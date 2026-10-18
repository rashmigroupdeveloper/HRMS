/** LC-01/CORE-02/03: validate the complete application and master relationships before allocation. */
import type { Kysely } from 'kysely';
import type { Database } from '../../../core/db/types.js';
import { employeeScopeSql, type EmployeeScope } from '../../../core/rbac/employee-scope.js';
import type { ConvertCandidateInput } from './onboarding-types.js';
import { PrejoinSubmissionSchema } from './prejoin-schema.js';

export function readCompletedApplication(raw: unknown) {
  let value = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw) as unknown;
    } catch {
      throw new Error('The submitted application is invalid; HR must request correction');
    }
  }
  const parsed = PrejoinSubmissionSchema.safeParse(value);
  if (!parsed.success)
    throw new Error('The submitted application is incomplete; HR must request correction');
  return parsed.data;
}

export async function validateJoiningAssignments(
  db: Kysely<Database>,
  input: ConvertCandidateInput,
  scope: EmployeeScope,
) {
  // Share locks preserve the validated master relationships until conversion commits.
  const department = await db
    .selectFrom('core.departments')
    .select('id')
    .where('id', '=', input.departmentId)
    .forShare()
    .executeTakeFirst();
  if (!department) throw new Error('Select a valid department assignment');
  const designation = await db
    .selectFrom('core.designations')
    .select('id')
    .where('id', '=', input.designationId)
    .forShare()
    .executeTakeFirst();
  if (!designation) throw new Error('Select a valid designation assignment');
  const location = await db
    .selectFrom('core.locations')
    .select('id')
    .where('id', '=', input.locationId)
    .where('company_id', '=', input.companyId)
    .forShare()
    .executeTakeFirst();
  if (!location) throw new Error('Work location must belong to the accepted employing entity');
  if(!Number.isSafeInteger(input.orgUnitId) || input.orgUnitId<=0) throw new Error('Select an organizational unit assignment');
  const unit=await db.selectFrom('core.org_units').select('id').where('id','=',input.orgUnitId).where('company_id','=',input.companyId).forShare().executeTakeFirst();
  if(!unit) throw new Error('Organizational unit must belong to the accepted employing entity');
  if (input.gradeId !== null && input.gradeId !== undefined) {
    const grade = await db
      .selectFrom('core.grades')
      .select('id')
      .where('id', '=', input.gradeId)
      .forShare()
      .executeTakeFirst();
    if (!grade) throw new Error('Select a valid grade assignment');
  }
  if (input.reportingManagerId !== null && input.reportingManagerId !== undefined) {
    const manager = await db
      .selectFrom('core.employees')
      .select('id')
      .where('id', '=', input.reportingManagerId)
      .where('status', 'in', ['active', 'on_notice'])
      .where(employeeScopeSql(scope, 'core.employees'))
      .forShare()
      .executeTakeFirst();
    if (!manager)
      throw new Error(
        'Reporting manager must be an available employee within your permitted data scope',
      );
  }
  if (input.salaryStructureId !== null && input.salaryStructureId !== undefined) {
    const structure = await db
      .selectFrom('pay.salary_structures')
      .select('id')
      .where('id', '=', input.salaryStructureId)
      .where('company_id', '=', input.companyId)
      .where('is_active', '=', true)
      .forShare()
      .executeTakeFirst();
    if (!structure)
      throw new Error(
        'Salary structure must be active and belong to the accepted employing entity',
      );
  }
}
