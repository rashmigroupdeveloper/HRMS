/** SEC-04: hold the live session through the protected transaction. */
import { ORPCError } from '@orpc/server';
import type { Kysely } from 'kysely';
import type { Database } from '../db/types.js';
export async function assertStepUp(
  db: Kysely<Database>,
  userId: number,
  sid: string | null,
): Promise<void> {
  if (!db.isTransaction) throw new Error('Step-up validation requires a transaction');
  // SHARE blocks deactivation while allowing FK key-share locks when two
  // administrators concurrently assign roles to each other.
  const user = await db
    .selectFrom('core.users')
    .select('id')
    .where('id', '=', userId)
    .where('is_active', '=', true)
    .forShare()
    .executeTakeFirst();
  const session =
    sid && user
      ? await db
          .selectFrom('sec.sessions')
          .select('id')
          .where('sid', '=', sid)
          .where('user_id', '=', userId)
          .where('revoked_at', 'is', null)
          .where('expires_at', '>', new Date())
          .where('stepped_up_until', '>', new Date())
          .forUpdate()
          .executeTakeFirst()
      : undefined;
  if (!session)
    throw new ORPCError('FORBIDDEN', {
      message: 'Re-enter your password to change access permissions',
      data: { code: 'STEP_UP_REQUIRED' },
    });
}
