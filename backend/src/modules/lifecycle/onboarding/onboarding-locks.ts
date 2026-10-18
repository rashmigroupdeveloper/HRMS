/** CORE-02/LC-01: duplicate identities serialize even across legal entities. */
import { sql, type Kysely } from 'kysely';
import type { Database } from '../../../core/db/types.js';
export async function lockOnboardingIdentities(
  db: Kysely<Database>,
  email: string,
  mobile: string,
  pan?: string,
  workEmail?: string | null,
) {
  if (!db.isTransaction) throw new Error('Onboarding identity locks require a transaction');
  const identities = [`email:${email.trim().toLowerCase()}`, `mobile:${mobile.trim()}`];
  if (workEmail?.trim()) identities.push(`email:${workEmail.trim().toLowerCase()}`);
  if (pan?.trim()) identities.push(`pan:${pan.trim().toUpperCase()}`);
  for (const identity of [...new Set(identities)].sort()) {
    await sql`SELECT pg_advisory_xact_lock(hashtextextended(${'hrms:onboarding:' + identity}, 0))`.execute(
      db,
    );
  }
}
