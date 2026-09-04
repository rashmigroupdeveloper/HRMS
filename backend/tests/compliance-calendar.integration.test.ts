/**
 * Stage 5.7 — registrations, licences and the compliance calendar, end to end.
 *
 * The properties that matter, each as a live test:
 *   1. `overdue` is DERIVED, so a filing cannot look green anywhere while its
 *      due date has passed — and no nightly job has to stay alive for that.
 *   2. Marking something filed WITHOUT evidence is impossible; the filing and
 *      its challan are one transaction.
 *   3. A waiver demands a reason, and the database refuses one without it.
 *   4. Filing evidence is append-only — the people whose filings it evidences
 *      cannot rewrite it afterwards.
 *   5. These are statutory obligations, so IT cannot reach them.
 */
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { Kysely } from 'kysely';
import { createApp } from '../src/app.js';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import { addDaysIso, istDateString } from '../src/core/dates.js';
import { hashPassword } from '../src/modules/auth/index.js';

const DB_URL = process.env['DATABASE_URL'];
const JWT_SECRET = process.env['JWT_SECRET'] ?? 'integration-test-secret-at-least-32-chars!';
const run = describe.skipIf(!DB_URL);

interface LoginBody { accessToken: string }
interface RegistrationsBody {
  rows: {
    id: number;
    registrationNo: string;
    expiry: { state: string; daysRemaining: number | null; stage: number | null };
  }[];
}
interface CalendarBody {
  rows: { id: number; obligationCode: string; status: string; evidenceCount: number }[];
}
interface PostureBody {
  companies: { companyId: number; expired: number; expiring: number }[];
  overdueFilings: number;
}

/** YYYY-MM-DD, N days from today — the calendar deals in dates, not instants. */
/**
 * Fixture dates must be built on the SAME calendar the code under test uses.
 * `expiryState` measures days from IST midnight (compliance/expiry.ts
 * `atStartOfDay`, docs/01 NFR-09). Deriving fixtures from `new Date()` with UTC
 * getters made every assertion here off by one between 00:00 and 05:30 IST,
 * when the UTC date is still yesterday — a green suite by day, red at night.
 * `core/dates.ts` exists precisely so nobody hand-rolls this twice.
 */
function dayOffset(days: number): string {
  return addDaysIso(istDateString(), days);
}

