/** PAY-03/CORE-10: run summary reads; monetary numbers are display-only. */
import { sql, type Kysely } from 'kysely';
import type { Database } from '../../../core/db/types.js';
import { formatDbDate } from '../../../core/dates.js';

export interface RunSummary {
  id: number;
  companyId: number;
  month: string;
  runType: string;
  status: string;
  attendanceLockId: number | null;
  computedAt: string | null;
  approvedAt: string | null;
  approvedBy: number | null;
  finalizedAt: string | null;
  finalizedBy: number | null;
  employeeCount: number;
  grossRupees: number;
  totalDeductionsRupees: number;
  netPayRupees: number;
}

/**
 * One aggregate query for any number of runs (no N+1 per run — the list stays
 * flat as months and entities accumulate).
 */
async function readSummaries(db: Kysely<Database>, filter: { runId?: number; companyId?: number }): Promise<RunSummary[]> {
  let query = db
    .selectFrom('pay.payroll_runs as r')
    .leftJoin('pay.payroll_items as i', 'i.run_id', 'r.id')
    .select([
      'r.id', 'r.company_id', 'r.month', 'r.run_type', 'r.status', 'r.attendance_lock_id',
      'r.computed_at', 'r.approved_at', 'r.approved_by', 'r.finalized_at', 'r.finalized_by',
      sql<number>`count(i.id)::int`.as('count'),
      sql<number>`coalesce(sum(i.gross), 0)::float`.as('sum_gross'),
      sql<number>`coalesce(sum(i.total_deductions), 0)::float`.as('sum_deductions'),
      sql<number>`coalesce(sum(i.net_pay), 0)::float`.as('sum_net'),
    ])
    .groupBy('r.id');
  if (filter.runId !== undefined) query = query.where('r.id', '=', filter.runId);
  if (filter.companyId !== undefined) query = query.where('r.company_id', '=', filter.companyId);
  const rows = await query.orderBy('r.month', 'desc').orderBy('r.id', 'desc').execute();
  const iso = (d: Date | null) => (d ? d.toISOString() : null);
  return rows.map((r) => ({
    id: r.id,
    companyId: r.company_id,
    month: formatDbDate(r.month),
    runType: r.run_type,
    status: r.status,
    attendanceLockId: r.attendance_lock_id,
    computedAt: iso(r.computed_at),
    approvedAt: iso(r.approved_at),
    approvedBy: r.approved_by,
    finalizedAt: iso(r.finalized_at),
    finalizedBy: r.finalized_by,
    employeeCount: r.count,
    grossRupees: r.sum_gross,
    totalDeductionsRupees: r.sum_deductions,
    netPayRupees: r.sum_net,
  }));
}

export async function readRunSummary(db: Kysely<Database>, runId: number): Promise<RunSummary | null> {
  return (await readSummaries(db, { runId }))[0] ?? null;
}

export async function readRunSummaries(db: Kysely<Database>, companyId?: number): Promise<RunSummary[]> {
  return readSummaries(db, companyId === undefined ? {} : { companyId });
}
