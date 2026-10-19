# Phase 6 — Plant Operations

**Target:** 9–11 weeks · **Gate:** **G6** · **Depends on:** G2 (payroll — canteen/transport/fines recover through it) and G5b
**Spec:** [`docs/15`](../docs/15-FEATURE-GAP-AUDIT.md) Register D · [`docs/16`](../docs/16-MICROFEATURE-INVENTORY.md) §23
**Architecture:** [`extended-roadmap.md`](extended-roadmap.md)

**Purpose.** Docs 00–14 describe an office-shaped employer. Rashmi is a multi-plant steel group where a gate, a
canteen, a bus, a safety incident and a disciplinary case are daily operational facts with money and legal
consequences. **This phase makes the platform fit the actual business** — for the workforce HRMS owns, and by
integrating cleanly with the CLMS for the workforce it does not.

> **Working rule for this phase.** Every control must be enforceable at the point of action — the gate refuses the
> pass, the invoice refuses to release, the roster refuses the save. A dashboard that reports a violation after the
> fact is not a control. UX contract §10 applies to every one of them: the blocked action names the rule, the
> failing condition, and who can override.

**Sponsor decision D8 — SETTLED 3 Sep 2026: contract labour is a SEPARATE product (CLMS).** HRMS does not
build a contractor master, licences, work orders, worker enrolment, ceiling enforcement, contractor muster,
wage registers or a billing gate. Former Stages 6.1 and 6.3 are cancelled and replaced by a single
integration stage. **D13 (plant ops as a phase) still stands** — gate, canteen, transport, EHS and IR are ours.

The residual risk to record: principal-employer liability remains Rashmi's regardless of which system holds
the data, so Stage 6.1's job is to make a contractor lapse *visible here* even though it is *managed there*.

---

## Stage 6.1 — CLMS integration (contract labour is a SEPARATE product)   `[ ☐ ]`
**Goal:** HRMS stops pretending it will own contract labour, and instead consumes what the CLMS knows — without either system becoming the other's fork.
**Scope changed:** 3 Sep 2026, sponsor direction. **Replaces the former Stages 6.1 and 6.3** (contractor master, licences, work orders, worker enrolment, ceiling enforcement, contractor muster, wage register, challan verification, billing gate) — all of that belongs to the CLMS.
**Requirement IDs:** `CLB-INT-01..06`

> **What changed and why it matters.** The former plan built a full CLMS inside HRMS. That is now out
> of scope. But three things do NOT disappear with it, and pretending otherwise is how a gap gets
> missed:
>
> 1. **Principal-employer liability still sits with Rashmi.** Whoever holds the data, the exposure is
>    ours. HRMS's compliance calendar (Stage 5.7) should still carry contractor licence expiry as a
>    tracked obligation, fed from the CLMS — otherwise nobody at Rashmi sees a lapse coming.
> 2. **Contract workers are physically on our sites.** They appear in safety incidents, in
>    permit-to-work, and — critically — in an emergency roll call. A mustering view that can only
>    count employees is worse than useless during an evacuation.
> 3. **Plant headcount and manpower cost are not employees-only numbers.** A plant head asking "how
>    many people are on this line" means everyone.
>
> **The design consequence, stated once so every later stage obeys it:** a contract worker has **no
> row in our database**. Everywhere one is referenced — an incident, a permit, a gate event, a
> muster line — the reference is an **`external_worker_ref`** (source system + their id + a cached
> display name), never a foreign key. Modelling it as an FK would recreate the contractor master we
> just agreed not to own.

**Tasks**
- [ ] `P6-T01` **CLB-INT-01 external worker reference type.** A small shared value object
      (`source`, `external_id`, `display_name`, `contractor_name`, `cached_at`) used by EHS, gate and
      reporting. No table of contractors, no FK, no lifecycle — a cached reference only.
- [ ] `P6-T02` **CLB-INT-02 headcount feed.** A read-only pull from the CLMS: active contract workers
      by plant and trade, refreshed on a watermark, behind a connector interface with a mock — the
      same discipline as `KentConnector` (CLAUDE.md §6). Surfaces on the plant and executive
      dashboards beside on-roll headcount, clearly labelled as contractor.
