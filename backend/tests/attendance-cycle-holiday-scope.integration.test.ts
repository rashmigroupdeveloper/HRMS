/**
 * Item 4 building blocks: attendance-cycle month mapping, holiday scope
 * resolution/upsert, planned off days, payable-day evaluator edges and the
 * policy-value guard on settings writes (rolled back against real PostgreSQL).
 */
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql, type Kysely } from 'kysely';
import type { Database } from '../src/core/db/types.js';
import { createDatabase } from '../src/core/db/database.js';
import {
  assertCycleStartDay, attendanceWindow, loadCycleStartDay, periodMonthOf, periodMonthSql, periodMonthsOfSpan, resolveAttendanceWindow,
} from '../src/core/db/attendance-cycle.js';
import { readPlannedOffDays, resolveHolidayScope, upsertScopedHoliday } from '../src/core/db/holiday-calendar.js';
import { evaluatePayableDays, parseLopDivisor, unpaidWeight } from '../src/modules/payroll-core/runs/payable-days.js';
import { readLockedPayableDays } from '../src/modules/payroll-core/runs/attendance.repository.js';
import { setSetting } from '../src/modules/settings/index.js';

const url = process.env['DATABASE_URL'];
const rollback = new Error('rollback item-4 fixture');

describe('attendance cycle (pure)', () => {
  it('maps windows and dates to payroll months', () => {
    expect(attendanceWindow('2026-06-01', 1)).toEqual({ from: '2026-06-01', until: '2026-07-01' });
    expect(attendanceWindow('2026-01-01', 26)).toEqual({ from: '2025-12-26', until: '2026-01-26' });
    expect(periodMonthOf('2026-06-25', 26)).toBe('2026-06-01');
    expect(periodMonthOf('2026-06-26', 26)).toBe('2026-07-01');
    expect(periodMonthOf('2026-12-30', 26)).toBe('2027-01-01');
    expect(periodMonthOf('2026-06-30', 1)).toBe('2026-06-01');
    expect(periodMonthsOfSpan('2026-06-20', '2026-07-02', 26)).toEqual(['2026-06-01', '2026-07-01']);
    expect(assertCycleStartDay(26)).toBe(26);
    expect(() => assertCycleStartDay(29)).toThrow(/1 to 28/);
    expect(() => assertCycleStartDay('26')).toThrow(/1 to 28/);
  });

  it('evaluates payable days at the edges', () => {
    expect(() => parseLopDivisor('DAILY')).toThrow(/CALENDAR/);
    expect(unpaidWeight({ iso: '2026-06-01', status: 'UAB', leavePaid: null, weekoffPaid: null, otherHalfWorked: false })).toBe(1);
    // A WO at the start of the facts has no left neighbour: never sandwiched.
    const facts = [
      { iso: '2026-06-07', status: 'WO' as const, leavePaid: null, weekoffPaid: true, otherHalfWorked: false },
      { iso: '2026-06-08', status: 'A' as const, leavePaid: null, weekoffPaid: null, otherHalfWorked: false },
    ];
    const r = evaluatePayableDays({ divisor: 'CALENDAR', sandwich: true, monthFrom: '2026-06-01', monthUntil: '2026-07-01', employedFrom: '2026-06-07', employedUntil: '2026-06-09', facts, plannedOffDays: new Set() });
    expect(r).toEqual({ daysInMonth: 30, payableDays: 1, lopDays: 29, sandwichDays: 0 });
    // FIXED_30 deducts days outside employment day for day (C-16: Feb joiner on the 27th → 30 − 26 − 1 LOP = 3).
    const none = evaluatePayableDays({ divisor: 'FIXED_30', sandwich: false, monthFrom: '2026-02-01', monthUntil: '2026-03-01', employedFrom: '2026-02-27', employedUntil: '2026-03-01', facts: facts.slice(1), plannedOffDays: new Set() });
    expect(none.payableDays).toBe(3);
  });
});

