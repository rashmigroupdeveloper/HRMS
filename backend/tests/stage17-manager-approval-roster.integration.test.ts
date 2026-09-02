/**
 * Stage 1.7 — manager month approvals (ATT-12) + roster read contract (ATT-04).
 */
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql, type Kysely } from 'kysely';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import { hashPassword } from '../src/modules/auth/index.js';
import {
  approveManagerMonth,
  applyRosterEntries,
  countPendingManagerApprovals,
  getManagerApprovalLedger,
  getMonthLockChecklist,
} from '../src/modules/attendance/index.js';
import { setSetting } from '../src/modules/settings/index.js';
import { istDateString } from '../src/core/dates.js';

const DB_URL = process.env['DATABASE_URL'];
const run = describe.skipIf(!DB_URL);

run('Stage 1.7 — manager approval ledger + month-lock gate', () => {
  let db: Kysely<Database>;
  const stamp = Date.now();
  const today = istDateString();
  const month = `${today.slice(0, 7)}-01`;
  let companyId: number;
  let managerId: number;
  let reportId: number;
  let managerUserId: number;
  let hrUserId: number;
  let shiftId: number;

  beforeAll(async () => {
    db = createDatabase(DB_URL ?? '');
    const code = `M${stamp.toString(36).toUpperCase().slice(0, 5)}`;
    companyId = (
      await db
        .insertInto('core.companies')
        .values({
          code,
          name: `Mgr Appr ${String(stamp)}`,
          ecode_prefix: code,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;

    managerId = (
      await db
        .insertInto('core.employees')
        .values({
          ecode: `${code}MGR`,
          company_id: companyId,
          first_name: 'Team',
          last_name: 'Lead',
          status: 'active',
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;

    reportId = (
      await db
        .insertInto('core.employees')
        .values({
          ecode: `${code}REP`,
          company_id: companyId,
          first_name: 'Direct',
          last_name: 'Report',
          status: 'active',
          reporting_manager_id: managerId,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;

    managerUserId = (
      await db
        .insertInto('core.users')
        .values({
          email: `mgr-${stamp}@hrms.test`,
          password_hash: await hashPassword('mgr-test-pw-1!'),
          employee_id: managerId,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;

    const hrEmp = (
      await db
        .insertInto('core.employees')
        .values({
          ecode: `${code}HR`,
          company_id: companyId,
          first_name: 'HR',
          status: 'active',
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;

    hrUserId = (
      await db
        .insertInto('core.users')
        .values({
          email: `hr-mgr-${stamp}@hrms.test`,
          password_hash: await hashPassword('hr-test-pw-1!'),
          employee_id: hrEmp,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;

    shiftId = (
      await db
        .insertInto('att.shifts')
        .values({
          code: `S${stamp.toString(36).toUpperCase()}`,
          name: 'Manager approval roster test',
          start_time: '09:00:00',
          end_time: '18:00:00',
          min_half_day_hours: '4',
          min_full_day_hours: '8',
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;

    // Ensure policy starts enabled for this suite
    await setSetting(db, {
      key: 'att.manager_approval_required_for_lock',
      value: true,
      type: 'boolean',
      description: 'ATT-12: managers must approve team attendance before month lock',
      actorUserId: hrUserId,
    });

    void reportId;
  });

  afterAll(async () => {
    // Restore default so other suites aren't forced into approval mode
    await setSetting(db, {
      key: 'att.manager_approval_required_for_lock',
      value: false,
      type: 'boolean',
      description: 'ATT-12: managers must approve team attendance before month lock',
      actorUserId: hrUserId,
    }).catch(() => undefined);
    await db.destroy();
  });

  it('ledger lists managers with reports; approval clears pending count', async () => {
    const before = await getManagerApprovalLedger(db, companyId, month);
    expect(before.some((r) => r.managerEmployeeId === managerId)).toBe(true);
    const pendingBefore = await countPendingManagerApprovals(db, companyId, month);
    expect(pendingBefore.pending).toBeGreaterThanOrEqual(1);

    await approveManagerMonth(db, {
      companyId,
      month,
      managerEmployeeId: managerId,
      actorUserId: managerUserId,
      note: 'Team month reviewed',
    });

    const after = await getManagerApprovalLedger(db, companyId, month);
    const row = after.find((r) => r.managerEmployeeId === managerId);
    expect(row?.approved).toBe(true);
    expect(row?.note).toContain('reviewed');

    const pendingAfter = await countPendingManagerApprovals(db, companyId, month);
    expect(pendingAfter.pending).toBe(0);

    // Any later attendance mutation invalidates the sign-off automatically.
    await db
      .insertInto('att.day_records')
      .values({
        employee_id: reportId,
        work_date: sql<Date>`${month}::date`,
        status: 'P',
        source: 'auto',
      })
      .onConflict((oc) =>
        oc.columns(['employee_id', 'work_date']).doUpdateSet({ status: 'P' }),
      )
      .execute();
    const invalidated = await getManagerApprovalLedger(db, companyId, month);
    expect(invalidated.find((r) => r.managerEmployeeId === managerId)?.approved).toBe(false);

    const latestEvent = await db
      .selectFrom('att.manager_month_approvals')
      .select(['id', 'event_type'])
      .where('company_id', '=', companyId)
      .where('manager_employee_id', '=', managerId)
      .orderBy('id', 'desc')
      .executeTakeFirstOrThrow();
    expect(latestEvent.event_type).toBe('invalidate');
    await expect(
      db
        .updateTable('att.manager_month_approvals')
        .set({ note: 'tamper' })
        .where('id', '=', latestEvent.id)
        .execute(),
    ).rejects.toThrow(/append-only/i);
  });

  it('month-lock checklist manager_approvals item reflects ledger when policy on', async () => {
    // Ensure approved from previous test (re-approve is fine)
    await approveManagerMonth(db, {
      companyId,
      month,
      managerEmployeeId: managerId,
      actorUserId: managerUserId,
    });

    const cl = await getMonthLockChecklist(db, companyId, month);
    const item = cl.items.find((i) => i.code === 'manager_approvals');
    expect(item).toBeTruthy();
    expect(item?.ok).toBe(true);
    expect(item?.detail.toLowerCase()).toMatch(/approved|no managers/);

    // Force a new manager without approval → pending
    const orphanMgr = (
      await db
        .insertInto('core.employees')
        .values({
          ecode: `ORPH${String(stamp).slice(-5)}`,
          company_id: companyId,
          first_name: 'Orphan',
          status: 'active',
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    await db
      .insertInto('core.employees')
      .values({
        ecode: `ORPR${String(stamp).slice(-5)}`,
        company_id: companyId,
        first_name: 'Kid',
        status: 'active',
        reporting_manager_id: orphanMgr,
      })
      .execute();

    const cl2 = await getMonthLockChecklist(db, companyId, month);
    const item2 = cl2.items.find((i) => i.code === 'manager_approvals');
    expect(item2?.ok).toBe(false);
    expect(item2?.detail).toMatch(/pending/i);
  });

  it('replaying an unchanged roster does not recompute or invalidate approval', async () => {
    const entry = {
      employeeId: reportId,
      date: month,
      shiftId,
      weekOff: false,
    };

    await applyRosterEntries(db, {
      actorUserId: managerUserId,
      entries: [entry],
      ip: null,
    });
    await db
      .deleteFrom('att.recompute_queue')
      .where('employee_id', '=', reportId)
      .where('work_date', '=', sql<Date>`${month}::date`)
      .execute();
    await approveManagerMonth(db, {
      companyId,
      month,
      managerEmployeeId: managerId,
      actorUserId: managerUserId,
    });

    const eventCountBefore = await db
      .selectFrom('att.manager_month_approvals')
      .select(sql<number>`count(*)::int`.as('count'))
      .where('company_id', '=', companyId)
      .where('month', '=', sql<Date>`${month}::date`)
      .where('manager_employee_id', '=', managerId)
      .executeTakeFirstOrThrow();

    expect(
      await applyRosterEntries(db, {
        actorUserId: managerUserId,
        entries: [entry],
        ip: null,
      }),
    ).toBe(0);
    expect(
      await db
        .selectFrom('att.recompute_queue')
        .select(sql<number>`count(*)::int`.as('count'))
        .where('employee_id', '=', reportId)
        .where('work_date', '=', sql<Date>`${month}::date`)
        .executeTakeFirstOrThrow(),
    ).toEqual({ count: 0 });

    // Even another writer changing only attribution must not invalidate the
    // already-approved roster business state.
    await db
      .updateTable('att.rosters')
      .set({ set_by: hrUserId })
      .where('employee_id', '=', reportId)
      .where('work_date', '=', sql<Date>`${month}::date`)
      .execute();

    const eventCountAfter = await db
      .selectFrom('att.manager_month_approvals')
      .select(sql<number>`count(*)::int`.as('count'))
      .where('company_id', '=', companyId)
      .where('month', '=', sql<Date>`${month}::date`)
      .where('manager_employee_id', '=', managerId)
      .executeTakeFirstOrThrow();
    expect(eventCountAfter.count).toBe(eventCountBefore.count);
    expect(
      (await getManagerApprovalLedger(db, companyId, month)).find(
        (row) => row.managerEmployeeId === managerId,
      )?.approved,
    ).toBe(true);

    expect(
      await applyRosterEntries(db, {
        actorUserId: managerUserId,
        entries: [{ ...entry, shiftId: null, weekOff: true }],
        ip: null,
      }),
    ).toBe(1);
    expect(
      (await getManagerApprovalLedger(db, companyId, month)).find(
        (row) => row.managerEmployeeId === managerId,
      )?.approved,
    ).toBe(false);
  });
});
