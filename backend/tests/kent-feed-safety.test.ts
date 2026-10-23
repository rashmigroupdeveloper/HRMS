/** ATT-01/02/18: food recognitions and malformed/incomplete batches must not become attendance. */
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEFAULT_KENT_FIELDS, KentHttpConnector, kentCommonFromEnv, kentConfigFromEnv, mapKentRecord } from '../src/modules/attendance/kent-http-connector.js';
import { KentDbConnector, kentConnectorFromEnv, parseCsv, type KentDbConfig } from '../src/modules/attendance/kent-source-connectors.js';

const now = new Date('2026-10-22T12:00:00Z');
const gate = { empId: 'rml1', deviceId: 'GATE-1', time: '2026-10-21 09:00:00', type: 1 };
const canteen = { ...gate, deviceId: 'HGR5GEDS' };
const dbConfig: KentDbConfig = { table: 'logs', columns: { employeeNo: 'ecode', time: 'punched_at', device: 'device_id' }, watermark: 'time', rereadDays: 3, batchSize: 2, defaultOffset: '+05:30', deviceMap: {} };
const dirs: string[] = [];
afterEach(async () => { for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true }); });

function http(body: unknown, extra: NodeJS.ProcessEnv = {}) {
  const cfg = kentConfigFromEnv({ KENT_BASE_URL: 'https://kent.invalid', KENT_AUTH: 'none', KENT_PAGING: 'none', ...extra });
  if (!cfg) throw new Error('Missing config');
  return new KentHttpConnector(cfg, () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) }), undefined, () => now);
}

