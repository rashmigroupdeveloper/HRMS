/**
 * Salary Assignment & History Service (PAY-02, PAY-07, PAY-16, SOW crosswalk).
 */
import type { Kysely } from 'kysely';
import type { Database, SalaryPhase, SalaryRevisionReason } from '../../../core/db/types.js';
import { writeAudit } from '../../../core/audit/audit.service.js';
import { fromRupees, toRupees, type Paise } from '../../../core/money/index.js';
import { getStructure } from '../structures/structure.service.js';
import { listComponents } from '../components/component.service.js';
import {
  resolveSalaryStructure,
  validateCtcBreakup,
  structureLineNode,
  type ComponentFormulaNode,
} from '../structures/dag-evaluator.js';
import {
  findEffectiveSalary,
  listSalaryHistory,
  insertSalaryRevision,
  type EmployeeSalaryRow,
} from './assignment.repository.js';
import { inTransaction } from '../../../core/db/database.js';

export interface AssignSalaryInput {
  employee_id: number;
  structure_id: number;
  effective_from: string; // YYYY-MM-DD
  annual_ctc_rupees: number;
  phase?: SalaryPhase | undefined;
  probation_percent?: number | null | undefined;
  revision_reason: SalaryRevisionReason;
}

export interface SalaryRevisionDiff {
  id: number;
  structure_id: number;
  structure_name?: string | undefined;
  effective_from: string;
  effective_to: string;
  annual_ctc_rupees: number;
  phase: SalaryPhase;
  probation_percent: number | null;
  revision_reason: SalaryRevisionReason | null;
  monthly_components: Record<string, number>;
  previous_annual_ctc_rupees?: number | undefined;
  ctc_change_percent?: number | undefined;
  ctc_delta_rupees?: number | undefined;
  retro_months_affected: string[];
}

export async function assignSalary(
  db: Kysely<Database>,
  input: AssignSalaryInput,
  actorUserId: number | null,
): Promise<EmployeeSalaryRow> {
  const structure = await getStructure(db, input.structure_id);
  if (!structure) {
    throw new Error(`Salary structure #${input.structure_id} not found`);
  }

  const employee = await db.selectFrom('core.employees').select('company_id').where('id', '=', input.employee_id).executeTakeFirst();
  if (!employee) throw new Error(`Employee #${input.employee_id} not found`);
  if (employee.company_id !== structure.company_id) {
    throw new Error(`Salary structure "${structure.name}" belongs to another company than the employee`);
  }

  const allComponents = await listComponents(db);
  const compMap = new Map(allComponents.map((c) => [c.code, c]));

  const nodes: ComponentFormulaNode[] = structure.components.map((item) => {
    const meta = compMap.get(item.component_code);
    if (!meta) {
      throw new Error(`Salary component '${item.component_code}' not found`);
    }
    return structureLineNode(item, meta);
  });

  const annualCtcPaise = fromRupees(input.annual_ctc_rupees);
  const phase: SalaryPhase = input.phase ?? 'confirmed';
  const probationPercent = phase === 'probation' ? (input.probation_percent ?? 80) : undefined;

  const evaluated = resolveSalaryStructure({
    nodes,
    annualCtcPaise,
    probationPercent: probationPercent ?? undefined,
  });

  // Strict CTC verification. The annual CTC is the CONFIRMED package; a probation
  // assignment stores the scaled amounts, so the check runs on the unscaled breakup (P-19).
  const check = validateCtcBreakup({
    annualCtcPaise,
    monthlyComponents:
      probationPercent === undefined ? evaluated.monthly : resolveSalaryStructure({ nodes, annualCtcPaise }).monthly,
    componentNodes: nodes,
  });
  if (!check.valid) {
    throw new Error(`Cannot assign salary: ${check.message}`);
  }

  // Store resolved components as { [code]: amount_paise }
  const componentAmounts: Record<string, number> = {};
  for (const [code, paiseAmt] of Object.entries(evaluated.monthly)) {
    componentAmounts[code] = paiseAmt;
  }

  return inTransaction(db, async (trx) => {
    const inserted = await insertSalaryRevision(trx, {
      employee_id: input.employee_id,
      structure_id: input.structure_id,
      effective_from: input.effective_from,
      annual_ctc: input.annual_ctc_rupees.toFixed(2),
      phase,
      component_amounts: componentAmounts,
      probation_percent: probationPercent !== undefined ? probationPercent.toFixed(2) : null,
      revision_reason: input.revision_reason,
      approved_by: actorUserId,
    });

    await writeAudit(trx, {
      actorUserId,
      action: 'employee_salary.assign',
      entity: 'pay.employee_salaries',
      entityId: inserted.id,
      newValue: JSON.stringify({
        employee_id: input.employee_id,
        effective_from: input.effective_from,
        annual_ctc: input.annual_ctc_rupees,
        phase,
        revision_reason: input.revision_reason,
      }),
    });

    return inserted;
  });
}

/**
 * Get current effective salary for an employee.
 */
