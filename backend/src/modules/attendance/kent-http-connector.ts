/**
 * KentHttpConnector — the production Kent feed adapter (handover item 7, owner's acceptance bar).
 * It speaks a small, documented HTTP contract (docs/integrations/KENT.md); the field names,
 * device→door mapping and timezone are configuration, so attaching the real Kent API is
 * config (or a thin field map), not code. Dedupe, quarantine, unmatched-ecode logging,
 * watermarking and recompute stay in the shared pipeline (ingest.service.ts).
 */
import type { DeviceInfo, KentConnector, RawSwipe } from './kent-connector.js';

export interface KentFieldMap {
  employeeNo: string; card: string; time: string; device: string; direction: string;
  receivedAt: string; deviceLastSeen: string; deviceWatermark: string;
}
export interface KentHttpConfig {
  baseUrl: string;
  apiKey: string;
  apiKeyHeader: string;
  pageSize: number;
  timeoutMs: number;
  maxRetries: number;
  /** Offset applied to device times that carry no zone, e.g. +05:30. */
  defaultOffset: string;
  /** Kent device id → HRMS door code (att.devices.door_code). Unmapped ids pass through. */
  deviceMap: Record<string, string>;
  fields: KentFieldMap;
}

const DEFAULT_FIELDS: KentFieldMap = {
  employeeNo: 'employeeNo', card: 'cardNo', time: 'punchTime', device: 'deviceId', direction: 'direction',
  receivedAt: 'receivedAt', deviceLastSeen: 'lastSeen', deviceWatermark: 'completeThrough',
};

/** Build config from env; returns null when KENT_BASE_URL is unset (integration not attached). */
export function kentConfigFromEnv(env: NodeJS.ProcessEnv = process.env): KentHttpConfig | null {
  const baseUrl = env['KENT_BASE_URL']?.trim();
  if (!baseUrl) return null;
  const apiKey = env['KENT_API_KEY'] ?? '';
  if (!apiKey) throw new Error('KENT_API_KEY is required when KENT_BASE_URL is set');
  const json = <T>(name: string, fallback: T): T => {
    const raw = env[name];
    if (!raw) return fallback;
    try { return JSON.parse(raw) as T; } catch { throw new Error(`${name} must be valid JSON`); }
  };
  return {
    baseUrl: baseUrl.replace(/\/+$/, ''),
    apiKey,
    apiKeyHeader: env['KENT_API_KEY_HEADER'] ?? 'X-API-Key',
    pageSize: Number(env['KENT_PAGE_SIZE'] ?? 1000),
    timeoutMs: Number(env['KENT_TIMEOUT_MS'] ?? 15000),
    maxRetries: Number(env['KENT_MAX_RETRIES'] ?? 3),
    defaultOffset: env['KENT_DEFAULT_OFFSET'] ?? '+05:30',
    deviceMap: json<Record<string, string>>('KENT_DEVICE_MAP', {}),
    fields: { ...DEFAULT_FIELDS, ...json<Partial<KentFieldMap>>('KENT_FIELD_MAP', {}) },
  };
}

type Fetch = (url: string, init: { headers: Record<string, string>; signal: AbortSignal }) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;
type Row = Record<string, unknown>;

export class KentFeedError extends Error {}

export class KentHttpConnector implements KentConnector {
  constructor(
    private readonly cfg: KentHttpConfig,
    private readonly fetchImpl: Fetch = fetch,
    private readonly sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
  ) {}

  /** Parse a device time; zone-less values get the configured offset. */
  parseTime(v: unknown): Date {
    const s = typeof v === 'string' ? v.trim() : typeof v === 'number' ? new Date(v).toISOString() : '';
    const withZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(s) ? s : `${s.replace(' ', 'T')}${this.cfg.defaultOffset}`;
    const d = new Date(withZone);
    if (Number.isNaN(d.getTime())) throw new KentFeedError(`Unreadable Kent time: ${String(v)}`);
    return d;
  }

