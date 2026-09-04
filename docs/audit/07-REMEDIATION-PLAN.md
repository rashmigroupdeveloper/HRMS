# 07 — Remediation Plan

Written in the `plans/` stage template so these stages can be lifted straight into the tracker.
Nothing here has been executed — the audit was read-only. **Do not start until this plan is approved.**

**Sizing:** S ≈ ½–1 day · M ≈ 2–4 days · L ≈ 1–2 weeks. One senior engineer with AI assistance.
**Owner types:** `backend` · `frontend` · `db` · `ops` · `human` (sponsor/IT decision, no code).

**Sequencing rule:** Wave 0 is not a backlog to pick from — it is an ordered set, and **W0.1 must land
first** because everything else edits files that are currently uncommitted.

---

## Wave 0 — Stop the bleeding (all 13 P0s) · 3–4 weeks

**Gate W0:** backend and frontend `verify` both exit 0 · every exploit in `05-SECURITY-REVIEW.md`
re-run and refused · the worker runs the 13 scheduled jobs on a staging box · a notification is
provably delivered end-to-end.

### Stage W0.1 — Commit the working tree   `[ ◐ 5 Sep 2026 — W0-T02 blocked on push permission ]`
**Goal:** get 238 uncommitted paths under version control and review before anyone edits them.
**Depends on:** nothing. **Blocks:** everything.
**Tasks**
- [x] `W0-T01` (S, backend) Commit in requirement-tagged slices, smallest first: the 13 untracked
      migrations as one commit per phase-5 stage; the 32 untracked tests with the code they test;
      frontend pages by feature. Follow CLAUDE.md §1.1 — every commit names a requirement ID.
- [ ] `W0-T02` (S, ops) Push to the remote. Confirm CI runs (it will fail — that is W0.2).
      **BLOCKED 5 Sep 2026:** `git push -u origin remediation/wave-0` denied by the environment's
      permission classifier. 19 requirement-tagged commits exist locally on `remediation/wave-0`.
      Needs the user to run the push (or grant the permission); CI has not executed.
- [x] `W0-T03` (S, ops) Delete `.impeccable/live/server.json` deliberately or restore it; it is currently
      staged as deleted with no explanation.
**Exit criteria:** `git status --short` is empty · CI has executed at least once on the pushed branch.
**Finding:** [H1]

### Stage W0.2 — Green the build   `[ ☑ done 5 Sep 2026 ]`
**Goal:** `npm run verify` exits 0 in both projects.
**Depends on:** W0.1.
**Tasks**
- [x] `W0-T04` (S, backend) `modules/leave/coverage-check.service.ts:210` — build `LeaveSpanHalves` with
      explicit booleans rather than passing `boolean | undefined` under `exactOptionalPropertyTypes`.
- [x] `W0-T05` (S, backend) `modules/reports/reports-export.service.ts:155,195` — parse `kind` and
      `stage` through their zod enums at the boundary so the narrowed union survives to the service.
- [x] `W0-T06` (S, backend) `modules/reports/reports.router.ts:712` — type the `day_records.status` read
      as `DayStatus` end-to-end so `teamMonthGrid` satisfies the output schema. **RPT-01 muster.**
- [x] `W0-T07` (S, backend) `tests/stage17-supporting-reports.integration.test.ts:357` — remove the
      tautological `"active" === "active"` assertion.
- [x] `W0-T08` (M, backend) Fix SHF-08: count the applicant as absent before the application row exists
      in `evaluateLeaveCoverage`, so the coverage warning fires. **This is the guard that stops a plant
      running below minimum headcount** — fix the logic, not the test.
**Tests required:** the existing suite, plus a regression test for the SHF-08 branch.
**Exit criteria:** `cd backend && npm run verify` exit 0 · `cd frontend && npm run verify` exit 0.
**Findings:** [E2] [E3] [E13]

**EVIDENCE (5 Sep 2026):**
```
backend  : typecheck ok · lint ok · knip ok · depcruise ✔ 192 modules, 753 deps, 0 violations
           Test Files 64 passed (64) · Tests 483 passed (483) · build ok   EXIT 0
frontend : typecheck ok · lint ok · knip ok · 290 tests · build ok          EXIT 0
```
**Two diagnoses changed under evidence, and both are recorded rather than quietly adjusted:**
1. **W0-T08 / [E3] — the logic was never broken.** Instrumenting the test showed
   `evaluateLeaveCoverage` produces exactly the right warning; the assertion searched for `2026-12-14`
   while the message correctly renders `14 Dec 2026` per docs/05 §10. The assertion was corrected and
   **strengthened** to the full sentence. This is not weakening a test to pass a gate — the original
   two-fragment `.includes` check was weaker than what now stands.
