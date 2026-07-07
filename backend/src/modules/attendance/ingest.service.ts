/**
 * Swipe ingestion pipeline (ATT-01/02, docs/02 §4):
 *   watermark − overlap → fetch → ensure partitions → idempotent bulk upsert
 *   → device last_seen → advance watermark (only after commit).
 * Re-running any window NEVER duplicates a swipe (DB unique key), and swipes
 * from unknown employee_nos are kept with employee_id NULL — the exception
 * queue, never silently dropped (the PP-9 lesson).
 */
import { sql, type Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
import type { KentConnector, RawSwipe } from './kent-connector.js';

const OVERLAP_MINUTES = 30;
const EPOCH = new Date('2020-01-01T00:00:00Z');
const CHUNK = 1000;

export interface IngestSummary {
  fetched: number;
  inserted: number;
  unmatchedEmployeeNos: string[];
  watermark: Date | null;
}

export async function ingestOnce(
  db: Kysely<Database>,
  connector: KentConnector,
  source = 'kent',
): Promise<IngestSummary> {
  const wmRow = await db
    .selectFrom('att.ingest_watermarks')
    .select('watermark_ts')
    .where('source', '=', source)
    .executeTakeFirst();
  const since = new Date((wmRow?.watermark_ts ?? EPOCH).getTime() - OVERLAP_MINUTES * 60_000);

  const swipes = await connector.fetchSince(since);
  if (swipes.length === 0) {
    return { fetched: 0, inserted: 0, unmatchedEmployeeNos: [], watermark: wmRow?.watermark_ts ?? null };
  }

  // Resolve employee ids in one pass (unknowns stay NULL → exception queue).
  const ecodes = [...new Set(swipes.map((s) => s.employeeNo))];
  const employees = await db
    .selectFrom('core.employees')
    .select(['id', 'ecode'])
    .where('ecode', 'in', ecodes)
    .execute();
  const idByEcode = new Map(employees.map((e) => [e.ecode, e.id]));
  const unmatched = [...new Set(ecodes.filter((e) => !idByEcode.has(e)))];

  let inserted = 0;
  let maxReceived = wmRow?.watermark_ts ?? EPOCH;

  await db.transaction().execute(async (trx) => {
    // Partitions for every month present in the batch (device backfills cross months).
    const months = [...new Set(swipes.map((s) => s.swipeTs.toISOString().slice(0, 7)))];
    for (const month of months) {
      await sql`SELECT att.ensure_swipe_partition(${`${month}-01`}::date)`.execute(trx);
    }

    for (let i = 0; i < swipes.length; i += CHUNK) {
      const chunk = swipes.slice(i, i + CHUNK);
      const result = await trx
        .insertInto('att.swipe_events')
        .values(
          chunk.map((s: RawSwipe) => ({
            employee_id: idByEcode.get(s.employeeNo) ?? null,
            employee_no: s.employeeNo,
            access_card: s.accessCard ?? null,
            swipe_ts: s.swipeTs,
            door_code: s.doorCode,
            direction: s.direction ?? null,
            swipe_type: s.swipeType ?? null,
            received_at: s.receivedAt,
            source,
          })),
        )
        .onConflict((oc) => oc.columns(['employee_no', 'swipe_ts', 'door_code']).doNothing())
        .executeTakeFirst();
      inserted += Number(result.numInsertedOrUpdatedRows ?? 0n);
    }

    // Device heartbeat: upsert doors + stamp last_seen (gap detection input, ATT-02).
    const byDoor = new Map<string, Date>();
    for (const s of swipes) {
      const prev = byDoor.get(s.doorCode);
      if (!prev || s.receivedAt > prev) byDoor.set(s.doorCode, s.receivedAt);
      if (s.receivedAt > maxReceived) maxReceived = s.receivedAt;
    }
    for (const [doorCode, lastSeen] of byDoor) {
      await trx
        .insertInto('att.devices')
        .values({ door_code: doorCode, source, last_seen_at: lastSeen })
        .onConflict((oc) =>
          oc.column('door_code').doUpdateSet((eb) => ({
            last_seen_at: eb
              .case()
              .when(eb.ref('att.devices.last_seen_at'), 'is', null)
              .then(lastSeen)
              .when(eb.ref('att.devices.last_seen_at'), '<', lastSeen)
              .then(lastSeen)
              .else(eb.ref('att.devices.last_seen_at'))
              .end(),
          })),
        )
        .execute();
    }

    // Watermark advances ONLY inside the same transaction as the data.
    await trx
      .insertInto('att.ingest_watermarks')
      .values({ source, watermark_ts: maxReceived })
      .onConflict((oc) => oc.column('source').doUpdateSet({ watermark_ts: maxReceived, updated_at: new Date() }))
      .execute();
  });

  return { fetched: swipes.length, inserted, unmatchedEmployeeNos: unmatched, watermark: maxReceived };
}

/** Doors silent longer than the threshold during working hours — the PP-9 pager (ATT-02). */
export async function findSilentDevices(
  db: Kysely<Database>,
  asOf: Date,
  thresholdMinutes: number,
): Promise<{ doorCode: string; lastSeenAt: Date | null }[]> {
  const cutoff = new Date(asOf.getTime() - thresholdMinutes * 60_000);
  const rows = await db
    .selectFrom('att.devices')
    .select(['door_code', 'last_seen_at'])
    .where('is_active', '=', true)
    .where((eb) => eb.or([eb('last_seen_at', 'is', null), eb('last_seen_at', '<', cutoff)]))
    .execute();
  return rows.map((r) => ({ doorCode: r.door_code, lastSeenAt: r.last_seen_at }));
}