- [ ] `P6-T03` **CLB-INT-03 licence obligations into the compliance calendar.** Contractor CLRA
      licence expiries arrive as `cmp.calendar_items` so the Stage 5.7 alert ladder and posture board
      cover them. Rashmi sees the lapse even though the CLMS owns the licence.
- [ ] `P6-T04` **CLB-INT-04 gate scope.** HRMS gate passes (Stage 6.2) cover **employees and
      visitors**. Contractor passes stay with the CLMS. Where the physical gate is shared, HRMS
      records the event against an `external_worker_ref` and never asserts validity it cannot check.
- [ ] `P6-T05` **CLB-INT-05 staleness is visible.** Every contractor-derived number carries its
      `cached_at`. A dashboard silently showing last week's contractor headcount during a shutdown is
      exactly the failure mode PP-9 taught us to design against.
- [ ] `P6-T06` **CLB-INT-06 integration health** in the Stage 8.5 integration hub: last successful
      sync, watermark, dead letters, manual replay.

**Tests required:** connector contract tests against recorded CLMS responses; a stale feed renders as
stale rather than as zero; an incident and a muster line can both reference a contract worker with no
row in our database; licence obligations reconcile with the CLMS list.

**Exit criteria:** contractor headcount visible per plant with an honest freshness stamp · a
contractor licence expiry raising an alert through the HRMS compliance calendar · one safety incident
recorded against a contract worker end-to-end.

## Stage 6.2 — Gate pass, access & visitors   `[ ☐ ]`
**Goal:** the gate becomes the enforcement point for every validity the system knows about.
**Depends on:** 6.1. **Closes:** GAP-D02, D03.
**Requirement IDs:** `FAC-01..06`

**Tasks**
- [ ] `P6-T08` **FAC-01 gate pass** for employees, contractor workers and third parties — issue, renew, suspend,
      block, lost-pass reissue; QR/barcode; validity derived from **all** upstream facts (employment status,
      induction validity, medical fitness, contractor licence, work order period).
- [ ] `P6-T09` **FAC-02 automatic blocking** — any upstream lapse blocks the pass at the gate the same day, with
      the reason readable by the gate operator in plain language.
- [ ] `P6-T10` **FAC-03 employee out-pass** — late-in / early-out gate authorisation tied to the existing
      attendance Permission request type (do not create a second approval concept), and material gate-pass
      reference for returnable/non-returnable items.
- [ ] `P6-T11` **FAC-04 visitor management** — pre-registration by a host, host approval, safety-briefing
      acknowledgement, badge issue, expected vs actual exit, overstay alert.
- [ ] `P6-T12` **FAC-05 gate event log** — append-only, partitioned, the source for mustering (6.6) and for
      contractor attendance reconciliation (6.3).
- [ ] `P6-T13` **FAC-06 gate operator console** — a deliberately minimal, high-contrast, offline-tolerant screen:
      scan → verdict in one glance → reason if refused.

**Data model:** `fac.gate_passes`, `fac.gate_events` (append-only, monthly partitions), `fac.visitors`,
`fac.visitor_briefings`.

**UI & navigation**
- `/plant/gate` — group **Plant**, icon `DoorOpen`, permission `fac.gate.manage`. Tabs: *Passes · Live gate ·
  Visitors · Blocked*.
- **The gate operator console is a separate, chrome-free route** (`/plant/gate/console`) designed for a 15" screen
  at arm's length in daylight: one large verdict area, green/amber/red, the person's photo, and the refusal reason
  in one short sentence. No nav, no side panels, keyboard/scanner-first, works with the network flapping.
- Employee-facing: the out-pass request is **inside `/my/attendance`** with the other attendance requests — not a
  new destination. Discovery beats novelty.

**Real-world use case.** *At 06:10 a contractor helper scans in. Their medical fitness expired yesterday. The
console shows red, "Medical fitness expired 12 Aug — contractor admin can renew", and the supervisor standing
there knows exactly what to do. No argument, no phone calls, no unfit worker on the shop floor.*

**Interrelations.** Reads 6.1 validity, 5.4 documents, Phase 1 employment status · writes gate events consumed by
6.3 muster and 6.6 mustering · out-pass reuses the Phase-1 Permission request and its approval chain.

**Tests required**
- Verdict matrix: every combination of expired employment / induction / medical / licence / work order produces
  the correct verdict and the correct human-readable reason.
