/** Item 7 / acceptance bar: Kent HTTP adapter + simulator → ingest → dedupe → day records. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { ControlledTransaction, Kysely } from 'kysely';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import { KentFeedError, KentHttpConnector, kentConfigFromEnv, kentConnectorFromEnv, type KentHttpConfig } from '../src/modules/attendance/kent-http-connector.js';
import { createKentSimulator } from '../src/modules/attendance/kent-simulator.js';
import { runKentSync } from '../src/modules/attendance/kent-sync.job.js';

const DB_URL = process.env['DATABASE_URL'];
const noSleep = () => Promise.resolve();
const must = (c: KentHttpConfig | null): KentHttpConfig => { if (c === null) throw new Error('no config'); return c; };

describe('kent config + parsing', () => {
  it('is absent without KENT_BASE_URL and validates the rest', () => {
    expect(kentConfigFromEnv({})).toBeNull();
    expect(kentConnectorFromEnv({})).toBeUndefined();
    expect(() => kentConfigFromEnv({ KENT_BASE_URL: 'http://x' })).toThrow(/KENT_API_KEY/);
    expect(() => kentConfigFromEnv({ KENT_BASE_URL: 'http://x', KENT_API_KEY: 'k', KENT_DEVICE_MAP: '{bad' })).toThrow(/valid JSON/);
    const cfg = kentConfigFromEnv({ KENT_BASE_URL: 'http://x/', KENT_API_KEY: 'k', KENT_FIELD_MAP: '{"employeeNo":"EmpCode"}', KENT_DEVICE_MAP: '{"7":"Gate-7"}' });
    expect(cfg).toMatchObject({ baseUrl: 'http://x', deviceMap: { '7': 'Gate-7' }, fields: { employeeNo: 'EmpCode', time: 'punchTime' } });
    expect(kentConnectorFromEnv({ KENT_BASE_URL: 'http://x', KENT_API_KEY: 'k' })).toBeInstanceOf(KentHttpConnector);
  });
  it('applies the default offset to zone-less times and rejects garbage', () => {
    const c = new KentHttpConnector(must(kentConfigFromEnv({ KENT_BASE_URL: 'http://x', KENT_API_KEY: 'k' })));
    expect(c.parseTime('2026-06-02 09:00:00').toISOString()).toBe('2026-06-02T03:30:00.000Z');
    expect(c.parseTime('2026-06-02T09:00:00Z').toISOString()).toBe('2026-06-02T09:00:00.000Z');
    expect(() => c.parseTime('nope')).toThrow(KentFeedError);
  });
});

describe('kent simulator over HTTP', () => {
  let sim: ReturnType<typeof createKentSimulator>;
  let cfg: KentHttpConfig;
  beforeAll(async () => {
    sim = createKentSimulator({ apiKey: 'sim-key', failEvery: 2 });
    const port = await sim.listen();
    cfg = must(kentConfigFromEnv({ KENT_BASE_URL: `http://127.0.0.1:${String(port)}`, KENT_API_KEY: 'sim-key', KENT_PAGE_SIZE: '2', KENT_DEVICE_MAP: '{"D1":"Main-Gate"}' }));
    sim.add([1, 2, 3].map((i) => ({ employeeNo: `e${String(i)}`, punchTime: `2026-06-02 09:0${String(i)}:00`, deviceId: 'D1', direction: 'in' as const, receivedAt: `2026-06-02T03:3${String(i)}:00Z` })));
  });
  afterAll(async () => { await sim.close(); });
  it('pages, retries simulated 503s, maps devices and upper-cases ecodes', async () => {
    const c = new KentHttpConnector(cfg, undefined, noSleep);
    const swipes = await c.fetchSince(new Date('2026-06-01T00:00:00Z'));
    expect(swipes.map((s) => s.employeeNo)).toEqual(['E1', 'E2', 'E3']);
    expect(swipes[0]).toMatchObject({ doorCode: 'Main-Gate', direction: 'in' });
    const devices = await c.listDevices();
    expect(devices[0]?.doorCode).toBe('Main-Gate');
  });
  it('does not retry a bad API key', async () => {
    const c = new KentHttpConnector({ ...cfg, apiKey: 'wrong' }, undefined, noSleep);
    await expect(c.fetchSince(new Date(0))).rejects.toThrow(/HTTP 401/);
  });
});

describe.skipIf(!DB_URL)('kent feed → pipeline', () => {
  let db: Kysely<Database>;
  let tx: ControlledTransaction<Database>;
  let sim: ReturnType<typeof createKentSimulator>;
  let ecode = '';
  let empId = 0;
  const source = `kent-test-${randomUUID().slice(0, 6)}`;
  beforeAll(async () => {
    db = createDatabase(DB_URL ?? '');
    tx = await db.startTransaction().execute();
    const tag = ('KT' + randomUUID().slice(0, 5)).toUpperCase();
    const company = (await tx.insertInto('core.companies').values({ code: tag, name: tag, ecode_prefix: tag }).returning('id').executeTakeFirstOrThrow()).id;
    const unit = (await tx.insertInto('core.org_units').values({ company_id: company, name: tag }).returning('id').executeTakeFirstOrThrow()).id;
    ecode = `${tag}1`;
    empId = (await tx.insertInto('core.employees').values({ company_id: company, org_unit_id: unit, ecode, first_name: 'Kent', status: 'active', doj: '2020-01-01' }).returning('id').executeTakeFirstOrThrow()).id;
    sim = createKentSimulator({ apiKey: 'k' });
    const port = await sim.listen();
    const recent = (minAgo: number) => new Date(Date.now() - minAgo * 60_000).toISOString();
    sim.add([
      { employeeNo: ecode.toLowerCase(), punchTime: recent(240), deviceId: 'G1', direction: 'in', receivedAt: recent(239) },
      { employeeNo: ecode, punchTime: recent(30), deviceId: 'G1', direction: 'out', receivedAt: recent(29) },
      { employeeNo: 'NOBODY99', punchTime: recent(20), deviceId: 'G1', receivedAt: recent(19) },
    ]);
    process.env['KENT_TEST_URL'] = `http://127.0.0.1:${String(port)}`;
  });
  afterAll(async () => {
    await sim.close();
    try { if (!tx.isRolledBack && !tx.isCommitted) await tx.rollback().execute(); } finally { await db.destroy(); }
  });
  it('ingests matched swipes, reports unmatched, and dedupes on re-run', async () => {
    const connector = kentConnectorFromEnv({ KENT_BASE_URL: process.env['KENT_TEST_URL'], KENT_API_KEY: 'k' });
    const first = await runKentSync(tx, connector, source);
    expect(first.fetched).toBe(3);
    expect(first.unmatchedEmployeeNos).toContain('NOBODY99');
    const rows = await tx.selectFrom('att.swipe_events').select(['employee_id', 'door_code']).where('employee_no', '=', ecode).execute();
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.employee_id === empId)).toBe(true);
    const again = await runKentSync(tx, connector, source);
    expect(again.inserted).toBe(0);
  });
});
