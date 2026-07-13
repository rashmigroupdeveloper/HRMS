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
import { sql, type Kysely, type Selectable, type Transaction } from 'kysely';
import type { AttShiftsTable, Database, DayStatus } from '../../core/db/types.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { getTypedSetting } from '../settings/index.js';
import { addDaysIso, formatDbDate, istDateTime } from '../../core/dates.js';
import { recordDetectedOvertime } from './overtime.service.js';

type Db = Kysely<Database> | Transaction<Database>;
type ShiftRow = Selectable<AttShiftsTable>;

/** Statuses that count as "present for the week" in week-off eligibility
 *  (docs/04 §1.2: P, HD, OD, CO, H, L-paid). LWP is still status L but has
 *  is_paid=false on lv.leave_types — closeWeek joins that flag. */
const WEEKOFF_PRESENT_STATUSES: readonly DayStatus[] = ['P', 'HD', 'OD', 'CO', 'H'];

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

interface ShiftInterval {
  start: number;
  end: number;
}

export type FinalizationHoldReason =
  | 'location_not_mapped'
  | 'no_active_devices'
  | 'device_watermark_pending';

export interface AbsenceFinalizationReadiness {
  ready: boolean;
  reason: FinalizationHoldReason | null;
  shiftEndAt: Date | null;
  pendingDoors: string[];
}

export interface FinalizationHold {
  employeeId: number;
  ecode: string;
  employeeName: string;
  workDate: string;
  shiftEndAt: string | null;
  reason: FinalizationHoldReason;
  pendingDoors: string[];
}

