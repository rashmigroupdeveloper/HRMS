/**
 * Travel Claims & Settlement Engine Service (TE-09, TE-10).
 *
 * Implements:
 * 1. Claim creation with multi-currency itemized expenses.
 * 2. Automated & manual settlement engine reconciling claim vs wallet advance.
 * 3. Computing net payable to employee OR net recoverable (deducted in payroll).
 * 4. Automatic wallet ledger debit via WalletService.
 */

import type { Database, TeClaimsTable, TeClaimItemsTable, TeSettlementsTable } from '../../core/db/types.js';
import type { Kysely, Selectable } from 'kysely';
import { WalletService } from './wallet.service.js';

export type ClaimRow = Selectable<TeClaimsTable>;
export type ClaimItemRow = Selectable<TeClaimItemsTable>;
export type SettlementRow = Selectable<TeSettlementsTable>;

export interface CreateClaimInput {
  tripId: number;
  employeeId: number;
}

export interface AddClaimItemInput {
  claimId: number;
  category: 'flight' | 'train' | 'bus' | 'hotel' | 'daily_allowance' | 'local_travel' | 'visa' | 'food' | 'misc';
  itemDate: string; // YYYY-MM-DD
  amountPaise: number;
  currency?: string | undefined;
  fxRateToInr?: number | undefined;
  receiptDocumentId?: number | undefined;
  receiptUrl?: string | undefined;
  description?: string | undefined;
}

export interface SettleClaimParams {
  claimId: number;
  approvedAmountPaise?: number | undefined;
  settledByUserId: number;
  settlementMode?: 'AUTO' | 'MANUAL' | undefined;
  recoveryChannel?: 'payroll_deduction' | 'wallet_carry_forward' | 'direct_refund' | undefined;
}

export interface SettlementResult {
  settlement: SettlementRow;
  claim: ClaimRow;
  reconciliation: {
    totalClaimedPaise: number;
    approvedAmountPaise: number;
    advanceAdjustedPaise: number;
    netPayablePaise: number;
    netRecoverablePaise: number;
    walletBalanceBeforePaise: number;
    walletBalanceAfterPaise: number;
  };
}

export class SettlementService {
  private readonly walletService: WalletService;

  constructor(private readonly db: Kysely<Database>) {
    this.walletService = new WalletService(db);
  }