2. **A new P1 surfaced: [E13].** `tests/compliance-calendar.integration.test.ts` built fixture dates in
   UTC against IST logic, so the suite passed by day and failed between 00:00 and 05:30 IST. The
   production code was correct; the test bypassed `core/dates.ts`. Fixed at the helper.

### Stage W0.3 — Make data scope structurally unavoidable   `[ ☑ done 5 Sep 2026 ]`  🔒 the big one
**Goal:** no query returns employee data outside the caller's scope, and it becomes a compile error to
forget.
**Depends on:** W0.2.
**Tasks**
- [x] `W0-T09` (M, backend) Change the repository/service signatures in `employees`, `leave`, `documents`,
      `letters`, `assets` to take a **required** `EmployeeScope` parameter. Let the compiler enumerate the
      call sites — do not hunt them by hand.
- [x] `W0-T10` (M, backend) Thread `{...context.permissionAccess, actorEmployeeId: context.user.employee_id}`
      through those routers, using the pattern `reports.router.ts:83-86` already establishes.
- [x] `W0-T11` (S, backend) `GET /employees/{ecode}`: return **404**, not 403, for out-of-scope e-codes,
      so the API is not an existence oracle.
- [x] `W0-T12` (S, backend) Scope `GET /employees/facets` — headcounts are disclosure too.
- [x] `W0-T13` (S, backend) Compute `canViewCompensation` against the **subject**: for `own` scope it is
      true only when `row.id === user.employee_id`. Fixes the Compensation tab on colleagues' profiles.
- [x] `W0-T14` (M, backend) Apply `assertEmployeesInScope` to every write that names an employee:
      `POST /leave/adjustments`, `POST /documents`, letters issue, asset assignment.
- [x] `W0-T15` (S, backend) Audit the remaining 15 unscoped modules and either scope them or record in
      code why they need none (e.g. `system`, `auth`).
**Tests required:** an **access-matrix integration test** — for each of the 12 roles × each scoped
endpoint, assert that an out-of-scope subject is refused. This test is the deliverable, not a nicety.
**Exit criteria:** the §1 exploits in `05-SECURITY-REVIEW.md` all return 404/403 · the matrix test is in CI.
**Findings:** [D1] [D2] [F3]

**EVIDENCE (5 Sep 2026) — §1 exploits re-run live against `hrms_audit_test`, same account as the audit:**

| Exploit | Audit (4 Sep) | Now |
|---|---|---|
| plain ESS reads another company's profile | `200` + DOB, personal email, mobile, home address | **`404`** |
| plain ESS lists the whole directory | `total=2`, both companies | **`total=1`**, own record only |
| plain ESS reads company-wide facets | both entities | **only own entity** |

`tests/access-matrix.integration.test.ts` — **15 cases, all green**, covering ESS→peer, ESS→directory,
ESS→facets, the 404-vs-403 oracle, compensation visibility, statutory masking, and hr_ops-scoped-to-one-
org-unit against leave balances (read AND write), the document vault (list AND upload), letters and
assets — with an hr_head control case proving scoping is not a blanket deny.
`npm run verify` → **EXIT 0, 504/504 tests** (was 483; +21).

**Three things the work changed that were not in the plan, each recorded rather than absorbed silently:**
1. **`scopeFromContext` is now the single shared constructor** (`core/rbac/employee-scope.ts`), replacing
   the private copy in `reports.router.ts`. One implementation, so no module can grow a variant.
2. **`OutOfScopeError` + one central mapping.** `assertEmployeesInScope` threw a bare `Error`, which oRPC
   surfaced as **500** — found by the new matrix test on its first run. It now throws a typed error that
   the `authed` middleware maps to **404** in exactly one place; per-handler try/catch would have been
   165 chances to forget. 404 not 403, for the same no-oracle reason as W0-T11.
