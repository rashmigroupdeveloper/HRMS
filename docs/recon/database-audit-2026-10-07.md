# HRMS local database and connection audit — 07 Oct 2026

Read-only audit requested by sponsor. Requirements: CORE-08/10/11/12, ATT-01/03/12/15, WF-02/03, NFR-03/05; docs 02, 03, 11, 13 and 14. This is audit evidence, not a completed build stage or gate approval.

Scope: the current HRMS checkout, its connection factory, integration-test setup and the local database selected by `backend/.env`. Queries ran inside repeatable-read, read-only transactions with a 20-second statement timeout and rollback. No personal identifiers, passwords, statutory IDs or bank details are reproduced. No data, grants, migrations, triggers or credentials were changed. Production and EMS were not inspected.

Connection succeeded: `localhost:5432/hrms`, database role `anooppratapsingh`, native Homebrew PostgreSQL **14.24**. Spec target is PostgreSQL **16**. Only one Git worktree was listed, on `main`. Separate test databases exist, but the inspected integration suites read `DATABASE_URL` from the application's `.env`.

## Highest-priority findings

### 1. Integration tests can unlink every employee account — critical

`backend/tests/employee-import.integration.test.ts:45` executes an UPDATE of `core.users.employee_id` to NULL for **all linked users**. It is not restricted to the fixture employee IDs, despite the preceding comment claiming fixture-only cleanup. It uses the application's `DATABASE_URL`.

Observed: **2,355 of 2,370 users are unlinked**, including **328 of 343 active users**. **273 active users have no role grants**. Admin/service accounts may legitimately be unlinked, so those counts alone do not prove every account is broken. The unrestricted test mutation is independently confirmed and can damage real account-to-employee relationships. It is a plausible contributor to the observed state; historical causation was not proven.

Repair: require a dedicated disposable test database and fail closed on application database targets; scope cleanup by fixture IDs. Restore account links from authoritative mappings, preserving audit history. Do not reconstruct links by guessing names.

### 2. Test data has poisoned attendance completeness — critical

All **4 device watermarks** equal **10 Dec 2083, 19:00 IST**, on active devices with a `ghost-*` test source. The devices are `Seamless-Plant_S4`, `Seamless-Plant_G4`, `DIP-6_Main`, and `Corporate_HO_1`.

`kent-ingestion.integration.test.ts:26` chooses random dates from 2030 onward and uses existing employee codes. The mock connector shares door names across runs. The live watermark guard prohibits regression, and ingestion uses `GREATEST`, so ordinary real-data ingestion cannot bring these cursors back to the present. A completeness test using these devices can falsely conclude that current shifts are synchronized. Actual incorrect absence finalization was not demonstrated.

Observed contamination:

| Data | Total | Future relative to 07 Oct 2026 |
|---|---:|---:|
| Raw swipes | 11,352 | 2,525; latest 10 Dec 2083 |
| Processed attendance days | 3,834 | 1,452; latest 01 Dec 2097 |
| Leave ledger rows | 2,749 | 2,516 |
| Recompute queue entries | 3,265 | 750 |

There are **80 monthly swipe partitions**, **253 source values**, and **102 unresolved swipes**. `mock-kent-test` contributes 1,632 future swipes. Future leave accruals can be legitimate; these counts are flags for classification, not automatic deletion instructions. A source labelled `kent` is not proof of genuine device provenance.

Repair: isolate tests first. Preserve the contaminated database as evidence and establish a clean application database from verified migrations and sanctioned data. Restore device completeness only from proven connector receipts. Preserve append-only evidence; do not disable immutability triggers to bulk-delete fixtures.

### 3. Checkout and applied database schema have diverged — high

**13 applied migrations have no source file in this checkout:** prefixes 175206, 175207, 175208, 175209, 175210, 175211, 175212, 175214, 175215, 175216, 175217, 175218, and 175219 (full timestamp prefixes are in `public.pgmigrations`). Their domains include identity, compliance, scheduling, privacy, documents, grievances, budgets, employee HOD, audit ordering, and integrity checks.

`1752200000000_rbac-last-admin-guard.ts` exists locally but is unapplied and in an unresolved delete/modify conflict. This database cannot presently be reproduced from the checkout alone. The discrepancy may reflect previous branch work; it does not by itself prove an invalid database migration.

`backend/src/app.ts` and `backend/package-lock.json` contain conflict markers; five paths have unmerged index entries. **`npm run verify` failed at typecheck with TS1185**, before tests or build. Resolve the Git state and recover the migration history before running migrations. Do not run destructive down migrations to make counts match.

### 4. Deployed audit hashing omits the required scope field — high

