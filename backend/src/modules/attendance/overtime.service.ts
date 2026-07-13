/**
 * Overtime — ATT-08, the HARD 48-hour rule (docs/04 §1.4, PP-16/19):
 *
 *   detect (every recompute: beyond-shift-end minutes, or ALL worked minutes
 *   on a week-off/holiday) → one entry per employee-day + an 'overtime'
 *   workflow intimation to the reporting manager → the manager decides
 *   (approve full or partial · reject · convert to comp-off) within
 *   `att.ot_decision_hours` — or the request LAPSES. No silent accrual,
 *   no month-end surprises.
 *
 * Money/comp-off exclusivity is a DB CHECK (comp_off_credit_id XOR
 * payroll_item_id), not a convention. Comp-off ledger credit + payroll payout
 * attach in Stages 1.5 / Phase 2.
 */
import { sql, type Kysely, type Selectable, type Transaction } from 'kysely';
import type { AttOvertimeEntriesTable, Database } from '../../core/db/types.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { formatDbDate } from '../../core/dates.js';
import { enqueue } from '../notifications/index.js';
import { act, createRequest, type RequestRow, type WorkflowFinalStatus } from '../workflows/index.js';
import { compOffDaysForMinutes, creditCompOffForOvertime } from '../leave/index.js';

type Db = Kysely<Database> | Transaction<Database>;
type OvertimeEntry = Selectable<AttOvertimeEntriesTable>;

/** The slice of AttendancePolicy this module needs (kept structural so there is
 *  no import back into day-status.service — no cycle). */
export interface OvertimePolicy {
  otMinMinutes: number;
  otDecisionHours: number;
}

/**
 * Idempotent detection (called from recomputeDay once minutes ≥ threshold):
 * first sighting creates the entry + the workflow intimation atomically;
 * re-detection while still pending only refreshes the minutes; a decided
 * entry is never reopened by a recompute.
 */
export async function recordDetectedOvertime(
  db: Kysely<Database>,
  employeeId: number,
  isoDate: string,
  detectedMinutes: number,
  policy: OvertimePolicy,
): Promise<void> {
  const existing = await db
    .selectFrom('att.overtime_entries')
    .select(['id', 'status'])
    .where('employee_id', '=', employeeId)
    .where('work_date', '=', sql<Date>`${isoDate}::date`)
    .executeTakeFirst();

  if (existing) {
    if (existing.status === 'pending') {
      await db
        .updateTable('att.overtime_entries')
        .set({ detected_minutes: detectedMinutes, claimed_minutes: detectedMinutes })
        .where('id', '=', existing.id)
        .where('status', '=', 'pending')
        .execute();
    }
    return;
  }

  const employee = await db
    .selectFrom('core.employees')
    .select(['reporting_manager_id'])
    .where('id', '=', employeeId)
    .executeTakeFirstOrThrow();
  const deadline = new Date(Date.now() + policy.otDecisionHours * 3600_000);
  const entryValues = {
    employee_id: employeeId,
    work_date: sql<Date>`${isoDate}::date` as unknown as Date,
    detected_minutes: detectedMinutes,
    claimed_minutes: detectedMinutes,
    manager_id: employee.reporting_manager_id,
    deadline_at: deadline,
  };

  const requester = await db
    .selectFrom('core.users')
    .select('id')
    .where('employee_id', '=', employeeId)
    .where('is_active', '=', true)
    .executeTakeFirst();

  if (requester) {
    // The intimation IS a workflow request: the RM step's notified_at is the
    // structural receipt, and the seeded chain's onBreach='lapse' enforces the
    // 48h rule via the hourly escalation sweep.
    try {
      await createRequest(
        db,
        {
          definitionCode: 'overtime',
          subjectEmployeeId: employeeId,
          requestedByUserId: requester.id,
          payload: { workDate: isoDate, detectedMinutes },
        },
        async (trx, requestId) => {
          // Throwing here rolls the whole request back — a concurrent detector
          // that already inserted the entry wins, and no orphan request leaks.
          await trx
            .insertInto('att.overtime_entries')
            .values({ ...entryValues, workflow_request_id: requestId })
            .executeTakeFirstOrThrow();
        },
      );
      await enqueue(db, {
        recipientUserId: requester.id,
        channel: 'in_app',
        templateCode: 'ot_detected',
        payload: { workDate: isoDate, detectedMinutes, deadline: deadline.toISOString() },
      });
    } catch {
      return; // lost the race — the winning entry already carries the request
    }
    return;
  }

  // No user account (e.g. worker without ESS): record + notify the manager's
  // user directly; the hourly lapse sweep enforces the deadline instead of the
  // workflow engine.
  await db
    .insertInto('att.overtime_entries')
    .values(entryValues)
    .onConflict((oc) => oc.columns(['employee_id', 'work_date']).doNothing())
    .execute();
  if (employee.reporting_manager_id !== null) {
    const managerUser = await db
      .selectFrom('core.users')
      .select('id')
      .where('employee_id', '=', employee.reporting_manager_id)
      .where('is_active', '=', true)
      .executeTakeFirst();
    if (managerUser) {
      await enqueue(db, {
        recipientUserId: managerUser.id,
        channel: 'in_app',
        templateCode: 'ot_pending_decision',
        payload: { employeeId, workDate: isoDate, detectedMinutes, deadline: deadline.toISOString() },
      });
    }
  }
}

