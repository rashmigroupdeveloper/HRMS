/** All database access for the auth module — Kysely only, no SQL elsewhere. */
import type { Kysely, Selectable } from 'kysely';
import type { Database, UsersTable } from '../../core/db/types.js';

export type UserRow = Selectable<UsersTable>;

/**
 * Login identifier = email OR employee e-code (doc 11 §0.1: everyone knows
 * their greytHR-style code `RML035384`; admins/service accounts use email).
 */
export function findUserByIdentifier(db: Kysely<Database>, identifier: string): Promise<UserRow | undefined> {
  if (identifier.includes('@')) {
    return db.selectFrom('core.users').selectAll().where('email', '=', identifier).executeTakeFirst();
  }
  return db
    .selectFrom('core.users as u')
    .innerJoin('core.employees as e', 'e.id', 'u.employee_id')
    .selectAll('u')
    .where('e.ecode', '=', identifier.toUpperCase())
    .executeTakeFirst();
}

export function findUserById(db: Kysely<Database>, id: number): Promise<UserRow | undefined> {
  return db.selectFrom('core.users').selectAll().where('id', '=', id).executeTakeFirst();
}

/**
 * CORE-01 heal: a login created by email can miss `employee_id` even when an
 * active employee with the same `work_email` exists. Attach only when the
 * employee is unused — never steal a link another account already holds.
 */
export async function findHealCandidateEmployeeId(
  db: Kysely<Database>,
  userId: number,
  email: string,
): Promise<number | undefined> {
  const row = await db
    .selectFrom('core.employees as e')
    .select('e.id')
    .where('e.work_email', '=', email)
    .where('e.status', 'in', ['active', 'on_notice', 'onboarding'])
    .where((eb) =>
      eb.not(
        eb.exists(
          eb
            .selectFrom('core.users as u')
            .select('u.id')
            .whereRef('u.employee_id', '=', 'e.id')
            .where('u.id', '!=', userId),
        ),
      ),
    )
    .executeTakeFirst();
  return row?.id;
}

export async function attachEmployeeToUser(
  db: Kysely<Database>,
  userId: number,
  employeeId: number,
): Promise<void> {
  await db
    .updateTable('core.users')
    .set({ employee_id: employeeId })
    .where('id', '=', userId)
    .where('employee_id', 'is', null)
    .execute();
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