`core.verify_audit_chain()` returned NULL: **7,338 rows pass the current verifier**. However, both deployed functions `core.audit_log_chain` and `core.verify_audit_chain` omit `scope_org_unit_id` and do not branch on `hash_version`. The verifier orders by `chain_seq`.

Checked-in migration `1752050000000_audit-org-unit-scope.ts` explicitly requires v2 hashes to cover scope. The deployed functions have therefore diverged from this checked-in definition. Passing the current verifier does not establish integrity of the scope field. No tampering was observed, and append-only triggers remain enabled.

Repair: recover the later audit migration and review the evolution of the hash format. Add a forward, version-aware correction that preserves existing evidence; do not rewrite historical hashes to manufacture a passing result.

### 5. Employee master is unsuitable for operational use — high

There are **1,387 employee rows**, **179 company rows**, and **997 active employees**. Company names include extensive test fixtures such as `MMT*`; counts cannot be treated as the sanctioned 1,066-person EMS import. The tracker already says the real snapshot import remains pending.

Among the 997 active employees:

| Missing field | Rows |
|---|---:|
| Mobile | 997 |
| Designation | 997 |
| Org unit | 997 |
| Grade | 997 |
| DOB | 962 |
| Department | 962 |
| Cost center | 962 |
| Location | 927 |
| Category | 892 |
| Reporting manager | 666 |
| DOJ | 535 |

**68 active rows have future DOB or DOJ**, and **523 employee codes do not start with their company's configured prefix**. Future DOJ can represent a legitimate planned joiner; active status and test provenance need review before classifying these as errors. Grade enrichment is a known later dependency; missing values should block readiness rather than be filled with invented defaults.

Repair: use the sanctioned EMS snapshot, canonical entity map and greytHR enrichment, with per-row reconciliation and reviewed exceptions (CORE-12). Keep fixtures out of business counts.

### 6. Notification routing is empty and work is overdue — high

`wf.event_subscriptions` has **0 rows**. `enqueueEvent()` loops over this matrix and returns zero when it is empty, so event-based fan-out currently has no configured audience. Directly queued notifications can still exist.

Observed: **39 queued in-app notifications** dated 04 Sep 2026; **56 pending workflow steps** have elapsed SLA deadlines; **3,265 recompute entries** date from 03–04 Sep 2026. All 96 recorded workflow steps have non-NULL `notified_at`, but this does not prove actual SMTP delivery. The development transport marks log-only sends as sent.

Only the audit connection was present in `hrms` at the inspection snapshot. This supports checking whether workers are running, but does not prove they were never run or that production workers are down. No `pgboss` schema appeared in the inspected table inventory.

Repair: configure the authorized recipient matrix and real transport, recover worker scheduling, then verify delivery and queue drainage against clean data.

### 7. Local connection and recovery configuration need hardening — readiness gaps

- Application connection uses a **PostgreSQL superuser** with CREATE ROLE, CREATE DATABASE and BYPASSRLS. Replace with a least-privilege application role and separate migration/test roles before deployment.
- PostgreSQL is **14.24**, while docs lock **16**. The shell runtime is **Node 26.8.2**, while backend package engines specify **24.x**. Align runtimes and validate migrations in the target versions.
- Pool uses `max: 10` but declares no connection acquisition timeout, application name, query timeout or idle pool error listener. Server statement and idle-in-transaction timeout defaults are both zero. The audit's own local timeout is not a configured application protection.
- Connection targets native port 5432 directly. No PgBouncer path was observed for this local setup; staging deployment remains pending in the tracker.
- WAL `archive_mode` is **off**. This database is not doing WAL archiving for PITR. No backup/restore artifacts were found by the filename search; off-box backups or production recovery were not verified.
- `backend/.env`, `backend/.env.bak-5432`, and `frontend/.env` have mode **0644**, rather than the docs' 0600 requirement. The backup expands the credential footprint. Credentials were not printed or reused for external access. The AGENTS instruction to rotate previously shared credentials remains outstanding; no rotation was attempted.
- PostgreSQL listens only on localhost; SSL is off. Local plaintext transport is contextual, not evidence of remote exposure.

## Checks that passed, and their limits

