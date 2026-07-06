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
- [ ] P0-T05 — Exact per-entity headcount confirmed (capacity sign-off input)
- [ ] P0-T06 — The 9 statutory policy decisions (10 §15) signed: PF base, bonus true-up, LOP divisor, OT base, DA/VDA, penalty→pay, gratuity 5y/4y240d, grade structures, sample formats. **Plus 2026 Labour Codes verification** (F&F TAT, wages ≥50% CTC — 10 §8)
- [ ] P0-T07 — Rotate leaked credentials: greytHR password, EMS SSH, MinIO console (docs 09/11)
**Exit criteria:** Kent method confirmed in writing · admin-recon artifacts archived in repo (`docs/recon/`) · all 9+1 policy decisions recorded with owner sign-off in `core.settings` seed notes · credentials rotated (confirmed by IT).

## Stage 0.2 — Monorepo scaffold, tooling, CI, deploy   `[ ☐ ]`
**Goal:** the `rashmi-hrms` monorepo with every machine-enforced quality gate live from commit #1.
**Depends on:** nothing.
**Tasks:**
- [ ] P0-T10 — Scaffold monorepo: `frontend` (React 19 + Vite + Tailwind v4), `backend` (Node 24 + Express 5 + TS), `backend/migrations` (node-pg-migrate)
- [ ] doc14-T1 — Max-strict tsconfig (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) + type-aware eslint (`no-floating-promises`) + knip + dependency-cruiser boundary rules
- [ ] doc14-T1 — **Money module**: integer-paise branded type + single rounding-policy file (PF nearest-rupee, ESIC round-up, …)
- [ ] doc14-T1 — Kysely setup + DB types generation; raw-SQL-outside-`sql`-tag banned by lint
- [ ] doc14-§3 — Typed RPC layer (oRPC/tRPC) mounted in Express; zod input+output on the first health/auth procedures; `{success,data,error,meta}` envelope kept for external endpoints only
- [ ] P0-T11 — Deploy script (build → migrate → `pm2 reload`), staging vhost + DB, **PgBouncer ≥1.21** (`max_prepared_statements` set), deploy-freeze flag
- [ ] P0-T13 — Observability baseline: pino structured logs → OTel; GlitchTip error tracking; PM2 monit; disk/CPU/queue-depth alert cron
- [ ] CI pipeline (blocking order): typecheck → eslint → knip → depcruise → unit → integration (Testcontainers Postgres) → smoke
**Modules/files:** repo root, `.github/workflows/`, `ecosystem.config.js`, `backend/src/core/money/`
**Tests required:** Money module unit tests (rounding table); CI proves itself by failing on a seeded violation.
**Exit criteria:** fresh clone → `npm install && npm run verify` green · staging deploy via script works · a deliberate cross-module import fails CI · Money rounding tests pass.

## Stage 0.3 — Design system port (`frontend/src/tokens` + `frontend/src/ui`)   `[ ☐ ]`
**Goal:** the Warm Editorial component kit ready so every later screen composes, never invents.
**Depends on:** 0.2.
**Tasks:**
- [ ] P0-T12 — Port tokens verbatim from ATS `index.css` (05 §1) incl. motion tokens (05 §2.2)
- [ ] P0-T12 — Port/build: Card, DarkCard, Pill/StatusBadge, KpiNumber, DataTable (virtualized ≥50 rows), FilterPanel, Drawer, Timeline, EmptyState, ConfirmModal (typed-confirm variant), MonthCalendar
- [ ] P0-T12 — Crextio-signature set: KpiPillRow, HatchFill, SegmentedProgress, IconButton, DotMatrix, RosterGrid, ApprovalInbox *(05 §5, 12 §7)*
- [ ] App shell: masthead + pill-nav + ⌘K stub + theme toggle; per-role nav skeleton (08 §3)
**Tests required:** Testing Library component tests (all 7 interactive states per component — 05 §7b); axe accessibility checks in both themes.
**Exit criteria:** Storybook-style demo page renders every component in light+dark · contrast checks pass 4.5:1 · zero hardcoded hexes (lint rule).

