/**
 * Kent CamAttendance feed adapters (handover item 7; KENT_RESEARCH.md §5).
 * Kent's pull API is token-based and often custom per client, so every part of the request
 * is configuration: path, query parameter names, paging style, the item path in the response,
 * and the auth scheme. Record field names default to Kent's documented webhook names
 * (empId, time, deviceId, deviceName, type). Dedupe, quarantine, unmatched-ecode logging,
 * watermarks and recompute stay in the shared pipeline (ingest.service.ts).
 */
import type { DeviceInfo, KentConnector, RawSwipe } from './kent-connector.js';
import { KentTimeError, parseKentTime } from './kent-time.js';

export interface KentFieldMap {
  employeeNo: string; card: string; time: string; device: string; deviceName: string; direction: string;
  receivedAt: string; type: string; deviceLastSeen: string; deviceWatermark: string;
}
export const DEFAULT_KENT_FIELDS: KentFieldMap = {
  employeeNo: 'empId', card: 'cardNo', time: 'time', device: 'deviceId', deviceName: 'deviceName', direction: 'direction',
  receivedAt: 'receivedAt', type: 'type', deviceLastSeen: 'lastSeen', deviceWatermark: 'completeThrough',
};

export type KentAuth = 'header' | 'bearer' | 'query' | 'login' | 'none';
export type KentPaging = 'cursor' | 'page' | 'offset' | 'none';
export type KentSinceFormat = 'iso' | 'epoch_s' | 'epoch_ms' | 'local';

export interface KentHttpConfig {
  baseUrl: string;
  auth: KentAuth;
  apiKey: string;
  apiKeyHeader: string;
  apiKeyQuery: string;
  loginPath: string;
  loginBody: Record<string, unknown>;
  loginTokenPath: string;
  pullPath: string;
  /** Empty = Kent exposes no device list; device health then comes from the silent-door heuristic. */
  devicesPath: string;
  paging: KentPaging;
  query: { since: string; until: string; limit: string; cursor: string; page: string };
  pageStart: number;
  sinceFormat: KentSinceFormat;
  itemsPath: string;
  nextCursorPath: string;
  /** Re-read at least this many days back every pull (buffered offline devices upload late; PP-9). */
  rereadDays: number;
  pageSize: number;
  timeoutMs: number;
  maxRetries: number;
  defaultOffset: string;
  deviceMap: Record<string, string>;
  fields: KentFieldMap;
}

type Env = NodeJS.ProcessEnv;
function jsonEnv<T>(env: Env, name: string, fallback: T): T {
  const raw = env[name];
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { throw new Error(`${name} must be valid JSON`); }
}
function oneOf<T extends string>(env: Env, name: string, allowed: readonly T[], fallback: T): T {
  const v = (env[name] ?? '').trim();
  if (!v) return fallback;
  if (!(allowed as readonly string[]).includes(v)) throw new Error(`${name} must be one of ${allowed.join(', ')}`);
  return v as T;
}
const str = (env: Env, name: string, fallback: string) => env[name] ?? fallback;

/** Shared record settings for every Kent mode. */
export function kentCommonFromEnv(env: Env = process.env): { defaultOffset: string; deviceMap: Record<string, string>; fields: KentFieldMap } {
  return {
    defaultOffset: str(env, 'KENT_DEFAULT_OFFSET', '+05:30'),
    deviceMap: jsonEnv<Record<string, string>>(env, 'KENT_DEVICE_MAP', {}),
    fields: { ...DEFAULT_KENT_FIELDS, ...jsonEnv<Partial<KentFieldMap>>(env, 'KENT_FIELD_MAP', {}) },
  };
}

