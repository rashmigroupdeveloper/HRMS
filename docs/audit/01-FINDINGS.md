# 01 — Findings Register

**Audit date:** 4 September 2026 · **Scope:** working tree as-is (109 modified + 129 untracked paths)
**Method:** every finding below is backed by a command output, a file:line, a SQL probe, or a live HTTP
request against a throwaway database (`hrms_audit_test`) built from `backend/migrations/` from scratch.
Where I could not verify something, it is marked **UNVERIFIED** and says why.

**Severity:** **P0** blocks production (money wrong · data loss · auth bypass · red gate) ·
**P1** must fix before go-live · **P2** should fix · **P3** polish.

**Counts:** **P0 = 13 · P1 = 36 · P2 = 28 · P3 = 7 · total 84**
*(+1 on 5 Sep 2026: [E13], found during remediation W0.2. [E3]'s diagnosis corrected — see the entry.)*

| Dim | A | B | C | D | E | F | G | H | I |
|---|---|---|---|---|---|---|---|---|---|
| findings | 6 | 6 | 12 | 18 | 13 | 7 | 6 | 9 | 7 |

---

## Dimension A — Architecture & boundaries

### [A1] [P1] [A] The Kent biometric connector is a mock with no environment guard
**Evidence:** `backend/src/modules/attendance/kent-sync.job.ts:19-34` — `connectorFor()` returns
`new MockKentConnector({...})` unconditionally. No `NODE_ENV` check, no settings flag, no throw.
It is invoked by the `kent-sync` pg-boss job every 5 minutes (`src/jobs/worker.ts:148-152`).
**Impact (data/compliance):** deployed as-is, the system **fabricates attendance** — deterministic
synthetic IN/OUT punches for every active employee — into `att.swipe_events`, which is append-only
by DB trigger (`swipe_events_immutable`) and therefore **cannot be deleted**. Those swipes drive
day-status → OT → payable days → pay. This is PP-9 inverted: not missing attendance, invented attendance.
**Doc ref:** docs/14 §8, docs/02 §4, plans/phase-1 Stage 1.1 (marked ☑ "on the MOCK feed").
**Fix:** `connectorFor()` must throw when `NODE_ENV === 'production'` and no real connector is
configured; gate the mock behind an explicit `ATT_CONNECTOR=mock` env value validated in `core/config/env.ts`.
**Test that would have caught it:** a test asserting `connectorFor()` rejects under `NODE_ENV=production`.

### [A2] [P0] [A] No email transport exists, and the notification queue is never drained
**Evidence:** `backend/src/modules/notifications/notifications.service.ts:27-35` — the only transport is
`devLogTransport`, which logs instead of sending. `processQueue()` (line 90) is called from
**tests only**: `grep -rn "processQueue" src/` returns only its definition and the `index.ts` re-export;
the sole caller is `tests/access-control.integration.test.ts:210`. `src/jobs/worker.ts` registers 13
queues — none of them drains notifications.
**Impact (compliance/UX):** every notification the system produces — approval requests, the LC-03 daily
07:00 boarding/exit email, ATT-08 manager OT digests, absence show-cause, policy-ack nags — is written to
`wf.notifications` with status `queued` and **never sent, not even to a log**. This is the single most-cited
failure in the source documents (PP-14: *"Chaitanya Sir has not received a single notification"*;
PP-6/PP-26; SOW LC-03 *"runs without exception"*), reproduced exactly.
**Doc ref:** WF-02, LC-03, PP-6/14/26; docs/04 §5; CLAUDE.md rule 8.
**Fix:** add a `notification-drain` pg-boss queue (every 1–2 min) in `src/jobs/worker.ts`; implement an
SMTP transport behind `NotificationTransport`; add SMTP vars to the env schema; alert on `status='dead'`.
**Test:** integration test asserting a queued notification reaches `status='sent'` after one worker cycle.

### [A3] [P1] [A] Object storage is local disk only; the SeaweedFS/S3 adapter does not exist
**Evidence:** `backend/src/core/storage/storage.ts:16-46` — `LocalDiskStorage` is the only implementation;
`getStorage()` always returns it, rooted at `process.cwd()/var/storage`. No S3 client is in
`backend/package.json`.
**Impact (data loss):** in the PM2 cluster topology (`ecosystem.config.cjs`, `instances: 2`) files written by
one process are on the same box but outside any backup story described in the repo; nothing mirrors them.
Payslips, letters, policy PDFs and vault documents (PAN/Aadhaar scans) would live on an unbacked local path.
**Doc ref:** docs/14 §4 (SeaweedFS replaces MinIO), docs/02 §2. Stage 0.5 exit criterion
*"SeaweedFS up with nightly mirror configured"* is **unmet** while the stage is marked ☑.
**Fix:** implement `S3Storage` against the same interface; select by env; keep `LocalDiskStorage` for tests only.
**Note:** path traversal IS correctly blocked (`storage.ts:20-27`) — verified.

### [A4] [P2] [A] The frontend does not consume the generated OpenAPI contract
**Evidence:** `frontend/src/lib/api.ts:1-4` — *"OpenAPI-generated client replaces this in a later stage"*;
line 87 `return (await res.json()) as T` — an unchecked cast. The backend does emit
`/api/openapi.json` (`backend/src/app.ts:40-44`).
**Impact (correctness):** docs/14 §3 makes the zod output schema *"the runtime firewall against a procedure
silently returning a malformed shape"* — but the client never validates, so drift surfaces as a React
crash or a silently wrong number on screen, not a contract error.
**Fix:** generate the client from the OpenAPI artifact in CI and fail the build on drift.

### [A5] [P2] [A] 36 files exceed the ~400-line ceiling
**Evidence:** backend 18 files (`src/core/db/types.ts` 1223, `modules/reports/reports.service.ts` 999,
`modules/reports/reports.router.ts` 844, `modules/attendance/day-status.service.ts` 765,
`modules/claims/claims.router.ts` 724, `modules/attendance/attendance-config.router.ts` 716 …);
frontend 18 files (`pages/privacy/PrivacyOpsPage.tsx` 851, `pages/reports/SupportingReports.tsx` 802,
`pages/workplace/HelpdeskPage.tsx` 771, `pages/compliance/CompliancePage.tsx` 758 …).
**Doc ref:** CLAUDE.md §2 *"Files ≤ ~400 lines"*; global coding-style rule *"800 max"*.
**Fix:** split routers from their zod schemas; extract per-report modules. `types.ts` is generated-ish and
is the least urgent.

### [A6] [P3] [A] 146 module-index exports have no consumer outside their own module
**Evidence:** static analysis of `src/modules/*/index.ts` re-exports vs. all of `src/`.
**Impact:** the public API surface of each module is far wider than its actual contract, and because
`knip.json` marks these index files as `entry` (documented in CLAUDE.md §6), **knip cannot see dead code
behind them** — which is how [C6] and [A2] survived a green `knip` gate.
**Fix:** export only what crosses a module boundary; add a lint rule or a custom knip config that treats
index re-exports as internal unless imported elsewhere.

**Verified good (dimension A):** `npm run depcruise` — *no dependency violations found (192 modules,
753 dependencies)*; no frontend file imports backend source and vice versa; money code exists only in
`backend/src/core/money`; tokens/UI kit exist only in `frontend/src/{tokens,ui}`.

---

## Dimension B — API contract (CORE-10)

### [B1] [P0] [B] 41 business procedures run on the `authed` tier with no permission code
**Evidence:** static extraction of all 219 procedures across 29 router files:
`withPermission` 165 · `authed` 41 · `base` 8 · `withStepUp` 3 · `withAnyPermission` 2.
The 41 include `POST /workflows/requests`, `POST /workflows/requests/{id}/act`,
`POST /workflows/requests/{id}/resubmit`, `PUT /workflows/delegations`, `GET /settings`,
`GET /settings/{key}`, `GET /privacy/register`, `PUT /privacy/consents`, `POST /helpdesk/tickets`,
`POST /engagement/polls/{id}/respond`, `POST /ird/grievances/file`, `POST /ird/posh/file`.
**Impact (security):** CLAUDE.md §2b states *"Every business procedure declares exactly ONE permission
code"* and *"base — public — login/health ONLY"*. Authorization for these 41 lives in scattered handler
logic or nowhere, so revoking a permission in the RBAC console has no effect on them, and the docs/08 §2
grid does not describe what they actually enforce.
**Fix:** give each a permission code (`workflow.request.raise`, `workflow.act`, `admin.settings.read`, …)
and seed it; keep the engine's current-approver check as a second layer, not the only one.
**Test:** an RBAC matrix test iterating every procedure × every role.

### [B2] [P0] [B] `POST /workflows/requests` accepts an arbitrary `subjectEmployeeId` — no authorization
**Evidence:** `backend/src/modules/workflows/workflows.router.ts:20-45` takes
`subjectEmployeeId: z.number().int().positive().optional()` straight from the client;
`workflow.service.ts:298-323` `createRequest()` inserts it with **no check** that the caller may act for
that employee. **Live proof** (audit DB, user `asha@audit.local` = plain `employee` role, company ACO):
```
POST /api/workflows/requests
{"definitionCode":"resignation","payload":{"reason":"forged by another employee"},"subjectEmployeeId":2}
→ {"requestId":1}
```
Employee 2 is `BCO000001`, a different company.
**Impact (data/compliance):** any of 1,066 employees can raise a resignation, transfer, confirmation or
leave request naming any other employee. See [E1] for what happens next.
**Fix:** in `createRequest`, require `subjectEmployeeId === caller.employee_id` unless the caller holds a
per-definition "raise on behalf" permission, scope-checked via `assertEmployeesInScope`.

### [B3] [P1] [B] `GET /settings` exposes all 51 policy values to every authenticated user
**Evidence:** `backend/src/modules/settings/settings.router.ts:19-40` — both read procedures are `authed`.
**Live proof:** plain employee retrieved all 51 keys including `att.month_lock_pending_max_age_days`,
`att.ot_decision_hours`, `att.leave_coverage_hard_block`, and the security-policy keys.
**Impact:** information disclosure of the exact thresholds that govern lockout, OT lapse and absence
escalation — useful to anyone gaming attendance. Also a CORE-10 rule violation.
**Fix:** split into a small ESS-visible allowlist and an `admin.settings`-gated full read.

### [B4] [P1] [B] Two unauthenticated write endpoints on the `base` tier, with a stubbed rate limit
**Evidence:** `backend/src/modules/ird/ird.router.ts` — `POST /ird/posh/file-anonymous` and
`POST /ird/whistle/file` are `base`. The guard is
`backend/src/modules/ird/ird.service.ts:288-291`:
```ts
export function whistleRateLimitOk(ip: string | null): boolean {
  void ip;
  return true;
}
```
The route summary itself says *"(rate-limit stub)"*.
**Impact (availability/integrity):** unauthenticated flooding of `ird.whistleblower_reports` and
`ird.posh_cases` — POSH-sensitive tables with an immutable access log. Storage exhaustion plus a
poisoned POSH register that a statutory IC must then triage.
**Fix:** real IP+global token bucket (see [D4]); CAPTCHA or a signed intake token for anonymous filing.
**Test note:** `tests/ird-posh.unit.test.ts:18-19` asserts the stub returns `true` — a vacuous test
(see [G4]).

### [B5] [P2] [B] 13 of 56 seeded permissions gate no code path
**Evidence:** cross-reference of `PERMISSIONS` in `src/core/rbac/seed-data.ts` against every
`withPermission|withAnyPermission|withStepUp|*.has('…')` reference in `src/`:
`employee.write`, `leave.approve`, `ar.approve`, `od.approve`, `payroll.run.view`,
`payroll.run.finalize`, `payroll.reports`, `salary.write`, `lifecycle.onboard.convert`,
`lifecycle.confirmation.approve`, `lifecycle.separation.approve`, `admin.users`, `ird.whistle.intake`.
**Impact:** the docs/08 §2 grid rows for `leave.approve` / `ar.approve` / `od.approve` are **decorative** —
approvals are authorized purely by chain position, so revoking `leave.approve` from `manager` in the RBAC
console changes nothing. Note `ot.approve` *is* enforced, so the model is inconsistent within one feature.
`employee.write` and `admin.users` have no procedure at all (see [E7]).
**Fix:** either enforce them or remove them from the seed; do not ship a console whose switches do nothing.

### [B6] [P2] [B] The permission is not stamped into the OpenAPI description, contrary to the code comment
**Evidence:** `backend/src/api/orpc.ts:96-97` claims *"The required permission is also stamped into the
OpenAPI description so the contract documents who can call what"* — `withPermission()` (lines 130-147)
does no such thing.
**Fix:** implement it, or delete the claim.

**Verified good (dimension B):** **all 219 procedures declare both `.input()` (where applicable) and
`.output()`, and all declare `.route()`** — zero exceptions found. The `withPermission` gate reads
permissions per-request from the DB, so grants take effect on the next call as documented.

---

## Dimension C — Database & data integrity

### [C1] [P1] [C] Zero temporal `EXCLUDE USING gist` constraints exist
**Evidence:** `SELECT … FROM pg_constraint WHERE contype='x'` on the freshly-migrated DB returns **0 rows**.
**Impact:** docs/14 §6.2 and CLAUDE.md §1 require them on every effective-dated table so overlapping rows
*"become a DB error, not a payroll bug"*. `cmp.registrations(valid_from, valid_to)`,
`pay.budgets(period_from, period_to)` and `att.roster_publications(period_from, period_to)` are all
unprotected. `pay.employee_salaries` — the one the doc names — does not exist yet ([C7]).
**Fix:** add `btree_gist` + `EXCLUDE` on each effective-dated table now, before rows exist.

### [C2] [P1] [C] `att.employee_shifts` is a mutable current-state table with no effective dating
**Evidence:** `\d att.employee_shifts` — PK is `(employee_id)`; columns are
`weekday_shift_id, saturday_shift_id, updated_by, created_at, updated_at`. No `effective_from/to`.
**Impact (money):** the day-status processor resolves an employee's shift from this row. Changing an
employee's default shift today silently changes the shift used by **every future recompute of every
past unlocked day**, altering late minutes, half-day thresholds and OT. ATT-03 requires recompute to be
idempotent; docs/14 §7.1 requires a run to be a deterministic function of *facts as known*. It is not.
**Fix:** convert to an effective-dated table with an `EXCLUDE` constraint; resolve by `work_date`.
**Test:** recompute a locked-adjacent month, change the shift, recompute again, assert byte-identical.

### [C3] [P1] [C] The exactly-once swipe guarantee is void when `door_code` is NULL
**Evidence:** `swipe_events_employee_no_swipe_ts_door_code_key UNIQUE (employee_no, swipe_ts, door_code)`
with `door_code` **nullable**. In Postgres, NULL ≠ NULL, so the index does not dedupe.
**Live proof:**
```sql
INSERT INTO att.swipe_events (employee_no,swipe_ts,door_code,received_at,source) VALUES
 ('ACO000001','2026-09-15 09:00+05:30',NULL,now(),'kent'), (…same…), (…same…);
-- INSERT 0 3   → 3 duplicate rows
```
**Impact (money):** docs/14 §8.2 states the ACK-plus-unique-index pair *is* the exactly-once guarantee.
A device that omits a door code (or any reconnect flood that replays punches) inserts duplicates into an
**append-only** table that can never be cleaned, and those duplicates shift first-in/last-out → OT minutes.
**Fix:** `door_code NOT NULL DEFAULT '__unknown__'`, or a unique index on
`COALESCE(door_code,'')`. Backfill before adding.

### [C4] [P1] [C] `sec.access_events` partitions stop on 31 Oct 2026 and nothing creates more
**Evidence:** only `access_events_202609` and `access_events_202610` exist.
`sec.ensure_access_partition` exists as a function but **has no caller** in `src/`.
**Live proof:**
```sql
INSERT INTO sec.access_events (actor_user_id,resource,field_class,purpose,ip,occurred_at)
VALUES (1,'employee.profile','statutory_ids','audit probe',NULL,'2026-11-01 10:00+05:30');
-- ERROR: no partition of relation "access_events" found for row
```
**Impact:** a dated failure ~57 days out. Currently masked only because nothing writes to the table ([C5]).
**Fix:** call `sec.ensure_access_partition` on the write path (as `att.ingest_watermarks` correctly does for
swipes) **and** add a monthly job that pre-creates the next three months.
**Note (verified good):** the swipe path *does* call `att.ensure_swipe_partition`
(`ingest.service.ts:116,248`) — that one is safe.

### [C5] [P1] [C] The sensitive-access log is never written; the "who saw my PAN" screen is permanently empty
**Evidence:** `recordAccess()` (`src/modules/security/access-log.service.ts:40-58`) has **no callers**
anywhere in `src/`. It is re-exported from `src/modules/security/index.ts:19` with the comment
*"every module that reveals a masked column calls this (SEC-10)"* — none does.
`GET /security/my/access-history` reads `sec.access_events`, which will always be empty.
Separately, the function's own docblock promises *"Never throws into the caller's path"* but the body has
**no try/catch** — so once it is wired up, [C4] turns a logging outage into a 500 on every masked read.
**Impact (compliance):** SEC-10/SEC-11 and the DPDP accountability control do not exist in practice.
**Fix:** call it from `getEmployeeByEcode`/`getOwnProfile` (unmask branch), payroll reads, and any export;
wrap the insert in try/catch that logs and swallows, as documented.

### [C6] [P1] [C] The entire `pay.*` payroll schema is absent
**Evidence:** docs/03 §6 specifies ~24 `pay.*` tables. The migrated DB has 7:
`budget_categories, budgets, claim_lines, claim_reservations, claim_types, claims, gl_accounts`.
Missing: `employee_salaries, salary_structures, salary_components, payroll_runs, payroll_items,
payroll_item_lines, statutory_rates, pt_slabs, it_slabs, inputs, arrears, loans, loan_postings,
salary_holds, bank_batches, fnf_settlements, investment_declarations, tds_challans, claim_bills,
claim_entitlements`.
**Impact:** M4 (payroll & statutory) — the reason the project exists — is unbuilt. This matches
plans/phase-2 (all stages ☐), so it is expected; it is recorded here because deliverable 00's verdict
turns on it.
**Doc ref:** docs/03 §6, PAY-01..18.

### [C7] [P2] [C] Two CHECK constraints were added `NOT VALID` and never validated
**Evidence:** `day_records_minutes_nonnegative`, `day_records_session_statuses_valid` —
`convalidated = false` (migration `1752190000000_attendance-day-integrity.ts`).
**Impact:** they enforce on new writes but pre-existing bad rows are never checked and the planner cannot
rely on them. On a fresh DB this is harmless; on the live `hrms` DB it means unknown legacy violations.
**Fix:** `ALTER TABLE … VALIDATE CONSTRAINT …` in a follow-up migration, after reporting violators.

### [C8] [P2] [C] `core.user_roles` unique key includes a nullable column → duplicate grants possible
**Evidence:** `user_roles_user_id_role_id_scope_org_unit_id_key UNIQUE (user_id, role_id, scope_org_unit_id)`
with `scope_org_unit_id` nullable. Two identical unscoped grants of the same role to the same user are
accepted. Confirmed while building fixtures — `ON CONFLICT (user_id, role_id)` is rejected because no such
constraint exists.
**Impact:** `getUserPermissionAccess` aggregates rows; duplicates inflate nothing today but make
revocation ("remove the role") delete only one row, silently leaving the grant in place.
**Fix:** unique index on `(user_id, role_id, COALESCE(scope_org_unit_id, 0))`.

### [C9] [P2] [C] ~45 live tables are undocumented in docs/03
**Evidence:** tables present in the DB but absent from docs/03: all of `sec.*` (7), `prv.*` (12),
`cmp.*` (3), `ird.*` (5), `doc.*` (1), `reporting.*` (2), plus `core.settings`, `core.plants`,
`core.mis_codes`, `core.password_reset_tokens`, `core.profile_change_requests`,
`att.{coverage_targets, employee_shifts, ingest_watermarks, leave_blackouts, manager_month_approvals,
quarantined_swipes, recompute_queue, roster_publications, roster_revisions, shift_patterns, shift_swaps}`,
`lv.{restricted_holidays, rh_selections}`, `hd.categories`, `eng.poll_responses`.
**`core.settings` is the notable one** — CLAUDE.md rule 2 makes it load-bearing for every policy value,
and docs/03 (*"every table and every column"*) never mentions it.
**Conversely**, docs/03 names tables that do not exist: `core.{clearances, onboarding_candidates,
onboarding_tasks, probation_reviews, separations, employee_education, employee_prev_employment}`,
`att.{regularizations …present}`, `eng.{surveys, survey_responses, poll_votes}`, and the `pay.*` set above.
**Fix:** regenerate docs/03 §§ from the live schema as part of the migration DoD.

### [C10] [P2] [C] Money-adjacent columns without CHECK constraints
**Evidence:** `ast.maintenance.cost` (nullable numeric, no `>= 0`),
`core.employee_family.nominee_share_pct` (no 0–100 range, no per-employee sum = 100),
`reporting.kpi_daily.value` (nullable numeric, no constraint),
`att.devices.expected_hourly_swipes` (no `>= 0`).
**Doc ref:** docs/14 §6.1 *"CHECK on every money/date invariant"*.

### [C11] [P3] [C] Unconstrained text where an enum is implied
**Evidence:** `core.audit_log.action`, `core.documents.kind`, `core.settings.value_type`,
`att.swipe_events.{direction, swipe_type, location_type}`, `core.employees.marital_status`.
`direction` is read by the first-in/last-out logic (ATT-18).
**Fix:** CHECK constraints or enum types, mirroring the TS unions.

### [C12] [P1] [C] Local Postgres is 14.21; the specification says 16
**Evidence:** `SELECT version()` → `PostgreSQL 14.21 (Homebrew)`; `postgresql@17` is installed but not
running; port 5433 does not respond. docs/14 §2 and docs/02 §1 specify PostgreSQL 16.
**Impact:** development and integration tests run two major versions below the production target.
Partition-pruning, planner and `MERGE`/`SEARCH` behaviour all differ.
**Fix:** pin one version across dev, CI and prod; add a `SHOW server_version_num` assertion at boot.

**Verified good (dimension C):** migrations run **cleanly from scratch** (exit 0, all 40 files),
are **idempotent** on re-run (*"No migrations to run!"*), and `migrate:down` **works** (tested one step
and re-applied). Every DDL block starts `SET lock_timeout = '5s'`. Append-only triggers are present and
correct on `core.audit_log`, `att.swipe_events`, `lv.ledger`, `att.month_locks`, `att.roster_revisions`,
`sec.access_events`, `prv.{consent_events, purge_log, breach_register}`, `cmp.filing_evidence`,
`ird.posh_case_access_log`, `pay.claim_reservations`, `att.manager_month_approvals`, `hd.ticket_messages`.
The audit hash chain is computed **in the database** (`core.audit_log_chain`), serialized by
`pg_advisory_xact_lock` on a dedicated `chain_seq` — the concurrency bug of ordering by `id` was found and
fixed (see `tests/audit-chain-concurrency.integration.test.ts`). `att.day_status` is a real PostgreSQL
enum whose 9 labels match the zod enum exactly. Money columns are `NUMERIC`, never float.
194 foreign keys, 144 CHECKs, 58 unique constraints.

---

## Dimension D — Security & identity

### [D1] [P0] [D] Any employee can read any other employee's full personal record — no data scope is applied
**Evidence:** `backend/src/modules/employees/employees.service.ts:87-92` states the problem in its own
comment: *"Scope engine lands later; this keeps employee-role holders from reading peers' PAN/Aadhaar."*
`getEmployeeByEcode` (line 240), `getOwnProfile` (line 265) and `listEmployees` receive
`user` + `permissions` but **never `context.permissionAccess`**. `employees.router.ts:71,145,182` pass no scope.
**Live proof** — user `asha@audit.local`, sole role `employee`, whose `employee.read` scope is `own`:
```
GET /api/employees/BCO000001   (a different company)
→ 200 {"name":"Bikram Beta","dob":"1988-08-08","personalEmail":"bikram.personal@example.com",
       "mobile":"9000000002","presentAddress":"34 Beta Road, Durgapur", …,"canViewCompensation":true}
GET /api/employees?pageSize=50 → total=2, both companies
GET /api/employees/facets      → company-wide headcounts
```
**Impact (compliance/privacy):** DPDP-relevant personal data — date of birth, personal email, mobile,
home address, emergency contact, blood group, marital status, exit reason — of all 1,066 employees across
14 legal entities is readable by any account with a login. This is simultaneously the
"plant A HR sees plant B" failure and a whole-directory leak to ESS users.
**Doc ref:** CORE-10, docs/08 §2 (`employee.read` = O / S / P per role), KQ manager-tree requirement.
**Fix:** thread `EmployeeScope` (already built, `src/core/rbac/employee-scope.ts`) into `listEmployees`,
`getEmployeeByEcode` and `listDirectoryFacets`; return 404 (not 403) for out-of-scope e-codes.
**Test:** an access-matrix integration test: for each role, assert an out-of-scope e-code returns 404.

### [D2] [P0] [D] Data scope is computed on every request and then discarded by 20 of 24 modules
**Evidence:** `withPermission()` resolves `permissionAccess` for all 165 gated procedures
(`src/api/orpc.ts:130-147`), but `grep -rn "permissionAccess" src/modules/` finds it consumed in **only 4
modules**: `attendance` (attendance-config.router), `audit`, `policies`, `reports` — 13 call sites total.
Not used by: `employees`, `leave`, `documents`, `letters`, `assets`, `helpdesk`, `engagement`, `claims`,
`compliance`, `ird`, `privacy`, `security`, `org`, `lifecycle`, `rbac`, `settings`, `workflows`, `system`.
**Concrete instances:**
- `leave.router.ts:127-131` `GET /leave/balances/{employeeId}` — `leave.admin` (hr_ops scope `org_unit`),
  no scope check → any HR ops reads any employee's balances company-wide.
- `leave.router.ts:367-384` `POST /leave/adjustments` — same permission, **writes** a ledger correction for
  any employee.
- `documents.router.ts:104-131,171-200` — `doc.vault.manage` (hr_ops scope `org_unit`) lists and uploads
  into **any** employee's document vault.
- `letters.router.ts:116` `GET /letters/employee/{employeeId}` — `letters.issue`, org_unit scope ignored.
- `assets.router.ts:154` `GET` by `employeeId` — `assets.manage`, org_unit scope ignored.
**Impact (compliance):** the org-unit restriction that separates the 14 entities and the plants exists in
seed data and in `withPermission`, and is thrown away before the query runs.
**Fix:** make scope non-optional: change the repository signatures to require an `EmployeeScope` argument
so omitting it is a type error, then fix the resulting compile failures.

### [D3] [P0] [D] `admin.roles` is unbounded — an `it_admin` can make itself `super_admin`
**Evidence:** `backend/src/modules/rbac/rbac.router.ts` — `grantProcedure` (line 63),
`revokeProcedure` (line 87), `assignRoleProcedure` (line 117), `removeRoleProcedure` (line 146) are all
guarded by `withPermission('admin.roles')` and contain **no ceiling check, no self-grant check, no step-up**.
docs/08 §2 requires *"grant ≤ own level"* and states as a hard rule that **it_admin never holds
compensation.read (separation of duties)** and has *"no HR data authority (cannot see salaries)"*.
**Live proof** — user `it@audit.local`, sole role `it_admin`:
```
POST /api/rbac/grants {"role":"it_admin","permission":"employee.compensation.read","scope":"all"} → {"changed":true}
POST /api/rbac/grants {"role":"it_admin","permission":"employee.statutory_ids.read","scope":"all"} → {"changed":true}
POST /api/rbac/user-roles {"userId":7,"role":"super_admin"}                                        → {"ok":true}
GET  /api/employees/ACO000001  (after re-login)
→ {"statutoryMasked":false,"pan":"ABCDE1234F","aadhaar":"111122223333","uan":"100000000001",
   "bankAccount":"99887766554433","bankIfsc":"HDFC0001234","canViewCompensation":true}
```
**Impact (compliance/security):** total compromise of separation of duties. `super_admin` additionally
carries `payroll.run.reopen` — the payroll unlock authority. The same endpoints can **revoke**
`admin.roles` from `super_admin` and every user, which is an unrecoverable lockout (I did not execute the
destructive variant).
**Fix:** (a) a role-lattice check — a grantor may never grant a permission it does not itself hold, nor
assign a role whose grant-set exceeds its own; (b) forbid self-targeted role changes; (c) `withStepUp` on
all four; (d) a DB-level guard that at least one active `super_admin` assignment always remains;
(e) alert on any `core.role_permissions` change.
**Test:** integration test — it_admin attempting each of the four calls against a higher role gets 403.

### [D4] [P0] [D] No rate limiting anywhere in the application
**Evidence:** `backend/src/app.ts` is 56 lines: `express.json()`, `cookieParser()`, the oRPC middleware,
`/api/openapi.json`, `/health`. No `express-rate-limit` or equivalent in `package.json`.
**Live proof:** 30 failed logins completed in **1 second**, all returning 401 — no throttle.
40 `POST /auth/password/forgot` calls all returned 200.
**Impact (availability/security):** NFR-03 explicitly requires *"rate limiting on auth + all endpoints"*.
Consequences: unthrottled credential stuffing; bcrypt-cost CPU exhaustion from a single client; unbounded
anonymous POSH/whistleblower writes ([B4]); and [D5] below.
**Fix:** IP + account token buckets on `/auth/*`, a global limiter on `/api/*`, stricter limits on
anonymous intake, behind a trusted-proxy config so `req.ip` is real.

### [D5] [P1] [D] Account lockout is an unauthenticated denial-of-service against every employee
**Evidence:** lockout works as designed — after 5 failures `core.users.failed_attempts=5` and
`locked_until` is set (verified live). But it is attacker-triggerable and there is no IP throttle ([D4]).
**Impact:** ~5,330 unauthenticated requests locks all 1,066 accounts. On the 28th of the month that stops
payroll. There is no admin "unlock" procedure in the API either (`admin.users` has no endpoint — [E7]).
**Fix:** pair lockout with IP throttling and progressive delay; add an audited unlock endpoint;
consider locking on *distinct-IP* failures rather than raw count.

### [D6] [P0] [D] No security headers — `helmet` is not installed or configured
**Evidence:** `curl -i http://localhost:5199/health` returns only
`X-Powered-By: Express`, `Content-Type`, `Content-Length`, `ETag`, `Date`, `Connection`, `Keep-Alive`.
No `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`/`frame-ancestors`,
`Content-Security-Policy`, `Referrer-Policy`, `Permissions-Policy`. `helmet` is absent from
`backend/package.json`.
**Impact:** no clickjacking protection on an app that approves resignations and moves money; no CSP, which
matters because the access token is in `sessionStorage` ([D13]) and uploads accept `text/html` ([D9]);
`X-Powered-By` leaks the stack.
**Fix:** `app.use(helmet({...}))` with an explicit CSP; `app.disable('x-powered-by')`.

### [D7] [P1] [D] No CORS configuration despite `CORS_ORIGIN` being advertised
**Evidence:** `backend/.env.example:31` documents `# CORS_ORIGIN=http://localhost:5173`; nothing in
`src/` reads it, and `cors` is not a dependency. Development works only because Vite proxies `/api`.
**Impact:** the production topology (docs/02 §2) is undefined at the browser boundary — either the app
breaks on a split origin, or a reverse-proxy `*` gets added under deadline pressure, which with
`credentials: 'include'` would be a cross-origin credential leak.
**Fix:** explicit origin allowlist from validated env; add `CORS_ORIGIN` to `core/config/env.ts`.

### [D8] [P1] [D] No error-handling middleware — a 413 returns an Express HTML stack trace with server paths
**Evidence:** live probe, 250 KB upload to `POST /api/documents/mine`:
```
HTTP 413
<!DOCTYPE html><html lang="en"><head>…<title>Error</title></head><body>
<pre>PayloadTooLargeError: request entity too large<br> &nbsp; &nbsp;at readStream
(/Users/anooppratapsingh/Documents/HRM…
```
**Impact:** absolute filesystem paths and the dependency tree leak to any client. Any non-ORPC throw
escapes as HTML rather than the documented `{success,data,error,meta}` / ORPC JSON shape, so the frontend's
`apiFetch` error parser (`frontend/src/lib/api.ts:74-79`) falls through to a generic
*"Request failed (413)"* and the user is told nothing useful.
**Fix:** a terminal error middleware that logs with a traceId and returns a JSON envelope; never echo stacks.

### [D9] [P1] [D] File uploads have no MIME allowlist, no size cap and no content sniffing
**Evidence:** `documents.router.ts:144,182` accept `mime: z.string().min(1).max(120)` and
`content: z.string().min(1)` (no `.max`). `vault.service.ts` and `core/storage/documents.ts` perform no
validation beyond the `doc.types` catalog lookup.
**Live proof:** a `<script>alert(document.domain)</script>` payload was stored as a **PAN card**:
```
id | kind |                    path                     | original_name |   mime    | size_bytes
 1 | pan  | pan/2026/09/9139d7c6-….html                 | pan.html      | text/html |         39
```
**Impact:** today the risk is latent because the documents module has **no download endpoint** ([E10]) —
but the metadata is stored and will drive whatever download is built, and HR sees `pan.html` as an
employee's identity document. `policies`/`letters` *do* serve content back from the same store.
**Fix:** per-`doc.types` MIME allowlist, magic-byte sniffing, size cap, filename sanitisation, and
`Content-Disposition: attachment` + `X-Content-Type-Options: nosniff` on every download.

### [D10] [P1] [D] `express.json()` uses the 100 kB default, so real document uploads are impossible
**Evidence:** `backend/src/app.ts:34` — `app.use(express.json())`, no `limit`. A 30 KB body succeeded
(rejected later for an unknown doc type); a 250 KB body returned 413.
**Impact (functional):** a scanned PAN/Aadhaar or an appointment-letter PDF is 200 KB – 2 MB. DOC-02
(document vault), CORE-13 (policy publish) and CORE-09 (letters) are all non-functional for real files.
**Fix:** raise the JSON limit deliberately for the upload routes (or move to multipart streaming), and cap
per-type in the validator rather than at the body parser.

### [D11] [P1] [D] `ceo_cell` can read individual compensation, which docs/08 forbids
**Evidence:** `seed-data.ts:275` grants `ceo_cell` → `employee.compensation.read` with scope `readonly`
and a `note: 'aggregates only — never individual salaries'`. `permissions.service.ts:63` maps
`readonly` → `all: true`. `employees.service.ts:253,278` gate purely on
`permissions.has('employee.compensation.read')`. **The note is a string no code reads.**
**Impact:** docs/08 §3 states ceo_cell sees *"aggregate compensation only (averages, not individual
salaries — individual visibility requires hr_head/payroll role)"*. Not enforced.
**Fix:** a distinct `employee.compensation.aggregate` permission, or an explicit aggregate-only path.

