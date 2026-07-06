# 13 — Master Build Plan (executable, step-by-step)

**Status:** Draft v1 — living document. Prepared 6 Jul 2026.
**Purpose:** This is the *execution* layer on top of docs 00–12. Those docs say **what** to build and **why**; this file says **in what order, as concrete checkable steps, with what "done" means, and how to survive 10,000+ users**. Read 00 → 07 first; this plan assumes that context and does not repeat it.

> How to use: work top-to-bottom within a phase. Each task has an ID (`P1-T03`), the requirement IDs it satisfies, and an acceptance check. Do not start a phase until the previous **Gate** is signed off. This file is expected to change over the next 1–2 days of analysis and throughout the build — edit it, don't append silently.

---

## 0. What changed from the docs: scale re-assessment (10,000+ users)

The documentation set was scoped to **~2,000–3,000 on-roll employees** (NFR-02). Sponsor **confirmed (6 Jul 2026): current reality is ~3,000 on-roll — but the system must be architected to stay stable up to ~10,000 without a rewrite.** So the target is: **provision for 3k, design for 10k.** We do NOT over-build the infrastructure day one (no premature read replica, no big cluster), but we DO adopt the cheap architectural choices that make 10k a scale-up switch rather than a re-engineering project. The distinction:

- **Adopt now (cheap insurance, painful to retrofit later):** monthly **partitioning** of the swipe/attendance tables, **PgBouncer** connection pooling, precomputed **muster MV + dashboard snapshots**, and **chunked payroll compute** (payroll runs as a background job per cost-center, not one giant query). These cost little at 3k and are exactly what saves you at 10k.
- **Defer until load demands it (documented, ready to switch on):** the **read replica**, additional app nodes, and detaching cold partitions. The architecture is *replica-ready* from day one — reporting reads go through a data-access layer that can be pointed at a replica by config — but we run on a single strong box until metrics say otherwise.

At 3k, swipe volume is ~**12k–36k/day**; the 10k ceiling would be ~40k–120k/day. Partitioning handles both; only the hardware and the replica need to grow.

| Assumption in docs | Holds at 3k? | Holds at 10k+? | Plan correction |
|---|---|---|---|
| Single WHM box: API + Postgres + MinIO co-located (D5, 02-ARCH §2) | Yes | **No — single point of failure for payroll + resource contention** | See §0.1 — single strong box **now** with replica-ready architecture; documented, trigger-gated scale-up path to a 2–3 node topology |
| `swipe_events` un-partitioned, ~10–20k rows/day (NFR-02) | Yes | **~40k–120k rows/day; ≈15M–45M rows/year** | Partition `att.swipe_events` and `att.day_records` by month (range partitioning); BRIN indexes on `swipe_ts`; 5-yr online history = tens of millions of rows |
| Muster export 2,500×31 < 10s via app query | Marginal | **No, not with live aggregation** | Precomputed monthly muster materialized view + virtualized grid; export streams from the MV |
| Dashboards read live aggregates | No | **No** | `reporting.kpi_daily` nightly snapshots (already in 06 §4) become mandatory, not optional; reporting/export reads isolated behind a data-access layer that can be pointed at a read replica when the scale-up trigger fires |
| One Postgres connection pool from PM2 cluster | Marginal | **No — connection storms** | **PgBouncer** (transaction pooling) in front of Postgres; API pods target PgBouncer, never Postgres directly |
| pg-boss job queue on the app DB | Yes | **Risky under load** | Keep pg-boss but on its own schema with its own pool budget; monitor queue depth; the kent-sync + recompute fan-out is the load spike to watch |

### 0.1 Target topology (the 10k **end-state** — built incrementally; * = deferred until the scale-up trigger)

```
                 ┌ Load balancer / reverse proxy (TLS, AutoSSL) ┐
 users ─HTTPS──▶ │  hrms.rashmigroup.com                        │
                 └───────────────┬──────────────────────────────┘
                                 │
        ┌────────────────────────┴───────────────────────┐
        │  App tier (stateless, horizontally scalable)    │
        │   hrms-api  ×N (PM2 cluster or containers)       │
        │   hrms-worker ×M (pg-boss consumers)             │
        │   hrms-scheduler ×1 (cron leader; single-writer) │
        └───────────┬───────────────────────┬─────────────┘
                    │ (via PgBouncer)        │
        ┌───────────┴──────────┐   ┌─────────┴───────────┐
        │ PostgreSQL 16 PRIMARY │──▶│ Read replica(s) *    │
        │ (payroll/attendance   │   │ reporting + exports  │
        │  writes, WAL archiving)│   │ + dashboards         │
        └───────────┬───────────┘   └──────────────────────┘
          * DEFERRED — not built day one; added when the scale-up trigger below fires.
            At 3k everything above the line runs on ONE strong box.
                    │
             ┌──────┴──────┐
             │ SeaweedFS (S3)│  documents, letters, payslip PDFs (doc 14 §4)
             └─────────────┘
   off-box: nightly pg_dump + continuous WAL (PITR) + object-store mirror → separate host
```

