/** LC-01/NFR-03: authenticated source consent creates only one separate prejoin record. */
import { randomUUID } from 'node:crypto';
import { SignJWT } from 'jose';
import { beforeAll, afterAll, afterEach, describe, it, expect, vi } from 'vitest';
import { sql, type Kysely, type Transaction } from 'kysely';
import type { Database } from '../src/core/db/types.js';
import { createDatabase } from '../src/core/db/database.js';
import { createApp } from '../src/app.js';
import { httpRequest } from './http-client.js';
import { receiveAcceptedOffer } from '../src/modules/ats-bridge/service.js';
import { acceptanceDigest, type AcceptedOffer } from '../src/modules/ats-bridge/contract.js';
const url = process.env['DATABASE_URL'];
const rollback = new Error('Intentional ATS bridge rollback');
const secret = 'synthetic-ats-bridge-secret-for-contract-tests';
describe.skipIf(!url)('ATS accepted LOI bridge (native PostgreSQL)', () => {
  let db: Kysely<Database>;
  beforeAll(() => {
    db = createDatabase(url ?? '');
  });
  afterAll(async () => {
    await db.destroy();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });
  async function fixture(run: (tx: Transaction<Database>, input: AcceptedOffer) => Promise<void>) {
    try {
      await db.transaction().execute(async (tx) => {
        const tag = 'ats_' + randomUUID().slice(0, 8);
        const company = await tx
          .insertInto('core.companies')
          .values({ code: tag, name: tag, ecode_prefix: tag, is_india_payroll: false })
          .returning('id')
          .executeTakeFirstOrThrow();
        for (const [key, value, value_type] of [
          ['integration.ats.company_ids', JSON.stringify([company.id]), 'json'],
          ['integration.ats.assertion_max_seconds', '120', 'number'],
          ['lifecycle.prejoin_token_hours', '72', 'number'],
        ] as const)
          await tx
            .insertInto('core.settings')
            .values({ key, value, value_type, description: 'Synthetic ATS bridge setting' })
            .onConflict((oc) => oc.column('key').doUpdateSet({ value, value_type }))
            .execute();
        const account = await tx
          .insertInto('core.users')
          .values({
            email: tag + '-client@hrms.invalid',
            password_hash: '!disabled!',
            is_active: true,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        const role = await tx
          .selectFrom('core.roles')
          .select('id')
          .where('code', '=', 'super_admin')
          .executeTakeFirstOrThrow();
        await tx
          .insertInto('core.user_roles')
          .values({ user_id: account.id, role_id: role.id })
          .execute();
        await tx
          .insertInto('core.settings')
          .values({
            key: 'integration.ats.service_user_id',
            value: JSON.stringify(account.id),
            value_type: 'number',
            description: 'Synthetic rollback-only service account',
          })
          .onConflict((oc) => oc.column('key').doUpdateSet({ value: JSON.stringify(account.id) }))
          .execute();
        const input: AcceptedOffer = {
          eventId: randomUUID(),
          offerId: company.id,
          candidateId: company.id + 1,
          acceptedBySubject: '123',
          acceptedAt: '1998-09-01T10:00:00+05:30',
          evidenceRef: 'Synthetic consent reference',
          companyId: company.id,
          fullName: 'Synthetic Accepted Candidate',
          personalEmail: tag + '@hrms.invalid',
          mobile: '9000000000',
          positionTitle: 'Synthetic position',
          offeredCtc: '120000.00',
          probationMonths: 6,
          probationSalaryPct: 80,
          proposedDoj: '1998-09-30',
          offerDate: '1998-09-01',
        };
        await run(tx, input);
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  }
  async function signed(
    input: AcceptedOffer,
    key = secret,
    audience = 'hrms:onboarding',
    expiry = '60s',
  ) {
    return new SignJWT({ payloadHash: acceptanceDigest(input) })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('synthetic-ats')
      .setSubject('ats-onboarding')
      .setAudience(audience)
      .setIssuedAt()
      .setExpirationTime(expiry)
      .sign(new TextEncoder().encode(key));
  }
  function config() {
    vi.stubEnv('ATS_BRIDGE_ENABLED', 'true');
    vi.stubEnv('ATS_BRIDGE_ISSUER', 'synthetic-ats');
    vi.stubEnv('ATS_BRIDGE_SECRET', secret);
  }
  it('creates one prejoining candidate, immutable receipt and audit, with no employee or sequence allocation', async () =>
    fixture(async (tx, input) => {
      const first = await receiveAcceptedOffer(tx, input);
      const replay = await receiveAcceptedOffer(tx, input);
      expect(replay).toEqual({ candidateId: first.candidateId, created: false });
      expect(first.created).toBe(true);
      const candidate = await tx
        .selectFrom('core.onboarding_candidates')
        .selectAll()
        .where('id', '=', first.candidateId)
        .executeTakeFirstOrThrow();
      expect(candidate.employee_id).toBeNull();
      expect(candidate.status).toBe('awaiting_prejoin');
      expect(candidate.prejoin_link_token).toBeNull();
      expect(candidate.prejoin_link_sent_at).toBeNull();
      expect(candidate.offered_ctc).toBe('120000.00');
      expect(candidate.probation_salary_pct).toBe(80);
      expect(
        await tx
          .selectFrom('core.employees')
          .select('id')
          .where('company_id', '=', input.companyId)
          .execute(),
      ).toHaveLength(0);
      expect(
        (
          await tx
            .selectFrom('core.companies')
            .select('ecode_next_seq')
            .where('id', '=', input.companyId)
            .executeTakeFirstOrThrow()
        ).ecode_next_seq,
      ).toBe(1);
      expect(
        await tx
          .selectFrom('core.audit_log')
          .select('id')
          .where('entity', '=', 'core.onboarding_candidates')
          .where('entity_id', '=', first.candidateId)
          .where('action', '=', 'ats.acceptance_received')
          .execute(),
      ).toHaveLength(1);
      await sql`SAVEPOINT ats_immutable`.execute(tx);
      await expect(
        tx
          .updateTable('core.ats_acceptance_receipts')
          .set({ evidence_ref: 'Altered' })
          .where('event_id', '=', input.eventId)
          .execute(),
      ).rejects.toThrow(/append-only/);
      await sql`ROLLBACK TO SAVEPOINT ats_immutable`.execute(tx);
    }));
  it('rejects changed retries and a second event for the same accepted offer', async () =>
    fixture(async (tx, input) => {
      await receiveAcceptedOffer(tx, input);
      for (const changed of [
        { ...input, offeredCtc: '240000.00' },
        { ...input, eventId: randomUUID() },
        { ...input, evidenceRef: 'Different consent' },
      ])
        await expect(receiveAcceptedOffer(tx, changed)).rejects.toThrow(
          /different accepted snapshot/,
        );
    }));
  it('requires actual configured legal-entity authority and explicit valid accepted facts', async () =>
    fixture(async (tx, input) => {
      await expect(receiveAcceptedOffer(tx, { ...input, companyId: 2147483647 })).rejects.toThrow(
        /outside/,
      );
      await expect(receiveAcceptedOffer(tx, { ...input, offeredCtc: '0.00' })).rejects.toThrow(
        /positive/,
      );
      await expect(
        receiveAcceptedOffer(tx, { ...input, acceptedAt: '2999-01-01T00:00:00Z' }),
      ).rejects.toThrow(/future/);
      await expect(receiveAcceptedOffer(tx, { ...input, probationSalaryPct: 0 })).rejects.toThrow();
      expect(
        await tx
          .selectFrom('core.ats_acceptance_receipts')
          .select('event_id')
          .where('ats_offer_id', '=', input.offerId)
          .execute(),
      ).toHaveLength(0);
    }));
  it('fails closed when the ATS connection or entity mapping is absent', async () =>
    fixture(async (tx, input) => {
      const request = await httpRequest(
        createApp({ db: tx, jwtSecret: 'synthetic-local-key', secureCookies: false }),
      );
      vi.stubEnv('ATS_BRIDGE_ENABLED', 'false');
      expect((await request.post('/api/integrations/ats/accepted-offers').send(input)).status).toBe(
        503,
      );
      await tx
        .deleteFrom('core.settings')
        .where('key', '=', 'integration.ats.company_ids')
        .execute();
      await expect(receiveAcceptedOffer(tx, input)).rejects.toThrow(/not configured/);
    }));
  it('enforces signature, audience, lifetime and exact body binding through the mounted HTTP contract', async () =>
    fixture(async (tx, input) => {
      config();
      const request = await httpRequest(
        createApp({ db: tx, jwtSecret: 'synthetic-local-key', secureCookies: false }),
      );
      expect((await request.post('/api/integrations/ats/accepted-offers').send(input)).status).toBe(
        401,
      );
      for (const token of [
        await signed(input, 'wrong-synthetic-key'),
        await signed(input, secret, 'wrong-app'),
        await signed(input, secret, 'hrms:onboarding', '3600s'),
        await signed({ ...input, offeredCtc: '1.00' }),
      ])
        expect(
          (
            await request
              .post('/api/integrations/ats/accepted-offers')
              .auth(token, { type: 'bearer' })
              .send(input)
          ).status,
        ).toBe(401);
      const token = await signed(input);
      const response = await request
        .post('/api/integrations/ats/accepted-offers')
        .auth(token, { type: 'bearer' })
        .send(input);
      expect(response.status).toBe(200);
      const body = response.body as {
        success: boolean;
        data: { candidateId: number; created: boolean };
      };
      expect(body.success).toBe(true);
      expect(body.data.created).toBe(true);
      const principalSetting = await tx.selectFrom('core.settings').select('value').where('key','=','integration.ats.service_user_id').executeTakeFirstOrThrow();
      const receivedAudit = await tx.selectFrom('core.audit_log').select('actor_user_id').where('action','=','ats.acceptance_received').where('entity_id','=',body.data.candidateId).executeTakeFirstOrThrow();
      expect(receivedAudit.actor_user_id).toBe(Number(principalSetting.value));

      const again = await request
        .post('/api/integrations/ats/accepted-offers')
        .auth(token, { type: 'bearer' })
        .send(input);
      expect(again.status).toBe(200);
      expect((again.body as typeof body).data).toEqual({
        candidateId: body.data.candidateId,
        created: false,
      });
      expect(JSON.stringify(response.body)).not.toMatch(/rawToken|password|secret|ecode/);
    }));
  it('denies disabled, unconfigured or permission-revoked machine principals despite a valid signature', async () =>
    fixture(async (tx, input) => {
      config();
      const request = await httpRequest(
        createApp({ db: tx, jwtSecret: 'synthetic-local-key', secureCookies: false }),
      );
      const token = await signed(input);
      const send = () =>
        request
          .post('/api/integrations/ats/accepted-offers')
          .auth(token, { type: 'bearer' })
          .send(input);
      const setting = await tx
        .selectFrom('core.settings')
        .select('value')
        .where('key', '=', 'integration.ats.service_user_id')
        .executeTakeFirstOrThrow();
      const id = Number(setting.value);
      await tx.updateTable('core.users').set({ is_active: false }).where('id', '=', id).execute();
      expect((await send()).status).toBe(401);
      await tx.updateTable('core.users').set({ is_active: true }).where('id', '=', id).execute();
      await tx.deleteFrom('core.user_roles').where('user_id', '=', id).execute();
      expect((await send()).status).toBe(403);
      await tx
        .deleteFrom('core.settings')
        .where('key', '=', 'integration.ats.service_user_id')
        .execute();
      expect((await send()).status).toBe(503);
      expect(
        await tx
          .selectFrom('core.ats_acceptance_receipts')
          .select('event_id')
          .where('ats_offer_id', '=', input.offerId)
          .execute(),
      ).toHaveLength(0);
    }));
  it('rolls back intake when prejoin issuance configuration is missing', async () =>
    fixture(async (tx, input) => {
      await tx
        .deleteFrom('core.settings')
        .where('key', '=', 'lifecycle.prejoin_token_hours')
        .execute();
      await expect(receiveAcceptedOffer(tx, input)).rejects.toThrow(/lifetime/);
      expect(
        await tx
          .selectFrom('core.onboarding_candidates')
          .select('id')
          .where('company_id', '=', input.companyId)
          .execute(),
      ).toHaveLength(0);
      expect(
        await tx
          .selectFrom('core.ats_acceptance_receipts')
          .select('event_id')
          .where('event_id', '=', input.eventId)
          .execute(),
      ).toHaveLength(0);
    }));
});
