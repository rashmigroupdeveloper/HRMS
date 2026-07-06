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
- [ ] P0-T09 *(new)* — **Read-only EMS Mongo export** for the employee-master seed (users collection, 1,066 rows) — we have evidence of access; formalize a sanctioned export + freeze a snapshot date with IT
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
- [x] P0-T12 — Tokens ported verbatim from docs/05 §1 (light + dark + radii) incl. motion tokens (05 §2.2) → `frontend/src/tokens/tokens.css`, mapped into the Tailwind theme (`bg-surface`, `text-ink`, `rounded-card`…); tabular-nums utility *(6 Jul 2026)*
- [ ] P0-T12 — Port/build: Card, DarkCard, Pill/StatusBadge, KpiNumber, DataTable (virtualized ≥50 rows), FilterPanel, Drawer, Timeline, EmptyState, ConfirmModal (typed-confirm variant), MonthCalendar
- [ ] P0-T12 — Crextio-signature set: KpiPillRow, HatchFill, SegmentedProgress, IconButton, DotMatrix, RosterGrid, ApprovalInbox *(05 §5, 12 §7)*
- [ ] App shell: masthead + pill-nav + ⌘K stub + theme toggle; per-role nav skeleton (08 §3)
**Tests required:** Testing Library component tests (all 7 interactive states per component — 05 §7b); axe accessibility checks in both themes.
**Exit criteria:** Storybook-style demo page renders every component in light+dark · contrast checks pass 4.5:1 · zero hardcoded hexes (lint rule).

