/** D4/NFR-03/CORE-10: explicit identities, exact callbacks, PKCE, one-use codes and live parent authority. */
import { createHash, randomUUID } from 'node:crypto';
import { beforeAll, afterAll, afterEach, describe, it, expect, vi } from 'vitest';
import { sql, type Kysely, type Transaction } from 'kysely';
import { jwtVerify } from 'jose';
import type { Database } from '../src/core/db/types.js';
import { createDatabase } from '../src/core/db/database.js';
import {
  authorize,
  redeem,
  introspect,
  linkAccount,
  unlinkAccount,
} from '../src/modules/sso/service.js';
import { codeHash } from '../src/modules/sso/config.js';
const url = process.env['DATABASE_URL'];
const rollback = new Error('Intentional SSO fixture rollback');
const key = 'synthetic-sso-client-key-at-least-32-characters';
const callback = 'http://127.0.0.1:5101/api/hrms/sso/callback';
const verifier = 'a'.repeat(43);
const challenge = createHash('sha256').update(verifier).digest('base64url');
function config(id = 'synthetic-ats') {
  for (const [name, value] of Object.entries({
    SSO_ENABLED: 'true',
    SSO_ATS_CLIENT_ID: id,
    SSO_ATS_CLIENT_SECRET: key,
    SSO_ATS_REDIRECT_URI: callback,
    SSO_ISSUER: 'http://127.0.0.1:5173',
    SSO_ATS_ACCOUNT_URL: 'http://127.0.0.1:5101/api/hrms/sso/account',
    SSO_ATS_START_URL: 'http://127.0.0.1:5101/api/hrms/sso/start',
  }))
    vi.stubEnv(name, value);
}
const request = {
  clientId: 'synthetic-ats',
  redirectUri: callback,
  challenge,
  state: 's'.repeat(43),
};
describe.skipIf(!url)('Linked ATS canonical-session boundary (native PostgreSQL)', () => {
  let db: Kysely<Database>;
  beforeAll(() => {
    db = createDatabase(url ?? '');
  });
  afterAll(async () => {
    await db.destroy();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
  async function fixture(
    run: (
      tx: Transaction<Database>,
      userId: number,
      sid: string,
      linkId: number,
      nonce: string,
    ) => Promise<void>,
  ) {
    config();
    try {
      await db.transaction().execute(async (tx) => {
        const tag = randomUUID();
        const user = await tx
          .insertInto('core.users')
          .values({ email: tag + '@hrms.invalid', password_hash: '!disabled!', is_active: true })
          .returning('id')
          .executeTakeFirstOrThrow();
        const role = await tx
          .selectFrom('core.roles')
          .select('id')
          .where('code', '=', 'employee')
          .executeTakeFirstOrThrow();
        await tx
          .insertInto('core.user_roles')
          .values({ user_id: user.id, role_id: role.id })
          .execute();
        const session = await tx
          .insertInto('sec.sessions')
          .values({ user_id: user.id, expires_at: new Date(Date.now() + 3600_000) })
          .returning('sid')
          .executeTakeFirstOrThrow();
        const link = await tx
          .insertInto('sec.app_links')
          .values({
            user_id: user.id,
            client_id: 'synthetic-ats',
            external_subject: '321',
            created_by: user.id,
          })
          .returning(['id', 'link_nonce'])
          .executeTakeFirstOrThrow();
        await run(tx, user.id, session.sid, link.id, link.link_nonce);
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  }
  async function issue(tx: Transaction<Database>, userId: number, sid: string) {
    const result = await authorize(tx, userId, sid, request);
    const redirect = new URL(result.redirectUrl);
    expect(redirect.origin + redirect.pathname).toBe(callback);
    expect(redirect.searchParams.get('state')).toBe(request.state);
    const code = redirect.searchParams.get('code');
    if (!code) throw new Error('Missing issued code');
    return code;
  }
  const redemption = (code: string) => ({
    code,
    clientId: 'synthetic-ats',
    redirectUri: callback,
    verifier,
  });
  it('stores only a code digest and S256 challenge, then signs only the explicitly linked ATS identity', async () =>
    fixture(async (tx, user, sid, link, nonce) => {
      const code = await issue(tx, user, sid);
      const row = await tx
        .selectFrom('sec.sso_grants')
        .selectAll()
        .where('code_hash', '=', codeHash(code))
        .executeTakeFirstOrThrow();
      expect(row.code_hash).not.toBe(code);
      expect(row.challenge).toBe(challenge);
      expect(row.session_sid).toBe(sid);
      const result = await redeem(tx, redemption(code));
      const { payload } = await jwtVerify(result.assertion, new TextEncoder().encode(key), {
        issuer: 'http://127.0.0.1:5173',
        audience: 'synthetic-ats',
        algorithms: ['HS256'],
      });
      expect(payload.sub).toBe('321');
      expect(payload['hrmsSession']).toBe(sid);
      expect(payload['linkId']).toBe(link);
      expect(payload['linkNonce']).toBe(nonce);
      expect(payload).not.toHaveProperty('roles');
      await expect(redeem(tx, redemption(code))).rejects.toThrow(/unavailable/);
    }));
  it('rejects wrong client, callback and verifier without consuming a valid grant', async () =>
    fixture(async (tx, user, sid) => {
      await expect(
        authorize(tx, user, sid, { ...request, redirectUri: 'https://attacker.invalid/callback' }),
      ).rejects.toThrow(/Unregistered/);
      const code = await issue(tx, user, sid);
      for (const input of [
        { ...redemption(code), clientId: 'another-app' },
        { ...redemption(code), redirectUri: 'https://attacker.invalid/callback' },
        { ...redemption(code), verifier: 'b'.repeat(43) },
      ])
        await expect(redeem(tx, input)).rejects.toThrow(/unavailable/);
      expect((await redeem(tx, redemption(code))).assertion).toBeTruthy();
    }));
  it('denies unknown/inactive/unlinked identities rather than matching coincident numeric IDs', async () =>
    fixture(async (tx, user, sid, link) => {
      await tx
        .updateTable('sec.app_links')
        .set({ is_active: false, link_nonce: randomUUID() })
        .where('id', '=', link)
        .execute();
      await expect(issue(tx, user, sid)).rejects.toThrow(/unavailable/);
    }));
  it('rejects parent logout immediately at redemption and every later ATS introspection', async () =>
    fixture(async (tx, user, sid, link, nonce) => {
      const code = await issue(tx, user, sid);
      expect(await introspect(tx, link, sid, nonce)).toEqual({ active: true, subject: '321' });
      await tx
        .updateTable('sec.sessions')
        .set({ revoked_at: new Date(), revoke_reason: 'synthetic_logout' })
        .where('sid', '=', sid)
        .execute();
      await expect(redeem(tx, redemption(code))).rejects.toThrow(/unavailable/);
      expect(await introspect(tx, link, sid, nonce)).toEqual({ active: false, subject: null });
    }));
  it('does not revive old grants or ATS sessions after unlink and relink', async () =>
    fixture(async (tx, user, sid, link, nonce) => {
      const code = await issue(tx, user, sid);
      await unlinkAccount(tx, link, user, 'Synthetic unlink');
      await tx
        .updateTable('sec.app_links')
        .set({ is_active: true, link_nonce: randomUUID() })
        .where('id', '=', link)
        .execute();
      expect(await introspect(tx, link, sid, nonce)).toEqual({ active: false, subject: null });
      await expect(redeem(tx, redemption(code))).rejects.toThrow(/unavailable/);
    }));
  it('revokes canonical access when its runtime SSO permission is removed', async () =>
    fixture(async (tx, user, sid, link, nonce) => {
      const code = await issue(tx, user, sid);
      await tx.deleteFrom('core.user_roles').where('user_id', '=', user).execute();
      expect(await introspect(tx, link, sid, nonce)).toEqual({ active: false, subject: null });
      await expect(redeem(tx, redemption(code))).rejects.toThrow(/unavailable/);
    }));
  it('refuses inactive canonical accounts and wrong parent sessions', async () =>
    fixture(async (tx, user, sid, link, nonce) => {
      expect(await introspect(tx, link, randomUUID(), nonce)).toEqual({
        active: false,
        subject: null,
      });
      await tx.updateTable('core.users').set({ is_active: false }).where('id', '=', user).execute();
      await expect(issue(tx, user, sid)).rejects.toThrow(/unavailable/);
    }));
  it('provisions links only after verifying matching source account identity, with no extra roles', async () =>
    fixture(async (tx, user, _sid, link) => {
      const email = (
        await tx
          .selectFrom('core.users')
          .select('email')
          .where('id', '=', user)
          .executeTakeFirstOrThrow()
      ).email;
      const before = await tx
        .selectFrom('core.user_roles')
        .select(['user_id', 'role_id'])
        .where('user_id', '=', user)
        .execute();
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValue(
            new Response(
              JSON.stringify({ subject: '999', email, employeeCode: null, active: true }),
            ),
          ),
      );
      await expect(
        linkAccount(
          tx,
          { userId: user, externalSubject: '999', reason: 'Synthetic verified identity' },
          user,
        ),
      ).rejects.toThrow(/different explicit link/);
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              subject: '321',
              email: 'other@hrms.invalid',
              employeeCode: null,
              active: true,
            }),
          ),
        ),
      );
      await expect(
        linkAccount(
          tx,
          { userId: user, externalSubject: '321', reason: 'Synthetic mismatch' },
          user,
        ),
      ).rejects.toThrow(/same person/);
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValue(
            new Response(
              JSON.stringify({ subject: '321', email, employeeCode: null, active: true }),
            ),
          ),
      );
      expect(
        await linkAccount(
          tx,
          { userId: user, externalSubject: '321', reason: 'Synthetic verified identity' },
          user,
        ),
      ).toEqual({ id: link });
      expect(
        await tx
          .selectFrom('core.user_roles')
          .select(['user_id', 'role_id'])
          .where('user_id', '=', user)
          .execute(),
      ).toEqual(before);
    }));
  it('rejects an expired grant without consuming it', async () =>
    fixture(async (tx, _user, sid, link, nonce) => {
      const code = randomUUID().replaceAll('-', '') + 'expiredcode';
      await tx
        .insertInto('sec.sso_grants')
        .values({
          code_hash: codeHash(code),
          link_id: link,
          link_nonce: nonce,
          session_sid: sid,
          redirect_uri: callback,
          challenge,
          created_at: new Date(Date.now() - 120_000),
          expires_at: new Date(Date.now() - 60_000),
        })
        .execute();
      await expect(redeem(tx, redemption(code))).rejects.toThrow(/unavailable/);
      const row = await tx
        .selectFrom('sec.sso_grants')
        .select('consumed_at')
        .where('code_hash', '=', codeHash(code))
        .executeTakeFirstOrThrow();
      expect(row.consumed_at).toBeNull();
    }));

  it('allows exactly one of two independent transactions to redeem a grant', async () => {
    // Separate connections need a committed fixture. Retain the disabled audit parent;
    // no employee/profile is created and no audit row is ever deleted.
    const clientId = 'sso-race-' + randomUUID();
    config(clientId);
    const fixture = await db.transaction().execute(async (tx) => {
      const user = await tx
        .insertInto('core.users')
        .values({ email: clientId + '@hrms.invalid', password_hash: '!disabled!', is_active: true })
        .returning('id')
        .executeTakeFirstOrThrow();
      const role = await tx
        .selectFrom('core.roles')
        .select('id')
        .where('code', '=', 'employee')
        .executeTakeFirstOrThrow();
      await tx
        .insertInto('core.user_roles')
        .values({ user_id: user.id, role_id: role.id })
        .execute();
      const session = await tx
        .insertInto('sec.sessions')
        .values({ user_id: user.id, expires_at: new Date(Date.now() + 3600_000) })
        .returning('sid')
        .executeTakeFirstOrThrow();
      const link = await tx
        .insertInto('sec.app_links')
        .values({
          user_id: user.id,
          client_id: clientId,
          external_subject: '321',
          created_by: user.id,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      return { userId: user.id, sid: session.sid, linkId: link.id };
    });
    try {
      const result = await authorize(db, fixture.userId, fixture.sid, { ...request, clientId });
      const code = new URL(result.redirectUrl).searchParams.get('code');
      if (!code) throw new Error('Missing issued code');
      const input = { ...redemption(code), clientId };
      const results = await Promise.allSettled([redeem(db, input), redeem(db, input)]);
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
      const grant = await db
        .selectFrom('sec.sso_grants')
        .select('consumed_at')
        .where('code_hash', '=', codeHash(code))
        .executeTakeFirstOrThrow();
      expect(grant.consumed_at).toBeInstanceOf(Date);
    } finally {
      await db.transaction().execute(async (tx) => {
        await tx
          .updateTable('core.users')
          .set({ is_active: false })
          .where('id', '=', fixture.userId)
          .execute();
        await tx
          .updateTable('sec.app_links')
          .set({ is_active: false, link_nonce: randomUUID() })
          .where('id', '=', fixture.linkId)
          .execute();
        await tx
          .updateTable('sec.sessions')
          .set({ revoked_at: new Date(), revoke_reason: 'synthetic_sso_race_cleanup' })
          .where('sid', '=', fixture.sid)
          .execute();
        await tx.deleteFrom('core.user_roles').where('user_id', '=', fixture.userId).execute();
      });
    }
  });

  it('enforces immutable identities and code bindings at the database boundary', async () =>
    fixture(async (tx, user, sid, link) => {
      const code = await issue(tx, user, sid);
      await sql`SAVEPOINT sso_binding`.execute(tx);
      await expect(
        tx
          .updateTable('sec.app_links')
          .set({ external_subject: '999' })
          .where('id', '=', link)
          .execute(),
      ).rejects.toThrow(/immutable/);
      await sql`ROLLBACK TO SAVEPOINT sso_binding`.execute(tx);
      await expect(
        tx
          .updateTable('sec.sso_grants')
          .set({ challenge: 'x'.repeat(43) })
          .where('code_hash', '=', codeHash(code))
          .execute(),
      ).rejects.toThrow(/immutable/);
      await sql`ROLLBACK TO SAVEPOINT sso_binding`.execute(tx);
    }));
});
