# 00 — Executive Verdict

**Audit date:** 4 September 2026 · **Auditor:** principal-engineer production-readiness pass
**Subject:** Rashmi Group HRMS, working tree on `main` (109 modified + 129 untracked paths)
**Evidence base:** all gates executed, migrations run from scratch on a throwaway database, and a live
server exercised with real HTTP requests. Detail in [`01-FINDINGS.md`](01-FINDINGS.md).

---

## Verdict: **NO-GO for production**

Not a close call, and not primarily because payroll is unbuilt. Three things decide it:

1. **The working tree does not compile.** `npm run typecheck`, `npm run lint` and `npm run build` all fail
   in `backend/`, and one integration test fails. No artifact can be produced today.
2. **Authorization is not enforced on the data.** The scope engine is designed, seeded and computed on
   every request — and then discarded by 20 of 24 modules. I logged in as an ordinary employee and read a
   different company's employee record, the whole directory, and every policy setting. I raised a
   resignation against another employee, and it **auto-approved with no approver and no notification**.
   I escalated an `it_admin` account to `super_admin` in one API call and read another employee's
   unmasked PAN, Aadhaar and bank account.
3. **Nothing runs in production even if it were deployed.** The PM2 config has the worker commented out,
   so no Kent sync, no OT lapse, no leave accrual, no daily emails. The notification queue has no drain
   and no SMTP transport, so the project's single most-cited requirement — *"the approver was never
   notified"* — is reproduced exactly.

None of this is a design failure. The architecture is sound and in several places genuinely excellent
(see [`02-WHATS-WORKING.md`](02-WHATS-WORKING.md)). The failure is that a well-designed set of controls
was built and then **not wired to the endpoints they were built for**. That is good news for the
remediation estimate: most of Wave 0 is connection work, not invention.

---

## Top 10 risks, worst first

| # | Risk | Evidence | Finding |
|---|---|---|---|
| 1 | **Any employee can read any employee's personal data across all 14 entities** — DOB, personal email, mobile, home address, emergency contact | Live: plain ESS user read `BCO000001`'s full profile and the whole directory | [D1] [D2] |
| 2 | **A forged resignation auto-approves itself** when the chain's approvers are vacant — zero steps, zero notifications | Live: `wf.requests` id=1 `status=approved`, `wf.request_steps` 0 rows | [B2] [E1] |
| 3 | **`it_admin` can self-escalate to `super_admin`** and read unmasked PAN/Aadhaar/UAN/bank — the exact separation of duties docs/08 calls a hard rule | Live: 3 API calls | [D3] |
| 4 | **No background jobs run in production** — worker commented out of `ecosystem.config.cjs`; attendance, OT lapse and leave accrual silently stop | `ecosystem.config.cjs` | [H2] |
| 5 | **No notification is ever delivered** — no SMTP transport, queue never drained. PP-14 recurs by construction | `processQueue` called only by tests | [A2] |
| 6 | **The build is red** — 4 TS errors + 1 lint error + 1 failing test; one error is on the muster report contract | `npm run verify` exit 2 | [E2] [E3] |
| 7 | **~40% of the system is uncommitted** — 13 migrations and 32 tests exist only on one disk, unreviewed, unbacked | `git status` | [H1] |
| 8 | **The Kent connector is a mock with no production guard** — it would fabricate attendance into an append-only table that feeds pay | `kent-sync.job.ts:19` | [A1] |
| 9 | **No rate limiting, no security headers** — 30 logins/second accepted; account lockout is an unauthenticated DoS on all 1,066 employees | Live probe; `app.ts` is 56 lines | [D4] [D5] [D6] |
| 10 | **No backups, no PITR, no restore drill, no monitoring** for a system carrying an 8-year statutory retention obligation | `scripts/` holds 2 files | [H5] [H6] |

**Two dated time bombs**, both worth fixing before they are forgotten: `sec.access_events` has no
partition after 31 Oct 2026 [C4], and `att.employee_shifts` has no effective dating, so any shift change
silently rewrites historical attendance recomputes [C2].

---

## Production-readiness scorecard

