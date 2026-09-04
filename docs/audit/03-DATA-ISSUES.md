# 03 — Data, Schema & Integrity Issues

Every SQL block below is runnable against a live database to detect the condition. All were executed
against `hrms_audit_test`, built from `backend/migrations/` from scratch on 4 Sep 2026.

**Environment note:** the database I audited runs **PostgreSQL 14.21**, two major versions below the
PostgreSQL 16 that docs/14 §2 and docs/02 §1 specify. `postgresql@17` is installed but not running.
Everything below should be re-verified on the production version before remediation is signed off.

---

## 1. Schema drift: docs/03 vs. the migrated database

### 1.1 Tables docs/03 specifies that do not exist

**The whole payroll core** (docs/03 §6) — `pay.employee_salaries`, `salary_structures`,
`salary_components`, `payroll_runs`, `payroll_items`, `payroll_item_lines`, `statutory_rates`,
`pt_slabs`, `it_slabs`, `inputs`, `arrears`, `loans`, `loan_postings`, `salary_holds`, `bank_batches`,
`fnf_settlements`, `investment_declarations`, `tds_challans`, `claim_bills`, `claim_entitlements`.
Expected — plans/phase-2 has every stage at ☐. Recorded because docs/03 §10 rules 1 and 4
(locked-payroll immutability; `attendance_lock_id NOT NULL` when a run is computed) are therefore
**unimplementable today** and must be built with the tables, not after.

**Lifecycle** (docs/03 §7) — `core.onboarding_candidates`, `core.onboarding_tasks`,
`core.probation_reviews`, `core.separations`, `core.clearances`. Expected (Phase 3).

**Others** — `core.employee_education`, `core.employee_prev_employment` (CORE-01 master completeness);
`eng.surveys`, `eng.survey_responses`, `eng.poll_votes` (EN-03 pulse surveys; the DB has
`eng.poll_responses` instead, an undocumented rename).

### 1.2 Tables that exist and are undocumented

Roughly 45. Whole schemas absent from docs/03: `sec.*` (7 tables), `prv.*` (12), `cmp.*` (3),
`ird.*` (5), `doc.*` (1), `reporting.*` (2). Plus:
`core.{settings, plants, mis_codes, password_reset_tokens, profile_change_requests}`,
`att.{coverage_targets, employee_shifts, ingest_watermarks, leave_blackouts, manager_month_approvals,
quarantined_swipes, recompute_queue, roster_publications, roster_revisions, shift_patterns, shift_swaps}`,
`lv.{restricted_holidays, rh_selections}`, `hd.categories`, `pay.{budgets, budget_categories,
claim_lines, claim_reservations}`.

> **`core.settings` is the one to fix first.** CLAUDE.md rule 2 makes it the home of every policy value in
> the system, and docs/03 — the document that promises *"every table and every column"* — never mentions it.

**Detect:**
```sql
-- list every base table so it can be diffed against docs/03
SELECT n.nspname || '.' || c.relname AS table_name
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE c.relkind IN ('r','p') AND c.relispartition = false
   AND n.nspname NOT IN ('pg_catalog','information_schema')
 ORDER BY 1;
```

---

## 2. Constraints that the specification requires and the database lacks

### 2.1 Zero temporal exclusion constraints  ·  [C1] · P1

docs/14 §6.2 and CLAUDE.md §1 require
`EXCLUDE USING gist (employee_id WITH =, daterange(effective_from, effective_to) WITH &&)` on every
effective-dated table, so *"overlapping salary rows become a DB error, not a payroll bug."*

**Detect:**
```sql
SELECT count(*) AS exclusion_constraints FROM pg_constraint WHERE contype = 'x';
-- returns 0
```

**Unprotected effective-dated ranges today:**
```sql
SELECT table_schema||'.'||table_name, string_agg(column_name, ', ')
  FROM information_schema.columns
 WHERE column_name IN ('valid_from','valid_to','period_from','period_to','effective_from','effective_to')
   AND table_schema NOT IN ('pg_catalog','information_schema')
 GROUP BY 1 ORDER BY 1;
-- att.roster_publications (period_from, period_to)
-- cmp.registrations       (valid_from, valid_to)     ← licence validity: overlaps are a compliance error
-- pay.budgets             (period_from, period_to)
-- pay.claims              (period_from, period_to)
-- prv.notices             (effective_from)
```

