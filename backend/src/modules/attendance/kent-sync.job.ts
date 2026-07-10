/**
 * The kent-sync job body (P1-T01): one scheduled cycle = ingest → silent-door
 * alert sweep. Runs every 5 minutes under pg-boss (src/jobs/worker.ts) and on
 * demand via the syncNow procedure.
 *
 * Until IT confirms the real access method (P0-T01), the connector is the
 * deterministic MOCK simulating today's swipes for every active employee —
 * the swap to KentDbView/KentRestApi/KentCsvDrop touches ONLY connectorFor().
 */
import type { Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { logger } from '../../core/logger.js';
import { MockKentConnector, type KentConnector } from './kent-connector.js';
import { alertSilentDevices, ingestOnce, type IngestSummary } from './ingest.service.js';
import { drainRecomputeQueue } from './day-status.service.js';

export const KENT_SOURCE = 'kent';

async function connectorFor(db: Kysely<Database>): Promise<KentConnector> {
  // Mock feed: today's simulated punches for every active employee, seeded by
  // the date so repeated cycles within a day are consistent (and idempotent).
  const employees = await db
    .selectFrom('core.employees')
    .select('ecode')
    .where('status', 'in', ['onboarding', 'active'])
    .limit(10_000)
    .execute();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new MockKentConnector({
    employeeNos: employees.map((e) => e.ecode),
    day: today,
    seed: Math.floor(today.getTime() / 86_400_000),
  });
}

export interface KentSyncResult extends IngestSummary {
  silentDoorsAlerted: string[];
  daysRecomputed: number;
}

export async function runKentSync(db: Kysely<Database>): Promise<KentSyncResult> {
  const connector = await connectorFor(db);
  const summary = await ingestOnce(db, connector, KENT_SOURCE);
  const silentDoorsAlerted = await alertSilentDevices(db);
  // Fresh swipes dirty their days (DB trigger); recompute right away so
  // processed attendance stays ≤5 min behind raw truth (ATT-03).
  const daysRecomputed = await drainRecomputeQueue(db);

  logger.info(
    {
      fetched: summary.fetched,
      inserted: summary.inserted,
      quarantined: summary.quarantined,
      unmatched: summary.unmatchedEmployeeNos.length,
      silentDoorsAlerted,
      daysRecomputed,
    },
    'kent-sync cycle complete',
  );
  return { ...summary, silentDoorsAlerted, daysRecomputed };
}