run('Stage 5.7 — compliance registrations & calendar (live Postgres)', () => {
  let db: Kysely<Database>;
  let app: Express;

  const stamp = Date.now();
  const password = 'Kharagpur2026x';
  const hrEmail = `cmp-hr-${String(stamp)}@hrms.test`;
  const itEmail = `cmp-it-${String(stamp)}@hrms.test`;
  const code = `OBL${String(stamp).slice(-6)}`;
  let hrUserId: number;
  let itUserId: number;
  let companyId: number;
  let hrToken: string;
  let itToken: string;
  let overdueItemId: number;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function login(email: string): Promise<string> {
    const res = await request(app).post('/api/auth/login').send({ identifier: email, password });
    expect(res.status).toBe(200);
    return (res.body as LoginBody).accessToken;
  }

  beforeAll(async () => {
    db = createDatabase(DB_URL ?? '');
    app = createApp({ db, jwtSecret: JWT_SECRET, secureCookies: false });

    const company = await db
      .selectFrom('core.companies')
      .select('id')
      .orderBy('id')
      .executeTakeFirstOrThrow();
    companyId = company.id;

    const hash = await hashPassword(password);
    const hr = await db
      .insertInto('core.users')
      .values({ email: hrEmail, password_hash: hash })
      .returning('id')
      .executeTakeFirstOrThrow();
    hrUserId = hr.id;
    const it = await db
      .insertInto('core.users')
      .values({ email: itEmail, password_hash: hash })
      .returning('id')
      .executeTakeFirstOrThrow();
    itUserId = it.id;

    const roles = await db
      .selectFrom('core.roles')
      .select(['id', 'code'])
      .where('code', 'in', ['hr_head', 'it_admin'])
      .execute();
    for (const role of roles) {
      await db
        .insertInto('core.user_roles')
        .values({
          user_id: role.code === 'hr_head' ? hrUserId : itUserId,
          role_id: role.id,
        })
        .execute();
    }

    hrToken = await login(hrEmail);
    itToken = await login(itEmail);
  });

  afterAll(async () => {
    // Evidenced obligations are deliberately NOT cleaned up: `cmp.filing_evidence`
    // is append-only, so the FK makes a filed item undeletable — the same
    // property that stops a user with audit history being hard-deleted
    // (CLAUDE.md §6). Only unevidenced rows are removed; the rest carry a
    // unique stamp and are inert.
    await db
      .deleteFrom('cmp.calendar_items')
      .where('obligation_code', 'like', `${code}%`)
      .where((eb) =>
        eb.not(
          eb.exists(
            eb
              .selectFrom('cmp.filing_evidence as e')
              .select('e.id')
              .whereRef('e.calendar_item_id', '=', 'cmp.calendar_items.id'),
          ),
        ),
      )
      .execute();
    await db
      .deleteFrom('cmp.registrations')
      .where('registration_no', 'like', `CMP${String(stamp)}%`)
      .execute();
    await db.deleteFrom('sec.sessions').where('user_id', 'in', [hrUserId, itUserId]).execute();
    await db.deleteFrom('core.user_roles').where('user_id', 'in', [hrUserId, itUserId]).execute();
    await db.destroy();
  });

  /* ── Registrations & expiry ────────────────────────────────────────────── */

  it('records a perpetual registration and never marks it expiring', async () => {
    const created = await request(app)
      .post('/api/compliance/registrations')
      .set(auth(hrToken))
      .send({
        companyId,
        locationId: null,
        kind: 'pf',
        registrationNo: `CMP${String(stamp)}-PF`,
        issuingAuthority: 'EPFO',
        validFrom: dayOffset(-3000),
        validTo: null,
        renewalOwnerUserId: hrUserId,
        documentPath: null,
        notes: null,
      });
    expect(created.status).toBe(200);

    const list = await request(app)
      .get('/api/compliance/registrations')
      .query({ kind: 'pf' })
      .set(auth(hrToken));
    const row = (list.body as RegistrationsBody).rows.find(
      (r) => r.registrationNo === `CMP${String(stamp)}-PF`,
    );
    expect(row?.expiry.state).toBe('perpetual');
    expect(row?.expiry.daysRemaining).toBeNull();
  });

  it('flags a licence inside the alert ladder as expiring, with the tightest stage', async () => {
    await request(app)
      .post('/api/compliance/registrations')
      .set(auth(hrToken))
      .send({
        companyId,
        locationId: null,
        kind: 'factory_licence',
        registrationNo: `CMP${String(stamp)}-FAC`,
        issuingAuthority: 'Factories Inspectorate',
        validFrom: dayOffset(-300),
        validTo: dayOffset(20),
        renewalOwnerUserId: hrUserId,
        documentPath: null,
        notes: null,
      });

    const list = await request(app)
      .get('/api/compliance/registrations')
      .query({ needsAttentionOnly: true })
      .set(auth(hrToken));
    const row = (list.body as RegistrationsBody).rows.find(
      (r) => r.registrationNo === `CMP${String(stamp)}-FAC`,
    );
    expect(row?.expiry.state).toBe('expiring');
    expect(row?.expiry.stage).toBe(30);
    expect(row?.expiry.daysRemaining).toBe(20);
  });

  it('refuses a validity window that ends before it starts', async () => {
    const res = await request(app)
      .post('/api/compliance/registrations')
      .set(auth(hrToken))
      .send({
        companyId,
        locationId: null,
        kind: 'shops',
        registrationNo: `CMP${String(stamp)}-BAD`,
        issuingAuthority: null,
        validFrom: dayOffset(10),
        validTo: dayOffset(5),
        renewalOwnerUserId: null,
        documentPath: null,
        notes: null,
      });
    expect(res.status).toBe(400);
  });

  /* ── Calendar ──────────────────────────────────────────────────────────── */

  it('DERIVES overdue from the due date — nothing stores it', async () => {
    const created = await request(app)
      .post('/api/compliance/calendar')
      .set(auth(hrToken))
      .send({
        companyId,
        obligationCode: `${code}-ECR`,
        title: 'PF ECR upload',
        frequency: 'monthly',
        periodLabel: `T-${String(stamp)}`,
        dueOn: dayOffset(-5),
        ownerUserId: hrUserId,
        registrationId: null,
      });
    expect(created.status).toBe(200);
    overdueItemId = (created.body as { id: number }).id;

    // Stored status is still 'due' — the derivation happens on read.
    const stored = await db
      .selectFrom('cmp.calendar_items')
      .select('status')
      .where('id', '=', overdueItemId)
      .executeTakeFirstOrThrow();
    expect(stored.status).toBe('due');

    const list = await request(app).get('/api/compliance/calendar').set(auth(hrToken));
    const row = (list.body as CalendarBody).rows.find((r) => r.id === overdueItemId);
    expect(row?.status).toBe('overdue');
  });

  it('files an obligation and its evidence as ONE transaction', async () => {
    const filed = await request(app)
      .post('/api/compliance/calendar/file')
      .set(auth(hrToken))
      .send({
        itemId: overdueItemId,
        reference: `CHLN-${String(stamp)}`,
        documentPath: null,
        remark: 'Filed on the EPFO portal',
      });
    expect(filed.status).toBe(200);

    const list = await request(app)
      .get('/api/compliance/calendar')
      .query({ includeSettled: true })
      .set(auth(hrToken));
    const row = (list.body as CalendarBody).rows.find((r) => r.id === overdueItemId);
    expect(row?.status).toBe('filed');
    expect(row?.evidenceCount).toBe(1);
  });

  it('refuses to file the same obligation twice', async () => {
    const again = await request(app)
      .post('/api/compliance/calendar/file')
      .set(auth(hrToken))
      .send({ itemId: overdueItemId, reference: 'DUPLICATE', documentPath: null, remark: null });
    expect(again.status).toBe(409);
  });

  it('filing evidence is append-only at the DATABASE, not by convention', async () => {
    await expect(
      db
        .updateTable('cmp.filing_evidence')
        .set({ reference: 'rewritten' })
        .where('calendar_item_id', '=', overdueItemId)
        .execute(),
    ).rejects.toThrow(/append-only/i);

    await expect(
      db.deleteFrom('cmp.filing_evidence').where('calendar_item_id', '=', overdueItemId).execute(),
    ).rejects.toThrow(/append-only/i);
  });

  it('a waiver without a reason is refused; with one it is recorded separately', async () => {
    const created = await request(app)
      .post('/api/compliance/calendar')
      .set(auth(hrToken))
      .send({
        companyId,
        obligationCode: `${code}-LWF`,
        title: 'LWF remittance',
        frequency: 'half_yearly',
        periodLabel: `W-${String(stamp)}`,
        dueOn: dayOffset(3),
        ownerUserId: null,
        registrationId: null,
      });
    const itemId = (created.body as { id: number }).id;

    const noReason = await request(app)
      .post('/api/compliance/calendar/waive')
      .set(auth(hrToken))
      .send({ itemId, reason: '' });
    expect(noReason.status).toBe(400);

    const waived = await request(app)
      .post('/api/compliance/calendar/waive')
      .set(auth(hrToken))
      .send({ itemId, reason: 'Entity has no LWF liability in this state' });
    expect(waived.status).toBe(200);

    // A waiver must never be logged as if it were a filing.
    const audit = await db
      .selectFrom('core.audit_log')
      .select(['action'])
      .where('entity', '=', 'cmp.calendar_items')
      .where('entity_id', '=', itemId)
      .orderBy('id', 'desc')
      .executeTakeFirstOrThrow();
    expect(audit.action).toBe('waived');
  });

  it('surfaces overdue filings and per-entity licence posture together', async () => {
    const res = await request(app).get('/api/compliance/posture').set(auth(hrToken));
    expect(res.status).toBe(200);
    const body = res.body as PostureBody;
    const entity = body.companies.find((c) => c.companyId === companyId);
    expect(entity?.expiring).toBeGreaterThanOrEqual(1);
  });

  /* ── Separation of duties ──────────────────────────────────────────────── */

  it('IT cannot reach statutory obligations — these are HR authority, not system settings', async () => {
    for (const path of [
      '/api/compliance/registrations',
      '/api/compliance/calendar',
      '/api/compliance/posture',
    ]) {
      const res = await request(app).get(path).set(auth(itToken));
      expect(res.status, path).toBe(403);
    }
  });
});
