/**
 * Day-status processor (ATT-03/05/17/18, docs/04 §1.1, 09 §4):
 * raw swipes + shift + calendar → one processed day record. Deterministic and
 * idempotent — recomputing an unchanged day yields the identical row.
 *
 * Resolution order for the day's shift (all DATA, all runtime-editable):
 *   roster row (manager) → employee scheme (Saturday vs weekday) → the
 *   `att.default_shift_code` setting.
 * Statuses: H (holiday) · WO (week-off) · else from FILO worked hours vs the
 * shift's thresholds: ≥ full → P · ≥ half → HD · else A.
 * Two-session shifts (G5) get per-session statuses; one present session = HD.
 * Rows with source='manual' (HR override, audited) or is_locked are NEVER
 * touched by recompute.
 */
import { sql, type Kysely, type Selectable, type Transaction } from 'kysely';
import type { AttShiftsTable, Database, DayStatus } from '../../core/db/types.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { getTypedSetting } from '../settings/index.js';

const IST_OFFSET_MS = 5.5 * 3600_000; // Asia/Kolkata — no DST, fixed offset (NFR-09)
/** Swipes are collected from shift start − 3h to shift end + 6h (late leavers). */
const EARLY_MARGIN_MS = 3 * 3600_000;
const LATE_MARGIN_MS = 6 * 3600_000;

type ShiftRow = Selectable<AttShiftsTable>;

/** 'YYYY-MM-DD' + 'HH:MM[:SS]' in IST → UTC Date. */
function istDateTime(isoDate: string, time: string): Date {
  return new Date(new Date(`${isoDate}T${time.length === 5 ? `${time}:00` : time}Z`).getTime() - IST_OFFSET_MS);
}

