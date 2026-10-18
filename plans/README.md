# HRMS Execution Plans

**Latest HR action audit, 16 Oct 2026:** [pack23](sow-completion/23-HR-ACTIONS-SAFETY-REVIEW.md) verifies attendance overrides, actual Excel exports, onboarding durability, IT tasks, absence/letters and HR dashboard access.21 native observations,10 controls and a separate committed-orphan reproduction show critical gaps remain. No application/schema changes or gate advancement.

**Latest other-module audit, 16 Oct 2026:** [pack22](sow-completion/22-OTHER-MODULE-BUG-AUDIT.md) confirms seven additional specific bug groups and three residual security/integrity issues, with20 native observations and four passing controls. Survey/helpdesk screen contracts, company audience, answer validation and ticket history remain open. No application/schema changes or gate advancement.

**Latest SOW regression review, 16 Oct 2026:** [pack21](sow-completion/21-SOW-REGRESSION-AND-HR-HOLD-REVIEW.md) implements the sponsor's HR hold decision, fixes a reproduced approval deadlock and invalid-chain bypass risk, and rechecks schema, actual API contracts and all176 SOW scope rows. Backend498 tests/build pass but coverage remains red; frontend246 tests/full verify pass. Significant cross-domain issues remain; no gate advances.

**Latest approval/attendance repair, 15 Oct 2026:** [pack20 — manager flow, database connections and remaining work](sow-completion/20-MANAGER-APPROVAL-AND-ATTENDANCE-REVIEW.md) records exact request links, scoped authority, validated resubmission, protected final effects and attendance/leave presentation. Local browser and native database evidence are linked. No new database fields or release gate; global backend coverage and the listed policy/integration work remain open.

This folder is the **live execution tracker** for the Rashmi HRMS build. The specs live in `docs/` (what to build and why); these files track **in what order and what's done**.

**Latest backend work, 14 Oct 2026:** [current repair scope and progress](sow-completion/19-BACKEND-REPAIR-SCOPE-AND-PROGRESS.md) supersedes earlier lint/test counts below. Backend lint is now clean; scoped workflow/directory tests, shared locked e-code allocation, JSON boundaries and local HTTP transport are repaired. Full verification remains blocked by the unchanged coverage floor. Claims and budgets are deferred; other remaining HR work and all 176 original SOW rows remain tracked. No release gate is advanced.

**Current field-purpose audit, 14 Oct 2026:** [all 1,379 business fields and remaining schema issues](sow-completion/18-FIELD-PURPOSE-AND-SCHEMA-AUDIT.md). All observed fields have migration/type declaration evidence; duplicate bill flags, raw invitation token storage, claim-state drift, financial/relational guards and missing historical runtime context remain open. The audit-time 597 lint errors are resolved by the latest increment above. This is a supplement to the 176-row SOW tracker, not a completion or zero-slop certificate.

**Current repair and SOW reconciliation, 14 Oct 2026:** [every SOW point and linked defects](../outputs/remediation-2026-10-14/SOW-ISSUES-AND-REMAINING.md) retains all 176 original rows and maps 46 reviewed findings. [Repair evidence](../outputs/remediation-2026-10-14/progress.json) separates tested changes from remaining integration, policy and acceptance work. Matching typed column names covers all 132 local business relations; 49-migration PostgreSQL16 replay and a disposable existing-data upgrade now pass with no column differences. Phase 2 and 3 completion labels are under revalidation; no phase gate is certified by this repair pass.

**Fresh validation, 13 Oct 2026:** [schema/migration/code review](../outputs/code-review-2026-10-13/REVIEW.md) records 38 actionable findings. Backend verify fails lint; separately, tests/coverage and knip also fail. Frontend verify passes its existing 233 tests, but new financial/lifecycle flows still have API, data and transaction defects. Fresh migration up fails on a disposable PostgreSQL17 database at missing claims.budget_id; exact target16 rehearsal is pending. Phase2/3 completion labels and Gate G3 checks must be reconciled against the review and dated signed acceptance evidence before being relied upon; this review advances no gate.

