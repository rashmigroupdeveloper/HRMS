/**
 * Verification harness only. In the payroll test, RML033904's maternity leave
 * (08–30 Jun 2026) was refused by P-07 BEFORE June was locked. This replays
 * that application through the real leave service + approval chain in the
 * snapshot, inside one transaction that sets the June lock aside and restores
 * it (and the day locks) before commit — i.e. the order of events the fix
 * makes possible. Usage: DATABASE_URL=... tsx scripts/recon-maternity-replay.ts
 */
import { sql } from 'kysely';
import { createDatabase } from '../src/core/db/database.js';
import { applyForLeave } from '../src/modules/leave/leave-apply.service.js';
import { registerLeaveWorkflowHooks } from '../src/modules/leave/index.js';
import { act } from '../src/modules/workflows/index.js';

const db = createDatabase(process.env['DATABASE_URL'] ?? '');
registerLeaveWorkflowHooks();
try {
  await db.transaction().execute(async (trx) => {
    const emp = await trx.selectFrom('core.employees as e').innerJoin('core.users as u', 'u.employee_id', 'e.id')
      .select(['e.id', 'e.company_id', 'u.id as user_id']).where('e.ecode', '=', 'RML033904').executeTakeFirstOrThrow();
    const lock = await trx.selectFrom('att.month_locks').select(['id', 'month']).where('company_id', '=', emp.company_id).where('month', '=', sql<Date>`'2026-06-01'::date`).executeTakeFirstOrThrow();
    // Harness only: lift the append-only guard for this transaction, restored below.
    await sql`ALTER TABLE att.month_locks DISABLE TRIGGER USER`.execute(trx);
    await trx.updateTable('att.month_locks').set({ month: sql<Date>`'1900-01-01'::date` }).where('id', '=', lock.id).execute();
    const days = trx.updateTable('att.day_records').where('employee_id', '=', emp.id)
      .where('work_date', '>=', sql<Date>`'2026-06-08'::date`).where('work_date', '<=', sql<Date>`'2026-06-30'::date`);
    await sql`ALTER TABLE att.day_records DISABLE TRIGGER USER`.execute(trx);
    await days.set({ is_locked: false }).execute();
    await sql`ALTER TABLE att.day_records ENABLE TRIGGER USER`.execute(trx);
    const applied = await applyForLeave(trx, { employeeId: emp.id, leaveTypeCode: 'ML', fromDate: '2026-06-08', toDate: '2026-06-30', reason: 'Maternity (replayed after P-07 fix)', requestedByUserId: emp.user_id });
    // Whoever the engine routed step 1 to (the RM, or their active delegate).
    const step = await trx.selectFrom('wf.request_steps').select('approver_user_id').where('request_id', '=', applied.workflowRequestId).where('acted_at', 'is', null).executeTakeFirstOrThrow();
    await act(trx, { requestId: applied.workflowRequestId, actorUserId: step.approver_user_id, action: 'approve' });
    await days.set({ is_locked: true }).execute();
    await trx.updateTable('att.month_locks').set({ month: lock.month }).where('id', '=', lock.id).execute();
    await sql`ALTER TABLE att.month_locks ENABLE TRIGGER USER`.execute(trx);
    console.log(JSON.stringify({ applied }));
  });
} finally {
  await db.destroy();
}
