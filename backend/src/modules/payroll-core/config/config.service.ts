/**
 * Payroll configuration without code or SQL (payroll-configurability audit):
 * effective-dated statutory parameters (PF/ESIC/OT/bonus), PT slab sets per
 * state, SAP GL mappings and per-run variable inputs (incentive, canteen,
 * guest house, notice and misc recoveries) incl. CSV bulk upload.
 *
 * Rules shared by every editor:
 * - Statutory data is versioned by effective month: a change inserts a new
 *   version, never edits history, so finalized months recompute identically.
 * - A version may not start in a month that already has a finalized/paid run
 *   (no retro edits of closed periods; reopen the run first).
 * - Every change is written to the audit hash chain with old → new values.
 */
import { sql, type Kysely } from 'kysely';
import type { Database } from '../../../core/db/types.js';
import { writeAudit } from '../../../core/audit/audit.service.js';
import { inTransaction } from '../../../core/db/database.js';
import { ConflictError, DomainError, NotFoundError } from '../../../core/errors/index.js';
import { formatDbDate } from '../../../core/dates.js';
import { decimalRupees, parseRupees } from '../../../core/money/index.js';

type Db = Kysely<Database>;

/** Parameters the engine reads (statutory-context.ts); anything else is rejected. */
export const STATUTORY_PARAMS: Record<string, readonly string[]> = {
  PF: ['ee_rate_pct', 'er_rate_pct', 'eps_rate_pct', 'wage_ceiling', 'eps_cap', 'edli_rate_pct', 'edli_cap', 'admin_rate_pct', 'admin_min_establishment'],
  ESIC: ['ee_rate_pct', 'er_rate_pct', 'wage_ceiling'],
  OT: ['hour_divisor', 'multiplier'],
  BONUS: ['min_rate_pct'],
};

/** Statutory deductions the engine computes itself — never entered by hand. */
const ENGINE_COMPONENTS = new Set(['PF_EE', 'PF_ER', 'EPS_ER', 'EDLI', 'PF_ADMIN', 'ESI_EE', 'ESI_ER', 'PT', 'TDS', 'LWF_EE', 'LWF_ER', 'LOAN_EMI', 'GRATUITY_ACCRUAL', 'BASIC', 'HRA', 'OT']);

function assertMonthStart(value: string, label: string): void {
  if (!/^\d{4}-\d{2}-01$/.test(value)) throw new DomainError(`${label} must be the first day of a month (YYYY-MM-01)`);
}

async function assertNoClosedRunFrom(db: Db, effectiveFrom: string): Promise<void> {
  const closed = await db.selectFrom('pay.payroll_runs').select(['id', 'month'])
    .where('status', 'in', ['finalized', 'paid']).where('month', '>=', sql<Date>`${effectiveFrom}::date`)
    .orderBy('month').executeTakeFirst();
  if (closed) {
    throw new ConflictError(`Payroll for ${formatDbDate(closed.month).slice(0, 7)} is already finalized; a change cannot take effect from ${effectiveFrom.slice(0, 7)}. Choose a later month or reopen that run first.`);
  }
}

// ── Statutory parameters ────────────────────────────────────────────────────
export async function listStatutoryRates(db: Db) {
  const rows = await db.selectFrom('pay.statutory_rates').selectAll().orderBy('scheme').orderBy('param').orderBy('effective_from', 'desc').execute();
  return rows.map((r) => ({ id: r.id, scheme: r.scheme, param: r.param, value: Number(r.value), effectiveFrom: formatDbDate(r.effective_from), sourceNote: r.source_note }));
}

export async function addStatutoryRate(db: Db, input: { scheme: string; param: string; value: number; effectiveFrom: string; sourceNote: string; actorUserId: number }): Promise<{ id: number }> {
  const scheme = input.scheme.toUpperCase();
  if (!STATUTORY_PARAMS[scheme]?.includes(input.param)) throw new DomainError(`Unknown statutory parameter ${scheme}.${input.param}`);
  assertMonthStart(input.effectiveFrom, 'Effective from');
  if (!Number.isFinite(input.value) || input.value < 0) throw new DomainError('Value must be a non-negative number');
  if (input.param.endsWith('_pct') && input.value > 100) throw new DomainError('A percentage cannot exceed 100');
  return inTransaction(db, async (trx) => {
    await assertNoClosedRunFrom(trx, input.effectiveFrom);
    const previous = await trx.selectFrom('pay.statutory_rates').select(['value', 'effective_from']).where('scheme', '=', scheme).where('param', '=', input.param)
      .where('effective_from', '<=', sql<Date>`${input.effectiveFrom}::date`).orderBy('effective_from', 'desc').executeTakeFirst();
    const row = await trx.insertInto('pay.statutory_rates')
      .values({ scheme, param: input.param, value: input.value.toFixed(4), effective_from: sql<Date>`${input.effectiveFrom}::date`, source_note: input.sourceNote })
      .onConflict((oc) => oc.columns(['scheme', 'param', 'effective_from']).doUpdateSet({ value: input.value.toFixed(4), source_note: input.sourceNote }))
      .returning('id').executeTakeFirstOrThrow();
    await writeAudit(trx, {
      actorUserId: input.actorUserId, action: 'statutory_rate_set', entity: 'pay.statutory_rates', entityId: row.id,
      oldValue: previous ? JSON.stringify({ value: Number(previous.value), effectiveFrom: formatDbDate(previous.effective_from) }) : null,
      newValue: JSON.stringify({ scheme, param: input.param, value: input.value, effectiveFrom: input.effectiveFrom, sourceNote: input.sourceNote }),
    });
    return { id: row.id };
  });
}

