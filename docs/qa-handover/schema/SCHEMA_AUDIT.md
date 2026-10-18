# Rashmi HRMS: database schema audit (precision and slop)

**Auditor:** schema worker. **Date:** Sun 18 Oct 2026, about 21:50 IST
**Target:** live DB `postgres://hrms@localhost:5432/hrms` (PostgreSQL 17.11) plus `backend/migrations` (54 files) plus `backend/src/core/db/types*.ts`
**Method:** read-only. Every psql session ran with `PGOPTIONS='-c default_transaction_read_only=on'`. I did not restart, migrate, seed or write anything in the app or DB.
**Evidence files:** `schema/evidence/`
- `schema.sql`: pg_dump --schema-only
- `columns.psv`: 1,549 columns across 146 base tables
- `constraints.psv`
- `spec_col_diff.txt`, `spec_type_null_diff.txt`
- `kysely_drift.txt`, `fk_noindex.txt`, `nofk.txt`, `redundant_idx.txt`
- `queries.sql`: the key reproducible queries

Severity rules:
- **Critical:** wrong money or statutory output.
- **High:** integrity hole that already corrupted data, or a guaranteed functional failure.
- **Medium:** a precision or integrity gap that will bite.
- **Low:** hygiene.

---

## 1. Verdict

**The schema is moderately precise: good types, too few constraints, and a lot of sprawl. Score: 6/10.**

What is precise (I verified each point):
- No `float`, `real` or `double` anywhere.
- All `pay.*` money is `NUMERIC(14,2)`, bank totals are `NUMERIC(16,2)`, and rates are `NUMERIC(6,4)` or `NUMERIC(14,4)`.
- Every instant is `timestamptz`. The only exception is node-pg-migrate's own `pgmigrations.run_on`.
- Business days are `date`.
- Swipe→work_date attribution is correct for IST. 0 `day_records` rows have `(first_in AT TIME ZONE 'Asia/Kolkata')::date <> work_date`.
- Every table has a PK.
- The required uniques exist:
  - one attendance row per employee per day: `day_records(employee_id, work_date)`
  - one payslip per employee per run: `payroll_items(run_id, employee_id)`
  - `payroll_runs(company_id, month, run_type)`
  - `rosters(employee_id, work_date)`
  - `overtime_entries(employee_id, work_date)`
- Salary history is protected by a GiST `EXCLUDE` against overlapping revisions.
- The org spine is tenant-safe: composite `(x_id, company_id)` FKs from `core.employees` to locations, cost_centers, org_units and plants. 0 mismatching rows.
- Append-only triggers exist for the audit chain, the ledger, swipes and month locks.
- All 54 migrations are applied, their names match the files 1:1, and each has a `down()`.

What is not precise:
1. Statutory configuration is not data. `pay.statutory_rates` is empty, and `pt_slabs` and `it_slabs` are never read. Statutory rates are hard-coded literals in `pay.salary_components.formula`, with no ₹21k ESIC gate and no PF cap.
2. Columns that docs/03 declares `NOT NULL` on the employee master are nullable in the DB, and the data already has gaps.
3. Indian identifiers (PAN, Aadhaar, UAN, ESIC, IFSC, account number) have no format CHECK and no uniqueness. `INVALIDPAN` is stored.
4. Tenant scoping stops at the org spine. `pay.*` and `te.*` allow cross-company and cross-owner rows, and both kinds exist in the data.
5. The claims schema contradicts itself. The claim insert path is guaranteed to violate `claims_budget_present`, and `claim_types` has duplicate, contradictory flag columns.
6. Sprawl: 63 tables are not in docs/03, 44 tables are never referenced by `backend/src`, and one migration's DDL is silently dead.

## 2. Counts by severity

| Severity | Count |
|---|---|
| Critical | 1 |
| High | 8 |
| Medium | 18 |
| Low | 13 |
| **Total** | **40** |

## 3. Findings

