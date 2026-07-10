/**
 * Stage 1.1 live proof (P1-T01/T02/T03 + doc 14 §8.4):
 *  - clock-drift quarantine: implausible timestamps never reach attendance
 *  - silent-door alerting: fires ONCE on transition, re-arms when seen again
 *  - the ops API surface obeys the central permission gates
 *  - the scheduled job body is same-day idempotent
 */
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { Kysely } from 'kysely';
import { createApp } from '../src/app.js';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import { hashPassword } from '../src/modules/auth/index.js';
import { alertSilentDevices, ingestOnce, runKentSync, type KentConnector, type RawSwipe } from '../src/modules/attendance/index.js';

const DB_URL = process.env['DATABASE_URL'];
const JWT_SECRET = process.env['JWT_SECRET'] ?? 'integration-test-secret-at-least-32-chars!';
const run = describe.skipIf(!DB_URL);

const SOURCE = `s11-${Date.now()}`;

function fixedConnector(swipes: RawSwipe[]): KentConnector {
  return {
    fetchSince: (since) => Promise.resolve(swipes.filter((s) => s.receivedAt > since)),
    listDevices: () => Promise.resolve([]),
  };
}

run('Stage 1.1 — productionized ingestion (live Postgres)', () => {
  let db: Kysely<Database>;
  let app: Express;
  const stamp = Date.now();
  const opsEmail = `test-s11-ops-${stamp}@hrms.test`;
  const password = 'stage11-test-password-1!';
  let opsId: number;
  const door = `S11-Door-${stamp}`;

  beforeAll(async () => {
    db = createDatabase(DB_URL ?? '');
    app = createApp({ db, jwtSecret: JWT_SECRET, secureCookies: false });

    const user = await db
      .insertInto('core.users')
      .values({ email: opsEmail, password_hash: await hashPassword(password) })
      .returning('id')
      .executeTakeFirstOrThrow();
    opsId = user.id;
  });

  afterAll(async () => {
    await db.deleteFrom('att.quarantined_swipes').where('source', '=', SOURCE).execute();
    await db.deleteFrom('att.devices').where('door_code', '=', door).execute();
    await db.deleteFrom('att.ingest_watermarks').where('source', '=', SOURCE).execute();
    await db.deleteFrom('wf.notifications').where('template_code', '=', 'device_silent').execute();
    await db.deleteFrom('core.user_roles').where('user_id', '=', opsId).execute();
    await db.updateTable('core.users').set({ is_active: false }).where('id', '=', opsId).execute();
    await db.destroy();
  });

  it('quarantines future-drift and epoch-reset swipes; clean ones flow through (doc 14 §8.4)', async () => {
    const received = new Date();
    const swipes: RawSwipe[] = [
      // plausible: swiped 2 min before it was received
      { employeeNo: 'S11OK0001', swipeTs: new Date(received.getTime() - 2 * 60_000), doorCode: door, receivedAt: received },
      // device clock AHEAD: "swiped" 30 min after receipt (> 10-min window)
      { employeeNo: 'S11FUT001', swipeTs: new Date(received.getTime() + 30 * 60_000), doorCode: door, receivedAt: received },
      // device clock RESET: swipe from 60 days ago arriving now (> 45-day window)
      { employeeNo: 'S11OLD001', swipeTs: new Date(received.getTime() - 60 * 86_400_000), doorCode: door, receivedAt: received },
    ];

    const result = await ingestOnce(db, fixedConnector(swipes), SOURCE);
    expect(result.fetched).toBe(3);
    expect(result.inserted).toBe(1);
    expect(result.quarantined).toBe(2);

    const parked = await db
      .selectFrom('att.quarantined_swipes')
      .select(['employee_no', 'reason'])
      .where('source', '=', SOURCE)
      .execute();
    const byNo = new Map(parked.map((p) => [p.employee_no, p.reason]));
    expect(byNo.get('S11FUT001')).toBe('future_timestamp');
    expect(byNo.get('S11OLD001')).toBe('too_old');

    // The poisoned rows are NOT in attendance:
    const inRaw = await db
      .selectFrom('att.swipe_events')
      .select('employee_no')
      .where('source', '=', SOURCE)
      .execute();
    expect(inRaw.map((r) => r.employee_no)).toEqual(['S11OK0001']);
  });

  it('silent-door alert fires ONCE on transition, then re-arms after the door is seen again (ATT-02)', async () => {
    await db
      .insertInto('wf.event_subscriptions')
      .values({ event_code: 'attendance.device_silent', recipient_kind: 'email', recipient_ref: `it-${stamp}@rashmi.test` })
      .onConflict((oc) => oc.columns(['event_code', 'recipient_kind', 'recipient_ref']).doNothing())
      .execute();

    // Door went quiet 2 hours ago.
    const twoHoursAgo = new Date(Date.now() - 2 * 3600_000);
    await db
      .updateTable('att.devices')
      .set({ last_seen_at: twoHoursAgo, alerted_silent_at: null })
      .where('door_code', '=', door)
      .execute();

    const first = await alertSilentDevices(db);
    expect(first).toContain(door);

    const second = await alertSilentDevices(db);
    expect(second).not.toContain(door); // no spam on the next 5-min cycle

    // Door comes back (seen NOW), then goes quiet again → re-armed alert.
    await db.updateTable('att.devices').set({ last_seen_at: new Date() }).where('door_code', '=', door).execute();
    const futureCheck = new Date(Date.now() + 3 * 3600_000);
    const third = await alertSilentDevices(db, futureCheck);
    expect(third).toContain(door);

    const queued = await db
      .selectFrom('wf.notifications')
      .select(db.fn.countAll().as('n'))
      .where('template_code', '=', 'device_silent')
      .where('recipient_email', '=', `it-${stamp}@rashmi.test`)
      .executeTakeFirstOrThrow();
    expect(Number(queued.n)).toBe(2); // exactly two transitions, two alerts

    await db.deleteFrom('wf.event_subscriptions').where('recipient_ref', '=', `it-${stamp}@rashmi.test`).execute();
  });

  it('ops APIs obey the central permission gates (401 → 403 → 200 with the right roles)', async () => {
    expect((await request(app).get('/api/attendance/exceptions/unmatched')).status).toBe(401);

    const login = await request(app).post('/api/auth/login').send({ identifier: opsEmail, password });
    const token = (login.body as { accessToken: string }).accessToken;
    expect((await request(app).get('/api/attendance/exceptions/unmatched').set('Authorization', `Bearer ${token}`)).status).toBe(403);
    expect((await request(app).get('/api/attendance/devices').set('Authorization', `Bearer ${token}`)).status).toBe(403);

    // hr_ops → attendance.manual_override (unmatched queue); it_admin → devices/integrations.
    for (const role of ['hr_ops', 'it_admin']) {
      const r = await db.selectFrom('core.roles').select('id').where('code', '=', role).executeTakeFirstOrThrow();
      await db
        .insertInto('core.user_roles')
        .values({ user_id: opsId, role_id: r.id, scope_org_unit_id: null })
        .onConflict((oc) => oc.columns(['user_id', 'role_id', 'scope_org_unit_id']).doNothing())
        .execute();
    }

    const unmatched = await request(app)
      .get('/api/attendance/exceptions/unmatched')
      .set('Authorization', `Bearer ${token}`);
    expect(unmatched.status).toBe(200);
    const list = unmatched.body as { employeeNo: string; swipes: number }[];
    expect(list.some((r) => r.employeeNo === 'S11OK0001')).toBe(true); // ghost e-code surfaced, not dropped

    const devices = await request(app).get('/api/attendance/devices').set('Authorization', `Bearer ${token}`);
    expect(devices.status).toBe(200);
    const board = devices.body as { doorCode: string; silent: boolean }[];
    expect(board.some((d) => d.doorCode === door)).toBe(true);

    const quarantined = await request(app)
      .get('/api/attendance/exceptions/quarantined')
      .set('Authorization', `Bearer ${token}`);
    expect(quarantined.status).toBe(200);
    expect((quarantined.body as unknown[]).length).toBeGreaterThanOrEqual(2);
  });

  it('the scheduled job body ingests today for real employees and is same-day idempotent (P1-T01)', async () => {
    const first = await runKentSync(db);
    const second = await runKentSync(db);
    expect(second.inserted).toBe(0); // same day, same seed → pure dedupe
    expect(second.fetched).toBeGreaterThanOrEqual(0);
    expect(first.quarantined).toBe(0); // mock generates plausible timestamps
  });
});
