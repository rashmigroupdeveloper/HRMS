/**
 * Salary Structure Service (PAY-01, SOW crosswalk, SOW crosswalk).
 */
import type { Kysely, Transaction } from 'kysely';
import type { Database, SalaryComponentItem } from '../../../core/db/types.js';
import { writeAudit } from '../../../core/audit/audit.service.js';
import { fromRupees, toRupees } from '../../../core/money/index.js';
import { listComponents } from '../components/component.service.js';
import {
  buildAndValidateDag,
  resolveSalaryStructure,
  validateCtcBreakup,
  structureLineNode,
  type ComponentFormulaNode,
  type EvaluatedBreakup,
} from './dag-evaluator.js';

export interface SalaryStructureModel {
  id: number;
  name: string;
  company_id: number;
  description: string | null;
  components: SalaryComponentItem[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateStructureInput {
  name: string;
  company_id: number;
  description?: string | null | undefined;
  components: SalaryComponentItem[];
  is_active?: boolean | undefined;
}

export interface UpdateStructureInput {
  name?: string | undefined;
  company_id?: number | undefined;
  description?: string | null | undefined;
  components?: SalaryComponentItem[] | undefined;
  is_active?: boolean | undefined;
}

export interface PreviewBreakupInput {
  structure_id?: number | undefined;
  components?: SalaryComponentItem[] | undefined;
  annual_ctc_rupees: number;
  probation_percent?: number | undefined;
}

export interface StructureBreakupResponse {
  monthly: Record<string, number>; // in Rupees
  annual: Record<string, number>; // in Rupees
  monthlyGross: number;
  annualGross: number;
  monthlyEmployerCost: number;
  annualEmployerCost: number;
  monthlyCtc: number;
  annualCtc: number;
  monthlyDeductions: number;
  monthlyNet: number;
  evaluationOrder: string[];
  validation: {
    valid: boolean;
    diffPaise: number;
    message?: string | undefined;
  };
}

function formatIso(val: unknown): string {
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'string') return val;
  return new Date(val as number).toISOString();
}

export async function listStructures(
  db: Kysely<Database> | Transaction<Database>,
  options: { companyId?: number | undefined; activeOnly?: boolean | undefined } = {},
): Promise<SalaryStructureModel[]> {
  let query = db.selectFrom('pay.salary_structures').selectAll().orderBy('name', 'asc');
  if (options.companyId) {
    query = query.where('company_id', '=', options.companyId);
  }
  if (options.activeOnly) {
    query = query.where('is_active', '=', true);
  }
  const rows = await query.execute();
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    company_id: r.company_id,
    description: r.description,
    components: r.components,
    is_active: r.is_active,
    created_at: formatIso(r.created_at),
    updated_at: formatIso(r.updated_at),
  }));
}

export async function getStructure(
  db: Kysely<Database> | Transaction<Database>,
  id: number,
): Promise<SalaryStructureModel | null> {
  const row = await db
    .selectFrom('pay.salary_structures')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst();
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    company_id: row.company_id,
    description: row.description,
    components: row.components,
    is_active: row.is_active,
    created_at: formatIso(row.created_at),
    updated_at: formatIso(row.updated_at),
  };
}

/**
 * Helper to build ComponentFormulaNodes for DAG validation and resolution.
 */
async function assembleComponentNodes(
  db: Kysely<Database> | Transaction<Database>,
  items: SalaryComponentItem[],
): Promise<ComponentFormulaNode[]> {
  const allComponents = await listComponents(db);
  const compMap = new Map(allComponents.map((c) => [c.code, c]));

  return items.map((item) => {
    const meta = compMap.get(item.component_code);
    if (!meta) {
      throw new Error(`Salary component '${item.component_code}' does not exist in component catalog`);
    }
    return structureLineNode(item, meta);
  });
}

