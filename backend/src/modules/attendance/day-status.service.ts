/**
 * Day-status processor (ATT-03/05/09/17/18, docs/04 §1.1-1.2, 09 §4):
 * raw swipes + shift + calendar → one processed day record. Deterministic and
 * idempotent — recomputing an unchanged day yields the identical row.
 *
 * Resolution order for the day's shift (all DATA, all runtime-editable):
 *   roster row (manager) → employee scheme (Saturday vs weekday) → the
 *   `att.default_shift_code` setting.
 * Statuses: H (holiday) · WO (week-off) · else from FILO worked hours vs the
 * shift's thresholds. Two-session shifts (G5) get per-session statuses.
 *
 * EXCLUSIVE ATTRIBUTION (review F1): a swipe belongs to exactly ONE
 * employee-day — the day whose shift interval it is nearest to. Prevents a
 * night-worker's morning exit from counting on both the night day and the next
 * day. All window margins + the session-presence fraction are POLICY read from
 * core.settings (review F10), never hardcoded.
 */
import { evaluateAttendancePenalties } from './penalty-evaluation.js';
import { logger } from '../../core/logger.js';
import { closeWeekOffs, recloseDecidedWeekOffs } from '../../core/db/attendance-period.js';
import { findHoliday, loadHolidaySubject } from '../../core/db/holiday-calendar.js';
import { loadCycleStartDay, periodMonthOf } from '../../core/db/attendance-cycle.js';
import { sql, type Kysely, type Selectable, type Transaction } from 'kysely';
import type { AttShiftsTable, Database, DayStatus } from '../../core/db/types.js';
import { getTypedSetting } from '../settings/index.js';
import { addDaysIso, formatDbDate, istDateTime, istDateString } from '../../core/dates.js';
import { recordDetectedOvertime } from './overtime.service.js';
import { approvedHalfRequests, overlayHalfRequests } from './half-requests.js';
import { readSessionStatuses } from './session-status.js';
import { inTransaction } from '../../core/db/database.js';
import { dayFinalizationAt, loadFinalizationTime } from './day-finalization.js';
import { scheduledShiftIntervals, shiftSessions, selectFilo, swipePoints, type AttendanceSwipe, type ShiftInterval, type SwipePoint } from './shift-windows.js';

type Db = Kysely<Database> | Transaction<Database>;
type ShiftRow = Selectable<AttShiftsTable>;

/** Statuses that count as "present for the week" in week-off eligibility
 *  (docs/04 §1.2: P, HD, OD, CO, H, L-paid). LWP is still status L but has
 *  is_paid=false on lv.leave_types — closeWeek joins that flag. */

export interface AttendancePolicy {
  earlyMarginMs: number;
  lateMarginMs: number;
  sessionPresentFraction: number;
  /** OT below this is noise, not an entry (docs/04 §1.4). */
  otMinMinutes: number;
  /** ATT-08: the manager's hard decision window after intimation. */
  otDecisionHours: number;
}

/** Resolve the tunable attendance policy from settings (docs/04 §1.1 defaults). */
export async function loadAttendancePolicy(db: Kysely<Database>): Promise<AttendancePolicy> {
  const earlyHours = await getTypedSetting(db, 'att.swipe_window_early_hours', 'number', 4);
  const lateHours = await getTypedSetting(db, 'att.swipe_window_late_hours', 'number', 8);
  const sessionPresentFraction = await getTypedSetting(db, 'att.session_present_fraction', 'number', 0.5);
  const otMinMinutes = await getTypedSetting(db, 'att.ot_min_minutes', 'number', 30);
  const otDecisionHours = await getTypedSetting(db, 'att.ot_decision_hours', 'number', 48);
  return {
    earlyMarginMs: earlyHours * 3600_000,
    lateMarginMs: lateHours * 3600_000,
    sessionPresentFraction,
    otMinMinutes,
    otDecisionHours,
  };
}

export interface ResolvedShift {
  shift: ShiftRow | null;
  isWeekOff: boolean;
  isHoliday: boolean;
  holidayName?: string;
}

/** Resolve a day's shift/off-day kind (roster → scheme → default + holidays).
 *  Exported so the regularization write-back can skip off-days authoritatively
 *  instead of re-deriving the calendar. */
