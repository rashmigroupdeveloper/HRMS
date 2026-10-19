/**
 * Stage 5.5 — POSH / grievance / whistleblower integration suite.
 *
 * Verifies:
 * 1. Honest empty IC listing (sponsor-awaiting banner, no invented members).
 * 2. Authenticated POSH filing.
 * 3. Non-handler access refusal (403).
 * 4. Assigned-case isolation:
 *    - Unassigned handler with ird.posh.handle CANNOT list or open the case (403, refusal log).
 *    - Explicitly assigned inquiry officer CAN list and open the case with step-up (200, opened log).
 * 5. Append-only access log immutability trigger.
 * 6. Anonymous POSH intake & claim-code tracking without disclosure.
 * 7. Grievance redressal filing and queues.
 * 8. Anonymous whistleblower intake & claim-code tracking.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import type { Database } from '../src/core/db/types.js';
import { createDatabase } from '../src/core/db/database.js';
import { createApp } from '../src/app.js';
import { hashPassword } from '../src/modules/auth/index.js';
import { signAccessToken } from '../src/core/auth/jwt.js';
import { assignPoshCase } from '../src/modules/ird/index.js';
import { httpRequest } from './http-client.js';

const url = process.env['DATABASE_URL'];

describe.skipIf(!url)('Stage 5.5 — POSH, grievance & whistleblower', () => {
  let db: Kysely<Database>;

  beforeAll(() => {
    db = createDatabase(url ?? '');
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('enforces honest IC banner, assigned-case isolation, access logging, and anonymous claim tokens', async () => {
    const rollback = new Error('Intentional IRD integration fixture rollback');

    try {
      await db.transaction().execute(async (tx) => {
        const stamp = Date.now();
        const tag = `ird_${String(stamp)}_${randomUUID().slice(0, 6)}`;
        const password = 'Kharagpur2026x!';
        const key = 'synthetic-ird-test-jwt-secret-min32chars!';
        const hashedPassword = await hashPassword(password);

        const company = await tx
          .selectFrom('core.companies')
          .select('id')
          .orderBy('id')
          .executeTakeFirstOrThrow();

        // Create 3 users:
        // 1. filer (ordinary employee)
        // 2. outsider (ordinary employee)
        // 3. handler (HR head holding ird.posh.handle, ird.grievance.handle, ird.whistle.intake)
        async function createUser(roleCode: string, suffix: string) {
          const ecode = `E${String(Date.now()).slice(-5)}${suffix}`;
          const email = `${tag}_${suffix}@hrms.invalid`;
          const employee = await tx
            .insertInto('core.employees')
            .values({
              ecode,
              company_id: company.id,
              first_name: `Test${suffix}`,
              last_name: 'IrdUser',
              status: 'active',
              doj: new Date('2020-01-01'),
            })
            .returning('id')
            .executeTakeFirstOrThrow();

          const user = await tx
            .insertInto('core.users')
            .values({
              email,
              password_hash: hashedPassword,
              employee_id: employee.id,
            })
            .returning('id')
            .executeTakeFirstOrThrow();

          const role = await tx
            .selectFrom('core.roles')
            .select('id')
            .where('code', '=', roleCode)
            .executeTakeFirstOrThrow();

          await tx
            .insertInto('core.user_roles')
            .values({ user_id: user.id, role_id: role.id })
            .execute();

          const session = await tx
            .insertInto('sec.sessions')
            .values({
              user_id: user.id,
              expires_at: new Date(Date.now() + 600_000),
              stepped_up_at: new Date(),
              stepped_up_until: new Date(Date.now() + 600_000),
            })
            .returning('sid')
            .executeTakeFirstOrThrow();

          const token = await signAccessToken(user.id, email, key, session.sid);
          return { userId: user.id, employeeId: employee.id, email, sid: session.sid, token };
        }

        const filer = await createUser('employee', 'filer');
        const outsider = await createUser('employee', 'outsider');
        const handler = await createUser('hr_head', 'handler');

        const request = await httpRequest(createApp({ db: tx, jwtSecret: key, secureCookies: false }));

        // 1. Honest empty IC listing
        const icRes = await request
          .get('/api/ird/ic')
          .auth(filer.token, { type: 'bearer' });
        expect(icRes.status).toBe(200);
        expect(icRes.body).toMatchObject({
          members: [],
          constituted: false,
          banner: 'IC not constituted — awaiting sponsor appointment',
        });

        // 2. Authenticated POSH complaint filing
        const fileRes = await request
          .post('/api/ird/posh/file')
          .auth(filer.token, { type: 'bearer' })
          .send({ summary: 'Workplace harassment incident report for access isolation test.' });
        expect(fileRes.status).toBe(200);
        const caseId = (fileRes.body as { id: number; caseRef: string }).id;
        const caseRef = (fileRes.body as { id: number; caseRef: string }).caseRef;
        expect(caseId).toBeGreaterThan(0);
        expect(caseRef).toMatch(/^POSH-\d{4}-\d{5}$/);

        // Filer can list their own filed complaints
        const myCasesRes = await request
          .get('/api/ird/posh/my-cases')
          .auth(filer.token, { type: 'bearer' });
        expect(myCasesRes.status).toBe(200);
        expect(myCasesRes.body).toMatchObject({
          cases: [expect.objectContaining({ id: caseId, caseRef })],
        });

        // 3. Outsider (without ird.posh.handle) gets 403 on open and list
        const outsiderOpenRes = await request
          .get(`/api/ird/posh/cases/${String(caseId)}`)
          .auth(outsider.token, { type: 'bearer' });
        expect(outsiderOpenRes.status).toBe(403);

        const outsiderListRes = await request
          .get('/api/ird/posh/cases')
          .auth(outsider.token, { type: 'bearer' });
        expect(outsiderListRes.status).toBe(403);

        // 4. Assigned-Case Isolation:
        // Handler user has ird.posh.handle + step-up, but is NOT assigned to this case.
        // Handler list-cases should return empty array (preventing general HR browsing)
        const unassignedListRes = await request
          .get('/api/ird/posh/cases')
          .auth(handler.token, { type: 'bearer' });
        expect(unassignedListRes.status).toBe(200);
        expect(unassignedListRes.body).toMatchObject({ cases: [] });

        // Handler open-case should be refused with 403 and write a refusal row
        const unassignedOpenRes = await request
          .get(`/api/ird/posh/cases/${String(caseId)}`)
          .auth(handler.token, { type: 'bearer' });
        expect(unassignedOpenRes.status).toBe(403);
        expect(JSON.stringify(unassignedOpenRes.body)).toMatch(/restricted to assigned inquiry officers/i);

        // Verify refusal was logged in append-only table
        const refusalLog = await tx
          .selectFrom('ird.posh_case_access_log')
          .selectAll()
          .where('case_id', '=', caseId)
          .where('actor_user_id', '=', handler.userId)
          .execute();
        expect(refusalLog).toHaveLength(1);
        expect(refusalLog[0]?.outcome).toBe('refused');

        // 5. Assign handler to the case
        await assignPoshCase(tx, {
          caseId,
          targetUserId: handler.userId,
          role: 'investigator',
          actorUserId: handler.userId,
          ip: '127.0.0.1',
        });

        // Handler now sees the case in their queue
        const assignedListRes = await request
          .get('/api/ird/posh/cases')
          .auth(handler.token, { type: 'bearer' });
        expect(assignedListRes.status).toBe(200);
        expect(assignedListRes.body).toMatchObject({
          cases: [expect.objectContaining({ id: caseId, caseRef })],
        });

        // Handler now successfully opens the case
        const assignedOpenRes = await request
          .get(`/api/ird/posh/cases/${String(caseId)}`)
          .auth(handler.token, { type: 'bearer' });
        expect(assignedOpenRes.status).toBe(200);
        expect(assignedOpenRes.body).toMatchObject({
          id: caseId,
          caseRef,
          summary: 'Workplace harassment incident report for access isolation test.',
        });

        // Verify opened outcome was logged
        const openedLog = await tx
          .selectFrom('ird.posh_case_access_log')
          .selectAll()
          .where('case_id', '=', caseId)
          .where('actor_user_id', '=', handler.userId)
          .where('outcome', '=', 'opened')
          .execute();
        expect(openedLog).toHaveLength(1);

        // 6. Append-Only Access Log trigger check (using savepoints to isolate aborted statements)
        await sql`SAVEPOINT sp_immutability_update`.execute(tx);
        await expect(
          sql`UPDATE ird.posh_case_access_log SET ip = 'malicious' WHERE id = ${openedLog[0]?.id}`.execute(tx),
        ).rejects.toThrow(/append-only/i);
        await sql`ROLLBACK TO SAVEPOINT sp_immutability_update`.execute(tx);

        await sql`SAVEPOINT sp_immutability_delete`.execute(tx);
        await expect(
          sql`DELETE FROM ird.posh_case_access_log WHERE id = ${openedLog[0]?.id}`.execute(tx),
        ).rejects.toThrow(/append-only/i);
        await sql`ROLLBACK TO SAVEPOINT sp_immutability_delete`.execute(tx);

        // 7. Anonymous POSH intake & claim token tracking
        const anonFileRes = await request
          .post('/api/ird/posh/file-anonymous')
          .send({ summary: 'Anonymous whistleblower incident from plant noticeboard QR.' });
        expect(anonFileRes.status).toBe(200);
        const anonBody = anonFileRes.body as { id: number; caseRef: string; claimToken: string };
        expect(anonBody.claimToken).toHaveLength(64);
        expect(anonBody.caseRef).toMatch(/^POSH-\d{4}-\d{5}$/);

        // Follow up with claim token
        const claimStatusRes = await request
          .post('/api/ird/posh/claim-status')
          .send({ claimToken: anonBody.claimToken });
        expect(claimStatusRes.status).toBe(200);
        expect(claimStatusRes.body).toMatchObject({
          caseRef: anonBody.caseRef,
          status: 'submitted',
        });
        // Check that summary is NOT disclosed in claim status
        expect((claimStatusRes.body as Record<string, unknown>)['summary']).toBeUndefined();

        // 8. Workplace Grievance
        const grvFileRes = await request
          .post('/api/ird/grievances/file')
          .auth(filer.token, { type: 'bearer' })
          .send({ summary: 'Workplace grievance regarding overtime calculation discrepancies.' });
        expect(grvFileRes.status).toBe(200);
        const grvRef = (grvFileRes.body as { id: number; caseRef: string }).caseRef;
        expect(grvRef).toMatch(/^GRV-\d{4}-\d{5}$/);

        // Filer checks their grievances
        const myGrvRes = await request
          .get('/api/ird/grievances/mine')
          .auth(filer.token, { type: 'bearer' });
        expect(myGrvRes.status).toBe(200);
        expect(myGrvRes.body).toMatchObject({
          grievances: [expect.objectContaining({ caseRef: grvRef })],
        });

        // HR handler checks grievance queue
        const hrGrvRes = await request
          .get('/api/ird/grievances')
          .auth(handler.token, { type: 'bearer' });
        expect(hrGrvRes.status).toBe(200);
        expect(hrGrvRes.body).toMatchObject({
          grievances: [expect.objectContaining({ caseRef: grvRef })],
        });

        // 9. Anonymous Whistleblower Report
        const whistleFileRes = await request
          .post('/api/ird/whistle/file')
          .send({ summary: 'Protected disclosure of vendor kickback in procurement.' });
        expect(whistleFileRes.status).toBe(200);
        const whistleToken = (whistleFileRes.body as { id: number; claimToken: string }).claimToken;
        expect(whistleToken).toHaveLength(64);

        // Check whistleblower claim status
        const whistleStatusRes = await request
          .post('/api/ird/whistle/claim-status')
          .send({ claimToken: whistleToken });
        expect(whistleStatusRes.status).toBe(200);
        expect(whistleStatusRes.body).toMatchObject({
          status: 'submitted',
        });

        // Triage handler checks reports
        const whistleReportsRes = await request
          .get('/api/ird/whistle/reports')
          .auth(handler.token, { type: 'bearer' });
        expect(whistleReportsRes.status).toBe(200);
        expect(whistleReportsRes.body).toMatchObject({
          reports: [expect.objectContaining({ summary: 'Protected disclosure of vendor kickback in procurement.' })],
        });

        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
