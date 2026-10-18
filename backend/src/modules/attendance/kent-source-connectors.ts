/**
 * Kent DB-read and SFTP/CSV-drop modes (KENT_RESEARCH §5.3–5.4), plus the mode-selecting factory.
 *  - DB: read the table Kent's "DB integration" exe writes (the one Greytip Astra reads today).
 *    Read-only, `WHERE <watermark column> > since`. PostgreSQL is built in; MSSQL/MySQL need
 *    their driver behind the same KentDbClient interface (see docs/integrations/KENT.md).
 *  - CSV: a folder that Kent's scheduler or SFTP upload drops files into. Columns are found by
 *    header aliases; files are archived only after the batch commits (afterIngest).
 */
import { mkdir, readdir, readFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import pg from 'pg';
import type { DeviceInfo, KentConnector, RawSwipe } from './kent-connector.js';
import { KentHttpConnector, KentFeedError, kentCommonFromEnv, kentConfigFromEnv, mapKentRecord, type KentFieldMap } from './kent-http-connector.js';

type Row = Record<string, unknown>;
type Env = NodeJS.ProcessEnv;

export interface KentDbClient { query(text: string, params: unknown[]): Promise<{ rows: Row[] }>; end?(): Promise<void> }
export interface KentDbColumns { employeeNo: string; time: string; device: string; card?: string; direction?: string; receivedAt?: string }
export interface KentDbConfig {
  table: string;
  columns: KentDbColumns;
  /** Which column bounds each read: the received/upload column when Kent fills it, else the punch time (with re-read). */
  watermark: 'receivedAt' | 'time';
  rereadDays: number;
  batchSize: number;
  defaultOffset: string;
  deviceMap: Record<string, string>;
}

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)?$/;
const quoteIdent = (s: string): string => {
  if (!IDENT.test(s)) throw new Error(`Unsafe SQL identifier in Kent DB config: ${s}`);
  return s.split('.').map((p) => `"${p}"`).join('.');
};

export class KentDbConnector implements KentConnector {
  constructor(private readonly client: KentDbClient, private readonly cfg: KentDbConfig, private readonly clock: () => Date = () => new Date()) {
    if (cfg.watermark === 'receivedAt' && !cfg.columns.receivedAt) throw new Error('KENT_DB_WATERMARK=receivedAt needs a receivedAt column');
  }

  async fetchSince(since: Date): Promise<RawSwipe[]> {
    const c = this.cfg.columns;
    const now = this.clock();
    const wmCol = this.cfg.watermark === 'receivedAt' && c.receivedAt ? c.receivedAt : c.time;
    let from = since;
    if (this.cfg.watermark === 'time') {
      const floor = new Date(now.getTime() - this.cfg.rereadDays * 86_400_000);
      if (floor < from) from = floor;
    }
    const pick: [keyof KentDbColumns, string][] = Object.entries(c).filter((e): e is [keyof KentDbColumns, string] => typeof e[1] === 'string' && e[1] !== '');
    const select = pick.map(([k, col]) => `${quoteIdent(col)} AS "${k}"`).join(', ');
    const { rows } = await this.client.query(
      `SELECT ${select} FROM ${quoteIdent(this.cfg.table)} WHERE ${quoteIdent(wmCol)} > $1 ORDER BY ${quoteIdent(wmCol)} LIMIT ${String(Math.max(1, Math.trunc(this.cfg.batchSize)))}`,
      [from],
    );
    const fields: KentFieldMap = { employeeNo: 'employeeNo', card: 'card', time: 'time', device: 'device', deviceName: '_none', direction: 'direction', receivedAt: 'receivedAt', type: '_none', deviceLastSeen: '_none', deviceWatermark: '_none' };
    const out: RawSwipe[] = [];
    for (const r of rows) {
      const norm: Row = { ...r };
      for (const k of ['time', 'receivedAt'] as const) { const v = norm[k]; if (v instanceof Date) norm[k] = v.toISOString(); }
      const m = mapKentRecord(norm, { fields, deviceMap: this.cfg.deviceMap, defaultOffset: this.cfg.defaultOffset, now, swipeType: 'kent_db' });
      if (m.swipe) out.push(m.swipe);
    }
    return out;
  }

