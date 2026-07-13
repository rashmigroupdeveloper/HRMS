# AGENTS.md — how to work in this repository (read me first, every time)

This is the **Rashmi Group HRMS** — a custom platform replacing greytHR/Protiviti payroll,
absorbing the in-house ATS (recruitment) and the "Yatra Avedan" T&E system. It is a
**10-year, money-and-compliance-critical** system. Treat it that way.

---

## 0. PRIME DIRECTIVE — read `docs/` before you touch anything

**Before writing, editing, planning, or answering any non-trivial question about this project,
read the specification set in [`docs/`](docs/).** The docs are the source of truth; the code is
downstream of them. Do not infer behaviour from the code when a doc specifies it — the doc wins.
Do not invent a feature, column, rate, or screen that isn't traceable to a doc.

**Minimum reading before any work:** `docs/00` (what & why + decisions), then the doc(s) governing
your task from the map below, then **`docs/13`** (execution order) and **`docs/14`** (locked tech +
reliability rules). For UI work, `docs/05` + `docs/12` are mandatory. For payroll, `docs/04` + `docs/10`
are mandatory and are read *in full* before a line of money code.

If a task spans areas, read all relevant docs first. If the docs contradict each other, surface it —
don't silently pick one. If something isn't in the docs, ask; don't guess.

### Doc map (read in this order for full context: 00 → 14)

| Doc | What it is | Read when |
|---|---|---|
| `00-EXECUTIVE-SUMMARY` | Why the project exists, build-vs-buy, **locked decisions D1–D7** | Always, first |
| `01-REQUIREMENTS-PRD` | Every requirement with an ID (ATT-08, PAY-06…) + traceability matrix | Any feature work |
| `02-ARCHITECTURE` | Stack, WHM topology, integrations (Kent, ATS, email, SAP) — *amended by 14* | Backend/infra |
| `03-DATABASE-SCHEMA` | Every table & column with purpose; schemas `core/att/lv/pay/wf/…` | Any DB/migration work |
| `04-MODULE-SPECS` | Exact behaviour: attendance algo, leave accrual, OT 48h, **payroll calc order**, F&F | Feature logic, payroll |
| `05-UIUX-SPEC` | Warm Editorial design system, tokens, motion doctrine, **§0.1 firewall**, quality bar | **All UI work** |
| `06-REPORTS-AND-DASHBOARDS` | Every report's exact columns; CEO dashboard KPI formulas | Reports/dashboards |
| `07-ROADMAP` | Phases, gates, risk register | Planning/sequencing |
| `08-ROLES-AND-PERMISSIONS` | 10 roles, permission grid, per-role nav, workflow catalog | Auth/RBAC, nav, workflows |
| `09-GREYTHR-RECON-FINDINGS` | Live recon of real greytHR: leave types, salary components, TDS, shifts | Payroll/leave/attendance |
| `10-INDIA-PAYROLL-STATUTORY-REFERENCE` | PF/ESIC/PT/LWF/TDS rates, pseudocode, **golden fixtures G1–G10** | **All payroll/statutory** |
| `11-EXISTING-EMS-YATRA-AVEDAN` | The live T&E system; **§0 = the 1,066-employee master + 14 entities** | T&E, employee-master import |
| `12-VISUAL-REFERENCE-CREXTIO` | The design *feel* (Nixtio/Crextio); §7 real-screen signature patterns | UI work (with 05) |
| `13-MASTER-BUILD-PLAN` | **Executable step-by-step**: order, task IDs, "done", 3k→10k scale | Before building anything |
| `14-TECH-STACK-AND-RELIABILITY` | **Locked tech decisions + the reliability program**; amends 02 | Before building anything |

**Live execution tracker:** [`plans/`](plans/) — one file per phase, stages with checkboxes and gates.
The docs are the *spec*; tick progress in `plans/`. Update `plans/` as you complete work.

---

## 1. Non-negotiable working rules (from `docs/13 §1` + `docs/14`)

