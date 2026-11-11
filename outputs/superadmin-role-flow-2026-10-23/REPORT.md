# Super Admin configuration and the 38 reported issue groups

23 Oct 2026 · Phase 1, Stage 1.8 · local code and synthetic native PostgreSQL/API verification.

## Confirmed sponsor decisions

1. Configuration defaults to **Super Admin**, who may delegate it.
2. HR Head must not have default access to the access matrix.
3. Payroll admin must not inherit approval-chain editing from payroll-policy/settings access.

These decisions supersede the older role notes and Pack40's automatic payroll-admin editing description. Existing payroll formulas, monetary defaults and statutory rate values are preserved.

## Implemented configuration boundary

| Authority | What it controls | Default grant |
|---|---|---|
| `admin.settings` | Settings console access; does not itself authorize value changes | Existing console readers retained |
| `payroll.config.manage` | `pay.*`, `tax.*`, `loans.*`; effective-dated statutory rates, PT slabs and GL configuration | Super Admin |
| `hr.config.manage` | HR policy settings, shift definitions and blackout configuration | Super Admin |
| `system.config.manage` | Technical/security/integration and remaining setting namespaces | Super Admin |
| `admin.workflows` | Approval-chain catalog/editing and scoped workflow administration | Super Admin |
| `admin.roles` | Access matrix, role creation, grants and user assignments | Existing authorized access administrators; delegation ceiling/password confirmation retained |
| `payroll.run.manage` | Run creation, inputs, computation and processing | Existing payroll operators; does not grant configuration |

Settings changes require a non-readonly, group-wide domain grant. Company-scoped grants cannot change group-wide settings or statutory/PT/GL data. Configuration-only delegates can open payroll reference settings without acquiring salary/register access. The existing HR `workflow.routing_holds` permission remains a scoped routing-repair authority, not chain editing or consent.

**How Super Admin delegates:** open Users & Roles → Permissions; optionally Create role (new roles start empty), grant the required domain permission and console access, then assign the role in People. Approval-chain access is a separate explicit grant. API grants/revocations take effect on the next request; recipients refresh their session/page to refresh navigation. No source edits or restart are required. Generic policy values retain typed validation and audit history.

Tests exercise a new custom role, its initially empty permissions, assignment, a permitted policy write, refused chain access and refused payroll-register access. Existing payroll-admin processing continues independently. Default HR Head matrix read/export and payroll-admin chain calls return 403. Group-scoped configuration changes remain refused even after explicit role-level delegation.

## Confirmed defects repaired

- **P4r:** the shared input guard now accepts draft and reopened states. JSON, CSV and Excel share the same validation/run-lock boundary. Re-locking inputs blocks add/remove again.
- **HH3 diagnosis:** the checker can reload the last computation's employee-specific omissions; exceptions no longer disappear when the maker leaves the page or the checker opens it. The full-population reconciliation gate is retained.
- **P13 financial safety:** the monthly engine previously ignored run type and could repeat regular salary on an off-cycle run. A native regression reproduced it. Non-regular runs now refuse this engine before payroll item changes. A supported dedicated off-cycle dialog/payout workflow is still open; no unsafe option is exposed as completed.
- **Navigation/dashboard:** payroll settings, structures, revisions and parallel-run entries appear under their permissions. Leadership widgets do not probe forbidden payroll/probation/HR report APIs.
- **PH3/C3 discovery:** the masthead polls the user's actual assigned inbox. A named assignee without broad domain approval permission can discover their pending approval; backend assignment/consent checks remain intact. Poll state resets across account changes.
- **O8:** HR correction authority now includes recomputation. Single-day calls verify the target employee scope; queued calls claim only permitted employees. Native tests show an outside employee is refused and an outside queued row remains untouched.
- **SA1:** access administrators can create empty custom roles through a password-confirmed, audited API and UI, then use existing grants/assignments. Duplicate role codes return 409; no permissions are copied automatically.
- **AUTH-05:** Change password is reachable from the account menu, with current/new/confirm fields and authoritative server policy errors. Closing unmounts the password form. Other-session invalidation remains on the existing server path.
- **E14:** My Pay exposes Investment declaration even before the employee has a finalized payslip.
- **E16/E16b/H2 discovery:** Plan new trip opens the existing travel-budget request drawer. Advance eligibility/approval remains the existing workflow, not a fabricated trip or payout.

## HH3 → payslip → paid → employee proof

The sponsor subsequently confirmed that HH3 was a test-data observation. No live run identifier is pending. The native synthetic recovery below is the regression evidence; no unknown employee was excluded to force finalization.

