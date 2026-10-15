/**
 * Batch Annual Increment & Retro Revision Engine (P2-T12, SOW crosswalk, doc 14 §7.2).
 *
 * Simulates and executes company-wide annual salary increments with
 * retroactive arrears computation (SAP FOR/IN model) without mutating closed runs.
 */

import { fromRupees, toRupees, ZERO, add, subtract, paise, type Paise } from '../../../core/money/index.js';

export type IncrementType = 'percentage' | 'flat' | 'band_matrix';

export interface EmployeeIncrementInput {
  employeeId: number;
  ecode: string;
  name: string;
  department?: string | null | undefined;
  designation?: string | null | undefined;
  grade?: string | null | undefined;
  currentAnnualCtcRupees: number;
  currentMonthlyBasicRupees: number;
  currentMonthlyGrossRupees: number;
}

export interface IncrementPolicy {
  type: IncrementType;
  defaultPercentage?: number | undefined; // e.g. 8.5
  flatMonthlyRupees?: number | undefined; // e.g. 3500
  gradeMatrix?: Record<string, number> | undefined; // e.g. { 'E1': 10.0, 'E2': 8.5, 'M1': 7.0 }
  effectiveDate: string; // YYYY-MM-DD, e.g. '2026-04-01'
  executionMonth: string; // YYYY-MM, e.g. '2026-07'
}

export interface EmployeeIncrementResult {
  employeeId: number;
  ecode: string;
  name: string;
  grade: string | null;
  currentAnnualCtcPaise: Paise;
  proposedAnnualCtcPaise: Paise;
  annualCtcDeltaPaise: Paise;
  hikePercent: number;
  currentMonthlyGrossPaise: Paise;
  proposedMonthlyGrossPaise: Paise;
  monthlyGrossDeltaPaise: Paise;
  monthlyPfDeltaPaise: Paise;
  monthlyNetDeltaPaise: Paise;
  retroMonthsCount: number;
  totalRetroArrearsPaise: Paise;
}

export interface IncrementSimulationSummary {
  effectiveDate: string;
  executionMonth: string;
  totalEmployeesCount: number;
  totalCurrentAnnualCtcRupees: number;
  totalProposedAnnualCtcRupees: number;
  totalAnnualCtcDeltaRupees: number;
  averageHikePercent: number;
  totalMonthlyGrossDeltaRupees: number;
  totalRetroArrearsLiabilityRupees: number;
  retroMonthsCount: number;
  items: EmployeeIncrementResult[];
}

export interface ScheduledArrearRecord {
  employeeId: number;
  forMonth: string; // YYYY-MM
  targetRunMonth: string; // YYYY-MM
  componentCode: string;
  amountPaise: Paise;
}