export async function createStructure(
  db: Kysely<Database>,
  input: CreateStructureInput,
  actorUserId: number | null,
): Promise<SalaryStructureModel> {
  const nodes = await assembleComponentNodes(db, input.components);
  buildAndValidateDag(nodes);

  const [inserted] = await db
    .insertInto('pay.salary_structures')
    .values({
      name: input.name,
      company_id: input.company_id,
      description: input.description ?? null,
      components: JSON.stringify(input.components) as unknown as SalaryComponentItem[],
      is_active: input.is_active ?? true,
    })
    .returningAll()
    .execute();

  if (!inserted) {
    throw new Error('Failed to create salary structure');
  }

  await writeAudit(db, {
    actorUserId,
    action: 'salary_structure.create',
    entity: 'pay.salary_structures',
    entityId: inserted.id,
    newValue: JSON.stringify(inserted),
  });

  return {
    id: inserted.id,
    name: inserted.name,
    company_id: inserted.company_id,
    description: inserted.description,
    components: inserted.components,
    is_active: inserted.is_active,
    created_at: formatIso(inserted.created_at),
    updated_at: formatIso(inserted.updated_at),
  };
}

export async function updateStructure(
  db: Kysely<Database>,
  id: number,
  input: UpdateStructureInput,
  actorUserId: number | null,
): Promise<SalaryStructureModel> {
  const existing = await getStructure(db, id);
  if (!existing) {
    throw new Error(`Salary structure with id ${id} not found`);
  }

  if (input.components) {
    const nodes = await assembleComponentNodes(db, input.components);
    buildAndValidateDag(nodes);
  }

  const updateValues: Record<string, unknown> = {
    ['updated_at']: new Date().toISOString(),
  };
  if (input.name !== undefined) updateValues['name'] = input.name;
  if (input.company_id !== undefined) updateValues['company_id'] = input.company_id;
  if (input.description !== undefined) updateValues['description'] = input.description;
  if (input.components !== undefined) updateValues['components'] = JSON.stringify(input.components);
  if (input.is_active !== undefined) updateValues['is_active'] = input.is_active;

  const [updated] = await db
    .updateTable('pay.salary_structures')
    .set(updateValues)
    .where('id', '=', id)
    .returningAll()
    .execute();

  if (!updated) {
    throw new Error('Failed to update salary structure');
  }

  await writeAudit(db, {
    actorUserId,
    action: 'salary_structure.update',
    entity: 'pay.salary_structures',
    entityId: updated.id,
    oldValue: JSON.stringify(existing),
    newValue: JSON.stringify(updated),
  });

  return {
    id: updated.id,
    name: updated.name,
    company_id: updated.company_id,
    description: updated.description,
    components: updated.components,
    is_active: updated.is_active,
    created_at: formatIso(updated.created_at),
    updated_at: formatIso(updated.updated_at),
  };
}

export async function previewStructureBreakup(
  db: Kysely<Database> | Transaction<Database>,
  input: PreviewBreakupInput,
): Promise<StructureBreakupResponse> {
  let components = input.components;
  if (!components && input.structure_id) {
    const struct = await getStructure(db, input.structure_id);
    if (!struct) {
      throw new Error(`Salary structure with id ${input.structure_id} not found`);
    }
    components = struct.components;
  }

  if (!components || components.length === 0) {
    throw new Error('Salary structure components must be provided for preview');
  }

  const nodes = await assembleComponentNodes(db, components);
  const annualCtcPaise = fromRupees(input.annual_ctc_rupees);

  const evaluated: EvaluatedBreakup = resolveSalaryStructure({
    nodes,
    annualCtcPaise,
    probationPercent: input.probation_percent,
  });

  const validation = validateCtcBreakup({
    annualCtcPaise,
    monthlyComponents: evaluated.monthly,
    componentNodes: nodes,
  });

  const monthlyRupees: Record<string, number> = {};
  const annualRupees: Record<string, number> = {};
  for (const [code, p] of Object.entries(evaluated.monthly)) {
    monthlyRupees[code] = toRupees(p);
  }
  for (const [code, p] of Object.entries(evaluated.annual)) {
    annualRupees[code] = toRupees(p);
  }

  return {
    monthly: monthlyRupees,
    annual: annualRupees,
    monthlyGross: toRupees(evaluated.monthlyGross),
    annualGross: toRupees(evaluated.annualGross),
    monthlyEmployerCost: toRupees(evaluated.monthlyEmployerCost),
    annualEmployerCost: toRupees(evaluated.annualEmployerCost),
    monthlyCtc: toRupees(evaluated.monthlyCtc),
    annualCtc: toRupees(evaluated.annualCtc),
    monthlyDeductions: toRupees(evaluated.monthlyDeductions),
    monthlyNet: toRupees(evaluated.monthlyNet),
    evaluationOrder: evaluated.evaluationOrder,
    validation,
  };
}
