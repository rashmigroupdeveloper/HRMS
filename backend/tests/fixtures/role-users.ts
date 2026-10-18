/** Shared integration helper: a user with one role (optionally org-unit scoped) and a live session token. */
import type { ControlledTransaction } from 'kysely';
import { signAccessToken } from '../../src/core/auth/jwt.js';
import type { Database } from '../../src/core/db/types.js';

export async function roleUser(
  tx: ControlledTransaction<Database>,
  p: { email: string; role: string; employeeId?: number | null; scopeOrgUnitId?: number | null; jwtSecret: string },
): Promise<{ userId: number; token: string }> {
  const u = await tx.insertInto('core.users').values({ email: p.email, password_hash: '!disabled!', employee_id: p.employeeId ?? null, is_active: true }).returning(['id', 'email']).executeTakeFirstOrThrow();
  const r = await tx.selectFrom('core.roles').select('id').where('code', '=', p.role).executeTakeFirstOrThrow();
  await tx.insertInto('core.user_roles').values({ user_id: u.id, role_id: r.id, scope_org_unit_id: p.scopeOrgUnitId ?? null }).execute();
  const s = await tx.insertInto('sec.sessions').values({ user_id: u.id, expires_at: new Date(Date.now() + 600000) }).returning('sid').executeTakeFirstOrThrow();
  return { userId: u.id, token: await signAccessToken(u.id, u.email, p.jwtSecret, s.sid) };
}
