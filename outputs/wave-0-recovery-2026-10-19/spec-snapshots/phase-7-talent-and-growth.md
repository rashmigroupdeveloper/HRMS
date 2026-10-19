# Phase 7 — Talent & Growth

**Target:** 8–10 weeks · **Gate:** **G7** · **Depends on:** G3 (lifecycle) and G5a
**Spec:** [`docs/15`](../docs/15-FEATURE-GAP-AUDIT.md) Register B · [`docs/16`](../docs/16-MICROFEATURE-INVENTORY.md) §14, §16–§19
**Architecture:** [`extended-roadmap.md`](extended-roadmap.md)

**Purpose.** Four of the fourteen modules every benchmark platform ships are recorded non-goals here — performance,
learning, compensation review, succession. That was a defensible Phase-1–3 choice, but three of them have already
leaked into requirements we accepted: **LC-04 needs a confirmation appraisal**, **PAY-17 needs increment
processing**, and **CORE-14 plus every plant audit needs a training record**. This phase closes the loop, and adds
the benefits and recruitment depth an employer of 2,000+ across 14 entities cannot run without.

**Sponsor pre-condition:** decision **D10** (performance & training). The recommendation in docs/15 §9.3 is
**training matrix in** (it is an audit artefact, not an L&D nicety) and **appraisals in this phase** rather than
indefinitely deferred, because the increment cycle is otherwise ungrounded.

> **Working rule for this phase.** Everything here is judgement about people, so **every judgement carries an
> auditable reason**. A rating changed in calibration, an increment above guideline, a PIP opened, a candidate
> rejected — each records who, when, and why. No silent adjustments anywhere.

---

## Stage 7.1 — Goals & review cycles   `[ ☐ ]`
**Goal:** the instrument that LC-04 confirmation and PAY-17 increments have been missing.
**Depends on:** G3. **Closes:** GAP-B01 (part 1).
**Requirement IDs:** `PMS-01..06`

**Tasks**
- [ ] `P7-T01` **PMS-01 goal framework** — configurable per entity/category: KRA/KPI with weightings for
      blue-collar and staff, OKR for management. One engine, two presentations; the *framework choice is a
      setting*, not a fork in the code.
- [ ] `P7-T02` **PMS-02 goal cascade** — org → department → individual with auto-rollup, alignment view, and
      conflict detection (two people owning the same number).
- [ ] `P7-T03` **PMS-03 review cycle engine** — annual, mid-year, quarterly, **probation (30/60/90)**, and
      project-based; window open/close, eligibility rules (joined before X, not on notice), reminders.
- [ ] `P7-T04` **PMS-04 participant model** — self, manager, skip-level; forms with sections, rating scales
      (3/4/5-point configurable) and mandatory comments on extreme ratings.
- [ ] `P7-T05` **PMS-05 probation/confirmation appraisal** wired into **LC-04**: the confirmation workflow now
      *consumes* a completed appraisal instead of an opinion, with extension as a first-class outcome.
- [ ] `P7-T06` **PMS-06 continuous feedback** — lightweight kudos and 1:1 notes, visible to the pair only, feeding
      the review form as optional context.

**Data model:** `pms.cycles`, `pms.goals`, `pms.goal_links`, `pms.reviews`, `pms.review_forms`,
`pms.responses`, `pms.rating_history` (append-only), `pms.feedback`.

**UI & navigation**
- Ops: `/performance` — group **Talent**, icon `Target`, permission `pms.review.manage`. Tabs: *Cycles · Goals ·
  Reviews · Calibration (7.2) · Analytics*.
- Manager: reviews appear in the **existing Approvals inbox** as a request type with an SLA — managers already
  live there daily; a second inbox would be ignored. The team view gains a per-person review status chip.
- ESS: `/my/goals` in More, **plus a home card while a cycle window is open** with the days remaining. Outside a
  window the card disappears entirely — this is the "surface it when it matters" rule from the roadmap §4.3.
- Forms autosave per section (kill-list), survive navigation, and show the rating scale's plain-language anchors
  inline rather than in a tooltip.