### [D12] [P2] [D] The `readonly` scope is a silent alias for `all`
**Evidence:** `permissions.service.ts:63` — `all: scopes.has('all') || scopes.has('readonly')`.
Held as `readonly` by `payroll_admin.attendance.team.read`, `ceo_cell.{employee.read,
employee.compensation.read, attendance.team.read}`, `it_admin.employee.read`,
`compliance_officer.employee.read`, `dpo.employee.read`, `hr_head.payroll.run.view`.
**Impact:** a scope named "read-only" grants **full-company read** and restricts nothing. Read-only-ness
comes only from those roles lacking write permissions — a coincidence, not a control. It reads in the
RBAC console as a safety property that does not exist.
**Fix:** either drop `readonly` from the `Scope` union or give it real semantics.

### [D13] [P2] [D] Refresh tokens are described as rotated but are neither rotated nor reuse-detected
**Evidence:** `auth.router.ts:83-97` summary *"Rotate the refresh token"*; plans/phase-0 P0-T20 claims
*"rotated on every use"*. `auth.service.ts:98-121` `refresh()` issues a new refresh JWT with the **same
`sid`** and never invalidates the presented one, which stays valid until its 7-day `exp`.
**Impact:** a stolen refresh token remains usable for up to 7 days alongside the legitimate one, with no
reuse detection. **Mitigated** by the `sec.sessions` liveness check (a genuine strength — revoke and
"sign out everywhere" do work), so this is P2 rather than P1.
**Fix:** store a refresh-token id per session, rotate it, and revoke the whole session on reuse of a
retired id.