describe('Kent feed safety', () => {
  it('applies the attendance-only device list before mapping or clock validation', () => {
    const common = kentCommonFromEnv({ KENT_ATTENDANCE_DEVICE_IDS: ' GATE-1, GATE-2 ' });
    const opts = { ...common, fields: DEFAULT_KENT_FIELDS, now, swipeType: 'test' };
    expect(mapKentRecord(gate, opts).swipe?.employeeNo).toBe('RML1');
    expect(mapKentRecord(canteen, opts)).toMatchObject({ swipe: null, excluded: true });
    expect(mapKentRecord(canteen, { ...opts, deviceMap: { HGR5GEDS: 'GATE-1' } })).toMatchObject({ swipe: null, excluded: true });
    expect(mapKentRecord({ ...canteen, time: 'bad' }, opts)).toMatchObject({ swipe: null, excluded: true });
    expect(mapKentRecord({ ...gate, deviceId: '' }, opts)).toMatchObject({ swipe: null, reason: 'missing device' });
  });

  it('filters both API events and completeness telemetry from non-attendance devices', async () => {
    const c = http({ items: [gate, canteen] }, { KENT_ATTENDANCE_DEVICE_IDS: 'GATE-1' });
    expect((await c.fetchSince(now)).map(s => s.doorCode)).toEqual(['GATE-1']);
    const devices = http({ items: [
      { deviceId: 'GATE-1', lastSeen: now.toISOString(), completeThrough: now.toISOString() },
      { deviceId: 'HGR5GEDS', lastSeen: now.toISOString(), completeThrough: now.toISOString() },
    ] }, { KENT_ATTENDANCE_DEVICE_IDS: 'GATE-1', KENT_DEVICES_PATH: '/devices' });
    expect((await devices.listDevices()).map(d => d.doorCode)).toEqual(['GATE-1']);
  });

  it.each([{}, null, 42, { ...gate, empId: '' }, { ...gate, time: 'bad' }])('refuses an invalid API record without returning a partial batch: %j', async bad => {
    await expect(http({ items: [gate, bad] }).fetchSince(now)).rejects.toThrow(/record/i);
  });

  it('detects DB truncation before returning any swipes, including equal timestamp rows', async () => {
    let query = '';
    const connector = new KentDbConnector({ query: (text) => {
      query = text;
      return Promise.resolve({ rows: [1, 2, 3].map(n => ({ employeeNo: `RML${String(n)}`, time: gate.time, device: 'GATE-1' })) });
    } }, dbConfig, () => now);
    await expect(connector.fetchSince(now)).rejects.toThrow(/limit|batch|truncat/i);
    expect(query).toContain('LIMIT 3');
  });

  it('refuses malformed DB rows rather than advancing past them', async () => {
    const c = new KentDbConnector({ query: () => Promise.resolve({ rows: [{ employeeNo: '', time: gate.time, device: 'GATE-1' }] }) }, dbConfig, () => now);
    await expect(c.fetchSince(now)).rejects.toThrow(/record/i);
  });

  it('filters canteen devices in DB mode as well', async () => {
    const c = kentConnectorFromEnv({ KENT_MODE: 'db', KENT_DB_URL: 'unused', KENT_DB_TABLE: 'logs', KENT_ATTENDANCE_DEVICE_IDS: 'GATE-1' }, {
      query: () => Promise.resolve({ rows: [gate, canteen].map(r => ({ employeeNo: r.empId, time: r.time, device: r.deviceId })) }),
    });
    expect((await c?.fetchSince(now))?.map(s => s.doorCode)).toEqual(['GATE-1']);
  });

  it('keeps the original CSV files when a later file contains a bad record', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'kent-safety-')); dirs.push(dir);
    const header = 'Employee No,Swipe Date,Device ID\n';
    await writeFile(join(dir, 'a.csv'), header + 'RML1,21/10/2026 09:00:00,GATE-1\n');
    await writeFile(join(dir, 'b.csv'), header + 'RML2,not-a-date,GATE-1\n');
    const c = kentConnectorFromEnv({ KENT_MODE: 'csv', KENT_CSV_DIR: dir });
    await expect(c?.fetchSince(now)).rejects.toThrow(/b.csv.*record/i);
    await c?.afterIngest?.();
    expect((await readdir(dir)).filter(n => n.endsWith('.csv')).sort()).toEqual(['a.csv', 'b.csv']);
  });

  it('filters canteen devices in scheduled CSV files', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'kent-safety-')); dirs.push(dir);
    await writeFile(join(dir, 'a.csv'), 'Employee No,Swipe Date,Device ID\nRML1,21/10/2026 09:00:00,GATE-1\nRML1,21/10/2026 08:00:00,HGR5GEDS\n');
    const c = kentConnectorFromEnv({ KENT_MODE: 'csv', KENT_CSV_DIR: dir, KENT_ATTENDANCE_DEVICE_IDS: 'GATE-1' });
    expect((await c?.fetchSince(now))?.map(s => s.doorCode)).toEqual(['GATE-1']);
  });

  it.each(['Employee No,Swipe Date\nRML1,21/10/2026 09:00:00\n', 'Employee No,Swipe Date,Device ID\nRML1,21/10/2026 09:00:00,\n'])('requires a source device for allow-listed CSV feeds: %s', async content => {
    const dir = await mkdtemp(join(tmpdir(), 'kent-safety-')); dirs.push(dir);
    await writeFile(join(dir, 'a.csv'), content);
    const c = kentConnectorFromEnv({ KENT_MODE: 'csv', KENT_CSV_DIR: dir, KENT_ATTENDANCE_DEVICE_IDS: 'GATE-1' });
    await expect(c?.fetchSince(now)).rejects.toThrow(/device/);
    expect(await readdir(dir)).toEqual(['a.csv']);
  });

  it('rejects unterminated CSV quoting', () => {
    expect(() => parseCsv('Employee No,Swipe Date\nRML1,"21/10/2026 09:00:00')).toThrow(/quot/i);
  });

  it('maps scheduled native logs using actual Date/Time, Attendance Type and later Created on', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'kent-safety-')); dirs.push(dir);
    await writeFile(join(dir, 'native.csv'), 'Employee ID,Date,Time,Device Name,Attendance Type,Created on\nRML1,06/10/2026,03:30,Gate,out,08-10-2026 04:00\n');
    const c = kentConnectorFromEnv({ KENT_MODE: 'csv', KENT_CSV_DIR: dir });
    const result = await c?.fetchSince(now);
    expect(result?.[0]).toMatchObject({ direction: 'out', doorCode: 'Gate', swipeTs: new Date('2026-10-05T22:00:00Z'), receivedAt: new Date('2026-10-07T22:30:00Z') });
  });

  it('refuses a blank source device in native scheduled logs', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'kent-safety-')); dirs.push(dir);
    await writeFile(join(dir, 'native.csv'), 'Employee ID,Date,Time,Device Name,Attendance Type,Created on\nRML1,06/10/2026,03:30,,out,08-10-2026 04:00\n');
    const c = kentConnectorFromEnv({ KENT_MODE: 'csv', KENT_CSV_DIR: dir });
    await expect(c?.fetchSince(now)).rejects.toThrow(/missing device/);
  });
  it('refuses conflicting minute-precision native directions before dedupe can discard an OUT', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'kent-safety-')); dirs.push(dir);
    await writeFile(join(dir, 'native.csv'), 'Employee ID,Date,Time,Device Name,Attendance Type,Created on\nRML1,06/10/2026,03:30,Gate,in,08-10-2026 04:00\nRML1,06/10/2026,03:30,Gate,out,08-10-2026 04:00\n');
    const c = kentConnectorFromEnv({ KENT_MODE: 'csv', KENT_CSV_DIR: dir });
    await expect(c?.fetchSince(now)).rejects.toThrow(/conflicting.*direction/i);
    await c?.afterIngest?.();
    expect((await readdir(dir)).filter(n => n.endsWith('.csv'))).toEqual(['native.csv']);
  });
});
