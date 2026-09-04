/**
 * Phase-1 reports R2–R6, R24, R27 (docs/06) — list queries shared by API + Excel.
 */
import { sql, type Kysely } from 'kysely';
import type {
  Database,
  DayStatus,
  WfRequestStatus,
  WfStepAction,
} from '../../core/db/types.js';
import { formatDbDate } from '../../core/dates.js';
import type { OrgScopeFilter } from '../../core/org/scope.js';
import { employeeScopeSql, type EmployeeScope } from '../../core/rbac/employee-scope.js';
import { monthStart, nextMonthStart } from '../attendance/index.js';
import { orgScopeWhere } from '../org/index.js';

function fullName(first: string, last: string | null): string {
  return last ? `${first} ${last}` : first;
}

function asIso(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return value instanceof Date ? value.toISOString() : value;
}

// ── R2 Daily Attendance / Swipe Detail (docs/06 §R2) ────────────────────────

export interface R2Row {
  ecode: string;
  employeeName: string;
  workDate: string;
  status: DayStatus | null;
  firstIn: string | null;
  lastOut: string | null;
  workedMinutes: number | null;
  lateMinutes: number | null;
  earlyExitMinutes: number | null;
  otMinutes: number | null;
  firstDoor: string | null;
  lastDoor: string | null;
  mappedLocation: string | null;
  majoritySwipeLocation: string | null;
  crossPlantFlag: boolean;
  rawSwipeCount: number;
  statusVsSwipes:
    | 'match'
    | 'status_without_swipes'
    | 'swipes_without_presence'
    | 'missing_day_record'
    | 'both_absent';
}