**Phasing of the infra itself** (provision for 3k, keep the 10k door open):
- **Phase 0–2 (at 3k):** a **single strong box** runs API + Postgres primary + SeaweedFS — this is genuinely fine for 3,000 employees. But stand up **PgBouncer and monthly partitioning from day one** (retrofitting partitioning onto a many-million-row table later is painful), and route all reporting/export/dashboard reads through a **data-access layer that can be flipped to a replica by config**.
- **Before Phase 2 (payroll go-live), non-negotiable regardless of scale:** WAL archiving + nightly off-box backup + a **rehearsed PITR restore drill**. A payroll system's real risk at *any* size is data loss, not throughput — so backup/restore discipline is a hard G2 gate; the replica is not.
- **Scale-up trigger (the 10k path, documented, not built yet):** when sustained metrics cross agreed thresholds — DB CPU > ~60% at peak, muster export p95 > 15 s, or headcount > ~5k — **add the read replica** (point the reporting data-access layer at it) and, if needed, **additional app nodes** behind the load balancer. Because the app tier is stateless and reads are already isolated, this is a provisioning change, not a code change.
- **Decision D6 — LOCKED (sponsor, 6 Jul 2026): provision for 3k on a single strong box; architect replica-ready for 10k.** Single PostgreSQL 16 primary with PgBouncer + partitioning now; read replica + extra app nodes added later on the trigger above; S3-compatible object store (SeaweedFS — doc 14 §4); off-box PITR + nightly backup mandatory before payroll go-live.

### 0.2 Non-functional targets (meet at 3k, must not break at 10k)

- Muster export: 3k × 31 days < 10 s today; design headroom to 10k × 31 < 15 s (streamed from MV; p95).
- Dashboard first paint < 2 s from snapshot tables (never live aggregation) — same at 3k and 10k because it reads precomputed rows.
- Kent ingestion: sustain today's ~12k–36k swipes/day with < 5 min end-to-end lag; pipeline sized to absorb the 10k ceiling (~120k/day) without redesign; recompute fan-out batched so a full-plant re-run doesn't starve the pool.
- Payroll run computes as a chunked background worker job (per cost-center), not a request — bounded window at 3k, and scales to 10k by adding worker capacity, not rewriting.
- 5 years online history retained; older monthly partitions detachable to cold storage.

---

## 1. Guiding principles (the definition of done for every task)

1. **Traceability:** every PR references a requirement ID (`feat: ATT-08 …`). No feature exists that isn't in docs 01/04/06/08.
2. **Config over code:** every policy number lives in `core.settings` (04 §8). Zero hardcoded grace minutes, rates, thresholds.
3. **Ledgers, not counters:** leave, wallet, loan outstanding, PF/tax YTD are sums of immutable rows.
4. **Immutability at the DB, not just the app:** locked attendance/payroll and all audit/ledger/swipe tables enforce append-only via triggers (03 §10).
5. **Test-first for money:** every statutory formula ships golden-file tests asserting to-the-rupee (04 §6.9, 10 §13). Payroll services target 100% branch coverage; 80% floor elsewhere.
6. **One design language:** Warm Editorial only (05 §0.1 firewall). No MUI, no blue enterprise UI, ever. The motion doctrine (05 §2) and the micro-frustration kill-list (05 §6 — ≤2-click daily actions, state preservation, form autosave) are code-review-enforced.
7. **Explainable numbers:** every payslip line carries a `calc_note`; every KPI tile links to its underlying list.
8. **Prove the notification:** every workflow step records `notified_at` — the "Chaitanya was never notified" bug must be impossible (WF-04, PP-14).
9. **Scale-safe by default:** partition big tables, isolate reporting reads (replica-ready), precompute dashboards, pool connections. Never ship a full-table live aggregation on a hot path.
10. **Accessible and localized by default:** contrast ≥ 4.5:1 in both themes, color never the only signal, keyboard-complete with visible focus, reduced-motion respected — the 05 §7 CRITICAL bar is part of done. INR lakh/crore grouping, IST timezone, DD MMM YYYY dates everywhere (NFR-09).

