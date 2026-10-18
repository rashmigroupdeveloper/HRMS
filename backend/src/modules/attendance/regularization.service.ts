/**
 * Attendance Regularization (AR), On-Duty (OD) and Permission — ATT-06/07,
 * docs/04 §1.3, the KQ future-dated-OD ask.
 *
 *   AR         — "I was here but the punch is missing": PAST days only, capped
 *                by `att.ar_max_past_days`; approval marks the selected day/half P.
 *   OD         — official duty away from a reader: FUTURE dates allowed (KQ);
 *                approval marks the selected day/half OD.
 *   PERMISSION — a time-bounded slice of ONE day (≤ `att.permission_max_hours`);
 *                approval protects the day as P.
 *
 * The request itself is a normal workflow instance ('regularization' / 'od'
 * chains — runtime-editable). The write-back into att.day_records happens in
 * the workflow COMPLETION HOOK, inside the same transaction that approves the
 * request. Whole-day rows stay protected; approved half coverage is reapplied
 * during swipe recomputation so the other half can still become present.
 */
import { z } from 'zod';
import { sql, type Kysely, type Selectable, type Transaction } from 'kysely';
import type { AttRegularizationsTable, Database, DayStatus } from '../../core/db/types.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { addDaysIso, formatDbDate, istDateString } from '../../core/dates.js';
import { getTypedSetting } from '../settings/index.js';
import { createRequest, type RequestRow, type WorkflowFinalStatus } from '../workflows/index.js';
import { dayPortionSchema, type DayPortion } from './half-requests.js';
import { recomputeDay, resolveDay } from './day-status.service.js';
import { assertApprovalSpanWritable } from '../../core/db/attendance-period.js';

type Db = Kysely<Database> | Transaction<Database>;

export type RegularizationKind = 'AR' | 'OD' | 'PERMISSION';

/** Which runtime-editable chain each kind rides on (docs/08 §4). */
const KIND_TO_WORKFLOW: Record<RegularizationKind, string> = {
  AR: 'regularization',
  PERMISSION: 'regularization',
  OD: 'od',
};

/** What an approval writes into the day (docs/04 §1.3). */
const KIND_TO_STATUS: Record<RegularizationKind, DayStatus> = {
  AR: 'P',
  OD: 'OD',
  PERMISSION: 'P',
};

export interface CreateRegularizationParams {
  employeeId: number;
  requestedByUserId: number;
  kind: RegularizationKind;
  fromDate: string;
  toDate: string;
  fromTime?: string | undefined;
  toTime?: string | undefined;
  reason: string;
  dayPortion?: DayPortion | undefined;
}

async function validateRegularization(db: Db, params: CreateRegularizationParams, excludeRequestId?: number): Promise<void> {
  if (params.fromDate > params.toDate) throw new Error('fromDate must be on or before toDate');

  const today = istDateString();
  const maxPastDays = await getTypedSetting(db, 'att.ar_max_past_days', 'number', 30);
  const earliest = addDaysIso(today, -maxPastDays);
  if (params.fromDate < earliest) {
    throw new Error(`Requests older than ${maxPastDays} days are closed — contact HR`);
  }

  if (params.kind === 'AR' && params.toDate > today) {
    throw new Error('AR is for past days only — use OD for planned duty');
  }
  if (params.kind === 'PERMISSION') {
    if (params.fromDate !== params.toDate) throw new Error('Permission covers exactly one day');
    if (!params.fromTime || !params.toTime) throw new Error('Permission needs from/to times');
    if (params.toTime <= params.fromTime) throw new Error('Permission toTime must be after fromTime');
    const maxHours = await getTypedSetting(db, 'att.permission_max_hours', 'number', 2);
    const [fh = 0, fm = 0] = params.fromTime.split(':').map(Number);
    const [th = 0, tm = 0] = params.toTime.split(':').map(Number);
    if (th * 60 + tm - (fh * 60 + fm) > maxHours * 60) {
      throw new Error(`Permission is capped at ${maxHours} hours`);
    }
  }

  const locked = await db
    .selectFrom('att.day_records')
    .select('id')
    .where('employee_id', '=', params.employeeId)
    .where('work_date', '>=', sql<Date>`${params.fromDate}::date`)
    .where('work_date', '<=', sql<Date>`${params.toDate}::date`)
    .where('is_locked', '=', true)
    .executeTakeFirst();
  if (locked) throw new Error('The period is locked for payroll — contact HR');

  const portion = dayPortionSchema.parse(params.dayPortion ?? 'full_day');
  if (params.kind === 'PERMISSION' && portion !== 'full_day') throw new Error('Short permission uses times rather than attendance halves');
  if (portion !== 'full_day') {
    if (params.fromTime || params.toTime) throw new Error('Select the shift half without custom times');
    const leave = await db.selectFrom('lv.applications').select('id').where('employee_id', '=', params.employeeId)
      .where('status', '=', 'approved').where('from_date', '<=', sql<Date>`${params.toDate}::date`)
      .where('to_date', '>=', sql<Date>`${params.fromDate}::date`).executeTakeFirst();
    if (leave) throw new Error('Approved leave covers this date; contact HR to reconcile attendance halves');
    for (let iso = params.fromDate; iso <= params.toDate; iso = addDaysIso(iso, 1)) {
      const resolved = await resolveDay(db, params.employeeId, iso);
      if (!resolved.isHoliday && !resolved.isWeekOff && !resolved.shift?.session_split) {
        throw new Error('Configure first/second-half shift boundaries before requesting a half day');
      }
    }
  }

  const duplicate = await db
    .selectFrom('att.regularizations as reg')
    .innerJoin('wf.requests as r', 'r.id', 'reg.workflow_request_id')
    .where('reg.employee_id', '=', params.employeeId)
    .where('r.id', '!=', excludeRequestId ?? -1)
    .where(eb => eb.or([
      eb('r.status', 'in', ['pending', 'sent_back']),
      eb.and([eb('r.status', '=', 'approved'), portion !== 'full_day'
        ? eb.val(true) : eb('reg.day_portion', '!=', 'full_day')]),
    ]))
    .$if(portion !== 'full_day', q => q.where(eb => eb.or([
      eb('reg.day_portion', '=', 'full_day'), eb('reg.day_portion', '=', portion),
    ])))
    .where('reg.from_date', '<=', sql<Date>`${params.toDate}::date`)
    .where('reg.to_date', '>=', sql<Date>`${params.fromDate}::date`)
    .select('reg.id')
    .executeTakeFirst();
  if (duplicate) throw new Error('An open or approved request already covers the selected attendance half');

}