export async function reportR2Swipes(
  db: Kysely<Database>,
  params: {
    companyId: number;
    month: string;
    ecode?: string | undefined;
    scope?: EmployeeScope | undefined;
  },
): Promise<R2Row[]> {
  const m = monthStart(params.month);
  const mEnd = nextMonthStart(m);

  let q = db
    .selectFrom('att.day_records as d')
    .innerJoin('core.employees as e', 'e.id', 'd.employee_id')
    .leftJoin('core.locations as mapped_loc', 'mapped_loc.id', 'e.location_id')
    .where('e.company_id', '=', params.companyId)
    .where(employeeScopeSql(params.scope, 'e'))
    .where('d.work_date', '>=', sql<Date>`${m}::date`)
    .where('d.work_date', '<', sql<Date>`${mEnd}::date`)
    .select([
      'e.id as employee_id',
      'e.ecode',
      'e.first_name',
      'e.last_name',
      'd.id as day_record_id',
      'd.work_date',
      'd.status',
      'd.first_in',
      'd.last_out',
      'd.worked_minutes',
      'd.late_minutes',
      'd.early_exit_minutes',
      'd.ot_minutes',
      'mapped_loc.name as mapped_location',
      sql<string | null>`(
        SELECT swipe_loc.name
          FROM att.swipe_events month_swipe
          JOIN att.devices dev ON dev.door_code = month_swipe.door_code
          JOIN core.locations swipe_loc ON swipe_loc.id = dev.location_id
         WHERE month_swipe.employee_id = e.id
           AND month_swipe.swipe_ts >= ${m}
           AND month_swipe.swipe_ts < ${mEnd}
         GROUP BY swipe_loc.name
         ORDER BY count(*) DESC, swipe_loc.name
         LIMIT 1
      )`.as('majority_swipe_location'),
      sql<number>`(
        SELECT count(*)::int
          FROM att.swipe_events se
         WHERE se.employee_id = e.id
           AND (
             (d.first_in IS NOT NULL
               AND se.swipe_ts >= d.first_in
               AND se.swipe_ts <= COALESCE(d.last_out, d.first_in))
             OR
            ((se.swipe_ts AT TIME ZONE 'Asia/Kolkata')::date = d.work_date
               AND NOT EXISTS (
                 SELECT 1
                   FROM att.day_records owner_day
                  WHERE owner_day.employee_id = d.employee_id
                    AND owner_day.id <> d.id
                    AND owner_day.first_in IS NOT NULL
                    AND se.swipe_ts >= owner_day.first_in
                    AND se.swipe_ts <= COALESCE(owner_day.last_out, owner_day.first_in)
               ))
           )
      )`.as('raw_swipe_count'),
      sql<string | null>`(
        SELECT se.door_code
          FROM att.swipe_events se
         WHERE se.employee_id = e.id
           AND (
             (d.first_in IS NOT NULL
               AND se.swipe_ts >= d.first_in
               AND se.swipe_ts <= COALESCE(d.last_out, d.first_in))
             OR
            ((se.swipe_ts AT TIME ZONE 'Asia/Kolkata')::date = d.work_date
               AND NOT EXISTS (
                 SELECT 1 FROM att.day_records owner_day
                  WHERE owner_day.employee_id = d.employee_id
                    AND owner_day.id <> d.id
                    AND owner_day.first_in IS NOT NULL
                    AND se.swipe_ts >= owner_day.first_in
                    AND se.swipe_ts <= COALESCE(owner_day.last_out, owner_day.first_in)
               ))
           )
         ORDER BY se.swipe_ts ASC
         LIMIT 1
      )`.as('first_door'),
      sql<string | null>`(
        SELECT se.door_code
          FROM att.swipe_events se
         WHERE se.employee_id = e.id
           AND (
             (d.first_in IS NOT NULL
               AND se.swipe_ts >= d.first_in
               AND se.swipe_ts <= COALESCE(d.last_out, d.first_in))
             OR
            ((se.swipe_ts AT TIME ZONE 'Asia/Kolkata')::date = d.work_date
               AND NOT EXISTS (
                 SELECT 1 FROM att.day_records owner_day
                  WHERE owner_day.employee_id = d.employee_id
                    AND owner_day.id <> d.id
                    AND owner_day.first_in IS NOT NULL
                    AND se.swipe_ts >= owner_day.first_in
                    AND se.swipe_ts <= COALESCE(owner_day.last_out, owner_day.first_in)
               ))
           )
         ORDER BY se.swipe_ts DESC
         LIMIT 1
      )`.as('last_door'),
    ])
    .orderBy('e.ecode')
    .orderBy('d.work_date');

  if (params.ecode !== undefined && params.ecode !== '') {
    q = q.where('e.ecode', '=', params.ecode);
  }

  const days = await q.execute();

  const processedRows: R2Row[] = days.map((d) => {
    const workDate = formatDbDate(d.work_date);
    const rawSwipeCount = d.raw_swipe_count;
    const presentLike = d.status === 'P' || d.status === 'HD' || d.status === 'OD' || d.status === 'CO';
    let statusVsSwipes: R2Row['statusVsSwipes'] = 'both_absent';
    if (presentLike && rawSwipeCount > 0) statusVsSwipes = 'match';
    else if (presentLike && rawSwipeCount === 0) statusVsSwipes = 'status_without_swipes';
    else if (!presentLike && rawSwipeCount > 0) statusVsSwipes = 'swipes_without_presence';

    return {
      ecode: d.ecode,
      employeeName: fullName(d.first_name, d.last_name),
      workDate,
      status: d.status,
      firstIn: asIso(d.first_in),
      lastOut: asIso(d.last_out),
      workedMinutes: d.worked_minutes,
      lateMinutes: d.late_minutes,
      earlyExitMinutes: d.early_exit_minutes,
      otMinutes: d.ot_minutes,
      firstDoor: d.first_door,
      lastDoor: d.last_door,
      mappedLocation: d.mapped_location,
      majoritySwipeLocation: d.majority_swipe_location,
      crossPlantFlag:
        d.mapped_location !== null &&
        d.majority_swipe_location !== null &&
        d.mapped_location !== d.majority_swipe_location,
      rawSwipeCount,
      statusVsSwipes,
    };
  });

  // A reconciliation report must also expose swipes for which the processor
  // failed to create any day row. Otherwise R2 can only compare records that
  // already made it through processing—the precise PP-9 blind spot.
  const orphanSwipeDays = await db
    .selectFrom('att.swipe_events as se')
    .innerJoin('core.employees as e', 'e.id', 'se.employee_id')
    .leftJoin('core.locations as mapped_loc', 'mapped_loc.id', 'e.location_id')
    .leftJoin('att.devices as swipe_device', 'swipe_device.door_code', 'se.door_code')
    .leftJoin('core.locations as swipe_loc', 'swipe_loc.id', 'swipe_device.location_id')
    .where('e.company_id', '=', params.companyId)
    .where(employeeScopeSql(params.scope, 'e'))
    .where(
      'se.swipe_ts',
      '>=',
      sql<Date>`(${m}::date::timestamp AT TIME ZONE 'Asia/Kolkata')`,
    )
    .where(
      'se.swipe_ts',
      '<',
      sql<Date>`(${mEnd}::date::timestamp AT TIME ZONE 'Asia/Kolkata')`,
    )
    .where(sql<boolean>`NOT EXISTS (
      SELECT 1
        FROM att.day_records owner_day
       WHERE owner_day.employee_id = e.id
         AND (
           owner_day.work_date = (se.swipe_ts AT TIME ZONE 'Asia/Kolkata')::date
           OR (
             owner_day.first_in IS NOT NULL
             AND se.swipe_ts >= owner_day.first_in
             AND se.swipe_ts <= COALESCE(owner_day.last_out, owner_day.first_in)
           )
         )
    )`)
    .$if(params.ecode !== undefined && params.ecode !== '', (query) =>
      query.where('e.ecode', '=', params.ecode ?? ''),
    )
    .select([
      'e.ecode',
      'e.first_name',
      'e.last_name',
      'mapped_loc.name as mapped_location',
      sql<Date>`(se.swipe_ts AT TIME ZONE 'Asia/Kolkata')::date`.as('work_date'),
      sql<number>`count(*)::int`.as('raw_swipe_count'),
      sql<string | null>`(array_agg(se.door_code ORDER BY se.swipe_ts ASC))[1]`.as(
        'first_door',
      ),
      sql<string | null>`(array_agg(se.door_code ORDER BY se.swipe_ts DESC))[1]`.as(
        'last_door',
      ),
      sql<string | null>`mode() WITHIN GROUP (ORDER BY swipe_loc.name)`.as(
        'majority_swipe_location',
      ),
    ])
    .groupBy([
      'e.id',
      'e.ecode',
      'e.first_name',
      'e.last_name',
      'mapped_loc.name',
      sql`(se.swipe_ts AT TIME ZONE 'Asia/Kolkata')::date`,
    ])
    .execute();

  const missingRows: R2Row[] = orphanSwipeDays.map((row) => ({
    ecode: row.ecode,
    employeeName: fullName(row.first_name, row.last_name),
    workDate: formatDbDate(row.work_date),
    status: null,
    firstIn: null,
    lastOut: null,
    workedMinutes: null,
    lateMinutes: null,
    earlyExitMinutes: null,
    otMinutes: null,
    firstDoor: row.first_door,
    lastDoor: row.last_door,
    mappedLocation: row.mapped_location,
    majoritySwipeLocation: row.majority_swipe_location,
    crossPlantFlag:
      row.mapped_location !== null &&
      row.majority_swipe_location !== null &&
      row.mapped_location !== row.majority_swipe_location,
    rawSwipeCount: row.raw_swipe_count,
    statusVsSwipes: 'missing_day_record',
  }));

  return [...processedRows, ...missingRows].sort(
    (left, right) =>
      left.ecode.localeCompare(right.ecode) || left.workDate.localeCompare(right.workDate),
  );
}

