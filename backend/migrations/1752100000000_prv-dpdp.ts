/**
 * Stage 5.3 — DPDP baseline (PRV-01..10).
 * Spec: plans/phase-5-compliance-and-trust.md Stage 5.3.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);

  pgm.sql(`
    CREATE SCHEMA IF NOT EXISTS prv;

    CREATE TABLE prv.notices (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      version INT NOT NULL,
      principal_class TEXT NOT NULL
        CHECK (principal_class IN ('employee','candidate','contractor_worker','dependant')),
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
      is_current BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (principal_class, version)
    );

    CREATE TABLE prv.notice_acks (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      notice_id BIGINT NOT NULL REFERENCES prv.notices(id),
      user_id BIGINT NOT NULL REFERENCES core.users(id),
      acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      ip TEXT,
      UNIQUE (notice_id, user_id)
    );

    CREATE TABLE prv.processing_register (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      data_class TEXT NOT NULL UNIQUE,
      purpose TEXT NOT NULL,
      lawful_basis TEXT NOT NULL CHECK (lawful_basis IN ('employment','consent','legal_obligation')),
      retention_days INT NOT NULL CHECK (retention_days > 0),
      recipients TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TRIGGER processing_register_updated_at BEFORE UPDATE ON prv.processing_register
      FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

    CREATE TABLE prv.consents (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      employee_id BIGINT NOT NULL REFERENCES core.employees(id),
      purpose TEXT NOT NULL
        CHECK (purpose IN ('photograph','wellness','bgv','family','alumni')),
      granted BOOLEAN NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (employee_id, purpose)
    );

    CREATE TABLE prv.consent_events (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      employee_id BIGINT NOT NULL REFERENCES core.employees(id),
      purpose TEXT NOT NULL,
      action TEXT NOT NULL CHECK (action IN ('grant','withdraw')),
      actor_user_id BIGINT NOT NULL REFERENCES core.users(id),
      occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE OR REPLACE FUNCTION prv.consent_events_immutable() RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION 'prv.consent_events is append-only (PRV-03)';
    END;
    $$ LANGUAGE plpgsql;
    CREATE TRIGGER consent_events_immutable
      BEFORE UPDATE OR DELETE ON prv.consent_events
      FOR EACH ROW EXECUTE FUNCTION prv.consent_events_immutable();

    CREATE TABLE prv.rights_requests (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      employee_id BIGINT NOT NULL REFERENCES core.employees(id),
      kind TEXT NOT NULL CHECK (kind IN ('access','correction','erasure')),
      status TEXT NOT NULL DEFAULT 'open'
        CHECK (status IN ('open','in_progress','fulfilled','refused')),
      reason TEXT,
      refusal_reason TEXT,
      workflow_request_id BIGINT REFERENCES wf.requests(id),
      due_at TIMESTAMPTZ NOT NULL,
      closed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE prv.retention_rules (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      data_class TEXT NOT NULL UNIQUE REFERENCES prv.processing_register(data_class),
      retention_days INT NOT NULL CHECK (retention_days > 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE prv.legal_holds (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      employee_id BIGINT NOT NULL REFERENCES core.employees(id),
      data_class TEXT,
      reason TEXT NOT NULL,
      placed_by BIGINT NOT NULL REFERENCES core.users(id),
      released_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE prv.purge_proposals (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      data_class TEXT NOT NULL,
      row_count INT NOT NULL CHECK (row_count >= 0),
      excluded_holds INT NOT NULL DEFAULT 0,
      proposed_by BIGINT NOT NULL REFERENCES core.users(id),
      proposed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      confirmed_by BIGINT REFERENCES core.users(id),
      confirmed_at TIMESTAMPTZ,
      CHECK (confirmed_by IS NULL OR confirmed_by <> proposed_by)
    );

    CREATE TABLE prv.purge_log (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      proposal_id BIGINT NOT NULL REFERENCES prv.purge_proposals(id),
      data_class TEXT NOT NULL,
      row_count INT NOT NULL,
      rule TEXT NOT NULL,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE OR REPLACE FUNCTION prv.purge_log_immutable() RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION 'prv.purge_log is append-only (PRV-06)';
    END;
    $$ LANGUAGE plpgsql;
    CREATE TRIGGER purge_log_immutable
      BEFORE UPDATE OR DELETE ON prv.purge_log
      FOR EACH ROW EXECUTE FUNCTION prv.purge_log_immutable();

    CREATE TABLE prv.processors (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      name TEXT NOT NULL,
      purpose TEXT NOT NULL,
      dpa_status TEXT NOT NULL CHECK (dpa_status IN ('active','expired','missing')),
      dpa_expires_on DATE,
      owner_email TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TRIGGER processors_updated_at BEFORE UPDATE ON prv.processors
      FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

    CREATE TABLE prv.breach_register (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      discovered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      summary TEXT NOT NULL,
      notified_board_at TIMESTAMPTZ,
      notified_principals_at TIMESTAMPTZ,
      recorded_by BIGINT NOT NULL REFERENCES core.users(id)
    );
    CREATE OR REPLACE FUNCTION prv.breach_register_immutable() RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION 'prv.breach_register is append-only (PRV-07)';
    END;
    $$ LANGUAGE plpgsql;
    CREATE TRIGGER breach_register_immutable
      BEFORE UPDATE OR DELETE ON prv.breach_register
      FOR EACH ROW EXECUTE FUNCTION prv.breach_register_immutable();

    INSERT INTO prv.notices (version, principal_class, title, body)
    VALUES (
      1,
      'employee',
      'How Rashmi Group uses your employment data',
      $notice$
This notice is given under the Digital Personal Data Protection Act, 2023.

We process your employment record (identity, attendance, leave, bank and statutory identifiers) to run the employment contract and to meet labour, tax and social-security law. That processing does not wait on extra consent.

Some uses do. Photograph on a noticeboard, wellness or health programmes, background verification beyond the joining pack, family-member data beyond ESIC nominees, and alumni contact after exit are optional. You can withdraw those from My privacy; withdrawal takes effect on the next read.

You may ask for a copy of what we hold, a correction, or erasure where the law allows. Erasure of payroll and statutory records is refused when a retention rule or a legal hold applies; the refusal names the rule.

The Data Protection Officer is listed on My privacy. Response SLA is the value in core.settings (prv.rights_sla_days).
$notice$
    );

    INSERT INTO prv.processing_register (data_class, purpose, lawful_basis, retention_days, recipients)
    VALUES
      ('identity', 'Employment master and directory', 'employment', 2555, 'HR, reporting manager, payroll'),
      ('contact', 'Work and emergency contact', 'employment', 2555, 'HR, reporting manager'),
      ('statutory_id', 'PF, ESIC, TDS, bank KYC', 'legal_obligation', 2920, 'Payroll, statutory portals'),
      ('bank', 'Salary credit', 'employment', 2920, 'Payroll, bank'),
      ('biometric_swipe', 'Attendance capture', 'employment', 1095, 'Attendance ops, Kent processor'),
      ('attendance', 'Day status, muster, OT', 'employment', 2555, 'HR, manager, payroll'),
      ('leave', 'Leave ledger', 'employment', 2555, 'HR, manager'),
      ('photograph', 'Directory photo and plant noticeboard', 'consent', 730, 'Directory, communications'),
      ('family', 'ESIC dependants and nominees', 'consent', 2555, 'HR, ESIC'),
      ('health', 'Occupational health (when collected)', 'consent', 1095, 'EHS, occupational health');

    INSERT INTO prv.retention_rules (data_class, retention_days)
    SELECT data_class, retention_days FROM prv.processing_register;

    INSERT INTO prv.processors (name, purpose, dpa_status, owner_email)
    VALUES
      ('Hosting / PostgreSQL', 'Primary employee database', 'active', 'it_admin@rashmigroup.com'),
      ('SMTP', 'Transactional email', 'missing', 'it_admin@rashmigroup.com'),
      ('Kent / Astra', 'Biometric swipe ingestion', 'missing', 'it_admin@rashmigroup.com');
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP TABLE IF EXISTS prv.breach_register;
    DROP FUNCTION IF EXISTS prv.breach_register_immutable();
    DROP TABLE IF EXISTS prv.processors;
    DROP TABLE IF EXISTS prv.purge_log;
    DROP FUNCTION IF EXISTS prv.purge_log_immutable();
    DROP TABLE IF EXISTS prv.purge_proposals;
    DROP TABLE IF EXISTS prv.legal_holds;
    DROP TABLE IF EXISTS prv.retention_rules;
    DROP TABLE IF EXISTS prv.rights_requests;
    DROP TABLE IF EXISTS prv.consent_events;
    DROP FUNCTION IF EXISTS prv.consent_events_immutable();
    DROP TABLE IF EXISTS prv.consents;
    DROP TABLE IF EXISTS prv.notice_acks;
    DROP TABLE IF EXISTS prv.notices;
    DROP TABLE IF EXISTS prv.processing_register;
    DROP SCHEMA IF EXISTS prv;
  `);
}
