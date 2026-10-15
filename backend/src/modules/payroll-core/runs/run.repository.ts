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

export async function readRunSummary(
  db: Kysely<Database>,
  runId: number,
): Promise<RunSummary | null> {
  const run = await db
    .selectFrom('pay.payroll_runs')
    .selectAll()
    .where('id', '=', runId)
    .executeTakeFirst();

  if (!run) return null;

  const stats = await db
    .selectFrom('pay.payroll_items')
    .where('run_id', '=', runId)
    .select([
      sql<number>`count(*)::int`.as('count'),
      sql<number>`coalesce(sum(gross), 0)::float`.as('sum_gross'),
      sql<number>`coalesce(sum(total_deductions), 0)::float`.as('sum_deductions'),
      sql<number>`coalesce(sum(net_pay), 0)::float`.as('sum_net'),
    ])
    .executeTakeFirst();

  return {
    id: run.id,
    companyId: run.company_id,
    month: formatDbDate(run.month),
    runType: run.run_type,
    status: run.status,
    attendanceLockId: run.attendance_lock_id,
    computedAt: run.computed_at ? run.computed_at.toISOString() : null,
    approvedAt: run.approved_at ? run.approved_at.toISOString() : null,
    approvedBy: run.approved_by,
    finalizedAt: run.finalized_at ? run.finalized_at.toISOString() : null,
    finalizedBy: run.finalized_by,
    employeeCount: stats?.count ?? 0,
    grossRupees: stats?.sum_gross ?? 0,
    totalDeductionsRupees: stats?.sum_deductions ?? 0,
    netPayRupees: stats?.sum_net ?? 0,
  };
}

export async function readRunSummaries(
  db: Kysely<Database>,
  companyId?: number,
): Promise<RunSummary[]> {
  let query = db.selectFrom('pay.payroll_runs').selectAll();
  if (companyId) {
    query = query.where('company_id', '=', companyId);
  }
  const runs = await query.orderBy('month', 'desc').orderBy('id', 'desc').execute();

  const summaries: RunSummary[] = [];
  for (const r of runs) {
    const stats = await db
      .selectFrom('pay.payroll_items')
      .where('run_id', '=', r.id)
      .select([
        sql<number>`count(*)::int`.as('count'),
        sql<number>`coalesce(sum(gross), 0)::float`.as('sum_gross'),
        sql<number>`coalesce(sum(total_deductions), 0)::float`.as('sum_deductions'),
        sql<number>`coalesce(sum(net_pay), 0)::float`.as('sum_net'),
      ])
      .executeTakeFirst();

    summaries.push({
      id: r.id,
      companyId: r.company_id,
      month: formatDbDate(r.month),
      runType: r.run_type,
      status: r.status,
      attendanceLockId: r.attendance_lock_id,
      computedAt: r.computed_at ? r.computed_at.toISOString() : null,
      approvedAt: r.approved_at ? r.approved_at.toISOString() : null,
      approvedBy: r.approved_by,
      finalizedAt: r.finalized_at ? r.finalized_at.toISOString() : null,
      finalizedBy: r.finalized_by,
      employeeCount: stats?.count ?? 0,
      grossRupees: stats?.sum_gross ?? 0,
      totalDeductionsRupees: stats?.sum_deductions ?? 0,
      netPayRupees: stats?.sum_net ?? 0,
    });
  }

  return summaries;
}
