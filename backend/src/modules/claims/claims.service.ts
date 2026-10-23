/**
 * Claims & Reimbursements Service (M12, CLM-01..07)
 *
 * Implements:
 * - Claim submission with multiple uploaded bills and live entitlement check
 * - Multi-tier verification: Line manager & HR line-item bill approval
 * - Payout routing: regular payroll run OR off-cycle batch (DB CHECK: run XOR batch)
 * - Travel advance adjustment (CLM-07)
 * - Year-end unsubstantiated proof tax recovery (CLM-05)
 */
import type { Kysely } from 'kysely';
import type { Database, ClaimStatus } from '../../core/db/types.js';
import { NotFoundError } from '../../core/errors/index.js';
import { EntitlementService } from './entitlement.service.js';
import { inTransaction } from '../../core/db/database.js';

export interface SubmitBillInput {
  documentId: number;
  billNo?: string | undefined;
  billDate?: string | undefined; // 'YYYY-MM-DD'
  amountRupees: number;
}

export interface SubmitClaimParams {
  employeeId: number;
  claimTypeCode: string;
  periodFrom: string; // 'YYYY-MM-DD'
  periodTo: string; // 'YYYY-MM-DD'
  bills: SubmitBillInput[];
  advanceLoanId?: number | null | undefined;
  workflowRequestId?: number | null | undefined;
}

export interface VerifyBillInput {
  billId: number;
  verified: boolean;
  approvedAmountRupees?: number | undefined;
}

export interface DecideClaimParams {
  claimId: number;
  decidedByUserId: number;
  action: 'approve' | 'reject' | 'partially_approve';
  approvedAmountRupees?: number | undefined;
  rejectionReason?: string | undefined;
  billVerifications?: VerifyBillInput[] | undefined;
}

export interface RoutePayoutParams {
  claimId: number;
  payoutMethod: 'payroll_run' | 'off_cycle_batch';
  runId?: number | undefined;
  batchId?: number | undefined;
  userId: number;
}

export interface ClaimWithBills {
  id: number;
  employeeId: number;
  ecode: string;
  employeeName: string;
  claimTypeCode: string;
  claimTypeName: string;
  payoutComponentCode: string;
  periodFrom: string;
  periodTo: string;
  claimedAmountRupees: number;
  approvedAmountRupees: number | null;
  status: ClaimStatus;
  rejectionReason: string | null;
  advanceLoanId: number | null;
  paidInRunId: number | null;
  paidInBatchId: number | null;
  createdAt: Date;
  bills: {
    id: number;
    documentId: number;
    billNo: string | null;
    billDate: string | null;
    amountRupees: number;
    verified: boolean;
    verifiedBy: number | null;
  }[];
}

export class ClaimsService {
  private readonly entitlementService: EntitlementService;

  constructor(private readonly db: Kysely<Database>) {
    this.entitlementService = new EntitlementService(db);
  }

  /**
   * Submits a reimbursement claim with multiple bills and live entitlement verification.
   */
  async submitClaim(params: SubmitClaimParams): Promise<{ claimId: number; totalClaimedRupees: number }> {
    const {
      employeeId,
      claimTypeCode,
      periodFrom,
      periodTo,
      bills,
      advanceLoanId = null,
      workflowRequestId = null,
    } = params;

    if (bills.length === 0) {
      throw new Error('At least one bill or receipt document must be attached to the claim');
    }

    const claimType = await this.db
      .selectFrom('pay.claim_types')
      .selectAll()
      .where('code', '=', claimTypeCode)
      .executeTakeFirst();

    if (!claimType) {
      throw new Error(`Unknown claim type code: ${claimTypeCode}`);
    }

    // 1. Calculate sum of bill amounts
    let totalClaimedRupees = 0;
    for (const b of bills) {
      if (b.amountRupees <= 0) {
        throw new Error('Bill amount must be positive');
      }
      totalClaimedRupees += b.amountRupees;
    }

    // 2. Entitlement is a flag for the approver, not a hard stop (E2E-015).
    // A missing budget must not reject the claim: this path is entitlement-funded.
    const targetDate = new Date(periodFrom);
    const entitlements = await this.entitlementService.getEmployeeEntitlements(employeeId, targetDate);
    const currentEntitlement = entitlements.find((e) => e.claimTypeCode === claimTypeCode);
    const overEntitlement = currentEntitlement !== undefined
      && currentEntitlement.availableBalanceRupees < totalClaimedRupees;
    const fundingFlag = currentEntitlement === undefined
      ? 'FLAG:no-budget'
      : overEntitlement
        ? 'FLAG:over-entitlement'
        : null;

    // 3. Atomically persist claim and bills
    return await inTransaction(this.db, async (trx) => {
      const inserted = await trx
        .insertInto('pay.claims')
        .values({
          employee_id: employeeId,
          claim_type_id: claimType.id,
          funding_kind: 'entitlement',
          reference: fundingFlag,
          period_from: new Date(periodFrom),
          period_to: new Date(periodTo),
          claimed_amount: totalClaimedRupees.toFixed(2),
          approved_amount: null,
          status: 'pending',
          workflow_request_id: workflowRequestId,
          rejection_reason: null,
          advance_loan_id: advanceLoanId,
          paid_in_run_id: null,
          paid_in_batch_id: null,
        })
        .returning(['id'])
        .executeTakeFirstOrThrow();

      for (const bill of bills) {
        await trx
          .insertInto('pay.claim_bills')
          .values({
            claim_id: inserted.id,
            document_id: bill.documentId,
            bill_no: bill.billNo ?? null,
            bill_date: bill.billDate ? new Date(bill.billDate) : null,
            amount: bill.amountRupees.toFixed(2),
            verified: false,
            verified_by: null,
          })
          .execute();
      }

      return {
        claimId: inserted.id,
        totalClaimedRupees,
      };
    });
  }

