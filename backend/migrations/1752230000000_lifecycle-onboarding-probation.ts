/**
 * Lifecycle Module — Onboarding Bridge, Task Fan-out & Probation Reviews (Cards L01, L02, LC-01..04).
 *
 * Implements:
 * 1. core.onboarding_candidates (LC-01): ATS candidate / LOI intake, pre-join token tracking, and conversion.
 * 2. core.onboarding_tasks (LC-02): Post-conversion stakeholder fan-out checklist across IT/Admin/HR/Payroll with SLAs.
 * 3. core.probation_reviews (LC-04): Probation evaluation queue, manager recommendations, and confirmed salary transition.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);
  pgm.sql(`
    -- 1. Onboarding Candidates Bridge Table (LC-01)
    CREATE TABLE IF NOT EXISTS core.onboarding_candidates (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      ats_candidate_id BIGINT,
      loi_reference TEXT,
      full_name TEXT NOT NULL,
      personal_email TEXT NOT NULL,
      mobile TEXT NOT NULL,
      dob DATE,
      address TEXT,
      total_experience_years NUMERIC(4,1),
      previous_company TEXT,
      current_salary NUMERIC(14,2),
      expected_salary NUMERIC(14,2),
      position_title TEXT NOT NULL,
      department TEXT,
      org_unit TEXT,
      designation TEXT,
      company_id BIGINT REFERENCES core.companies(id),
      category core.employment_category NOT NULL DEFAULT 'white_collar',
      replacement_of_ecode TEXT,
      offered_ctc NUMERIC(14,2) NOT NULL,
      probation_months SMALLINT DEFAULT 6,
      probation_salary_pct SMALLINT DEFAULT 100,
      proposed_doj DATE NOT NULL,
      offer_date DATE NOT NULL,
      work_location TEXT,
      prejoin_link_token TEXT UNIQUE,
      prejoin_token_hash TEXT,
      prejoin_token_expires_at TIMESTAMPTZ,
      prejoin_link_sent_at TIMESTAMPTZ,
      prejoin_completed_at TIMESTAMPTZ,
      prejoin_submitted_data JSONB,
      status TEXT NOT NULL DEFAULT 'awaiting_prejoin' CHECK (status IN ('awaiting_prejoin', 'link_sent', 'prejoin_done', 'converted', 'no_show')),
      employee_id BIGINT REFERENCES core.employees(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS onboarding_candidates_status_idx ON core.onboarding_candidates(status);
    CREATE INDEX IF NOT EXISTS onboarding_candidates_company_idx ON core.onboarding_candidates(company_id);

    -- 2. Onboarding Stakeholder Tasks Table (LC-02)
    CREATE TABLE IF NOT EXISTS core.onboarding_tasks (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      employee_id BIGINT NOT NULL REFERENCES core.employees(id),
      candidate_id BIGINT REFERENCES core.onboarding_candidates(id),
      task_code TEXT NOT NULL,
      task_name TEXT NOT NULL,
      department TEXT NOT NULL CHECK (department IN ('IT', 'Admin', 'HR', 'Payroll')),
      owner_role TEXT NOT NULL,
      due_date DATE NOT NULL,
      sla_hours INTEGER NOT NULL DEFAULT 48,
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'completed', 'escalated')),
      escalated_at TIMESTAMPTZ,
      done_by BIGINT REFERENCES core.users(id),
      done_at TIMESTAMPTZ,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS onboarding_tasks_emp_idx ON core.onboarding_tasks(employee_id);
    CREATE INDEX IF NOT EXISTS onboarding_tasks_status_idx ON core.onboarding_tasks(status, due_date);

    -- 3. Probation Reviews Table (LC-04)
    CREATE TABLE IF NOT EXISTS core.probation_reviews (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      employee_id BIGINT NOT NULL REFERENCES core.employees(id),
      due_date DATE NOT NULL,
      manager_recommendation TEXT CHECK (manager_recommendation IN ('confirm', 'extend', 'separate')),
      extension_months SMALLINT CHECK (extension_months BETWEEN 1 AND 6),
      review_notes TEXT,
      ratings JSONB,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'completed')),
      outcome TEXT CHECK (outcome IN ('confirmed', 'extended', 'separated')),
      decided_by BIGINT REFERENCES core.users(id),
      decided_at TIMESTAMPTZ,
      confirmation_date DATE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS probation_reviews_emp_idx ON core.probation_reviews(employee_id);
    CREATE INDEX IF NOT EXISTS probation_reviews_due_idx ON core.probation_reviews(due_date, status);
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP TABLE IF EXISTS core.probation_reviews;
    DROP TABLE IF EXISTS core.onboarding_tasks;
    DROP TABLE IF EXISTS core.onboarding_candidates;
  `);
}