### [D14] [P2] [D] Insecure default JWT secret in the app factory
**Evidence:** `backend/src/app.ts:21` — `jwtSecret: deps?.jwtSecret ?? 'insecure-test-only-secret-never-in-production!'`.
**Impact:** `src/index.ts` always passes the validated secret, so this is unreachable in the shipped
entrypoint — but it is one refactor away from a silent auth bypass (anyone can forge tokens against a
published constant).
**Fix:** throw when `NODE_ENV === 'production'` and no secret is supplied.

### [D15] [P1] [D] Environment validation covers 4 of the ~12 variables the system uses
**Evidence:** `src/core/config/env.ts:8-13` validates `NODE_ENV, PORT, DATABASE_URL, JWT_SECRET` only.
Unvalidated: `TEST_DATABASE_URL`, `SMTP_*`, `S3_*`, `CORS_ORIGIN`, `ATS_JWT_PUBLIC_KEY`, `STORAGE_DIR`,
`LOG_LEVEL`.
**Impact:** docs/14 and the ops checklist claim boot-time config validation. A missing `SMTP_HOST` in
production surfaces as silently undelivered payroll notifications, not a boot failure.
**Fix:** extend the schema; make production-required vars conditionally required on `NODE_ENV`.

### [D16] [P1] [D] Four npm advisories in production dependencies, one high
**Evidence:** `npm audit --omit=dev` in `backend/`:
`high` **brace-expansion**; `moderate` **qs** (Express's query parser), **uuid** ×2 via **exceljs**.
`4 vulnerabilities (3 moderate, 1 high)`. Frontend: `found 0 vulnerabilities`.
**Fix:** upgrade `exceljs`; `npm audit` as a blocking CI step.

### [D17] [P2] [D] Access token in `sessionStorage` with no CSP to back it up
**Evidence:** `frontend/src/lib/session.ts:28-40`. Combined with [D6] (no CSP) and [D9]
(HTML upload accepted).
**Impact:** any XSS yields a 15-minute access token. The httpOnly refresh cookie is correctly out of
JavaScript's reach — that part is right.
**Fix:** ship a CSP; consider keeping the access token in memory only.

### [D18] [P3] [D] `jwtVerify` does not pin the algorithm list
**Evidence:** `src/core/auth/jwt.ts:75` — `jwtVerify(token, key(secret), { issuer: ISSUER })`, no
`algorithms: ['HS256']`, no `audience`.
**Impact:** low — `jose` restricts a `Uint8Array` key to HMAC algorithms, so classic alg-confusion is
already blocked. Defence in depth only.

**Verified good (dimension D):** password policy with history (`core.password_history`), TOTP MFA with
recovery codes and an enforcement policy, step-up re-authentication with a distinct
`STEP_UP_REQUIRED` error the client handles without losing state, server-side session revocation that
makes "sign out everywhere" real, uniform login failure messages (no user-enumeration oracle), exponential
lockout backoff, password-reset tokens that are single-use and reuse-checked, bcrypt hashing, the
hash-chained audit log with DB-side verification, and correct statutory-ID masking
(`canViewStatutoryIds` — own record, or a payroll-class permission; verified live that a peer's
PAN/Aadhaar/bank return `null`).

---

## Dimension E — Business-logic correctness

### [E1] [P0] [E] A workflow whose approvers are all vacant approves itself, with no steps and no notifications
**Evidence:** `workflow.service.ts` `advance()` skips vacant approvers and, when the chain is exhausted,
marks the request `approved`. plans/phase-1 Stage 1.3 P1-T10 records this as intended and tested:
*"vacant approvers auto-skip with audit (chain exhausted → auto-approved ✓)"*.
**Live proof** — the forged resignation from [B2]:
```
wf.requests:      id=1 definition=resignation subject_employee_id=2 requested_by=1 status=approved
wf.request_steps: (0 rows)
core.audit_log:   step_1 skipped — approver 'reporting_manager' vacant   (actor_user_id = NULL)
                  step_2 skipped — approver 'role:hr_head' vacant        (actor_user_id = NULL)
                  step_3 skipped — approver 'role:hr_ops' vacant         (actor_user_id = NULL)
```
Note steps 2 and 3 are **role** steps: `role:hr_head` and `role:hr_ops` resolved to zero holders and were
skipped. So whenever nobody holds `hr_head` — during setup, after a departure, or after an `admin.roles`
holder revokes it ([D3]) — **every resignation, confirmation, transfer and separation auto-approves**.
**Impact (compliance/HR):** an employee can be separated with no human decision anywhere in the chain.
CLAUDE.md rule 8 — *"every workflow step records `notified_at`; the 'approver never notified' bug must be
impossible"* — is satisfied only vacuously: there are no steps, so nobody was notified, and the plan's
claim that the NOT NULL receipt makes this *"structural, not procedural"* does not hold.
**Doc ref:** docs/04 §5 says *"missing approver (vacant manager) → auto-skip-to-next with audit note,
never a dead end"* — it does **not** authorise approving when every step is vacant.
**Fix:** a mandatory floor — if no step in a chain resolved to a real approver, the request must land in an
HR fallback queue (`role:hr_head`, else `super_admin`) in status `pending`, never `approved`. Emit a
loud alert. Record a step row for the fallback so the receipt invariant means something.
**Test:** integration test — chain with every approver vacant ⇒ status `pending` + one fallback step.

### [E2] [P1] [E] Backend typecheck, lint and build are RED — the working tree does not compile
**Evidence:** `cd backend && npm run typecheck` → exit 2:
- `src/modules/leave/coverage-check.service.ts:210` TS2375 — `fromHalf`/`toHalf` are
  `boolean | undefined` against a `LeaveSpanHalves` requiring `boolean` (`exactOptionalPropertyTypes`).
- `src/modules/reports/reports-export.service.ts:155` TS2345 — request `kind` widened to `string` against
  `"OD" | "AR" | "PERMISSION"`.
- `src/modules/reports/reports-export.service.ts:195` TS2345 — absence `stage` widened to `string` against
  `"watch" | "show_cause" | "warning" | "termination_review"`.
- `src/modules/reports/reports.router.ts:712` TS2345 — `teamMonthGrid` returns
  `days: Record<string,{status: string}>` against the `dayStatus` enum output schema.
`npm run lint` → exit 1: `tests/stage17-supporting-reports.integration.test.ts:357`
`@typescript-eslint/no-unnecessary-condition` — *comparison is always true, since `"active" === "active"`*.
`npm run build` → exit 2 (same four).
**Impact:** `npm run verify` cannot pass, so the repository's own Definition of Done is unmet and no
artifact can be produced. The muster/team-grid error is on **RPT-01**, the report an auditor asks for.
**Fix:** narrow the three at their source (parse the query param through the zod enum rather than
`string`); type `day_records.status` reads as `DayStatus`; delete the tautological assertion.

### [E3] [P1] [E] One integration test fails: leave-coverage warning for a same-day applicant
**Evidence:** `npm run test` → `Test Files 1 failed | 63 passed (64)`, `Tests 1 failed | 482 passed (483)`.
`tests/shift-micro-scheduling.integration.test.ts:277` —
*"SHF-08 counts the applicant as absent before the application row exists"*, `expected false to be true`.

> **CORRECTED 5 Sep 2026 during remediation W0-T08.** This entry originally inferred, from the test's
> name, that the coverage logic failed to count the applicant. Instrumenting the test disproved that:
> `evaluateLeaveCoverage` returns exactly the right warning —
> `"HMTNDJPGEN on 14 Dec 2026 would leave 0 against the sanctioned 1 (shortfall 1). Your manager can
> still approve."` The **assertion** was wrong: it searched for `2026-12-14` while the message correctly
> renders `14 Dec 2026`, the only date format this system shows a human (docs/05 §10, NFR-09).
>
> **The logic was never broken.** SHF-08 does count the applicant as absent before the row exists.
> Fixed by asserting the whole sentence — stronger than the original two-fragment `.includes` check,
> and it now pins the shortfall arithmetic too.

**Impact as re-assessed:** a false-negative test, not a coverage defect. The plant was never at risk of
running understaffed through this path; the suite was reporting a failure that did not exist.
**Fix applied:** `tests/shift-micro-scheduling.integration.test.ts` asserts the exact rendered warning.

### [E4] [P1] [E] There is no employee-master write path at all
**Evidence:** `employee.write` is seeded (`seed-data.ts:57`, granted to hr_ops `org_unit` and hr_head
`all`) and referenced by **no procedure**. The employees router exposes only `list`, `facets`, `getOwn`,
`getByEcode`. `admin.users` is likewise unenforced anywhere.
**Impact (functional):** CORE-01 ("single employee master"), CORE-08 (field validation: PAN/Aadhaar/IFSC
formats, duplicate ESI/UAN checks) and CORE-03 (reporting + functional manager maintenance) have no UI or
API. HR cannot correct a PAN, change a department, or fix a reporting manager except by direct SQL — which
also bypasses `core.audit_log`. There is no way to create or deactivate a user account through the product
(`scripts/create-admin.ts` is the only route).
**Fix:** build the write endpoints with CORE-08 validators, `assertEmployeesInScope`, and `writeAudit`
field-by-field old→new.

### [E5] [P1] [E] Policy documents are returned as UTF-8 text, corrupting every binary file
**Evidence:** `backend/src/modules/policies/policies.router.ts:130` —
`return { mime: doc.mime, fileName: doc.originalName, content: doc.content.toString('utf8') }`.
**Impact:** CORE-13 policy publishing accepts a PDF and returns mojibake. The same pattern is in
`letters.router.ts:135`.
**Fix:** base64-encode binary content in the JSON response, or serve bytes from a dedicated route with
correct headers.

### [E6] [P1] [E] The document vault has no download endpoint
**Evidence:** `documents.router.ts` exposes `listTypes`, `listMine`, `listManaged`, `uploadOwn`,
`uploadForEmployee` — and nothing that reads bytes. `readDocument` is imported only by `letters` and
`policies`.
**Impact:** DOC-02 documents can be uploaded and listed but never retrieved — by the employee or by HR.
**Fix:** add a permission-gated, scope-checked download with `Content-Disposition: attachment`.

### [E7] [P1] [E] Whistleblower reports can be filed but never read
**Evidence:** `ird.whistle.intake` is seeded (hr_head, super_admin) and enforced by no procedure.
`irdRouter` exports `listPosh` and `listGrievance` but no whistleblower list.
**Impact:** anonymous reports accumulate in `ird.whistleblower_reports` with no route to a handler —
the intake side of a statutory obligation exists, the response side does not.

### [E8] [P2] [E] Two scheduled jobs are commented as IST but scheduled in UTC
**Evidence:** `src/jobs/worker.ts` — every other job converts explicitly ("07:00 IST (01:30 UTC)"), but:
- line 160: `boss.schedule(WEEK_CLOSE_QUEUE, '0 2 * * 1')` commented *"Monday 02:00 IST"* → runs 07:30 IST.
- line 168: `boss.schedule(ROSTER_REMINDER_QUEUE, '0 9 5 * *')` commented *"the 5th, 09:00"* → runs 14:30 IST.
pg-boss `schedule()` defaults to UTC.
**Impact:** ATT-09 week-off eligibility closes 5½ h later than intended; the ATT-04 roster-deadline nag
(explicitly "5th, 09:00") arrives mid-afternoon.
**Fix:** convert both, or pass `{ tz: 'Asia/Kolkata' }` consistently.

### [E9] [P2] [E] Two pg-boss queues are scheduled without being created
**Evidence:** `src/jobs/worker.ts:68-83` creates 11 queues; `KPI_SNAPSHOT_QUEUE` (line 101) and
`HELPDESK_ESCALATION_QUEUE` (line 109) are `schedule()`d and `work()`ed but never `createQueue`d.
pg-boss v12 requires explicit queue creation.
**Impact:** worker boot likely throws, taking **all 13 jobs** down with it. **UNVERIFIED at runtime** —
I did not start the worker against the audit DB. Verify by running `npm run worker`.
**Fix:** add both to the `queues` array.

### [E10] [P2] [E] The notification drain sends up to 50 messages inside one transaction
**Evidence:** `notifications.service.ts:100-110` — `db.transaction()` wraps `claimDeliverable` plus every
`transport.send()` and `markSent()`.
**Impact:** with a real SMTP transport, one failure late in the batch rolls back the `markSent` of
already-delivered messages → **duplicate sends** on retry; and the claim rows stay locked for the sum of
50 SMTP round-trips.
**Fix:** claim in one short transaction, then send and mark per-message outside it.

### [E11] [P2] [E] Money crosses the DB boundary through a float multiply, contradicting the file's own contract
**Evidence:** `src/modules/claims/ledger.service.ts:11-27` — the docblock says *"NUMERIC arrives as a
string … and becomes branded `Paise` before any arithmetic happens (docs/14 §6 — floats never touch
money)"*; the implementation is
`export function numericToPaise(value){ return paise(Math.round(Number(value) * 100)); }`.
**Impact:** low at claim magnitudes, but it is exactly the pattern docs/14 §2 forbids, and
`core/money`'s own `fromRupees()` — which guards against >2-decimal inputs — is bypassed.
**Fix:** parse the NUMERIC string exactly (split on `.`, pad to 2 places, integer-concatenate).

### [E12] [P3] [E] The `previewChain` procedure discloses any employee's approval chain
**Evidence:** `workflows.router.ts:180-215` — `authed`, accepts any `subjectEmployeeId`.
**Live proof:** Asha retrieved Bikram's chain for `definitionCode=leave`.
**Impact:** org-structure disclosure (approver names). Low, but it is the same missing check as [B2].

### [E13] [P1] [E] A test built its fixture dates in UTC against IST logic — green by day, red at night
**Discovered:** 5 Sep 2026, 01:28 IST, during remediation W0.2. **Not present in the 4 Sep audit run**,
which executed at ~23:00 IST and passed.
**Evidence:** `tests/compliance-calendar.integration.test.ts:45-49` built fixture dates with
```ts
const d = new Date(); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10);
```
while the code under test measures from **IST** midnight — `src/modules/compliance/expiry.ts:53-64`
`atStartOfDay()` uses local getters, deliberately, with a comment citing NFR-09 and the exact hazard
(*"on the day a plant's licence actually lapses, is a day of production blocked for nothing"*).

Between **00:00 and 05:30 IST** the UTC calendar date is still yesterday, so every fixture was one day
short: `expected 19 to be 20` on `daysRemaining`.
**Impact:** a suite that passes all day and fails overnight — the worst kind, because it trains people to
re-run rather than investigate, and it would have fired on any CI job scheduled after midnight IST.
**The production code is correct;** the test bypassed `core/dates.ts`, which exists to prevent exactly
this. A sweep found no other test deriving from `new Date()` with UTC getters, and the one production
occurrence (`attendance/shift-windows.ts:42-48` `mondayOf`) anchors to an ISO string at `T00:00:00Z`,
which is timezone-independent and correct.
**Fix applied:** the helper now uses the shared `istDateString()` + `addDaysIso()`.
**Test that would have caught it:** CI running at a fixed non-IST-business hour, or a clock-freezing
harness that pins "now" to 02:00 IST.

**Verified good (dimension E):** **policy values are genuinely configuration, not code.**
`getTypedSetting(db, key, type, default)` is used at ~70 call sites across attendance, leave, compliance,
privacy, documents, reports and auth; the seed loads 51 keys idempotently. I found **no hardcoded policy
number** in the services I read. `core/money` is a correct integer-paise implementation with a single
named rounding-policy file (PF nearest rupee, ESIC round **up**), basis-point rates, and safe-range
assertions; its tests hand-compute expectations and one of them **caught an arithmetic error in
docs/10 §13 fixture G8** (₹1,67,007.69 → ₹1,67,638.85). `core/dates.ts` correctly handles the pg
DATE local-midnight trap and fixed-offset IST arithmetic, with 25 tests.

---

## Dimension F — Frontend, UX, accessibility

### [F1] [P1] [F] 44 of 47 pages have no test, and no page has an accessibility test
**Evidence:** 33 frontend test files, 290 tests, all green. `axe-core` is used in exactly three files —
`ui/Button.test.tsx`, `ui/forms.test.tsx`, `ui/surfaces.test.tsx` — over **primitives in isolation**,
in both themes. Pages with no test file include `MusterPage`, `ApprovalsPage`, `ProfilePage`,
`DirectoryPage`, `MonthLockPage`, `AccessControlPage`, `SecurityPage`, `AuditLogPage`, `PayrollPage`,
`MyPayPage`, `ExecutivePage`, `CompliancePage`, `PrivacyOpsPage`, `AssetsPage`, `HelpdeskPage`.
**Impact:** CLAUDE.md rule 10 requires contrast ≥ 4.5:1 in both themes, colour never the only signal,
keyboard-completeness and visible focus. That is verified for buttons and form fields, and for **no real
screen** — where the composition, the tables, the drawers and the charts actually live.
**Fix:** an axe smoke test per route (render → `runAxe` in both themes), plus interaction tests on the
≤2-click daily actions (punch, apply leave, approve).
**UNVERIFIED:** I did not measure per-page contrast ratios or walk every route per role in a browser —
that requires the page-level harness this finding asks for.

### [F2] [P2] [F] No code splitting — one 790 kB JavaScript chunk for all 44 routes
**Evidence:** `npm run build` →
`dist/assets/index-C4eNKQ_B.js  790.55 kB │ gzip: 221.41 kB` with Vite's
*"Some chunks are larger than 500 kB"* warning. `router.tsx` statically imports all 44 pages;
`grep "React.lazy|Suspense"` finds none.
**Impact:** NFR-01 requires dashboard first paint < 2 s; NFR-07 requires tablets and phones. An ESS user
on a plant-floor device downloads the payroll console, executive dashboard and privacy-ops code to punch in.
**Fix:** `React.lazy` per route with a `Suspense` skeleton; a `manualChunks` split for charts.

### [F3] [P2] [F] `canViewCompensation: true` is returned for a plain employee viewing someone else
**Evidence:** live probe of `GET /api/employees/BCO000001` as `asha@audit.local` returned
`"canViewCompensation": true`. The flag is `permissions.has('employee.compensation.read')` with no scope
or subject check (`employees.service.ts:253,278`); the `employee` role holds that permission at scope `own`.
`ProfilePage` gates the Compensation tab on this flag.
**Impact:** the ESS user is shown a Compensation tab on a **colleague's** profile. It is empty only because
`pay.*` does not exist yet — the moment Phase 2 lands, it fills.
**Fix:** compute the flag against the subject (`own` scope ⇒ true only when `row.id === user.employee_id`).

### [F4] [P2] [F] `nav-config.ts` contradicts its own rule with 14 hardcoded role checks
**Evidence:** the file's docblock says *"Never hardcode role checks in page handlers; nav is the
permission-driven shell"*, then uses `hasRole(...)` at lines 87-94, 101, 192, 315; `RoleHomePage.tsx`
adds five more (lines 52, 58, 64, 70, 163); `router.tsx:143` gates `/dev/gallery` on
`hasRole(user,'super_admin')`.
**Impact:** frontend-only, so not a security hole — but it defeats CORE-10's promise that a runtime
permission change takes effect immediately: re-granting a permission in the RBAC console will not change
the navigation until the role changes too.
**Fix:** derive every nav decision from permissions.

### [F5] [P2] [F] `apiFetch` has no timeout and no abort
**Evidence:** `frontend/src/lib/api.ts:47-88` — no `AbortController`, no timeout, no cancellation on unmount.
**Impact:** a stalled request leaves a page in its loading state indefinitely; navigating away leaves the
promise resolving into an unmounted tree.
**Fix:** `AbortSignal.timeout(n)` plus per-component abort on unmount.

### [F6] [P2] [F] No end-to-end tests exist
**Evidence:** no Playwright/Cypress dependency, config or spec anywhere in the repo.
**Doc ref:** docs/14 §10 Tier-2 item 12 requires *"Playwright smoke: 10–20 journeys (login → punch →
approve → run payroll → download register)"*; plans/README calls it *"the one missing gate"*.
**Impact:** no test covers a whole journey, so [D1], [B2] and [E1] were all invisible to the suite.