**Fix:** `CREATE EXTENSION IF NOT EXISTS btree_gist;` then add an `EXCLUDE` per table. Do it now, while
the tables are nearly empty.

### 2.2 `att.employee_shifts` has no effective dating at all  ·  [C2] · P1

```
                          Table "att.employee_shifts"
 employee_id       | bigint  | not null      ← PRIMARY KEY: one row per employee, ever
 weekday_shift_id  | bigint  | not null
 saturday_shift_id | bigint  |
 updated_by        | bigint  |
 created_at        | timestamptz | not null
 updated_at        | timestamptz | not null
```

This is a **mutable current-state table**. The day-status processor resolves an employee's shift from it,
so changing a shift today changes the shift used by every future recompute of every past unlocked day —
altering late minutes, half-day thresholds and OT on attendance that has already been shown to the
employee. ATT-03 requires idempotent recompute; docs/14 §7.1 requires a run to be a deterministic function
of facts *as known at the time*.

**Detect drift risk (rows whose shift changed after attendance was computed):**
```sql
SELECT es.employee_id, es.updated_at AS shift_changed_at,
       count(*) FILTER (WHERE dr.work_date < es.updated_at::date AND NOT dr.is_locked) AS rewritable_days
  FROM att.employee_shifts es
  JOIN att.day_records dr ON dr.employee_id = es.employee_id
 GROUP BY 1,2 HAVING count(*) FILTER (WHERE dr.work_date < es.updated_at::date AND NOT dr.is_locked) > 0
 ORDER BY 3 DESC;
```

**Fix:** add `effective_from date NOT NULL`, `effective_to date`, a surrogate PK, an `EXCLUDE` on
`(employee_id, daterange(effective_from, effective_to))`, and resolve by `work_date`.

### 2.3 The exactly-once swipe guarantee is defeated by NULL  ·  [C3] · P1

`swipe_events_employee_no_swipe_ts_door_code_key UNIQUE (employee_no, swipe_ts, door_code)` — and
`door_code` is **nullable**. In Postgres NULL ≠ NULL, so the index does not dedupe those rows.

**Proven:**
```sql
INSERT INTO att.swipe_events (employee_no, swipe_ts, door_code, received_at, source) VALUES
 ('ACO000001','2026-09-15 09:00:00+05:30', NULL, now(), 'kent'),
 ('ACO000001','2026-09-15 09:00:00+05:30', NULL, now(), 'kent'),
 ('ACO000001','2026-09-15 09:00:00+05:30', NULL, now(), 'kent');
-- INSERT 0 3
```

docs/14 §8.2 states this index *is* the exactly-once guarantee. `att.swipe_events` is append-only by
trigger, so duplicates admitted this way can never be removed — and they shift first-in/last-out, which
shifts OT minutes, which is money.

**Detect existing duplicates:**
```sql
SELECT employee_no, swipe_ts, count(*)
  FROM att.swipe_events WHERE door_code IS NULL
 GROUP BY 1,2 HAVING count(*) > 1 ORDER BY 3 DESC;
```

**Fix:** backfill `door_code` to a sentinel, then
`ALTER TABLE att.swipe_events ALTER COLUMN door_code SET NOT NULL;`
(or replace the constraint with a unique index on `COALESCE(door_code,'')`).

### 2.4 `core.user_roles` uniqueness includes a nullable column  ·  [C8] · P2

`UNIQUE (user_id, role_id, scope_org_unit_id)` with `scope_org_unit_id` nullable admits duplicate
unscoped grants. Confirmed while building fixtures: `ON CONFLICT (user_id, role_id)` is rejected because
no such constraint exists.

**Detect:**
```sql
SELECT user_id, role_id, count(*)
  FROM core.user_roles WHERE scope_org_unit_id IS NULL
 GROUP BY 1,2 HAVING count(*) > 1;
```
**Fix:** `CREATE UNIQUE INDEX … ON core.user_roles (user_id, role_id, COALESCE(scope_org_unit_id, 0));`

