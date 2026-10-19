/** PAY-03/07, CORE-06/10: reconcile membership independently of item totals. */
import { sql, type Kysely } from 'kysely';
import type { Database } from '../../../core/db/types.js';

/**
 * The compute loop can skip invalid salary/DOJ inputs. A balanced subset must
 * never authorize payment. Compare identities, so replacing an omitted person
 * with an unrelated employee cannot pass by preserving the headcount.
 *
 * Preserve the existing final-month F&F exclusion: a separate settlement that
 * owns payable final-month days is not paid a second time by this run.
 */
export async function reconcilePopulation(db: Kysely<Database>, runId: number): Promise<string[]> {
  const result = await sql<{ missing: number; unexpected: number }>`
    WITH expected AS (
      SELECT e.id
      FROM pay.payroll_runs r
      JOIN core.employees e ON e.company_id = r.company_id
      WHERE r.id = ${runId}
        AND e.status IN ('active', 'on_notice', 'exited')
        AND (e.doj IS NULL OR e.doj < r.month + INTERVAL '1 month')
        AND (e.dol IS NULL OR e.dol >= r.month)
        AND NOT EXISTS (
          SELECT 1 FROM pay.fnf_settlements f
          WHERE f.employee_id = e.id
            AND f.status IN ('computed', 'approved', 'paid')
            AND f.days_payable > 0
            AND f.last_working_day >= r.month
            AND f.last_working_day < r.month + INTERVAL '1 month'
            AND f.run_id IS DISTINCT FROM r.id
        )
    ), actual AS (
      SELECT employee_id AS id FROM pay.payroll_items WHERE run_id = ${runId}
    )
    SELECT
      (SELECT count(*)::int FROM expected e WHERE NOT EXISTS (SELECT 1 FROM actual a WHERE a.id = e.id)) AS missing,
      (SELECT count(*)::int FROM actual a WHERE NOT EXISTS (SELECT 1 FROM expected e WHERE e.id = a.id)) AS unexpected
  `.execute(db);
  const counts = result.rows[0];
  if (!counts) return ['Payroll population could not be reconciled.'];
  const anomalies: string[] = [];
  if (counts.missing > 0) anomalies.push(`Payroll population mismatch: ${String(counts.missing)} expected employee(s) have no computed item.`);
  if (counts.unexpected > 0) anomalies.push(`Payroll population mismatch: ${String(counts.unexpected)} computed employee(s) are outside the expected population.`);
  return anomalies;
}