### [F7] [P3] [F] 18 frontend files exceed 400 lines — see [A5].

**Verified good (dimension F):** **the design firewall holds perfectly.**
`grep -rnoE "#[0-9a-fA-F]{3,8}" src --include='*.tsx' --include='*.ts' --include='*.css'` excluding
`src/tokens/tokens.css` → **0 matches**; the same for `rgb()/rgba()/hsl()/oklch()` → **0 matches**;
no MUI, Ant, Chakra, Bootstrap, Mantine, Radix or Headless UI in `package.json` — the only UI dependencies
are `lucide-react` (icons, per docs/05 §7b) and `sonner` (toasts). 11 pages use the shared
`ModuleState`/`useModuleResource` pattern, which deliberately distinguishes *"backend not built yet"*
(a calm pending panel naming the phase and endpoint) from a real error, and never renders invented data —
a direct implementation of docs/05 §4.8. Charts are token-driven SVG primitives rather than a second
library. Frontend `verify` is fully green: typecheck, lint, knip, 290 tests, build.

---

## Dimension G — Tests & quality

### [G1] [P0] [G] The backend CI job cannot run its tests — there is no Postgres service
**Evidence:** `.github/workflows/ci.yml` runs `npm run verify` in `backend/` with no `services: postgres`
block and no `TEST_DATABASE_URL`. `backend/vitest.config.ts:4-9` **throws** when `TEST_DATABASE_URL` is
absent: *"TEST_DATABASE_URL is required. Integration tests must never run against DATABASE_URL."*
Locally this passes only because `backend/.env` (gitignored) supplies it.
**Impact:** the blocking gate that plans/README calls *"CI gates all green (blocking)"* has never been able
to execute the 64 integration test files. Combined with [E2], `main` is red.
**Fix:** add a `postgres:16` service container, run `npm run migrate` and the three seeds, export
`TEST_DATABASE_URL`.