  /**
   * Decides a claim (approve, reject, or partial approval) and records HR bill verification.
   */
  async decideClaim(params: DecideClaimParams): Promise<{ status: ClaimStatus; approvedAmountRupees: number }> {
    const {
      claimId,
      decidedByUserId,
      action,
      approvedAmountRupees,
      rejectionReason,
      billVerifications = [],
    } = params;

    return await inTransaction(this.db, async (trx) => {
      const claim = await trx
        .selectFrom('pay.claims')
        .selectAll()
        .where('id', '=', claimId)
        .forUpdate()
        .executeTakeFirstOrThrow();

      if (claim.status === 'paid') {
        throw new Error('Cannot modify a claim that has already been paid');
      }

      // Update bill verification flags
      for (const bv of billVerifications) {
        await trx
          .updateTable('pay.claim_bills')
          .set({
            verified: bv.verified,
            verified_by: decidedByUserId,
          })
          .where('id', '=', bv.billId)
          .where('claim_id', '=', claimId)
          .execute();
      }

      let newStatus: ClaimStatus;
      let finalApprovedAmount: number;

      if (action === 'reject') {
        if (!rejectionReason || rejectionReason.trim().length === 0) {
          throw new Error('Mandatory rejection reason required when declining a claim');
        }
        newStatus = 'rejected';
        finalApprovedAmount = 0;
      } else if (action === 'partially_approve') {
        if (approvedAmountRupees === undefined || approvedAmountRupees <= 0) {
          throw new Error('Approved amount must be specified for partial approval');
        }
        if (approvedAmountRupees > Number(claim.claimed_amount)) {
          throw new Error('Approved amount cannot exceed claimed amount');
        }
        if (!rejectionReason || rejectionReason.trim().length === 0) {
          throw new Error('Mandatory explanation required when partially approving a claim');
        }
        newStatus = 'approved';
        finalApprovedAmount = approvedAmountRupees;
      } else {
        // Full approval
        newStatus = 'approved';
        finalApprovedAmount = approvedAmountRupees ?? Number(claim.claimed_amount);
      }

      await trx
        .updateTable('pay.claims')
        .set({
          status: newStatus,
          approved_amount: finalApprovedAmount.toFixed(2),
          rejection_reason: rejectionReason ?? null,
        })
        .where('id', '=', claimId)
        .execute();

      return {
        status: newStatus,
        approvedAmountRupees: finalApprovedAmount,
      };
    });
  }

