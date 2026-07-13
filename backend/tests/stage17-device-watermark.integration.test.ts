/**
 * P1-T07 / doc 14 §8.5 — the PP-9 structural guarantee.
 * No automatic Absent row exists until every active door at the employee's
 * mapped location is synchronized past that employee's shift end.
 */
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql, type Kysely } from 'kysely';
import { createDatabase } from '../src/core/db/database.js';
import { istDateTime } from '../src/core/dates.js';
import type { Database } from '../src/core/db/types.js';
import {
  ingestOnce,
  getMonthLockChecklist,
  listFinalizationHolds,
  recomputeDay,
  type KentConnector,
} from '../src/modules/attendance/index.js';

const DB_URL = process.env['DATABASE_URL'];
const run = describe.skipIf(!DB_URL);

function deviceConnector(
  states: { doorCode: string; watermarkTs: Date }[],
): KentConnector {
  return {
    fetchSince: () => Promise.resolve([]),
    listDevices: () =>
      Promise.resolve(
        states.map((state) => ({
          ...state,
          lastContactAt: state.watermarkTs,
        })),
      ),
  };
}

run('Stage 1.7 — per-device absence finalization watermark', () => {
  let db: Kysely<Database>;
  const stamp = Date.now();
  const suffix = stamp.toString(36).toUpperCase();
  const companyCode = `WM${suffix}`;
  const ecode = `WME${suffix}`;
  const shiftCode = `WMS${suffix}`;
  const doorA = `WM-A-${stamp}`;
  const doorB = `WM-B-${stamp}`;
  const source = `wm-${stamp}`;
  const workDate = `2042-${String((stamp % 12) + 1).padStart(2, '0')}-10`;
  const beforeShiftEnd = istDateTime(workDate, '17:59');
  const afterShiftEnd = istDateTime(workDate, '18:01');
  let companyId: number;
  let locationId: number;
  let employeeId: number;
  let shiftId: number;

  beforeAll(async () => {
    db = createDatabase(DB_URL ?? '');
    companyId = (
      await db
        .insertInto('core.companies')
        .values({ code: companyCode, name: companyCode, ecode_prefix: companyCode })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    locationId = (
      await db
        .insertInto('core.locations')
        .values({ company_id: companyId, name: `Watermark Plant ${stamp}`, state_code: 'WB' })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    shiftId = (
      await db
        .insertInto('att.shifts')
        .values({
          code: shiftCode,
          name: 'Watermark Test Shift',
          start_time: '09:00:00',
          end_time: '18:00:00',
          min_half_day_hours: '4',
          min_full_day_hours: '8',
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    employeeId = (
      await db
        .insertInto('core.employees')
        .values({
          ecode,
          company_id: companyId,
          first_name: 'Watermark',
          last_name: 'Employee',
          location_id: locationId,
          status: 'active',
          attendance_mode: 'biometric',
          biometric_registered: true,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    await db
      .insertInto('att.employee_shifts')
      .values({ employee_id: employeeId, weekday_shift_id: shiftId })
      .execute();
    await db
      .insertInto('att.devices')
      .values([
        { door_code: doorA, source, location_id: locationId },
        { door_code: doorB, source, location_id: locationId },
      ])
      .execute();
  });

  afterAll(async () => {
    await db
      .deleteFrom('att.recompute_queue')
      .where('employee_id', '=', employeeId)
      .execute();
    await db
      .deleteFrom('att.day_records')
      .where('employee_id', '=', employeeId)
      .execute();
    await db
      .deleteFrom('att.employee_shifts')
      .where('employee_id', '=', employeeId)
      .execute();
    await db.deleteFrom('att.devices').where('door_code', 'in', [doorA, doorB]).execute();
    await db.deleteFrom('core.employees').where('id', '=', employeeId).execute();
    await db.deleteFrom('att.shifts').where('id', '=', shiftId).execute();
    await db.deleteFrom('core.locations').where('id', '=', locationId).execute();
    await db.deleteFrom('core.companies').where('id', '=', companyId).execute();
    await db.destroy();
  });

  it('holds Absent until every mapped active door passes shift end', async () => {
    await ingestOnce(
      db,
      deviceConnector([
        { doorCode: doorA, watermarkTs: beforeShiftEnd },
        { doorCode: doorB, watermarkTs: beforeShiftEnd },
      ]),
      source,
    );

    expect(await recomputeDay(db, employeeId, workDate)).toBe('held');
    const checklist = await getMonthLockChecklist(db, companyId, workDate.slice(0, 7));
    expect(checklist.items.find((item) => item.code === 'sync_watermark')).toMatchObject({
      ok: false,
    });
    expect(checklist.canLock).toBe(false);
    expect(
      await db
        .selectFrom('att.day_records')
        .select('id')
        .where('employee_id', '=', employeeId)
        .where('work_date', '=', sql<Date>`${workDate}::date`)
        .executeTakeFirst(),
    ).toBeUndefined();

    await ingestOnce(
      db,
      deviceConnector([
        { doorCode: doorA, watermarkTs: afterShiftEnd },
        { doorCode: doorB, watermarkTs: beforeShiftEnd },
      ]),
      source,
    );
    expect(await recomputeDay(db, employeeId, workDate)).toBe('held');
    const holds = await listFinalizationHolds(db, companyId, workDate);
    expect(holds).toHaveLength(1);
    expect(holds[0]).toMatchObject({
      ecode,
      reason: 'device_watermark_pending',
      pendingDoors: [doorB],
    });

    await ingestOnce(
      db,
      deviceConnector([
        { doorCode: doorA, watermarkTs: beforeShiftEnd },
        { doorCode: doorB, watermarkTs: afterShiftEnd },
      ]),
      source,
    );
    expect(await recomputeDay(db, employeeId, workDate)).toBe('A');
    const finalized = await db
      .selectFrom('att.day_records')
      .select(['status', 'source'])
      .where('employee_id', '=', employeeId)
      .where('work_date', '=', sql<Date>`${workDate}::date`)
      .executeTakeFirstOrThrow();
    expect(finalized).toEqual({ status: 'A', source: 'auto' });
    expect(await listFinalizationHolds(db, companyId, workDate)).toEqual([]);

    const watermarks = await db
      .selectFrom('att.devices as device')
      .innerJoin('att.device_watermarks as watermark', 'watermark.device_id', 'device.id')
      .select(['device.door_code', 'watermark.watermark_ts'])
      .where('device.door_code', 'in', [doorA, doorB])
      .orderBy('device.door_code')
      .execute();
    expect(watermarks.every((row) => row.watermark_ts.getTime() === afterShiftEnd.getTime())).toBe(true);
    const doorAId = (
      await db
        .selectFrom('att.devices')
        .select('id')
        .where('door_code', '=', doorA)
        .executeTakeFirstOrThrow()
    ).id;
    await expect(
      db
        .updateTable('att.device_watermarks')
        .set({ watermark_ts: beforeShiftEnd })
        .where('device_id', '=', doorAId)
        .execute(),
    ).rejects.toThrow(/cannot regress/i);
  });

  it('rejects a connector watermark that has no proven contact receipt', async () => {
    const invalidDoor = `WM-invalid-${stamp}`;
    const invalidConnector: KentConnector = {
      fetchSince: () => Promise.resolve([]),
      listDevices: () => Promise.resolve([{ doorCode: invalidDoor, watermarkTs: afterShiftEnd }]),
    };
    await expect(ingestOnce(db, invalidConnector, `${source}-invalid`)).rejects.toThrow(
      /without a contact receipt/i,
    );
    expect(
      await db
        .selectFrom('att.devices')
        .select('id')
        .where('door_code', '=', invalidDoor)
        .executeTakeFirst(),
    ).toBeUndefined();
  });
});