### [G2] [P1] [G] The CI pipeline implements 5 of the 8 required gates
**Evidence:** `ci.yml` runs typecheck → lint → knip → depcruise → test → build. docs/14 §10 item 15
requires additionally: **golden-master payroll diff**, **Playwright smoke**, and **nightly Stryker
mutation testing scoped to payroll-core**. Also absent: `npm audit`, a migration up/down test, a load test
for the 3k→10k target, and an RBAC matrix test.
**Impact:** the "test-of-the-tests" (mutation testing) that docs/14 introduces specifically to catch
*"vacuous AI-generated tests"* is not running — and [G4] is exactly such a test.

### [G3] [P1] [G] Backend test coverage is never measured
**Evidence:** `backend/package.json` has no `@vitest/coverage-v8` dependency and no coverage script;
`vitest.config.ts` sets no coverage thresholds. The frontend does have coverage tooling
(`test:coverage`) but it is not in `verify` and no threshold is enforced.
**Impact:** the 80% floor and the payroll-core 100%-branch target (CLAUDE.md §1.5, docs/14 §10) are
unmeasurable, so the claim in plans/README ("82% coverage") cannot be checked and is not gated.
**Fix:** add coverage with a failing threshold to both `verify` scripts.

### [G4] [P2] [G] A test asserts the behaviour of a stub, proving nothing
**Evidence:** `tests/ird-posh.unit.test.ts:18-19`
```ts
expect(whistleRateLimitOk(null)).toBe(true);
expect(whistleRateLimitOk('127.0.0.1')).toBe(true);
```
against `export function whistleRateLimitOk(ip){ void ip; return true; }`.
**Impact:** the test is green, the requirement (rate-limited anonymous intake) is unimplemented, and the
green tick is what makes it invisible. See [B4].