- Gate events are append-only and survive a partition rollover.
- Console degrades correctly on network loss (last-known validity, clearly labelled as stale, with a hard cutoff).
- Visitor overstay alert fires; badge cannot be reused after exit.

**Exit criteria:** one plant running gate verdicts against real validity data for a full week · a real block and a
real release demonstrated · the console usable by a gate operator without training beyond one page.

---

## Stage 6.4 — Canteen   `[ ☐ ]`
**Goal:** meals become an accurate, reconciled, recoverable transaction instead of a paper register.
**Depends on:** 6.2 (identity at the point of service), G2 (payroll recovery). **Closes:** GAP-D04.
**Requirement IDs:** `FAC-07..10`

**Tasks**
- [ ] `P6-T23` **FAC-07 meal master** — slots aligned to shifts (breakfast/lunch/tea/dinner/night), menu classes,
      prices, and **separate rate cards for employees, contractor workers and visitors**.
- [ ] `P6-T24` **FAC-08 meal punch capture** — device/kiosk ingestion behind the same connector-interface pattern
      as Kent, append-only, partitioned; duplicate-punch and wrong-slot rules configurable in `core.settings`.
- [ ] `P6-T25` **FAC-09 entitlement & subsidy engine** — per grade/category: free meals, subsidised count,
      chargeable beyond; the subsidy is computed, explainable, and shown to the employee.
- [ ] `P6-T26` **FAC-10 recovery + vendor reconciliation** — employee recoveries become **payroll input rows**
      (never direct payroll writes); contractor meals become invoice-gate line items; the vendor's bill is
      reconciled against punches with a variance report.

**UI & navigation**
- `/plant/canteen` — group **Plant**, icon `UtensilsCrossed`, permission `fac.canteen.manage`. Tabs:
  *Consumption · Rates & entitlement · Vendor reconciliation · Devices*.
- ESS: canteen recovery appears as a **payslip line with a `calc_note`** and a drill-down to the meal list —
  the explainable-numbers rule (CLAUDE.md §7). No separate ESS canteen page; nobody wants one.

**Real-world use case.** *An employee questions a ₹640 canteen deduction. They tap the payslip line and see 32
meals with dates, slots and rates, 12 of them free by entitlement. The query never becomes a helpdesk ticket. The
vendor's bill for the same month differs by 214 meals; the variance report shows they are all visitor punches the
vendor billed at employee rates.*

**Interrelations.** Payroll input rows (G2) · gate identity (6.2) · contractor invoice gate (6.3).

**Tests required**
- Recovery reconciles to the rupee: Σ(chargeable punches × rate) ≡ payroll input row, per employee per period.
- Entitlement engine across grade boundaries, mid-month grade change, and mid-month category change.
- Duplicate/wrong-slot rules; punches are append-only.
- Vendor variance report correctly attributes every difference.

**Exit criteria:** one plant's canteen recoveries land in a live payroll run and reconcile to the rupee · vendor
reconciliation accepted by finance.

---

## Stage 6.5 — Transport & quarters   `[ ☐ ]`
**Goal:** the bus roster is shift-aware, the seat is allocated, the recovery is automatic, and the night-shift
women transport obligation is evidenced.
**Depends on:** 6.2, G2. **Closes:** GAP-D05, A08 (evidence half), and the quarters clearance gap in §16 15.15.
**Requirement IDs:** `FAC-11..14`

**Tasks**
- [ ] `P6-T27` **FAC-11 route & stop master**, vehicle & vendor, capacity, shift-aligned trip schedule.
- [ ] `P6-T28` **FAC-12 seat allocation** — request → approval → allocation, waitlist, stop change; roster-aware so
      a shift change proposes a trip change instead of silently stranding someone.
- [ ] `P6-T29` **FAC-13 boarding capture** + recovery/subsidy as payroll input rows; vendor trip reconciliation.
- [ ] `P6-T30` **FAC-14 night-shift women transport evidence** — for every night-shift roster row assigned to a
      woman, the system records the consent (from `CMP` Stage 5.1 / OSH obligations) **and** the transport
      arrangement; a roster save without both is refused, naming the rule.
- [ ] `P6-T31` Company accommodation/quarters: allotment, recovery, and **exit clearance line** joining the
      Phase-3 clearance matrix.

