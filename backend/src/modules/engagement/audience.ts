/**
 * Engagement audience filter — the same {categories, departmentIds,
 * locationIds} shape the policy publisher uses (CORE-13), so HR learns the
 * targeting model once and it means the same thing everywhere.
 *
 * An empty/absent audience targets everyone active — but the publisher UI
 * makes that a deliberate choice rather than the path of least resistance.
 */
import type { Kysely, Transaction } from 'kysely';
import type { Database, EmploymentCategory } from '../../core/db/types.js';

export type Db = Kysely<Database> | Transaction<Database>;

export interface EngagementAudience {
  categories?: EmploymentCategory[] | undefined;
  departmentIds?: number[] | undefined;
  locationIds?: number[] | undefined;
}

/** Active employees an audience targets. */
function targetedEmployees(db: Db, audience: EngagementAudience | null) {
  let q = db
    .selectFrom('core.employees')
    .select(['id'])
    .where('status', 'in', ['active', 'on_notice']);
  if (audience?.categories && audience.categories.length > 0) {
    q = q.where('category', 'in', audience.categories);
  }
  if (audience?.departmentIds && audience.departmentIds.length > 0) {
    q = q.where('department_id', 'in', audience.departmentIds);
  }
  if (audience?.locationIds && audience.locationIds.length > 0) {
    q = q.where('location_id', 'in', audience.locationIds);
  }
  return q;
}

/** True when the audience (possibly empty = everyone) includes this user. */
export async function audienceIncludesUser(
  db: Db,
  audience: EngagementAudience | null,
  userId: number,
): Promise<boolean> {
  if (audience === null) return true;
  const user = await db
    .selectFrom('core.users')
    .select('employee_id')
    .where('id', '=', userId)
    .executeTakeFirst();
  // A login with no employee record is staff-only tooling, not an audience member.
  if (!user?.employee_id) return false;
  const hit = await targetedEmployees(db, audience)
    .where('id', '=', user.employee_id)
    .executeTakeFirst();
  return hit !== undefined;
}

/** JSONB `{}` (the column default) means "no filter", not "an empty filter". */
export function toAudience(value: unknown): EngagementAudience | null {
  if (value === null || typeof value !== 'object') return null;
  const a = value as EngagementAudience;
  return Object.keys(a).length === 0 ? null : a;
}