---

## 2. Tech foundation — locked

Per 02-ARCH (as amended by **doc 14 — TECH STACK & RELIABILITY**, the research-verified decision record): React 19 + Vite + Tailwind v4 (Warm Editorial tokens from ATS) · **Node 24 LTS** + Express 5 + **TypeScript (max-strict)** (Yatra Avedan module pattern: `modules/<x>/x.{controller,service,routes,repository}.ts`) · PostgreSQL 16 · **Kysely** query layer (no string-built SQL, ever) · **typed RPC contracts (oRPC/tRPC) with zod input *and* output schemas** · integer-paise **Money module** with one rounding-policy file · JWT (15 min access + 7 d refresh) + bcrypt · **pg-boss + node-cron** jobs · **S3-compatible object store — SeaweedFS** (MinIO is EOL for new builds; the running EMS MinIO becomes a Phase-3.5 migration source — doc 14 §4) · PM2 · Vitest + fast-check + supertest + golden payroll fixtures + Stryker mutation testing on payroll-core. **Added for scale: PgBouncer (≥1.21) and monthly range partitioning now; replica-ready reporting reads (the replica itself is deferred to the §0.1 trigger).**

Monorepo `rashmi-hrms`: `apps/web`, `apps/api`, `packages/{ui,tokens,shared}`, `apps/api/migrations` (node-pg-migrate). Response envelope `{ success, data, error, meta }` everywhere. Files ≤ ~400 lines, feature-folders.

---

## 3. Phase 0 — Foundations & de-risking (target 3 wk)

**Goal:** repo, pipeline, auth/RBAC, employee master, and the two highest-risk spikes (Kent + scale) proven, before any feature build.

### 3.1 Week-1 external dependency chase (blocks everything — send the asks day 1)
- `P0-T01` Kent/Astra access method — DB view vs REST vs SFTP/CSV drop — from IT (Sharique/Ayush). *(02 §4)* **Blocks Phase 1.**
- `P0-T02` Dedicated **read-only greytHR admin login** to capture: salary structures per grade, one month's Final Pay Register + Bank file + JV, statutory file formats (ECR/ESIC/PT/24Q), workflow configs, attendance policy (grace/half-day/penalty/GCS Saturday/OT rates), full employee master export incl. inactive, leave policy config, loan register, holiday calendars. *(09 §8)*
- `P0-T03` Bank bulk-upload file format from Finance. *(02 §5)*
- `P0-T04` Payslip template sign-off (the RML fixed template — 09 §2 is the reference). *(PAY-06)*
- `P0-T05` **Confirm true headcount** and 5-yr swipe volume → final capacity sign-off. *(NFR-02, §0)*
- `P0-T06` Resolve the 9 statutory policy decisions in 10 §15 (PF base, bonus true-up, LOP divisor, OT base, DA/VDA, penalty→pay, gratuity 5y/4y240d, grade structures, sample formats). **Do not code payroll until signed.** Plus: **verify the 2026 Labour Codes status** (F&F TAT ~2 working days vs 3? "wages" ≥ 50% of CTC widening the PF/gratuity base?) per 10 §8 — owner: payroll admin; re-checked at the Phase-3 F&F gate.
- `P0-T07` Rotate the leaked credentials flagged in docs 09/11 (greytHR password, EMS SSH, MinIO console). *(security)*

### 3.2 Repo & pipeline
- `P0-T10` Scaffold monorepo (apps/web, apps/api, packages). CI: lint + typecheck + test on PR.
- `P0-T11` Deploy script (build → migrate → `pm2 reload`); staging vhost + DB; **PgBouncer in front of Postgres from the start**; deploy-freeze flag for payroll days.
- `P0-T12` `packages/tokens` + `packages/ui`: port Card, DarkCard, Pill/StatusBadge, KpiNumber, DataTable (virtualized), FilterPanel, Drawer, Timeline, EmptyState, ConfirmModal, MonthCalendar from the ATS; **build the Crextio-signature set**: KpiPillRow, HatchFill, SegmentedProgress, IconButton, DotMatrix, plus RosterGrid and ApprovalInbox. *(05 §5, 12 §7)*
- `P0-T13` Observability baseline: structured logs, error tracking, PM2 monit, disk/CPU/queue-depth/biometric-gap alert cron. *(02 §2.6)*