The new rollback-only native test creates two expected employees, with one missing salary. The first employee's hand-computed result is **₹59,324 gross − ₹200 PT = ₹59,124 net**, with no PF/ESIC/TDS in this synthetic fixture. Compute creates that correct item and records the other employee's missing-salary exception. HR Head reloads the diagnostic through the real API. Approval does not weaken finalization: finalization still refuses one missing item.

After authorized reopening and correction of the missing salary, recomputation has no omissions. HR Head approves/finalizes; payslips and the bank batch contain both employees; the simulated mark-paid transition succeeds. The first employee's own authenticated payslip API returns **₹59,124** and its archived document is present. Four non-regular run types refuse the monthly engine and create no extra items. This proves the recovery/cascade contract, not repair of the unavailable original June dataset. No real transfer occurred.

## All 38 reported groups

“Present” below means source/native/component evidence exists in this checkout. It does not certify the old browser timeout resolved in its original environment. New regressions have explicit failing-then-passing evidence. Open features remain open.

| # | Reported ID(s) | Current disposition |
|---|---|---|
| 1 | HH3 | Diagnostic visibility repaired; full-population guard and recovery proved natively. Sponsor confirmed this was test data; no live run identifier pending. |
| 2 | P9 / P16 / E13 | Synthetic full cascade passes at ₹59,124 through employee-own API; this is the test-data recovery evidence confirmed by the sponsor. |
| 3 | P4r | Reopened inputs repaired across the shared input boundary; lock/read-only behavior retained. |
| 4 | P4d | `.xlsx` preview/commit and legacy `.xls` Save As guidance already exist and have component/native bulk tests. Original browser timeout not reproduced against its dataset. |
| 5 | P8 | `/payroll/settings` and PT slabs UI exist. Navigation/configuration delegation repaired; statutory/PT/GL writes now require explicit configuration authority. |
| 6 | P6 / P10 / P11 | Run LOP/hold filtering and TDS Form24Q/Form16/challan UI exist. Pack42 adds audited/scoped hold placement/release and payroll proof-verification UI; LOP-reversal editing remains open. |
| 7 | P1–P3 / P12 / P15 / P18 | Payroll settings/structures/revisions/parallel-run navigation repaired. Canonical loans route remains `/loans`; self-service is `/my/loans`. Secondary destinations live in More, not an oversized primary pill row. |
| 8 | P13 | Dedicated off-cycle dialog/payout feature remains open. Newly reproduced duplicate-monthly-salary risk is blocked. |
| 9 | E3 | Family/nominee panel and HR-approved self-change path already exist; native family tests pass. Original UI observation needs current-environment replay. |
| 10 | E5 | Current calendar/day/request and approval contracts have component/native tests. Original day-button timeout needs browser replay; no new clock/status shortcut was introduced. |
| 11 | E6 / E7 | AR, short Permission and OD choices are present in AttendanceRequestDrawer and covered by tests. Configured half/minute rules remain authoritative. |
| 12 | E9 | Approval effects have native workflow/leave tests. Manager approval can advance a multistep chain rather than complete it; no forced final approval was added. Original request/chain/refresh state still needs its record. |
| 13 | E14 | My Pay declaration entry repaired for employees without a payslip; `/my/tax` retains the declaration/proof UI. |
| 14 | E16 / E16b | Plan new trip entry added to the existing budget request flow; component test opens the actual drawer. |
| 15 | E18 | Current ESS `/my/resignation` uses server-linked self identity and policy-derived notice; native separation tests cover ownership. The old ID301 implementation is not the current self-service path. |
| 16 | E23 | **Open:** mobile/geo punch UI/API contract is not implemented here. No fabricated GPS or biometric event added. |
| 17 | E24 | Public tokenized prejoin routing exists before login; token expiry, one-use submission and joining boundaries have tests. A missing/expired token is intentionally refused; original token/context needs replay. |
| 18 | AUTH-05 | Account-menu Change password added and tested, including confirmation and server rejection. |
| 19 | A11Y | Existing label/calendar/accessibility tests run in full frontend verification. New controls use labeled UI primitives. The old full-browser axe/paint/contrast report is not certified closed by jsdom tests. |
| 20 | M4 | **Open:** OT pre-plan/pre-approval UI and domain flow are missing; detected-OT approval is a different capability. |
| 21 | M12 | **Open:** recruitment/requisition remains a Phase4 shell; no permission grant can manufacture the missing endpoint/workflow. |
| 22 | M13 | Pack43 reproduces and repairs reimbursement submission creating no workflow. Native proof covers manager inbox/notification, successive configured approval, partial receipt verification and payroll payment. Legacy unlinked claims require deliberate routing reconciliation; no approval is fabricated. |
| 23 | HH2-loan | `/my/loans` apply flow and loan approval tests exist; no broad `/loans` registry access is granted to employees. Original Apply timeout needs replay. |
| 24 | H2 | Plan new trip discovery repaired; existing advances follow approved budget/RM/HOD rules. Original advance submission timeout still needs its record/browser replay. |
| 25 | HH2-resign | HR Head separation approval is already in the current seed and native separation tests. A stale deployment/grant needs environment-specific reconciliation. |
| 26 | O8 / O9 / O11 | HR recompute repaired with scope isolation. Month-lock checklist/control and Excel muster export exist and have native tests; HR Ops month-lock is currently explicitly scoped/allowed. |
| 27 | O26 | Current onboarding includes Offer/LOI composer and native offer approval behavior. Candidate/prejoin remains separate from actual employee creation. Original UI absence is not reproduced on that source. |
| 28 | HH9 | `/admin/org-masters` contains company/entity/dept and other master editors for authorized users. Configuration is now Super Admin/delegation-controlled. A separate HR read-only masters experience remains unverified; attendance masters is not the org-master page. |
| 29 | PH3 / C3 | Plant→HR Head→CEO offer chain already exists; assigned-inbox discovery repaired without granting blanket approval rights. Original offer request still needs replay. |
| 30 | I4 | Pack42 adds a dedicated scoped task-owner permission/API/UI for IT. No HR conversion power is granted; unavailable Kent enrollment remains explicit. |
| 31 | I6 / I7 | **Open:** SMTP configuration/delivery UI and backup/restore evidence/control are not supplied by generic settings. Server configuration and an actual restore drill remain operational acceptance work. |
| 32 | H1 | HOD assignment exists at `/admin/department-heads`, with derived department scope tests. It is an employee-master function, not arbitrary user-role assignment. Super Admin can delegate appropriate authority. |
| 33 | SA1 | Empty-role creation added; existing matrix grants and user assignments retained and tested, including custom configuration-only roles. |
| 34 | AUTH-01 ×3 | Permission-driven ESS/manager navigation and shell tests pass; payroll destinations additionally repaired. Original login/nav screenshots need current-environment replay before all three old failures can close. |
| 35 | NAV-01 ×3 | Forbidden optional dashboard probes repaired; role-specific fetch tests cover payroll/plant/CEO permissions. This is not a full browser-console certification. |
| 36 | NEG-UI ×2 | Sponsor-confirmed restrictions enforced in routes/navigation/API: default HR Head matrix denied, payroll settings no longer grant chain access. Explicit Super Admin delegation remains possible. |
| 37 | API-PERM-WRITE | Current seed intentionally grants HR Ops scoped month lock (O9). A business-readiness/input failure can return 400 for an authorized caller; cross-entity/unauthorized writes must return 403. Existing scoped tests remain; do not change readiness errors to conceal an outdated matrix expectation. |
| 38 | API-PERM-READ | HR Head `/api/rbac/matrix` and export now return 403 by default as explicitly requested. `admin.roles` controls matrix access. |

