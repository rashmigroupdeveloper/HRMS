/** LV-03 / WF-01: revise the application and manager-visible payload atomically. */
import { sql, type Kysely } from 'kysely';
import { z } from 'zod';
import type { Database } from '../../core/db/types.js';
import type { RequestRow } from '../workflows/index.js';
import { assertApprovalSpanWritable } from '../../core/db/attendance-period.js';
import { validateLeaveApplication } from './leave-validation.js';

const correction = z.object({
  leaveType: z.string().min(1), fromDate: z.string().date(), toDate: z.string().date(),
  fromHalf: z.boolean().optional(), toHalf: z.boolean().optional(), reason: z.string().nullish(),
});

export async function resubmitLeave(db: Kysely<Database>, request: RequestRow, raw: Record<string, unknown>) {
  const payload = correction.parse(raw);
  const application = await db.selectFrom('lv.applications').selectAll()
    .where('workflow_request_id', '=', request.id).forUpdate().executeTakeFirstOrThrow();
  if (application.status !== 'pending' || application.employee_id !== request.subject_employee_id) {
    throw new Error('Only the matching pending leave application can be revised');
  }
  if ((payload.leaveType === 'CO') !== (request.definition_code === 'comp_off')) {
    throw new Error('A revision cannot switch between leave and comp-off approval chains');
  }
  await assertApprovalSpanWritable(db, application.employee_id, payload.fromDate, payload.toDate);
  const validated = await validateLeaveApplication(db, {
    employeeId: application.employee_id, requestedByUserId: request.requested_by,
    leaveTypeCode: payload.leaveType, fromDate: payload.fromDate, toDate: payload.toDate,
    fromHalf: payload.fromHalf ?? application.from_half, toHalf: payload.toHalf ?? application.to_half,
    reason: payload.reason ?? undefined,
  }, application.id);
  await db.updateTable('lv.applications').set({
    leave_type_id: validated.type.id, from_date: sql<Date>`${payload.fromDate}::date`,
    to_date: sql<Date>`${payload.toDate}::date`, from_half: validated.fromHalf, to_half: validated.toHalf,
    days: String(validated.days), reason: payload.reason ?? null,
  }).where('id', '=', application.id).execute();
  return { leaveType: validated.type.code, fromDate: payload.fromDate, toDate: payload.toDate,
    fromHalf: validated.fromHalf, toHalf: validated.toHalf, days: validated.days, reason: payload.reason ?? null };
}