### 3.3 Auth, RBAC, audit, settings, notifications
- `P0-T20` Auth: JWT issuer + refresh (httpOnly cookie) + bcrypt + lockout/backoff; becomes SSO issuer the ATS validates. *(02 §1, NFR-03)*
- `P0-T21` RBAC tables + seed the full role catalog and permission grid from **08 §1–2** verbatim; manager scope via `core.reporting_tree` closure (trigger-maintained, **company-agnostic** — cross-entity managers exist, 09 §10.3); **per-role navigation shells per 08 §3** (skeleton in Phase 0, surfaces filled as each phase ships). *(CORE-10)*
- `P0-T22` `core.audit_log` append-only (INSERT-only trigger), **hash-chained for tamper evidence** (India MCA edit-log rule — doc 14 §7); auth events with IP. *(CORE-11)*
- `P0-T23` `core.settings` typed key-value store (audited) — the home for every policy number.
- `P0-T24` Notification service skeleton: `wf.notifications` queue (in-app + SMTP via nodemailer), templated, retry + dead-letter, `wf.event_subscriptions` matrix.

### 3.4 Organization + employee master (the spine)
- `P0-T30` Org tables: `companies` (seed all six: RML, RGH, EIPL, RPF, RPL, RDL — 09 §10.1), locations, cost_centers, departments, org_units, designations, grades. E-code generator as a DB function with `FOR UPDATE` on `ecode_next_seq` (CORE-02, 03 §10.5).
- `P0-T31` `core.employees` with **all CORE-01..08 validations** (PAN/Aadhaar/IFSC/bank-length/DOB-minor/duplicate ESI-UAN-ecode/CTC-vs-breakup/special-char strip); statutory-ID masking by permission; `reporting_tree` trigger; `employee_history`, `employee_family`, `documents` (object-store keys via the storage adapter).
- `P0-T32` **Bulk Excel import** with per-row validation report (CORE-12); dry-run load of the current greytHR master export; reconciliation counts vs source.
- `P0-T33` Employee directory + profile UI shell (05 §4.2), compensation tab permission-gated/masked.

### 3.5 The two de-risking spikes (do these early, in parallel with 3.4)
- `P0-T40` **Kent connectivity spike:** implement `KentConnector` behind the interface (02 §4) for whichever access method IT confirms; pull **one real day** of swipes end-to-end into `att.swipe_events` (idempotent upsert). Prove watermark + overlap window + gap detection. *This is the highest-risk integration — de-risk first.*
- `P0-T41` **Scale spike:** load-test with synthetic data at **3k (today) and 10k (ceiling)** × 60 days of swipes; validate partitioning strategy, muster MV refresh time, and a dashboard snapshot build. Confirm the single box comfortably handles 3k and identify at what point the read replica/extra nodes kick in — freeze the partitioning plan and the documented scale-up trigger on measured numbers, not guesses.

**Gate G0:** employee master loaded + validated for real headcount; SSO validates against ATS; deploy pipeline + PgBouncer proven; one real day of Kent swipes ingested; scale spike numbers acceptable and partitioning frozen. Sponsor + IT sign-off.

---

## 4. Phase 1 — Attendance · Leave · Workflows · Core Reports (6–8 wk) — the visible win

Sequencing: stand up ingestion first so it accumulates data while the rest is built. Ship the small high-visibility items (boarding/exit email, muster) early.

### 4.1 Attendance ingestion & processing
- `P1-T01` Kent ingestion pipeline productionized: `*/5 min` pg-boss job, per-device watermark, 30-min overlap, idempotent upsert, raw immutable rows; **partitioned** swipe table. *(ATT-01)*
- `P1-T02` Device health + gap detection + **offline alerting to IT** (`att.devices`, expected_hourly_swipes, last_seen); device-health dashboard tile. *(ATT-02)* — this is the fix for the 200-employee PP-9 mismatch.
- `P1-T03` Unmatched-swipe exception queue (never silently dropped). *(04 §1.1)*
- `P1-T04` Shifts, rosters (manager-maintained, monthly-5th reminder), holidays per location; **two-session day model + Saturday GCS scheme** (session_statuses JSONB, scheme_code). *(ATT-04/05/13, 09 §4)*
- `P1-T05` Day-status processor + idempotent recompute (dirty-flag driven), FILO basis, cross-plant swipes valid (ATT-16/18); manual override HR-only with reason+audit (ATT-17). *(04 §1.1)*
- `P1-T06` Week-off eligibility engine at week close (ATT-09); "Penalty Days" policy hook. *(04 §1.2)*
- `P1-T07` Month-lock checklist + `att.month_locks` + freeze trigger; managers' attendance approval is an explicit, visible precondition (ATT-12/15). **Frappe-pattern safety watermark (doc 14 §8): never finalize a day — especially never mark Absent — until the device-sync watermark has passed that shift's end.** *(04 §1.6)*