**Real-world use case.** *A trainee's 90-day probation review opens automatically on day 75. Their manager
completes it in the approvals inbox alongside leave requests. The confirmation workflow (LC-04) picks up the
completed appraisal, HR head approves, the salary switch from probation percentage to full (PAY-02) fires, and the
confirmation letter issues. Previously this was a reminder email and a verbal opinion.*

**Interrelations.** Feeds LC-04 confirmation and PAY-02 salary switch · outputs feed 7.4 compensation · consumes
the WF engine · goal data feeds the 9-box in 7.2.

**Tests required**
- Cycle eligibility across joiners, exits, transfers and people on notice; nobody is silently omitted or duplicated.
- Cascade rollup arithmetic and conflict detection.
- Probation review → confirmation → salary switch end-to-end, including the extension path.
- Autosave: no data loss across navigation, refresh, or session timeout mid-form.

**Exit criteria:** one probation cycle and one mid-year cycle run for a pilot department · a confirmation decided
from a completed appraisal end-to-end.

---

## Stage 7.2 — 360, competency, calibration & talent view   `[ ☐ ]`
**Goal:** ratings that survive scrutiny, and the talent picture the CEO cell keeps asking for.
**Depends on:** 7.1. **Closes:** GAP-B01 (part 2), B04 (competency half), B05.
**Requirement IDs:** `PMS-07..14`, `TAL` folded in

**Tasks**
- [ ] `P7-T07` **PMS-07 360° feedback** — reviewer nomination with manager approval, weighting per reviewer class,
      anonymity thresholds (no aggregate shown below N respondents), aggregate scoring.
- [ ] `P7-T08` **PMS-08 competency framework** — role-based competency sets, proficiency levels, gap analysis.
- [ ] `P7-T09` **PMS-09 calibration** — sessions by unit, side-by-side comparison, **every adjustment records a
      before/after, an actor and a reason**; the audit trail is the deliverable, not the meeting.
- [ ] `P7-T10` **PMS-10 distribution guidance** — configurable target distribution shown as guidance with variance
      highlighted; **never an automatic forced curve** (a forced curve applied by software is an industrial-
      relations risk in an Indian manufacturing setting — this is a deliberate design choice, recorded here).
- [ ] `P7-T11` **PMS-11 9-box** performance × potential, with movement over cycles.
- [ ] `P7-T12` **PMS-12 PIP** — trigger, milestones, review points, outcome, and an explicit link to the IR path
      in Phase 6 when it fails (documented process, not an ambush).
- [ ] `P7-T13` **PMS-13 succession & bench** — critical roles, successor readiness (ready now / 1–2 yr / 3+),
      risk-of-loss, and **IDPs** that consume the training catalogue from 7.3.
- [ ] `P7-T14` **PMS-14 performance analytics** — distribution, reviewer consistency, rating inflation trend,
      manager-level bias indicators.

**UI & navigation**
- Calibration is a **dedicated full-width workspace** (`/performance/calibration/:cycleId`) — a grid of people,
  filter by unit, drag between rating bands, with a mandatory reason modal on every move and a running distribution
  chart. It is the one screen in the product that justifies a large monitor.
- 9-box lives on `/performance` → Analytics and, **aggregate-only**, on the executive dashboard.
- ESS sees their own 360 aggregate only above the anonymity threshold, with a plain explanation when below it.

**Real-world use case.** *In calibration, a plant manager moves three of his eight reports up a band. The system
requires a reason on each, shows his unit is now 62% above target against a 30% guideline, and records the whole
session. When one of those employees later disputes an increment, the trail exists.*

**Interrelations.** Feeds 7.4 (rating → increment guideline) · IDPs consume 7.3 training · PIP failure path links
to Phase 6 `ird` · succession feeds 7.6 internal mobility.

**Tests required**
- **Calibration audit completeness:** every rating that differs from the manager's submission has a reason, actor
  and timestamp — property test over generated sessions.
- Anonymity threshold: no 360 aggregate is ever exposed below N, including via export or API.
- 9-box placement matches its inputs; movement history preserved across cycles.
- Distribution guidance never mutates a rating by itself (negative test).

**Exit criteria:** one calibrated cycle with a complete adjustment trail · 9-box reviewed by the CEO cell · one
PIP run to an outcome.

---