**Remaining backend schema, 10 Oct 2026:** [complete schema plan](sow-completion/13-BACKEND-SCHEMA-PLAN.md), [field/table catalog](sow-completion/14-BACKEND-TABLE-CATALOG.md), [46 proposed models and 44 amendments](sow-completion/15-BACKEND-SCHEMA-CHANGES.md), and [latest checkout/verification limits](sow-completion/16-CURRENT-CHECKOUT-ADDENDUM.md). All 176 scored SOW points, 119 requirements and 60 build tasks have a schema or explicit decision boundary. SQL drafts are guarded and unapplied; Phase0 Stage0.2 remains in progress.

| Phase file | Scope | Duration | Gate |
|---|---|---|---|
| [phase-0-foundations.md](phase-0-foundations.md) | Repo, tooling, auth/RBAC, employee master, de-risk spikes | 3 wk | G0 |
| [phase-1-attendance-leave-workflows.md](phase-1-attendance-leave-workflows.md) | Biometric ingestion, attendance, leave, approvals, core reports, ESS | 6–8 wk | G1 |
| [phase-2-payroll-statutory.md](phase-2-payroll-statutory.md) | Full India payroll engine, statutory outputs, loans, claims, parallel run | 8–10 wk | G2 |
| [phase-3-lifecycle-assets-executive.md](phase-3-lifecycle-assets-executive.md) | Onboarding, separation/F&F, transfers, assets, helpdesk, engagement, CEO dashboard | 5–6 wk | G3 |
| [phase-3.5-travel-expense.md](phase-3.5-travel-expense.md) | T&E module (M13) — absorb & supersede Yatra Avedan | 4–6 wk | G3.5 |
| [phase-4-ats-absorption.md](phase-4-ats-absorption.md) | ATS absorption, contract workers, PWA rollout | scoped later | — |

## How these plans work

- **Phases run in order.** A phase does not start until the previous phase's **Gate** is signed off (sponsor + named UAT users). Gates are listed at the bottom of each file.
- **Stages** are the ordered chunks inside a phase — each stage is roughly a PR-train / 2–5 working days of work with its own exit criteria. A stage isn't "done" until every exit criterion passes.
- **Checkboxes are the state.** Tick tasks as they merge; update the stage status marker. Commit the plan file change *in the same PR* that completes the work.
- Stages within a phase may overlap where dependencies allow (each stage lists `Depends on`), but exit criteria are never waived.

## Stage template

```
## Stage N.M — <name>   `[ ☐ not started | ◐ in progress | ☑ done ]`
**Goal:** one sentence.
**Depends on:** stage refs.
**Tasks:** - [ ] checkbox list, tagged with plan task ID (P1-T05) + requirement IDs (ATT-03)
**Modules/files:** indicative monorepo paths
**Tests required:** per docs/14 §10 program
**Exit criteria:** verifiable checks
```

## Definition of done (every task, every stage — from docs/14)

1. **Traceability:** the PR title cites a requirement ID (`feat: ATT-08 OT 48h lapse job`). No orphan features.
2. **CI gates all green (blocking):** typecheck (max-strict) → eslint (type-aware) → knip → dependency-cruiser (module boundaries) → unit/property tests → integration tests (real Postgres) → golden-master payroll diff (Phase 2+) → Playwright smoke.
   *Status 1 Sep 2026:* backend `verify` runs typecheck · lint · knip · dependency-cruiser · **162 tests** · build. Frontend `verify` runs typecheck · lint · knip · **156 tests (Vitest + Testing Library + axe, 82% coverage)** · build. **Playwright E2E smoke is still the one missing gate.**
3. **Tests written per the doc 14 §10 program** — statutory logic is test-FIRST with hand-computed expected values; 80% coverage floor, payroll-core 100% branch.
4. **No hardcoded policy values** — every policy number reads from `core.settings` (docs/04 §8).
5. **Design firewall respected** — Warm Editorial only (docs/05 §0.1); accessibility bar (docs/05 §7) is part of done.
6. **Human review is mandatory** on any diff touching `payroll-core/` or statutory seed data.
7. **Money paths:** golden/property tests updated; shadow-run comparison where logic changed (Phase 2+).

## Key spec references

**Complete SOW execution handoff, 09 Oct 2026:** [start here](sow-completion/00-START-HERE.md) links the domain plans, all 176 exact-wording SOW points, existing code inventory, database relationships, transaction/state rules, screen contracts, acceptance checks and unresolved decisions. [Portable context bundle](../outputs/sow-review-2026-10-09/HRMS-SOW-Execution-Context.zip) includes the plan pack, original specifications/trackers and both SOW workbooks. This is completion planning, not new feature implementation or gate sign-off. Revalidate source fingerprints before execution; a full checkout and sanctioned external source contracts remain required.