## Stage 0.4 — Auth, RBAC, audit, settings, notifications   `[ ◐ in progress ]`
**Goal:** the security + configuration spine every module hangs on.
**Depends on:** 0.2. **Local blocker: needs the `hrms` database created on the native Postgres (creds are the user's) before migrations can run.**
**Tasks:**
- [ ] P0-T20 — Auth: JWT issuer (15 min access + 7 d refresh httpOnly) + bcrypt + lockout/backoff; SSO tokens the ATS can validate *(NFR-03)*
- [~] P0-T21 — RBAC: **migration 0001 written** (`core.{users,roles,permissions,role_permissions,user_roles}`) + **seed data encoded verbatim from 08 §1–2** (`src/core/rbac/seed-data.ts`, 10 roles × 38 permissions × scope semantics) with a consistency test suite asserting the §2 hard rules (it_admin never sees compensation; managers never override attendance; reopen = super_admin only; two-person finalize). Remaining: run migration, seed loader, `core.reporting_tree` closure, per-role nav shells *(CORE-10)*
- [~] P0-T22 — **`core.audit_log` migration written**: append-only (UPDATE/DELETE-rejecting trigger) + **hash-chained** rows (sha256 per row, advisory-lock serialized) + `core.verify_audit_chain()` tamper-detection function *(CORE-11, doc 14 §7.4)*. Remaining: run migration + integration test proving tamper detection
- [~] P0-T23 — **`core.settings` migration written** (typed JSONB key-value + description + updated_by). Remaining: settings service + zod validation per value_type
- [ ] P0-T24 — Notification skeleton: `wf.notifications` queue (in-app + SMTP), templates, retry + dead-letter, `wf.event_subscriptions` matrix *(WF-02)*
**Modules/files:** `backend/src/modules/{auth,rbac,audit,settings,notifications}/`
**Tests required:** integration tests asserting: lockout, refresh rotation, permission denial, audit-chain verification fn detects a tampered row, notification retry→dead-letter.
**Exit criteria:** login against ATS with one token works on staging · permission grid export matches 08 §2 · tamper-detection test green.

## Stage 0.5 — Org structure + employee master + two-source import   `[ ☐ ]`
**Goal:** the single most important table populated with real, validated data — **seeded from the live EMS master (1,066 employees), enriched from greytHR** (doc 11 §0.1 decision).
**Depends on:** 0.4 (audit/RBAC), Stage 0.1 P0-T02 (greytHR export), P0-T08/T09 (entity answers + EMS snapshot).
**Tasks:**
- [ ] P0-T30 — Org tables: companies = **canonical 14-entity master with dedupe rules** (doc 11 §0.2): merge "Rashmi Metalix Ltd"→RML; e-code prefixes per doc 11 §6.3 (RML/RGH/RDL/RPL/EIP/KIO/KOL/RRE/RPF/RMT/RMB/RBS/RAS); `is_india_payroll` flag (5 foreign entities = false); locations, cost_centers, departments, org_units, designations, grades; e-code generator as DB fn with `FOR UPDATE` *(CORE-02)*
- [ ] P0-T31 — `core.employees` + all CORE-01..08 validations (PAN/Aadhaar/IFSC/bank/DOB-minor/duplicates/CTC-vs-breakup); statutory-ID masking by permission; `employee_history`, `employee_family`, `documents` (object-store keys via **storage adapter → SeaweedFS**, doc 14 §4)
- [ ] P0-T32a — **Import step 1 (EMS seed):** load the EMS `users` snapshot keyed on `userid` (= greytHR e-code): identity, gender, phone, company (canonicalized), department/designation (normalized — 112/176 distinct values need mapping tables), `reporting_manager_id`→RM, `hod_id`→functional manager, bcrypt hashes (users can log in day one); flag `userid` typos (e.g. EIPL0346 vs EIPLL366) into an exception report *(CORE-12, doc 11 §0.1)*
- [ ] P0-T32b — **Import step 2 (greytHR enrich):** match on the same `userid`, fill what EMS lacks: DOB, DOJ, grade, CTC/statutory IDs (PAN/Aadhaar/UAN/ESIC), bank, PF/ESI numbers; per-row validation report; reconciliation counts vs both sources; unmatched-in-either list for HR review
- [ ] P0-T33 — Directory + profile UI shell (05 §4.2), compensation tab masked
**Modules/files:** `backend/src/modules/{org,employees,documents,import}/`, `frontend/src/pages/people/`
**Tests required:** validator unit tests per CORE-08 rule; company-dedupe + designation/department-normalization fixtures; e-code concurrency test; two-source merge test (EMS row + greytHR row → one employee); import round-trip integration test.
**Exit criteria:** 1,066 EMS rows loaded + enriched, reconciliation counts match both sources, exception report (typos/unmatched) reviewed by HR ops · concurrent e-code test green · SeaweedFS up with nightly mirror configured.

## Stage 0.6 — De-risk spikes   `[ ☐ ]`
**Goal:** kill the two unknowns that could sink later phases — with measurements, not opinions.
**Depends on:** 0.2; P0-T01 for the Kent spike.
**Tasks:**
- [ ] P0-T40 — **Kent spike:** KentConnector behind the interface for the confirmed access method; pull one real day of swipes end-to-end into `att.swipe_events` (idempotent upsert, watermark + 30-min overlap, gap detection). Confirm push-vs-pull; if push (webhook/iclock-style), the ACK-after-commit rule (doc 14 §8.2)
- [ ] P0-T41 — **Scale spike:** synthetic 3k AND 10k × 60 days of swipes; measure partition strategy, muster MV refresh, dashboard snapshot build; freeze partitioning + the documented scale-up trigger on measured numbers
**Exit criteria:** one real day of Kent data visible in staging with zero dupes on re-run · scale numbers recorded in `docs/recon/scale-spike.md` · partitioning plan frozen.

---

## Gate G0 — Phase 0 sign-off
- [ ] Employee master loaded + validated: EMS seed (1,066) + greytHR enrichment, reconciled to both sources; entity master canonicalized (14 → deduped, India-payroll flags set per P0-T08 answers)
- [ ] SSO works against the ATS
- [ ] Deploy pipeline + PgBouncer proven on staging
- [ ] One real day of Kent swipes ingested idempotently
- [ ] Scale-spike numbers acceptable; partitioning + trigger frozen
- [ ] Stage 0.1 external dependencies resolved (or escalated with dates)
- [ ] Sponsor + IT sign-off recorded
