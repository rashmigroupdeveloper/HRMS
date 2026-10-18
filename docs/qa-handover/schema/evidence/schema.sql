--
-- PostgreSQL database dump
--

\restrict xlUM9ygYIqmrsFeX5iBcsLoADjP0f1TaGiBJAowhfGxykL8DcAcNTchlZmQs9ET

-- Dumped from database version 17.11 (Debian 17.11-0+deb13u1)
-- Dumped by pg_dump version 17.11 (Debian 17.11-0+deb13u1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: ast; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA ast;


--
-- Name: att; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA att;


--
-- Name: cmp; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA cmp;


--
-- Name: core; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA core;


--
-- Name: doc; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA doc;


--
-- Name: eng; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA eng;


--
-- Name: hd; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA hd;


--
-- Name: ird; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA ird;


--
-- Name: lv; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA lv;


--
-- Name: pay; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA pay;


--
-- Name: prv; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA prv;


--
-- Name: reporting; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA reporting;


--
-- Name: sec; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA sec;


--
-- Name: te; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA te;


--
-- Name: wf; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA wf;


--
-- Name: btree_gist; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;


--
-- Name: EXTENSION btree_gist; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION btree_gist IS 'support for indexing common datatypes in GiST';


--
-- Name: citext; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public;


--
-- Name: EXTENSION citext; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION citext IS 'data type for case-insensitive character strings';


--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: day_status; Type: TYPE; Schema: att; Owner: -
--

CREATE TYPE att.day_status AS ENUM (
    'P',
    'A',
    'HD',
    'WO',
    'H',
    'L',
    'OD',
    'CO',
    'UAB'
);


--
-- Name: contract_type; Type: TYPE; Schema: core; Owner: -
--

CREATE TYPE core.contract_type AS ENUM (
    'permanent',
    'temporary',
    'probationary',
    'consultant',
    'fixed_term'
);


--
-- Name: employee_status; Type: TYPE; Schema: core; Owner: -
--

CREATE TYPE core.employee_status AS ENUM (
    'onboarding',
    'active',
    'on_notice',
    'exited'
);


--
-- Name: employment_category; Type: TYPE; Schema: core; Owner: -
--

CREATE TYPE core.employment_category AS ENUM (
    'white_collar',
    'blue_collar',
    'trainee',
    'consultant',
    'contract'
);


--
-- Name: day_records_lock_guard(); Type: FUNCTION; Schema: att; Owner: -
--

CREATE FUNCTION att.day_records_lock_guard() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF OLD.is_locked THEN
        RAISE EXCEPTION 'att.day_records row % is locked (ATT-15: post-lock changes only via the audited unlock)', OLD.id;
      END IF;
      IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
      RETURN NEW;
    END $$;


--
-- Name: day_records_month_lock_guard(); Type: FUNCTION; Schema: att; Owner: -
--

CREATE FUNCTION att.day_records_month_lock_guard() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      v_company_id BIGINT;
    BEGIN
      SELECT company_id INTO v_company_id
      FROM core.employees
      WHERE id = NEW.employee_id;

      IF EXISTS (
        SELECT 1
        FROM att.month_locks ml
        WHERE ml.company_id = v_company_id
          AND ml.month = date_trunc('month', NEW.work_date)::date
      ) THEN
        -- The lock transaction itself is the only permitted post-lock write:
        -- it flips an existing row from unlocked to locked without changing data.
        IF TG_OP = 'UPDATE'
           AND OLD.is_locked = false
           AND NEW.is_locked = true
           AND (to_jsonb(NEW) - 'is_locked' - 'updated_at')
               IS NOT DISTINCT FROM
               (to_jsonb(OLD) - 'is_locked' - 'updated_at')
        THEN
          RETURN NEW;
        END IF;
        RAISE EXCEPTION 'attendance month is locked (ATT-15)';
      END IF;
      RETURN NEW;
    END $$;


--
-- Name: device_watermark_monotonic(); Type: FUNCTION; Schema: att; Owner: -
--

CREATE FUNCTION att.device_watermark_monotonic() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF NEW.device_id <> OLD.device_id THEN
        RAISE EXCEPTION 'device watermark ownership cannot change';
      END IF;
      IF NEW.watermark_ts < OLD.watermark_ts THEN
        RAISE EXCEPTION 'device watermark cannot regress (ATT-12)';
      END IF;
      RETURN NEW;
    END $$;


--
-- Name: enqueue_recompute(); Type: FUNCTION; Schema: att; Owner: -
--

CREATE FUNCTION att.enqueue_recompute() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      d DATE;
    BEGIN
      IF NEW.employee_id IS NULL THEN RETURN NULL; END IF;
      d := (NEW.swipe_ts AT TIME ZONE 'Asia/Kolkata')::date;
      INSERT INTO att.recompute_queue (employee_id, work_date)
      VALUES (NEW.employee_id, d), (NEW.employee_id, d - 1)
      ON CONFLICT DO NOTHING;
      RETURN NULL;
    END $$;


--
-- Name: ensure_swipe_partition(date); Type: FUNCTION; Schema: att; Owner: -
--

CREATE FUNCTION att.ensure_swipe_partition(p_any_day date) RETURNS void
    LANGUAGE plpgsql
    AS $$
    DECLARE
      v_start DATE := date_trunc('month', p_any_day)::date;
      v_end   DATE := (v_start + interval '1 month')::date;
      v_name  TEXT := 'swipe_events_' || to_char(v_start, 'YYYYMM');
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'att' AND c.relname = v_name
      ) THEN
        EXECUTE format(
          'CREATE TABLE att.%I PARTITION OF att.swipe_events FOR VALUES FROM (%L) TO (%L)',
          v_name, v_start, v_end
        );
      END IF;
    END $$;


--
-- Name: invalidate_manager_month_approval(); Type: FUNCTION; Schema: att; Owner: -
--

CREATE FUNCTION att.invalidate_manager_month_approval() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      v_employee_id BIGINT;
      v_work_date DATE;
      v_manager_id BIGINT;
      v_company_id BIGINT;
      v_month DATE;
      v_latest_event TEXT;
    BEGIN

      -- NOTE: this function is shared by att.rosters AND att.day_records.
      -- `is_week_off` exists only on rosters, so the comparison MUST stay in a
      -- nested IF: PL/pgSQL prepares an expression on first execution, and a
      -- flat `AND` chain would resolve NEW.is_week_off for day_records too and
      -- fail with 'record "new" has no field "is_week_off"'.
      IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'rosters' THEN
        IF NEW.employee_id IS NOT DISTINCT FROM OLD.employee_id
           AND NEW.work_date IS NOT DISTINCT FROM OLD.work_date
           AND NEW.shift_id IS NOT DISTINCT FROM OLD.shift_id
           AND NEW.is_week_off IS NOT DISTINCT FROM OLD.is_week_off THEN
          RETURN NEW;
        END IF;
      END IF;


      IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'day_records' THEN
        IF (to_jsonb(NEW) - ARRAY['computed_at', 'updated_at', 'is_locked'])
           IS NOT DISTINCT FROM (to_jsonb(OLD) - ARRAY['computed_at', 'updated_at', 'is_locked']) THEN
          RETURN NEW;
        END IF;
      END IF;

      v_employee_id := COALESCE(NEW.employee_id, OLD.employee_id);
      v_work_date := COALESCE(NEW.work_date, OLD.work_date);

      SELECT reporting_manager_id, company_id
        INTO v_manager_id, v_company_id
        FROM core.employees
       WHERE id = v_employee_id;

      IF v_manager_id IS NULL THEN
        IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
      END IF;

      v_month := date_trunc('month', v_work_date)::date;
      SELECT event_type
        INTO v_latest_event
        FROM att.manager_month_approvals
       WHERE company_id = v_company_id
         AND month = v_month
         AND manager_employee_id = v_manager_id
       ORDER BY id DESC
       LIMIT 1;

      IF v_latest_event = 'approve' THEN
        INSERT INTO att.manager_month_approvals
          (company_id, month, manager_employee_id, approved_by_user_id, event_type, note)
        VALUES
          (v_company_id, v_month, v_manager_id, NULL, 'invalidate',
           TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME || ' changed after approval');
      END IF;

      IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
    END $$;


--
-- Name: month_locks_immutable(); Type: FUNCTION; Schema: att; Owner: -
--

CREATE FUNCTION att.month_locks_immutable() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      RAISE EXCEPTION 'att.month_locks is append-only (ATT-15: locked months cannot be reopened)';
    END $$;


--
-- Name: reject_manager_approval_mutation(); Type: FUNCTION; Schema: att; Owner: -
--

CREATE FUNCTION att.reject_manager_approval_mutation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      RAISE EXCEPTION 'manager attendance approval events are append-only';
    END $$;


--
-- Name: roster_revisions_immutable(); Type: FUNCTION; Schema: att; Owner: -
--

CREATE FUNCTION att.roster_revisions_immutable() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      RAISE EXCEPTION 'att.roster_revisions is append-only (SHF-05)';
    END;
    $$;


--
-- Name: swipe_events_immutable(); Type: FUNCTION; Schema: att; Owner: -
--

CREATE FUNCTION att.swipe_events_immutable() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      RAISE EXCEPTION 'att.swipe_events is append-only (ATT-01: raw swipes are never edited)';
    END $$;


--
-- Name: filing_evidence_immutable(); Type: FUNCTION; Schema: cmp; Owner: -
--

CREATE FUNCTION cmp.filing_evidence_immutable() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      RAISE EXCEPTION 'cmp.filing_evidence is append-only (CMP-18 / audit evidence)';
    END $$;


--
-- Name: assert_super_admin_remains(); Type: FUNCTION; Schema: core; Owner: -
--

CREATE FUNCTION core.assert_super_admin_remains() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      v_touched  INT;
      v_remaining INT;
    BEGIN
      IF TG_TABLE_NAME = 'user_roles' THEN
        SELECT count(*) INTO v_touched
          FROM removed rm
          JOIN core.roles r ON r.id = rm.role_id
         WHERE r.code = 'super_admin';
      ELSIF TG_TABLE_NAME = 'role_permissions' THEN
        SELECT count(*) INTO v_touched
          FROM removed rm
          JOIN core.roles r ON r.id = rm.role_id
          JOIN core.permissions p ON p.id = rm.permission_id
         WHERE r.code = 'super_admin' AND p.code = 'admin.roles';
      ELSE
        SELECT count(*) INTO v_touched
          FROM removed rm
          JOIN core.user_roles ur ON ur.user_id = rm.id
          JOIN core.roles r ON r.id = ur.role_id
         WHERE r.code = 'super_admin'
           AND rm.is_active = true;
      END IF;

      -- The statement did not touch a super_admin: nothing to protect here.
      IF v_touched = 0 THEN
        RETURN NULL;
      END IF;

      SELECT count(*) INTO v_remaining
        FROM core.user_roles ur
        JOIN core.roles r ON r.id = ur.role_id
        JOIN core.users u ON u.id = ur.user_id
        JOIN core.role_permissions rp ON rp.role_id = r.id
        JOIN core.permissions p ON p.id = rp.permission_id
       WHERE r.code = 'super_admin'
         AND u.is_active = true
         AND ur.scope_org_unit_id IS NULL
         AND p.code = 'admin.roles' AND rp.scope = 'all';

      IF v_remaining = 0 THEN
        RAISE EXCEPTION
          'refusing to leave the platform with no active super_admin (audit W0-T25)';
      END IF;
      RETURN NULL;
    END;
    $$;


--
-- Name: audit_log_chain(); Type: FUNCTION; Schema: core; Owner: -
--

CREATE FUNCTION core.audit_log_chain() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      last_hash TEXT;
    BEGIN
      PERFORM pg_advisory_xact_lock(hashtext('core.audit_log'));

      -- Assigned under the lock. The id was assigned before it, which is
      -- exactly why the chain must not be ordered by id.
      NEW.chain_seq := nextval('core.audit_log_chain_seq');

      SELECT row_hash INTO last_hash
        FROM core.audit_log ORDER BY chain_seq DESC LIMIT 1;

      NEW.prev_hash := COALESCE(last_hash, 'GENESIS');
      NEW.row_hash := encode(digest(
        NEW.prev_hash
          || coalesce(NEW.actor_user_id::text, '') || '|' || NEW.action
          || '|' || NEW.entity || '|' || coalesce(NEW.entity_id::text, '')
          || '|' || coalesce(NEW.field, '') || '|' || coalesce(NEW.old_value, '')
          || '|' || coalesce(NEW.new_value, '') || '|' || coalesce(NEW.ip::text, '')
          || '|' || NEW.at::text,
        'sha256'), 'hex');
      RETURN NEW;
    END $$;


--
-- Name: audit_log_immutable(); Type: FUNCTION; Schema: core; Owner: -
--

CREATE FUNCTION core.audit_log_immutable() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      RAISE EXCEPTION 'core.audit_log is append-only (CORE-11 / MCA edit-log rule)';
    END $$;


--
-- Name: next_ecode(bigint); Type: FUNCTION; Schema: core; Owner: -
--

CREATE FUNCTION core.next_ecode(p_company_id bigint) RETURNS text
    LANGUAGE plpgsql
    AS $$
    DECLARE v_seq INTEGER; v_prefix TEXT;
    BEGIN
      UPDATE core.companies SET ecode_next_seq = ecode_next_seq + 1
      WHERE id = p_company_id AND ecode_next_seq > 0 AND btrim(ecode_prefix) <> ''
      RETURNING ecode_next_seq - 1, ecode_prefix INTO v_seq, v_prefix;
      IF NOT FOUND THEN RAISE EXCEPTION 'Missing entity or invalid employee code series configuration'; END IF;
      RETURN v_prefix || lpad(v_seq::text, greatest(6,length(v_seq::text)), '0');
    END $$;


--
-- Name: rebuild_reporting_tree(); Type: FUNCTION; Schema: core; Owner: -
--

CREATE FUNCTION core.rebuild_reporting_tree() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      -- Full rebuild: O(n) recursive walk — milliseconds at 3k–10k employees,
      -- statement-level so bulk imports rebuild ONCE. Depth cap kills cycles.
      TRUNCATE core.reporting_tree;
      INSERT INTO core.reporting_tree (manager_id, employee_id, depth)
      WITH RECURSIVE chain AS (
        SELECT e.reporting_manager_id AS manager_id, e.id AS employee_id, 1 AS depth
        FROM core.employees e
        WHERE e.reporting_manager_id IS NOT NULL
        UNION ALL
        SELECT e.reporting_manager_id, c.employee_id, (c.depth + 1)::smallint
        FROM chain c
        JOIN core.employees e ON e.id = c.manager_id
        WHERE e.reporting_manager_id IS NOT NULL AND c.depth < 50
      )
      SELECT manager_id, employee_id, MIN(depth)
      FROM chain
      GROUP BY manager_id, employee_id;
      RETURN NULL;
    END $$;


--
-- Name: serialize_admin_changes(); Type: FUNCTION; Schema: core; Owner: -
--

CREATE FUNCTION core.serialize_admin_changes() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      PERFORM pg_advisory_xact_lock(1752200000);
      RETURN NULL;
    END;
    $$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: core; Owner: -
--

CREATE FUNCTION core.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END $$;


--
-- Name: verify_audit_chain(); Type: FUNCTION; Schema: core; Owner: -
--

CREATE FUNCTION core.verify_audit_chain() RETURNS bigint
    LANGUAGE plpgsql
    AS $$
    DECLARE
      r RECORD;
      expected_prev TEXT := 'GENESIS';
      computed TEXT;
    BEGIN
      FOR r IN SELECT * FROM core.audit_log ORDER BY chain_seq LOOP
        IF r.prev_hash <> expected_prev THEN
          RETURN r.id;
        END IF;
        computed := encode(digest(
          r.prev_hash
            || coalesce(r.actor_user_id::text, '') || '|' || r.action
            || '|' || r.entity || '|' || coalesce(r.entity_id::text, '')
            || '|' || coalesce(r.field, '') || '|' || coalesce(r.old_value, '')
            || '|' || coalesce(r.new_value, '') || '|' || coalesce(r.ip::text, '')
            || '|' || r.at::text,
          'sha256'), 'hex');
        IF r.row_hash <> computed THEN
          RETURN r.id;
        END IF;
        expected_prev := computed;
      END LOOP;
      RETURN NULL;
    END $$;


--
-- Name: reject_message_mutation(); Type: FUNCTION; Schema: hd; Owner: -
--

CREATE FUNCTION hd.reject_message_mutation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      RAISE EXCEPTION 'hd.ticket_messages is append-only (SOW-9.4)';
    END $$;


--
-- Name: posh_access_log_immutable(); Type: FUNCTION; Schema: ird; Owner: -
--

CREATE FUNCTION ird.posh_access_log_immutable() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      RAISE EXCEPTION 'ird.posh_case_access_log is append-only (PSH access logging)';
    END;
    $$;


--
-- Name: ledger_immutable(); Type: FUNCTION; Schema: lv; Owner: -
--

CREATE FUNCTION lv.ledger_immutable() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      RAISE EXCEPTION 'lv.ledger is append-only (LV-05: balances are sums of immutable rows)';
    END $$;


--
-- Name: claim_reservations_immutable(); Type: FUNCTION; Schema: pay; Owner: -
--

CREATE FUNCTION pay.claim_reservations_immutable() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      RAISE EXCEPTION 'pay.claim_reservations is append-only (release with a new row, never an update)';
    END $$;


--
-- Name: enforce_finalized_items_immutability(); Type: FUNCTION; Schema: pay; Owner: -
--

CREATE FUNCTION pay.enforce_finalized_items_immutability() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      run_status TEXT;
    BEGIN
      SELECT status INTO run_status FROM pay.payroll_runs WHERE id = COALESCE(OLD.run_id, NEW.run_id);
      IF run_status = 'finalized' OR run_status = 'paid' THEN
        RAISE EXCEPTION 'Cannot update or delete payroll items of a finalized payroll run';
      END IF;
      IF TG_OP = 'DELETE' THEN
        RETURN OLD;
      END IF;
      RETURN NEW;
    END;
    $$;


--
-- Name: enforce_finalized_run_immutability(); Type: FUNCTION; Schema: pay; Owner: -
--

CREATE FUNCTION pay.enforce_finalized_run_immutability() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF TG_OP = 'DELETE' THEN
        IF OLD.status = 'finalized' OR OLD.status = 'paid' THEN
          RAISE EXCEPTION 'Cannot delete finalized or paid payroll run';
        END IF;
        RETURN OLD;
      ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status = 'finalized' AND NEW.status != 'reopened' AND NEW.status != 'paid' THEN
          RAISE EXCEPTION 'Finalized payroll runs are immutable and cannot be updated except to reopen or mark paid';
        END IF;
        RETURN NEW;
      END IF;
      RETURN NEW;
    END;
    $$;


--
-- Name: validate_gl_account_org_codes(); Type: FUNCTION; Schema: pay; Owner: -
--

CREATE FUNCTION pay.validate_gl_account_org_codes() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      v_company_id BIGINT;
      v_plant_id BIGINT;
      v_cost_center_plant_id BIGINT;
    BEGIN
      SELECT id INTO v_company_id
      FROM core.companies
      WHERE code = NEW.company_code;
      IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'Unknown company_code: %', NEW.company_code
          USING ERRCODE = '23503';
      END IF;

      SELECT id INTO v_plant_id
      FROM core.plants
      WHERE company_id = v_company_id
        AND plant_code = NEW.plant_code;
      IF v_plant_id IS NULL THEN
        RAISE EXCEPTION 'Unknown plant_code % for company %', NEW.plant_code, NEW.company_code
          USING ERRCODE = '23503';
      END IF;

      SELECT plant_id INTO v_cost_center_plant_id
      FROM core.cost_centers
      WHERE company_id = v_company_id
        AND code = NEW.cost_center_code;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Unknown cost_center_code % for company %', NEW.cost_center_code, NEW.company_code
          USING ERRCODE = '23503';
      END IF;
      IF v_cost_center_plant_id IS NULL OR v_cost_center_plant_id <> v_plant_id THEN
        RAISE EXCEPTION 'Cost centre % is not assigned to plant % for company %',
          NEW.cost_center_code, NEW.plant_code, NEW.company_code
          USING ERRCODE = '23514';
      END IF;

      IF length(btrim(NEW.component_code)) = 0 THEN
        RAISE EXCEPTION 'component_code is required' USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END;
    $$;


--
-- Name: breach_register_immutable(); Type: FUNCTION; Schema: prv; Owner: -
--

CREATE FUNCTION prv.breach_register_immutable() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      RAISE EXCEPTION 'prv.breach_register is append-only (PRV-07)';
    END;
    $$;


--
-- Name: consent_events_immutable(); Type: FUNCTION; Schema: prv; Owner: -
--

CREATE FUNCTION prv.consent_events_immutable() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      RAISE EXCEPTION 'prv.consent_events is append-only (PRV-03)';
    END;
    $$;


--
-- Name: purge_log_immutable(); Type: FUNCTION; Schema: prv; Owner: -
--

CREATE FUNCTION prv.purge_log_immutable() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      RAISE EXCEPTION 'prv.purge_log is append-only (PRV-06)';
    END;
    $$;


--
-- Name: access_events_immutable(); Type: FUNCTION; Schema: sec; Owner: -
--

CREATE FUNCTION sec.access_events_immutable() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      RAISE EXCEPTION 'sec.access_events is append-only (SEC-10 / DPDP access log)';
    END $$;


--
-- Name: ensure_access_partition(date); Type: FUNCTION; Schema: sec; Owner: -
--

CREATE FUNCTION sec.ensure_access_partition(p_any_day date) RETURNS void
    LANGUAGE plpgsql
    AS $$
    DECLARE
      v_start DATE := date_trunc('month', p_any_day)::date;
      v_end   DATE := (v_start + interval '1 month')::date;
      v_name  TEXT := 'access_events_' || to_char(v_start, 'YYYYMM');
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'sec' AND c.relname = v_name
      ) THEN
        EXECUTE format(
          'CREATE TABLE sec.%I PARTITION OF sec.access_events FOR VALUES FROM (%L) TO (%L)',
          v_name, v_start, v_end
        );
      END IF;
    END $$;


--
-- Name: reject_wallet_tx_mutation(); Type: FUNCTION; Schema: te; Owner: -
--

CREATE FUNCTION te.reject_wallet_tx_mutation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      RAISE EXCEPTION 'te.wallet_transactions is an immutable ledger; updates and deletes are prohibited';
    END;
    $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: assets; Type: TABLE; Schema: ast; Owner: -
--

CREATE TABLE ast.assets (
    id bigint NOT NULL,
    asset_no text NOT NULL,
    category text NOT NULL,
    description text,
    serial_no text,
    purchase_date date,
    warranty_till date,
    status text DEFAULT 'in_stock'::text NOT NULL,
    location_id bigint,
    company_id bigint NOT NULL,
    created_by bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT assets_status_check CHECK ((status = ANY (ARRAY['in_stock'::text, 'assigned'::text, 'maintenance'::text, 'lost'::text, 'scrapped'::text])))
);


--
-- Name: TABLE assets; Type: COMMENT; Schema: ast; Owner: -
--

COMMENT ON TABLE ast.assets IS 'AST-01 asset registry; warranty_till accepts past dates (AST-02)';


--
-- Name: assets_id_seq; Type: SEQUENCE; Schema: ast; Owner: -
--

ALTER TABLE ast.assets ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME ast.assets_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: assignments; Type: TABLE; Schema: ast; Owner: -
--

CREATE TABLE ast.assignments (
    id bigint NOT NULL,
    asset_id bigint NOT NULL,
    holder_kind text NOT NULL,
    employee_id bigint,
    third_party_name text,
    third_party_org text,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    returned_at timestamp with time zone,
    return_condition text,
    notes text,
    assigned_by bigint NOT NULL,
    returned_by bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT assignments_holder_kind_check CHECK ((holder_kind = ANY (ARRAY['employee'::text, 'third_party'::text]))),
    CONSTRAINT assignments_holder_xor CHECK ((((holder_kind = 'employee'::text) AND (employee_id IS NOT NULL) AND (third_party_name IS NULL)) OR ((holder_kind = 'third_party'::text) AND (employee_id IS NULL) AND (third_party_name IS NOT NULL)))),
    CONSTRAINT assignments_return_complete CHECK ((((returned_at IS NULL) AND (return_condition IS NULL)) OR ((returned_at IS NOT NULL) AND (return_condition IS NOT NULL)))),
    CONSTRAINT assignments_return_condition_check CHECK ((return_condition = ANY (ARRAY['ok'::text, 'damaged'::text, 'not_returned'::text])))
);


--
-- Name: TABLE assignments; Type: COMMENT; Schema: ast; Owner: -
--

COMMENT ON TABLE ast.assignments IS 'AST-03 employee/third-party allocation; open row = still held (AST-04/05)';


--
-- Name: assignments_id_seq; Type: SEQUENCE; Schema: ast; Owner: -
--

ALTER TABLE ast.assignments ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME ast.assignments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: maintenance; Type: TABLE; Schema: ast; Owner: -
--

CREATE TABLE ast.maintenance (
    id bigint NOT NULL,
    asset_id bigint NOT NULL,
    kind text NOT NULL,
    scheduled_for date,
    reported_by bigint,
    description text NOT NULL,
    resolved_at timestamp with time zone,
    resolution text,
    cost numeric(12,2),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT maintenance_cost_check CHECK (((cost IS NULL) OR (cost >= (0)::numeric))),
    CONSTRAINT maintenance_kind_check CHECK ((kind = ANY (ARRAY['scheduled'::text, 'incident'::text, 'damage'::text, 'lost'::text])))
);


--
-- Name: TABLE maintenance; Type: COMMENT; Schema: ast; Owner: -
--

COMMENT ON TABLE ast.maintenance IS 'AST-06 maintenance, incident, damage and loss trail';


--
-- Name: maintenance_id_seq; Type: SEQUENCE; Schema: ast; Owner: -
--

ALTER TABLE ast.maintenance ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME ast.maintenance_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: absence_cases; Type: TABLE; Schema: att; Owner: -
--

CREATE TABLE att.absence_cases (
    id bigint NOT NULL,
    employee_id bigint NOT NULL,
    start_date date NOT NULL,
    days_absent smallint NOT NULL,
    stage text DEFAULT 'watch'::text NOT NULL,
    letter_id bigint,
    hr_owner_id bigint,
    resolution text,
    closed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT absence_cases_check CHECK (((resolution IS NULL) = (closed_at IS NULL))),
    CONSTRAINT absence_cases_resolution_check CHECK ((resolution = ANY (ARRAY['returned'::text, 'regularized'::text, 'exited'::text]))),
    CONSTRAINT absence_cases_stage_check CHECK ((stage = ANY (ARRAY['watch'::text, 'show_cause'::text, 'warning'::text, 'termination_review'::text])))
);


--
-- Name: absence_cases_id_seq; Type: SEQUENCE; Schema: att; Owner: -
--

ALTER TABLE att.absence_cases ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME att.absence_cases_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: coverage_targets; Type: TABLE; Schema: att; Owner: -
--

CREATE TABLE att.coverage_targets (
    id bigint NOT NULL,
    location_id bigint NOT NULL,
    department_id bigint,
    shift_id bigint NOT NULL,
    weekday smallint NOT NULL,
    sanctioned integer NOT NULL,
    updated_by bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT coverage_targets_sanctioned_check CHECK ((sanctioned >= 0)),
    CONSTRAINT coverage_targets_weekday_check CHECK (((weekday >= 0) AND (weekday <= 6)))
);


--
-- Name: coverage_targets_id_seq; Type: SEQUENCE; Schema: att; Owner: -
--

ALTER TABLE att.coverage_targets ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME att.coverage_targets_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: day_records; Type: TABLE; Schema: att; Owner: -
--

CREATE TABLE att.day_records (
    id bigint NOT NULL,
    employee_id bigint NOT NULL,
    work_date date NOT NULL,
    shift_id bigint,
    status att.day_status NOT NULL,
    leave_type_id bigint,
    first_in timestamp with time zone,
    last_out timestamp with time zone,
    worked_minutes integer,
    late_minutes smallint DEFAULT 0 NOT NULL,
    early_exit_minutes smallint DEFAULT 0 NOT NULL,
    ot_minutes smallint DEFAULT 0 NOT NULL,
    weekoff_paid boolean,
    session_statuses jsonb,
    scheme_code text,
    penalty_flag boolean DEFAULT false NOT NULL,
    source text DEFAULT 'auto'::text NOT NULL,
    override_reason text,
    is_locked boolean DEFAULT false NOT NULL,
    computed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT day_records_check CHECK (((source <> 'manual'::text) OR (override_reason IS NOT NULL))),
    CONSTRAINT day_records_session_statuses_valid CHECK (
CASE
    WHEN (session_statuses IS NULL) THEN true
    WHEN (jsonb_typeof(session_statuses) <> 'array'::text) THEN false
    ELSE COALESCE(((jsonb_array_length(session_statuses) = 2) AND (((session_statuses -> 0) -> 'session'::text) = '1'::jsonb) AND (((session_statuses -> 1) -> 'session'::text) = '2'::jsonb) AND (((session_statuses -> 0) ->> 'status'::text) = ANY (ARRAY['P'::text, 'A'::text, 'O'::text, 'OD'::text])) AND (((session_statuses -> 1) ->> 'status'::text) = ANY (ARRAY['P'::text, 'A'::text, 'O'::text, 'OD'::text]))), false)
END),
    CONSTRAINT day_records_source_check CHECK ((source = ANY (ARRAY['auto'::text, 'regularized'::text, 'manual'::text])))
);


--
-- Name: day_records_id_seq; Type: SEQUENCE; Schema: att; Owner: -
--

ALTER TABLE att.day_records ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME att.day_records_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: device_watermarks; Type: TABLE; Schema: att; Owner: -
--

