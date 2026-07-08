# Phase 0 — Foundations & De-risking

**Target:** 3 weeks · **Gate:** G0 · **Spec:** docs/13 §3, docs/14
**Purpose:** repo, pipeline, auth/RBAC, employee master, and the two highest-risk spikes (Kent + scale) proven — before any feature build.

> Stage 0.1 starts **day 1** and runs in parallel with everything else. Stages 0.2 → 0.5 are sequential-ish; 0.6 runs as soon as its inputs exist.

---

## Stage 0.0 — Project skeleton (setup only — zero HRMS code)   `[ ☑ done 6 Jul 2026 ]`
**Goal:** frontend and backend exist as complete projects with DB tooling and every quality gate wired — nothing domain-specific yet.
**Depends on:** nothing.
**Decisions taken at setup time (sponsor, 6 Jul 2026):** **`frontend/` and `backend/` are FULLY INDEPENDENT projects** — separate teams will own them; each has its own `package.json`, `node_modules`, tsconfig, eslint, knip, prettier; no root workspace, no shared `packages/` (docs/02 layout amended). Consequences: tokens/UI kit live in `frontend/src/{tokens,ui}`; the **Money module lives ONLY in `backend/src/core/money`**; the frontend↔backend contract is **API-first** (typed RPC emitting OpenAPI; frontend consumes a generated client). · **No Docker** (sponsor preference) — local dev uses the machine's native PostgreSQL on 5432 (create `hrms` user + db once, see `backend/.env.example`). · Node 22 locally, engines `>=22`, **production target Node 24 LTS** (doc 14). · npm (pnpm blocked by machine permissions).
**Tasks:**
- [x] `backend/`: Express 5 + TS skeleton — app factory, `/health` only, zod-validated env, pino logger (sensitive-field redaction), Kysely + pg pool (empty DB interface), `migrations/` (node-pg-migrate + ts-node), Vitest + supertest smoke test (3 tests) — **plus own max-strict tsconfig, eslint, knip, dependency-cruiser (module-boundary rules), prettier, `.env.example`**
- [x] `frontend/`: Vite 7 + React 19 + Tailwind v4 skeleton — placeholder page only — **plus own max-strict tsconfig, eslint, knip, prettier**
- [x] CI (`.github/workflows/ci.yml`): two independent jobs, one per project, each running its own `verify`
- [x] Local database: native PostgreSQL (no Docker — removed on sponsor request); setup documented in `backend/.env.example`/README
- [x] Both projects: `npm install` clean; **`npm run verify` exits 0** (backend: typecheck → lint → knip → depcruise → test → build · frontend: typecheck → lint → knip → build)
**Exit criteria — all verified 6 Jul 2026:** ✅ both verifies green (exit 0) independently · ✅ `/health` responded live on :5199 with the correct envelope · ✅ `npm run migrate` connected to Postgres 16 and completed ("No migrations to run!", `pgmigrations` table created).

