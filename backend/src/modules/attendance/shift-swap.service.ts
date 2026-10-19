/**
 * Shift-swap / shift-bid (SHF-07).
 * Concurrency & safety invariants:
 * - Deterministic paired-employee lock order (asc ID) prevents deadlocks
 * - Stale-roster check rejects if roster was modified while workflow was in-flight
 * - Attendance month-lock assertions protect finalized periods
 * - Fatigue, rest, OT cap & overlap rules run via applyRosterEntries
 */
import { sql, type Kysely, type Transaction } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { z } from 'zod';
import { getUserPermissionAccess } from '../../core/rbac/permissions.service.js';
import { assertEmployeesInScope } from '../../core/rbac/employee-scope.js';
import { attendanceTransaction } from './attendance-mutation.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { formatDbDate } from '../../core/dates.js';
import { createRequest, type RequestRow, type WorkflowFinalStatus } from '../workflows/index.js';
import { applyRosterEntries } from './roster.service.js';
import { assertAttendanceMonthOpen, lockAttendanceEmployee } from './attendance-mutation.js';

type Db = Kysely<Database> | Transaction<Database>;
const assignment = z.object({
  shiftId: z.number().int().positive().nullable(),
  weekOff: z.boolean(),
});
const snapshot = z.object({ requester: assignment, counterpart: assignment });
const swapInput = z.object({
  requesterEmployeeId: z.number().int().positive(),
  requestedByUserId: z.number().int().positive(),
  counterpartEmployeeId: z.number().int().positive(),
  workDate: z.string().date(),
  kind: z.enum(['swap', 'bid']),
  reason: z.string().trim().min(5).max(1000),
});

