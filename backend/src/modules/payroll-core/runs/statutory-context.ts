/**
 * Loads the statutory parameters a payroll month needs from data
 * (pay.statutory_rates, pay.pt_slabs, investment declarations) and derives the
 * per-employee statutory profile: PF basis, ESIC coverage for the contribution
 * period, PT slabs by work-location state, and the monthly TDS projection.
 */
import { sql, type Kysely } from 'kysely';
import type { Database } from '../../../core/db/types.js';
import { DomainError } from '../../../core/errors/index.js';
import { type Paise, paise, parseRupees } from '../../../core/money/index.js';
import type { PfWageBasis, PtSlabRow, StatutoryRates } from '../engine/compute-engine.js';
import { computeAnnualTax, NEW_REGIME_SD_PAISE, OLD_REGIME_SD_PAISE, type TaxRegime } from '../statutory/tds.js';

const pctToBp = (v: number): number => Math.round(v * 100);
const rupeesToPaise = (v: number): Paise => paise(Math.round(v * 100));

export async function loadStatutoryRates(db: Kysely<Database>, monthStr: string): Promise<StatutoryRates> {
  const rows = await db
    .selectFrom('pay.statutory_rates')
    .select(['scheme', 'param', 'value', 'effective_from'])
    .where('effective_from', '<=', sql<Date>`${monthStr}::date`)
    .orderBy('effective_from', 'desc')
    .execute();
  const value = (scheme: string, param: string): number => {
    const row = rows.find((r) => r.scheme === scheme && r.param === param);
    if (!row) throw new DomainError(`Statutory rate ${scheme}.${param} is not configured for ${monthStr}`, 'CONFLICT');
    return Number(row.value);
  };
  return {
    pfEeBp: pctToBp(value('PF', 'ee_rate_pct')),
    pfErBp: pctToBp(value('PF', 'er_rate_pct')),
    epsBp: pctToBp(value('PF', 'eps_rate_pct')),
    pfWageCeilingPaise: rupeesToPaise(value('PF', 'wage_ceiling')),
    epsCapPaise: rupeesToPaise(value('PF', 'eps_cap')),
    edliBp: pctToBp(value('PF', 'edli_rate_pct')),
    edliCapPaise: rupeesToPaise(value('PF', 'edli_cap')),
    pfAdminBp: pctToBp(value('PF', 'admin_rate_pct')),
    esicEeBp: pctToBp(value('ESIC', 'ee_rate_pct')),
    esicErBp: pctToBp(value('ESIC', 'er_rate_pct')),
    esicCeilingPaise: rupeesToPaise(value('ESIC', 'wage_ceiling')),
    otDivisor: value('OT', 'hour_divisor'),
    otMultiplier: value('OT', 'multiplier'),
  };
}

/** PT slabs per state, latest effective set on or before the month. States without PT get []. */
export async function loadPtSlabs(db: Kysely<Database>, monthStr: string): Promise<Map<string, PtSlabRow[]>> {
  const rows = await db
    .selectFrom('pay.pt_slabs')
    .selectAll()
    .where('effective_from', '<=', sql<Date>`${monthStr}::date`)
    .orderBy('effective_from', 'desc')
    .orderBy('min_monthly', 'asc')
    .execute();
  const latest = new Map<string, number>();
  for (const r of rows) if (!latest.has(r.state_code)) latest.set(r.state_code, r.effective_from.getTime());
  const out = new Map<string, PtSlabRow[]>();
  for (const r of rows) {
    if (r.effective_from.getTime() !== latest.get(r.state_code)) continue;
    const list = out.get(r.state_code) ?? [];
    list.push({
      minMonthlyPaise: parseRupees(r.min_monthly),
      maxMonthlyPaise: r.max_monthly === null ? null : parseRupees(r.max_monthly),
      amountPaise: parseRupees(r.amount),
      basis: r.basis,
    });
    out.set(r.state_code, list);
  }
  return out;
}

/** ESIC contribution periods: Apr–Sep and Oct–Mar (ESI Act s.2(9) read with Reg. 26). */
export function esicPeriodStart(monthStr: string): string {
  const [y = 0, m = 0] = monthStr.split('-').map(Number);
  if (m >= 4 && m <= 9) return `${String(y)}-04-01`;
  return m >= 10 ? `${String(y)}-10-01` : `${String(y - 1)}-10-01`;
}

/** Indian FY label for a month, e.g. 2026-06-01 → '2026-27'. */
export function financialYear(monthStr: string): string {
  const [y = 0, m = 0] = monthStr.split('-').map(Number);
  const start = m >= 4 ? y : y - 1;
  return `${String(start)}-${String((start + 1) % 100).padStart(2, '0')}`;
}

const OLD_REGIME_CAPS: Record<string, number> = { '80C': 150000, '80CCD1B': 50000, '80D': 25000, '80TTA': 10000, '24B': 200000 };

/**
 * Annual tax on the projected annual salary (contracted monthly gross × 12):
 * new regime with ₹75k standard deduction, old regime with ₹50k standard
 * deduction, PT and declared/verified Chapter VI-A deductions (capped).
 */
export async function projectAnnualTax(
  db: Kysely<Database>,
  params: { employeeId: number; regime: TaxRegime; contractedMonthlyGrossPaise: Paise; monthlyPtPaise: Paise; fy: string },
): Promise<Paise> {
  const annual = params.contractedMonthlyGrossPaise * 12;
  let taxable: number;
  if (params.regime === 'new') {
    taxable = annual - NEW_REGIME_SD_PAISE;
  } else {
    const decl = await db
      .selectFrom('pay.investment_declarations')
      .select(['section', 'declared_amount', 'verified_amount'])
      .where('employee_id', '=', params.employeeId)
      .where('fy', '=', params.fy)
      .execute();
    const chapterVia = decl.reduce((sum, d) => {
      const amount = Number(d.verified_amount ?? d.declared_amount);
      const cap = OLD_REGIME_CAPS[d.section.toUpperCase()];
      return sum + Math.round((cap === undefined ? amount : Math.min(amount, cap)) * 100);
    }, 0);
    taxable = annual - OLD_REGIME_SD_PAISE - params.monthlyPtPaise * 12 - chapterVia;
  }
  return computeAnnualTax(paise(Math.max(0, taxable)), params.regime).totalTaxWithCessPaise;
}

/** Employee override → company policy → pay.pf_wage_base setting (P-01). */
export function resolvePfWageBasis(setting: string, companyBasis: PfWageBasis | null, employeeBasis: PfWageBasis | null): PfWageBasis {
  const fallback: PfWageBasis = setting === 'CEILING_15000' ? 'CEILING_15000' : 'ACTUAL';
  return employeeBasis ?? companyBasis ?? fallback;
}