### [G5] [P2] [G] Half the statutory golden fixtures are untested
**Evidence:** `tests/money.test.ts` covers **G1, G2, G7, G8, G10**. docs/10 §13 defines G1–G10;
**G3a/G3b/G3c (the ESIC ₹20,999/₹21,001 boundary and the mid-period revision), G4, G5, G6 and G9 have
no test.** This is consistent with payroll being unbuilt, but G3 in particular tests a rule
(*"once in, stays in for the full contribution period"*) that is pure arithmetic and testable today.

### [G6] [P2] [G] No property-based tests
**Evidence:** `fast-check` is not a dependency. docs/14 §10 Tier-2 item 10 requires
*"net = gross − deductions exactly; component sum = gross; paise conservation; PF ceiling monotonicity;
idempotent recompute"*.

**Verified good (dimension G):** 483 backend tests across 64 files, of which the majority are **real
integration tests against a live Postgres**, correctly isolated by a `*_test` database-name guard enforced
before any test loads, and with `fileParallelism: false` because the suites share one audit chain — both
of which are the right calls. Tests deactivate rather than delete audited users, honouring the append-only
FK. `punch-edge-cases.test.ts` alone carries 36 cases; `day-status-compute.test.ts` 15; `dates.test.ts` 25;
`money.test.ts` 24 with hand-computed expectations. The audit-chain concurrency test documents a real bug
it caught (chain ordered by `id` instead of `chain_seq`).

