/**
 * Password change under policy (SEC-01).
 *
 * History is checked BEFORE the write and trimmed after, so `historyDepth` is
 * a true depth rather than an ever-growing table — which would also be a DPDP
 * retention problem.
 */
import bcrypt from 'bcryptjs';
import type { Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { getPasswordPolicy } from '../../core/auth/security-policy.js';
import { checkPassword, type PasswordViolation } from '../../core/auth/password-policy.js';

export type PasswordChangeResult =
  | { ok: true }
  | { ok: false; reason: 'policy'; violations: PasswordViolation[] }
  | { ok: false; reason: 'reused' }
  | { ok: false; reason: 'wrong_current' };

/**
 * Change a password under policy. History is checked BEFORE the write and
 * trimmed after, so `historyDepth` is a true depth rather than an ever-growing
 * table (which would also be a DPDP retention problem).
 */
export async function changePassword(
  db: Kysely<Database>,
  input: {
    userId: number;
    newPassword: string;
    actorUserId: number;
    identifiers: readonly string[];
    /** Omitted for an admin reset; required when a user changes their own. */
    currentPassword?: string;
  },
): Promise<PasswordChangeResult> {
  const policy = await getPasswordPolicy(db);

  const user = await db
    .selectFrom('core.users')
    .select(['id', 'password_hash'])
    .where('id', '=', input.userId)
    .executeTakeFirst();
  if (!user) return { ok: false, reason: 'wrong_current' };

  if (input.currentPassword !== undefined) {
    const valid = await bcrypt.compare(input.currentPassword, user.password_hash);
    if (!valid) return { ok: false, reason: 'wrong_current' };
  }

  const verdict = checkPassword(input.newPassword, policy, { identifiers: input.identifiers });
  if (!verdict.ok) return { ok: false, reason: 'policy', violations: verdict.violations };

  if (await isReused(db, input.userId, input.newPassword, user.password_hash, policy.historyDepth)) {
    return { ok: false, reason: 'reused' };
  }

  const hash = await bcrypt.hash(input.newPassword, 10);
  await db.transaction().execute(async (trx) => {
    await trx
      .updateTable('core.users')
      .set({ password_hash: hash, failed_attempts: 0, locked_until: null })
      .where('id', '=', input.userId)
      .execute();
    await trx
      .insertInto('sec.password_history')
      .values({
        user_id: input.userId,
        password_hash: hash,
        changed_by_user_id: input.actorUserId,
      })
      .execute();
  });

  await trimHistory(db, input.userId, policy.historyDepth);
  return { ok: true };
}

async function isReused(
  db: Kysely<Database>,
  userId: number,
  candidate: string,
  currentHash: string,
  depth: number,
): Promise<boolean> {
  if (await bcrypt.compare(candidate, currentHash)) return true;
  if (depth <= 0) return false;

  const history = await db
    .selectFrom('sec.password_history')
    .select('password_hash')
    .where('user_id', '=', userId)
    .orderBy('changed_at', 'desc')
    .limit(depth)
    .execute();

  for (const row of history) {
    // Sequential on purpose: bounded by historyDepth (5).
    if (await bcrypt.compare(candidate, row.password_hash)) return true;
  }
  return false;
}

async function trimHistory(db: Kysely<Database>, userId: number, depth: number): Promise<void> {
  const keep = await db
    .selectFrom('sec.password_history')
    .select('id')
    .where('user_id', '=', userId)
    .orderBy('changed_at', 'desc')
    .limit(Math.max(depth, 1))
    .execute();
  const keepIds = keep.map((r) => r.id);
  if (keepIds.length === 0) return;
  await db
    .deleteFrom('sec.password_history')
    .where('user_id', '=', userId)
    .where('id', 'not in', keepIds)
    .execute();
}