/** API pull config from env; null when KENT_BASE_URL is unset. */
export function kentConfigFromEnv(env: Env = process.env): KentHttpConfig | null {
  const baseUrl = env['KENT_BASE_URL']?.trim();
  if (!baseUrl) return null;
  const auth = oneOf<KentAuth>(env, 'KENT_AUTH', ['header', 'bearer', 'query', 'login', 'none'], 'header');
  const apiKey = env['KENT_API_KEY'] ?? '';
  if ((auth === 'header' || auth === 'bearer' || auth === 'query') && !apiKey) throw new Error('KENT_API_KEY is required for KENT_AUTH=' + auth);
  if (auth === 'login' && !env['KENT_LOGIN_PATH']) throw new Error('KENT_LOGIN_PATH is required for KENT_AUTH=login');
  return {
    baseUrl: baseUrl.replace(/\/+$/, ''),
    auth, apiKey,
    apiKeyHeader: str(env, 'KENT_API_KEY_HEADER', 'X-API-Key'),
    apiKeyQuery: str(env, 'KENT_API_KEY_QUERY', 'token'),
    loginPath: str(env, 'KENT_LOGIN_PATH', ''),
    loginBody: jsonEnv<Record<string, unknown>>(env, 'KENT_LOGIN_BODY', {}),
    loginTokenPath: str(env, 'KENT_LOGIN_TOKEN_PATH', 'token'),
    pullPath: str(env, 'KENT_PULL_PATH', '/punches'),
    devicesPath: str(env, 'KENT_DEVICES_PATH', ''),
    paging: oneOf<KentPaging>(env, 'KENT_PAGING', ['cursor', 'page', 'offset', 'none'], 'cursor'),
    query: {
      since: str(env, 'KENT_Q_SINCE', 'since'), until: str(env, 'KENT_Q_UNTIL', ''), limit: str(env, 'KENT_Q_LIMIT', 'limit'),
      cursor: str(env, 'KENT_Q_CURSOR', 'cursor'), page: str(env, 'KENT_Q_PAGE', 'page'),
    },
    pageStart: Number(env['KENT_PAGE_START'] ?? 1),
    sinceFormat: oneOf<KentSinceFormat>(env, 'KENT_SINCE_FORMAT', ['iso', 'epoch_s', 'epoch_ms', 'local'], 'iso'),
    itemsPath: str(env, 'KENT_ITEMS_PATH', 'items'),
    nextCursorPath: str(env, 'KENT_NEXT_CURSOR_PATH', 'nextCursor'),
    rereadDays: Number(env['KENT_REREAD_DAYS'] ?? 3),
    pageSize: Number(env['KENT_PAGE_SIZE'] ?? 1000),
    timeoutMs: Number(env['KENT_TIMEOUT_MS'] ?? 15000),
    maxRetries: Number(env['KENT_MAX_RETRIES'] ?? 3),
    ...kentCommonFromEnv(env),
  };
}

type Row = Record<string, unknown>;
/** Dot-path lookup ("data.records"); "" or "." means the value itself. */
export function atPath(v: unknown, path: string): unknown {
  if (!path || path === '.') return v;
  let cur: unknown = v;
  for (const k of path.split('.')) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Row)[k];
  }
  return cur;
}

export class KentFeedError extends Error {}

export interface MappedKentRecord { swipe: RawSwipe | null; unknownFace: boolean; reason?: string }

/**
 * One Kent record → RawSwipe. `type: 0` (unknown face) is never a swipe. Direction is optional
 * (Kent sends none; FILO applies). receivedAt falls back to `now` (arrival time).
 */
export function mapKentRecord(r: Row, opts: { fields: KentFieldMap; deviceMap: Record<string, string>; defaultOffset: string; now: Date; swipeType: string }): MappedKentRecord {
  const f = opts.fields;
  const scalar = (k: string) => { const v = r[k]; return typeof v === 'string' || typeof v === 'number' ? String(v).trim() : ''; };
  const type = r[f.type];
  if (type === 0 || type === '0') return { swipe: null, unknownFace: true };
  const employeeNo = scalar(f.employeeNo).toUpperCase();
  const deviceId = scalar(f.device);
  const deviceName = scalar(f.deviceName);
  const door = (deviceId ? opts.deviceMap[deviceId] : undefined) ?? (deviceName ? opts.deviceMap[deviceName] : undefined) ?? (deviceId || deviceName);
  if (!employeeNo) return { swipe: null, unknownFace: false, reason: 'missing employee code' };
  if (!door) return { swipe: null, unknownFace: false, reason: 'missing device' };
  let swipeTs: Date; let receivedAt = opts.now;
  try {
    swipeTs = parseKentTime(r[f.time], opts.defaultOffset);
    const rec = r[f.receivedAt];
    if (rec !== undefined && rec !== null && rec !== '') receivedAt = parseKentTime(rec, opts.defaultOffset);
  } catch (e) { return { swipe: null, unknownFace: false, reason: e instanceof KentTimeError ? e.message : 'bad time' }; }
  const dir = scalar(f.direction).toLowerCase();
  const card = scalar(f.card);
  return {
    unknownFace: false,
    swipe: {
      employeeNo, swipeTs, doorCode: door, receivedAt, swipeType: opts.swipeType,
      ...(card ? { accessCard: card } : {}),
      ...(dir === 'in' || dir === 'out' ? { direction: dir } : {}),
    },
  };
}

