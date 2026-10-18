import type { MigrationBuilder } from 'node-pg-migrate';

/**
 * Migration: Travel & Expense (M13, TE-01..12) — Absorb & Supersede Yatra Avedan
 * Specs: docs/11, docs/01 §8b, docs/13 §6
 *
 * Implements:
 * 1. te.trips & te.trip_itineraries (TE-01..04)
 * 2. te.budgets (TE-05 grade/level allowances)
 * 3. te.advances (TE-07 travel advance workflow)
 * 4. te.wallets & te.wallet_transactions (TE-08 immutable ledger with append-only trigger)
 * 5. te.claims & te.claim_items (TE-10 multi-currency line items)
 * 6. te.settlements (TE-09 claim vs advance settlement with payroll recovery linkage)
 */
export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);

  pgm.sql(`CREATE SCHEMA IF NOT EXISTS te;`);

  // 1. te.trips (TE-01..04)
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS te.trips (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      reference_no TEXT UNIQUE NOT NULL,
      employee_id BIGINT NOT NULL REFERENCES core.employees(id),
      company_id BIGINT NOT NULL REFERENCES core.companies(id),
      trip_name TEXT NOT NULL,
      travel_type TEXT NOT NULL CHECK (travel_type IN ('domestic', 'international')),
      purpose TEXT NOT NULL,
      destination_country TEXT NOT NULL DEFAULT 'India',
      destination_city TEXT NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      visa_required BOOLEAN NOT NULL DEFAULT false,
      visa_status TEXT DEFAULT 'not_applicable' CHECK (visa_status IN ('not_applicable', 'applied', 'approved', 'rejected')),
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'in_progress', 'completed', 'cancelled')),
      estimated_budget_paise BIGINT NOT NULL DEFAULT 0,
      approved_budget_paise BIGINT NOT NULL DEFAULT 0,
      cancellation_reason TEXT,
      cancellation_cost_paise BIGINT DEFAULT 0,
      workflow_request_id BIGINT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_te_trips_employee ON te.trips(employee_id);
    CREATE INDEX IF NOT EXISTS idx_te_trips_status ON te.trips(status);
  `);

  // 2. te.trip_itineraries (TE-01)
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS te.trip_itineraries (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      trip_id BIGINT NOT NULL REFERENCES te.trips(id) ON DELETE CASCADE,
      segment_type TEXT NOT NULL CHECK (segment_type IN ('flight', 'train', 'bus', 'hotel', 'car', 'other')),
      origin TEXT NOT NULL,
      destination TEXT NOT NULL,
      departure_date TIMESTAMPTZ NOT NULL,
      arrival_date TIMESTAMPTZ,
      provider TEXT,
      booking_reference TEXT,
      estimated_cost_paise BIGINT NOT NULL DEFAULT 0,
      actual_cost_paise BIGINT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_te_itineraries_trip ON te.trip_itineraries(trip_id);
  `);

  // 3. te.budgets (TE-05)
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS te.budgets (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      grade_level TEXT NOT NULL,
      travel_type TEXT NOT NULL CHECK (travel_type IN ('domestic', 'international')),
      flight_class TEXT NOT NULL DEFAULT 'economy',
      hotel_per_night_paise BIGINT NOT NULL DEFAULT 400000,
      daily_allowance_paise BIGINT NOT NULL DEFAULT 150000,
      local_conveyance_paise BIGINT NOT NULL DEFAULT 100000,
      is_active BOOLEAN NOT NULL DEFAULT true,
      CONSTRAINT uq_te_budget_grade_type UNIQUE(grade_level, travel_type)
    );

    INSERT INTO te.budgets (grade_level, travel_type, flight_class, hotel_per_night_paise, daily_allowance_paise, local_conveyance_paise) VALUES
      ('A', 'domestic', 'economy', 600000, 200000, 150000),
      ('A', 'international', 'business', 1500000, 500000, 300000),
      ('B', 'domestic', 'economy', 450000, 150000, 100000),
      ('B', 'international', 'economy', 1000000, 350000, 200000),
      ('C', 'domestic', 'economy', 300000, 100000, 80000),
      ('C', 'international', 'economy', 800000, 250000, 150000)
    ON CONFLICT (grade_level, travel_type) DO NOTHING;
  `);

  // 4. te.advances (TE-07)
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS te.advances (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      trip_id BIGINT NOT NULL REFERENCES te.trips(id),
      employee_id BIGINT NOT NULL REFERENCES core.employees(id),
      amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
      purpose TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'approved', 'rejected', 'sent_back', 'disbursed', 'cancelled')),
      workflow_request_id BIGINT,
      disbursed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_te_advances_employee ON te.advances(employee_id);
    CREATE INDEX IF NOT EXISTS idx_te_advances_trip ON te.advances(trip_id);
  `);

  // 5. te.wallets (TE-08)
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS te.wallets (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      employee_id BIGINT NOT NULL UNIQUE REFERENCES core.employees(id),
      balance_paise BIGINT NOT NULL DEFAULT 0 CHECK (balance_paise >= 0),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_te_wallets_employee ON te.wallets(employee_id);
  `);

  // 6. te.wallet_transactions (TE-08 — Immutable Ledger)
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS te.wallet_transactions (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      wallet_id BIGINT NOT NULL REFERENCES te.wallets(id),
      employee_id BIGINT NOT NULL REFERENCES core.employees(id),
      trip_id BIGINT REFERENCES te.trips(id),
      source TEXT NOT NULL CHECK (source IN ('ADVANCE', 'CLAIM_SETTLEMENT', 'RECOVERY', 'ADJUSTMENT')),
      type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
      amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
      balance_after_paise BIGINT NOT NULL CHECK (balance_after_paise >= 0),
      transaction_reference TEXT NOT NULL UNIQUE,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_te_wallet_tx_wallet ON te.wallet_transactions(wallet_id);
    CREATE INDEX IF NOT EXISTS idx_te_wallet_tx_employee ON te.wallet_transactions(employee_id);

    -- Append-only trigger: reject UPDATE/DELETE
    CREATE OR REPLACE FUNCTION te.reject_wallet_tx_mutation() RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'te.wallet_transactions is an immutable ledger; updates and deletes are prohibited';
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_no_update_delete_wallet_transactions ON te.wallet_transactions;
    CREATE TRIGGER trg_no_update_delete_wallet_transactions
      BEFORE UPDATE OR DELETE ON te.wallet_transactions
      FOR EACH ROW EXECUTE FUNCTION te.reject_wallet_tx_mutation();
  `);

  // 7. te.claims & te.claim_items (TE-10)
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS te.claims (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      reference_no TEXT NOT NULL UNIQUE,
      trip_id BIGINT NOT NULL REFERENCES te.trips(id),
      employee_id BIGINT NOT NULL REFERENCES core.employees(id),
      total_claimed_paise BIGINT NOT NULL DEFAULT 0,
      approved_amount_paise BIGINT NOT NULL DEFAULT 0,
      advance_adjusted_paise BIGINT NOT NULL DEFAULT 0,
      net_payable_paise BIGINT NOT NULL DEFAULT 0,
      net_recoverable_paise BIGINT NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'sent_back', 'settled')),
      settlement_status TEXT NOT NULL DEFAULT 'unsettled' CHECK (settlement_status IN ('unsettled', 'settled')),
      workflow_request_id BIGINT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_te_claims_trip ON te.claims(trip_id);
    CREATE INDEX IF NOT EXISTS idx_te_claims_employee ON te.claims(employee_id);

    CREATE TABLE IF NOT EXISTS te.claim_items (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      claim_id BIGINT NOT NULL REFERENCES te.claims(id) ON DELETE CASCADE,
      category TEXT NOT NULL CHECK (category IN ('flight', 'train', 'bus', 'hotel', 'daily_allowance', 'local_travel', 'visa', 'food', 'misc')),
      item_date DATE NOT NULL,
      amount_paise BIGINT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      fx_rate_to_inr NUMERIC(10,4) NOT NULL DEFAULT 1.0000,
      inr_amount_paise BIGINT NOT NULL,
      receipt_document_id BIGINT,
      receipt_url TEXT,
      description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_te_claim_items_claim ON te.claim_items(claim_id);
  `);

  // 8. te.settlements (TE-09)
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS te.settlements (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      claim_id BIGINT NOT NULL REFERENCES te.claims(id),
      trip_id BIGINT NOT NULL REFERENCES te.trips(id),
      employee_id BIGINT NOT NULL REFERENCES core.employees(id),
      settlement_mode TEXT NOT NULL DEFAULT 'AUTO' CHECK (settlement_mode IN ('AUTO', 'MANUAL')),
      claimed_amount_paise BIGINT NOT NULL,
      advance_amount_paise BIGINT NOT NULL,
      net_payable_paise BIGINT NOT NULL DEFAULT 0,
      net_recoverable_paise BIGINT NOT NULL DEFAULT 0,
      recovery_channel TEXT DEFAULT 'payroll_deduction' CHECK (recovery_channel IN ('payroll_deduction', 'wallet_carry_forward', 'direct_refund')),
      settled_by BIGINT REFERENCES core.users(id),
      settled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      status TEXT NOT NULL DEFAULT 'settled' CHECK (status IN ('pending', 'settled', 'payroll_posted'))
    );

    CREATE INDEX IF NOT EXISTS idx_te_settlements_claim ON te.settlements(claim_id);
    CREATE INDEX IF NOT EXISTS idx_te_settlements_employee ON te.settlements(employee_id);
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);

  pgm.sql(`
    DROP TRIGGER IF EXISTS trg_no_update_delete_wallet_transactions ON te.wallet_transactions;
    DROP FUNCTION IF EXISTS te.reject_wallet_tx_mutation();
    DROP TABLE IF EXISTS te.settlements CASCADE;
    DROP TABLE IF EXISTS te.claim_items CASCADE;
    DROP TABLE IF EXISTS te.claims CASCADE;
    DROP TABLE IF EXISTS te.wallet_transactions CASCADE;
    DROP TABLE IF EXISTS te.wallets CASCADE;
    DROP TABLE IF EXISTS te.advances CASCADE;
    DROP TABLE IF EXISTS te.budgets CASCADE;
    DROP TABLE IF EXISTS te.trip_itineraries CASCADE;
    DROP TABLE IF EXISTS te.trips CASCADE;
    DROP SCHEMA IF EXISTS te CASCADE;
  `);
}