## Stage 0.1 — External dependency chase + security hygiene   `[ ☐ ]`
**Goal:** unblock the build's two hard external dependencies and close known credential leaks — asks sent day 1.
**Depends on:** nothing. Chase relentlessly; everything in Phase 1–2 hangs on these.
**Tasks:**
- [ ] P0-T01 — Kent/Astra access method (DB view / REST / SFTP-CSV) confirmed with IT *(blocks Phase 1)*
- [ ] P0-T02 — Read-only greytHR **admin** login; capture: salary structures per grade, one month's Final Pay Register + Bank file + JV, statutory file formats (ECR/ESIC/PT/24Q), workflow configs, attendance policy (grace/half-day/penalty/GCS Saturday/OT rates), full employee master export incl. inactive, leave policy config, loan register, holiday calendars *(09-RECON §8 checklist)*
- [ ] P0-T03 — Bank bulk-upload file format from Finance
- [ ] P0-T04 — Payslip template sign-off (09-RECON §2 is the reference)
- [ ] P0-T05 — Exact per-entity headcount confirmed (capacity sign-off input). *Part-answered by the live EMS read (doc 11 §0): 1,066 in the EMS master — confirm this covers all on-roll (blue-collar too?) vs the ~3k figure.*
- [ ] P0-T06 — The 9 statutory policy decisions (10 §15) signed: PF base, bonus true-up, LOP divisor, OT base, DA/VDA, penalty→pay, gratuity 5y/4y240d, grade structures, sample formats. **Plus 2026 Labour Codes verification** (F&F TAT, wages ≥50% CTC — 10 §8)
- [ ] P0-T07 — Rotate leaked credentials: greytHR password, EMS SSH, MinIO console (docs 09/11) — *still open after the 6 Jul Mongo read (Atlas URI also seen)*
- [ ] P0-T08 *(new — from doc 11 §0.2 / doc 00 D3 update)* — **Entity-scope confirmations from HR:** (a) which small India entities actually run payroll through this HRMS (eHoome iOT, Koove iOT, Koove Organic, Rashmi Rare Earth) vs. group companies out of scope; (b) canonical legal name of "Rashmi 6 Paradigm Limited" (suspected typo); (c) confirm the 5 foreign entities (RPF Dubai, Reach Mining Tanzania, RM UK, RM Bahrain, Rashmi Group holding) stay master-only / out of India payroll
- [~] P0-T09 *(new)* — **Read-only EMS Mongo export** for the employee-master seed (users collection, 1,066 rows) — we have evidence of access; formalize a sanctioned export + freeze a snapshot date with IT. *Progress 7 Jul 2026: read-only taxonomy/schema recon done (no PII) → `docs/recon/ems-master-taxonomy.md` (14 entities + counts, 112 departments, 176 designations, e-code prefixes, travel tiers, data-quality counts). The sanctioned frozen-snapshot export itself still pending IT.*
**Exit criteria:** Kent method confirmed in writing · admin-recon artifacts archived in repo (`docs/recon/`) · all 9+1 policy decisions recorded with owner sign-off in `core.settings` seed notes · entity-scope answers recorded (P0-T08) · EMS users snapshot secured (P0-T09) · credentials rotated (confirmed by IT).