type Fetch = (url: string, init: { method?: string; headers: Record<string, string>; body?: string; signal: AbortSignal }) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

export class KentHttpConnector implements KentConnector {
  private token: string | null = null;
  constructor(
    private readonly cfg: KentHttpConfig,
    private readonly fetchImpl: Fetch = fetch,
    private readonly sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
    private readonly clock: () => Date = () => new Date(),
  ) {}

  /** Parse a device time (seconds/ms epoch, ISO, "DD MMM YYYY HH:mm:ss"); zone-less values get the configured offset. */
  parseTime(v: unknown): Date {
    try { return parseKentTime(v, this.cfg.defaultOffset); } catch (e) { throw new KentFeedError(e instanceof Error ? e.message : String(e)); }
  }

  private formatSince(d: Date): string {
    switch (this.cfg.sinceFormat) {
      case 'epoch_s': return String(Math.floor(d.getTime() / 1000));
      case 'epoch_ms': return String(d.getTime());
      case 'local': {
        const [sign, hh = '0', mm = '0'] = /^([+-])(\d{2}):?(\d{2})$/.exec(this.cfg.defaultOffset)?.slice(1) ?? ['+'];
        const ms = (sign === '-' ? -1 : 1) * (Number(hh) * 60 + Number(mm)) * 60_000;
        return new Date(d.getTime() + ms).toISOString().slice(0, 19).replace('T', ' ');
      }
      default: return d.toISOString();
    }
  }

  private async login(): Promise<string> {
    const body = await this.request('POST', this.cfg.loginPath, JSON.stringify(this.cfg.loginBody), false);
    const t = atPath(body, this.cfg.loginTokenPath);
    if (typeof t !== 'string' || !t) throw new KentFeedError(`Kent login answered without a token at "${this.cfg.loginTokenPath}"`);
    this.token = t;
    return t;
  }

  private async authHeaders(path: string): Promise<{ headers: Record<string, string>; path: string }> {
    const c = this.cfg;
    if (c.auth === 'header') return { headers: { [c.apiKeyHeader]: c.apiKey }, path };
    if (c.auth === 'bearer') return { headers: { Authorization: `Bearer ${c.apiKey}` }, path };
    if (c.auth === 'query') return { headers: {}, path: `${path}${path.includes('?') ? '&' : '?'}${encodeURIComponent(c.apiKeyQuery)}=${encodeURIComponent(c.apiKey)}` };
    if (c.auth === 'login') return { headers: { Authorization: `Bearer ${this.token ?? (await this.login())}` }, path };
    return { headers: {}, path };
  }