/** Validate per-kind rules (all caps are settings), then create the workflow
 *  request WITH its domain row in one transaction. */
export async function createRegularization(
  db: Kysely<Database>,
  params: CreateRegularizationParams,
): Promise<{ id: number; workflowRequestId: number }> {
  await validateRegularization(db, params);

  let regularizationId = 0;
  const workflowRequestId = await createRequest(
    db,
    {
      definitionCode: KIND_TO_WORKFLOW[params.kind],
      subjectEmployeeId: params.employeeId,
      requestedByUserId: params.requestedByUserId,
      payload: {
        kind: params.kind,
        dayPortion: params.dayPortion ?? 'full_day',
        fromDate: params.fromDate,
        toDate: params.toDate,
        fromTime: params.fromTime ?? null,
        toTime: params.toTime ?? null,
        reason: params.reason,
      },
    },
    async (trx, requestId) => {
      await validateRegularization(trx, params, requestId);
      const inserted = await trx
        .insertInto('att.regularizations')
        .values({
          employee_id: params.employeeId,
          kind: params.kind,
          day_portion: params.dayPortion ?? 'full_day',
          from_date: sql<Date>`${params.fromDate}::date` as unknown as Date,
          to_date: sql<Date>`${params.toDate}::date` as unknown as Date,
          from_time: params.fromTime ?? null,
          to_time: params.toTime ?? null,
          reason: params.reason,
          requested_status: KIND_TO_STATUS[params.kind],
          workflow_request_id: requestId,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      regularizationId = inserted.id;
    },
  );

  return { id: regularizationId, workflowRequestId };
}

/**
 * Completion hook ('regularization' + 'od' chains): approval writes the
 * requested status into every WORKING day of the range with source='regularized'.
 * Holidays and week-offs are skipped — never converted into a present/OD day
 * (that would inflate payable days; a genuine WO/holiday worked is OT, not AR).
 * Locked days and HR manual overrides are never clobbered (ATT-17 wins).
 * Runs inside the approving transaction — decision and write-back are atomic.
 */
export async function applyRegularizationOnFinal(db: Db, request: RequestRow, status: WorkflowFinalStatus): Promise<void> {
  const reg = await db
    .selectFrom('att.regularizations')
    .selectAll()
    .where('workflow_request_id', '=', request.id)
    .executeTakeFirst();
  if (status !== 'approved') return;
  if (reg?.employee_id !== request.subject_employee_id || KIND_TO_WORKFLOW[reg.kind] !== request.definition_code
    || KIND_TO_STATUS[reg.kind] !== reg.requested_status) {
    throw new Error('Attendance request does not match its authoritative domain record');
  }
  if (reg.applied) return;

  const toIso = formatDbDate(reg.to_date);
  await assertApprovalSpanWritable(db, reg.employee_id, formatDbDate(reg.from_date), toIso);
  if (reg.day_portion !== 'full_day') {
    await validateRegularization(db, { employeeId: reg.employee_id, requestedByUserId: request.requested_by,
      kind: reg.kind, fromDate: formatDbDate(reg.from_date), toDate: toIso, reason: reg.reason, dayPortion: reg.day_portion }, request.id);
    await db.updateTable('att.regularizations').set({ applied: true }).where('id', '=', reg.id).execute();
    for (let iso = formatDbDate(reg.from_date); iso <= toIso; iso = addDaysIso(iso, 1)) {
      const resolved = await resolveDay(db, reg.employee_id, iso);
      if (resolved.isHoliday || resolved.isWeekOff) continue;
      const result = await recomputeDay(db, reg.employee_id, iso);
      if (result === 'skipped') throw new Error('Protected attendance or leave needs HR reconciliation before half-day approval');
    }
    await writeAudit(db, { action: 'update', entity: 'att.regularizations', entityId: reg.id,
      field: 'applied', newValue: `${reg.kind} ${reg.day_portion} ${formatDbDate(reg.from_date)}..${toIso}` });
    return;
  }
  const row = {
    status: reg.requested_status,
    leave_type_id: null,
    session_statuses: null,
    source: 'regularized' as const,
    computed_at: new Date(),
  };
  for (let iso = formatDbDate(reg.from_date); iso <= toIso; iso = addDaysIso(iso, 1)) {
    const resolved = await resolveDay(db, reg.employee_id, iso);
    if (resolved.isHoliday || resolved.isWeekOff) continue; // leave the paid off-day intact
    const applied = await db
      .insertInto('att.day_records')
      .values({ employee_id: reg.employee_id, work_date: sql<Date>`${iso}::date` as unknown as Date, ...row })
      .onConflict((oc) =>
        oc
          .columns(['employee_id', 'work_date'])
          .doUpdateSet(row)
          .where('att.day_records.source', '<>', 'manual')
          .where('att.day_records.is_locked', '=', false),
      )
      .returning('id').executeTakeFirst();
    if (!applied) throw new Error('Attendance changed during approval — refresh and contact HR');
  }

  await db.updateTable('att.regularizations').set({ applied: true }).where('id', '=', reg.id).execute();
  await writeAudit(db, {
    action: 'update',
    entity: 'att.regularizations',
    entityId: reg.id,
    field: 'applied',
    newValue: `${reg.kind} ${formatDbDate(reg.from_date)}..${toIso} → ${reg.requested_status}`,
  });
}

export type RegularizationRow = Selectable<AttRegularizationsTable> & { workflow_status: string };

/** An employee's own requests with their live workflow state (ESS list). */
export async function listRegularizations(db: Kysely<Database>, employeeId: number): Promise<RegularizationRow[]> {
  return db
    .selectFrom('att.regularizations as reg')
    .innerJoin('wf.requests as r', 'r.id', 'reg.workflow_request_id')
    .where('reg.employee_id', '=', employeeId)
    .selectAll('reg')
    .select('r.status as workflow_status')
    .orderBy('reg.id', 'desc')
    .limit(200)
    .execute();
}

const correctionSchema = z.object({
  kind: z.enum(['AR', 'OD', 'PERMISSION']), fromDate: z.string().date(), toDate: z.string().date(),
  fromTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).nullish(),
  toTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).nullish(),
  reason: z.string().trim().min(5),
  dayPortion: dayPortionSchema.default('full_day'),
});