CREATE TABLE att.device_watermarks (
    device_id bigint NOT NULL,
    watermark_ts timestamp with time zone NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: devices; Type: TABLE; Schema: att; Owner: -
--

CREATE TABLE att.devices (
    id bigint NOT NULL,
    source text DEFAULT 'kent'::text NOT NULL,
    door_code text NOT NULL,
    location_id bigint,
    last_seen_at timestamp with time zone,
    expected_hourly_swipes numeric(8,2),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    alerted_silent_at timestamp with time zone
);


--
-- Name: devices_id_seq; Type: SEQUENCE; Schema: att; Owner: -
--

ALTER TABLE att.devices ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME att.devices_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: employee_shifts; Type: TABLE; Schema: att; Owner: -
--

CREATE TABLE att.employee_shifts (
    employee_id bigint NOT NULL,
    weekday_shift_id bigint NOT NULL,
    saturday_shift_id bigint,
    updated_by bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: holidays; Type: TABLE; Schema: att; Owner: -
--

CREATE TABLE att.holidays (
    id bigint NOT NULL,
    location_id bigint,
    holiday_date date NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: holidays_id_seq; Type: SEQUENCE; Schema: att; Owner: -
--

ALTER TABLE att.holidays ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME att.holidays_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: ingest_watermarks; Type: TABLE; Schema: att; Owner: -
--

CREATE TABLE att.ingest_watermarks (
    source text NOT NULL,
    watermark_ts timestamp with time zone NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: leave_blackouts; Type: TABLE; Schema: att; Owner: -
--

CREATE TABLE att.leave_blackouts (
    id bigint NOT NULL,
    blackout_date date NOT NULL,
    location_id bigint,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: leave_blackouts_id_seq; Type: SEQUENCE; Schema: att; Owner: -
--

ALTER TABLE att.leave_blackouts ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME att.leave_blackouts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: manager_month_approvals; Type: TABLE; Schema: att; Owner: -
--

CREATE TABLE att.manager_month_approvals (
    id bigint NOT NULL,
    company_id bigint NOT NULL,
    month date NOT NULL,
    manager_employee_id bigint NOT NULL,
    approved_by_user_id bigint,
    approved_at timestamp with time zone DEFAULT now() NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    event_type text DEFAULT 'approve'::text NOT NULL,
    CONSTRAINT manager_month_approvals_event_type_check CHECK ((event_type = ANY (ARRAY['approve'::text, 'invalidate'::text])))
);


--
-- Name: TABLE manager_month_approvals; Type: COMMENT; Schema: att; Owner: -
--

COMMENT ON TABLE att.manager_month_approvals IS 'ATT-12 manager attendance approval ledger — prerequisite for month lock when policy enabled';


--
-- Name: manager_month_approvals_id_seq; Type: SEQUENCE; Schema: att; Owner: -
--

ALTER TABLE att.manager_month_approvals ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME att.manager_month_approvals_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: month_locks; Type: TABLE; Schema: att; Owner: -
--

CREATE TABLE att.month_locks (
    id bigint NOT NULL,
    company_id bigint NOT NULL,
    month date NOT NULL,
    locked_by bigint NOT NULL,
    locked_at timestamp with time zone DEFAULT now() NOT NULL,
    checklist jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT month_locks_first_day_check CHECK ((month = (date_trunc('month'::text, (month)::timestamp with time zone))::date))
);


--
-- Name: month_locks_id_seq; Type: SEQUENCE; Schema: att; Owner: -
--

ALTER TABLE att.month_locks ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME att.month_locks_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: overtime_entries; Type: TABLE; Schema: att; Owner: -
--

CREATE TABLE att.overtime_entries (
    id bigint NOT NULL,
    employee_id bigint NOT NULL,
    work_date date NOT NULL,
    detected_minutes smallint NOT NULL,
    claimed_minutes smallint NOT NULL,
    approved_minutes smallint,
    status text DEFAULT 'pending'::text NOT NULL,
    manager_id bigint,
    decided_at timestamp with time zone,
    deadline_at timestamp with time zone NOT NULL,
    workflow_request_id bigint,
    comp_off_credit_id bigint,
    payroll_item_id bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT overtime_entries_check CHECK ((claimed_minutes <= detected_minutes)),
    CONSTRAINT overtime_entries_check1 CHECK (((approved_minutes IS NULL) OR (approved_minutes <= claimed_minutes))),
    CONSTRAINT overtime_entries_check2 CHECK (((comp_off_credit_id IS NULL) OR (payroll_item_id IS NULL))),
    CONSTRAINT overtime_entries_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'lapsed'::text, 'converted_comp_off'::text])))
);


--
-- Name: overtime_entries_id_seq; Type: SEQUENCE; Schema: att; Owner: -
--

ALTER TABLE att.overtime_entries ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME att.overtime_entries_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: quarantined_swipes; Type: TABLE; Schema: att; Owner: -
--

CREATE TABLE att.quarantined_swipes (
    id bigint NOT NULL,
    employee_no text NOT NULL,
    swipe_ts timestamp with time zone NOT NULL,
    door_code text,
    direction text,
    swipe_type text,
    received_at timestamp with time zone NOT NULL,
    source text NOT NULL,
    reason text NOT NULL,
    reviewed boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: quarantined_swipes_id_seq; Type: SEQUENCE; Schema: att; Owner: -
--

ALTER TABLE att.quarantined_swipes ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME att.quarantined_swipes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: recompute_queue; Type: TABLE; Schema: att; Owner: -
--

CREATE TABLE att.recompute_queue (
    employee_id bigint NOT NULL,
    work_date date NOT NULL,
    queued_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: regularizations; Type: TABLE; Schema: att; Owner: -
--

CREATE TABLE att.regularizations (
    id bigint NOT NULL,
    employee_id bigint NOT NULL,
    kind text NOT NULL,
    from_date date NOT NULL,
    to_date date NOT NULL,
    from_time time without time zone,
    to_time time without time zone,
    reason text NOT NULL,
    requested_status att.day_status NOT NULL,
    workflow_request_id bigint NOT NULL,
    applied boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    day_portion text DEFAULT 'full_day'::text NOT NULL,
    CONSTRAINT regularizations_check CHECK ((from_date <= to_date)),
    CONSTRAINT regularizations_check1 CHECK (((kind <> 'PERMISSION'::text) OR ((from_time IS NOT NULL) AND (to_time IS NOT NULL) AND (from_date = to_date)))),
    CONSTRAINT regularizations_day_portion_check CHECK ((day_portion = ANY (ARRAY['full_day'::text, 'first_half'::text, 'second_half'::text]))),
    CONSTRAINT regularizations_kind_check CHECK ((kind = ANY (ARRAY['AR'::text, 'OD'::text, 'PERMISSION'::text])))
);


--
-- Name: regularizations_id_seq; Type: SEQUENCE; Schema: att; Owner: -
--

ALTER TABLE att.regularizations ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME att.regularizations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: roster_publications; Type: TABLE; Schema: att; Owner: -
--

CREATE TABLE att.roster_publications (
    id bigint NOT NULL,
    manager_employee_id bigint NOT NULL,
    period_from date NOT NULL,
    period_to date NOT NULL,
    published_at timestamp with time zone DEFAULT now() NOT NULL,
    published_by bigint NOT NULL,
    revision integer DEFAULT 1 NOT NULL,
    reason text,
    CONSTRAINT roster_publications_check CHECK ((period_to >= period_from))
);


--
-- Name: roster_publications_id_seq; Type: SEQUENCE; Schema: att; Owner: -
--

ALTER TABLE att.roster_publications ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME att.roster_publications_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: roster_revisions; Type: TABLE; Schema: att; Owner: -
--

CREATE TABLE att.roster_revisions (
    id bigint NOT NULL,
    employee_id bigint NOT NULL,
    work_date date NOT NULL,
    old_shift_id bigint,
    new_shift_id bigint,
    old_week_off boolean NOT NULL,
    new_week_off boolean NOT NULL,
    reason text NOT NULL,
    changed_by bigint NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: roster_revisions_id_seq; Type: SEQUENCE; Schema: att; Owner: -
--

ALTER TABLE att.roster_revisions ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME att.roster_revisions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: rosters; Type: TABLE; Schema: att; Owner: -
--

CREATE TABLE att.rosters (
    id bigint NOT NULL,
    employee_id bigint NOT NULL,
    work_date date NOT NULL,
    shift_id bigint,
    is_week_off boolean DEFAULT false NOT NULL,
    set_by bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT rosters_check CHECK ((is_week_off OR (shift_id IS NOT NULL)))
);


--
-- Name: rosters_id_seq; Type: SEQUENCE; Schema: att; Owner: -
--

ALTER TABLE att.rosters ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME att.rosters_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: shift_patterns; Type: TABLE; Schema: att; Owner: -
--

CREATE TABLE att.shift_patterns (
    id bigint NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    cycle jsonb NOT NULL,
    created_by bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT shift_patterns_cycle_array CHECK ((jsonb_typeof(cycle) = 'array'::text))
);


--
-- Name: shift_patterns_id_seq; Type: SEQUENCE; Schema: att; Owner: -
--

ALTER TABLE att.shift_patterns ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME att.shift_patterns_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: shift_swaps; Type: TABLE; Schema: att; Owner: -
--

CREATE TABLE att.shift_swaps (
    id bigint NOT NULL,
    requester_employee_id bigint NOT NULL,
    counterpart_employee_id bigint,
    work_date date NOT NULL,
    requester_shift_id bigint,
    counterpart_shift_id bigint,
    kind text NOT NULL,
    workflow_request_id bigint NOT NULL,
    applied boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT shift_swaps_kind_check CHECK ((kind = ANY (ARRAY['swap'::text, 'bid'::text])))
);


--
-- Name: shift_swaps_id_seq; Type: SEQUENCE; Schema: att; Owner: -
--

ALTER TABLE att.shift_swaps ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME att.shift_swaps_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: shifts; Type: TABLE; Schema: att; Owner: -
--

CREATE TABLE att.shifts (
    id bigint NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    crosses_midnight boolean DEFAULT false NOT NULL,
    session_split time without time zone,
    grace_in_minutes smallint DEFAULT 0 NOT NULL,
    grace_out_minutes smallint DEFAULT 0 NOT NULL,
    min_half_day_hours numeric(4,2) NOT NULL,
    min_full_day_hours numeric(4,2) NOT NULL,
    break_minutes smallint DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    break_paid boolean DEFAULT false NOT NULL,
    ot_start_offset_minutes smallint DEFAULT 0 NOT NULL,
    late_slabs jsonb DEFAULT '[]'::jsonb NOT NULL,
    early_exit_slabs jsonb DEFAULT '[]'::jsonb NOT NULL,
    allowance_component_code text,
    session2_start time without time zone,
    session2_end time without time zone,
    CONSTRAINT shifts_hours_order CHECK ((min_full_day_hours >= min_half_day_hours)),
    CONSTRAINT shifts_minutes_nonnegative CHECK (((grace_in_minutes >= 0) AND (grace_out_minutes >= 0) AND (break_minutes >= 0) AND (min_half_day_hours >= (0)::numeric) AND (min_full_day_hours >= min_half_day_hours))),
    CONSTRAINT shifts_ot_offset CHECK (((ot_start_offset_minutes >= 0) AND (ot_start_offset_minutes <= 240))),
    CONSTRAINT shifts_primary_window_valid CHECK (((start_time <> end_time) AND ((crosses_midnight AND (end_time < start_time)) OR ((NOT crosses_midnight) AND (end_time > start_time))))),
    CONSTRAINT shifts_second_session_valid CHECK (((session2_start IS NULL) OR ((NOT crosses_midnight) AND (session_split IS NULL) AND (session2_start >= end_time) AND (session2_end > session2_start)))),
    CONSTRAINT shifts_session2_pair CHECK (((session2_start IS NULL) = (session2_end IS NULL))),
    CONSTRAINT shifts_session_split_valid CHECK (((session_split IS NULL) OR ((NOT crosses_midnight) AND (session2_start IS NULL) AND (session_split > start_time) AND (session_split < end_time))))
);


--
-- Name: shifts_id_seq; Type: SEQUENCE; Schema: att; Owner: -
--

ALTER TABLE att.shifts ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME att.shifts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: swipe_events; Type: TABLE; Schema: att; Owner: -
--

CREATE TABLE att.swipe_events (
    id bigint NOT NULL,
    employee_id bigint,
    employee_no text NOT NULL,
    access_card text,
    shift_label text,
    swipe_ts timestamp with time zone NOT NULL,
    door_code text,
    longitude numeric(9,6),
    latitude numeric(9,6),
    location_type text,
    mobile_device_name text,
    mobile_device_id text,
    swipe_type text,
    direction text,
    remarks text,
    permission_reason text,
    signed_by text,
    received_at timestamp with time zone NOT NULL,
    source text DEFAULT 'kent'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
)
PARTITION BY RANGE (swipe_ts);


--
-- Name: swipe_events_202610; Type: TABLE; Schema: att; Owner: -
--

CREATE TABLE att.swipe_events_202610 (
    id bigint NOT NULL,
    employee_id bigint,
    employee_no text NOT NULL,
    access_card text,
    shift_label text,
    swipe_ts timestamp with time zone NOT NULL,
    door_code text,
    longitude numeric(9,6),
    latitude numeric(9,6),
    location_type text,
    mobile_device_name text,
    mobile_device_id text,
    swipe_type text,
    direction text,
    remarks text,
    permission_reason text,
    signed_by text,
    received_at timestamp with time zone NOT NULL,
    source text DEFAULT 'kent'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: swipe_events_202611; Type: TABLE; Schema: att; Owner: -
--

CREATE TABLE att.swipe_events_202611 (
    id bigint NOT NULL,
    employee_id bigint,
    employee_no text NOT NULL,
    access_card text,
    shift_label text,
    swipe_ts timestamp with time zone NOT NULL,
    door_code text,
    longitude numeric(9,6),
    latitude numeric(9,6),
    location_type text,
    mobile_device_name text,
    mobile_device_id text,
    swipe_type text,
    direction text,
    remarks text,
    permission_reason text,
    signed_by text,
    received_at timestamp with time zone NOT NULL,
    source text DEFAULT 'kent'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: swipe_events_id_seq; Type: SEQUENCE; Schema: att; Owner: -
--

ALTER TABLE att.swipe_events ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME att.swipe_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: calendar_items; Type: TABLE; Schema: cmp; Owner: -
--

CREATE TABLE cmp.calendar_items (
    id bigint NOT NULL,
    company_id bigint NOT NULL,
    obligation_code text NOT NULL,
    title text NOT NULL,
    frequency text NOT NULL,
    period_label text NOT NULL,
    due_on date NOT NULL,
    owner_user_id bigint,
    status text DEFAULT 'due'::text NOT NULL,
    registration_id bigint,
    filed_at timestamp with time zone,
    filed_by_user_id bigint,
    waived_reason text,
    waived_by_user_id bigint,
    waived_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT calendar_filed_pairs CHECK (((status <> 'filed'::text) OR ((filed_at IS NOT NULL) AND (filed_by_user_id IS NOT NULL)))),
    CONSTRAINT calendar_items_frequency_check CHECK ((frequency = ANY (ARRAY['monthly'::text, 'quarterly'::text, 'half_yearly'::text, 'annual'::text, 'one_off'::text]))),
    CONSTRAINT calendar_items_status_check CHECK ((status = ANY (ARRAY['due'::text, 'filed'::text, 'waived'::text]))),
    CONSTRAINT calendar_waived_pairs CHECK (((status <> 'waived'::text) OR ((waived_at IS NOT NULL) AND (waived_by_user_id IS NOT NULL) AND (waived_reason IS NOT NULL) AND (length(btrim(waived_reason)) >= 3))))
);


--
-- Name: calendar_items_id_seq; Type: SEQUENCE; Schema: cmp; Owner: -
--

ALTER TABLE cmp.calendar_items ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME cmp.calendar_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: filing_evidence; Type: TABLE; Schema: cmp; Owner: -
--

CREATE TABLE cmp.filing_evidence (
    id bigint NOT NULL,
    calendar_item_id bigint NOT NULL,
    reference text NOT NULL,
    document_path text,
    remark text,
    filed_by_user_id bigint NOT NULL,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT evidence_reference_present CHECK ((length(btrim(reference)) >= 2))
);


--
-- Name: filing_evidence_id_seq; Type: SEQUENCE; Schema: cmp; Owner: -
--

ALTER TABLE cmp.filing_evidence ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME cmp.filing_evidence_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: registrations; Type: TABLE; Schema: cmp; Owner: -
--

CREATE TABLE cmp.registrations (
    id bigint NOT NULL,
    company_id bigint NOT NULL,
    location_id bigint,
    kind text NOT NULL,
    registration_no text NOT NULL,
    issuing_authority text,
    valid_from date NOT NULL,
    valid_to date,
    renewal_owner_user_id bigint,
    document_path text,
    notes text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT registrations_kind_check CHECK ((kind = ANY (ARRAY['pf'::text, 'esic'::text, 'pt'::text, 'lwf'::text, 'factory_licence'::text, 'clra_licence'::text, 'shops'::text, 'single_registration'::text, 'other'::text]))),
    CONSTRAINT registrations_number_present CHECK ((length(btrim(registration_no)) > 0)),
    CONSTRAINT registrations_validity_ordered CHECK (((valid_to IS NULL) OR (valid_to > valid_from)))
);


--
-- Name: registrations_id_seq; Type: SEQUENCE; Schema: cmp; Owner: -
--

ALTER TABLE cmp.registrations ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME cmp.registrations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: audit_log; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.audit_log (
    id bigint NOT NULL,
    actor_user_id bigint,
    action text NOT NULL,
    entity text NOT NULL,
    entity_id bigint,
    field text,
    old_value text,
    new_value text,
    ip inet,
    at timestamp with time zone DEFAULT now() NOT NULL,
    prev_hash text NOT NULL,
    row_hash text NOT NULL,
    scope_org_unit_id bigint,
    hash_version smallint DEFAULT 2 NOT NULL,
    chain_seq bigint NOT NULL,
    CONSTRAINT audit_log_hash_version_check CHECK ((hash_version = ANY (ARRAY[1, 2])))
);


--
-- Name: audit_log_chain_seq; Type: SEQUENCE; Schema: core; Owner: -
--

CREATE SEQUENCE core.audit_log_chain_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: audit_log_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

ALTER TABLE core.audit_log ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME core.audit_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: clearances; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.clearances (
    id bigint NOT NULL,
    separation_id bigint NOT NULL,
    department text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    remarks text,
    unreturned_assets jsonb,
    recovery_amount numeric(14,2) DEFAULT 0 NOT NULL,
    cleared_by bigint,
    cleared_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT clearances_department_check CHECK ((department = ANY (ARRAY['IT'::text, 'Admin'::text, 'Finance'::text, 'HR'::text]))),
    CONSTRAINT clearances_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'cleared'::text, 'flagged'::text])))
);


--
-- Name: clearances_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

ALTER TABLE core.clearances ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME core.clearances_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: companies; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.companies (
    id bigint NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    ecode_prefix text NOT NULL,
    ecode_next_seq integer DEFAULT 1 NOT NULL,
    is_india_payroll boolean DEFAULT true NOT NULL,
    gstin text,
    pan text,
    pf_establishment_code text,
    esic_code text,
    pt_registration_no text,
    tan text,
    address text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    sap_company_code text
);


--
-- Name: companies_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

ALTER TABLE core.companies ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME core.companies_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: cost_centers; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.cost_centers (
    id bigint NOT NULL,
    company_id bigint NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    plant_id bigint
);


--
-- Name: cost_centers_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

ALTER TABLE core.cost_centers ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME core.cost_centers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: departments; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.departments (
    id bigint NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    mis_code_id bigint
);


--
-- Name: departments_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

ALTER TABLE core.departments ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME core.departments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: designations; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.designations (
    id bigint NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: designations_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

ALTER TABLE core.designations ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME core.designations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: documents; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.documents (
    id bigint NOT NULL,
    owner_employee_id bigint,
    kind text NOT NULL,
    path text NOT NULL,
    original_name text NOT NULL,
    mime text NOT NULL,
    size_bytes integer NOT NULL,
    uploaded_by bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_on date,
    status text DEFAULT 'active'::text NOT NULL,
    CONSTRAINT documents_status_check CHECK ((status = ANY (ARRAY['active'::text, 'superseded'::text, 'withdrawn'::text])))
);


--
-- Name: documents_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

ALTER TABLE core.documents ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME core.documents_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: employee_family; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.employee_family (
    id bigint NOT NULL,
    employee_id bigint NOT NULL,
    name text NOT NULL,
    relation text NOT NULL,
    dob date,
    aadhaar text,
    is_esic_dependent boolean DEFAULT false NOT NULL,
    is_nominee boolean DEFAULT false NOT NULL,
    nominee_share_pct numeric(5,2),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: employee_family_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

ALTER TABLE core.employee_family ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME core.employee_family_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: employee_history; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.employee_history (
    id bigint NOT NULL,
    employee_id bigint NOT NULL,
    effective_date date NOT NULL,
    change_type text NOT NULL,
    field text NOT NULL,
    old_value text,
    new_value text,
    reference_id bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: employee_history_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

ALTER TABLE core.employee_history ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME core.employee_history_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: employees; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.employees (
    id bigint NOT NULL,
    ecode text NOT NULL,
    company_id bigint NOT NULL,
    first_name text NOT NULL,
    last_name text,
    photo_path text,
    gender text,
    dob date,
    marital_status text,
    blood_group text,
    personal_email text,
    work_email public.citext,
    mobile text,
    emergency_contact_name text,
    emergency_contact_phone text,
    present_address text,
    permanent_address text,
    category core.employment_category,
    contract_type core.contract_type,
    contract_end_date date,
    doj date,
    dol date,
    status core.employee_status DEFAULT 'onboarding'::core.employee_status NOT NULL,
    exit_reason text,
    designation_id bigint,
    department_id bigint,
    org_unit_id bigint,
    location_id bigint,
    cost_center_id bigint,
    grade_id bigint,
    reporting_manager_id bigint,
    functional_manager_id bigint,
    probation_months smallint,
    probation_salary_pct smallint,
    probation_due_date date,
    confirmation_date date,
    pan text,
    aadhaar text,
    uan text,
    pf_number text,
    esic_ip_number text,
    pf_applicable boolean DEFAULT true NOT NULL,
    esic_applicable boolean DEFAULT false NOT NULL,
    pt_applicable boolean DEFAULT true NOT NULL,
    lwf_applicable boolean DEFAULT true NOT NULL,
    tax_regime text DEFAULT 'new'::text NOT NULL,
    bank_name text,
    bank_account text,
    bank_ifsc text,
    payment_mode text DEFAULT 'bank'::text NOT NULL,
    access_card_no text,
    biometric_registered boolean DEFAULT false NOT NULL,
    attendance_mode text DEFAULT 'biometric'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    plant_id bigint,
    hod_employee_id bigint,
    CONSTRAINT employees_attendance_mode_check CHECK ((attendance_mode = ANY (ARRAY['biometric'::text, 'mobile'::text, 'manual'::text]))),
    CONSTRAINT employees_check CHECK (((status <> 'exited'::core.employee_status) OR (dol IS NOT NULL))),
    CONSTRAINT employees_hod_not_self CHECK (((hod_employee_id IS NULL) OR (hod_employee_id <> id))),
    CONSTRAINT employees_payment_mode_check CHECK ((payment_mode = ANY (ARRAY['bank'::text, 'cheque'::text, 'hold'::text]))),
    CONSTRAINT employees_tax_regime_check CHECK ((tax_regime = ANY (ARRAY['old'::text, 'new'::text])))
);


--
-- Name: employees_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

ALTER TABLE core.employees ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME core.employees_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: grades; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.grades (
    id bigint NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    rank smallint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: grades_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

ALTER TABLE core.grades ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME core.grades_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: letter_templates; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.letter_templates (
    id bigint NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    body_template text NOT NULL,
    body_docx_document_id bigint,
    merge_fields jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: letter_templates_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

ALTER TABLE core.letter_templates ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME core.letter_templates_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: letters; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.letters (
    id bigint NOT NULL,
    employee_id bigint NOT NULL,
    template_code text NOT NULL,
    document_id bigint,
    issued_by bigint,
    issued_at timestamp with time zone,
    workflow_request_id bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    body_rendered text NOT NULL,
    status text DEFAULT 'issued'::text NOT NULL,
    CONSTRAINT letters_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'pending_signature'::text, 'issued'::text])))
);


--
-- Name: letters_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

ALTER TABLE core.letters ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME core.letters_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: locations; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.locations (
    id bigint NOT NULL,
    company_id bigint NOT NULL,
    name text NOT NULL,
    state_code text NOT NULL,
    timezone text DEFAULT 'Asia/Kolkata'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: locations_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

ALTER TABLE core.locations ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME core.locations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: mis_codes; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.mis_codes (
    id bigint NOT NULL,
    company_id bigint NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    parent_id bigint,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mis_codes_code_check CHECK ((length(btrim(code)) > 0))
);


--
-- Name: mis_codes_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

ALTER TABLE core.mis_codes ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME core.mis_codes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: onboarding_candidates; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.onboarding_candidates (
    id bigint NOT NULL,
    ats_candidate_id bigint,
    loi_reference text,
    full_name text NOT NULL,
    personal_email text NOT NULL,
    mobile text NOT NULL,
    dob date,
    address text,
    total_experience_years numeric(4,1),
    previous_company text,
    current_salary numeric(14,2),
    expected_salary numeric(14,2),
    position_title text NOT NULL,
    department text,
    org_unit text,
    designation text,
    company_id bigint,
    category core.employment_category DEFAULT 'white_collar'::core.employment_category NOT NULL,
    replacement_of_ecode text,
    offered_ctc numeric(14,2) NOT NULL,
    probation_months smallint DEFAULT 6,
    probation_salary_pct smallint DEFAULT 100,
    proposed_doj date NOT NULL,
    offer_date date NOT NULL,
    work_location text,
    prejoin_link_token text,
    prejoin_token_hash text,
    prejoin_token_expires_at timestamp with time zone,
    prejoin_link_sent_at timestamp with time zone,
    prejoin_completed_at timestamp with time zone,
    prejoin_submitted_data jsonb,
    status text DEFAULT 'awaiting_prejoin'::text NOT NULL,
    employee_id bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT onboarding_candidates_status_check CHECK ((status = ANY (ARRAY['awaiting_prejoin'::text, 'link_sent'::text, 'prejoin_done'::text, 'converted'::text, 'no_show'::text]))),
    CONSTRAINT prejoin_raw_token_forbidden CHECK ((prejoin_link_token IS NULL))
);


--
-- Name: onboarding_candidates_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

ALTER TABLE core.onboarding_candidates ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME core.onboarding_candidates_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: onboarding_tasks; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.onboarding_tasks (
    id bigint NOT NULL,
    employee_id bigint NOT NULL,
    candidate_id bigint,
    task_code text NOT NULL,
    task_name text NOT NULL,
    department text NOT NULL,
    owner_role text NOT NULL,
    due_date date NOT NULL,
    sla_hours integer DEFAULT 48 NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    escalated_at timestamp with time zone,
    done_by bigint,
    done_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT onboarding_tasks_department_check CHECK ((department = ANY (ARRAY['IT'::text, 'Admin'::text, 'HR'::text, 'Payroll'::text]))),
    CONSTRAINT onboarding_tasks_status_check CHECK ((status = ANY (ARRAY['open'::text, 'completed'::text, 'escalated'::text])))
);


--
-- Name: onboarding_tasks_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

ALTER TABLE core.onboarding_tasks ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME core.onboarding_tasks_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: org_units; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.org_units (
    id bigint NOT NULL,
    company_id bigint NOT NULL,
    parent_id bigint,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: org_units_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

ALTER TABLE core.org_units ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME core.org_units_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: password_reset_tokens; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.password_reset_tokens (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

ALTER TABLE core.password_reset_tokens ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME core.password_reset_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: permissions; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.permissions (
    id bigint NOT NULL,
    code text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: permissions_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

ALTER TABLE core.permissions ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME core.permissions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: plants; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.plants (
    id bigint NOT NULL,
    company_id bigint NOT NULL,
    plant_code text NOT NULL,
    name text NOT NULL,
    location_id bigint,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT plants_plant_code_check CHECK ((length(btrim(plant_code)) > 0))
);


--
-- Name: plants_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

ALTER TABLE core.plants ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME core.plants_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: policies; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.policies (
    id bigint NOT NULL,
    title text NOT NULL,
    document_id bigint,
    effective_date date NOT NULL,
    requires_acknowledgment boolean DEFAULT true NOT NULL,
    audience jsonb,
    is_active boolean DEFAULT true NOT NULL,
    created_by bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    body_summary text,
    CONSTRAINT policies_has_content CHECK (((document_id IS NOT NULL) OR (body_summary IS NOT NULL)))
);


--
-- Name: policies_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

ALTER TABLE core.policies ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME core.policies_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: policy_acknowledgments; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.policy_acknowledgments (
    id bigint NOT NULL,
    policy_id bigint NOT NULL,
    employee_id bigint NOT NULL,
    acknowledged_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: policy_acknowledgments_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

ALTER TABLE core.policy_acknowledgments ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME core.policy_acknowledgments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: probation_reviews; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.probation_reviews (
    id bigint NOT NULL,
    employee_id bigint NOT NULL,
    due_date date NOT NULL,
    manager_recommendation text,
    extension_months smallint,
    review_notes text,
    ratings jsonb,
    status text DEFAULT 'pending'::text NOT NULL,
    outcome text,
    decided_by bigint,
    decided_at timestamp with time zone,
    confirmation_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT probation_reviews_extension_months_check CHECK (((extension_months >= 1) AND (extension_months <= 6))),
    CONSTRAINT probation_reviews_manager_recommendation_check CHECK ((manager_recommendation = ANY (ARRAY['confirm'::text, 'extend'::text, 'separate'::text]))),
    CONSTRAINT probation_reviews_outcome_check CHECK ((outcome = ANY (ARRAY['confirmed'::text, 'extended'::text, 'separated'::text]))),
    CONSTRAINT probation_reviews_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'under_review'::text, 'completed'::text])))
);


--
-- Name: probation_reviews_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

ALTER TABLE core.probation_reviews ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME core.probation_reviews_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: profile_change_requests; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.profile_change_requests (
    id bigint NOT NULL,
    employee_id bigint NOT NULL,
    field text NOT NULL,
    old_value text,
    new_value text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    workflow_request_id bigint,
    decided_by bigint,
    decided_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT profile_change_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: profile_change_requests_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

ALTER TABLE core.profile_change_requests ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME core.profile_change_requests_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: reporting_tree; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.reporting_tree (
    manager_id bigint NOT NULL,
    employee_id bigint NOT NULL,
    depth smallint NOT NULL
);


--
-- Name: role_permissions; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.role_permissions (
    id bigint NOT NULL,
    role_id bigint NOT NULL,
    permission_id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    scope text DEFAULT 'all'::text NOT NULL,
    CONSTRAINT role_permissions_scope_check CHECK ((scope = ANY (ARRAY['all'::text, 'subtree'::text, 'own'::text, 'org_unit'::text, 'readonly'::text])))
);


--
-- Name: role_permissions_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

ALTER TABLE core.role_permissions ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME core.role_permissions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: roles; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.roles (
    id bigint NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: roles_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

ALTER TABLE core.roles ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME core.roles_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: separations; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.separations (
    id bigint NOT NULL,
    employee_id bigint NOT NULL,
    initiated_at timestamp with time zone DEFAULT now() NOT NULL,
    initiated_by text NOT NULL,
    reason text NOT NULL,
    resignation_date date NOT NULL,
    notice_period_days smallint NOT NULL,
    requested_lwd date NOT NULL,
    approved_lwd date,
    shortfall_days numeric(4,1) DEFAULT 0 NOT NULL,
    workflow_request_id bigint,
    status text DEFAULT 'pending'::text NOT NULL,
    fnf_id bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT separations_initiated_by_check CHECK ((initiated_by = ANY (ARRAY['employee'::text, 'hr'::text]))),
    CONSTRAINT separations_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'withdrawn'::text, 'rejected'::text, 'completed'::text])))
);


--
-- Name: separations_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

ALTER TABLE core.separations ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME core.separations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: settings; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.settings (
    key text NOT NULL,
    value jsonb NOT NULL,
    value_type text NOT NULL,
    description text NOT NULL,
    updated_by bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: transfers; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.transfers (
    id bigint NOT NULL,
    employee_id bigint NOT NULL,
    transfer_type text NOT NULL,
    effective_date date NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    current_company_id bigint NOT NULL,
    current_department_id bigint,
    current_location_id bigint,
    current_designation_id bigint,
    current_grade_id bigint,
    current_reporting_manager_id bigint,
    current_ecode text NOT NULL,
    target_company_id bigint,
    target_department_id bigint,
    target_location_id bigint,
    target_designation_id bigint,
    target_grade_id bigint,
    target_reporting_manager_id bigint,
    target_ecode text,
    salary_revision_amount numeric(12,2),
    leave_treatment text DEFAULT 'transfer'::text NOT NULL,
    reason text NOT NULL,
    remarks text,
    approved_by bigint,
    approved_at timestamp with time zone,
    notified_at timestamp with time zone,
    created_by bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT transfers_leave_treatment_check CHECK ((leave_treatment = ANY (ARRAY['transfer'::text, 'encash'::text]))),
    CONSTRAINT transfers_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'completed'::text, 'cancelled'::text]))),
    CONSTRAINT transfers_transfer_type_check CHECK ((transfer_type = ANY (ARRAY['department'::text, 'location'::text, 'inter_entity'::text, 'promotion'::text])))
);


--
-- Name: transfers_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

ALTER TABLE core.transfers ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME core.transfers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: user_roles; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.user_roles (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    role_id bigint NOT NULL,
    scope_org_unit_id bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_roles_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

ALTER TABLE core.user_roles ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME core.user_roles_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: users; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.users (
    id bigint NOT NULL,
    employee_id bigint,
    email public.citext NOT NULL,
    password_hash text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    last_login_at timestamp with time zone,
    failed_attempts smallint DEFAULT 0 NOT NULL,
    locked_until timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

ALTER TABLE core.users ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME core.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: types; Type: TABLE; Schema: doc; Owner: -
--

CREATE TABLE doc.types (
    code text NOT NULL,
    name text NOT NULL,
    typically_expires boolean DEFAULT false NOT NULL,
    retention_class text,
    mandatory_for text DEFAULT ''::text NOT NULL,
    sort_order smallint DEFAULT 100 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT types_code_present CHECK ((length(btrim(code)) > 0)),
    CONSTRAINT types_name_present CHECK ((length(btrim(name)) > 0))
);


--
-- Name: announcements; Type: TABLE; Schema: eng; Owner: -
--

CREATE TABLE eng.announcements (
    id bigint NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    audience jsonb DEFAULT '{}'::jsonb NOT NULL,
    published_by bigint NOT NULL,
    published_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    attachment_document_id bigint
);


--
-- Name: announcements_id_seq; Type: SEQUENCE; Schema: eng; Owner: -
--

ALTER TABLE eng.announcements ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME eng.announcements_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: poll_responses; Type: TABLE; Schema: eng; Owner: -
--

CREATE TABLE eng.poll_responses (
    id bigint NOT NULL,
    poll_id bigint NOT NULL,
    respondent_user_id bigint,
    option_index smallint NOT NULL,
    comment text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    respondent_hash text,
    CONSTRAINT poll_responses_identity_mode CHECK (((respondent_user_id IS NULL) <> (respondent_hash IS NULL))),
    CONSTRAINT poll_responses_option_index_check CHECK ((option_index >= 0))
);


--
-- Name: COLUMN poll_responses.respondent_hash; Type: COMMENT; Schema: eng; Owner: -
--

COMMENT ON COLUMN eng.poll_responses.respondent_hash IS 'EN-02/03 salted HMAC of (poll, user) — dedupes anonymous responses without storing identity (docs/03 §9)';


--
-- Name: poll_responses_id_seq; Type: SEQUENCE; Schema: eng; Owner: -
--

ALTER TABLE eng.poll_responses ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME eng.poll_responses_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: polls; Type: TABLE; Schema: eng; Owner: -
--

CREATE TABLE eng.polls (
    id bigint NOT NULL,
    question text NOT NULL,
    options jsonb NOT NULL,
    kind text DEFAULT 'poll'::text NOT NULL,
    is_anonymous boolean DEFAULT false NOT NULL,
    audience jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by bigint NOT NULL,
    opens_at timestamp with time zone DEFAULT now() NOT NULL,
    closes_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT polls_kind_check CHECK ((kind = ANY (ARRAY['poll'::text, 'pulse'::text])))
);


--
-- Name: TABLE polls; Type: COMMENT; Schema: eng; Owner: -
--

COMMENT ON TABLE eng.polls IS 'EN-02/03 polls and pulse surveys; anonymity is fixed at creation';


--
-- Name: polls_id_seq; Type: SEQUENCE; Schema: eng; Owner: -
--

ALTER TABLE eng.polls ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME eng.polls_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: survey_responses; Type: TABLE; Schema: eng; Owner: -
--

CREATE TABLE eng.survey_responses (
    id bigint NOT NULL,
    survey_id bigint NOT NULL,
    respondent_user_id bigint,
    respondent_hash text,
    answers jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT survey_responses_respondent_check CHECK (((respondent_user_id IS NULL) <> (respondent_hash IS NULL)))
);


--
-- Name: TABLE survey_responses; Type: COMMENT; Schema: eng; Owner: -
--

COMMENT ON TABLE eng.survey_responses IS 'Survey responses with salted HMAC dedupe for anonymous ballots';


--
-- Name: survey_responses_id_seq; Type: SEQUENCE; Schema: eng; Owner: -
--

ALTER TABLE eng.survey_responses ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME eng.survey_responses_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: surveys; Type: TABLE; Schema: eng; Owner: -
--

CREATE TABLE eng.surveys (
    id bigint NOT NULL,
    title text NOT NULL,
    description text,
    questions jsonb NOT NULL,
    audience jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by bigint NOT NULL,
    open_from timestamp with time zone DEFAULT now() NOT NULL,
    open_till timestamp with time zone,
    is_anonymous boolean DEFAULT true NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE surveys; Type: COMMENT; Schema: eng; Owner: -
--

COMMENT ON TABLE eng.surveys IS 'EN-03 multi-question pulse surveys (C34, docs/03 §9)';


--
-- Name: surveys_id_seq; Type: SEQUENCE; Schema: eng; Owner: -
--

ALTER TABLE eng.surveys ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME eng.surveys_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: categories; Type: TABLE; Schema: hd; Owner: -
--

CREATE TABLE hd.categories (
    id bigint NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    assignee_role_code text,
    sla_hours integer DEFAULT 24 NOT NULL,
    escalate_after_hours integer,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    escalate_to_role_code text DEFAULT 'hr_head'::text,
    CONSTRAINT categories_escalate_after_hours_check CHECK (((escalate_after_hours IS NULL) OR (escalate_after_hours > 0))),
    CONSTRAINT categories_sla_hours_check CHECK ((sla_hours > 0))
);


--
-- Name: TABLE categories; Type: COMMENT; Schema: hd; Owner: -
--

COMMENT ON TABLE hd.categories IS 'HD-01 routing + SLA as runtime data; includes the HRMS-platform channel (docs/07 §4b)';


--
-- Name: categories_id_seq; Type: SEQUENCE; Schema: hd; Owner: -
--

ALTER TABLE hd.categories ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME hd.categories_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: ticket_messages; Type: TABLE; Schema: hd; Owner: -
--

CREATE TABLE hd.ticket_messages (
    id bigint NOT NULL,
    ticket_id bigint NOT NULL,
    author_user_id bigint NOT NULL,
    body text NOT NULL,
    is_internal boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE ticket_messages; Type: COMMENT; Schema: hd; Owner: -
--

COMMENT ON TABLE hd.ticket_messages IS 'SOW-9.4 append-only query log';


--
-- Name: ticket_messages_id_seq; Type: SEQUENCE; Schema: hd; Owner: -
--

ALTER TABLE hd.ticket_messages ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME hd.ticket_messages_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: ticket_no_seq; Type: SEQUENCE; Schema: hd; Owner: -
--

CREATE SEQUENCE hd.ticket_no_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tickets; Type: TABLE; Schema: hd; Owner: -
--

CREATE TABLE hd.tickets (
    id bigint NOT NULL,
    ticket_no text NOT NULL,
    raised_by bigint NOT NULL,
    category_id bigint NOT NULL,
    subject text NOT NULL,
    body text NOT NULL,
    assignee_user_id bigint,
    status text DEFAULT 'open'::text NOT NULL,
    priority text DEFAULT 'normal'::text NOT NULL,
    sla_due_at timestamp with time zone NOT NULL,
    escalated_level smallint DEFAULT 0 NOT NULL,
    escalated_at timestamp with time zone,
    acknowledged_at timestamp with time zone,
    resolved_at timestamp with time zone,
    resolution text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    first_response_at timestamp with time zone,
    reopen_count integer DEFAULT 0 NOT NULL,
    escalated_to_user_id bigint,
    CONSTRAINT tickets_escalated_level_check CHECK ((escalated_level >= 0)),
    CONSTRAINT tickets_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'urgent'::text]))),
    CONSTRAINT tickets_resolution_complete CHECK (((status <> ALL (ARRAY['resolved'::text, 'closed'::text])) OR ((resolved_at IS NOT NULL) AND (resolution IS NOT NULL)))),
    CONSTRAINT tickets_status_check CHECK ((status = ANY (ARRAY['open'::text, 'pending'::text, 'resolved'::text, 'closed'::text])))
);


--
-- Name: TABLE tickets; Type: COMMENT; Schema: hd; Owner: -
--

COMMENT ON TABLE hd.tickets IS 'HD-01 tickets; sla_due_at NOT NULL so every ticket has a clock';


--
-- Name: tickets_id_seq; Type: SEQUENCE; Schema: hd; Owner: -
--

ALTER TABLE hd.tickets ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME hd.tickets_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: grievances; Type: TABLE; Schema: ird; Owner: -
--

CREATE TABLE ird.grievances (
    id bigint NOT NULL,
    case_ref text NOT NULL,
    status text DEFAULT 'submitted'::text NOT NULL,
    filed_at timestamp with time zone DEFAULT now() NOT NULL,
    filed_by_user_id bigint NOT NULL,
    summary text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT grievances_ref_present CHECK ((length(btrim(case_ref)) > 0)),
    CONSTRAINT grievances_status_check CHECK ((status = ANY (ARRAY['submitted'::text, 'under_review'::text, 'escalated'::text, 'resolved'::text, 'closed'::text]))),
    CONSTRAINT grievances_summary_present CHECK ((length(btrim(summary)) >= 10))
);


--
-- Name: grievances_id_seq; Type: SEQUENCE; Schema: ird; Owner: -
--