## Stage 7.3 — Training matrix, certifications & skills   `[ ☐ ]`
**Goal:** the audit artefact first, the learning platform never.
**Depends on:** 5.4 (expiry engine), 6.6 (safety inductions). **Closes:** GAP-B03, B04, and PSH-06's dependency.
**Requirement IDs:** `LRN-01..11`

> **Scope discipline:** this stage builds a *training record and matrix*, not an LMS. Courseware delivery
> (SCORM/video) stays a non-goal. What auditors, the OSH Code and POSH ask for is evidence of *who is trained and
> current* — that is what we build.

**Tasks**
- [ ] `P7-T15` **LRN-01 training catalogue** — course, type (safety / statutory / technical / behavioural),
      validity period, delivery mode, provider.
- [ ] `P7-T16` **LRN-02 training matrix** — role × course requirement per entity/plant, so "what must this person
      have?" is data.
- [ ] `P7-T17` **LRN-03 training records** — attendance capture (including bulk capture from a session sheet, the
      realistic plant workflow), assessment result, certificate in the document vault.
- [ ] `P7-T18` **LRN-04 certification validity** — reuses the Stage 5.4 expiry engine; expiry can **gate** work
      (a lapsed forklift licence blocks that roster assignment, like the OT cap does).
- [ ] `P7-T19` **LRN-05 mandatory-training register** — safety induction, POSH, fire, first-aid, ISO/IATF — with a
      coverage report per plant per course, in the language the training was delivered in.
- [ ] `P7-T20` **LRN-06 training calendar & nomination** — schedule, nominate, confirm, attendance, feedback.
- [ ] `P7-T21` **LRN-07 skills inventory** — skill taxonomy, per-person proficiency (from training, assessment or
      manager rating), **skill gap by role and by production line**.
- [ ] `P7-T22` **LRN-08 contractor worker training** — the same matrix applied to `clb.workers`, feeding the
      Phase-6 gate.

**UI & navigation**
- `/learning` — group **Talent**, icon `GraduationCap`, permission `lrn.matrix.manage`. Tabs: *Matrix · Records ·
  Calendar · Certifications · Skills · Coverage*.
- The **coverage view is the primary screen**, not the catalogue: a role × course grid per plant, cells coloured in
  the shared expiry language, click-through to the missing people.
- ESS: `/my/training` in More **plus a home card when a certification expires within 30 days**.
- Manager: a "team certifications" panel in the team view; the roster editor blocks an assignment requiring a
  lapsed certification, naming it (UX contract §10 again — one pattern, used everywhere).

**Real-world use case.** *An IATF audit asks for evidence that every crane operator's training is current. The
coverage grid shows 34 of 36 current and 2 expiring in 11 days, with certificates attached. The two are already
nominated for next week's refresher. The auditor gets a PDF, not a promise.*

**Interrelations.** Expiry engine (5.4) · safety inductions (6.6) · gate pass validity (6.2) · POSH training
coverage (5.5) · IDPs (7.2) · roster gating (Phase 1).

**Tests required**
- Coverage report exactly equals the record set (no rounding, no stale cache) — property test.
- Expiry alerts at T-30/15/7 to person + manager + training admin.
- Roster refusal on lapsed mandatory certification, including bulk roster upload.
- Bulk attendance capture is idempotent (a re-uploaded session sheet does not duplicate records).

**Exit criteria:** matrix populated for one plant's critical roles · a real expiry alert and a real roster refusal ·
POSH training coverage report feeding Stage 5.5's annual return.

---

## Stage 7.4 — Compensation review cycle   `[ ☐ ]`
**Goal:** increments become a governed, budgeted, auditable cycle instead of a spreadsheet.
**Depends on:** 7.1/7.2 (ratings), G2 (payroll), 5.1 (wage-definition check). **Closes:** GAP-B02.
**Requirement IDs:** `CMR-01..09`

**Tasks**
- [ ] `P7-T23` **CMR-01 cycle definition** — period, eligibility, effective date, and a **budget pot per business
      unit** with distribution rules.
- [ ] `P7-T24` **CMR-02 pay structure** — bands/ranges per grade, compa-ratio, range penetration; a proposal
      outside the band is flagged, not blocked.