**SOW checklist review, 09 Oct 2026:** [point-by-point workbook](../outputs/sow-review-2026-10-09/SOW-Completion-Review.xlsx) reconciles all 176 scored items in the supplied Protiviti SOW against the current repository. Assessment: 12 implemented capabilities, 43 partial, 86 pending, 29 manual/service duties requiring external evidence, and 6 scope decisions. Historical vendor/RML percentages are retained separately. “Implemented” means the reviewed capability exists in code, not production acceptance. Backend and frontend TypeScript checks passed; full verify, DB integration tests and live UAT were not run. No stage or phase gate was advanced.

**Code versus plan follow-up:** every SOW row now includes an explicit code verdict; the workbook's **Code vs Plan** tab records nine reconciliation findings. Corrected the stale settings-write note, credited the existing BU dashboard as partial, and refreshed the Phase 3 route summary. Existing asset/helpdesk/engagement APIs are credited without treating pending UI, authorization, integration or acceptance work as complete. The BU dashboard handler currently does not apply the caller's permission scope; that remains an open gap. Counts and stage gates are unchanged.

**Expanded actual-code audit, 09 Oct 2026:** [37 source-backed gaps and repairs](sow-completion/10-CODE-AUDIT-AND-GAPS.md), [119 PRD requirements and 60 numbered build tasks](sow-completion/11-REQUIREMENT-TO-CODE.md), and [screen/API/database/transaction connections](sow-completion/12-TRANSACTION-AND-CONNECTION-MAP.md) extend the initial checklist. The source index covers 338 backend/frontend files and four root deployment/CI files. Fresh frontend full verify passed 233 tests. Backend static checks and separate build passed; full verify failed coverage (lines/statements 29.98%, functions 19.17%), with 164 DB tests skipped. The preceding workbook paragraph describes the earlier checklist pass, not these later checks. No fresh business-database inspection or gate sign-off was performed. An implemented capability in that baseline still requires its linked repairs and acceptance evidence.

**Read-only database audit, 07 Oct 2026:** [dated evidence and repair order](../docs/recon/database-audit-2026-10-07.md). At that inspection: shared-database test contamination, unrestricted test cleanup, future device watermarks, missing migration sources, deployed audit hash-scope drift and merge-conflict failures. **Fresh source reconciliation, 09 Oct:** dedicated test-DB setup and fixture-scoped cleanup now exist; the earlier TypeScript checks passed and current source has no recorded merge conflicts. Historical data/deployed schema findings require a fresh safe audit; these source fixes do not prove live data repaired. No stage or gate advanced.

**Schema/connection follow-up:** the actual Kysely factory connects successfully. All 61 typed tables/declared columns exist, but 43 business relations and 15 columns are unrepresented in the current types. Temporal exclusions and processed-attendance partitioning remain absent; backend HTTP on port 5100 was unavailable at inspection. See the follow-up section in the audit evidence above.

**Relationship review, 07 Oct 2026:** [complete table/field map and design assessment](../docs/recon/database-relationships-2026-10-07.md) covers 104 business tables, 1,028 fields and 192 parent/base-table FK constraints. Confirmed 119 dangling swipe employee IDs and missing budget/claim workflow FKs; company alignment composite FKs are a strength. Findings remain open; no implementation stage was advanced.

**Additional greytHR field recon, 07 Oct 2026 (P0-T02 evidence):** [sanitized inventory and HRMS comparison](../docs/recon/greythr-additional-fields-2026-10-07.md) captures 164 field-definition appearances / 143 unique technical names across six authenticated metadata sections. Education and previous-employment tables are specified in doc 03 but absent from the inspected live schema. Further fields require a scope decision; no records were imported, schema changed, or gate advanced.

**Attendance/access recon follow-up (P0-T02, ATT-03/05):** [dated session/access evidence](../docs/recon/greythr-attendance-and-access-2026-10-07.md). At inspection, configuration reads returned 403 and current-period returned 500. **Fresh source reconciliation, 09 Oct:** processor readiness now considers absent sessions; regularization and whole-day leave clear stale session labels. Preserve those fixes. Approved tenant thresholds, isolated behavior/deployment proof and real connector access remain open. No persistent integration was configured or gate advanced.

