/** Item 7 / KENT_RESEARCH: Kent CamAttendance webhook + pull (API / DB / CSV drop) → ingest → dedupe. */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ControlledTransaction, Kysely } from 'kysely';
import { createApp } from '../src/app.js';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import { DEFAULT_KENT_FIELDS, KentFeedError, KentHttpConnector, atPath, kentConfigFromEnv, mapKentRecord } from '../src/modules/attendance/kent-http-connector.js';
import { KentCsvDropConnector, KentDbConnector, kentConnectorFromEnv, kentModeFromEnv, parseCsv, type KentDbClient } from '../src/modules/attendance/kent-source-connectors.js';
import { createKentSimulator } from '../src/modules/attendance/kent-simulator.js';
import { runKentSync } from '../src/modules/attendance/kent-sync.job.js';
import { parseKentTime } from '../src/modules/attendance/kent-time.js';
import { kentWebhookConfigFromEnv } from '../src/modules/attendance/kent-webhook.js';
import { httpRequest } from './http-client.js';

const DB_URL = process.env['DATABASE_URL'];
const noSleep = () => Promise.resolve();
const must = <T>(c: T | null | undefined): T => { if (c === null || c === undefined) throw new Error('missing'); return c; };
const TOKEN = 'a'.repeat(32);

describe('kent time parsing', () => {
  it('handles epoch seconds vs ms, ISO, export and dd-mm formats, with +05:30 default', () => {
    expect(parseKentTime(1780370400).toISOString()).toBe('2026-06-02T03:20:00.000Z');
    expect(parseKentTime(1780370400000).toISOString()).toBe('2026-06-02T03:20:00.000Z');
    expect(parseKentTime('1780370400').toISOString()).toBe('2026-06-02T03:20:00.000Z');
    expect(parseKentTime('2026-06-02 09:00:00').toISOString()).toBe('2026-06-02T03:30:00.000Z');
    expect(parseKentTime('2026-06-02T09:00:00Z').toISOString()).toBe('2026-06-02T09:00:00.000Z');
    expect(parseKentTime('16 Jun 2025 15:03:40').toISOString()).toBe('2025-06-16T09:33:40.000Z');
    expect(parseKentTime('16-Jun-2025 15:03').toISOString()).toBe('2025-06-16T09:33:00.000Z');
    expect(parseKentTime('02/06/2026 09:00:00').toISOString()).toBe('2026-06-02T03:30:00.000Z');
    expect(parseKentTime('2026-06-02 09:00:00', '+00:00').toISOString()).toBe('2026-06-02T09:00:00.000Z');
    expect(parseKentTime(new Date(5)).getTime()).toBe(5);
    for (const bad of ['nope', '', null, -5, new Date(NaN)]) expect(() => parseKentTime(bad)).toThrow();
  });
});