3. **`tests/directory-facets` moved from `hr_ops` to `hr_head`.** An `hr_ops` user with no
   `scope_org_unit_id` now correctly resolves to zero org units and sees nothing — fail-closed, which is
   the right posture. Those cases assert facet *arithmetic*, so they need a caller who can legitimately
   see the fixtures. Scope itself is covered by the matrix test.

### Stage W0.4 — Workflow authorization and the vacant-chain floor   `[ ☑ done 5 Sep 2026 — safety floor shipped; D21 still open for the POLICY ]`
**Goal:** nobody can raise a request for someone else, and nothing approves without an approver.
**Depends on:** W0.3 (`assertEmployeesInScope`). **Needs decision:** **D21**.
**Tasks**
- [x] `W0-T16` (M, backend) `createRequest`: require `subjectEmployeeId === caller.employee_id` unless the
      caller holds a per-definition raise-on-behalf permission, scope-checked.
- [x] `W0-T17` (M, backend) **Chain floor.** If no step resolved to a real approver, route to a fallback
      (`role:hr_head`, then `super_admin`) in status `pending` — never `approved`. Write a real
      `wf.request_steps` row so the `notified_at` receipt invariant carries meaning. Emit an alert.
- [x] `W0-T18` (S, backend) Attribute skip audit rows to a system actor instead of `actor_user_id = NULL`.
- [x] `W0-T19` (S, backend) Give `workflows.{create,act,resubmit,timeline,preview,setDelegation}` real
      permission codes and seed them; keep the current-approver check as the second layer.
- [x] `W0-T20` (S, backend) Scope `GET /workflows/preview` to subjects the caller may see.
- [x] `W0-T21` (S, db) Data probe before deploying: list every existing `wf.requests` row that reached a
      terminal status with **zero** steps (query in `03-DATA-ISSUES.md` §5.3) and triage each one.
**Tests required:** all-vacant chain ⇒ `pending` + one fallback step · non-subject raising for another
employee ⇒ 403 · existing delegation/send_back/escalation tests still green.
**Exit criteria:** the §2 exploit is refused · no terminal request can exist with zero steps.
**Findings:** [B2] [E1] [E12] [I2]

**EVIDENCE (5 Sep 2026) — §2 exploit re-run live, same account and payload as the audit:**
```
POST /api/workflows/requests {"definitionCode":"resignation","subjectEmployeeId":2,...}
  was : {"requestId":1}  → wf.requests status=approved, wf.request_steps 0 rows
  now : 403 {"code":"FORBIDDEN","message":"You can only raise a request about yourself"}

control — the same user raising about THEMSELVES still works:
  {"requestId":2} → status=pending  (not approved: every step vacant, so the floor held)
```
W0-T21 data probe on the audit DB found the audit's own forged row as the only
terminal-with-zero-steps request; it was removed. The unscoped probe stays in
`03-DATA-ISSUES.md` §5.3 as the pre-go-live check against production.
`npm run verify` → **EXIT 0, 510/510** backend; frontend **EXIT 0**.

**What was decided vs. what still needs D21.** The floor — *never approve a request nobody was asked
about* — was implemented without waiting, because it is not a policy choice: docs/04 §5 authorises
"auto-skip-to-next … never a dead end" and says nothing about approving an undecided chain, and
CLAUDE.md rule 8 forbids an un-notified approval. The *fallback approver* is `core.settings`
(`wf.vacant_chain_fallback_approver`, shipped `role:hr_head`), not a value invented in code.
**Still open for the sponsor (D21):** who, if anyone, may raise a request on another employee's behalf.
Today the answer is nobody — `workflow.request.raise_on_behalf` is seeded and granted to no role, so the
documented ESS-initiated model (docs/04 §1.3, LC-06) is the only path. The LC-06 HR-initiated absconder
route needs that decision before it can be built.

**Three corrections made under evidence during the stage:**
1. **The floor's first condition was wrong and a test caught it.** Testing "did anyone approve?" also
   blocked the legitimate SLA `auto_approve` breach (Restricted Holiday: silence is consent at the
   cutoff, docs/08 §4). The right question is **"was anyone ever asked?"** — zero step rows in the
   current cycle. A notified approver who lets the window pass has been asked.
2. **`tests/stage13-workflows` contained a test asserting the defect** — *"empty chain → auto-approved"*,
   matching the Stage 1.3 plan record. It is rewritten to assert the corrected behaviour, and the change
   is recorded here and in the test's own comment rather than made silently.