### 4.2 Workflow engine + requests
- `P1-T10` Generic approval engine: `wf.definitions/requests/request_steps/delegations`; steps resolve to RM/functional-mgr/role/user; **approve / reject / send_back** (adopt from Yatra Avedan); per-step SLA; vacant-approver auto-skip; every step writes `notified_at`. *(WF-01..04)*
- `P1-T11` Seed the **authoritative workflow catalog from 08 §4 / 09 §10.2** (Leave, Leave Cancel, Leave Encashment, Comp Off, Restricted Holiday, Regularization & Permission, OD, Overtime, Claim, Loan, Confirmation, Resignation, Transfer, Letter Signature; Offer/LOI reserved for Phase 4).
- `P1-T12` Approvals inbox (05 §3): one cross-type queue, ≤2-click decisions, SLA countdown pills, keyboard `a`/`r`, batch approve, "all caught up" state.
- `P1-T13` SLA escalation job (hourly): breach → escalate/auto-reject/lapse per definition. *(WF-03)*
- `P1-T14` AR + **Permission** (time-bounded) + OD (future-dated allowed); Excel-exportable. *(ATT-06/07)*
- `P1-T15` Overtime with the **48-hour rule**: daily 18:00 summary to managers, deadline_at, lapse job, comp-off-or-pay (never both, DB CHECK). *(ATT-08, 04 §1.4)*

### 4.3 Leave
- `P1-T20` Leave types seed = live six (CL, SL, EL, Election Leave, Comp Off, LWP) + ML in catalog (09 §1); `lv.leave_types` with accrual/carry/encash/sandwich config.
- `P1-T21` Immutable `lv.ledger` (balance = SUM(delta)); monthly accrual job (1st 00:05) never blocked by unapproved attendance — flags exceptions instead. *(LV-02/05)*
- `P1-T22` Applications with balance check, half-day, sandwich preview; cancellation as re-approval reversing ledger; encashment request workflow; Restricted Holiday selection→approval→holiday. *(LV-03/06/08/09)*
- `P1-T23` Comp-off earn from approved WO/H work (auto-suggested from swipes), expiry job. *(LV-04)*

### 4.4 Absenteeism, alerts, lifecycle-lite, letters
- `P1-T30` Absenteeism engine: daily scans; UAB alerts up the hierarchy + HR; `absence_cases` watch→show_cause→warning with letter from template through official HR email. *(ATT-10/11)*
- `P1-T31` **Daily 07:00 boarding/exit email** per plant, sent even when empty. *(LC-03)* — small, huge visibility, ship early.
- `P1-T32` Letters engine: templates + merge fields + Letter Signature Approval workflow; show-cause/warning/certificates; archived on employee + ESS. *(CORE-09)*
- `P1-T33` Policy repository + acknowledgment tracking + weekly nag + HR tile. *(CORE-13)*

### 4.5 Reports, dashboards, ESS
- `P1-T40` **R1 Muster Summary** with RM + Functional Mgr + Emp ID + Cost Center/Plant columns and leave-type columns, from precomputed MV, virtualized, <15 s export for 10k. *(RPT-01, LV-07, PP-5/8/15/25)*
- `P1-T41` R2 swipe/reconciliation (HRMS status vs raw + cross-plant flag), R3 AR/OD, R4 late/early/UAB, R5 OT register, R6 absence cases, R24 boarding/exit, R27 headcount — all Excel-exportable with applied filters. *(RPT-06)*
- `P1-T42` HR Ops dashboard (05 §4.1) + manager team view/roster editor + senior-manager subtree scope (KQ) + device-health board.
- `P1-T43` ESS home + My Attendance + My Leave (05 §4.3/4.4/4.9); mobile/geo check-in PWA if pulled forward (ATT-14).

**Gate G1:** one full month of HRMS attendance runs in parallel with greytHR; muster matches physical reality (spot-check vs Kent raw); managers approving in-app; boarding/exit email running daily; **PP-9 200-employee mismatch demonstrably impossible** (device gaps page someone). HR-ops UAT sign-off.

---

## 5. Phase 2 — Payroll & Statutory (8–10 wk) — the takeover