0. **One plan-stage at a time (sponsor preference).** Announce "Working on Phase X, Stage X.Y — <name>" BEFORE building; finish that stage, report, stop. Never silently roll into the next stage. Never delete `.md` files.
1. **Traceability** — every PR/commit references a requirement ID (`feat: ATT-08 …`). No feature exists that isn't in docs 01/04/06/08.
2. **Config over code** — every policy number (grace minutes, rates, thresholds, divisors) lives in `core.settings`. **Zero hardcoded policy values.**
3. **Ledgers, not counters** — leave balance, wallet, loan outstanding, PF/tax YTD are `SUM()` of immutable rows.
4. **Immutability at the DB, not just the app** — locked attendance/payroll + all audit/ledger/swipe tables are append-only via triggers.
5. **Test-first for money** — every statutory formula ships **golden-file tests to the rupee** (10 §13). Payroll-core targets 100% branch coverage; 80% floor elsewhere. Expected values are hand-computed, never produced by running the code.
6. **One design language — Warm Editorial only** (`docs/05 §0.1` firewall). **No MUI, no blue enterprise UI, no second component library, ever.** Compose from `frontend/src/ui`; never invent a primitive. Motion doctrine (05 §2) + the micro-frustration kill-list (05 §6: ≤2-click daily actions, state preservation, form autosave) are enforced.
7. **Explainable numbers** — every payslip line carries a `calc_note`; every KPI tile links to its underlying list.
8. **Prove the notification** — every workflow step records `notified_at` (the "approver never notified" bug must be impossible).
9. **Scale-safe by default** — partition big tables, isolate reporting reads (replica-ready), precompute dashboards, pool via PgBouncer. Never ship a full-table live aggregation on a hot path. Target: **provision for 3k, architect for 10k** (D6/D7).
10. **Accessible & localized by default** — contrast ≥ 4.5:1 in **both** themes, colour never the only signal, keyboard-complete with visible focus, reduced-motion respected. INR lakh/crore grouping, IST, `DD MMM YYYY` dates.

**Money discipline (docs/14 §6–7):** integer-paise branded `Money` type in app code; one rounding-policy file (PF → nearest rupee, ESIC → round **up**); floats never touch money; DB stays `NUMERIC`. Retro = **recompute + delta** (closed periods are never edited). Constraints are the spec: `NOT NULL`, `CHECK` on every money/date invariant, FKs always, temporal `EXCLUDE USING gist` on effective-dated rows.

---

## 2. Repository structure — two fully independent projects

```
frontend/   React 19 + Vite + Tailwind v4 (Warm Editorial). Own package.json, node_modules, configs.
backend/    Express 5 + TypeScript (max-strict) + Kysely + PostgreSQL 16. Own package.json, configs.
docs/       the specification set (source of truth)
plans/      the execution tracker (one file per phase)
```

- **Separate teams own each project.** No root workspace, no shared `packages/`. **Frontend never imports backend source, and vice versa.** The only contract between them is the **HTTP API** — typed RPC (oRPC) with **zod input *and* output** schemas, emitting OpenAPI; the frontend generates its client from that OpenAPI.
- **Backend module pattern** (Yatra Avedan / doc 14 §2): `modules/<x>/{controller,service,routes,repository}.ts`; each module exposes `index.ts`; deep cross-module imports are **CI-blocked** (dependency-cruiser). DB schema-per-module mirrors this.
- **Money module lives ONLY in `backend/src/core/money`.** Tokens/UI kit live ONLY in `frontend/src/{tokens,ui}`.
- Object storage via an **S3-compatible adapter → SeaweedFS** (not MinIO — EOL). Kent access via the `KentConnector` interface.
- Files ≤ ~400 lines, feature-folders. Response envelope `{ success, data, error, meta }` only on externally-consumed endpoints.

### 2b. The API pattern — every endpoint, no exceptions (CORE-10, sponsor rule)

Every API is an **oRPC procedure** with zod `.input()` AND `.output()`, registered in `backend/src/api/router.ts` (the OpenAPI contract regenerates itself). Three access tiers, all defined centrally in `backend/src/api/orpc.ts`:

```ts
base                              // public — login/health ONLY
authed                            // any logged-in user
withPermission('admin.settings')  // ← THE RULE for every business procedure:
```