// ── PT slabs ────────────────────────────────────────────────────────────────
export async function listPtSlabs(db: Db) {
  const rows = await db.selectFrom('pay.pt_slabs').selectAll().orderBy('state_code').orderBy('effective_from', 'desc').orderBy('min_monthly').execute();
  return rows.map((r) => ({ id: r.id, stateCode: r.state_code, minMonthly: Number(r.min_monthly), maxMonthly: r.max_monthly === null ? null : Number(r.max_monthly), amount: Number(r.amount), effectiveFrom: formatDbDate(r.effective_from), basis: r.basis }));
}

export interface PtSlabInput { minMonthly: number; maxMonthly: number | null; amount: number }

export async function setPtSlabs(db: Db, input: { stateCode: string; effectiveFrom: string; basis: 'earned_monthly' | 'contracted_monthly'; slabs: PtSlabInput[]; actorUserId: number }): Promise<{ count: number }> {
  const state = input.stateCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(state)) throw new DomainError('State code must be two letters (e.g. WB, OD)');
  assertMonthStart(input.effectiveFrom, 'Effective from');
  const slabs = [...input.slabs].sort((a, b) => a.minMonthly - b.minMonthly);
  // Bands must be contiguous, non-overlapping, and only the last may be open-ended.
  slabs.forEach((s, i) => {
    if (s.amount < 0 || s.minMonthly < 0) throw new DomainError('Slab amounts and limits cannot be negative');
    const next = slabs[i + 1];
    if (s.maxMonthly === null && next) throw new DomainError('Only the highest slab can be open-ended');
    if (s.maxMonthly !== null && s.maxMonthly < s.minMonthly) throw new DomainError(`Slab ${String(s.minMonthly)}–${String(s.maxMonthly)} ends before it starts`);
    if (next && s.maxMonthly !== null && next.minMonthly <= s.maxMonthly) throw new DomainError(`Slabs overlap at ${String(next.minMonthly)}`);
  });
  return inTransaction(db, async (trx) => {
    await assertNoClosedRunFrom(trx, input.effectiveFrom);
    const old = await trx.selectFrom('pay.pt_slabs').select(['min_monthly', 'max_monthly', 'amount']).where('state_code', '=', state)
      .where('effective_from', '=', sql<Date>`${input.effectiveFrom}::date`).execute();
    await trx.deleteFrom('pay.pt_slabs').where('state_code', '=', state).where('effective_from', '=', sql<Date>`${input.effectiveFrom}::date`).execute();
    if (slabs.length > 0) {
      await trx.insertInto('pay.pt_slabs').values(slabs.map((s) => ({
        state_code: state, min_monthly: s.minMonthly.toFixed(2), max_monthly: s.maxMonthly === null ? null : s.maxMonthly.toFixed(2),
        amount: s.amount.toFixed(2), effective_from: sql<Date>`${input.effectiveFrom}::date`, basis: input.basis,
      }))).execute();
    }
    await writeAudit(trx, {
      actorUserId: input.actorUserId, action: 'pt_slabs_set', entity: 'pay.pt_slabs', entityId: null,
      oldValue: JSON.stringify(old), newValue: JSON.stringify({ state, effectiveFrom: input.effectiveFrom, basis: input.basis, slabs }),
    });
    return { count: slabs.length };
  });
}

// ── SAP GL mapping ──────────────────────────────────────────────────────────
export async function listGlAccounts(db: Db) {
  const rows = await db.selectFrom('pay.gl_accounts').selectAll().orderBy('company_code').orderBy('component_code').execute();
  return rows.map((r) => ({ id: r.id, companyCode: r.company_code, plantCode: r.plant_code, costCenterCode: r.cost_center_code, componentCode: r.component_code, glCode: r.gl_code }));
}

