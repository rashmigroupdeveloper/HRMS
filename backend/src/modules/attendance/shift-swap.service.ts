/**
 * Shift-swap / shift-bid (SHF-07). Fatigue + OT-cap + overlap run on the
 * resulting pair via applyRosterEntries, inside the approving transaction.
 */
import { sql, type Kysely, type Transaction } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { formatDbDate } from '../../core/dates.js';
import { createRequest, type RequestRow, type WorkflowFinalStatus } from '../workflows/index.js';
import { applyRosterEntries } from './roster.service.js';

type Db = Kysely<Database> | Transaction<Database>;

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
  if (params.requesterEmployeeId === params.counterpartEmployeeId) {
    throw new Error('A swap needs a different colleague');
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
  if (!requester) throw new Error('You have no roster assignment on that date — ask your manager first');
  if (!counterpart) throw new Error('Your colleague has no roster assignment on that date');

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
}

export async function applyShiftSwapOnFinal(db: Db, request: RequestRow, status: WorkflowFinalStatus): Promise<void> {
  const swap = await db
    .selectFrom('att.shift_swaps')
    .selectAll()
    .where('workflow_request_id', '=', request.id)
    .executeTakeFirst();
  if (!swap || swap.applied || status !== 'approved') return;
  if (swap.counterpart_employee_id === null) return;

  const iso = formatDbDate(swap.work_date);
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

  const bid = swap.kind === 'bid';
  await applyRosterEntries(db, {
    actorUserId: request.requested_by,
    ip: null,
    reason: 'Approved shift-swap (SHF-07)',
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

  await db.updateTable('att.shift_swaps').set({ applied: true }).where('id', '=', swap.id).execute();
  await writeAudit(db, {
    actorUserId: request.requested_by,
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
    .execute();
}