describe('kent config + record mapping', () => {
  it('selects the mode from env and validates', () => {
    expect(kentConfigFromEnv({})).toBeNull();
    expect(kentModeFromEnv({})).toBeNull();
    expect(kentConnectorFromEnv({})).toBeUndefined();
    expect(() => kentModeFromEnv({ KENT_MODE: 'adms' })).toThrow(/KENT_MODE/);
    expect(() => kentConfigFromEnv({ KENT_BASE_URL: 'http://x' })).toThrow(/KENT_API_KEY/);
    expect(() => kentConfigFromEnv({ KENT_BASE_URL: 'http://x', KENT_AUTH: 'login' })).toThrow(/KENT_LOGIN_PATH/);
    expect(() => kentConfigFromEnv({ KENT_BASE_URL: 'http://x', KENT_AUTH: 'magic', KENT_API_KEY: 'k' })).toThrow(/KENT_AUTH/);
    expect(() => kentConfigFromEnv({ KENT_BASE_URL: 'http://x', KENT_API_KEY: 'k', KENT_DEVICE_MAP: '{bad' })).toThrow(/valid JSON/);
    const cfg = must(kentConfigFromEnv({ KENT_BASE_URL: 'http://x/', KENT_API_KEY: 'k', KENT_FIELD_MAP: '{"employeeNo":"EmpCode"}', KENT_DEVICE_MAP: '{"7":"Gate-7"}' }));
    expect(cfg).toMatchObject({ baseUrl: 'http://x', deviceMap: { '7': 'Gate-7' }, fields: { employeeNo: 'EmpCode', time: 'time' }, rereadDays: 3, devicesPath: '' });
    expect(kentConnectorFromEnv({ KENT_BASE_URL: 'http://x', KENT_API_KEY: 'k' })).toBeInstanceOf(KentHttpConnector);
    expect(kentModeFromEnv({ KENT_DB_URL: 'postgres://x' })).toBe('db');
    expect(kentModeFromEnv({ KENT_CSV_DIR: '/tmp' })).toBe('csv');
    expect(() => kentConnectorFromEnv({ KENT_MODE: 'db' })).toThrow(/KENT_DB_TABLE/);
    expect(() => kentConnectorFromEnv({ KENT_MODE: 'csv' })).toThrow(/KENT_CSV_DIR/);
    expect(() => kentConnectorFromEnv({ KENT_MODE: 'db', KENT_DB_URL: 'x', KENT_DB_TABLE: 't', KENT_DB_COLUMNS: '{' })).toThrow(/KENT_DB_COLUMNS/);
    expect(kentConnectorFromEnv({ KENT_MODE: 'csv', KENT_CSV_DIR: '/tmp', KENT_CSV_ALIASES: '{"time":["Punch At"]}' })).toBeInstanceOf(KentCsvDropConnector);
    expect(kentConnectorFromEnv({ KENT_MODE: 'db', KENT_DB_URL: 'x', KENT_DB_TABLE: 't' }, { query: () => Promise.resolve({ rows: [] }) })).toBeInstanceOf(KentDbConnector);
    expect(kentWebhookConfigFromEnv({})).toBeNull();
    expect(() => kentWebhookConfigFromEnv({ KENT_WEBHOOK_TOKEN: 'short' })).toThrow(/24/);
    expect(kentWebhookConfigFromEnv({ KENT_WEBHOOK_TOKEN: TOKEN, KENT_WEBHOOK_ALLOW_IPS: '1.2.3.4, 5.6.7.8', KENT_WEBHOOK_HEADER: 'X-Kent' })).toMatchObject({ allowIps: ['1.2.3.4', '5.6.7.8'], header: { name: 'x-kent' } });
  });
  it('maps Kent webhook records; type 0 is an unknown face; bad rows carry a reason', () => {
    const o = { fields: DEFAULT_KENT_FIELDS, deviceMap: { DEV9: 'Gate-9' }, defaultOffset: '+05:30', now: new Date('2026-06-02T05:00:00Z'), swipeType: 't' };
    const ok = mapKentRecord({ empId: 'rml1', time: 1780370400, type: 1, deviceId: 'DEV9', deviceName: 'X' }, o);
    expect(ok.swipe).toMatchObject({ employeeNo: 'RML1', doorCode: 'Gate-9', receivedAt: o.now });
    expect(mapKentRecord({ empId: 'r', time: 1, type: 1, deviceId: '', deviceName: 'Seamless' }, o).swipe?.doorCode).toBe('Seamless');
    expect(mapKentRecord({ empId: '', time: 1, type: 0, deviceId: 'D' }, o).unknownFace).toBe(true);
    expect(mapKentRecord({ time: 1, deviceId: 'D' }, o).reason).toMatch(/employee/);
    expect(mapKentRecord({ empId: 'x', time: 1 }, o).reason).toMatch(/device/);
    expect(mapKentRecord({ empId: 'x', time: 'garbage', deviceId: 'D' }, o).reason).toMatch(/Unreadable/);
    expect(mapKentRecord({ empId: 'x', time: 1780370400, deviceId: 'D', direction: 'OUT', cardNo: 'C1', receivedAt: 1780370500 }, o).swipe).toMatchObject({ direction: 'out', accessCard: 'C1' });
    expect(atPath({ a: { b: [1] } }, 'a.b')).toEqual([1]);
    expect(atPath([1], '')).toEqual([1]);
    expect(atPath({ a: 1 }, 'a.b')).toBeUndefined();
  });
  it('parses CSV with quotes, CRLF and ; delimiter', () => {
    expect(parseCsv('\uFEFFa,b\r\n"x, y","q""z"\r\n\r\n')).toEqual([['a', 'b'], ['x, y', 'q"z']]);
    expect(parseCsv('a;b\n1;2')).toEqual([['a', 'b'], ['1', '2']]);
  });
});