---

## Dimension H — Ops & production readiness

### [H1] [P0] [H] Roughly 40% of the system exists only in an uncommitted working tree
**Evidence:** `git status --short` → **109 modified**, **129 untracked**, 1 deleted. The untracked set
includes **13 migrations** (`1752060000000_sec-identity-hardening` … `1752190000000_attendance-day-integrity`),
**32 test files**, 7 attendance modules, 4 core/auth modules, 6 core/db files, 8 admin pages, and 9 plan files.
**Impact (data loss/continuity):** every Phase 5 capability — identity hardening, DPDP, POSH/grievance,
compliance calendar, document vault — plus Stage 1.11 exists on one developer's disk with no backup and no
review. A disk failure loses it. CLAUDE.md §1.1 requires every commit to reference a requirement ID;
none of this is committed at all, so there is no traceability for the largest body of work in the repo.
**Fix:** commit in reviewable, requirement-tagged slices **before any remediation begins**.

### [H2] [P0] [H] The PM2 topology runs no background worker — every scheduled job is disabled in production
**Evidence:** `ecosystem.config.cjs` defines only `hrms-api`; `hrms-worker` and `hrms-scheduler` are
**commented out** with *"Uncomment when Phase 1 lands the job system"*. Phase 1 Stages 1.1–1.11 have
landed and `src/jobs/worker.ts` registers 13 jobs. The commented block also points at `dist/worker.js`
and `dist/scheduler.js`, but the build (`rootDir: src`) emits `dist/jobs/worker.js`, and no scheduler
entrypoint exists.
**Impact:** deployed today, the system performs **no** Kent sync, no attendance recompute, no OT lapse
(the ATT-08 48-hour rule silently never fires), no week-off close, no leave accrual (LV-02, the PP-1 pain
point), no comp-off expiry, no absence scan, no boarding/exit email, no SLA escalation, no KPI snapshot,
no helpdesk escalation, no policy nag. Attendance and leave quietly stop being maintained.
**Fix:** enable both apps with correct paths; `instances: 1` on the cron leader as the comment says;
add a startup assertion that the expected schedules exist in pg-boss.

