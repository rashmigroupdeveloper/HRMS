# 14 — Tech Stack Decision Record & Reliability Program

**Status:** v1 — 6 Jul 2026. Research-verified decisions that amend **02-ARCHITECTURE** and bind **13-MASTER-BUILD-PLAN**.
**Method:** six parallel deep-research sweeps (industry HRMS architectures, open-source HRMS internals, payroll-engine patterns, biometric ingestion, workflow-engine build-vs-buy, reliability engineering for money software), July 2026, sources cited inline.
**Goal as stated by sponsor:** "industry-level software with 0 bugs and errors." §11 translates that into an honest, enforceable contract; §1–§10 are the machinery that gets us as close as engineering allows.

---

## 1. What the industry actually does (so we know we're not missing a secret)

- **No HRMS vendor discloses payroll-engine internals.** Workday's "continuous calculation" and Rippling's "reactive graph" are marketing terms; the only engineering-grade artifacts anywhere are Rippling's reporting fan-out posts and PayFit's DSL posts. There is no secret architecture we're failing to copy.
- **Two platform generations exist:** bespoke in-memory object models (Workday: Java OMS over ~10 MySQL tables used as a KV store) and document-store "employee graphs" (Rippling and Darwinbox on MongoDB — chosen for *per-tenant schema flexibility*, a SaaS-vendor problem we do not have). **Deel runs Node + PostgreSQL.** greytHR itself is Java/K8s at a self-reported 99.5% uptime.
- **Payroll correctness is achieved the same way everywhere it's visible:** deterministic pure-function runs over effective-dated inputs, immutable versioned results, golden test suites gating deploys, and parallel/shadow runs against the incumbent (PayFit rule-author test suites; SAP's retro model; a US payroll-automation case where a 4-week shadow run was "the single highest-leverage decision").
- **Modular monolith is the 2024–26 consensus for a team this size** (Shopify, DHH, ThoughtWorks Radar "start with a well-factored monolith", Prime Video's 90% cost cut moving back; AI-agent-era writing adds that agents reason better in one codebase). Nobody credible recommends microservices for a 1-senior-dev + AI-agents team.

**Conclusion: the docs' Postgres modular-monolith design is validated.** The changes below are refinements, not a re-architecture.

## 2. Stack verdicts (amendments to 02-ARCH §1)

| Component | Verdict | Detail |
|---|---|---|
| React 19 + Vite + Tailwind v4, Warm Editorial | **Keep** | Unchanged; design firewall (05 §0.1) stands |
| Node.js | **Keep — pin Node 24 LTS** | Active LTS to Apr 2028 |
| Express 5 + TypeScript | **Keep** | v5 stable + LTS'd; auto promise-rejection forwarding kills the classic async-crash class. Framework throughput is irrelevant at this load — reliability comes from the layers below, not the router. NestJS's structure enforcement is replaced cheaper by dependency-cruiser rules (§5) |
| Modular monolith, Yatra Avedan module pattern | **Keep — now machine-enforced** | `modules/<x>/{controller,service,routes,repository}.ts`; boundaries enforced by dependency-cruiser + eslint-plugin-boundaries in CI, not convention |
| PostgreSQL 16, monthly partitioning | **Keep — with two cautions** | Keep partition counts modest (dozens — monthly, not daily); beware prepared-statement generic-plan lock explosion across many partitions (`plan_cache_mode=force_custom_plan` for hot partitioned queries if needed) |
| PgBouncer | **Keep — version ≥ 1.21** | Set `max_prepared_statements > 0`; never SQL-level `PREPARE`; no session state under transaction pooling |
| pg-boss + node-cron | **Keep** | v10 partitioned job tables; ACID enqueue inside domain transactions = transactional outbox for free. Known footguns documented in §6.4 |
| PM2 single-node | **Keep (acceptable)** | Industry drifting to Docker/systemd; not a blocker at this scale; revisit at the scale-up trigger |
| Workflow engine | **Build (validated)** | DB state machine + config rows + pg-boss timers — exactly what Frappe/Odoo/Keka/BambooHR ship. **Temporal and BPMN engines are explicitly rejected**: platform-sized cost for a problem one Postgres row solves. Escape hatch if durable execution is ever truly needed: DBOS (a library, not a cluster) |
| **MinIO** | **REPLACED — SeaweedFS** | See §4. MinIO OSS entered maintenance mode Dec 2025 (admin UI stripped Feb 2025) — dead for new builds |
| zod at boundaries | **Keep — upgraded to full contracts** | See §5: typed RPC with zod input *and output* schemas |
| — (new) Kysely | **Add** | Best-in-class type inference on complex payroll SQL (joins/CTEs/window fns); raw `sql` escape hatch; **string-built SQL banned**. (pgTyped rejected: nullability holes — wrong failure mode for money. Prisma rejected: opaque queries on complex workloads) |
| — (new) Money module | **Add** | Integer-paise branded `Money` type in app code; single rounding-policy module (PF → nearest rupee; ESIC → round **up**; etc.); floats never touch money; DB stays `NUMERIC` |
| — (new) max-strict TS + static analysis | **Add** | `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`; type-aware typescript-eslint (`no-floating-promises`); **knip** (dead code — AI agents leave orphans); **dependency-cruiser** (module boundaries) |
| Vitest + supertest | **Keep — program expanded** | §10: golden masters, fast-check property tests, Stryker mutation testing, Testcontainers, thin Playwright |

## 3. End-to-end typed contracts (§5 of the API design)

- **DECIDED (sponsor, 6 Jul 2026): oRPC.** tRPC was ruled out because its type-sharing model (frontend imports backend router types) violates the independent-teams boundary (02-ARCH team-boundary consequence); oRPC gives tRPC-style DX on the backend **plus standards-compliant OpenAPI output** — the neutral contract the frontend team generates its typed client from. Risk contained: it's a thin swappable layer, and the OpenAPI artifact outlives any library. Mounted inside the Express 5 app.
- Every procedure declares **zod input AND output schemas**. The output schema is the runtime firewall against an endpoint silently returning a malformed number. This kills contract drift — the highest-volume bug class in two-tier apps.
- The `{ success, data, error, meta }` REST envelope survives only on the few externally-consumed endpoints (ATS integration, pre-join links, webhooks).
- ts-rest / zodios rejected: maintenance concerns flagged by their own communities — wrong bet for a decade-horizon system.

## 4. Object storage: SeaweedFS replaces MinIO

**Facts:** MinIO's community edition lost its admin UI (Feb 2025) and the repo formally entered maintenance mode (Dec 2025 — security fixes only; commercial AIStor ≈ $96k/yr). Building a new 10-year payroll system on it is indefensible.

**Decision:**
1. All storage goes through an **S3-compatible storage adapter** (one interface, provider swappable) — the same discipline as the KentConnector.
2. HRMS production deploys **SeaweedFS** (production-proven since 2015, erasure coding, best feature breadth). **Garage** is the sanctioned lighter alternative if ops simplicity wins.
3. The running EMS MinIO instance is **not extended** — it becomes a **migration source** in Phase 3.5 (bucket mirror → SeaweedFS) and is retired with Yatra Avedan.
4. Amends: 02-ARCH §1 (Files row), §2 (topology), 11 §4b.3 (the "reuse the running MinIO" recommendation is superseded).

## 5. Module boundaries, enforced by machines

- Feature folders by domain; each module exposes `index.ts` as its public API; deep imports banned.
- **dependency-cruiser** rules in CI + **eslint-plugin-boundaries** in-editor: cross-module imports fail the build. This replaces what NestJS would have enforced with DI ceremony.
- DB mirrors the boundaries: schema-per-module (`core`, `att`, `lv`, `pay`, `wf`…, already the 03-SCHEMA design); per-module grants; cross-schema JOINs only via the designated reporting module.

## 6. Database correctness rules (constraint-first — the layer AI code cannot bypass)

1. **Constraints are the spec:** `NOT NULL` default everywhere; `CHECK` on every money/date invariant; FKs always; `UNIQUE(run_id, employee_id)` makes double-payment structurally impossible (already in 03 §6).
2. **Temporal exclusion:** effective-dated tables (`pay.employee_salaries`, shift/roster assignments) get `EXCLUDE USING gist (employee_id WITH =, daterange(effective_from, effective_to) WITH &&)` (btree_gist) — overlapping salary rows become a DB error, not a payroll bug.
3. **Append-only enforced by trigger + revoked grants** (03 §10 already): audit_log, swipe_events, lv.ledger, finalized payroll.
4. **pg-boss footguns (documented so nobody trips):** `singletonKey` without `singletonSeconds` = no dedup; `boss.send()` returns `null` on dedup — handle it; always pass explicit keys to `boss.schedule()`; pin the major version and wrap queue ops in one facade module.
5. **Migration safety:** `SET lock_timeout = '5s'` before all DDL; `CREATE INDEX CONCURRENTLY`; expand/contract for renames (previous app version must run against the new schema — keeps `pm2 deploy revert` viable); squawk lint on migrations in CI.

## 7. Payroll-engine correctness patterns (from SAP/PayFit/Frappe research)

1. **Derive, don't mutate:** inputs are effective-dated facts; a run is a **deterministic pure function** over facts-as-known-at-run-time; results are frozen versioned artifacts. Recomputing an unchanged run must be byte-identical (property-tested).
2. **Retro = recompute + delta (the SAP FOR/IN model):** a change effective in a closed period never edits that period — the engine recomputes it as a **new result version**, diffs against the stored old version, and pays/recovers only the delta in the current month. An `earliest_retro_date` bounds lookback. This upgrades the docs' `pay.arrears` design from "component rows" to a principled model.
3. **Immutability + maker-checker** (already in docs; now with industry confirmation): finalized runs locked by trigger; payroll_admin computes, hr_head co-signs finalize; reopen is permission-gated + audited.
4. **Hash-chained audit log (India statutory):** MCA rules (FY 2023-24 onward) require a tamper-proof edit log with ~8-year retention, auditor-attested. Upgrade `core.audit_log`: each row carries `SHA-256(prev_row_hash ‖ row_content)` — edits/deletes/reordering become detectable. Cheap to add now, painful to retrofit.
5. **Parallel-run discipline** (industry practice): minimum **2 consecutive cycles** (prefer "rich" months — increments, joiners, bonus); **numeric tolerances agreed before starting**; **reconcile gross before net** (errors cascade); every variance logged with a disposition (true error vs intentional improvement).
6. **Shadow runs forever:** any change to payroll logic after go-live computes old-vs-new in parallel; the diff must be empty (or signed off) before the new code pays anyone.
7. **Independent reconciliation:** register totals recomputed via a second code path (SQL aggregate vs engine sum) — must match to the paisa before finalize is enabled.

## 8. Attendance-ingestion hardening (from biometric research)

1. **Confirm Kent's protocol early** (P0-T01/T40): if the devices support a push protocol (ADMS/iclock-style, as ZKTeco/eSSL do — device POSTs punches, server ACKs), **prefer push**: near-real-time, device retries until ACK, no inbound firewall holes. Kent CamAttendance's documented model is cloud **webhooks** — either way the KentConnector interface holds.
2. **The ACK is the transaction boundary:** reply OK only after the DB commit; the device's retry-until-ACK + our `UNIQUE(employee_no, swipe_ts, door_code)` = exactly-once ingestion.
3. **Out-of-order is normal:** devices buffer thousands of punches offline and flush in bulk on reconnect (a week's outage at one plant ≈ 10k+ punches in one burst — bulk-insert path required). Never key logic on arrival time; never advance watermarks past gaps.
4. **Clock-drift quarantine:** devices drift and reset to epoch after battery failure. Quarantine punches outside a plausibility window (> few min future, > retention-days past) into the exception queue; push a time-sync command to devices daily where the protocol allows.
5. **The Frappe safety watermark (adopted — P1-T07):** a day's attendance is finalized (and Absent marked) **only after the per-device sync watermark passes that shift's end**. This single rule makes the PP-9 failure ("device offline → 200 false absents") structurally impossible rather than merely alerted.
6. **Offline detection:** `last_seen_at` per device updated on any contact; alert at 10–15 min silence during working hours (already ATT-02); nightly reconciliation re-pull of the last 48–72h per device (idempotency makes it free).
7. **Scale check:** 3k employees ≈ 12–36k swipes/day ≈ under 1 POST/sec average, single-digit/sec at shift-change peaks — trivial for one box. The engineering risk is correctness under reconnect floods, not throughput.

## 9. Workflow engine: build-verdict record

Every surveyed HRMS (Frappe, Odoo, Keka, BambooHR, Darwinbox) ships approvals as **config rows + a status/stage cursor** in the app DB — ordered approver stages (relative: "reporting manager", "manager's manager", role), N-of-M support, SLA timers via jobs. Nobody uses BPMN for HR approvals. Temporal is wrong-sized (4-service cluster or vendor spend, determinism constraints) when the "workflow" is one row in our own Postgres; its benefits (durable wait, SLA timer, escalation, audit) all have one-row equivalents here. The 03-SCHEMA `wf.*` design + pg-boss timers is exactly the industry pattern — **build it as specced** (with `send_back`, per 11 §4b).

## 10. The Reliability Program (tiered; mapped to plan phases)

**Tier 1 — Foundations (Phase 0, before feature code):**
1. Money module (integer paise, branded type, one rounding-policy file).
2. Max-strict tsconfig + type-aware eslint + knip + dependency-cruiser — all CI-blocking.
3. Constraint-first schema incl. temporal EXCLUDE rules (§6).
4. Hash-chained append-only audit log (§7.4).
5. Typed RPC (oRPC/tRPC) with zod in+out on every procedure (§3).
6. Kysely; raw-SQL ban outside the `sql` tag.
7. Run-lifecycle state machines (payroll run, workflow request, F&F) as explicit transition tables — illegal transitions unrepresentable, enforced by a DB trigger.

**Tier 2 — Test net (Phase 1–2, before first real payroll):**
8. Exact-value statutory unit tests — expected values computed by hand/spreadsheet from official tables, never by running the code (10 §13 G1–G10).
9. Golden-master snapshot of a full synthetic run (~100 employees covering every edge case), diffed in CI on every commit.
10. fast-check property tests: net = gross − deductions exactly; component sum = gross; paise conservation across the register; PF ceiling monotonicity; idempotent recompute.
11. Testcontainers integration tests asserting constraints + pg-boss flows.
12. Playwright smoke: 10–20 journeys only (login → punch → approve → run payroll → download register).
13. Contract tests (Pact): **skipped** — monolith with one first-party client; the RPC compiler is the contract test.

**Tier 3 — AI-agent process gates (immediate; cheap):**
14. Spec-first for all money logic: the statutory spec with worked numeric examples is written *before* implementation and stored in-repo as the audit artifact (docs 10 + 04 already are this — keep the discipline for changes).
15. CI gate order (all blocking): typecheck → eslint → knip → dependency-cruiser → unit/property → integration (real Postgres) → golden-master diff → Playwright smoke. **Nightly: Stryker mutation testing scoped to payroll-core** with a mutation-score threshold — the test-of-the-tests that catches vacuous AI-generated tests.
16. Human review mandatory on any diff touching `payroll-core/` or statutory data; conventions encoded as lint rules + CLAUDE.md, not prose.

**Tier 4 — Runtime nets (before go-live):**
17. GlitchTip self-hosted (Sentry-SDK-compatible, 4 containers) for error tracking, browser + node, releases tagged.
18. pino → OpenTelemetry → Prometheus/Grafana; every log line carries traceId. **Business metrics alert before technical ones:** total-payout delta vs last month > X% pages someone; employees-processed vs expected; queue depth; device gaps; replica-readiness metrics for the §0.1 trigger.
19. Feature flags (DB-backed table or Unleash OSS) as the canary on a single box: dark-launch, enable for one department, widen. Kill switch on every new money path.
20. Shadow runs + maker-checker + nightly restore-TESTED backups (§7.5–7.7).

**Tier 5 — Expectation setting:**
21. The written reliability contract (§11).

## 11. What "0 bugs" means here (the reliability contract)

No mature engineering organization promises literal zero defects — SRE practice explicitly rejects 100% as a target. What we promise instead, and engineer for:

| Severity | Definition | Target |
|---|---|---|
| **Sev1** | Wrong money or wrong statutory output reaches a payslip, bank file, or government filing — or data loss | **Zero, ever.** Defense-in-depth: constraints + golden tests + property tests + mutation testing + shadow runs + independent reconciliation + maker-checker + parallel run + PITR |
| **Sev2** | Payroll run or attendance lock blocked; approvals stalled system-wide | SLO: resolved same business day; deploy freeze on payroll days prevents self-inflicted ones |
| **Sev3** | UI defect, report formatting, non-blocking annoyance | Normal error budget; weekly triage (07 §4b feedback loop) |

The honest version of "industry-level with 0 bugs": **money and compliance outputs are protected by seven independent layers, any one of which can fail — including the AI — without money being wrong.** Everything else gets an explicit budget so velocity survives.

## 12. Cross-references & change log

Amends: 02-ARCH §1 (stack), §2 (storage in topology); 11 §4b.3 (MinIO reuse superseded). Bound into: 13-PLAN §2 (tech foundation), §3 (P0 tasks), §5 (P2 tasks), §7 (testing workstream).

| Date | Change |
|---|---|
| 6 Jul 2026 | v1 — created from six-report research pass; MinIO→SeaweedFS; Kysely, oRPC/tRPC, Money module, max-strict TS; retro FOR/IN model; hash-chained audit; attendance sync watermark; workflow build-verdict; tiered reliability program; Sev-based reliability contract |