function toIsoDate(d: Date): string {
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export interface ResolvedShift {
  shift: ShiftRow | null;
  isWeekOff: boolean;
  isHoliday: boolean;
  holidayName?: string;
}

async function resolveDay(
  db: Kysely<Database> | Transaction<Database>,
  employeeId: number,
  isoDate: string,
): Promise<ResolvedShift> {
  const employee = await db
    .selectFrom('core.employees')
    .select(['location_id'])
    .where('id', '=', employeeId)
    .executeTakeFirstOrThrow();

  const holiday = await db
    .selectFrom('att.holidays')
    .select('name')
    .where('holiday_date', '=', sql<Date>`${isoDate}::date`)
    .where((eb) =>
      employee.location_id === null
        ? eb('location_id', 'is', null)
        : eb.or([eb('location_id', 'is', null), eb('location_id', '=', employee.location_id)]),
    )
    .executeTakeFirst();
  if (holiday) return { shift: null, isWeekOff: false, isHoliday: true, holidayName: holiday.name };

  const roster = await db
    .selectFrom('att.rosters')
    .selectAll()
    .where('employee_id', '=', employeeId)
    .where('work_date', '=', sql<Date>`${isoDate}::date`)
    .executeTakeFirst();
  if (roster) {
    if (roster.is_week_off) return { shift: null, isWeekOff: true, isHoliday: false };
    const shift = await db
      .selectFrom('att.shifts')
      .selectAll()
      .where('id', '=', roster.shift_id ?? -1)
      .executeTakeFirst();
    return { shift: shift ?? null, isWeekOff: false, isHoliday: false };
  }

  const scheme = await db
    .selectFrom('att.employee_shifts')
    .selectAll()
    .where('employee_id', '=', employeeId)
    .executeTakeFirst();

  const dow = new Date(`${isoDate}T00:00:00Z`).getUTCDay(); // 0 Sun … 6 Sat
  if (dow === 0) {
    // No roster row (handled above) → Sunday defaults to the week-off.
    return { shift: null, isWeekOff: true, isHoliday: false };
  }

  let shiftId: number | null = null;
  if (scheme) {
    shiftId = dow === 6 && scheme.saturday_shift_id !== null ? scheme.saturday_shift_id : scheme.weekday_shift_id;
  }

  let shift: ShiftRow | undefined;
  if (shiftId !== null) {
    shift = await db.selectFrom('att.shifts').selectAll().where('id', '=', shiftId).executeTakeFirst();
  } else {
    const defaultCode = await getTypedSetting(db as Kysely<Database>, 'att.default_shift_code', 'string', 'GEN');
    shift = await db.selectFrom('att.shifts').selectAll().where('code', '=', defaultCode).executeTakeFirst();
  }
  return { shift: shift ?? null, isWeekOff: false, isHoliday: false };
}

interface SessionStatus {
  session: number;
  status: 'P' | 'A';
}

export interface ComputedDay {
  status: DayStatus;
  firstIn: Date | null;
  lastOut: Date | null;
  workedMinutes: number | null;
  lateMinutes: number;
  earlyExitMinutes: number;
  sessionStatuses: SessionStatus[] | null;
  schemeCode: string | null;
  shiftId: number | null;
}

/** Pure computation — the golden-test surface. */
export function computeDayStatus(
  resolved: ResolvedShift,
  isoDate: string,
  swipeTimes: Date[], // all swipes attributed to this day, any order
): ComputedDay {
  if (resolved.isHoliday) {
    return { status: 'H', firstIn: null, lastOut: null, workedMinutes: null, lateMinutes: 0, earlyExitMinutes: 0, sessionStatuses: null, schemeCode: null, shiftId: null };
  }
  if (resolved.isWeekOff || !resolved.shift) {
    return { status: 'WO', firstIn: null, lastOut: null, workedMinutes: null, lateMinutes: 0, earlyExitMinutes: 0, sessionStatuses: null, schemeCode: null, shiftId: null };
  }

  const shift = resolved.shift;
  const start = istDateTime(isoDate, shift.start_time);
  const end = new Date(istDateTime(isoDate, shift.end_time).getTime() + (shift.crosses_midnight ? 86_400_000 : 0));
  const windowStart = new Date(start.getTime() - EARLY_MARGIN_MS);
  const windowEnd = new Date(end.getTime() + LATE_MARGIN_MS);

  const inWindow = swipeTimes.filter((t) => t >= windowStart && t <= windowEnd).sort((a, b) => a.getTime() - b.getTime());
  const base = {
    schemeCode: shift.code,
    shiftId: shift.id,
  };

  if (inWindow.length === 0) {
    return { ...base, status: 'A', firstIn: null, lastOut: null, workedMinutes: 0, lateMinutes: 0, earlyExitMinutes: 0, sessionStatuses: null };
  }

  // FILO — first in, last out (ATT-18, PP-v2-2).
  const firstIn = inWindow[0] ?? null;
  const lastOut = inWindow.length > 1 ? (inWindow[inWindow.length - 1] ?? null) : null;

  const rawMinutes = firstIn && lastOut ? Math.floor((lastOut.getTime() - firstIn.getTime()) / 60_000) : 0;
  const workedMinutes = Math.max(0, rawMinutes - shift.break_minutes);

  const graceIn = shift.grace_in_minutes * 60_000;
  const graceOut = shift.grace_out_minutes * 60_000;
  const lateMinutes = firstIn && firstIn.getTime() > start.getTime() + graceIn
    ? Math.floor((firstIn.getTime() - start.getTime()) / 60_000)
    : 0;
  const earlyExitMinutes = lastOut && lastOut.getTime() < end.getTime() - graceOut
    ? Math.floor((end.getTime() - lastOut.getTime()) / 60_000)
    : 0;

  const fullMin = Number(shift.min_full_day_hours) * 60;
  const halfMin = Number(shift.min_half_day_hours) * 60;

  let status: DayStatus;
  let sessionStatuses: SessionStatus[] | null = null;

  if (shift.session_split !== null && firstIn && lastOut) {
    // Two-session day (09 §4): a session is Present when coverage ≥ half of it.
    const split = istDateTime(isoDate, shift.session_split);
    const sessions: [Date, Date][] = [
      [start, split],
      [split, end],
    ];
    sessionStatuses = sessions.map(([s, e], i): SessionStatus => {
      const overlap = Math.min(lastOut.getTime(), e.getTime()) - Math.max(firstIn.getTime(), s.getTime());
      return { session: i + 1, status: overlap >= (e.getTime() - s.getTime()) / 2 ? 'P' : 'A' };
    });
    const present = sessionStatuses.filter((s) => s.status === 'P').length;
    status = present === 2 ? 'P' : present === 1 ? 'HD' : 'A';
  } else {
    status = workedMinutes >= fullMin ? 'P' : workedMinutes >= halfMin ? 'HD' : 'A';
  }

  return { ...base, status, firstIn, lastOut, workedMinutes, lateMinutes, earlyExitMinutes, sessionStatuses };
}

/** Recompute one employee-day from raw truth. Skips manual/locked rows (ATT-17/15). */
export async function recomputeDay(db: Kysely<Database>, employeeId: number, isoDate: string): Promise<DayStatus | 'skipped'> {
  const existing = await db
    .selectFrom('att.day_records')
    .select(['id', 'source', 'is_locked'])
    .where('employee_id', '=', employeeId)
    .where('work_date', '=', sql<Date>`${isoDate}::date`)
    .executeTakeFirst();
  if (existing && (existing.is_locked || existing.source === 'manual')) return 'skipped';

  const resolved = await resolveDay(db, employeeId, isoDate);

  // Attribution window: the day's shift window (handles crosses_midnight).
  const dayStartIst = istDateTime(isoDate, '00:00');
  const from = new Date(dayStartIst.getTime() - EARLY_MARGIN_MS);
  const to = new Date(dayStartIst.getTime() + 2 * 86_400_000); // covers night shifts into D+1
  const swipes = await db
    .selectFrom('att.swipe_events')
    .select('swipe_ts')
    .where('employee_id', '=', employeeId)
    .where('swipe_ts', '>=', from)
    .where('swipe_ts', '<', to)
    .orderBy('swipe_ts')
    .execute();

  const computed = computeDayStatus(resolved, isoDate, swipes.map((s) => s.swipe_ts));

  await db
    .insertInto('att.day_records')
    .values({
      employee_id: employeeId,
      work_date: sql<Date>`${isoDate}::date` as unknown as Date,
      shift_id: computed.shiftId,
      status: computed.status,
      first_in: computed.firstIn,
      last_out: computed.lastOut,
      worked_minutes: computed.workedMinutes,
      late_minutes: computed.lateMinutes,
      early_exit_minutes: computed.earlyExitMinutes,
      session_statuses: computed.sessionStatuses ? JSON.stringify(computed.sessionStatuses) : null,
      scheme_code: computed.schemeCode,
      source: 'auto',
      computed_at: new Date(),
    })
    .onConflict((oc) =>
      oc.columns(['employee_id', 'work_date']).doUpdateSet({
        shift_id: computed.shiftId,
        status: computed.status,
        first_in: computed.firstIn,
        last_out: computed.lastOut,
        worked_minutes: computed.workedMinutes,
        late_minutes: computed.lateMinutes,
        early_exit_minutes: computed.earlyExitMinutes,
        session_statuses: computed.sessionStatuses ? JSON.stringify(computed.sessionStatuses) : null,
        scheme_code: computed.schemeCode,
        source: 'auto',
        computed_at: new Date(),
      }),
    )
    .execute();

  return computed.status;
}

/** Drain the dirty queue (called after each sync cycle + by the worker). */
export async function drainRecomputeQueue(db: Kysely<Database>, batch = 500): Promise<number> {
  const items = await db
    .selectFrom('att.recompute_queue')
    .selectAll()
    .orderBy('queued_at')
    .limit(batch)
    .execute();

  for (const item of items) {
    const isoDate = toIsoDate(item.work_date);
    await recomputeDay(db, item.employee_id, isoDate);
    await db
      .deleteFrom('att.recompute_queue')
      .where('employee_id', '=', item.employee_id)
      .where('work_date', '=', item.work_date)
      .execute();
  }
  return items.length;
}

/** HR-only manual override — mandatory reason, audited, survives recompute (ATT-17). */
export async function setManualStatus(
  db: Kysely<Database>,
  params: { employeeId: number; isoDate: string; status: DayStatus; reason: string; actorUserId: number },
): Promise<void> {
  const previous = await db
    .selectFrom('att.day_records')
    .select(['status'])
    .where('employee_id', '=', params.employeeId)
    .where('work_date', '=', sql<Date>`${params.isoDate}::date`)
    .executeTakeFirst();

  await db
    .insertInto('att.day_records')
    .values({
      employee_id: params.employeeId,
      work_date: sql<Date>`${params.isoDate}::date` as unknown as Date,
      status: params.status,
      source: 'manual',
      override_reason: params.reason,
      computed_at: new Date(),
    })
    .onConflict((oc) =>
      oc.columns(['employee_id', 'work_date']).doUpdateSet({
        status: params.status,
        source: 'manual',
        override_reason: params.reason,
        computed_at: new Date(),
      }),
    )
    .execute();

  await writeAudit(db, {
    actorUserId: params.actorUserId,
    action: 'update',
    entity: 'att.day_records',
    entityId: params.employeeId,
    field: `manual_override:${params.isoDate}`,
    oldValue: previous?.status ?? null,
    newValue: `${params.status} — ${params.reason}`,
  });
}

/**
 * Week-off eligibility at week close (ATT-09, PI-PAY-1/2): an employee who
 * worked fewer than `att.weekoff_min_worked_days` days that week earns NO paid
 * week-off. Runs for the Mon–Sun week containing `weekStartIso`.
 */
export async function closeWeek(db: Kysely<Database>, weekStartIso: string): Promise<number> {
  const minWorked = await getTypedSetting(db, 'att.weekoff_min_worked_days', 'number', 1);

  const rows = await db
    .selectFrom('att.day_records')
    .select(['employee_id', 'work_date', 'status'])
    .where('work_date', '>=', sql<Date>`${weekStartIso}::date`)
    .where('work_date', '<', sql<Date>`${weekStartIso}::date + 7`)
    .where('is_locked', '=', false)
    .execute();

  const byEmployee = new Map<number, { worked: number; weekoffDates: Date[] }>();
  for (const r of rows) {
    const entry = byEmployee.get(r.employee_id) ?? { worked: 0, weekoffDates: [] };
    if (r.status === 'P' || r.status === 'HD') entry.worked += 1;
    if (r.status === 'WO') entry.weekoffDates.push(r.work_date);
    byEmployee.set(r.employee_id, entry);
  }

  let updated = 0;
  for (const [employeeId, entry] of byEmployee) {
    if (entry.weekoffDates.length === 0) continue;
    const paid = entry.worked >= minWorked;
    for (const d of entry.weekoffDates) {
      await db
        .updateTable('att.day_records')
        .set({ weekoff_paid: paid })
        .where('employee_id', '=', employeeId)
        .where('work_date', '=', d)
        .where('is_locked', '=', false)
        .execute();
      updated += 1;
    }
  }
  return updated;
}
