/**
 * ORG-05 — shared SQL predicate for company / plant / MIS / dept / cost-centre.
 * Empty arrays mean "no extra slice"; callers still apply their own RBAC scope.
 */
import { sql, type RawBuilder } from 'kysely';
import type { OrgScopeFilter } from '../../core/org/scope.js';
import { emptyOrgScope } from '../../core/org/scope.js';

/**
 * Predicate against `core.employees` (alias defaults to `e`).
 * Joins are expressed as IN-subqueries so list queries need no forced joins.
 */
export function orgScopeWhere(
  scope: OrgScopeFilter | undefined | null,
  employeeAlias = 'e',
): RawBuilder<boolean> {
  const filter = scope ?? emptyOrgScope();
  const parts: RawBuilder<unknown>[] = [];
  const col = (name: string) => sql.ref(`${employeeAlias}.${name}`);

  if (filter.companyCode.length > 0) {
    parts.push(
      sql`${col('company_id')} IN (
        SELECT c.id FROM core.companies c
         WHERE c.code IN (${sql.join(filter.companyCode.map((code) => sql`${code}`))})
      )`,
    );
  }
  if (filter.plantCode.length > 0) {
    parts.push(
      sql`${col('plant_id')} IN (
        SELECT p.id FROM core.plants p
         WHERE p.plant_code IN (${sql.join(filter.plantCode.map((code) => sql`${code}`))})
      )`,
    );
  }
  if (filter.misCode.length > 0) {
    parts.push(
      sql`EXISTS (
        SELECT 1 FROM core.departments d
        INNER JOIN core.mis_codes m ON m.id = d.mis_code_id
         WHERE d.id = ${col('department_id')}
           AND m.company_id = ${col('company_id')}
           AND m.code IN (${sql.join(filter.misCode.map((code) => sql`${code}`))})
      )`,
    );
  }
  if (filter.departmentId.length > 0) {
    parts.push(
      sql`${col('department_id')} IN (${sql.join(filter.departmentId.map((id) => sql`${id}`))})`,
    );
  }
  if (filter.costCenterCode.length > 0) {
    parts.push(
      sql`${col('cost_center_id')} IN (
        SELECT cc.id FROM core.cost_centers cc
         WHERE cc.code IN (${sql.join(filter.costCenterCode.map((code) => sql`${code}`))})
      )`,
    );
  }

  if (parts.length === 0) return sql<boolean>`true`;
  return sql<boolean>`(${sql.join(parts, sql` AND `)})`;
}
