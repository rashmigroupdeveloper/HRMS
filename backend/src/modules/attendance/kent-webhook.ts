/**
 * Kent CamAttendance webhook receiver (KENT_RESEARCH §5.1; Kent portal: Settings → Webhooks).
 * Kent POSTs a JSON array of recognition events:
 *   [{ empId, employeeName, time, type (1 recognised / 0 unknown), imageUrl, accountId, companyId,
 *      mode, locationName, deviceName, departmentName, deviceId }]
 * Kent documents no auth, so the URL carries a long secret token (constant-time compared),
 * with an optional IP allow-list and optional shared header. The raw body is stored first,
 * type:0 events go to att.kent_unknown_faces, and recognised events go through ingestOnce
 * (source "kent_webhook"): dedupe makes Kent retries safe, quarantine and unmatched-ecode
 * handling are the same as the pull. receivedAt = arrival time. The scheduled pull/CSV/DB
 * mode stays as the daily catch-up for anything lost while we were down.
 */
import { timingSafeEqual } from 'node:crypto';
import express, { type Request, type Response, type Router } from 'express';
import type { Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { logger } from '../../core/logger.js';
import type { KentConnector, RawSwipe } from './kent-connector.js';
import { kentCommonFromEnv, mapKentRecord } from './kent-http-connector.js';
import { parseKentTime } from './kent-time.js';
import { ingestOnce, type IngestSummary } from './ingest.service.js';

const KENT_WEBHOOK_SOURCE = 'kent_webhook';

export interface KentWebhookConfig {
  token: string;
  allowIps: string[];
  header: { name: string; value: string } | null;
  maxBytes: string;
}

export function kentWebhookConfigFromEnv(env: NodeJS.ProcessEnv = process.env): KentWebhookConfig | null {
  const token = env['KENT_WEBHOOK_TOKEN']?.trim();
  if (!token) return null;
  if (token.length < 24) throw new Error('KENT_WEBHOOK_TOKEN must be at least 24 characters (use: openssl rand -hex 24)');
  const name = env['KENT_WEBHOOK_HEADER']?.trim();
  const value = env['KENT_WEBHOOK_HEADER_VALUE'] ?? '';
  return {
    token,
    allowIps: (env['KENT_WEBHOOK_ALLOW_IPS'] ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    header: name ? { name: name.toLowerCase(), value } : null,
    maxBytes: env['KENT_WEBHOOK_MAX_BYTES'] ?? '5mb',
  };
}

const safeEqual = (a: string, b: string) => { const x = Buffer.from(a); const y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };
const normIp = (ip: string) => ip.replace(/^::ffff:/, '');

class ArrayConnector implements KentConnector {
  constructor(private readonly swipes: RawSwipe[]) {}
  fetchSince(): Promise<RawSwipe[]> { return Promise.resolve(this.swipes); }
  listDevices() { return Promise.resolve([]); }
}

export interface KentWebhookResult { batchId: number; records: number; accepted: number; inserted: number; unknownFaces: number; rejected: number; summary: IngestSummary | null }

/** Process one stored-or-to-store webhook body. Exported for tests and for replaying a stored batch. */
async function processKentWebhook(db: Kysely<Database>, rawBody: string, opts: { remoteIp: string | null; now?: Date; env?: NodeJS.ProcessEnv }): Promise<KentWebhookResult> {
  const now = opts.now ?? new Date();
  const batch = await db.insertInto('att.kent_webhook_batches').values({ raw_body: rawBody, remote_ip: opts.remoteIp, received_at: now }).returning('id').executeTakeFirstOrThrow();
  let parsed: unknown;
  try { parsed = JSON.parse(rawBody); } catch {
    await db.updateTable('att.kent_webhook_batches').set({ error: 'body is not JSON', processed_at: new Date() }).where('id', '=', batch.id).execute();
    throw new KentWebhookBadRequest('Body must be a JSON array of Kent events');
  }
  const list: unknown[] = Array.isArray(parsed) ? parsed : parsed !== null && typeof parsed === 'object' ? [parsed] : [];
  const common = kentCommonFromEnv(opts.env ?? process.env);
  const swipes: RawSwipe[] = [];
  const unknown: Record<string, unknown>[] = [];
  let rejected = 0;
  for (const item of list) {
    if (item === null || typeof item !== 'object') { rejected++; continue; }
    const r = item as Record<string, unknown>;
    const m = mapKentRecord(r, { ...common, now, swipeType: KENT_WEBHOOK_SOURCE });
    if (m.unknownFace) unknown.push(r);
    else if (m.swipe) swipes.push(m.swipe);
    else { rejected++; logger.warn({ batchId: batch.id, reason: m.reason }, 'kent webhook record rejected'); }
  }
  const f = common.fields;
  const s = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v) : null);
  if (unknown.length > 0) {
    await db.insertInto('att.kent_unknown_faces').values(unknown.map((r) => {
      let ts: Date | null = null;
      try { ts = parseKentTime(r[f.time], common.defaultOffset); } catch { ts = null; }
      return { batch_id: batch.id, event_ts: ts, device_id: s(r[f.device]), device_name: s(r[f.deviceName]), location_name: s(r['locationName']), image_url: s(r['imageUrl']), raw: JSON.stringify(r) };
    })).execute();
  }
  let summary: IngestSummary | null = null;
  try {
    if (swipes.length > 0) summary = await ingestOnce(db, new ArrayConnector(swipes), KENT_WEBHOOK_SOURCE);
  } catch (e) {
    await db.updateTable('att.kent_webhook_batches').set({ error: e instanceof Error ? e.message : String(e), records: list.length, unknown_faces: unknown.length, rejected }).where('id', '=', batch.id).execute();
    throw e;
  }
  const result = { batchId: batch.id, records: list.length, accepted: swipes.length, inserted: summary?.inserted ?? 0, unknownFaces: unknown.length, rejected, summary };
  await db.updateTable('att.kent_webhook_batches').set({ records: result.records, accepted: result.accepted, inserted: result.inserted, unknown_faces: result.unknownFaces, rejected, processed_at: new Date() }).where('id', '=', batch.id).execute();
  return result;
}

