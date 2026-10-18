# Rashmi HRMS — end-to-end UI + API suite (Playwright / TypeScript)

Logs in as **every role** through the real login form and performs each role's tasks by clicking and filling forms
(ROLE_TASKS.md IDs in every test title), plus API permission/auth checks, a full maker-checker payroll run,
bulk CSV/Excel uploads, responsive (desktop/tablet/mobile) health and axe accessibility.

## One command

```bash
cd /workspace/hrms-e2e
npm run e2e          # reset DB → start own servers → all projects → reports
```

What it does (`scripts/run-all.sh`):
1. `scripts/reset-db.sh` — drops/recreates **hrms_e2e**, restores the tester snapshot (June-2026 payroll cohort, runs 4/5),
   runs the fixer's migrations + seeds from `/workspace/hrms-fix/backend`, applies the fixer's recon prep and `scripts/e2e-prep.sql`
   (HOD persona, RGH-scoped HR Ops persona, disposable auth users, clears lockouts/delegations).
2. `scripts/start-servers.sh` — runs **/workspace/hrms-fix** (working tree, via the `.app` symlink) on its own ports:
   backend **:5130**, Vite frontend **:5193** (proxy `/api` → :5130). It never touches the fixer's :5110/:5183 instance.
3. `npx playwright test` — all projects (below), then `scripts/build-results.ts` writes
   - `/workspace/hrms-test/e2e/E2E_RESULTS.md` — pass/fail matrix per role × task, failures with screenshots, traces, repro steps,
     usability scores, a11y findings, console/network errors
   - `/workspace/hrms-test/e2e/FAILURES.md` — actionable list for the fixer, grouped by area with fix hints
   - `/workspace/hrms-test/e2e/artifacts/` — copied failure screenshots + traces
   - HTML report: `reports/html/index.html` (`npm run show-report`)

Variants: `npm run e2e -- --project=api`, `npm run e2e -- -g "P5"`, `E2E_SKIP_RESET=1 E2E_SKIP_SERVERS=1 npm run e2e -- --project=a11y`.
Env: `E2E_BASE_URL` (default http://localhost:5193), `E2E_API_URL`, `E2E_DATABASE_URL`, `E2E_WORKERS` (default 3), `E2E_OUT`.

## Projects / specs

| Project | Spec | Covers |
|---|---|---|
| api | `tests/api/auth.spec.ts` | login/refresh rotation/logout, lockout + unlock, change password, forgot/reset (single-use), temp password |
| api | `tests/api/permissions.spec.ts` | docs/08 read/write matrix per role; entity scope (RML vs RGH, group roles) |
| auth | `tests/ui/00-auth.spec.ts` | per role: login, wrong password (no enumeration), refresh, logout/back; lockout, change/forgot/reset, IT temp password in the UI |
| roles | `tests/ui/01-access.spec.ts` | per role: allowed pages healthy; **negative** – forbidden pages deny and offer no actions |
| roles | `tests/ui/10-employee.spec.ts` | E2 E5 E9 E13 E16 E18 E20 E22 … (leave, AR, profile, helpdesk, letters, travel, resignation) |
| roles | `tests/ui/20-approval-chains.spec.ts` | multi-level chains with each approver acting: leave/AR (M1), claim (M13→O13→payroll), loan (RM→HR Head→Payroll), travel advance (RM→HOD), resignation, subtree (S1), batch |
| payroll | `tests/ui/40-payroll-run.spec.ts` | reopen (super_admin) → inputs: form, good/bad CSV, good .xlsx, legacy .xls → lock → compute (**RML033625 = ₹59,124**) → PT slab change alters next compute (₹59,074) and revert restores → future-dated rate no effect → maker can't approve → hr_head approve + typed finalize → payslips/bank/JV → mark paid → no-retro → employee sees ₹59,124 |
| roles | `tests/ui/50-role-tasks.spec.ts` | every other ROLE_TASKS ID: role finds the screen via nav, page healthy, capability present |
| viewport-desktop/tablet/mobile | `tests/ui/90-viewports.spec.ts` | every role's key pages: no page errors / console errors / 404·5xx / failed calls, no horizontal overflow |
| a11y | `tests/ui/91-a11y.spec.ts` | axe WCAG 2.1 A/AA on login + each role's pages; serious/critical fail |

## Usability score (per task, 1–5)
`lib/fixtures.ts › UxTracker`: **clicks** (≤4 interactions → 5 … >15 → 1, login excluded), **discoverability**
(primary nav/home 5, in-page link 4, “More” 3, palette 2, typed URL 1), **clarity** (starts 5; loses points when success/error
feedback is missing or unclear). Overall = mean, shown per task in E2E_RESULTS.md.

## Conventions
- Titles: `[role] TASK-ID what` — parsed by the report builder. Personas: `lib/personas.ts` (password `Rashmi#Test2026`).
- Each test logs in fresh through the UI (refresh-token rotation makes shared storage state unreliable).
- `Session.click/fill/nav` record repro steps; errors shown as toasts fail fast with the app's message.
- No app source is modified; the suite only reads `/workspace/hrms-fix` and runs it.

## Dev helpers
`tools/explore.mjs` (nav + ARIA dump per role), `tools/explore-click.mjs` (open a drawer and dump it), `tools/probe.mjs` (API status matrix).