3. **Scoping the chain preview by `workflow.participate` restricted nothing**, because participation is
   `all` for every role. The live re-run caught it still answering 200 for another company's employee.
   Added `scopeForPermission()` so a read is narrowed by `employee.read` — the permission that actually
   governs seeing facts about a person — regardless of which permission gates the route.

### Stage W0.5 — Bound `admin.roles`   `[ ☑ done 5 Sep 2026 ]`
**Goal:** an administrator cannot grant itself power it does not have, and cannot lock everyone out.
**Depends on:** W0.2.
**Tasks**
- [x] `W0-T22` (M, backend) Role lattice: a grantor may never grant a permission it does not hold, nor
      assign a role whose grant-set exceeds its own.
- [x] `W0-T23` (S, backend) Reject self-targeted role assign/remove.
- [x] `W0-T24` (S, backend) `withStepUp('admin.roles')` on all four RBAC mutation endpoints.
- [x] `W0-T25` (S, db) A trigger refusing any delete that would leave zero active `super_admin`
      assignments.
- [x] `W0-T26` (S, backend) Emit a high-priority notification on every `core.role_permissions` change —
      the audit row is already written; nobody is watching it.
**Tests required:** it_admin attempting each of the four escalations ⇒ 403 · last-super_admin removal ⇒
DB error.
**Exit criteria:** the §3 exploit is refused at step one.
**Finding:** [D3]

**EVIDENCE (5 Sep 2026) — §3 exploit re-run live, same account, session already elevated:**
```
step 1  grant itself employee.compensation.read  was {"changed":true}
                                                 now 403 "…because you do not hold it"
step 1b grant itself employee.statutory_ids.read was {"changed":true}   now 403
step 2  assign itself super_admin                was {"ok":true}
                                                 now 403 "You cannot change your own roles"
step 2b assign super_admin to someone ELSE       now 403 "it carries 44 permission(s) you do not hold"
step 3  read a peer's statutory IDs              was pan/aadhaar/bank in clear
                                                 now statutoryMasked=true, all null,
                                                     canViewCompensation=false
```
`tests/rbac-ceiling.integration.test.ts` — **8 cases green**, including a control proving it_admin can
still grant a permission it *does* hold (the ceiling is not a blanket deny) and that the DATABASE refuses
to be left with no active super_admin. `npm run verify` → **EXIT 0, 518/518**.

**The rule.** docs/08 §1 says roles are *additive*, not ranked, so there is no hierarchy to compare
against. "Grant ≤ own level" is therefore implemented as a comparison of permission SETS: **you cannot
hand out what you do not hold.** Revocation is included — letting IT strip `payroll.reports` from
payroll_admin is not escalation, but it is unilateral control over a domain docs/08 puts outside IT's
authority, and it is how a self-inflicted outage starts on a payroll day.

**Three adjustments the work forced, each recorded:**
1. **Step-up on writes only.** Applying it to the matrix READ broke docs/08 §3's it_admin "Users & Roles"
   landing page (`role-access` caught it) and would train people to re-enter their password more often,
   not less. Reads keep `withPermission`; grant/revoke/assign/remove get `withStepUp`.
2. **The DB guard needed transition tables.** The first version fired on every `is_active` update and
   refused ordinary exit-day deactivation in any database with no super_admin — a guard causing the
   outage it prevents. It now uses `REFERENCING OLD TABLE`, so it only looks when the statement actually
   touched a super_admin. Proven both ways: normal deactivation succeeds, both lockout routes refuse.
3. **The integration DB needed a permanent super_admin anchor** (`tests/global-setup.ts`). Suites that
   created a temporary super_admin were deleting it in cleanup and being correctly refused. Production
   always has one; the test environment now models that invariant instead of contradicting it.

### Stage W0.6 — Turn the system on   `[ ☐ ]`
**Goal:** the things that are built actually run in production.
**Depends on:** W0.2. **Needs decision:** **D17** (SMTP).
**Tasks**
- [ ] `W0-T27` (S, ops) `ecosystem.config.cjs`: enable `hrms-worker` pointing at **`dist/jobs/worker.js`**
      (not `dist/worker.js`), `instances: 1`. Decide whether the scheduler is a separate app or the
      worker is the cron leader — there is no `dist/scheduler.js`.