describe.skipIf(!url)('holiday scope, planned off days, cycle setting (live Postgres)', () => {
  let db: Kysely<Database>;
  beforeAll(() => { db = createDatabase(url ?? ''); });
  afterAll(async () => { await db.destroy(); });

  it('resolves scopes, upserts holidays, requeues days and reads off days', async () => {
    try {
      await db.transaction().execute(async (trx) => {
        const tag = `HS${String(Date.now()).slice(-7)}`;
        const company = await trx.insertInto('core.companies').values({ code: tag, name: tag, ecode_prefix: 'HS' }).returning('id').executeTakeFirstOrThrow();
        const other = await trx.insertInto('core.companies').values({ code: `${tag}X`, name: `${tag}X`, ecode_prefix: 'HX' }).returning('id').executeTakeFirstOrThrow();
        const loc = await trx.insertInto('core.locations').values({ company_id: company.id, name: tag, state_code: 'WB' }).returning('id').executeTakeFirstOrThrow();
        const plant = await trx.insertInto('core.plants').values({ company_id: company.id, plant_code: tag, name: tag, location_id: loc.id }).returning('id').executeTakeFirstOrThrow();
        const emp = await trx.insertInto('core.employees').values({ company_id: company.id, ecode: `${tag}E`, first_name: 'H', status: 'active', doj: '2020-01-01' as never, location_id: loc.id, plant_id: plant.id }).returning('id').executeTakeFirstOrThrow();

        expect(await resolveHolidayScope(trx, { plantId: plant.id })).toEqual({ company_id: company.id, plant_id: plant.id, location_id: null });
        expect(await resolveHolidayScope(trx, { locationId: loc.id })).toEqual({ company_id: company.id, plant_id: null, location_id: loc.id });
        expect(await resolveHolidayScope(trx, {})).toEqual({ company_id: null, plant_id: null, location_id: null });
        await expect(resolveHolidayScope(trx, { companyId: other.id, plantId: plant.id })).rejects.toThrow(/different company/);
        await expect(resolveHolidayScope(trx, { companyId: other.id, locationId: loc.id })).rejects.toThrow(/different company/);
        await expect(resolveHolidayScope(trx, { plantId: 987654321 })).rejects.toThrow(/Unknown plant/);
        await expect(resolveHolidayScope(trx, { locationId: 987654321 })).rejects.toThrow(/Unknown location/);
        await expect(resolveHolidayScope(trx, { companyId: 987654321 })).rejects.toThrow(/Unknown company/);

        await trx.insertInto('att.day_records').values({ employee_id: emp.id, work_date: '2026-03-10' as never, status: 'A' }).execute();
        const scope = await resolveHolidayScope(trx, { companyId: company.id });
        expect(await upsertScopedHoliday(trx, scope, '2026-03-10', 'Holi')).toBe(true);
        expect(await upsertScopedHoliday(trx, scope, '2026-03-10', 'Holi (Dol Jatra)')).toBe(false);
        const queued = await trx.selectFrom('att.recompute_queue').select('employee_id').where('employee_id', '=', emp.id).where('work_date', '=', sql<Date>`'2026-03-10'::date`).execute();
        expect(queued.length).toBe(1);

        const shift = await trx.selectFrom('att.shifts').select('id').executeTakeFirst()
          ?? await trx.insertInto('att.shifts').values({ code: tag, name: tag, start_time: '09:00', end_time: '18:00' } as never).returning('id').executeTakeFirstOrThrow();
        await trx.insertInto('att.rosters').values({ employee_id: emp.id, work_date: '2026-03-08' as never, is_week_off: false, shift_id: shift.id }).execute();
        await trx.insertInto('att.rosters').values({ employee_id: emp.id, work_date: '2026-03-11' as never, is_week_off: true, shift_id: null }).execute();
        const off = await readPlannedOffDays(trx, emp.id, '2026-03-08', '2026-03-16');
        // Sun 8 is rostered working; Tue 10 holiday; Wed 11 rostered off; Sun 15 default week-off.
        expect([...off].sort()).toEqual(['2026-03-10', '2026-03-11', '2026-03-15']);
        expect((await readPlannedOffDays(trx, emp.id, '2026-03-08', '2026-03-08')).size).toBe(0);

        const month = await trx.selectNoFrom(periodMonthSql(sql`'2026-03-27'::date`, 26).as('m')).executeTakeFirstOrThrow();
        expect(new Date(month.m).toISOString().slice(0, 10)).toBe('2026-04-01');

        // Cycle setting: validated on write, read by core.
        await expect(setSetting(trx, { key: 'att.cycle_start_day', value: 31, type: 'number', description: 'x', actorUserId: null })).rejects.toThrow(/Invalid value/);
        await expect(setSetting(trx, { key: 'pay.lop_divisor', value: 'DAILY', type: 'string', description: 'x', actorUserId: null })).rejects.toThrow(/Invalid value/);
        await setSetting(trx, { key: 'att.cycle_start_day', value: 26, type: 'number', description: 'x', actorUserId: null });
        expect(await loadCycleStartDay(trx)).toBe(26);

        // A pre-cycle lock (no stored window) is a calendar month; the next window continues from it.
        const user = await trx.insertInto('core.users').values({ email: `${tag.toLowerCase()}@hrms.invalid`, password_hash: '!x!' }).returning('id').executeTakeFirstOrThrow();
        await trx.insertInto('att.month_locks').values({ company_id: company.id, month: '2026-02-01' as never, locked_by: user.id }).execute();
        expect(await resolveAttendanceWindow(trx, company.id, '2026-02-01')).toEqual({ from: '2026-02-01', until: '2026-03-01' });
        expect(await resolveAttendanceWindow(trx, company.id, '2026-03-01')).toEqual({ from: '2026-03-01', until: '2026-03-26' });

        // F&F helper: paid day-equivalents over locked facts; missing facts refuse.
        for (const [d, status] of [['2026-03-02', 'P'], ['2026-03-03', 'HD']] as const) {
          await trx.insertInto('att.day_records').values({ employee_id: emp.id, work_date: d as never, status, is_locked: true }).execute();
        }
        expect(await readLockedPayableDays(trx, emp.id, '2026-03-02', '2026-03-04')).toBe(1.5);
        await expect(readLockedPayableDays(trx, emp.id, '2026-03-02', '2026-03-02')).rejects.toThrow(/incomplete/);
        await expect(readLockedPayableDays(trx, emp.id, '2026-03-02', '2026-03-06')).rejects.toThrow(/incomplete/);
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
