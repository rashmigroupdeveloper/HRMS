/** ATT-05/06/07: approved coverage overlays current raw first/second-half facts. */
import { sql, type Kysely } from 'kysely';
import { z } from 'zod';
import type { Database, DayStatus } from '../../core/db/types.js';
import type { SessionStatuses } from './session-status.js';
export const dayPortionSchema = z.enum(['full_day', 'first_half', 'second_half']);
export type DayPortion = z.infer<typeof dayPortionSchema>;
export async function approvedHalfRequests(db: Kysely<Database>, employeeId: number, iso: string) {
  return db.selectFrom('att.regularizations as reg').innerJoin('wf.requests as r', 'r.id', 'reg.workflow_request_id')
    .select(['reg.day_portion', 'reg.requested_status']).where('reg.employee_id', '=', employeeId)
    .where('reg.day_portion', '!=', 'full_day').where('reg.applied', '=', true).where('r.status', '=', 'approved')
    .where('reg.from_date', '<=', sql<Date>`${iso}::date`).where('reg.to_date', '>=', sql<Date>`${iso}::date`).execute();
}
export function overlayHalfRequests(sessions: SessionStatuses | null,
  requests: readonly { day_portion: DayPortion; requested_status: DayStatus }[]) {
  if (!sessions) throw new Error('Configure first/second-half shift boundaries before applying a half-day request');
  if (sessions.some(s => s.status === 'O')) throw new Error('Off-half attendance requires HR reconciliation');
  const merged: SessionStatuses = [{ ...sessions[0] }, { ...sessions[1] }];
  for (const request of requests) {
    if (request.requested_status !== 'P' && request.requested_status !== 'OD') throw new Error('Invalid half-day attendance result');
    const index = request.day_portion === 'first_half' ? 0 : 1;
    merged[index].status = request.requested_status;
  }
  const count = merged.filter(s => s.status === 'P' || s.status === 'OD').length;
  const status: DayStatus = count === 2 ? (merged.every(s => s.status === 'OD') ? 'OD' : 'P') : count === 1 ? 'HD' : 'A';
  return { status, sessionStatuses: merged };
}
