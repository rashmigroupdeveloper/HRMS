/**
 * Swipe ingestion pipeline (ATT-01/02, docs/02 §4, doc 14 §8):
 *   watermark − overlap → fetch → PLAUSIBILITY QUARANTINE → ensure partitions
 *   → idempotent bulk upsert → device heartbeat → advance watermark (in-txn).
 *
 * Guarantees:
 *  - Re-running any window NEVER duplicates a swipe (DB unique key).
 *  - Unknown employee_nos are kept with employee_id NULL — the exception
 *    queue, never silently dropped (the PP-9 lesson).
 *  - Implausible timestamps (device clock drift/reset — doc 14 §8.4) go to
 *    att.quarantined_swipes for review; they never poison FILO attendance.
 *    Plausibility is judged against received_at (not wall clock), so backfills
 *    and simulations behave identically to live feeds.
 */
import { sql, type Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { getTypedSetting } from '../settings/index.js';
import { enqueueEvent } from '../notifications/index.js';
import type { KentConnector, RawSwipe } from './kent-connector.js';

const OVERLAP_MINUTES = 30;
const EPOCH = new Date('2020-01-01T00:00:00Z');
const CHUNK = 1000;

export interface IngestSummary {
  fetched: number;
  inserted: number;
  quarantined: number;
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

  const fetched = await connector.fetchSince(since);
  if (fetched.length === 0) {
    return { fetched: 0, inserted: 0, quarantined: 0, unmatchedEmployeeNos: [], watermark: wmRow?.watermark_ts ?? null };
  }

  // Plausibility window (policy values — docs/04 §8; admin-tunable via settings).
  const futureMinutes = await getTypedSetting(db, 'att.quarantine_future_minutes', 'number', 10);
  const pastDays = await getTypedSetting(db, 'att.quarantine_past_days', 'number', 45);

  const swipes: RawSwipe[] = [];
  const quarantine: { swipe: RawSwipe; reason: string }[] = [];
  for (const s of fetched) {
    const driftMs = s.swipeTs.getTime() - s.receivedAt.getTime();
    if (driftMs > futureMinutes * 60_000) {
      quarantine.push({ swipe: s, reason: 'future_timestamp' }); // swiped "after" it was received — clock ahead
    } else if (-driftMs > pastDays * 86_400_000) {
      quarantine.push({ swipe: s, reason: 'too_old' }); // e.g. device reset to epoch
    } else {
      swipes.push(s);
    }
  }

  // Resolve employee ids in one pass (unknowns stay NULL → exception queue).
  const ecodes = [...new Set(swipes.map((s) => s.employeeNo))];
  const employees =
    ecodes.length > 0
      ? await db.selectFrom('core.employees').select(['id', 'ecode']).where('ecode', 'in', ecodes).execute()
      : [];
  const idByEcode = new Map(employees.map((e) => [e.ecode, e.id]));
  const unmatched = [...new Set(ecodes.filter((e) => !idByEcode.has(e)))];

  let inserted = 0;
  let maxReceived = wmRow?.watermark_ts ?? EPOCH;
  for (const s of fetched) if (s.receivedAt > maxReceived) maxReceived = s.receivedAt;

  await db.transaction().execute(async (trx) => {
    if (quarantine.length > 0) {
      await trx
        .insertInto('att.quarantined_swipes')
        .values(
          quarantine.map(({ swipe, reason }) => ({
            employee_no: swipe.employeeNo,
            swipe_ts: swipe.swipeTs,
            door_code: swipe.doorCode,
            direction: swipe.direction ?? null,
            swipe_type: swipe.swipeType ?? null,
            received_at: swipe.receivedAt,
            source,
            reason,
          })),
        )
        .onConflict((oc) => oc.columns(['employee_no', 'swipe_ts', 'door_code', 'source']).doNothing())
        .execute();
    }

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

    // Device heartbeat: upsert doors + stamp last_seen (gap detection input,
    // ATT-02). Built from ALL fetched swipes — including quarantined ones —
    // because a door with a drifted clock is still actively delivering data;
    // otherwise it would false-alarm as silent (review att6). received_at is
    // the trustworthy receipt time regardless of the swipe timestamp's drift.
    const byDoor = new Map<string, Date>();
    for (const s of fetched) {
      const prev = byDoor.get(s.doorCode);
      if (!prev || s.receivedAt > prev) byDoor.set(s.doorCode, s.receivedAt);
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

  return { fetched: fetched.length, inserted, quarantined: quarantine.length, unmatchedEmployeeNos: unmatched, watermark: maxReceived };
}

/**
 * Recovery path for quarantined swipes (review F7): after the device clock is
 * fixed (or an over-tight plausibility window is corrected), promote the parked
 * rows into att.swipe_events and mark them reviewed. Idempotent — the swipe
 * unique key ignores anything already ingested. Without this the migration's
 * "review… and re-ingest" promise had no implementation and quarantined rows
 * were a dead-end once the watermark passed them.
 */
export async function reingestQuarantined(
  db: Kysely<Database>,
  ids?: number[],
): Promise<{ promoted: number; reviewed: number }> {
  let promoted = 0;
  let reviewed = 0;

  await db.transaction().execute(async (trx) => {
    let q = trx.selectFrom('att.quarantined_swipes').selectAll().where('reviewed', '=', false);
    if (ids && ids.length > 0) q = q.where('id', 'in', ids);
    const rows = await q.execute();
    if (rows.length === 0) return;

    const ecodes = [...new Set(rows.map((r) => r.employee_no))];
    const employees = await trx.selectFrom('core.employees').select(['id', 'ecode']).where('ecode', 'in', ecodes).execute();
    const idByEcode = new Map(employees.map((e) => [e.ecode, e.id]));

    const months = [...new Set(rows.map((r) => r.swipe_ts.toISOString().slice(0, 7)))];
    for (const month of months) {
      await sql`SELECT att.ensure_swipe_partition(${`${month}-01`}::date)`.execute(trx);
    }

    const result = await trx
      .insertInto('att.swipe_events')
      .values(
        rows.map((r) => ({
          employee_id: idByEcode.get(r.employee_no) ?? null,
          employee_no: r.employee_no,
          swipe_ts: r.swipe_ts,
          door_code: r.door_code,
          direction: r.direction,
          swipe_type: r.swipe_type,
          received_at: r.received_at,
          source: r.source,
        })),
      )
      .onConflict((oc) => oc.columns(['employee_no', 'swipe_ts', 'door_code']).doNothing())
      .executeTakeFirst();
    promoted = Number(result.numInsertedOrUpdatedRows ?? 0n);

    const marked = await trx
      .updateTable('att.quarantined_swipes')
      .set({ reviewed: true })
      .where('id', 'in', rows.map((r) => r.id))
      .executeTakeFirst();
    reviewed = Number(marked.numUpdatedRows);
  });

  return { promoted, reviewed };
}

export interface SilentDevice {
  doorCode: string;
  lastSeenAt: Date | null;
}

/** Doors silent longer than the threshold — the PP-9 pager input (ATT-02). */
export async function findSilentDevices(
  db: Kysely<Database>,
  asOf: Date,
  thresholdMinutes: number,
): Promise<SilentDevice[]> {
  const cutoff = new Date(asOf.getTime() - thresholdMinutes * 60_000);
  const rows = await db
    .selectFrom('att.devices')
    .select(['door_code', 'last_seen_at'])
    .where('is_active', '=', true)
    .where((eb) => eb.or([eb('last_seen_at', 'is', null), eb('last_seen_at', '<', cutoff)]))
    .execute();
  return rows.map((r) => ({ doorCode: r.door_code, lastSeenAt: r.last_seen_at }));
}

/**
 * TRANSITION-based silent-door alerting (ATT-02): notify once when a door goes
 * quiet — not every 5-minute cycle — and re-arm automatically once it's seen
 * again (alerted_silent_at < last_seen_at). Recipients come from the
 * wf.event_subscriptions matrix ('attendance.device_silent' → it_admin per
 * PP-9: "must page someone, not silently under-count").
 */
export async function alertSilentDevices(db: Kysely<Database>, asOf = new Date()): Promise<string[]> {
  const thresholdMinutes = await getTypedSetting(db, 'att.device_silent_minutes', 'number', 15);
  const cutoff = new Date(asOf.getTime() - thresholdMinutes * 60_000);

  const toAlert = await db
    .selectFrom('att.devices')
    .select(['id', 'door_code', 'last_seen_at'])
    .where('is_active', '=', true)
    .where((eb) => eb.or([eb('last_seen_at', 'is', null), eb('last_seen_at', '<', cutoff)]))
    .where((eb) =>
      eb.or([
        eb('alerted_silent_at', 'is', null),
        eb('alerted_silent_at', '<', eb.ref('last_seen_at')), // seen since last alert → re-armed
      ]),
    )
    .execute();

  const alerted: string[] = [];
  for (const device of toAlert) {
    await enqueueEvent(db, 'attendance.device_silent', 'device_silent', {
      doorCode: device.door_code,
      lastSeenAt: device.last_seen_at?.toISOString() ?? null,
      thresholdMinutes,
    });
    await db.updateTable('att.devices').set({ alerted_silent_at: asOf }).where('id', '=', device.id).execute();
    alerted.push(device.door_code);
  }
  return alerted;
}
