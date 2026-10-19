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
import { sql, type Kysely, type Selectable, type Transaction } from 'kysely';
import { writeAudit } from '../../core/audit/audit.service.js';
import { ConflictError, DomainError, ForbiddenError, NotFoundError } from '../../core/errors/index.js';
import { employeeScopeSql, type EmployeeScope } from '../../core/rbac/employee-scope.js';
import { createRequest } from '../workflows/index.js';
import { getTypedSetting } from '../settings/index.js';
import { assertDate, assertWithinTrip, isoDay } from './travel-utils.js';
import { WalletService } from './wallet.service.js';
import { inTransaction } from '../../core/db/database.js';

export type ClaimRow = Selectable<TeClaimsTable>;
export type ClaimItemRow = Selectable<TeClaimItemsTable>;
export type SettlementRow = Selectable<TeSettlementsTable>;

export interface CreateClaimInput {
  tripId: number;
  employeeId: number;
  periodFrom?: string | undefined;
  periodTo?: string | undefined;
}

export interface AddClaimItemInput {
  claimId: number;
  actorEmployeeId: number | null;
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

type Db = Kysely<Database> | Transaction<Database>;

/** Enforces closed travel month rule (EMS Parity: travel month <= te.closed_travel_month cannot be claimed). */
async function assertNotClosedTravelMonth(db: Db, dateInput: string | Date, label: string): Promise<void> {
  const closedMonth = await getTypedSetting<string | null>(db, 'te.closed_travel_month', 'string', '2026-06');
  if (!closedMonth || !closedMonth.trim()) return;
  const d = typeof dateInput === 'string' ? dateInput.slice(0, 10) : dateInput.toISOString().slice(0, 10);
  const month = d.slice(0, 7);
  if (month <= closedMonth.trim()) {
    throw new DomainError(`${label} (${d}) falls within closed travel month (${month} <= ${closedMonth.trim()}); claims cannot be raised or submitted`);
  }
}

/** Computes real-time commitment ledger headroom (SUM(reserve) - SUM(release)). */
export async function getTripBudgetHeadroom(db: Db, tripId: number): Promise<{
  estimatedBudgetPaise: number;
  approvedBudgetPaise: number;
  reservedBudgetPaise: number;
  availableBudgetPaise: number;
}> {
  const trip = await db
    .selectFrom('te.trips')
    .select(['estimated_budget_paise', 'approved_budget_paise', 'status'])
    .where('id', '=', tripId)
    .executeTakeFirst();
  if (!trip) throw new NotFoundError(`Trip #${tripId} not found`);

  const reservations = await db
    .selectFrom('te.budget_reservations')
    .select(['movement', 'amount_paise'])
    .where('trip_id', '=', tripId)
    .execute();

  let reservedBudgetPaise = 0;
  for (const r of reservations) {
    if (r.movement === 'reserve') reservedBudgetPaise += Number(r.amount_paise);
    else if (r.movement === 'release') reservedBudgetPaise -= Number(r.amount_paise);
  }
  if (reservedBudgetPaise < 0) reservedBudgetPaise = 0;

  const approved = Number(trip.approved_budget_paise || 0);
  const availableBudgetPaise = Math.max(0, approved - reservedBudgetPaise);
  return {
    estimatedBudgetPaise: Number(trip.estimated_budget_paise || 0),
    approvedBudgetPaise: approved,
    reservedBudgetPaise,
    availableBudgetPaise,
  };
}

/** 'travel_claim' final hook: approved claims become settleable; rejected/lapsed claims release reservation. */
export async function applyTravelClaimOnFinal(db: Db, request: { id: number }, status: 'approved' | 'rejected' | 'lapsed'): Promise<void> {
  const claim = await db.selectFrom('te.claims').selectAll().where('workflow_request_id', '=', request.id).executeTakeFirst();
  if (claim?.status !== 'submitted') return;
  if (status === 'approved') {
    await db
      .updateTable('te.claims')
      .set({ status: 'approved', approved_amount_paise: claim.total_claimed_paise, updated_at: new Date() })
      .where('id', '=', claim.id)
      .execute();
  } else {
    // Release budget reservation on rejection / lapse
    const reservations = await db
      .selectFrom('te.budget_reservations')
      .select(['movement', 'amount_paise'])
      .where('claim_id', '=', claim.id)
      .execute();
    let netReserved = 0;
    for (const r of reservations) {
      if (r.movement === 'reserve') netReserved += Number(r.amount_paise);
      else if (r.movement === 'release') netReserved -= Number(r.amount_paise);
    }
    if (netReserved > 0) {
      await db
        .insertInto('te.budget_reservations')
        .values({
          trip_id: claim.trip_id,
          claim_id: claim.id,
          movement: 'release',
          amount_paise: netReserved,
          reason: `Claim #${claim.id} ${status} refund`,
          actor_user_id: null,
        })
        .execute();
    }
    await db
      .updateTable('te.claims')
      .set({ status: 'rejected', updated_at: new Date() })
      .where('id', '=', claim.id)
      .execute();
  }
}

export class SettlementService {
  private readonly walletService: WalletService;