- Connection successful; no recorded database deadlocks or invalid indexes.
- Audit chain passes the deployed verifier, with the scope limitation above.
- Audit, raw-swipe and leave-ledger immutability triggers are enabled. Lock and watermark guards are enabled. This audit did not attempt destructive writes to retest them.
- No unlocked day records beneath existing company month locks.
- No negative attendance minute values or inverted first-in/last-out pairs found.
- No negative employee/type leave balances as of 07 Oct 2026.
- No duplicate normalized company/department/designation names, duplicate role grants, or multiple user links to the same employee found.
- No cross-company employee org-unit/location/cost-center mismatches or self-reporting managers found. Broader hierarchy cycle detection was not performed.
- Two attendance CHECK constraints remain **NOT VALID**: `day_records_minutes_nonnegative` and `day_records_session_statuses_valid`. They still constrain new/changed rows; historical validation is unfinished. The minute audit passed; historical session JSON was not separately validated.

## Repair order

1. Prevent integration tests from targeting the application database; restrict fixture cleanup.
2. Resolve merge conflicts and recover the 13 missing applied migration sources.
3. Preserve a backup/snapshot; rebuild a clean local application database using reproducible migrations and sanctioned imports.
4. Restore employee/login mappings and device completeness from authoritative sources.
5. Correct audit hash-version/scope coverage with preserved historical evidence.
6. Configure notification recipients and real transport; prove worker drainage and delivery.
7. Align PostgreSQL/Node versions; implement least-privilege roles and tested recovery; validate historical constraints and rerun verification against isolated tests.

No implementation stage or phase gate was marked complete by this audit.

## Follow-up: schema and application connection check

Additional read-only checks on 07 Oct 2026 used the **actual `createDatabase()` Kysely factory** from `backend/src/core/db/database.ts`. A transaction queried `current_database()`, `current_user`, server port and a constant successfully, then destroyed the pool. This proves the backend connection factory can reach `hrms` on port 5432 with the current configuration. It does not prove the Express application can start.

The configured development path is frontend `:5173` → Vite `/api` proxy → backend `:5100` → Kysely/pg pool → `localhost:5432/hrms`. An HTTP request to `http://localhost:5100/api/system/health` returned connection refused at inspection time. The checked-in health procedure is liveness-only and does not query PostgreSQL, so an eventual HTTP 200 would still need a separate database readiness check.

Catalog results:

- **104 business relations plus `public.pgmigrations`**, across 15 schemas; monthly partitions excluded from this count. All inspected base/partitioned tables have primary keys.
- **202 FK definitions** in the catalog query excluding constraints with a parent constraint ID. No invalid indexes were found; two attendance CHECK constraints remain unvalidated as described above.
- **All 61 tables declared by the backend `Database` interface exist**, and every column declared for those tables exists. An AST-based comparison of interface property names against catalog column names found no missing declared tables or columns.
- **43 business relations are absent from the backend `Database` interface**, including the `sec`, `cmp`, `prv`, `ird`, and `doc` additions, payroll budget/claim tables, and scheduling additions. This is consistent with the missing migration sources; the current checkout represents an older application contract than the database.
- **15 additional database columns** are absent from their mapped TypeScript interfaces: `core.audit_log.chain_seq`; `core.companies.sap_company_code`; `core.cost_centers.plant_id`; `core.departments.mis_code_id`; `core.employees.plant_id` and `hod_employee_id`; `core.documents.expires_on` and `status`; and seven `att.shifts` columns (`break_paid`, `ot_start_offset_minutes`, `late_slabs`, `early_exit_slabs`, `allowance_component_code`, `session2_start`, `session2_end`). Extra columns do not automatically break existing queries, but they violate the intended lock-step schema/type maintenance.
- The mechanical nullability check flagged two nullable JSON fields typed as `unknown`; **these are not confirmed type errors**, because `unknown` admits NULL. This check does not certify runtime type compatibility, defaults, numeric precision, or enum value parity.
- **No temporal exclusion constraints exist** in this database, including on `att.employee_shifts`. Doc 14 requires exclusions for effective-dated assignments. Payroll salary tables are not yet present, so their absence is future-phase work rather than proof of a broken salary exclusion.
- `att.day_records` is an ordinary table, while doc 13 calls for monthly partitioning of swipes and processed attendance. Swipes and security access events are partitioned; the attendance-day scale requirement remains unmet.
- `core.user_roles` uses ordinary `UNIQUE(user_id, role_id, scope_org_unit_id)` with a nullable scope. This does not structurally prevent repeated global grants with NULL scope. No such duplicates were found in the data audit; this is a constraint weakness to address in a forward migration.

Employee NULLability is explicitly documented in migration 175181 as temporary support for EMS seeding followed by greytHR enrichment. Tightening is a payroll precondition. The current NULLable schema should therefore be reported as an unfinished readiness gate, rather than silently changed during a read-only review.

Connection verdict: **database connection works; API connection is currently unavailable; application types and migration history are incomplete relative to the live schema.** No schema or application code was changed by this follow-up.
