/** WF-01 / CORE-11: subject → request/step → domain → audit lock order. */
import type { Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { workflowLockSubjects } from './workflow-hooks.js';

export async function lockWorkflowSubject(db: Kysely<Database>, employeeId: number): Promise<void> {
  if (!db.isTransaction) throw new Error('Workflow locking requires a transaction');
  await db
    .selectFrom('core.employees')
    .select('id')
    .where('id', '=', employeeId)
    .forUpdate()
    .executeTakeFirstOrThrow();
}

export async function lockWorkflowRequest(db: Kysely<Database>, requestId: number) {
  const initial = await db
    .selectFrom('wf.requests')
    .select(['id', 'definition_code', 'subject_employee_id'])
    .where('id', '=', requestId)
    .executeTakeFirstOrThrow();
  const subjects = await workflowLockSubjects(db, initial);
  for (const id of subjects) await lockWorkflowSubject(db, id);
  const request = await db
    .selectFrom('wf.requests')
    .selectAll()
    .where('id', '=', requestId)
    .forUpdate()
    .executeTakeFirstOrThrow();
  if (
    request.subject_employee_id !== initial.subject_employee_id ||
    request.definition_code !== initial.definition_code ||
    JSON.stringify(subjects) !== JSON.stringify(await workflowLockSubjects(db, request))
  ) {
    throw new Error('Request subjects changed; refresh before acting');
  }
  return request;
}