  /**
   * Creates a new draft claim for a trip.
   */
  async createClaim(input: CreateClaimInput): Promise<ClaimRow> {
    const trip = await this.db
      .selectFrom('te.trips')
      .selectAll()
      .where('id', '=', input.tripId)
      .executeTakeFirst();

    if (!trip) {
      throw new Error(`Trip #${input.tripId} not found`);
    }

    const referenceNo = `CLM-${new Date().getFullYear()}-${String(Math.floor(1000 + Math.random() * 9000))}`;

    return await this.db
      .insertInto('te.claims')
      .values({
        reference_no: referenceNo,
        trip_id: input.tripId,
        employee_id: input.employeeId,
        total_claimed_paise: 0,
        approved_amount_paise: 0,
        advance_adjusted_paise: 0,
        net_payable_paise: 0,
        net_recoverable_paise: 0,
        status: 'draft',
        settlement_status: 'unsettled',
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  /**
   * Adds an itemized expense receipt to a claim.
   */
  async addClaimItem(input: AddClaimItemInput): Promise<ClaimItemRow> {
    const claim = await this.db
      .selectFrom('te.claims')
      .selectAll()
      .where('id', '=', input.claimId)
      .executeTakeFirst();

    if (!claim) {
      throw new Error(`Claim #${input.claimId} not found`);
    }

    if (claim.status === 'settled') {
      throw new Error(`Cannot add items to already settled claim`);
    }

    const fxRate = input.fxRateToInr ?? 1.0;
    const inrAmountPaise = Math.round(input.amountPaise * fxRate);

    const item = await this.db
      .insertInto('te.claim_items')
      .values({
        claim_id: input.claimId,
        category: input.category,
        item_date: new Date(input.itemDate),
        amount_paise: input.amountPaise,
        currency: input.currency ?? 'INR',
        fx_rate_to_inr: fxRate.toFixed(4),
        inr_amount_paise: inrAmountPaise,
        receipt_document_id: input.receiptDocumentId ?? null,
        receipt_url: input.receiptUrl ?? null,
        description: input.description ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    // Recompute total claimed
    const newTotal = claim.total_claimed_paise + inrAmountPaise;
    await this.db
      .updateTable('te.claims')
      .set({
        total_claimed_paise: newTotal,
        updated_at: new Date(),
      })
      .where('id', '=', claim.id)
      .execute();

    return item;
  }

  /**
   * Retrieves claims list.
   */
  async getClaims(filters?: { employeeId?: number | undefined; tripId?: number | undefined; status?: ClaimRow['status'] | 'all' | undefined }): Promise<ClaimRow[]> {
    let query = this.db.selectFrom('te.claims').selectAll();

    if (filters?.employeeId) {
      query = query.where('employee_id', '=', filters.employeeId);
    }
    if (filters?.tripId) {
      query = query.where('trip_id', '=', filters.tripId);
    }
    if (filters?.status && filters.status !== 'all') {
      query = query.where('status', '=', filters.status);
    }

    return await query.orderBy('id', 'desc').execute();
  }

  /**
   * Retrieves single claim with items.
   */
  async getClaimById(id: number): Promise<{ claim: ClaimRow; items: ClaimItemRow[]; settlement?: SettlementRow | null }> {
    const claim = await this.db
      .selectFrom('te.claims')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    if (!claim) {
      throw new Error(`Claim #${id} not found`);
    }

    const items = await this.db
      .selectFrom('te.claim_items')
      .selectAll()
      .where('claim_id', '=', id)
      .orderBy('id', 'asc')
      .execute();

    const settlement = await this.db
      .selectFrom('te.settlements')
      .selectAll()
      .where('claim_id', '=', id)
      .executeTakeFirst();

    return { claim, items, settlement: settlement ?? null };
  }

  /**
   * Reconciles claim against advance and settles the claim (TE-09).
   *
   * Logic:
   * 1. Fetches current wallet balance for employee.
   * 2. If approvedAmount >= walletBalance:
   *    advanceAdjusted = walletBalance
   *    netPayable = approvedAmount - walletBalance (company owes employee)
   *    netRecoverable = 0
   * 3. If walletBalance > approvedAmount:
   *    advanceAdjusted = approvedAmount
   *    netPayable = 0
   *    netRecoverable = walletBalance - approvedAmount (employee owes company -> marked for payroll recovery)
   * 4. Debits the advance amount from the wallet.
   * 5. Persists te.settlements and updates claim status to 'settled'.
   */
  async settleClaim(params: SettleClaimParams): Promise<SettlementResult> {
    const claim = await this.db
      .selectFrom('te.claims')
      .selectAll()
      .where('id', '=', params.claimId)
      .executeTakeFirst();

    if (!claim) {
      throw new Error(`Claim #${params.claimId} not found`);
    }

    if (claim.settlement_status === 'settled') {
      throw new Error(`Claim #${params.claimId} is already settled`);
    }

    const approvedAmountPaise = params.approvedAmountPaise ?? claim.total_claimed_paise;
    const wallet = await this.walletService.getOrCreateWallet(claim.employee_id);
    const advanceHeldPaise = wallet.balance_paise;

    let advanceAdjustedPaise = 0;
    let netPayablePaise = 0;
    let netRecoverablePaise = 0;
    let debitAmountPaise = 0;

    if (approvedAmountPaise >= advanceHeldPaise) {
      // Employee spent more than or equal to advance -> Net payable to employee
      advanceAdjustedPaise = advanceHeldPaise;
      netPayablePaise = approvedAmountPaise - advanceHeldPaise;
      netRecoverablePaise = 0;
      debitAmountPaise = advanceHeldPaise;
    } else {
      // Employee spent less than advance -> Net recoverable from employee
      advanceAdjustedPaise = approvedAmountPaise;
      netPayablePaise = 0;
      netRecoverablePaise = advanceHeldPaise - approvedAmountPaise;
      // Debit the full advance held to clear wallet, remaining goes to payroll deduction
      debitAmountPaise = advanceHeldPaise;
    }

    // 1. Debit the wallet if there is advance to adjust
    if (debitAmountPaise > 0) {
      await this.walletService.debit({
        employeeId: claim.employee_id,
        amountPaise: debitAmountPaise,
        source: 'CLAIM_SETTLEMENT',
        transactionReference: `TX-SETTLE-${claim.reference_no}-${Date.now()}`,
        tripId: claim.trip_id,
        notes: `Settlement for claim ${claim.reference_no}: adjusted ₹${(advanceAdjustedPaise / 100).toFixed(2)}`,
      });
    }

    const recoveryChannel = params.recoveryChannel ?? 'payroll_deduction';

    // 2. Insert settlement record
    const settlement = await this.db
      .insertInto('te.settlements')
      .values({
        claim_id: claim.id,
        trip_id: claim.trip_id,
        employee_id: claim.employee_id,
        settlement_mode: params.settlementMode ?? 'AUTO',
        claimed_amount_paise: claim.total_claimed_paise,
        advance_amount_paise: advanceHeldPaise,
        net_payable_paise: netPayablePaise,
        net_recoverable_paise: netRecoverablePaise,
        recovery_channel: recoveryChannel,
        settled_by: params.settledByUserId,
        settled_at: new Date(),
        status: 'settled',
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    // 3. Update claim record
    const updatedClaim = await this.db
      .updateTable('te.claims')
      .set({
        approved_amount_paise: approvedAmountPaise,
        advance_adjusted_paise: advanceAdjustedPaise,
        net_payable_paise: netPayablePaise,
        net_recoverable_paise: netRecoverablePaise,
        status: 'settled',
        settlement_status: 'settled',
        updated_at: new Date(),
      })
      .where('id', '=', claim.id)
      .returningAll()
      .executeTakeFirstOrThrow();

    const postWallet = await this.walletService.getOrCreateWallet(claim.employee_id);

    return {
      settlement,
      claim: updatedClaim,
      reconciliation: {
        totalClaimedPaise: claim.total_claimed_paise,
        approvedAmountPaise,
        advanceAdjustedPaise,
        netPayablePaise,
        netRecoverablePaise,
        walletBalanceBeforePaise: advanceHeldPaise,
        walletBalanceAfterPaise: postWallet.balance_paise,
      },
    };
  }
}
