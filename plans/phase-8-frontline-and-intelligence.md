# Phase 8 — Frontline & Intelligence

**Target:** 7–9 weeks · **Gate:** **G8** · **Depends on:** G6 (there must be plant surfaces worth putting on a phone)
**Spec:** [`docs/15`](../docs/15-FEATURE-GAP-AUDIT.md) Register C · [`docs/16`](../docs/16-MICROFEATURE-INVENTORY.md) §5, §24, §25, §26, §28
**Architecture:** [`extended-roadmap.md`](extended-roadmap.md)

**Purpose.** Roughly half this workforce is blue-collar, in Odisha and West Bengal, Android-first and
WhatsApp-native. The specification gives them an English-only PWA with GPS check-in. That is an adoption risk, not
a feature gap — a system the frontline cannot use is a system HR keys in on their behalf, which is exactly the
greytHR failure mode docs/07 §4b describes. This phase also builds the platform surface (webhooks, report builder,
archival) and takes a **written position on AI** instead of leaving the question open.

**Sponsor pre-conditions:** **D11** (frontline channel strategy) and **D12** (AI position).

> **Working rule for this phase.** The frontline test is not "does it work" but "does it work on a ₹7,000 Android
> phone, on 2G, in daylight, in Odia, with gloves on, in 20 seconds". Every frontline story is accepted on a real
> device in a real location, not in a simulator.

---

## Stage 8.1 — Native mobile shell & offline capture   `[ ☐ ]`
**Goal:** the frontline gets an app that works when the network does not.
**Depends on:** G6. **Closes:** GAP-C08, C09, E03 (partly), and the EHS mobile dependency from 6.6.
**Requirement IDs:** `FRT-01..06`

**Tasks**
- [ ] `P8-T01` **FRT-01 Android-first app shell** wrapping the existing web surfaces where they are already good
      (payslip, leave, requests) and adding **native-only capabilities**: background sync, secure local storage,
      camera, push, biometric unlock. iOS follows; Android ships first, and that ordering is deliberate.
- [ ] `P8-T02` **FRT-02 offline punch queue** — encrypted local queue, background sync on reconnect, battery-aware
      GPS polling, device-ID binding (from SEC-06), **exactly-once ingestion** guaranteed by an idempotency key
      minted on the device.
- [ ] `P8-T03` **FRT-03 offline-tolerant requests** — leave, AR/OD, hazard report and helpdesk tickets compose
      offline and submit on reconnect, with an honest local status ("queued — will submit when you have signal")
      rather than a false success.
- [ ] `P8-T04` **FRT-04 role-derived floating action** on the mobile shell: *Punch* (frontline), *Report a hazard*
      (plant), *Raise a request* (everyone). **No new tab** — `TAB_ORDER` stays at four.
- [ ] `P8-T05` **FRT-05 low-bandwidth mode** — text-first rendering, deferred images, payslip as a compact view
      before the PDF, hard budget of one screen per round-trip on 2G.
- [ ] `P8-T06` **FRT-06 shared-device / kiosk mode** for plant entry points — one device, many users, no session
      bleed, auto-logout on idle, no cached personal data between users.

**UI & navigation**
- Mobile tabs unchanged: `Home · My Attendance · My Leave · My Pay`. Everything else is the More sheet or a home
  card. The floating action is the only addition, and it is contextual.
- The mobile home is **a stack of cards, not a dashboard**: today's shift and punch status, the one pending thing,
  the one expiring thing, the payslip when it is new. Nothing else competes.
- Every offline-capable surface shows a persistent, honest sync indicator. A queued item is visibly queued.

**Real-world use case.** *A helper at a remote yard punches in at 06:02 with no signal. The punch queues locally.
He punches out at 14:31, still offline. On his way home he passes the canteen Wi-Fi; both punches sync with their
device-minted keys; the day-status engine computes one day record. He sees a green tick. Under the PWA-only design
he would have had no attendance for the day and would have needed a regularisation.*

