/**
 * Independent Secondary Reconciliation Engine (doc 14 §7.7, PAY-03, P2-T04).
 *
 * Independent set-based verification code path that audits payroll run items
 * and lines to guarantee paisa-perfect conservation before finalization is allowed:
 *   1. Net Conservation: Net == Gross - Deductions (for every item and for the grand aggregate).
 *   2. Line Sum Consistency: Item Gross/Deductions == Sum(Line amounts).
 *   3. Zero Float Variance: Discrepancy must be exactly 0 paise.
 */

import type { Database } from '../../../core/db/types.js';
import type { Kysely } from 'kysely';
import { sql } from 'kysely';

export interface ReconciliationReport {
  runId: number;
  isReconciled: boolean;
  employeeCount: number;
  totalGrossRupees: number;
  totalDeductionsRupees: number;
  totalNetRupees: number;
  discrepancyPaise: number;
  lineMismatchCount: number;
  negativeNetCount: number;
  anomalies: string[];
}

export class ReconciliationService {
  constructor(private readonly db: Kysely<Database>) {}

  /**
   * Run full independent verification on a payroll run.
   */
  async reconcileRun(runId: number): Promise<ReconciliationReport> {
    const anomalies: string[] = [];

    // 1. Fetch item-level aggregates via independent SQL
    const itemAggregate = await this.db
      .selectFrom('pay.payroll_items')
      .where('run_id', '=', runId)
      .select([
        sql<number>`count(*)::int`.as('item_count'),
        sql<number>`round(coalesce(sum(gross), 0) * 100)::bigint`.as('sum_gross_paise'),
        sql<number>`round(coalesce(sum(total_deductions), 0) * 100)::bigint`.as(
          'sum_deductions_paise',
        ),
        sql<number>`round(coalesce(sum(net_pay), 0) * 100)::bigint`.as('sum_net_paise'),
      ])
      .executeTakeFirst();

    const itemCount = itemAggregate?.item_count ?? 0;
    const sumGrossPaise = itemAggregate?.sum_gross_paise ?? 0;
    const sumDeductionsPaise = itemAggregate?.sum_deductions_paise ?? 0;
    const sumNetPaise = itemAggregate?.sum_net_paise ?? 0;

    // 2. Check aggregate mathematical conservation: Gross - Deductions == Net
    const expectedNetPaise = sumGrossPaise - sumDeductionsPaise;
    const discrepancyPaise = Math.abs(sumNetPaise - expectedNetPaise);

    if (discrepancyPaise !== 0) {
      anomalies.push(
        `Aggregate net conservation failure: Sum(Net) [${sumNetPaise} paise] ≠ Sum(Gross) - Sum(Deductions) [${expectedNetPaise} paise]. Diff: ${discrepancyPaise} paise.`,
      );
    }

    // 3. Check individual items where net != gross - deductions
    const itemConservationViolations = await this.db
      .selectFrom('pay.payroll_items')
      .where('run_id', '=', runId)
      .where(sql<boolean>`round((gross - total_deductions) * 100) != round(net_pay * 100)`)
      .select(['employee_id', 'gross', 'total_deductions', 'net_pay'])
      .execute();

    if (itemConservationViolations.length > 0) {
      for (const v of itemConservationViolations) {
        anomalies.push(
          `Employee #${v.employee_id} item equation mismatch: Gross ₹${v.gross} - Deductions ₹${v.total_deductions} ≠ Net ₹${v.net_pay}.`,
        );
      }
    }

    // 4. Check negative net pay items (flagged for review)
    const negativeNetItems = await this.db
      .selectFrom('pay.payroll_items')
      .where('run_id', '=', runId)
      .where(sql<boolean>`net_pay < 0`)
      .select(['employee_id', 'net_pay'])
      .execute();

    const negativeNetCount = negativeNetItems.length;
    if (negativeNetCount > 0) {
      anomalies.push(
        `Notice: ${negativeNetCount} employee(s) have negative net pay (review exception).`,
      );
    }

    // 5. Reconcile earning and deduction bases independently. Deduction lines
    // are positive amounts; employer costs never reduce employee take-home.
    const lineMismatchCheck = await this.db
      .selectFrom('pay.payroll_items as pi')
      .leftJoin(
        this.db
          .selectFrom('pay.payroll_item_lines')
          .innerJoin(
            'pay.salary_components as sc',
            'sc.code',
            'pay.payroll_item_lines.component_code',
          )
          .select([
            'item_id',
            sql<number>`round(coalesce(sum(amount) FILTER (WHERE sc.kind = 'earning' AND sc.part_of_gross), 0) * 100)::bigint`.as(
              'gross_paise',
            ),
            sql<number>`round(coalesce(sum(amount) FILTER (WHERE sc.kind = 'deduction'), 0) * 100)::bigint`.as(
              'deductions_paise',
            ),
          ])
          .groupBy('item_id')
          .as('lines_agg'),
        'lines_agg.item_id',
        'pi.id',
      )
      .where('pi.run_id', '=', runId)
      .where(
        sql<boolean>`round(pi.gross * 100) != coalesce(lines_agg.gross_paise, 0)
          OR round(pi.total_deductions * 100) != coalesce(lines_agg.deductions_paise, 0)`,
      )
      .select(['pi.employee_id'])
      .execute();

    const lineMismatchCount = lineMismatchCheck.length;
    if (lineMismatchCount > 0) {
      anomalies.push(
        `${lineMismatchCount} employee(s) have earning or deduction lines that disagree with their payroll headers.`,
      );
    }
    if (itemCount === 0) anomalies.push('Payroll has no computed employees.');

    const isReconciled =
      itemCount > 0 &&
      discrepancyPaise === 0 &&
      itemConservationViolations.length === 0 &&
      lineMismatchCount === 0 &&
      negativeNetCount === 0;

    return {
      runId,
      isReconciled,
      employeeCount: itemCount,
      totalGrossRupees: sumGrossPaise / 100,
      totalDeductionsRupees: sumDeductionsPaise / 100,
      totalNetRupees: sumNetPaise / 100,
      discrepancyPaise,
      lineMismatchCount,
      negativeNetCount,
      anomalies,
    };
  }
}