export async function upsertGlAccount(db: Db, input: { companyCode: string; plantCode: string; costCenterCode: string; componentCode: string; glCode: string; actorUserId: number }): Promise<{ id: number }> {
  return inTransaction(db, async (trx) => {
    const component = await trx.selectFrom('pay.salary_components').select('code').where('code', '=', input.componentCode).executeTakeFirst();
    if (!component) throw new NotFoundError(`Salary component ${input.componentCode} does not exist`);
    const key = { company_code: input.companyCode, plant_code: input.plantCode, cost_center_code: input.costCenterCode, component_code: input.componentCode };
    const old = await trx.selectFrom('pay.gl_accounts').select('gl_code').where('company_code', '=', key.company_code).where('plant_code', '=', key.plant_code)
      .where('cost_center_code', '=', key.cost_center_code).where('component_code', '=', key.component_code).executeTakeFirst();
    const row = await trx.insertInto('pay.gl_accounts').values({ ...key, gl_code: input.glCode.trim() })
      .onConflict((oc) => oc.columns(['company_code', 'plant_code', 'cost_center_code', 'component_code']).doUpdateSet({ gl_code: input.glCode.trim() }))
      .returning('id').executeTakeFirstOrThrow();
    await writeAudit(trx, { actorUserId: input.actorUserId, action: 'gl_mapping_set', entity: 'pay.gl_accounts', entityId: row.id, oldValue: old?.gl_code ?? null, newValue: JSON.stringify({ ...key, gl_code: input.glCode.trim() }) });
    return { id: row.id };
  });
}

// ── Variable inputs per run ─────────────────────────────────────────────────
export interface VariableInput { employeeId: number; componentCode: string; amountRupees: number; note: string }

/** Components HR may enter as variable inputs (not engine-computed, not employer cost). */
export async function enterableComponentCodes(db: Db): Promise<string[]> {
  const rows = await db.selectFrom('pay.salary_components').select(['code', 'kind']).where('is_active', '=', true).orderBy('display_order').execute();
  return rows.filter((r) => r.kind !== 'employer_contribution' && !ENGINE_COMPONENTS.has(r.code)).map((r) => r.code);
}

async function openRun(db: Db, runId: number, lock = false) {
  const run = await db.selectFrom('pay.payroll_runs').select(['id', 'status', 'company_id']).where('id', '=', runId)
    .$if(lock, query => query.forUpdate()).executeTakeFirst();
  if (!run) throw new NotFoundError('Payroll run not found');
  if (run.status !== 'draft') throw new ConflictError('Variable inputs can only change while the run is a draft (before inputs are locked)');
  return run;
}

export async function listRunInputs(db: Db, runId: number) {
  const rows = await db.selectFrom('pay.inputs as i').innerJoin('core.employees as e', 'e.id', 'i.employee_id')
    .select(['i.id', 'i.employee_id', 'e.ecode', 'e.first_name', 'e.last_name', 'i.component_code', 'i.amount', 'i.note'])
    .where('i.run_id', '=', runId).orderBy('e.ecode').orderBy('i.component_code').execute();
  return rows.map((r) => ({ id: r.id, employeeId: r.employee_id, ecode: r.ecode, name: [r.first_name, r.last_name].filter(Boolean).join(' '), componentCode: r.component_code, amountRupees: Number(r.amount), note: r.note }));
}

/**
 * Row-level problems for variable inputs against a run (shared by the JSON
 * API, the CSV path and the Excel bulk importer so the rules never diverge).
 */
export async function runInputProblems(db: Db, runId: number, inputs: readonly VariableInput[]): Promise<{ index: number; field: string; message: string }[]> {
  const run = await openRun(db, runId);
  const problems: { index: number; field: string; message: string }[] = [];
  if (inputs.length === 0) return problems;
  const codes = [...new Set(inputs.map((i) => i.componentCode))];
  const components = await db.selectFrom('pay.salary_components').select(['code', 'kind', 'is_active']).where('code', 'in', codes).execute();
  const byCode = new Map(components.map((c) => [c.code, c]));
  const empIds = [...new Set(inputs.map((i) => i.employeeId))];
  const emps = await db.selectFrom('core.employees').select(['id', 'company_id']).where('id', 'in', empIds).execute();
  const empCompany = new Map(emps.map((e) => [e.id, e.company_id]));
  inputs.forEach((inp, index) => {
    const comp = byCode.get(inp.componentCode);
    if (!comp) problems.push({ index, field: 'component_code', message: `unknown component ${inp.componentCode}` });
    else if (comp.kind === 'employer_contribution' || ENGINE_COMPONENTS.has(comp.code)) problems.push({ index, field: 'component_code', message: `${inp.componentCode} is computed by payroll and cannot be entered` });
    else if (!comp.is_active) problems.push({ index, field: 'component_code', message: `${inp.componentCode} is inactive` });
    if (empCompany.get(inp.employeeId) !== run.company_id) problems.push({ index, field: 'ecode', message: `employee ${String(inp.employeeId)} is not in this run's company` });
    // Parse the decimal DTO representation, not a binary-float product (1.09 *
    // 100 is not exactly 109). The shared Money boundary also checks safe range.
    try {
      if (parseRupees(String(inp.amountRupees)) <= 0) throw new RangeError('Non-positive input');
    } catch { problems.push({ index, field: 'amount', message: 'amount must be a positive rupee value with at most 2 decimals within the safe money range' }); }
    if (inp.note.trim().length < 2) problems.push({ index, field: 'note', message: 'a note is required' });
  });
  return problems;
}

