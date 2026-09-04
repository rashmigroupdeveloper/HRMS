# 02 — What Is Genuinely Solid

Remediation will touch most of this codebase. This file records what is *right*, with the evidence, so
that it is not damaged on the way to fixing what is wrong. Everything below was verified, not assumed.

---

## 1. Module boundaries are machine-enforced and clean

```
$ npm run depcruise
✔ no dependency violations found (192 modules, 753 dependencies cruised)
```

`.dependency-cruiser.cjs` encodes three rules — no circular imports, no deep cross-module imports
(modules talk only through `index.ts`), and `core/` never imports from `modules/`. All three hold across
192 modules. This is what docs/14 §5 promised as the cheap replacement for NestJS's DI ceremony, and it
delivered. **Do not weaken these rules while fixing the scope problem** — thread the scope object through
the public APIs instead.

Verified alongside it: no file in `frontend/` imports backend source and no file in `backend/` imports
frontend source; money code exists only in `backend/src/core/money`; design tokens and UI primitives exist
only in `frontend/src/{tokens,ui}`.

## 2. The design firewall is perfect

```
$ grep -rnoE "#[0-9a-fA-F]{3,8}\b" src --include='*.tsx' --include='*.ts' --include='*.css' \
    | grep -v "src/tokens/tokens.css" | wc -l
0
$ grep -rnoE "(rgb|rgba|hsl|hsla|oklch)\(" src … | grep -v tokens.css | wc -l
0
```

Zero hardcoded colours outside the token file, in either syntax. No MUI, Ant, Chakra, Bootstrap, Mantine,
Radix or Headless UI anywhere in `frontend/package.json` — the only UI dependencies are `lucide-react`
(icons, exactly as docs/05 §7b specifies) and `sonner`. Charts are token-driven SVG primitives in
`src/ui/Chart.tsx` rather than a second component library, with a deliberately fixed two-series palette
and no colour prop. docs/05 §0.1 is the rule most projects quietly break; this one has not.

## 3. The "never fake data" discipline is real, not aspirational

`frontend/src/pages/_shared/{ModuleState.tsx,useModuleResource.ts}` distinguishes *"this backend lands in
Phase N"* (a calm pending panel naming the phase, task and endpoint) from a genuine failure (a loud
error). Every page calls the endpoint it will really call. There is no sample net pay, no sample
headcount, no lorem row anywhere in 44 product routes. For a payroll system this is the difference
between a screenshot that is honest and one that is indistinguishable from real money.

The same instinct shows in `employees.service.ts` — the directory facet counts were changed from four
hardcoded entity headcounts to derived queries, with the reasoning written down.

## 4. The money module is correct and properly isolated

`backend/src/core/money/{money.ts,rounding-policy.ts}`:
- Integer paise behind a branded `Paise` type; `paise()` rejects non-integers; a `MAX_SAFE_PAISE` guard
  catches overflow before it silently loses precision.
- Rates are **basis points** so percentages are integers too (PF 12% = 1200 bp, EPS 8.33% = 833 bp).
- `mulDiv` and `percentBp` do one rounding at the end, not per-step.
- **One** rounding-policy file, each function named for its statutory source: PF → nearest rupee,
  ESIC → **round up**, gratuity/TDS/net → nearest rupee. An auditor's rounding question is answerable by
  pointing at one line.
- `formatINR` uses `en-IN` grouping (NFR-09 lakh/crore).

`tests/money.test.ts` (24 tests) computes every expectation by hand — and **caught an arithmetic error in
docs/10 §13 fixture G8** (₹1,67,007.69 → ₹1,67,638.85), which is exactly what the test-first rule for
money exists to do.

## 5. Database integrity work is largely excellent

**Migrations:** 40 files run cleanly from scratch (exit 0), are idempotent on re-run
(*"No migrations to run!"*), and `migrate:down` works — all three verified on a throwaway database.
Every DDL block opens with `SET lock_timeout = '5s'`.

**Append-only enforcement at the database, not the app** — UPDATE/DELETE-rejecting triggers on:
`core.audit_log`, `att.swipe_events`, `lv.ledger`, `att.month_locks`, `att.roster_revisions`,
`att.manager_month_approvals`, `sec.access_events`, `prv.consent_events`, `prv.purge_log`,
`prv.breach_register`, `cmp.filing_evidence`, `ird.posh_case_access_log`, `pay.claim_reservations`,
`hd.ticket_messages`.

**The hash-chained audit log** is computed *in the database* (`core.audit_log_chain`), so app code cannot
lie about it. It serializes with `pg_advisory_xact_lock` on a dedicated `chain_seq` sequence — and
`tests/audit-chain-concurrency.integration.test.ts` documents the real bug that motivated it (the chain
was ordered by `id`, which is assigned before the lock). `core.verify_audit_chain()` exists and the
integration test proves it catches a forged row and confirms a restored chain. This satisfies docs/14 §7.4
and the MCA edit-log rule.

**The month-lock guard is thoughtfully written.** `att.day_records_month_lock_guard` permits exactly one
post-lock write — flipping `is_locked` false→true when *nothing else on the row changed*, compared with
`to_jsonb(NEW) - 'is_locked' - 'updated_at' IS NOT DISTINCT FROM to_jsonb(OLD) - …`. That is the correct
shape for a lock transaction and it is rare to see it done properly.

**Ledgers are ledgers.** `lv.ledger` is append-only and balances are `SUM(delta)`;
`pay.claim_reservations` follows the same pattern with a deliberate comment explaining why there is no
`remaining` column. `readHeadroom` takes `FOR UPDATE` on the budget row so two concurrent claims cannot
both pass the same headroom check.

