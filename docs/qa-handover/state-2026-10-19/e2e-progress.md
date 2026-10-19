# e2e job progress (updated 02:05 IST 19-Oct)
- Snapshot restored into hrms_e2e (template hrms_snapshot); suite portable (5104/5176, hrms_e2e).
- Baseline on main c1cfe2c (snapshot): 269 tests, 196 pass, 69 fail, 4 skip (per-role table in /workspace/STATE/e2e/baseline-snapshot-c1cfe2c/E2E_RESULTS.md).
- Merged to main: 5c2cc4e (scope + concurrency specs, personas), 4d8187c (production-readiness pass).
- Concurrency (tests/api/concurrency.spec.ts): OK for leave double-submit, approve races, bulk commit, payroll approve/finalize/markPaid; bugs E2E-022 (F&F double pay), E2E-023 (bank batches), E2E-024 (punch overlap 409).
- Production readiness (scripts/run-prod.sh): bootstrap/masters/employees/logins/leave OK; blocked at month lock/payroll: E2E-027 (worker dies on fresh DB, P0), E2E-028..034.
- Next: ESS + viewer-role walkthroughs with screenshots (1366/390), animation audit, full re-run on latest main.

## update (IST 19-Oct, after the main 8ff3191 merge)
- Walkthroughs done (ESS + 9 viewer roles, 1366/390) → /workspace/STATE/e2e/walkthrough/; motion audit → E2E-041. Bugs E2E-035..041.
- Full run on main b7929f9: 306 tests, 251 pass, 43 fail, 12 skip. Triage: test fixes for date-picker labels (UI now uses "02 Nov 2026"), E18, AUTH-04 (login accounts panel from job/fix), P1/P8/P12, O11, E24, SCOPE-WRITE payloads. NEG-UI payroll_admin→/admin/workflows is allowed per docs/08 (client-decision note).
- New bugs: E2E-042 (employee loan apply unreachable, route-guard regression), 043 (ESS resignation page shows a permission error; employee can't see own resignation), 044 (no team muster export), 045 (hr_ops RML can issue a letter for an RGH employee, security), 046 (overlap error shown on the reason field).
- Merged to main: 8ff3191 (triage fixes + walkthrough tool + concurrency second pass).
- Prod pass now drives the Kent simulator (E2E_KENT_SIM=1, port 5194, device KGP-G1→RML-KGP-MAIN-GATE) and syncs via "Sync now"; importer only as a labelled fallback.
