# Phase 1 — Attendance · Leave · Workflows · Core Reports

**Target:** 6–8 weeks · **Gate:** G1 · **Spec:** docs/13 §4, docs/04 §1–2/§5, docs/03 §4–5/§8
**Purpose:** the visible win — trusted attendance, in-app approvals, the muster HR was refused for a year, and the daily boarding/exit email. Ships the pain-point killers before payroll.

> Sequencing: 1.1 first so data accumulates while the rest is built. 1.6's boarding/exit email is small + high-visibility — deliver early. 1.3 unblocks 1.4/1.5.

---

## Stage 1.1 — Ingestion productionized + device health   `[ ☑ done 9 Jul 2026 — on the MOCK feed; real Kent swaps in via connectorFor() when P0-T01 lands ]`
**Goal:** Kent swipes flow in every ≤5 min, immutably, with silence detected — the PP-9 fix.
**Depends on:** Phase 0 (Stage 0.6 spike).
**Tasks:**
- [x] P1-T01 — Production pipeline **live**: `kent-sync` every 5 min under **pg-boss** (`src/jobs/worker.ts`, `npm run worker`; queue state in Postgres, retries built in; immediate cycle on boot); watermark − 30-min overlap; idempotent upsert; partitioned table; bulk-insert path — **worker booted live and completed a real cycle; cross-process same-day idempotency observed (inserted=0 on re-cycle)** *(ATT-01)*
- [x] P1-T02 — Device health **live**: last_seen heartbeat; **transition-based silent-door alerting** (fires ONCE when a door goes quiet, re-arms when it's seen again — proven: 2 transitions → exactly 2 notifications) via `wf.event_subscriptions` (`attendance.device_silent` → recipients are data); threshold = `att.device_silent_minutes` setting (default 15); device-health board API `GET /attendance/devices` (admin.devices) *(ATT-02)*
- [x] P1-T03 — Unmatched-swipe exception queue **live**: `GET /attendance/exceptions/unmatched` (attendance.manual_override) — grouped ghost e-codes with counts/first/last-seen; proven a ghost e-code surfaces, never dropped *(04 §1.1)*
- [x] doc14-§8.4 — **Clock-drift quarantine live**: plausibility judged against `received_at` (wall-clock independent): future-drift > `att.quarantine_future_minutes` (10) or age > `att.quarantine_past_days` (45) → `att.quarantined_swipes` with reason (`future_timestamp`/`too_old`), NEVER into attendance; review API `GET /attendance/exceptions/quarantined` (admin.integrations); manual `POST /attendance/sync` *(device time-sync command = real-Kent task, depends on protocol P0-T01)*
**Modules/files:** `backend/src/modules/attendance/{ingest.service,kent-sync.job,attendance.router}.ts`, `backend/src/jobs/worker.ts`, migration 0005
**Tests:** 71 total green (verify 0) incl. quarantine boundaries, alert-once + re-arm, 401→403→200 permission walk on all four endpoints, same-day job idempotency. *(Reconnect-flood 10k-burst covered by the 0.6 scale spike.)*
**Exit criteria:** re-run of any window creates zero dupes ✅ · silenced device alerts within threshold, once ✅ · 3 consecutive days of live ≤5-min-lag ingestion ⏳ (needs the worker left running — start `npm run worker` alongside `npm run dev`).

## Stage 1.2 — Shifts, rosters, day-status processor   `[ ☑ done 9 Jul 2026 ]`
**Goal:** raw swipes become correct day statuses — session-aware, recomputable, never manager-editable.
**Depends on:** 1.1.
**Tasks:**
- [x] P1-T04 — **All calendar config is runtime DATA (sponsor centralization rule):** shift catalog seeded with the live RML shapes (GEN, **G5 two-session split 13:30**, **GCS Saturday half-day**, NIGHT cross-midnight) — every time/grace/threshold a row, editable via `PUT /attendance/config/shifts/{code}` (admin.settings, audited); per-employee **weekday/Saturday scheme** (`PUT /attendance/config/schemes/{id}`); manager **rosters** incl. week-offs (`PUT /attendance/roster` bulk, attendance.roster.write — roster edits auto-dirty the days); **holiday calendar** per location (`PUT /attendance/config/holidays`); **monthly-5th roster reminder job** (recipients = `attendance.roster_deadline` subscription data) *(ATT-04/05/13, 09 §4)*
- [x] P1-T05 — Day-status processor **live**: FILO (ATT-18); resolution roster → scheme(Sat/weekday) → `att.default_shift_code` setting; grace-aware late/early minutes; break-net worked minutes; **two-session dual statuses** (G5 → HD with `[P,A]`, the live "A:P" shape); **night-shift date attribution** (21:55→06:04 → shift date, P); holiday-wins; Sunday-default WO; **idempotent recompute** on the dirty queue (swipe-insert DB trigger enqueues D and D−1); **manual override = HR-only via API (mandatory reason, audited) and recompute NEVER touches manual or locked rows**; locked rows immutable by DB trigger *(ATT-03/15/17)*
- [x] P1-T06 — Week-off eligibility at week close: worked < `att.weekoff_min_worked_days` (setting, default 1) → **unpaid WO** (PI-PAY-1/2 exact scenarios proven); weekly job Mon 02:00 + on-demand `POST /attendance/week-close`; penalty-days hook reserved (`penalty_flag` column + disabled-by-default policy) *(ATT-09)*
**Modules/files:** `backend/src/modules/attendance/{day-status.service,attendance-config.router}.ts`, migration 0006, worker queues `attendance-recompute` (1-min safety drain) / `attendance-week-close` / `roster-reminder`; kent-sync now drains recompute after every cycle (processed attendance ≤5 min behind raw)
**Tests:** **13 golden fixtures, all hand-computed** (full/late/HD-sessions/short/absent/no-swipes/GCS-Saturday/Sunday-WO/holiday/night/manual-override-survives/locked-untouchable/idempotence/week-off-paid-vs-unpaid) — 84 total green, verify exit 0.
**Exit criteria:** every status branch matches hand-computed fixtures ✅ · locked-row recompute skipped AND direct UPDATE rejected by the DB ✅ · managers have NO status-edit surface — the only write is `attendance.manual_override`-gated (HR), reason mandatory, audited ✅.

## Stage 1.3 — Workflow engine + approvals inbox   `[ ☑ done 9 Jul 2026 — backend; inbox UI = frontend team on the /workflows APIs ]`
**Goal:** the generic approval spine (approve / reject / **send_back**) with provable notifications.
**Depends on:** Phase 0 (0.4 notifications).
**Tasks:**
- [x] P1-T10 — Engine **live** (migration 0007): approver specs `reporting_manager | functional_manager | role:<code> | user:<id>` with **out-of-office delegation** applied at resolution (delegated_from trail ✓ tested); **vacant approvers auto-skip with audit** (chain exhausted → auto-approved ✓); **`notified_at` is NOT NULL — a step row physically cannot exist without its notification receipt** (the PP-14 guarantee, structural not procedural); send_back → requester **resubmit** restarts the chain (timeline keeps round 1) *(WF-01..04, doc 11 §4b)*
- [x] P1-T11 — **15 chains seeded** from 08 §4 / live 09 §10.2 (leave, leave_cancel, leave_encashment, comp_off, restricted_holiday, regularization, od, overtime, claim, loan, travel_advance_domestic, confirmation, resignation, transfer, letter_signature) — `npm run seed:workflows`, idempotent, **runtime edits never clobbered**; chains editable via `PUT /workflows/definitions/{code}` (admin.settings, audited old→new) — **edit takes effect on the very next request ✓ tested**
- [x] P1-T12 — Inbox **API** live: `GET /workflows/inbox` (SLA-sorted, subject + payload + receipts + delegation flag), `POST /workflows/requests/{id}/act`, timeline `GET /workflows/requests/{id}` (visibility: requester/subject/step-holders/audit.read). *Inbox UI (keyboard a/r, batch, countdown pills) = frontend team per 05 §3.*
- [x] P1-T13 — SLA escalation **hourly job** (`workflow-escalation`) + on-demand endpoint: breach → **escalate** (spec'd target or approver's own manager, else skip-forward) / **auto_reject** / **lapse** (OT's hard 48h ✓ tested) / **auto_approve** (Restricted Holiday ✓ tested); every breach audited + requester notified *(WF-03)*
**Modules/files:** `backend/src/modules/workflows/{workflow.service,definitions.seed,workflows.router,seed}.ts`, migration 0007, worker queue `workflow-escalation`
**Tests:** 6 integration (90 total green, verify 0): receipt + inbox + stranger-403 + RM approve; send_back→resubmit round-trip; delegation reroute with trail; vacant-skip→auto-approve with audit; OT lapse + RH auto-approve + leave escalate; runtime chain edit takes effect immediately.
**Exit criteria:** every action path walked with a visible timeline ✅ · a step cannot exist un-notified (NOT NULL receipt) ✅ · non-approver acting → 403 ✅.

## Stage 1.4 — AR / OD / Permission + Overtime 48h   `[ ☑ done 11 Jul 2026 — backend; ESS/inbox UI = frontend team on the new APIs; Excel exports land with the R3/R5 reports in 1.7 ]`
**Goal:** the attendance-exception requests, and the OT module greytHR never delivered.
**Depends on:** 1.2, 1.3.
**Tasks:**
- [x] P1-T14 — AR (**past-only**, capped by `att.ar_max_past_days` setting) + **Permission** (single day, time-bounded ≤ `att.permission_max_hours`) + OD (**future-dated allowed** — the KQ ask); locked-period + overlapping-open-request guards; rides the runtime-editable `regularization`/`od` chains; **approval writes the day INSIDE the approving transaction** via the new workflow completion-hook registry (`source='regularized'`) and `recomputeDay` now only touches `source='auto'` rows, so an approval can never be silently reverted; HR manual override still outranks it *(ATT-06/07, PP-16, KQ)*
- [x] P1-T15 — OT **detected on every recompute**: minutes beyond shift end, or ALL worked minutes on a WO/holiday (day-status now computes WO/H FILO minutes; `day_records.ot_minutes` populated); ≥ `att.ot_min_minutes` → idempotent one-entry-per-day + `overtime` workflow intimation to the RM (onBreach=**lapse**, `att.ot_decision_hours`); employees without ESS accounts get a workflow-less entry lapsed by the hourly sweep; decisions: approve **full/partial**, reject, **convert to comp-off** — paid-XOR-comp-off is a DB CHECK; daily **18:00 IST manager digest** job *(ATT-08, 04 §1.4, PP-19)*
- Engine upgrades (workflows): `onWorkflowFinal(code, hook)` registry fired in-transaction at all three final states; `createRequest` gained an atomic `attach` callback (domain row + request commit together); requesters are now notified on final approval too.
- APIs (central gates): `POST /attendance/requests` + `GET /attendance/requests/mine` + `GET /attendance/ot/mine` (**attendance.own**) · `GET /attendance/ot/pending` + `POST /attendance/ot/decide` (**ot.approve**) · `POST /attendance/ot/lapse-sweep` (**admin.integrations**). Worker: `ot-daily-summary` (12:30 UTC = 18:00 IST) + OT lapse sweep piggybacks the hourly escalation job; hooks registered in both api + worker processes.
- Deferred by design: comp-off **ledger credit** on conversion → Stage 1.5 (needs `lv` schema; `comp_off_credit_id` FK attaches then) · OT payout `payroll_item_id` → Phase 2 · R3/R5 Excel exports → Stage 1.7.
**Tests:** migration 0009 constraints + 6 new integration tests (validators; AR e2e apply-on-approve + recompute-skip; future OD; OT detect→partial approve→double-decide blocked; SLA lapse→entry lapsed; WO work by user-less employee→sweep lapse) — **106 total green, verify exit 0**.
**Exit criteria:** e2e: employee applies AR → RM approves → day recomputed with `source='regularized'` ✅ · OT older than 48h auto-lapses (both the workflow SLA path and the workflow-less sweep, on test clock) ✅ · exports match on-screen filters → moved to 1.7 with the reports themselves.

## Stage 1.5 — Leave module   `[ ☑ done 13 Jul 2026 — backend; ESS leave UI = frontend team on the /leave APIs ]`
**Goal:** ledger-true leave with the six live RML types and automatic monthly accrual.
**Depends on:** 1.3.
**Tasks:**
- [x] P1-T20 — Types seeded (migration 0010): CL/SL/EL/**EL_VOTE**/CO/LWP + ML (gender-conditional) with accrual/carry/encash/half-day/sandwich config — **every rate is a runtime-editable row** (`PUT /leave/types/{code}`, leave.admin, audited); seed rates are DEFAULTS pending P0-T06 sign-off *(LV-01, 09 §1)*
- [x] P1-T21 — `lv.ledger` **append-only at the DB** (UPDATE/DELETE-rejecting trigger, like the audit log); balance = SUM(delta), available = balance − pending applications; **monthly accrual idempotent BY THE DATABASE** (partial unique index: one accrual per employee×type×month), EL gated on `accrual_requires_service_months`, runs 1st 00:05 IST (pg-boss daily + IST-1st guard) — **never blocked by unapproved attendance**; prior-month A/UAB employees flagged via `leave.accrual_exceptions` event subscription *(LV-02/05, PP-1)*
- [x] P1-T22 — Applications (`POST /leave/applications`, leave.own): balance check incl. pending reservations, half-day edges, **sandwich rule per type** (exclude skips holidays/week-offs; include counts them but never overwrites their H/WO record), max_per_request, gender/category applicability, locked-period + overlap guards; **approval = ledger debit + L/CO day-records inside the approving transaction** (completion hooks on 'leave'/'comp_off' chains); **Leave Cancel as re-approval** ('leave_cancel' chain: exact reversal txn + days handed back to the recompute pipeline); **employee-initiated encashment** ('leave_encashment' 3-step chain → 'encash' debit, clamped+audited if the balance moved); **Restricted Holiday** publish → pick (capped by `lv.rh_max_per_year`) → approve → personal H day-record *(LV-03/06/08/09)*
- [x] P1-T23 — Comp-off: **OT convert now credits the ledger for real** (the Stage-1.4 deferred hookup): `comp_off_earn` with `expiry_date = work_date + lv.comp_off_validity_days` (90), fraction by `lv.comp_off_half_day_minutes`(240)/`_full_day_minutes`(480), linked via `att.overtime_entries.comp_off_credit_id` (FK added; paid-XOR-comp-off CHECK live); **daily expiry sweep** (00:30 IST) lapses unused credits FIFO-generously + idempotently; applying CO = normal application against the CO balance on the 'comp_off' chain *(LV-04, PP-18)*
- Also: `leave.own` permission added to the grid (all roles, like attendance.own) — seed:rbac now 39 permissions/165 grants; year-end carry-forward cap job (`POST /leave/year-end/run`, boundary pending P0-T06); manual adjustments (leave.admin, note mandatory by DB CHECK, audited); FK `att.day_records.leave_type_id` → lv.leave_types live.
**Tests:** 9 integration (hand-computed): accrual rates + EL service gate + DB-idempotence; sandwich exclude 3 vs include 4 over the same Fri–Mon; apply→approve e2e (API) with ledger −3 and per-day L records; balance guard; cancel reversal to the paise-exact day count + recompute handback; LWP writes days with zero ledger rows; OT 270 min → 0.5 comp-off earn → half-day spend → expiry sweep lapse (idempotent); RH cap + approved pick = H day; encashment 3-step chain → −5 encash txn + duplicate blocked — **120 total green, verify exit 0**.
**Exit criteria:** balances on ESS match ledger sums ✅ (API = SUM proven) · accrual job runs on test clock without human trigger ✅ (idempotent, worker-scheduled) · a cancelled approved leave leaves a zero-net ledger trail ✅ (−3 then +3, both rows immutable).

## Stage 1.6 — Absenteeism, alerts, letters, policies   `[ ☐ ]`
**Goal:** the automated vigilance HR asked Protiviti for 26 times — incl. the daily email. **Ship the email first.**
**Depends on:** 1.2 (statuses); letters need 1.3 (signature workflow).
**Tasks:**
- [ ] P1-T31 — **Daily 07:00 boarding/exit email** per plant to HR/BH/CEO Cell, sent even when empty *(LC-03, PP-6/26)* ← deliver as early as data allows
- [ ] P1-T30 — Absenteeism engine: daily scan; UAB alerts up hierarchy + HR; `absence_cases` watch(≥4d)→show_cause(≥7d)→warning; letter issued through the system *(ATT-10/11, PP-7)*
- [ ] P1-T32 — Letters engine: docx templates + merge fields + **Letter Signature Approval** chain; show-cause/warning/certificates archived on employee + ESS *(CORE-09)*
- [ ] P1-T33 — Policy repository + acknowledgment tracking + weekly nag + HR tile *(CORE-13)*
**Tests required:** case stage transitions on test clock; email renders with ExcelJS attachment; empty-day email still sends; letter merge-field validation.
**Exit criteria:** email observed on 3 consecutive mornings incl. one empty day · a 7-day synthetic absence opens a show-cause case with letter linked · policy-ack % tile matches DB.

## Stage 1.7 — Reports, dashboards, ESS, month lock   `[ ☐ ]`
**Goal:** the flagship muster + the daily surfaces for every role; the month becomes lockable.
**Depends on:** 1.2, 1.5 (leave columns), 1.4 (AR/OD/OT data).
**Tasks:**
- [ ] P1-T40 — **R1 Muster Summary** with RM + Functional Mgr + Emp ID + Cost Center + leave columns; precomputed MV; virtualized; <10 s export at 3k (headroom to 10k <15 s) *(RPT-01, LV-07, PP-5/8/15/25)*
- [ ] P1-T41 — R2 swipe/reconciliation (+cross-plant flag), R3 AR/OD, R4 late/early/UAB, R5 OT register, R6 absence cases, R24 boarding/exit, R27 headcount — all Excel-export with applied filters *(RPT-06)*
- [ ] P1-T42 — HR Ops dashboard (05 §4.1) · manager team month-grid + roster editor · senior-manager subtree toggle (KQ) · device-health board
- [ ] P1-T43 — ESS: home (greeting, shift chip, tiles) + My Attendance (calendar, day drill) + My Leave (balances, apply) *(05 §4.3/4.4/4.9)*
- [ ] P1-T07 — Month-lock checklist + freeze trigger; **sync-watermark rule: no day finalized (no Absent marked) until device watermark passes shift end** *(ATT-12/15, doc 14 §8.5)*
**Tests required:** muster MV vs raw recompute equivalence; export = view query (same filters); perf test 3k×31 in CI; lock immutability trigger; watermark holds finalization.
**Exit criteria:** HR ops downloads the June-template muster with the new columns in <10 s · month-lock blocked until checklist green · CI perf test passes.

---

## Gate G1 — Phase 1 sign-off
- [ ] One full month of HRMS attendance in parallel with greytHR; muster matches plant reality (spot-checks vs Kent raw)
- [ ] Managers doing approvals in-app (adoption evidence, not just capability)
- [ ] Boarding/exit email running daily without manual trigger
- [ ] **PP-9 replication test:** a silenced device is detected + flagged; the affected days are held un-finalized by the watermark — the 200-employee mismatch is demonstrably impossible
- [ ] HR-ops UAT sign-off (07 §4b: training materials delivered)
