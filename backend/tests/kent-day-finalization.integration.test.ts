/** ATT-01/03/18: sponsor-selected next-morning cutoff, not a KENT-generated clock or forced OUT. */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { sql, type ControlledTransaction, type Kysely } from 'kysely';
import { randomUUID } from 'node:crypto';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import { istDateTime } from '../src/core/dates.js';
import { getAbsenceFinalizationReadiness, listFinalizationHolds, recomputeDay } from '../src/modules/attendance/index.js';

const DB_URL = process.env['DATABASE_URL'];
describe.skipIf(!DB_URL)('KENT next-morning finalization', () => {
  let db: Kysely<Database>; let tx: ControlledTransaction<Database>;
  let empId = 0; let dayShift = 0; let nightShift = 0; let deviceId = 0;
  const tag = `KFC${randomUUID().slice(0, 6)}`;
  const workDate = '2026-10-05'; // Monday
  const nextDate = '2026-10-06';
  beforeAll(async () => {
    db = createDatabase(DB_URL ?? ''); tx = await db.startTransaction().execute();
    const company = await tx.insertInto('core.companies').values({ code: tag, name: tag, ecode_prefix: tag }).returning('id').executeTakeFirstOrThrow();
    const location = await tx.insertInto('core.locations').values({ company_id: company.id, name: tag, state_code: 'WB' }).returning('id').executeTakeFirstOrThrow();
    empId = (await tx.insertInto('core.employees').values({ ecode: tag, first_name: tag, company_id: company.id, location_id: location.id, doj: '2020-01-01', status: 'active', attendance_mode: 'biometric', biometric_registered: true }).returning('id').executeTakeFirstOrThrow()).id;
    dayShift = (await tx.insertInto('att.shifts').values({ code: tag, name: tag, start_time: '09:00', end_time: '18:00', break_minutes: 60, min_full_day_hours: '8', min_half_day_hours: '4' }).returning('id').executeTakeFirstOrThrow()).id;
    nightShift = (await tx.insertInto('att.shifts').values({ code: `${tag}N`, name: tag, start_time: '22:00', end_time: '06:00', crosses_midnight: true, min_full_day_hours: '8', min_half_day_hours: '4' }).returning('id').executeTakeFirstOrThrow()).id;
    await tx.insertInto('att.employee_shifts').values({ employee_id: empId, weekday_shift_id: dayShift }).execute();
    deviceId = (await tx.insertInto('att.devices').values({ source: tag, door_code: tag, location_id: location.id }).returning('id').executeTakeFirstOrThrow()).id;
    await tx.insertInto('att.device_watermarks').values({ device_id: deviceId, watermark_ts: istDateTime(nextDate, '04:00') }).execute();
  });
  afterEach(() => { vi.restoreAllMocks(); });
  afterAll(async () => { try { await tx.rollback().execute(); } finally { await db.destroy(); } });
  const clock = (time: string) => vi.spyOn(Date, 'now').mockReturnValue(istDateTime(nextDate, time).getTime());

  it('holds an automatic absence before 04:00 even with a complete device receipt', async () => {
    clock('03:59');
    expect(await recomputeDay(tx, empId, workDate)).toBe('held');
    expect(await getAbsenceFinalizationReadiness(tx, empId, workDate)).toMatchObject({ ready: false, reason: 'day_cutoff_pending' });
  });

  it('allows finalization at 04:00 only with device completeness through the cutoff', async () => {
    clock('04:00');
    expect(await recomputeDay(tx, empId, workDate)).toBe('A');
    expect(await getAbsenceFinalizationReadiness(tx, empId, workDate)).toMatchObject({ ready: true });
  });

  it('keeps a shift ending after 04:00 open through its actual end', async () => {
    await tx.insertInto('att.rosters').values({ employee_id: empId, work_date: sql<Date>`${nextDate}::date`, shift_id: nightShift }).execute();
    // The 06 Oct night shift ends at 06:00 on 07 Oct; its 04:00 cutoff is earlier.
    vi.spyOn(Date, 'now').mockReturnValue(istDateTime('2026-10-07', '04:01').getTime());
    expect(await getAbsenceFinalizationReadiness(tx, empId, nextDate)).toMatchObject({ ready: false, reason: 'day_cutoff_pending' });
  });

  it('retains a 03:30 OUT on the previous workday and queues its provisional result for the cutoff', async () => {
    clock('03:45');
    const early = await tx.insertInto('att.shifts').values({ code: `${tag}E`, name: tag, start_time: '07:00', end_time: '16:00', break_minutes: 60, min_full_day_hours: '8', min_half_day_hours: '4' }).returning('id').executeTakeFirstOrThrow();
    await tx.updateTable('att.rosters').set({ shift_id: early.id }).where('employee_id', '=', empId).where('work_date', '=', sql<Date>`${nextDate}::date`).execute();
    await sql`SELECT att.ensure_swipe_partition(DATE '2026-10-01')`.execute(tx);
    await tx.insertInto('att.swipe_events').values([
      { employee_no: tag, employee_id: empId, door_code: tag, swipe_ts: istDateTime(workDate, '09:00'), received_at: istDateTime(workDate, '09:00'), direction: 'in', source: tag },
      { employee_no: tag, employee_id: empId, door_code: tag, swipe_ts: istDateTime(nextDate, '03:30'), received_at: istDateTime(nextDate, '03:31'), direction: 'out', source: tag },
    ]).execute();
    expect(await recomputeDay(tx, empId, workDate)).toBe('P');
    const row = await tx.selectFrom('att.day_records').select(['first_in', 'last_out', 'worked_minutes']).where('employee_id', '=', empId).where('work_date', '=', sql<Date>`${workDate}::date`).executeTakeFirstOrThrow();
    expect(row.first_in?.toISOString()).toBe(istDateTime(workDate, '09:00').toISOString());
    expect(row.last_out?.toISOString()).toBe(istDateTime(nextDate, '03:30').toISOString());
    expect(row.worked_minutes).toBe(1050); // 18h30 elapsed less 1h unpaid break
    const queued = await tx.selectFrom('att.recompute_queue').select('queued_at').where('employee_id', '=', empId)
      .where('work_date', '=', sql<Date>`${workDate}::date`).executeTakeFirstOrThrow();
    expect(queued.queued_at.toISOString()).toBe(istDateTime(nextDate, '04:00').toISOString());
    expect(await listFinalizationHolds(tx, (await tx.selectFrom('core.employees').select('company_id').where('id', '=', empId).executeTakeFirstOrThrow()).company_id, workDate)).toEqual(expect.arrayContaining([expect.objectContaining({ reason: 'day_cutoff_pending' })]));
    await tx.insertInto('att.swipe_events').values([
      { employee_no: tag, employee_id: empId, door_code: tag, swipe_ts: istDateTime(nextDate, '07:00'), received_at: istDateTime(nextDate, '07:00'), direction: 'in', source: tag },
      { employee_no: tag, employee_id: empId, door_code: tag, swipe_ts: istDateTime(nextDate, '16:00'), received_at: istDateTime(nextDate, '16:00'), direction: 'out', source: tag },
    ]).execute();
    expect(await recomputeDay(tx, empId, nextDate)).toBe('P');
    const following = await tx.selectFrom('att.day_records').select(['first_in', 'last_out', 'worked_minutes']).where('employee_id', '=', empId).where('work_date', '=', sql<Date>`${nextDate}::date`).executeTakeFirstOrThrow();
    expect(following.first_in?.toISOString()).toBe(istDateTime(nextDate, '07:00').toISOString());
    expect(following.last_out?.toISOString()).toBe(istDateTime(nextDate, '16:00').toISOString());
    expect(following.worked_minutes).toBe(480);
  });
});