describe('kent pull over HTTP (simulator)', () => {
  let sim: ReturnType<typeof createKentSimulator>;
  let base = '';
  beforeAll(async () => {
    sim = createKentSimulator({ apiKey: 'sim-key', failEvery: 3, login: { username: 'u', password: 'p' } });
    base = `http://127.0.0.1:${String(await sim.listen())}`;
    sim.add([1, 2, 3].map((i) => ({ empId: `e${String(i)}`, time: `2026-06-02 09:0${String(i)}:00`, type: 1 as const, deviceId: 'D1', direction: 'in' as const, receivedAt: `2026-06-02T03:3${String(i)}:00Z` })));
  });
  afterAll(async () => { await sim.close(); });
  it('style A: cursor paging, retries 503s, maps devices, upper-cases ecodes', async () => {
    const cfg = must(kentConfigFromEnv({ KENT_BASE_URL: base, KENT_API_KEY: 'sim-key', KENT_PAGE_SIZE: '2', KENT_DEVICE_MAP: '{"D1":"Main-Gate"}', KENT_DEVICES_PATH: '/devices', KENT_REREAD_DAYS: '0' }));
    const c = new KentHttpConnector(cfg, undefined, noSleep);
    const swipes = await c.fetchSince(new Date('2026-06-01T00:00:00Z'));
    expect(swipes.map((s) => s.employeeNo)).toEqual(['E1', 'E2', 'E3']);
    expect(swipes[0]).toMatchObject({ doorCode: 'Main-Gate', direction: 'in' });
    expect((await c.listDevices())[0]?.doorCode).toBe('Main-Gate');
    expect(await new KentHttpConnector({ ...cfg, devicesPath: '' }).listDevices()).toEqual([]);
    await expect(new KentHttpConnector({ ...cfg, apiKey: 'wrong' }, undefined, noSleep).fetchSince(new Date(0))).rejects.toThrow(/HTTP 401/);
    await expect(new KentHttpConnector({ ...cfg, itemsPath: 'nope' }, undefined, noSleep).fetchSince(new Date(0))).rejects.toThrow(KentFeedError);
  });
  it('style B: login token, page paging, data.records, epoch-second since, re-read window catches late uploads', async () => {
    const now = Date.now();
    sim.add([{ empId: 'late1', time: Math.floor((now - 2 * 86_400_000) / 1000), type: 1, deviceId: 'D2' }, { empId: 'x', time: Math.floor(now / 1000), type: 0, deviceId: 'D2' }]);
    const env = { KENT_BASE_URL: base, KENT_AUTH: 'login', KENT_LOGIN_PATH: '/api/login', KENT_LOGIN_BODY: '{"username":"u","password":"p"}', KENT_LOGIN_TOKEN_PATH: 'data.token', KENT_PULL_PATH: '/api/recognition-logs', KENT_PAGING: 'page', KENT_Q_SINCE: 'fromDate', KENT_Q_LIMIT: 'pageSize', KENT_SINCE_FORMAT: 'epoch_s', KENT_ITEMS_PATH: 'data.records', KENT_PAGE_SIZE: '2' };
    const c = new KentHttpConnector(must(kentConfigFromEnv(env)), undefined, noSleep);
    const got = await c.fetchSince(new Date(now - 60_000));
    expect(got.map((s) => s.employeeNo)).toEqual(['LATE1']);
    const noReread = new KentHttpConnector(must(kentConfigFromEnv({ ...env, KENT_REREAD_DAYS: '0' })), undefined, noSleep);
    expect(await noReread.fetchSince(new Date(now - 60_000))).toEqual([]);
    await expect(new KentHttpConnector(must(kentConfigFromEnv({ ...env, KENT_LOGIN_BODY: '{"username":"u","password":"bad"}' })), undefined, noSleep).fetchSince(new Date())).rejects.toThrow(/401/);
    await expect(new KentHttpConnector(must(kentConfigFromEnv({ ...env, KENT_LOGIN_TOKEN_PATH: 'nope' })), undefined, noSleep).fetchSince(new Date())).rejects.toThrow(/token/);
  });
  it('bearer / query / none auth and offset paging build the right request', async () => {
    const seen: { url: string; headers: Record<string, string> }[] = [];
    const fake = (url: string, init: { headers: Record<string, string> }) => { seen.push({ url, headers: init.headers }); return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) }); };
    const mk = (extra: Record<string, string>) => new KentHttpConnector(must(kentConfigFromEnv({ KENT_BASE_URL: 'http://k', KENT_API_KEY: 's3', KENT_ITEMS_PATH: '', ...extra })), fake, noSleep, () => new Date('2026-06-02T00:00:00Z'));
    await mk({ KENT_AUTH: 'bearer', KENT_PAGING: 'offset', KENT_Q_PAGE: 'skip', KENT_Q_UNTIL: 'to' }).fetchSince(new Date('2026-06-01T00:00:00Z'));
    await mk({ KENT_AUTH: 'query', KENT_PAGING: 'none', KENT_SINCE_FORMAT: 'local' }).fetchSince(new Date('2026-06-01T00:00:00Z'));
    await mk({ KENT_AUTH: 'none', KENT_SINCE_FORMAT: 'epoch_ms', KENT_PULL_PATH: '/x?y=1' }).fetchSince(new Date('2026-06-01T00:00:00Z'));
    expect(seen[0]?.headers['Authorization']).toBe('Bearer s3');
    expect(seen[0]?.url).toMatch(/skip=0/);
    expect(seen[0]?.url).toMatch(/to=2026-06-02/);
    expect(seen[1]?.url).toMatch(/since=2026-05-30\+05%3A30%3A00.*token=s3|token=s3/);
    expect(seen[2]?.url).toMatch(/^http:\/\/k\/x\?y=1&since=\d{13}/);
  });
});

