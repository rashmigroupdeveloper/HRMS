# Phase 1 — Attendance · Leave · Workflows · Core Reports

**Target:** 6–8 weeks · **Gate:** G1 · **Spec:** docs/13 §4, docs/04 §1–2/§5, docs/03 §4–5/§8
**Purpose:** the visible win — trusted attendance, in-app approvals, the muster HR was refused for a year, and the daily boarding/exit email. Ships the pain-point killers before payroll.

> Sequencing: 1.1 first so data accumulates while the rest is built. 1.6's boarding/exit email is small + high-visibility — deliver early. 1.3 unblocks 1.4/1.5.

---

## Stage 1.1 — Ingestion productionized + device health   `[ ☐ ]`
**Goal:** Kent swipes flow in every ≤5 min, immutably, with silence detected — the PP-9 fix.
**Depends on:** Phase 0 (Stage 0.6 spike).
**Tasks:**
- [ ] P1-T01 — Production pipeline: `*/5 min` pg-boss job, per-device watermark, 30-min overlap, idempotent upsert on `(employee_no, swipe_ts, door_code)`, **partitioned** `att.swipe_events`, bulk-insert path for reconnect floods *(ATT-01)*
- [ ] P1-T02 — Device health: `att.devices` last_seen + expected-hourly baseline; **offline alert to IT** at 10–15 min silence in working hours; device-health dashboard tile *(ATT-02)*
- [ ] P1-T03 — Unmatched-swipe exception queue (employee_id NULL → HR queue, never dropped) *(04 §1.1)*
- [ ] doc14-§8.4 — Clock-drift quarantine: punches outside plausibility window → exception queue; daily device time-sync where protocol allows
**Modules/files:** `apps/api/src/modules/attendance/ingestion/`, `jobs/kent-sync.ts`
**Tests required:** idempotency (same batch twice → zero new rows); out-of-order arrival; reconnect-flood (10k punches one burst); gap-detection alert fires; quarantine boundaries.
**Exit criteria:** 3 consecutive days of live ingestion ≤5-min lag · re-run of any window creates zero dupes · a silenced test device pages within threshold.

## Stage 1.2 — Shifts, rosters, day-status processor   `[ ☐ ]`
**Goal:** raw swipes become correct day statuses — session-aware, recomputable, never manager-editable.
**Depends on:** 1.1.
**Tasks:**
- [ ] P1-T04 — Shifts (grace, half/full-day thresholds, crosses-midnight), manager-maintained rosters + monthly-5th reminder, holiday calendars per location; **two-session day model + Saturday GCS scheme** *(ATT-04/05/13, 09 §4)*
- [ ] P1-T05 — Day-status processor per 04 §1.1: FILO basis (ATT-18), cross-plant swipes valid + reconciliation flag (ATT-16), idempotent recompute on dirty-flag; manual override HR-only + reason + audit (ATT-17)
- [ ] P1-T06 — Week-off eligibility at week close (zero worked days → unpaid WO; whole-month rule) + Penalty Days policy hook *(ATT-09)*
**Modules/files:** `apps/api/src/modules/attendance/{shifts,rosters,processor}/`
**Tests required:** processor golden cases (each day-status branch of 04 §1.1); two-session dual-status; night-shift date attribution; week-off eligibility (PI-PAY-1/2 exact scenarios); recompute idempotence (property test).
**Exit criteria:** processor output matches hand-computed fixtures for every status branch · recompute of a locked month is rejected · manager cannot reach any status-edit endpoint (authz test).

## Stage 1.3 — Workflow engine + approvals inbox   `[ ☐ ]`
**Goal:** the generic approval spine (approve / reject / **send_back**) with provable notifications.
**Depends on:** Phase 0 (0.4 notifications).
**Tasks:**
- [ ] P1-T10 — Engine: `wf.{definitions,requests,request_steps,delegations}`; steps resolve RM/functional-mgr/role/user; vacant-approver auto-skip + audit; **every step writes `notified_at`** (the anti-PP-14 receipt) *(WF-01..04)*
- [ ] P1-T11 — Seed the authoritative catalog (08 §4 / 09 §10.2): Leave, Leave Cancel, Leave Encashment, Comp Off, Restricted Holiday, Regularization & Permission, OD, Overtime, Claim, Loan, Confirmation, Resignation, Transfer, Letter Signature
- [ ] P1-T12 — Approvals inbox: one cross-type queue, ≤2-click decisions, SLA countdown pills, keyboard `a`/`r`, batch approve, "all caught up" state *(05 §3/§6)*
- [ ] P1-T13 — SLA escalation job (hourly): escalate / auto-reject / lapse per definition *(WF-03)*
**Modules/files:** `apps/api/src/modules/workflows/`, `apps/web/src/pages/approvals/`
**Tests required:** chain resolution incl. cross-entity manager; send_back round-trip; escalation on breach; delegation window; notified_at recorded on every step (integration).
**Exit criteria:** a seeded request walks every action path with a visible timeline · "approver never notified" is impossible: assertion test that a step cannot advance without notified_at.

## Stage 1.4 — AR / OD / Permission + Overtime 48h   `[ ☐ ]`
**Goal:** the attendance-exception requests, and the OT module greytHR never delivered.
**Depends on:** 1.2, 1.3.
**Tasks:**
- [ ] P1-T14 — AR (past-only, window-capped) + **Permission** (time-bounded hours) + OD (**future-dated allowed**, partial-day); approval → day recompute; Excel-exportable *(ATT-06/07, PP-16, KQ)*
- [ ] P1-T15 — OT: detection from swipes beyond shift / WO-H work; daily 18:00 manager summary; **48-hour deadline → lapse job**; approve full/partial or convert to comp-off (one only — DB CHECK); rate from settings *(ATT-08, 04 §1.4)*
**Tests required:** validator rules (AR past-only, OD future OK); OT lifecycle incl. lapse at exactly deadline; paid-XOR-compoff constraint test; conversion creates ledger credit.
**Exit criteria:** e2e: employee applies AR → RM approves → day recomputed with `source='regularized'` · OT older than 48h auto-lapses in test clock · exports match on-screen filters.

## Stage 1.5 — Leave module   `[ ☐ ]`
**Goal:** ledger-true leave with the six live RML types and automatic monthly accrual.
**Depends on:** 1.3.
**Tasks:**
- [ ] P1-T20 — Types seed: CL, SL, EL, **Election Leave**, Comp Off, LWP (+ ML in catalog, gender-conditional) with accrual/carry/encash/sandwich config *(LV-01, 09 §1)*
- [ ] P1-T21 — Immutable `lv.ledger` (balance = SUM(delta)); monthly accrual job (1st 00:05) — never blocked by unapproved attendance, exceptions flagged instead *(LV-02/05)*
- [ ] P1-T22 — Applications (balance check, half-day, sandwich preview); **Leave Cancel as re-approval** reversing the debit; employee-initiated encashment workflow; Restricted Holiday pick→approve→holiday *(LV-03/06/08/09)*
- [ ] P1-T23 — Comp-off: earn from approved WO/H work, expiry window + lapse job *(LV-04)*
**Tests required:** ledger property test (balance always = SUM, never negative available on approve); accrual proration; sandwich rules per type; cancel reverses exactly; comp-off expiry.
**Exit criteria:** balances on ESS match ledger sums for imported employees · accrual job runs on test clock without human trigger · a cancelled approved leave leaves a zero-net ledger trail.

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
