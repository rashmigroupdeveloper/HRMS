/**
 * The kent-sync job body (P1-T01): one scheduled cycle = ingest → silent-door
 * alert sweep. Runs every 5 minutes under pg-boss (src/jobs/worker.ts) and on
 * demand via the syncNow procedure.
 *
 * A verified adapter must be supplied by the composition root. P0-T01 has not
 * settled the real protocol, so normal execution fails explicitly. Mock feeds
 * are test-only inputs and never selected from employee-master data.
 */
import type { Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { logger } from '../../core/logger.js';
import { type KentConnector } from './kent-connector.js';
import { alertSilentDevices, ingestOnce, type IngestSummary } from './ingest.service.js';
import { drainRecomputeQueue } from './day-status.service.js';

export const KENT_SOURCE = 'kent';

export class KentIntegrationUnavailable extends Error {
  constructor() {
    super('Kent integration is not configured. No swipes were generated or ingested.');
  }
}

export interface KentSyncResult extends IngestSummary {
  silentDoorsAlerted: string[];
  daysRecomputed: number;
}

export async function runKentSync(
  db: Kysely<Database>,
  connector?: KentConnector,
  source = KENT_SOURCE,
): Promise<KentSyncResult> {
  // Until a verified real adapter is wired at the composition root, normal
  // API/worker calls fail before touching data. Tests inject their own feed.
  if (!connector) throw new KentIntegrationUnavailable();
  const summary = await ingestOnce(db, connector, source);
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