## Stage 0.2 — Scaffold, tooling, CI, deploy   `[ ◐ in progress ]`
**Goal:** every machine-enforced quality gate live from commit #1; deploy machinery ready.
**Depends on:** nothing.
**Tasks:**
- [x] P0-T10 — Scaffold: `frontend` (React 19 + Vite 7 + Tailwind v4), `backend` (Express 5 + TS), `backend/migrations` (node-pg-migrate) *(done in Stage 0.0)*
- [x] doc14-T1 — Max-strict tsconfig + type-aware eslint (`no-floating-promises`) + knip + dependency-cruiser boundary rules *(done in Stage 0.0)*
- [x] doc14-T1 — **Money module** (`backend/src/core/money/`): integer-paise branded `Paise` type, `percentBp`/`mulDiv` integer math, single rounding-policy file (PF nearest-rupee, ESIC round-UP, TDS, gratuity, net, OT) — **27 hand-computed statutory tests green; caught + fixed an arithmetic error in doc 10's G8 gratuity fixture** *(6 Jul 2026)*
- [x] doc14-T1 — Kysely setup + `core.*` table types in `src/core/db/types.ts` *(raw-SQL lint ban: add custom rule when first repository lands)*
- [x] doc14-§3 — **oRPC (decided over tRPC — tRPC's type-sharing violates the independent-teams boundary)** mounted in Express: `src/api/{orpc,router,handler}.ts` + first module (`modules/system`) with a zod-output-validated procedure at `GET /api/system/health`; **OpenAPI contract served at `/api/openapi.json`** — the frontend team generates its typed client from this *(6 Jul 2026; 3 API tests green)*
- [~] P0-T11 — Deploy machinery: `scripts/deploy.sh` (freeze-file check → pull → verify → migrate → build → `pm2 reload`) + `ecosystem.config.cjs` **written**; staging vhost + PgBouncer ≥1.21 setup = **server task, pending access**
- [ ] P0-T13 — Observability baseline: pino ✓ (with redaction); OTel wiring, GlitchTip, PM2 monit + alert cron = pending server
- [x] CI pipeline: two independent jobs (backend/frontend), gate order typecheck → eslint → knip → depcruise → test → build *(Testcontainers integration stage added when first DB test lands)*
**Exit criteria:** fresh clone → `npm install && npm run verify` green in both projects ✅ (6 Jul 2026) · Money rounding tests pass ✅ · staging deploy via script works ⏳ (server access) · deliberate cross-module import fails CI ⏳ (test on first PR).

## Stage 0.3 — Design system port (`frontend/src/tokens` + `frontend/src/ui`)   `[ ◐ in progress ]`
**Goal:** the Warm Editorial component kit ready so every later screen composes, never invents.
**Depends on:** 0.2.
**Tasks:**
- [x] P0-T12 — Tokens ported verbatim from docs/05 §1 (light + dark + radii) incl. motion tokens (05 §2.2) → `frontend/src/tokens/tokens.css`, mapped into the Tailwind theme (`bg-surface`, `text-ink`, `rounded-card`…); tabular-nums utility *(6 Jul 2026)* + **pattern utilities** in `index.css` (warm canvas gradient, `u-grain` hero texture, `u-hatch` diagonal, `u-press` scale-0.97, focus-visible ring, reduced-motion) + `--canvas-glow` token *(6 Jul 2026)*
- [~] P0-T12 — Port/build primitives: **done** — Button (5 variants × 7 states), IconButton, Card/CardHeader, DarkCard (grain), Pill/StatusBadge (icon+label, 5 tones), KpiNumber (count-up once, reduced-motion, en-IN tabular), **TextField** (label-above per §284, blur-validated error with `role="alert"`, `aria-invalid`/`aria-describedby`, leading-icon + password-reveal, ref-forwarded for focus-first-invalid), **DataTable** (virtualized >50 via @tanstack/react-virtual, sticky header, right-aligned numerics, hover-wash / solid-gold-selected per doc 12 §7.4, keyboard-activatable rows), **Drawer** (right slide, `--ease-drawer`, scrim+Esc close, scroll-lock, focus in/restore), **ConfirmModal** (centered, **typed-confirmation** variant), **EmptyState**, **Timeline** (approval-chain, 4 states). **FilterPanel + MonthCalendar done 8 Jul 2026** (see below) — primitive port complete
- [~] P0-T12 — Crextio-signature set: **done** — KpiPillRow (4-state), HatchFill, SegmentedProgress (tri-segment), IconButton, DotMatrix. **Remaining:** RosterGrid, ApprovalInbox *(05 §5, 12 §7)*
- [~] App shell: **done** — masthead + gold-active pill-nav + ⌘K search stub + theme toggle (light↔dark, persisted, system-aware) in `frontend/src/App.tsx` gallery; gallery now demos row→drawer, typed-confirm finalize, empty-state. **Remaining:** per-role nav skeleton (08 §3), real routing
- [ ] **Tests + a11y (exit-criteria gap):** frontend has no test runner yet (Vitest+Testing Library+axe) — add it, then cover all 7 states per component in both themes. *This is the remaining blocker for Stage 0.3 sign-off.*
**Delivered 6 Jul 2026:** `frontend/src/ui/` (cn, theme, ThemeToggle, Button, IconButton, Card, DarkCard, StatusBadge, KpiNumber, HatchFill, KpiPillRow, SegmentedProgress, DotMatrix, DataTable, Drawer, ConfirmModal, EmptyState, Timeline, index barrel) + interactive gallery in `App.tsx`. **`npm run verify` green (typecheck → lint → knip → build, exit 0).** lucide-react + @tanstack/react-virtual added (both sanctioned by §5/§7). Zero hardcoded hex in components (all via tokens/`color-mix`).
**Delivered 8 Jul 2026 — §5 inventory completion:** **Toast** (sonner — spec-named dep — Warm Editorial theme, aria-live polite per kill-list #10, Undo-action per #6), **form vocabulary** (**Select** — ARIA combobox/listbox, `aria-activedescendant`, typeahead, scale-from-trigger; **DatePicker** — ISO value / `DD MMM YYYY` display, IST today, keyboard arrows cross month edges, min/max; **Textarea** with warning-toned live counter; **Checkbox** gold-check; **Switch** gold-track `role="switch"`), **feedback layer** (**Skeleton** `.u-shimmer`, reduced-motion-safe; **Tooltip** — charcoal pill per 12 §7, delayed-first/instant-adjacent per 05 §2.3, focus + Escape), **FilterPanel/FilterSection** (accordion — instant per frequency test, async skeleton facets, Clear-all + active-count), **MonthCalendar** (Monday-first grid via shared `calendar.ts`, hatched week-offs, gold today-ring as the view's one accent, state dots + auto legend + per-day aria-labels, note tooltips, roving-tabindex arrow nav). Gallery now exercises: apply-leave drawer (`pages/leave/` — draft survives close per kill-list #4, error → focus-first-invalid), people-filter drawer (`pages/people/` — selections persist per #2), skeleton facet load, approve-with-Undo toast, finalize-ceremony toast, masthead tooltips. **`npm run verify` green.** Deferred to module phases by design: RosterGrid + ApprovalInbox (Phase 1 composites), payroll Stepper (Phase 2), ⌘K palette (ships with real routing/shell).
**Tests required:** Testing Library component tests (all 7 interactive states per component — 05 §7b); axe accessibility checks in both themes.
**Exit criteria:** Storybook-style demo page renders every component in light+dark ✅ (gallery, live toggle) · contrast checks pass 4.5:1 ⏳ (needs axe run) · zero hardcoded hexes ✅ (lint-clean, tokens only) · component tests ⏳.

## Stage 0.4 — Auth, RBAC, audit, settings, notifications   `[ ☑ done 7 Jul 2026 ]`
**Goal:** the security + configuration spine every module hangs on.
**Depends on:** 0.2. ~~Local blocker~~ **resolved 7 Jul 2026: DATABASE_URL provided; migration 0001 applied to the live Postgres.**
**Tasks:**
- [x] P0-T20 — Auth **built + integration-tested live (7 Jul 2026)**: oRPC procedures `login/refresh/logout/me`; JWT HS256, 15 min access + 7 d refresh in httpOnly cookie (path-scoped `/api/auth`, rotated on every use); bcrypt; **lockout after 5 failures with exponential backoff** (15→30→60→120 min, DB-backed — proven in test incl. "correct password stays refused while locked"); uniform failure responses (no user-enumeration oracle); every auth event audited with IP. *SSO-against-ATS validation = pending ATS-side change.* *(NFR-03)*
- [x] P0-T21 — RBAC **live**: migration 0001 applied; **seeded 10 roles / 38 permissions / 155 grants** from 08 §1–2 (idempotent `npm run seed:rbac`); §2 hard-rule proven in integration test (it_admin ∌ compensation.read). *Remaining elsewhere: `core.reporting_tree` closure → Stage 0.5 (needs employees); per-role nav shells → frontend team.* *(CORE-10)*
- [x] P0-T22 — `core.audit_log` **live and proven**: UPDATE/DELETE rejected by the DB itself (tested); **hash chain** (sha256 per row, advisory-lock serialized); `core.verify_audit_chain()` **caught a deliberately forged row in the integration test, then confirmed the restored chain** *(CORE-11, doc 14 §7.4, MCA rule)*
- [x] P0-T23 — `core.settings` **live**: typed reads (`getTypedSetting` with zod per value_type), **audited writes** (old→new lands in the hash chain — tested), authed read procedures `GET /api/settings[/{key}]`. *Write endpoint arrives with the permission-enforcement layer.*
- [x] P0-T24 — Notification skeleton **live (7 Jul 2026)**: `wf.notifications` queue (claim via FOR UPDATE SKIP LOCKED) + `wf.event_subscriptions` recipient matrix (role/user/email fan-out) + pluggable transport (dev-log now, SMTP when server creds exist) + **retry → dead-letter proven in test** (5 attempts → status 'dead', never silently dropped) *(WF-02)*
- [x] *(added — sponsor requirement 7 Jul 2026)* **Central runtime access control on EVERY API**: `withPermission(code)` gate in `api/orpc.ts` (every business procedure declares one permission) + **RBAC admin API** (`/api/rbac/matrix`, grant/revoke permission↔role, assign/remove user↔role — all audited) — **integration-proven: revoke → 403 on the very next request, grant back → 200, no restart** *(CORE-10, PI-ESS-2 access matrix)*
**Modules/files:** `backend/src/modules/{auth,settings}/`, `backend/src/core/{audit,auth,rbac}/`, `backend/migrations/0001…`
**Tests:** 47 total green (verify exit 0), incl. 8 live-DB integration tests: seed sanity, hard rule, append-only, tamper detection, lockout/backoff, full login→me→refresh-rotation→logout, garbage-token 401s, audited settings round-trip.
**Exit criteria:** ~~tamper-detection test green~~ ✅ · permission grid matches 08 §2 ✅ (seed + hard-rule test) · login against ATS on staging ⏳ (ATS-side + server task).

## Stage 0.5 — Org structure + employee master + two-source import   `[ ☑ done 7 Jul 2026 — pipeline proven on mock fixtures; real EMS/greytHR snapshots swap in via P0-T09/T02 ]`
**Goal:** the single most important table populated with real, validated data — **seeded from the live EMS master (1,066 employees), enriched from greytHR** (doc 11 §0.1 decision).
**Depends on:** 0.4 (audit/RBAC), Stage 0.1 P0-T02 (greytHR export), P0-T08/T09 (entity answers + EMS snapshot).
**Tasks:**
- [x] P0-T30 — Org tables **live** (migration 0003): companies = **canonical entity master seeded (13 canonical of 14 raw — "Rashmi Metalix Ltd" is the dup that merges into RML)** with e-code prefixes + `is_india_payroll` flags; locations, cost_centers, departments, org_units, designations, grades; **e-code generator as atomic DB fn — 20 concurrent calls → 20 unique codes proven** *(CORE-02)*
- [x] P0-T31 — `core.employees` **live** (full docs/03 §3 column set; enrich-fed columns NULLable until the Phase-2 tightening gate — documented in the migration header); `employee_history`, `employee_family`, `documents`; exited-requires-DOL CHECK (PP-17); **reporting-tree closure table + statement-level rebuild trigger — cross-entity depth-2 subtree proven (KQ)**
- [x] P0-T32a — **Import step 1 (EMS seed) built + proven on mock fixtures**: company canonicalization ("Rashmi Metalix Ltd"→RML, "Rashmi 6 Paradigm"→RPL ✓ tested), strict e-code series check (**catches EIPLL366-style typos** ✓), department/designation normalization (case/whitespace variants merge ✓), RM/HOD two-pass linking, **EMS bcrypt hashes → login works day one** ✓, exception report (nothing silent) *(CORE-12)*
- [x] P0-T32b — **Import step 2 (greytHR enrich) built + proven**: matches on `userid`, fills DOB/DOJ/category/PAN/Aadhaar/UAN/PF/bank; unmatched userids reported ✓
- [ ] P0-T33 — Directory + profile UI shell (05 §4.2) — **frontend team** (design system components exist in `frontend/src/ui`)
- [ ] *(data swap)* Re-run both imports with the REAL EMS snapshot (P0-T09) + greytHR export (P0-T02) once secured — the pipeline is ready
**Modules/files:** `backend/src/modules/{org,employees,documents,import}/`, `frontend/src/pages/people/`
**Tests required:** validator unit tests per CORE-08 rule; company-dedupe + designation/department-normalization fixtures; e-code concurrency test; two-source merge test (EMS row + greytHR row → one employee); import round-trip integration test.
**Exit criteria:** 1,066 EMS rows loaded + enriched, reconciliation counts match both sources, exception report (typos/unmatched) reviewed by HR ops · concurrent e-code test green · SeaweedFS up with nightly mirror configured.

## Stage 0.6 — De-risk spikes   `[ ☑ done 7 Jul 2026 — with the MOCK connector (sponsor decision: no Kent access yet); real Kent = swap one class ]`
**Goal:** kill the two unknowns that could sink later phases — with measurements, not opinions.
**Depends on:** 0.2; ~~P0-T01 for the Kent spike~~ → **mocked per sponsor (7 Jul 2026)**; P0-T01 still owed by IT for the real swap.
**Tasks:**
- [x] P0-T40 — **Ingestion spike (mock)**: migration 0004 live — `att.swipe_events` **monthly-partitioned from day one** (auto `ensure_swipe_partition`), **append-only by trigger**, idempotency key `(employee_no, swipe_ts, door_code)`; `att.devices` last-seen heartbeat + `findSilentDevices` (the PP-9 pager); `att.ingest_watermarks` advanced only in-transaction. **`MockKentConnector`** (deterministic, realistic: IN/OUT jitter, lunch pairs, cross-plant punches, received-at lag, offline-door simulation) behind the **`KentConnector` interface — real Kent (DB/REST/CSV per P0-T01) swaps in with zero pipeline changes.** Proven in tests: full-day ingest, re-ingest = 0 dupes, full replay = 0 dupes, unknown e-code → NULL-employee exception queue, silent-door detection, FILO aggregate ✓
- [x] P0-T41 — **Scale spike run**: 3,000 employees × 14 days = **96,642 swipes ingested in 2.2 s (43,529 rows/s)** through the real pipeline; full-duplicate replay → **0 inserts in 0.11 s**; FILO aggregate over 42,000 employee-days in **0.15 s**. Results + conclusions in `docs/recon/scale-spike.md`; **partitioning strategy frozen**. Re-run on the production box before G0 (same script: `npx tsx scripts/scale-spike.ts`)
**Exit criteria:** ~~scale numbers recorded~~ ✅ · ~~partitioning frozen~~ ✅ · one real day of REAL Kent data ⏳ (blocked on P0-T01 — the only remaining piece).

---

## Gate G0 — Phase 0 sign-off

**Status 7 Jul 2026: all locally-executable work DONE (backend verify 0, 66 tests incl. 27 live-DB integration; frontend verify 0). Remaining gate items are EXTERNAL — data, server, and IT dependencies:**

- [ ] Employee master loaded with REAL data: EMS seed (1,066) + greytHR enrichment — *pipeline built + proven on fixtures; needs the P0-T09 snapshot + P0-T02 export*
- [ ] SSO works against the ATS — *needs ATS-side JWT validation change*
- [ ] Deploy pipeline + PgBouncer proven on staging — *needs server access (P0-T11/T13)*
- [ ] One REAL day of Kent swipes ingested — *pipeline proven with mock; needs P0-T01 access method from IT*
- [x] Scale-spike numbers acceptable; partitioning frozen *(docs/recon/scale-spike.md — re-run on prod box at sign-off)*
- [ ] Stage 0.1 external dependencies resolved (or escalated with dates)
- [ ] Sponsor + IT sign-off recorded