### [H3] [P1] [H] No graceful shutdown in either process
**Evidence:** `src/index.ts:16-18` — `app.listen()` with no `SIGTERM`/`SIGINT` handler, no
`server.close()`, no `db.destroy()`. `src/jobs/worker.ts:180` — `main()` with no `boss.stop()`.
**Impact:** a PM2 reload kills in-flight requests and mid-flight jobs. For a payroll system a job
terminated mid-transaction is the failure mode that produces partial state.
**Fix:** signal handlers that stop accepting, drain, then close pg-boss and the Kysely pool.

### [H4] [P1] [H] `/health` does not check the database — there is no readiness probe
**Evidence:** `src/app.ts:46-53` returns a static `{status:'ok'}`; `GET /api/system/health`
(`system.router.ts:14-21`) likewise.
**Impact:** an API process that cannot reach Postgres reports healthy, so PM2/the load balancer keeps
sending it traffic.
**Fix:** split liveness from readiness; readiness runs `SELECT 1` with a short timeout.

### [H5] [P1] [H] No error tracking, no metrics, no tracing, and no request logging
**Evidence:** `pino` is configured with sensible redaction (`core/logger.ts`) but **nothing logs a
request**: no morgan/pino-http, no traceId on any log line (the logger's own comment says
*"Trace correlation (OTel) is wired in a later Stage 0.2 task"*). No Sentry/GlitchTip SDK, no
Prometheus/OpenTelemetry exporter in `package.json`.
**Doc ref:** docs/14 §10 Tier-4 items 17–18 require GlitchTip, pino → OTel → Prometheus/Grafana, and
*"business metrics alert before technical ones"* (payout delta, employees-processed, queue depth,
device gaps).
**Impact:** in production there is no way to know a job stopped, an endpoint is 500-ing, or the Kent feed
went quiet — which is the exact class of failure PP-9 was.

### [H6] [P1] [H] No backup, PITR or restore-drill evidence in the repository
**Evidence:** `scripts/` contains `deploy.sh` and `setup-local-env.sh` only. No `pg_dump` schedule, no
WAL-archiving configuration, no restore runbook.
**Doc ref:** NFR-05 requires nightly off-box `pg_dump` + WAL archiving, RPO ≤ 24 h (≤ 15 min for payroll
months), RTO ≤ 4 h, and a **rehearsed** restore before payroll go-live. docs/14 §10 item 20 requires
*"nightly restore-TESTED backups"*.
**Impact:** for a system of record holding statutory data with an 8-year MCA retention obligation, this is
the difference between an incident and an extinction event.

### [H7] [P1] [H] Node version drift across three environments
**Evidence:** local `node -v` → **v26.0.0**; `.github/workflows/ci.yml` → **node-version: 22**;
`package.json` engines → `>=22`; docs/14 §2 → *"pin Node 24 LTS"* (active LTS to Apr 2028).
**Impact:** CI does not test what the developer runs, and neither matches the documented production target.
**Fix:** pin one version in `.nvmrc`, `engines`, CI and the deploy script.

### [H8] [P2] [H] No PgBouncer configuration, no pool tuning, no feature flags
**Evidence:** no PgBouncer config in the repo; `createDatabase` uses default pool settings
(**UNVERIFIED** — I did not read `core/db/database.ts` pool options in detail).
docs/14 §2 requires PgBouncer ≥ 1.21 with `max_prepared_statements > 0`; §10 item 19 requires DB-backed
feature flags with *"a kill switch on every new money path"*. Neither exists.

### [H9] [P2] [H] No dead-letter or retry policy is configured on any pg-boss job
**Evidence:** every `boss.work()` call in `src/jobs/worker.ts` passes only a handler — no `retryLimit`,
`retryBackoff`, `expireInSeconds` or dead-letter queue. docs/14 §6.4 calls out pg-boss footguns
explicitly (`singletonKey` without `singletonSeconds`, `send()` returning `null` on dedup); none is
handled.

**Verified good (dimension H):** the migration discipline is real — every DDL block opens with
`SET lock_timeout = '5s'`, big time-series tables are monthly-partitioned from day one with an
`ensure_*_partition` helper, and the up/down/idempotency behaviour all verified clean. `pino` redacts
`password`, `aadhaar`, `pan`, `bank_account` and the `authorization` header. The `.env.example` is
thorough and carries the production notes.

---

## Dimension I — Spec ↔ code ↔ plan drift

*(Full re-grading in `06-SPEC-DRIFT.md`; the headline items are recorded here.)*

### [I1] [P1] [I] Stage 0.5 is marked ☑ done with its own exit criteria unmet
**Evidence:** plans/phase-0 Stage 0.5 exit criteria: *"1,066 EMS rows loaded + enriched, reconciliation
counts match both sources … SeaweedFS up with nightly mirror configured."* Neither happened:
`importEmsSeed` and `importGreythrEnrich` are referenced **only by tests**, exposed by no API or CLI
script, and storage is local disk ([A3]). The stage header does disclose *"pipeline proven on mock
fixtures"*, so this is a partially-flagged overclaim rather than a hidden one.

### [I2] [P0] [I] Stage 1.3's headline guarantee does not hold
**Evidence:** P1-T10 claims *"`notified_at` is NOT NULL — a step row physically cannot exist without its
notification receipt (the PP-14 guarantee, structural not procedural)"*. Live proof [E1]: an **approved
resignation with zero step rows**. The invariant is true and the guarantee is still false. The stage's
exit criteria list *"non-approver acting → 403"* but say nothing about who may **raise** a request ([B2]).

### [I3] [P1] [I] 18 of 31 specified reports are unimplemented
**Evidence:** docs/06 defines R1–R31. Backend source references R1–R7, R20, R24, R27, R28, R29, R30
(13). Absent: R8–R19, R21, R22, R23, R25, R26, R31 — including the payroll register, the statutory
registers, the ATS cross-system reports and the reimbursement register. Most are Phase 2/3/4 dependent.

### [I4] [P2] [I] docs/08 defines 10 roles; the code seeds 12
**Evidence:** `seed-data.ts:17-29` adds `compliance_officer` and `dpo`, neither in docs/08 §1's catalog
nor given a navigation shell in docs/08 §3. `PERMISSIONS` has grown from the 38 recorded in plans/phase-0
P0-T21 to 56.
**Fix:** amend docs/08 §§1–3, or record the two roles as a Phase-5 amendment.

### [I5] [P2] [I] CLAUDE.md §2b's `base` rule does not match the code
**Evidence:** CLAUDE.md states *"base — public — login/health ONLY"*; the code has 8 `base` procedures
including two unauthenticated writes ([B4]). Either the rule or the code is wrong; the doc wins per
CLAUDE.md §0, so the anonymous-intake exception needs to be written into the rule deliberately.

### [I6] [P3] [I] plans/README carries stale test counts
**Evidence:** *"backend verify runs … 162 tests"* and *"frontend … 156 tests … 82% coverage"*;
actual today is 483 and 290. Harmless, but the same paragraph asserts *"CI gates all green (blocking)"*,
which is false ([E2], [G1]).

### [I7] [P3] [I] A doc contradiction found by the code, already corrected
**Evidence:** `tests/money.test.ts:113-122` records that docs/10 §13 fixture **G8** originally printed
₹1,67,007.69 where the correct value is ₹1,67,638.85, and that the doc has since been corrected. Noted
here as a positive example of the test-first discipline working, and as a reminder that fixtures are the
audit artifact.