**Precondition:** 10 §15 decisions signed; off-box WAL/PITR backups running with a **rehearsed restore drill** (§0.1 — the hard requirement at any scale; the split topology is NOT required, only the trigger-gated readiness for it); attendance month-lock working.

- `P2-T01` Salary components seed = live six earnings + deductions with real formulas (HRA=Basic×0.5, PF on full basic per RML flag, monthly BONUS, fixed MEDICAL/EDUCATION, GUEST HOUSE recovery class); components model ported from Frappe HR. *(PAY-01, 09 §2, 10 §10)*
- `P2-T02` Salary structures per grade/category/location; effective-dated `employee_salaries` with **DB-level overlap exclusion** (`EXCLUDE USING gist` — doc 14 §6); **probation % auto-apply + auto-switch to confirmed on confirmation date**; CTC-vs-breakup validation; new-joiner salary rows created from LOI CTC on conversion so payroll never misses a joiner. *(PAY-01/02/07)*
- `P2-T03` Run pipeline state machine (draft→inputs_locked→computed→under_review→approved→finalized|reopened); immutability trigger; attendance-lock hard precondition. *(PAY-03, 03 §10)*
- `P2-T04` Compute engine in the exact order of 04 §3: proration/LOP/LOP-reversal (divisor per settings), earnings, OT pay, arrears, inputs → gross → PF → ESIC → PT → LWF → TDS → other deductions → net; per-line `calc_note`. Retro/arrears follow the **recompute-and-delta model** (closed periods never edited; new result version + delta paid in current month — doc 14 §7). Runs as chunked worker jobs (per cost-center) for 10k scale. *(PAY-03/04/16)*
- `P2-T05` **Statutory engines, each test-first with golden fixtures (10 §13):**
  - PF + ECR text file (full-basic base, EPS capped, EDLI, admin, NCP days). *(PAY-09)*
  - ESIC + contribution-period state machine + return file. *(PAY-10)*
  - PT-WB slabs + register. *(PAY-11)*
  - LWF-WB half-yearly. *(PAY-12)*
  - TDS: old+new regime, A→R IT-statement layout (09 §3), declarations→proof-window→verify, monthly projection, 24Q data, Form 16 Part B. *(PAY-13)*
  - Apprentice/trainee rules: Apprentices Act contracts excluded from PF/ESIC/bonus; stipend processing; golden G9. *(PAY-14, 10 §9)*
- `P2-T06` Payslip PDF (fixed RML template, PAN/UAN/PF/ESIC, net in words) + **three payslip types** (regular, reimbursement, overtime). *(PAY-06, 10 §11)*
- `P2-T07` Outputs: bank file (excludes holds), JV/GL mapping (SAP-consumable), variance report vs prev month; reports R7–R19. Salary holds (payment/process). *(PAY-05/08)*
- `P2-T08` Payroll console UI (05 §4.5): stepper, review grid with Δ + drawer payslip preview, typed-confirmation finalize ceremony, outputs card.
- `P2-T09` Loans & Advances (M11): types/schedulers, ESS application + eligibility-gated workflow, EMI auto-deduction, perquisite valuation, **SAP legacy loan import**. *(LN-01..04, PP-11)*
- `P2-T10` Claims & Reimbursements (M12): claim types/entitlements, ESS submission w/ live balance, RM→HR-verify→payroll-batch chain, payout via run or off-cycle batch, year-end TDS on unsubstantiated, R31 register. *(CLM-01..07)*
- `P2-T11` YTD import from Protiviti (mid-year TDS continuity); **parallel run 2 months minimum** with per-component Δ report (R20), **pre-agreed numeric tolerances, gross reconciled before net** (industry practice — doc 14 §7); cut-over sign-off (HR Head + Finance, two-person finalize rule).
- `P2-T12` Annual processes: statutory-bonus year-end true-up (8.33–20% band, set-on/set-off per Sec 15) and increment processing with effective dates. *(PAY-17, 10 §7.1)*

**Gate G2:** parallel-run register matches to the rupee (or signed-off differences); first live payroll month end-to-end; ECR/ESIC/PT/24Q files accepted by portals; PITR restore drill passed with verified off-box backups. **Protiviti retired after this gate.**

---

## 6. Phases 3, 3.5, 4 (summarized — expand when Phase 2 nears gate)