| ID | Sev | table.column | Issue | Evidence | Recommended fix / migration |
|---|---|---|---|---|---|
| S-01 | Critical | `pay.statutory_rates`, `pay.pt_slabs`, `pay.it_slabs`, `pay.salary_components.formula` | docs/03 §6.8 and docs/04 §6.9 say statutory values are versioned **data**. In the DB, `statutory_rates` has **0 rows** (docs/10 §12 lists the seed). `pt_slabs` and `it_slabs` are never referenced in `backend/src` (grep finds only `core/db/types.ts`). Rates are literals in formulas: `ESI_EE = GROSS*0.0075`, `ESI_ER = GROSS*0.0325` (no ₹21,000 eligibility), `PF_ER = PF_WAGES*0.0367` (uncapped, not 12%−EPS). This is the root cause of alpha's ESIC/PF mis-calcs (early-beta-findings.md L16). | `SELECT count(*) FROM pay.statutory_rates` → 0; `SELECT code, formula FROM pay.salary_components WHERE formula ~ '\d\.\d'` → 10 rows; seed in `migrations/1752220000000_pay-schema-init.ts:403-424` | Seed `statutory_rates` from docs/10 §12. Engine reads rates and ceilings by `effective_from`, and formulas use variables such as `ESI_EE_RATE` and `PF_WAGE_CEILING`. Add `UNIQUE(scheme, param, effective_from)` and `UNIQUE(state_code, min_monthly, effective_from)` on `pt_slabs`. |
| S-02 | High | `pay.claims.funding_kind`, `budget_id` | `funding_kind` is `NOT NULL DEFAULT 'budget'`. CHECK `claims_budget_present` requires `budget_id` when funding_kind='budget'. `claims.service.ts:142-156` inserts without `funding_kind` or `budget_id`, so **every claim submission violates the CHECK** (raised as a 500). `pay.claims` has 0 rows. | `information_schema.columns` default `'budget'`; CHECK text in `constraints.psv`; `SELECT (('budget'<>'budget') OR (NULL::bigint IS NOT NULL))` → false. Proven from the schema and code; I did not execute an insert (read-only). | Decide on one claims model. Either the claims service sets `funding_kind='entitlement'`, or a migration changes the default to `'entitlement'` and requires `budget_id` only for budget-funded claims. |
| S-03 | High | `core.employees.pan/aadhaar/uan/esic_ip_number/pf_number/bank_ifsc/bank_account`; `core.companies.pan/gstin/tan`; `core.employee_family.aadhaar` | No format CHECK and no UNIQUE on any statutory identifier, although CORE-07/08 demand format checks plus duplicate ESI/UAN detection. The zod schemas are bare `z.string()` (`employees.router.ts:107-109`, `import.schemas.ts:54-61`). Live row RML000011 has `pan='INVALIDPAN'`. | `SELECT ecode, pan FROM core.employees WHERE pan !~ '^[A-Z]{5}[0-9]{4}[A-Z]$'` → RML000011 | `CHECK (pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$')`, `aadhaar ~ '^[2-9][0-9]{11}$'`, `uan ~ '^[0-9]{12}$'`, `esic_ip_number ~ '^[0-9]{10}$'` (or 17-digit legacy), `bank_ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$'`, `bank_account ~ '^[0-9]{9,18}$'`. Add them `NOT VALID`, clean the data, then `VALIDATE`. Add partial UNIQUE indexes on `pan`, `aadhaar`, `uan` and `esic_ip_number` `WHERE … IS NOT NULL`. Add a Verhoeff check for Aadhaar in the app. |
| S-04 | High | `core.employees.dob, mobile, doj, category, contract_type, designation_id, department_id, org_unit_id, location_id, cost_center_id` | docs/03 §3 declares all ten `NOT NULL`; all ten are **nullable** in the DB. PP-8 says "every employee must carry" a cost center. Data: 11/12 employees have `contract_type` NULL, 2/12 have `cost_center_id` NULL and 1 has `gender` NULL. The Kysely types encode the relaxation (`doj: Timestamp \| null`, types.ts:322). | `spec_type_null_diff.txt`; `SELECT count(*) FILTER (WHERE contract_type IS NULL) …` → 11 / 2 / 1 | Backfill. Then `ALTER … SET NOT NULL`, or `CHECK (status='onboarding' OR (doj IS NOT NULL AND …))` if onboarding rows legitimately lack them. |
| S-05 | High | `pay.employee_salaries.structure_id` | No company consistency. RGH employee RGH000001 (company 2) holds RML structure "G1 Staff Baseline" (company 1). | `SELECT … WHERE e.company_id<>s.company_id` → salary id 4 | Add `UNIQUE(id, company_id)` on `salary_structures`. Add a `company_id` column to `employee_salaries` with composite FKs to `employees(id, company_id)` and `salary_structures(id, company_id)`. Fix row 4. |
| S-06 | High | `te.advances.employee_id`, `te.trips.company_id`, `pay.payroll_items` vs run, `pay.payroll_runs.attendance_lock_id` | Denormalised owner and tenant columns with no composite FK. Live corruption: **te.advances id 1 has employee_id 8 on trip 1, which belongs to employee 9** (the IDOR artefact from alpha's travel finding). `payroll_items.employee_id` is not tied to the run's company, and `attendance_lock_id` can point at another company's lock. | `SELECT a.id,a.employee_id,t.employee_id FROM te.advances a JOIN te.trips t … WHERE a.employee_id<>t.employee_id` → (1, 8, 9) | Drop `te.advances.employee_id` and derive it from the trip, or add FK `(trip_id, employee_id) → te.trips(id, employee_id)`. Add the same pattern for trips→employees(company) and payroll_items→runs(company). |
| S-07 | High | `core.separations.workflow_request_id`, `(employee_id)` | Spec says `workflow_request_id NOT NULL`; the DB has it nullable and with **no FK** to `wf.requests`. Separation 4 is `approved` with `workflow_request_id NULL`, i.e. approved without a chain. Employee 11 has two concurrent `pending` separations (ids 1, 2). There is no "one open separation" uniqueness and no `requested_lwd >= resignation_date` CHECK. | `SELECT id, employee_id, status, workflow_request_id FROM core.separations` | FK plus `CHECK (status='pending' OR workflow_request_id IS NOT NULL)` (or NOT NULL). `CREATE UNIQUE INDEX ON core.separations(employee_id) WHERE status IN ('pending','approved')`. Add a date-order CHECK. |
| S-08 | High | `pay.loans.*` | No CHECK on `principal>0`, `emi>0`, `tenure_months>0`, `interest_rate` range, `outstanding BETWEEN 0 AND principal`. No `created_by`, no `updated_at`, no FK on `workflow_request_id`, and nothing requires a workflow for `source='hrms'`. Live: loan 1 is ₹5,00,00,000 at 0% for 60 months, `active`, `workflow_request_id NULL`. Loan 3 is ₹1 crore and `active` without a workflow. **No `core.audit_log` row exists for any loan** (or for any separation or leave application). | `SELECT … FROM pay.loans`; `SELECT entity,count(*) FROM core.audit_log GROUP BY 1` (no pay.loans / core.separations / lv.applications) | Add the CHECKs. `CHECK (source='sap_legacy' OR status<>'active' OR workflow_request_id IS NOT NULL)`. Add an FK to `wf.requests`, plus `created_by` and `updated_at` with trigger. Write audit rows from the loan, separation and leave services. |
| S-09 | High | `lv.leave_types.applicable_gender` vs `core.employees.gender` | Both are free text with no CHECK and they use different vocabularies. ML has `applicable_gender='F'`, while employees store `'Male'`/`'Female'`. The comparison is `e.gender = t.applicable_gender` (`leave-core.service.ts:88`, `leave-validation.ts:94`), so **0 of 3 female employees are eligible for maternity leave**. | `SELECT t.code, t.applicable_gender, count(e.id) FILTER (WHERE e.gender=t.applicable_gender) …` → `ML\|F\|0\|3` | Add an enum or `CHECK (gender IN ('M','F','X'))` on both columns, plus a data migration mapping Male→M and Female→F. |
| S-10 | Medium | `att.day_records.work_date/status` | Impossible future facts: 4 rows of status `A` for future dates (emp 8: 26–27 Oct; emp 9: 23–24 Nov) written by leave cancel, and one `P/manual` on **2026-12-12**. Nothing prevents an absence or presence from being recorded for a day that has not happened. | `SELECT … FROM att.day_records WHERE work_date > (now() AT TIME ZONE 'Asia/Kolkata')::date` → 10 rows (5 L, 4 A, 1 P) | A trigger rejects `status IN ('P','A','HD','UAB')` when `work_date > IST today`. Future days may only hold L, OD, H or WO. Recompute after cancel should delete the row, not write `A`. |
| S-11 | Medium | `pay.claim_types.bill_required/requires_bill`, `taxable_if_unsubstantiated/is_taxable`, `payout_component_code` | Two pairs of duplicate flags with **contradictory values**: `daily_allowance` has bill_required=t and requires_bill=f, and all six types have taxable_if_unsubstantiated=t and is_taxable=f. `payout_component_code` defaults to `'REIMB'`, which does not exist in `salary_components`, and has no FK (spec has one). | `SELECT code, bill_required, requires_bill, … FROM pay.claim_types`; `SELECT count(*) FROM pay.salary_components WHERE code='REIMB'` → 0; `migrations/1752270000000_claims-reconciliation.ts:15-18` | Keep one column per concept (expand/contract). Seed the REIMB component and add the FK. |
| S-12 | Medium | migration `1752220000000_pay-schema-init.ts` | Uses `CREATE TABLE IF NOT EXISTS` for `pay.claim_types`, `pay.claims` and `pay.gl_accounts`, which were already created by `1752150000000` and `1752090000000`. Its definitions (status CHECK set, `claim_type_id NOT NULL`, gl FK to cost_centers) are **silently skipped**. `1752270000000` then bolted columns on as nullable. Side effects: `pay.claims.claim_type_id` is nullable (spec NOT NULL), and `claims_emp_idx` duplicates `claims_employee_idx`. | `grep "CREATE TABLE" migrations/*` (each table created twice); `redundant_idx.txt` | Forward migration: set `claim_type_id NOT NULL` and drop `claims_emp_idx`. Remove `IF NOT EXISTS` from table DDL in new migrations so collisions fail loudly. |
| S-13 | Medium | `pay.it_slabs` | Seeded `fy='2025-26'` with **FY 2024-25 slabs** (0–3L, 3–7L 5%…, >15L 30%; 87A threshold 7L / ₹25k). docs/10 §6.1 says 0–4L nil … >24L 30%, 87A ≤12L / ₹60k. No FY 2026-27 rows and no old-regime rows, although today is in FY 2026-27. | `SELECT … FROM pay.it_slabs`; `docs/10 L188-202`; `1752220000000:428-436` | Re-seed per docs/10. Add `UNIQUE(fy, regime, slab_from)` and `CHECK (slab_to IS NULL OR slab_to > slab_from)`. |
| S-14 | Medium | 73 money/day columns (e.g. `pay.payroll_items.gross/net_pay/total_deductions`, `pay.employee_salaries.annual_ctc`, `pay.inputs.amount`, `pay.fnf_settlements.*`, `pay.loan_postings.*`, `pay.pt_slabs.amount`, `te.claims.*_paise`, `te.trips.*_paise`) | No non-negative or range CHECK. Percentages are also unbounded (`employee_family.nominee_share_pct`, `employee_salaries.probation_percent`, `employees.probation_salary_pct`). | script output in §3 notes; `constraints.psv` | `CHECK (x >= 0)` where the sign is fixed, and `CHECK (pct BETWEEN 0 AND 100)` (or the 70/80/90 domain per LOI). Signed amounts (inputs, lines) need an explicit kind/sign rule instead. |
| S-15 | Medium | `te.*_paise` (bigint) vs `pay.*` (NUMERIC rupees) vs `pay.employee_salaries.component_amounts` (JSONB integer paise) | Three money representations. One row mixes units: `annual_ctc=824196.00` (rupees) next to `component_amounts.BASIC=3228600` (paise). The unit lives only in code (`salary-snapshot.ts:1`). `INT8` is globally parsed as JS `Number` (`database.ts:7`). | `SELECT annual_ctc, component_amounts FROM pay.employee_salaries WHERE id=1` | Standardise on NUMERIC(14,2) rupees in the DB (docs/03 convention). If paise are kept, use a `_paise` suffix and a JSON CHECK, and document the exception. |
| S-16 | Medium | `updated_at` on 19 tables | docs/03 says `updated_at` is trigger-maintained. 51 tables have `set_updated_at`; **19 do not**: `ast.assets`, `att.device_watermarks`, `att.ingest_watermarks`, `core.clearances`, `core.onboarding_candidates`, `core.onboarding_tasks`, `core.probation_reviews`, `core.separations`, `core.transfers`, `eng.surveys`, `hd.categories`, `hd.tickets`, `pay.payroll_runs`, `pay.salary_structures`, `prv.consents`, `te.advances`, `te.claims`, `te.trips`, `te.wallets`. The data has rows whose status differs from the insert default but whose `updated_at = created_at` (separations 3/4/5, payroll_runs 1/2), which fits the missing trigger. 32 spec tables have no `updated_at` column at all (e.g. `pay.payroll_items`, `pay.loans`, `lv.ledger`; `spec_col_diff.txt`). | trigger query in report notes; `SELECT id,status,created_at,updated_at FROM core.separations` | Add `set_updated_at` triggers. Add `updated_at` to mutable tables; ledgers and append-only tables are exempt. |
| S-17 | Medium | missing FKs | Integer refs with no FK: `att.swipe_events.employee_id` (spec REFERENCES), `pay.fnf_settlements.separation_id`, `core.separations.fnf_id`, `att.overtime_entries.payroll_item_id`, `te.claim_items.receipt_document_id`, `pay.claim_types.payout_component_code`, and `workflow_request_id` on `pay.claims`, `pay.loans`, `pay.budgets`, `core.separations`, `te.trips`, `te.advances` and `te.claims`. Ten other tables do have that FK, so this is inconsistent. 0 orphans today. | `nofk.txt` (20 cols); orphan counts all 0 | Add the FKs (`NOT VALID` then `VALIDATE`). PG17 supports FKs from partitioned `swipe_events`. |
| S-18 | Medium | `pay.payroll_runs.month`, `pay.tds_challans.month`, `pay.loans.start_month`, `pay.salary_holds.start_month/released_month`, `pay.arrears.for_month`, `att.manager_month_approvals.month`, `reporting.muster_month.month` | Only `att.month_locks` has a first-of-month CHECK. A run dated `2026-10-15` would bypass `UNIQUE(company_id, month, run_type)` and create a second October run. | `grep date_trunc constraints.psv` → only month_locks | `CHECK (month = date_trunc('month', month)::date)` on each. |
| S-19 | Medium | `sec.access_events` (+ partitions) | SEC-10/11 "who read whose sensitive data". The table is **never written** (0 rows, no reference in `backend/src`). `sec.ensure_access_partition()` is never called, and partitions exist only for 2026-10 and 2026-11 with no DEFAULT partition, so any future writer fails from 1 Dec 2026, 05:30 IST (00:00 UTC). Swipes are fine because `ingest.service.ts:116,248` calls `att.ensure_swipe_partition`. | `pg_class.relispartition` list; grep | Wire the writer (masking-reveal paths) and a monthly partition job. Add a DEFAULT partition as a safety net. |
| S-20 | Medium | DB roles | docs/03 §10.2 and §10.7 require `hrms_app` (grants, no UPDATE/DELETE on append-only tables) and `hrms_ro`. Neither role exists. The app connects as `hrms`, which is **superuser** and can UPDATE `core.audit_log` and DELETE `lv.ledger` at the privilege level. Only triggers protect those tables, and a superuser can bypass triggers. This is the local env; prod needs checking. | `SELECT rolname, rolsuper FROM pg_roles …`; `has_table_privilege('hrms','core.audit_log','UPDATE')` → t | Create the roles, add grants and REVOKE in a migration, and connect as `hrms_app`. |
| S-21 | Medium | 183 FK columns with no leading index | Notable: `pay.claim_bills.claim_id` (ON DELETE CASCADE), `pay.loan_postings.loan_id`, `pay.fnf_settlements.employee_id`, `pay.employee_salaries.structure_id`, `core.employee_family.employee_id`, `core.users.employee_id` (also not unique), `wf.requests.requested_by`, `wf.delegations.from_user_id/to_user_id` (delegation lookup per approval), `lv.applications.leave_type_id`, `core.employees.department_id/location_id/designation_id`, `pay.bank_batches.run_id`, `pay.payroll_runs.attendance_lock_id`. | `fk_noindex.txt` | Index the FKs on hot paths and cascade targets now. Leave low-cardinality `*_by` columns alone. |
| S-22 | Medium | date-order CHECKs | Missing on `te.trips(start_date, end_date)`, `te.trip_itineraries(departure_date, arrival_date)`, `core.separations(resignation_date, requested_lwd/approved_lwd)`, `core.employees(doj, dol)`, `pay.salary_holds(start_month, released_month)`, `eng.surveys(open_from, open_till)`, `eng.polls(opens_at, closes_at)`, `ast.assignments(assigned_at, returned_at)`. Present on regularizations, lv.applications, claims, budgets, employee_salaries and **wf.delegations** (`from_date <= to_date`, so alpha's "no fromDate<=toDate check" is app-level only; the DB rejects the row). | pair scan in `constraints.psv` | Add `CHECK (b IS NULL OR b >= a)` per pair. |
| S-23 | Medium | 44 tables unreferenced in `backend/src` | Includes `att.coverage_targets`, `att.leave_blackouts`, `att.roster_publications`, `att.roster_revisions`, `att.shift_patterns`, `att.shift_swaps`, all `cmp.*` (3), all `ird.*` (5), all `prv.*` (12; 3 seeded), `core.employee_family`, `core.mis_codes`, `core.password_reset_tokens`, `core.plants` (1 row, but it is the FK target of employees and cost_centers), `core.profile_change_requests`, `doc.types`, `pay.budgets`, `pay.budget_categories`, `pay.claim_lines`, `pay.claim_reservations`, `pay.statutory_rates`, `pay.pt_slabs`, `pay.it_slabs`, `pay.tds_challans`, `sec.access_events`, `sec.mfa_*`, `sec.password_history`. Many have elaborate triggers and CHECKs with no code path. There are also two parallel claims/budget models: `pay.claims/budgets` and `te.claims/budgets`. | grep loop over `live_tables.txt` (excluding `core/db/types*.ts` and tests) | For each table, either ship it (route, service and test) or drop it in an expand/contract migration. Pick one claims model. |
| S-24 | Medium | `core.companies.pan/gstin/tan/pf_establishment_code/esic_code/pt_registration_no`, `ecode_prefix` | All 13 companies have NULL statutory identifiers, so ECR, ESIC, PT, 24Q and payslip footers cannot be produced. `ecode_prefix` duplicates `code` (identical in all 13 rows, both UNIQUE); the spec's `ecode_format` is missing. | `SELECT id, code, ecode_prefix, pan, gstin, tan FROM core.companies` | Seed the identifiers, with `NOT NULL` when `is_india_payroll`, plus format CHECKs. Drop `ecode_prefix` or add `CHECK (ecode_prefix = code)`. |
| S-25 | Medium | all `date` columns at the app boundary (latent) | `core/dates.ts:4-8,29` documents that pg turns DATE into local midnight and that `toISOString()` gives the wrong day on an IST server ("the F6 bug"). The pattern still appears 34 times, e.g. `separation.service.ts:187,294,298,302,373,576,778-786`, `claims.service.ts:423,425,451`, `loans.service.ts:401`, `fnf-engine.ts:105,165`, `salary.service.ts:221-222`. It does not reproduce on this box because the process TZ is UTC; per dates.ts, prod is IST. | grep `toISOString().slice(0, 10)` | Register a pg type parser for DATE (OID 1082) that returns the raw `'YYYY-MM-DD'` string, or use `formatDbDate()` everywhere. Add a lint rule. |
| S-26 | Medium | `pay.employee_salaries.component_amounts`, `effective_to`, `revision_reason` | Salary id 5 (employee 12, phase `probation`) has `component_amounts = {}` and `revision_reason NULL`: an assignment with no pay. There is no JSON-shape CHECK. `effective_to` uses a `9999-12-31` NOT NULL sentinel instead of NULL/`infinity` (spec has no effective_to). `probation_percent NUMERIC(5,2)` duplicates `core.employees.probation_salary_pct SMALLINT` and `onboarding_candidates.probation_salary_pct` (default 100). | `SELECT id, component_amounts, revision_reason FROM pay.employee_salaries` | `CHECK (component_amounts <> '{}'::jsonb AND jsonb_typeof(component_amounts)='object')`. Make `revision_reason NOT NULL`. Keep a single source for probation %. |
| S-40 | Medium | missing `created_by` / audit on config and master tables | No `created_by` on `pay.salary_structures`, `pay.salary_components`, `lv.leave_types`, `att.shifts`, `pay.statutory_rates`, `wf.definitions`, `pay.loans` or `core.employees`. They rely on `core.audit_log`, which has rows for structures and salaries but **none** for `pay.loans`, `core.separations`, `lv.applications` or `te.*`. | `SELECT entity, count(*) FROM core.audit_log GROUP BY 1` | Add `created_by` and `updated_by` to config tables. Make audit writes mandatory in the service layer (or use a generic audit trigger). |
| S-27 | Low | redundant indexes | Exact duplicate: `pay.claims_emp_idx` = `claims_employee_idx`. Prefix-covered by a unique or composite index: `pay.payroll_items_run_idx`, `pay.payroll_runs_company_month_idx`, `core.idx_clearances_separation`, `te.idx_te_wallets_employee`, `reporting.muster_month_lookup_idx`, `att.manager_month_approvals_lookup_idx`. | `redundant_idx.txt` | Drop them (`DROP INDEX CONCURRENTLY`). |
| S-28 | Low | `core.locations.timezone` | The column exists (default Asia/Kolkata) but no code reads it; `'Asia/Kolkata'` is hard-coded (`month-lock.service.ts:97-150`, `reports.service.ts:99,121`). Non-India entities exist (RPF Dubai, RMT UK, RMB Bahrain). Partition bounds and `ensure_*_partition` use DB-session TZ (server is `Etc/UTC`), so partitions are UTC months, not IST months. | `SHOW timezone` → Etc/UTC; grep | Either drop the column and document IST-only, or drive attribution from `locations.timezone`. |
| S-29 | Low | spec vs DB drift | 3 spec tables are missing, 63 live tables are undocumented, and many columns were renamed or added (§4). docs/03 claims "every column has a stated purpose". | `spec_col_diff.txt` | Update docs/03, or drop the undocumented objects (see S-23). |
| S-30 | Low | free-text domains | `core.employees.gender`, `marital_status`, `blood_group`, `exit_reason`; `core.employee_family.relation`; `pay.investment_declarations.section`; `pay.it_slabs.fy` and `investment_declarations.fy` (no `^\d{4}-\d{2}$` CHECK). Identifiers are unbounded `TEXT`. | `columns.psv`, `constraints.psv` | Add CHECK domains or small enums. |
| S-31 | Low | `te.trip_itineraries.departure_date/arrival_date` | Named `_date` but typed `timestamptz`; stored as `2026-11-20 00:00+00` (05:30 IST). Mixed semantics. | `SELECT departure_date FROM te.trip_itineraries` | Either use `date`, or rename to `_at` and capture the real local time. |
| S-32 | Low | `att.day_records` | `day_records_minutes_nonnegative` is `NOT VALID` (existing rows never validated) and covers only `worked_minutes`. `late_minutes`, `early_exit_minutes` and `ot_minutes` are unchecked (0 negatives today). No CHECK ties `status='L'` to `leave_type_id IS NOT NULL` (0 violations today). | `constraints.psv` | `VALIDATE CONSTRAINT`, extend it to all minute columns, and add `CHECK ((status='L') = (leave_type_id IS NOT NULL))`. |
| S-33 | Low | `att.swipe_events UNIQUE(employee_no, swipe_ts, door_code)` | `door_code` is nullable, so mobile or manual punches with a NULL door never collide (NULLs are distinct) and idempotency breaks for them. All 277 current rows are kent with a door. | `columns.psv` | `UNIQUE NULLS NOT DISTINCT (…)` (PG15+), or COALESCE door_code to the source. |
| S-34 | Low | `lv.ledger.delta NUMERIC(5,2)`, `lv.applications.days NUMERIC(4,1)`, `lv.leave_types.max_per_request NUMERIC(4,1)`, `accrual_per_month NUMERIC(5,2)` | Leave units have inconsistent scale. The ±999.99 limit surfaces as a raw "numeric field overflow" for delta 99999 (alpha L6) because there is no app-side range check and no DB CHECK with a friendly name. | `columns.psv` | Use one leave type, e.g. NUMERIC(6,2), with `CHECK (abs(delta) <= 366)` and a zod bound. |
| S-35 | Low | `core.users.employee_id` | Not unique and not indexed, so one person can have several logins. 0 duplicates today. | `pg_indexes` for core.users | `CREATE UNIQUE INDEX … WHERE employee_id IS NOT NULL`. |
| S-36 | Low | status modelling | docs/03 says "explicit status enums". Only `employee_status`, `employment_category`, `contract_type` and `day_status` are enums; dozens of status columns are `TEXT` + CHECK. Soft state is mixed: `is_active` on 19 tables and `status` on others. No `deleted_at` anywhere, which is consistent. | `columns.psv` | Accept TEXT+CHECK (easier to evolve) and update docs/03, or convert. Document the choice. |
| S-37 | Low | `backend/migrations/README.md`, `backend/scripts/rollback/` | README says migrations are `.up.sql/.down.sql` and that rollback lives in `scripts/rollback`. In reality migrations are `.ts` with `down()`, and `scripts/rollback/1751790000000_….down.sql` is an orphan. There is a gap at 1752130000000 (harmless). | `ls migrations`, README L1-25 | Fix the README and delete the orphan. |
| S-38 | Low | Kysely types | The hand-written types match the live columns 1:1 (no missing or ghost columns across 146 tables). Drift: `te.trips.visa_status`, `te.trips.cancellation_cost_paise` and `te.settlements.recovery_channel` are nullable in the DB but typed non-null. The types encode the nullable slop from S-04. | `kysely_drift.txt` | Set these 3 columns `NOT NULL` (they have defaults). Consider `kysely-codegen` in CI to stop drift. |
| S-39 | Low | `pay.payroll_runs` lock gate | CHECK `check_attendance_lock_when_computed` allows `draft`/`inputs_locked` without a lock, which matches docs/03 §10.4. Runs 1 and 2 sit at `inputs_locked` with no lock, and `att.month_locks` is empty. The run→lock company is not enforced (see S-06). | `SELECT … FROM pay.payroll_runs` | Optionally require the lock at `inputs_locked`, and add a composite FK `(attendance_lock_id, company_id)`. |

## 4. Spec (docs/03) vs live DB diff

**Tables in docs/03 that are missing from the DB (3):**
- `core.employee_education`
- `core.employee_prev_employment` (SOW-3.2g)
- `eng.poll_votes`, replaced by `eng.poll_responses`

**Live tables not in docs/03 (63):**
- `att`: coverage_targets, employee_shifts, ingest_watermarks, leave_blackouts, manager_month_approvals, quarantined_swipes, recompute_queue, roster_publications, roster_revisions, shift_patterns, shift_swaps
- `cmp`: all 3
- `core`: mis_codes, password_reset_tokens, plants, profile_change_requests, settings, transfers
- `doc.types`
- `eng.poll_responses`
- `hd.categories`
- `ird`: all 5
- `lv`: restricted_holidays, rh_selections
- `pay`: budget_categories, budgets, claim_lines, claim_reservations
- `prv`: all 12
- `reporting`: kpi_daily, muster_month
- `sec`: access_events, mfa_enrolments, mfa_recovery_codes, password_history, sessions (sessions is referenced by the §NFR-03 addendum)
- `te`: all 9

**Column differences (spec tables):**
- Renamed or replaced:
  - `core.companies.ecode_format` → `ecode_prefix`
  - `hd.tickets.category` → `category_id`
  - `hd.ticket_messages.attachment_document_id` missing
  - `eng.announcements.publish_at/created_by` → `published_at/published_by`
  - `eng.polls.open_till` → `opens_at/closes_at`
  - `pay.gl_accounts.cost_center_id/gl_description` → `company_code/plant_code/cost_center_code` (text, no FK; validated by trigger `validate_gl_account_org_codes`)
  - `core.probation_reviews.workflow_request_id` missing
- Notable additions:
  - `core.employees.plant_id/hod_employee_id`
  - `att.shifts` gained 9 columns (session split, slabs, OT offset)
  - `pay.claims` gained 15 budget/FX/settlement columns, which overlap `status` because both `paid` and `settled` exist in `status` and also in `settlement_status`
  - `pay.claim_types` gained duplicate flags (S-11)
  - `pay.fnf_settlements` gained 9 columns (incl. `calc_breakdown JSONB`)
  - `pay.employee_salaries.effective_to/probation_percent/approved_at`
  - `att.day_records.override_reason`
  - `att.regularizations.day_portion` (per addendum)
  - full list in `spec_col_diff.txt`
- Nullability, where docs/03 says NOT NULL but the DB allows NULL:
  - `core.employees`: dob, mobile, category, contract_type, doj, designation_id, department_id, org_unit_id, location_id, cost_center_id
  - `core.letters.document_id`
  - `core.letter_templates.body_docx_document_id`
  - `core.policies.document_id`
  - `att.holidays.location_id`
  - `pay.claims.claim_type_id` and `workflow_request_id`
  - `core.separations.workflow_request_id`
  - `eng.surveys.open_till`
  - `eng.survey_responses.respondent_hash`
- The reverse: `eng.announcements.audience` is NOT NULL in the DB but nullable in the spec.
- Types: every spec column that exists has the spec type and precision. 0 type mismatches.
- `UNIQUE(employee_id, effective_from)` on `pay.employee_salaries` was replaced by the stronger GiST EXCLUDE.
- Audit columns: 32 spec tables lack `updated_at` and 5 lack `created_at` (`core.audit_log`, `att.device_watermarks`, `core.policy_acknowledgments`, `core.reporting_tree`, `pay.pt_slabs`); see `spec_col_diff.txt` `no_audit=`.
- §10 integrity rules:
  - Met: 1 (lock triggers), 3 (`employees_check` dol when exited), 4 (`check_attendance_lock_when_computed`), 5 (`core.next_ecode`), 6 (`overtime_entries_check2`). Rule 2 is met by triggers but not by grants.
  - Not met: rule 7 (roles absent, S-20).

## 5. Data quality (seeded and test data at audit time)

Row volumes are small: 12 employees, 13 users, 13 companies, 64 day_records, 277 swipes, 13 ledger rows, 12 leave applications, 5 salaries, 3 loans, 5 separations, 3 trips, 0 payroll_items, 0 pay.claims.

| Check | Result |
|---|---|
| Orphans on non-FK refs (swipe→employee, reporting_tree, fnf↔separation, workflow refs on claims/loans/separations/te) | **0** |
| Org-spine company mismatch (employee vs location/cost_center/org_unit) | **0** (composite FKs) |
| Salary structure company ≠ employee company | **1**: salary 4 (RGH000001 on RML "G1 Staff Baseline") |
| te.advances employee ≠ trip owner | **1**: advance 1 (emp 8 on emp 9's trip; ₹50,000) |
| Invalid PAN format | **1**: RML000011 `INVALIDPAN` |
| Employees with NULL contract_type / cost_center / gender | **11 / 2 / 1** of 12 |
| Companies with NULL PAN/TAN/GSTIN/PF code | **13 / 13** |
| Future-dated attendance with A or P | **5** (4×A: emp 8 26–27 Oct, emp 9 23–24 Nov; 1×P manual: emp 9 12 Dec) |
| day_records first_in IST date ≠ work_date | 0 |
| day_records first_in > last_out, negative minutes, L without leave_type | 0 / 0 / 0 |
| `P` days with no first_in (regularized/manual) | 3 (acceptable: AR/manual) |
| Negative leave balances (SUM(delta) < 0) | **0** in the ledger. Alpha's "LWP available = −1" is computed at display time (LWP has no ledger rows) |
| Approved separation with no workflow | **1** (separation 4) |
| Duplicate open separations per employee | **1 employee** (emp 11: ids 1, 2) |
| Loans active with no workflow | **3/3** (₹5 cr @0%, ₹10k, ₹1 cr) |
| Salary assignment with empty snapshot | **1** (salary 5, `{}`) |
| Maternity-leave eligible females | **0 of 3** (gender vocabulary mismatch) |
| Rows where status changed but updated_at = created_at | separations 3/4/5, payroll_runs 1/2 |
| Payroll runs past draft with no attendance lock | 2 (`inputs_locked`; allowed by the current CHECK) |
| pay.statutory_rates rows | **0** |
| pay.it_slabs correct for FY 2025-26 per docs/10 | **No** (FY 2024-25 slabs) |

## 6. Migrations

- 54 migration files; 54 rows in `public.pgmigrations`; names match 1:1 (`diff` empty). All were applied in one batch at 2026-10-18 21:30:10 IST (`run_on` 16:00:10 UTC, stored as `timestamp without time zone`).
- All 54 export `down()`. Alpha's `alpha/be-verify-migrations.log` shows `Migration up → up → down-all → up passed` (54) on a disposable `*_migration_test` DB. **I did not re-run it** because the task is read-only and other workers are using this DB.
- Drift and dead code: `1752220000000` re-declares 3 existing tables with `IF NOT EXISTS` (S-12). The README is stale and there is an orphan rollback SQL file (S-37).
- Kysely vs DB: no table or column drift; 3 nullability mismatches (S-38).

## 7. Not verified / limits

- I did not execute any write. That includes S-02, which I proved from the default, the CHECK and the insert code, not by inserting.
- I did not re-run migrations (I used alpha's log).
- I did not check the prod DB role setup. S-20 is about this local env only.
- S-25 is latent: the app process here runs in UTC.
- EXPLAIN-based hot-path analysis was not feasible at 12-employee scale. Index findings are structural.
