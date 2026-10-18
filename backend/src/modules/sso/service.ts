/** D4/NFR-03: explicit links; one-use PKCE grants bound to a live canonical session. */
import { randomBytes, createHash, randomUUID } from 'node:crypto';
import { SignJWT } from 'jose';
import { ORPCError } from '@orpc/server';
import { z } from 'zod';
import type { Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { getUserPermissions } from '../../core/rbac/permissions.service.js';
import { inTransaction } from '../../core/db/database.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { getTypedSetting } from '../settings/index.js';
import { codeHash, ssoConfig } from './config.js';
const denied = () =>
  new ORPCError('UNAUTHORIZED', {
    message: 'The connected account or canonical session is unavailable',
  });
async function lifetime(db: Kysely<Database>) {
  const value = await getTypedSetting<number | null>(
    db,
    'auth.sso_code_ttl_seconds',
    'number',
    null,
  );
  if (value === null || !Number.isSafeInteger(value) || value <= 0)
    throw new ORPCError('SERVICE_UNAVAILABLE', {
      message: 'Connected sign-in lifetime is not configured',
    });
  return value;
}
async function liveLink(db: Kysely<Database>, linkId: number, sid: string, lockSession = false) {
  const link = await db
    .selectFrom('sec.app_links')
    .selectAll()
    .where('id', '=', linkId)
    .executeTakeFirst();
  if (!link) throw denied();
  // Match canonical auth's account-first lock order. No role claims cross apps.
  const user = await db
    .selectFrom('core.users')
    .select(['id', 'is_active'])
    .where('id', '=', link.user_id)
    .forShare()
    .executeTakeFirst();
  const current = await db
    .selectFrom('sec.app_links')
    .selectAll()
    .where('id', '=', link.id)
    .where('is_active', '=', true)
    .forShare()
    .executeTakeFirst();
  const sessionQuery = db
    .selectFrom('sec.sessions')
    .select(['id', 'sid', 'expires_at'])
    .where('sid', '=', sid)
    .where('user_id', '=', link.user_id)
    .where('revoked_at', 'is', null)
    .where('expires_at', '>', new Date());
  const session = await (
    lockSession ? sessionQuery.forUpdate() : sessionQuery.forShare()
  ).executeTakeFirst();
  if (
    !user?.is_active ||
    !current ||
    !session ||
    current.client_id !== ssoConfig().id ||
    !(await getUserPermissions(db, user.id)).has('auth.sso')
  )
    throw denied();
  return { link: current, session };
}
export async function connectedStatus(db: Kysely<Database>, userId: number) {
  let config;
  try {
    config = ssoConfig();
  } catch {
    return { configured: false, linked: false, startUrl: null };
  }
  const link = await db
    .selectFrom('sec.app_links')
    .select('id')
    .where('user_id', '=', userId)
    .where('client_id', '=', config.id)
    .where('is_active', '=', true)
    .executeTakeFirst();
  return { configured: true, linked: !!link, startUrl: link ? config.startUrl : null };
}
export async function linkAccount(
  db: Kysely<Database>,
  input: { userId: number; externalSubject: string; reason: string },
  actor: number,
) {
  const config = ssoConfig();
  const response = await fetch(config.accountUrl, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + config.secret, 'Content-Type': 'application/json' },
    body: JSON.stringify({ subject: input.externalSubject }),
    redirect: 'error',
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok)
    throw new ORPCError('BAD_REQUEST', { message: 'The ATS account could not be verified' });
  const external = z
    .object({
      subject: z.string(),
      email: z.string().email(),
      employeeCode: z.string().nullable(),
      active: z.literal(true),
    })
    .parse(await response.json());
  if (external.subject !== input.externalSubject)
    throw new ORPCError('BAD_REQUEST', { message: 'ATS account verification mismatch' });
  return inTransaction(db, async (tx) => {
    const user = await tx
      .selectFrom('core.users')
      .select(['id', 'email', 'employee_id', 'is_active'])
      .where('id', '=', input.userId)
      .forUpdate()
      .executeTakeFirst();
    if (!user?.is_active || user.email.trim().toLowerCase() !== external.email.trim().toLowerCase())
      throw new ORPCError('BAD_REQUEST', {
        message: 'Verify that both active accounts belong to the same person',
      });
    if (user.employee_id !== null) {
      const employee = await tx
        .selectFrom('core.employees')
        .select('ecode')
        .where('id', '=', user.employee_id)
        .executeTakeFirst();
      if (employee?.ecode !== external.employeeCode)
        throw new ORPCError('BAD_REQUEST', {
          message: 'Employee codes do not match across the verified accounts',
        });
    }
    const prior = await tx
      .selectFrom('sec.app_links')
      .selectAll()
      .where('client_id', '=', config.id)
      .where((eb) =>
        eb.or([eb('user_id', '=', user.id), eb('external_subject', '=', external.subject)]),
      )
      .forUpdate()
      .executeTakeFirst();
    if (prior && (prior.user_id !== user.id || prior.external_subject !== external.subject))
      throw new ORPCError('CONFLICT', {
        message: 'An account already has a different explicit link',
      });
    if (prior?.is_active) return { id: prior.id };
    const row = prior
      ? await tx
          .updateTable('sec.app_links')
          .set({ is_active: true, link_nonce: randomUUID() })
          .where('id', '=', prior.id)
          .returning('id')
          .executeTakeFirstOrThrow()
      : await tx
          .insertInto('sec.app_links')
          .values({
            user_id: user.id,
            client_id: config.id,
            external_subject: external.subject,
            created_by: actor,
            is_active: true,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
    await writeAudit(tx, {
      actorUserId: actor,
      action: 'sso.account_linked',
      entity: 'sec.app_links',
      entityId: row.id,
      newValue: JSON.stringify({
        userId: user.id,
        clientId: config.id,
        externalSubject: external.subject,
        reason: input.reason,
      }),
    });
    return { id: row.id };
  });
}
export async function unlinkAccount(
  db: Kysely<Database>,
  linkId: number,
  actor: number,
  reason: string,
) {
  return inTransaction(db, async (tx) => {
    const row = await tx
      .updateTable('sec.app_links')
      .set({ is_active: false, link_nonce: randomUUID() })
      .where('id', '=', linkId)
      .returning('id')
      .executeTakeFirst();
    if (!row) throw new ORPCError('NOT_FOUND', { message: 'Connected account not found' });
    await writeAudit(tx, {
      actorUserId: actor,
      action: 'sso.account_unlinked',
      entity: 'sec.app_links',
      entityId: row.id,
      newValue: reason,
    });
    return { success: true as const };
  });
}
export async function authorize(
  db: Kysely<Database>,
  userId: number,
  sid: string,
  input: { clientId: string; redirectUri: string; challenge: string; state: string },
) {
  const config = ssoConfig();
  if (input.clientId !== config.id || input.redirectUri !== config.callback)
    throw new ORPCError('BAD_REQUEST', { message: 'Unregistered connected application callback' });
  return inTransaction(db, async (tx) => {
    const link = await tx
      .selectFrom('sec.app_links')
      .select('id')
      .where('user_id', '=', userId)
      .where('client_id', '=', config.id)
      .where('is_active', '=', true)
      .executeTakeFirst();
    if (!link) throw denied();
    const live = await liveLink(tx, link.id, sid);
    const raw = randomBytes(32).toString('base64url');
    const expires = new Date(
      Math.min(Date.now() + (await lifetime(tx)) * 1000, live.session.expires_at.getTime()),
    );
    await tx
      .insertInto('sec.sso_grants')
      .values({
        code_hash: codeHash(raw),
        link_id: link.id,
        link_nonce: live.link.link_nonce,
        session_sid: sid,
        redirect_uri: config.callback,
        challenge: input.challenge,
        expires_at: expires,
      })
      .execute();
    const redirect = new URL(config.callback);
    redirect.searchParams.set('code', raw);
    redirect.searchParams.set('state', input.state);
    return { redirectUrl: redirect.href };
  });
}
export async function redeem(
  db: Kysely<Database>,
  input: { code: string; clientId: string; redirectUri: string; verifier: string },
) {
  const config = ssoConfig();
  if (input.clientId !== config.id || input.redirectUri !== config.callback) throw denied();
  return inTransaction(db, async (tx) => {
    const known = await tx
      .selectFrom('sec.sso_grants')
      .select(['link_id', 'session_sid'])
      .where('code_hash', '=', codeHash(input.code))
      .executeTakeFirst();
    if (!known) throw denied();
    const live = await liveLink(tx, known.link_id, known.session_sid);
    const grant = await tx
      .selectFrom('sec.sso_grants')
      .selectAll()
      .where('code_hash', '=', codeHash(input.code))
      .where('consumed_at', 'is', null)
      .where('expires_at', '>', new Date())
      .forUpdate()
      .executeTakeFirst();
    if (
      grant?.link_nonce !== live.link.link_nonce ||
      grant.redirect_uri !== input.redirectUri ||
      grant.challenge !== createHash('sha256').update(input.verifier).digest('base64url')
    )
      throw denied();
    await tx
      .updateTable('sec.sso_grants')
      .set({ consumed_at: new Date() })
      .where('id', '=', grant.id)
      .execute();
    const assertion = await new SignJWT({
      hrmsSession: live.session.sid,
      linkId: live.link.id,
      linkNonce: live.link.link_nonce,
      sessionExpiresAt: live.session.expires_at.toISOString(),
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(config.issuer)
      .setAudience(config.id)
      .setSubject(live.link.external_subject)
      .setIssuedAt()
      .setExpirationTime(
        Math.min(
          Math.floor(grant.expires_at.getTime() / 1000),
          Math.floor(live.session.expires_at.getTime() / 1000),
        ),
      )
      .sign(new TextEncoder().encode(config.secret));
    await writeAudit(tx, {
      actorUserId: live.link.user_id,
      action: 'sso.grant_redeemed',
      entity: 'sec.sso_grants',
      entityId: grant.id,
      newValue: 'One-use grant consumed by the registered ATS client',
    });
    return { assertion };
  });
}
export async function introspect(
  db: Kysely<Database>,
  linkId: number,
  sid: string,
  linkNonce: string,
) {
  try {
    return await inTransaction(db, async (tx) => {
      const live = await liveLink(tx, linkId, sid);
      if (live.link.link_nonce !== linkNonce) return { active: false, subject: null };
      return { active: true, subject: live.link.external_subject };
    });
  } catch (cause) {
    if (cause instanceof ORPCError && cause.code === 'UNAUTHORIZED')
      return { active: false, subject: null };
    throw cause;
  }
}

export async function revokeConnectedSession(
  db: Kysely<Database>,
  linkId: number,
  sid: string,
  linkNonce: string,
) {
  return inTransaction(db, async (tx) => {
    const live = await liveLink(tx, linkId, sid, true);
    if (live.link.link_nonce !== linkNonce) throw denied();
    await tx
      .updateTable('sec.sessions')
      .set({
        revoked_at: new Date(),
        revoked_by_user_id: live.link.user_id,
        revoke_reason: 'connected_ats_logout',
      })
      .where('sid', '=', sid)
      .execute();
    await writeAudit(tx, {
      actorUserId: live.link.user_id,
      action: 'logout',
      entity: 'sec.sessions',
      entityId: live.session.id,
      newValue: 'Current canonical session revoked through linked ATS sign-out',
    });
    return { success: true as const };
  });
}

export async function searchExternalAccounts(query: string) {
  const config = ssoConfig();
  const response = await fetch(config.accountUrl, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + config.secret, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
    redirect: 'error',
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok)
    throw new ORPCError('SERVICE_UNAVAILABLE', { message: 'ATS account search is unavailable' });
  return z
    .object({
      accounts: z.array(
        z.object({
          subject: z.string(),
          name: z.string(),
          email: z.string().email(),
          employeeCode: z.string().nullable(),
        }),
      ),
    })
    .parse(await response.json());
}
