/** Legacy loan opening balances (SAP / greytHR / Adrenalin) — one row per running loan. */
import { z } from 'zod';
import { writeAudit } from '../../../core/audit/audit.service.js';
import type { BulkImporter } from '../../../core/bulk/index.js';
import { LoansService } from '../../loans/index.js';
import { attachEmployees, hasRowError, num, rowError, str } from '../helpers.js';

const noContext = z.object({}).strict();
type NoCtx = z.infer<typeof noContext>;
const LOAN_TYPES = ['loan_diminishing', 'loan_flat', 'emi_no_interest', 'salary_advance', 'travel_advance'] as const;
type LoanType = (typeof LOAN_TYPES)[number];

export const legacyLoansImporter: BulkImporter<NoCtx> = {
  key: 'loans',
  title: 'Loan opening balances',
  description: 'Running loans and advances migrated from SAP / greytHR, recovered by payroll from the start month.',
  permission: 'payroll.run.manage',
  contextSchema: noContext,
  contextFields: [],
  columns: [
    { key: 'ecode', header: 'Employee code', aliases: ['ecode', 'employee no', 'employeeno'], type: 'string', required: true, help: 'E-code.' },
    { key: 'loan_type', header: 'Loan type', type: 'enum', required: true, options: LOAN_TYPES, help: 'How the loan amortises.' },
    { key: 'original_principal', header: 'Original principal', aliases: ['principal', 'sanctioned amount'], type: 'money', required: true, min: 1, help: 'Amount originally sanctioned.' },
    { key: 'outstanding', header: 'Outstanding', aliases: ['outstanding balance', 'balance'], type: 'money', required: true, min: 0, help: 'Balance still to recover at go-live.' },
    { key: 'interest_rate', header: 'Interest % p.a.', aliases: ['interest rate', 'rate'], type: 'number', required: true, min: 0, max: 36, help: 'Annual rate; 0 for interest-free.' },
    { key: 'emi', header: 'Monthly EMI', aliases: ['emi', 'installment'], type: 'money', required: true, min: 1, help: 'Monthly recovery.' },
    { key: 'remaining_tenure', header: 'Remaining months', aliases: ['remaining tenure', 'tenure'], type: 'integer', required: true, min: 1, max: 360, help: 'Instalments left.' },
    { key: 'start_month', header: 'Recover from', aliases: ['start month', 'start'], type: 'date', required: true, help: 'First payroll month to recover (YYYY-MM-01).' },
    { key: 'source_reference', header: 'Legacy reference', aliases: ['source reference', 'sap loan no', 'reference'], type: 'string', required: true, maxLength: 64, help: 'Loan number in the old system (used to block double imports).' },
  ],
  instructions: ['Legacy reference must be unique per employee; re-importing the same loan is refused.', 'Outstanding cannot exceed the original principal.'],
  samples: [{ ecode: 'RML033625', loan_type: 'emi_no_interest', original_principal: 60000, outstanding: 36000, interest_rate: 0, emi: 5000, remaining_tenure: 8, start_month: '2026-11-01', source_reference: 'SAP-LN-104233' }],
  rowKey: (v) => `${str(v['ecode']).toUpperCase()}|${str(v['source_reference']).toUpperCase()}`,
  contextKey: () => 'legacy-loans',
  authorize: () => Promise.resolve(null),
  validate: async ({ db, actor }, rows) => {
    await attachEmployees(db, actor.scope, rows);
    const ok = rows.filter((r) => !hasRowError(r));
    const existing = ok.length === 0 ? [] : await db.selectFrom('pay.loans').select(['employee_id', 'source_reference'])
      .where('employee_id', 'in', [...new Set(ok.map((r) => num(r.values['employee_id'])))]).where('source_reference', 'is not', null).execute();
    const taken = new Set(existing.map((e) => `${String(e.employee_id)}|${(e.source_reference ?? '').toUpperCase()}`));
    for (const row of ok) {
      if (num(row.values['outstanding']) > num(row.values['original_principal'])) rowError(row, 'Outstanding', 'Cannot exceed the original principal');
      if (!/^\d{4}-\d{2}-01$/.test(str(row.values['start_month']))) rowError(row, 'Recover from', 'Must be the first day of a month');
      if (taken.has(`${String(row.values['employee_id'])}|${str(row.values['source_reference']).toUpperCase()}`)) rowError(row, 'Legacy reference', 'This loan was already imported');
    }
  },
  commit: async ({ trx, actor }, rows, progress) => {
    const service = new LoansService(trx);
    for (const [i, row] of rows.entries()) {
      const res = await service.importLegacyLoan({
        employeeId: num(row.values['employee_id']), loanType: str(row.values['loan_type']) as LoanType,
        originalPrincipalRupees: num(row.values['original_principal']), outstandingBalanceRupees: num(row.values['outstanding']),
        annualInterestRate: num(row.values['interest_rate']), monthlyEmiRupees: num(row.values['emi']), remainingTenureMonths: num(row.values['remaining_tenure']),
        startMonth: str(row.values['start_month']), sourceReference: str(row.values['source_reference']),
      });
      await writeAudit(trx, { actorUserId: actor.userId, action: 'create', entity: 'pay.loans', entityId: res.loanId, field: 'legacy_import', newValue: str(row.values['source_reference']), ip: actor.ip });
      if ((i + 1) % 200 === 0) await progress(i + 1);
    }
    return { created: rows.length, updated: 0, skipped: 0 };
  },
};
