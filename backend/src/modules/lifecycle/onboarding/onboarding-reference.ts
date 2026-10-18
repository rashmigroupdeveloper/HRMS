/** LC-01, CORE-02/10: real master choices; never assume entity count or IDs. */
import type { Kysely } from 'kysely';
import { companyScopeSql } from '../../../core/rbac/company-scope.js';
import type { Database } from '../../../core/db/types.js';
import type { EmployeeScope } from '../../../core/rbac/employee-scope.js';
export async function onboardingReferenceData(
  db: Kysely<Database>,
  scope: EmployeeScope,
  companyId?: number,
) {
  let companiesQuery = db
    .selectFrom('core.companies as c')
    .select(['c.id', 'c.name', 'c.ecode_prefix as ecodePrefix'])
    .orderBy('c.name');
  companiesQuery = companiesQuery.where(companyScopeSql(scope, 'c.id'));
  const companies = await companiesQuery.execute();
  if (companyId !== undefined && !companies.some((c) => c.id === companyId))
    throw new Error('Company outside your permitted data scope');
  const departments = await db
    .selectFrom('core.departments')
    .select(['id', 'name'])
    .orderBy('name')
    .execute();
  const designations = await db
    .selectFrom('core.designations')
    .select(['id', 'name'])
    .orderBy('name')
    .execute();
  const locations =
    companyId === undefined
      ? []
      : await db
          .selectFrom('core.locations')
          .select(['id', 'name'])
          .where('company_id', '=', companyId)
          .orderBy('name')
          .execute();
  const orgUnits=companyId===undefined?[]:await db.selectFrom('core.org_units').select(['id','name']).where('company_id','=',companyId).orderBy('name').execute();
  const salaryStructures =
    companyId === undefined
      ? []
      : await db
          .selectFrom('pay.salary_structures')
          .select(['id', 'name'])
          .where('company_id', '=', companyId)
          .where('is_active', '=', true)
          .orderBy('name')
          .execute();
  return { companies, departments, designations, orgUnits, locations, salaryStructures };
}
