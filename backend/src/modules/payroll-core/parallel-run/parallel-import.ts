/**
 * Parallel Run Ingestion Engine (P2-T11, doc 04 §6.8, SOW crosswalk).
 *
 * Ingests and normalizes Protiviti / greytHR monthly pay registers for
 * automated component-by-component dual-run comparison against HRMS runs.
 */

import { createHash } from 'crypto';
import { fromRupees, add, subtract, ZERO, type Paise } from '../../../core/money/index.js';

export interface ProtivitiRegisterRow {
  ecode: string;
  name: string;
  department?: string | null | undefined;
  designation?: string | null | undefined;
  payableDays: number;
  lopDays: number;
  basicRupees: number;
  hraRupees: number;
  medicalAllowRupees: number;
  specialAllowRupees: number;
  educationAllowRupees: number;
  bonusAdvanceRupees: number;
  otherAllowancesRupees: number;
  grossRupees: number;
  pfEeRupees: number;
  esicEeRupees: number;
  ptRupees: number;
  lwfRupees: number;
  tdsRupees: number;
  otherDeductionsRupees: number;
  totalDeductionsRupees: number;
  netPayRupees: number;
}

export interface NormalizedRegisterItem {
  ecode: string;
  name: string;
  department: string | null;
  designation: string | null;
  payableDays: number;
  lopDays: number;
  basicPaise: Paise;
  hraPaise: Paise;
  medicalAllowPaise: Paise;
  specialAllowPaise: Paise;
  educationAllowPaise: Paise;
  bonusAdvancePaise: Paise;
  otherAllowancesPaise: Paise;
  grossPaise: Paise;
  pfEePaise: Paise;
  esicEePaise: Paise;
  ptPaise: Paise;
  lwfPaise: Paise;
  tdsPaise: Paise;
  otherDeductionsPaise: Paise;
  totalDeductionsPaise: Paise;
  netPayPaise: Paise;
}

export interface IngestedRegister {
  registerMonth: string; // YYYY-MM
  sourceFileName: string;
  checksum: string;
  headcount: number;
  totalGrossPaise: Paise;
  totalDeductionsPaise: Paise;
  totalNetPaise: Paise;
  items: NormalizedRegisterItem[];
  warnings: string[];
}

export function parseAndValidateProtivitiRegister(
  month: string,
  sourceFileName: string,
  rawRows: ProtivitiRegisterRow[]
): IngestedRegister {
  if (rawRows.length === 0) {
    throw new Error('Protiviti pay register is empty; minimum 1 employee required.');
  }

  const warnings: string[] = [];
  const seenEcodes = new Set<string>();
  const items: NormalizedRegisterItem[] = [];

  let sumGrossPaise: Paise = ZERO;
  let sumDeductionsPaise: Paise = ZERO;
  let sumNetPaise: Paise = ZERO;

  for (let idx = 0; idx < rawRows.length; idx++) {
    const row = rawRows[idx];
    if (!row) continue;
    const ecode = row.ecode.trim().toUpperCase();

    if (!ecode) {
      throw new Error(`Row ${idx + 1} has empty employee code.`);
    }

    if (seenEcodes.has(ecode)) {
      throw new Error(`Duplicate employee code ${ecode} found at row ${idx + 1}.`);
    }
    seenEcodes.add(ecode);

    const basicPaise = fromRupees(row.basicRupees);
    const hraPaise = fromRupees(row.hraRupees);
    const medicalAllowPaise = fromRupees(row.medicalAllowRupees);
    const specialAllowPaise = fromRupees(row.specialAllowRupees);
    const educationAllowPaise = fromRupees(row.educationAllowRupees);
    const bonusAdvancePaise = fromRupees(row.bonusAdvanceRupees);
    const otherAllowancesPaise = fromRupees(row.otherAllowancesRupees);
    const grossPaise = fromRupees(row.grossRupees);

    const pfEePaise = fromRupees(row.pfEeRupees);
    const esicEePaise = fromRupees(row.esicEeRupees);
    const ptPaise = fromRupees(row.ptRupees);
    const lwfPaise = fromRupees(row.lwfRupees);
    const tdsPaise = fromRupees(row.tdsRupees);
    const otherDeductionsPaise = fromRupees(row.otherDeductionsRupees);
    const totalDeductionsPaise = fromRupees(row.totalDeductionsRupees);
    const netPayPaise = fromRupees(row.netPayRupees);

    // Row-level conservation check: Gross - Deductions == Net (allow up to 200 paise / ₹2 rounding discrepancy in legacy file)
    const expectedNet = subtract(grossPaise, totalDeductionsPaise);
    const netDelta = Math.abs(netPayPaise - expectedNet);
    if (netDelta > 200) {
      warnings.push(
        `Row ${idx + 1} (${ecode}): Net pay ₹${row.netPayRupees} differs from Gross ₹${row.grossRupees} - Deductions ₹${row.totalDeductionsRupees} by ${netDelta} paise.`
      );
    }

    sumGrossPaise = add(sumGrossPaise, grossPaise);
    sumDeductionsPaise = add(sumDeductionsPaise, totalDeductionsPaise);
    sumNetPaise = add(sumNetPaise, netPayPaise);

    items.push({
      ecode,
      name: row.name.trim(),
      department: row.department?.trim() ?? null,
      designation: row.designation?.trim() ?? null,
      payableDays: row.payableDays,
      lopDays: row.lopDays,
      basicPaise,
      hraPaise,
      medicalAllowPaise,
      specialAllowPaise,
      educationAllowPaise,
      bonusAdvancePaise,
      otherAllowancesPaise,
      grossPaise,
      pfEePaise,
      esicEePaise,
      ptPaise,
      lwfPaise,
      tdsPaise,
      otherDeductionsPaise,
      totalDeductionsPaise,
      netPayPaise,
    });
  }

  // Cryptographic checksum of normalized register payload for audit integrity
  const hasher = createHash('sha256');
  hasher.update(month);
  hasher.update(sourceFileName);
  hasher.update(String(items.length));
  for (const it of items) {
    hasher.update(`${it.ecode}:${it.grossPaise}:${it.totalDeductionsPaise}:${it.netPayPaise}`);
  }
  const checksum = hasher.digest('hex');

  return {
    registerMonth: month,
    sourceFileName,
    checksum,
    headcount: items.length,
    totalGrossPaise: sumGrossPaise,
    totalDeductionsPaise: sumDeductionsPaise,
    totalNetPaise: sumNetPaise,
    items,
    warnings,
  };
}