export async function resolveDay(db: Db, employeeId: number, isoDate: string): Promise<ResolvedShift> {
  // C-35: group / company / plant / location holiday calendars.
  const holiday = await findHoliday(db, await loadHolidaySubject(db, employeeId), isoDate);
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

export type FinalizationHoldReason =
  | 'day_cutoff_pending'
  | 'location_not_mapped'
  | 'no_active_devices'
  | 'device_watermark_pending';

export interface AbsenceFinalizationReadiness {
  ready: boolean;
  reason: FinalizationHoldReason | null;
  shiftEndAt: Date | null;
  finalizeAfterAt?: Date | null;
  pendingDoors: string[];
}

export interface FinalizationHold {
  employeeId: number;
  ecode: string;
  employeeName: string;
  workDate: string;
  shiftEndAt: string | null;
  finalizeAfterAt: string | null;
  reason: FinalizationHoldReason;
  pendingDoors: string[];
}

/** The working [start, end] instants (ms) for a resolved shift, or null (WO/holiday). */
function shiftInterval(resolved: ResolvedShift, isoDate: string): ShiftInterval | null {
  if (resolved.isHoliday || resolved.isWeekOff || !resolved.shift) return null;
  const intervals = scheduledShiftIntervals(resolved.shift, isoDate);
  return { start: Math.min(...intervals.map(iv => iv.start)), end: Math.max(...intervals.map(iv => iv.end)) };
}

/**
 * Doc 14 §8.5: an automatic absence is safe only after every active biometric
 * door mapped to the employee's location is complete through shift end.
 * Mobile/manual attendance and employees not yet biometrically registered do
 * not depend on the Kent door fleet.
 */
export async function getAbsenceFinalizationReadiness(
  db: Db,
  employeeId: number,
  isoDate: string,
  resolvedDay?: ResolvedShift,
): Promise<AbsenceFinalizationReadiness> {
  const employee = await db
    .selectFrom('core.employees')
    .select(['attendance_mode', 'biometric_registered', 'location_id'])
    .where('id', '=', employeeId)
    .executeTakeFirstOrThrow();

  if (employee.attendance_mode !== 'biometric' || !employee.biometric_registered) {
    return { ready: true, reason: null, shiftEndAt: null, pendingDoors: [] };
  }

  const resolved = resolvedDay ?? (await resolveDay(db, employeeId, isoDate));
  const interval = shiftInterval(resolved, isoDate);
  const shiftEndAt = interval ? new Date(interval.end) : null;
  const finalizeAfterAt = dayFinalizationAt(isoDate, await loadFinalizationTime(db), interval?.end);
  if (Date.now() < finalizeAfterAt.getTime()) {
    return { ready: false, reason: 'day_cutoff_pending', shiftEndAt, finalizeAfterAt, pendingDoors: [] };
  }

  if (employee.location_id === null) {
    return {
      ready: false,
      reason: 'location_not_mapped',
      shiftEndAt,
      finalizeAfterAt,
      pendingDoors: [],
    };
  }

  const devices = await db
    .selectFrom('att.devices as device')
    .leftJoin('att.device_watermarks as watermark', 'watermark.device_id', 'device.id')
    .select(['device.door_code', 'watermark.watermark_ts'])
    .where('device.location_id', '=', employee.location_id)
    .where('device.is_active', '=', true)
    .orderBy('device.door_code')
    .execute();

  if (devices.length === 0) {
    return {
      ready: false,
      reason: 'no_active_devices',
      shiftEndAt,
      finalizeAfterAt,
      pendingDoors: [],
    };
  }

  const pendingDoors = devices
    .filter((device) => !device.watermark_ts || device.watermark_ts < finalizeAfterAt)
    .map((device) => device.door_code);
  return pendingDoors.length === 0
    ? { ready: true, reason: null, shiftEndAt, finalizeAfterAt, pendingDoors: [] }
    : { ready: false, reason: 'device_watermark_pending', shiftEndAt, finalizeAfterAt, pendingDoors };
}

/** Distance (ms) from an instant to a shift interval; 0 if inside. */
function distanceTo(t: number, iv: ShiftInterval): number {
  if (t >= iv.start && t <= iv.end) return 0;
  return t < iv.start ? iv.start - t : t - iv.end;
}

/**
 * Keep only the swipes THIS day owns. A swipe in the day's early margin that is
 * nearer the previous day's shift, or in the late margin nearer the next day's
 * shift, belongs to that neighbour. Neighbours are resolved lazily — only when
 * a contested swipe exists — so ordinary days pay no extra queries.
 */
async function attributeOwnedSwipes(
  db: Db,
  employeeId: number,
  isoDate: string,
  cur: ShiftInterval,
  swipes: SwipePoint[],
  finalizationTime: string,
): Promise<SwipePoint[]> {
  let prevIv: ShiftInterval | null | undefined;
  let nextIv: ShiftInterval | null | undefined;
  const owned: SwipePoint[] = [];

  for (const swipe of swipes) {
    const t = swipe.swipeTs.getTime();
    if (t >= cur.start && t <= cur.end) {
      owned.push(swipe); // inside the core interval → unambiguously ours
      continue;
    }
    if (t < cur.start) {
      if (prevIv === undefined) {
        prevIv = shiftInterval(await resolveDay(db, employeeId, addDaysIso(isoDate, -1)), addDaysIso(isoDate, -1));
      }
      // An explicit pre-cutoff OUT after yesterday's shift is not today's IN,
      // even when today's early shift is temporally nearer.
      if (swipe.direction?.toLowerCase() === 'out' && prevIv && t > prevIv.end
        && t <= dayFinalizationAt(addDaysIso(isoDate, -1), finalizationTime, prevIv.end).getTime()) continue;
      // Early margin: keep unless the previous day's shift is strictly nearer.
      if (prevIv === null || distanceTo(t, cur) < distanceTo(t, prevIv)) owned.push(swipe);
    } else {
      if (nextIv === undefined) {
        nextIv = shiftInterval(await resolveDay(db, employeeId, addDaysIso(isoDate, 1)), addDaysIso(isoDate, 1));
      }
      if (swipe.direction?.toLowerCase() === 'out'
        && t <= dayFinalizationAt(isoDate, finalizationTime, cur.end).getTime()
        && (nextIv === null || t < nextIv.start)) { owned.push(swipe); continue; }
      // Late margin: keep on ties (cur is the earlier day) — see F1 proof.
      if (nextIv === null || distanceTo(t, cur) <= distanceTo(t, nextIv)) owned.push(swipe);
    }
  }
  return owned;
}

interface SessionStatus {
  session: number;
  status: 'P' | 'A' | 'O' | 'OD';
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
  /** Detected OT (ATT-08): minutes beyond shift end, or ALL worked minutes on a
   *  WO/holiday. Raw detection — the ≥ threshold gate applies at entry creation. */
  otMinutes: number;
}

/**
 * Pure computation — the golden-test surface. `swipeTimes` are already the
 * swipes THIS day owns (attribution happens in recomputeDay); this function
 * still window-clips defensively, which is a no-op for owned swipes.
 */
export function computeDayStatus(
  resolved: ResolvedShift,
  isoDate: string,
  swipeTimes: AttendanceSwipe[],
  policy: AttendancePolicy,
  finalizationTime?: string,
): ComputedDay {
  const swipes = swipePoints(swipeTimes);
  if (resolved.isHoliday || resolved.isWeekOff) {
    // WO/H day: no shift interval, but swipes still mean WORK — FILO minutes
    // become detected OT (docs/04 §1.4: week-off/holiday work is OT-eligible).
    const { firstIn, lastOut } = selectFilo(swipes);
    const worked = firstIn && lastOut ? Math.floor((lastOut.getTime() - firstIn.getTime()) / 60_000) : null;
    return {
      status: resolved.isHoliday ? 'H' : 'WO',
      schemeCode: null,
      shiftId: null,
      firstIn,
      lastOut,
      workedMinutes: worked,
      lateMinutes: 0,
      earlyExitMinutes: 0,
      sessionStatuses: null,
      otMinutes: worked ?? 0,
    };
  }

  if (!resolved.shift) throw new Error('No shift configured for this working day');
  const shift = resolved.shift;
  const intervals = scheduledShiftIntervals(shift, isoDate);
  const sessions = shiftSessions(shift, isoDate, intervals);
  const start = new Date(Math.min(...intervals.map(iv => iv.start)));
  const end = new Date(Math.max(...intervals.map(iv => iv.end)));
  const windowStart = new Date(start.getTime() - policy.earlyMarginMs);
  const windowEnd = new Date(Math.max(end.getTime() + policy.lateMarginMs,
    finalizationTime ? dayFinalizationAt(isoDate, finalizationTime, end.getTime()).getTime() : end.getTime()));

  const inWindow = swipes.filter(swipe => swipe.swipeTs >= windowStart && swipe.swipeTs <= windowEnd);
  const base = { schemeCode: shift.code, shiftId: shift.id };

  if (inWindow.length === 0) {
    return { ...base, status: 'A', firstIn: null, lastOut: null, workedMinutes: 0, lateMinutes: 0, earlyExitMinutes: 0, sessionStatuses: sessions === null ? null : [{ session: 1, status: 'A' }, { session: 2, status: 'A' }], otMinutes: 0 };
  }

  // FILO — first in, last out (ATT-18, PP-v2-2).
  const { firstIn, lastOut } = selectFilo(inWindow);

  const rawMinutes = firstIn && lastOut
    ? intervals.length === 2
      ? intervals.reduce((sum, iv) => sum + Math.floor(Math.max(0, Math.min(lastOut.getTime(), iv.end) - Math.max(firstIn.getTime(), iv.start)) / 60000), 0)
      : Math.floor((lastOut.getTime() - firstIn.getTime()) / 60000)
    : 0;
  const workedMinutes = Math.max(0, rawMinutes - (shift.break_paid ? 0 : shift.break_minutes));

  const graceIn = shift.grace_in_minutes * 60_000;
  const graceOut = shift.grace_out_minutes * 60_000;
  const lateMinutes =
    firstIn && firstIn.getTime() > start.getTime() + graceIn ? Math.floor((firstIn.getTime() - start.getTime() - graceIn) / 60_000) : 0;
  const earlyExitMinutes =
    lastOut && lastOut.getTime() < end.getTime() - graceOut ? Math.floor((end.getTime() - graceOut - lastOut.getTime()) / 60_000) : 0;

  const fullMin = Number(shift.min_full_day_hours) * 60;
  const halfMin = Number(shift.min_half_day_hours) * 60;

  let status: DayStatus;
  let sessionStatuses: SessionStatus[] | null = null;

  if (sessions !== null) {
    sessionStatuses = sessions.map((session, i): SessionStatus => {
      const overlap = firstIn && lastOut ? Math.max(0, Math.min(lastOut.getTime(), session.end) - Math.max(firstIn.getTime(), session.start)) : 0;
      const need = (session.end - session.start) * policy.sessionPresentFraction;
      return { session: i + 1, status: firstIn && lastOut && overlap >= need ? 'P' : 'A' };
    });
    const present = sessionStatuses.filter((s) => s.status === 'P').length;
    status = present === 2 ? 'P' : present === 1 ? 'HD' : 'A';
  } else {
    status = workedMinutes >= fullMin ? 'P' : workedMinutes >= halfMin ? 'HD' : 'A';
  }

  // OT = time past shift end (ATT-08); grace-out is a penalty concept, not an
  // OT one, so it does not shave detected minutes.
  const otStart = end.getTime() + shift.ot_start_offset_minutes * 60_000;
  const otMinutes = lastOut && lastOut.getTime() > otStart ? Math.floor((lastOut.getTime() - otStart) / 60_000) : 0;

  return { ...base, status, firstIn, lastOut, workedMinutes, lateMinutes, earlyExitMinutes, sessionStatuses, otMinutes };
}

async function queueHalfRecompute(db: Kysely<Database>, employeeId: number, isoDate: string, due: Date) {
  await db.insertInto('att.recompute_queue').values({ employee_id: employeeId,
    work_date: sql<Date>`${isoDate}::date`, queued_at: due })
    .onConflict(oc => oc.columns(['employee_id', 'work_date']).doUpdateSet({ queued_at: due })).execute();
}

/** Recompute one employee-day from raw truth. Manual/whole-day regularized/locked rows
 *  are never overwritten; partial approvals are overlaid under the employee lock — enforced both by the pre-check AND the
 *  conflict-WHERE, so an override or an approved regularization committed
 *  concurrently is not clobbered (review F9; Stage 1.4). */
export async function recomputeDay(
  db: Kysely<Database>,
  employeeId: number,
  isoDate: string,
  policy?: AttendancePolicy,
): Promise<DayStatus | 'held' | 'skipped'> {
  const pol = policy ?? (await loadAttendancePolicy(db));
  if (!db.isTransaction) {
    const result = await inTransaction(db, tx => recomputeDay(tx, employeeId, isoDate, pol));
    if (result !== 'held' && result !== 'skipped') {
      const posted = await db.selectFrom('att.day_records').select('ot_minutes').where('employee_id', '=', employeeId)
        .where('work_date', '=', sql<Date>`${isoDate}::date`).executeTakeFirst();
      if (posted && posted.ot_minutes >= pol.otMinMinutes) await recordDetectedOvertime(db, employeeId, isoDate, posted.ot_minutes, pol, true);
    }
    return result;
  }
  await db.selectFrom('core.employees').select('id').where('id','=',employeeId).forUpdate().executeTakeFirstOrThrow();
  const lockMonth = periodMonthOf(isoDate, await loadCycleStartDay(db));
  const monthLock = await db.selectFrom('att.month_locks as m').innerJoin('core.employees as e','e.company_id','m.company_id')
    .select('m.id').where('e.id','=',employeeId).where('m.month','=',sql<Date>`${lockMonth}::date`).executeTakeFirst();
  if (monthLock) return 'skipped';
  const halves = await approvedHalfRequests(db, employeeId, isoDate);
  if (halves.length > 0) {
    if (isoDate > istDateString()) {
      const planned = await resolveDay(db, employeeId, isoDate);
      const due = shiftInterval(planned, isoDate);
      if (due) await queueHalfRecompute(db, employeeId, isoDate, new Date(due.end));
      return 'held';
    }
  }


  const existing = await db
    .selectFrom('att.day_records')
    .select(['source', 'is_locked', 'leave_type_id', 'status'])
    .where('employee_id', '=', employeeId)
    .where('work_date', '=', sql<Date>`${isoDate}::date`)
    .executeTakeFirst();
  // Half-day leave: the leave owns the status, but the punches of the other half
  // are still recorded so payroll can pay a worked half (item 4 / docs/09 §4).
  const halfLeave = existing !== undefined && !existing.is_locked && existing.leave_type_id !== null
    && existing.status === 'HD' && existing.source !== 'manual';
  if (existing && !halfLeave && (existing.is_locked || existing.leave_type_id !== null || (existing.source !== 'auto' && !(halves.length > 0 && existing.source === 'regularized')))) return 'skipped';

  const resolved = await resolveDay(db, employeeId, isoDate);
  const cur = shiftInterval(resolved, isoDate);
  const finalizationTime = await loadFinalizationTime(db);

  let owned: SwipePoint[] = [];
  if (cur) {
    const from = new Date(cur.start - pol.earlyMarginMs);
    const to = new Date(Math.max(cur.end + pol.lateMarginMs, dayFinalizationAt(isoDate, finalizationTime, cur.end).getTime()));
    const swipes = await db
      .selectFrom('att.swipe_events')
      .select(['swipe_ts', 'direction'])
      .where('employee_id', '=', employeeId)
      .where('swipe_ts', '>=', from)
      .where('swipe_ts', '<=', to)
      .orderBy('swipe_ts')
      .execute();
    owned = await attributeOwnedSwipes(db, employeeId, isoDate, cur, swipes.map((s) => ({ swipeTs: s.swipe_ts, direction: s.direction })), finalizationTime);
  } else {
    // WO/holiday: no shift interval — any swipe inside the IST calendar day is
    // week-off/holiday WORK and feeds OT detection (docs/04 §1.4).
    const dayStart = istDateTime(isoDate, '00:00');
    const swipes = await db
      .selectFrom('att.swipe_events')
      .select(['swipe_ts', 'direction'])
      .where('employee_id', '=', employeeId)
      .where('swipe_ts', '>=', dayStart)
      .where('swipe_ts', '<', new Date(dayStart.getTime() + 86_400_000))
      .orderBy('swipe_ts')
      .execute();
    owned = swipes.map((s) => ({ swipeTs: s.swipe_ts, direction: s.direction }));
  }

  let computed = computeDayStatus(resolved, isoDate, owned, pol, finalizationTime);
  if (halfLeave) {
    await db.updateTable('att.day_records')
      .set({ shift_id: computed.shiftId, first_in: computed.firstIn, last_out: computed.lastOut,
        worked_minutes: computed.workedMinutes, penalty_flag: false, penalty_evaluation: null,
        session_statuses: computed.sessionStatuses ? JSON.stringify(computed.sessionStatuses) : null, computed_at: new Date() })
      .where('employee_id', '=', employeeId).where('work_date', '=', sql<Date>`${isoDate}::date`)
      .where('is_locked', '=', false).where('status', '=', 'HD').execute();
    return 'HD';
  }
  if (halves.length > 0 && !resolved.isHoliday && !resolved.isWeekOff) {
    computed = { ...computed, ...overlayHalfRequests(readSessionStatuses(computed.sessionStatuses), halves),
      lateMinutes: halves.some(h => h.day_portion === 'first_half') ? 0 : computed.lateMinutes,
      earlyExitMinutes: halves.some(h => h.day_portion === 'second_half') ? 0 : computed.earlyExitMinutes,
    };
    if (computed.sessionStatuses?.some(s => s.status === 'A') && cur && cur.end > Date.now()) {
      await queueHalfRecompute(db, employeeId, isoDate, new Date(cur.end));
      return 'held';
    }
  }
  if (computed.status === 'A' || computed.sessionStatuses?.some((session) => session.status === 'A')) {
    const readiness = await getAbsenceFinalizationReadiness(
      db,
      employeeId,
      isoDate,
      resolved,
    );
    if (!readiness.ready) {
      await db
        .deleteFrom('att.day_records')
        .where('employee_id', '=', employeeId)
        .where('work_date', '=', sql<Date>`${isoDate}::date`)
        .where('source', '=', 'auto')
        .where('is_locked', '=', false)
        .execute();
      await queueHalfRecompute(db, employeeId, isoDate,
        readiness.reason === 'day_cutoff_pending' && readiness.finalizeAfterAt ? readiness.finalizeAfterAt : new Date());
      return 'held';
    }
  }
  // Evaluate AFTER approved half overlays remove their covered deviation.
  // This snapshot never feeds status, sessions, OT or a payroll day quantity.
  const penalties = resolved.shift && computed.firstIn !== null
    ? evaluateAttendancePenalties(computed.lateMinutes, computed.earlyExitMinutes,
      resolved.shift.late_slabs, resolved.shift.early_exit_slabs) : [];
  const row = {
    penalty_flag: penalties.length > 0,
    penalty_evaluation: JSON.stringify(penalties),
    shift_id: computed.shiftId,
    status: computed.status,
    first_in: computed.firstIn,
    last_out: computed.lastOut,
    worked_minutes: computed.workedMinutes,
    late_minutes: computed.lateMinutes,
    early_exit_minutes: computed.earlyExitMinutes,
    ot_minutes: computed.otMinutes,
    session_statuses: computed.sessionStatuses ? JSON.stringify(computed.sessionStatuses) : null,
    scheme_code: computed.schemeCode,
    source: halves.length > 0 ? 'regularized' as const : 'auto' as const,
    computed_at: new Date(),
  };

  await db
    .insertInto('att.day_records')
    .values({ employee_id: employeeId, work_date: sql<Date>`${isoDate}::date` as unknown as Date, ...row })
    .onConflict((oc) =>
      oc
        .columns(['employee_id', 'work_date'])
        .doUpdateSet(row)
        // Only plain auto rows are recomputable — the guard makes the
        // check-then-write race safe and avoids tripping the lock trigger.
        .where(eb => halves.length > 0 ? eb('att.day_records.source', 'in', ['auto', 'regularized']) : eb('att.day_records.source', '=', 'auto'))
        .where('att.day_records.leave_type_id', 'is', null)
        .where('att.day_records.is_locked', '=', false),
    )
    .execute();

  // Live presence remains visible. A provisional KENT result is queued again
  // at the cutoff, and stays queued if source completeness is still missing.
  const finalization = await getAbsenceFinalizationReadiness(db, employeeId, isoDate, resolved);
  if (!finalization.ready) {
    await queueHalfRecompute(db, employeeId, isoDate,
      finalization.reason === 'day_cutoff_pending' && finalization.finalizeAfterAt ? finalization.finalizeAfterAt : new Date());
  }
  await recloseDecidedWeekOffs(db, employeeId, [isoDate],
    await getTypedSetting(db, 'att.weekoff_min_worked_days', 'number', 1));

  return computed.status;
}

/** HR Ops visibility for PP-9: queued biometric days that are specifically
 * waiting for device completeness, not generic recompute work. */
export async function listFinalizationHolds(
  db: Kysely<Database>,
  companyId: number,
  isoDate: string,
): Promise<FinalizationHold[]> {
  const candidates = await db
    .selectFrom('att.recompute_queue as queue')
    .innerJoin('core.employees as employee', 'employee.id', 'queue.employee_id')
    .select([
      'employee.id',
      'employee.ecode',
      'employee.first_name',
      'employee.last_name',
    ])
    .distinct()
    .where('employee.company_id', '=', companyId)
    .where('employee.attendance_mode', '=', 'biometric')
    .where('employee.biometric_registered', '=', true)
    .where('queue.work_date', '=', sql<Date>`${isoDate}::date`)
    .execute();

  const holds: FinalizationHold[] = [];
  for (const employee of candidates) {
    const readiness = await getAbsenceFinalizationReadiness(db, employee.id, isoDate);
    if (readiness.ready || readiness.reason === null) continue;
    holds.push({
      employeeId: employee.id,
      ecode: employee.ecode,
      employeeName: employee.last_name
        ? `${employee.first_name} ${employee.last_name}`
        : employee.first_name,
      workDate: isoDate,
      shiftEndAt: readiness.shiftEndAt?.toISOString() ?? null,
      finalizeAfterAt: readiness.finalizeAfterAt?.toISOString() ?? null,
      reason: readiness.reason,
      pendingDoors: readiness.pendingDoors,
    });
  }
  return holds;
}

/**
 * Drain the dirty queue (called after each sync cycle + by the per-minute
 * worker). Rows are CLAIMED first (DELETE … RETURNING with SKIP LOCKED) so a
 * swipe arriving during recompute re-dirties the day for the next drain rather
 * than having its flag silently erased (review F9); a failed recompute
 * re-enqueues its row so nothing is lost.
 */
export async function drainRecomputeQueue(db: Kysely<Database>, batch = 500): Promise<number> {
  const claimed = await sql<{ employee_id: number; work_date: Date }>`
    DELETE FROM att.recompute_queue
    WHERE ctid IN (
      SELECT ctid FROM att.recompute_queue
      WHERE queued_at <= now()
      ORDER BY queued_at
      LIMIT ${batch}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING employee_id, work_date
  `.execute(db);

  if (claimed.rows.length === 0) return 0;
  const policy = await loadAttendancePolicy(db);

  for (const item of claimed.rows) {
    const isoDate = formatDbDate(item.work_date);
    try {
      await recomputeDay(db, item.employee_id, isoDate, policy);
    } catch (err) {
      logger.error({ err, employeeId: item.employee_id, workDate: isoDate }, 'recomputeDay failed; re-queued'); // E2E-033
      // Re-enqueue so the dirty flag is never lost on a transient failure.
      await db
        .insertInto('att.recompute_queue')
        .values({ employee_id: item.employee_id, work_date: item.work_date })
        .onConflict((oc) => oc.doNothing())
        .execute();
    }
  }
  return claimed.rows.length;
}

/** HR-only manual override — mandatory reason, audited, survives recompute
 *  (ATT-17). Derived columns are reset so the row never shows stale swipe times
 *  next to an overridden status (review att5). */
export { setManualStatus } from './manual-status.service.js';

/**
 * Week-off eligibility at week close (ATT-09, PI-PAY-1/2): an employee present
 * on fewer than `att.weekoff_min_worked_days` days that week earns NO paid
 * week-off. "Present" = WEEKOFF_PRESENT_STATUSES (docs/04 §1.2 — includes H so
 * a holiday week is still paid). One set-based statement (review efficiency).
 */
export async function closeWeek(db: Kysely<Database>, weekStartIso: string): Promise<number> {
  const minWorked = await getTypedSetting(db, 'att.weekoff_min_worked_days', 'number', 1);
  return closeWeekOffs(db, weekStartIso, minWorked);
}
