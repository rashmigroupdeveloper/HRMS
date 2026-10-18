/** ATT-12/15, CORE-10: month close must prove the complete reviewed population. */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql, type Kysely, type Transaction } from 'kysely';
import type { Database } from '../src/core/db/types.js';
import { createDatabase } from '../src/core/db/database.js';
import {
  getMonthLockChecklist,
  lockMonth,
  approveManagerMonth,
  applyRosterEntries,
} from '../src/modules/attendance/index.js';
import { setSetting } from '../src/modules/settings/index.js';
const url = process.env['DATABASE_URL'];
const rollback = new Error('Intentional month close fixture rollback');
const month = '1998-09-01';
interface Fixture {
  trx: Transaction<Database>;
  companyId: number;
  employeeId: number;
  managerId: number;
  userId: number;
}
describe.skipIf(!url)('ATT-12/15 month-close readiness (native PostgreSQL)', () => {
  let db: Kysely<Database>;
  beforeAll(() => {
    db = createDatabase(url ?? '');
  });
  afterAll(async () => {
    await db.destroy();
  });
  async function fixture(run: (f: Fixture) => Promise<void>) {
    try {
      await db.transaction().execute(async (trx) => {
        const tag = 'close_' + randomUUID().slice(0, 8);
        const companies = [];
        for (const suffix of ['A', 'B'])
          companies.push(
            (
              await trx
                .insertInto('core.companies')
                .values({
                  code: tag + suffix,
                  name: tag + suffix,
                  ecode_prefix: tag + suffix,
                  is_india_payroll: false,
                })
                .returning('id')
                .executeTakeFirstOrThrow()
            ).id,
          );
        const companyId = companies[0];
        const managerCompany = companies[1];
        if (!companyId || !managerCompany) throw new Error('Missing fixture companies');
        const manager = await trx
          .insertInto('core.employees')
          .values({
            company_id: managerCompany,
            ecode: tag + 'M',
            first_name: 'Synthetic close manager',
            status: 'active',
            attendance_mode: 'manual',
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        const employee = await trx
          .insertInto('core.employees')
          .values({
            company_id: companyId,
            ecode: tag + 'E',
            first_name: 'Synthetic close employee',
            status: 'active',
            attendance_mode: 'manual',
            doj: new Date('1998-09-30'),
            reporting_manager_id: manager.id,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        const user = await trx
          .insertInto('core.users')
          .values({
            email: tag + '@hrms.invalid',
            password_hash: '!disabled!',
            employee_id: manager.id,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        await setSetting(trx, {
          key: 'att.manager_approval_required_for_lock',
          value: true,
          type: 'boolean',
          description: 'ATT-12 mandatory month-close approval',
          actorUserId: user.id,
        });
        await trx
          .insertInto('att.day_records')
          .values({
            employee_id: employee.id,
            work_date: sql<Date>`'1998-09-30'::date`,
            status: 'P',
            source: 'manual',
            override_reason: 'Synthetic verified attendance',
          })
          .execute();
        await approveManagerMonth(trx, {
          companyId,
          month,
          managerEmployeeId: manager.id,
          actorUserId: user.id,
        });
        await run({
          trx,
          companyId,
          employeeId: employee.id,
          managerId: manager.id,
          userId: user.id,
        });
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  }
  const checklist = (f: Fixture, target = month) =>
    getMonthLockChecklist(f.trx, f.companyId, target);
  it('locks a complete past employment window and prevents roster changes afterwards', async () =>
    fixture(async (f) => {
      const ready = await checklist(f);
      expect(ready.items.filter((item) => !item.ok)).toEqual([]);
      expect(ready.canLock).toBe(true);
      expect(
        (await lockMonth(f.trx, { companyId: f.companyId, month, actorUserId: f.userId })).id,
      ).toBeGreaterThan(0);
      expect((await checklist(f)).alreadyLocked).toBe(true);
      const latest = await f.trx
        .selectFrom('att.manager_month_approvals')
        .select('event_type')
        .where('company_id', '=', f.companyId)
        .orderBy('id', 'desc')
        .executeTakeFirstOrThrow();
      expect(latest.event_type).toBe('approve');
      expect(
        (
          await f.trx
            .selectFrom('att.day_records')
            .select('is_locked')
            .where('employee_id', '=', f.employeeId)
            .executeTakeFirstOrThrow()
        ).is_locked,
      ).toBe(true);
      const shift = await f.trx
        .selectFrom('att.shifts')
        .select('id')
        .where('code', '=', 'G5')
        .executeTakeFirstOrThrow();
      await expect(
        applyRosterEntries(f.trx, {
          actorUserId: f.userId,
          ip: null,
          entries: [
            { employeeId: f.employeeId, date: '1998-09-30', shiftId: shift.id, weekOff: false },
          ],
        }),
      ).rejects.toThrow(/locked/i);
    }));
  it('blocks an empty or future/current period', async () =>
    fixture(async (f) => {
      const future = await checklist(f, '2027-01');
      expect(future.canLock).toBe(false);
      expect(future.items.find((i) => i.code === 'period_closed')?.ok).toBe(false);
      await f.trx
        .updateTable('core.employees')
        .set({ doj: new Date('1998-10-01') })
        .where('id', '=', f.employeeId)
        .execute();
      const empty = await checklist(f);
      expect(empty.canLock).toBe(false);
      expect(empty.items.find((i) => i.code === 'population_ready')?.ok).toBe(false);
    }));
  it('blocks missing employment dates and missing joining date', async () =>
    fixture(async (f) => {
      await f.trx.deleteFrom('att.day_records').where('employee_id', '=', f.employeeId).execute();
      expect((await checklist(f)).items.find((i) => i.code === 'attendance_complete')?.ok).toBe(
        false,
      );
      await f.trx
        .updateTable('core.employees')
        .set({ doj: null })
        .where('id', '=', f.employeeId)
        .execute();
      expect((await checklist(f)).items.find((i) => i.code === 'population_ready')?.ok).toBe(false);
    }));
  it('blocks unresolved week-off eligibility', async () =>
    fixture(async (f) => {
      await f.trx
        .updateTable('att.day_records')
        .set({ status: 'WO', weekoff_paid: null })
        .where('employee_id', '=', f.employeeId)
        .execute();
      expect((await checklist(f)).items.find((i) => i.code === 'attendance_complete')?.ok).toBe(
        false,
      );
    }));
  it('blocks queued recomputation for the target month only', async () =>
    fixture(async (f) => {
      await f.trx
        .insertInto('att.recompute_queue')
        .values({ employee_id: f.employeeId, work_date: sql<Date>`'1998-10-02'::date` })
        .execute();
      expect((await checklist(f)).items.find((i) => i.code === 'recompute_drained')?.ok).toBe(true);
      await f.trx
        .insertInto('att.recompute_queue')
        .values({ employee_id: f.employeeId, work_date: sql<Date>`'1998-09-30'::date` })
        .execute();
      expect((await checklist(f)).items.find((i) => i.code === 'recompute_drained')?.ok).toBe(
        false,
      );
    }));
  it('blocks disabling the mandatory manager precondition', async () =>
    fixture(async (f) => {
      await setSetting(f.trx, {
        key: 'att.manager_approval_required_for_lock',
        value: false,
        type: 'boolean',
        description: 'ATT-12 mandatory month-close approval',
        actorUserId: f.userId,
      });
      const result = await checklist(f);
      expect(result.canLock).toBe(false);
      expect(result.items.find((i) => i.code === 'manager_approvals')?.detail).toMatch(/disabled/i);
    }));
  it('blocks detected OT without its decision record', async () =>
    fixture(async (f) => {
      await f.trx
        .updateTable('att.day_records')
        .set({ ot_minutes: 60 })
        .where('employee_id', '=', f.employeeId)
        .execute();
      expect((await checklist(f)).items.find((i) => i.code === 'ot_detected')?.ok).toBe(false);
    }));
  it('preserves attestation on identical recomputation but invalidates a real change', async () =>
    fixture(async (f) => {
      await f.trx
        .updateTable('att.day_records')
        .set({ computed_at: new Date() })
        .where('employee_id', '=', f.employeeId)
        .execute();
      const latest = () =>
        f.trx
          .selectFrom('att.manager_month_approvals')
          .select('event_type')
          .where('company_id', '=', f.companyId)
          .orderBy('id', 'desc')
          .executeTakeFirstOrThrow();
      expect((await latest()).event_type).toBe('approve');
      await f.trx
        .updateTable('att.day_records')
        .set({ status: 'A' })
        .where('employee_id', '=', f.employeeId)
        .execute();
      expect((await latest()).event_type).toBe('invalidate');
    }));
  it('does not demand an overtime entry for minutes below the configured threshold', async () =>
    fixture(async (f) => {
      await f.trx
        .updateTable('att.day_records')
        .set({ ot_minutes: 1 })
        .where('employee_id', '=', f.employeeId)
        .execute();
      expect((await checklist(f)).items.find((i) => i.code === 'ot_detected')?.ok).toBe(true);
    }));
  it('blocks open leave cancellation and approved AR waiting for write-back', async () =>
    fixture(async (f) => {
      const leaveType = await f.trx
        .selectFrom('lv.leave_types')
        .select('id')
        .where('is_active', '=', true)
        .executeTakeFirstOrThrow();
      const request = await f.trx
        .insertInto('wf.requests')
        .values({
          definition_code: 'leave',
          subject_employee_id: f.employeeId,
          requested_by: f.userId,
          payload: '{}',
          status: 'approved',
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      const cancellation = await f.trx
        .insertInto('wf.requests')
        .values({
          definition_code: 'leave_cancel',
          subject_employee_id: f.employeeId,
          requested_by: f.userId,
          payload: '{}',
          status: 'pending',
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await f.trx
        .insertInto('lv.applications')
        .values({
          employee_id: f.employeeId,
          leave_type_id: leaveType.id,
          from_date: sql<Date>`'1998-09-30'::date`,
          to_date: sql<Date>`'1998-09-30'::date`,
          days: '1',
          status: 'approved',
          workflow_request_id: request.id,
          cancel_workflow_request_id: cancellation.id,
        })
        .execute();
      expect((await checklist(f)).items.find((i) => i.code === 'leave_resolved')?.ok).toBe(false);
      const ar = await f.trx
        .insertInto('wf.requests')
        .values({
          definition_code: 'regularization',
          subject_employee_id: f.employeeId,
          requested_by: f.userId,
          payload: '{}',
          status: 'approved',
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await f.trx
        .insertInto('att.regularizations')
        .values({
          employee_id: f.employeeId,
          kind: 'AR',
          requested_status: 'P',
          from_date: sql<Date>`'1998-09-30'::date`,
          to_date: sql<Date>`'1998-09-30'::date`,
          reason: 'Synthetic request awaiting application',
          workflow_request_id: ar.id,
          applied: false,
        })
        .execute();
      expect((await checklist(f)).items.find((i) => i.code === 'recompute_drained')?.ok).toBe(
        false,
      );
    }));
  it('rejects invalid monthly boundaries before a database cast', async () =>
    fixture(async (f) => {
      await expect(checklist(f, '1998-09-30')).rejects.toThrow(/month/i);
      await expect(checklist(f, '2026-99')).rejects.toThrow(/month/i);
    }));
});
