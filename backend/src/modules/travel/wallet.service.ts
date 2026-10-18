/**
 * Employee Travel Wallet & Immutable Ledger Service (TE-08).
 *
 * Enforces the same immutable-ledger discipline as leave and payroll:
 * - Wallet balance = SUM(credits) - SUM(debits)
 * - Every movement is an immutable te.wallet_transactions row
 * - Append-only: DB trigger blocks any UPDATE or DELETE
 * - Idempotent via unique transaction_reference
 */

import type { Database, TeWalletsTable, TeWalletTransactionsTable } from '../../core/db/types.js';
import type { Kysely, Selectable } from 'kysely';

export type WalletRow = Selectable<TeWalletsTable>;
export type WalletTransactionRow = Selectable<TeWalletTransactionsTable>;

export interface WalletCreditParams {
  employeeId: number;
  amountPaise: number;
  source: 'ADVANCE' | 'ADJUSTMENT';
  transactionReference: string;
  tripId?: number | undefined;
  notes?: string | undefined;
}

export interface WalletDebitParams {
  employeeId: number;
  amountPaise: number;
  source: 'CLAIM_SETTLEMENT' | 'RECOVERY';
  transactionReference: string;
  tripId?: number | undefined;
  notes?: string | undefined;
}

export class WalletService {
  constructor(private readonly db: Kysely<Database>) {}

  /**
   * Gets or creates the employee travel wallet.
   */
  async getOrCreateWallet(employeeId: number): Promise<WalletRow> {
    const existing = await this.db
      .selectFrom('te.wallets')
      .selectAll()
      .where('employee_id', '=', employeeId)
      .executeTakeFirst();

    if (existing) {
      return existing;
    }

    return await this.db
      .insertInto('te.wallets')
      .values({
        employee_id: employeeId,
        balance_paise: 0,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  /**
   * Retrieves all immutable wallet transactions for an employee.
   */
  async getTransactions(employeeId: number): Promise<WalletTransactionRow[]> {
    return await this.db
      .selectFrom('te.wallet_transactions')
      .selectAll()
      .where('employee_id', '=', employeeId)
      .orderBy('id', 'desc')
      .execute();
  }

  /**
   * Credits the employee wallet (e.g. advance approval) and logs immutable transaction.
   */
  async credit(params: WalletCreditParams): Promise<{ wallet: WalletRow; transaction: WalletTransactionRow }> {
    if (params.amountPaise <= 0) {
      throw new Error(`Credit amount must be greater than 0 paise`);
    }

    const wallet = await this.getOrCreateWallet(params.employeeId);
    const newBalance = wallet.balance_paise + params.amountPaise;

    // 1. Record immutable ledger transaction
    const transaction = await this.db
      .insertInto('te.wallet_transactions')
      .values({
        wallet_id: wallet.id,
        employee_id: params.employeeId,
        trip_id: params.tripId ?? null,
        source: params.source,
        type: 'credit',
        amount_paise: params.amountPaise,
        balance_after_paise: newBalance,
        transaction_reference: params.transactionReference,
        notes: params.notes ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    // 2. Update wallet current balance
    const updatedWallet = await this.db
      .updateTable('te.wallets')
      .set({
        balance_paise: newBalance,
        updated_at: new Date(),
      })
      .where('id', '=', wallet.id)
      .returningAll()
      .executeTakeFirstOrThrow();

    return { wallet: updatedWallet, transaction };
  }

  /**
   * Debits the employee wallet (e.g. claim settlement or advance reconciliation).
   */
  async debit(params: WalletDebitParams): Promise<{ wallet: WalletRow; transaction: WalletTransactionRow }> {
    if (params.amountPaise <= 0) {
      throw new Error(`Debit amount must be greater than 0 paise`);
    }

    const wallet = await this.getOrCreateWallet(params.employeeId);
    const currentBalance = wallet.balance_paise;

    if (currentBalance < params.amountPaise) {
      throw new Error(
        `Insufficient wallet balance: requested debit of ₹${(params.amountPaise / 100).toFixed(2)}, current balance is ₹${(currentBalance / 100).toFixed(2)}`
      );
    }

    const newBalance = currentBalance - params.amountPaise;

    // 1. Record immutable ledger transaction
    const transaction = await this.db
      .insertInto('te.wallet_transactions')
      .values({
        wallet_id: wallet.id,
        employee_id: params.employeeId,
        trip_id: params.tripId ?? null,
        source: params.source,
        type: 'debit',
        amount_paise: params.amountPaise,
        balance_after_paise: newBalance,
        transaction_reference: params.transactionReference,
        notes: params.notes ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    // 2. Update wallet current balance
    const updatedWallet = await this.db
      .updateTable('te.wallets')
      .set({
        balance_paise: newBalance,
        updated_at: new Date(),
      })
      .where('id', '=', wallet.id)
      .returningAll()
      .executeTakeFirstOrThrow();

    return { wallet: updatedWallet, transaction };
  }

  /**
   * Verifies the mathematical integrity of the wallet ledger:
   * balance === SUM(credits) - SUM(debits)
   */
  async verifyLedgerIntegrity(employeeId: number): Promise<{
    isValid: boolean;
    computedBalancePaise: number;
    recordedBalancePaise: number;
    totalCreditsPaise: number;
    totalDebitsPaise: number;
    transactionCount: number;
  }> {
    const wallet = await this.getOrCreateWallet(employeeId);
    const txs = await this.getTransactions(employeeId);

    let credits = 0;
    let debits = 0;

    for (const tx of txs) {
      if (tx.type === 'credit') {
        credits += tx.amount_paise;
      } else {
        debits += tx.amount_paise;
      }
    }

    const computed = credits - debits;
    const recorded = wallet.balance_paise;

    return {
      isValid: computed === recorded,
      computedBalancePaise: computed,
      recordedBalancePaise: recorded,
      totalCreditsPaise: credits,
      totalDebitsPaise: debits,
      transactionCount: txs.length,
    };
  }
}