/** The working [start, end] instants (ms) for a resolved shift, or null (WO/holiday). */
function shiftInterval(resolved: ResolvedShift, isoDate: string): ShiftInterval | null {
  if (resolved.isHoliday || resolved.isWeekOff || !resolved.shift) return null;
  const s = resolved.shift;
  const start = istDateTime(isoDate, s.start_time).getTime();
  const end = istDateTime(isoDate, s.end_time).getTime() + (s.crosses_midnight ? 86_400_000 : 0);
  return { start, end };
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
  if (!interval) {
    return { ready: true, reason: null, shiftEndAt: null, pendingDoors: [] };
  }
  const shiftEndAt = new Date(interval.end);

  if (employee.location_id === null) {
    return {
      ready: false,
      reason: 'location_not_mapped',
      shiftEndAt,
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
      pendingDoors: [],
    };
  }

  const pendingDoors = devices
    .filter((device) => !device.watermark_ts || device.watermark_ts < shiftEndAt)
    .map((device) => device.door_code);
  return pendingDoors.length === 0
    ? { ready: true, reason: null, shiftEndAt, pendingDoors: [] }
    : { ready: false, reason: 'device_watermark_pending', shiftEndAt, pendingDoors };
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
  swipeTimes: Date[],
): Promise<Date[]> {
  let prevIv: ShiftInterval | null | undefined;
  let nextIv: ShiftInterval | null | undefined;
  const owned: Date[] = [];

  for (const swipe of swipeTimes) {
    const t = swipe.getTime();
    if (t >= cur.start && t <= cur.end) {
      owned.push(swipe); // inside the core interval → unambiguously ours
      continue;
    }
    if (t < cur.start) {
      if (prevIv === undefined) {
        prevIv = shiftInterval(await resolveDay(db, employeeId, addDaysIso(isoDate, -1)), addDaysIso(isoDate, -1));
      }
      // Early margin: keep unless the previous day's shift is strictly nearer.
      if (prevIv === null || distanceTo(t, cur) < distanceTo(t, prevIv)) owned.push(swipe);
    } else {
      if (nextIv === undefined) {
        nextIv = shiftInterval(await resolveDay(db, employeeId, addDaysIso(isoDate, 1)), addDaysIso(isoDate, 1));
      }
      // Late margin: keep on ties (cur is the earlier day) — see F1 proof.
      if (nextIv === null || distanceTo(t, cur) <= distanceTo(t, nextIv)) owned.push(swipe);
    }
  }
  return owned;
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
  swipeTimes: Date[],
  policy: AttendancePolicy,
): ComputedDay {
  if (resolved.isHoliday || resolved.isWeekOff || !resolved.shift) {
    // WO/H day: no shift interval, but swipes still mean WORK — FILO minutes
    // become detected OT (docs/04 §1.4: week-off/holiday work is OT-eligible).
    const sorted = [...swipeTimes].sort((a, b) => a.getTime() - b.getTime());
    const firstIn = sorted[0] ?? null;
    const lastOut = sorted.length > 1 ? (sorted[sorted.length - 1] ?? null) : null;
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

  const shift = resolved.shift;
  const start = istDateTime(isoDate, shift.start_time);
  const end = new Date(istDateTime(isoDate, shift.end_time).getTime() + (shift.crosses_midnight ? 86_400_000 : 0));
  const windowStart = new Date(start.getTime() - policy.earlyMarginMs);
  const windowEnd = new Date(end.getTime() + policy.lateMarginMs);

  const inWindow = swipeTimes.filter((t) => t >= windowStart && t <= windowEnd).sort((a, b) => a.getTime() - b.getTime());
  const base = { schemeCode: shift.code, shiftId: shift.id };

  if (inWindow.length === 0) {
    return { ...base, status: 'A', firstIn: null, lastOut: null, workedMinutes: 0, lateMinutes: 0, earlyExitMinutes: 0, sessionStatuses: null, otMinutes: 0 };
  }

  // FILO — first in, last out (ATT-18, PP-v2-2).
  const firstIn = inWindow[0] ?? null;
  const lastOut = inWindow.length > 1 ? (inWindow[inWindow.length - 1] ?? null) : null;

  const rawMinutes = firstIn && lastOut ? Math.floor((lastOut.getTime() - firstIn.getTime()) / 60_000) : 0;
  const workedMinutes = Math.max(0, rawMinutes - shift.break_minutes);

  const graceIn = shift.grace_in_minutes * 60_000;
  const graceOut = shift.grace_out_minutes * 60_000;
  const lateMinutes =
    firstIn && firstIn.getTime() > start.getTime() + graceIn ? Math.floor((firstIn.getTime() - start.getTime()) / 60_000) : 0;
  const earlyExitMinutes =
    lastOut && lastOut.getTime() < end.getTime() - graceOut ? Math.floor((end.getTime() - lastOut.getTime()) / 60_000) : 0;

  const fullMin = Number(shift.min_full_day_hours) * 60;
  const halfMin = Number(shift.min_half_day_hours) * 60;

  let status: DayStatus;
  let sessionStatuses: SessionStatus[] | null = null;

  if (shift.session_split !== null && firstIn && lastOut) {
    // Two-session day (09 §4): a session is Present when coverage ≥ the policy fraction.
    const split = istDateTime(isoDate, shift.session_split);
    const sessions: [Date, Date][] = [
      [start, split],
      [split, end],
    ];
    sessionStatuses = sessions.map(([s, e], i): SessionStatus => {
      const overlap = Math.min(lastOut.getTime(), e.getTime()) - Math.max(firstIn.getTime(), s.getTime());
      const need = (e.getTime() - s.getTime()) * policy.sessionPresentFraction;
      return { session: i + 1, status: overlap >= need ? 'P' : 'A' };
    });
    const present = sessionStatuses.filter((s) => s.status === 'P').length;
    status = present === 2 ? 'P' : present === 1 ? 'HD' : 'A';
  } else {
    status = workedMinutes >= fullMin ? 'P' : workedMinutes >= halfMin ? 'HD' : 'A';
  }

  // OT = time past shift end (ATT-08); grace-out is a penalty concept, not an
  // OT one, so it does not shave detected minutes.
  const otMinutes = lastOut && lastOut.getTime() > end.getTime() ? Math.floor((lastOut.getTime() - end.getTime()) / 60_000) : 0;

  return { ...base, status, firstIn, lastOut, workedMinutes, lateMinutes, earlyExitMinutes, sessionStatuses, otMinutes };
}

/** Recompute one employee-day from raw truth. Manual/regularized/locked rows
 *  are never overwritten — enforced both by the pre-check AND the
 *  conflict-WHERE, so an override or an approved regularization committed
 *  concurrently is not clobbered (review F9; Stage 1.4). */
export async function recomputeDay(
  db: Kysely<Database>,
  employeeId: number,
  isoDate: string,
  policy?: AttendancePolicy,
): Promise<DayStatus | 'held' | 'skipped'> {
  const pol = policy ?? (await loadAttendancePolicy(db));

  const existing = await db
    .selectFrom('att.day_records')
    .select(['source', 'is_locked'])
    .where('employee_id', '=', employeeId)
    .where('work_date', '=', sql<Date>`${isoDate}::date`)
    .executeTakeFirst();
  if (existing && (existing.is_locked || existing.source !== 'auto')) return 'skipped';

  const resolved = await resolveDay(db, employeeId, isoDate);
  const cur = shiftInterval(resolved, isoDate);

  let owned: Date[] = [];
  if (cur) {
    const from = new Date(cur.start - pol.earlyMarginMs);
    const to = new Date(cur.end + pol.lateMarginMs);
    const swipes = await db
      .selectFrom('att.swipe_events')
      .select('swipe_ts')
      .where('employee_id', '=', employeeId)
      .where('swipe_ts', '>=', from)
      .where('swipe_ts', '<=', to)
      .orderBy('swipe_ts')
      .execute();
    owned = await attributeOwnedSwipes(db, employeeId, isoDate, cur, swipes.map((s) => s.swipe_ts));
  } else {
    // WO/holiday: no shift interval — any swipe inside the IST calendar day is
    // week-off/holiday WORK and feeds OT detection (docs/04 §1.4).
    const dayStart = istDateTime(isoDate, '00:00');
    const swipes = await db
      .selectFrom('att.swipe_events')
      .select('swipe_ts')
      .where('employee_id', '=', employeeId)
      .where('swipe_ts', '>=', dayStart)
      .where('swipe_ts', '<', new Date(dayStart.getTime() + 86_400_000))
      .orderBy('swipe_ts')
      .execute();
    owned = swipes.map((s) => s.swipe_ts);
  }

  const computed = computeDayStatus(resolved, isoDate, owned, pol);
  if (computed.status === 'A') {
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
      await db
        .insertInto('att.recompute_queue')
        .values({ employee_id: employeeId, work_date: sql<Date>`${isoDate}::date` })
        .onConflict((oc) =>
          oc.columns(['employee_id', 'work_date']).doUpdateSet({ queued_at: new Date() }),
        )
        .execute();
      return 'held';
    }
  }
  const row = {
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
    source: 'auto' as const,
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
        .where('att.day_records.source', '=', 'auto')
        .where('att.day_records.is_locked', '=', false),
    )
    .execute();

  // Detection → entry + intimation happens here so EVERY recompute path (sync
  // drain, roster edit, manual API) surfaces OT the moment swipes show it.
  if (computed.otMinutes >= pol.otMinMinutes) {
    await recordDetectedOvertime(db, employeeId, isoDate, computed.otMinutes, pol);
  }

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
    } catch {
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

  const row = {
    status: params.status,
    source: 'manual' as const,
    override_reason: params.reason,
    first_in: null,
    last_out: null,
    worked_minutes: null,
    late_minutes: 0,
    early_exit_minutes: 0,
    session_statuses: null,
    computed_at: new Date(),
  };

  await db
    .insertInto('att.day_records')
    .values({ employee_id: params.employeeId, work_date: sql<Date>`${params.isoDate}::date` as unknown as Date, ...row })
    .onConflict((oc) =>
      oc.columns(['employee_id', 'work_date']).doUpdateSet(row).where('att.day_records.is_locked', '=', false),
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
 * Week-off eligibility at week close (ATT-09, PI-PAY-1/2): an employee present
 * on fewer than `att.weekoff_min_worked_days` days that week earns NO paid
 * week-off. "Present" = WEEKOFF_PRESENT_STATUSES (docs/04 §1.2 — includes H so
 * a holiday week is still paid). One set-based statement (review efficiency).
 */
export async function closeWeek(db: Kysely<Database>, weekStartIso: string): Promise<number> {
  const minWorked = await getTypedSetting(db, 'att.weekoff_min_worked_days', 'number', 1);
  const presentList = WEEKOFF_PRESENT_STATUSES.join(',');

  // Paid leave (L with lv.leave_types.is_paid) counts as present (docs/04 §1.2).
  const result = await sql<{ id: number }>`
    UPDATE att.day_records d
    SET weekoff_paid = (w.present >= ${minWorked})
    FROM (
      SELECT dr.employee_id,
             COUNT(*) FILTER (
               WHERE dr.status = ANY (string_to_array(${presentList}, ',')::att.day_status[])
                  OR (dr.status = 'L' AND EXISTS (
                        SELECT 1 FROM lv.leave_types lt
                        WHERE lt.id = dr.leave_type_id AND lt.is_paid = true
                      ))
             ) AS present
      FROM att.day_records dr
      WHERE dr.work_date >= ${weekStartIso}::date AND dr.work_date < ${weekStartIso}::date + 7
        AND dr.is_locked = false
      GROUP BY dr.employee_id
    ) w
    WHERE d.employee_id = w.employee_id
      AND d.status = 'WO'
      AND d.work_date >= ${weekStartIso}::date AND d.work_date < ${weekStartIso}::date + 7
      AND d.is_locked = false
    RETURNING d.id
  `.execute(db);

  return result.rows.length;
}
