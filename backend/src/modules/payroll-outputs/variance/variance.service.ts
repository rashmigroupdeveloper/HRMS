/**
 * Variance Report Service (R10, PAY-05, SOW crosswalk).
 *
 * Computes per-employee month-over-month payroll delta comparison,
 * component-wise differences, and anomaly detection:
 * - Negative net pay
 * - High variance exceeding threshold (> 10% or > ₹5,000)
 * - LOP spikes
 * - New joiners / leavers
 * - Payment holds
 */

import type { Kysely } from 'kysely';
import type { Database } from '../../../core/db/types.js';

export interface EmployeeVariance {
  employeeId: number;
  ecode: string;
  name: string;
  department: string | null;
  designation: string | null;
  currentGross: number;
  previousGross: number;
  grossDelta: number;
  grossDeltaPercent: number;
  currentNet: number;
  previousNet: number;
  netDelta: number;
  netDeltaPercent: number;
  currentPayableDays: number;
  previousPayableDays: number;
  payableDaysDelta: number;
  currentLopDays: number;
  previousLopDays: number;
  lopDaysDelta: number;
  paymentStatus: string;
  isAnomaly: boolean;
  anomalies: string[];
}

export interface VarianceReportSummary {
  runId: number;
  previousRunId: number | null;
  companyName: string;
  currentMonth: string;
  previousMonth: string | null;
  employeeCount: number;
  totalCurrentGross: number;
  totalPreviousGross: number;
  grossDeltaTotal: number;
  totalCurrentNet: number;
  totalPreviousNet: number;
  netDeltaTotal: number;
  anomalyCount: number;
  items: EmployeeVariance[];
}

export class VarianceReportService {
  constructor(private readonly db: Kysely<Database>) {}

