/** CORE-10: company-wide records require coverage of that company's units. */
import { sql, type Kysely, type RawBuilder } from 'kysely';
import type { Database } from '../db/types.js';
import type { EmployeeScope } from './employee-scope.js';
import { ForbiddenError, NotFoundError } from '../errors/index.js';

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
  if (!company) throw new ForbiddenError('Company outside your permitted data scope');
}

/** Scope inputs every authenticated oRPC context carries. */
interface ScopedContext {
  db: Kysely<Database>;
  permissionAccess: EmployeeScope | Omit<EmployeeScope, 'actorEmployeeId'>;
  user: { employee_id: number | null };
}

function scopeOf(context: ScopedContext): EmployeeScope {
  return { ...context.permissionAccess, actorEmployeeId: context.user.employee_id };
}

/**
 * Entity isolation for company-owned records (payroll runs, locks, batches):
 * a group-scoped holder passes; an entity-scoped holder must cover the
 * run's company. Unknown ids are 404 rather than leaking existence.
 */
export async function requireRunInScope(context: ScopedContext, runId: number): Promise<number> {
  const run = await context.db
    .selectFrom('pay.payroll_runs')
    .select('company_id')
    .where('id', '=', runId)
    .executeTakeFirst();
  if (!run) throw new NotFoundError('Payroll run not found');
  await assertCompanyInScope(context.db, scopeOf(context), run.company_id);
  return run.company_id;
}

export async function requireCompanyInScope(context: ScopedContext, companyId: number): Promise<void> {
  await assertCompanyInScope(context.db, scopeOf(context), companyId);
}

/** Company ids the caller may see for the current permission (null = group-wide). */
export async function companiesInScope(context: ScopedContext): Promise<number[] | null> {
  if (context.permissionAccess.all) return null;
  const rows = await context.db
    .selectFrom('core.companies as c')
    .select('c.id')
    .where(companyScopeSql(scopeOf(context), 'c.id'))
    .execute();
  return rows.map((r) => r.id);
}