export const IncrementBatchEngine = {
  /**
   * Simulates batch annual increments and computes retroactive arrears liability.
   */
  simulateIncrementBatch(
    policy: IncrementPolicy,
    employees: EmployeeIncrementInput[]
  ): IncrementSimulationSummary {
    if (employees.length === 0) {
      throw new Error('Employee list cannot be empty for increment simulation.');
    }

    // Determine retroactive lookback months
    const effDate = new Date(policy.effectiveDate);
    const parts = policy.executionMonth.split('-');
    const execYear = Number(parts[0] ?? 2026);
    const execMonth = Number(parts[1] ?? 1);
    const execDate = new Date(execYear, execMonth - 1, 1);

    let retroMonthsCount = 0;
    if (execDate > effDate) {
      const yearDiff = execDate.getFullYear() - effDate.getFullYear();
      const monthDiff = execDate.getMonth() - effDate.getMonth();
      retroMonthsCount = Math.max(0, yearDiff * 12 + monthDiff);
    }

    const items: EmployeeIncrementResult[] = [];
    let sumCurrentCtc: Paise = ZERO;
    let sumProposedCtc: Paise = ZERO;
    let sumMonthlyGrossDelta: Paise = ZERO;
    let sumRetroArrears: Paise = ZERO;
    let totalHikePercent = 0;

    for (const emp of employees) {
      const curCtcPaise = fromRupees(emp.currentAnnualCtcRupees);
      const curGrossPaise = fromRupees(emp.currentMonthlyGrossRupees);
      const curBasicPaise = fromRupees(emp.currentMonthlyBasicRupees);

      // Determine percentage hike for employee
      let hikePercent = 0;
      if (policy.type === 'percentage') {
        hikePercent = policy.defaultPercentage ?? 0;
      } else if (policy.type === 'band_matrix' && emp.grade && policy.gradeMatrix) {
        hikePercent = policy.gradeMatrix[emp.grade] ?? policy.defaultPercentage ?? 0;
      } else if (policy.type === 'flat' && policy.flatMonthlyRupees) {
        const flatAnnualPaise = fromRupees(policy.flatMonthlyRupees * 12);
        hikePercent =
          curCtcPaise > ZERO ? (Number(flatAnnualPaise) / Number(curCtcPaise)) * 100 : 0;
      }

      // Compute proposed Annual CTC
      let proposedCtcPaise: Paise;
      if (policy.type === 'flat' && policy.flatMonthlyRupees) {
        proposedCtcPaise = add(curCtcPaise, fromRupees(policy.flatMonthlyRupees * 12));
      } else {
        proposedCtcPaise = paise(
          Math.round(curCtcPaise * (1 + hikePercent / 100))
        );
      }

      const ctcDeltaPaise = subtract(proposedCtcPaise, curCtcPaise);

      // Approximate monthly earnings & statutory deltas:
      // CTC change distributes proportionally to monthly gross (approx 70-80% of CTC)
      const monthlyGrossDeltaPaise = paise(
        Math.round(curGrossPaise * (hikePercent / 100))
      );
      const proposedGrossPaise = add(curGrossPaise, monthlyGrossDeltaPaise);

      // Basic typically increases by hikePercent -> PF EE (12% of Basic delta)
      const monthlyBasicDeltaPaise = paise(
        Math.round(curBasicPaise * (hikePercent / 100))
      );
      const monthlyPfDeltaPaise = paise(
        Math.round((monthlyBasicDeltaPaise * 12) / 100)
      );

      const monthlyNetDeltaPaise = subtract(monthlyGrossDeltaPaise, monthlyPfDeltaPaise);

      // Total retroactive arrears across lookback months
      const totalRetroArrearsPaise = paise(
        monthlyNetDeltaPaise * retroMonthsCount
      );

      sumCurrentCtc = add(sumCurrentCtc, curCtcPaise);
      sumProposedCtc = add(sumProposedCtc, proposedCtcPaise);
      sumMonthlyGrossDelta = add(sumMonthlyGrossDelta, monthlyGrossDeltaPaise);
      sumRetroArrears = add(sumRetroArrears, totalRetroArrearsPaise);
      totalHikePercent += hikePercent;

      items.push({
        employeeId: emp.employeeId,
        ecode: emp.ecode,
        name: emp.name,
        grade: emp.grade ?? null,
        currentAnnualCtcPaise: curCtcPaise,
        proposedAnnualCtcPaise: proposedCtcPaise,
        annualCtcDeltaPaise: ctcDeltaPaise,
        hikePercent: Math.round(hikePercent * 100) / 100,
        currentMonthlyGrossPaise: curGrossPaise,
        proposedMonthlyGrossPaise: proposedGrossPaise,
        monthlyGrossDeltaPaise,
        monthlyPfDeltaPaise,
        monthlyNetDeltaPaise,
        retroMonthsCount,
        totalRetroArrearsPaise,
      });
    }

    const avgHike = employees.length > 0 ? totalHikePercent / employees.length : 0;

    return {
      effectiveDate: policy.effectiveDate,
      executionMonth: policy.executionMonth,
      totalEmployeesCount: employees.length,
      totalCurrentAnnualCtcRupees: toRupees(sumCurrentCtc),
      totalProposedAnnualCtcRupees: toRupees(sumProposedCtc),
      totalAnnualCtcDeltaRupees: toRupees(subtract(sumProposedCtc, sumCurrentCtc)),
      averageHikePercent: Math.round(avgHike * 100) / 100,
      totalMonthlyGrossDeltaRupees: toRupees(sumMonthlyGrossDelta),
      totalRetroArrearsLiabilityRupees: toRupees(sumRetroArrears),
      retroMonthsCount,
      items,
    };
  },

  /**
   * Generates scheduled arrears records for retroactive months to be enqueued into pay.arrears.
   */
  generateRetroArrearsRecords(
    simulation: IncrementSimulationSummary
  ): ScheduledArrearRecord[] {
    const scheduledRecords: ScheduledArrearRecord[] = [];
    if (simulation.retroMonthsCount <= 0) return scheduledRecords;

    const effDate = new Date(simulation.effectiveDate);

    for (const item of simulation.items) {
      if (item.totalRetroArrearsPaise <= ZERO) continue;

      for (let m = 0; m < simulation.retroMonthsCount; m++) {
        const retroMonthDate = new Date(effDate.getFullYear(), effDate.getMonth() + m, 1);
        const forMonthStr = retroMonthDate.toISOString().slice(0, 7);

        scheduledRecords.push({
          employeeId: item.employeeId,
          forMonth: forMonthStr,
          targetRunMonth: simulation.executionMonth,
          componentCode: 'BASIC_ARREARS',
          amountPaise: item.monthlyNetDeltaPaise,
        });
      }
    }

    return scheduledRecords;
  }
}