**UI & navigation**
- `/plant/transport` — group **Plant**, icon `Bus`. Tabs: *Routes & trips · Allocations · Boarding · Reconciliation*.
- ESS: "My transport" is a **card on the ESS home**, not a nav item — it shows today's trip and stop, and the
  request/change action. This is a daily glance, not a destination.
- The women-night-shift rule surfaces **in the roster editor** as a blocking condition with a one-click path to
  record consent and select the trip — the rule is enforced where the work happens (UX contract §10).

**Real-world use case.** *A supervisor rosters four women onto the C shift. Two have standing consent and a trip;
two do not. The save is refused with both names and a link that records consent and allocates seats on the 22:15
trip. The evidence exists before the shift, not after an inspector asks.*

**Interrelations.** Roster (Phase 1) · payroll input (G2) · OSH consent (5.1) · Phase-3 exit clearance (quarters).

**Tests required**
- Roster refusal for night-shift women without consent + transport, including bulk roster upload.
- Recovery reconciliation to the rupee; capacity never oversubscribed; waitlist promotion is deterministic.
- Shift change proposes a trip change and never leaves a stale allocation.

**Exit criteria:** one plant's transport recoveries in a live payroll run · the night-shift rule refusing a real
roster save · quarters recovery and exit clearance proven.

---

## Stage 6.6 — EHS: safety, permits & occupational health   `[ ☐ ]`
**Goal:** a hazard reported from a phone in 20 seconds, an investigation that closes, and the registers the law wants.
**Depends on:** 6.1, 6.2. **Closes:** GAP-D07, D08, A07, A29 (accident register), D06 (PPE).
**Requirement IDs:** `EHS-01..12`

**Tasks**
- [ ] `P6-T32` **EHS-01 incident / near-miss / unsafe-act reporting** — mobile-first, photo, location, severity,
      injured parties (employee **or** contractor worker **or** visitor), immediate actions. Anonymous near-miss
      reporting allowed (reporting culture beats attribution).
- [ ] `P6-T33` **EHS-02 investigation** — team, timeline, root cause (5-why / fishbone captured as structured
      data, not free text), contributing factors.
- [ ] `P6-T34` **EHS-03 CAPA** — corrective/preventive actions with owner, due date, verification, and **overdue
      escalation** to the plant head then the CHRO.
- [ ] `P6-T35` **EHS-04 accident register** (Form 23-style) and statutory reporting to the Inspectorate, generated
      through the Stage 5.6 register framework.
- [ ] `P6-T36` **EHS-05 safety metrics** — TRIR, LTIFR, DART, severity rate, near-miss ratio, per plant, per
      contractor, per shift; on the plant and executive dashboards.
- [ ] `P6-T37` **EHS-06 permit to work** — hot work, confined space, height, electrical, line-breaking: issue,
      approve, gas readings, isolation checks, extension, close-out; permits visible at the gate console.
- [ ] `P6-T38` **EHS-07 inductions & refreshers** for employees, contractor workers and visitors, with validity
      feeding the gate (6.2).
