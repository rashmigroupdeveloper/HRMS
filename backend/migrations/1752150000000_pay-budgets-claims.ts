/**
 * Migration — budgets, claims and the commitment ledger (Phase 3.5 Stage T1).
 * Spec: plans/phase-3.5-travel-expense.md · docs/01 §8b (TE-05/06/10) · docs/03 §6.
 *
 * Placed in `pay` because docs/03 §6 reserves `pay.claims` there and because a
 * claim's terminus is a payroll payout or an off-cycle batch — it is money, and
 * it belongs with money.
 *
 * ## Scope: the live model, and only the live model
 *
 * Every column here exists in the live EMS (docs/recon/ems-claims-live-schema.md).
 * docs/03 §6 also describes a grade-ENTITLEMENT funding model (medical, LTA);
 * that is a separate future decision and is deliberately NOT anticipated here.
 * Anticipating it earlier added a `funding_kind` discriminator that nothing
 * used — surface area with no requirement behind it.
 *
 * ## The commitment ledger is the point of this migration
 *
 * `pay.claim_reservations` is append-only. A budget's remaining headroom is
 * `allowance − SUM(live reservation rows)`, never a mutable `remaining` column,
 * because the failure being designed against is silent over-commitment: three
 * people each submitting ₹40,000 against a ₹50,000 budget, each individually
 * affordable at the moment it is approved. Reserving at SUBMISSION — matching
 * the live system — is what makes the third one impossible.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);

  pgm.sql(`
    CREATE SCHEMA IF NOT EXISTS pay;

    ------------------------------------------------------------------
    -- Expense taxonomy (CLM-01). Shared by budget categories and claim lines
    -- so a budget's "hotel" allowance and a line's "hotel" cost are the same
    -- concept and can be compared without a mapping table.
    ------------------------------------------------------------------
    CREATE TABLE pay.claim_types (
      id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      code           TEXT UNIQUE NOT NULL,
      name           TEXT NOT NULL,
      requires_bill  BOOLEAN NOT NULL DEFAULT true,
      is_taxable     BOOLEAN NOT NULL DEFAULT false,
      is_active      BOOLEAN NOT NULL DEFAULT true,
      sort_order     SMALLINT NOT NULL DEFAULT 100,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TRIGGER claim_types_updated_at BEFORE UPDATE ON pay.claim_types
      FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

    ------------------------------------------------------------------
    -- Budgets (TE-05) — the funding source that must be approved first.
    ------------------------------------------------------------------
    CREATE TABLE pay.budgets (
      id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      reference           TEXT UNIQUE NOT NULL,
      title               TEXT NOT NULL,
      purpose             TEXT,
      employee_id         BIGINT NOT NULL REFERENCES core.employees(id),
      company_id          BIGINT NOT NULL REFERENCES core.companies(id),
      cost_center_id      BIGINT REFERENCES core.cost_centers(id),
      period_from         DATE NOT NULL,
      period_to           DATE NOT NULL,
      -- ── The travel request itself (live recon §1) ────────────────────────
      -- In the live system the Budget IS the trip: trips has zero records
      -- because IBudget carries the whole itinerary. Splitting them would give
      -- a user two places to describe one journey, so they stay one object.
      travel_type         TEXT CHECK (travel_type IN ('domestic','international')),
      region              TEXT,
      from_location       TEXT,
      to_location         TEXT,
      travel_start        DATE,
      travel_end          DATE,
      nights              SMALLINT CHECK (nights IS NULL OR nights >= 0),
      desk_books_air      BOOLEAN NOT NULL DEFAULT false,
      desk_books_hotel    BOOLEAN NOT NULL DEFAULT false,
      desk_books_visa     BOOLEAN NOT NULL DEFAULT false,
      own_arrangement_reason TEXT,
      limit_exceed_reason    TEXT,
      -- allowance is the REQUESTED total (live totalEstimatedCost);
      -- approved_allowance is what the approver granted (live approvedBudget).
      -- The ledger draws on the approved figure once approved, never the ask.
      allowance           NUMERIC(14,2) NOT NULL,
      approved_allowance  NUMERIC(14,2) CHECK (approved_allowance IS NULL OR approved_allowance >= 0),
      currency            TEXT NOT NULL DEFAULT 'INR',
      fx_rate_to_inr      NUMERIC(14,6) NOT NULL DEFAULT 1 CHECK (fx_rate_to_inr > 0),
      fx_rate_date        DATE,
      -- Draft -> pending -> approved -> closed, with rejected as a terminus.
      -- Nothing may be claimed until 'approved' (enforced in the service AND
      -- by claims_funding_approved below).
      status              TEXT NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft','pending','approved','rejected','closed')),
      workflow_request_id BIGINT,
      approved_by_user_id BIGINT REFERENCES core.users(id),
      approved_at         TIMESTAMPTZ,
      rejection_reason    TEXT,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT budgets_period_ordered CHECK (period_to >= period_from),
      CONSTRAINT budgets_travel_dates_ordered CHECK (
        travel_start IS NULL OR travel_end IS NULL OR travel_end >= travel_start
      ),
      -- An approved budget must carry the figure that was approved, otherwise
      -- the ledger has nothing defensible to draw against.
      CONSTRAINT budgets_approved_allowance_present CHECK (
        (status <> 'approved') OR (approved_allowance IS NOT NULL)
      ),
      CONSTRAINT budgets_allowance_positive CHECK (allowance > 0),
      CONSTRAINT budgets_approval_pairs CHECK (
        (status <> 'approved') OR (approved_by_user_id IS NOT NULL AND approved_at IS NOT NULL)
      ),
      CONSTRAINT budgets_rejection_reasoned CHECK (
        (status <> 'rejected') OR (length(btrim(coalesce(rejection_reason,''))) >= 3)
      )
    );
    CREATE INDEX budgets_employee_idx ON pay.budgets (employee_id, status);
    CREATE INDEX budgets_company_idx ON pay.budgets (company_id, period_from);
    CREATE TRIGGER budgets_updated_at BEFORE UPDATE ON pay.budgets
      FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

    -- Per-category sub-allowance inside a budget (the live budgetReserved{}
    -- shape). Optional: a budget with no rows here is governed by its total only.
    CREATE TABLE pay.budget_categories (
      id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      budget_id     BIGINT NOT NULL REFERENCES pay.budgets(id) ON DELETE CASCADE,
      claim_type_id BIGINT NOT NULL REFERENCES pay.claim_types(id),
      allowance     NUMERIC(14,2) NOT NULL CHECK (allowance >= 0),
      UNIQUE (budget_id, claim_type_id)
    );

    ------------------------------------------------------------------
    -- Claims (TE-10)
    ------------------------------------------------------------------
    CREATE TABLE pay.claims (
      id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      reference           TEXT UNIQUE NOT NULL,
      employee_id         BIGINT NOT NULL REFERENCES core.employees(id),
      budget_id           BIGINT NOT NULL REFERENCES pay.budgets(id),
      -- The budget the reservation actually sits against, which may differ from
      -- budget_id after a draft budget switch (live budget_reserved_id). The
      -- refund must go back where the money was taken from, not where the claim
      -- currently points.
      reserved_budget_id  BIGINT REFERENCES pay.budgets(id),
      period_from         DATE NOT NULL,
      period_to           DATE NOT NULL,
      claimed_amount      NUMERIC(14,2) NOT NULL CHECK (claimed_amount > 0),
      approved_amount     NUMERIC(14,2) CHECK (approved_amount IS NULL OR approved_amount >= 0),
      -- FX is held on the CLAIM, not the line (live shape): one rate map and
      -- one date per claim, so every line settles at the same rate.
      display_currency    TEXT NOT NULL DEFAULT 'INR',
      fx_rates_to_inr     JSONB,
      fx_rate_date        DATE,
      -- Settlement against an advance already held (live claimSettlement).
      settlement_status   TEXT NOT NULL DEFAULT 'unsettled'
                            CHECK (settlement_status IN ('unsettled','settled')),
      settlement_mode     TEXT CHECK (settlement_mode IN ('AUTO','MANUAL')),
      settlement_amount   NUMERIC(14,2) CHECK (settlement_amount IS NULL OR settlement_amount >= 0),
      net_payable         NUMERIC(14,2),
      settled_by_user_id  BIGINT REFERENCES core.users(id),
      settled_at          TIMESTAMPTZ,
      status              TEXT NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft','submitted','sent_back','approved','rejected','settled')),
      workflow_request_id BIGINT,
      rejection_reason    TEXT,
      submitted_at        TIMESTAMPTZ,
      decided_at          TIMESTAMPTZ,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT claims_period_ordered CHECK (period_to >= period_from),
      CONSTRAINT claims_rejection_reasoned CHECK (
        (status <> 'rejected') OR (length(btrim(coalesce(rejection_reason,''))) >= 3)
      ),
      -- Partial approval is legitimate (CLM-03) but may never exceed the claim.
      CONSTRAINT claims_approved_within_claimed CHECK (
        approved_amount IS NULL OR approved_amount <= claimed_amount
      ),
      -- calculateClaimSettlement() refuses a settlement above the claim; the
      -- database refuses it too, so no code path can slip past the rule.
      CONSTRAINT claims_settlement_within_claim CHECK (
        settlement_amount IS NULL OR settlement_amount <= claimed_amount
      ),
      CONSTRAINT claims_settled_pairs CHECK (
        (settlement_status <> 'settled')
        OR (settlement_mode IS NOT NULL AND settlement_amount IS NOT NULL
            AND settled_by_user_id IS NOT NULL AND settled_at IS NOT NULL)
      )
    );
    CREATE INDEX claims_employee_idx ON pay.claims (employee_id, status);
    CREATE INDEX claims_budget_idx ON pay.claims (budget_id);
    -- Mirrors the live unique_active_claim_per_budget EXACTLY: only a
    -- REJECTED claim frees its budget. A settled claim still blocks a second
    -- one, which is what stops a budget being claimed against twice.
    CREATE UNIQUE INDEX claims_one_live_per_budget
      ON pay.claims (budget_id)
      WHERE budget_id IS NOT NULL AND status <> 'rejected';
    CREATE TRIGGER claims_updated_at BEFORE UPDATE ON pay.claims
      FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

    CREATE TABLE pay.claim_lines (
      id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      claim_id       BIGINT NOT NULL REFERENCES pay.claims(id) ON DELETE CASCADE,
      claim_type_id  BIGINT NOT NULL REFERENCES pay.claim_types(id),
      description    TEXT,
      spent_on       DATE NOT NULL,
      bill_no        TEXT,
      -- Amount as incurred, in its own currency, plus the rate used to convert.
      -- Both are kept: a claim settled months later must still show the rate it
      -- was settled at, not today's.
      original_amount   NUMERIC(14,2) NOT NULL CHECK (original_amount > 0),
      original_currency TEXT NOT NULL DEFAULT 'INR',
      fx_rate_to_inr    NUMERIC(14,6) NOT NULL DEFAULT 1 CHECK (fx_rate_to_inr > 0),
      amount            NUMERIC(14,2) NOT NULL CHECK (amount > 0),  -- INR
      document_path     TEXT,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX claim_lines_claim_idx ON pay.claim_lines (claim_id);

    ------------------------------------------------------------------
    -- The commitment ledger (append-only). Headroom = allowance − SUM(live).
    ------------------------------------------------------------------
    CREATE TABLE pay.claim_reservations (
      id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      budget_id    BIGINT NOT NULL REFERENCES pay.budgets(id),
      claim_id     BIGINT NOT NULL REFERENCES pay.claims(id),
      -- 'reserve' on submission; 'release' on rejection, send-back or deletion.
      -- A release is a NEW row, never an update — the history of what was held
      -- and when is the auditable part.
      movement     TEXT NOT NULL CHECK (movement IN ('reserve','release')),
      amount       NUMERIC(14,2) NOT NULL CHECK (amount > 0),
      -- Per-category breakdown of this movement, mirroring the live
      -- budgetReserved{} snapshot. Kept because a budget's categories are
      -- individually capped, so a refund has to give back the same buckets it
      -- took: {"travel": 12000.00, "hotel": 8000.00, ...}
      by_category  JSONB,
      reason       TEXT NOT NULL,
      actor_user_id BIGINT REFERENCES core.users(id),
      occurred_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX claim_reservations_budget_idx ON pay.claim_reservations (budget_id, occurred_at);
    CREATE INDEX claim_reservations_claim_idx ON pay.claim_reservations (claim_id);

    CREATE OR REPLACE FUNCTION pay.claim_reservations_immutable() RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION 'pay.claim_reservations is append-only (release with a new row, never an update)';
    END $$ LANGUAGE plpgsql;

    CREATE TRIGGER claim_reservations_immutable BEFORE UPDATE OR DELETE ON pay.claim_reservations
      FOR EACH ROW EXECUTE FUNCTION pay.claim_reservations_immutable();

    ------------------------------------------------------------------
    -- Seed the expense taxonomy actually used by the live system.
    ------------------------------------------------------------------
    INSERT INTO pay.claim_types (code, name, requires_bill, sort_order) VALUES
      ('travel',          'Travel',            true,  10),
      ('hotel',           'Hotel / lodging',   true,  20),
      ('daily_allowance', 'Daily allowance',   false, 30),
      ('local_travel',    'Local conveyance',  true,  40),
      ('visa',            'Visa',              true,  50),
      ('misc',            'Miscellaneous',     true,  90)
    ON CONFLICT (code) DO NOTHING;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP TABLE IF EXISTS pay.claim_reservations;
    DROP FUNCTION IF EXISTS pay.claim_reservations_immutable();
    DROP TABLE IF EXISTS pay.claim_lines;
    DROP TABLE IF EXISTS pay.claims;
    DROP TABLE IF EXISTS pay.budget_categories;
    DROP TABLE IF EXISTS pay.budgets;
    DROP TABLE IF EXISTS pay.claim_types;
  `);
}