- [ ] `W0-T28` (S, backend) Add `KPI_SNAPSHOT_QUEUE` and `HELPDESK_ESCALATION_QUEUE` to the `createQueue`
      list; then **actually start the worker** and confirm all 13 jobs register.
- [ ] `W0-T29` (M, backend) Add a `notification-drain` queue (every 1–2 min) calling `processQueue`.
      Restructure it to claim in one short transaction, then send and mark **per message**, so a late
      failure cannot roll back earlier `markSent` calls.
- [ ] `W0-T30` (M, backend) Implement `SmtpTransport` behind `NotificationTransport`; select by env;
      keep `devLogTransport` for development. Add `SMTP_*` to the env schema.
- [ ] `W0-T31` (S, ops) Alert on `wf.notifications.status = 'dead'` and on queue depth.
- [ ] `W0-T32` (S, backend) Fix the two UTC/IST cron bugs: week close and roster nag.
- [ ] `W0-T33` (S, backend) Startup assertion that the expected pg-boss schedules exist.
**Tests required:** integration test — enqueue → drain → `status='sent'`; a worker smoke test asserting
all 13 queues register.
**Exit criteria:** on staging, a real email arrives from an approval and from the 07:00 boarding/exit job.
**Findings:** [A2] [H2] [E8] [E9] [E10]

### Stage W0.7 — Guard the mock connector   `[ ☐ ]`
**Goal:** the system cannot invent attendance.
**Depends on:** W0.2.
**Tasks**
- [ ] `W0-T34` (S, backend) `connectorFor()` throws when `NODE_ENV === 'production'` unless an explicit
      real connector is configured. Add `ATT_CONNECTOR` to the validated env schema.
- [ ] `W0-T35` (S, ops) Document loudly, in the deploy runbook, that attendance is synthetic until D15.
**Tests required:** `connectorFor()` under `NODE_ENV=production` with no real connector ⇒ throws.
**Exit criteria:** it is impossible to deploy the mock by accident.
**Finding:** [A1]

### Stage W0.8 — Baseline HTTP hardening   `[ ☐ ]`
**Goal:** the API stops being trivially abusable.
**Depends on:** W0.2. **Needs decision:** **D22** for the CORS origin.
**Tasks**
- [ ] `W0-T36` (S, backend) `helmet` with an explicit CSP; `app.disable('x-powered-by')`.
- [ ] `W0-T37` (M, backend) Rate limiting: IP + account buckets on `/auth/*`, a global limiter on
      `/api/*`, strict limits on anonymous IRD intake. `app.set('trust proxy', …)` so `req.ip` is real.
- [ ] `W0-T38` (S, backend) Replace the `whistleRateLimitOk` stub with the real limiter; **delete the
      vacuous test** that asserts the stub's return value.
- [ ] `W0-T39` (S, backend) A terminal error middleware: log with a traceId, return the JSON envelope,
      never a stack.
- [ ] `W0-T40` (S, backend) Explicit CORS allowlist from validated env.
- [ ] `W0-T41` (S, backend) Raise the JSON body limit deliberately for upload routes so DOC-02, CORE-13
      and CORE-09 work with real files; cap per document type in the validator.
- [ ] `W0-T42` (S, backend) Guard the default JWT secret behind `NODE_ENV !== 'production'`.
**Tests required:** a supertest asserting the security headers are present; a rate-limit test.
**Exit criteria:** 30 rapid logins ⇒ 429 · a 413 returns JSON, not HTML · `curl -i` shows CSP + HSTS.
**Findings:** [D4] [D5] [D6] [D7] [D8] [D10] [D14] [B4] [G4]

---

## Wave 1 — Production hardening (the 35 P1s) · 5–7 weeks

**Gate W1:** CI runs the full integration suite against a real Postgres · a restore drill has been
performed and timed · monitoring shows a job failing within 5 minutes · scope, upload and access-log
controls all have tests.

### Stage W1.1 — Make CI real   `[ ☐ ]`
- [ ] `W1-T01` (M, ops) `services: postgres:16` in `ci.yml`; run `migrate` + the three seeds; export
      `TEST_DATABASE_URL`. **The backend CI job has never executed a single integration test.**