### 2.5 Two CHECK constraints added `NOT VALID` and never validated  ·  [C7] · P2

```sql
SELECT conrelid::regclass, conname FROM pg_constraint WHERE convalidated = false;
-- att.day_records | day_records_minutes_nonnegative
-- att.day_records | day_records_session_statuses_valid
```
They enforce on new writes only; pre-existing rows were never checked and the planner cannot rely on them.
**Fix:** report violators, then `ALTER TABLE att.day_records VALIDATE CONSTRAINT …`.

### 2.6 Money- and share-adjacent columns without invariants  ·  [C10] · P2

```sql
SELECT table_schema||'.'||table_name||'.'||column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE data_type IN ('numeric','double precision','real')
   AND table_schema NOT IN ('pg_catalog','information_schema') ORDER BY 1;
```
Missing invariants: `ast.maintenance.cost` (no `>= 0`), `att.devices.expected_hourly_swipes` (no `>= 0`),
`reporting.kpi_daily.value` (unconstrained), and — the one that matters for F&F —
`core.employee_family.nominee_share_pct`, which has **no 0–100 range check and no per-employee sum
constraint**, so nominee shares can total anything.

**Detect bad nominee shares:**
```sql
SELECT employee_id, sum(nominee_share_pct) AS total
  FROM core.employee_family WHERE nominee_share_pct IS NOT NULL
 GROUP BY 1 HAVING sum(nominee_share_pct) <> 100;
```

### 2.7 Unconstrained text where an enum is implied  ·  [C11] · P3

`core.audit_log.action`, `core.documents.kind`, `core.settings.value_type`,
`att.swipe_events.{direction, swipe_type, location_type}`, `core.employees.marital_status`,
`ast.assets.category`. `direction` is the column the ATT-18 first-in/last-out logic reads.

> **Correction to a first impression:** `att.day_records.status` *is* protected — `att.day_status` is a
> real PostgreSQL enum whose labels (`P,A,HD,WO,H,L,OD,CO,UAB`) match the zod enum exactly. Verified:
> `INSERT … status='ZZZ'` → `ERROR: invalid input value for enum att.day_status`.

---

## 3. Partitioning

| Table | Partitions present | Auto-creation | State |
|---|---|---|---|
| `att.swipe_events` | 202609, 202610 | `att.ensure_swipe_partition` **is called** on the ingest path (`ingest.service.ts:116,248`) | ✅ safe |
| `sec.access_events` | 202609, 202610 | `sec.ensure_access_partition` exists but **has no caller** | ❌ [C4] |

**Proven failure, 1 Nov 2026:**
```sql
INSERT INTO sec.access_events (actor_user_id, resource, field_class, purpose, ip, occurred_at)
VALUES (1,'employee.profile','statutory_ids','audit probe',NULL,'2026-11-01 10:00:00+05:30');
-- ERROR: no partition of relation "access_events" found for row
```

**Detect the next gap on any environment:**
```sql
SELECT parent.relname AS table_name,
       max(substring(child.relname from '\d{6}$')) AS last_partition
  FROM pg_inherits i
  JOIN pg_class child  ON child.oid  = i.inhrelid
  JOIN pg_class parent ON parent.oid = i.inhparent
 GROUP BY 1;
```
**Fix:** call `sec.ensure_access_partition` on the write path *and* add a monthly job pre-creating three
months ahead for both tables. Note that `att.swipe_events` is protected only because ingestion is the sole
writer — any second writer must call the helper too.

---

## 4. Integrity that is enforced correctly (do not disturb)

**Append-only triggers** — verified present on 14 tables:
```sql
SELECT c.relname, t.tgname FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
 WHERE NOT t.tgisinternal AND t.tgname LIKE '%immutable%' OR t.tgname LIKE '%append_only%';
```
`core.audit_log`, `att.swipe_events`, `lv.ledger`, `att.month_locks`, `att.roster_revisions`,
`att.manager_month_approvals`, `sec.access_events`, `prv.{consent_events, purge_log, breach_register}`,
`cmp.filing_evidence`, `ird.posh_case_access_log`, `pay.claim_reservations`, `hd.ticket_messages`.

