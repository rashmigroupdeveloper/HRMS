/**
 * Claim Entitlement Engine (M12, CLM-01)
 *
 * Resolves grade-specific or default entitlements per claim type and basis period.
 * Tracks available balance = entitlement - approved - pending.
 */
import type { Kysely, Selectable } from 'kysely';
import type { Database, ClaimBasis, ClaimEntitlementsTable } from '../../core/db/types.js';
import { getTypedSetting } from '../settings/index.js';
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

    if (claimTypes.length === 0) return [];

    const claimTypeIds = claimTypes.map((ct) => ct.id);

    // 1. Batch-fetch all relevant entitlements for these claim types effective on or before targetDate
    const entitlements = await this.db
      .selectFrom('pay.claim_entitlements')
      .selectAll()
      .where('claim_type_id', 'in', claimTypeIds)
      .where((eb) =>
        gradeId !== null
          ? eb.or([eb('grade_id', '=', gradeId), eb('grade_id', 'is', null)])
          : eb('grade_id', 'is', null)
      )
      .where('effective_from', '<=', targetDate)
      .orderBy('effective_from', 'desc')
      .execute();

    // Map each claim_type_id to the best matching entitlement (prefer grade-specific over default)
    const entitlementByClaimTypeId = new Map<number, Selectable<ClaimEntitlementsTable>>();
    for (const ent of entitlements) {
      const existing = entitlementByClaimTypeId.get(ent.claim_type_id);
      if (!existing) {
        entitlementByClaimTypeId.set(ent.claim_type_id, ent);
      } else if (existing.grade_id === null && ent.grade_id !== null) {
        entitlementByClaimTypeId.set(ent.claim_type_id, ent);
      }
    }

    // 2. Batch-fetch all non-rejected claims for this employee
    const claims = await this.db
      .selectFrom('pay.claims')
      .select(['claim_type_id', 'status', 'approved_amount', 'claimed_amount', 'period_from', 'period_to'])
      .where('employee_id', '=', employeeId)
      .where('status', 'in', ['approved', 'paid', 'pending', 'verified'])
      .execute();

    const summaries: EntitlementSummary[] = [];

    for (const ct of claimTypes) {
      const entitlementRow = entitlementByClaimTypeId.get(ct.id);

      // Configurable baseline limits if no explicit entitlement row configured yet (CLAUDE.md Rule 2):
      let totalEntitlementRupees = entitlementRow ? Number(entitlementRow.amount) : 0;
      if (!entitlementRow) {
        const fallbacks: Record<string, number> = {
          medical: 15000,
          conveyance: 5000,
          telephone: 2000,
          lta: 50000,
          relocation: 25000,
        };
        const defLimit = fallbacks[ct.code] ?? 10000;
        totalEntitlementRupees = await getTypedSetting(this.db, `claims.default_limit_${ct.code}`, 'number', defLimit);
      }

      const totalEntitlementPaise = fromRupees(totalEntitlementRupees);
      const bounds = this.getPeriodBounds(ct.entitlement_basis, targetDate);

      // Sum consumed and pending claims for this claim type within period bounds
      let approvedSum = 0;
      let pendingSum = 0;
      for (const c of claims) {
        if (c.claim_type_id !== ct.id) continue;
        if (c.period_from >= bounds.from && c.period_to <= bounds.to) {
          if (c.status === 'approved' || c.status === 'paid') {
            approvedSum += Number(c.approved_amount ?? 0);
          } else if (c.status === 'pending' || c.status === 'verified') {
            pendingSum += Number(c.claimed_amount);
          }
        }
      }

      const approvedPaise = fromRupees(approvedSum);
      const pendingPaise = fromRupees(pendingSum);

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