/** Validates and inserts inputs atomically: one bad row rejects the whole batch with every problem listed. */
export async function addRunInputs(db: Db, runId: number, inputs: VariableInput[], actorUserId: number): Promise<{ inserted: number }> {
  if (inputs.length === 0) throw new DomainError('Nothing to add');
  return inTransaction(db, async (trx) => {
    await openRun(trx, runId, true);
    const problems = await runInputProblems(trx, runId, inputs);
    if (problems.length > 0) throw new DomainError(problems.slice(0, 20).map((p) => `Row ${String(p.index + 1)}: ${p.message}`).join('; '));
    const rows = inputs.map((i) => ({ run_id: runId, employee_id: i.employeeId, component_code: i.componentCode, amount: decimalRupees(parseRupees(String(i.amountRupees))), note: i.note.trim(), entered_by: actorUserId }));
    for (let start = 0; start < rows.length; start += 1000) await trx.insertInto('pay.inputs').values(rows.slice(start, start + 1000)).execute();
    await writeAudit(trx, { actorUserId, action: 'payroll_inputs_added', entity: 'pay.payroll_runs', entityId: runId, oldValue: null, newValue: JSON.stringify({ count: inputs.length, inputs: inputs.slice(0, 200) }) });
    return { inserted: inputs.length };
  });
}

export async function removeRunInput(db: Db, runId: number, inputId: number, actorUserId: number): Promise<void> {
  await inTransaction(db, async (trx) => {
    await openRun(trx, runId, true);
    const row = await trx.deleteFrom('pay.inputs').where('id', '=', inputId).where('run_id', '=', runId).returningAll().executeTakeFirst();
    if (!row) throw new NotFoundError('Input not found on this run');
    await writeAudit(trx, { actorUserId, action: 'payroll_input_removed', entity: 'pay.payroll_runs', entityId: runId, oldValue: JSON.stringify({ employeeId: row.employee_id, componentCode: row.component_code, amount: row.amount, note: row.note }), newValue: null });
  });
}

/** Splits one CSV line; honours "quoted, values" and "" escapes. Cells are trimmed. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line.charAt(i);
    if (quoted) {
      if (ch === '"' && line.charAt(i + 1) === '"') { cur += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { out.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

/**
 * CSV bulk upload: header `ecode,component_code,amount,note` (any order,
 * case-insensitive). Employee codes resolve within the run's company.
 */
export async function parseInputsCsv(db: Db, runId: number, csv: string): Promise<VariableInput[]> {
  const run = await openRun(db, runId);
  const lines = csv.replace(/^\uFEFF/, '').split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const header = (lines.shift() ?? '').split(',').map((h) => h.trim().toLowerCase());
  const col = (name: string): number => {
    const i = header.indexOf(name);
    if (i < 0) throw new DomainError(`CSV header must include ${name} (expected: ecode,component_code,amount,note)`);
    return i;
  };
  const [ci, cc, ca, cn] = [col('ecode'), col('component_code'), col('amount'), col('note')];
  if (lines.length === 0) throw new DomainError('The CSV has no data rows');
  if (lines.length > 5000) throw new DomainError('Upload at most 5,000 rows at a time');
  const rows = lines.map(splitCsvLine);
  const ecodes = [...new Set(rows.map((r) => r[ci] ?? ''))];
  const emps = await db.selectFrom('core.employees').select(['id', 'ecode']).where('company_id', '=', run.company_id).where('ecode', 'in', ecodes).execute();
  const idByCode = new Map(emps.map((e) => [e.ecode, e.id]));
  const missing = ecodes.filter((c) => !idByCode.has(c));
  if (missing.length > 0) throw new DomainError(`Unknown employee codes for this company: ${missing.slice(0, 10).join(', ')}`);
  return rows.map((r) => ({ employeeId: idByCode.get(r[ci] ?? '') ?? 0, componentCode: (r[cc] ?? '').toUpperCase(), amountRupees: Number(r[ca]), note: (r[cn] ?? '').trim() }));
}
