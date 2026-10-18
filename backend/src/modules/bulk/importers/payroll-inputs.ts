/**
 * Payroll variable inputs & recoveries (incentive, canteen, guest house,
 * travel-advance, notice, misc) for a DRAFT run. Accepts the template layout
 * or the client's Report 4 pay register (one row per employee; each non-zero
 * variable column becomes an input).
 */
import { z } from 'zod';
import { assertCompanyInScope } from '../../../core/rbac/company-scope.js';
import { NotFoundError } from '../../../core/errors/index.js';
import { LAYOUT_WARNING, normalizeHeader, type AlternateLayout, type BulkImporter, type Cell } from '../../../core/bulk/index.js';
import { addRunInputs, enterableComponentCodes, runInputProblems } from '../../payroll-core/index.js';
import { attachEmployees, hasRowError, num, rowError, str } from '../helpers.js';

const context = z.object({ runId: z.coerce.number().int().positive() });
type Ctx = z.infer<typeof context>;

/** Report 4 variable columns → component codes. Engine-computed columns are never imported. */
const REPORT4_INPUTS: readonly [string, string][] = [
  ['INCENTIVE', 'INCENTIVE'],
  ['OTHER EARNINGS', 'OTHER_EARNINGS'],
  ['MISCELLANEOUS RECOVERY', 'MISC_RECOVERY'],
  ['CANTEEN RECOVERY', 'CANTEEN'],
  ['GUEST HOUSE DEDUCTION', 'GUEST_HOUSE'],
  ['TRAVEL ADVANCE RECOVERY', 'TRAVEL_ADV_RECOVERY'],
  ['NOTICE PERIOD RECOVERY', 'NOTICE_RECOVERY'],
];
/** Report 4 columns with money the HRMS has no input component for (warned, not imported). */
const REPORT4_UNMAPPED = ['GRATUITY', 'LEAVE ENCASHMENT', 'EX-GRATIA', 'HOLD SALARY', 'Performance-Linked Earnings', 'LOAN2'];

const report4InputsLayout: AlternateLayout = {
  name: 'Report 4 pay register',
  detect: (headers) => headers.includes('employeeno') && headers.includes('netpay') && headers.includes('paiddays'),
  map: (row) => {
    const ecode = str(row['employeeno']);
    if (ecode === '') return [];
    const month = str(row['payrollmonth']);
    const out: Record<string, Cell>[] = [];
    for (const [header, code] of REPORT4_INPUTS) {
      const raw = row[normalizeHeader(header)] ?? null;
      const amount = typeof raw === 'number' ? Math.abs(raw) : Math.abs(Number(String(raw ?? '').replace(/,/g, '')) || 0);
      if (amount > 0) out.push({ ecode, component_code: code, amount, note: `Report 4 ${header.toLowerCase()}${month ? ` ${month}` : ''}` });
    }
    const unmapped = REPORT4_UNMAPPED.filter((h) => Number(row[normalizeHeader(h)] ?? 0) !== 0);
    const first = out[0];
    if (unmapped.length > 0 && first) first[LAYOUT_WARNING] = `Also on this row but not imported (no HRMS input component): ${unmapped.join(', ')}`;
    return out;
  },
};

export const payrollInputsImporter: BulkImporter<Ctx> = {
  key: 'payroll-inputs',
  title: 'Payroll variable inputs and recoveries',
  description: 'Incentives, other earnings and recoveries (canteen, guest house, travel advance, notice, misc) for a draft payroll run.',
  permission: 'payroll.run.manage',
  contextSchema: context,
  contextFields: [{ key: 'runId', label: 'Payroll run (draft)', type: 'run' }],
  columns: [
    { key: 'ecode', header: 'Employee code', aliases: ['ecode', 'employee no', 'employeeno', 'emp code', 'emp id'], type: 'string', required: true, maxLength: 32, help: 'E-code of an employee in the run\'s company.' },
    { key: 'component_code', header: 'Component', aliases: ['component_code', 'component code', 'pay component'], type: 'string', required: true, help: 'Pay component code, e.g. INCENTIVE, CANTEEN, GUEST_HOUSE.' },
    { key: 'amount', header: 'Amount', aliases: ['amount (rs)', 'amount rupees', 'value'], type: 'money', required: true, min: 0.01, help: 'Positive amount in the entity currency.' },
    { key: 'note', header: 'Note', aliases: ['remarks', 'reason'], type: 'string', required: true, maxLength: 500, help: 'Why this input exists (shown to reviewers).' },
  ],
  instructions: [
    'Only for runs in DRAFT (before inputs are locked).',
    'You can also upload the Report 4 pay register as-is: each non-zero INCENTIVE / OTHER EARNINGS / recovery column becomes an input.',
    'PF, ESI, PT, TDS, LWF, loan EMI, BASIC/HRA and OT are computed by payroll and cannot be uploaded.',
  ],
  samples: [
    { ecode: 'RML033625', component_code: 'CANTEEN', amount: 1375, note: 'Canteen June 2026' },
    { ecode: 'RML033901', component_code: 'INCENTIVE', amount: 2500, note: 'Production incentive Q1' },
  ],
  layouts: [report4InputsLayout],
  dynamicOptions: async (db) => ({ component_code: await enterableComponentCodes(db) }),
  rowKey: (v) => [str(v['ecode']).toUpperCase(), str(v['component_code']).toUpperCase(), String(v['amount']), str(v['note']).toLowerCase()].join('|'),
  contextKey: (c) => `run:${String(c.runId)}`,
  authorize: async ({ db, context: c, actor }) => {
    const run = await db.selectFrom('pay.payroll_runs').select('company_id').where('id', '=', c.runId).executeTakeFirst();
    if (!run) throw new NotFoundError('Payroll run not found');
    await assertCompanyInScope(db, actor.scope, run.company_id);
    return run.company_id;
  },
  validate: async ({ db, context: c, actor }, rows) => {
    const run = await db.selectFrom('pay.payroll_runs').select('company_id').where('id', '=', c.runId).executeTakeFirstOrThrow();
    await attachEmployees(db, actor.scope, rows, { companyId: run.company_id });
    const candidates = rows.filter((r) => !hasRowError(r));
    const problems = await runInputProblems(db, c.runId, candidates.map((r) => ({
      employeeId: num(r.values['employee_id']), componentCode: str(r.values['component_code']).toUpperCase(), amountRupees: num(r.values['amount']), note: str(r.values['note']),
    })));
    const headers: Record<string, string> = { component_code: 'Component', ecode: 'Employee code', amount: 'Amount', note: 'Note' };
    for (const p of problems) {
      const row = candidates[p.index];
      if (row) rowError(row, headers[p.field] ?? null, p.message);
    }
  },
  commit: async ({ trx, context: c, actor }, rows) => {
    const res = await addRunInputs(trx, c.runId, rows.map((r) => ({
      employeeId: num(r.values['employee_id']), componentCode: str(r.values['component_code']).toUpperCase(), amountRupees: num(r.values['amount']), note: str(r.values['note']),
    })), actor.userId);
    return { created: res.inserted, updated: 0, skipped: 0 };
  },
};
