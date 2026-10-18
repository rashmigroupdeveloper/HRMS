# Continuous launch-readiness work

Sponsor instruction17 Oct2026 supersedes the older one-stage-and-stop preference: continue across announced stages until launch readiness is evidenced or external/usage limits require a precise handoff. Claims/reimbursements remain deferred; prior budget deferral also remains. Deferred obligations are not counted complete. Never manufacture integration, financial policy or UAT evidence.

## Current position

Read the [consolidated phase status](03-PHASE-STATUS.md) for the18 Oct sponsor checklist reconciliation. “Code exists,” “locally verified repair” and “accepted stage” are distinct. No phase gate is passed by historical checked tasks.

**18 Oct2026 update:** [pack33](../sow-completion/33-ACTUAL-JOINING-AND-DEPLOYMENT-AUDIT.md) and [deployment audit](../../outputs/deployment-audit-2026-10-18/REVIEW.md) supersede historical test totals below.42 focused onboarding tests and frontend full298 pass. Backend runtime640 pass/5 fail, branch coverage76.88% below80; shared-test typecheck also fails. Another AI remains active. Actual joining/token/UI repair is partial; Stage3.1 stays open. Sponsor will supply Kent raw data and integration locations later.

- Baseline: pack28 has49 role cases/176 SOW rows. Pack29 repaired backend F02–F05;546 tests pass, global coverage77.08% lines/72.85% branches remains below80.
- Implemented locally: pack30 Phase1 Stage1.7 close completeness and report scope,561 tests pass, static checks/build pass; coverage77.59% lines/73.50% branches remains red. Function-only migration1752310000000 applied; no added DB fields/tables.
- Implemented locally: pack31 Kent no-fake-sync guard;561 backend tests/static checks/build pass; coverage77.58% lines/73.54% branches still fails80. Normal unconfigured sync503, with no data changes.
- Implemented locally: pack32 HR routing-hold recovery UI; fullfrontend verify274 tests green, synthetic native browser proof and both-theme screenshots.
- Working next: Phase3 Stage3.1 candidate-to-employee integrity under sponsor-confirmed actual joining gate.
- Remaining: notification delivery evidence; onboarding/lifecycle and payroll authority/source/UI; integrations, remaining domain and operations work.
- Every business requirement/SOW row remains tracked in packs and latest evidence. No release gate signed yet.

## Launch blockers requiring real evidence

Authorized Kent protocol/source access and real delayed/reconnect delivery; actual ATS offer/candidate contract and secure linked-account SSO; approved payroll/statutory settings and real source balances/comparisons; authenticated SMTP/object-storage delivery; real master reconciliation; intended production environment, backup/restore/scale proof; required money human review and HR/Finance UAT. Local hrms is an authorized test DB and is never the production launch target.

## Continuation rules

Read this file, AGENTS and governing docs first. Preserve the dirty checkout. Announce stage transitions, implement and verify rather than only listing defects. Keep full verification thresholds; do not treat fixture-only/unit/browser screenshots as real integration acceptance. Do not send external messages/deploy/payout without the required explicit authority. Keep this file and the detailed handoff current after each verified increment.

ATS source located at `/Users/anooppratapsingh/Documents/interview_scheduling`; source/identity facts and required connected-account contract are in `01-ATS-CONNECTED-ACCOUNTS.md`. ATS files/DB have not been changed; SSO is not yet implemented. Detailed continuation is in `HANDOFF.md`.

Sponsor confirmed: permanent e-code is issued only after HR confirms actual joining, even if the application was approved earlier. See `02-CANDIDATE-TO-EMPLOYEE.md`. Candidates remain outside real employee MIS until that boundary. Separate-app SSO and the ATS source adapter remain unimplemented.