/** Completion hook ('overtime' chain): mirror the workflow's final state onto
 *  the entry, inside the finalizing transaction. A lapse is the ATT-08 teeth —
 *  the minutes are gone unless HR reopens via manual override policy. */
export async function applyOvertimeOnFinal(db: Db, request: RequestRow, status: WorkflowFinalStatus): Promise<void> {
  const entry = await db
    .selectFrom('att.overtime_entries')
    .select(['id', 'claimed_minutes'])
    .where('workflow_request_id', '=', request.id)
    .where('status', '=', 'pending')
    .executeTakeFirst();
  if (!entry) return;

  await db
    .updateTable('att.overtime_entries')
    .set({
      status: status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : 'lapsed',
      approved_minutes: status === 'approved' ? entry.claimed_minutes : null,
      decided_at: new Date(),
    })
    .where('id', '=', entry.id)
    .where('status', '=', 'pending')
    .execute();
}

export interface DecideOvertimeParams {
  entryId: number;
  actorUserId: number;
  action: 'approve' | 'reject' | 'convert_comp_off';
  /** Partial approval (≤ claimed). Defaults to the full claim. */
  approvedMinutes?: number | undefined;
  comment?: string | undefined;
}

/**
 * The manager's decision endpoint logic. Workflow-backed entries go THROUGH
 * the engine (authorization = current approver / role queue, receipts, audit);
 * partial minutes and comp-off conversion are then refined on the entry.
 * Entries without a workflow (employee has no user account) are decided
 * directly under the router's `ot.approve` gate.
 */