  private async request(method: string, rawPath: string, body: string | undefined, withAuth = true): Promise<unknown> {
    let lastError: unknown;
    let relogged = false;
    for (let attempt = 0; attempt <= this.cfg.maxRetries; attempt++) {
      if (attempt > 0) await this.sleep(Math.min(30_000, 500 * 2 ** (attempt - 1)));
      const { headers, path } = withAuth ? await this.authHeaders(rawPath) : { headers: {}, path: rawPath };
      const ctrl = new AbortController();
      const timer = setTimeout(() => { ctrl.abort(); }, this.cfg.timeoutMs);
      try {
        const res = await this.fetchImpl(`${this.cfg.baseUrl}${path}`, {
          method, headers: { ...headers, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
          ...(body ? { body } : {}), signal: ctrl.signal,
        });
        if (res.ok) return await res.json();
        if (res.status === 401 && withAuth && this.cfg.auth === 'login' && !relogged) { relogged = true; this.token = null; attempt--; continue; }
        lastError = new KentFeedError(`Kent ${rawPath} answered HTTP ${String(res.status)}`);
        if (res.status < 500 && res.status !== 429) throw lastError;
      } catch (e) {
        if (e instanceof KentFeedError && !/HTTP (5\d\d|429)/.test(e.message)) throw e;
        lastError = e;
      } finally { clearTimeout(timer); }
    }
    throw new KentFeedError(`Kent ${rawPath} failed after ${String(this.cfg.maxRetries + 1)} attempts: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
  }

  async fetchSince(since: Date): Promise<RawSwipe[]> {
    const c = this.cfg;
    const now = this.clock();
    const floor = new Date(now.getTime() - c.rereadDays * 86_400_000);
    const from = c.rereadDays > 0 && floor < since ? floor : since;
    const out: RawSwipe[] = [];
    let cursor: string | null = null;
    let page = c.pageStart;
    let offset = 0;
    for (let i = 0; i < 10_000; i++) {
      const q = new URLSearchParams();
      if (c.query.since) q.set(c.query.since, this.formatSince(from));
      if (c.query.until) q.set(c.query.until, this.formatSince(now));
      if (c.paging !== 'none' && c.query.limit) q.set(c.query.limit, String(c.pageSize));
      if (c.paging === 'cursor' && cursor) q.set(c.query.cursor, cursor);
      if (c.paging === 'page') q.set(c.query.page, String(page));
      if (c.paging === 'offset') q.set(c.query.page, String(offset));
      const qs = q.toString();
      const body = await this.request('GET', `${c.pullPath}${qs ? (c.pullPath.includes('?') ? '&' : '?') + qs : ''}`, undefined);
      const rawItems = atPath(body, c.itemsPath);
      if (!Array.isArray(rawItems)) throw new KentFeedError(`Kent response has no array at "${c.itemsPath}"`);
      const items = rawItems as Row[];
      for (const r of items) {
        const m = mapKentRecord(r, { fields: c.fields, deviceMap: c.deviceMap, defaultOffset: c.defaultOffset, now, swipeType: 'kent' });
        if (m.swipe) out.push(m.swipe);
        else if (m.reason?.startsWith('Unreadable')) throw new KentFeedError(m.reason);
      }
      if (c.paging === 'none' || items.length === 0) return out;
      if (c.paging === 'cursor') {
        const next = atPath(body, c.nextCursorPath);
        cursor = (typeof next === 'string' || typeof next === 'number') && String(next) ? String(next) : null;
        if (!cursor) return out;
      } else {
        if (items.length < c.pageSize) return out;
        page++; offset += items.length;
      }
    }
    throw new KentFeedError('Kent pagination did not terminate');
  }

  async listDevices(): Promise<DeviceInfo[]> {
    const c = this.cfg;
    if (!c.devicesPath) return [];
    const f = c.fields;
    const body = await this.request('GET', c.devicesPath, undefined);
    const raw = atPath(body, c.itemsPath);
    const items = Array.isArray(raw) ? (raw as Row[]) : [];
    return items.flatMap((r): DeviceInfo[] => {
      const id = r[f.device];
      if (typeof id !== 'string' && typeof id !== 'number') return [];
      const seen = r[f.deviceLastSeen];
      const wm = r[f.deviceWatermark];
      const lastContactAt = seen ? this.parseTime(seen) : undefined;
      const watermarkTs = wm && lastContactAt ? this.parseTime(wm) : undefined;
      return [{ doorCode: c.deviceMap[String(id)] ?? String(id), ...(lastContactAt ? { lastContactAt } : {}), ...(watermarkTs && lastContactAt && watermarkTs <= lastContactAt ? { watermarkTs } : {}) }];
    });
  }
}