export interface R2RawSwipeRow {
  employeeNo: string;
  accessCard: string | null;
  shiftLabel: string | null;
  swipeTs: string;
  doorCode: string | null;
  longitude: string | null;
  latitude: string | null;
  locationType: string | null;
  mobileDeviceName: string | null;
  mobileDeviceId: string | null;
  swipeType: string | null;
  direction: string | null;
  remarks: string | null;
  permissionReason: string | null;
  signedBy: string | null;
  receivedAt: string;
  source: string;
}

/** Lossless R2 drill-down over the stored Kent fields, with the same night-shift ownership rule. */
export async function reportR2RawSwipes(
  db: Kysely<Database>,
  params: { ecode: string; workDate: string; scope?: EmployeeScope | undefined },
): Promise<R2RawSwipeRow[]> {
  const rows = await db
    .selectFrom('att.swipe_events as se')
    .innerJoin('core.employees as e', 'e.id', 'se.employee_id')
    .leftJoin('att.day_records as d', (join) =>
      join.onRef('d.employee_id', '=', 'e.id').on('d.work_date', '=', sql<Date>`${params.workDate}::date`),
    )
    .where('e.ecode', '=', params.ecode)
    .where(employeeScopeSql(params.scope, 'e'))
    .where(sql<boolean>`(
      (d.first_in IS NOT NULL AND se.swipe_ts >= d.first_in AND se.swipe_ts <= COALESCE(d.last_out, d.first_in))
      OR
      ((se.swipe_ts AT TIME ZONE 'Asia/Kolkata')::date = ${params.workDate}::date
        AND NOT EXISTS (
          SELECT 1 FROM att.day_records owner_day
           WHERE owner_day.employee_id = e.id
             AND (d.id IS NULL OR owner_day.id <> d.id)
             AND owner_day.first_in IS NOT NULL
             AND se.swipe_ts >= owner_day.first_in
             AND se.swipe_ts <= COALESCE(owner_day.last_out, owner_day.first_in)
        )))
    `)
    .select([
      'se.employee_no', 'se.access_card', 'se.shift_label', 'se.swipe_ts', 'se.door_code',
      'se.longitude', 'se.latitude', 'se.location_type', 'se.mobile_device_name',
      'se.mobile_device_id', 'se.swipe_type', 'se.direction', 'se.remarks',
      'se.permission_reason', 'se.signed_by', 'se.received_at', 'se.source',
    ])
    .orderBy('se.swipe_ts')
    .execute();

  return rows.map((row) => ({
    employeeNo: row.employee_no,
    accessCard: row.access_card,
    shiftLabel: row.shift_label,
    swipeTs: row.swipe_ts.toISOString(),
    doorCode: row.door_code,
    longitude: row.longitude,
    latitude: row.latitude,
    locationType: row.location_type,
    mobileDeviceName: row.mobile_device_name,
    mobileDeviceId: row.mobile_device_id,
    swipeType: row.swipe_type,
    direction: row.direction,
    remarks: row.remarks,
    permissionReason: row.permission_reason,
    signedBy: row.signed_by,
    receivedAt: row.received_at.toISOString(),
    source: row.source,
  }));
}