- [ ] `P7-T25` **CMR-03 manager proposal worksheet** — the team, their current pay, rating, compa-ratio,
      guideline range from the rating, and a proposal field with a **live budget meter**. Over-budget requires a
      reason and a higher approver.
- [ ] `P7-T26` **CMR-04 multi-level approval** on the WF engine (manager → function head → HR head → CHRO by
      threshold), with roll-up views at each level.
- [ ] `P7-T27` **CMR-05 promotion handling** within the cycle — grade change, designation change, and the
      structure rebuild that follows.
- [ ] `P7-T28` **CMR-06 publish & letters** — freeze the cycle, generate increment/promotion letters from the
      cycle data (not retyped), e-sign, release on a scheduled date.
- [ ] `P7-T29` **CMR-07 payroll hand-off** — approved proposals become dated salary revisions; **every revised
      structure re-runs the ≥50% wage-definition check from 5.1** and a failure blocks publication.
- [ ] `P7-T30` **CMR-08 variable pay / incentive plans** — plan definition, achievement input, payout computation,
      approval, payroll hand-off; `CMR-09` **pay-equity view** (comparable roles, gap analysis).

**UI & navigation**
- `/compensation` — group **Talent**, icon `TrendingUp`, permission `cmr.cycle.manage`. Tabs: *Cycles · Budgets ·
  Proposals · Approvals · Letters · Equity*.
- The **manager worksheet is the make-or-break screen**: one table, inline editing, a sticky budget meter, keyboard
  navigation between rows, autosave, and an "explain this guideline" affordance. It is used by non-HR people once a
  year under time pressure — it must be self-explanatory with zero training.
- Salary values are step-up gated (5.2) and masked in screenshots-by-default for shoulder-surfing safety in
  open-plan offices.
- ESS sees nothing until release; on release, the increment letter appears in `/my/letters` with the revised
  structure, and the next payslip's `calc_note` references the revision.

**Real-world use case.** *The April cycle opens with a ₹3.2 Cr pot split across four business units. A plant head
proposes 11% for a high performer whose compa-ratio is already 1.18; the worksheet flags it and routes to the CHRO.
On publish, 1,340 letters generate from cycle data, e-sign, and release at 10:00 on 1 April. Four structures fail
the 50% wage check and are blocked from publication until corrected — the failure is caught before payroll, not by
an inspector.*

**Interrelations.** Consumes ratings (7.1/7.2) · produces salary revisions for payroll (G2) · gated by the wage
rule (5.1) · letters via the vault + e-sign (5.4) · settlements from Phase 6 IR can drive collective revisions.

**Tests required**
- Budget cannot be exceeded without an explicit, recorded override and the correct higher approver.
- **Every published revision passes the wage-definition check** — negative test proves publication is blocked.
- Letter content matches the cycle data exactly (golden-file comparison; no retyping path exists).
- Effective-dated revision reaches the correct payroll period, including a mid-cycle joiner and an exit.
- Pay-equity computation is deterministic and reproducible.

**Exit criteria:** one full cycle from budget to released letters to revised structures in payroll · a blocked
publication demonstrated on a wage-rule failure.

---

## Stage 7.5 — Benefits administration   `[ ☐ ]`
**Goal:** the half of "total rewards" that PF and ESIC do not cover.
**Depends on:** G2, 5.3 (health data consent), 5.4 (documents). **Closes:** GAP-B06, B12, A22 (partly).
**Requirement IDs:** `BEN-01..10`

**Tasks**
- [ ] `P7-T31` **BEN-01 plan master** — group mediclaim, GPA, GTLI per entity: insurer, policy number, period,
      sum insured by grade, dependant rules, premium split.
- [ ] `P7-T32` **BEN-02 enrolment** — auto-enrol on joining, dependant capture with consent (5.3), mid-year
      additions/deletions (marriage, childbirth, exit) with effective dates.
- [ ] `P7-T33` **BEN-03 insurer file exchange** — endorsement files out, member confirmations in, behind a
      provider interface; discrepancy report.
- [ ] `P7-T34` **BEN-04 voluntary top-up / parental cover** — election window, premium computed, deduction as a
      payroll input row.
