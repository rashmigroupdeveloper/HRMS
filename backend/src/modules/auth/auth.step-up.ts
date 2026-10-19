/** SEC-04: password verification elevates only this live session. No MFA. */
import bcrypt from 'bcryptjs';
import type { Kysely } from 'kysely';
import { z } from 'zod';
import type { Database } from '../../core/db/types.js';
import { inTransaction } from '../../core/db/database.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { getTypedSetting } from '../settings/index.js';
import { readAuthPolicy } from './auth.policy.js';
import { findUserById, recordLoginFailure } from './auth.repository.js';
export async function verifyStepUp(
  db: Kysely<Database>,
  userId: number,
  sid: string | null,
  password: string,
  ip: string | null,
) {
  return inTransaction(db, async (tx) => {
    const user = await findUserById(tx, userId, true);
    if (!user?.is_active || !sid) return { ok: false as const };
    const now = new Date();
    const session = await tx
      .selectFrom('sec.sessions')
      .select(['id', 'expires_at'])
      .where('sid', '=', sid)
      .where('user_id', '=', userId)
      .where('revoked_at', 'is', null)
      .where('expires_at', '>', now)
      .forUpdate()
      .executeTakeFirst();
    if (!session) return { ok: false as const };
    if (user.locked_until && user.locked_until > now) return { ok: false as const };
    if (!(await bcrypt.compare(password, user.password_hash))) {
      await recordLoginFailure(tx, userId, await readAuthPolicy(tx));
      await writeAudit(tx, {
        actorUserId: userId,
        action: 'step_up_failed',
        entity: 'sec.sessions',
        entityId: session.id,
        ip,
      });
      return { ok: false as const };
    }
    const minutes = z
      .number()
      .int()
      .min(1)
      .max(60)
      .parse(await getTypedSetting(tx, 'sec.stepup_window_minutes', 'number', 10));
    const until = new Date(Math.min(Date.now() + minutes * 60_000, session.expires_at.getTime()));
    await tx
      .updateTable('core.users')
      .set({ failed_attempts: 0, locked_until: null })
      .where('id', '=', userId)
      .execute();
    await tx
      .updateTable('sec.sessions')
      .set({ stepped_up_at: now, stepped_up_until: until })
      .where('id', '=', session.id)
      .execute();
    await writeAudit(tx, {
      actorUserId: userId,
      action: 'step_up',
      entity: 'sec.sessions',
      entityId: session.id,
      ip,
    });
    return { ok: true as const, steppedUpUntil: until.toISOString() };
  });
}