class KentWebhookBadRequest extends Error {}

/** Express router for POST /api/integrations/kent/webhook/:token (mount before express.json()). */
export function kentWebhookRouter(db: Kysely<Database>, cfg: KentWebhookConfig | null): Router {
  const router = express.Router();
  router.post('/api/integrations/kent/webhook/:token', express.text({ type: () => true, limit: cfg?.maxBytes ?? '5mb' }), (req: Request, res: Response) => {
    const ip = normIp(req.ip ?? '');
    const token = typeof req.params['token'] === 'string' ? req.params['token'] : '';
    if (!cfg || !safeEqual(token, cfg.token)) { res.status(404).json({ error: 'not found' }); return; }
    if (cfg.allowIps.length > 0 && !cfg.allowIps.includes(ip)) { logger.warn({ ip }, 'kent webhook refused: address not allow-listed'); res.status(403).json({ error: 'forbidden' }); return; }
    if (cfg.header) {
      const got = req.headers[cfg.header.name];
      if (typeof got !== 'string' || !safeEqual(got, cfg.header.value)) { res.status(401).json({ error: 'unauthorized' }); return; }
    }
    const body = typeof req.body === 'string' ? req.body : '';
    processKentWebhook(db, body, { remoteIp: ip || null })
      .then((r) => {
        logger.info({ batchId: r.batchId, records: r.records, inserted: r.inserted, unknownFaces: r.unknownFaces, rejected: r.rejected }, 'kent webhook batch');
        res.status(200).json({ ok: true, batchId: r.batchId, received: r.records, accepted: r.accepted, inserted: r.inserted, unknownFaces: r.unknownFaces, rejected: r.rejected });
      })
      .catch((e: unknown) => {
        if (e instanceof KentWebhookBadRequest) { res.status(400).json({ error: e.message }); return; }
        logger.error({ err: e }, 'kent webhook processing failed (raw body kept)');
        res.status(500).json({ error: 'stored but not processed; Kent may retry safely' });
      });
  });
  return router;
}