- [ ] `W1-T02` (S, ops) Add `npm audit --omit=dev` as a blocking step; fix the high `brace-expansion`
      advisory and the `exceljs`→`uuid` chain.
- [ ] `W1-T03` (M, backend) Add `@vitest/coverage-v8` with an enforced 80% floor; put coverage in
      `verify`. The 80%/100%-branch targets are currently unmeasurable.
- [ ] `W1-T04` (S, ops) Pin Node in `.nvmrc`, `engines`, `ci.yml` and the deploy script. Resolve 22 / 24 / 26.
- [ ] `W1-T05` (M, ops) A migration test: fresh DB → `up` → `up` (idempotent) → `down` → `up`.
**Findings:** [G1] [G3] [D16] [H7] · **Sizing:** M

### Stage W1.2 — Database integrity   `[ ☐ ]`
- [ ] `W1-T06` (M, db) `btree_gist` + `EXCLUDE` on every effective-dated table:
      `cmp.registrations`, `pay.budgets`, `att.roster_publications`. Do it while they are nearly empty.
- [ ] `W1-T07` (L, db+backend) **Make `att.employee_shifts` effective-dated** — surrogate PK,
      `effective_from/to`, `EXCLUDE`, resolve by `work_date`. Backfill existing rows from
      `created_at`. This is the one that silently rewrites history.
- [ ] `W1-T08` (M, db) Backfill `att.swipe_events.door_code`, then `SET NOT NULL` so the exactly-once
      unique key works. Report duplicates first.
- [ ] `W1-T09` (S, db) Unique index on `core.user_roles (user_id, role_id, COALESCE(scope_org_unit_id,0))`.
- [ ] `W1-T10` (S, db) `VALIDATE CONSTRAINT` the two `NOT VALID` CHECKs after reporting violators.
- [ ] `W1-T11` (S, db) CHECKs on `nominee_share_pct` (0–100 and per-employee sum = 100),
      `ast.maintenance.cost >= 0`, `att.devices.expected_hourly_swipes >= 0`.
- [ ] `W1-T12` (S, db) Enum/CHECK on `att.swipe_events.direction` and the other unconstrained status text.
**Findings:** [C1] [C2] [C3] [C8] [C7] [C10] [C11] · **Sizing:** L overall

### Stage W1.3 — Partitions and the access log   `[ ☐ ]`
- [ ] `W1-T13` (S, backend) Call `sec.ensure_access_partition` on the write path; add a monthly job
      pre-creating three months ahead for **both** partitioned tables. **Dated failure: 1 Nov 2026.**
- [ ] `W1-T14` (M, backend) Wire `recordAccess` into every unmask path — `getEmployeeByEcode`,
      `getOwnProfile`, exports, future payroll reads — and **implement its documented "never throws"
      contract** with a try/catch that logs and swallows.
- [ ] `W1-T15` (S, frontend) Verify `GET /security/my/access-history` now returns rows.
**Findings:** [C4] [C5] · **Sizing:** M

### Stage W1.4 — Uploads, documents and letters   `[ ☐ ]`
- [ ] `W1-T16` (M, backend) Per-`doc.types` MIME allowlist, magic-byte sniffing, size cap, filename
      sanitisation. Purge the `pan.html` test artifact if it reached any real environment.
- [ ] `W1-T17` (M, backend) A scope-checked document **download** endpoint with
      `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff`. DOC-02 is upload-only today.
- [ ] `W1-T18` (S, backend) Return binary content base64-encoded (or stream it) instead of
      `toString('utf8')`, which corrupts every PDF in policies and letters.
- [ ] `W1-T19` (L, ops+backend) Implement the S3/SeaweedFS adapter behind `StorageAdapter`. **Needs D18.**
**Findings:** [D9] [E6] [E5] [A3] · **Sizing:** L

### Stage W1.5 — Employee-master write path   `[ ☐ ]`
- [ ] `W1-T20` (L, backend) Build the CORE-01/CORE-08 write API: field validation (PAN/Aadhaar/IFSC
      formats, duplicate UAN/ESI/e-code), `assertEmployeesInScope`, and field-by-field `writeAudit`
      old→new. Enforce `employee.write`.
- [ ] `W1-T21` (M, backend) Build the `admin.users` API (create, deactivate, **unlock** — there is
      currently no way to release a locked account through the product).