  private async get(path: string): Promise<Row> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.cfg.maxRetries; attempt++) {
      if (attempt > 0) await this.sleep(Math.min(30_000, 500 * 2 ** (attempt - 1)));
      const ctrl = new AbortController();
      const timer = setTimeout(() => { ctrl.abort(); }, this.cfg.timeoutMs);
      try {
        const res = await this.fetchImpl(`${this.cfg.baseUrl}${path}`, { headers: { [this.cfg.apiKeyHeader]: this.cfg.apiKey, Accept: 'application/json' }, signal: ctrl.signal });
        if (res.ok) return (await res.json()) as Row;
        lastError = new KentFeedError(`Kent ${path} answered HTTP ${String(res.status)}`);
        if (res.status < 500 && res.status !== 429) throw lastError; // 4xx (bad key, bad request) is not retried
      } catch (e) {
        if (e instanceof KentFeedError && !/HTTP (5\d\d|429)/.test(e.message)) throw e;
        lastError = e;
      } finally { clearTimeout(timer); }
    }
    throw new KentFeedError(`Kent ${path} failed after ${String(this.cfg.maxRetries + 1)} attempts: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
  }

  async fetchSince(since: Date): Promise<RawSwipe[]> {
    const f = this.cfg.fields;
    const out: RawSwipe[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < 10_000; page++) {
      const q = new URLSearchParams({ since: since.toISOString(), limit: String(this.cfg.pageSize) });
      if (cursor) q.set('cursor', cursor);
      const body = await this.get(`/punches?${q.toString()}`);
      const items = Array.isArray(body['items']) ? (body['items'] as Row[]) : [];
      const now = new Date();
      for (const r of items) {
        const employeeNo = typeof r[f.employeeNo] === 'string' || typeof r[f.employeeNo] === 'number' ? String(r[f.employeeNo]).trim().toUpperCase() : '';
        const device = typeof r[f.device] === 'string' || typeof r[f.device] === 'number' ? String(r[f.device]) : '';
        if (!employeeNo || !device) continue; // malformed rows are skipped; the pipeline logs unmatched ecodes
        const rawDir = r[f.direction];
        const dir = typeof rawDir === 'string' ? rawDir.toLowerCase() : '';
        const card = r[f.card];
        out.push({
          employeeNo,
          ...(typeof card === 'string' && card ? { accessCard: card } : {}),
          swipeTs: this.parseTime(r[f.time]),
          doorCode: this.cfg.deviceMap[device] ?? device,
          ...(dir === 'in' || dir === 'out' ? { direction: dir } : {}),
          swipeType: 'kent',
          receivedAt: r[f.receivedAt] !== undefined && r[f.receivedAt] !== null ? this.parseTime(r[f.receivedAt]) : now,
        });
      }
      cursor = typeof body['nextCursor'] === 'string' && body['nextCursor'] ? body['nextCursor'] : null;
      if (!cursor || items.length === 0) return out;
    }
    throw new KentFeedError('Kent pagination did not terminate');
  }

  async listDevices(): Promise<DeviceInfo[]> {
    const f = this.cfg.fields;
    const body = await this.get('/devices');
    const items = Array.isArray(body['items']) ? (body['items'] as Row[]) : [];
    return items.flatMap((r): DeviceInfo[] => {
      const id = r[f.device];
      if (typeof id !== 'string' && typeof id !== 'number') return [];
      const seen = r[f.deviceLastSeen];
      const wm = r[f.deviceWatermark];
      const lastContactAt = seen ? this.parseTime(seen) : undefined;
      // A watermark is only trusted together with a contact receipt (pipeline invariant).
      const watermarkTs = wm && lastContactAt ? this.parseTime(wm) : undefined;
      return [{ doorCode: this.cfg.deviceMap[String(id)] ?? String(id), ...(lastContactAt ? { lastContactAt } : {}), ...(watermarkTs && lastContactAt && watermarkTs <= lastContactAt ? { watermarkTs } : {}) }];
    });
  }
}

/** Composition root helper: the configured connector, or undefined (sync then fails closed). */
export function kentConnectorFromEnv(env: NodeJS.ProcessEnv = process.env): KentConnector | undefined {
  const cfg = kentConfigFromEnv(env);
  return cfg ? new KentHttpConnector(cfg) : undefined;
}