export async function decideOvertime(db: Kysely<Database>, params: DecideOvertimeParams): Promise<OvertimeEntry> {
  const entry = await db
    .selectFrom('att.overtime_entries')
    .selectAll()
    .where('id', '=', params.entryId)
    .executeTakeFirstOrThrow();
  if (entry.status !== 'pending') throw new Error(`Entry already ${entry.status}`);

  const minutes = params.approvedMinutes ?? entry.claimed_minutes;
  if (params.action !== 'reject' && (minutes <= 0 || minutes > entry.claimed_minutes)) {
    throw new Error(`approvedMinutes must be 1..${entry.claimed_minutes}`);
  }
  // Validate the conversion BEFORE consuming the workflow approval, so a
  // below-threshold convert fails cleanly instead of half-deciding the entry.
  if (params.action === 'convert_comp_off' && (await compOffDaysForMinutes(db, minutes)) === 0) {
    throw new Error('Too few minutes for a comp-off — approve as OT pay or reject instead');
  }

  const actor = await db
    .selectFrom('core.users')
    .select('employee_id')
    .where('id', '=', params.actorUserId)
    .executeTakeFirstOrThrow();

  if (entry.workflow_request_id !== null) {
    await act(db, {
      requestId: entry.workflow_request_id,
      actorUserId: params.actorUserId,
      action: params.action === 'reject' ? 'reject' : 'approve',
      comment: params.comment,
    });
    // The hook has set the full-approve/reject baseline; refine for partial
    // minutes / comp-off conversion + record who decided.
    await db
      .updateTable('att.overtime_entries')
      .set({
        status: params.action === 'convert_comp_off' ? 'converted_comp_off' : params.action === 'reject' ? 'rejected' : 'approved',
        approved_minutes: params.action === 'reject' ? null : minutes,
        manager_id: actor.employee_id ?? entry.manager_id,
      })
      .where('id', '=', entry.id)
      .execute();
  } else {
    await db
      .updateTable('att.overtime_entries')
      .set({
        status: params.action === 'convert_comp_off' ? 'converted_comp_off' : params.action === 'reject' ? 'rejected' : 'approved',
        approved_minutes: params.action === 'reject' ? null : minutes,
        manager_id: actor.employee_id ?? entry.manager_id,
        decided_at: new Date(),
      })
      .where('id', '=', entry.id)
      .where('status', '=', 'pending')
      .execute();
    await writeAudit(db, {
      actorUserId: params.actorUserId,
      action: 'update',
      entity: 'att.overtime_entries',
      entityId: entry.id,
      field: 'decision',
      oldValue: 'pending',
      newValue: `${params.action}:${params.action === 'reject' ? 0 : minutes}min`,
    });
  }

  // LV-04: the converted minutes become a comp-off ledger CREDIT with an
  // expiry window; the entry's comp_off_credit_id link makes the XOR
  // (money vs comp-off) checkable at the DB.
  if (params.action === 'convert_comp_off') {
    await creditCompOffForOvertime(db, {
      otEntryId: entry.id,
      employeeId: entry.employee_id,
      workDateIso: formatDbDate(entry.work_date),
      minutes,
      actorUserId: params.actorUserId,
    });
  }

  return db.selectFrom('att.overtime_entries').selectAll().where('id', '=', entry.id).executeTakeFirstOrThrow();
}

/** Hourly sweep companion to runEscalations: entries WITHOUT a workflow lapse
 *  here once past deadline (workflow-backed ones lapse via the engine + hook). */
export async function lapseExpiredOvertime(db: Kysely<Database>, asOf = new Date()): Promise<number> {
  const rows = await db
    .updateTable('att.overtime_entries')
    .set({ status: 'lapsed', decided_at: asOf })
    .where('status', '=', 'pending')
    .where('deadline_at', '<', asOf)
    .where('workflow_request_id', 'is', null)
    .returning('id')
    .execute();
  return rows.length;
}

/** Daily 18:00 IST digest (PP-19): each manager with pending OT gets one
 *  summary with the count and the nearest deadline. */
export async function sendOvertimeSummaries(db: Kysely<Database>): Promise<number> {
  const pending = await db
    .selectFrom('att.overtime_entries as o')
    .innerJoin('core.users as u', (join) => join.onRef('u.employee_id', '=', 'o.manager_id').on('u.is_active', '=', true))
    .where('o.status', '=', 'pending')
    .select(({ fn }) => ['u.id as user_id', fn.countAll<number>().as('count'), fn.min('o.deadline_at').as('earliest_deadline')])
    .groupBy('u.id')
    .execute();

  for (const row of pending) {
    await enqueue(db, {
      recipientUserId: row.user_id,
      channel: 'in_app',
      templateCode: 'ot_pending_summary',
      payload: { pendingCount: row.count, earliestDeadline: new Date(row.earliest_deadline).toISOString() },
    });
  }
  return pending.length;
}

/** Pending decisions for a manager (the console list behind the digest). */
export async function listPendingOvertime(db: Kysely<Database>, managerEmployeeId: number): Promise<OvertimeEntry[]> {
  return db
    .selectFrom('att.overtime_entries')
    .selectAll()
    .where('manager_id', '=', managerEmployeeId)
    .where('status', '=', 'pending')
    .orderBy('deadline_at')
    .execute();
}

/** An employee's own OT history (ESS). */
export async function listMyOvertime(db: Kysely<Database>, employeeId: number): Promise<OvertimeEntry[]> {
  return db
    .selectFrom('att.overtime_entries')
    .selectAll()
    .where('employee_id', '=', employeeId)
    .orderBy('work_date', 'desc')
    .limit(200)
    .execute();
}
