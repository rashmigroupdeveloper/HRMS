/**
 * Verification helper (not shipped behaviour): re-runs the June 2026 payroll
 * runs of a snapshot DB through the real services — reopen → compute → review
 * → approve → finalize → payslips → bank file → paid — so reconcile.py can
 * compare every item with independently computed expected values.
 * Usage: DATABASE_URL=... tsx scripts/recon-rerun.ts <runId,...> <superAdminUserId> <payrollUserId> <hrHeadUserId>
 */
import { createDatabase } from '../src/core/db/database.js';
import { PayrollRunService } from '../src/modules/payroll-core/runs/run.service.js';
import { PayslipGeneratorService } from '../src/modules/payroll-outputs/payslip/payslip-generator.js';
import { BankFileService } from '../src/modules/payroll-outputs/bank/bank-file.service.js';
import { SeparationService } from '../src/modules/lifecycle/separation/separation.service.js';

const [runsArg = '', adminArg = '', payrollArg = '', headArg = ''] = process.argv.slice(2);
const db = createDatabase(process.env['DATABASE_URL'] ?? '');
const svc = new PayrollRunService(db);
const out: Record<string, unknown> = {};
try {
  for (const runId of runsArg.split(',').map(Number)) {
    const run = await db.selectFrom('pay.payroll_runs').select('status').where('id', '=', runId).executeTakeFirstOrThrow();
    if (run.status === 'finalized' || run.status === 'approved') await svc.reopenRun(runId, 'Recompute with fixed payroll engine', Number(adminArg));
    const computed = await svc.computeRun(runId, Number(payrollArg));
    await svc.reviewRun(runId, Number(payrollArg));
    await svc.approveRun(runId, Number(headArg));
    await svc.finalizeRun(runId, Number(headArg));
    const slips = await new PayslipGeneratorService(db).generateRunPayslips(runId, Number(payrollArg));
    const bank = await new BankFileService(db).generateBankBatch(runId, Number(payrollArg));
    await svc.markPaid(runId, Number(headArg), `UTR-RECON-${String(runId)}`);
    out[String(runId)] = { computed, slips, bank: { records: bank.recordCount, total: bank.totalAmountRupees } };
  }
  // F&F for approved separations whose LWD month the runs already paid (P-02/P-03: days payable must be 0).
  const seps = await db.selectFrom('core.separations').select('id').where('status', '=', 'approved').where('approved_lwd', '<', new Date('2026-07-01')).execute();
  const fnf: Record<string, unknown> = {};
  for (const s of seps) fnf[String(s.id)] = await new SeparationService(db).computeFnf({ separationId: s.id, userId: Number(payrollArg) });
  out['fnf'] = fnf;
  console.log(JSON.stringify(out, null, 1));
} finally {
  await db.destroy();
}