ALTER TABLE ird.grievances ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME ird.grievances_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: ic_members; Type: TABLE; Schema: ird; Owner: -
--

CREATE TABLE ird.ic_members (
    id bigint NOT NULL,
    employee_id bigint NOT NULL,
    role text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    appointed_on date NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ic_members_role_check CHECK ((role = ANY (ARRAY['presiding_officer'::text, 'member'::text, 'external'::text])))
);


--
-- Name: TABLE ic_members; Type: COMMENT; Schema: ird; Owner: -
--

COMMENT ON TABLE ird.ic_members IS 'POSH Internal Committee. Seed ZERO members — sponsor appoints (do not invent).';


--
-- Name: ic_members_id_seq; Type: SEQUENCE; Schema: ird; Owner: -
--

ALTER TABLE ird.ic_members ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME ird.ic_members_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: posh_case_access_log; Type: TABLE; Schema: ird; Owner: -
--

CREATE TABLE ird.posh_case_access_log (
    id bigint NOT NULL,
    case_id bigint NOT NULL,
    actor_user_id bigint NOT NULL,
    opened_at timestamp with time zone DEFAULT now() NOT NULL,
    ip text,
    outcome text DEFAULT 'opened'::text NOT NULL,
    CONSTRAINT posh_case_access_log_outcome_check CHECK ((outcome = ANY (ARRAY['opened'::text, 'refused'::text])))
);


--
-- Name: posh_case_access_log_id_seq; Type: SEQUENCE; Schema: ird; Owner: -
--

ALTER TABLE ird.posh_case_access_log ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME ird.posh_case_access_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: posh_cases; Type: TABLE; Schema: ird; Owner: -
--

CREATE TABLE ird.posh_cases (
    id bigint NOT NULL,
    case_ref text NOT NULL,
    status text DEFAULT 'submitted'::text NOT NULL,
    filed_at timestamp with time zone DEFAULT now() NOT NULL,
    filed_by_user_id bigint,
    is_anonymous boolean DEFAULT false NOT NULL,
    summary_encrypted_or_text text NOT NULL,
    anonymous_token_hash text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT posh_cases_anonymous_pair CHECK ((((is_anonymous = false) AND (filed_by_user_id IS NOT NULL)) OR ((is_anonymous = true) AND (filed_by_user_id IS NULL) AND (anonymous_token_hash IS NOT NULL)))),
    CONSTRAINT posh_cases_ref_present CHECK ((length(btrim(case_ref)) > 0)),
    CONSTRAINT posh_cases_status_check CHECK ((status = ANY (ARRAY['submitted'::text, 'under_inquiry'::text, 'closed'::text, 'withdrawn'::text]))),
    CONSTRAINT posh_cases_summary_present CHECK ((length(btrim(summary_encrypted_or_text)) >= 10))
);


--
-- Name: COLUMN posh_cases.summary_encrypted_or_text; Type: COMMENT; Schema: ird; Owner: -
--

COMMENT ON COLUMN ird.posh_cases.summary_encrypted_or_text IS 'v1: plain text. Encryption at rest is a Phase 5 follow-up — do not log this column.';


--
-- Name: posh_cases_id_seq; Type: SEQUENCE; Schema: ird; Owner: -
--

ALTER TABLE ird.posh_cases ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME ird.posh_cases_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: whistleblower_reports; Type: TABLE; Schema: ird; Owner: -
--

CREATE TABLE ird.whistleblower_reports (
    id bigint NOT NULL,
    anonymous_token_hash text NOT NULL,
    status text DEFAULT 'submitted'::text NOT NULL,
    filed_at timestamp with time zone DEFAULT now() NOT NULL,
    summary text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT whistle_summary_present CHECK ((length(btrim(summary)) >= 10)),
    CONSTRAINT whistle_token_present CHECK ((length(btrim(anonymous_token_hash)) = 64)),
    CONSTRAINT whistleblower_reports_status_check CHECK ((status = ANY (ARRAY['submitted'::text, 'triaged'::text, 'investigating'::text, 'closed'::text])))
);


--
-- Name: TABLE whistleblower_reports; Type: COMMENT; Schema: ird; Owner: -
--

COMMENT ON TABLE ird.whistleblower_reports IS 'Anonymous whistleblower intake. No PII columns — only a token hash for claim-code follow-up.';


--
-- Name: whistleblower_reports_id_seq; Type: SEQUENCE; Schema: ird; Owner: -
--

ALTER TABLE ird.whistleblower_reports ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME ird.whistleblower_reports_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: applications; Type: TABLE; Schema: lv; Owner: -
--

CREATE TABLE lv.applications (
    id bigint NOT NULL,
    employee_id bigint NOT NULL,
    leave_type_id bigint NOT NULL,
    from_date date NOT NULL,
    to_date date NOT NULL,
    from_half boolean DEFAULT false NOT NULL,
    to_half boolean DEFAULT false NOT NULL,
    days numeric(4,1) NOT NULL,
    reason text,
    status text DEFAULT 'pending'::text NOT NULL,
    workflow_request_id bigint NOT NULL,
    cancel_workflow_request_id bigint,
    ledger_txn_id bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT applications_check CHECK ((from_date <= to_date)),
    CONSTRAINT applications_days_check CHECK ((days > (0)::numeric)),
    CONSTRAINT applications_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text])))
);


--
-- Name: applications_id_seq; Type: SEQUENCE; Schema: lv; Owner: -
--

ALTER TABLE lv.applications ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME lv.applications_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: leave_types; Type: TABLE; Schema: lv; Owner: -
--

CREATE TABLE lv.leave_types (
    id bigint NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    is_paid boolean DEFAULT true NOT NULL,
    accrual_per_month numeric(5,2) DEFAULT 0 NOT NULL,
    accrual_requires_service_months smallint DEFAULT 0 NOT NULL,
    max_carry_forward numeric(5,2),
    encashable boolean DEFAULT false NOT NULL,
    max_per_request numeric(4,1),
    allow_half_day boolean DEFAULT true NOT NULL,
    sandwich_rule text DEFAULT 'exclude'::text NOT NULL,
    applicable_categories core.employment_category[],
    applicable_gender text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT leave_types_sandwich_rule_check CHECK ((sandwich_rule = ANY (ARRAY['include'::text, 'exclude'::text])))
);


--
-- Name: leave_types_id_seq; Type: SEQUENCE; Schema: lv; Owner: -
--

ALTER TABLE lv.leave_types ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME lv.leave_types_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: ledger; Type: TABLE; Schema: lv; Owner: -
--

CREATE TABLE lv.ledger (
    id bigint NOT NULL,
    employee_id bigint NOT NULL,
    leave_type_id bigint NOT NULL,
    txn_type text NOT NULL,
    delta numeric(5,2) NOT NULL,
    effective_date date NOT NULL,
    expiry_date date,
    reference_id bigint,
    note text,
    created_by bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ledger_check CHECK (((txn_type <> 'adjustment'::text) OR (note IS NOT NULL))),
    CONSTRAINT ledger_delta_check CHECK ((delta <> (0)::numeric)),
    CONSTRAINT ledger_txn_type_check CHECK ((txn_type = ANY (ARRAY['accrual'::text, 'grant'::text, 'application'::text, 'cancel'::text, 'lapse'::text, 'encash'::text, 'comp_off_earn'::text, 'adjustment'::text])))
);


--
-- Name: ledger_id_seq; Type: SEQUENCE; Schema: lv; Owner: -
--

ALTER TABLE lv.ledger ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME lv.ledger_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: restricted_holidays; Type: TABLE; Schema: lv; Owner: -
--

CREATE TABLE lv.restricted_holidays (
    id bigint NOT NULL,
    holiday_date date NOT NULL,
    name text NOT NULL,
    location_id bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: restricted_holidays_id_seq; Type: SEQUENCE; Schema: lv; Owner: -
--

ALTER TABLE lv.restricted_holidays ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME lv.restricted_holidays_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: rh_selections; Type: TABLE; Schema: lv; Owner: -
--

CREATE TABLE lv.rh_selections (
    id bigint NOT NULL,
    employee_id bigint NOT NULL,
    restricted_holiday_id bigint NOT NULL,
    workflow_request_id bigint NOT NULL,
    applied boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: rh_selections_id_seq; Type: SEQUENCE; Schema: lv; Owner: -
--

ALTER TABLE lv.rh_selections ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME lv.rh_selections_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: arrears; Type: TABLE; Schema: pay; Owner: -
--

CREATE TABLE pay.arrears (
    id bigint NOT NULL,
    employee_id bigint NOT NULL,
    source_salary_id bigint NOT NULL,
    for_month date NOT NULL,
    paid_in_run_id bigint,
    component_code text NOT NULL,
    amount numeric(14,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: arrears_id_seq; Type: SEQUENCE; Schema: pay; Owner: -
--

ALTER TABLE pay.arrears ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME pay.arrears_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: bank_batches; Type: TABLE; Schema: pay; Owner: -
--

CREATE TABLE pay.bank_batches (
    id bigint NOT NULL,
    run_id bigint NOT NULL,
    file_document_id bigint NOT NULL,
    total_amount numeric(16,2) NOT NULL,
    record_count integer NOT NULL,
    generated_by bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: bank_batches_id_seq; Type: SEQUENCE; Schema: pay; Owner: -
--

ALTER TABLE pay.bank_batches ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME pay.bank_batches_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: budget_categories; Type: TABLE; Schema: pay; Owner: -
--

CREATE TABLE pay.budget_categories (
    id bigint NOT NULL,
    budget_id bigint NOT NULL,
    claim_type_id bigint NOT NULL,
    allowance numeric(14,2) NOT NULL,
    CONSTRAINT budget_categories_allowance_check CHECK ((allowance >= (0)::numeric))
);


--
-- Name: budget_categories_id_seq; Type: SEQUENCE; Schema: pay; Owner: -
--

ALTER TABLE pay.budget_categories ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME pay.budget_categories_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: budgets; Type: TABLE; Schema: pay; Owner: -
--

CREATE TABLE pay.budgets (
    id bigint NOT NULL,
    reference text NOT NULL,
    title text NOT NULL,
    purpose text,
    employee_id bigint NOT NULL,
    company_id bigint NOT NULL,
    cost_center_id bigint,
    period_from date NOT NULL,
    period_to date NOT NULL,
    travel_type text,
    region text,
    from_location text,
    to_location text,
    travel_start date,
    travel_end date,
    nights smallint,
    desk_books_air boolean DEFAULT false NOT NULL,
    desk_books_hotel boolean DEFAULT false NOT NULL,
    desk_books_visa boolean DEFAULT false NOT NULL,
    own_arrangement_reason text,
    limit_exceed_reason text,
    allowance numeric(14,2) NOT NULL,
    approved_allowance numeric(14,2),
    currency text DEFAULT 'INR'::text NOT NULL,
    fx_rate_to_inr numeric(14,6) DEFAULT 1 NOT NULL,
    fx_rate_date date,
    status text DEFAULT 'draft'::text NOT NULL,
    workflow_request_id bigint,
    approved_by_user_id bigint,
    approved_at timestamp with time zone,
    rejection_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    overspend_allowed boolean DEFAULT false NOT NULL,
    CONSTRAINT budgets_allowance_positive CHECK ((allowance > (0)::numeric)),
    CONSTRAINT budgets_approval_pairs CHECK (((status <> 'approved'::text) OR ((approved_by_user_id IS NOT NULL) AND (approved_at IS NOT NULL)))),
    CONSTRAINT budgets_approved_allowance_check CHECK (((approved_allowance IS NULL) OR (approved_allowance >= (0)::numeric))),
    CONSTRAINT budgets_approved_allowance_present CHECK (((status <> 'approved'::text) OR (approved_allowance IS NOT NULL))),
    CONSTRAINT budgets_fx_rate_to_inr_check CHECK ((fx_rate_to_inr > (0)::numeric)),
    CONSTRAINT budgets_nights_check CHECK (((nights IS NULL) OR (nights >= 0))),
    CONSTRAINT budgets_period_ordered CHECK ((period_to >= period_from)),
    CONSTRAINT budgets_rejection_reasoned CHECK (((status <> 'rejected'::text) OR (length(btrim(COALESCE(rejection_reason, ''::text))) >= 3))),
    CONSTRAINT budgets_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'pending'::text, 'approved'::text, 'rejected'::text, 'closed'::text]))),
    CONSTRAINT budgets_travel_dates_ordered CHECK (((travel_start IS NULL) OR (travel_end IS NULL) OR (travel_end >= travel_start))),
    CONSTRAINT budgets_travel_type_check CHECK ((travel_type = ANY (ARRAY['domestic'::text, 'international'::text])))
);


--
-- Name: budgets_id_seq; Type: SEQUENCE; Schema: pay; Owner: -
--

ALTER TABLE pay.budgets ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME pay.budgets_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: claim_bills; Type: TABLE; Schema: pay; Owner: -
--

CREATE TABLE pay.claim_bills (
    id bigint NOT NULL,
    claim_id bigint NOT NULL,
    document_id bigint NOT NULL,
    bill_no text,
    bill_date date,
    amount numeric(14,2) NOT NULL,
    verified boolean DEFAULT false NOT NULL,
    verified_by bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: claim_bills_id_seq; Type: SEQUENCE; Schema: pay; Owner: -
--

ALTER TABLE pay.claim_bills ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME pay.claim_bills_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: claim_entitlements; Type: TABLE; Schema: pay; Owner: -
--

CREATE TABLE pay.claim_entitlements (
    id bigint NOT NULL,
    claim_type_id bigint NOT NULL,
    grade_id bigint,
    amount numeric(14,2) NOT NULL,
    effective_from date NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: claim_entitlements_id_seq; Type: SEQUENCE; Schema: pay; Owner: -
--

ALTER TABLE pay.claim_entitlements ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME pay.claim_entitlements_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: claim_lines; Type: TABLE; Schema: pay; Owner: -
--

CREATE TABLE pay.claim_lines (
    id bigint NOT NULL,
    claim_id bigint NOT NULL,
    claim_type_id bigint NOT NULL,
    description text,
    spent_on date NOT NULL,
    bill_no text,
    original_amount numeric(14,2) NOT NULL,
    original_currency text DEFAULT 'INR'::text NOT NULL,
    fx_rate_to_inr numeric(14,6) DEFAULT 1 NOT NULL,
    amount numeric(14,2) NOT NULL,
    document_path text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT claim_lines_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT claim_lines_fx_rate_to_inr_check CHECK ((fx_rate_to_inr > (0)::numeric)),
    CONSTRAINT claim_lines_original_amount_check CHECK ((original_amount > (0)::numeric))
);


--
-- Name: claim_lines_id_seq; Type: SEQUENCE; Schema: pay; Owner: -
--

ALTER TABLE pay.claim_lines ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME pay.claim_lines_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: claim_reservations; Type: TABLE; Schema: pay; Owner: -
--

CREATE TABLE pay.claim_reservations (
    id bigint NOT NULL,
    budget_id bigint NOT NULL,
    claim_id bigint NOT NULL,
    movement text NOT NULL,
    amount numeric(14,2) NOT NULL,
    by_category jsonb,
    reason text NOT NULL,
    actor_user_id bigint,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT claim_reservations_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT claim_reservations_movement_check CHECK ((movement = ANY (ARRAY['reserve'::text, 'release'::text])))
);


--
-- Name: claim_reservations_id_seq; Type: SEQUENCE; Schema: pay; Owner: -
--

ALTER TABLE pay.claim_reservations ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME pay.claim_reservations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: claim_types; Type: TABLE; Schema: pay; Owner: -
--

CREATE TABLE pay.claim_types (
    id bigint NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    requires_bill boolean DEFAULT true NOT NULL,
    is_taxable boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order smallint DEFAULT 100 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    entitlement_basis text DEFAULT 'monthly'::text NOT NULL,
    bill_required boolean DEFAULT true NOT NULL,
    taxable_if_unsubstantiated boolean DEFAULT true NOT NULL,
    payout_component_code text DEFAULT 'REIMB'::text NOT NULL
);


--
-- Name: claim_types_id_seq; Type: SEQUENCE; Schema: pay; Owner: -
--

ALTER TABLE pay.claim_types ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME pay.claim_types_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: claims; Type: TABLE; Schema: pay; Owner: -
--

CREATE TABLE pay.claims (
    id bigint NOT NULL,
    reference text,
    employee_id bigint NOT NULL,
    budget_id bigint,
    reserved_budget_id bigint,
    period_from date NOT NULL,
    period_to date NOT NULL,
    claimed_amount numeric(14,2) NOT NULL,
    approved_amount numeric(14,2),
    display_currency text DEFAULT 'INR'::text NOT NULL,
    fx_rates_to_inr jsonb,
    fx_rate_date date,
    settlement_status text DEFAULT 'unsettled'::text NOT NULL,
    settlement_mode text,
    settlement_amount numeric(14,2),
    net_payable numeric(14,2),
    settled_by_user_id bigint,
    settled_at timestamp with time zone,
    status text DEFAULT 'draft'::text NOT NULL,
    workflow_request_id bigint,
    rejection_reason text,
    submitted_at timestamp with time zone,
    decided_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    claim_type_id bigint,
    advance_loan_id bigint,
    paid_in_run_id bigint,
    paid_in_batch_id bigint,
    funding_kind text DEFAULT 'budget'::text NOT NULL,
    CONSTRAINT claims_approved_amount_check CHECK (((approved_amount IS NULL) OR (approved_amount >= (0)::numeric))),
    CONSTRAINT claims_approved_within_claimed CHECK (((approved_amount IS NULL) OR (approved_amount <= claimed_amount))),
    CONSTRAINT claims_budget_present CHECK (((funding_kind <> 'budget'::text) OR (budget_id IS NOT NULL))),
    CONSTRAINT claims_claimed_amount_check CHECK ((claimed_amount > (0)::numeric)),
    CONSTRAINT claims_funding_kind_check CHECK ((funding_kind = ANY (ARRAY['budget'::text, 'entitlement'::text]))),
    CONSTRAINT claims_period_ordered CHECK ((period_to >= period_from)),
    CONSTRAINT claims_rejection_reasoned CHECK (((status <> 'rejected'::text) OR (length(btrim(COALESCE(rejection_reason, ''::text))) >= 3))),
    CONSTRAINT claims_settled_pairs CHECK (((settlement_status <> 'settled'::text) OR ((settlement_mode IS NOT NULL) AND (settlement_amount IS NOT NULL) AND (settled_by_user_id IS NOT NULL) AND (settled_at IS NOT NULL)))),
    CONSTRAINT claims_settlement_amount_check CHECK (((settlement_amount IS NULL) OR (settlement_amount >= (0)::numeric))),
    CONSTRAINT claims_settlement_mode_check CHECK ((settlement_mode = ANY (ARRAY['AUTO'::text, 'MANUAL'::text]))),
    CONSTRAINT claims_settlement_status_check CHECK ((settlement_status = ANY (ARRAY['unsettled'::text, 'settled'::text]))),
    CONSTRAINT claims_settlement_within_claim CHECK (((settlement_amount IS NULL) OR (settlement_amount <= claimed_amount))),
    CONSTRAINT claims_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'submitted'::text, 'sent_back'::text, 'pending'::text, 'verified'::text, 'approved'::text, 'rejected'::text, 'paid'::text, 'settled'::text])))
);


--
-- Name: claims_id_seq; Type: SEQUENCE; Schema: pay; Owner: -
--

ALTER TABLE pay.claims ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME pay.claims_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: employee_salaries; Type: TABLE; Schema: pay; Owner: -
--

CREATE TABLE pay.employee_salaries (
    id bigint NOT NULL,
    employee_id bigint NOT NULL,
    structure_id bigint NOT NULL,
    effective_from date NOT NULL,
    effective_to date DEFAULT '9999-12-31'::date NOT NULL,
    annual_ctc numeric(14,2) NOT NULL,
    phase text DEFAULT 'confirmed'::text NOT NULL,
    component_amounts jsonb NOT NULL,
    probation_percent numeric(5,2),
    revision_reason text,
    approved_by bigint,
    approved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT employee_salaries_phase_check CHECK ((phase = ANY (ARRAY['probation'::text, 'confirmed'::text]))),
    CONSTRAINT employee_salaries_revision_reason_check CHECK ((revision_reason = ANY (ARRAY['joining'::text, 'annual_increment'::text, 'promotion'::text, 'confirmation'::text, 'correction'::text, 'probation_start'::text]))),
    CONSTRAINT valid_salary_dates CHECK ((effective_from < effective_to))
);


--
-- Name: employee_salaries_id_seq; Type: SEQUENCE; Schema: pay; Owner: -
--

ALTER TABLE pay.employee_salaries ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME pay.employee_salaries_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: fnf_settlements; Type: TABLE; Schema: pay; Owner: -
--

CREATE TABLE pay.fnf_settlements (
    id bigint NOT NULL,
    employee_id bigint NOT NULL,
    separation_id bigint NOT NULL,
    run_id bigint,
    last_working_day date NOT NULL,
    days_payable numeric(4,1) NOT NULL,
    leave_encash_days numeric(5,2) DEFAULT 0 NOT NULL,
    notice_recovery_days numeric(4,1) DEFAULT 0 NOT NULL,
    gratuity_amount numeric(14,2) DEFAULT 0 NOT NULL,
    other_payments numeric(14,2) DEFAULT 0 NOT NULL,
    other_deductions numeric(14,2) DEFAULT 0 NOT NULL,
    held_salary_released numeric(14,2) DEFAULT 0 NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    tat_due_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    leave_encash_amount numeric(14,2) DEFAULT 0 NOT NULL,
    notice_recovery_amount numeric(14,2) DEFAULT 0 NOT NULL,
    gross_payable numeric(14,2) DEFAULT 0 NOT NULL,
    total_deductions numeric(14,2) DEFAULT 0 NOT NULL,
    net_payable numeric(14,2) DEFAULT 0 NOT NULL,
    paid_at timestamp with time zone,
    relieving_letter_id bigint,
    service_certificate_id bigint,
    calc_breakdown jsonb,
    CONSTRAINT fnf_settlements_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'clearances_pending'::text, 'computed'::text, 'approved'::text, 'paid'::text])))
);


--
-- Name: fnf_settlements_id_seq; Type: SEQUENCE; Schema: pay; Owner: -
--

ALTER TABLE pay.fnf_settlements ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME pay.fnf_settlements_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: gl_accounts; Type: TABLE; Schema: pay; Owner: -
--

CREATE TABLE pay.gl_accounts (
    id bigint NOT NULL,
    company_code text NOT NULL,
    plant_code text NOT NULL,
    cost_center_code text NOT NULL,
    component_code text NOT NULL,
    gl_code text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT gl_accounts_gl_code_check CHECK ((length(btrim(gl_code)) > 0))
);


--
-- Name: gl_accounts_id_seq; Type: SEQUENCE; Schema: pay; Owner: -
--

ALTER TABLE pay.gl_accounts ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME pay.gl_accounts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: inputs; Type: TABLE; Schema: pay; Owner: -
--