  listDevices(): Promise<DeviceInfo[]> { return Promise.resolve([]); }
}

// ---------- CSV / SFTP drop ----------
export interface KentCsvConfig {
  dir: string;
  archiveDir: string;
  aliases: Record<'employeeNo' | 'time' | 'device' | 'card' | 'direction' | 'receivedAt', string[]>;
  defaultOffset: string;
  deviceMap: Record<string, string>;
}
const DEFAULT_CSV_ALIASES: KentCsvConfig['aliases'] = {
  employeeNo: ['employee no', 'employee code', 'empid', 'emp id', 'ecode', 'emp code', 'employee id'],
  time: ['swipe date', 'swipe time', 'punch time', 'time', 'date time', 'datetime', 'recognition time', 'log time'],
  device: ['door/address', 'door', 'device id', 'deviceid', 'device name', 'device', 'location name'],
  card: ['access card', 'card no', 'card'],
  direction: ['status', 'direction', 'in/out', 'in out'],
  receivedAt: ['received on', 'received at', 'upload time', 'synced at'],
};

/** RFC-4180-ish CSV parse (quotes, escaped quotes, CRLF); delimiter auto-detected from the header (`,` `;` or tab). */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, '');
  const head = src.split(/\r?\n/, 1)[0] ?? '';
  const delim = [',', ';', '\t'].map((d) => [d, head.split(d).length] as const).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ',';
  const rows: string[][] = [];
  let row: string[] = []; let cell = ''; let q = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src.charAt(i);
    if (q) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}

export class KentCsvDropConnector implements KentConnector {
  private pending: string[] = [];
  constructor(private readonly cfg: KentCsvConfig, private readonly clock: () => Date = () => new Date()) {}

  async fetchSince(): Promise<RawSwipe[]> {
    const names = (await readdir(this.cfg.dir, { withFileTypes: true })).filter((d) => d.isFile() && /\.(csv|txt)$/i.test(d.name)).map((d) => d.name).sort();
    const now = this.clock();
    const out: RawSwipe[] = [];
    this.pending = [];
    for (const name of names) {
      const rows = parseCsv(await readFile(join(this.cfg.dir, name), 'utf8'));
      const header = (rows[0] ?? []).map((h) => h.trim().toLowerCase());
      const col = (k: keyof KentCsvConfig['aliases']) => { for (const a of this.cfg.aliases[k]) { const i = header.indexOf(a); if (i >= 0) return i; } return -1; };
      const idx = { employeeNo: col('employeeNo'), time: col('time'), device: col('device'), card: col('card'), direction: col('direction'), receivedAt: col('receivedAt') };
      if (idx.employeeNo < 0 || idx.time < 0) throw new KentFeedError(`${name}: no employee or time column (header: ${header.join(', ')})`);
      for (const r of rows.slice(1)) {
        const get = (i: number) => (i >= 0 ? (r[i] ?? '').trim() : '');
        const rec: Row = { employeeNo: get(idx.employeeNo), time: get(idx.time), device: get(idx.device) || 'CSV-DROP', card: get(idx.card), direction: get(idx.direction), receivedAt: get(idx.receivedAt) || null };
        const m = mapKentRecord(rec, { fields: { employeeNo: 'employeeNo', card: 'card', time: 'time', device: 'device', deviceName: '_none', direction: 'direction', receivedAt: 'receivedAt', type: '_none', deviceLastSeen: '_none', deviceWatermark: '_none' }, deviceMap: this.cfg.deviceMap, defaultOffset: this.cfg.defaultOffset, now, swipeType: 'kent_csv' });
        if (m.swipe) out.push(m.swipe);
      }
      this.pending.push(name);
    }
    return out;
  }

