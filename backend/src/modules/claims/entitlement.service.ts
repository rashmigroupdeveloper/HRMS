/**
 * Claim Entitlement Engine (M12, CLM-01)
 *
 * Resolves grade-specific or default entitlements per claim type and basis period.
 * Tracks available balance = entitlement - approved - pending.
 */
import type { Kysely } from 'kysely';
import type { Database, ClaimBasis } from '../../core/db/types.js';
import {
  paise,
  fromRupees,
  toRupees,
  subtract,
  ZERO,
} from '../../core/money/index.js';

export interface EntitlementSummary {
  claimTypeCode: string;
  claimTypeName: string;
  basis: ClaimBasis;
  totalEntitlementRupees: number;
  approvedClaimsRupees: number;
  pendingClaimsRupees: number;
  availableBalanceRupees: number;
  billRequired: boolean;
  taxableIfUnsubstantiated: boolean;
  payoutComponentCode: string;
}

export class EntitlementService {
  constructor(private readonly db: Kysely<Database>) {}

  /**
   * Resolves date bounds for entitlement basis.
   * - annual: Financial Year (1 Apr to 31 Mar)
   * - monthly: Current Calendar Month (1st to last day)
   * - per_event: unbounded or single event
   */
  getPeriodBounds(basis: ClaimBasis, targetDate: Date = new Date()): { from: Date; to: Date } {
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth(); // 0-indexed

    if (basis === 'annual') {
      // Indian FY starts 1 April
      const fyStartYear = month >= 3 ? year : year - 1;
      return {
        from: new Date(Date.UTC(fyStartYear, 3, 1)),
        to: new Date(Date.UTC(fyStartYear + 1, 2, 31, 23, 59, 59)),
      };
    } else if (basis === 'monthly') {
      return {
        from: new Date(Date.UTC(year, month, 1)),
        to: new Date(Date.UTC(year, month + 1, 0, 23, 59, 59)),
      };
    } else {
      // per_event: 1 year window around target date
      return {
        from: new Date(Date.UTC(year, 0, 1)),
        to: new Date(Date.UTC(year, 11, 31, 23, 59, 59)),
      };
    }
  }

  /**
   * Computes employee's live entitlement balance across all claim types.
   */
  async getEmployeeEntitlements(employeeId: number, targetDate: Date = new Date()): Promise<EntitlementSummary[]> {
    const emp = await this.db
      .selectFrom('core.employees')
      .select(['grade_id'])
      .where('id', '=', employeeId)
      .executeTakeFirst();

    const gradeId = emp?.grade_id ?? null;

    const claimTypes = await this.db
      .selectFrom('pay.claim_types')
      .selectAll()
      .orderBy('code', 'asc')
      .execute();

    const summaries: EntitlementSummary[] = [];

    for (const ct of claimTypes) {
      // 1. Resolve entitlement limit for employee's grade or default (grade_id IS NULL)
      let entitlementRow = gradeId
        ? await this.db
            .selectFrom('pay.claim_entitlements')
            .selectAll()
            .where('claim_type_id', '=', ct.id)
            .where('grade_id', '=', gradeId)
            .where('effective_from', '<=', targetDate)
            .orderBy('effective_from', 'desc')
            .executeTakeFirst()
        : undefined;

      entitlementRow ??= await this.db
        .selectFrom('pay.claim_entitlements')
        .selectAll()
        .where('claim_type_id', '=', ct.id)
        .where('grade_id', 'is', null)
        .where('effective_from', '<=', targetDate)
        .orderBy('effective_from', 'desc')
        .executeTakeFirst();

      // Default baseline limits if no explicit entitlement row configured yet:
      // Medical: 15,000/yr, Conveyance: 5,000/mo, Telephone: 2,000/mo, LTA: 50,000/yr, Misc: 10,000
      let totalEntitlementRupees = entitlementRow ? Number(entitlementRow.amount) : 0;
      if (!entitlementRow) {
        if (ct.code === 'medical') totalEntitlementRupees = 15000;
        else if (ct.code === 'conveyance') totalEntitlementRupees = 5000;
        else if (ct.code === 'telephone') totalEntitlementRupees = 2000;
        else if (ct.code === 'lta') totalEntitlementRupees = 50000;
        else if (ct.code === 'relocation') totalEntitlementRupees = 25000;
        else totalEntitlementRupees = 10000;
      }

      const totalEntitlementPaise = fromRupees(totalEntitlementRupees);
      const bounds = this.getPeriodBounds(ct.entitlement_basis, targetDate);

      // 2. Query consumed (approved/paid) claims in this period
      const approvedClaims = await this.db
        .selectFrom('pay.claims')
        .select((eb) => [eb.fn.sum<string>('approved_amount').as('sum_approved')])
        .where('employee_id', '=', employeeId)
        .where('claim_type_id', '=', ct.id)
        .where('status', 'in', ['approved', 'paid'])
        .where('period_from', '>=', bounds.from)
        .where('period_to', '<=', bounds.to)
        .executeTakeFirst();

      const approvedPaise = fromRupees(Number(approvedClaims?.sum_approved ?? 0));

      // 3. Query pending claims in this period
      const pendingClaims = await this.db
        .selectFrom('pay.claims')
        .select((eb) => [eb.fn.sum<string>('claimed_amount').as('sum_pending')])
        .where('employee_id', '=', employeeId)
        .where('claim_type_id', '=', ct.id)
        .where('status', 'in', ['pending', 'verified'])
        .where('period_from', '>=', bounds.from)
        .where('period_to', '<=', bounds.to)
        .executeTakeFirst();

      const pendingPaise = fromRupees(Number(pendingClaims?.sum_pending ?? 0));

      const consumedPaise = paise(Number(approvedPaise) + Number(pendingPaise));
      const availablePaise =
        consumedPaise >= totalEntitlementPaise
          ? ZERO
          : subtract(totalEntitlementPaise, consumedPaise);

      summaries.push({
        claimTypeCode: ct.code,
        claimTypeName: ct.name,
        basis: ct.entitlement_basis,
        totalEntitlementRupees,
        approvedClaimsRupees: toRupees(approvedPaise),
        pendingClaimsRupees: toRupees(pendingPaise),
        availableBalanceRupees: toRupees(availablePaise),
        billRequired: ct.bill_required,
        taxableIfUnsubstantiated: ct.taxable_if_unsubstantiated,
        payoutComponentCode: ct.payout_component_code,
      });
    }

    return summaries;
  }
}