  /**
   * Routes an approved claim to either a regular payroll run OR an off-cycle bank batch.
   * Enforces DB invariant: paid_in_run_id XOR paid_in_batch_id.
   * If advanceLoanId is set, performs travel advance adjustment (CLM-07).
   */
  async routePayout(params: RoutePayoutParams): Promise<{
    payoutMethod: 'payroll_run' | 'off_cycle_batch';
    paidAmountRupees: number;
    advanceAdjustedRupees: number;
  }> {
    const { claimId, payoutMethod, runId, batchId, userId } = params;

    if (payoutMethod === 'payroll_run' && !runId) {
      throw new Error('runId is required when paying through regular payroll run');
    }
    if (payoutMethod === 'off_cycle_batch' && !batchId) {
      throw new Error('batchId is required when paying through off-cycle bank batch');
    }

    return await inTransaction(this.db, async (trx) => {
      const claim = await trx
        .selectFrom('pay.claims')
        .innerJoin('pay.claim_types', 'pay.claim_types.id', 'pay.claims.claim_type_id')
        .select([
          'pay.claims.id',
          'pay.claims.employee_id',
          'pay.claims.approved_amount',
          'pay.claims.status',
          'pay.claims.advance_loan_id',
          'pay.claims.paid_in_run_id',
          'pay.claims.paid_in_batch_id',
          'pay.claim_types.payout_component_code',
        ])
        .where('pay.claims.id', '=', claimId)
        .forUpdate()
        .executeTakeFirstOrThrow();

      if (claim.status !== 'approved') {
        throw new Error(`Only approved claims can be paid (current status: ${claim.status})`);
      }
      if (claim.paid_in_run_id !== null || claim.paid_in_batch_id !== null) {
        throw new Error('Claim is already marked as paid');
      }

      const approvedRupees = Number(claim.approved_amount ?? 0);
      let advanceAdjustedRupees = 0;
      let netPayableRupees = approvedRupees;

      // Advance loan settlement (CLM-07)
      if (claim.advance_loan_id) {
        const advLoan = await trx
          .selectFrom('pay.loans')
          .selectAll()
          .where('id', '=', claim.advance_loan_id)
          .forUpdate()
          .executeTakeFirst();

        if (advLoan?.status === 'active') {
          const advOutstanding = Number(advLoan.outstanding);
          advanceAdjustedRupees = Math.min(approvedRupees, advOutstanding);
          netPayableRupees = approvedRupees - advanceAdjustedRupees;

          const newAdvOutstanding = advOutstanding - advanceAdjustedRupees;
          await trx
            .updateTable('pay.loans')
            .set({
              outstanding: newAdvOutstanding.toFixed(2),
              status: newAdvOutstanding <= 0 ? 'closed' : 'active',
            })
            .where('id', '=', claim.advance_loan_id)
            .execute();
        }
      }

      if (payoutMethod === 'payroll_run' && runId) {
        // Enqueue into payroll inputs (pay.inputs) if net amount > 0
        if (netPayableRupees > 0) {
          await trx
            .insertInto('pay.inputs')
            .values({
              run_id: runId,
              employee_id: claim.employee_id,
              component_code: claim.payout_component_code,
              amount: netPayableRupees.toFixed(2),
              note: `Reimbursement claim #${claimId} settlement`,
              entered_by: userId,
            })
            .execute();
        }

        // Update claim record
        await trx
          .updateTable('pay.claims')
          .set({
            status: 'paid',
            paid_in_run_id: runId,
            paid_in_batch_id: null, // XOR enforcement
          })
          .where('id', '=', claimId)
          .execute();
      } else if (payoutMethod === 'off_cycle_batch' && batchId) {
        await trx
          .updateTable('pay.claims')
          .set({
            status: 'paid',
            paid_in_run_id: null, // XOR enforcement
            paid_in_batch_id: batchId,
          })
          .where('id', '=', claimId)
          .execute();
      }

      return {
        payoutMethod,
        paidAmountRupees: netPayableRupees,
        advanceAdjustedRupees,
      };
    });
  }

  /**
   * Retrieves full details for a claim, including attached bills.
   */
  async getClaimDetails(claimId: number): Promise<ClaimWithBills> {
    const row = await this.db
      .selectFrom('pay.claims')
      .innerJoin('pay.claim_types', 'pay.claim_types.id', 'pay.claims.claim_type_id')
      .innerJoin('core.employees', 'core.employees.id', 'pay.claims.employee_id')
      .select([
        'pay.claims.id',
        'pay.claims.employee_id',
        'core.employees.ecode',
        'core.employees.first_name',
        'core.employees.last_name',
        'pay.claim_types.code as claim_type_code',
        'pay.claim_types.name as claim_type_name',
        'pay.claim_types.payout_component_code',
        'pay.claims.period_from',
        'pay.claims.period_to',
        'pay.claims.claimed_amount',
        'pay.claims.approved_amount',
        'pay.claims.status',
        'pay.claims.rejection_reason',
        'pay.claims.advance_loan_id',
        'pay.claims.paid_in_run_id',
        'pay.claims.paid_in_batch_id',
        'pay.claims.created_at',
      ])
      .where('pay.claims.id', '=', claimId)
      .executeTakeFirst();
    if (!row) throw new NotFoundError('Claim not found');

    const bills = await this.db
      .selectFrom('pay.claim_bills')
      .selectAll()
      .where('claim_id', '=', claimId)
      .orderBy('id', 'asc')
      .execute();

    const periodFromStr =
      row.period_from instanceof Date ? row.period_from.toISOString().slice(0, 10) : String(row.period_from).slice(0, 10);
    const periodToStr =
      row.period_to instanceof Date ? row.period_to.toISOString().slice(0, 10) : String(row.period_to).slice(0, 10);

    return {
      id: row.id,
      employeeId: row.employee_id,
      ecode: row.ecode,
      employeeName: `${row.first_name} ${row.last_name}`.trim(),
      claimTypeCode: row.claim_type_code,
      claimTypeName: row.claim_type_name,
      payoutComponentCode: row.payout_component_code,
      periodFrom: periodFromStr,
      periodTo: periodToStr,
      claimedAmountRupees: Number(row.claimed_amount),
      approvedAmountRupees: row.approved_amount ? Number(row.approved_amount) : null,
      status: row.status,
      rejectionReason: row.rejection_reason,
      advanceLoanId: row.advance_loan_id,
      paidInRunId: row.paid_in_run_id,
      paidInBatchId: row.paid_in_batch_id,
      createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
      bills: bills.map((b) => ({
        id: b.id,
        documentId: b.document_id,
        billNo: b.bill_no,
        billDate:
          b.bill_date instanceof Date
            ? b.bill_date.toISOString().slice(0, 10)
            : typeof b.bill_date === 'string'
              ? (b.bill_date as string).slice(0, 10)
              : null,
        amountRupees: Number(b.amount),
        verified: b.verified,
        verifiedBy: b.verified_by,
      })),
    };
  }