// ── R3 AR / OD / Permission (docs/06 §R3) ───────────────────────────────────

export interface R3Row {
  id: number;
  ecode: string;
  employeeName: string;
  kind: 'AR' | 'OD' | 'PERMISSION';
  fromDate: string;
  toDate: string;
  fromTime: string | null;
  toTime: string | null;
  reason: string;
  requestedStatus: DayStatus;
  applied: boolean;
  workflowStatus: WfRequestStatus;
  currentStep: number;
  decidedAt: string | null;
  timeline: R3TimelineStep[];
}

export interface R3TimelineStep {
  stepNo: number;
  approverName: string;
  delegatedFromName: string | null;
  action: WfStepAction | null;
  comment: string | null;
  notifiedAt: string;
  actedAt: string | null;
  slaDueAt: string;
}

export async function reportR3Regularizations(
  db: Kysely<Database>,
  params: {
    companyId: number;
    kind?: 'AR' | 'OD' | 'PERMISSION' | undefined;
    status?: WfRequestStatus | undefined;
    scope?: EmployeeScope | undefined;
  },
): Promise<R3Row[]> {
  let q = db
    .selectFrom('att.regularizations as reg')
    .innerJoin('core.employees as e', 'e.id', 'reg.employee_id')
    .innerJoin('wf.requests as r', 'r.id', 'reg.workflow_request_id')
    .where('e.company_id', '=', params.companyId)
    .where(employeeScopeSql(params.scope, 'e'))
    .select([
      'reg.id',
      'e.ecode',
      'e.first_name',
      'e.last_name',
      'reg.kind',
      'reg.from_date',
      'reg.to_date',
      'reg.from_time',
      'reg.to_time',
      'reg.reason',
      'reg.requested_status',
      'reg.applied',
      'reg.workflow_request_id',
      'r.status as workflow_status',
      'r.current_step',
      'r.decided_at',
    ])
    .orderBy('reg.id', 'desc');

  const kind = params.kind;
  if (kind === 'AR' || kind === 'OD' || kind === 'PERMISSION') {
    q = q.where('reg.kind', '=', kind);
  }
  const status = params.status;
  if (
    status === 'pending' ||
    status === 'approved' ||
    status === 'rejected' ||
    status === 'cancelled' ||
    status === 'lapsed' ||
    status === 'sent_back'
  ) {
    q = q.where('r.status', '=', status);
  }

  const rows = await q.execute();
  const requestIds = rows.map((row) => row.workflow_request_id);
  const steps = requestIds.length === 0
    ? []
    : await db
        .selectFrom('wf.request_steps as step')
        .innerJoin('core.users as approver_user', 'approver_user.id', 'step.approver_user_id')
        .leftJoin('core.employees as approver', 'approver.id', 'approver_user.employee_id')
        .leftJoin('core.users as delegated_user', 'delegated_user.id', 'step.delegated_from')
        .leftJoin('core.employees as delegated', 'delegated.id', 'delegated_user.employee_id')
        .where('step.request_id', 'in', requestIds)
        .select([
          'step.request_id', 'step.step_no', 'step.action', 'step.comment', 'step.notified_at',
          'step.acted_at', 'step.sla_due_at', 'approver_user.email as approver_email',
          'approver.first_name as approver_first', 'approver.last_name as approver_last',
          'delegated_user.email as delegated_email', 'delegated.first_name as delegated_first',
          'delegated.last_name as delegated_last',
        ])
        .orderBy('step.request_id')
        .orderBy('step.step_no')
        .orderBy('step.id')
        .execute();
  const timelineByRequest = new Map<number, R3TimelineStep[]>();
  for (const step of steps) {
    const timeline = timelineByRequest.get(step.request_id) ?? [];
    timeline.push({
      stepNo: step.step_no,
      approverName: step.approver_first
        ? fullName(step.approver_first, step.approver_last)
        : step.approver_email,
      delegatedFromName: step.delegated_first
        ? fullName(step.delegated_first, step.delegated_last)
        : step.delegated_email,
      action: step.action,
      comment: step.comment,
      notifiedAt: step.notified_at.toISOString(),
      actedAt: asIso(step.acted_at),
      slaDueAt: step.sla_due_at.toISOString(),
    });
    timelineByRequest.set(step.request_id, timeline);
  }
  return rows.map((r) => ({
    id: r.id,
    ecode: r.ecode,
    employeeName: fullName(r.first_name, r.last_name),
    kind: r.kind,
    fromDate: formatDbDate(r.from_date),
    toDate: formatDbDate(r.to_date),
    fromTime: r.from_time,
    toTime: r.to_time,
    reason: r.reason,
    requestedStatus: r.requested_status,
    applied: r.applied,
    workflowStatus: r.workflow_status,
    currentStep: r.current_step,
    decidedAt: asIso(r.decided_at),
    timeline: timelineByRequest.get(r.workflow_request_id) ?? [],
  }));
}

