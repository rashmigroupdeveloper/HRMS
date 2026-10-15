/**
 * Parallel Run Variance Reporter (R20, doc 04 §6.8, doc 14 §7.5, SOW crosswalk).
 *
 * Automated dual-run reconciliation engine comparing HRMS payroll run items
 * and lines against the Protiviti monthly pay register.
 *
 * Protocol: RECONCILE GROSS EARNINGS BEFORE NET PAY.
 * 100% of discrepancies classified into:
 *   - exact_match
 *   - rounding_tolerance (<= 200 paise / ₹2.00)
 *   - policy_divergence (known policy difference, e.g. PF base or ESIC rounding)
 *   - data_discrepancy (attendance payable days or IT declaration mismatch)
 *   - engine_bug (unexplained variance)
 */

import type { Database } from '../../../core/db/types.js';
import type { Kysely } from 'kysely';
import { fromRupees, toRupees, ZERO, add, subtract, type Paise } from '../../../core/money/index.js';
import type { IngestedRegister, NormalizedRegisterItem } from './parallel-import.js';
import { componentTotals } from '../reconciliation/component-totals.js';

export type DiscrepancyCategory =
  | 'exact_match'
  | 'rounding_tolerance'
  | 'policy_divergence'
  | 'data_discrepancy'
  | 'engine_bug';

export interface ComponentDelta {
  componentCode: string;
  hrmsPaise: Paise;
  protivitiPaise: Paise;
  deltaPaise: Paise;
}

export interface EmployeeParallelVariance {
  ecode: string;
  name: string;
  department: string | null;
  designation: string | null;
  payableDaysHrms: number;
  payableDaysProtiviti: number;
  payableDaysDelta: number;
  lopDaysHrms: number;
  lopDaysProtiviti: number;
  lopDaysDelta: number;
  hrmsGrossPaise: Paise;
  protivitiGrossPaise: Paise;
  grossDeltaPaise: Paise;
  hrmsTotalDeductionsPaise: Paise;
  protivitiTotalDeductionsPaise: Paise;
  deductionsDeltaPaise: Paise;
  hrmsNetPayPaise: Paise;
  protivitiNetPayPaise: Paise;
  netDeltaPaise: Paise;
  category: DiscrepancyCategory;
  notes: string[];
  componentDeltas: ComponentDelta[];
}

export interface ParallelRunReconciliationReport {
  runId: number;
  month: string;
  comparisonTimestamp: string;
  headcount: number;
  exactMatchCount: number;
  roundingToleranceCount: number;
  policyDivergenceCount: number;
  dataDiscrepancyCount: number;
  unexplainedBugCount: number;
  totalHrmsGrossRupees: number;
  totalProtivitiGrossRupees: number;
  grossDeltaRupees: number;
  totalHrmsNetRupees: number;
  totalProtivitiNetRupees: number;
  netDeltaRupees: number;
  cutOverGatePassed: boolean;
  signOffRequired: {
    hrHead: boolean;
    financeController: boolean;
    internalAudit: boolean;
  };
  items: EmployeeParallelVariance[];
}

export interface SignOffRecord {
  runId: number;
  month: string;
  hrHeadSigned: boolean;
  hrHeadSignedAt?: string;
  hrHeadNotes?: string;
  financeSigned: boolean;
  financeSignedAt?: string;
  financeNotes?: string;
  auditSigned: boolean;
  auditSignedAt?: string;
  auditNotes?: string;
  status: 'pending' | 'partially_signed' | 'fully_signed';
}

export class ParallelRunVarianceService {
  constructor(private readonly db: Kysely<Database>) {}

