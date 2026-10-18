/** WF-01 / CORE-11: subject → request/step → domain → audit lock order. */
import type { Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';

export async function lockWorkflowSubject(db: Kysely<Database>, employeeId: number): Promise<void> {
  if (!db.isTransaction) throw new Error('Workflow locking requires a transaction');
  await db.selectFrom('core.employees').select('id').where('id', '=', employeeId)
    .forUpdate().executeTakeFirstOrThrow();
}

export async function lockWorkflowRequest(db: Kysely<Database>, requestId: number) {
  const initial = await db.selectFrom('wf.requests').select('subject_employee_id')
    .where('id', '=', requestId).executeTakeFirstOrThrow();
  await lockWorkflowSubject(db, initial.subject_employee_id);
  const request = await db.selectFrom('wf.requests').selectAll().where('id', '=', requestId)
    .forUpdate().executeTakeFirstOrThrow();
  if (request.subject_employee_id !== initial.subject_employee_id) throw new Error('Request subject changed; refresh before acting');
  return request;
}