// ── R4 Late / Early / UAB (docs/06 §R4) ─────────────────────────────────────

export interface R4Row {
  ecode: string;
  employeeName: string;
  workDate: string;
  status: DayStatus;
  lateMinutes: number;
  earlyExitMinutes: number;
  monthlyExceptionCount: number;
  monthlyLateMinutes: number;
  monthlyEarlyExitMinutes: number;
  monthlyUabDays: number;
}

export async function reportR4Exceptions(
  db: Kysely<Database>,
  companyId: number,
  month: string,
  scope?: EmployeeScope,
): Promise<R4Row[]> {
  const m = monthStart(month);
  const mEnd = nextMonthStart(m);
  const rows = await db
    .selectFrom('att.day_records as d')
    .innerJoin('core.employees as e', 'e.id', 'd.employee_id')
    .where('e.company_id', '=', companyId)
    .where(employeeScopeSql(scope, 'e'))
    .where('d.work_date', '>=', sql<Date>`${m}::date`)
    .where('d.work_date', '<', sql<Date>`${mEnd}::date`)
    .where((eb) =>
      eb.or([
        eb('d.late_minutes', '>', 0),
        eb('d.early_exit_minutes', '>', 0),
        eb('d.status', '=', 'UAB'),
      ]),
    )
    .select([
      'e.ecode',
      'e.first_name',
      'e.last_name',
      'd.work_date',
      'd.status',
      'd.late_minutes',
      'd.early_exit_minutes',
      sql<number>`count(*) over (partition by e.id)::int`.as('monthly_exception_count'),
      sql<number>`sum(d.late_minutes) over (partition by e.id)::int`.as('monthly_late_minutes'),
      sql<number>`sum(d.early_exit_minutes) over (partition by e.id)::int`.as('monthly_early_exit_minutes'),
      sql<number>`sum(CASE WHEN d.status = 'UAB' THEN 1 ELSE 0 END) over (partition by e.id)::int`.as('monthly_uab_days'),
    ])
    .orderBy('d.work_date')
    .orderBy('e.ecode')
    .execute();
  return rows.map((r) => ({
    ecode: r.ecode,
    employeeName: fullName(r.first_name, r.last_name),
    workDate: formatDbDate(r.work_date),
    status: r.status,
    lateMinutes: r.late_minutes,
    earlyExitMinutes: r.early_exit_minutes,
    monthlyExceptionCount: r.monthly_exception_count,
    monthlyLateMinutes: r.monthly_late_minutes,
    monthlyEarlyExitMinutes: r.monthly_early_exit_minutes,
    monthlyUabDays: r.monthly_uab_days,
  }));
}

// ── R5 OT Register (docs/06 §R5) ────────────────────────────────────────────

export interface R5Row {
  ecode: string;
  employeeName: string;
  workDate: string;
  detectedMinutes: number;
  claimedMinutes: number;
  approvedMinutes: number | null;
  status: 'pending' | 'approved' | 'rejected' | 'lapsed' | 'converted_comp_off';
  managerEcode: string | null;
  managerName: string | null;
  deadlineAt: string;
  decidedAt: string | null;
  decisionLatencyHours: number | null;
  convertedCompOff: boolean;
  compOffCreditId: number | null;
  payrollItemId: number | null;
  within48h: boolean | null;
  managerDecisionCount: number;
  managerAverageLatencyHours: number | null;
}