**Interrelations.** Feeds Phase-1 ingestion (a second connector alongside Kent, same watermark discipline) ·
device binding from SEC-06 · hazard reporting from 6.6 · gate console offline tolerance from 6.2.

**Tests required**
- **Offline queue property test (the characteristic test of this phase):** for N punches queued offline with an
  arbitrary reconnect order, arbitrary duplicates from retries, and an app kill mid-sync — the server ends with
  exactly N swipes, no duplicates, no loss, and exactly one day record per date.
- Kiosk mode: no data from user A is reachable by user B after logout — including caches, autofill and back-button.
- 2G performance budget enforced in CI (Lighthouse throttled profile) on the four mobile tabs.
- Device binding: a punch from an unbound device is refused and audited.

**Exit criteria:** offline punching proven by a real frontline group in a real low-signal area for a full week ·
zero duplicate or lost punches in that period · kiosk mode signed off by a plant.

---

## Stage 8.2 — Channels: push, WhatsApp, SMS   `[ ☐ ]`
**Goal:** reach people where they actually are, and prove the message arrived.
**Depends on:** 8.1, 5.3 (consent for the channel). **Closes:** GAP-C10, C11, and §24 gaps.
**Requirement IDs:** `FRT-07..10`, `FRT-15`

**Tasks**
- [ ] `P8-T07` **FRT-07 push notifications** — approvals, payslip published, expiry warnings, hazard-CAPA
      assignments; deep-linked so a tap lands on the action, not the home screen.
- [ ] `P8-T08` **FRT-08 WhatsApp Business API** behind a BSP-agnostic interface (same connector discipline as
      Kent/booking/e-sign): payslip-ready notice, approval nudge, announcement broadcast, policy acknowledgement
      reminder. Template management with localisation; **opt-in recorded in the consent registry (5.3)**.
- [ ] `P8-T09` **FRT-09 SMS fallback** for users with neither app nor WhatsApp, on a strict cost budget and a
      documented message set.