export async function getEffectiveSalary(
  db: Kysely<Database>,
  employeeId: number,
  asOfDate?: string,
): Promise<{
  salary: EmployeeSalaryRow | null;
  structure: { id: number; name: string } | null;
  componentsInRupees: Record<string, number>;
  annualCtcRupees: number;
}> {
  const row = await findEffectiveSalary(db, employeeId, asOfDate);
  if (!row) {
    return {
      salary: null,
      structure: null,
      componentsInRupees: {},
      annualCtcRupees: 0,
    };
  }

  const structure = await getStructure(db, row.structure_id);
  const componentAmounts = row.component_amounts;
  const componentsInRupees: Record<string, number> = {};
  for (const [code, amtPaise] of Object.entries(componentAmounts)) {
    componentsInRupees[code] = toRupees(amtPaise as Paise);
  }

  return {
    salary: row,
    structure: structure ? { id: structure.id, name: structure.name } : null,
    componentsInRupees,
    annualCtcRupees: parseFloat(row.annual_ctc),
  };
}

/**
 * Helper to compute affected retro calendar months between effectiveFrom and current month.
 */
function calculateRetroMonths(effectiveFromStr: string, asOfDate: Date = new Date()): string[] {
  const effectiveDate = new Date(effectiveFromStr);
  const currentMonthStart = new Date(asOfDate.getFullYear(), asOfDate.getMonth(), 1);

  if (effectiveDate >= currentMonthStart) {
    return [];
  }

  const affected: string[] = [];
  const cursor = new Date(effectiveDate.getFullYear(), effectiveDate.getMonth(), 1);
  while (cursor < currentMonthStart) {
    const yyyy = cursor.getFullYear();
    const mm = String(cursor.getMonth() + 1).padStart(2, '0');
    affected.push(`${yyyy}-${mm}-01`);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return affected;
}

/**
 * Get revision history with diff comparisons and retro period preview.
 */
export async function getSalaryRevisionHistory(
  db: Kysely<Database>,
  employeeId: number,
): Promise<SalaryRevisionDiff[]> {
  const revisions = await listSalaryHistory(db, employeeId);
  const results: SalaryRevisionDiff[] = [];

  for (let i = 0; i < revisions.length; i++) {
    const rev = revisions[i];
    if (!rev) continue;
    const prev = i + 1 < revisions.length ? revisions[i + 1] : undefined;

    const currentCtc = parseFloat(rev.annual_ctc);
    const prevCtc = prev ? parseFloat(prev.annual_ctc) : undefined;
    const ctcDelta = prevCtc !== undefined ? currentCtc - prevCtc : undefined;
    const ctcPercent = prevCtc !== undefined && prevCtc > 0 ? ((currentCtc - prevCtc) / prevCtc) * 100 : undefined;

    const rawAmounts = rev.component_amounts;
    const monthlyInRupees: Record<string, number> = {};
    for (const [code, amtPaise] of Object.entries(rawAmounts)) {
      monthlyInRupees[code] = toRupees(amtPaise as Paise);
    }

    const effectiveFromStr = new Date(rev.effective_from).toISOString().slice(0, 10);
    const effectiveToStr = new Date(rev.effective_to).toISOString().slice(0, 10);

    const retroMonths = calculateRetroMonths(effectiveFromStr);

    const diff: SalaryRevisionDiff = {
      id: rev.id,
      structure_id: rev.structure_id,
      effective_from: effectiveFromStr,
      effective_to: effectiveToStr,
      annual_ctc_rupees: currentCtc,
      phase: rev.phase,
      probation_percent: rev.probation_percent ? parseFloat(rev.probation_percent) : null,
      revision_reason: rev.revision_reason,
      monthly_components: monthlyInRupees,
      retro_months_affected: retroMonths,
    };

    if (prevCtc !== undefined) diff.previous_annual_ctc_rupees = prevCtc;
    if (ctcPercent !== undefined) diff.ctc_change_percent = parseFloat(ctcPercent.toFixed(2));
    if (ctcDelta !== undefined) diff.ctc_delta_rupees = parseFloat(ctcDelta.toFixed(2));

    results.push(diff);
  }

  return results;
}

/**
 * Auto-switch employee from probation to confirmed salary on confirmation date (PAY-02, LC-04).
 */
export async function autoSwitchConfirmation(
  db: Kysely<Database>,
  employeeId: number,
  confirmationDate: string,
  actorUserId: number | null,
): Promise<EmployeeSalaryRow | null> {
  const current = await findEffectiveSalary(db, employeeId, confirmationDate);
  if (current?.phase !== 'probation') {
    return null;
  }

  const annualCtc = parseFloat(current.annual_ctc);

  return assignSalary(
    db,
    {
      employee_id: employeeId,
      structure_id: current.structure_id,
      effective_from: confirmationDate,
      annual_ctc_rupees: annualCtc,
      phase: 'confirmed',
      probation_percent: null,
      revision_reason: 'confirmation',
    },
    actorUserId,
  );
}