export async function reportR5Ot(
  db: Kysely<Database>,
  companyId: number,
  month: string,
  scope?: EmployeeScope,
): Promise<R5Row[]> {
  const m = monthStart(month);
  const mEnd = nextMonthStart(m);
  const rows = await db
    .selectFrom('att.overtime_entries as o')
    .innerJoin('core.employees as e', 'e.id', 'o.employee_id')
    .leftJoin('core.employees as mgr', 'mgr.id', 'o.manager_id')
    .where('e.company_id', '=', companyId)
    .where(employeeScopeSql(scope, 'e'))
    .where('o.work_date', '>=', sql<Date>`${m}::date`)
    .where('o.work_date', '<', sql<Date>`${mEnd}::date`)
    .select([
      'e.ecode',
      'e.first_name',
      'e.last_name',
      'o.work_date',
      'o.detected_minutes',
      'o.claimed_minutes',
      'o.approved_minutes',
      'o.status',
      'o.deadline_at',
      'o.decided_at',
      'o.comp_off_credit_id',
      'o.payroll_item_id',
      'mgr.ecode as mgr_ecode',
      'mgr.first_name as mgr_first',
      'mgr.last_name as mgr_last',
      sql<number | null>`CASE
        WHEN o.decided_at IS NULL THEN NULL
        ELSE round((extract(epoch FROM (o.decided_at - o.created_at)) / 3600)::numeric, 1)::float
      END`.as('decision_latency_hours'),
    ])
    .orderBy('o.work_date')
    .orderBy('e.ecode')
    .execute();

  const detailRows = rows.map((r) => {
    const decidedAt = r.decided_at;
    const deadlineAt = r.deadline_at;
    let decisionLatencyHours: number | null = null;
    let within48h: boolean | null = null;
    if (decidedAt) {
      decisionLatencyHours = r.decision_latency_hours;
      within48h = decidedAt.getTime() <= deadlineAt.getTime();
    }
    return {
      ecode: r.ecode,
      employeeName: fullName(r.first_name, r.last_name),
      workDate: formatDbDate(r.work_date),
      detectedMinutes: r.detected_minutes,
      claimedMinutes: r.claimed_minutes,
      approvedMinutes: r.approved_minutes,
      status: r.status,
      managerEcode: r.mgr_ecode,
      managerName: r.mgr_first ? fullName(r.mgr_first, r.mgr_last) : null,
      deadlineAt: deadlineAt.toISOString(),
      decidedAt: asIso(decidedAt),
      decisionLatencyHours,
      convertedCompOff: r.comp_off_credit_id !== null,
      compOffCreditId: r.comp_off_credit_id,
      payrollItemId: r.payroll_item_id,
      within48h,
      managerDecisionCount: 0,
      managerAverageLatencyHours: null,
    };
  });
  const managerStats = new Map<string, { count: number; totalHours: number }>();
  for (const row of detailRows) {
    if (row.managerEcode === null || row.decisionLatencyHours === null) continue;
    const stat = managerStats.get(row.managerEcode) ?? { count: 0, totalHours: 0 };
    stat.count += 1;
    stat.totalHours += row.decisionLatencyHours;
    managerStats.set(row.managerEcode, stat);
  }
  return detailRows.map((row) => {
    const stat = row.managerEcode === null ? undefined : managerStats.get(row.managerEcode);
    return {
      ...row,
      managerDecisionCount: stat?.count ?? 0,
      managerAverageLatencyHours: stat
        ? Math.round((stat.totalHours / stat.count) * 10) / 10
        : null,
    };
  });
}

// ── R6 Absence Cases (docs/06 §R6) ──────────────────────────────────────────

export interface R6Row {
  id: number;
  ecode: string;
  employeeName: string;
  startDate: string;
  daysAbsent: number;
  stage: 'watch' | 'show_cause' | 'warning' | 'termination_review';
  ownerName: string | null;
  letterId: number | null;
  letterStatus: 'draft' | 'pending_signature' | 'issued' | null;
  letterContentPath: string | null;
  resolution: string | null;
  closedAt: string | null;
}