**Partitioning is automated where it is used.** `att.ensure_swipe_partition` is called on the ingest path
before every insert (`ingest.service.ts:116,248`), so the swipe table creates its own months.

Other correct details: 194 foreign keys, 144 CHECK constraints, 58 unique constraints;
`att.day_status` is a real PostgreSQL enum whose 9 labels match the zod enum exactly; money columns are
`NUMERIC`, never float; `swipe_events` carries both a BRIN index on `swipe_ts` and a btree on
`(employee_id, swipe_ts)`; employee search uses `gin_trgm_ops` indexes rather than `LIKE '%…%'` scans.

## 6. Configuration really is configuration

`getTypedSetting(db, key, type, default)` is used at roughly 70 call sites across attendance, leave,
compliance, privacy, documents, reports and auth. `npm run seed:settings` loads 51 keys idempotently.
I looked specifically for hardcoded policy numbers in `day-status.service.ts`, `overtime.service.ts` and
`leave-apply.service.ts` and found none — the only numeric literals are the documented defaults passed to
`getTypedSetting` (`att.ot_min_minutes` 30, `att.ot_decision_hours` 48). Writes go through
`setSetting`, which audits old→new into the hash chain. CLAUDE.md rule 2 is honoured.

## 7. Date and timezone handling is done properly

`backend/src/core/dates.ts` is a small, well-reasoned module that eliminates the two hazards it names:
pg returning a DATE as a *local-midnight* `Date` (so `toISOString()` yields the wrong day), and mixing
local-time with UTC math. `formatDbDate` uses local getters to invert pg's own construction, which is
correct on any server timezone. IST is handled as a fixed +5:30 offset with no DST assumption.
`formatPayrollMonth` **throws** rather than emit `undefined 2026`, with the comment *"a mislabelled
payroll month is a reconciliation incident"*. 25 tests.

## 8. The security primitives themselves are strong

What is built here is good — the problem in [`05-SECURITY-REVIEW.md`](05-SECURITY-REVIEW.md) is that it is
not applied everywhere, not that it is weak:

- **Sessions are the real credential.** `sec.sessions` is checked on every request alongside the JWT, so
  admin revoke, "sign out everywhere" and the exit-day access cut take effect on the **next request** —
  verified in `api/orpc.ts:66-78`. Most JWT implementations get this wrong.
- **TOTP MFA** with recovery codes, a policy-driven enforcement mode (`off`/`grace`/`required`) and
  required-role targeting; 14 tests.
- **Step-up re-authentication** with a distinct `STEP_UP_REQUIRED` error code that the frontend catches as
  its own error class and retries the exact action — so the user never loses their work
  (`frontend/src/lib/api.ts:25-30`, docs/05 §6 state-preservation).
- **Password policy** with history (`sec.password_history`), reuse rejection, and structured violation
  codes mapped to human messages.
- **Statutory-ID masking works.** `canViewStatutoryIds` permits unmasking only for one's own record or a
  payroll-class permission. Verified live: a peer's `pan`, `aadhaar`, `uan`, `bankAccount` and `bankIfsc`
  all returned `null` with `statutoryMasked: true`.
- **No user-enumeration oracle** — invalid credentials and inactive accounts answer identically; the
  password-reset endpoint always returns `ok`.
- **Exponential lockout backoff** (15→30→60→120 min) proven in test, including "correct password stays
  refused while locked".
- **The refresh token is httpOnly, `SameSite=Lax`, path-scoped to `/api/auth`** — JavaScript can never
  read it.
- **Storage path traversal is blocked** (`core/storage/storage.ts:20-27`), and document types are
  validated against a `doc.types` catalog, so `documentType: '../../escape'` is rejected.
- **`pino` redacts** `password`, `aadhaar`, `pan`, `bank_account` and the `authorization` header.

## 9. The API contract layer is complete where it counts

Every one of the **219 procedures** across 29 router files declares an `.output()` schema and a `.route()`.
Not one exception. That is the runtime firewall docs/14 §3 asked for, and it is why the muster type error
[E2] is a *compile* failure rather than a wrong report in production.

`withPermission` reads permissions from the database per request, so a grant or revoke takes effect on the
next call with no deploy — proven in `tests/access-control.integration.test.ts`.

## 10. The test suite, where it exists, is the right kind of test

773 tests total (483 backend, 290 frontend), all but one green. The backend suite is dominated by **real
integration tests against a live Postgres**, correctly guarded: `vitest.config.ts` refuses to run unless
`TEST_DATABASE_URL` names a `*_test` database, and `fileParallelism: false` because the suites share one
audit chain. Tests deactivate rather than delete audited users, honouring the append-only FK by design.

Depth where it matters: `punch-edge-cases.test.ts` 36 cases · `dates.test.ts` 25 · `money.test.ts` 24 ·
`day-status-compute.test.ts` 15 · `totp.test.ts` 14 · `claim-category-caps.test.ts` 14.

## 11. The plans are honest

This deserves saying, because it is unusual. `plans/phase-0` shows **Gate G0 with 6 of 7 boxes unticked**
and each blocker named with its external dependency. Stage 1.9's exit criteria explicitly read
*"not met as product — these screens are shells until their phase backends land. They are complete as UI,
which is what this stage claims and all it claims."* Stage 1.1 and 0.6 both carry "on the MOCK connector"
in the status line. The two overclaims I found ([I1], [I2]) are real but partially self-disclosed —
this is a tracker written by someone trying to tell the truth, and it made this audit faster.