**Phase 3 — Lifecycle · Assets · Helpdesk · Engagement · Executive (5–6 wk).** Onboarding bridge from ATS + pre-join links + task fan-out (LC-01/02); probation/confirmation + salary switch e2e (LC-04); separation pipeline + clearances + F&F with gratuity golden tests + letter gating (LC-06, PAY-15) — **re-verify the 2026 Labour Codes F&F TAT + wages rule (10 §8) before this gate**; transfers incl. entity transfer (LC-05); Assets (AST-01..06); Helpdesk (HD-01); Engagement (EN-01..04); **CEO dashboard** from `reporting.kpi_daily` snapshots incl. new-hire attrition 3/6/12mo (RPT-03; reports R23, R25–R30 — R21 Offer / R22 Recruitment read ATS data via the integration until Phase 4); alumni ESS mode (LC-07). **Gate G3:** a real resignation processed system-only with every-approver receipts; CEO dashboard reviewed by CEO Cell; asset exit-clearance loop closed.

**Phase 3.5 — Travel & Expense, absorb Yatra Avedan (4–6 wk; M13, TE-01..12).** Port module pattern + models to Postgres: Trip (TE-01..04), Budget/allowances + policy (TE-05/06), Advance (TE-07), **Wallet + WalletTransaction settlement ledger** (TE-08/09), Claim with multi-currency line items (TE-10/11), international-travel-policy, MMT booking connector (TE-03); migration + retirement (TE-12). Wire settlement → payroll (recoverable→deduction; reimbursement→payroll/off-cycle). **Rebuild every screen in Warm Editorial — no MUI (05 §0.1).** Migrate Yatra Avedan Mongo data; parallel-run; **decommission Yatra Avedan.** **Gate G3.5:** full trip→advance→booking→claim→settlement reconciles to the wallet to the rupee.

**Phase 4 — ATS absorption + contract workers (scoped later).** ATS frontend under HRMS shell on shared packages; recruit-schema migration; Offer report fully internal (R21); Offer/LOI workflow chain live; contract-worker module (separate PRD); geo check-in PWA rollout to sales if not already shipped.

**End state:** one platform — payroll/attendance/leave/lifecycle + T&E (ex-Yatra Avedan) + recruitment (ex-ATS) — owning the employee master; greytHR, Yatra Avedan, standalone ATS all retired.

---

## 7. Cross-cutting workstreams (run across all phases)