describe('kent DB-read and CSV-drop modes', () => {
  it('DB mode reads the configured table above the watermark and rejects unsafe identifiers', async () => {
    const calls: { text: string; params: unknown[] }[] = [];
    const client: KentDbClient = { query: (text, params) => { calls.push({ text, params }); return Promise.resolve({ rows: [{ employeeNo: 'rml9', time: new Date('2026-06-02T03:30:00Z'), device: 'Seamless-Plant_S4', card: 'RML9' }] }); } };
    const c = new KentDbConnector(client, { table: 'dbo.AttendanceLogs', columns: { employeeNo: 'EmpCode', time: 'LogTime', device: 'Door', card: 'Card' }, watermark: 'time', rereadDays: 1, batchSize: 10, defaultOffset: '+05:30', deviceMap: {} }, () => new Date('2026-06-03T00:00:00Z'));
    const got = await c.fetchSince(new Date('2026-06-02T23:00:00Z'));
    expect(got).toHaveLength(1);
    expect(got[0]).toMatchObject({ employeeNo: 'RML9', accessCard: 'RML9', swipeType: 'kent_db' });
    expect(calls[0]?.text).toContain('FROM "dbo"."AttendanceLogs" WHERE "LogTime" > $1');
    expect((calls[0]?.params[0] as Date).toISOString()).toBe('2026-06-02T00:00:00.000Z');
    expect(await c.listDevices()).toEqual([]);
    await expect(new KentDbConnector(client, { table: 'x; drop table y', columns: { employeeNo: 'a', time: 'b', device: 'c' }, watermark: 'time', rereadDays: 0, batchSize: 1, defaultOffset: '+05:30', deviceMap: {} }).fetchSince(new Date())).rejects.toThrow(/Unsafe/);
    expect(() => new KentDbConnector(client, { table: 't', columns: { employeeNo: 'a', time: 'b', device: 'c' }, watermark: 'receivedAt', rereadDays: 0, batchSize: 1, defaultOffset: '+05:30', deviceMap: {} })).toThrow(/receivedAt/);
  });
  it('CSV mode reads greytHR/Kent exports by header alias and archives only after ingest', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'kentcsv-'));
    await writeFile(join(dir, 'a.csv'), 'Employee No,Employee Name,Swipe Date,Door/Address,Status,Received On\nrml1,A,16 Jun 2025 09:03:40,Seamless-Plant_S4,IN,16 Jun 2025 09:10:00\nrml1,A,16 Jun 2025 18:00:00,,,\n');
    await writeFile(join(dir, 'b.csv'), 'Name Only\nx\n');
    const c = new KentCsvDropConnector({ dir, archiveDir: join(dir, 'done'), aliases: { employeeNo: ['employee no'], time: ['swipe date'], device: ['door/address'], card: [], direction: ['status'], receivedAt: ['received on'] }, defaultOffset: '+05:30', deviceMap: {} });
    await expect(c.fetchSince()).rejects.toThrow(/b\.csv/);
    await writeFile(join(dir, 'b.csv'), 'Employee No,Swipe Date\n');
    const got = await c.fetchSince();
    expect(got).toHaveLength(2);
    expect(got[0]).toMatchObject({ employeeNo: 'RML1', direction: 'in', doorCode: 'Seamless-Plant_S4' });
    expect(got[0]?.receivedAt.toISOString()).toBe('2025-06-16T03:40:00.000Z');
    expect(got[1]?.doorCode).toBe('CSV-DROP');
    expect((await readdir(dir)).filter((n) => n.endsWith('.csv'))).toHaveLength(2);
    await c.afterIngest();
    expect((await readdir(dir)).filter((n) => n.endsWith('.csv'))).toHaveLength(0);
    expect(await readdir(join(dir, 'done'))).toHaveLength(2);
    expect(await c.listDevices()).toEqual([]);
  });
});