- [ ] `P8-T10` **FRT-10 channel routing + preferences** — per user and per event class, with quiet hours, a
      fallback ladder (push → WhatsApp → SMS → email), and **delivery-failure visibility to the sender** ("this
      approver's number is unreachable"), which is the missing half of the `notified_at` control.
- [ ] `P8-T10b` **FRT-15 in-app notification centre.** Bell in the masthead, unread count, mark-read, deep-link
      to the action. Push/WhatsApp are the reach; this is the inbox that still works on desktop. Delivery events
      from 8.2 feed it. Not a fourth mobile tab.

**UI & navigation**
- Admin: channel configuration lives under `/admin/integrations` (group **Admin**, icon `Plug`) — new in this phase,
  alongside webhook and connector management from 8.5.
- ESS: notification preferences sit in the **account menu**, next to privacy — both are "about me and my data".
- Engagement (`/engagement`) gains channel selection and per-channel reach analytics on announcements.

**Real-world use case.** *Payslips publish at 18:00 on the last working day. 1,180 employees get a WhatsApp notice
in Odia with a secure one-tap link; 260 with no WhatsApp get an SMS; 40 unreachable numbers are listed for HR to
correct. The month's "where is my payslip" helpdesk volume goes from ~300 tickets to under 20.*

**Interrelations.** Extends the existing `wf.event_subscriptions` model (recipients are data — do not fork it) ·
consent from 5.3 · templates localised by 8.3 · delivery events feed the `notified_at` receipt chain.

**Tests required**
- Fallback ladder exhausts in order and stops on first success; no duplicate delivery across channels.
- Quiet hours respected except for a defined critical class (safety, security).
- Consent withdrawal stops that channel immediately.
- Template rendering across all supported languages, including right-length truncation for SMS.
- Delivery failures surface to the sender and to the workflow timeline.

**Exit criteria:** a payslip notification cycle delivered across all three channels with a reconciliation report ·
opt-in/opt-out proven · helpdesk volume measured before and after.

---

## Stage 8.3 — Localisation   `[ ☐ ]`
**Goal:** retract the multi-language non-goal for the population that needs it most.
**Depends on:** 8.1. **Closes:** GAP-C12 (and the POSH/training language expectations from 5.5, 7.3).
**Requirement IDs:** `FRT-11..12`

**Tasks**
- [ ] `P8-T11` **FRT-11 i18n framework** — externalised strings, locale per user with a plant-level default,
      Devanagari/Odia/Bengali typography verified in the Warm Editorial type scale (this is a **design** task as
      much as an engineering one — the tokens must hold up).
- [ ] `P8-T12` **FRT-12 translated surfaces, in priority order:** ESS home · attendance · leave · payslip labels ·
      policies · POSH and safety content · notification templates. **Ops and admin surfaces stay English** — a
      deliberate scope line, recorded here so it is not relitigated per screen.
- [ ] Content localisation workflow: policies (4.7) and training material (7.3) carry a language per version, and
      coverage reports state which language a person acknowledged or was trained in.

**UI & navigation**
- Language switcher in the account menu and on the login screen (before authentication — a person who cannot read
  the login page cannot get to the switcher inside).
- Numbers, dates and currency stay in the existing India formats across all locales; only prose is translated.

**Real-world use case.** *A POSH policy is published in Odia and Hindi. The acknowledgement report shows 96%
coverage and, for the first time, which language each person acknowledged — which is exactly what the IC's annual
return needs to claim the policy was communicated effectively.*

**Tests required:** no untranslated string in a shipped locale on the priority surfaces (CI check against the
string catalogue); layout does not break at the longest translation; screen-reader language attributes correct;
contrast and type scale verified in each script in both themes.

**Exit criteria:** ESS fully usable in Odia and Hindi, verified by real frontline users, not by translators.

---

## Stage 8.4 — Attendance capture depth   `[ ☐ ]`
**Goal:** close the buddy-punching and geofence gaps mobile capture opens.
**Depends on:** 8.1. **Closes:** GAP-E03, E04, E01/E02 (rostering intelligence).
**Requirement IDs:** `FRT-13..14`, `ATT` extensions

**Tasks**
- [ ] `P8-T13` **Geofence definition object** — site polygons/radii per plant and per customer site, allow-list per
      employee/attendance mode, and **validation at punch time** (ATT-14 stores coordinates today; nothing checks
      them). Out-of-fence punches are captured but flagged, never silently dropped.
- [ ] `P8-T14` **Selfie + face match + liveness** behind a provider interface, with an explicit privacy posture:
      templates encrypted, retention-limited, consent-recorded (5.3), and a documented fallback for failures —
      **never a person locked out of their own attendance by a model**.
- [ ] `P8-T15` **Rostering intelligence** — rotating-pattern templates applied in bulk, shift-swap/bid between
      employees with manager approval, and coverage/shortfall view; all of it calling **FAT-01** (Stage 6.8) and
      the 5.1 OT ceilings already enforced at save. Do not re-implement fatigue here.
- [ ] `P8-T15b` **FRT-17 demand-based auto-roster.** From coverage rules (sanctioned per line/section/shift) generate
      a *suggested* roster the manager confirms. Never auto-publish. Respects fatigue, OT cap, leave, certification
      expiry, women-night-shift consent. Human-in-the-loop is the product, not a fallback.
- [ ] `P8-T16` **Attendance reconciliation report** for auditors — swipe count vs day records vs muster vs payroll
      paid days, one screen, any period (closes GAP-E07).

**UI & navigation**
- Geofence and face settings live in `/admin/masters` (attendance masters), which already exists.
- Punch experience on mobile: one large button, verdict in under two seconds, and a clear reason on failure with
  the fallback path visible immediately.
- Shift swap appears in `/my/attendance` as a request type and in the manager approvals inbox — no new destination.

**Real-world use case.** *A sales engineer punches from a customer site 40km from any plant. It is inside their
allow-listed customer geofence, so it passes. A colleague punching from home is captured, flagged out-of-fence, and
appears in the manager's exceptions list — visible, discussable, not silently deleted and not silently allowed.*

**Tests required:** geofence boundary and GPS-drift tolerance; out-of-fence is flagged not dropped; face-match
failure always has a working fallback; swap approval cannot violate fatigue or OT rules; reconciliation report ties
out exactly across all four sources for a seeded month.

**Exit criteria:** geofencing live for field staff · face capture live at one plant with a proven fallback ·
reconciliation report accepted by the compliance owner.

---

## Stage 8.5 — Platform: integrations, reporting & data lifecycle   `[ ☐ ]`
**Goal:** stop being a closed system, and stop shipping a dev ticket for every new question.
**Depends on:** 5.2 (API keys), 5.3 (retention). **Closes:** GAP-C06, C13–C16, C23–C25, E26, E27, plus §25 gaps.
**Requirement IDs:** `PLT-02..12`

**Tasks**
- [ ] `P8-T17` **PLT-02 outbound webhooks** — event catalogue, subscription, signing, retry with backoff, replay,
      and a dead-letter view; built on the SEC-09 service accounts.
- [ ] `P8-T18` **PLT-03 idempotency contract** on every write endpoint, documented in the OpenAPI output.
- [ ] `P8-T19` **PLT-04 integration hub** (`/admin/integrations`) — every connector (Kent, SAP, ATS, booking,
      e-sign, insurer, BSP, SMS) with health, watermark, last success, dead letters and a manual replay.
- [ ] `P8-T20` **PLT-05 ad-hoc report builder** — pick entity + fields + filters + grouping, **inside the caller's
      data scope** (a manager's builder can only ever see their subtree); saved views; shared views.
- [ ] `P8-T21` **PLT-06 scheduled report subscriptions** — "email me R6 every Monday 07:00", with delivery through
      the 8.2 channel router.
- [ ] `P8-T22` **PLT-07 data dictionary** — the published definition of every metric (what "headcount" means, as of
      when, including whom), linked from every dashboard tile so two screens can never disagree.
- [ ] `P8-T23` **PLT-08 remaining reports** — the 22 of R1–R31 still unbuilt, prioritised by usage telemetry rather
      than by list order.
- [ ] `P8-T24` **PLT-09 bulk operations framework** — upload/edit with dry-run, validation report, partial commit,
      rollback, and an audit row per changed row; retrofitted onto transfers, salary revisions, roster and leave
      adjustments (closes GAP-C16).
- [ ] `P8-T25` **PLT-10 archival & restore** — exited-employee data to cold storage per the 5.3 retention classes,
      with a proven restore path; `PLT-11` **product usage telemetry** per role and feature (proving or disproving
      the CORE-14 training thesis); `PLT-12` **WCAG 2.2 AA conformance audit** as a published gate artefact.
- [ ] `P8-T26` **Global search / command palette** across people, requests, tickets, assets and documents — scope
      enforced, with an audit row on any sensitive hit (closes GAP-C14).

**UI & navigation**
- `/admin/integrations` — group **Admin**, icon `Plug`.
- Report builder is a **tab on `/reports`** (`/reports/builder`), not a new nav item — it is a way of using
  reports, not a separate product.
- Command palette is `⌘K`/`Ctrl+K` from anywhere, with a visible affordance in the masthead for discoverability.

**Real-world use case.** *A plant head wants headcount by trade by shift for the last six months. Today that is a
ticket, a developer, and a fortnight. With the builder it is four clicks, saved as a view, and scheduled to arrive
every Monday at 07:00 — inside his plant scope, and never one row beyond it.*

**Tests required:** webhook signature verification, retry/backoff and replay idempotency; **report builder scope
enforcement is a security test, not a feature test** — a manager's builder cannot produce a row outside their
subtree by any combination of fields, filters or joins; bulk dry-run matches the committed result exactly; archival
restore returns byte-identical data; every dashboard tile resolves to a data-dictionary entry.

**Exit criteria:** one external consumer driven entirely by webhooks · report builder in production use by
managers · all R1–R31 live · WCAG audit published · telemetry informing the next phase's priorities.

---

## Stage 8.6 — AI: a written position, then the highest-value build   `[ ☐ ]`
**Goal:** answer the question the sponsor will be asked, and build the use case with actual ROI.
**Depends on:** 5.3 (consent & governance), 8.5 (data dictionary). **Closes:** GAP-C18–C22.
**Requirement IDs:** `AIX-01..14`

> **The order matters and is deliberate.** Governance first, anomaly detection second, assistant third. Every
> competitor leads with a chatbot; the highest-value AI in a money-and-compliance-critical system is the one that
> catches a wrong number before it is paid.

**Tasks**
- [ ] `P8-T27` **AIX-01 AI governance position** — what employee data may and may not be processed by a model,
      where inference runs, retention of prompts/outputs, human-in-the-loop rules, and an **employee-facing
      disclosure** published alongside the privacy notice (5.3). Signed by the sponsor before any model ships.
- [ ] `P8-T28` **AIX-02 hard rule, enforced in code:** no AI output writes to a money, statutory or disciplinary
      field without explicit human confirmation. Implemented as a middleware guard, not a convention.
- [ ] `P8-T29` **AIX-03 payroll & attendance anomaly detection** — outlier net pay vs the employee's own history
      and their cohort, impossible punch sequences, duplicate bank accounts across employees, ghost-worker
      indicators (no punches + active salary), sudden component changes. Surfaced as a **pre-finalize control**
      in the payroll review grid, ranked with an explanation of *why* each row is flagged.
- [ ] `P8-T30` **AIX-04 helpdesk triage + suggested answer** from the knowledge base (E28), with deflection
      measured against the 8.2 baseline.
- [ ] `P8-T31` **AIX-05 HR assistant** over policies and the user's **own** data only — leave balance, payslip
      explanation, policy questions with citations to the policy version. Scope-enforced identically to the API;
      the assistant is a client of the same permissions, never a bypass. **Local-language** (Hindi/Odia/Bengali)
      for ESS questions once 8.3 ships.
- [ ] `P8-T32` **AIX-06 attrition risk** feeding the executive dashboard, with model-card documentation, published
      features, and an explicit prohibition on using it in individual employment decisions.
- [ ] `P8-T33` **AIX-07 document extraction** — OCR for expense receipts (closes §13.15), certificates and IDs,
      always as a *draft* the human confirms.
- [ ] `P8-T34` **AIX-08 roster conflict assistant** — before publish, list people who would breach fatigue, OT cap,
      leave overlap, or lapsed certification. Suggestion only; save still goes through FAT-01.
- [ ] `P8-T35` **AIX-09 leave-clash warning** on apply: “N others on this team already off these dates; coverage
      would drop to X”. Uses the 1.11 planner; does not auto-reject.
- [ ] `P8-T36` **AIX-10 OT-cost forecast** on the plant dashboard from rostered hours × OT rate — a projection
      tile that drills to the roster, not a payroll write.
- [ ] `P8-T37` **AIX-11 MIS copilot** — “show me Hot Mill overtime cost for RML plant 1701 this quarter” answered
      from the data dictionary + ORG-05 filters, with the SQL/report link. Scope-enforced. Never a new number
      that a dashboard tile does not already define.
- [ ] `P8-T38` **AIX-12 duplicate-identity / ghost-worker pack** as a scheduled control (bank IFSC+account,
      Aadhaar last-4 collision, active salary + zero swipes for N days). Output is a queue, not an auto-exit.
- [ ] `P8-T39` **AIX-13 approve-from-push / WhatsApp** — the E24 deep link: signed, single-use, short-TTL token.
      Pairs with 8.2. Refuse if the step is already acted.
- [ ] `P8-T40` **AIX-14** resume-screening *draft* scores if Phase 7.6 is the recruitment system of record;
      otherwise leave in the ATS. Always a draft the panel confirms.

**UI & navigation**
- Anomalies appear **inside the payroll review grid** as a ranked exceptions panel — where the work already
  happens. Not a separate "AI" destination.
- The assistant is a **panel invoked from the masthead**, available on every page, carrying the current page as
  context. Every answer cites its source (policy version, payslip line, ledger row) and offers the underlying
  screen — the explainable-numbers rule extended to prose.
- No AI feature is presented without its confidence and its fallback. Nothing in this product says "trust me".

**Real-world use case.** *In the September run, one employee's net is ₹1.4L against a six-month average of ₹38k.
The anomaly panel ranks it first and explains: a leave-encashment input was entered in days instead of hours. It is
caught before finalize, before a bank file, before a recovery conversation. That single catch pays for the stage.*

**Tests required**
- **Every AI surface has a deterministic fallback path tested with the model disabled** — the product works
  without AI, always.
- Anomaly detection on a seeded corpus with known injected errors: recall on the injected set and a bounded false-
  positive rate agreed with the payroll admin before build.
- Assistant scope: no prompt, jailbreak or phrasing yields data outside the caller's permissions — a security
  suite, run like the POSH refusal suite.
- Write-guard negative tests: no path lets a model output reach a money/statutory/disciplinary field unconfirmed.

**Exit criteria:** governance note published to employees · anomaly detection catching real injected errors in a
parallel run · assistant live with proven scope enforcement · deflection measured · MIS copilot answering one
real plant-head question from the data dictionary.

---

## Stage 8.7 — Per-entity branding, feature flags   `[ ☐ ]`
**Goal:** 14 legal entities can look like themselves on letters and payslips, and a module can roll out to RML
before RDL without a deploy.
**Depends on:** 5.4 (letters), 2.4 (payslip template). **Closes:** doc 16 §27.7, §27.12.
**Requirement IDs:** `PLT-13..15`

**Tasks**
- [ ] `P8-T41` **PLT-13 per-entity branding.** Letterhead, payslip chrome, portal wordmark, and sender display
      name from `core.companies` — not a hardcoded RML template. Foreign entities included.
- [ ] `P8-T42` **PLT-14 feature flags** per entity / plant: a module or ESS card can be `off | pilot | on`.
      Flag changes audited. Default off for anything Phase 6–8 until that plant’s UAT.
- [ ] `P8-T43` **PLT-15 setting scope** global / entity / plant / grade (doc 16 §27.2) — the missing half of
      `core.settings`. A plant can have a different OT cap without forking code.

**Tests:** a payslip for RGH cannot render RML letterhead; a flag-off entity cannot call the flagged procedure
(403, not empty data); plant-scoped setting wins over global for that plant only.

**Exit criteria:** two entities with distinct payslip chrome in one run · one module piloted on a single plant.

---

## Gate G8 — Phase 8 sign-off
- [ ] Offline punching proven on real devices in a real low-signal location for a full week, zero loss/duplicates
- [ ] Payslip notification delivered across push/WhatsApp/SMS with a reconciliation report and measured helpdesk drop
- [ ] In-app notification centre live; approve-from-push proven
- [ ] ESS usable in Odia and Hindi, verified by real frontline users
- [ ] Report builder in production use with scope enforcement proven as a security test
- [ ] All R1–R31 live; every dashboard tile resolves to a data-dictionary entry
- [ ] WCAG 2.2 AA conformance audit published
- [ ] AI governance note published; anomaly detection catching real errors; assistant scope-proven; MIS copilot live
- [ ] Auto-roster suggestion confirmed (not auto-published) at one plant
- [ ] Two entities with distinct payslip chrome; one feature flag piloted
- [ ] `npm run verify` green; G8 E2E journey (offline punch × 4 → reconnect → one day record) in Playwright