- `docs/13-MASTER-BUILD-PLAN.md` — the master plan these files decompose (task IDs P0-T01…P2-T12)
- `docs/14-TECH-STACK-AND-RELIABILITY.md` — stack decision record + reliability program (wins over doc 02 on conflict)
- `docs/03-DATABASE-SCHEMA.md` — every table/column · `docs/04-MODULE-SPECS.md` — exact behavior
- `docs/08-ROLES-AND-PERMISSIONS.md` — RBAC seed + per-role shells · `docs/10-INDIA-PAYROLL-STATUTORY-REFERENCE.md` — rates + golden fixtures

## Frontend route map (locked 11 Jul 2026 — P0-T33 shell)

Product routes live in `frontend/src/app/router.tsx`. **Every route now resolves to a real page** — `PlaceholderPage` is gone. Surfaces whose *backend* lands in a later phase render their real layout plus an honest pending panel naming the phase and task, and never invented data (docs/05 §4.8: *"never fake data"*).

| Path | Status | Phase |
|---|---|---|
| `/login`, `/` (role home) | live | 0 |
| `/people`, `/people/:ecode` | live (P0-T33) | 0 |
| `/approvals`, `/my/*`, `/attendance/*`, `/leave` | live (Stage 1.3–1.7) | 1 |
| `/team`, `/reports/*`, `/policies`, `/letters` | live (Stage 1.7) | 1 |
| `/admin/users`, `/admin/settings`, `/admin/workflows`, `/admin/masters`, `/admin/audit` | live (Stage 1.8) | 1 |
| `/payroll/*`, `/loans`, `/claims`, `/my/pay`, `/my/claims` | UI live · backend Phase 2 | 2 |
| `/lifecycle/*` | pending process shells; boarding/exit report slice exists | 3 |
| `/assets`, `/helpdesk` | backend + operational UI exist; exact SOW gaps/UAT remain | 3 |
| `/engagement` | announcement feed live; poll/pulse APIs exist; publisher/poll UI pending | 3 |
| `/executive`, BU home | snapshot/BU API + screens exist; KPI, scope and acceptance gaps remain | 3 |
| `/travel/*` | UI live · backend Phase 3.5 | 3.5 |
| `/recruitment/*` | UI live · backend Phase 4 | 4 |
| `/dev/gallery` | live (super_admin) | 0 |

**Next UI stage:** Phase 2 payroll console (P2-T08) — **blocked** until the 9 statutory policy decisions (P0-T06) are signed; no money code starts before that.

**16 Oct repair increment:** [pack24 — Stage0.4 readonly authority](sow-completion/24-READONLY-AUTHORITY-REPAIR.md). H02 repair is separate from remaining HR action and SOW acceptance; see evidence for verification limits.

**Latest16 Oct:** [pack25 — authentication repairs](sow-completion/25-AUTH-SESSION-AND-LOGIN-REPAIR.md) implements the approved session decision and concurrent login safety. Read its actual verify result; remaining SOW rows are not declared complete.

**16 Oct Stage1.4 increment:** [half-wise attendance/AR/OD](sow-completion/26-HALF-WISE-ATTENDANCE-REQUESTS.md) implements the sponsor-confirmed two-half model; read actual verification and remaining acceptance before advancing any gate.

**16 Oct Stage 1.4 timing refinement:** [configured half timings](sow-completion/27-ATTENDANCE-TIMING-UI.md) implements the sponsor-confirmed timing UI and records browser proof. Remaining SOW acceptance and the backend coverage gate remain open.

**17 Oct Stage1.8 role-flow review:** [49 separate cases and remaining SOW](sow-completion/28-ROLE-FLOW-AND-SOW-REVIEW.md).19 native observations reproduce open HR scope/correction, month-close, co-sign and task-access gaps. Original176 SOW texts retained; no acceptance gate advanced. Next build is the separately announced Stage1.2 HR attendance safety repair.

**17 Oct Stage1.2 repair:** [HR attendance safety F02–F05](sow-completion/29-HR-ATTENDANCE-SAFETY-REPAIR.md) implements scoped, transactional correction/scheme safety with17 new native regressions and546 passing full-suite tests. Coverage and other13 role-flow finding groups remain open; no gate advanced.
