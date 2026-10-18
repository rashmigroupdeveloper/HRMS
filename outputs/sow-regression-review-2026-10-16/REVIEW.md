# SOW regression review — 16 Oct 2026

**The whole system is not yet sound.** The current builds/tests pass their executable assertions, but important payroll, lifecycle and client/API flows still have source-backed gaps. This review completed the sponsor's vacancy decision and repaired two additional workflow risks. It does not turn code presence into acceptance.

## Repaired in Phase 1, Stage 1.3

1. **Real approval deadlock:** reproduced an employee-lock/audit-chain-lock cycle against native PostgreSQL. Workflow mutations now lock subject → request/step → domain → audit. The coordinated regression observes actual `pg_locks` waiting and then proves both transactions finish. No retry or weakened global timeout masks the problem. This is a bounded workflow fix, not a universal concurrency certificate.
2. **Approval-chain bypass:** duplicate step numbers could cause a required later approval to be skipped; invalid approver/escalation strings could be interpreted as vacancy. Shared read/write validation now rejects them. Native API tests prove invalid edits do not persist.
3. **Sponsor vacancy decision:** all configured approvers missing/inactive at creation or resubmission → pending **Held for HR**, with audited hold, configured HR event and requester notification. No attendance posting/debit/final hook and no fictitious recipient receipt. Scoped `admin.settings` routing repair requires a reason, rejects readonly/out-of-scope actors, and can only restore an eligible configured approver. Concurrent retries open one step. Existing configured lapse deadlines remain: a held OT request still lapses. The exact request detail says **Waiting for HR**; this is a copy/status addition to the existing component.

**Worker isolation:** a malformed legacy chain now fails closed for that request and emits a redacted error without aborting processing of valid overdue requests. A native regression failed before this isolation repair and now proves unrelated OT still lapses. Held-expiry failures are isolated in the same way. Operational error delivery/monitoring remains an open deployment obligation.

The amendment is recorded in docs01/04/08/13. No table, column or migration was added. `seed:workflows` added only the configured HR Head event subscription; all 15 existing chain definitions were preserved. A dedicated HR hold-queue screen remains an integration task; this increment supplies the secured backend recovery API and employee request-state message. Endpoints: GET `/api/workflows/routing-holds?limit=50&offset=0`; POST `/api/workflows/requests/{id}/retry-routing` with `{reason}`. Request timeline adds `routingState`; held requests remain `pending` in the existing DB status.

## Confirmed risks still disturbing end-to-end flows

| Priority / finding | Current problem | Evidence / remaining work |
|---|---|---|
| P1 G05 / R12 | Some screen URLs do not route to the current backend | Ten local HTTP probes confirm loan `/api/loans/*` and separation screen URLs return 404 while actual generated paths reach auth. Loan route definitions include an extra `/api`; separation method/path names differ. Read [contract proof](http-contract-proof.json) and [all scanned calls](screen-api-audit.json). Fix HTTP method/path, payload/output and auth/scope together in the owning domain. |
| P1 G09 / R13–14 | Payroll/local screen state and sample fallbacks report success without persistence | Payroll actions only change React state; onboarding/probation/separation catches still fill sample records. Replace with real API/data success and visible error/empty states. |
| P1 G06 / R18–20 | Onboarding/probation can produce incomplete identity and salary facts | Sequential conversion writes are not one transaction; login sentinel and empty salary components remain. E-code allocation is repaired, but cannot repair the entire onboarding flow by itself. |
| P1 G07 / R16–17 | F&F substitutes sample days/leave/DOJ and lacks complete payment/approval gates | Source still defaults to 15 payable days, 12 EL and a fixture DOJ; paid/letters cannot be accepted without authoritative inputs and payment evidence. Human money review required. |
| P1 G08 / R05/08/10/23/24/29–34 | Payroll, loans, YTD, annual processes and outputs lack complete source/consumption contracts | Current source retains missing real-run facts, repeat-consumption/immutability risks, memory-only opening YTD, active loan creation and mutable outstanding. Goldens do not certify orchestration. All individual R obligations remain in findings.json and pack19. |
| P1 G04 | Central readonly grants can still reach existing mutation handlers | RBAC permits readonly on arbitrary codes; central scope treats it as all; presence-only procedure gates do not distinguish writes. New routing repair independently rejects readonly with a native test. A foundation-stage API authority repair is still needed across existing procedures. |
| P1/P2 legacy state | Invalid chain data and approval histories need review | Native `claim` and `travel_budget` have invalid second approver specifications; new validation fails closed. Claims/budgets remain deferred and no runtime edits were overwritten. Local test DB also has 98 overtime and 52 privacy_rights approved requests with no step records. These counts do not establish their original cause or that all are live business errors. Do not use them as acceptance evidence or automatically reverse financial/history rows. |
| P2 G10 | Required backend coverage is red | 498 native/unit tests pass; full verify fails the unchanged 80% floor. See verification below. |