CREATE TABLE pay.inputs (
    id bigint NOT NULL,
    run_id bigint NOT NULL,
    employee_id bigint NOT NULL,
    component_code text NOT NULL,
    amount numeric(14,2) NOT NULL,
    note text NOT NULL,
    entered_by bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: inputs_id_seq; Type: SEQUENCE; Schema: pay; Owner: -
--

ALTER TABLE pay.inputs ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME pay.inputs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: investment_declarations; Type: TABLE; Schema: pay; Owner: -
--

CREATE TABLE pay.investment_declarations (
    id bigint NOT NULL,
    employee_id bigint NOT NULL,
    fy text NOT NULL,
    section text NOT NULL,
    declared_amount numeric(14,2) NOT NULL,
    proof_document_id bigint,
    verified_amount numeric(14,2),
    verified_by bigint,
    verified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: investment_declarations_id_seq; Type: SEQUENCE; Schema: pay; Owner: -
--

ALTER TABLE pay.investment_declarations ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME pay.investment_declarations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: it_slabs; Type: TABLE; Schema: pay; Owner: -
--

CREATE TABLE pay.it_slabs (
    id bigint NOT NULL,
    fy text NOT NULL,
    regime text NOT NULL,
    slab_from numeric(14,2) NOT NULL,
    slab_to numeric(14,2),
    rate numeric(6,4) NOT NULL,
    surcharge_rules jsonb,
    cess_rate numeric(6,4) DEFAULT 0.04 NOT NULL,
    standard_deduction numeric(14,2) NOT NULL,
    rebate_87a jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT it_slabs_regime_check CHECK ((regime = ANY (ARRAY['old'::text, 'new'::text])))
);


--
-- Name: it_slabs_id_seq; Type: SEQUENCE; Schema: pay; Owner: -
--

ALTER TABLE pay.it_slabs ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME pay.it_slabs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: loan_postings; Type: TABLE; Schema: pay; Owner: -
--

CREATE TABLE pay.loan_postings (
    id bigint NOT NULL,
    loan_id bigint NOT NULL,
    run_id bigint NOT NULL,
    principal_part numeric(14,2) NOT NULL,
    interest_part numeric(14,2) NOT NULL,
    perquisite_value numeric(14,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: loan_postings_id_seq; Type: SEQUENCE; Schema: pay; Owner: -
--

ALTER TABLE pay.loan_postings ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME pay.loan_postings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: loans; Type: TABLE; Schema: pay; Owner: -
--

CREATE TABLE pay.loans (
    id bigint NOT NULL,
    employee_id bigint NOT NULL,
    loan_type text NOT NULL,
    principal numeric(14,2) NOT NULL,
    interest_rate numeric(6,3) DEFAULT 0 NOT NULL,
    emi numeric(14,2) NOT NULL,
    start_month date NOT NULL,
    tenure_months smallint NOT NULL,
    outstanding numeric(14,2) NOT NULL,
    perquisite_applicable boolean DEFAULT false NOT NULL,
    source text DEFAULT 'hrms'::text NOT NULL,
    workflow_request_id bigint,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT loans_loan_type_check CHECK ((loan_type = ANY (ARRAY['loan_diminishing'::text, 'loan_flat'::text, 'emi_no_interest'::text, 'salary_advance'::text, 'travel_advance'::text]))),
    CONSTRAINT loans_source_check CHECK ((source = ANY (ARRAY['hrms'::text, 'sap_legacy'::text]))),
    CONSTRAINT loans_status_check CHECK ((status = ANY (ARRAY['active'::text, 'closed'::text, 'written_off'::text])))
);


--
-- Name: loans_id_seq; Type: SEQUENCE; Schema: pay; Owner: -
--

ALTER TABLE pay.loans ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME pay.loans_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: payroll_item_lines; Type: TABLE; Schema: pay; Owner: -
--

CREATE TABLE pay.payroll_item_lines (
    id bigint NOT NULL,
    item_id bigint NOT NULL,
    component_code text NOT NULL,
    amount numeric(14,2) NOT NULL,
    calc_note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: payroll_item_lines_id_seq; Type: SEQUENCE; Schema: pay; Owner: -
--

ALTER TABLE pay.payroll_item_lines ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME pay.payroll_item_lines_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: payroll_items; Type: TABLE; Schema: pay; Owner: -
--

CREATE TABLE pay.payroll_items (
    id bigint NOT NULL,
    run_id bigint NOT NULL,
    employee_id bigint NOT NULL,
    days_in_month numeric(4,1) NOT NULL,
    payable_days numeric(4,1) NOT NULL,
    lop_days numeric(4,1) DEFAULT 0 NOT NULL,
    lop_reversal_days numeric(4,1) DEFAULT 0 NOT NULL,
    ot_minutes integer DEFAULT 0 NOT NULL,
    gross numeric(14,2) NOT NULL,
    total_deductions numeric(14,2) NOT NULL,
    net_pay numeric(14,2) NOT NULL,
    payment_status text DEFAULT 'payable'::text NOT NULL,
    payslip_document_id bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payroll_items_payment_status_check CHECK ((payment_status = ANY (ARRAY['payable'::text, 'hold_payment'::text, 'hold_process'::text])))
);


--
-- Name: payroll_items_id_seq; Type: SEQUENCE; Schema: pay; Owner: -
--

ALTER TABLE pay.payroll_items ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME pay.payroll_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: payroll_runs; Type: TABLE; Schema: pay; Owner: -
--

CREATE TABLE pay.payroll_runs (
    id bigint NOT NULL,
    company_id bigint NOT NULL,
    month date NOT NULL,
    run_type text DEFAULT 'regular'::text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    attendance_lock_id bigint,
    computed_at timestamp with time zone,
    approved_at timestamp with time zone,
    approved_by bigint,
    finalized_at timestamp with time zone,
    finalized_by bigint,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT check_attendance_lock_when_computed CHECK (((status = ANY (ARRAY['draft'::text, 'inputs_locked'::text])) OR (attendance_lock_id IS NOT NULL))),
    CONSTRAINT payroll_runs_run_type_check CHECK ((run_type = ANY (ARRAY['regular'::text, 'off_cycle'::text, 'fnf'::text, 'bonus'::text, 'arrears'::text]))),
    CONSTRAINT payroll_runs_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'inputs_locked'::text, 'computed'::text, 'under_review'::text, 'approved'::text, 'finalized'::text, 'reopened'::text, 'paid'::text])))
);


--
-- Name: payroll_runs_id_seq; Type: SEQUENCE; Schema: pay; Owner: -
--

ALTER TABLE pay.payroll_runs ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME pay.payroll_runs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: pt_slabs; Type: TABLE; Schema: pay; Owner: -
--

CREATE TABLE pay.pt_slabs (
    id bigint NOT NULL,
    state_code text NOT NULL,
    min_monthly numeric(14,2) NOT NULL,
    max_monthly numeric(14,2),
    amount numeric(8,2) NOT NULL,
    effective_from date NOT NULL
);


--
-- Name: pt_slabs_id_seq; Type: SEQUENCE; Schema: pay; Owner: -
--

ALTER TABLE pay.pt_slabs ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME pay.pt_slabs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: salary_components; Type: TABLE; Schema: pay; Owner: -
--

CREATE TABLE pay.salary_components (
    code text NOT NULL,
    name text NOT NULL,
    kind text NOT NULL,
    formula text,
    rounding text DEFAULT 'round'::text NOT NULL,
    taxable boolean DEFAULT true NOT NULL,
    part_of_gross boolean DEFAULT true NOT NULL,
    part_of_pf_wages boolean DEFAULT false NOT NULL,
    prorate_on_lop boolean DEFAULT true NOT NULL,
    display_order smallint NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT salary_components_kind_check CHECK ((kind = ANY (ARRAY['earning'::text, 'deduction'::text, 'employer_contribution'::text]))),
    CONSTRAINT salary_components_rounding_check CHECK ((rounding = ANY (ARRAY['round'::text, 'floor'::text, 'ceil'::text, 'nearest_10'::text])))
);


--
-- Name: salary_holds; Type: TABLE; Schema: pay; Owner: -
--

CREATE TABLE pay.salary_holds (
    id bigint NOT NULL,
    employee_id bigint NOT NULL,
    hold_type text NOT NULL,
    reason text NOT NULL,
    start_month date NOT NULL,
    released_month date,
    created_by bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT salary_holds_hold_type_check CHECK ((hold_type = ANY (ARRAY['payment'::text, 'process'::text])))
);


--
-- Name: salary_holds_id_seq; Type: SEQUENCE; Schema: pay; Owner: -
--

ALTER TABLE pay.salary_holds ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME pay.salary_holds_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: salary_structures; Type: TABLE; Schema: pay; Owner: -
--

CREATE TABLE pay.salary_structures (
    id bigint NOT NULL,
    name text NOT NULL,
    company_id bigint NOT NULL,
    description text,
    components jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: salary_structures_id_seq; Type: SEQUENCE; Schema: pay; Owner: -
--

ALTER TABLE pay.salary_structures ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME pay.salary_structures_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: statutory_rates; Type: TABLE; Schema: pay; Owner: -
--

CREATE TABLE pay.statutory_rates (
    id bigint NOT NULL,
    scheme text NOT NULL,
    param text NOT NULL,
    value numeric(14,4) NOT NULL,
    effective_from date NOT NULL,
    source_note text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: statutory_rates_id_seq; Type: SEQUENCE; Schema: pay; Owner: -
--

ALTER TABLE pay.statutory_rates ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME pay.statutory_rates_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: tds_challans; Type: TABLE; Schema: pay; Owner: -
--

CREATE TABLE pay.tds_challans (
    id bigint NOT NULL,
    company_id bigint NOT NULL,
    month date NOT NULL,
    amount numeric(14,2) NOT NULL,
    challan_no text NOT NULL,
    bsr_code text,
    paid_on date NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tds_challans_id_seq; Type: SEQUENCE; Schema: pay; Owner: -
--

ALTER TABLE pay.tds_challans ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME pay.tds_challans_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: breach_register; Type: TABLE; Schema: prv; Owner: -
--

CREATE TABLE prv.breach_register (
    id bigint NOT NULL,
    discovered_at timestamp with time zone DEFAULT now() NOT NULL,
    summary text NOT NULL,
    notified_board_at timestamp with time zone,
    notified_principals_at timestamp with time zone,
    recorded_by bigint NOT NULL
);


--
-- Name: breach_register_id_seq; Type: SEQUENCE; Schema: prv; Owner: -
--

ALTER TABLE prv.breach_register ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME prv.breach_register_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: consent_events; Type: TABLE; Schema: prv; Owner: -
--

CREATE TABLE prv.consent_events (
    id bigint NOT NULL,
    employee_id bigint NOT NULL,
    purpose text NOT NULL,
    action text NOT NULL,
    actor_user_id bigint NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT consent_events_action_check CHECK ((action = ANY (ARRAY['grant'::text, 'withdraw'::text])))
);


--
-- Name: consent_events_id_seq; Type: SEQUENCE; Schema: prv; Owner: -
--

ALTER TABLE prv.consent_events ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME prv.consent_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: consents; Type: TABLE; Schema: prv; Owner: -
--

CREATE TABLE prv.consents (
    id bigint NOT NULL,
    employee_id bigint NOT NULL,
    purpose text NOT NULL,
    granted boolean NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT consents_purpose_check CHECK ((purpose = ANY (ARRAY['photograph'::text, 'wellness'::text, 'bgv'::text, 'family'::text, 'alumni'::text])))
);


--
-- Name: consents_id_seq; Type: SEQUENCE; Schema: prv; Owner: -
--

ALTER TABLE prv.consents ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME prv.consents_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: legal_holds; Type: TABLE; Schema: prv; Owner: -
--

CREATE TABLE prv.legal_holds (
    id bigint NOT NULL,
    employee_id bigint NOT NULL,
    data_class text,
    reason text NOT NULL,
    placed_by bigint NOT NULL,
    released_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: legal_holds_id_seq; Type: SEQUENCE; Schema: prv; Owner: -
--

ALTER TABLE prv.legal_holds ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME prv.legal_holds_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: notice_acks; Type: TABLE; Schema: prv; Owner: -
--

CREATE TABLE prv.notice_acks (
    id bigint NOT NULL,
    notice_id bigint NOT NULL,
    user_id bigint NOT NULL,
    acknowledged_at timestamp with time zone DEFAULT now() NOT NULL,
    ip text
);


--
-- Name: notice_acks_id_seq; Type: SEQUENCE; Schema: prv; Owner: -
--

ALTER TABLE prv.notice_acks ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME prv.notice_acks_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: notices; Type: TABLE; Schema: prv; Owner: -
--

CREATE TABLE prv.notices (
    id bigint NOT NULL,
    version integer NOT NULL,
    principal_class text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    effective_from timestamp with time zone DEFAULT now() NOT NULL,
    is_current boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notices_principal_class_check CHECK ((principal_class = ANY (ARRAY['employee'::text, 'candidate'::text, 'contractor_worker'::text, 'dependant'::text])))
);


--
-- Name: notices_id_seq; Type: SEQUENCE; Schema: prv; Owner: -
--

ALTER TABLE prv.notices ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME prv.notices_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: processing_register; Type: TABLE; Schema: prv; Owner: -
--

CREATE TABLE prv.processing_register (
    id bigint NOT NULL,
    data_class text NOT NULL,
    purpose text NOT NULL,
    lawful_basis text NOT NULL,
    retention_days integer NOT NULL,
    recipients text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT processing_register_lawful_basis_check CHECK ((lawful_basis = ANY (ARRAY['employment'::text, 'consent'::text, 'legal_obligation'::text]))),
    CONSTRAINT processing_register_retention_days_check CHECK ((retention_days > 0))
);


--
-- Name: processing_register_id_seq; Type: SEQUENCE; Schema: prv; Owner: -
--

ALTER TABLE prv.processing_register ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME prv.processing_register_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: processors; Type: TABLE; Schema: prv; Owner: -
--

CREATE TABLE prv.processors (
    id bigint NOT NULL,
    name text NOT NULL,
    purpose text NOT NULL,
    dpa_status text NOT NULL,
    dpa_expires_on date,
    owner_email text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT processors_dpa_status_check CHECK ((dpa_status = ANY (ARRAY['active'::text, 'expired'::text, 'missing'::text])))
);


--
-- Name: processors_id_seq; Type: SEQUENCE; Schema: prv; Owner: -
--

ALTER TABLE prv.processors ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME prv.processors_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: purge_log; Type: TABLE; Schema: prv; Owner: -
--

CREATE TABLE prv.purge_log (
    id bigint NOT NULL,
    proposal_id bigint NOT NULL,
    data_class text NOT NULL,
    row_count integer NOT NULL,
    rule text NOT NULL,
    executed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: purge_log_id_seq; Type: SEQUENCE; Schema: prv; Owner: -
--

ALTER TABLE prv.purge_log ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME prv.purge_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: purge_proposals; Type: TABLE; Schema: prv; Owner: -
--

CREATE TABLE prv.purge_proposals (
    id bigint NOT NULL,
    data_class text NOT NULL,
    row_count integer NOT NULL,
    excluded_holds integer DEFAULT 0 NOT NULL,
    proposed_by bigint NOT NULL,
    proposed_at timestamp with time zone DEFAULT now() NOT NULL,
    confirmed_by bigint,
    confirmed_at timestamp with time zone,
    CONSTRAINT purge_proposals_check CHECK (((confirmed_by IS NULL) OR (confirmed_by <> proposed_by))),
    CONSTRAINT purge_proposals_row_count_check CHECK ((row_count >= 0))
);


--
-- Name: purge_proposals_id_seq; Type: SEQUENCE; Schema: prv; Owner: -
--

ALTER TABLE prv.purge_proposals ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME prv.purge_proposals_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: retention_rules; Type: TABLE; Schema: prv; Owner: -
--

CREATE TABLE prv.retention_rules (
    id bigint NOT NULL,
    data_class text NOT NULL,
    retention_days integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT retention_rules_retention_days_check CHECK ((retention_days > 0))
);


--
-- Name: retention_rules_id_seq; Type: SEQUENCE; Schema: prv; Owner: -
--

ALTER TABLE prv.retention_rules ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME prv.retention_rules_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: rights_requests; Type: TABLE; Schema: prv; Owner: -
--

CREATE TABLE prv.rights_requests (
    id bigint NOT NULL,
    employee_id bigint NOT NULL,
    kind text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    reason text,
    refusal_reason text,
    workflow_request_id bigint,
    due_at timestamp with time zone NOT NULL,
    closed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT rights_requests_kind_check CHECK ((kind = ANY (ARRAY['access'::text, 'correction'::text, 'erasure'::text]))),
    CONSTRAINT rights_requests_status_check CHECK ((status = ANY (ARRAY['open'::text, 'in_progress'::text, 'fulfilled'::text, 'refused'::text])))
);


--
-- Name: rights_requests_id_seq; Type: SEQUENCE; Schema: prv; Owner: -
--

ALTER TABLE prv.rights_requests ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME prv.rights_requests_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: pgmigrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pgmigrations (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    run_on timestamp without time zone NOT NULL
);


--
-- Name: pgmigrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pgmigrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pgmigrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pgmigrations_id_seq OWNED BY public.pgmigrations.id;


--
-- Name: kpi_daily; Type: TABLE; Schema: reporting; Owner: -
--

CREATE TABLE reporting.kpi_daily (
    id bigint NOT NULL,
    snapshot_date date NOT NULL,
    company_id bigint,
    category text DEFAULT 'total'::text NOT NULL,
    metric text NOT NULL,
    value numeric(18,4),
    unavailable_reason text,
    computed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE kpi_daily; Type: COMMENT; Schema: reporting; Owner: -
--

COMMENT ON TABLE reporting.kpi_daily IS 'RPT-03 nightly KPI snapshot; NULL value = not computable (reason in unavailable_reason)';


--
-- Name: kpi_daily_id_seq; Type: SEQUENCE; Schema: reporting; Owner: -
--

ALTER TABLE reporting.kpi_daily ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME reporting.kpi_daily_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: muster_month; Type: TABLE; Schema: reporting; Owner: -
--

CREATE TABLE reporting.muster_month (
    id bigint NOT NULL,
    company_id bigint NOT NULL,
    month date NOT NULL,
    employee_id bigint NOT NULL,
    ecode text NOT NULL,
    employee_name text NOT NULL,
    reporting_manager text,
    functional_manager text,
    department text,
    designation text,
    org_unit text,
    cost_center text,
    contact text,
    category text,
    day_statuses jsonb DEFAULT '{}'::jsonb NOT NULL,
    present smallint DEFAULT 0 NOT NULL,
    absent smallint DEFAULT 0 NOT NULL,
    half_days smallint DEFAULT 0 NOT NULL,
    weekoffs smallint DEFAULT 0 NOT NULL,
    weekoffs_unpaid smallint DEFAULT 0 NOT NULL,
    holidays smallint DEFAULT 0 NOT NULL,
    leave_days numeric(5,1) DEFAULT 0 NOT NULL,
    od_days smallint DEFAULT 0 NOT NULL,
    co_days smallint DEFAULT 0 NOT NULL,
    uab_days smallint DEFAULT 0 NOT NULL,
    lop_days numeric(5,1) DEFAULT 0 NOT NULL,
    ot_hours numeric(8,2) DEFAULT 0 NOT NULL,
    built_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: muster_month_id_seq; Type: SEQUENCE; Schema: reporting; Owner: -
--

ALTER TABLE reporting.muster_month ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME reporting.muster_month_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: access_events; Type: TABLE; Schema: sec; Owner: -
--

CREATE TABLE sec.access_events (
    id bigint NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    actor_user_id bigint NOT NULL,
    session_sid uuid,
    subject_employee_id bigint,
    resource text NOT NULL,
    field_class text NOT NULL,
    purpose text NOT NULL,
    record_count integer DEFAULT 1 NOT NULL,
    ip inet,
    CONSTRAINT access_events_count_positive CHECK ((record_count > 0)),
    CONSTRAINT access_events_purpose_stated CHECK ((length(btrim(purpose)) >= 3))
)
PARTITION BY RANGE (occurred_at);


--
-- Name: access_events_202610; Type: TABLE; Schema: sec; Owner: -
--

CREATE TABLE sec.access_events_202610 (
    id bigint NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    actor_user_id bigint NOT NULL,
    session_sid uuid,
    subject_employee_id bigint,
    resource text NOT NULL,
    field_class text NOT NULL,
    purpose text NOT NULL,
    record_count integer DEFAULT 1 NOT NULL,
    ip inet,
    CONSTRAINT access_events_count_positive CHECK ((record_count > 0)),
    CONSTRAINT access_events_purpose_stated CHECK ((length(btrim(purpose)) >= 3))
);


--
-- Name: access_events_202611; Type: TABLE; Schema: sec; Owner: -
--

CREATE TABLE sec.access_events_202611 (
    id bigint NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    actor_user_id bigint NOT NULL,
    session_sid uuid,
    subject_employee_id bigint,
    resource text NOT NULL,
    field_class text NOT NULL,
    purpose text NOT NULL,
    record_count integer DEFAULT 1 NOT NULL,
    ip inet,
    CONSTRAINT access_events_count_positive CHECK ((record_count > 0)),
    CONSTRAINT access_events_purpose_stated CHECK ((length(btrim(purpose)) >= 3))
);


--
-- Name: access_events_id_seq; Type: SEQUENCE; Schema: sec; Owner: -
--

ALTER TABLE sec.access_events ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME sec.access_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: mfa_enrolments; Type: TABLE; Schema: sec; Owner: -
--

CREATE TABLE sec.mfa_enrolments (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    secret text NOT NULL,
    confirmed_at timestamp with time zone,
    disabled_at timestamp with time zone,
    disabled_by_user_id bigint,
    last_used_step bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: mfa_enrolments_id_seq; Type: SEQUENCE; Schema: sec; Owner: -
--

ALTER TABLE sec.mfa_enrolments ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME sec.mfa_enrolments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: mfa_recovery_codes; Type: TABLE; Schema: sec; Owner: -
--

CREATE TABLE sec.mfa_recovery_codes (
    id bigint NOT NULL,
    enrolment_id bigint NOT NULL,
    code_hash text NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: mfa_recovery_codes_id_seq; Type: SEQUENCE; Schema: sec; Owner: -
--

ALTER TABLE sec.mfa_recovery_codes ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME sec.mfa_recovery_codes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: password_history; Type: TABLE; Schema: sec; Owner: -
--

CREATE TABLE sec.password_history (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    password_hash text NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    changed_by_user_id bigint
);


--
-- Name: password_history_id_seq; Type: SEQUENCE; Schema: sec; Owner: -
--

ALTER TABLE sec.password_history ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME sec.password_history_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: sessions; Type: TABLE; Schema: sec; Owner: -
--

CREATE TABLE sec.sessions (
    id bigint NOT NULL,
    sid uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    revoked_by_user_id bigint,
    revoke_reason text,
    ip inet,
    user_agent text,
    device_label text,
    stepped_up_at timestamp with time zone,
    stepped_up_until timestamp with time zone,
    refresh_token_hash text,
    CONSTRAINT sessions_expiry_after_start CHECK ((expires_at > created_at)),
    CONSTRAINT sessions_refresh_token_hash_check CHECK ((refresh_token_hash ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT sessions_revoke_pairs CHECK ((((revoked_at IS NULL) AND (revoke_reason IS NULL)) OR ((revoked_at IS NOT NULL) AND (revoke_reason IS NOT NULL)))),
    CONSTRAINT sessions_stepup_pairs CHECK ((((stepped_up_at IS NULL) AND (stepped_up_until IS NULL)) OR ((stepped_up_at IS NOT NULL) AND (stepped_up_until IS NOT NULL) AND (stepped_up_until > stepped_up_at))))
);


--
-- Name: sessions_id_seq; Type: SEQUENCE; Schema: sec; Owner: -
--

ALTER TABLE sec.sessions ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME sec.sessions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: advances; Type: TABLE; Schema: te; Owner: -
--

CREATE TABLE te.advances (
    id bigint NOT NULL,
    trip_id bigint NOT NULL,
    employee_id bigint NOT NULL,
    amount_paise bigint NOT NULL,
    purpose text NOT NULL,
    status text DEFAULT 'requested'::text NOT NULL,
    workflow_request_id bigint,
    disbursed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT advances_amount_paise_check CHECK ((amount_paise > 0)),
    CONSTRAINT advances_status_check CHECK ((status = ANY (ARRAY['requested'::text, 'approved'::text, 'rejected'::text, 'sent_back'::text, 'disbursed'::text, 'cancelled'::text])))
);


--
-- Name: advances_id_seq; Type: SEQUENCE; Schema: te; Owner: -
--

ALTER TABLE te.advances ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME te.advances_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: budgets; Type: TABLE; Schema: te; Owner: -
--

CREATE TABLE te.budgets (
    id bigint NOT NULL,
    grade_level text NOT NULL,
    travel_type text NOT NULL,
    flight_class text DEFAULT 'economy'::text NOT NULL,
    hotel_per_night_paise bigint DEFAULT 400000 NOT NULL,
    daily_allowance_paise bigint DEFAULT 150000 NOT NULL,
    local_conveyance_paise bigint DEFAULT 100000 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    CONSTRAINT budgets_travel_type_check CHECK ((travel_type = ANY (ARRAY['domestic'::text, 'international'::text])))
);


--
-- Name: budgets_id_seq; Type: SEQUENCE; Schema: te; Owner: -
--

ALTER TABLE te.budgets ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME te.budgets_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: claim_items; Type: TABLE; Schema: te; Owner: -
--

CREATE TABLE te.claim_items (
    id bigint NOT NULL,
    claim_id bigint NOT NULL,
    category text NOT NULL,
    item_date date NOT NULL,
    amount_paise bigint NOT NULL,
    currency text DEFAULT 'INR'::text NOT NULL,
    fx_rate_to_inr numeric(10,4) DEFAULT 1.0000 NOT NULL,
    inr_amount_paise bigint NOT NULL,
    receipt_document_id bigint,
    receipt_url text,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT claim_items_category_check CHECK ((category = ANY (ARRAY['flight'::text, 'train'::text, 'bus'::text, 'hotel'::text, 'daily_allowance'::text, 'local_travel'::text, 'visa'::text, 'food'::text, 'misc'::text])))
);


--
-- Name: claim_items_id_seq; Type: SEQUENCE; Schema: te; Owner: -
--

ALTER TABLE te.claim_items ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME te.claim_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: claims; Type: TABLE; Schema: te; Owner: -
--

CREATE TABLE te.claims (
    id bigint NOT NULL,
    reference_no text NOT NULL,
    trip_id bigint NOT NULL,
    employee_id bigint NOT NULL,
    total_claimed_paise bigint DEFAULT 0 NOT NULL,
    approved_amount_paise bigint DEFAULT 0 NOT NULL,
    advance_adjusted_paise bigint DEFAULT 0 NOT NULL,
    net_payable_paise bigint DEFAULT 0 NOT NULL,
    net_recoverable_paise bigint DEFAULT 0 NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    settlement_status text DEFAULT 'unsettled'::text NOT NULL,
    workflow_request_id bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT claims_settlement_status_check CHECK ((settlement_status = ANY (ARRAY['unsettled'::text, 'settled'::text]))),
    CONSTRAINT claims_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'submitted'::text, 'approved'::text, 'rejected'::text, 'sent_back'::text, 'settled'::text])))
);


--
-- Name: claims_id_seq; Type: SEQUENCE; Schema: te; Owner: -
--

ALTER TABLE te.claims ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME te.claims_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: settlements; Type: TABLE; Schema: te; Owner: -
--

CREATE TABLE te.settlements (
    id bigint NOT NULL,
    claim_id bigint NOT NULL,
    trip_id bigint NOT NULL,
    employee_id bigint NOT NULL,
    settlement_mode text DEFAULT 'AUTO'::text NOT NULL,
    claimed_amount_paise bigint NOT NULL,
    advance_amount_paise bigint NOT NULL,
    net_payable_paise bigint DEFAULT 0 NOT NULL,
    net_recoverable_paise bigint DEFAULT 0 NOT NULL,
    recovery_channel text DEFAULT 'payroll_deduction'::text,
    settled_by bigint,
    settled_at timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'settled'::text NOT NULL,
    CONSTRAINT settlements_recovery_channel_check CHECK ((recovery_channel = ANY (ARRAY['payroll_deduction'::text, 'wallet_carry_forward'::text, 'direct_refund'::text]))),
    CONSTRAINT settlements_settlement_mode_check CHECK ((settlement_mode = ANY (ARRAY['AUTO'::text, 'MANUAL'::text]))),
    CONSTRAINT settlements_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'settled'::text, 'payroll_posted'::text])))
);


--
-- Name: settlements_id_seq; Type: SEQUENCE; Schema: te; Owner: -
--

ALTER TABLE te.settlements ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME te.settlements_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: trip_itineraries; Type: TABLE; Schema: te; Owner: -
--

CREATE TABLE te.trip_itineraries (
    id bigint NOT NULL,
    trip_id bigint NOT NULL,
    segment_type text NOT NULL,
    origin text NOT NULL,
    destination text NOT NULL,
    departure_date timestamp with time zone NOT NULL,
    arrival_date timestamp with time zone,
    provider text,
    booking_reference text,
    estimated_cost_paise bigint DEFAULT 0 NOT NULL,
    actual_cost_paise bigint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT trip_itineraries_segment_type_check CHECK ((segment_type = ANY (ARRAY['flight'::text, 'train'::text, 'bus'::text, 'hotel'::text, 'car'::text, 'other'::text])))
);


--
-- Name: trip_itineraries_id_seq; Type: SEQUENCE; Schema: te; Owner: -
--

ALTER TABLE te.trip_itineraries ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME te.trip_itineraries_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: trips; Type: TABLE; Schema: te; Owner: -
--

CREATE TABLE te.trips (
    id bigint NOT NULL,
    reference_no text NOT NULL,
    employee_id bigint NOT NULL,
    company_id bigint NOT NULL,
    trip_name text NOT NULL,
    travel_type text NOT NULL,
    purpose text NOT NULL,
    destination_country text DEFAULT 'India'::text NOT NULL,
    destination_city text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    visa_required boolean DEFAULT false NOT NULL,
    visa_status text DEFAULT 'not_applicable'::text,
    status text DEFAULT 'draft'::text NOT NULL,
    estimated_budget_paise bigint DEFAULT 0 NOT NULL,
    approved_budget_paise bigint DEFAULT 0 NOT NULL,
    cancellation_reason text,
    cancellation_cost_paise bigint DEFAULT 0,
    workflow_request_id bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT trips_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'submitted'::text, 'approved'::text, 'rejected'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text]))),
    CONSTRAINT trips_travel_type_check CHECK ((travel_type = ANY (ARRAY['domestic'::text, 'international'::text]))),
    CONSTRAINT trips_visa_status_check CHECK ((visa_status = ANY (ARRAY['not_applicable'::text, 'applied'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: trips_id_seq; Type: SEQUENCE; Schema: te; Owner: -
--

ALTER TABLE te.trips ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME te.trips_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: wallet_transactions; Type: TABLE; Schema: te; Owner: -
--

CREATE TABLE te.wallet_transactions (
    id bigint NOT NULL,
    wallet_id bigint NOT NULL,
    employee_id bigint NOT NULL,
    trip_id bigint,
    source text NOT NULL,
    type text NOT NULL,
    amount_paise bigint NOT NULL,
    balance_after_paise bigint NOT NULL,
    transaction_reference text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT wallet_transactions_amount_paise_check CHECK ((amount_paise > 0)),
    CONSTRAINT wallet_transactions_balance_after_paise_check CHECK ((balance_after_paise >= 0)),
    CONSTRAINT wallet_transactions_source_check CHECK ((source = ANY (ARRAY['ADVANCE'::text, 'CLAIM_SETTLEMENT'::text, 'RECOVERY'::text, 'ADJUSTMENT'::text]))),
    CONSTRAINT wallet_transactions_type_check CHECK ((type = ANY (ARRAY['credit'::text, 'debit'::text])))
);


--
-- Name: wallet_transactions_id_seq; Type: SEQUENCE; Schema: te; Owner: -
--

ALTER TABLE te.wallet_transactions ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME te.wallet_transactions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: wallets; Type: TABLE; Schema: te; Owner: -
--

CREATE TABLE te.wallets (
    id bigint NOT NULL,
    employee_id bigint NOT NULL,
    balance_paise bigint DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT wallets_balance_paise_check CHECK ((balance_paise >= 0))
);


--
-- Name: wallets_id_seq; Type: SEQUENCE; Schema: te; Owner: -
--

ALTER TABLE te.wallets ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME te.wallets_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: definitions; Type: TABLE; Schema: wf; Owner: -
--

CREATE TABLE wf.definitions (
    code text NOT NULL,
    name text NOT NULL,
    steps jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: delegations; Type: TABLE; Schema: wf; Owner: -
--

CREATE TABLE wf.delegations (
    id bigint NOT NULL,
    from_user_id bigint NOT NULL,
    to_user_id bigint NOT NULL,
    from_date date NOT NULL,
    to_date date NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT delegations_check CHECK ((from_date <= to_date)),
    CONSTRAINT delegations_check1 CHECK ((from_user_id <> to_user_id))
);


--
-- Name: delegations_id_seq; Type: SEQUENCE; Schema: wf; Owner: -
--

ALTER TABLE wf.delegations ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME wf.delegations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: event_subscriptions; Type: TABLE; Schema: wf; Owner: -
--

CREATE TABLE wf.event_subscriptions (
    id bigint NOT NULL,
    event_code text NOT NULL,
    recipient_kind text NOT NULL,
    recipient_ref text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT event_subscriptions_recipient_kind_check CHECK ((recipient_kind = ANY (ARRAY['role'::text, 'user'::text, 'email'::text])))
);


--
-- Name: event_subscriptions_id_seq; Type: SEQUENCE; Schema: wf; Owner: -
--

ALTER TABLE wf.event_subscriptions ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME wf.event_subscriptions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: notifications; Type: TABLE; Schema: wf; Owner: -
--

CREATE TABLE wf.notifications (
    id bigint NOT NULL,
    recipient_user_id bigint,
    recipient_email text,
    channel text NOT NULL,
    template_code text NOT NULL,
    payload jsonb NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    attempts smallint DEFAULT 0 NOT NULL,
    last_error text,
    sent_at timestamp with time zone,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notifications_channel_check CHECK ((channel = ANY (ARRAY['in_app'::text, 'email'::text]))),
    CONSTRAINT notifications_check CHECK (((recipient_user_id IS NOT NULL) OR (recipient_email IS NOT NULL))),
    CONSTRAINT notifications_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'sent'::text, 'failed'::text, 'dead'::text])))
);


--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: wf; Owner: -
--

ALTER TABLE wf.notifications ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME wf.notifications_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: request_steps; Type: TABLE; Schema: wf; Owner: -
--

CREATE TABLE wf.request_steps (
    id bigint NOT NULL,
    request_id bigint NOT NULL,
    step_no smallint NOT NULL,
    approver_user_id bigint NOT NULL,
    delegated_from bigint,
    action text,
    comment text,
    notified_at timestamp with time zone NOT NULL,
    acted_at timestamp with time zone,
    sla_due_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    approver_spec text,
    CONSTRAINT request_steps_action_check CHECK ((action = ANY (ARRAY['approved'::text, 'rejected'::text, 'sent_back'::text, 'escalated'::text, 'skipped'::text])))
);


--
-- Name: request_steps_id_seq; Type: SEQUENCE; Schema: wf; Owner: -
--

ALTER TABLE wf.request_steps ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME wf.request_steps_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: requests; Type: TABLE; Schema: wf; Owner: -
--

CREATE TABLE wf.requests (
    id bigint NOT NULL,
    definition_code text NOT NULL,
    subject_employee_id bigint NOT NULL,
    requested_by bigint NOT NULL,
    payload jsonb NOT NULL,
    current_step smallint DEFAULT 1 NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    decided_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text, 'lapsed'::text, 'sent_back'::text])))
);


--
-- Name: requests_id_seq; Type: SEQUENCE; Schema: wf; Owner: -
--

ALTER TABLE wf.requests ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME wf.requests_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: swipe_events_202610; Type: TABLE ATTACH; Schema: att; Owner: -
--

ALTER TABLE ONLY att.swipe_events ATTACH PARTITION att.swipe_events_202610 FOR VALUES FROM ('2026-10-01 00:00:00+00') TO ('2026-11-01 00:00:00+00');


--
-- Name: swipe_events_202611; Type: TABLE ATTACH; Schema: att; Owner: -
--

ALTER TABLE ONLY att.swipe_events ATTACH PARTITION att.swipe_events_202611 FOR VALUES FROM ('2026-11-01 00:00:00+00') TO ('2026-12-01 00:00:00+00');


--
-- Name: access_events_202610; Type: TABLE ATTACH; Schema: sec; Owner: -
--

ALTER TABLE ONLY sec.access_events ATTACH PARTITION sec.access_events_202610 FOR VALUES FROM ('2026-10-01 00:00:00+00') TO ('2026-11-01 00:00:00+00');


--
-- Name: access_events_202611; Type: TABLE ATTACH; Schema: sec; Owner: -
--

ALTER TABLE ONLY sec.access_events ATTACH PARTITION sec.access_events_202611 FOR VALUES FROM ('2026-11-01 00:00:00+00') TO ('2026-12-01 00:00:00+00');


--
-- Name: pgmigrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pgmigrations ALTER COLUMN id SET DEFAULT nextval('public.pgmigrations_id_seq'::regclass);


--
-- Name: assets assets_asset_no_key; Type: CONSTRAINT; Schema: ast; Owner: -
--

ALTER TABLE ONLY ast.assets
    ADD CONSTRAINT assets_asset_no_key UNIQUE (asset_no);


--
-- Name: assets assets_pkey; Type: CONSTRAINT; Schema: ast; Owner: -
--

ALTER TABLE ONLY ast.assets
    ADD CONSTRAINT assets_pkey PRIMARY KEY (id);


--
-- Name: assignments assignments_pkey; Type: CONSTRAINT; Schema: ast; Owner: -
--

ALTER TABLE ONLY ast.assignments
    ADD CONSTRAINT assignments_pkey PRIMARY KEY (id);


--
-- Name: maintenance maintenance_pkey; Type: CONSTRAINT; Schema: ast; Owner: -
--

ALTER TABLE ONLY ast.maintenance
    ADD CONSTRAINT maintenance_pkey PRIMARY KEY (id);


--
-- Name: absence_cases absence_cases_pkey; Type: CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.absence_cases
    ADD CONSTRAINT absence_cases_pkey PRIMARY KEY (id);


--
-- Name: coverage_targets coverage_targets_pkey; Type: CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.coverage_targets
    ADD CONSTRAINT coverage_targets_pkey PRIMARY KEY (id);


--
-- Name: day_records day_records_employee_id_work_date_key; Type: CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.day_records
    ADD CONSTRAINT day_records_employee_id_work_date_key UNIQUE (employee_id, work_date);


--
-- Name: day_records day_records_minutes_nonnegative; Type: CHECK CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE att.day_records
    ADD CONSTRAINT day_records_minutes_nonnegative CHECK (((worked_minutes IS NULL) OR (worked_minutes >= 0))) NOT VALID;


--
-- Name: day_records day_records_pkey; Type: CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.day_records
    ADD CONSTRAINT day_records_pkey PRIMARY KEY (id);


--
-- Name: device_watermarks device_watermarks_pkey; Type: CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.device_watermarks
    ADD CONSTRAINT device_watermarks_pkey PRIMARY KEY (device_id);


--
-- Name: devices devices_door_code_key; Type: CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.devices
    ADD CONSTRAINT devices_door_code_key UNIQUE (door_code);


--
-- Name: devices devices_pkey; Type: CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.devices
    ADD CONSTRAINT devices_pkey PRIMARY KEY (id);


--
-- Name: employee_shifts employee_shifts_pkey; Type: CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.employee_shifts
    ADD CONSTRAINT employee_shifts_pkey PRIMARY KEY (employee_id);


--
-- Name: holidays holidays_location_date_uq; Type: CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.holidays
    ADD CONSTRAINT holidays_location_date_uq UNIQUE NULLS NOT DISTINCT (location_id, holiday_date);


--
-- Name: holidays holidays_pkey; Type: CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.holidays
    ADD CONSTRAINT holidays_pkey PRIMARY KEY (id);


--
-- Name: ingest_watermarks ingest_watermarks_pkey; Type: CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.ingest_watermarks
    ADD CONSTRAINT ingest_watermarks_pkey PRIMARY KEY (source);


--
-- Name: leave_blackouts leave_blackouts_location_id_blackout_date_key; Type: CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.leave_blackouts
    ADD CONSTRAINT leave_blackouts_location_id_blackout_date_key UNIQUE (location_id, blackout_date);


--
-- Name: leave_blackouts leave_blackouts_pkey; Type: CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.leave_blackouts
    ADD CONSTRAINT leave_blackouts_pkey PRIMARY KEY (id);


--
-- Name: manager_month_approvals manager_month_approvals_pkey; Type: CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.manager_month_approvals
    ADD CONSTRAINT manager_month_approvals_pkey PRIMARY KEY (id);


--
-- Name: month_locks month_locks_company_id_month_key; Type: CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.month_locks
    ADD CONSTRAINT month_locks_company_id_month_key UNIQUE (company_id, month);


--
-- Name: month_locks month_locks_pkey; Type: CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.month_locks
    ADD CONSTRAINT month_locks_pkey PRIMARY KEY (id);


--
-- Name: overtime_entries overtime_entries_employee_id_work_date_key; Type: CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.overtime_entries
    ADD CONSTRAINT overtime_entries_employee_id_work_date_key UNIQUE (employee_id, work_date);


--
-- Name: overtime_entries overtime_entries_pkey; Type: CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.overtime_entries
    ADD CONSTRAINT overtime_entries_pkey PRIMARY KEY (id);


--
-- Name: quarantined_swipes quarantined_swipes_employee_no_swipe_ts_door_code_source_key; Type: CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.quarantined_swipes
    ADD CONSTRAINT quarantined_swipes_employee_no_swipe_ts_door_code_source_key UNIQUE (employee_no, swipe_ts, door_code, source);


--
-- Name: quarantined_swipes quarantined_swipes_pkey; Type: CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.quarantined_swipes
    ADD CONSTRAINT quarantined_swipes_pkey PRIMARY KEY (id);


--
-- Name: recompute_queue recompute_queue_pkey; Type: CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.recompute_queue
    ADD CONSTRAINT recompute_queue_pkey PRIMARY KEY (employee_id, work_date);


--
-- Name: regularizations regularizations_pkey; Type: CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.regularizations
    ADD CONSTRAINT regularizations_pkey PRIMARY KEY (id);


--
-- Name: roster_publications roster_publications_pkey; Type: CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.roster_publications
    ADD CONSTRAINT roster_publications_pkey PRIMARY KEY (id);


--
-- Name: roster_revisions roster_revisions_pkey; Type: CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.roster_revisions
    ADD CONSTRAINT roster_revisions_pkey PRIMARY KEY (id);


--
-- Name: rosters rosters_employee_id_work_date_key; Type: CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.rosters
    ADD CONSTRAINT rosters_employee_id_work_date_key UNIQUE (employee_id, work_date);


--
-- Name: rosters rosters_pkey; Type: CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.rosters
    ADD CONSTRAINT rosters_pkey PRIMARY KEY (id);


--
-- Name: shift_patterns shift_patterns_code_key; Type: CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.shift_patterns
    ADD CONSTRAINT shift_patterns_code_key UNIQUE (code);


--
-- Name: shift_patterns shift_patterns_pkey; Type: CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.shift_patterns
    ADD CONSTRAINT shift_patterns_pkey PRIMARY KEY (id);


--
-- Name: shift_swaps shift_swaps_pkey; Type: CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.shift_swaps
    ADD CONSTRAINT shift_swaps_pkey PRIMARY KEY (id);


--
-- Name: shifts shifts_code_key; Type: CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.shifts
    ADD CONSTRAINT shifts_code_key UNIQUE (code);


--
-- Name: shifts shifts_pkey; Type: CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.shifts
    ADD CONSTRAINT shifts_pkey PRIMARY KEY (id);


--
-- Name: swipe_events swipe_events_employee_no_swipe_ts_door_code_key; Type: CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.swipe_events
    ADD CONSTRAINT swipe_events_employee_no_swipe_ts_door_code_key UNIQUE (employee_no, swipe_ts, door_code);


--
-- Name: swipe_events_202610 swipe_events_202610_employee_no_swipe_ts_door_code_key; Type: CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.swipe_events_202610
    ADD CONSTRAINT swipe_events_202610_employee_no_swipe_ts_door_code_key UNIQUE (employee_no, swipe_ts, door_code);


--
-- Name: swipe_events swipe_events_pkey; Type: CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.swipe_events
    ADD CONSTRAINT swipe_events_pkey PRIMARY KEY (id, swipe_ts);


--
-- Name: swipe_events_202610 swipe_events_202610_pkey; Type: CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.swipe_events_202610
    ADD CONSTRAINT swipe_events_202610_pkey PRIMARY KEY (id, swipe_ts);


--
-- Name: swipe_events_202611 swipe_events_202611_employee_no_swipe_ts_door_code_key; Type: CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.swipe_events_202611
    ADD CONSTRAINT swipe_events_202611_employee_no_swipe_ts_door_code_key UNIQUE (employee_no, swipe_ts, door_code);


--
-- Name: swipe_events_202611 swipe_events_202611_pkey; Type: CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.swipe_events_202611
    ADD CONSTRAINT swipe_events_202611_pkey PRIMARY KEY (id, swipe_ts);


--
-- Name: calendar_items calendar_items_pkey; Type: CONSTRAINT; Schema: cmp; Owner: -
--

ALTER TABLE ONLY cmp.calendar_items
    ADD CONSTRAINT calendar_items_pkey PRIMARY KEY (id);


--
-- Name: filing_evidence filing_evidence_pkey; Type: CONSTRAINT; Schema: cmp; Owner: -
--

ALTER TABLE ONLY cmp.filing_evidence
    ADD CONSTRAINT filing_evidence_pkey PRIMARY KEY (id);


--
-- Name: registrations registrations_pkey; Type: CONSTRAINT; Schema: cmp; Owner: -
--

ALTER TABLE ONLY cmp.registrations
    ADD CONSTRAINT registrations_pkey PRIMARY KEY (id);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: clearances clearances_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.clearances
    ADD CONSTRAINT clearances_pkey PRIMARY KEY (id);


--
-- Name: companies companies_code_key; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.companies
    ADD CONSTRAINT companies_code_key UNIQUE (code);


--
-- Name: companies companies_ecode_prefix_key; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.companies
    ADD CONSTRAINT companies_ecode_prefix_key UNIQUE (ecode_prefix);


--
-- Name: companies companies_name_key; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.companies
    ADD CONSTRAINT companies_name_key UNIQUE (name);


--
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);


--
-- Name: companies companies_sap_company_code_key; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.companies
    ADD CONSTRAINT companies_sap_company_code_key UNIQUE (sap_company_code);


--
-- Name: cost_centers cost_centers_company_id_code_key; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.cost_centers
    ADD CONSTRAINT cost_centers_company_id_code_key UNIQUE (company_id, code);


--
-- Name: cost_centers cost_centers_id_company_uk; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.cost_centers
    ADD CONSTRAINT cost_centers_id_company_uk UNIQUE (id, company_id);


--
-- Name: cost_centers cost_centers_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.cost_centers
    ADD CONSTRAINT cost_centers_pkey PRIMARY KEY (id);


--
-- Name: departments departments_name_key; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.departments
    ADD CONSTRAINT departments_name_key UNIQUE (name);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: designations designations_name_key; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.designations
    ADD CONSTRAINT designations_name_key UNIQUE (name);