- [ ] `W1-T22` (M, backend) Enforce `leave.approve` / `ar.approve` / `od.approve` in the approval path,
      or remove them from the seed. Today they are switches that do nothing.
- [ ] `W1-T23` (M, backend+ops) CLI entrypoints for the EMS/greytHR import with a written exception
      report and a dry-run mode. **Needs D16.**
- [ ] `W1-T24` (S, frontend) The employee-edit UI on the existing profile shell.
**Findings:** [E4] [B5] [I1] · **Sizing:** L

### Stage W1.6 — Ops foundations   `[ ☐ ]`
- [ ] `W1-T25` (S, backend) Graceful shutdown in both `src/index.ts` and `src/jobs/worker.ts` —
      SIGTERM → stop accepting → drain → `boss.stop()` + `db.destroy()`.
- [ ] `W1-T26` (S, backend) Split liveness from readiness; readiness runs `SELECT 1` with a timeout.
- [ ] `W1-T27` (M, backend) Request logging with a traceId on every line (pino-http); propagate into job
      logs.
- [ ] `W1-T28` (M, ops) Error tracking (GlitchTip, per docs/14 §10 item 17), browser + node, releases tagged.
- [ ] `W1-T29` (L, ops) **Backups:** nightly off-box `pg_dump` + WAL archiving for PITR, a written restore
      runbook, and a **timed restore drill**. NFR-05 requires RPO ≤ 24 h (≤ 15 min for payroll months)
      and RTO ≤ 4 h. **Needs D19.**
- [ ] `W1-T30` (M, ops) Metrics + alerting, business metrics first per docs/14 §10 item 18: queue depth,
      device gaps, jobs-not-run, notification dead-letters.
- [ ] `W1-T31` (S, backend) Retry limits, backoff and a dead-letter policy on every pg-boss job.
- [ ] `W1-T32` (M, ops) PgBouncer ≥ 1.21 with `max_prepared_statements > 0`; document pool sizing.
- [ ] `W1-T33` (S, backend) Extend the env schema to every variable the system reads.
**Findings:** [H3] [H4] [H5] [H6] [H8] [H9] [D15] · **Sizing:** L

### Stage W1.7 — Test net   `[ ☐ ]`
- [ ] `W1-T34` (M, frontend) A page-level render + axe harness for all 47 pages in both themes. **This
      unblocks re-grading `04-UI-UX-ISSUES.md` honestly.**
- [ ] `W1-T35` (M, frontend+backend) Playwright smoke, 10–20 journeys per docs/14 §10 item 12.
- [ ] `W1-T36` (M, backend) Property tests with `fast-check` on the money invariants.
- [ ] `W1-T37` (S, backend) Golden fixtures G3a/G3b/G3c (the ESIC boundary), G4, G5, G6, G9 — G3 in
      particular is pure arithmetic and testable today.
- [ ] `W1-T38` (M, backend) A night-shift end-to-end test: cross-midnight swipes ⇒ correct day assignment.
- [ ] `W1-T39` (M, backend) A load test at 3k employees / 20k swipes per day against NFR-01 and NFR-02.
**Findings:** [F1] [F6] [G2] [G5] [G6] · **Sizing:** L

---

## Wave 2 — Top-grade polish (28 P2s + 7 P3s) · 4–6 weeks