export async function reportR6AbsenceCases(
  db: Kysely<Database>,
  params: {
    companyId: number;
    stage?: 'watch' | 'show_cause' | 'warning' | 'termination_review' | undefined;
    openOnly?: boolean | undefined;
    scope?: EmployeeScope | undefined;
  },
): Promise<R6Row[]> {
  let q = db
    .selectFrom('att.absence_cases as c')
    .innerJoin('core.employees as e', 'e.id', 'c.employee_id')
    .leftJoin('core.users as owner_user', 'owner_user.id', 'c.hr_owner_id')
    .leftJoin('core.employees as owner', 'owner.id', 'owner_user.employee_id')
    .leftJoin('core.letters as letter', 'letter.id', 'c.letter_id')
    .where('e.company_id', '=', params.companyId)
    .where(employeeScopeSql(params.scope, 'e'))
    .select([
      'c.id',
      'e.ecode',
      'e.first_name',
      'e.last_name',
      'c.start_date',
      'c.days_absent',
      'c.stage',
      'owner_user.email as owner_email',
      'owner.first_name as owner_first',
      'owner.last_name as owner_last',
      'c.letter_id',
      'letter.status as letter_status',
      'c.resolution',
      'c.closed_at',
    ])
    .orderBy('c.id', 'desc');

  const stage = params.stage;
  if (
    stage === 'watch' ||
    stage === 'show_cause' ||
    stage === 'warning' ||
    stage === 'termination_review'
  ) {
    q = q.where('c.stage', '=', stage);
  }
  if (params.openOnly === true) q = q.where('c.closed_at', 'is', null);

  const rows = await q.execute();
  return rows.map((r) => ({
    id: r.id,
    ecode: r.ecode,
    employeeName: fullName(r.first_name, r.last_name),
    startDate: formatDbDate(r.start_date),
    daysAbsent: r.days_absent,
    stage: r.stage,
    ownerName: r.owner_first ? fullName(r.owner_first, r.owner_last) : r.owner_email,
    letterId: r.letter_id,
    letterStatus: r.letter_status,
    letterContentPath: r.letter_id === null ? null : `/api/letters/${String(r.letter_id)}/content`,
    resolution: r.resolution,
    closedAt: asIso(r.closed_at),
  }));
}

// ── R24 Boarding / Exit (docs/06 §R24) ──────────────────────────────────────

export interface BoardingReportRow {
  ecode: string;
  name: string;
  designation: string | null;
  department: string | null;
  reportingManager: string | null;
  costCenter: string | null;
  location: string | null;
  doj: string | null;
  dol: string | null;
  exitReason: string | null;
  kind: 'join' | 'exit';
}

export async function reportR24Boarding(
  db: Kysely<Database>,
  fromDate: string,
  toDate: string,
  companyId: number,
  scope?: EmployeeScope,
): Promise<{ joins: BoardingReportRow[]; exits: BoardingReportRow[] }> {
  const base = db
    .selectFrom('core.employees as e')
    .leftJoin('core.designations as d', 'd.id', 'e.designation_id')
    .leftJoin('core.departments as dep', 'dep.id', 'e.department_id')
    .leftJoin('core.cost_centers as cc', 'cc.id', 'e.cost_center_id')
    .leftJoin('core.locations as loc', 'loc.id', 'e.location_id')
    .leftJoin('core.employees as rm', 'rm.id', 'e.reporting_manager_id')
    .where('e.company_id', '=', companyId)
    .where(employeeScopeSql(scope, 'e'))
    .select([
      'e.ecode',
      'e.first_name',
      'e.last_name',
      'd.name as designation',
      'dep.name as department',
      'cc.code as cost_center',
      'loc.name as location',
      'rm.first_name as rm_first',
      'rm.last_name as rm_last',
      'e.doj',
      'e.dol',
      'e.exit_reason',
    ]);

  const joinsRaw = await base
    .where('e.doj', '>=', sql<Date>`${fromDate}::date`)
    .where('e.doj', '<=', sql<Date>`${toDate}::date`)
    .orderBy('e.doj')
    .orderBy('e.ecode')
    .execute();
  const exitsRaw = await base
    .where('e.dol', '>=', sql<Date>`${fromDate}::date`)
    .where('e.dol', '<=', sql<Date>`${toDate}::date`)
    .orderBy('e.dol')
    .orderBy('e.ecode')
    .execute();

  const toRow = (r: (typeof joinsRaw)[number], kind: 'join' | 'exit'): BoardingReportRow => ({
    ecode: r.ecode,
    name: fullName(r.first_name, r.last_name),
    designation: r.designation,
    department: r.department,
    reportingManager: r.rm_first ? fullName(r.rm_first, r.rm_last) : null,
    costCenter: r.cost_center,
    location: r.location,
    doj: kind === 'join' && r.doj ? formatDbDate(r.doj) : null,
    dol: kind === 'exit' && r.dol ? formatDbDate(r.dol) : null,
    exitReason: kind === 'exit' ? r.exit_reason : null,
    kind,
  });

  return {
    joins: joinsRaw.map((r) => toRow(r, 'join')),
    exits: exitsRaw.map((r) => toRow(r, 'exit')),
  };
}

// ── R27 Headcount (docs/06 §R27 — point-in-time + trend dimensions) ─────────