  constructor(private readonly db: Kysely<Database>) {
    this.walletService = new WalletService(db);
  }

  /**
   * Creates a new draft claim for a trip strictly against an approved budget.
   */
  async createClaim(input: CreateClaimInput): Promise<ClaimRow> {
    const trip = await this.db
      .selectFrom('te.trips')
      .selectAll()
      .where('id', '=', input.tripId)
      .executeTakeFirst();

    if (!trip) throw new NotFoundError(`Trip #${String(input.tripId)} not found`);
    if (trip.employee_id !== input.employeeId) throw new ForbiddenError('You can only claim expenses on your own trip');
    if (!['approved', 'in_progress', 'completed'].includes(trip.status)) {
      throw new ConflictError(`Expenses can only be claimed on an approved trip (this trip is ${trip.status})`);
    }
    if ((trip.approved_budget_paise ?? 0) <= 0) {
      throw new ConflictError('Cannot claim expenses against a trip without an approved budget');
    }

    const tripStart = isoDay(trip.start_date);
    const tripEnd = isoDay(trip.end_date);
    await assertNotClosedTravelMonth(this.db, tripStart, 'Trip start date');
    await assertNotClosedTravelMonth(this.db, tripEnd, 'Trip end date');

    const fromDate = input.periodFrom ? assertDate(input.periodFrom, 'Claim period from') : tripStart;
    const toDate = input.periodTo ? assertDate(input.periodTo, 'Claim period to') : tripEnd;
    if (toDate < fromDate) throw new DomainError('Claim end date cannot be before start date');
    assertWithinTrip(trip, fromDate, 'Claim start date');
    assertWithinTrip(trip, toDate, 'Claim end date');

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
        period_from: sql<Date>`${fromDate}::date`,
        period_to: sql<Date>`${toDate}::date`,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  /**
   * Adds an itemized expense receipt to a claim. Receipt attachment is mandatory.
   */
  async addClaimItem(input: AddClaimItemInput): Promise<ClaimItemRow> {
    const claim = await this.db
      .selectFrom('te.claims')
      .selectAll()
      .where('id', '=', input.claimId)
      .executeTakeFirst();

    if (!claim) throw new NotFoundError(`Claim #${String(input.claimId)} not found`);
    if (claim.employee_id !== input.actorEmployeeId) throw new ForbiddenError('You can only change your own claims');
    if (claim.status !== 'draft' && claim.status !== 'sent_back') {
      throw new ConflictError(`Cannot add items to a ${claim.status} claim`);
    }

    // Receipt is mandatory on every line
    if (!input.receiptDocumentId && (!input.receiptUrl || !input.receiptUrl.trim())) {
      throw new DomainError('Receipt attachment (document ID or URL) is mandatory for every expense line');
    }

    const trip = await this.db.selectFrom('te.trips').select(['start_date', 'end_date']).where('id', '=', claim.trip_id).executeTakeFirstOrThrow();
    const itemDay = input.itemDate.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(itemDay)) throw new DomainError('Item date must be a valid date (YYYY-MM-DD)');
    assertWithinTrip(trip, itemDay, 'Expense date');
    await assertNotClosedTravelMonth(this.db, itemDay, 'Expense date');

    if (!Number.isInteger(input.amountPaise) || input.amountPaise <= 0) throw new DomainError('Amount must be a positive whole number of paise');

    const fxRate = input.fxRateToInr ?? 1.0;
    if (!(fxRate > 0)) throw new DomainError('Exchange rate must be positive');
    const inrAmountPaise = Math.round(input.amountPaise * fxRate);

    const item = await this.db
      .insertInto('te.claim_items')
      .values({
        claim_id: input.claimId,
        category: input.category,
        item_date: sql<Date>`${itemDay}::date`,
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

    // Recompute total claimed and expand period bounds if needed
    const currentFrom = claim.period_from ? isoDay(claim.period_from) : itemDay;
    const currentTo = claim.period_to ? isoDay(claim.period_to) : itemDay;
    const newFrom = itemDay < currentFrom ? itemDay : currentFrom;
    const newTo = itemDay > currentTo ? itemDay : currentTo;

    await this.db
      .updateTable('te.claims')
      .set({
        total_claimed_paise: sql<number>`total_claimed_paise + ${inrAmountPaise}`,
        period_from: sql<Date>`${newFrom}::date`,
        period_to: sql<Date>`${newTo}::date`,
        updated_at: new Date(),
      })
      .where('id', '=', claim.id)
      .execute();

    return item;
  }

  /**
   * Retrieves claims list.
   */
  async getClaims(filters?: { employeeId?: number | undefined; tripId?: number | undefined; scope?: EmployeeScope | undefined; status?: ClaimRow['status'] | 'all' | undefined }): Promise<ClaimRow[]> {
    let query = this.db.selectFrom('te.claims').selectAll();
    if (filters?.scope) {
      query = query.where(sql<boolean>`employee_id IN (SELECT e.id FROM core.employees e WHERE ${employeeScopeSql(filters.scope, 'e')})`);
    }

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

    if (!claim) throw new NotFoundError(`Claim #${String(id)} not found`);

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

  /** Submits the caller's own draft claim to the reporting manager ('travel_claim'). Enforces receipts, summary doc, non-overlapping claims, and commitment reservation. */
  async submitClaim(params: {
    claimId: number;
    actorEmployeeId: number | null;
    actorUserId: number;
    summaryDocumentId?: number | undefined;
    summaryDocumentUrl?: string | undefined;
  }): Promise<ClaimRow> {
    const claim = await this.db.selectFrom('te.claims').selectAll().where('id', '=', params.claimId).executeTakeFirst();
    if (!claim) throw new NotFoundError(`Claim #${String(params.claimId)} not found`);
    if (claim.employee_id !== params.actorEmployeeId) throw new ForbiddenError('You can only submit your own claims');
    if (claim.status !== 'draft' && claim.status !== 'sent_back') throw new ConflictError(`Claim is already ${claim.status}`);
    if (claim.total_claimed_paise <= 0) throw new DomainError('Add at least one expense item before submitting');

    const summaryId = params.summaryDocumentId ?? claim.summary_document_id;
    const summaryUrl = params.summaryDocumentUrl ?? claim.summary_document_url;
    if (!summaryId && (!summaryUrl || !summaryUrl.trim())) {
      throw new DomainError('Summary document attachment is mandatory before submitting a claim');
    }

    const items = await this.db.selectFrom('te.claim_items').selectAll().where('claim_id', '=', claim.id).execute();
    for (const it of items) {
      if (!it.receipt_document_id && (!it.receipt_url || !it.receipt_url.trim())) {
        throw new DomainError(`Receipt attachment is missing for expense line #${it.id} (${it.category})`);
      }
    }

    // Overlapping active claim check on the same trip budget
    const claimFrom = claim.period_from ? isoDay(claim.period_from) : null;
    const claimTo = claim.period_to ? isoDay(claim.period_to) : null;
    if (claimFrom && claimTo) {
      const overlapping = await this.db
        .selectFrom('te.claims')
        .selectAll()
        .where('trip_id', '=', claim.trip_id)
        .where('id', '!=', claim.id)
        .where('status', 'in', ['submitted', 'approved', 'settled'])
        .where('period_from', 'is not', null)
        .where('period_to', 'is not', null)
        .where((eb) =>
          eb.and([
            eb('period_from', '<=', sql<Date>`${claimTo}::date`),
            eb('period_to', '>=', sql<Date>`${claimFrom}::date`),
          ])
        )
        .executeTakeFirst();
      if (overlapping) {
        throw new ConflictError(
          `Claim travel dates (${claimFrom} to ${claimTo}) overlap with active claim #${overlapping.id} (${isoDay(overlapping.period_from!)} to ${isoDay(overlapping.period_to!)}) on this trip budget`
        );
      }
    }

    return inTransaction(this.db, async (trx) => {
      // Commitment headroom check
      const { availableBudgetPaise } = await getTripBudgetHeadroom(trx, claim.trip_id);
      if (claim.total_claimed_paise > availableBudgetPaise) {
        throw new ConflictError(
          `Claim total (₹${(claim.total_claimed_paise / 100).toFixed(2)}) exceeds available trip budget headroom (₹${(availableBudgetPaise / 100).toFixed(2)})`
        );
      }

      // Reserve in commitment ledger
      await trx
        .insertInto('te.budget_reservations')
        .values({
          trip_id: claim.trip_id,
          claim_id: claim.id,
          movement: 'reserve',
          amount_paise: claim.total_claimed_paise,
          reason: `Claim #${claim.id} submission reservation`,
          actor_user_id: params.actorUserId,
        })
        .execute();

      await createRequest(
        trx,
        {
          definitionCode: 'travel_claim',
          subjectEmployeeId: claim.employee_id,
          requestedByUserId: params.actorUserId,
          payload: { claimId: claim.id, totalClaimedPaise: claim.total_claimed_paise },
        },
        async (t, requestId) => {
          await t
            .updateTable('te.claims')
            .set({
              status: 'submitted',
              workflow_request_id: requestId,
              summary_document_id: summaryId ?? null,
              summary_document_url: summaryUrl ?? null,
              updated_at: new Date(),
            })
            .where('id', '=', claim.id)
            .execute();
          await writeAudit(t, {
            actorUserId: params.actorUserId,
            action: 'submit',
            entity: 'te.claims',
            entityId: claim.id,
            newValue: String(claim.total_claimed_paise),
          });
        }
      );

      return trx.selectFrom('te.claims').selectAll().where('id', '=', claim.id).executeTakeFirstOrThrow();
    });
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
    return inTransaction(this.db, async (trx) => {
    const walletService = new WalletService(trx);
    const claim = await trx
      .selectFrom('te.claims')
      .selectAll()
      .where('id', '=', params.claimId)
      .executeTakeFirst();

    if (!claim) throw new NotFoundError(`Claim #${String(params.claimId)} not found`);
    if (claim.settlement_status === 'settled') throw new ConflictError(`Claim #${String(params.claimId)} is already settled`);
    // P-23: only a claim the approval chain approved can be settled.
    if (claim.status !== 'approved') throw new ConflictError(`Claim #${String(params.claimId)} is ${claim.status}; only approved claims can be settled`);
    const settler = await trx.selectFrom('core.users').select('employee_id').where('id', '=', params.settledByUserId).executeTakeFirst();
    if (settler?.employee_id === claim.employee_id) throw new ForbiddenError('You cannot settle your own claim');
    const openAdvance = await trx.selectFrom('te.advances').select('id').where('trip_id', '=', claim.trip_id).where('status', 'in', ['requested', 'approved']).executeTakeFirst();
    if (openAdvance) throw new ConflictError(`Advance #${String(openAdvance.id)} on this trip is still open; disburse or cancel it before settling`);

    const approvedAmountPaise = params.approvedAmountPaise ?? (claim.approved_amount_paise || claim.total_claimed_paise);
    if (!Number.isInteger(approvedAmountPaise) || approvedAmountPaise < 0 || approvedAmountPaise > claim.total_claimed_paise) {
      throw new DomainError('Approved amount must be between 0 and the claimed total');
    }
    const wallet = await walletService.getOrCreateWallet(claim.employee_id);
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
      await walletService.debit({
        employeeId: claim.employee_id,
        amountPaise: debitAmountPaise,
        source: 'CLAIM_SETTLEMENT',
        transactionReference: `TX-SETTLE-${claim.reference_no}`,
        tripId: claim.trip_id,
        notes: `Settlement for claim ${claim.reference_no}: adjusted ₹${(advanceAdjustedPaise / 100).toFixed(2)}`,
      });
    }

    const recoveryChannel = params.recoveryChannel ?? 'payroll_deduction';

    // 2. Insert settlement record
    const settlement = await trx
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
    const updatedClaim = await trx
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

    const postWallet = await walletService.getOrCreateWallet(claim.employee_id);

    const result: SettlementResult = {
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
    await writeAudit(trx, { actorUserId: params.settledByUserId, action: 'settle', entity: 'te.claims', entityId: claim.id, newValue: JSON.stringify({ netPayablePaise, netRecoverablePaise }) });
    return result;
    });
  }
}