--
-- Name: designations designations_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.designations
    ADD CONSTRAINT designations_pkey PRIMARY KEY (id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: employee_family employee_family_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.employee_family
    ADD CONSTRAINT employee_family_pkey PRIMARY KEY (id);


--
-- Name: employee_history employee_history_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.employee_history
    ADD CONSTRAINT employee_history_pkey PRIMARY KEY (id);


--
-- Name: employees employees_ecode_key; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.employees
    ADD CONSTRAINT employees_ecode_key UNIQUE (ecode);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: employees employees_work_email_key; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.employees
    ADD CONSTRAINT employees_work_email_key UNIQUE (work_email);


--
-- Name: grades grades_code_key; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.grades
    ADD CONSTRAINT grades_code_key UNIQUE (code);


--
-- Name: grades grades_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.grades
    ADD CONSTRAINT grades_pkey PRIMARY KEY (id);


--
-- Name: letter_templates letter_templates_code_key; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.letter_templates
    ADD CONSTRAINT letter_templates_code_key UNIQUE (code);


--
-- Name: letter_templates letter_templates_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.letter_templates
    ADD CONSTRAINT letter_templates_pkey PRIMARY KEY (id);


--
-- Name: letters letters_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.letters
    ADD CONSTRAINT letters_pkey PRIMARY KEY (id);


--
-- Name: locations locations_company_id_name_key; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.locations
    ADD CONSTRAINT locations_company_id_name_key UNIQUE (company_id, name);


--
-- Name: locations locations_id_company_uk; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.locations
    ADD CONSTRAINT locations_id_company_uk UNIQUE (id, company_id);


--
-- Name: locations locations_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.locations
    ADD CONSTRAINT locations_pkey PRIMARY KEY (id);


--
-- Name: mis_codes mis_codes_company_id_code_key; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.mis_codes
    ADD CONSTRAINT mis_codes_company_id_code_key UNIQUE (company_id, code);


--
-- Name: mis_codes mis_codes_id_company_uk; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.mis_codes
    ADD CONSTRAINT mis_codes_id_company_uk UNIQUE (id, company_id);


--
-- Name: mis_codes mis_codes_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.mis_codes
    ADD CONSTRAINT mis_codes_pkey PRIMARY KEY (id);


--
-- Name: onboarding_candidates onboarding_candidates_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.onboarding_candidates
    ADD CONSTRAINT onboarding_candidates_pkey PRIMARY KEY (id);


--
-- Name: onboarding_candidates onboarding_candidates_prejoin_link_token_key; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.onboarding_candidates
    ADD CONSTRAINT onboarding_candidates_prejoin_link_token_key UNIQUE (prejoin_link_token);


--
-- Name: onboarding_tasks onboarding_tasks_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.onboarding_tasks
    ADD CONSTRAINT onboarding_tasks_pkey PRIMARY KEY (id);


--
-- Name: org_units org_units_id_company_uk; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.org_units
    ADD CONSTRAINT org_units_id_company_uk UNIQUE (id, company_id);


--
-- Name: org_units org_units_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.org_units
    ADD CONSTRAINT org_units_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_token_hash_key; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_token_hash_key UNIQUE (token_hash);


--
-- Name: permissions permissions_code_key; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.permissions
    ADD CONSTRAINT permissions_code_key UNIQUE (code);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: plants plants_company_id_plant_code_key; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.plants
    ADD CONSTRAINT plants_company_id_plant_code_key UNIQUE (company_id, plant_code);


--
-- Name: plants plants_id_company_uk; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.plants
    ADD CONSTRAINT plants_id_company_uk UNIQUE (id, company_id);


--
-- Name: plants plants_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.plants
    ADD CONSTRAINT plants_pkey PRIMARY KEY (id);


--
-- Name: policies policies_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.policies
    ADD CONSTRAINT policies_pkey PRIMARY KEY (id);


--
-- Name: policy_acknowledgments policy_acknowledgments_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.policy_acknowledgments
    ADD CONSTRAINT policy_acknowledgments_pkey PRIMARY KEY (id);


--
-- Name: policy_acknowledgments policy_acknowledgments_policy_id_employee_id_key; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.policy_acknowledgments
    ADD CONSTRAINT policy_acknowledgments_policy_id_employee_id_key UNIQUE (policy_id, employee_id);


--
-- Name: probation_reviews probation_reviews_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.probation_reviews
    ADD CONSTRAINT probation_reviews_pkey PRIMARY KEY (id);


--
-- Name: profile_change_requests profile_change_requests_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.profile_change_requests
    ADD CONSTRAINT profile_change_requests_pkey PRIMARY KEY (id);


--
-- Name: reporting_tree reporting_tree_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.reporting_tree
    ADD CONSTRAINT reporting_tree_pkey PRIMARY KEY (manager_id, employee_id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_role_id_permission_id_key; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.role_permissions
    ADD CONSTRAINT role_permissions_role_id_permission_id_key UNIQUE (role_id, permission_id);


--
-- Name: roles roles_code_key; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.roles
    ADD CONSTRAINT roles_code_key UNIQUE (code);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: separations separations_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.separations
    ADD CONSTRAINT separations_pkey PRIMARY KEY (id);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (key);


--
-- Name: transfers transfers_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.transfers
    ADD CONSTRAINT transfers_pkey PRIMARY KEY (id);


--
-- Name: clearances uq_separation_department; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.clearances
    ADD CONSTRAINT uq_separation_department UNIQUE (separation_id, department);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_id_scope_org_unit_id_key; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.user_roles
    ADD CONSTRAINT user_roles_user_id_role_id_scope_org_unit_id_key UNIQUE (user_id, role_id, scope_org_unit_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: types types_pkey; Type: CONSTRAINT; Schema: doc; Owner: -
--

ALTER TABLE ONLY doc.types
    ADD CONSTRAINT types_pkey PRIMARY KEY (code);


--
-- Name: announcements announcements_pkey; Type: CONSTRAINT; Schema: eng; Owner: -
--

ALTER TABLE ONLY eng.announcements
    ADD CONSTRAINT announcements_pkey PRIMARY KEY (id);


--
-- Name: poll_responses poll_responses_pkey; Type: CONSTRAINT; Schema: eng; Owner: -
--

ALTER TABLE ONLY eng.poll_responses
    ADD CONSTRAINT poll_responses_pkey PRIMARY KEY (id);


--
-- Name: polls polls_pkey; Type: CONSTRAINT; Schema: eng; Owner: -
--

ALTER TABLE ONLY eng.polls
    ADD CONSTRAINT polls_pkey PRIMARY KEY (id);


--
-- Name: survey_responses survey_responses_pkey; Type: CONSTRAINT; Schema: eng; Owner: -
--

ALTER TABLE ONLY eng.survey_responses
    ADD CONSTRAINT survey_responses_pkey PRIMARY KEY (id);


--
-- Name: surveys surveys_pkey; Type: CONSTRAINT; Schema: eng; Owner: -
--

ALTER TABLE ONLY eng.surveys
    ADD CONSTRAINT surveys_pkey PRIMARY KEY (id);


--
-- Name: categories categories_code_key; Type: CONSTRAINT; Schema: hd; Owner: -
--

ALTER TABLE ONLY hd.categories
    ADD CONSTRAINT categories_code_key UNIQUE (code);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: hd; Owner: -
--

ALTER TABLE ONLY hd.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: ticket_messages ticket_messages_pkey; Type: CONSTRAINT; Schema: hd; Owner: -
--

ALTER TABLE ONLY hd.ticket_messages
    ADD CONSTRAINT ticket_messages_pkey PRIMARY KEY (id);


--
-- Name: tickets tickets_pkey; Type: CONSTRAINT; Schema: hd; Owner: -
--

ALTER TABLE ONLY hd.tickets
    ADD CONSTRAINT tickets_pkey PRIMARY KEY (id);


--
-- Name: tickets tickets_ticket_no_key; Type: CONSTRAINT; Schema: hd; Owner: -
--

ALTER TABLE ONLY hd.tickets
    ADD CONSTRAINT tickets_ticket_no_key UNIQUE (ticket_no);


--
-- Name: grievances grievances_pkey; Type: CONSTRAINT; Schema: ird; Owner: -
--

ALTER TABLE ONLY ird.grievances
    ADD CONSTRAINT grievances_pkey PRIMARY KEY (id);


--
-- Name: ic_members ic_members_pkey; Type: CONSTRAINT; Schema: ird; Owner: -
--

ALTER TABLE ONLY ird.ic_members
    ADD CONSTRAINT ic_members_pkey PRIMARY KEY (id);


--
-- Name: posh_case_access_log posh_case_access_log_pkey; Type: CONSTRAINT; Schema: ird; Owner: -
--

ALTER TABLE ONLY ird.posh_case_access_log
    ADD CONSTRAINT posh_case_access_log_pkey PRIMARY KEY (id);


--
-- Name: posh_cases posh_cases_pkey; Type: CONSTRAINT; Schema: ird; Owner: -
--

ALTER TABLE ONLY ird.posh_cases
    ADD CONSTRAINT posh_cases_pkey PRIMARY KEY (id);


--
-- Name: whistleblower_reports whistleblower_reports_pkey; Type: CONSTRAINT; Schema: ird; Owner: -
--

ALTER TABLE ONLY ird.whistleblower_reports
    ADD CONSTRAINT whistleblower_reports_pkey PRIMARY KEY (id);


--
-- Name: applications applications_pkey; Type: CONSTRAINT; Schema: lv; Owner: -
--

ALTER TABLE ONLY lv.applications
    ADD CONSTRAINT applications_pkey PRIMARY KEY (id);


--
-- Name: leave_types leave_types_code_key; Type: CONSTRAINT; Schema: lv; Owner: -
--

ALTER TABLE ONLY lv.leave_types
    ADD CONSTRAINT leave_types_code_key UNIQUE (code);


--
-- Name: leave_types leave_types_pkey; Type: CONSTRAINT; Schema: lv; Owner: -
--

ALTER TABLE ONLY lv.leave_types
    ADD CONSTRAINT leave_types_pkey PRIMARY KEY (id);


--
-- Name: ledger ledger_pkey; Type: CONSTRAINT; Schema: lv; Owner: -
--

ALTER TABLE ONLY lv.ledger
    ADD CONSTRAINT ledger_pkey PRIMARY KEY (id);


--
-- Name: restricted_holidays restricted_holidays_holiday_date_name_key; Type: CONSTRAINT; Schema: lv; Owner: -
--

ALTER TABLE ONLY lv.restricted_holidays
    ADD CONSTRAINT restricted_holidays_holiday_date_name_key UNIQUE (holiday_date, name);


--
-- Name: restricted_holidays restricted_holidays_pkey; Type: CONSTRAINT; Schema: lv; Owner: -
--

ALTER TABLE ONLY lv.restricted_holidays
    ADD CONSTRAINT restricted_holidays_pkey PRIMARY KEY (id);


--
-- Name: rh_selections rh_selections_employee_id_restricted_holiday_id_key; Type: CONSTRAINT; Schema: lv; Owner: -
--

ALTER TABLE ONLY lv.rh_selections
    ADD CONSTRAINT rh_selections_employee_id_restricted_holiday_id_key UNIQUE (employee_id, restricted_holiday_id);


--
-- Name: rh_selections rh_selections_pkey; Type: CONSTRAINT; Schema: lv; Owner: -
--

ALTER TABLE ONLY lv.rh_selections
    ADD CONSTRAINT rh_selections_pkey PRIMARY KEY (id);


--
-- Name: arrears arrears_pkey; Type: CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.arrears
    ADD CONSTRAINT arrears_pkey PRIMARY KEY (id);


--
-- Name: bank_batches bank_batches_pkey; Type: CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.bank_batches
    ADD CONSTRAINT bank_batches_pkey PRIMARY KEY (id);


--
-- Name: budget_categories budget_categories_budget_id_claim_type_id_key; Type: CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.budget_categories
    ADD CONSTRAINT budget_categories_budget_id_claim_type_id_key UNIQUE (budget_id, claim_type_id);


--
-- Name: budget_categories budget_categories_pkey; Type: CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.budget_categories
    ADD CONSTRAINT budget_categories_pkey PRIMARY KEY (id);


--
-- Name: budgets budgets_pkey; Type: CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.budgets
    ADD CONSTRAINT budgets_pkey PRIMARY KEY (id);


--
-- Name: budgets budgets_reference_key; Type: CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.budgets
    ADD CONSTRAINT budgets_reference_key UNIQUE (reference);


--
-- Name: claim_bills claim_bills_pkey; Type: CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.claim_bills
    ADD CONSTRAINT claim_bills_pkey PRIMARY KEY (id);


--
-- Name: claim_entitlements claim_entitlements_pkey; Type: CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.claim_entitlements
    ADD CONSTRAINT claim_entitlements_pkey PRIMARY KEY (id);


--
-- Name: claim_lines claim_lines_pkey; Type: CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.claim_lines
    ADD CONSTRAINT claim_lines_pkey PRIMARY KEY (id);


--
-- Name: claim_reservations claim_reservations_pkey; Type: CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.claim_reservations
    ADD CONSTRAINT claim_reservations_pkey PRIMARY KEY (id);


--
-- Name: claim_types claim_types_code_key; Type: CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.claim_types
    ADD CONSTRAINT claim_types_code_key UNIQUE (code);


--
-- Name: claim_types claim_types_pkey; Type: CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.claim_types
    ADD CONSTRAINT claim_types_pkey PRIMARY KEY (id);


--
-- Name: claims claims_pkey; Type: CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.claims
    ADD CONSTRAINT claims_pkey PRIMARY KEY (id);


--
-- Name: claims claims_reference_key; Type: CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.claims
    ADD CONSTRAINT claims_reference_key UNIQUE (reference);


--
-- Name: employee_salaries employee_salaries_pkey; Type: CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.employee_salaries
    ADD CONSTRAINT employee_salaries_pkey PRIMARY KEY (id);


--
-- Name: fnf_settlements fnf_settlements_pkey; Type: CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.fnf_settlements
    ADD CONSTRAINT fnf_settlements_pkey PRIMARY KEY (id);


--
-- Name: gl_accounts gl_accounts_company_code_plant_code_cost_center_code_compon_key; Type: CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.gl_accounts
    ADD CONSTRAINT gl_accounts_company_code_plant_code_cost_center_code_compon_key UNIQUE (company_code, plant_code, cost_center_code, component_code);


--
-- Name: gl_accounts gl_accounts_pkey; Type: CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.gl_accounts
    ADD CONSTRAINT gl_accounts_pkey PRIMARY KEY (id);


--
-- Name: inputs inputs_pkey; Type: CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.inputs
    ADD CONSTRAINT inputs_pkey PRIMARY KEY (id);


--
-- Name: investment_declarations investment_declarations_employee_id_fy_section_key; Type: CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.investment_declarations
    ADD CONSTRAINT investment_declarations_employee_id_fy_section_key UNIQUE (employee_id, fy, section);


--
-- Name: investment_declarations investment_declarations_pkey; Type: CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.investment_declarations
    ADD CONSTRAINT investment_declarations_pkey PRIMARY KEY (id);


--
-- Name: it_slabs it_slabs_pkey; Type: CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.it_slabs
    ADD CONSTRAINT it_slabs_pkey PRIMARY KEY (id);


--
-- Name: loan_postings loan_postings_pkey; Type: CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.loan_postings
    ADD CONSTRAINT loan_postings_pkey PRIMARY KEY (id);


--
-- Name: loans loans_pkey; Type: CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.loans
    ADD CONSTRAINT loans_pkey PRIMARY KEY (id);


--
-- Name: employee_salaries no_overlapping_salaries; Type: CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.employee_salaries
    ADD CONSTRAINT no_overlapping_salaries EXCLUDE USING gist (employee_id WITH =, daterange(effective_from, effective_to, '[)'::text) WITH &&);


--
-- Name: payroll_item_lines payroll_item_lines_pkey; Type: CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.payroll_item_lines
    ADD CONSTRAINT payroll_item_lines_pkey PRIMARY KEY (id);


--
-- Name: payroll_items payroll_items_pkey; Type: CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.payroll_items
    ADD CONSTRAINT payroll_items_pkey PRIMARY KEY (id);


--
-- Name: payroll_items payroll_items_run_id_employee_id_key; Type: CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.payroll_items
    ADD CONSTRAINT payroll_items_run_id_employee_id_key UNIQUE (run_id, employee_id);


--
-- Name: payroll_runs payroll_runs_company_id_month_run_type_key; Type: CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.payroll_runs
    ADD CONSTRAINT payroll_runs_company_id_month_run_type_key UNIQUE (company_id, month, run_type);


--
-- Name: payroll_runs payroll_runs_pkey; Type: CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.payroll_runs
    ADD CONSTRAINT payroll_runs_pkey PRIMARY KEY (id);


--
-- Name: pt_slabs pt_slabs_pkey; Type: CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.pt_slabs
    ADD CONSTRAINT pt_slabs_pkey PRIMARY KEY (id);


--
-- Name: salary_components salary_components_pkey; Type: CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.salary_components
    ADD CONSTRAINT salary_components_pkey PRIMARY KEY (code);


--
-- Name: salary_holds salary_holds_pkey; Type: CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.salary_holds
    ADD CONSTRAINT salary_holds_pkey PRIMARY KEY (id);


--
-- Name: salary_structures salary_structures_name_key; Type: CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.salary_structures
    ADD CONSTRAINT salary_structures_name_key UNIQUE (name);


--
-- Name: salary_structures salary_structures_pkey; Type: CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.salary_structures
    ADD CONSTRAINT salary_structures_pkey PRIMARY KEY (id);


--
-- Name: statutory_rates statutory_rates_pkey; Type: CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.statutory_rates
    ADD CONSTRAINT statutory_rates_pkey PRIMARY KEY (id);


--
-- Name: tds_challans tds_challans_pkey; Type: CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.tds_challans
    ADD CONSTRAINT tds_challans_pkey PRIMARY KEY (id);


--
-- Name: breach_register breach_register_pkey; Type: CONSTRAINT; Schema: prv; Owner: -
--

ALTER TABLE ONLY prv.breach_register
    ADD CONSTRAINT breach_register_pkey PRIMARY KEY (id);


--
-- Name: consent_events consent_events_pkey; Type: CONSTRAINT; Schema: prv; Owner: -
--

ALTER TABLE ONLY prv.consent_events
    ADD CONSTRAINT consent_events_pkey PRIMARY KEY (id);


--
-- Name: consents consents_employee_id_purpose_key; Type: CONSTRAINT; Schema: prv; Owner: -
--

ALTER TABLE ONLY prv.consents
    ADD CONSTRAINT consents_employee_id_purpose_key UNIQUE (employee_id, purpose);


--
-- Name: consents consents_pkey; Type: CONSTRAINT; Schema: prv; Owner: -
--

ALTER TABLE ONLY prv.consents
    ADD CONSTRAINT consents_pkey PRIMARY KEY (id);


--
-- Name: legal_holds legal_holds_pkey; Type: CONSTRAINT; Schema: prv; Owner: -
--

ALTER TABLE ONLY prv.legal_holds
    ADD CONSTRAINT legal_holds_pkey PRIMARY KEY (id);


--
-- Name: notice_acks notice_acks_notice_id_user_id_key; Type: CONSTRAINT; Schema: prv; Owner: -
--

ALTER TABLE ONLY prv.notice_acks
    ADD CONSTRAINT notice_acks_notice_id_user_id_key UNIQUE (notice_id, user_id);


--
-- Name: notice_acks notice_acks_pkey; Type: CONSTRAINT; Schema: prv; Owner: -
--

ALTER TABLE ONLY prv.notice_acks
    ADD CONSTRAINT notice_acks_pkey PRIMARY KEY (id);


--
-- Name: notices notices_pkey; Type: CONSTRAINT; Schema: prv; Owner: -
--

ALTER TABLE ONLY prv.notices
    ADD CONSTRAINT notices_pkey PRIMARY KEY (id);


--
-- Name: notices notices_principal_class_version_key; Type: CONSTRAINT; Schema: prv; Owner: -
--

ALTER TABLE ONLY prv.notices
    ADD CONSTRAINT notices_principal_class_version_key UNIQUE (principal_class, version);


--
-- Name: processing_register processing_register_data_class_key; Type: CONSTRAINT; Schema: prv; Owner: -
--

ALTER TABLE ONLY prv.processing_register
    ADD CONSTRAINT processing_register_data_class_key UNIQUE (data_class);


--
-- Name: processing_register processing_register_pkey; Type: CONSTRAINT; Schema: prv; Owner: -
--

ALTER TABLE ONLY prv.processing_register
    ADD CONSTRAINT processing_register_pkey PRIMARY KEY (id);


--
-- Name: processors processors_pkey; Type: CONSTRAINT; Schema: prv; Owner: -
--

ALTER TABLE ONLY prv.processors
    ADD CONSTRAINT processors_pkey PRIMARY KEY (id);


--
-- Name: purge_log purge_log_pkey; Type: CONSTRAINT; Schema: prv; Owner: -
--

ALTER TABLE ONLY prv.purge_log
    ADD CONSTRAINT purge_log_pkey PRIMARY KEY (id);


--
-- Name: purge_proposals purge_proposals_pkey; Type: CONSTRAINT; Schema: prv; Owner: -
--

ALTER TABLE ONLY prv.purge_proposals
    ADD CONSTRAINT purge_proposals_pkey PRIMARY KEY (id);


--
-- Name: retention_rules retention_rules_data_class_key; Type: CONSTRAINT; Schema: prv; Owner: -
--

ALTER TABLE ONLY prv.retention_rules
    ADD CONSTRAINT retention_rules_data_class_key UNIQUE (data_class);


--
-- Name: retention_rules retention_rules_pkey; Type: CONSTRAINT; Schema: prv; Owner: -
--

ALTER TABLE ONLY prv.retention_rules
    ADD CONSTRAINT retention_rules_pkey PRIMARY KEY (id);


--
-- Name: rights_requests rights_requests_pkey; Type: CONSTRAINT; Schema: prv; Owner: -
--

ALTER TABLE ONLY prv.rights_requests
    ADD CONSTRAINT rights_requests_pkey PRIMARY KEY (id);


--
-- Name: pgmigrations pgmigrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pgmigrations
    ADD CONSTRAINT pgmigrations_pkey PRIMARY KEY (id);


--
-- Name: kpi_daily kpi_daily_pkey; Type: CONSTRAINT; Schema: reporting; Owner: -
--

ALTER TABLE ONLY reporting.kpi_daily
    ADD CONSTRAINT kpi_daily_pkey PRIMARY KEY (id);


--
-- Name: kpi_daily kpi_daily_snapshot_date_company_id_category_metric_key; Type: CONSTRAINT; Schema: reporting; Owner: -
--

ALTER TABLE ONLY reporting.kpi_daily
    ADD CONSTRAINT kpi_daily_snapshot_date_company_id_category_metric_key UNIQUE (snapshot_date, company_id, category, metric);


--
-- Name: muster_month muster_month_company_id_month_employee_id_key; Type: CONSTRAINT; Schema: reporting; Owner: -
--

ALTER TABLE ONLY reporting.muster_month
    ADD CONSTRAINT muster_month_company_id_month_employee_id_key UNIQUE (company_id, month, employee_id);


--
-- Name: muster_month muster_month_pkey; Type: CONSTRAINT; Schema: reporting; Owner: -
--

ALTER TABLE ONLY reporting.muster_month
    ADD CONSTRAINT muster_month_pkey PRIMARY KEY (id);


--
-- Name: access_events access_events_pkey; Type: CONSTRAINT; Schema: sec; Owner: -
--

ALTER TABLE ONLY sec.access_events
    ADD CONSTRAINT access_events_pkey PRIMARY KEY (id, occurred_at);


--
-- Name: access_events_202610 access_events_202610_pkey; Type: CONSTRAINT; Schema: sec; Owner: -
--

ALTER TABLE ONLY sec.access_events_202610
    ADD CONSTRAINT access_events_202610_pkey PRIMARY KEY (id, occurred_at);


--
-- Name: access_events_202611 access_events_202611_pkey; Type: CONSTRAINT; Schema: sec; Owner: -
--

ALTER TABLE ONLY sec.access_events_202611
    ADD CONSTRAINT access_events_202611_pkey PRIMARY KEY (id, occurred_at);


--
-- Name: mfa_enrolments mfa_enrolments_pkey; Type: CONSTRAINT; Schema: sec; Owner: -
--

ALTER TABLE ONLY sec.mfa_enrolments
    ADD CONSTRAINT mfa_enrolments_pkey PRIMARY KEY (id);


--
-- Name: mfa_recovery_codes mfa_recovery_codes_pkey; Type: CONSTRAINT; Schema: sec; Owner: -
--

ALTER TABLE ONLY sec.mfa_recovery_codes
    ADD CONSTRAINT mfa_recovery_codes_pkey PRIMARY KEY (id);


--
-- Name: password_history password_history_pkey; Type: CONSTRAINT; Schema: sec; Owner: -
--

ALTER TABLE ONLY sec.password_history
    ADD CONSTRAINT password_history_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: sec; Owner: -
--

ALTER TABLE ONLY sec.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_sid_key; Type: CONSTRAINT; Schema: sec; Owner: -
--

ALTER TABLE ONLY sec.sessions
    ADD CONSTRAINT sessions_sid_key UNIQUE (sid);


--
-- Name: advances advances_pkey; Type: CONSTRAINT; Schema: te; Owner: -
--

ALTER TABLE ONLY te.advances
    ADD CONSTRAINT advances_pkey PRIMARY KEY (id);


--
-- Name: budgets budgets_pkey; Type: CONSTRAINT; Schema: te; Owner: -
--

ALTER TABLE ONLY te.budgets
    ADD CONSTRAINT budgets_pkey PRIMARY KEY (id);


--
-- Name: claim_items claim_items_pkey; Type: CONSTRAINT; Schema: te; Owner: -
--

ALTER TABLE ONLY te.claim_items
    ADD CONSTRAINT claim_items_pkey PRIMARY KEY (id);


--
-- Name: claims claims_pkey; Type: CONSTRAINT; Schema: te; Owner: -
--

ALTER TABLE ONLY te.claims
    ADD CONSTRAINT claims_pkey PRIMARY KEY (id);


--
-- Name: claims claims_reference_no_key; Type: CONSTRAINT; Schema: te; Owner: -
--

ALTER TABLE ONLY te.claims
    ADD CONSTRAINT claims_reference_no_key UNIQUE (reference_no);


--
-- Name: settlements settlements_pkey; Type: CONSTRAINT; Schema: te; Owner: -
--

ALTER TABLE ONLY te.settlements
    ADD CONSTRAINT settlements_pkey PRIMARY KEY (id);


--
-- Name: trip_itineraries trip_itineraries_pkey; Type: CONSTRAINT; Schema: te; Owner: -
--

ALTER TABLE ONLY te.trip_itineraries
    ADD CONSTRAINT trip_itineraries_pkey PRIMARY KEY (id);


--
-- Name: trips trips_pkey; Type: CONSTRAINT; Schema: te; Owner: -
--

ALTER TABLE ONLY te.trips
    ADD CONSTRAINT trips_pkey PRIMARY KEY (id);


--
-- Name: trips trips_reference_no_key; Type: CONSTRAINT; Schema: te; Owner: -
--

ALTER TABLE ONLY te.trips
    ADD CONSTRAINT trips_reference_no_key UNIQUE (reference_no);


--
-- Name: budgets uq_te_budget_grade_type; Type: CONSTRAINT; Schema: te; Owner: -
--

ALTER TABLE ONLY te.budgets
    ADD CONSTRAINT uq_te_budget_grade_type UNIQUE (grade_level, travel_type);


--
-- Name: wallet_transactions wallet_transactions_pkey; Type: CONSTRAINT; Schema: te; Owner: -
--

ALTER TABLE ONLY te.wallet_transactions
    ADD CONSTRAINT wallet_transactions_pkey PRIMARY KEY (id);


--
-- Name: wallet_transactions wallet_transactions_transaction_reference_key; Type: CONSTRAINT; Schema: te; Owner: -
--

ALTER TABLE ONLY te.wallet_transactions
    ADD CONSTRAINT wallet_transactions_transaction_reference_key UNIQUE (transaction_reference);


--
-- Name: wallets wallets_employee_id_key; Type: CONSTRAINT; Schema: te; Owner: -
--

ALTER TABLE ONLY te.wallets
    ADD CONSTRAINT wallets_employee_id_key UNIQUE (employee_id);


--
-- Name: wallets wallets_pkey; Type: CONSTRAINT; Schema: te; Owner: -
--

ALTER TABLE ONLY te.wallets
    ADD CONSTRAINT wallets_pkey PRIMARY KEY (id);


--
-- Name: definitions definitions_pkey; Type: CONSTRAINT; Schema: wf; Owner: -
--

ALTER TABLE ONLY wf.definitions
    ADD CONSTRAINT definitions_pkey PRIMARY KEY (code);


--
-- Name: delegations delegations_pkey; Type: CONSTRAINT; Schema: wf; Owner: -
--

ALTER TABLE ONLY wf.delegations
    ADD CONSTRAINT delegations_pkey PRIMARY KEY (id);


--
-- Name: event_subscriptions event_subscriptions_event_code_recipient_kind_recipient_ref_key; Type: CONSTRAINT; Schema: wf; Owner: -
--

ALTER TABLE ONLY wf.event_subscriptions
    ADD CONSTRAINT event_subscriptions_event_code_recipient_kind_recipient_ref_key UNIQUE (event_code, recipient_kind, recipient_ref);


--
-- Name: event_subscriptions event_subscriptions_pkey; Type: CONSTRAINT; Schema: wf; Owner: -
--

ALTER TABLE ONLY wf.event_subscriptions
    ADD CONSTRAINT event_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: wf; Owner: -
--

ALTER TABLE ONLY wf.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: request_steps request_steps_pkey; Type: CONSTRAINT; Schema: wf; Owner: -
--

ALTER TABLE ONLY wf.request_steps
    ADD CONSTRAINT request_steps_pkey PRIMARY KEY (id);


--
-- Name: requests requests_pkey; Type: CONSTRAINT; Schema: wf; Owner: -
--

ALTER TABLE ONLY wf.requests
    ADD CONSTRAINT requests_pkey PRIMARY KEY (id);


--
-- Name: assets_asset_no_trgm; Type: INDEX; Schema: ast; Owner: -
--

CREATE INDEX assets_asset_no_trgm ON ast.assets USING gin (lower(asset_no) public.gin_trgm_ops);


--
-- Name: assets_description_trgm; Type: INDEX; Schema: ast; Owner: -
--

CREATE INDEX assets_description_trgm ON ast.assets USING gin (lower(COALESCE(description, ''::text)) public.gin_trgm_ops);


--
-- Name: assets_search_idx; Type: INDEX; Schema: ast; Owner: -
--

CREATE INDEX assets_search_idx ON ast.assets USING btree (company_id, status, category);


--
-- Name: assets_serial_idx; Type: INDEX; Schema: ast; Owner: -
--

CREATE INDEX assets_serial_idx ON ast.assets USING btree (serial_no) WHERE (serial_no IS NOT NULL);


--
-- Name: assets_serial_trgm; Type: INDEX; Schema: ast; Owner: -
--

CREATE INDEX assets_serial_trgm ON ast.assets USING gin (lower(COALESCE(serial_no, ''::text)) public.gin_trgm_ops);


--
-- Name: assignments_employee_idx; Type: INDEX; Schema: ast; Owner: -
--

CREATE INDEX assignments_employee_idx ON ast.assignments USING btree (employee_id) WHERE (employee_id IS NOT NULL);


--
-- Name: assignments_one_open_per_asset; Type: INDEX; Schema: ast; Owner: -
--

CREATE UNIQUE INDEX assignments_one_open_per_asset ON ast.assignments USING btree (asset_id) WHERE (returned_at IS NULL);


--
-- Name: maintenance_asset_idx; Type: INDEX; Schema: ast; Owner: -
--

CREATE INDEX maintenance_asset_idx ON ast.maintenance USING btree (asset_id, created_at DESC);


--
-- Name: maintenance_open_idx; Type: INDEX; Schema: ast; Owner: -
--

CREATE INDEX maintenance_open_idx ON ast.maintenance USING btree (scheduled_for) WHERE (resolved_at IS NULL);


--
-- Name: absence_cases_one_open; Type: INDEX; Schema: att; Owner: -
--

CREATE UNIQUE INDEX absence_cases_one_open ON att.absence_cases USING btree (employee_id) WHERE (closed_at IS NULL);


--
-- Name: coverage_targets_scope; Type: INDEX; Schema: att; Owner: -
--

CREATE UNIQUE INDEX coverage_targets_scope ON att.coverage_targets USING btree (location_id, weekday, shift_id, COALESCE(department_id, (0)::bigint));


--
-- Name: day_records_date_status_idx; Type: INDEX; Schema: att; Owner: -
--

CREATE INDEX day_records_date_status_idx ON att.day_records USING btree (work_date, status);


--
-- Name: device_watermarks_ts_idx; Type: INDEX; Schema: att; Owner: -
--

CREATE INDEX device_watermarks_ts_idx ON att.device_watermarks USING btree (watermark_ts);


--
-- Name: manager_month_approvals_latest_idx; Type: INDEX; Schema: att; Owner: -
--

CREATE INDEX manager_month_approvals_latest_idx ON att.manager_month_approvals USING btree (company_id, month, manager_employee_id, id DESC);


--
-- Name: manager_month_approvals_lookup_idx; Type: INDEX; Schema: att; Owner: -
--

CREATE INDEX manager_month_approvals_lookup_idx ON att.manager_month_approvals USING btree (company_id, month);


--
-- Name: overtime_pending_idx; Type: INDEX; Schema: att; Owner: -
--

CREATE INDEX overtime_pending_idx ON att.overtime_entries USING btree (manager_id, status) WHERE (status = 'pending'::text);


--
-- Name: overtime_wf_idx; Type: INDEX; Schema: att; Owner: -
--

CREATE UNIQUE INDEX overtime_wf_idx ON att.overtime_entries USING btree (workflow_request_id) WHERE (workflow_request_id IS NOT NULL);


--
-- Name: quarantined_swipes_review_idx; Type: INDEX; Schema: att; Owner: -
--

CREATE INDEX quarantined_swipes_review_idx ON att.quarantined_swipes USING btree (reviewed, created_at);


--
-- Name: regularizations_emp_idx; Type: INDEX; Schema: att; Owner: -
--

CREATE INDEX regularizations_emp_idx ON att.regularizations USING btree (employee_id, from_date);


--
-- Name: regularizations_half_coverage_idx; Type: INDEX; Schema: att; Owner: -
--

CREATE INDEX regularizations_half_coverage_idx ON att.regularizations USING btree (employee_id, from_date, to_date) WHERE ((day_portion <> 'full_day'::text) AND applied);


--
-- Name: regularizations_wf_idx; Type: INDEX; Schema: att; Owner: -
--

CREATE UNIQUE INDEX regularizations_wf_idx ON att.regularizations USING btree (workflow_request_id);


--
-- Name: roster_publications_range; Type: INDEX; Schema: att; Owner: -
--

CREATE UNIQUE INDEX roster_publications_range ON att.roster_publications USING btree (manager_employee_id, period_from, period_to);


--
-- Name: shift_swaps_requester; Type: INDEX; Schema: att; Owner: -
--

CREATE INDEX shift_swaps_requester ON att.shift_swaps USING btree (requester_employee_id, work_date);


--
-- Name: swipe_events_emp_ts_idx; Type: INDEX; Schema: att; Owner: -
--

CREATE INDEX swipe_events_emp_ts_idx ON ONLY att.swipe_events USING btree (employee_id, swipe_ts);


--
-- Name: swipe_events_202610_employee_id_swipe_ts_idx; Type: INDEX; Schema: att; Owner: -
--

CREATE INDEX swipe_events_202610_employee_id_swipe_ts_idx ON att.swipe_events_202610 USING btree (employee_id, swipe_ts);


--
-- Name: swipe_events_ts_brin; Type: INDEX; Schema: att; Owner: -
--

CREATE INDEX swipe_events_ts_brin ON ONLY att.swipe_events USING brin (swipe_ts);


--
-- Name: swipe_events_202610_swipe_ts_idx; Type: INDEX; Schema: att; Owner: -
--

CREATE INDEX swipe_events_202610_swipe_ts_idx ON att.swipe_events_202610 USING brin (swipe_ts);


--
-- Name: swipe_events_202611_employee_id_swipe_ts_idx; Type: INDEX; Schema: att; Owner: -
--

CREATE INDEX swipe_events_202611_employee_id_swipe_ts_idx ON att.swipe_events_202611 USING btree (employee_id, swipe_ts);


--
-- Name: swipe_events_202611_swipe_ts_idx; Type: INDEX; Schema: att; Owner: -
--

CREATE INDEX swipe_events_202611_swipe_ts_idx ON att.swipe_events_202611 USING brin (swipe_ts);


--
-- Name: calendar_due_idx; Type: INDEX; Schema: cmp; Owner: -
--

CREATE INDEX calendar_due_idx ON cmp.calendar_items USING btree (due_on, status);


--
-- Name: calendar_period_unique; Type: INDEX; Schema: cmp; Owner: -
--

CREATE UNIQUE INDEX calendar_period_unique ON cmp.calendar_items USING btree (company_id, obligation_code, period_label);


--
-- Name: evidence_item_idx; Type: INDEX; Schema: cmp; Owner: -
--

CREATE INDEX evidence_item_idx ON cmp.filing_evidence USING btree (calendar_item_id, recorded_at DESC);


--
-- Name: registrations_expiry_idx; Type: INDEX; Schema: cmp; Owner: -
--

CREATE INDEX registrations_expiry_idx ON cmp.registrations USING btree (valid_to) WHERE (is_active AND (valid_to IS NOT NULL));


--
-- Name: registrations_unique_live; Type: INDEX; Schema: cmp; Owner: -
--

CREATE UNIQUE INDEX registrations_unique_live ON cmp.registrations USING btree (company_id, COALESCE(location_id, (0)::bigint), kind, registration_no) WHERE is_active;


--
-- Name: audit_log_chain_seq_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE UNIQUE INDEX audit_log_chain_seq_idx ON core.audit_log USING btree (chain_seq);


--
-- Name: audit_log_entity_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX audit_log_entity_idx ON core.audit_log USING btree (entity, entity_id, at);


--
-- Name: audit_log_scope_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX audit_log_scope_idx ON core.audit_log USING btree (scope_org_unit_id, at DESC, id DESC);


--
-- Name: documents_expires_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX documents_expires_idx ON core.documents USING btree (expires_on) WHERE ((expires_on IS NOT NULL) AND (status = 'active'::text));


--
-- Name: documents_owner_kind_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX documents_owner_kind_idx ON core.documents USING btree (owner_employee_id, kind) WHERE (owner_employee_id IS NOT NULL);


--
-- Name: employees_ecode_trgm; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX employees_ecode_trgm ON core.employees USING gin (lower(ecode) public.gin_trgm_ops);


--
-- Name: employees_fullname_trgm; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX employees_fullname_trgm ON core.employees USING gin (lower(((COALESCE(first_name, ''::text) || ' '::text) || COALESCE(last_name, ''::text))) public.gin_trgm_ops);


--
-- Name: employees_hod_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX employees_hod_idx ON core.employees USING btree (hod_employee_id) WHERE (hod_employee_id IS NOT NULL);


--
-- Name: employees_rm_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX employees_rm_idx ON core.employees USING btree (reporting_manager_id);


--
-- Name: employees_status_company_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX employees_status_company_idx ON core.employees USING btree (status, company_id);


--
-- Name: idx_clearances_separation; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_clearances_separation ON core.clearances USING btree (separation_id);


--
-- Name: idx_employee_history_lookup; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_employee_history_lookup ON core.employee_history USING btree (employee_id, effective_date);


--
-- Name: idx_separations_employee; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_separations_employee ON core.separations USING btree (employee_id);


--
-- Name: idx_separations_status; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_separations_status ON core.separations USING btree (status);


--
-- Name: idx_transfers_effective_date; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_transfers_effective_date ON core.transfers USING btree (effective_date);


--
-- Name: idx_transfers_employee; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_transfers_employee ON core.transfers USING btree (employee_id);


--
-- Name: idx_transfers_status; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_transfers_status ON core.transfers USING btree (status);


--
-- Name: letters_emp_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX letters_emp_idx ON core.letters USING btree (employee_id);


--
-- Name: letters_wf_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE UNIQUE INDEX letters_wf_idx ON core.letters USING btree (workflow_request_id) WHERE (workflow_request_id IS NOT NULL);


--
-- Name: onboarding_candidates_company_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX onboarding_candidates_company_idx ON core.onboarding_candidates USING btree (company_id);


--
-- Name: onboarding_candidates_status_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX onboarding_candidates_status_idx ON core.onboarding_candidates USING btree (status);


--
-- Name: onboarding_tasks_emp_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX onboarding_tasks_emp_idx ON core.onboarding_tasks USING btree (employee_id);


--
-- Name: onboarding_tasks_status_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX onboarding_tasks_status_idx ON core.onboarding_tasks USING btree (status, due_date);


--
-- Name: password_reset_tokens_user; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX password_reset_tokens_user ON core.password_reset_tokens USING btree (user_id, created_at DESC);


--
-- Name: probation_reviews_due_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX probation_reviews_due_idx ON core.probation_reviews USING btree (due_date, status);


--
-- Name: probation_reviews_emp_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX probation_reviews_emp_idx ON core.probation_reviews USING btree (employee_id);


--
-- Name: announcements_live_idx; Type: INDEX; Schema: eng; Owner: -
--

CREATE INDEX announcements_live_idx ON eng.announcements USING btree (published_at DESC) WHERE is_active;


--
-- Name: poll_responses_one_per_anon; Type: INDEX; Schema: eng; Owner: -
--

CREATE UNIQUE INDEX poll_responses_one_per_anon ON eng.poll_responses USING btree (poll_id, respondent_hash) WHERE (respondent_hash IS NOT NULL);


--
-- Name: poll_responses_one_per_person; Type: INDEX; Schema: eng; Owner: -
--

CREATE UNIQUE INDEX poll_responses_one_per_person ON eng.poll_responses USING btree (poll_id, respondent_user_id) WHERE (respondent_user_id IS NOT NULL);


--
-- Name: poll_responses_tally_idx; Type: INDEX; Schema: eng; Owner: -
--

CREATE INDEX poll_responses_tally_idx ON eng.poll_responses USING btree (poll_id, option_index);


--
-- Name: survey_responses_one_per_hash; Type: INDEX; Schema: eng; Owner: -
--

CREATE UNIQUE INDEX survey_responses_one_per_hash ON eng.survey_responses USING btree (survey_id, respondent_hash) WHERE (respondent_hash IS NOT NULL);


--
-- Name: survey_responses_one_per_user; Type: INDEX; Schema: eng; Owner: -
--

CREATE UNIQUE INDEX survey_responses_one_per_user ON eng.survey_responses USING btree (survey_id, respondent_user_id) WHERE (respondent_user_id IS NOT NULL);


--
-- Name: surveys_active_idx; Type: INDEX; Schema: eng; Owner: -
--

CREATE INDEX surveys_active_idx ON eng.surveys USING btree (open_from, open_till) WHERE is_active;


--
-- Name: ticket_messages_thread_idx; Type: INDEX; Schema: hd; Owner: -
--

CREATE INDEX ticket_messages_thread_idx ON hd.ticket_messages USING btree (ticket_id, created_at);


--
-- Name: tickets_assignee_idx; Type: INDEX; Schema: hd; Owner: -
--

CREATE INDEX tickets_assignee_idx ON hd.tickets USING btree (assignee_user_id) WHERE (status = ANY (ARRAY['open'::text, 'pending'::text]));


--
-- Name: tickets_escalated_to_idx; Type: INDEX; Schema: hd; Owner: -
--

CREATE INDEX tickets_escalated_to_idx ON hd.tickets USING btree (escalated_to_user_id) WHERE (escalated_to_user_id IS NOT NULL);


--
-- Name: tickets_first_response_idx; Type: INDEX; Schema: hd; Owner: -
--

CREATE INDEX tickets_first_response_idx ON hd.tickets USING btree (first_response_at) WHERE (first_response_at IS NOT NULL);


--
-- Name: tickets_queue_idx; Type: INDEX; Schema: hd; Owner: -
--

CREATE INDEX tickets_queue_idx ON hd.tickets USING btree (status, sla_due_at);


--
-- Name: tickets_raiser_idx; Type: INDEX; Schema: hd; Owner: -
--

CREATE INDEX tickets_raiser_idx ON hd.tickets USING btree (raised_by, created_at DESC);


--
-- Name: grievances_ref_uq; Type: INDEX; Schema: ird; Owner: -
--

CREATE UNIQUE INDEX grievances_ref_uq ON ird.grievances USING btree (case_ref);


--
-- Name: ic_members_active_idx; Type: INDEX; Schema: ird; Owner: -
--

CREATE INDEX ic_members_active_idx ON ird.ic_members USING btree (active) WHERE active;


--
-- Name: posh_cases_anon_token_uq; Type: INDEX; Schema: ird; Owner: -
--

CREATE UNIQUE INDEX posh_cases_anon_token_uq ON ird.posh_cases USING btree (anonymous_token_hash) WHERE (anonymous_token_hash IS NOT NULL);


--
-- Name: posh_cases_ref_uq; Type: INDEX; Schema: ird; Owner: -
--

CREATE UNIQUE INDEX posh_cases_ref_uq ON ird.posh_cases USING btree (case_ref);


--
-- Name: whistle_token_uq; Type: INDEX; Schema: ird; Owner: -
--

CREATE UNIQUE INDEX whistle_token_uq ON ird.whistleblower_reports USING btree (anonymous_token_hash);


--
-- Name: lv_applications_cancel_wf_idx; Type: INDEX; Schema: lv; Owner: -
--

CREATE UNIQUE INDEX lv_applications_cancel_wf_idx ON lv.applications USING btree (cancel_workflow_request_id) WHERE (cancel_workflow_request_id IS NOT NULL);


--
-- Name: lv_applications_emp_idx; Type: INDEX; Schema: lv; Owner: -
--

CREATE INDEX lv_applications_emp_idx ON lv.applications USING btree (employee_id, from_date);


--
-- Name: lv_applications_wf_idx; Type: INDEX; Schema: lv; Owner: -
--

CREATE UNIQUE INDEX lv_applications_wf_idx ON lv.applications USING btree (workflow_request_id);


--
-- Name: lv_ledger_accrual_once; Type: INDEX; Schema: lv; Owner: -
--

CREATE UNIQUE INDEX lv_ledger_accrual_once ON lv.ledger USING btree (employee_id, leave_type_id, effective_date) WHERE (txn_type = 'accrual'::text);


--
-- Name: lv_ledger_emp_type_idx; Type: INDEX; Schema: lv; Owner: -
--

CREATE INDEX lv_ledger_emp_type_idx ON lv.ledger USING btree (employee_id, leave_type_id, effective_date);


--
-- Name: lv_rh_selections_wf_idx; Type: INDEX; Schema: lv; Owner: -
--

CREATE UNIQUE INDEX lv_rh_selections_wf_idx ON lv.rh_selections USING btree (workflow_request_id);


--
-- Name: arrears_emp_month_idx; Type: INDEX; Schema: pay; Owner: -
--

CREATE INDEX arrears_emp_month_idx ON pay.arrears USING btree (employee_id, for_month);


--
-- Name: budgets_company_idx; Type: INDEX; Schema: pay; Owner: -
--

CREATE INDEX budgets_company_idx ON pay.budgets USING btree (company_id, period_from);


--
-- Name: budgets_employee_idx; Type: INDEX; Schema: pay; Owner: -
--

CREATE INDEX budgets_employee_idx ON pay.budgets USING btree (employee_id, status);


--
-- Name: claim_lines_claim_idx; Type: INDEX; Schema: pay; Owner: -
--

CREATE INDEX claim_lines_claim_idx ON pay.claim_lines USING btree (claim_id);


--
-- Name: claim_reservations_budget_idx; Type: INDEX; Schema: pay; Owner: -
--

CREATE INDEX claim_reservations_budget_idx ON pay.claim_reservations USING btree (budget_id, occurred_at);


--
-- Name: claim_reservations_claim_idx; Type: INDEX; Schema: pay; Owner: -
--

CREATE INDEX claim_reservations_claim_idx ON pay.claim_reservations USING btree (claim_id);


--
-- Name: claims_budget_idx; Type: INDEX; Schema: pay; Owner: -
--

CREATE INDEX claims_budget_idx ON pay.claims USING btree (budget_id);


--
-- Name: claims_emp_idx; Type: INDEX; Schema: pay; Owner: -
--

CREATE INDEX claims_emp_idx ON pay.claims USING btree (employee_id, status);


--
-- Name: claims_employee_idx; Type: INDEX; Schema: pay; Owner: -
--

CREATE INDEX claims_employee_idx ON pay.claims USING btree (employee_id, status);


--
-- Name: claims_one_live_per_budget; Type: INDEX; Schema: pay; Owner: -
--

CREATE UNIQUE INDEX claims_one_live_per_budget ON pay.claims USING btree (budget_id) WHERE ((budget_id IS NOT NULL) AND (status <> 'rejected'::text));


--
-- Name: employee_salaries_emp_idx; Type: INDEX; Schema: pay; Owner: -
--

CREATE INDEX employee_salaries_emp_idx ON pay.employee_salaries USING btree (employee_id, effective_from DESC);


--
-- Name: loans_emp_idx; Type: INDEX; Schema: pay; Owner: -
--

CREATE INDEX loans_emp_idx ON pay.loans USING btree (employee_id, status);


--
-- Name: payroll_inputs_run_emp_idx; Type: INDEX; Schema: pay; Owner: -
--

CREATE INDEX payroll_inputs_run_emp_idx ON pay.inputs USING btree (run_id, employee_id);


--
-- Name: payroll_item_lines_item_idx; Type: INDEX; Schema: pay; Owner: -
--

CREATE INDEX payroll_item_lines_item_idx ON pay.payroll_item_lines USING btree (item_id);


--
-- Name: payroll_items_emp_idx; Type: INDEX; Schema: pay; Owner: -
--

CREATE INDEX payroll_items_emp_idx ON pay.payroll_items USING btree (employee_id);


--
-- Name: payroll_items_run_idx; Type: INDEX; Schema: pay; Owner: -
--

CREATE INDEX payroll_items_run_idx ON pay.payroll_items USING btree (run_id);


--
-- Name: payroll_runs_company_month_idx; Type: INDEX; Schema: pay; Owner: -
--

CREATE INDEX payroll_runs_company_month_idx ON pay.payroll_runs USING btree (company_id, month);


--
-- Name: pt_slabs_lookup_idx; Type: INDEX; Schema: pay; Owner: -
--

CREATE INDEX pt_slabs_lookup_idx ON pay.pt_slabs USING btree (state_code, effective_from DESC);


--
-- Name: salary_holds_emp_idx; Type: INDEX; Schema: pay; Owner: -
--

CREATE INDEX salary_holds_emp_idx ON pay.salary_holds USING btree (employee_id);


--
-- Name: salary_structures_company_idx; Type: INDEX; Schema: pay; Owner: -
--

CREATE INDEX salary_structures_company_idx ON pay.salary_structures USING btree (company_id, is_active);


--
-- Name: kpi_daily_lookup_idx; Type: INDEX; Schema: reporting; Owner: -
--

CREATE INDEX kpi_daily_lookup_idx ON reporting.kpi_daily USING btree (snapshot_date DESC, company_id, metric);


--
-- Name: muster_month_lookup_idx; Type: INDEX; Schema: reporting; Owner: -
--

CREATE INDEX muster_month_lookup_idx ON reporting.muster_month USING btree (company_id, month);


--
-- Name: muster_month_rm_idx; Type: INDEX; Schema: reporting; Owner: -
--

CREATE INDEX muster_month_rm_idx ON reporting.muster_month USING btree (month, reporting_manager);


--
-- Name: access_events_actor_idx; Type: INDEX; Schema: sec; Owner: -
--

CREATE INDEX access_events_actor_idx ON ONLY sec.access_events USING btree (actor_user_id, occurred_at DESC);


--
-- Name: access_events_202610_actor_user_id_occurred_at_idx; Type: INDEX; Schema: sec; Owner: -
--

CREATE INDEX access_events_202610_actor_user_id_occurred_at_idx ON sec.access_events_202610 USING btree (actor_user_id, occurred_at DESC);


--
-- Name: access_events_subject_idx; Type: INDEX; Schema: sec; Owner: -
--

CREATE INDEX access_events_subject_idx ON ONLY sec.access_events USING btree (subject_employee_id, occurred_at DESC);


--
-- Name: access_events_202610_subject_employee_id_occurred_at_idx; Type: INDEX; Schema: sec; Owner: -
--

CREATE INDEX access_events_202610_subject_employee_id_occurred_at_idx ON sec.access_events_202610 USING btree (subject_employee_id, occurred_at DESC);


--
-- Name: access_events_202611_actor_user_id_occurred_at_idx; Type: INDEX; Schema: sec; Owner: -
--

CREATE INDEX access_events_202611_actor_user_id_occurred_at_idx ON sec.access_events_202611 USING btree (actor_user_id, occurred_at DESC);


--
-- Name: access_events_202611_subject_employee_id_occurred_at_idx; Type: INDEX; Schema: sec; Owner: -
--

CREATE INDEX access_events_202611_subject_employee_id_occurred_at_idx ON sec.access_events_202611 USING btree (subject_employee_id, occurred_at DESC);


--
-- Name: mfa_one_active_per_user; Type: INDEX; Schema: sec; Owner: -
--

CREATE UNIQUE INDEX mfa_one_active_per_user ON sec.mfa_enrolments USING btree (user_id) WHERE (disabled_at IS NULL);


--
-- Name: mfa_recovery_enrolment_idx; Type: INDEX; Schema: sec; Owner: -
--

CREATE INDEX mfa_recovery_enrolment_idx ON sec.mfa_recovery_codes USING btree (enrolment_id);


--
-- Name: password_history_user_idx; Type: INDEX; Schema: sec; Owner: -
--

CREATE INDEX password_history_user_idx ON sec.password_history USING btree (user_id, changed_at DESC);


--
-- Name: sessions_sid_live_idx; Type: INDEX; Schema: sec; Owner: -
--

CREATE INDEX sessions_sid_live_idx ON sec.sessions USING btree (sid) WHERE (revoked_at IS NULL);


--
-- Name: sessions_user_idx; Type: INDEX; Schema: sec; Owner: -
--

CREATE INDEX sessions_user_idx ON sec.sessions USING btree (user_id, last_seen_at DESC);


--
-- Name: idx_te_advances_employee; Type: INDEX; Schema: te; Owner: -
--

CREATE INDEX idx_te_advances_employee ON te.advances USING btree (employee_id);


--
-- Name: idx_te_advances_trip; Type: INDEX; Schema: te; Owner: -
--

CREATE INDEX idx_te_advances_trip ON te.advances USING btree (trip_id);


--
-- Name: idx_te_claim_items_claim; Type: INDEX; Schema: te; Owner: -
--

CREATE INDEX idx_te_claim_items_claim ON te.claim_items USING btree (claim_id);


--
-- Name: idx_te_claims_employee; Type: INDEX; Schema: te; Owner: -
--

CREATE INDEX idx_te_claims_employee ON te.claims USING btree (employee_id);


--
-- Name: idx_te_claims_trip; Type: INDEX; Schema: te; Owner: -
--

CREATE INDEX idx_te_claims_trip ON te.claims USING btree (trip_id);


--
-- Name: idx_te_itineraries_trip; Type: INDEX; Schema: te; Owner: -
--

CREATE INDEX idx_te_itineraries_trip ON te.trip_itineraries USING btree (trip_id);


--
-- Name: idx_te_settlements_claim; Type: INDEX; Schema: te; Owner: -
--

CREATE INDEX idx_te_settlements_claim ON te.settlements USING btree (claim_id);


--
-- Name: idx_te_settlements_employee; Type: INDEX; Schema: te; Owner: -
--

CREATE INDEX idx_te_settlements_employee ON te.settlements USING btree (employee_id);


--
-- Name: idx_te_trips_employee; Type: INDEX; Schema: te; Owner: -
--

CREATE INDEX idx_te_trips_employee ON te.trips USING btree (employee_id);


--
-- Name: idx_te_trips_status; Type: INDEX; Schema: te; Owner: -
--

CREATE INDEX idx_te_trips_status ON te.trips USING btree (status);


--
-- Name: idx_te_wallet_tx_employee; Type: INDEX; Schema: te; Owner: -
--

CREATE INDEX idx_te_wallet_tx_employee ON te.wallet_transactions USING btree (employee_id);


--
-- Name: idx_te_wallet_tx_wallet; Type: INDEX; Schema: te; Owner: -
--

CREATE INDEX idx_te_wallet_tx_wallet ON te.wallet_transactions USING btree (wallet_id);


--
-- Name: idx_te_wallets_employee; Type: INDEX; Schema: te; Owner: -
--

CREATE INDEX idx_te_wallets_employee ON te.wallets USING btree (employee_id);


--
-- Name: notifications_inbox_idx; Type: INDEX; Schema: wf; Owner: -
--

CREATE INDEX notifications_inbox_idx ON wf.notifications USING btree (recipient_user_id, read_at) WHERE (channel = 'in_app'::text);


--
-- Name: notifications_queue_idx; Type: INDEX; Schema: wf; Owner: -
--

CREATE INDEX notifications_queue_idx ON wf.notifications USING btree (status, created_at) WHERE (status = ANY (ARRAY['queued'::text, 'failed'::text]));


--
-- Name: wf_one_open_step_per_request; Type: INDEX; Schema: wf; Owner: -
--

CREATE UNIQUE INDEX wf_one_open_step_per_request ON wf.request_steps USING btree (request_id) WHERE (action IS NULL);


--
-- Name: wf_request_steps_inbox_idx; Type: INDEX; Schema: wf; Owner: -
--

CREATE INDEX wf_request_steps_inbox_idx ON wf.request_steps USING btree (approver_user_id) WHERE (action IS NULL);


--
-- Name: wf_request_steps_request_idx; Type: INDEX; Schema: wf; Owner: -
--

CREATE INDEX wf_request_steps_request_idx ON wf.request_steps USING btree (request_id, id);


--
-- Name: wf_request_steps_sla_idx; Type: INDEX; Schema: wf; Owner: -
--

CREATE INDEX wf_request_steps_sla_idx ON wf.request_steps USING btree (sla_due_at) WHERE (action IS NULL);


--
-- Name: wf_requests_subject_idx; Type: INDEX; Schema: wf; Owner: -
--

CREATE INDEX wf_requests_subject_idx ON wf.requests USING btree (subject_employee_id, status);


--
-- Name: swipe_events_202610_employee_id_swipe_ts_idx; Type: INDEX ATTACH; Schema: att; Owner: -
--

ALTER INDEX att.swipe_events_emp_ts_idx ATTACH PARTITION att.swipe_events_202610_employee_id_swipe_ts_idx;


--
-- Name: swipe_events_202610_employee_no_swipe_ts_door_code_key; Type: INDEX ATTACH; Schema: att; Owner: -
--

ALTER INDEX att.swipe_events_employee_no_swipe_ts_door_code_key ATTACH PARTITION att.swipe_events_202610_employee_no_swipe_ts_door_code_key;


--
-- Name: swipe_events_202610_pkey; Type: INDEX ATTACH; Schema: att; Owner: -
--

ALTER INDEX att.swipe_events_pkey ATTACH PARTITION att.swipe_events_202610_pkey;


--
-- Name: swipe_events_202610_swipe_ts_idx; Type: INDEX ATTACH; Schema: att; Owner: -
--

ALTER INDEX att.swipe_events_ts_brin ATTACH PARTITION att.swipe_events_202610_swipe_ts_idx;


--
-- Name: swipe_events_202611_employee_id_swipe_ts_idx; Type: INDEX ATTACH; Schema: att; Owner: -
--

ALTER INDEX att.swipe_events_emp_ts_idx ATTACH PARTITION att.swipe_events_202611_employee_id_swipe_ts_idx;


--
-- Name: swipe_events_202611_employee_no_swipe_ts_door_code_key; Type: INDEX ATTACH; Schema: att; Owner: -
--

ALTER INDEX att.swipe_events_employee_no_swipe_ts_door_code_key ATTACH PARTITION att.swipe_events_202611_employee_no_swipe_ts_door_code_key;


--
-- Name: swipe_events_202611_pkey; Type: INDEX ATTACH; Schema: att; Owner: -
--

ALTER INDEX att.swipe_events_pkey ATTACH PARTITION att.swipe_events_202611_pkey;


--
-- Name: swipe_events_202611_swipe_ts_idx; Type: INDEX ATTACH; Schema: att; Owner: -
--

ALTER INDEX att.swipe_events_ts_brin ATTACH PARTITION att.swipe_events_202611_swipe_ts_idx;


--
-- Name: access_events_202610_actor_user_id_occurred_at_idx; Type: INDEX ATTACH; Schema: sec; Owner: -
--

ALTER INDEX sec.access_events_actor_idx ATTACH PARTITION sec.access_events_202610_actor_user_id_occurred_at_idx;


--
-- Name: access_events_202610_pkey; Type: INDEX ATTACH; Schema: sec; Owner: -
--

ALTER INDEX sec.access_events_pkey ATTACH PARTITION sec.access_events_202610_pkey;


--
-- Name: access_events_202610_subject_employee_id_occurred_at_idx; Type: INDEX ATTACH; Schema: sec; Owner: -
--

ALTER INDEX sec.access_events_subject_idx ATTACH PARTITION sec.access_events_202610_subject_employee_id_occurred_at_idx;


--
-- Name: access_events_202611_actor_user_id_occurred_at_idx; Type: INDEX ATTACH; Schema: sec; Owner: -
--

ALTER INDEX sec.access_events_actor_idx ATTACH PARTITION sec.access_events_202611_actor_user_id_occurred_at_idx;


--
-- Name: access_events_202611_pkey; Type: INDEX ATTACH; Schema: sec; Owner: -
--

ALTER INDEX sec.access_events_pkey ATTACH PARTITION sec.access_events_202611_pkey;


--
-- Name: access_events_202611_subject_employee_id_occurred_at_idx; Type: INDEX ATTACH; Schema: sec; Owner: -
--

ALTER INDEX sec.access_events_subject_idx ATTACH PARTITION sec.access_events_202611_subject_employee_id_occurred_at_idx;


--
-- Name: absence_cases absence_cases_updated_at; Type: TRIGGER; Schema: att; Owner: -
--

CREATE TRIGGER absence_cases_updated_at BEFORE UPDATE ON att.absence_cases FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: coverage_targets coverage_targets_updated_at; Type: TRIGGER; Schema: att; Owner: -
--

CREATE TRIGGER coverage_targets_updated_at BEFORE UPDATE ON att.coverage_targets FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: day_records day_records_invalidate_manager_approval; Type: TRIGGER; Schema: att; Owner: -
--

CREATE TRIGGER day_records_invalidate_manager_approval AFTER INSERT OR DELETE OR UPDATE ON att.day_records FOR EACH ROW EXECUTE FUNCTION att.invalidate_manager_month_approval();


--
-- Name: day_records day_records_lock_guard; Type: TRIGGER; Schema: att; Owner: -
--

CREATE TRIGGER day_records_lock_guard BEFORE DELETE OR UPDATE ON att.day_records FOR EACH ROW EXECUTE FUNCTION att.day_records_lock_guard();


--
-- Name: day_records day_records_month_lock_guard; Type: TRIGGER; Schema: att; Owner: -
--

CREATE TRIGGER day_records_month_lock_guard BEFORE INSERT OR UPDATE ON att.day_records FOR EACH ROW EXECUTE FUNCTION att.day_records_month_lock_guard();


--
-- Name: day_records day_records_updated_at; Type: TRIGGER; Schema: att; Owner: -
--

CREATE TRIGGER day_records_updated_at BEFORE UPDATE ON att.day_records FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: device_watermarks device_watermark_monotonic; Type: TRIGGER; Schema: att; Owner: -
--

CREATE TRIGGER device_watermark_monotonic BEFORE UPDATE ON att.device_watermarks FOR EACH ROW EXECUTE FUNCTION att.device_watermark_monotonic();


--
-- Name: devices devices_updated_at; Type: TRIGGER; Schema: att; Owner: -
--

CREATE TRIGGER devices_updated_at BEFORE UPDATE ON att.devices FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: employee_shifts employee_shifts_updated_at; Type: TRIGGER; Schema: att; Owner: -
--

CREATE TRIGGER employee_shifts_updated_at BEFORE UPDATE ON att.employee_shifts FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: holidays holidays_updated_at; Type: TRIGGER; Schema: att; Owner: -
--

CREATE TRIGGER holidays_updated_at BEFORE UPDATE ON att.holidays FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: leave_blackouts leave_blackouts_updated_at; Type: TRIGGER; Schema: att; Owner: -
--

CREATE TRIGGER leave_blackouts_updated_at BEFORE UPDATE ON att.leave_blackouts FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: manager_month_approvals manager_month_approvals_append_only; Type: TRIGGER; Schema: att; Owner: -
--

CREATE TRIGGER manager_month_approvals_append_only BEFORE DELETE OR UPDATE ON att.manager_month_approvals FOR EACH ROW EXECUTE FUNCTION att.reject_manager_approval_mutation();


--
-- Name: month_locks month_locks_immutable; Type: TRIGGER; Schema: att; Owner: -
--

CREATE TRIGGER month_locks_immutable BEFORE DELETE OR UPDATE ON att.month_locks FOR EACH ROW EXECUTE FUNCTION att.month_locks_immutable();


--
-- Name: overtime_entries overtime_entries_updated_at; Type: TRIGGER; Schema: att; Owner: -
--

CREATE TRIGGER overtime_entries_updated_at BEFORE UPDATE ON att.overtime_entries FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: regularizations regularizations_updated_at; Type: TRIGGER; Schema: att; Owner: -
--

CREATE TRIGGER regularizations_updated_at BEFORE UPDATE ON att.regularizations FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: roster_revisions roster_revisions_immutable; Type: TRIGGER; Schema: att; Owner: -
--

CREATE TRIGGER roster_revisions_immutable BEFORE DELETE OR UPDATE ON att.roster_revisions FOR EACH ROW EXECUTE FUNCTION att.roster_revisions_immutable();


--
-- Name: rosters rosters_invalidate_manager_approval; Type: TRIGGER; Schema: att; Owner: -
--

CREATE TRIGGER rosters_invalidate_manager_approval AFTER INSERT OR DELETE OR UPDATE ON att.rosters FOR EACH ROW EXECUTE FUNCTION att.invalidate_manager_month_approval();


--
-- Name: rosters rosters_updated_at; Type: TRIGGER; Schema: att; Owner: -
--

CREATE TRIGGER rosters_updated_at BEFORE UPDATE ON att.rosters FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: shift_patterns shift_patterns_updated_at; Type: TRIGGER; Schema: att; Owner: -
--

CREATE TRIGGER shift_patterns_updated_at BEFORE UPDATE ON att.shift_patterns FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: shifts shifts_updated_at; Type: TRIGGER; Schema: att; Owner: -
--

CREATE TRIGGER shifts_updated_at BEFORE UPDATE ON att.shifts FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: swipe_events swipe_events_enqueue_recompute; Type: TRIGGER; Schema: att; Owner: -
--

CREATE TRIGGER swipe_events_enqueue_recompute AFTER INSERT ON att.swipe_events FOR EACH ROW EXECUTE FUNCTION att.enqueue_recompute();


--
-- Name: swipe_events swipe_events_immutable; Type: TRIGGER; Schema: att; Owner: -
--

CREATE TRIGGER swipe_events_immutable BEFORE DELETE OR UPDATE ON att.swipe_events FOR EACH ROW EXECUTE FUNCTION att.swipe_events_immutable();


--
-- Name: calendar_items calendar_items_updated_at; Type: TRIGGER; Schema: cmp; Owner: -
--

CREATE TRIGGER calendar_items_updated_at BEFORE UPDATE ON cmp.calendar_items FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: filing_evidence filing_evidence_immutable; Type: TRIGGER; Schema: cmp; Owner: -
--

CREATE TRIGGER filing_evidence_immutable BEFORE DELETE OR UPDATE ON cmp.filing_evidence FOR EACH ROW EXECUTE FUNCTION cmp.filing_evidence_immutable();


--
-- Name: registrations registrations_updated_at; Type: TRIGGER; Schema: cmp; Owner: -
--

CREATE TRIGGER registrations_updated_at BEFORE UPDATE ON cmp.registrations FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: audit_log audit_log_chain; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER audit_log_chain BEFORE INSERT ON core.audit_log FOR EACH ROW EXECUTE FUNCTION core.audit_log_chain();


--
-- Name: audit_log audit_log_immutable; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER audit_log_immutable BEFORE DELETE OR UPDATE ON core.audit_log FOR EACH ROW EXECUTE FUNCTION core.audit_log_immutable();


--
-- Name: companies companies_updated_at; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER companies_updated_at BEFORE UPDATE ON core.companies FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: cost_centers cost_centers_updated_at; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER cost_centers_updated_at BEFORE UPDATE ON core.cost_centers FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: departments departments_updated_at; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER departments_updated_at BEFORE UPDATE ON core.departments FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: designations designations_updated_at; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER designations_updated_at BEFORE UPDATE ON core.designations FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: documents documents_updated_at; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER documents_updated_at BEFORE UPDATE ON core.documents FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: employee_family employee_family_updated_at; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER employee_family_updated_at BEFORE UPDATE ON core.employee_family FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: employee_history employee_history_updated_at; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER employee_history_updated_at BEFORE UPDATE ON core.employee_history FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: employees employees_reporting_tree; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER employees_reporting_tree AFTER INSERT OR DELETE OR UPDATE OF reporting_manager_id ON core.employees FOR EACH STATEMENT EXECUTE FUNCTION core.rebuild_reporting_tree();


--
-- Name: employees employees_updated_at; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER employees_updated_at BEFORE UPDATE ON core.employees FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: grades grades_updated_at; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER grades_updated_at BEFORE UPDATE ON core.grades FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: letter_templates letter_templates_updated_at; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER letter_templates_updated_at BEFORE UPDATE ON core.letter_templates FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: letters letters_updated_at; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER letters_updated_at BEFORE UPDATE ON core.letters FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: locations locations_updated_at; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER locations_updated_at BEFORE UPDATE ON core.locations FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: mis_codes mis_codes_updated_at; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER mis_codes_updated_at BEFORE UPDATE ON core.mis_codes FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: org_units org_units_updated_at; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER org_units_updated_at BEFORE UPDATE ON core.org_units FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: permissions permissions_updated_at; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER permissions_updated_at BEFORE UPDATE ON core.permissions FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: plants plants_updated_at; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER plants_updated_at BEFORE UPDATE ON core.plants FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: policies policies_updated_at; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER policies_updated_at BEFORE UPDATE ON core.policies FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: role_permissions role_permissions_keep_one_super_admin_del; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER role_permissions_keep_one_super_admin_del AFTER DELETE ON core.role_permissions REFERENCING OLD TABLE AS removed FOR EACH STATEMENT EXECUTE FUNCTION core.assert_super_admin_remains();


--
-- Name: role_permissions role_permissions_keep_one_super_admin_upd; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER role_permissions_keep_one_super_admin_upd AFTER UPDATE ON core.role_permissions REFERENCING OLD TABLE AS removed FOR EACH STATEMENT EXECUTE FUNCTION core.assert_super_admin_remains();


--
-- Name: role_permissions role_permissions_serialize_admin_changes; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER role_permissions_serialize_admin_changes BEFORE DELETE OR UPDATE ON core.role_permissions FOR EACH STATEMENT EXECUTE FUNCTION core.serialize_admin_changes();


--
-- Name: role_permissions role_permissions_updated_at; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER role_permissions_updated_at BEFORE UPDATE ON core.role_permissions FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: roles roles_updated_at; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER roles_updated_at BEFORE UPDATE ON core.roles FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: settings settings_updated_at; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER settings_updated_at BEFORE UPDATE ON core.settings FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: user_roles user_roles_keep_one_super_admin_del; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER user_roles_keep_one_super_admin_del AFTER DELETE ON core.user_roles REFERENCING OLD TABLE AS removed FOR EACH STATEMENT EXECUTE FUNCTION core.assert_super_admin_remains();


--
-- Name: user_roles user_roles_keep_one_super_admin_upd; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER user_roles_keep_one_super_admin_upd AFTER UPDATE ON core.user_roles REFERENCING OLD TABLE AS removed FOR EACH STATEMENT EXECUTE FUNCTION core.assert_super_admin_remains();


--
-- Name: user_roles user_roles_serialize_admin_changes; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER user_roles_serialize_admin_changes BEFORE INSERT OR DELETE OR UPDATE ON core.user_roles FOR EACH STATEMENT EXECUTE FUNCTION core.serialize_admin_changes();


--
-- Name: user_roles user_roles_updated_at; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER user_roles_updated_at BEFORE UPDATE ON core.user_roles FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: users users_keep_one_super_admin; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER users_keep_one_super_admin AFTER UPDATE ON core.users REFERENCING OLD TABLE AS removed FOR EACH STATEMENT EXECUTE FUNCTION core.assert_super_admin_remains();


--
-- Name: users users_serialize_admin_changes; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER users_serialize_admin_changes BEFORE DELETE OR UPDATE ON core.users FOR EACH STATEMENT EXECUTE FUNCTION core.serialize_admin_changes();


--
-- Name: users users_updated_at; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER users_updated_at BEFORE UPDATE ON core.users FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: types doc_types_updated_at; Type: TRIGGER; Schema: doc; Owner: -
--

CREATE TRIGGER doc_types_updated_at BEFORE UPDATE ON doc.types FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: ticket_messages ticket_messages_append_only; Type: TRIGGER; Schema: hd; Owner: -
--

CREATE TRIGGER ticket_messages_append_only BEFORE DELETE OR UPDATE ON hd.ticket_messages FOR EACH ROW EXECUTE FUNCTION hd.reject_message_mutation();


--
-- Name: posh_case_access_log posh_access_log_immutable; Type: TRIGGER; Schema: ird; Owner: -
--

CREATE TRIGGER posh_access_log_immutable BEFORE DELETE OR UPDATE ON ird.posh_case_access_log FOR EACH ROW EXECUTE FUNCTION ird.posh_access_log_immutable();


--
-- Name: applications applications_updated_at; Type: TRIGGER; Schema: lv; Owner: -
--

CREATE TRIGGER applications_updated_at BEFORE UPDATE ON lv.applications FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: leave_types leave_types_updated_at; Type: TRIGGER; Schema: lv; Owner: -
--

CREATE TRIGGER leave_types_updated_at BEFORE UPDATE ON lv.leave_types FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: ledger ledger_immutable; Type: TRIGGER; Schema: lv; Owner: -
--

CREATE TRIGGER ledger_immutable BEFORE DELETE OR UPDATE ON lv.ledger FOR EACH ROW EXECUTE FUNCTION lv.ledger_immutable();


--
-- Name: rh_selections rh_selections_updated_at; Type: TRIGGER; Schema: lv; Owner: -
--

CREATE TRIGGER rh_selections_updated_at BEFORE UPDATE ON lv.rh_selections FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: budgets budgets_updated_at; Type: TRIGGER; Schema: pay; Owner: -
--

CREATE TRIGGER budgets_updated_at BEFORE UPDATE ON pay.budgets FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: claim_reservations claim_reservations_immutable; Type: TRIGGER; Schema: pay; Owner: -
--

CREATE TRIGGER claim_reservations_immutable BEFORE DELETE OR UPDATE ON pay.claim_reservations FOR EACH ROW EXECUTE FUNCTION pay.claim_reservations_immutable();


--
-- Name: claim_types claim_types_updated_at; Type: TRIGGER; Schema: pay; Owner: -
--

CREATE TRIGGER claim_types_updated_at BEFORE UPDATE ON pay.claim_types FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: claims claims_updated_at; Type: TRIGGER; Schema: pay; Owner: -
--

CREATE TRIGGER claims_updated_at BEFORE UPDATE ON pay.claims FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: gl_accounts gl_accounts_org_codes_guard; Type: TRIGGER; Schema: pay; Owner: -
--

CREATE TRIGGER gl_accounts_org_codes_guard BEFORE INSERT OR UPDATE OF company_code, plant_code, cost_center_code, component_code ON pay.gl_accounts FOR EACH ROW EXECUTE FUNCTION pay.validate_gl_account_org_codes();


--
-- Name: payroll_items trg_payroll_items_immutability; Type: TRIGGER; Schema: pay; Owner: -
--

CREATE TRIGGER trg_payroll_items_immutability BEFORE DELETE OR UPDATE ON pay.payroll_items FOR EACH ROW EXECUTE FUNCTION pay.enforce_finalized_items_immutability();


--
-- Name: payroll_runs trg_payroll_runs_immutability; Type: TRIGGER; Schema: pay; Owner: -
--

CREATE TRIGGER trg_payroll_runs_immutability BEFORE DELETE OR UPDATE ON pay.payroll_runs FOR EACH ROW EXECUTE FUNCTION pay.enforce_finalized_run_immutability();


--
-- Name: breach_register breach_register_immutable; Type: TRIGGER; Schema: prv; Owner: -
--

CREATE TRIGGER breach_register_immutable BEFORE DELETE OR UPDATE ON prv.breach_register FOR EACH ROW EXECUTE FUNCTION prv.breach_register_immutable();


--
-- Name: consent_events consent_events_immutable; Type: TRIGGER; Schema: prv; Owner: -
--

CREATE TRIGGER consent_events_immutable BEFORE DELETE OR UPDATE ON prv.consent_events FOR EACH ROW EXECUTE FUNCTION prv.consent_events_immutable();


--
-- Name: processing_register processing_register_updated_at; Type: TRIGGER; Schema: prv; Owner: -
--

CREATE TRIGGER processing_register_updated_at BEFORE UPDATE ON prv.processing_register FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: processors processors_updated_at; Type: TRIGGER; Schema: prv; Owner: -
--

CREATE TRIGGER processors_updated_at BEFORE UPDATE ON prv.processors FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: purge_log purge_log_immutable; Type: TRIGGER; Schema: prv; Owner: -
--

CREATE TRIGGER purge_log_immutable BEFORE DELETE OR UPDATE ON prv.purge_log FOR EACH ROW EXECUTE FUNCTION prv.purge_log_immutable();


--
-- Name: access_events access_events_immutable; Type: TRIGGER; Schema: sec; Owner: -
--

CREATE TRIGGER access_events_immutable BEFORE DELETE OR UPDATE ON sec.access_events FOR EACH ROW EXECUTE FUNCTION sec.access_events_immutable();


--
-- Name: mfa_enrolments mfa_enrolments_updated_at; Type: TRIGGER; Schema: sec; Owner: -
--

CREATE TRIGGER mfa_enrolments_updated_at BEFORE UPDATE ON sec.mfa_enrolments FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: wallet_transactions trg_no_update_delete_wallet_transactions; Type: TRIGGER; Schema: te; Owner: -
--

CREATE TRIGGER trg_no_update_delete_wallet_transactions BEFORE DELETE OR UPDATE ON te.wallet_transactions FOR EACH ROW EXECUTE FUNCTION te.reject_wallet_tx_mutation();


--
-- Name: event_subscriptions event_subscriptions_updated_at; Type: TRIGGER; Schema: wf; Owner: -
--

CREATE TRIGGER event_subscriptions_updated_at BEFORE UPDATE ON wf.event_subscriptions FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: notifications notifications_updated_at; Type: TRIGGER; Schema: wf; Owner: -
--

CREATE TRIGGER notifications_updated_at BEFORE UPDATE ON wf.notifications FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: definitions wf_definitions_updated_at; Type: TRIGGER; Schema: wf; Owner: -
--

CREATE TRIGGER wf_definitions_updated_at BEFORE UPDATE ON wf.definitions FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: delegations wf_delegations_updated_at; Type: TRIGGER; Schema: wf; Owner: -
--

CREATE TRIGGER wf_delegations_updated_at BEFORE UPDATE ON wf.delegations FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: requests wf_requests_updated_at; Type: TRIGGER; Schema: wf; Owner: -
--

CREATE TRIGGER wf_requests_updated_at BEFORE UPDATE ON wf.requests FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: assets assets_company_id_fkey; Type: FK CONSTRAINT; Schema: ast; Owner: -
--

ALTER TABLE ONLY ast.assets
    ADD CONSTRAINT assets_company_id_fkey FOREIGN KEY (company_id) REFERENCES core.companies(id);


--
-- Name: assets assets_created_by_fkey; Type: FK CONSTRAINT; Schema: ast; Owner: -
--

ALTER TABLE ONLY ast.assets
    ADD CONSTRAINT assets_created_by_fkey FOREIGN KEY (created_by) REFERENCES core.users(id);


--
-- Name: assets assets_location_id_fkey; Type: FK CONSTRAINT; Schema: ast; Owner: -
--

ALTER TABLE ONLY ast.assets
    ADD CONSTRAINT assets_location_id_fkey FOREIGN KEY (location_id) REFERENCES core.locations(id);


--
-- Name: assignments assignments_asset_id_fkey; Type: FK CONSTRAINT; Schema: ast; Owner: -
--

ALTER TABLE ONLY ast.assignments
    ADD CONSTRAINT assignments_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES ast.assets(id);


--
-- Name: assignments assignments_assigned_by_fkey; Type: FK CONSTRAINT; Schema: ast; Owner: -
--

ALTER TABLE ONLY ast.assignments
    ADD CONSTRAINT assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES core.users(id);


--
-- Name: assignments assignments_employee_id_fkey; Type: FK CONSTRAINT; Schema: ast; Owner: -
--

ALTER TABLE ONLY ast.assignments
    ADD CONSTRAINT assignments_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES core.employees(id);


--
-- Name: assignments assignments_returned_by_fkey; Type: FK CONSTRAINT; Schema: ast; Owner: -
--

ALTER TABLE ONLY ast.assignments
    ADD CONSTRAINT assignments_returned_by_fkey FOREIGN KEY (returned_by) REFERENCES core.users(id);


--
-- Name: maintenance maintenance_asset_id_fkey; Type: FK CONSTRAINT; Schema: ast; Owner: -
--

ALTER TABLE ONLY ast.maintenance
    ADD CONSTRAINT maintenance_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES ast.assets(id);


--
-- Name: maintenance maintenance_reported_by_fkey; Type: FK CONSTRAINT; Schema: ast; Owner: -
--

ALTER TABLE ONLY ast.maintenance
    ADD CONSTRAINT maintenance_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES core.users(id);


--
-- Name: absence_cases absence_cases_employee_id_fkey; Type: FK CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.absence_cases
    ADD CONSTRAINT absence_cases_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES core.employees(id);


--
-- Name: absence_cases absence_cases_hr_owner_id_fkey; Type: FK CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.absence_cases
    ADD CONSTRAINT absence_cases_hr_owner_id_fkey FOREIGN KEY (hr_owner_id) REFERENCES core.users(id);


--
-- Name: absence_cases absence_cases_letter_id_fkey; Type: FK CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.absence_cases
    ADD CONSTRAINT absence_cases_letter_id_fkey FOREIGN KEY (letter_id) REFERENCES core.letters(id);


--
-- Name: coverage_targets coverage_targets_department_id_fkey; Type: FK CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.coverage_targets
    ADD CONSTRAINT coverage_targets_department_id_fkey FOREIGN KEY (department_id) REFERENCES core.departments(id);


--
-- Name: coverage_targets coverage_targets_location_id_fkey; Type: FK CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.coverage_targets
    ADD CONSTRAINT coverage_targets_location_id_fkey FOREIGN KEY (location_id) REFERENCES core.locations(id);


--
-- Name: coverage_targets coverage_targets_shift_id_fkey; Type: FK CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.coverage_targets
    ADD CONSTRAINT coverage_targets_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES att.shifts(id);


--
-- Name: coverage_targets coverage_targets_updated_by_fkey; Type: FK CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.coverage_targets
    ADD CONSTRAINT coverage_targets_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES core.users(id);


--
-- Name: day_records day_records_employee_id_fkey; Type: FK CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.day_records
    ADD CONSTRAINT day_records_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES core.employees(id);


--
-- Name: day_records day_records_leave_type_fk; Type: FK CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.day_records
    ADD CONSTRAINT day_records_leave_type_fk FOREIGN KEY (leave_type_id) REFERENCES lv.leave_types(id);


--
-- Name: day_records day_records_shift_id_fkey; Type: FK CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.day_records
    ADD CONSTRAINT day_records_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES att.shifts(id);


--
-- Name: device_watermarks device_watermarks_device_id_fkey; Type: FK CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.device_watermarks
    ADD CONSTRAINT device_watermarks_device_id_fkey FOREIGN KEY (device_id) REFERENCES att.devices(id) ON DELETE CASCADE;


--
-- Name: devices devices_location_id_fkey; Type: FK CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.devices
    ADD CONSTRAINT devices_location_id_fkey FOREIGN KEY (location_id) REFERENCES core.locations(id);


--
-- Name: employee_shifts employee_shifts_employee_id_fkey; Type: FK CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.employee_shifts
    ADD CONSTRAINT employee_shifts_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES core.employees(id);


--
-- Name: employee_shifts employee_shifts_saturday_shift_id_fkey; Type: FK CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.employee_shifts
    ADD CONSTRAINT employee_shifts_saturday_shift_id_fkey FOREIGN KEY (saturday_shift_id) REFERENCES att.shifts(id);


--
-- Name: employee_shifts employee_shifts_updated_by_fkey; Type: FK CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.employee_shifts
    ADD CONSTRAINT employee_shifts_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES core.users(id);


--
-- Name: employee_shifts employee_shifts_weekday_shift_id_fkey; Type: FK CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.employee_shifts
    ADD CONSTRAINT employee_shifts_weekday_shift_id_fkey FOREIGN KEY (weekday_shift_id) REFERENCES att.shifts(id);


--
-- Name: holidays holidays_location_id_fkey; Type: FK CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.holidays
    ADD CONSTRAINT holidays_location_id_fkey FOREIGN KEY (location_id) REFERENCES core.locations(id);


--
-- Name: leave_blackouts leave_blackouts_location_id_fkey; Type: FK CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.leave_blackouts
    ADD CONSTRAINT leave_blackouts_location_id_fkey FOREIGN KEY (location_id) REFERENCES core.locations(id);


--
-- Name: manager_month_approvals manager_month_approvals_approved_by_user_id_fkey; Type: FK CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.manager_month_approvals
    ADD CONSTRAINT manager_month_approvals_approved_by_user_id_fkey FOREIGN KEY (approved_by_user_id) REFERENCES core.users(id);


--
-- Name: manager_month_approvals manager_month_approvals_company_id_fkey; Type: FK CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.manager_month_approvals
    ADD CONSTRAINT manager_month_approvals_company_id_fkey FOREIGN KEY (company_id) REFERENCES core.companies(id);


--
-- Name: manager_month_approvals manager_month_approvals_manager_employee_id_fkey; Type: FK CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.manager_month_approvals
    ADD CONSTRAINT manager_month_approvals_manager_employee_id_fkey FOREIGN KEY (manager_employee_id) REFERENCES core.employees(id);


--
-- Name: month_locks month_locks_company_id_fkey; Type: FK CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.month_locks
    ADD CONSTRAINT month_locks_company_id_fkey FOREIGN KEY (company_id) REFERENCES core.companies(id);


--
-- Name: month_locks month_locks_locked_by_fkey; Type: FK CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.month_locks
    ADD CONSTRAINT month_locks_locked_by_fkey FOREIGN KEY (locked_by) REFERENCES core.users(id);


--
-- Name: overtime_entries overtime_entries_comp_off_credit_fk; Type: FK CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.overtime_entries
    ADD CONSTRAINT overtime_entries_comp_off_credit_fk FOREIGN KEY (comp_off_credit_id) REFERENCES lv.ledger(id);


--
-- Name: overtime_entries overtime_entries_employee_id_fkey; Type: FK CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.overtime_entries
    ADD CONSTRAINT overtime_entries_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES core.employees(id);


--
-- Name: overtime_entries overtime_entries_manager_id_fkey; Type: FK CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.overtime_entries
    ADD CONSTRAINT overtime_entries_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES core.employees(id);


--
-- Name: overtime_entries overtime_entries_workflow_request_id_fkey; Type: FK CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.overtime_entries
    ADD CONSTRAINT overtime_entries_workflow_request_id_fkey FOREIGN KEY (workflow_request_id) REFERENCES wf.requests(id);


--
-- Name: regularizations regularizations_employee_id_fkey; Type: FK CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.regularizations
    ADD CONSTRAINT regularizations_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES core.employees(id);


--
-- Name: regularizations regularizations_workflow_request_id_fkey; Type: FK CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.regularizations
    ADD CONSTRAINT regularizations_workflow_request_id_fkey FOREIGN KEY (workflow_request_id) REFERENCES wf.requests(id);


--
-- Name: roster_publications roster_publications_manager_employee_id_fkey; Type: FK CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.roster_publications
    ADD CONSTRAINT roster_publications_manager_employee_id_fkey FOREIGN KEY (manager_employee_id) REFERENCES core.employees(id);


--
-- Name: roster_publications roster_publications_published_by_fkey; Type: FK CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.roster_publications
    ADD CONSTRAINT roster_publications_published_by_fkey FOREIGN KEY (published_by) REFERENCES core.users(id);


--
-- Name: roster_revisions roster_revisions_changed_by_fkey; Type: FK CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.roster_revisions
    ADD CONSTRAINT roster_revisions_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES core.users(id);


--
-- Name: roster_revisions roster_revisions_employee_id_fkey; Type: FK CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.roster_revisions
    ADD CONSTRAINT roster_revisions_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES core.employees(id);


--
-- Name: roster_revisions roster_revisions_new_shift_id_fkey; Type: FK CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.roster_revisions
    ADD CONSTRAINT roster_revisions_new_shift_id_fkey FOREIGN KEY (new_shift_id) REFERENCES att.shifts(id);


--
-- Name: roster_revisions roster_revisions_old_shift_id_fkey; Type: FK CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.roster_revisions
    ADD CONSTRAINT roster_revisions_old_shift_id_fkey FOREIGN KEY (old_shift_id) REFERENCES att.shifts(id);


--
-- Name: rosters rosters_employee_id_fkey; Type: FK CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.rosters
    ADD CONSTRAINT rosters_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES core.employees(id);


--
-- Name: rosters rosters_set_by_fkey; Type: FK CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.rosters
    ADD CONSTRAINT rosters_set_by_fkey FOREIGN KEY (set_by) REFERENCES core.users(id);


--
-- Name: rosters rosters_shift_id_fkey; Type: FK CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.rosters
    ADD CONSTRAINT rosters_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES att.shifts(id);


--
-- Name: shift_patterns shift_patterns_created_by_fkey; Type: FK CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.shift_patterns
    ADD CONSTRAINT shift_patterns_created_by_fkey FOREIGN KEY (created_by) REFERENCES core.users(id);


--
-- Name: shift_swaps shift_swaps_counterpart_employee_id_fkey; Type: FK CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.shift_swaps
    ADD CONSTRAINT shift_swaps_counterpart_employee_id_fkey FOREIGN KEY (counterpart_employee_id) REFERENCES core.employees(id);


--
-- Name: shift_swaps shift_swaps_counterpart_shift_id_fkey; Type: FK CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.shift_swaps
    ADD CONSTRAINT shift_swaps_counterpart_shift_id_fkey FOREIGN KEY (counterpart_shift_id) REFERENCES att.shifts(id);


--
-- Name: shift_swaps shift_swaps_requester_employee_id_fkey; Type: FK CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.shift_swaps
    ADD CONSTRAINT shift_swaps_requester_employee_id_fkey FOREIGN KEY (requester_employee_id) REFERENCES core.employees(id);


--
-- Name: shift_swaps shift_swaps_requester_shift_id_fkey; Type: FK CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.shift_swaps
    ADD CONSTRAINT shift_swaps_requester_shift_id_fkey FOREIGN KEY (requester_shift_id) REFERENCES att.shifts(id);


--
-- Name: shift_swaps shift_swaps_workflow_request_id_fkey; Type: FK CONSTRAINT; Schema: att; Owner: -
--

ALTER TABLE ONLY att.shift_swaps
    ADD CONSTRAINT shift_swaps_workflow_request_id_fkey FOREIGN KEY (workflow_request_id) REFERENCES wf.requests(id);


--
-- Name: calendar_items calendar_items_company_id_fkey; Type: FK CONSTRAINT; Schema: cmp; Owner: -
--

ALTER TABLE ONLY cmp.calendar_items
    ADD CONSTRAINT calendar_items_company_id_fkey FOREIGN KEY (company_id) REFERENCES core.companies(id);


--
-- Name: calendar_items calendar_items_filed_by_user_id_fkey; Type: FK CONSTRAINT; Schema: cmp; Owner: -
--

ALTER TABLE ONLY cmp.calendar_items
    ADD CONSTRAINT calendar_items_filed_by_user_id_fkey FOREIGN KEY (filed_by_user_id) REFERENCES core.users(id);


--
-- Name: calendar_items calendar_items_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: cmp; Owner: -
--

ALTER TABLE ONLY cmp.calendar_items
    ADD CONSTRAINT calendar_items_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES core.users(id);


--
-- Name: calendar_items calendar_items_registration_id_fkey; Type: FK CONSTRAINT; Schema: cmp; Owner: -
--

ALTER TABLE ONLY cmp.calendar_items
    ADD CONSTRAINT calendar_items_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES cmp.registrations(id);


--
-- Name: calendar_items calendar_items_waived_by_user_id_fkey; Type: FK CONSTRAINT; Schema: cmp; Owner: -
--

ALTER TABLE ONLY cmp.calendar_items
    ADD CONSTRAINT calendar_items_waived_by_user_id_fkey FOREIGN KEY (waived_by_user_id) REFERENCES core.users(id);


--
-- Name: filing_evidence filing_evidence_calendar_item_id_fkey; Type: FK CONSTRAINT; Schema: cmp; Owner: -
--

ALTER TABLE ONLY cmp.filing_evidence
    ADD CONSTRAINT filing_evidence_calendar_item_id_fkey FOREIGN KEY (calendar_item_id) REFERENCES cmp.calendar_items(id);


--
-- Name: filing_evidence filing_evidence_filed_by_user_id_fkey; Type: FK CONSTRAINT; Schema: cmp; Owner: -
--

ALTER TABLE ONLY cmp.filing_evidence
    ADD CONSTRAINT filing_evidence_filed_by_user_id_fkey FOREIGN KEY (filed_by_user_id) REFERENCES core.users(id);


--
-- Name: registrations registrations_company_id_fkey; Type: FK CONSTRAINT; Schema: cmp; Owner: -
--

ALTER TABLE ONLY cmp.registrations
    ADD CONSTRAINT registrations_company_id_fkey FOREIGN KEY (company_id) REFERENCES core.companies(id);


--
-- Name: registrations registrations_location_id_fkey; Type: FK CONSTRAINT; Schema: cmp; Owner: -
--

ALTER TABLE ONLY cmp.registrations
    ADD CONSTRAINT registrations_location_id_fkey FOREIGN KEY (location_id) REFERENCES core.locations(id);


--
-- Name: registrations registrations_renewal_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: cmp; Owner: -
--

ALTER TABLE ONLY cmp.registrations
    ADD CONSTRAINT registrations_renewal_owner_user_id_fkey FOREIGN KEY (renewal_owner_user_id) REFERENCES core.users(id);


--
-- Name: audit_log audit_log_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.audit_log
    ADD CONSTRAINT audit_log_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES core.users(id);


--
-- Name: audit_log audit_log_scope_org_unit_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.audit_log
    ADD CONSTRAINT audit_log_scope_org_unit_id_fkey FOREIGN KEY (scope_org_unit_id) REFERENCES core.org_units(id);


--
-- Name: clearances clearances_cleared_by_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.clearances
    ADD CONSTRAINT clearances_cleared_by_fkey FOREIGN KEY (cleared_by) REFERENCES core.users(id);


--
-- Name: clearances clearances_separation_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.clearances
    ADD CONSTRAINT clearances_separation_id_fkey FOREIGN KEY (separation_id) REFERENCES core.separations(id) ON DELETE CASCADE;


--
-- Name: cost_centers cost_centers_company_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.cost_centers
    ADD CONSTRAINT cost_centers_company_id_fkey FOREIGN KEY (company_id) REFERENCES core.companies(id);


--
-- Name: cost_centers cost_centers_plant_company_fk; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.cost_centers
    ADD CONSTRAINT cost_centers_plant_company_fk FOREIGN KEY (plant_id, company_id) REFERENCES core.plants(id, company_id);


--
-- Name: cost_centers cost_centers_plant_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.cost_centers
    ADD CONSTRAINT cost_centers_plant_id_fkey FOREIGN KEY (plant_id) REFERENCES core.plants(id);


--
-- Name: departments departments_mis_code_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.departments
    ADD CONSTRAINT departments_mis_code_id_fkey FOREIGN KEY (mis_code_id) REFERENCES core.mis_codes(id);


--
-- Name: documents documents_owner_employee_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.documents
    ADD CONSTRAINT documents_owner_employee_id_fkey FOREIGN KEY (owner_employee_id) REFERENCES core.employees(id);


--
-- Name: documents documents_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.documents
    ADD CONSTRAINT documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES core.users(id);


--
-- Name: employee_family employee_family_employee_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.employee_family
    ADD CONSTRAINT employee_family_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES core.employees(id);


--
-- Name: employee_history employee_history_employee_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.employee_history
    ADD CONSTRAINT employee_history_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES core.employees(id);


--
-- Name: employees employees_company_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.employees
    ADD CONSTRAINT employees_company_id_fkey FOREIGN KEY (company_id) REFERENCES core.companies(id);


--
-- Name: employees employees_cost_center_company_fk; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.employees
    ADD CONSTRAINT employees_cost_center_company_fk FOREIGN KEY (cost_center_id, company_id) REFERENCES core.cost_centers(id, company_id);


--
-- Name: employees employees_cost_center_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.employees
    ADD CONSTRAINT employees_cost_center_id_fkey FOREIGN KEY (cost_center_id) REFERENCES core.cost_centers(id);


--
-- Name: employees employees_department_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.employees
    ADD CONSTRAINT employees_department_id_fkey FOREIGN KEY (department_id) REFERENCES core.departments(id);


--
-- Name: employees employees_designation_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.employees
    ADD CONSTRAINT employees_designation_id_fkey FOREIGN KEY (designation_id) REFERENCES core.designations(id);


--
-- Name: employees employees_functional_manager_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.employees
    ADD CONSTRAINT employees_functional_manager_id_fkey FOREIGN KEY (functional_manager_id) REFERENCES core.employees(id);


--
-- Name: employees employees_grade_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.employees
    ADD CONSTRAINT employees_grade_id_fkey FOREIGN KEY (grade_id) REFERENCES core.grades(id);


--
-- Name: employees employees_hod_employee_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.employees
    ADD CONSTRAINT employees_hod_employee_id_fkey FOREIGN KEY (hod_employee_id) REFERENCES core.employees(id);


--
-- Name: employees employees_location_company_fk; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.employees
    ADD CONSTRAINT employees_location_company_fk FOREIGN KEY (location_id, company_id) REFERENCES core.locations(id, company_id);


--
-- Name: employees employees_location_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.employees
    ADD CONSTRAINT employees_location_id_fkey FOREIGN KEY (location_id) REFERENCES core.locations(id);


--
-- Name: employees employees_org_unit_company_fk; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.employees
    ADD CONSTRAINT employees_org_unit_company_fk FOREIGN KEY (org_unit_id, company_id) REFERENCES core.org_units(id, company_id);


--
-- Name: employees employees_org_unit_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.employees
    ADD CONSTRAINT employees_org_unit_id_fkey FOREIGN KEY (org_unit_id) REFERENCES core.org_units(id);


--
-- Name: employees employees_plant_company_fk; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.employees
    ADD CONSTRAINT employees_plant_company_fk FOREIGN KEY (plant_id, company_id) REFERENCES core.plants(id, company_id);


--
-- Name: employees employees_plant_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.employees
    ADD CONSTRAINT employees_plant_id_fkey FOREIGN KEY (plant_id) REFERENCES core.plants(id);


--
-- Name: employees employees_reporting_manager_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.employees
    ADD CONSTRAINT employees_reporting_manager_id_fkey FOREIGN KEY (reporting_manager_id) REFERENCES core.employees(id);


--
-- Name: letter_templates letter_templates_body_docx_document_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.letter_templates
    ADD CONSTRAINT letter_templates_body_docx_document_id_fkey FOREIGN KEY (body_docx_document_id) REFERENCES core.documents(id);


--
-- Name: letters letters_document_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.letters
    ADD CONSTRAINT letters_document_id_fkey FOREIGN KEY (document_id) REFERENCES core.documents(id);


--
-- Name: letters letters_employee_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.letters
    ADD CONSTRAINT letters_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES core.employees(id);


--
-- Name: letters letters_issued_by_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.letters
    ADD CONSTRAINT letters_issued_by_fkey FOREIGN KEY (issued_by) REFERENCES core.users(id);


--
-- Name: letters letters_workflow_request_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.letters
    ADD CONSTRAINT letters_workflow_request_id_fkey FOREIGN KEY (workflow_request_id) REFERENCES wf.requests(id);


--
-- Name: locations locations_company_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.locations
    ADD CONSTRAINT locations_company_id_fkey FOREIGN KEY (company_id) REFERENCES core.companies(id);


--
-- Name: mis_codes mis_codes_company_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.mis_codes
    ADD CONSTRAINT mis_codes_company_id_fkey FOREIGN KEY (company_id) REFERENCES core.companies(id);


--
-- Name: mis_codes mis_codes_parent_company_fk; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.mis_codes
    ADD CONSTRAINT mis_codes_parent_company_fk FOREIGN KEY (parent_id, company_id) REFERENCES core.mis_codes(id, company_id);


--
-- Name: mis_codes mis_codes_parent_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.mis_codes
    ADD CONSTRAINT mis_codes_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES core.mis_codes(id);


--
-- Name: onboarding_candidates onboarding_candidates_company_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.onboarding_candidates
    ADD CONSTRAINT onboarding_candidates_company_id_fkey FOREIGN KEY (company_id) REFERENCES core.companies(id);


--
-- Name: onboarding_candidates onboarding_candidates_employee_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.onboarding_candidates
    ADD CONSTRAINT onboarding_candidates_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES core.employees(id);


--
-- Name: onboarding_tasks onboarding_tasks_candidate_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.onboarding_tasks
    ADD CONSTRAINT onboarding_tasks_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES core.onboarding_candidates(id);


--
-- Name: onboarding_tasks onboarding_tasks_done_by_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.onboarding_tasks
    ADD CONSTRAINT onboarding_tasks_done_by_fkey FOREIGN KEY (done_by) REFERENCES core.users(id);


--
-- Name: onboarding_tasks onboarding_tasks_employee_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.onboarding_tasks
    ADD CONSTRAINT onboarding_tasks_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES core.employees(id);


--
-- Name: org_units org_units_company_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.org_units
    ADD CONSTRAINT org_units_company_id_fkey FOREIGN KEY (company_id) REFERENCES core.companies(id);


--
-- Name: org_units org_units_parent_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.org_units
    ADD CONSTRAINT org_units_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES core.org_units(id);


--
-- Name: password_reset_tokens password_reset_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES core.users(id);


--
-- Name: plants plants_company_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.plants
    ADD CONSTRAINT plants_company_id_fkey FOREIGN KEY (company_id) REFERENCES core.companies(id);


--
-- Name: plants plants_location_company_fk; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.plants
    ADD CONSTRAINT plants_location_company_fk FOREIGN KEY (location_id, company_id) REFERENCES core.locations(id, company_id);


--
-- Name: plants plants_location_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.plants
    ADD CONSTRAINT plants_location_id_fkey FOREIGN KEY (location_id) REFERENCES core.locations(id);


--
-- Name: policies policies_created_by_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.policies
    ADD CONSTRAINT policies_created_by_fkey FOREIGN KEY (created_by) REFERENCES core.users(id);


--
-- Name: policies policies_document_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.policies
    ADD CONSTRAINT policies_document_id_fkey FOREIGN KEY (document_id) REFERENCES core.documents(id);


--
-- Name: policy_acknowledgments policy_acknowledgments_employee_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.policy_acknowledgments
    ADD CONSTRAINT policy_acknowledgments_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES core.employees(id);


--
-- Name: policy_acknowledgments policy_acknowledgments_policy_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.policy_acknowledgments
    ADD CONSTRAINT policy_acknowledgments_policy_id_fkey FOREIGN KEY (policy_id) REFERENCES core.policies(id);


--
-- Name: probation_reviews probation_reviews_decided_by_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.probation_reviews
    ADD CONSTRAINT probation_reviews_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES core.users(id);


--
-- Name: probation_reviews probation_reviews_employee_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.probation_reviews
    ADD CONSTRAINT probation_reviews_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES core.employees(id);


--
-- Name: profile_change_requests profile_change_requests_decided_by_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.profile_change_requests
    ADD CONSTRAINT profile_change_requests_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES core.users(id);


--
-- Name: profile_change_requests profile_change_requests_employee_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.profile_change_requests
    ADD CONSTRAINT profile_change_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES core.employees(id);


--
-- Name: profile_change_requests profile_change_requests_workflow_request_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.profile_change_requests
    ADD CONSTRAINT profile_change_requests_workflow_request_id_fkey FOREIGN KEY (workflow_request_id) REFERENCES wf.requests(id);


--
-- Name: role_permissions role_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES core.permissions(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES core.roles(id) ON DELETE CASCADE;


--
-- Name: separations separations_employee_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.separations
    ADD CONSTRAINT separations_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES core.employees(id);


--
-- Name: settings settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.settings
    ADD CONSTRAINT settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES core.users(id);


--
-- Name: transfers transfers_approved_by_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.transfers
    ADD CONSTRAINT transfers_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES core.users(id);


--
-- Name: transfers transfers_created_by_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.transfers
    ADD CONSTRAINT transfers_created_by_fkey FOREIGN KEY (created_by) REFERENCES core.users(id);


--
-- Name: transfers transfers_current_company_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.transfers
    ADD CONSTRAINT transfers_current_company_id_fkey FOREIGN KEY (current_company_id) REFERENCES core.companies(id);


--
-- Name: transfers transfers_current_department_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.transfers
    ADD CONSTRAINT transfers_current_department_id_fkey FOREIGN KEY (current_department_id) REFERENCES core.departments(id);


--
-- Name: transfers transfers_current_designation_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.transfers
    ADD CONSTRAINT transfers_current_designation_id_fkey FOREIGN KEY (current_designation_id) REFERENCES core.designations(id);


--
-- Name: transfers transfers_current_grade_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.transfers
    ADD CONSTRAINT transfers_current_grade_id_fkey FOREIGN KEY (current_grade_id) REFERENCES core.grades(id);


--
-- Name: transfers transfers_current_location_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.transfers
    ADD CONSTRAINT transfers_current_location_id_fkey FOREIGN KEY (current_location_id) REFERENCES core.locations(id);


--
-- Name: transfers transfers_current_reporting_manager_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.transfers
    ADD CONSTRAINT transfers_current_reporting_manager_id_fkey FOREIGN KEY (current_reporting_manager_id) REFERENCES core.employees(id);


--
-- Name: transfers transfers_employee_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.transfers
    ADD CONSTRAINT transfers_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES core.employees(id);


--
-- Name: transfers transfers_target_company_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.transfers
    ADD CONSTRAINT transfers_target_company_id_fkey FOREIGN KEY (target_company_id) REFERENCES core.companies(id);


--
-- Name: transfers transfers_target_department_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.transfers
    ADD CONSTRAINT transfers_target_department_id_fkey FOREIGN KEY (target_department_id) REFERENCES core.departments(id);


--
-- Name: transfers transfers_target_designation_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.transfers
    ADD CONSTRAINT transfers_target_designation_id_fkey FOREIGN KEY (target_designation_id) REFERENCES core.designations(id);


--
-- Name: transfers transfers_target_grade_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.transfers
    ADD CONSTRAINT transfers_target_grade_id_fkey FOREIGN KEY (target_grade_id) REFERENCES core.grades(id);


--
-- Name: transfers transfers_target_location_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.transfers
    ADD CONSTRAINT transfers_target_location_id_fkey FOREIGN KEY (target_location_id) REFERENCES core.locations(id);


--
-- Name: transfers transfers_target_reporting_manager_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.transfers
    ADD CONSTRAINT transfers_target_reporting_manager_id_fkey FOREIGN KEY (target_reporting_manager_id) REFERENCES core.employees(id);


--
-- Name: user_roles user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES core.roles(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_scope_fk; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.user_roles
    ADD CONSTRAINT user_roles_scope_fk FOREIGN KEY (scope_org_unit_id) REFERENCES core.org_units(id);


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES core.users(id) ON DELETE CASCADE;


--
-- Name: users users_employee_fk; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.users
    ADD CONSTRAINT users_employee_fk FOREIGN KEY (employee_id) REFERENCES core.employees(id);


--
-- Name: announcements announcements_attachment_document_id_fkey; Type: FK CONSTRAINT; Schema: eng; Owner: -
--

ALTER TABLE ONLY eng.announcements
    ADD CONSTRAINT announcements_attachment_document_id_fkey FOREIGN KEY (attachment_document_id) REFERENCES core.documents(id);


--
-- Name: announcements announcements_published_by_fkey; Type: FK CONSTRAINT; Schema: eng; Owner: -
--

ALTER TABLE ONLY eng.announcements
    ADD CONSTRAINT announcements_published_by_fkey FOREIGN KEY (published_by) REFERENCES core.users(id);


--
-- Name: poll_responses poll_responses_poll_id_fkey; Type: FK CONSTRAINT; Schema: eng; Owner: -
--

ALTER TABLE ONLY eng.poll_responses
    ADD CONSTRAINT poll_responses_poll_id_fkey FOREIGN KEY (poll_id) REFERENCES eng.polls(id);


--
-- Name: poll_responses poll_responses_respondent_user_id_fkey; Type: FK CONSTRAINT; Schema: eng; Owner: -
--

ALTER TABLE ONLY eng.poll_responses
    ADD CONSTRAINT poll_responses_respondent_user_id_fkey FOREIGN KEY (respondent_user_id) REFERENCES core.users(id);


--
-- Name: polls polls_created_by_fkey; Type: FK CONSTRAINT; Schema: eng; Owner: -
--

ALTER TABLE ONLY eng.polls
    ADD CONSTRAINT polls_created_by_fkey FOREIGN KEY (created_by) REFERENCES core.users(id);


--
-- Name: survey_responses survey_responses_respondent_user_id_fkey; Type: FK CONSTRAINT; Schema: eng; Owner: -
--

ALTER TABLE ONLY eng.survey_responses
    ADD CONSTRAINT survey_responses_respondent_user_id_fkey FOREIGN KEY (respondent_user_id) REFERENCES core.users(id);


--
-- Name: survey_responses survey_responses_survey_id_fkey; Type: FK CONSTRAINT; Schema: eng; Owner: -
--

ALTER TABLE ONLY eng.survey_responses
    ADD CONSTRAINT survey_responses_survey_id_fkey FOREIGN KEY (survey_id) REFERENCES eng.surveys(id) ON DELETE CASCADE;


--
-- Name: surveys surveys_created_by_fkey; Type: FK CONSTRAINT; Schema: eng; Owner: -
--

ALTER TABLE ONLY eng.surveys
    ADD CONSTRAINT surveys_created_by_fkey FOREIGN KEY (created_by) REFERENCES core.users(id);


--
-- Name: ticket_messages ticket_messages_author_user_id_fkey; Type: FK CONSTRAINT; Schema: hd; Owner: -
--

ALTER TABLE ONLY hd.ticket_messages
    ADD CONSTRAINT ticket_messages_author_user_id_fkey FOREIGN KEY (author_user_id) REFERENCES core.users(id);


--
-- Name: ticket_messages ticket_messages_ticket_id_fkey; Type: FK CONSTRAINT; Schema: hd; Owner: -
--

ALTER TABLE ONLY hd.ticket_messages
    ADD CONSTRAINT ticket_messages_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES hd.tickets(id);


--
-- Name: tickets tickets_assignee_user_id_fkey; Type: FK CONSTRAINT; Schema: hd; Owner: -
--

ALTER TABLE ONLY hd.tickets
    ADD CONSTRAINT tickets_assignee_user_id_fkey FOREIGN KEY (assignee_user_id) REFERENCES core.users(id);


--
-- Name: tickets tickets_category_id_fkey; Type: FK CONSTRAINT; Schema: hd; Owner: -
--

ALTER TABLE ONLY hd.tickets
    ADD CONSTRAINT tickets_category_id_fkey FOREIGN KEY (category_id) REFERENCES hd.categories(id);


--
-- Name: tickets tickets_escalated_to_user_id_fkey; Type: FK CONSTRAINT; Schema: hd; Owner: -
--

ALTER TABLE ONLY hd.tickets
    ADD CONSTRAINT tickets_escalated_to_user_id_fkey FOREIGN KEY (escalated_to_user_id) REFERENCES core.users(id);


--
-- Name: tickets tickets_raised_by_fkey; Type: FK CONSTRAINT; Schema: hd; Owner: -
--

ALTER TABLE ONLY hd.tickets
    ADD CONSTRAINT tickets_raised_by_fkey FOREIGN KEY (raised_by) REFERENCES core.users(id);


--
-- Name: grievances grievances_filed_by_user_id_fkey; Type: FK CONSTRAINT; Schema: ird; Owner: -
--

ALTER TABLE ONLY ird.grievances
    ADD CONSTRAINT grievances_filed_by_user_id_fkey FOREIGN KEY (filed_by_user_id) REFERENCES core.users(id);


--
-- Name: ic_members ic_members_employee_id_fkey; Type: FK CONSTRAINT; Schema: ird; Owner: -
--

ALTER TABLE ONLY ird.ic_members
    ADD CONSTRAINT ic_members_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES core.employees(id);


--
-- Name: posh_case_access_log posh_case_access_log_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: ird; Owner: -
--

ALTER TABLE ONLY ird.posh_case_access_log
    ADD CONSTRAINT posh_case_access_log_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES core.users(id);


--
-- Name: posh_case_access_log posh_case_access_log_case_id_fkey; Type: FK CONSTRAINT; Schema: ird; Owner: -
--

ALTER TABLE ONLY ird.posh_case_access_log
    ADD CONSTRAINT posh_case_access_log_case_id_fkey FOREIGN KEY (case_id) REFERENCES ird.posh_cases(id);


--
-- Name: posh_cases posh_cases_filed_by_user_id_fkey; Type: FK CONSTRAINT; Schema: ird; Owner: -
--

ALTER TABLE ONLY ird.posh_cases
    ADD CONSTRAINT posh_cases_filed_by_user_id_fkey FOREIGN KEY (filed_by_user_id) REFERENCES core.users(id);


--
-- Name: applications applications_cancel_workflow_request_id_fkey; Type: FK CONSTRAINT; Schema: lv; Owner: -
--

ALTER TABLE ONLY lv.applications
    ADD CONSTRAINT applications_cancel_workflow_request_id_fkey FOREIGN KEY (cancel_workflow_request_id) REFERENCES wf.requests(id);


--
-- Name: applications applications_employee_id_fkey; Type: FK CONSTRAINT; Schema: lv; Owner: -
--

ALTER TABLE ONLY lv.applications
    ADD CONSTRAINT applications_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES core.employees(id);


--
-- Name: applications applications_leave_type_id_fkey; Type: FK CONSTRAINT; Schema: lv; Owner: -
--

ALTER TABLE ONLY lv.applications
    ADD CONSTRAINT applications_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES lv.leave_types(id);


--
-- Name: applications applications_ledger_txn_id_fkey; Type: FK CONSTRAINT; Schema: lv; Owner: -
--

ALTER TABLE ONLY lv.applications
    ADD CONSTRAINT applications_ledger_txn_id_fkey FOREIGN KEY (ledger_txn_id) REFERENCES lv.ledger(id);


--
-- Name: applications applications_workflow_request_id_fkey; Type: FK CONSTRAINT; Schema: lv; Owner: -
--

ALTER TABLE ONLY lv.applications
    ADD CONSTRAINT applications_workflow_request_id_fkey FOREIGN KEY (workflow_request_id) REFERENCES wf.requests(id);


--
-- Name: ledger ledger_created_by_fkey; Type: FK CONSTRAINT; Schema: lv; Owner: -
--

ALTER TABLE ONLY lv.ledger
    ADD CONSTRAINT ledger_created_by_fkey FOREIGN KEY (created_by) REFERENCES core.users(id);


--
-- Name: ledger ledger_employee_id_fkey; Type: FK CONSTRAINT; Schema: lv; Owner: -
--

ALTER TABLE ONLY lv.ledger
    ADD CONSTRAINT ledger_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES core.employees(id);


--
-- Name: ledger ledger_leave_type_id_fkey; Type: FK CONSTRAINT; Schema: lv; Owner: -
--

ALTER TABLE ONLY lv.ledger
    ADD CONSTRAINT ledger_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES lv.leave_types(id);


--
-- Name: restricted_holidays restricted_holidays_location_id_fkey; Type: FK CONSTRAINT; Schema: lv; Owner: -
--

ALTER TABLE ONLY lv.restricted_holidays
    ADD CONSTRAINT restricted_holidays_location_id_fkey FOREIGN KEY (location_id) REFERENCES core.locations(id);


--
-- Name: rh_selections rh_selections_employee_id_fkey; Type: FK CONSTRAINT; Schema: lv; Owner: -
--

ALTER TABLE ONLY lv.rh_selections
    ADD CONSTRAINT rh_selections_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES core.employees(id);


--
-- Name: rh_selections rh_selections_restricted_holiday_id_fkey; Type: FK CONSTRAINT; Schema: lv; Owner: -
--

ALTER TABLE ONLY lv.rh_selections
    ADD CONSTRAINT rh_selections_restricted_holiday_id_fkey FOREIGN KEY (restricted_holiday_id) REFERENCES lv.restricted_holidays(id);


--
-- Name: rh_selections rh_selections_workflow_request_id_fkey; Type: FK CONSTRAINT; Schema: lv; Owner: -
--

ALTER TABLE ONLY lv.rh_selections
    ADD CONSTRAINT rh_selections_workflow_request_id_fkey FOREIGN KEY (workflow_request_id) REFERENCES wf.requests(id);


--
-- Name: arrears arrears_component_code_fkey; Type: FK CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.arrears
    ADD CONSTRAINT arrears_component_code_fkey FOREIGN KEY (component_code) REFERENCES pay.salary_components(code);


--
-- Name: arrears arrears_employee_id_fkey; Type: FK CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.arrears
    ADD CONSTRAINT arrears_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES core.employees(id);


--
-- Name: arrears arrears_paid_in_run_id_fkey; Type: FK CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.arrears
    ADD CONSTRAINT arrears_paid_in_run_id_fkey FOREIGN KEY (paid_in_run_id) REFERENCES pay.payroll_runs(id);


--
-- Name: arrears arrears_source_salary_id_fkey; Type: FK CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.arrears
    ADD CONSTRAINT arrears_source_salary_id_fkey FOREIGN KEY (source_salary_id) REFERENCES pay.employee_salaries(id);


--
-- Name: bank_batches bank_batches_file_document_id_fkey; Type: FK CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.bank_batches
    ADD CONSTRAINT bank_batches_file_document_id_fkey FOREIGN KEY (file_document_id) REFERENCES core.documents(id);


--
-- Name: bank_batches bank_batches_generated_by_fkey; Type: FK CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.bank_batches
    ADD CONSTRAINT bank_batches_generated_by_fkey FOREIGN KEY (generated_by) REFERENCES core.users(id);


--
-- Name: bank_batches bank_batches_run_id_fkey; Type: FK CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.bank_batches
    ADD CONSTRAINT bank_batches_run_id_fkey FOREIGN KEY (run_id) REFERENCES pay.payroll_runs(id);


--
-- Name: budget_categories budget_categories_budget_id_fkey; Type: FK CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.budget_categories
    ADD CONSTRAINT budget_categories_budget_id_fkey FOREIGN KEY (budget_id) REFERENCES pay.budgets(id) ON DELETE CASCADE;


--
-- Name: budget_categories budget_categories_claim_type_id_fkey; Type: FK CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.budget_categories
    ADD CONSTRAINT budget_categories_claim_type_id_fkey FOREIGN KEY (claim_type_id) REFERENCES pay.claim_types(id);


--
-- Name: budgets budgets_approved_by_user_id_fkey; Type: FK CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.budgets
    ADD CONSTRAINT budgets_approved_by_user_id_fkey FOREIGN KEY (approved_by_user_id) REFERENCES core.users(id);


--
-- Name: budgets budgets_company_id_fkey; Type: FK CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.budgets
    ADD CONSTRAINT budgets_company_id_fkey FOREIGN KEY (company_id) REFERENCES core.companies(id);


--
-- Name: budgets budgets_cost_center_id_fkey; Type: FK CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.budgets
    ADD CONSTRAINT budgets_cost_center_id_fkey FOREIGN KEY (cost_center_id) REFERENCES core.cost_centers(id);


--
-- Name: budgets budgets_employee_id_fkey; Type: FK CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.budgets
    ADD CONSTRAINT budgets_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES core.employees(id);


--
-- Name: claim_bills claim_bills_claim_id_fkey; Type: FK CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.claim_bills
    ADD CONSTRAINT claim_bills_claim_id_fkey FOREIGN KEY (claim_id) REFERENCES pay.claims(id) ON DELETE CASCADE;


--
-- Name: claim_bills claim_bills_document_id_fkey; Type: FK CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.claim_bills
    ADD CONSTRAINT claim_bills_document_id_fkey FOREIGN KEY (document_id) REFERENCES core.documents(id);


--
-- Name: claim_bills claim_bills_verified_by_fkey; Type: FK CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.claim_bills
    ADD CONSTRAINT claim_bills_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES core.users(id);


--
-- Name: claim_entitlements claim_entitlements_claim_type_id_fkey; Type: FK CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.claim_entitlements
    ADD CONSTRAINT claim_entitlements_claim_type_id_fkey FOREIGN KEY (claim_type_id) REFERENCES pay.claim_types(id);


--
-- Name: claim_entitlements claim_entitlements_grade_id_fkey; Type: FK CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.claim_entitlements
    ADD CONSTRAINT claim_entitlements_grade_id_fkey FOREIGN KEY (grade_id) REFERENCES core.grades(id);


--
-- Name: claim_lines claim_lines_claim_id_fkey; Type: FK CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.claim_lines
    ADD CONSTRAINT claim_lines_claim_id_fkey FOREIGN KEY (claim_id) REFERENCES pay.claims(id) ON DELETE CASCADE;


--
-- Name: claim_lines claim_lines_claim_type_id_fkey; Type: FK CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.claim_lines
    ADD CONSTRAINT claim_lines_claim_type_id_fkey FOREIGN KEY (claim_type_id) REFERENCES pay.claim_types(id);


--
-- Name: claim_reservations claim_reservations_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.claim_reservations
    ADD CONSTRAINT claim_reservations_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES core.users(id);


--
-- Name: claim_reservations claim_reservations_budget_id_fkey; Type: FK CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.claim_reservations
    ADD CONSTRAINT claim_reservations_budget_id_fkey FOREIGN KEY (budget_id) REFERENCES pay.budgets(id);


--
-- Name: claim_reservations claim_reservations_claim_id_fkey; Type: FK CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.claim_reservations
    ADD CONSTRAINT claim_reservations_claim_id_fkey FOREIGN KEY (claim_id) REFERENCES pay.claims(id);


--
-- Name: claims claims_advance_loan_id_fkey; Type: FK CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.claims
    ADD CONSTRAINT claims_advance_loan_id_fkey FOREIGN KEY (advance_loan_id) REFERENCES pay.loans(id);


--
-- Name: claims claims_budget_id_fkey; Type: FK CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.claims
    ADD CONSTRAINT claims_budget_id_fkey FOREIGN KEY (budget_id) REFERENCES pay.budgets(id);


--
-- Name: claims claims_claim_type_id_fkey; Type: FK CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.claims
    ADD CONSTRAINT claims_claim_type_id_fkey FOREIGN KEY (claim_type_id) REFERENCES pay.claim_types(id);


--
-- Name: claims claims_employee_id_fkey; Type: FK CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.claims
    ADD CONSTRAINT claims_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES core.employees(id);


--
-- Name: claims claims_paid_in_batch_id_fkey; Type: FK CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.claims
    ADD CONSTRAINT claims_paid_in_batch_id_fkey FOREIGN KEY (paid_in_batch_id) REFERENCES pay.bank_batches(id);


--
-- Name: claims claims_paid_in_run_id_fkey; Type: FK CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.claims
    ADD CONSTRAINT claims_paid_in_run_id_fkey FOREIGN KEY (paid_in_run_id) REFERENCES pay.payroll_runs(id);


--
-- Name: claims claims_reserved_budget_id_fkey; Type: FK CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.claims
    ADD CONSTRAINT claims_reserved_budget_id_fkey FOREIGN KEY (reserved_budget_id) REFERENCES pay.budgets(id);


--
-- Name: claims claims_settled_by_user_id_fkey; Type: FK CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.claims
    ADD CONSTRAINT claims_settled_by_user_id_fkey FOREIGN KEY (settled_by_user_id) REFERENCES core.users(id);


--
-- Name: employee_salaries employee_salaries_approved_by_fkey; Type: FK CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.employee_salaries
    ADD CONSTRAINT employee_salaries_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES core.users(id);


--
-- Name: employee_salaries employee_salaries_employee_id_fkey; Type: FK CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.employee_salaries
    ADD CONSTRAINT employee_salaries_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES core.employees(id);


--
-- Name: employee_salaries employee_salaries_structure_id_fkey; Type: FK CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.employee_salaries
    ADD CONSTRAINT employee_salaries_structure_id_fkey FOREIGN KEY (structure_id) REFERENCES pay.salary_structures(id);


--
-- Name: fnf_settlements fnf_settlements_employee_id_fkey; Type: FK CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.fnf_settlements
    ADD CONSTRAINT fnf_settlements_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES core.employees(id);


--
-- Name: fnf_settlements fnf_settlements_relieving_letter_id_fkey; Type: FK CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.fnf_settlements
    ADD CONSTRAINT fnf_settlements_relieving_letter_id_fkey FOREIGN KEY (relieving_letter_id) REFERENCES core.letters(id);


--
-- Name: fnf_settlements fnf_settlements_run_id_fkey; Type: FK CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.fnf_settlements
    ADD CONSTRAINT fnf_settlements_run_id_fkey FOREIGN KEY (run_id) REFERENCES pay.payroll_runs(id);


--
-- Name: fnf_settlements fnf_settlements_service_certificate_id_fkey; Type: FK CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.fnf_settlements
    ADD CONSTRAINT fnf_settlements_service_certificate_id_fkey FOREIGN KEY (service_certificate_id) REFERENCES core.letters(id);


--
-- Name: inputs inputs_component_code_fkey; Type: FK CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.inputs
    ADD CONSTRAINT inputs_component_code_fkey FOREIGN KEY (component_code) REFERENCES pay.salary_components(code);


--
-- Name: inputs inputs_employee_id_fkey; Type: FK CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.inputs
    ADD CONSTRAINT inputs_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES core.employees(id);


--
-- Name: inputs inputs_entered_by_fkey; Type: FK CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.inputs
    ADD CONSTRAINT inputs_entered_by_fkey FOREIGN KEY (entered_by) REFERENCES core.users(id);


--
-- Name: inputs inputs_run_id_fkey; Type: FK CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.inputs
    ADD CONSTRAINT inputs_run_id_fkey FOREIGN KEY (run_id) REFERENCES pay.payroll_runs(id);


--
-- Name: investment_declarations investment_declarations_employee_id_fkey; Type: FK CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.investment_declarations
    ADD CONSTRAINT investment_declarations_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES core.employees(id);


--
-- Name: investment_declarations investment_declarations_proof_document_id_fkey; Type: FK CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.investment_declarations
    ADD CONSTRAINT investment_declarations_proof_document_id_fkey FOREIGN KEY (proof_document_id) REFERENCES core.documents(id);


--
-- Name: investment_declarations investment_declarations_verified_by_fkey; Type: FK CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.investment_declarations
    ADD CONSTRAINT investment_declarations_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES core.users(id);


--
-- Name: loan_postings loan_postings_loan_id_fkey; Type: FK CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.loan_postings
    ADD CONSTRAINT loan_postings_loan_id_fkey FOREIGN KEY (loan_id) REFERENCES pay.loans(id);


--
-- Name: loan_postings loan_postings_run_id_fkey; Type: FK CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.loan_postings
    ADD CONSTRAINT loan_postings_run_id_fkey FOREIGN KEY (run_id) REFERENCES pay.payroll_runs(id);


--
-- Name: loans loans_employee_id_fkey; Type: FK CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.loans
    ADD CONSTRAINT loans_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES core.employees(id);


--
-- Name: payroll_item_lines payroll_item_lines_component_code_fkey; Type: FK CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.payroll_item_lines
    ADD CONSTRAINT payroll_item_lines_component_code_fkey FOREIGN KEY (component_code) REFERENCES pay.salary_components(code);


--
-- Name: payroll_item_lines payroll_item_lines_item_id_fkey; Type: FK CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.payroll_item_lines
    ADD CONSTRAINT payroll_item_lines_item_id_fkey FOREIGN KEY (item_id) REFERENCES pay.payroll_items(id) ON DELETE CASCADE;


--
-- Name: payroll_items payroll_items_employee_id_fkey; Type: FK CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.payroll_items
    ADD CONSTRAINT payroll_items_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES core.employees(id);


--
-- Name: payroll_items payroll_items_payslip_document_id_fkey; Type: FK CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.payroll_items
    ADD CONSTRAINT payroll_items_payslip_document_id_fkey FOREIGN KEY (payslip_document_id) REFERENCES core.documents(id);


--
-- Name: payroll_items payroll_items_run_id_fkey; Type: FK CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.payroll_items
    ADD CONSTRAINT payroll_items_run_id_fkey FOREIGN KEY (run_id) REFERENCES pay.payroll_runs(id) ON DELETE CASCADE;


--
-- Name: payroll_runs payroll_runs_approved_by_fkey; Type: FK CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.payroll_runs
    ADD CONSTRAINT payroll_runs_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES core.users(id);


--
-- Name: payroll_runs payroll_runs_attendance_lock_id_fkey; Type: FK CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.payroll_runs
    ADD CONSTRAINT payroll_runs_attendance_lock_id_fkey FOREIGN KEY (attendance_lock_id) REFERENCES att.month_locks(id);


--
-- Name: payroll_runs payroll_runs_company_id_fkey; Type: FK CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.payroll_runs
    ADD CONSTRAINT payroll_runs_company_id_fkey FOREIGN KEY (company_id) REFERENCES core.companies(id);


--
-- Name: payroll_runs payroll_runs_finalized_by_fkey; Type: FK CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.payroll_runs
    ADD CONSTRAINT payroll_runs_finalized_by_fkey FOREIGN KEY (finalized_by) REFERENCES core.users(id);


--
-- Name: salary_holds salary_holds_created_by_fkey; Type: FK CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.salary_holds
    ADD CONSTRAINT salary_holds_created_by_fkey FOREIGN KEY (created_by) REFERENCES core.users(id);


--
-- Name: salary_holds salary_holds_employee_id_fkey; Type: FK CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.salary_holds
    ADD CONSTRAINT salary_holds_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES core.employees(id);


--
-- Name: salary_structures salary_structures_company_id_fkey; Type: FK CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.salary_structures
    ADD CONSTRAINT salary_structures_company_id_fkey FOREIGN KEY (company_id) REFERENCES core.companies(id);


--
-- Name: tds_challans tds_challans_company_id_fkey; Type: FK CONSTRAINT; Schema: pay; Owner: -
--

ALTER TABLE ONLY pay.tds_challans
    ADD CONSTRAINT tds_challans_company_id_fkey FOREIGN KEY (company_id) REFERENCES core.companies(id);


--
-- Name: breach_register breach_register_recorded_by_fkey; Type: FK CONSTRAINT; Schema: prv; Owner: -
--

ALTER TABLE ONLY prv.breach_register
    ADD CONSTRAINT breach_register_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES core.users(id);


--
-- Name: consent_events consent_events_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: prv; Owner: -
--

ALTER TABLE ONLY prv.consent_events
    ADD CONSTRAINT consent_events_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES core.users(id);


--
-- Name: consent_events consent_events_employee_id_fkey; Type: FK CONSTRAINT; Schema: prv; Owner: -
--

ALTER TABLE ONLY prv.consent_events
    ADD CONSTRAINT consent_events_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES core.employees(id);


--
-- Name: consents consents_employee_id_fkey; Type: FK CONSTRAINT; Schema: prv; Owner: -
--

ALTER TABLE ONLY prv.consents
    ADD CONSTRAINT consents_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES core.employees(id);


--
-- Name: legal_holds legal_holds_employee_id_fkey; Type: FK CONSTRAINT; Schema: prv; Owner: -
--

ALTER TABLE ONLY prv.legal_holds
    ADD CONSTRAINT legal_holds_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES core.employees(id);


--
-- Name: legal_holds legal_holds_placed_by_fkey; Type: FK CONSTRAINT; Schema: prv; Owner: -
--

ALTER TABLE ONLY prv.legal_holds
    ADD CONSTRAINT legal_holds_placed_by_fkey FOREIGN KEY (placed_by) REFERENCES core.users(id);


--
-- Name: notice_acks notice_acks_notice_id_fkey; Type: FK CONSTRAINT; Schema: prv; Owner: -
--

ALTER TABLE ONLY prv.notice_acks
    ADD CONSTRAINT notice_acks_notice_id_fkey FOREIGN KEY (notice_id) REFERENCES prv.notices(id);


--
-- Name: notice_acks notice_acks_user_id_fkey; Type: FK CONSTRAINT; Schema: prv; Owner: -
--

ALTER TABLE ONLY prv.notice_acks
    ADD CONSTRAINT notice_acks_user_id_fkey FOREIGN KEY (user_id) REFERENCES core.users(id);


--
-- Name: purge_log purge_log_proposal_id_fkey; Type: FK CONSTRAINT; Schema: prv; Owner: -
--

ALTER TABLE ONLY prv.purge_log
    ADD CONSTRAINT purge_log_proposal_id_fkey FOREIGN KEY (proposal_id) REFERENCES prv.purge_proposals(id);


--
-- Name: purge_proposals purge_proposals_confirmed_by_fkey; Type: FK CONSTRAINT; Schema: prv; Owner: -
--

ALTER TABLE ONLY prv.purge_proposals
    ADD CONSTRAINT purge_proposals_confirmed_by_fkey FOREIGN KEY (confirmed_by) REFERENCES core.users(id);


--
-- Name: purge_proposals purge_proposals_proposed_by_fkey; Type: FK CONSTRAINT; Schema: prv; Owner: -
--

ALTER TABLE ONLY prv.purge_proposals
    ADD CONSTRAINT purge_proposals_proposed_by_fkey FOREIGN KEY (proposed_by) REFERENCES core.users(id);


--
-- Name: retention_rules retention_rules_data_class_fkey; Type: FK CONSTRAINT; Schema: prv; Owner: -
--

ALTER TABLE ONLY prv.retention_rules
    ADD CONSTRAINT retention_rules_data_class_fkey FOREIGN KEY (data_class) REFERENCES prv.processing_register(data_class);


--
-- Name: rights_requests rights_requests_employee_id_fkey; Type: FK CONSTRAINT; Schema: prv; Owner: -
--

ALTER TABLE ONLY prv.rights_requests
    ADD CONSTRAINT rights_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES core.employees(id);


--
-- Name: rights_requests rights_requests_workflow_request_id_fkey; Type: FK CONSTRAINT; Schema: prv; Owner: -
--

ALTER TABLE ONLY prv.rights_requests
    ADD CONSTRAINT rights_requests_workflow_request_id_fkey FOREIGN KEY (workflow_request_id) REFERENCES wf.requests(id);


--
-- Name: kpi_daily kpi_daily_company_id_fkey; Type: FK CONSTRAINT; Schema: reporting; Owner: -
--

ALTER TABLE ONLY reporting.kpi_daily
    ADD CONSTRAINT kpi_daily_company_id_fkey FOREIGN KEY (company_id) REFERENCES core.companies(id);


--
-- Name: muster_month muster_month_company_id_fkey; Type: FK CONSTRAINT; Schema: reporting; Owner: -
--

ALTER TABLE ONLY reporting.muster_month
    ADD CONSTRAINT muster_month_company_id_fkey FOREIGN KEY (company_id) REFERENCES core.companies(id);


--
-- Name: muster_month muster_month_employee_id_fkey; Type: FK CONSTRAINT; Schema: reporting; Owner: -
--

ALTER TABLE ONLY reporting.muster_month
    ADD CONSTRAINT muster_month_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES core.employees(id);


--
-- Name: access_events access_events_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: sec; Owner: -
--

ALTER TABLE sec.access_events
    ADD CONSTRAINT access_events_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES core.users(id);


--
-- Name: mfa_enrolments mfa_enrolments_disabled_by_user_id_fkey; Type: FK CONSTRAINT; Schema: sec; Owner: -
--

ALTER TABLE ONLY sec.mfa_enrolments
    ADD CONSTRAINT mfa_enrolments_disabled_by_user_id_fkey FOREIGN KEY (disabled_by_user_id) REFERENCES core.users(id);


--
-- Name: mfa_enrolments mfa_enrolments_user_id_fkey; Type: FK CONSTRAINT; Schema: sec; Owner: -
--

ALTER TABLE ONLY sec.mfa_enrolments
    ADD CONSTRAINT mfa_enrolments_user_id_fkey FOREIGN KEY (user_id) REFERENCES core.users(id);


--
-- Name: mfa_recovery_codes mfa_recovery_codes_enrolment_id_fkey; Type: FK CONSTRAINT; Schema: sec; Owner: -
--

ALTER TABLE ONLY sec.mfa_recovery_codes
    ADD CONSTRAINT mfa_recovery_codes_enrolment_id_fkey FOREIGN KEY (enrolment_id) REFERENCES sec.mfa_enrolments(id) ON DELETE CASCADE;


--
-- Name: password_history password_history_changed_by_user_id_fkey; Type: FK CONSTRAINT; Schema: sec; Owner: -
--

ALTER TABLE ONLY sec.password_history
    ADD CONSTRAINT password_history_changed_by_user_id_fkey FOREIGN KEY (changed_by_user_id) REFERENCES core.users(id);


--
-- Name: password_history password_history_user_id_fkey; Type: FK CONSTRAINT; Schema: sec; Owner: -
--

ALTER TABLE ONLY sec.password_history
    ADD CONSTRAINT password_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES core.users(id);


--
-- Name: sessions sessions_revoked_by_user_id_fkey; Type: FK CONSTRAINT; Schema: sec; Owner: -
--

ALTER TABLE ONLY sec.sessions
    ADD CONSTRAINT sessions_revoked_by_user_id_fkey FOREIGN KEY (revoked_by_user_id) REFERENCES core.users(id);


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: sec; Owner: -
--

ALTER TABLE ONLY sec.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES core.users(id);


--
-- Name: advances advances_employee_id_fkey; Type: FK CONSTRAINT; Schema: te; Owner: -
--

ALTER TABLE ONLY te.advances
    ADD CONSTRAINT advances_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES core.employees(id);


--
-- Name: advances advances_trip_id_fkey; Type: FK CONSTRAINT; Schema: te; Owner: -
--

ALTER TABLE ONLY te.advances
    ADD CONSTRAINT advances_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES te.trips(id);


--
-- Name: claim_items claim_items_claim_id_fkey; Type: FK CONSTRAINT; Schema: te; Owner: -
--

ALTER TABLE ONLY te.claim_items
    ADD CONSTRAINT claim_items_claim_id_fkey FOREIGN KEY (claim_id) REFERENCES te.claims(id) ON DELETE CASCADE;


--
-- Name: claims claims_employee_id_fkey; Type: FK CONSTRAINT; Schema: te; Owner: -
--

ALTER TABLE ONLY te.claims
    ADD CONSTRAINT claims_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES core.employees(id);


--
-- Name: claims claims_trip_id_fkey; Type: FK CONSTRAINT; Schema: te; Owner: -
--

ALTER TABLE ONLY te.claims
    ADD CONSTRAINT claims_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES te.trips(id);


--
-- Name: settlements settlements_claim_id_fkey; Type: FK CONSTRAINT; Schema: te; Owner: -
--

ALTER TABLE ONLY te.settlements
    ADD CONSTRAINT settlements_claim_id_fkey FOREIGN KEY (claim_id) REFERENCES te.claims(id);


--
-- Name: settlements settlements_employee_id_fkey; Type: FK CONSTRAINT; Schema: te; Owner: -
--

ALTER TABLE ONLY te.settlements
    ADD CONSTRAINT settlements_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES core.employees(id);


--
-- Name: settlements settlements_settled_by_fkey; Type: FK CONSTRAINT; Schema: te; Owner: -
--

ALTER TABLE ONLY te.settlements
    ADD CONSTRAINT settlements_settled_by_fkey FOREIGN KEY (settled_by) REFERENCES core.users(id);


--
-- Name: settlements settlements_trip_id_fkey; Type: FK CONSTRAINT; Schema: te; Owner: -
--

ALTER TABLE ONLY te.settlements
    ADD CONSTRAINT settlements_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES te.trips(id);


--
-- Name: trip_itineraries trip_itineraries_trip_id_fkey; Type: FK CONSTRAINT; Schema: te; Owner: -
--

ALTER TABLE ONLY te.trip_itineraries
    ADD CONSTRAINT trip_itineraries_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES te.trips(id) ON DELETE CASCADE;


--
-- Name: trips trips_company_id_fkey; Type: FK CONSTRAINT; Schema: te; Owner: -
--

ALTER TABLE ONLY te.trips
    ADD CONSTRAINT trips_company_id_fkey FOREIGN KEY (company_id) REFERENCES core.companies(id);


--
-- Name: trips trips_employee_id_fkey; Type: FK CONSTRAINT; Schema: te; Owner: -
--

ALTER TABLE ONLY te.trips
    ADD CONSTRAINT trips_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES core.employees(id);


--
-- Name: wallet_transactions wallet_transactions_employee_id_fkey; Type: FK CONSTRAINT; Schema: te; Owner: -
--

ALTER TABLE ONLY te.wallet_transactions
    ADD CONSTRAINT wallet_transactions_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES core.employees(id);


--
-- Name: wallet_transactions wallet_transactions_trip_id_fkey; Type: FK CONSTRAINT; Schema: te; Owner: -
--

ALTER TABLE ONLY te.wallet_transactions
    ADD CONSTRAINT wallet_transactions_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES te.trips(id);


--
-- Name: wallet_transactions wallet_transactions_wallet_id_fkey; Type: FK CONSTRAINT; Schema: te; Owner: -
--

ALTER TABLE ONLY te.wallet_transactions
    ADD CONSTRAINT wallet_transactions_wallet_id_fkey FOREIGN KEY (wallet_id) REFERENCES te.wallets(id);


--
-- Name: wallets wallets_employee_id_fkey; Type: FK CONSTRAINT; Schema: te; Owner: -
--

ALTER TABLE ONLY te.wallets
    ADD CONSTRAINT wallets_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES core.employees(id);


--
-- Name: delegations delegations_from_user_id_fkey; Type: FK CONSTRAINT; Schema: wf; Owner: -
--

ALTER TABLE ONLY wf.delegations
    ADD CONSTRAINT delegations_from_user_id_fkey FOREIGN KEY (from_user_id) REFERENCES core.users(id);


--
-- Name: delegations delegations_to_user_id_fkey; Type: FK CONSTRAINT; Schema: wf; Owner: -
--

ALTER TABLE ONLY wf.delegations
    ADD CONSTRAINT delegations_to_user_id_fkey FOREIGN KEY (to_user_id) REFERENCES core.users(id);


--
-- Name: notifications notifications_recipient_user_id_fkey; Type: FK CONSTRAINT; Schema: wf; Owner: -
--

ALTER TABLE ONLY wf.notifications
    ADD CONSTRAINT notifications_recipient_user_id_fkey FOREIGN KEY (recipient_user_id) REFERENCES core.users(id);


--
-- Name: request_steps request_steps_approver_user_id_fkey; Type: FK CONSTRAINT; Schema: wf; Owner: -
--

ALTER TABLE ONLY wf.request_steps
    ADD CONSTRAINT request_steps_approver_user_id_fkey FOREIGN KEY (approver_user_id) REFERENCES core.users(id);


--
-- Name: request_steps request_steps_delegated_from_fkey; Type: FK CONSTRAINT; Schema: wf; Owner: -
--

ALTER TABLE ONLY wf.request_steps
    ADD CONSTRAINT request_steps_delegated_from_fkey FOREIGN KEY (delegated_from) REFERENCES core.users(id);


--
-- Name: request_steps request_steps_request_id_fkey; Type: FK CONSTRAINT; Schema: wf; Owner: -
--

ALTER TABLE ONLY wf.request_steps
    ADD CONSTRAINT request_steps_request_id_fkey FOREIGN KEY (request_id) REFERENCES wf.requests(id);


--
-- Name: requests requests_definition_code_fkey; Type: FK CONSTRAINT; Schema: wf; Owner: -
--

ALTER TABLE ONLY wf.requests
    ADD CONSTRAINT requests_definition_code_fkey FOREIGN KEY (definition_code) REFERENCES wf.definitions(code);


--
-- Name: requests requests_requested_by_fkey; Type: FK CONSTRAINT; Schema: wf; Owner: -
--

ALTER TABLE ONLY wf.requests
    ADD CONSTRAINT requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES core.users(id);


--
-- Name: requests requests_subject_employee_id_fkey; Type: FK CONSTRAINT; Schema: wf; Owner: -
--

ALTER TABLE ONLY wf.requests
    ADD CONSTRAINT requests_subject_employee_id_fkey FOREIGN KEY (subject_employee_id) REFERENCES core.employees(id);


--
-- PostgreSQL database dump complete
--

\unrestrict xlUM9ygYIqmrsFeX5iBcsLoADjP0f1TaGiBJAowhfGxykL8DcAcNTchlZmQs9ET