describe.skipIf(!DB_URL)('kent feeds → pipeline', () => {
  let db: Kysely<Database>;
  let tx: ControlledTransaction<Database>;
  let sim: ReturnType<typeof createKentSimulator>;
  let ecode = '';
  let empId = 0;
  const source = `kent-test-${randomUUID().slice(0, 6)}`;
  const recent = (minAgo: number) => new Date(Date.now() - minAgo * 60_000).toISOString();
  beforeAll(async () => {
    db = createDatabase(DB_URL ?? '');
    tx = await db.startTransaction().execute();
    const tag = ('KT' + randomUUID().slice(0, 5)).toUpperCase();
    const company = (await tx.insertInto('core.companies').values({ code: tag, name: tag, ecode_prefix: tag }).returning('id').executeTakeFirstOrThrow()).id;
    const unit = (await tx.insertInto('core.org_units').values({ company_id: company, name: tag }).returning('id').executeTakeFirstOrThrow()).id;
    ecode = `${tag}1`;
    empId = (await tx.insertInto('core.employees').values({ company_id: company, org_unit_id: unit, ecode, first_name: 'Kent', status: 'active', doj: '2020-01-01' }).returning('id').executeTakeFirstOrThrow()).id;
    sim = createKentSimulator({ apiKey: 'k' });
    await sim.listen();
  });
  afterAll(async () => {
    await sim.close();
    try { if (!tx.isRolledBack && !tx.isCommitted) await tx.rollback().execute(); } finally { await db.destroy(); }
  });

  it('API pull ingests matched swipes, reports unmatched, and dedupes on re-run', async () => {
    const port = (sim.server.address() as { port: number }).port;
    sim.add([
      { empId: ecode.toLowerCase(), time: recent(240), type: 1, deviceId: 'G1', receivedAt: recent(239) },
      { empId: ecode, time: Math.floor(Date.now() / 1000) - 1800, type: 1, deviceId: 'G1', receivedAt: recent(29) },
      { empId: 'NOBODY99', time: recent(20), type: 1, deviceId: 'G1', receivedAt: recent(19) },
    ]);
    const connector = kentConnectorFromEnv({ KENT_BASE_URL: `http://127.0.0.1:${String(port)}`, KENT_API_KEY: 'k' });
    const first = await runKentSync(tx, connector, source);
    expect(first.fetched).toBe(3);
    expect(first.unmatchedEmployeeNos).toContain('NOBODY99');
    const rows = await tx.selectFrom('att.swipe_events').select(['employee_id']).where('employee_no', '=', ecode).execute();
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.employee_id === empId)).toBe(true);
    expect((await runKentSync(tx, connector, source)).inserted).toBe(0);
  });

  it('webhook: token, allow-list and header gates; raw stored; unknown faces apart; retries dedupe', async () => {
    const mkApp = (cfg: Parameters<typeof createApp>[0]) => createApp({ db: tx, jwtSecret: 'x'.repeat(40), secureCookies: false, ...cfg });
    const open = mkApp({ kentWebhook: { token: TOKEN, allowIps: [], header: null, maxBytes: '1mb' } });
    const t = Math.floor(Date.now() / 1000) - 600;
    const body = [
      { empId: ecode, employeeName: 'Kent', time: t, type: 1, imageUrl: '', accountId: 1, companyId: 'CO01', mode: 'system generated', locationName: '44', deviceName: 'Seamless-Plant_S4', departmentName: '', deviceId: 'WH-DEV-1' },
      { empId: '', employeeName: '', time: t, type: 0, imageUrl: 'https://kent/x.jpg', locationName: '44', deviceName: 'Seamless-Plant_S4', deviceId: 'WH-DEV-1' },
      { employeeName: 'no code', time: t, type: 1, deviceId: 'WH-DEV-1' },
      'junk',
    ];
    const post = async (app: ReturnType<typeof createApp>, path: string, payload: unknown, headers: Record<string, string> = {}) => {
      let r = (await httpRequest(app)).post(path).set('Content-Type', 'application/json');
      for (const [k, v] of Object.entries(headers)) r = r.set(k, v);
      return r.send(typeof payload === 'string' ? payload : JSON.stringify(payload));
    };
    expect((await post(open, '/api/integrations/kent/webhook/wrong-token', body)).status).toBe(404);
    expect((await post(mkApp({ kentWebhook: null }), `/api/integrations/kent/webhook/${TOKEN}`, body)).status).toBe(404);
    expect((await post(mkApp({ kentWebhook: { token: TOKEN, allowIps: ['10.9.9.9'], header: null, maxBytes: '1mb' } }), `/api/integrations/kent/webhook/${TOKEN}`, body)).status).toBe(403);
    const hdr = mkApp({ kentWebhook: { token: TOKEN, allowIps: [], header: { name: 'x-kent-key', value: 'v' }, maxBytes: '1mb' } });
    expect((await post(hdr, `/api/integrations/kent/webhook/${TOKEN}`, body)).status).toBe(401);
    expect((await post(hdr, `/api/integrations/kent/webhook/${TOKEN}`, [], { 'x-kent-key': 'v' })).status).toBe(200);
    const bad = await post(open, `/api/integrations/kent/webhook/${TOKEN}`, '{not json');
    expect(bad.status).toBe(400);
    const res = await post(open, `/api/integrations/kent/webhook/${TOKEN}`, body);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, received: 4, accepted: 1, inserted: 1, unknownFaces: 1, rejected: 2 });
    const batchId = (res.body as { batchId: number }).batchId;
    const batch = await tx.selectFrom('att.kent_webhook_batches').selectAll().where('id', '=', batchId).executeTakeFirstOrThrow();
    expect(batch.raw_body).toContain('WH-DEV-1');
    expect(batch.processed_at).not.toBeNull();
    const faces = await tx.selectFrom('att.kent_unknown_faces').selectAll().where('batch_id', '=', batchId).execute();
    expect(faces).toHaveLength(1);
    expect(faces[0]).toMatchObject({ image_url: 'https://kent/x.jpg', device_id: 'WH-DEV-1', location_name: '44' });
    const sw = await tx.selectFrom('att.swipe_events').select(['door_code', 'source', 'received_at', 'swipe_ts']).where('employee_no', '=', ecode).where('door_code', '=', 'WH-DEV-1').execute();
    expect(sw).toHaveLength(1);
    expect(sw[0]?.source).toBe('kent_webhook');
    expect(new Date(sw[0]?.swipe_ts ?? 0).getTime()).toBe(t * 1000);
    expect(Date.now() - new Date(sw[0]?.received_at ?? 0).getTime()).toBeLessThan(60_000);
    const errored = await tx.selectFrom('att.kent_webhook_batches').select('error').where('raw_body', '=', '{not json').executeTakeFirstOrThrow();
    expect(errored.error).toMatch(/JSON/);
    // Kent retry of the same batch, through the simulator's push helper path shape: no duplicates.
    const again = await post(open, `/api/integrations/kent/webhook/${TOKEN}`, body);
    expect(again.body).toMatchObject({ inserted: 0, accepted: 1 });
    // A single object (not array) is accepted too.
    expect((await post(open, `/api/integrations/kent/webhook/${TOKEN}`, { ...(body[0] as Record<string, unknown>), time: t + 60 })).body).toMatchObject({ inserted: 1 });
  });

  it('CSV drop through runKentSync ingests and archives', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'kentcsv-sync-'));
    await writeFile(join(dir, 'drop.csv'), `Employee No,Swipe Date,Door/Address,Received On\n${ecode},${recent(90).slice(0, 19).replace('T', ' ')}Z,CSV-GATE,\n`);
    const c = kentConnectorFromEnv({ KENT_MODE: 'csv', KENT_CSV_DIR: dir });
    const r = await runKentSync(tx, c, `${source}-csv`);
    expect(r.inserted).toBe(1);
    expect((await readdir(dir)).filter((n) => n.endsWith('.csv'))).toHaveLength(0);
  });

  it('mixed webhook retains the food recognition raw but creates only attendance swipes/devices', async () => {
    vi.stubEnv('KENT_ATTENDANCE_DEVICE_IDS', 'WH-ATTENDANCE');
    try {
      const app = createApp({ db: tx, jwtSecret: 'x'.repeat(40), secureCookies: false, kentWebhook: { token: TOKEN, allowIps: [], header: null, maxBytes: '1mb' } });
      const c = await httpRequest(app);
      const body = [
        { empId: ecode, time: recent(15), type: 1, deviceId: 'WH-ATTENDANCE' },
        { empId: ecode, time: recent(20), type: 1, deviceId: 'HGR5GEDS' },
      ];
      const res = await c.post(`/api/integrations/kent/webhook/${TOKEN}`).send(body);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ received: 2, accepted: 1, inserted: 1, rejected: 1 });
      const batch = await tx.selectFrom('att.kent_webhook_batches').select('raw_body').where('id', '=', (res.body as { batchId: number }).batchId).executeTakeFirstOrThrow();
      expect(batch.raw_body).toContain('HGR5GEDS');
      const swipes = await tx.selectFrom('att.swipe_events').select('door_code').where('employee_no', '=', ecode).where('door_code', 'in', ['WH-ATTENDANCE', 'HGR5GEDS']).execute();
      expect(swipes.map(s => s.door_code)).toEqual(['WH-ATTENDANCE']);
      expect(await tx.selectFrom('att.devices').select('id').where('door_code', '=', 'HGR5GEDS').execute()).toEqual([]);
    } finally { vi.unstubAllEnvs(); }
  });
});