| Dim | Area | Score | One-line justification |
|---|---|:--:|---|
| **A** | Architecture & boundaries | **7/10** | Modular monolith is clean and machine-enforced (depcruise: 0 violations, 192 modules); loses points because three external adapters — Kent, storage, email — are mocks with no production path. |
| **B** | API contract (CORE-10) | **6/10** | All 219 procedures carry zod input *and* output and a route — genuinely 100% — but 41 run with no permission code and one accepts an unauthorized subject id. |
| **C** | Database & data integrity | **6/10** | Migrations up/down/idempotent clean, append-only triggers and the hash chain are excellent; zero temporal EXCLUDE constraints, a defeated swipe unique key, and no effective dating on shifts. |
| **D** | Security & identity | **3/10** | Strong primitives (MFA, step-up, session revocation, masking, audit chain) sitting above three proven authorization bypasses, no rate limiting and no security headers. |
| **E** | Business-logic correctness | **5/10** | Settings-driven policy and the money module are exemplary; the workflow engine can approve without an approver, and the build does not compile. |
| **F** | Frontend, UX, accessibility | **7/10** | The design firewall is perfect (0 hardcoded colours, no second library) and the "never fake data" pattern is real; 44 of 47 pages are untested and no page has an a11y test. |
| **G** | Tests & quality | **5/10** | 773 tests with real-Postgres integration and hand-computed money fixtures — but CI cannot run them, coverage is unmeasured, and there is no E2E, golden-master or mutation testing. |
| **H** | Ops & production readiness | **2/10** | No worker in the topology, no graceful shutdown, no readiness probe, no monitoring, no backups, no feature flags, Node version drift across three environments. |
| **I** | Spec ↔ code ↔ plan drift | **6/10** | The plans are unusually honest (Gate G0 correctly shown unpassed); two ☑ stages have unmet exit criteria and ~45 live tables are undocumented in docs/03. |
| | **Weighted overall** | **5.0/10** | A strong skeleton with its safety wiring disconnected. |

---

## What it takes to reach top grade

Sizing assumes one senior engineer with AI assistance, at the pace this repository has demonstrated.
Detail and sequencing in [`07-REMEDIATION-PLAN.md`](07-REMEDIATION-PLAN.md).

| Wave | Content | Effort |
|---|---|---|
| **Wave 0 — stop the bleeding** | 13 P0s: commit the tree, green the build, thread the scope engine through every module, fix workflow authorization and the vacant-chain floor, bound `admin.roles`, wire the worker and the notification drain, guard the mock connector, add helmet + rate limiting | **3–4 weeks** |
| **Wave 1 — production hardening** | 35 P1s: temporal constraints, effective-dated shifts, swipe uniqueness, access-log wiring, upload validation, error middleware, CI with Postgres + coverage, backups/PITR + restore drill, monitoring and error tracking, graceful shutdown, readiness probes, Node pinning | **5–7 weeks** |
| **Wave 2 — top-grade polish** | 28 P2s + 7 P3s: E2E smoke, page-level a11y, code splitting, property tests, golden-master + mutation testing, file-size refactors, doc regeneration, `readonly` scope semantics | **4–6 weeks** |
| **Then** | Phase 2 payroll can begin — it must not begin before Wave 0 and the G5a stages the plans already mark as blocking | — |

**≈ 12–17 weeks to a defensible production system**, of which roughly a quarter is connecting controls
that already exist. Payroll (Phase 2, 8–10 weeks) sits after that, not in parallel: every one of the
authorization defects above becomes a money defect the moment `pay.*` exists.

---

## Decisions needed from the sponsor

These block work and are not the engineer's to make. Numbered continuing the docs/15 §9.3 series.

| # | Decision | Why it blocks |
|---|---|---|
| **D8** | POSH Internal Committee appointments | `ird.ic_members` is empty; POSH cases cannot be routed. Already flagged in plans/phase-5. |
| **D15** | Kent access method — push (ADMS/webhook) or pull, and the credentials | The highest-risk integration is still a mock. P0-T01/T40 have been open since July. |
| **D16** | Real EMS + greytHR snapshots | The 1,066-employee import pipeline is built and proven only on fixtures; Gate G0 cannot close without them. |
| **D17** | SMTP relay host and credentials | Nothing can be notified until this exists. |
| **D18** | Object-storage host for SeaweedFS (or accept Garage) | Payslips, letters and identity documents currently land on unbacked local disk. |
| **D19** | Backup destination + who owns the quarterly restore drill | NFR-05 cannot be satisfied by code alone. |
| **D20** | Does `ceo_cell` see individual compensation, or aggregates only? | docs/08 says aggregates; the seed grants full read. One of the two must change. |
| **D21** | Who may raise a workflow request on another employee's behalf, and what happens when a whole chain is vacant? | Needed to specify the fix for [B2]/[E1] rather than guess it. |
| **D22** | Production Postgres and Node versions (PG 16 vs 17; Node 24) | Dev currently runs PG 14 and Node 26; neither matches the spec. |