## Verification and limits

Full backend `npm run verify` passed: **152 files / 1,102 tests, no skips**, typecheck, lint, knip, dependency-cruiser, coverage and build. Coverage is 86.58% statements/lines, 81.15% branches and 90.86% functions. Full frontend `npm run verify` passed: **60 files / 397 tests**, typecheck, lint, knip and build. `git diff --check` passed. [Machine-readable verification](verification.json) records the results. Regression evidence includes reopened-input refusal, absent diagnostics, forbidden widget probes, assigned-inbox invisibility, configuration default overreach and non-regular salary duplication before their repairs. Scope tests prove single-day and dirty-queue isolation, configuration-only reads, no payroll-register access from configuration alone, and current-token grant/revocation behavior.

Testing used a newly created, explicitly declared loopback database `hrms_roleflow_test_20261023`. The normal migration runner applied only the two new migrations, 1100 and 1200, on that test clone. Application `.env` and the main database's role grants/configuration were not rewritten. New financial fixtures roll back; the existing legacy suite cleanup behavior remains documented separately. No original source spreadsheets, live KENT device data, live payroll, government filings, email recipients or actual payouts were changed.

This pack closes a bounded Stage1.8 repair/review increment. It does not implement every future feature in the table or certify the old UAT environment. Human payroll-core review under CLAUDE.md §3 remains mandatory before deployment; current statutory policy/notification acceptance from Pack40 is still open. No release or phase acceptance gate is advanced.


Latest continuation: [Pack42 payroll controls and IT tasks](../payroll-controls-2026-10-23/REPORT.md). The remaining full-request features are explicitly open there.

Latest claims continuation: [Pack43](../claims-workflow-integrity-2026-10-24/REPORT.md).