  /**
   * Compares an HRMS payroll run against an ingested Protiviti register.
   */
  async compareRunAgainstProtiviti(
    runId: number,
    protivitiRegister: IngestedRegister
  ): Promise<ParallelRunReconciliationReport> {
    // 1. Fetch HRMS run items
    const hrmsRun = await this.db
      .selectFrom('pay.payroll_runs')
      .select(['id', 'month', 'status', 'company_id'])
      .where('id', '=', runId)
      .executeTakeFirst();

    if (!hrmsRun) {
      throw new Error(`HRMS Payroll run #${runId} not found.`);
    }

    const hrmsItems = await this.db
      .selectFrom('pay.payroll_items as pi')
      .innerJoin('core.employees as e', 'e.id', 'pi.employee_id')
      .select([
        'pi.id as item_id',
        'pi.employee_id',
        'pi.payable_days',
        'pi.lop_days',
        'pi.gross',
        'pi.total_deductions',
        'pi.net_pay',
        'e.ecode',
        'e.first_name',
        'e.last_name',
      ])
      .where('pi.run_id', '=', runId)
      .execute();

    // 2. Fetch all component lines for the run
    const hrmsLines = await this.db
      .selectFrom('pay.payroll_item_lines as pil')
      .innerJoin('pay.payroll_items as pi', 'pi.id', 'pil.item_id')
      .select(['pi.employee_id', 'pil.component_code', 'pil.amount'])
      .where('pi.run_id', '=', runId)
      .execute();

    const linesByEmployee = componentTotals(hrmsLines);

    // Map Protiviti items by Ecode
    const protivitiMap = new Map<string, NormalizedRegisterItem>();
    for (const p of protivitiRegister.items) {
      protivitiMap.set(p.ecode, p);
    }

    const variances: EmployeeParallelVariance[] = [];
    let exactMatches = 0;
    let roundingTolerances = 0;
    let policyDivergences = 0;
    let dataDiscrepancies = 0;
    let unexplainedBugs = 0;

    let totalHrmsGross: Paise = ZERO;
    let totalProtivitiGross: Paise = ZERO;
    let totalHrmsNet: Paise = ZERO;
    let totalProtivitiNet: Paise = ZERO;

    for (const h of hrmsItems) {
      const ecode = h.ecode.toUpperCase();
      const p = protivitiMap.get(ecode);

      const hGrossPaise = fromRupees(Number(h.gross));
      const hDeductionsPaise = fromRupees(Number(h.total_deductions));
      const hNetPaise = fromRupees(Number(h.net_pay));
      const hPayableDays = Number(h.payable_days);
      const hLopDays = Number(h.lop_days);

      totalHrmsGross = add(totalHrmsGross, hGrossPaise);
      totalHrmsNet = add(totalHrmsNet, hNetPaise);

      if (!p) {
        // Employee present in HRMS but missing in Protiviti register
        variances.push({
          ecode,
          name: `${h.first_name} ${h.last_name}`.trim(),
          department: null,
          designation: null,
          payableDaysHrms: hPayableDays,
          payableDaysProtiviti: 0,
          payableDaysDelta: hPayableDays,
          lopDaysHrms: hLopDays,
          lopDaysProtiviti: 0,
          lopDaysDelta: hLopDays,
          hrmsGrossPaise: hGrossPaise,
          protivitiGrossPaise: ZERO,
          grossDeltaPaise: hGrossPaise,
          hrmsTotalDeductionsPaise: hDeductionsPaise,
          protivitiTotalDeductionsPaise: ZERO,
          deductionsDeltaPaise: hDeductionsPaise,
          hrmsNetPayPaise: hNetPaise,
          protivitiNetPayPaise: ZERO,
          netDeltaPaise: hNetPaise,
          category: 'data_discrepancy',
          notes: ['Employee exists in HRMS payroll run but is missing from Protiviti register.'],
          componentDeltas: [],
        });
        dataDiscrepancies++;
        continue;
      }

      totalProtivitiGross = add(totalProtivitiGross, p.grossPaise);
      totalProtivitiNet = add(totalProtivitiNet, p.netPayPaise);

      const pLines = linesByEmployee.get(h.employee_id) ?? new Map<string, Paise>();

      // Detailed component comparison
      const componentDeltas: ComponentDelta[] = [];
      const checkComponent = (code: string, hAmount: Paise, pAmount: Paise) => {
        const delta = subtract(hAmount, pAmount);
        componentDeltas.push({
          componentCode: code,
          hrmsPaise: hAmount,
          protivitiPaise: pAmount,
          deltaPaise: delta,
        });
      };

      checkComponent('BASIC', pLines.get('BASIC') ?? ZERO, p.basicPaise);
      checkComponent('HRA', pLines.get('HRA') ?? ZERO, p.hraPaise);
      checkComponent('MEDICAL_ALLOW', pLines.get('MEDICAL_ALLOW') ?? ZERO, p.medicalAllowPaise);
      checkComponent('SPECIAL_ALLOW', pLines.get('SPECIAL_ALLOW') ?? ZERO, p.specialAllowPaise);
      checkComponent('EDUCATION_ALLOW', pLines.get('EDUCATION_ALLOW') ?? ZERO, p.educationAllowPaise);
      checkComponent('BONUS', pLines.get('BONUS') ?? ZERO, p.bonusAdvancePaise);
      checkComponent('PF_EE', pLines.get('PF_EE') ?? ZERO, p.pfEePaise);
      checkComponent('ESIC_EE', pLines.get('ESI_EE') ?? pLines.get('ESIC_EE') ?? ZERO, p.esicEePaise);
      checkComponent('PT', pLines.get('PT') ?? ZERO, p.ptPaise);
      checkComponent('LWF', pLines.get('LWF') ?? ZERO, p.lwfPaise);
      checkComponent('TDS', pLines.get('TDS') ?? ZERO, p.tdsPaise);

      const grossDelta = subtract(hGrossPaise, p.grossPaise);
      const deductionsDelta = subtract(hDeductionsPaise, p.totalDeductionsPaise);
      const netDelta = subtract(hNetPaise, p.netPayPaise);
      const payableDaysDelta = hPayableDays - p.payableDays;
      const lopDaysDelta = hLopDays - p.lopDays;

      const notes: string[] = [];
      let category: DiscrepancyCategory = 'exact_match';

      if (netDelta === ZERO && grossDelta === ZERO && deductionsDelta === ZERO && payableDaysDelta === 0) {
        category = 'exact_match';
        exactMatches++;
      } else if (payableDaysDelta !== 0 || lopDaysDelta !== 0) {
        category = 'data_discrepancy';
        notes.push(
          `Attendance variance: HRMS payable days ${hPayableDays} vs Protiviti ${p.payableDays} (LOP diff: ${lopDaysDelta}).`
        );
        dataDiscrepancies++;
      } else if (Math.abs(netDelta) <= 200 && Math.abs(grossDelta) <= 200) {
        category = 'rounding_tolerance';
        notes.push(`Minor rounding difference within ₹2.00 statutory tolerance: ${netDelta} paise.`);
        roundingTolerances++;
      } else {
        // Check for specific known policy divergence
        const pfDiff = componentDeltas.find((c) => c.componentCode === 'PF_EE')?.deltaPaise ?? ZERO;
        const ptDiff = componentDeltas.find((c) => c.componentCode === 'PT')?.deltaPaise ?? ZERO;
        const esicDiff = componentDeltas.find((c) => c.componentCode === 'ESIC_EE')?.deltaPaise ?? ZERO;

        if (pfDiff !== ZERO && Math.abs(pfDiff) > 200) {
          category = 'policy_divergence';
          notes.push(`PF Base Policy divergence: RML computes PF on actual basic whereas Protiviti applied ₹15k cap.`);
          policyDivergences++;
        } else if (ptDiff !== ZERO || esicDiff !== ZERO) {
          category = 'policy_divergence';
          notes.push(`Statutory slab / ESIC ceiling round-up divergence.`);
          policyDivergences++;
        } else {
          category = 'engine_bug';
          notes.push(
            `Unexplained calculation discrepancy: Gross diff ₹${toRupees(grossDelta)}, Net diff ₹${toRupees(netDelta)}.`
          );
          unexplainedBugs++;
        }
      }

      variances.push({
        ecode,
        name: p.name,
        department: p.department,
        designation: p.designation,
        payableDaysHrms: hPayableDays,
        payableDaysProtiviti: p.payableDays,
        payableDaysDelta,
        lopDaysHrms: hLopDays,
        lopDaysProtiviti: p.lopDays,
        lopDaysDelta,
        hrmsGrossPaise: hGrossPaise,
        protivitiGrossPaise: p.grossPaise,
        grossDeltaPaise: grossDelta,
        hrmsTotalDeductionsPaise: hDeductionsPaise,
        protivitiTotalDeductionsPaise: p.totalDeductionsPaise,
        deductionsDeltaPaise: deductionsDelta,
        hrmsNetPayPaise: hNetPaise,
        protivitiNetPayPaise: p.netPayPaise,
        netDeltaPaise: netDelta,
        category,
        notes,
        componentDeltas,
      });
    }

    const cutOverGatePassed = unexplainedBugs === 0;

    return {
      runId,
      month: new Date(hrmsRun.month).toISOString().slice(0, 7),
      comparisonTimestamp: new Date().toISOString(),
      headcount: variances.length,
      exactMatchCount: exactMatches,
      roundingToleranceCount: roundingTolerances,
      policyDivergenceCount: policyDivergences,
      dataDiscrepancyCount: dataDiscrepancies,
      unexplainedBugCount: unexplainedBugs,
      totalHrmsGrossRupees: toRupees(totalHrmsGross),
      totalProtivitiGrossRupees: toRupees(totalProtivitiGross),
      grossDeltaRupees: toRupees(subtract(totalHrmsGross, totalProtivitiGross)),
      totalHrmsNetRupees: toRupees(totalHrmsNet),
      totalProtivitiNetRupees: toRupees(totalProtivitiNet),
      netDeltaRupees: toRupees(subtract(totalHrmsNet, totalProtivitiNet)),
      cutOverGatePassed,
      signOffRequired: {
        hrHead: true,
        financeController: true,
        internalAudit: true,
      },
      items: variances,
    };
  }
}
