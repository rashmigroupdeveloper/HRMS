/** CORE-10: company-wide records require coverage of that company's units. */
import { sql, type Kysely, type RawBuilder } from 'kysely';
import type { Database } from '../db/types.js';
import type { EmployeeScope } from './employee-scope.js';

export function companyScopeSql(
  scope: EmployeeScope | undefined,
  companyColumn: string,
): RawBuilder<boolean> {
  if (!scope || scope.all) return sql<boolean>`true`;
  if (scope.orgUnitIds.length === 0) return sql<boolean>`false`;
  const company = sql.ref(companyColumn);
  // Empty entities and unmapped employees cannot confer authority by accident.
  return sql<boolean>`EXISTS (SELECT 1 FROM core.org_units ou WHERE ou.company_id = ${company})
    AND NOT EXISTS (SELECT 1 FROM core.org_units ou WHERE ou.company_id = ${company}
      AND ou.id NOT IN (${sql.join(scope.orgUnitIds)}))
    AND NOT EXISTS (SELECT 1 FROM core.employees ce WHERE ce.company_id = ${company}
      AND (ce.org_unit_id IS NULL OR ce.org_unit_id NOT IN (${sql.join(scope.orgUnitIds)})))`;
}

export async function assertCompanyInScope(
  db: Kysely<Database>,
  scope: EmployeeScope,
  companyId: number,
) {
  const company = await db
    .selectFrom('core.companies as c')
    .select('c.id')
    .where('c.id', '=', companyId)
    .where(companyScopeSql(scope, 'c.id'))
    .executeTakeFirst();
  if (!company) throw new Error('Company outside your permitted data scope');
}