export async function requestShiftSwap(
  db: Kysely<Database>,
  params: {
    requesterEmployeeId: number;
    requestedByUserId: number;
    counterpartEmployeeId: number;
    workDate: string;
    kind: 'swap' | 'bid';
    reason: string;
  },
): Promise<{ id: number; workflowRequestId: number }> {
  params = swapInput.parse(params);
  return attendanceTransaction(db, async (db) => {
    if (params.requesterEmployeeId === params.counterpartEmployeeId) {
      throw new Error('A swap needs a different colleague');
    }

    const [firstId, secondId] = [params.requesterEmployeeId, params.counterpartEmployeeId].sort(
      (a, b) => a - b,
    );
    if (firstId === undefined || secondId === undefined) {
      throw new Error('Invalid swap participants');
    }

    await lockAttendanceEmployee(db, firstId);
    await lockAttendanceEmployee(db, secondId);
    const actor = await db
      .selectFrom('core.users')
      .select(['employee_id', 'is_active'])
      .where('id', '=', params.requestedByUserId)
      .executeTakeFirst();
    if (!actor?.is_active || actor.employee_id !== params.requesterEmployeeId)
      throw new Error('Requester account does not own this employee');

    const requesterEmp = await db
      .selectFrom('core.employees')
      .select(['id', 'company_id', 'status'])
      .where('id', '=', params.requesterEmployeeId)
      .executeTakeFirst();
    if (requesterEmp?.status !== 'active') {
      throw new Error('Requester employee record is not active');
    }

    const counterpartEmp = await db
      .selectFrom('core.employees')
      .select(['id', 'company_id', 'status'])
      .where('id', '=', params.counterpartEmployeeId)
      .executeTakeFirst();
    if (counterpartEmp?.status !== 'active') {
      throw new Error('Colleague employee record is not active');
    }

    for (const company of [...new Set([requesterEmp.company_id, counterpartEmp.company_id])].sort(
      (a, b) => a - b,
    )) {
      await assertAttendanceMonthOpen(db, company, params.workDate);
    }

    const requester = await db
      .selectFrom('att.rosters')
      .select(['shift_id', 'is_week_off'])
      .where('employee_id', '=', params.requesterEmployeeId)
      .where('work_date', '=', sql<Date>`${params.workDate}::date`)
      .executeTakeFirst();
    const counterpart = await db
      .selectFrom('att.rosters')
      .select(['shift_id', 'is_week_off'])
      .where('employee_id', '=', params.counterpartEmployeeId)
      .where('work_date', '=', sql<Date>`${params.workDate}::date`)
      .executeTakeFirst();
    if (!requester) {
      throw new Error('You have no roster assignment on that date — ask your manager first');
    }
    if (!counterpart) {
      throw new Error('Your colleague has no roster assignment on that date');
    }

    // Check for duplicate pending swap requests for either participant on that date
    const pending = await db
      .selectFrom('att.shift_swaps as s')
      .innerJoin('wf.requests as r', 'r.id', 's.workflow_request_id')
      .select('s.id')
      .where('s.work_date', '=', sql<Date>`${params.workDate}::date`)
      .where('r.status', 'in', ['pending', 'sent_back'])
      .where((eb) =>
        eb.or([
          eb('s.requester_employee_id', 'in', [
            params.requesterEmployeeId,
            params.counterpartEmployeeId,
          ]),
          eb('s.counterpart_employee_id', 'in', [
            params.requesterEmployeeId,
            params.counterpartEmployeeId,
          ]),
        ]),
      )
      .executeTakeFirst();
    if (pending) {
      throw new Error('A shift swap request for this date is already in progress');
    }

    let swapId = 0;
    const workflowRequestId = await createRequest(
      db,
      {
        definitionCode: 'shift_swap',
        subjectEmployeeId: params.requesterEmployeeId,
        requestedByUserId: params.requestedByUserId,
        payload: {
          kind: params.kind,
          workDate: params.workDate,
          counterpartEmployeeId: params.counterpartEmployeeId,
          reason: params.reason,
          rosterSnapshot: {
            requester: { shiftId: requester.shift_id, weekOff: requester.is_week_off },
            counterpart: { shiftId: counterpart.shift_id, weekOff: counterpart.is_week_off },
          },
        },
      },
      async (trx, requestId) => {
        const inserted = await trx
          .insertInto('att.shift_swaps')
          .values({
            requester_employee_id: params.requesterEmployeeId,
            counterpart_employee_id: params.counterpartEmployeeId,
            work_date: sql<Date>`${params.workDate}::date` as unknown as Date,
            requester_shift_id: requester.shift_id,
            counterpart_shift_id: counterpart.shift_id,
            kind: params.kind,
            workflow_request_id: requestId,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        swapId = inserted.id;
      },
    );
    return { id: swapId, workflowRequestId };
  });
}

export async function applyShiftSwapOnFinal(
  db: Db,
  request: RequestRow,
  status: WorkflowFinalStatus,
): Promise<void> {
  const swap = await db
    .selectFrom('att.shift_swaps')
    .selectAll()
    .where('workflow_request_id', '=', request.id)
    .executeTakeFirst();
  if (status !== 'approved') return;
  if (
    swap?.requester_employee_id !== request.subject_employee_id ||
    swap.counterpart_employee_id === null
  )
    throw new Error('Shift swap domain record is missing or inconsistent');
  if (swap.applied) return;
  if (!db.isTransaction)
    throw new Error('Shift swap finalization requires the workflow transaction');
  const original = snapshot.safeParse(
    (request.payload as Record<string, unknown>)['rosterSnapshot'],
  );
  if (!original.success)
    throw new Error('Shift swap has no verified roster snapshot; withdraw and resubmit');

  const iso = formatDbDate(swap.work_date);

  // Deterministic employee locking in ascending ID order to prevent deadlock
  const [firstId, secondId] = [swap.requester_employee_id, swap.counterpart_employee_id].sort(
    (a, b) => a - b,
  );
  if (firstId === undefined || secondId === undefined) return;

  const emp1 = await lockAttendanceEmployee(db, firstId);
  const emp2 = await lockAttendanceEmployee(db, secondId);
  const activeParticipants = await db.selectFrom('core.employees').select('id')
    .where('id', 'in', [firstId, secondId]).where('status', '=', 'active').execute();
  if (activeParticipants.length !== 2)
    throw new Error('Both shift swap participants must still be active; withdraw and reconcile the roster');

  for (const company of [...new Set([emp1.company_id, emp2.company_id])].sort((a, b) => a - b)) {
    await assertAttendanceMonthOpen(db, company, iso);
  }

  const requesterRow = await db
    .selectFrom('att.rosters')
    .select(['shift_id', 'is_week_off'])
    .where('employee_id', '=', swap.requester_employee_id)
    .where('work_date', '=', sql<Date>`${iso}::date`)
    .executeTakeFirst();
  const counterpartRow = await db
    .selectFrom('att.rosters')
    .select(['shift_id', 'is_week_off'])
    .where('employee_id', '=', swap.counterpart_employee_id)
    .where('work_date', '=', sql<Date>`${iso}::date`)
    .executeTakeFirst();
  if (!requesterRow || !counterpartRow) {
    throw new Error('SHF-07: roster rows disappeared before the swap could apply');
  }

  // Stale-roster guard: verify roster assignments haven't been modified while request was pending
  if (
    requesterRow.shift_id !== swap.requester_shift_id ||
    counterpartRow.shift_id !== swap.counterpart_shift_id ||
    requesterRow.shift_id !== original.data.requester.shiftId ||
    counterpartRow.shift_id !== original.data.counterpart.shiftId ||
    requesterRow.is_week_off !== original.data.requester.weekOff ||
    counterpartRow.is_week_off !== original.data.counterpart.weekOff
  ) {
    throw new Error(
      'SHF-07: roster was modified after the shift swap was requested; swap cannot apply cleanly',
    );
  }

  const decision = await db
    .selectFrom('wf.request_steps')
    .select('approver_user_id')
    .where('request_id', '=', request.id)
    .where('action', '=', 'approved')
    .orderBy('id', 'desc')
    .executeTakeFirst();
  if (!decision) throw new Error('Shift swap needs an authorized approval');
  const actor = await db
    .selectFrom('core.users')
    .select(['employee_id', 'is_active'])
    .where('id', '=', decision.approver_user_id)
    .executeTakeFirst();
  const access = await getUserPermissionAccess(
    db,
    decision.approver_user_id,
    'attendance.roster.write',
    'write',
  );
  if (!actor?.is_active || !access)
    throw new Error('Shift swap approver no longer has roster authority');
  const scope = { ...access, actorEmployeeId: actor.employee_id };
  await assertEmployeesInScope(db, scope, [
    swap.requester_employee_id,
    swap.counterpart_employee_id,
  ]);
  const bid = swap.kind === 'bid';
  await applyRosterEntries(db, {
    actorUserId: decision.approver_user_id,
    ip: null,
    reason: 'Approved shift-swap (SHF-07)',
    scope,
    entries: [
      {
        employeeId: swap.requester_employee_id,
        date: iso,
        shiftId: counterpartRow.shift_id,
        weekOff: counterpartRow.is_week_off,
      },
      {
        employeeId: swap.counterpart_employee_id,
        date: iso,
        shiftId: bid ? null : requesterRow.shift_id,
        weekOff: bid ? true : requesterRow.is_week_off,
      },
    ],
  });

  await db
    .updateTable('att.shift_swaps')
    .set({ applied: true })
    .where('id', '=', swap.id)
    .execute();
  await writeAudit(db, {
    actorUserId: decision.approver_user_id,
    action: 'update',
    entity: 'att.shift_swaps',
    entityId: swap.id,
    subjectEmployeeId: swap.requester_employee_id,
    newValue: `${swap.kind} ${iso} applied`,
  });
}

export async function listMySwaps(db: Kysely<Database>, employeeId: number) {
  return db
    .selectFrom('att.shift_swaps as s')
    .innerJoin('wf.requests as r', 'r.id', 's.workflow_request_id')
    .select([
      's.id',
      's.kind',
      's.work_date',
      's.counterpart_employee_id',
      's.applied',
      'r.status as workflow_status',
      's.workflow_request_id',
    ])
    .where('s.requester_employee_id', '=', employeeId)
    .orderBy('s.id', 'desc')
    .limit(100)
    .execute();
}

/** Called before the engine locks its subject, including cancel/resubmit/escalation. */
export async function shiftSwapSubjects(
  db: Db,
  request: Pick<RequestRow, 'id' | 'subject_employee_id'>,
): Promise<number[]> {
  const swap = await db
    .selectFrom('att.shift_swaps')
    .select(['requester_employee_id', 'counterpart_employee_id'])
    .where('workflow_request_id', '=', request.id)
    .executeTakeFirst();
  if (
    swap?.requester_employee_id !== request.subject_employee_id ||
    swap.counterpart_employee_id === null
  )
    throw new Error('Shift swap domain record is missing or inconsistent');
  return [swap.requester_employee_id, swap.counterpart_employee_id];
}