These are not all newly introduced by the latest change. The 500-file previous inventory was byte-for-byte unchanged at the start of this review; the accumulated checkout is already dirty/untracked. Attribution to an individual build/commit is unavailable. The previous 46 code findings and nine schema observations are retained with explicit current statuses in [findings.json](findings.json). R21's allocator repair and R46's transport repair are preserved; their broader domain/gate obligations are not closed.

## Breadth and limits of the review

- Fingerprinted the previous 500 project sources/configurations before editing, then captured the final source inventory. Reviewed the current workflow/attendance/leave boundaries and critical payroll, onboarding, probation, transfer, separation, loan and output entry points. The inventory is not a claim that every line or every runtime permutation was manually certified.
- Generated the real OpenAPI document: **250 paths / 268 operations**. AST-scanned **165 literal/template frontend calls** plus **nine unresolved dynamic expressions**. Of 30 initial unmatched candidates, six were conditional-method/query-suffix false positives; **24 candidates remain**, with selected defects independently confirmed by HTTP. Path matching is not response-shape, permission or transaction proof.
- Read-only live catalog comparison: **132 business relations / 1,379 columns**, no added/removed/changed column definitions against the prior catalog. Source migrations remain unchanged. The native DB has 48 applied migrations; the prior disposable PostgreSQL16 replay/upgrade remains historical evidence and was not rerun or misrepresented as applied locally. Constraints/field necessity still require the retained schema audit; no zero-slop certificate is issued.
- Retained **all 176 original SOW rows**, exact wording and remaining categories in [sow-scope-current.json](sow-scope-current.json). No whole row is promoted to accepted by this partial repair. Claims and budgets are deferred, not deleted or completed. Manual duties, scope decisions, Kent, real delivery/payment evidence and signed UAT remain necessary.

## Verification

| Check | Result |
|---|---|
| Backend typecheck / lint / knip / dependency graph | Pass |
| Explicit local-test backend suite | **498 passed / 65 files / 0 skipped** |
| Separate backend production build | Pass |
| Full backend `npm run verify` | **Exit 1 — coverage**, not a green gate |
| Coverage | Lines/statements **76.56%**, branches **71.84%**, functions **80.83%**; global floor **80%**, unchanged |
| Frontend full `npm run verify` | Pass, **246 tests / 27 files**, build pass |
| UI scoped tools | React Doctor and deterministic Impeccable scan report zero findings for `ApprovalRequestStatus.tsx`; not a full-app certification. Prior broad warnings remain in pack20. |
| Fixture cleanup | Read-only check: no active checked s13/s14/scope fixture users and no open checked fixture requests. Immutable audit identities/month locks retained. |

The new UI test exposed a teardown ordering race in the existing test file: restoring mocks before component cleanup could return undefined to a late resource effect. Cleanup now precedes mock restoration; assertions remain. The S14 cleanup also removes its retained synthetic employees from active/payroll populations while preserving immutable swipe/audit parents; older local test data is not globally cleaned or certified. No backend/frontend thresholds were lowered. The frontend retains its approximately 919.53 kB main-chunk advisory. No money/statutory source, production data, migration, commit, PR or deployment was changed by this increment.

## Resume safely

[Pack21](../../plans/sow-completion/21-SOW-REGRESSION-AND-HR-HOLD-REVIEW.md) records the current execution boundary. Before code changes read AGENTS, docs00/relevant specs/13/14; money requires all docs04/10 and human review. Use Node24/npm and the explicitly sponsor-authorized loopback `hrms` test DB, native PostgreSQL14.24. Do not recreate `hrms_test` or run native suites concurrently. Explicit TEST_DATABASE_URL and NODE_ENV=test/LOCAL_TEST_DATABASE_NAME=hrms are required; ordinary unconfigured tests skip integrations. Keep credentials private.

Recommended next separate stage: **Phase0 Stage0.4 — central permission read/write and ownership repair**, followed by the documented domain API/client and transaction stages in pack19. Do not silently combine several stages or mark existing SOW work complete from a build. The current [context ZIP](HRMS-SOW-Regression-Context-2026-10-16.zip) contains actual source/tests/migrations/config, amended canonical docs, plans, original SOW and current audit evidence, with hashes and clear exclusions. It excludes .env, dependencies, business exports/dumps, raw logs and temporary fixture credentials. Older historical outputs are not exhaustively bundled. No gate advanced.
