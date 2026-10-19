/**
 * Apprentices Act 1961 Compliance & Trainee Exclusions (PAY-14).
 *
 * Implements legal exclusions for designated apprentices:
 *  - Section 18 of Apprentices Act, 1961: Apprentices are trainees, not workers.
 *  - Total exemption from Employees' Provident Fund (EPF).
 *  - Total exemption from Employees' State Insurance (ESIC).
 *  - Excluded from Payment of Bonus Act, 1965 (stipend is not wages).
 *  - Professional tax applies per state slabs, and TDS applies when the stipend is taxable (docs/10 §9).
 *    PF, ESIC and bonus do not. That is the whole statutory exclusion.
 *
 * Authoritative source: docs/10 §9, Golden G9.
 */

import {
  type Paise,
  paise,
} from '../../../core/money/money.js';
import { computePt } from './pt.js';

export interface ApprenticeDeductionsInput {
  stipendPaise: Paise;
  state?: string | undefined;
}

export interface ApprenticeDeductionsResult {
  isApprentice: boolean;
  stipendPaise: Paise;
  pfEePaise: Paise;
  pfErPaise: Paise;
  esicEePaise: Paise;
  esicErPaise: Paise;
  bonusPaise: Paise;
  ptPaise: Paise;
  netStipendPaise: Paise;
}

/**
 * Checks whether an employee is a legally designated apprentice under Apprentices Act, 1961.
 * General trainees under contract are regular employees, but designated apprentices are excluded.
 */
export function isApprentice(category: string, contractType: string): boolean {
  const normCategory = category.trim().toLowerCase();
  const normContract = contractType.trim().toLowerCase();

  return normCategory === 'trainee' && normContract === 'apprentice';
}

/**
 * Computes statutory deductions for a designated apprentice.
 * Enforces zero PF, zero ESIC, and zero bonus, applying only Professional Tax where applicable.
 */
export function computeApprenticeDeductions(input: ApprenticeDeductionsInput): ApprenticeDeductionsResult {
  const { stipendPaise, state = 'WB' } = input;

  const ptPaise = computePt(stipendPaise, state);
  const netStipendPaise = paise(Math.max(0, stipendPaise - ptPaise));

  return {
    isApprentice: true,
    stipendPaise,
    pfEePaise: paise(0),
    pfErPaise: paise(0),
    esicEePaise: paise(0),
    esicErPaise: paise(0),
    bonusPaise: paise(0),
    ptPaise,
    netStipendPaise,
  };
}
