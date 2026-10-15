/**
 * Historical YTD Payroll Loader (P2-T11, SOW crosswalk, doc 10 §6).
 *
 * Ingests opening Year-To-Date (YTD) historical payroll figures for mid-year
 * cutover to guarantee seamless tax calculation (Section 192 TDS continuity)
 * across the 1,066+ employee master.
 */

import { fromRupees, toRupees, ZERO, add, type Paise } from '../../../core/money/index.js';

export interface YtdOpeningRecord {
  ecode: string;
  financialYear: string; // e.g. '2026-2027'
  cutoverMonth: string; // e.g. '2026-09'
  monthsProcessed: number;
  cumulativeGrossRupees: number;
  cumulativeTaxableGrossRupees: number;
  cumulativePfEeRupees: number;
  cumulativePtRupees: number;
  cumulativeTdsRupees: number;
}

export interface NormalizedYtdSummary {
  ecode: string;
  financialYear: string;
  cutoverMonth: string;
  monthsProcessed: number;
  cumulativeGrossPaise: Paise;
  cumulativeTaxableGrossPaise: Paise;
  cumulativePfEePaise: Paise;
  cumulativePtPaise: Paise;
  cumulativeTdsPaise: Paise;
}

export interface YtdImportResult {
  financialYear: string;
  cutoverMonth: string;
  employeeCount: number;
  totalGrossRupees: number;
  totalTaxableGrossRupees: number;
  totalPfEeRupees: number;
  totalPtRupees: number;
  totalTdsRupees: number;
  records: NormalizedYtdSummary[];
}

const ytdStore = new Map<string, NormalizedYtdSummary>();

export const YtdHistoricalLoader = {
  /**
   * Loads and normalizes historical YTD opening payroll facts.
   */
  loadYtdOpeningBatch(records: YtdOpeningRecord[]): YtdImportResult {
    if (records.length === 0) {
      throw new Error('YTD opening batch cannot be empty.');
    }

    const normalizedRecords: NormalizedYtdSummary[] = [];
    let sumGross: Paise = ZERO;
    let sumTaxableGross: Paise = ZERO;
    let sumPfEe: Paise = ZERO;
    let sumPt: Paise = ZERO;
    let sumTds: Paise = ZERO;

    const first = records[0];
    const fy = first ? first.financialYear : '2026-2027';
    const cutoverMonth = first ? first.cutoverMonth : '2026-04';

    for (const r of records) {
      const ecode = r.ecode.trim().toUpperCase();
      const grossPaise = fromRupees(r.cumulativeGrossRupees);
      const taxableGrossPaise = fromRupees(r.cumulativeTaxableGrossRupees);
      const pfEePaise = fromRupees(r.cumulativePfEeRupees);
      const ptPaise = fromRupees(r.cumulativePtRupees);
      const tdsPaise = fromRupees(r.cumulativeTdsRupees);

      const item: NormalizedYtdSummary = {
        ecode,
        financialYear: r.financialYear,
        cutoverMonth: r.cutoverMonth,
        monthsProcessed: r.monthsProcessed,
        cumulativeGrossPaise: grossPaise,
        cumulativeTaxableGrossPaise: taxableGrossPaise,
        cumulativePfEePaise: pfEePaise,
        cumulativePtPaise: ptPaise,
        cumulativeTdsPaise: tdsPaise,
      };

      normalizedRecords.push(item);
      ytdStore.set(`${ecode}:${r.financialYear}`, item);

      sumGross = add(sumGross, grossPaise);
      sumTaxableGross = add(sumTaxableGross, taxableGrossPaise);
      sumPfEe = add(sumPfEe, pfEePaise);
      sumPt = add(sumPt, ptPaise);
      sumTds = add(sumTds, tdsPaise);
    }

    return {
      financialYear: fy,
      cutoverMonth,
      employeeCount: records.length,
      totalGrossRupees: toRupees(sumGross),
      totalTaxableGrossRupees: toRupees(sumTaxableGross),
      totalPfEeRupees: toRupees(sumPfEe),
      totalPtRupees: toRupees(sumPt),
      totalTdsRupees: toRupees(sumTds),
      records: normalizedRecords,
    };
  },

  /**
   * Retrieves opening YTD for a given employee and financial year.
   */
  getEmployeeYtd(ecode: string, financialYear: string): NormalizedYtdSummary | null {
    return ytdStore.get(`${ecode.toUpperCase()}:${financialYear}`) ?? null;
  },

  /**
   * Clears YTD store (for testing).
   */
  clear(): void {
    ytdStore.clear();
  },
};
