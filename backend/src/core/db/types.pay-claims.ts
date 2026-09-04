/**
 * `pay` budgets, claims and the commitment ledger (Phase 3.5 Stage T1).
 *
 * Money columns are `NUMERIC` in the database and arrive as strings from
 * node-postgres; the services convert at the boundary into the branded `Paise`
 * integer type (docs/14 §6 — floats never touch money).
 */
import type { ColumnType, Generated } from 'kysely';

/** A DB-defaulted timestamp that still SELECTs as a real `Date`. */
type DefaultedTimestamp = ColumnType<Date, Date | string | undefined, Date | string>;
type Timestamp = ColumnType<Date, Date | string, Date | string>;
type DateOnly = ColumnType<Date, Date | string, Date | string>;
/** NUMERIC: read as string to preserve exactness, written as string or number. */
type Numeric = ColumnType<string, string | number, string | number>;

export type BudgetStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'closed';
export type ClaimStatus =
  | 'draft'
  | 'submitted'
  | 'sent_back'
  | 'approved'
  | 'rejected'
  | 'settled';
export type ReservationMovement = 'reserve' | 'release';

export interface PayClaimTypesTable {
  id: Generated<number>;
  code: string;
  name: string;
  requires_bill: Generated<boolean>;
  is_taxable: Generated<boolean>;
  is_active: Generated<boolean>;
  sort_order: Generated<number>;
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
}

export type TravelType = 'domestic' | 'international';

/**
 * The budget IS the travel request (live recon §1): the EMS `trips` collection
 * is empty because IBudget carries the itinerary itself.
 */
export interface PayBudgetsTable {
  id: Generated<number>;
  reference: string;
  title: string;
  purpose: string | null;
  employee_id: number;
  company_id: number;
  cost_center_id: number | null;
  period_from: DateOnly;
  period_to: DateOnly;
  travel_type: TravelType | null;
  region: string | null;
  from_location: string | null;
  to_location: string | null;
  travel_start: DateOnly | null;
  travel_end: DateOnly | null;
  nights: number | null;
  desk_books_air: Generated<boolean>;
  desk_books_hotel: Generated<boolean>;
  desk_books_visa: Generated<boolean>;
  own_arrangement_reason: string | null;
  limit_exceed_reason: string | null;
  /** Requested total. The ledger draws on `approved_allowance` once approved. */
  allowance: Numeric;
  approved_allowance: Numeric | null;
  currency: Generated<string>;
  fx_rate_to_inr: Generated<Numeric>;
  fx_rate_date: DateOnly | null;
  status: Generated<BudgetStatus>;
  workflow_request_id: number | null;
  approved_by_user_id: number | null;
  approved_at: Timestamp | null;
  rejection_reason: string | null;
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
}

export interface PayBudgetCategoriesTable {
  id: Generated<number>;
  budget_id: number;
  claim_type_id: number;
  allowance: Numeric;
}

export interface PayClaimsTable {
  id: Generated<number>;
  reference: string;
  employee_id: number;
  budget_id: number;
  /** Where the reservation actually sits; may differ after a budget switch. */
  reserved_budget_id: number | null;
  period_from: DateOnly;
  period_to: DateOnly;
  claimed_amount: Numeric;
  approved_amount: Numeric | null;
  /** FX lives on the claim, not the line — one rate map per claim (live shape). */
  display_currency: Generated<string>;
  fx_rates_to_inr: Record<string, number> | null;
  fx_rate_date: DateOnly | null;
  settlement_status: Generated<'unsettled' | 'settled'>;
  settlement_mode: 'AUTO' | 'MANUAL' | null;
  settlement_amount: Numeric | null;
  net_payable: Numeric | null;
  settled_by_user_id: number | null;
  settled_at: Timestamp | null;
  status: Generated<ClaimStatus>;
  workflow_request_id: number | null;
  rejection_reason: string | null;
  submitted_at: Timestamp | null;
  decided_at: Timestamp | null;
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
}

export interface PayClaimLinesTable {
  id: Generated<number>;
  claim_id: number;
  claim_type_id: number;
  description: string | null;
  spent_on: DateOnly;
  bill_no: string | null;
  original_amount: Numeric;
  original_currency: Generated<string>;
  fx_rate_to_inr: Generated<Numeric>;
  amount: Numeric;
  document_path: string | null;
  created_at: DefaultedTimestamp;
}

/** Append-only. A release is a NEW row, never an update to the reserve row. */
export interface PayClaimReservationsTable {
  id: Generated<number>;
  budget_id: number;
  claim_id: number;
  movement: ReservationMovement;
  amount: Numeric;
  /** Per-category breakdown, mirroring the live budgetReserved{} snapshot. */
  by_category: Record<string, number> | null;
  reason: string;
  actor_user_id: number | null;
  occurred_at: DefaultedTimestamp;
}