- [ ] `P6-T39` **EHS-08 PPE** — entitlement by role, issue/return/replacement, size, inspection, expiry, and
      non-return recovery through payroll (reuses the assets module's third-party holder support).
- [ ] `P6-T40` **EHS-09 annual health check-up** (OSH Code) — campaign, scheduling, completion tracking, and an
      **occupational health record** whose clinical content is visible only to `ehs.health.manage`, never to HR.
- [ ] `P6-T41` **EHS-10 emergency mustering** — a roll-call view built from live gate events and attendance:
      who is inside, who is accounted for, per assembly point.

**Data model:** `ehs.incidents`, `ehs.investigations`, `ehs.capa`, `ehs.permits`, `ehs.inductions`,
`ehs.health_checks` (restricted), `ehs.ppe_issues`, `ehs.incident_events` (append-only).

**UI & navigation**
- `/safety` — group **Plant**, icon `TriangleAlert`, permission `ehs.incident.investigate`. Tabs:
  *Incidents · CAPA · Permits · Inductions · Health · PPE · Metrics*.
- **Reporting a hazard is not a nav item.** It is a persistent action: a floating button on the mobile shell for
  anyone at a plant, and a card on the plant-head home. Target: report in ≤20 seconds, photo included, offline-safe
  (queues like a punch — Phase 8 machinery, stubbed here with a local retry).
- The mustering view is a **full-screen, projector-friendly** route with no chrome — it will be shown on a wall
  during a drill.
- Health records use the UX contract §7 restricted banner and are structurally separate from the HR profile.

**Real-world use case.** *A fitter photographs a frayed sling at 14:20 and taps submit; it is a near-miss, so he
files it anonymously. The safety officer investigates, root cause is a missed inspection cycle, CAPA is assigned to
maintenance with a 7-day due date. On day 8 it escalates to the plant head. The sling batch is replaced. Six months
later the LTIFR trend on the executive dashboard shows the effect, and the accident register for the year compiles
itself.*

**Interrelations.** Feeds the Stage 5.6 accident register · inductions gate 6.2 passes · PPE extends assets ·
health checks satisfy the OSH obligation from 5.1 · a serious incident can initiate an IR case in 6.7.

**Tests required**
- CAPA overdue escalation fires at the right time to the right person and cannot be closed without verification.
- Accident register completeness for a seeded year, cross-checked against incidents (golden-file).
- Permit close-out is mandatory; an open permit past its window alerts and blocks a new permit on the same asset.
- **Mustering equals reality:** roll-call = (gate events in) − (gate events out), reconciled with attendance,
  proven over a simulated drill dataset.
- Health record access negative tests: `hr_ops`/`hr_head` receive 403 on clinical content; audited.

**Exit criteria:** one incident through report → investigation → CAPA → verified closure · a real drill using the
mustering view · the accident register generated · PPE recovery in a live payroll run.

---

## Stage 6.7 — Industrial relations & discipline   `[ ☐ ]`
**Goal:** a litigation-ready disciplinary process, and the union/settlement facts that drive payroll.
**Depends on:** 5.4 (vault), 5.5 (case-handling patterns), G2. **Closes:** GAP-D11, D12, A06.
**Requirement IDs:** `IRD-01..10`

**Tasks**
- [ ] `P6-T42` **IRD-01 standing orders** — certified text, version, display locations, and the **misconduct
      catalogue** derived from them; every disciplinary case must cite a listed ground.
- [ ] `P6-T43` **IRD-02 misconduct log → show-cause notice → explanation → charge sheet**, each with templates,
      service/acknowledgement recording (this is what gets challenged), and statutory response windows.
- [ ] `P6-T44` **IRD-03 domestic enquiry** — enquiry officer, presenting officer, workman's representative,
      witnesses, hearing scheduling and minutes, findings report.
- [ ] `P6-T45` **IRD-04 suspension** with **subsistence allowance** at the statutory rate flowing to payroll as an
      input row, with the automatic rate change on the statutory day-count boundary.
- [ ] `P6-T46` **IRD-05 punishment order** — warning / fine / withholding increment / demotion / dismissal — with
      letter, appeal window, appellate decision; a fine flows to payroll within the statutory cap.
- [ ] `P6-T47` **IRD-06 case file export** — the complete, ordered, timestamped bundle for a tribunal.
- [ ] `P6-T48` **IRD-07 absence → discipline bridge** — an ATT-10 absence case escalates into a disciplinary case
      carrying its evidence, instead of restarting.
- [ ] `P6-T49` **IRD-08 union register** — recognised unions, office bearers, membership, charter of demands.
- [ ] `P6-T50` **IRD-09 settlements / LTS** — terms, effective dates, and their payroll effects modelled as
      dated rules rather than one-off manual entries.

**UI & navigation**
- `/discipline` — group **People**, icon `Gavel`, permission `ird.case.manage`. Tabs: *Cases · Notices · Enquiries ·
  Standing orders · Unions & settlements*.
- Manager entry point is **inside the team view**, not here: "initiate action" on a team member, which creates the
  case and hands it to HR. Managers must never own the process, only trigger it.
- Every case screen is an **immutable timeline** — each artefact (notice, acknowledgement, explanation, minutes,
  order) appended with actor and timestamp, exportable in one click. Nothing is editable after service.
- Restricted banner per UX contract §7; the accused employee sees their own case timeline and can respond in ESS.

**Real-world use case.** *A worker is charged with an unauthorised absence of 11 days. The absence case from
Phase 1 already holds the swipe evidence and two show-cause letters; the bridge carries them into the disciplinary
case. The enquiry runs with a workman's representative, minutes are recorded per hearing, the finding is
documented, and a punishment of withholding one increment is ordered with an appeal window. Eighteen months later
the tribunal asks for the file; it exports in one click, complete and in order.*

**Interrelations.** Absence engine (Phase 1) · payroll input rows for subsistence and fines (G2) · POSH findings
can initiate a case without exposing the POSH file (5.5) · settlements feed compensation rules (Phase 7).

**Tests required**
- Timeline immutability: no artefact can be edited or removed post-service; attempts are audited.
- Subsistence allowance rate changes at the statutory day boundary and reaches payroll correctly.
- Fine cap enforcement (statutory percentage of wages) — a hard block.
- Case export completeness: every artefact, in order, with service evidence.
- Standing-order citation is mandatory; a case citing an unlisted ground cannot proceed.

**Exit criteria:** one full disciplinary case run in the system with a complete export · a suspension's subsistence
allowance correct in a live payroll run · standing orders loaded for every entity that needs them.

---

## Stage 6.8 — Fatigue at roster, NAPS/NATS, ID card   `[ ☐ ]`
**Goal:** the three plant holes that were referenced but never tasked: consecutive-shift rules as a **hard block**, apprentice statutory returns, and a printable badge tied to the gate pass.
**Depends on:** 6.1, 6.2, Stage 1.11 (roster checks). **Closes:** GAP-D09, D13, doc 16 §2.12.
**Catalog:** [`coverage-closeout.md`](coverage-closeout.md). **Requirement IDs:** `FAT-01`, `NAP-01..04`, `FAC-15`

**Tasks**
- [ ] `P6-T60` **FAT-01 fatigue rules.** Settings (per plant, in `core.settings`): max consecutive night shifts, minimum rest hours between shifts, double-shift forbidden, max consecutive working days. Evaluated at **roster save and bulk upload**, same UX as OT-cap refusal (names the rule, the failing people, who can override). Phase 8.4 must call this; it must not re-implement it. Override permission is named and audited.
- [ ] `P6-T61` **NAP-01 apprentice / trainee register.** Distinct from `employment_category='trainee'` on the payroll deduction flag (PAY-14). NAPS/NATS: registration number, contract start/end, trade, stipend rule, establishment, portal reference.
- [ ] `P6-T62` **NAP-02 stipend as payroll input** — stipend computed from the contract, not from a salary structure; PF/ESIC/bonus exclusion already in PAY-14; this task is the *source* of the stipend row.
- [ ] `P6-T63` **NAP-03 completion certificate** in the document vault + coverage report (“who is past contract end without a certificate”).
- [ ] `P6-T64` **NAP-04 statutory returns** generated through the Stage 5.6 register framework (state-configurable), not a one-off Excel.
- [ ] `P6-T65` **FAC-15 ID / badge print.** Photo + name + e-code + company code + plant code + blood group from the master; QR that is the gate pass. Employee and contractor-worker variants. Lost-badge reissue is the existing lost-pass path.

**UI:** fatigue surfaces **in the roster editor** (1.11), not on a plant page. Apprentices: tab on `/people` filtered by category + `/compliance/registers`. Badge print from the employee/contractor profile and the gate console.

**Tests:** roster save with 7 consecutive nights refuses; override writes audit; an India payroll run cannot PF-deduct a NAPS apprentice (PAY-14 still holds); badge QR resolves to the live gate-pass verdict.

**Exit criteria:** fatigue refusing a real roster at one plant · one NAPS cohort on the register with a generated return · badges in use at one gate for a week.

---

## Gate G6 — Phase 6 sign-off
- [ ] Contractor headcount and licence-expiry alerts visible in HRMS, sourced from the CLMS, with an honest freshness stamp
- [ ] Gate console running at one plant for a full week against live employee/visitor validity
- [ ] Canteen and transport recoveries in a live payroll run, reconciled to the rupee
- [ ] Night-shift women transport/consent rule refusing a real roster save
- [ ] One incident closed through CAPA — including one recorded against a **contract worker held in the CLMS**, proving the `external_worker_ref` path
- [ ] One drill run on the mustering view, counting employees AND contract workers on site
- [ ] One disciplinary case exported as a litigation-ready bundle
- [ ] `npm run verify` green; G6 E2E journeys (mobile hazard report, gate refusal) in Playwright