- **Every business procedure declares exactly ONE permission code.** Which ROLES hold that permission lives in the DATABASE (`core.role_permissions`) — editable at runtime via the `/api/rbac/*` admin API (grant/revoke role↔permission, assign/remove user↔role), taking effect on the **next request**, fully audited. **Never hardcode a role check inside a handler.**
- New permission codes are added to `core/rbac/seed-data.ts` (the docs/08 §2 grid) + `npm run seed:rbac` (idempotent).
- Centralization pattern everywhere: policy numbers → `core.settings` (`getTypedSetting`/audited `setSetting`) · notification recipients → `wf.event_subscriptions` data (`enqueueEvent`) · sensitive mutations → `writeAudit()` (hash-chained; caller masks sensitive values) · DB access → Kysely only (raw SQL only inside the `sql` tag); new tables update `core/db/types.ts` in the same commit as the migration.

---

## 3. Definition of done (every change)

- Reads the relevant docs first; references a requirement ID.
- **`npm run verify` is green** in the project you touched (frontend: typecheck → lint → knip → build; backend: + dependency-cruiser → test → golden-master). Never hand-wave a red gate.
- Tests exist (TDD; money = golden/property tests first). No `console.log`, no hardcoded secrets or policy values, no `any`.
- UI: zero hardcoded hex (tokens/`color-mix` only), all 7 interactive states, contrast-checked in both themes.
- `plans/` updated to reflect what's done vs. remaining. Do not mark a Gate passed without its criteria met.
- **Human review is mandatory** on any diff touching `payroll-core/` or statutory data.

---

## 4. Reality anchors (facts established by live recon — see docs 09/11)

- **Employee master seed:** the live EMS `users` collection = **1,066 employees**, `userid` = greytHR e-code (`RML035384`) — the join key to greytHR/payroll. Seed from EMS, enrich from greytHR on `userid` (doc 11 §0.1).
- **14 legal entities**, not 6 (doc 11 §0.2). All in scope for the platform; the **India-payroll engine runs only for India entities** (`is_india_payroll`); dedupe "Rashmi Metalix Ltd" → RML on import.
- **Kent biometric feed** is the highest-risk integration and the root cause of the PP-9 200-employee mismatch — treat its de-risking (P0-T40) and the sync-watermark rule (14 §8.5) as load-bearing.

## 5. Security

Never commit secrets or policy values. Statutory-ID columns (PAN/Aadhaar/UAN/ESIC/bank) are permission-masked and never logged. Credentials shared in chat history (greytHR, EMS SSH, MinIO/Atlas) must be **rotated** — flag this, don't reuse casually. All recon access is read-only.

## 6. Commands + this-machine gotchas (learned the hard way — do not relearn)

**Commands** — backend (`cd backend`): `npm run dev` (:5100) · `verify` · `migrate` · `seed:rbac` · `test`. Frontend (`cd frontend`): `npm run dev` (:5173, proxies `/api`) · `verify`.

- **npm, NOT pnpm** (corepack blocked — Node installed under another Windows user via nvm). **Native PostgreSQL on 5432, no Docker** (sponsor decision). Node 22 local; prod target Node 24.
- Migrations run via **tsx**, not ts-node (`npm run migrate` — ts-node can't `require()` .ts in an ESM package). Every DDL starts `SET lock_timeout = '5s'`; big time-series tables monthly-partitioned from day one (`att.ensure_swipe_partition` pattern); append-only tables get UPDATE/DELETE-rejecting triggers.
- **oRPC middleware mounts WITHOUT a path arg** (`app.use(orpcMiddleware(deps))`) — Express `use(path)` strips `req.url` and breaks prefix matching.
- Integration tests: live `.env` DB, `describe.skipIf(!DB_URL)`, **`fileParallelism: false`** (shared audit chain). **Users with audit history can never be hard-deleted** (FK from the append-only log — by design, CORE-06): tests deactivate + detach, never delete.
- knip: module public APIs (`src/modules/*/index.ts`) are `entry`; runtime-only deps → `ignoreDependencies`; `"exclude": ["types"]`. supertest `res.body` is `any` → cast to a typed interface. External systems live behind an interface with a mock (`MockKentConnector` → real Kent swaps in with zero pipeline changes).
