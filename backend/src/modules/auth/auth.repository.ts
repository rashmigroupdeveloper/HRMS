/** All database access for the auth module — Kysely only, no SQL elsewhere. */
import type { Kysely, Selectable } from 'kysely';
import type { AuthPolicy } from './auth.policy.js';
import type { Database, UsersTable } from '../../core/db/types.js';

export type UserRow = Selectable<UsersTable>;

/**
 * Login identifier = email OR employee e-code (doc 11 §0.1: everyone knows
 * their greytHR-style code `RML035384`; admins/service accounts use email).
 */
export function findUserByIdentifier(db: Kysely<Database>, identifier: string, lock = false): Promise<UserRow | undefined> {
  if (identifier.includes('@')) {
    return db.selectFrom('core.users').selectAll().where('email', '=', identifier).$if(lock, q => q.forUpdate()).executeTakeFirst();
  }
  return db
    .selectFrom('core.users as u')
    .innerJoin('core.employees as e', 'e.id', 'u.employee_id')
    .selectAll('u')
    .where('e.ecode', '=', identifier.toUpperCase())
    .$if(lock, q => q.forUpdate('u'))
    .executeTakeFirst();
}

export function findUserById(db: Kysely<Database>, id: number, lock = false): Promise<UserRow | undefined> {
  return db.selectFrom('core.users').selectAll().where('id', '=', id).$if(lock, q => q.forUpdate()).executeTakeFirst();
}

/** Reset the failure counter and stamp the login. */
export async function recordLoginSuccess(db: Kysely<Database>, userId: number): Promise<void> {
  await db
    .updateTable('core.users')
    .set({ failed_attempts: 0, locked_until: null, last_login_at: new Date() })
    .where('id', '=', userId)
    .execute();
}

/**
 * Increment the failure counter; from the 5th consecutive failure the account
 * locks with exponential backoff: 15 min → 30 → 60 → capped at 120 (NFR-03).
 * Returns the new state so the service can report it.
 */
export async function recordLoginFailure(
  db: Kysely<Database>,
  userId: number,
  policy: AuthPolicy,
): Promise<{ fails: number; lockedUntil: Date | null }> {
  if (!db.isTransaction) throw new Error('Login failure recording requires an account transaction');
  const current = await findUserById(db, userId, true);
  if (!current) throw new Error('Login account no longer exists');
  const fails = Math.min(current.failed_attempts + 1, 32767);
  let lockedUntil: Date | null = null;
  if (fails >= policy.failureThreshold) {
    const minutes = policy.lockBaseMinutes * 2 ** Math.min(fails - policy.failureThreshold, Math.log2(policy.lockMaxMinutes / policy.lockBaseMinutes));
    lockedUntil = new Date(Date.now() + minutes * 60_000);
  }
  await db
    .updateTable('core.users')
    .set({ failed_attempts: fails, locked_until: lockedUntil })
    .where('id', '=', userId)
    .execute();
  return { fails, lockedUntil };
}