export interface R27Row {
  snapshotDate: string;
  status: 'active';
  company: string;
  location: string | null;
  category: string | null;
  department: string | null;
  grade: string | null;
  gender: string | null;
  ageBand: string;
  tenureBand: string;
  count: number;
}

export async function reportR27Headcount(
  db: Kysely<Database>,
  params: {
    companyId?: number | undefined;
    asOf?: string | undefined;
    fromMonth?: string | undefined;
    toMonth?: string | undefined;
    scope?: EmployeeScope | undefined;
    /** ORG-05 — same plant / MIS / cost-centre predicate as the directory. */
    orgScope?: OrgScopeFilter | undefined;
  } = {},
): Promise<R27Row[]> {
  let q = db
    .selectFrom('core.employees as e')
    .innerJoin('core.companies as company', 'company.id', 'e.company_id')
    .leftJoin('core.departments as dep', 'dep.id', 'e.department_id')
    .leftJoin('core.locations as location', 'location.id', 'e.location_id')
    .leftJoin('core.grades as grade', 'grade.id', 'e.grade_id')
    .select([
      'e.category', 'e.gender', 'e.dob', 'e.doj', 'e.dol',
      'company.name as company', 'dep.name as department',
      'location.name as location', 'grade.code as grade',
    ])
    .where(employeeScopeSql(params.scope, 'e'))
    .where(orgScopeWhere(params.orgScope, 'e'));

  if (params.companyId !== undefined) {
    q = q.where('e.company_id', '=', params.companyId);
  }
  const employees = await q.execute();
  const snapshots = reportSnapshots(params);
  const grouped = new Map<string, R27Row>();

  for (const snapshotDate of snapshots) {
    for (const employee of employees) {
      if (employee.doj === null) continue;
      const doj = formatDbDate(employee.doj);
      const dol = employee.dol === null ? null : formatDbDate(employee.dol);
      if (doj > snapshotDate || (dol !== null && dol <= snapshotDate)) continue;
      const ageBand = bandYears(yearsBetween(employee.dob, snapshotDate), 'age');
      const tenureBand = bandYears(yearsBetween(employee.doj, snapshotDate), 'tenure');
      const dimensions = [
        snapshotDate, employee.company, employee.location, employee.category,
        employee.department, employee.grade, employee.gender, ageBand, tenureBand,
      ];
      const key = JSON.stringify(dimensions);
      const existing = grouped.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        grouped.set(key, {
          snapshotDate,
          status: 'active',
          company: employee.company,
          location: employee.location,
          category: employee.category,
          department: employee.department,
          grade: employee.grade,
          gender: employee.gender,
          ageBand,
          tenureBand,
          count: 1,
        });
      }
    }
  }
  return [...grouped.values()].sort((a, b) =>
    a.snapshotDate.localeCompare(b.snapshotDate) ||
    a.company.localeCompare(b.company) ||
    (a.category ?? '').localeCompare(b.category ?? '') ||
    (a.department ?? '').localeCompare(b.department ?? ''),
  );
}

function reportSnapshots(params: {
  asOf?: string | undefined;
  fromMonth?: string | undefined;
  toMonth?: string | undefined;
}): string[] {
  if (params.fromMonth === undefined || params.toMonth === undefined) {
    return [params.asOf ?? new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date())];
  }
  const [fromYear, fromMonth] = params.fromMonth.split('-').map(Number);
  const [toYear, toMonth] = params.toMonth.split('-').map(Number);
  if (!fromYear || !fromMonth || !toYear || !toMonth) return [];
  const snapshots: string[] = [];
  let year = fromYear;
  let month = fromMonth;
  while (year < toYear || (year === toYear && month <= toMonth)) {
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    snapshots.push(`${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`);
    month += 1;
    if (month === 13) {
      month = 1;
      year += 1;
    }
  }
  return snapshots;
}

function yearsBetween(value: Date | string | null, asOf: string): number | null {
  if (value === null) return null;
  const from = formatDbDate(new Date(value));
  const yearDelta = Number(asOf.slice(0, 4)) - Number(from.slice(0, 4));
  return asOf.slice(5) < from.slice(5) ? yearDelta - 1 : yearDelta;
}

function bandYears(years: number | null, kind: 'age' | 'tenure'): string {
  if (years === null || years < 0) return 'Unknown';
  if (kind === 'age') {
    if (years < 25) return '<25';
    if (years < 35) return '25–34';
    if (years < 45) return '35–44';
    if (years < 55) return '45–54';
    return '55+';
  }
  if (years < 1) return '<1 year';
  if (years < 3) return '1–2 years';
  if (years < 6) return '3–5 years';
  if (years < 11) return '6–10 years';
  return '10+ years';
}