  async generateVarianceReport(
    runId: number,
    thresholdPercent = 10,
    thresholdAmount = 5000
  ): Promise<VarianceReportSummary> {
    // 1. Fetch Current Run & Company
    const currentRun = await this.db
      .selectFrom('pay.payroll_runs as r')
      .innerJoin('core.companies as c', 'c.id', 'r.company_id')
      .select(['r.id', 'r.company_id', 'r.month', 'c.name as company_name'])
      .where('r.id', '=', runId)
      .executeTakeFirst();

    if (!currentRun) {
      throw new Error(`Payroll run #${String(runId)} not found.`);
    }

    const currentMonthDate = new Date(currentRun.month);
    const currentMonthStr = currentMonthDate.toISOString().slice(0, 7);

    // 2. Find Previous Run for the same company (most recent run before currentMonth)
    const prevRun = await this.db
      .selectFrom('pay.payroll_runs')
      .selectAll()
      .where('company_id', '=', currentRun.company_id)
      .where('month', '<', currentRun.month)
      .where('status', 'in', ['computed', 'under_review', 'approved', 'finalized', 'paid'])
      .orderBy('month', 'desc')
      .executeTakeFirst();

    const previousRunId = prevRun?.id ?? null;
    const previousMonthStr = prevRun
      ? new Date(prevRun.month).toISOString().slice(0, 7)
      : null;

    // 3. Fetch items for current run
    const currentItems = await this.db
      .selectFrom('pay.payroll_items as it')
      .innerJoin('core.employees as e', 'e.id', 'it.employee_id')
      .leftJoin('core.departments as dept', 'dept.id', 'e.department_id')
      .leftJoin('core.designations as d', 'd.id', 'e.designation_id')
      .select([
        'it.employee_id',
        'it.payable_days',
        'it.lop_days',
        'it.gross',
        'it.net_pay',
        'it.payment_status',
        'e.ecode',
        'e.first_name',
        'e.last_name',
        'dept.name as department',
        'd.name as designation',
      ])
      .where('it.run_id', '=', runId)
      .execute();

    // 4. Fetch items for previous run if it exists
    const prevItemsMap = new Map<
      number,
      { gross: number; net: number; payableDays: number; lopDays: number }
    >();

    if (previousRunId) {
      const prevItems = await this.db
        .selectFrom('pay.payroll_items')
        .select(['employee_id', 'gross', 'net_pay', 'payable_days', 'lop_days'])
        .where('run_id', '=', previousRunId)
        .execute();

      for (const p of prevItems) {
        prevItemsMap.set(p.employee_id, {
          gross: Number(p.gross),
          net: Number(p.net_pay),
          payableDays: Number(p.payable_days),
          lopDays: Number(p.lop_days),
        });
      }
    }

    const varianceList: EmployeeVariance[] = [];
    let totalCurGross = 0;
    let totalPrevGross = 0;
    let totalCurNet = 0;
    let totalPrevNet = 0;
    let anomalyCount = 0;

    for (const c of currentItems) {
      const curGross = Number(c.gross);
      const curNet = Number(c.net_pay);
      const curPayableDays = Number(c.payable_days);
      const curLopDays = Number(c.lop_days);

      const prev = prevItemsMap.get(c.employee_id);
      const prevGross = prev?.gross ?? 0;
      const prevNet = prev?.net ?? 0;
      const prevPayableDays = prev?.payableDays ?? 0;
      const prevLopDays = prev?.lopDays ?? 0;

      const grossDelta = curGross - prevGross;
      const netDelta = curNet - prevNet;
      const payableDaysDelta = curPayableDays - prevPayableDays;
      const lopDaysDelta = curLopDays - prevLopDays;

      const grossDeltaPct = prevGross > 0 ? (grossDelta / prevGross) * 100 : 100;
      const netDeltaPct = prevNet > 0 ? (netDelta / prevNet) * 100 : 100;

      totalCurGross += curGross;
      totalPrevGross += prevGross;
      totalCurNet += curNet;
      totalPrevNet += prevNet;

      const anomalies: string[] = [];

      if (curNet < 0) {
        anomalies.push(`Negative Net Pay (₹${curNet.toFixed(2)})`);
      }

      if (c.payment_status === 'hold_payment' || c.payment_status === 'hold_process') {
        anomalies.push('Salary On Hold');
      }

      if (!prev) {
        anomalies.push('New Joiner / First Run');
      } else {
        if (Math.abs(grossDelta) >= thresholdAmount || Math.abs(grossDeltaPct) >= thresholdPercent) {
          const dir = grossDelta >= 0 ? '+' : '';
          anomalies.push(
            `High Gross Variance (${dir}₹${grossDelta.toFixed(0)}, ${dir}${grossDeltaPct.toFixed(1)}%)`
          );
        }
        if (lopDaysDelta > 3) {
          anomalies.push(`LOP Spike (+${lopDaysDelta.toFixed(1)} days)`);
        }
      }

      const isAnomaly = anomalies.length > 0;
      if (isAnomaly) {
        anomalyCount++;
      }

      const fullName = c.last_name
        ? `${c.first_name} ${c.last_name}`
        : c.first_name;

      varianceList.push({
        employeeId: c.employee_id,
        ecode: c.ecode,
        name: fullName,
        department: c.department,
        designation: c.designation,
        currentGross: curGross,
        previousGross: prevGross,
        grossDelta,
        grossDeltaPercent: Number(grossDeltaPct.toFixed(2)),
        currentNet: curNet,
        previousNet: prevNet,
        netDelta,
        netDeltaPercent: Number(netDeltaPct.toFixed(2)),
        currentPayableDays: curPayableDays,
        previousPayableDays: prevPayableDays,
        payableDaysDelta,
        currentLopDays: curLopDays,
        previousLopDays: prevLopDays,
        lopDaysDelta,
        paymentStatus: c.payment_status,
        isAnomaly,
        anomalies,
      });
    }

    // Sort by largest gross delta magnitude descending so biggest changes rise to the top (docs/05 §4.5)
    varianceList.sort((a, b) => Math.abs(b.grossDelta) - Math.abs(a.grossDelta));

    return {
      runId,
      previousRunId,
      companyName: currentRun.company_name,
      currentMonth: currentMonthStr,
      previousMonth: previousMonthStr,
      employeeCount: currentItems.length,
      totalCurrentGross: totalCurGross,
      totalPreviousGross: totalPrevGross,
      grossDeltaTotal: totalCurGross - totalPrevGross,
      totalCurrentNet: totalCurNet,
      totalPreviousNet: totalPrevNet,
      netDeltaTotal: totalCurNet - totalPrevNet,
      anomalyCount,
      items: varianceList,
    };
  }
}
