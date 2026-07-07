/** All database access for the auth module — Kysely only, no SQL elsewhere. */
import type { Kysely, Selectable } from 'kysely';
import type { Database, UsersTable } from '../../core/db/types.js';

export type UserRow = Selectable<UsersTable>;

export function findUserByEmail(db: Kysely<Database>, email: string): Promise<UserRow | undefined> {
  return db.selectFrom('core.users').selectAll().where('email', '=', email).executeTakeFirst();
}

export function findUserById(db: Kysely<Database>, id: number): Promise<UserRow | undefined> {
  return db.selectFrom('core.users').selectAll().where('id', '=', id).executeTakeFirst();
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
  currentFails: number,
): Promise<{ fails: number; lockedUntil: Date | null }> {
  const fails = currentFails + 1;
  let lockedUntil: Date | null = null;
  if (fails >= 5) {
    const minutes = Math.min(15 * 2 ** (fails - 5), 120);
    lockedUntil = new Date(Date.now() + minutes * 60_000);
  }
  await db
    .updateTable('core.users')
    .set({ failed_attempts: fails, locked_until: lockedUntil })
    .where('id', '=', userId)
    .execute();
  return { fails, lockedUntil };
}