  listDevices(): Promise<DeviceInfo[]> { return Promise.resolve([]); }

  async afterIngest(): Promise<void> {
    await mkdir(this.cfg.archiveDir, { recursive: true });
    const stamp = this.clock().toISOString().replace(/[:.]/g, '-');
    for (const name of this.pending) await rename(join(this.cfg.dir, name), join(this.cfg.archiveDir, `${stamp}_${name}`));
    this.pending = [];
  }
}

const dbPools = new Map<string, pg.Pool>();

export type KentMode = 'api' | 'db' | 'csv';

export function kentModeFromEnv(env: Env = process.env): KentMode | null {
  const m = (env['KENT_MODE'] ?? '').trim();
  if (m === 'api' || m === 'db' || m === 'csv') return m;
  if (m) throw new Error('KENT_MODE must be api, db or csv');
  if (env['KENT_BASE_URL']?.trim()) return 'api';
  if (env['KENT_DB_URL']?.trim()) return 'db';
  if (env['KENT_CSV_DIR']?.trim()) return 'csv';
  return null;
}

/** Composition root helper: the configured pull connector, or undefined (sync then fails closed). */
export function kentConnectorFromEnv(env: Env = process.env, dbClient?: KentDbClient): KentConnector | undefined {
  const mode = kentModeFromEnv(env);
  const common = kentCommonFromEnv(env);
  if (mode === 'api') { const cfg = kentConfigFromEnv(env); return cfg ? new KentHttpConnector(cfg) : undefined; }
  if (mode === 'db') {
    const url = env['KENT_DB_URL']?.trim();
    const table = env['KENT_DB_TABLE']?.trim();
    if (!url || !table) throw new Error('KENT_MODE=db needs KENT_DB_URL and KENT_DB_TABLE');
    let columns: KentDbColumns;
    try { columns = { employeeNo: 'employee_no', time: 'swipe_time', device: 'door', ...(JSON.parse(env['KENT_DB_COLUMNS'] ?? '{}') as Partial<KentDbColumns>) }; } catch { throw new Error('KENT_DB_COLUMNS must be valid JSON'); }
    const watermark = env['KENT_DB_WATERMARK'] === 'receivedAt' ? 'receivedAt' : 'time';
    let client: KentDbClient | undefined = dbClient ?? dbPools.get(url);
    if (!client) { const pool = new pg.Pool({ connectionString: url, max: 2 }); pool.on('error', () => undefined); dbPools.set(url, pool); client = pool; }
    return new KentDbConnector(client, { table, columns, watermark, rereadDays: Number(env['KENT_REREAD_DAYS'] ?? 3), batchSize: Number(env['KENT_PAGE_SIZE'] ?? 50000), defaultOffset: common.defaultOffset, deviceMap: common.deviceMap });
  }
  if (mode === 'csv') {
    const dir = env['KENT_CSV_DIR']?.trim();
    if (!dir) throw new Error('KENT_MODE=csv needs KENT_CSV_DIR');
    let extra: Partial<KentCsvConfig['aliases']> = {};
    try { extra = JSON.parse(env['KENT_CSV_ALIASES'] ?? '{}') as Partial<KentCsvConfig['aliases']>; } catch { throw new Error('KENT_CSV_ALIASES must be valid JSON'); }
    const aliases = { ...DEFAULT_CSV_ALIASES };
    for (const [k, v] of Object.entries(extra) as [keyof KentCsvConfig['aliases'], string[]][]) aliases[k] = [...v.map((x) => x.toLowerCase()), ...DEFAULT_CSV_ALIASES[k]];
    return new KentCsvDropConnector({ dir, archiveDir: (env['KENT_CSV_ARCHIVE_DIR']?.trim() ?? '') === '' ? join(dir, 'processed') : (env['KENT_CSV_ARCHIVE_DIR'] ?? '').trim(), aliases, defaultOffset: common.defaultOffset, deviceMap: common.deviceMap });
  }
  return undefined;
}
