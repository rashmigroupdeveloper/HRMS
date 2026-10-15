/**
 * Employees' Provident Fund (EPF) Engine (PAY-09).
 *
 * Implements EPF, EPS, EDLI, Admin charges, and EPFO Unified Portal ECR file generation.
 * Authoritative source: docs/10 §2, docs/04 §3.
 * Rounding: Nearest rupee via roundPfContribution (docs/14 §2 Tier-1).
 */

import {
  type Paise,
  paise,
  mulDiv,
  min,
  max,
} from '../../../core/money/money.js';
import { roundPfContribution } from '../../../core/money/rounding-policy.js';

export type PfWageBaseMode = 'ACTUAL' | 'CEILING_15000';

export interface PfComputeInput {
  /** Pf eligible wages (Basic + DA) in integer paise */
  pfWagesPaise: Paise;
  /** 'ACTUAL' (full basic per RML live policy) or 'CEILING_15000' (statutory floor) */
  wageBaseMode?: PfWageBaseMode | undefined;
  /** Loss of pay days in current month */
  lopDays?: number | undefined;
  /** Unpaid week off days in current month */
  unpaidWeekoffDays?: number | undefined;
  /** Establishment active employee headcount (for admin charge min ₹500 split) */
  headcount?: number | undefined;
}

export interface PfComputeResult {
  eePfPaise: Paise;
  erEpsPaise: Paise;
  erEpfPaise: Paise;
  edliPaise: Paise;
  adminPaise: Paise;
  pfWagesPaise: Paise;
  epsWagesPaise: Paise;
  edliWagesPaise: Paise;
  ncpDays: number;
}

export interface EcrRecordInput {
  uan: string;
  memberName: string;
  grossWagesPaise: Paise;
  epfWagesPaise: Paise;
  epsWagesPaise: Paise;
  edliWagesPaise: Paise;
  eeSharePaise: Paise;
  erEpsPaise: Paise;
  erEpfPaise: Paise;
  ncpDays: number;
  refundOfAdvancesPaise?: Paise | undefined;
}

const STATUTORY_PF_CEILING_PAISE = paise(1500000); // ₹15,000
const MAX_EPS_MONTHLY_PAISE = paise(125000); // ₹1,250
const MAX_EDLI_MONTHLY_PAISE = paise(7500); // ₹75
const MIN_ADMIN_PER_ESTABLISHMENT_PAISE = paise(50000); // ₹500

/**
 * Computes EPF, EPS, EDLI, and admin charges down to the exact rupee.
 */
export function computePf(input: PfComputeInput): PfComputeResult {
  const {
    pfWagesPaise,
    wageBaseMode = 'ACTUAL',
    lopDays = 0,
    unpaidWeekoffDays = 0,
    headcount = 1,
  } = input;

  // 1. Employee EPF Base
  let eePfBasePaise = pfWagesPaise;
  if (wageBaseMode === 'CEILING_15000') {
    eePfBasePaise = min(pfWagesPaise, STATUTORY_PF_CEILING_PAISE);
  }
  const eePfPaise = roundPfContribution(mulDiv(eePfBasePaise, 12, 100));

  // 2. Employer EPS (8.33% capped at ₹15,000 wage ceiling -> max ₹1,250)
  const epsWagesPaise = min(pfWagesPaise, STATUTORY_PF_CEILING_PAISE);
  // 8.33% = 833 basis points
  const rawEpsPaise = mulDiv(epsWagesPaise, 833, 10000);
  const erEpsPaise = min(roundPfContribution(rawEpsPaise), MAX_EPS_MONTHLY_PAISE);

  // 3. Employer EPF (12% of pf wages minus EPS share)
  const totalEr12PctPaise = roundPfContribution(mulDiv(pfWagesPaise, 12, 100));
  const erEpfPaise = paise(Math.max(0, totalEr12PctPaise - erEpsPaise));

  // 4. EDLI (0.50% of min(pf_wages, 15000) -> max ₹75)
  const edliWagesPaise = min(pfWagesPaise, STATUTORY_PF_CEILING_PAISE);
  const rawEdliPaise = mulDiv(edliWagesPaise, 50, 10000);
  const edliPaise = min(roundPfContribution(rawEdliPaise), MAX_EDLI_MONTHLY_PAISE);

  // 5. EPF Admin charges (0.50% of pf_wages; min ₹500 per establishment across employees)
  const rawAdminPaise = mulDiv(pfWagesPaise, 50, 10000);
  const minAdminPerHead = headcount && headcount > 1 ? mulDiv(MIN_ADMIN_PER_ESTABLISHMENT_PAISE, 1, headcount) : paise(0);
  const adminPaise = max(roundPfContribution(rawAdminPaise), minAdminPerHead);

  // 6. Non-Contributory Period (NCP) days
  const ncpDays = Math.max(0, lopDays + unpaidWeekoffDays);

  return {
    eePfPaise,
    erEpsPaise,
    erEpfPaise,
    edliPaise,
    adminPaise,
    pfWagesPaise,
    epsWagesPaise,
    edliWagesPaise,
    ncpDays,
  };
}

/**
 * Generates official ECR text export format per EPFO Unified Portal specification.
 * Delimiter is `#~#`.
 */
export function generateEcrExport(records: EcrRecordInput[]): string {
  const lines: string[] = [];

  for (const r of records) {
    const grossRupees = Math.round(r.grossWagesPaise / 100);
    const epfRupees = Math.round(r.epfWagesPaise / 100);
    const epsRupees = Math.round(r.epsWagesPaise / 100);
    const edliRupees = Math.round(r.edliWagesPaise / 100);
    const eeRupees = Math.round(r.eeSharePaise / 100);
    const epsErRupees = Math.round(r.erEpsPaise / 100);
    const epfErRupees = Math.round(r.erEpfPaise / 100);
    const refundRupees = r.refundOfAdvancesPaise ? Math.round(r.refundOfAdvancesPaise / 100) : 0;

    // EPFO ECR format fields:
    // 1: UAN, 2: Member Name, 3: Gross Wages, 4: EPF Wages, 5: EPS Wages, 6: EDLI Wages,
    // 7: EE Share, 8: EPS Share, 9: ER EPF Share, 10: NCP Days, 11: Refund of Advances
    const row = [
      r.uan,
      r.memberName,
      grossRupees.toString(),
      epfRupees.toString(),
      epsRupees.toString(),
      edliRupees.toString(),
      eeRupees.toString(),
      epsErRupees.toString(),
      epfErRupees.toString(),
      r.ncpDays.toString(),
      refundRupees.toString(),
    ].join('#~#');

    lines.push(row);
  }

  return lines.join('\n');
}