**The audit hash chain** is computed in the database, serialized by `pg_advisory_xact_lock` on a dedicated
`core.audit_log_chain_seq` (not by `id`, which is assigned before the lock — a real bug that was found and
fixed). Verify integrity at any time:
```sql
SELECT core.verify_audit_chain();   -- NULL / empty = intact
```

**The lock guards** are correct. `day_records_lock_guard` refuses any write to a row with `is_locked`;
`day_records_month_lock_guard` refuses writes in a locked month **except** the single lock transaction
itself, identified by comparing `to_jsonb(NEW) - 'is_locked' - 'updated_at'` against the same projection of
`OLD`. That is precisely the right shape.

**Verify no locked attendance was mutated:**
```sql
SELECT dr.employee_id, dr.work_date, dr.updated_at, ml.locked_at
  FROM att.day_records dr
  JOIN core.employees e ON e.id = dr.employee_id
  JOIN att.month_locks ml ON ml.company_id = e.company_id
   AND ml.month = date_trunc('month', dr.work_date)::date
 WHERE dr.updated_at > ml.locked_at;   -- must be empty
```

---

## 5. Seed, import and data-quality risk

### 5.1 The 1,066-employee import path is not reachable  ·  [I1] · P1

`importEmsSeed` and `importGreythrEnrich` exist in `src/modules/employees/import.service.ts`, are covered
by `tests/employee-import.integration.test.ts`, and are exported from the module index — but they are
**called by nothing outside tests**: no oRPC procedure, no npm script, no file in `backend/scripts/`.

**Impact:** Stage 0.5's exit criterion *"1,066 EMS rows loaded + enriched, reconciliation counts match
both sources, exception report reviewed by HR ops"* cannot be executed by anyone but a test runner, yet
the stage is marked ☑ done. Gate G0 correctly still shows this box unticked.

**Fix:** add `npm run import:ems` / `import:greythr` CLI entrypoints that write the exception report to a
file, plus a dry-run mode. This is also the natural home for the `is_india_payroll` and RML-dedupe
assertions.

**Post-import reconciliation queries to run:**
```sql
-- entity split vs docs/00 §3 (RML 667, RGH 174, RDL 96, RPL 57)
SELECT c.code, c.name, c.is_india_payroll, count(e.id)
  FROM core.companies c LEFT JOIN core.employees e ON e.company_id = c.id
 GROUP BY 1,2,3 ORDER BY 4 DESC;

-- the dedupe that must have happened on import
SELECT code, name FROM core.companies WHERE name ILIKE '%metalix%' OR name ILIKE '%metaliks%';

-- e-code series conformance (CORE-02)
SELECT e.ecode, c.ecode_prefix FROM core.employees e JOIN core.companies c ON c.id = e.company_id
 WHERE e.ecode NOT LIKE c.ecode_prefix || '%';
```

### 5.2 There is no write path to the employee master  ·  [E4] · P1

`employee.write` is seeded and enforced nowhere; the employees router is read-only. HR cannot correct a
PAN, change a department or fix a reporting manager except by direct SQL — which also bypasses
`core.audit_log`, so CORE-11 ("who changed which field, old → new") has nothing to record.

### 5.3 Standing data-quality probes