  /**
   * Retrieves claims history for an employee.
   */
  async getEmployeeClaims(employeeId: number): Promise<ClaimWithBills[]> {
    const claims = await this.db
      .selectFrom('pay.claims')
      .select(['id'])
      .where('employee_id', '=', employeeId)
      .orderBy('id', 'desc')
      .execute();

    const result: ClaimWithBills[] = [];
    for (const c of claims) {
      result.push(await this.getClaimDetails(c.id));
    }
    return result;
  }

  /**
   * Lists claims waiting for verification or approval.
   */
  async listPendingVerification(statusFilter?: ClaimStatus): Promise<ClaimWithBills[]> {
    let query = this.db.selectFrom('pay.claims').select(['id', 'claim_type_id']);

    if (statusFilter) {
      query = query.where('status', '=', statusFilter);
    } else {
      query = query.where('status', 'in', ['pending', 'verified', 'approved']);
    }

    const rows = await query.orderBy('id', 'desc').execute();
    const result: ClaimWithBills[] = [];
    for (const r of rows) {
      // A claim with no type cannot be verified; one bad row must not 500 the queue.
      if (r.claim_type_id === null) continue;
      try {
        result.push(await this.getClaimDetails(r.id));
      } catch (err) {
        if (err instanceof NotFoundError) continue;
        throw err;
      }
    }
    return result;
  }

  /**
   * Year-end unsubstantiated proof recovery calculation (CLM-05):
   * Identifies unverified or unclaimed limits for taxable components in the final financial year run (March).
   */
  async calculateYearEndUnsubstantiatedRecovery(employeeId: number, fyYear: number): Promise<{
    taxableAdditionRupees: number;
    breakdown: { claimTypeCode: string; unsubstantiatedRupees: number }[];
  }> {
    const marchDate = new Date(Date.UTC(fyYear, 2, 31)); // 31 March
    const entitlements = await this.entitlementService.getEmployeeEntitlements(employeeId, marchDate);

    let taxableAdditionRupees = 0;
    const breakdown: { claimTypeCode: string; unsubstantiatedRupees: number }[] = [];

    for (const ent of entitlements) {
      if (ent.taxableIfUnsubstantiated) {
        // Any approved claim without verified bills is treated as unsubstantiated
        const unverifiedClaims = await this.db
          .selectFrom('pay.claims')
          .innerJoin('pay.claim_bills', 'pay.claim_bills.claim_id', 'pay.claims.id')
          .select((eb) => [eb.fn.sum<string>('pay.claim_bills.amount').as('unverified_sum')])
          .where('pay.claims.employee_id', '=', employeeId)
          .where('pay.claims.status', 'in', ['approved', 'paid'])
          .where('pay.claim_bills.verified', '=', false)
          .executeTakeFirst();

        const unverifiedRupees = Number(unverifiedClaims?.unverified_sum ?? 0);
        if (unverifiedRupees > 0) {
          taxableAdditionRupees += unverifiedRupees;
          breakdown.push({
            claimTypeCode: ent.claimTypeCode,
            unsubstantiatedRupees: unverifiedRupees,
          });
        }
      }
    }

    return {
      taxableAdditionRupees,
      breakdown,
    };
  }
}
