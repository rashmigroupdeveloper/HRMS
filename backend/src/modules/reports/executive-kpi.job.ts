/**
 * Nightly executive KPI snapshot generator worker (RPT-03, SOW crosswalk).
 *
 * Runs nightly to compute heavy aggregations off peak hours into `reporting.kpi_daily`.
 * Real-time reads select precomputed rows for zero table scans.
 */
import type { Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { buildKpiSnapshot } from './kpi-snapshot.service.js';

export async function runExecutiveKpiDailyJob(
  db: Kysely<Database>,
  params: { date?: string | undefined } = {},
): Promise<{ snapshotDate: string; metrics: number; timestamp: string }> {
  const result = await buildKpiSnapshot(db, params);
  return {
    ...result,
    timestamp: new Date().toISOString(),
  };
}
