/** ATT-03/09/15: late raw facts and cross-month locks must not stale week-off pay. */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql, type Kysely } from 'kysely';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import { closeWeekOffs } from '../src/core/db/attendance-period.js';
import { istDateTime } from '../src/core/dates.js';
import { recomputeDay } from '../src/modules/attendance/index.js';

const url = process.env['DATABASE_URL'];
describe.skipIf(!url)('Attendance weekly dependency repair', () => {
  let db: Kysely<Database>;
  beforeAll(() => { db = createDatabase(url ?? ''); });
  afterAll(async () => { await db.destroy(); });
  async function fixture() {
    const tx = await db.startTransaction().execute();
    const tag = `WEEK${randomUUID().slice(0,8)}`;
    const c = await tx.insertInto('core.companies').values({ code: tag, name: tag, ecode_prefix: tag }).returning('id').executeTakeFirstOrThrow();
    const e = await tx.insertInto('core.employees').values({ company_id: c.id, ecode: tag, first_name: tag,
      doj: '2020-01-01', attendance_mode: 'manual' }).returning('id').executeTakeFirstOrThrow();
    const shift = await tx.insertInto('att.shifts').values({ code: tag, name: tag, start_time: '09:00', end_time: '18:00',
      break_minutes: 60, min_full_day_hours: '8', min_half_day_hours: '4' }).returning('id').executeTakeFirstOrThrow();
    await tx.insertInto('att.rosters').values({ employee_id: e.id, work_date: '2026-09-28', shift_id: shift.id }).execute();
    return { tx, employeeId: e.id, tag };
  }
  it('counts a locked previous-month presence while changing only the open Sunday', async () => {
    const f = await fixture(); try {
      await f.tx.insertInto('att.day_records').values([
        { employee_id: f.employeeId, work_date: '2026-09-28', status: 'P', is_locked: true },
        { employee_id: f.employeeId, work_date: '2026-10-04', status: 'WO', weekoff_paid: false },
      ]).execute();
      await closeWeekOffs(f.tx, '2026-09-28', 1, f.employeeId);
      const sunday = await f.tx.selectFrom('att.day_records').select('weekoff_paid').where('employee_id', '=', f.employeeId)
        .where('work_date', '=', sql<Date>`DATE '2026-10-04'`).executeTakeFirstOrThrow();
      expect(sunday.weekoff_paid).toBe(true);
    } finally { await f.tx.rollback().execute(); }
  });
  it('refreshes a previously decided Sunday after a late IN/OUT pair changes A to P', async () => {
    const f = await fixture(); try {
      await f.tx.insertInto('att.day_records').values([
        { employee_id: f.employeeId, work_date: '2026-09-28', status: 'A', source: 'auto' },
        { employee_id: f.employeeId, work_date: '2026-10-04', status: 'WO', weekoff_paid: false },
      ]).execute();
      await sql`SELECT att.ensure_swipe_partition(DATE '2026-09-01')`.execute(f.tx);
      await f.tx.insertInto('att.swipe_events').values(['09:00','18:00'].map((t,i) => ({ employee_id: f.employeeId,
        employee_no: f.tag, swipe_ts: istDateTime('2026-09-28',t), received_at: new Date(), direction: i === 0 ? 'in' : 'out', source: f.tag }))).execute();
      expect(await recomputeDay(f.tx, f.employeeId, '2026-09-28')).toBe('P');
      expect((await f.tx.selectFrom('att.day_records').select('weekoff_paid').where('employee_id', '=', f.employeeId)
        .where('work_date', '=', sql<Date>`DATE '2026-10-04'`).executeTakeFirstOrThrow()).weekoff_paid).toBe(true);
    } finally { await f.tx.rollback().execute(); }
  });
  it('removes stale Sunday eligibility when a corrected working day becomes absent', async () => {
    const f = await fixture(); try {
      await f.tx.insertInto('att.day_records').values([
        { employee_id: f.employeeId, work_date: '2026-09-28', status: 'P', source: 'auto' },
        { employee_id: f.employeeId, work_date: '2026-10-04', status: 'WO', weekoff_paid: true },
      ]).execute();
      expect(await recomputeDay(f.tx, f.employeeId, '2026-09-28')).toBe('A');
      expect((await f.tx.selectFrom('att.day_records').select('weekoff_paid').where('employee_id', '=', f.employeeId)
        .where('work_date', '=', sql<Date>`DATE '2026-10-04'`).executeTakeFirstOrThrow()).weekoff_paid).toBe(false);
    } finally { await f.tx.rollback().execute(); }
  });
});