- **Testing (the doc 14 §10 reliability program):** TDD; 80% floor, payroll 100% branch; exact-value statutory unit tests with hand-computed expected values; golden fixtures G1–G10 (10 §13) + a **golden-master full-run snapshot** (~100 synthetic employees covering every edge, diffed in CI); **fast-check property tests** on invariants (net = gross − deductions, paise conservation, idempotent recompute); **Stryker mutation testing nightly on payroll-core** (catches vacuous tests — essential when AI agents write both code and tests); Testcontainers integration tests asserting DB constraints; thin Playwright smoke (10–20 journeys); muster/dashboard perf tests at 10k scale in CI; **shadow runs** on every payroll-logic change (old vs new engine diff must be empty before the new one pays).
- **Security:** RBAC everywhere; restricted columns masked + never logged; TLS; rate limits (5/min auth, 100/min general); parameterized queries only; payroll immutability triggers; quarterly super_admin role review; rotate the leaked creds (P0-T07).
- **Data migration:** greytHR/Adrenalin master + leave balances + salary structures + YTD payroll; Yatra Avedan Mongo (Phase 3.5); SAP legacy loans; every load has a per-row validation report and reconciliation counts; go-live only on clean load.
- **Training & change management (07 §4b):** per-phase UAT sign-off is part of the gate; 1-page role quick-guides + short screen recordings; in-app contextual help + teaching empty states (CORE-14); published admin-access matrix each phase; helpdesk "HRMS platform" category from day one.
- **Statutory ownership (the forever cost):** budget ~15–20% of build effort/year permanently; named owner reviews each Union Budget + EPFO/ESIC/PT/LWF notification; rates are versioned data (`statutory_rates`), updates are row edits + new goldens, not redeploys. *(07 risk #10)*
- **Infra/SRE:** WAL archiving + nightly off-box backup + **rehearsed restore drill before payroll go-live**; deploy freeze on payroll days; queue-depth + device-gap + disk alerts; read-replica lag monitoring.

---

## 8. Open decisions to resolve in the next 1–2 days (blocking or shaping)

| # | Decision | Why it matters | Owner | Status / Recommendation |
|---|---|---|---|---|
| D6 | **Production hosting** | Payroll data-loss risk; §0 | Sponsor + IT | ✅ **RESOLVED — single strong box for 3k, architected replica-ready for 10k** (6 Jul 2026). PgBouncer + partitioning + precomputed dashboards now; read replica + extra app nodes added on the scale-up trigger in §0.1. |
| D7 | Confirm headcount | Sizing, partitioning, payroll compute window | Sponsor/HR | ✅ **RESOLVED — ~3,000 on-roll today; design ceiling ~10,000** (6 Jul 2026). Provision for 3k, don't over-build; keep the 10k door open. |
| — | The 9 payroll policy items (10 §15) | Blocks all payroll code | Payroll/Finance | ⏳ Chase in Phase 0 |
| — | Kent access method | Blocks attendance | IT | ⏳ Chase week 1 |
| D3-bis | RPF (Dubai) payroll — stays out of India engine (manual/WPS) until a Dubai module is scoped? | Scope boundary | Sponsor | ⏳ Confirm; schema already reserves it |

---

## 9. Timeline (risk-adjusted, ±30%)

| Phase | Duration | Cumulative | Visible value |
|---|---|---|---|
| 0 Foundations (+ light scale hardening) | 3 wk | ~3 wk | — |
| 1 Attendance/Leave/Workflows/Reports | 6–8 wk | ~11 wk | **muster + daily emails + approvals from ~wk 8** |
| 2 Payroll & Statutory | 8–10 wk | ~21 wk | Protiviti replaced |
| 3 Lifecycle/Assets/Executive | 5–6 wk | ~27 wk | CEO dashboard, F&F |
| 3.5 Travel & Expense (absorb Yatra Avedan) | 4–6 wk | ~32 wk | one platform for T&E |
| 4 ATS absorption + contract | scoped later | — | full consolidation |

≈ 7 months to full Protiviti replacement, with visible wins from ~week 8. (No longer than doc 07's estimate — provisioning for 3k keeps Phase 0 lean; the 10k readiness is design discipline, not extra build time.)

---

## 10. Immediate next actions (on plan approval)

1. Send the Phase-0 external-dependency asks **today**: Kent access (IT), admin greytHR login (HR), bank/JV/ECR formats (Finance), the 9 payroll policy questions (Payroll), true 10k headcount + ESS-active split (Sponsor).
2. Rotate the three leaked credentials (P0-T07).
3. Scaffold `rashmi-hrms` monorepo + CI + staging + **PgBouncer**.
4. Port design tokens/primitives from ATS into `packages/ui`.
5. Employee-master schema + import current headcount export (dry run).
6. Run the two spikes in parallel: **Kent one-day pull** and **10k synthetic scale/partitioning test** — freeze the infra plan on measured numbers.

---

## 11. Change log

| Date | Change |
|---|---|
| 6 Jul 2026 | v1 — execution plan created from docs 00–12; added 10k-scale re-assessment (§0), split topology, partitioning, PgBouncer, read replica; new decisions D6/D7. |
| 6 Jul 2026 | v1.1 — D6/D7 first pass (assumed 10k on-roll). |
| 6 Jul 2026 | v1.2 — corrected: **~3k on-roll today, design ceiling ~10k**. Posture is now "provision for 3k, architect replica-ready for 10k": PgBouncer + partitioning + precomputed dashboards + chunked payroll adopted now; read replica + extra app nodes deferred to a documented scale-up trigger. Phase 0 leaner; timeline back to ~7 months. |
| 6 Jul 2026 | v1.3 — full audit + deep-research pass. Purged remaining split-tier/day-one-replica contradictions (§0 table, §0.1 diagram, §2, Phase-2 precondition, Gate G2); unified swipe-volume figures; fixed timeline arithmetic. Added: accessibility/localization principle (#10), motion+kill-list enforcement (#6), per-role nav shells (P0-T21), hash-chained audit log (P0-T22), 2026 Labour Codes verification (P0-T06 + Phase-3 gate), signature UI components (P0-T12), attendance sync-watermark rule (P1-T07), PAY-07 (P2-T02), PAY-14 apprentice rules (P2-T05), PAY-17 bonus true-up (P2-T12), retro recompute-and-delta model (P2-T04), 2-month-minimum parallel run with tolerances (P2-T11), TE-01..12 traceability, R21/R22 correct placement. Stack finalized per research: **SeaweedFS replaces MinIO (EOL), Kysely, typed RPC (oRPC/tRPC), Money module, Node 24, max-strict TS, fast-check + Stryker** — full decision record + reliability program in new **doc 14**. |