## Stage 0.4 — Auth, RBAC, audit, settings, notifications   `[ ☐ ]`
**Goal:** the security + configuration spine every module hangs on.
**Depends on:** 0.2.
**Tasks:**
- [ ] P0-T20 — Auth: JWT issuer (15 min access + 7 d refresh httpOnly) + bcrypt + lockout/backoff; SSO tokens the ATS can validate *(NFR-03)*
- [ ] P0-T21 — RBAC: `core.{roles,permissions,role_permissions,user_roles}` seeded verbatim from 08 §1–2; `core.reporting_tree` closure (trigger-maintained, company-agnostic); per-role nav shells wired *(CORE-10)*
- [ ] P0-T22 — `core.audit_log` append-only (INSERT-only trigger) + **hash-chained** rows (doc 14 §7.4, MCA rule); auth events with IP *(CORE-11)*
- [ ] P0-T23 — `core.settings` typed key-value store (audited) — every policy number's home
- [ ] P0-T24 — Notification skeleton: `wf.notifications` queue (in-app + SMTP), templates, retry + dead-letter, `wf.event_subscriptions` matrix *(WF-02)*
**Modules/files:** `backend/src/modules/{auth,rbac,audit,settings,notifications}/`
**Tests required:** integration tests asserting: lockout, refresh rotation, permission denial, audit-chain verification fn detects a tampered row, notification retry→dead-letter.
**Exit criteria:** login against ATS with one token works on staging · permission grid export matches 08 §2 · tamper-detection test green.

## Stage 0.5 — Org structure + employee master + import   `[ ☐ ]`
**Goal:** the single most important table populated with real, validated data.
**Depends on:** 0.4 (audit/RBAC), Stage 0.1 P0-T02 (master export).
**Tasks:**
- [ ] P0-T30 — Org tables: companies (**seed all six**: RML, RGH, EIPL, RPF, RPL, RDL), locations, cost_centers, departments, org_units, designations, grades; e-code generator as DB fn with `FOR UPDATE` *(CORE-02)*
- [ ] P0-T31 — `core.employees` + all CORE-01..08 validations (PAN/Aadhaar/IFSC/bank/DOB-minor/duplicates/CTC-vs-breakup); statutory-ID masking by permission; `employee_history`, `employee_family`, `documents` (object-store keys via **storage adapter → SeaweedFS**, doc 14 §4)
- [ ] P0-T32 — Bulk Excel import with per-row validation report *(CORE-12)*; dry-run of greytHR export; reconciliation counts vs source
- [ ] P0-T33 — Directory + profile UI shell (05 §4.2), compensation tab masked
**Modules/files:** `backend/src/modules/{org,employees,documents,import}/`, `frontend/src/pages/people/`
**Tests required:** validator unit tests per CORE-08 rule; e-code concurrency test (parallel onboarding → no duplicates); import round-trip integration test.
**Exit criteria:** real headcount loaded, reconciliation counts match, validation report reviewed by HR ops · concurrent e-code test green · SeaweedFS up with nightly mirror configured.

## Stage 0.6 — De-risk spikes   `[ ☐ ]`
**Goal:** kill the two unknowns that could sink later phases — with measurements, not opinions.
**Depends on:** 0.2; P0-T01 for the Kent spike.
**Tasks:**
- [ ] P0-T40 — **Kent spike:** KentConnector behind the interface for the confirmed access method; pull one real day of swipes end-to-end into `att.swipe_events` (idempotent upsert, watermark + 30-min overlap, gap detection). Confirm push-vs-pull; if push (webhook/iclock-style), the ACK-after-commit rule (doc 14 §8.2)
- [ ] P0-T41 — **Scale spike:** synthetic 3k AND 10k × 60 days of swipes; measure partition strategy, muster MV refresh, dashboard snapshot build; freeze partitioning + the documented scale-up trigger on measured numbers
**Exit criteria:** one real day of Kent data visible in staging with zero dupes on re-run · scale numbers recorded in `docs/recon/scale-spike.md` · partitioning plan frozen.

---

## Gate G0 — Phase 0 sign-off
- [ ] Employee master loaded + validated for real headcount (reconciled to source)
- [ ] SSO works against the ATS
- [ ] Deploy pipeline + PgBouncer proven on staging
- [ ] One real day of Kent swipes ingested idempotently
- [ ] Scale-spike numbers acceptable; partitioning + trigger frozen
- [ ] Stage 0.1 external dependencies resolved (or escalated with dates)
- [ ] Sponsor + IT sign-off recorded
