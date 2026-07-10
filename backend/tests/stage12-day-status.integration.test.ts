/**
 * Stage 1.2 golden fixtures — EVERY day-status branch, hand-computed
 * (docs/04 §1.1 · 09 §4 two-session G5 + Saturday GCS · ATT-05/09/15/17/18).
 * Times are IST; the anchor Monday shifts by whole WEEKS per run (raw swipes
 * are immutable, so each run uses fresh dates while weekdays stay aligned).
 */
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql, type Kysely } from 'kysely';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import { closeWeek, recomputeDay, setManualStatus } from '../src/modules/attendance/index.js';

const DB_URL = process.env['DATABASE_URL'];
const run = describe.skipIf(!DB_URL);

const IST_OFFSET_MS = 5.5 * 3600_000;
/** IST wall-clock → UTC instant. */
function ist(isoDate: string, time: string): Date {
  return new Date(new Date(`${isoDate}T${time}:00Z`).getTime() - IST_OFFSET_MS);
}
function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// 2031-03-03 is a Monday; shift by run-unique whole weeks (weekday-aligned).
const WEEK_OFFSET = Date.now() % 2000;
const MON = addDays('2031-03-03', WEEK_OFFSET * 7);

run('Stage 1.2 — day-status processor golden fixtures (live Postgres)', () => {
  let db: Kysely<Database>;
  const stamp = Date.now();
  let emp1: number; // has swipes
  let emp2: number; // fully absent (week-off eligibility case)
  let adminUserId: number;
  const SOURCE = `s12-${stamp}`;

  async function makeEmployee(suffix: string): Promise<number> {
    const rml = await db.selectFrom('core.companies').select('id').where('code', '=', 'RML').executeTakeFirstOrThrow();
    const row = await db
      .insertInto('core.employees')
      .values({ ecode: `RML9${String(stamp).slice(-5)}${suffix}`, company_id: rml.id, first_name: `S12 ${suffix}` })
      .returning('id')
      .executeTakeFirstOrThrow();
    return row.id;
  }

  async function swipe(employeeId: number, at: Date): Promise<void> {
    const emp = await db.selectFrom('core.employees').select('ecode').where('id', '=', employeeId).executeTakeFirstOrThrow();
    await sql`SELECT att.ensure_swipe_partition(${at.toISOString().slice(0, 10)}::date)`.execute(db);
    await db
      .insertInto('att.swipe_events')
      .values({
        employee_id: employeeId,
        employee_no: emp.ecode,
        swipe_ts: at,
        door_code: `S12-${stamp}`,
        received_at: at,
        source: SOURCE,
      })
      .execute();
  }

  async function day(employeeId: number, isoDate: string) {
    return db
      .selectFrom('att.day_records')
      .selectAll()
      .where('employee_id', '=', employeeId)
      .where('work_date', '=', sql<Date>`${isoDate}::date`)
      .executeTakeFirstOrThrow();
  }

  beforeAll(async () => {
    db = createDatabase(DB_URL ?? '');
    emp1 = await makeEmployee('A');
    emp2 = await makeEmployee('B');
    const admin = await db
      .insertInto('core.users')
      .values({ email: `s12-admin-${stamp}@hrms.test`, password_hash: 'x' })
      .returning('id')
      .executeTakeFirstOrThrow();
    adminUserId = admin.id;

    // Scheme: weekday G5 (two-session), Saturday GCS — the live RML shape (09 §4).
    const g5 = await db.selectFrom('att.shifts').select('id').where('code', '=', 'G5').executeTakeFirstOrThrow();
    const gcs = await db.selectFrom('att.shifts').select('id').where('code', '=', 'GCS').executeTakeFirstOrThrow();
    for (const e of [emp1, emp2]) {
      await db
        .insertInto('att.employee_shifts')
        .values({ employee_id: e, weekday_shift_id: g5.id, saturday_shift_id: gcs.id })
        .execute();
    }
  });

  afterAll(async () => {
    await db.deleteFrom('att.recompute_queue').where('employee_id', 'in', [emp1, emp2]).execute();
    await sql`DELETE FROM att.day_records WHERE employee_id IN (${emp1}, ${emp2}) AND is_locked = false`.execute(db);
    await db.deleteFrom('att.employee_shifts').where('employee_id', 'in', [emp1, emp2]).execute();
    await db.deleteFrom('att.rosters').where('employee_id', 'in', [emp1, emp2]).execute();
    await db.deleteFrom('att.holidays').where('name', 'like', `S12 ${stamp}%`).execute();
    await db.updateTable('core.users').set({ is_active: false }).where('id', '=', adminUserId).execute();
    await db.destroy();
  });

  it('MON full day: 08:55–18:05 → P, no late/early, worked 520 min (550 − 30 break)', async () => {
    await swipe(emp1, ist(MON, '08:55'));
    await swipe(emp1, ist(MON, '18:05'));
    await recomputeDay(db, emp1, MON);
    const r = await day(emp1, MON);
    expect(r.status).toBe('P');
    expect(r.worked_minutes).toBe(520);
    expect(r.late_minutes).toBe(0);
    expect(r.early_exit_minutes).toBe(0);
    expect(r.scheme_code).toBe('G5');
    const sessions = r.session_statuses as { session: number; status: string }[];
    expect(sessions.map((s) => s.status)).toEqual(['P', 'P']);
  });

  it('TUE late arrival 09:25 (grace 10) → P with late_minutes 25', async () => {
    const d = addDays(MON, 1);
    await swipe(emp1, ist(d, '09:25'));
    await swipe(emp1, ist(d, '18:00'));
    await recomputeDay(db, emp1, d);
    const r = await day(emp1, d);
    expect(r.status).toBe('P');
    expect(r.late_minutes).toBe(25);
  });

  it('WED 09:00–13:30 → HD via sessions [P, A] (the live A:P dual-status shape)', async () => {
    const d = addDays(MON, 2);
    await swipe(emp1, ist(d, '09:00'));
    await swipe(emp1, ist(d, '13:30'));
    await recomputeDay(db, emp1, d);
    const r = await day(emp1, d);
    expect(r.status).toBe('HD');
    const sessions = r.session_statuses as { session: number; status: string }[];
    expect(sessions).toEqual([
      { session: 1, status: 'P' },
      { session: 2, status: 'A' },
    ]);
    expect(r.early_exit_minutes).toBe(270); // magnitude vs shift END 18:00 (grace only gates whether it counts)
  });

  it('THU one short hour → A (below both session halves)', async () => {
    const d = addDays(MON, 3);
    await swipe(emp1, ist(d, '09:00'));
    await swipe(emp1, ist(d, '10:00'));
    await recomputeDay(db, emp1, d);
    expect((await day(emp1, d)).status).toBe('A');
  });

  it('FRI no swipes → A', async () => {
    const d = addDays(MON, 4);
    await recomputeDay(db, emp1, d);
    expect((await day(emp1, d)).status).toBe('A');
  });

  it('SAT runs the GCS scheme: 09:02–13:32 → P on the half-day shift (09 §4)', async () => {
    const d = addDays(MON, 5);
    await swipe(emp1, ist(d, '09:02'));
    await swipe(emp1, ist(d, '13:32'));
    await recomputeDay(db, emp1, d);
    const r = await day(emp1, d);
    expect(r.status).toBe('P');
    expect(r.scheme_code).toBe('GCS');
    expect(r.worked_minutes).toBe(270); // 4.5h, no break on GCS
  });

  it('SUN without roster → WO', async () => {
    const d = addDays(MON, 6);
    await recomputeDay(db, emp1, d);
    expect((await day(emp1, d)).status).toBe('WO');
  });

  it('holiday wins over everything → H (ATT-13)', async () => {
    const d = addDays(MON, 7);
    await db
      .insertInto('att.holidays')
      .values({ holiday_date: sql<Date>`${d}::date` as unknown as Date, name: `S12 ${stamp} Holi`, location_id: null })
      .execute();
    await recomputeDay(db, emp1, d);
    expect((await day(emp1, d)).status).toBe('H');
  });

  it('NIGHT shift via roster: 21:55 → 06:04 next day attributes to the shift date → P', async () => {
    const d = addDays(MON, 8);
    const night = await db.selectFrom('att.shifts').select('id').where('code', '=', 'NIGHT').executeTakeFirstOrThrow();
    await db
      .insertInto('att.rosters')
      .values({ employee_id: emp1, work_date: sql<Date>`${d}::date` as unknown as Date, shift_id: night.id, is_week_off: false })
      .execute();
    await swipe(emp1, ist(d, '21:55'));
    await swipe(emp1, ist(addDays(d, 1), '06:04'));
    await recomputeDay(db, emp1, d);
    const r = await day(emp1, d);
    expect(r.status).toBe('P');
    expect(r.worked_minutes).toBe(459); // 489 raw − 30 break
    expect(r.scheme_code).toBe('NIGHT');
  });

  it('manual HR override survives recompute and is audited (ATT-17)', async () => {
    const d = addDays(MON, 9);
    await setManualStatus(db, { employeeId: emp1, isoDate: d, status: 'P', reason: 'Machine offline, gate register verified', actorUserId: adminUserId });
    await swipe(emp1, ist(d, '09:00'));
    await swipe(emp1, ist(d, '09:30')); // would compute A
    const result = await recomputeDay(db, emp1, d);
    expect(result).toBe('skipped');
    const r = await day(emp1, d);
    expect(r.status).toBe('P');
    expect(r.source).toBe('manual');

    const audit = await db
      .selectFrom('core.audit_log')
      .select('new_value')
      .where('entity', '=', 'att.day_records')
      .where('field', '=', `manual_override:${d}`)
      .executeTakeFirstOrThrow();
    expect(audit.new_value).toContain('gate register');
  });

  it('locked rows are untouchable: recompute skips, direct UPDATE rejected by the DB (ATT-15)', async () => {
    const d = addDays(MON, 10);
    await recomputeDay(db, emp1, d); // A (no swipes)
    await db
      .updateTable('att.day_records')
      .set({ is_locked: true })
      .where('employee_id', '=', emp1)
      .where('work_date', '=', sql<Date>`${d}::date`)
      .execute();

    expect(await recomputeDay(db, emp1, d)).toBe('skipped');
    await expect(
      db
        .updateTable('att.day_records')
        .set({ status: 'P' })
        .where('employee_id', '=', emp1)
        .where('work_date', '=', sql<Date>`${d}::date`)
        .execute(),
    ).rejects.toThrow(/locked/);
  });

  it('recompute is idempotent: second run yields the identical record (ATT-03)', async () => {
    const first = await day(emp1, MON);
    await recomputeDay(db, emp1, MON);
    const second = await day(emp1, MON);
    expect(second.status).toBe(first.status);
    expect(second.worked_minutes).toBe(first.worked_minutes);
    expect(second.late_minutes).toBe(first.late_minutes);
    expect(second.session_statuses).toEqual(first.session_statuses);
  });

  it('week-off eligibility (ATT-09, PI-PAY-1/2): a zero-work week earns an UNPAID week-off; a worked week earns a paid one', async () => {
    // emp2: absent all week (recompute Mon–Sat = A, Sun = WO).
    for (let i = 0; i < 7; i++) await recomputeDay(db, emp2, addDays(MON, i));

    const updated = await closeWeek(db, MON);
    expect(updated).toBeGreaterThanOrEqual(2);

    const sun = addDays(MON, 6);
    expect((await day(emp2, sun)).weekoff_paid).toBe(false); // worked 0 days → unpaid (PI-PAY-1)
    expect((await day(emp1, sun)).weekoff_paid).toBe(true); // worked ≥1 day → paid
  });
});