/** WF-01 / ATT-06/07: manager-visible revision and applied dates are one fact. */
export async function resubmitRegularization(db: Db, request: RequestRow, raw: Record<string, unknown>) {
  const payload = correctionSchema.parse(raw);
  const reg = await db.selectFrom('att.regularizations').selectAll()
    .where('workflow_request_id', '=', request.id).forUpdate().executeTakeFirstOrThrow();
  if (reg.applied || reg.employee_id !== request.subject_employee_id || payload.kind !== reg.kind) {
    throw new Error('Attendance request identity or kind cannot change during resubmission');
  }
  await validateRegularization(db, { ...payload, employeeId: reg.employee_id,
    requestedByUserId: request.requested_by, fromTime: payload.fromTime ?? undefined, toTime: payload.toTime ?? undefined }, request.id);
  await assertApprovalSpanWritable(db, reg.employee_id, payload.fromDate, payload.toDate);
  await db.updateTable('att.regularizations').set({
    from_date: sql<Date>`${payload.fromDate}::date`, to_date: sql<Date>`${payload.toDate}::date`,
    from_time: payload.fromTime ?? null, to_time: payload.toTime ?? null, reason: payload.reason, day_portion: payload.dayPortion,
  }).where('id', '=', reg.id).execute();
  return { ...payload, fromTime: payload.fromTime ?? null, toTime: payload.toTime ?? null };
}
