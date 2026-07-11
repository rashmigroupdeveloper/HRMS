/**
 * Attendance Regularization (AR), On-Duty (OD) and Permission — ATT-06/07,
 * docs/04 §1.3, the KQ future-dated-OD ask.
 *
 *   AR         — "I was here but the punch is missing": PAST days only, capped
 *                by `att.ar_max_past_days`; approval marks the day P.
 *   OD         — official duty away from a reader: FUTURE dates allowed (KQ);
 *                approval marks the day OD.
 *   PERMISSION — a time-bounded slice of ONE day (≤ `att.permission_max_hours`);
 *                approval protects the day as P.
 *
 * The request itself is a normal workflow instance ('regularization' / 'od'
 * chains — runtime-editable). The write-back into att.day_records happens in
 * the workflow COMPLETION HOOK, inside the same transaction that approves the
 * request, and those rows get source='regularized' so recomputeDay never
 * silently reverts an approved decision.
 */
import { sql, type Kysely, type Selectable, type Transaction } from 'kysely';
import type { AttRegularizationsTable, Database, DayStatus } from '../../core/db/types.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { addDaysIso, formatDbDate, istDateString } from '../../core/dates.js';
import { getTypedSetting } from '../settings/index.js';
import { createRequest, type RequestRow, type WorkflowFinalStatus } from '../workflows/index.js';

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
}

/** Validate per-kind rules (all caps are settings), then create the workflow
 *  request WITH its domain row in one transaction. */
export async function createRegularization(
  db: Kysely<Database>,
  params: CreateRegularizationParams,
): Promise<{ id: number; workflowRequestId: number }> {
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

  const duplicate = await db
    .selectFrom('att.regularizations as reg')
    .innerJoin('wf.requests as r', 'r.id', 'reg.workflow_request_id')
    .where('reg.employee_id', '=', params.employeeId)
    .where('r.status', 'in', ['pending', 'sent_back'])
    .where('reg.from_date', '<=', sql<Date>`${params.toDate}::date`)
    .where('reg.to_date', '>=', sql<Date>`${params.fromDate}::date`)
    .select('reg.id')
    .executeTakeFirst();
  if (duplicate) throw new Error('An open request already covers these dates');

  let regularizationId = 0;
  const workflowRequestId = await createRequest(
    db,
    {
      definitionCode: KIND_TO_WORKFLOW[params.kind],
      subjectEmployeeId: params.employeeId,
      requestedByUserId: params.requestedByUserId,
      payload: {
        kind: params.kind,
        fromDate: params.fromDate,
        toDate: params.toDate,
        fromTime: params.fromTime ?? null,
        toTime: params.toTime ?? null,
        reason: params.reason,
      },
    },
    async (trx, requestId) => {
      const inserted = await trx
        .insertInto('att.regularizations')
        .values({
          employee_id: params.employeeId,
          kind: params.kind,
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
 * requested status into every day of the range with source='regularized'.
 * Locked days and HR manual overrides are never clobbered (ATT-17 wins).
 * Runs inside the approving transaction — decision and write-back are atomic.
 */
export async function applyRegularizationOnFinal(db: Db, request: RequestRow, status: WorkflowFinalStatus): Promise<void> {
  const reg = await db
    .selectFrom('att.regularizations')
    .selectAll()
    .where('workflow_request_id', '=', request.id)
    .executeTakeFirst();
  if (!reg || reg.applied || status !== 'approved') return;

  const toIso = formatDbDate(reg.to_date);
  const row = {
    status: reg.requested_status,
    source: 'regularized' as const,
    computed_at: new Date(),
  };
  for (let iso = formatDbDate(reg.from_date); iso <= toIso; iso = addDaysIso(iso, 1)) {
    await db
      .insertInto('att.day_records')
      .values({ employee_id: reg.employee_id, work_date: sql<Date>`${iso}::date` as unknown as Date, ...row })
      .onConflict((oc) =>
        oc
          .columns(['employee_id', 'work_date'])
          .doUpdateSet(row)
          .where('att.day_records.source', '<>', 'manual')
          .where('att.day_records.is_locked', '=', false),
      )
      .execute();
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