- [ ] `P7-T35` **BEN-05 claim assist** — intimation, document upload, TPA reference and status tracking (we do not
      adjudicate; we make the employee's life navigable).
- [ ] `P7-T36` **BEN-06 superannuation & NPS** — scheme, contributions, PRAN, statements.
- [ ] `P7-T37` **BEN-07 gratuity fund reconciliation** — LIC/trust balance vs computed actuarial liability from
      the payroll engine, with a variance report for finance.
- [ ] `P7-T38` **BEN-08 flexi-benefit plan** — declaration window, component selection within CTC, lock date,
      payroll effect (the concrete implementation of the flexi-basket referenced in CLM-01).
- [ ] `P7-T39` **BEN-09 total-rewards statement** — one page per employee: cash, statutory, insurance, retirals,
      canteen/transport subsidy, training investment.
- [ ] `P7-T40` **BEN-10 maternity mechanics** — 26-week entitlement engine, medical bonus, post-natal WFH option,
      no-dismissal protection flag, crèche register for locations above the threshold.

**UI & navigation**
- Ops: `/benefits` — group **Workplace**, icon `HeartPulse`, permission `ben.plan.manage`. Tabs: *Plans ·
  Enrolments · Dependants · Insurer files · Retirals · Claims*.
- ESS: `/my/benefits` in More, **plus a home card during an enrolment or declaration window** with a deadline
  countdown. The **total-rewards statement is a card on the ESS home once a year**, in the month after the cycle —
  it is the single highest-value thing an employee can see and it should not be hidden in a menu.
- Health/clinical content follows the restricted pattern from 6.6; HR sees enrolment, not diagnosis.

**Real-world use case.** *An employee's child is born on 3 May. They add the dependant in ESS with a birth
certificate; the endorsement file goes to the insurer on the 5th; the confirmation returns on the 9th; the
premium delta appears as a payroll input for May with a `calc_note`. Today this is an email chain that sometimes
takes a quarter and occasionally fails silently.*

**Interrelations.** Payroll input rows (G2) · consent (5.3) · documents (5.4) · maternity ties to the Phase-1
leave engine and the statutory registers in 5.6 · gratuity reconciliation reads the payroll liability.

**Tests required**
- Enrolment → endorsement → confirmation round-trip against recorded insurer files; discrepancies surfaced.
- Effective-dated dependant changes hit the correct premium period, including retro additions.
- Deduction reconciliation to the rupee against payroll input rows.
- Maternity: 26-week entitlement across a financial-year boundary; no-dismissal flag blocks a separation workflow.
- Health/clinical access negative tests (HR roles receive 403).

**Exit criteria:** one entity fully enrolled with an insurer file accepted · a mid-year addition round-tripped ·
total-rewards statement reviewed by the sponsor · maternity case run end-to-end.

---

## Stage 7.6 — Recruitment depth   `[ ☐ ]`
**Goal:** the requisition-to-offer spine the Phase-4 "absorption" does not provide.
**Depends on:** G3, 5.4 (e-sign), 7.4 (bands for offer modelling). **Closes:** GAP-B07, B08 (requisition half), B15, B16.
**Requirement IDs:** `REC-01..12`

**Tasks**
- [ ] `P7-T41` **REC-01 manpower requisition (MRF)** — role, grade, cost centre, replacement vs new, justification,
      **budgeted-headcount check** against the position master (`REC-02`), approval chain per docs/08.
- [ ] `P7-T42` **REC-02 position / establishment master** — sanctioned posts per cost centre, occupied, vacant,
      frozen; the thing budget vs actual headcount reporting has been missing.
- [ ] `P7-T43` **REC-03 JD library** linked to requisitions and to the competency framework (7.2).
- [ ] `P7-T44` **REC-04 interview scheduling + panel scorecards** — structured, per-competency, comparable across
      candidates; free-text-only feedback is disallowed by design.
- [ ] `P7-T45` **REC-05 offer modelling** — CTC breakup preview against the band (7.4) and the **≥50% wage rule
      (5.1) checked at offer time**, not at joining.
- [ ] `P7-T46` **REC-06 LOI/offer approval chain** (the existing WF-01 LOI chain: initiator → plant head/GM → HR
      head → CEO) with `REC-07` **offer letter e-sign** and acceptance tracking.
- [ ] `P7-T47` **REC-08 background verification** — vendor order, status, results, adverse-action handling with a
      documented right to respond.
- [ ] `P7-T48` **REC-09 candidate privacy** — notice, consent, retention and purge inherited from 5.3 (candidates
      are data principals too; this is a common blind spot).
- [ ] `P7-T49` **REC-10 internal job posting** + `REC-11` **employee referral** with payout through payroll ·
      `REC-12` recruitment analytics (time-to-fill, source-of-hire, offer-drop, funnel) closing R21/R22.
- [ ] `P7-T49b` **REC-13 workforce scenarios.** Position master (REC-02) + current salaries → a what-if:
      freeze hiring / add N posts / apply a % increment at a plant or MIS code, and show headcount + manpower-cost
      delta. Output is a dated scenario, not a live edit. Feeds the CEO “budget vs actual” tile (25.18).

**UI & navigation**
- `/recruitment` already exists in nav (group **People**, icon `UserSearch`). This stage fills it: tabs
  *Requisitions · Positions · Pipeline · Interviews · Offers · BGV · Analytics*.
- Manager entry is the **"Raise a requisition" action in the team view** — the same principle as discipline: the
  manager triggers, HR owns.
- ESS: internal job postings appear as a **card on the ESS home when a matching role opens** (matched on grade and
  skills from 7.3), not as a nav item nobody visits.

**Real-world use case.** *A plant head raises an MRF for two fitters. The position master shows 34 sanctioned, 34
occupied — no vacancy — so the requisition is refused with the numbers shown, and he raises a sanction-increase
instead. Six weeks later the offer for the eventual hire is modelled against the band, passes the wage check at
offer time, is approved through the LOI chain, e-signed by the candidate, and flows into pre-boarding.*

**Interrelations.** Positions feed budget-vs-actual headcount reporting (Phase 8 §25.18) · offers feed Phase-3
onboarding · e-sign from 5.4 · wage rule from 5.1 · candidate data governed by 5.3 · absorbs/replaces the Phase-4
ATS scope depending on decision D-ATS.

**Tests required**
- Requisition refused without a sanctioned vacancy; the override path requires the right approver and a reason.
- Offer CTC fails the wage check → offer cannot be released (negative test).
- Scorecard comparability: two candidates on the same requisition produce comparable structured outputs.
- Candidate retention/purge behaves exactly like employee retention (shared machinery, not a copy).

**Exit criteria:** one requisition → offer → e-signed acceptance → onboarding handoff · position master loaded for
one entity · R21/R22 reporting live from internal data.

---

## Stage 7.7 — Exit intelligence & alumni   `[ ☐ ]`
**Goal:** make attrition explainable rather than merely countable.
**Depends on:** G3 (separation). **Closes:** GAP-B14, B17 (onboarding depth), B18 (org chart).
**Requirement IDs:** `PMS` + `LC` extensions

**Tasks**
- [ ] `P7-T50` **Exit interview instrument** — structured, per exit type, with a **controlled attrition-reason
      taxonomy** (the free-text field is secondary), administered before the LWD and again 30 days post-exit.
- [ ] `P7-T51` **Attrition analytics** — reason × unit × manager × tenure × grade, feeding the CEO dashboard's
      new-hire attrition KPIs (RPT-03) with *why*, not just *how many*.
- [ ] `P7-T52` **Knowledge-transfer / handover checklist** in the separation pipeline, gating clearance.
- [ ] `P7-T53` **Rehire eligibility** flag with reason and approver; enforced at candidate creation in 7.6.
- [ ] `P7-T54` **Onboarding depth** — buddy assignment, 30/60/90 check-ins, onboarding feedback survey (closes the
      loop with 7.1's probation review).
- [ ] `P7-T55` **Interactive org chart** — browse, search, span-of-control, functional vs reporting line toggle,
      vacancy visualisation from the position master.
- [ ] `P7-T56` **LC-08 retirement pipeline.** 60/90-day runway from `dob` + policy retirement age (setting, not
      hardcoded): task fan-out (HR, payroll, IT, benefits, quarters), superannuation/NPS hand-off (7.5), clearance
      matrix, last-working-day, letters. Distinct from resignation (LC-06). A person on the runway cannot be
      quietly dropped from the confirmation or increment cycle.

**UI & navigation**
- Exit interview lives in `/lifecycle` → separation; analytics in `/reports` and on the executive dashboard.
- Org chart is a **tab on `/people`**, not a new nav item — it is a way of looking at the directory, not a
  separate destination.
- Buddy and 30/60/90 tasks land in the existing onboarding task fan-out (LC-02), not a new system.

**Real-world use case.** *Q2 attrition in one rolling-mill section is 3× the plant average. The dashboard drills to
14 exits, 9 citing "shift pattern" and 6 naming the same supervisor. That is actionable in a way a headcount
number never was.*

**Tests required:** taxonomy completeness (no exit closes without a reason); analytics reconcile with headcount
movement exactly; rehire flag blocks candidate creation; org chart respects data scoping (a manager sees their
subtree, not the group).

**Exit criteria:** exit interviews running for a quarter with reason analytics on the executive dashboard · org
chart live · 30/60/90 check-ins completing for a joiner cohort · one retirement run end-to-end with superannuation
hand-off.

---

## Stage 7.8 — Engagement the brochure promised: R&R, eNPS, birthdays, EAP   `[ ☐ ]`
**Goal:** close B11 / B13 / B12 and the daily “this HRMS feels unfinished” list. Doc 15 §9.4 assigned these to
Phase 7; the original file forgot them.
**Depends on:** G3 (engagement module exists), 5.3 (consent for photos / health). **Closes:** GAP-B11, B12, B13,
doc 16 §2.10, §20.7–20.9, §20.8.
**Catalog:** [`coverage-closeout.md`](coverage-closeout.md). **Requirement IDs:** `ENG-01..05`

**Tasks**
- [ ] `P7-T70` **ENG-01 rewards & recognition.** Spot award, peer kudos, nomination → approval, budget pot,
      points and/or payroll payout as a `pay.inputs` row (PAY-23 contract). PMS-06 1:1 notes stay private; this is
      the *public* path.
- [ ] `P7-T71` **ENG-02 eNPS + pulse.** Recurring pulse (EN-03 built, not only specced), eNPS, driver analysis,
      manager-level heatmap, action-plan owner. Anonymous above a threshold N. Never a named score on a
      disciplinary file.
- [ ] `P7-T72` **ENG-03 birthdays / work anniversaries** on the ESS home feed, audience-scoped, suppressible per
      person (consent). Not a nav item.
- [ ] `P7-T73` **ENG-04 wellness / EAP.** Programme enrolment + **confidential counselling referral** that HR
      cannot read (same access model as 5.5, narrower). Clinical content never on the HR profile. Health-check
      campaigns stay in 6.6 EHS.
- [ ] `P7-T74` **ENG-05 education & prior experience** on the employee profile (structured, dated), feeding
      skills (7.3) and BGV (7.6). Not free text in a notes blob.

**UI:** R&R is a card on ESS home + a tab on `/engagement`. Pulse is a home card during a window. EAP entry is in
the account menu next to “confidential concern”, never in the pill strip.

**Tests:** kudos cannot pay without approval; eNPS below N never deanonymises (export included); HR 403 on EAP
clinical; anniversary feed respects suppress; education rows are dated and scoped.

**Exit criteria:** one spot-award paid through payroll · one pulse with a manager heatmap · EAP referral proven
unreadable by hr_ops.

---

## Gate G7 — Phase 7 sign-off
- [ ] One full review cycle including calibration with a complete adjustment trail
- [ ] One merit cycle from budget → proposals → approvals → published letters → revised structures in payroll,
      with a wage-rule block demonstrated
- [ ] Training matrix showing real coverage for a plant's critical roles; a real expiry alert and roster refusal
- [ ] Benefits enrolment file accepted by the insurer; a mid-year dependant addition round-tripped
- [ ] One requisition → e-signed offer → onboarding handoff, with a budgeted-headcount refusal demonstrated
- [ ] Exit-reason analytics live on the executive dashboard
- [ ] One retirement pipeline completed; one workforce scenario reviewed by the CEO cell
- [ ] R&R payout in a live payroll run; one pulse with a heatmap; EAP access-refusal demonstrated
- [ ] `npm run verify` green; G7 E2E journey (goals → review → calibration → increment → letter) in Playwright