```sql
-- CORE-06 / PP-17: exited employees must have a DOL (CHECK-enforced; verify anyway)
SELECT id, ecode, status, dol FROM core.employees WHERE status = 'exited' AND dol IS NULL;

-- CORE-03: both reporting and functional manager present
SELECT count(*) FILTER (WHERE reporting_manager_id IS NULL) AS no_rm,
       count(*) FILTER (WHERE hod_employee_id IS NULL)      AS no_hod
  FROM core.employees WHERE status IN ('active','on_notice');
-- NOTE: employees with no RM are exactly the population exposed to the
-- vacant-chain auto-approval defect [E1]. Run this BEFORE fixing anything else.

-- CORE-07: statutory identifier completeness and format
SELECT count(*) FILTER (WHERE pan     IS NULL) AS missing_pan,
       count(*) FILTER (WHERE aadhaar IS NULL) AS missing_aadhaar,
       count(*) FILTER (WHERE uan     IS NULL) AS missing_uan,
       count(*) FILTER (WHERE pan IS NOT NULL AND pan !~ '^[A-Z]{5}[0-9]{4}[A-Z]$') AS bad_pan,
       count(*) FILTER (WHERE aadhaar IS NOT NULL AND aadhaar !~ '^[0-9]{12}$')     AS bad_aadhaar
  FROM core.employees WHERE status IN ('active','on_notice');

-- duplicates that CORE-08 says must be impossible
SELECT 'pan' AS field, pan AS value, count(*) FROM core.employees WHERE pan IS NOT NULL
 GROUP BY 1,2 HAVING count(*) > 1
UNION ALL
SELECT 'uan', uan, count(*) FROM core.employees WHERE uan IS NOT NULL
 GROUP BY 1,2 HAVING count(*) > 1;

-- orphaned reporting tree (cheap and catches import errors)
SELECT e.id, e.ecode, e.reporting_manager_id FROM core.employees e
  LEFT JOIN core.employees m ON m.id = e.reporting_manager_id
 WHERE e.reporting_manager_id IS NOT NULL AND m.id IS NULL;

-- workflow requests that completed with no approval step at all  ← [E1]
SELECT r.id, r.definition_code, r.subject_employee_id, r.requested_by, r.status
  FROM wf.requests r LEFT JOIN wf.request_steps s ON s.request_id = r.id
 WHERE r.status IN ('approved','rejected') GROUP BY r.id HAVING count(s.id) = 0;

-- notifications that were queued and never delivered  ← [A2]
SELECT status, count(*), min(created_at) AS oldest FROM wf.notifications GROUP BY 1;
```

---

## 6. Masking, logging and privacy

**Working:** statutory-ID masking is correct at the service layer (`canViewStatutoryIds` — own record or a
payroll-class permission). Verified live that a peer's PAN/Aadhaar/UAN/bank return `null` with
`statutoryMasked: true`. `pino` redacts `*.password`, `*.aadhaar`, `*.pan`, `*.bank_account` and
`req.headers.authorization`.

**Not working:**
1. **[C5] The sensitive-access log is never written.** `recordAccess()` has no callers, so
   `sec.access_events` stays empty and `GET /security/my/access-history` (SEC-11 / DPDP "who looked at my
   record") is permanently blank. The function's docblock promises it *"never throws into the caller's
   path"* but there is no try/catch — so once wired, [C4] turns it into a 500 on every masked read.
2. **[D2] Everything except statutory IDs is unscoped.** Masking protects PAN and bank; it does nothing
   for date of birth, personal email, mobile, home address or emergency contact, all of which any
   authenticated user can read for any employee (see [`05-SECURITY-REVIEW.md`](05-SECURITY-REVIEW.md) §1).
3. **`writeAudit` does not enforce masking.** `AuditEntry.oldValue/newValue` are free strings with only a
   comment saying *"Sensitive values must be MASKED by the caller"*. There is no employee-write path yet,
   so nothing violates it today — but the guard should exist before one is built.

---

## 7. Dates and timezone

`core/dates.ts` is correct (see [`02-WHATS-WORKING.md`](02-WHATS-WORKING.md) §7). Two residual risks:

1. **[E8] Two scheduled jobs are commented IST but scheduled UTC.** pg-boss `schedule()` defaults to UTC.
   `WEEK_CLOSE_QUEUE '0 2 * * 1'` (commented "Monday 02:00 IST") fires at 07:30 IST;
   `ROSTER_REMINDER_QUEUE '0 9 5 * *'` (commented "the 5th, 09:00") fires at 14:30 IST. Every other job in
   the file converts explicitly, so this is an oversight, not a convention.
2. **`formatDbDate` depends on the Node process timezone matching the database session timezone.** It uses
   local getters to invert pg's local-midnight construction, which is right — but nothing pins `TZ` or
   asserts agreement at boot. Add both.

**Night-shift crossing midnight** is handled by design (`att.shifts.crosses_midnight`; the shift window is
`[start − 4h, end + 8h]` per docs/04 §1.1) and `tests/shift-windows.test.ts` covers 11 cases —
but **UNVERIFIED end-to-end**: I did not construct a night-shift employee with real cross-midnight swipes
and assert the resulting day assignment. That belongs in the remediation test set.