| Stage | Tasks | Size | Owner | Findings |
|---|---|---|---|---|
| **W2.1 Frontend performance & UX** | `React.lazy` per route + `manualChunks`; `AbortController` + timeout in `apiFetch`; global session-expiry handling; form autosave; double-submit protection; pagination on large lists; audit `overflow-x` coverage; `2xl` layouts for large monitors | M | frontend | [F2] [F5] 7.4 7.5 |
| **W2.2 Permission-driven nav** | Replace all 20 `hasRole` calls with permission checks; give `compliance_officer` and `dpo` real shells | M | frontend | [F4] [I4] |
| **W2.3 API contract completion** | Permission codes on the remaining `authed` procedures; split `GET /settings` into ESS-allowlist vs admin; stamp the permission into the OpenAPI description; generate the frontend client from OpenAPI in CI | M | backend | [B1] [B3] [B6] [A4] |
| **W2.4 RBAC semantics** | Give `readonly` real meaning or delete it; add `employee.compensation.aggregate` for ceo_cell (**needs D20**); enforce the "aggregates only" rule | M | backend | [D11] [D12] |
| **W2.5 Auth hardening** | Refresh-token rotation with reuse detection; pin `jwtVerify` algorithms; move the access token out of `sessionStorage` once CSP is in place | M | backend+frontend | [D13] [D17] [D18] |
| **W2.6 Money boundary** | Replace `numericToPaise`'s float multiply with exact string parsing; route it through `fromRupees`; **do this before payroll reuses the helper** | S | backend | [E11] |
| **W2.7 Whistleblower handling** | A list/handle surface enforcing `ird.whistle.intake`; reports currently have no route to a handler | S | backend+frontend | [E7] |
| **W2.8 Mutation testing** | Nightly Stryker scoped to money and authorization code, with a score threshold — the test-of-the-tests docs/14 §10 item 15 requires | M | backend | [G2] |
| **W2.9 File-size refactor** | Split the 36 files over 400 lines, starting with `SupportingReports.tsx` (802, seven pages in one file) and `reports.service.ts` (999) | L | both | [A5] |
| **W2.10 Documentation** | Regenerate docs/03 from the live schema (~45 undocumented tables, ~20 documented-but-absent); amend docs/08 for 12 roles; update plans/README counts; resolve the 9 contradictions in `06-SPEC-DRIFT.md` §3 | M | human+backend | [C9] [I4] [I5] [I6] |
| **W2.11 Module API narrowing** | Export only what crosses a boundary; make knip able to see dead code behind `index.ts` — this is what hid [C5] and [A2] behind a green gate | M | backend | [A6] |
| **W2.12 Feature flags** | DB-backed flags with a kill switch on every new money path, per docs/14 §10 item 19 | M | backend | [H8] |

---

## Decisions required from the sponsor

Work is blocked or under-specified until these are answered. Numbered continuing docs/15 §9.3.

| # | Decision | Blocks | Consequence of delay |
|---|---|---|---|
| **D8** | POSH Internal Committee appointments *(already open in plans/phase-5)* | POSH case routing | `ird.ic_members` stays empty; cases cannot be assigned |
| **D15** | Kent access method (push/ADMS vs pull) + credentials | W0.7, Gate G0, all of attendance | Attendance data remains synthetic; the highest-risk integration stays unproven. Open since July. |
| **D16** | Real EMS + greytHR snapshots | W1.5 T23, Gate G0 | The 1,066-employee master cannot be loaded; the import pipeline stays test-only |
| **D17** | SMTP relay host + credentials | W0.6 | Nothing can be notified — PP-14 unresolved |
| **D18** | Object-storage host for SeaweedFS (or accept Garage) | W1.4 T19 | Payslips, letters and identity documents stay on unbacked local disk |
| **D19** | Backup destination + owner of the quarterly restore drill | W1.6 T29 | NFR-05 cannot be met by code alone |
| **D20** | Does `ceo_cell` see individual compensation, or aggregates only? | W2.4 | docs/08 and the seed disagree; one must change before `pay.*` exists |
| **D21** | Who may raise a workflow request on another's behalf, and what happens when a whole chain is vacant? | W0.4 | The fix would otherwise be a guess at policy |
| **D22** | Production PostgreSQL (16 vs 17) and Node (24) versions; CORS origin | W1.1, W0.8 | Dev runs PG 14 / Node 26; neither matches the spec |
| **D23** | Deploy-freeze policy for payroll days, and who signs off a production deploy | Wave 1 exit | docs/14 §11 assumes it; nothing records it |

---

## What this plan deliberately does not do

- **It does not start Phase 2 payroll.** Every authorization defect in Wave 0 becomes a *money* defect the
  moment `pay.*` exists. Payroll begins after Gate W1, and after the G5a stages that plans/phase-5 already
  marks as blocking (5.1–5.4).
- **It does not re-architect anything.** The module boundaries, the money module, the audit chain, the
  settings layer, the design system and the migration discipline are all sound. The work is connecting
  controls that were built and left unwired, not replacing them.
- **It does not fix findings by weakening tests or rules.** Where a test fails (SHF-08) the logic is fixed;
  where a rule is inconvenient (`base` tier, vacant chains) the doc is amended deliberately by decision,
  not silently by code.
