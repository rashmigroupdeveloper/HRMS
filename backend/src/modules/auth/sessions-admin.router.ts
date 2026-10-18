/**
 * Sessions view & revoke (handover item 6; docs/08 it_admin "force logout").
 * IT admin sees live sessions and revokes one (or all of a user's); revocation
 * takes effect on the next request because a session is a row. Everyone can
 * see and end their own sessions. Audited; holders of higher roles are protected.
 */
import { sql } from 'kysely';
import { z } from 'zod';
import { authed, withPermission } from '../../api/orpc.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { NotFoundError } from '../../core/errors/index.js';
import { assertManageable } from './auth.router.js';

const sessionRow = z.object({
  id: z.number(), userId: z.number(), email: z.string(), name: z.string().nullable(), ip: z.string().nullable(),
  userAgent: z.string().nullable(), createdAt: z.string(), lastSeenAt: z.string(), expiresAt: z.string(), current: z.boolean(),
});

type Db = Parameters<typeof writeAudit>[0];
async function liveSessions(db: Db, filter: { userId?: number | undefined; q?: string | undefined; limit: number }, currentSid: string | null) {
  const rows = await db.selectFrom('sec.sessions as s').innerJoin('core.users as u', 'u.id', 's.user_id')
    .leftJoin('core.employees as e', 'e.id', 'u.employee_id')
    .select(['s.id', 's.sid', 's.user_id', 'u.email', 'e.first_name', 'e.last_name', 's.ip', 's.user_agent', 's.created_at', 's.last_seen_at', 's.expires_at'])
    .where('s.revoked_at', 'is', null).where('s.expires_at', '>', new Date())
    .$if(filter.userId !== undefined, (q) => q.where('s.user_id', '=', filter.userId ?? 0))
    .$if(filter.q !== undefined && filter.q !== '', (q) => q.where(sql<boolean>`u.email ILIKE ${`%${filter.q ?? ''}%`}`))
    .orderBy('s.last_seen_at', 'desc').limit(filter.limit).execute();
  const iso = (d: unknown) => new Date(d as string).toISOString();
  return rows.map((r) => ({
    id: r.id, userId: r.user_id, email: r.email, name: [r.first_name, r.last_name].filter(Boolean).join(' ') || null,
    ip: r.ip, userAgent: r.user_agent, createdAt: iso(r.created_at), lastSeenAt: iso(r.last_seen_at), expiresAt: iso(r.expires_at),
    current: currentSid !== null && r.sid === currentSid,
  }));
}

async function revoke(db: Db, ids: number[], actorUserId: number, reason: string, ip: string | null): Promise<number> {
  if (ids.length === 0) return 0;
  const done = await db.updateTable('sec.sessions').set({ revoked_at: new Date(), revoked_by_user_id: actorUserId, revoke_reason: reason })
    .where('id', 'in', ids).where('revoked_at', 'is', null).returning('id').execute();
  for (const r of done) await writeAudit(db, { actorUserId, action: 'session_revoked', entity: 'sec.sessions', entityId: r.id, newValue: reason, ip });
  return done.length;
}

function currentSid(context: { sessionSid: string | null }): string | null {
  return context.sessionSid;
}

export const sessionsRouter = {
  list: withPermission('admin.users')
    .route({ method: 'GET', path: '/auth/sessions', summary: 'Live sessions (IT admin)' })
    .input(z.object({ userId: z.coerce.number().int().positive().optional(), q: z.string().max(100).optional(), limit: z.coerce.number().int().min(1).max(500).default(200) }))
    .output(z.array(sessionRow))
    .handler(({ input, context }) => liveSessions(context.db, input, currentSid(context))),
  revoke: withPermission('admin.users')
    .route({ method: 'POST', path: '/auth/sessions/{id}/revoke', summary: 'Force-logout one session (audited)' })
    .input(z.object({ id: z.coerce.number().int().positive() }))
    .output(z.object({ revoked: z.number() }))
    .handler(async ({ input, context }) => {
      const s = await context.db.selectFrom('sec.sessions').select(['id', 'user_id']).where('id', '=', input.id).executeTakeFirst();
      if (!s) throw new NotFoundError('Session not found');
      await assertManageable(context.db, context.user.id, s.user_id);
      return { revoked: await revoke(context.db, [s.id], context.user.id, 'admin_revoke', context.req.ip ?? null) };
    }),
  revokeUser: withPermission('admin.users')
    .route({ method: 'POST', path: '/auth/users/{userId}/sessions/revoke', summary: 'Force-logout every session of a user (audited)' })
    .input(z.object({ userId: z.coerce.number().int().positive() }))
    .output(z.object({ revoked: z.number() }))
    .handler(async ({ input, context }) => {
      await assertManageable(context.db, context.user.id, input.userId);
      const ids = (await liveSessions(context.db, { userId: input.userId, limit: 1000 }, null)).map((s) => s.id);
      return { revoked: await revoke(context.db, ids, context.user.id, 'admin_revoke_all', context.req.ip ?? null) };
    }),
  mine: authed
    .route({ method: 'GET', path: '/auth/sessions/mine', summary: 'My signed-in devices' })
    .output(z.array(sessionRow))
    .handler(({ context }) => liveSessions(context.db, { userId: context.user.id, limit: 100 }, currentSid(context))),
  revokeMine: authed
    .route({ method: 'POST', path: '/auth/sessions/mine/{id}/revoke', summary: 'Sign out one of my devices' })
    .input(z.object({ id: z.coerce.number().int().positive() }))
    .output(z.object({ revoked: z.number() }))
    .handler(async ({ input, context }) => {
      const s = await context.db.selectFrom('sec.sessions').select('id').where('id', '=', input.id).where('user_id', '=', context.user.id).executeTakeFirst();
      if (!s) throw new NotFoundError('Session not found');
      return { revoked: await revoke(context.db, [s.id], context.user.id, 'self_revoke', context.req.ip ?? null) };
    }),
};
