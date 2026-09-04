# Phase 5 — Compliance & Trust

**Target:** 7–9 weeks · **Gates:** **G5a** (blocks Phase 2) then **G5b**
**Spec:** [`docs/15`](../docs/15-FEATURE-GAP-AUDIT.md) Register A + C · [`docs/16`](../docs/16-MICROFEATURE-INVENTORY.md) §1, §3, §10, §11, §23.5
**Architecture:** [`extended-roadmap.md`](extended-roadmap.md) — read §1–§6 first.

**Purpose.** The platform is being built to hold biometrics, bank accounts, Aadhaar, PAN, health and salary for
2,000+ people, under a legal regime that changed on 21 Nov 2025 (Labour Codes) and 13 Nov 2025 (DPDP Rules), and
it currently has no privacy layer, no MFA, no POSH process and no statutory register. **This phase makes the
system defensible.** Four of its stages must land before payroll starts.

> **Working rule for this phase.** Every stage produces an *artefact a regulator or an auditor would ask for* —
> a generated register, a signed acknowledgement, a consent record, an access log, a filed return. A stage that
> produces only a screen is not done.

---

## Stage 5.1 — Labour-Codes conformance   `[ ◐ CMP-01 checker + OT caps from 1.11 · rest open ]`  🔒 blocks Phase 2
**Goal:** the four Codes stop being a TODO in doc 10 and become enforced rules, settings and tests.
**Depends on:** Gate G1. **Closes:** GAP-A01, A02, A03, A04, A05, A06, A09.
**Requirement IDs:** `CMP-01..07`

**Tasks**
- [x] `P5-T01` **CMP-01 wage-definition engine.** A `wage_definition` rule object in `core.settings`
      (`wages.basic_da_min_pct` default 50, `wages.excluded_components[]`). Pure
      `assertWageDefinition(structure)` + `GET/POST /compliance/wage-rule|wage-check`.
      Persist-on-every-save is a Phase 2.1 hook (no salary structures yet). Six goldens incl. two failing (incl. RML033903 live 49.999%).
- [ ] `P5-T02` **CMP-02 conformance report.** "Which employees' current structures fail the ≥50% rule" with
      remediation modelling: show the restated structure and the delta to PF/gratuity/bonus bases **before**
      anyone commits. Restatement is a *proposal*, approved by `hr_head` + `payroll_admin`, never silent.
- [ ] `P5-T03` **CMP-03 F&F clock.** `fnf.tat_working_days` reduced per the Code; an SLA clock starting at
      approved-LWD, breach alert to `hr_head` + `payroll_admin`, and the clock rendered on the separation timeline.
- [ ] `P5-T04` **CMP-04 fixed-term employment.** `employment_category` gains `fixed_term`; gratuity engine gains
      the 1-year pro-rata branch; benefit parity flag; contract end date + T-60/30 expiry alerts.
- [ ] `P5-T05` **CMP-05 appointment-letter mandate.** Letter type flagged `statutorily_mandatory`; a coverage
      report ("who has no appointment letter on file"); issuance blocked from being skipped at onboarding.
- [ ] `P5-T06` **CMP-06 statutory OT ceilings.** Daily / weekly / quarterly OT caps and spread-over as settings;
      enforced at **roster save** and at **OT approval**, not discovered at payroll. Over-cap is a hard block with
      a named override permission and an exception register.
- [ ] `P5-T07` **CMP-07 standing orders + single registration** placeholders: standing-orders document object
      (certified text, version, display locations) referenced later by `ird`; single-registration fields on the
      entity master (feeds Stage 5.7).

**Data model:** `cmp.wage_rules`, `cmp.conformance_runs`, `cmp.ot_ceilings`, `cmp.standing_orders`;
`core.employees.employment_category` extended; `core.entities` gains registration columns.

**API:** `cmp.wageCheck`, `cmp.conformanceReport`, `cmp.proposeRestatement`, `cmp.approveRestatement`,
`cmp.otCeilingCheck` — permission `cmp.register.generate` / `admin.settings`.

**UI & navigation**
- New route `/compliance/labour-codes` — a **tab inside the `/compliance` hub** (not its own nav item).
- Layout: a conformance scorecard per entity (compliant / at-risk / failing counts) → drill to the employee list →
  drill to one employee's current vs restated structure, side by side, with the PF/gratuity/bonus delta called out
  in a `DarkCard`. Restatement carries an explicit two-person approval strip.
- **OT ceilings surface where the work happens, not here:** the roster editor (`/attendance` → roster) shows a
  live "hours committed this quarter" meter per employee and refuses a save that breaches the cap, naming the rule
  (UX contract §10). The OT decision screen shows the same meter to the approving manager.

**Real-world use case.** *Subhasis (payroll admin) opens the conformance tab in March. 214 blue-collar structures
fail the 50% rule because a fixed conveyance allowance was inflated in 2023. He models the restatement, sees PF
liability rise ₹4.1L/month, exports the impact, takes it to the CHRO, and only then does hr_head co-approve. No
structure was edited silently, and the golden tests prove the arithmetic.*

**Interrelations.** Feeds Phase 2 payroll (structures, gratuity, F&F) · consumes `core.settings` · writes to the
existing audit chain · the OT ceiling reads the Phase-1 roster and OT engine · fixed-term feeds Phase-3 lifecycle.

**Tests required**
- Golden fixtures (hand-computed) for the wage check across 6 real RML structure shapes, incl. two failing.
- Property test: no path can persist a structure violating the active rule — including bulk import and restatement.
- Gratuity golden tests extended with fixed-term 1-year pro-rata cases.
- F&F clock: breach fires at the boundary, respects working-day calendar and holidays.
- OT ceiling: roster save and OT approval both refuse; override requires the permission and writes an audit row.

**Exit criteria:** conformance report runs across all 14 entities · a restatement completes end-to-end with
two-person approval and an audit trail · OT cap refuses a real over-cap roster · **payroll cannot start without
this stage merged** (CI check on the Phase-2 branch).

---

## Stage 5.2 — Identity & access hardening   `[ ◐ 5.2a done · 5.2b open ]`  🔒 blocks Phase 2

> **Split into 5.2a (the security spine — SHIPPED) and 5.2b (federation & network controls — open).**
> The split is deliberate: 5.2a has no external dependencies and is what Gate G5a actually needs; 5.2b
> (SSO, SCIM, IP rules) needs a corporate IdP and a network policy that do not exist in the environment yet.
**Goal:** privileged access is provably controlled before money and statutory IDs exist in the system.
**Depends on:** Gate G1. **Closes:** GAP-C01, C02, C03, C04, C05, C07, C06 (partly), A17.
**Requirement IDs:** `SEC-01..14`

**Tasks**
- [x] `P5-T08` **SEC-01 password policy object** — length, complexity, reuse history, rotation, lockout, breached-
      password check; all values in `core.settings`; enforced at set/reset.
- [x] `P5-T09` **SEC-02/03 MFA (TOTP)** enrolment + enforcement, mandatory for `payroll_admin`, `hr_head`,
      `super_admin`, `it_admin`, `dpo`, `compliance_officer`. Recovery codes; enrolment status report.
- [x] `P5-T10` **SEC-04 step-up re-authentication** before: unmasked statutory-ID read, salary read/write, payroll
      finalize/reopen, role grant, purge execution, POSH case open. A reusable `requireStepUp()` middleware.
- [x] `P5-T11` **SEC-05/06 session & device management** — active session list, remote revoke effective next
      request, idle timeout, concurrent-session policy, device binding for mobile punch.
- [ ] `P5-T12` **SEC-07 IP / network restriction** per role (payroll + admin from corporate network by default).
- [ ] `P5-T13` **SEC-08 SSO (SAML 2.0 / OIDC)** against the corporate IdP, with local login retained as a
      break-glass path for the frontline population that has no directory account.
- [ ] `P5-T13b` **SEC-15 SCIM 2.0** inbound: create/update/disable on join, role change and DOL. De-provision
      takes effect on the next request (same as session revoke). SSO without SCIM is not an exit criterion.
- [ ] `P5-T14` **SEC-09 service accounts + API keys**, scoped to a permission subset, rotatable, with a
      last-used timestamp; the foundation Phase 8 builds webhooks on.
- [x] `P5-T15` **SEC-10 purpose-stamped access logging** — sensitive reads capture a purpose code; `SEC-11`
      **employee-visible access history** (`/my/privacy` → "who viewed my record").
- [ ] `P5-T16` **SEC-12 break-glass** flow: `super_admin` elevation requires a typed reason, is time-boxed, and
      raises an immediate alert; `SEC-13` **quarterly access recertification** campaign with a sign-off artefact.

**Data model:** `sec.mfa_enrolments`, `sec.sessions`, `sec.api_keys`, `sec.ip_rules`, `sec.access_events`
(append-only, partitioned), `sec.access_reviews`, `sec.breakglass_events`.

**UI & navigation**
- New route `/admin/security` — group **Admin**, icon `KeyRound`, permission `sec.mfa.manage`. Tabs:
  *Sessions · MFA · API keys · Network rules · Access reviews · Break-glass log*.
- ESS: `/my/privacy` (Stage 5.3) hosts the personal half — active sessions, sign out everywhere, access history.
- **Step-up is a modal, not a page** — it must not lose the user's context (kill-list rule: state preservation).
  It renders the reason for the challenge ("viewing unmasked PAN for 3 employees") so the friction is legible.
- MFA enrolment appears as a **home card** for any privileged user who has not enrolled, escalating to a blocking
  interstitial after a configurable grace period.

**Real-world use case.** *Sharique (IT) is asked to help debug a payroll query. He can open the payroll console
route, but every salary column renders masked and the step-up modal tells him he lacks
`employee.compensation.read` — the separation of duties in docs/08 is now enforced at the field, not by
convention. When a genuine emergency needs it, break-glass elevation is possible, typed, time-boxed, and alerts
the CHRO within seconds.*

**Interrelations.** Every module gains step-up on its sensitive procedures · access events feed Stage 5.3's
employee-visible log · API keys are the prerequisite for Phase 8 integrations · session revoke is the exit-day
control Phase 3 separation calls.

**Tests required**
- Negative suite: every sensitive procedure returns 403 without step-up, and the challenge is audited.
- Session revoke takes effect on the very next request (no cached principal).
- MFA cannot be disabled by the enrolled user alone; recovery-code use is single-shot and audited.
- API key scope cannot exceed its grant; expired/rotated keys fail closed.
- Access-log completeness property: every read of a masked column emits exactly one `sec.access_events` row.

**Exit criteria (5.2a — met):** a revoked session stops working on the very next request · step-up demonstrably
required before a dangerous action and refused without it · a TOTP code is spent exactly once · an employee can
see who viewed their record · sensitive-read events are append-only at the database.
**Exit criteria (5.2b — open):** MFA *enforced* (not merely offered) for all six privileged roles with a 100%
enrolment report · SSO working for at least one entity with local login retained for the frontline.

### 5.2a — delivered (this stage)

**Backend**
- `sec` schema: `sessions`, `mfa_enrolments`, `mfa_recovery_codes`, `password_history`,
  `access_events` (append-only trigger + monthly partitions).
- `core/auth/totp.ts` — RFC 6238, tested against **the RFC's own Appendix B vectors**; `matchTotpStep`
  returns the matched step so a code can be **spent once** (replay guard).
- `core/auth/password-policy.ts` — pure checker returning **every** violation, not the first.
- `core/auth/session.ts` + `core/auth/security-policy.ts` — session primitives and policy reads.
- `core/settings/read.ts` — the typed settings READ, moved out of `modules/settings`.
- `modules/security/` — `mfa.service`, `access-log.service`, `security.service` (password change),
  `security.router` (16 procedures), `index.ts`.
- `authed` now validates the session row on every request; `withStepUp(permission)` and
  `authedWithStepUp` added to `api/orpc.ts`.
- Login mints a session; logout **revokes** it; refresh refuses a revoked session; `/auth/me` reports
  MFA status and the step-up window.
- New permission codes `sec.session.revoke`, `sec.mfa.manage` (it_admin + super_admin only).
- 14 new `core.settings` keys, seeded, with the seed test extended to resolve named-constant fallbacks.

**Frontend**
- `app/StepUpDialog.tsx` — modal (never a page), states WHY it is asking, and **retries the interrupted
  action itself** so nothing the user was doing is lost.
- `pages/my/PrivacyPage.tsx` (`/my/privacy`) — sessions with device labels + end/sign-out-everywhere,
  TOTP enrolment with reveal-once recovery codes, **"who has looked at your record"**, password change
  with the rules stated up front. Ordered by anxiety, not tidiness.
- `pages/admin/SecurityPage.tsx` (`/admin/security`) — two-step coverage with step-up-gated reset,
  access log, session lookup/revoke.
- `StepUpRequiredError` in `lib/api.ts` so pages catch a type, not a status code.
- Nav: `/admin/security` under **Admin** (`sec.*` holders only), `/my/privacy` for everyone — both in the
  More menu; **the pill strip and the 4 mobile tabs are untouched**, asserted by test.

**Architectural decision taken during the stage.** Session primitives and policy reads were moved from
`modules/security` into `core/auth` + `core/settings`. `api/orpc.ts` validates a session on *every*
request, so reaching those through a module's public API routed the API layer back through that module's
router — a cycle dependency-cruiser correctly rejected. Reading settings is foundation; *writing* them
(audited, permissioned) stays a feature in `modules/settings`.

**Tests:** 23 unit (TOTP vectors, password policy) + 13 integration (`security-identity.integration.test.ts`)
+ 7 component (StepUpDialog, incl. axe) + 5 nav placement + 2 api = **50 new tests**, all green.

### 5.2b — deferred, with reasons

| Task | Why it is not in 5.2a |
|---|---|
| `P5-T12` **SEC-07 IP / network restriction** | Needs the corporate network ranges and a stated policy; guessing them would lock people out |
| `P5-T13` **SEC-08 SSO (SAML/OIDC)** | Needs a real IdP to integrate and test against; a mock SSO proves nothing |
| `P5-T13b` **SEC-15 SCIM 2.0** | Same IdP dependency as SSO. **Do not ship SSO without SCIM** — join/exit must provision and de-provision the HRMS account (and later downstream apps) or exit-day access stays a ticket to IT. Task is: inbound SCIM for users/roles; de-provision on DOL; last-login freeze. |
| `P5-T14` **SEC-09 service accounts / API keys** | Has no consumer until Phase 8 webhooks; building it now would ship untested surface area |
| `P5-T16` **SEC-12/13 break-glass + access recertification** | Depends on the role review cadence the sponsor has not yet set |
| **Enforcement flip** `sec.mfa_enforcement` → `required` | Deliberately shipped as `grace`: flipping it before anyone has enrolled locks out every privileged user. The coverage report drives the flip |

---

## Stage 5.3 — DPDP baseline   `[ ◐ code 3 Sep 2026 — notice/consent/rights/purge log; biometric encryption + G5a UAT open ]`  🔒 blocks Phase 2
**Goal:** lawful processing, provable consent where required, enforceable retention, and working data-principal rights.
**Depends on:** 5.2. **Closes:** GAP-A10..A18, C25.
**Requirement IDs:** `PRV-01..12`

**Tasks**
- [x] `P5-T17` **PRV-01 privacy notice** — versioned employee notice, first-login interstitial, ack recorded.
- [x] `P5-T18` **PRV-02 processing register** — seeded data classes; ESS + DPO read.
- [x] `P5-T19` **PRV-03 consent registry** — five purposes; grant/withdraw appends `prv.consent_events`.
- [x] `P5-T20` **PRV-04 rights-request workflow** — access/correction/erasure; SLA from `prv.rights_sla_days`; DPO fulfill/refuse.
- [x] `P5-T21` **PRV-05 data-export pack** — masked PAN/Aadhaar/bank (never raw in the pack).
- [x] `P5-T22` **PRV-06 retention schedule + purge** — propose + two-person confirm + append-only log. v1 is log-only (does not delete attendance).
- [x] `P5-T23` **PRV-07 breach register** — append-only rows.
- [x] `P5-T24` **PRV-08 processor register + DPA tracking** — Hosting/SMTP/Kent rows (SMTP+Kent `dpa_status=missing`).
- [ ] `P5-T25` **PRV-09 biometric protection** — template encryption at rest (Kent connector; blocked on P0-T01).
- [x] `P5-T26` **PRV-10 DPO publication** — role mailbox `dpo@rashmigroup.com` + SLA in account menu.

**Data model:** `prv.notices`, `prv.notice_acks`, `prv.processing_register`, `prv.consents` +
`prv.consent_events` (append-only), `prv.rights_requests`, `prv.retention_rules`, `prv.legal_holds`,
`prv.purge_log` (append-only), `prv.processors`, `prv.breach_register` (append-only).

**UI & navigation**
- Ops: `/privacy` — group **Compliance**, icon `Lock`, permission `prv.rights.handle`. Tabs:
  *Requests · Consents · Retention & purge · Processors · Breach register · Notices*.
- ESS: `/my/privacy` — More menu **and** a permanent entry in the account menu (this is the one place a privacy
  link must never be buried). Sections: what we hold and why · my consents (with withdraw) · who accessed my
  record · request my data / correct it / delete it · who to contact.
- The **privacy notice is a first-login interstitial**, not a footer link. It is dismissible only by acknowledgement.
- Purge screens follow UX contract §8 (evidence over assertion): the proposal shows the exact row counts per class
  and the legal holds that excluded rows, and the confirmation screen requires the second person's step-up.

**Frontend delivered (Stage 5.3 UI)**
- [x] `/my/privacy` DPDP sections (register, consents, rights form, DPO) + account-menu Privacy & DPO contact
- [x] `/privacy` ops page (More · Compliance) gated on `prv.rights.handle` | `prv.notice.manage`
- [x] Privacy-notice gate in `App.tsx` (skips silently on 404)
- [x] Nav tests: `/privacy` not in pills; in More for DPO perms

**Real-world use case.** *An exited employee emails asking for everything the company holds on them. HR forwards
it into the rights queue. The DPO verifies identity, the clock starts, the system assembles the export pack from
every schema, the DPO reviews and releases it, and the register shows the request closed in 11 days with the
artefact attached. Two years later, the retention job proposes purging that person's attendance detail; payroll
records are excluded by a statutory-retention rule; the DPO proposes, the super_admin confirms, and the purge log
records what class was removed without ever recording the content.*

**Interrelations.** Consumes `sec.access_events` (5.2) for the access-history view · retention rules govern the
archival path in Phase 8 · the processor register is the gate Phase 8's integrations must pass · candidate data in
Phase 7 recruitment inherits the same notice/consent/retention machinery rather than inventing its own.

**Tests required**
- **Retention property test:** for any generated dataset and any retention rule, nothing survives past its period
  unless a legal hold covers it, and nothing under hold is ever removed.
- Two-person purge negative test: single-actor purge is impossible by any route including direct API.
- Rights-request SLA clock; refusal path requires a reason; export pack completeness across all schemas.
- Consent withdrawal takes effect on the next read of the dependent surface (e.g. photo disappears from directory).
- Notice versioning forces re-acknowledgement.

**Exit criteria:** an end-to-end erasure request completes with two-person purge and a verifying audit chain ·
every data class in the processing register has a retention rule · every active processor has a DPA row · the
privacy notice is acknowledged by 100% of active users.

---

## Stage 5.4 — Document vault, e-signature & sandbox   `[ ◐ skeleton DOC-01/02/03 ]`  🔒 blocks Phase 2
**Goal:** documents become a managed, expiring, signable asset — and there is finally a safe place to rehearse.
**Depends on:** 5.2. **Closes:** GAP-B09, B10, A03 (evidence half), A23, C17, C25 (archival half).
**Requirement IDs:** `DOC-01..09`, `PLT-01`

**Tasks**
- [x] `P5-T27` **DOC-01 document type catalog** — per employment category: which documents are mandatory, whether
      they expire, retention class (links to `prv.retention_rules`), who may view.
      *(skeleton shipped: `doc.types` seeded pan/aadhaar/appointment/medical_fitness)*
- [x] `P5-T28` **DOC-02 employee document vault** — upload (ESS + HR), versioning, virus scan, storage via the S3
      adapter, permission-scoped viewing, download watermarking for sensitive classes.
      *(skeleton shipped: list/upload via `core.documents` + storage adapter; versioning/scan/watermark later)*
- [x] `P5-T29` **DOC-03 expiry engine** — `valid → expiring (T-30/15/7) → expired → blocked`, one colour language
      reused by licences (5.7), inductions and medical fitness (Phase 6) and certifications (Phase 7).
      *(reuses CMP-16 `expiryState` via `modules/compliance` public API; blocked state deferred)*
- [ ] `P5-T30` **DOC-04 mandatory-document coverage report** + `DOC-05` **bulk document request** ("collect PAN
      from these 40 people") with reminders.
- [ ] `P5-T31` **DOC-06 e-signature** — Aadhaar eSign / DSC behind a provider interface (swappable, like the Kent
      and booking connectors), envelope model, signer status, tamper-evident completion certificate.
      *(provider interface stub only — `ESignProvider` in `modules/documents/esign.ts`)*
- [ ] `P5-T32` **DOC-07 statutory joining forms** — EPF Form 2 & Form 11, ESIC Form 1, **Gratuity Form F**,
      Form 12BB — generated, e-signed, filed to the vault, with a coverage report per form per entity.
- [ ] `P5-T33` **PLT-01 sandbox tenant** — a restorable environment seeded from production with irreversible
      masking of names, statutory IDs, bank details and contact data; plus **config promotion** (settings,
      workflow definitions, letter templates) dev→prod with a diff and an approval.

**Data model:** `doc.types`, `doc.employee_documents`, `doc.expiry_events`, `doc.esign_envelopes`,
`doc.esign_events` (append-only). Sandbox is infrastructure + a masking script, not a schema.

**UI & navigation**
- Ops: `/documents` — group **People**, icon `FolderLock`, permission `doc.vault.manage`. Tabs:
  *Coverage · Expiring · Requests · E-sign envelopes · Types*.
- ESS: `/my/documents` — More menu **plus a home card** whenever a document is missing or expiring within 30 days
  (this is the discovery mechanism; nobody browses a vault).
- The employee profile page (`/people/:ecode`) gains a **Documents** tab so HR never leaves the person to find
  their papers — the ≤2-click rule.
- E-sign is presented as a **status strip on the letter/offer itself**, never a separate inbox to check.

**Real-world use case.** *A new blue-collar joiner at the Kharagpur plant completes Form 2, Form 11 and Form F on a
kiosk with Aadhaar OTP before their first shift. HR's coverage report goes from 41 missing forms to 0 in a week.
Eight months later the expiry engine flags 63 medical fitness certificates lapsing in 30 days, and the same colour
language the gate pass will use in Phase 6 is already familiar to everyone.*

**Interrelations.** The expiry engine is reused by Phase 6 (licences, gate passes, inductions, medical fitness) and
Phase 7 (certifications) — build it once, generically · retention classes come from 5.3 · e-sign is consumed by
Phase 7 offer letters and Phase 2 Form 16 · **the sandbox is what Phase 2's parallel run rehearses in**.

**Tests required**
- Expiry state machine transitions at exact boundaries incl. timezone/holiday edges.
- Permission tests: a document class visible to HR is invisible to the manager, and both are audited.
- E-sign provider contract tests against recorded provider responses; a tampered document fails verification.
- Masking test: **no unmasked statutory ID, bank account or personal contact survives the sandbox script** — run
  as a property test over the whole schema, not a spot check.
- Config promotion produces an accurate diff and cannot apply without approval.

**Exit criteria:** mandatory-document coverage report is green for a pilot entity · one letter fully e-signed with
a verifiable certificate · sandbox restored from a production snapshot with the masking property test passing ·
**Phase 2 rehearsal happens in the sandbox, not in production**.

---

### 🔒 Gate G5a — the payroll pre-condition
- [ ] Wage-definition check live and enforced on every structure write (5.1)
- [ ] F&F TAT confirmed against the Code and set (5.1)
- [ ] MFA enforced + step-up on salary/statutory reads (5.2)
- [ ] Privacy notice, processing register, retention rules and consent registry live (5.3)
- [ ] Masked sandbox usable for a payroll rehearsal; config promotion working (5.4)
- [ ] Sponsor sign-off: **Phase 2 may begin**

---

## Stage 5.5 — POSH, grievance & whistleblower   `[ ◐ skeleton shipped 3 Sep 2026 — IC empty until D8 ]`
**Goal:** a confidential, time-bound, evidence-producing case process that HR itself cannot read into.
**Depends on:** 5.2 (step-up), 5.4 (document vault). **Closes:** GAP-A19, A20, A21, E29.
**Requirement IDs:** `PSH-01..10`, `GRV-01..06`

> **Skeleton (this pass):** schema `ird` + empty IC (no invented members) + file/list APIs +
> FORBIDDEN open for non-handlers + Compliance tab with mandatory IC banner.
> Full access model (IC-only reads, existence-leak suite, 90-day clock) remains below.

> **This stage's primary deliverable is a negative capability:** proving that people who should not see a case,
> cannot — including `hr_head` and `super_admin`. Build the access model first and the screens second.
> *(v1 skeleton temporarily grants `ird.posh.handle` to hr_head for intake wiring; IC-scoped refusal is the full build.)*

**Tasks**
- [~] `P5-T34` **PSH-01 IC constitution** — **skeleton:** `ird.ic_members` table, list API, empty banner. Full composition rules deferred (sponsor appoints; seed zero).
- [~] `P5-T35` **PSH-02 confidential intake** — **skeleton:** authenticated + anonymous file paths.
- [ ] `P5-T36` **PSH-03 case file** — parties, allegation, evidence (vault-backed, sealed), interim relief actions,
      hearings, witness statements, findings, recommendation, employer action, appeal.
- [ ] `P5-T37` **PSH-04 90-day inquiry clock** with milestone reminders at 30/60/75/85 days and a breach alert to
      the IC chair only.
- [ ] `P5-T38` **PSH-05 annual return** to the District Officer, auto-compiled by 31 January, **including nil
      years**, with the filed copy stored as evidence.
- [ ] `P5-T39` **PSH-06 POSH training coverage report** — who is trained, when, in which language (consumes the
      Phase 7 training matrix; until then, a manual record with the same shape).
- [~] `P5-T40` **GRV-01 grievance** — **skeleton:** `ird.grievances` + HR list/file.
- [~] `P5-T41` **GRV-02 whistleblower** — **skeleton:** anonymous intake + claim token hash, no PII columns.
- [ ] `P5-T42` **PSH-07 sealed retention** — case records retained per statute, access restricted post-closure,
      every post-closure read alerting the IC chair.

**Data model:** `psh.*` and `grv.*` as **isolated schemas** with row-level access driven by case membership, not
by org scope. No FK from these schemas into anything that would leak existence; the employee master is referenced
by an indirection table so a directory query can never join into a case.

**UI & navigation**
- `/cases` — group **Compliance**, icon `Scale`, permission `psh.case.own` **or** `grv.case.handle`. The nav item
  itself is invisible to anyone without a case. The landing page shows only the cases the viewer is a member of.
- ESS entry points are deliberately **not** in the nav: a "Raise a confidential concern" action in the account
  menu and on the Helpdesk landing page, both leading to a form that states plainly who will see it.
- Every case screen carries the UX contract §7 banner: *restricted — access logged*, plus the explicit list of who
  else can see this case. An IC member always knows exactly who the audience is.
- The external IC member gets a **time-boxed, case-scoped login** with no shell around it — no nav, no directory,
  no search: one case, one screen.

**Real-world use case.** *A complaint is filed from a phone at 22:40 using the QR code on the plant noticeboard.
The IC chair is notified; hr_head is not. Three weeks later hr_head, trying to help, opens the case URL from a
notification thread and receives a refusal — which is itself logged and visible to the IC chair. The inquiry
closes on day 71. On 14 January the annual return compiles itself, the chair reviews and files it, and the filed
copy sits in the evidence vault.*

**Interrelations.** Uses the WF engine for hearing scheduling and the 90-day clock, but with a **restricted
inbox** that does not surface in the normal approvals badge · uses the document vault with a sealed class · the
disciplinary bridge to Phase 6 `ird` is one-directional: a POSH finding can *initiate* a disciplinary case without
exposing the POSH file.

**Tests required**
- **Access-control negative suite is the primary suite.** `hr_ops`, `hr_head`, `payroll_admin`, `it_admin`,
  `super_admin` and a non-assigned IC member each receive 403 on read, list, export and search for a case; every
  refusal writes an audit row; no case appears in any global search, report, or export.
- Existence-leak test: a case's existence is not inferable from counts, IDs, timing or error messages.
- IC composition validation refuses non-compliant committees; term expiry alerts fire.
- 90-day clock milestones and breach; annual return compiles correctly for a nil year.
- Anonymous whistleblower submission is genuinely unattributable in the data model, and the claim code works.

**Exit criteria:** a full test case run end-to-end by a real IC · the refusal test demonstrated live to the sponsor ·
a nil-year annual return generated · the confidential ticket class live in helpdesk.

---

## Stage 5.6 — Statutory registers & returns   `[ ◐ catalog stub · wage columns wait Stage 2 ]`
**Goal:** the artefacts an inspector actually asks for, generated from data we already hold.
**Depends on:** Phase 2 for wage columns (registers with wages), 5.1 for OT data. **Closes:** GAP-A16 (registers), A26–A30.
**Requirement IDs:** `CMP-08..14`

**Stub landed (this PR):** catalog + header-only / blocked preview under
`cmp.register.generate` — `GET /compliance/registers/catalog`,
`GET /compliance/registers/{code}/preview`. Form 12 + Muster = header-only from
employee master (ecode, name, doj). Form 15 / Form 22 / Wage = `pending_payroll`
with reason `Needs Stage 2 payroll compute (P0-T06 / Stage 2.2)`. No invented
wages. UI: Registers tab (`registers`) via `RegistersTab.tsx`.

**Tasks**
- [x] `P5-T43` **CMP-08 register framework** — stub catalog + availability status
      (`available` | `pending_payroll`); full definition object (state variants,
      layout templates) still open.
- [ ] `P5-T44` **CMP-09 Form 12** Register of Adult Workers — from roster + master (name, work, group, relay, hours).
      *(header-only stub from master only)*
- [ ] `P5-T45` **CMP-10 Form 15** Register of Leave with Wages — from the leave ledger.
- [ ] `P5-T46` **CMP-11 Form 22** Muster Roll cum Register of Wages — attendance + payable days + rate + deductions
      in the statutory layout. **Distinct from R1 muster**; both must exist and must reconcile.
- [ ] `P5-T47` **CMP-12** Overtime register · Accident register (populated by Phase 6 EHS) · Form 4 General
      Register · annual return.
- [ ] `P5-T48` **CMP-13 register run + evidence** — generation is a recorded run (period, entity, generator,
      hash), the output is immutable, and re-generation produces a new run rather than overwriting.
- [ ] `P5-T49` **CMP-14 audit evidence pack** — one export bundling registers, challans, filings, licences,
      acknowledgements and policy coverage for a date range: what you hand an inspector.

**UI & navigation**
- `/compliance/registers` — tab in the `/compliance` hub. Pick entity + period + register → generate → preview in
  the statutory layout → download → the run is listed with its hash and generator.
- Registers appear **read-only forever** once generated (evidence, not a report you re-run casually).
- The `/compliance` hub landing page is a **compliance posture board**: per entity, per obligation — generated /
  due / overdue, with the same expiry colour language as documents and licences.

**Real-world use case.** *A Factories Inspectorate visit is announced for the Kharagpur unit with four days'
notice. The compliance officer generates Form 12, Form 15 and Form 22 for the last 12 months, exports the evidence
pack, and hands over a bundle whose numbers reconcile with the muster and the payroll registers because they came
from the same tables. The old process was three people and two weeks of spreadsheets.*

**Interrelations.** Reads attendance (Phase 1), leave (Phase 1), payroll (Phase 2), OT (5.1), accidents (Phase 6
EHS), contract labour registers (Phase 6 CLB) · feeds the compliance calendar (5.7).

**Tests required**
- **Golden-file tests**: generated Form 12 / 15 / 22 compared against hand-built expected layouts for a seeded
  month, cell by cell.
- Reconciliation test: Form 22 payable days ≡ R1 muster ≡ payroll paid days, for the same period, to the day.
- Immutability: a generated register cannot be edited; regeneration creates a distinct run.
- State-variant test: two states' layouts produced from the same data by configuration only.

**Exit criteria:** Form 12/15/22 generated for a real month and accepted by the compliance owner · reconciliation
test green against muster and payroll · evidence pack produced for one entity.

---

## Stage 5.7 — Licences, registrations & compliance calendar   `[ ◐ code complete — 14-entity load + live alerts remain ]`
**Goal:** nothing lapses silently across 14 entities and multiple plants.
**Depends on:** 5.4 (expiry engine). **Closes:** GAP-A05, A24, A25.
**Requirement IDs:** `CMP-15..20`

**Tasks**
- [ ] `P5-T50` **CMP-15 statutory registration master** — per entity **and** per plant: PF, ESIC, PT, LWF, Factory
      licence, CLRA licence, Shops registration, single registration under the Codes; number, validity, issuing
      authority, renewal owner, document in the vault.
- [ ] `P5-T51` **CMP-16 expiry alerting** at T-90/30/15/7 to the named owner, escalating to `hr_head` on lapse;
      reuses the Stage 5.4 expiry engine.
- [ ] `P5-T52` **CMP-17 compliance calendar** — every recurring obligation (ECR, ESIC, PT, LWF, TDS 24Q, annual
      returns, POSH 31 Jan, Factories annual return, licence renewals) with owner, due date, evidence upload and a
      missed-filing alarm.
- [ ] `P5-T53` **CMP-18 filing evidence** — the acknowledgement/challan attached to the calendar item, append-only.
- [ ] `P5-T54` **CMP-19 compliance dashboard** per entity and consolidated; `CMP-20` compliance tile on the
      executive dashboard (RPT-03) showing overdue obligations and lapsed licences.

**UI & navigation**
- `/compliance/licences` and `/compliance/calendar` — tabs in the hub.
- The calendar is a **list-first view with a month toggle**, not a grid — obligations are read as a queue, not
  browsed as a calendar. Overdue sorts to the top and never collapses.
- Executive dashboard gains one tile: *Compliance — N overdue, M licences expiring*. Clicking it drills into the
  hub (rule: every KPI links to its rows).

**Real-world use case.** *The CLRA licence for one contractor at the Odisha unit expires on 30 June. At T-90 the
contractor admin is notified; at T-30 the plant head; at T-7 the HR head. On 1 July, had it lapsed, Phase 6's
billing gate would block that contractor's invoice and their workers' gate passes automatically — the calendar and
the gate are the same fact expressed twice.*

**Interrelations.** Feeds Phase 6 CLB (licence validity gates the contractor's workers and invoices) · the
payroll statutory calendar in `/payroll` becomes a *view* of this calendar rather than a second list.

**Tests required**
- Alert cascade fires at each threshold to the correct recipient and escalates on lapse.
- Missed-filing alarm cannot be silenced without an evidence upload or an explicit, audited waiver.
- Consolidated dashboard equals the sum of entity dashboards (no double-count across shared registrations).

**Exit criteria:** all 14 entities' registrations loaded with owners · alerts firing on a real upcoming expiry ·
the executive compliance tile live.

---

## Stage 5.8 — Daily identity: password reset, profile-change, custom fields   `[ ◐ ESS-01 done · 5.8b open ]`
**Goal:** the two highest-volume HR tickets after “where is my payslip” stop being tickets.
**Depends on:** 5.2a (password policy + sessions), 5.3 (privacy notice). **Closes:** doc 16 §1.5, §2.20, §2.26.
**Catalog:** [`coverage-closeout.md`](coverage-closeout.md). **Requirement IDs:** `ESS-01..03`

**Tasks**
- [x] `P5-T60` **ESS-01 forgot / reset password.** Self-service on a verified channel (work email or mobile OTP). Token single-use, short TTL, rate-limited. Forced password change on first login already implied by the privacy interstitial + policy; this task is the *reset*. Local login retained for the frontline (5.2b SSO).
- [ ] `P5-T61` **ESS-02 profile-change request.** Employee proposes changes to address, bank, family/dependants, photo, emergency contact. HR approves. The write is an effective-dated revision, never an overwrite. Statutory IDs (PAN/Aadhaar/bank) require step-up on the HR side. Status visible to the employee.
- [ ] `P5-T62` **ESS-03 custom fields.** A typed attribute catalog on the employee master (text / date / enum / money-as-paise) with entity scope, without a migration. Values are audited. Payroll and reports may consume a field only after it is flagged `payroll_input` / `reportable` — no silent coupling.

**UI:** reset is on `/login`. Profile-change is a tab on `/people/:ecode` (me) and an inbox item for HR — not a new nav item. Custom fields admin lives under `/admin/masters`.

**Tests:** reset token cannot be replayed; unapproved profile proposal does not change the master; custom field cannot appear in a payroll input unless flagged; bank-change requires step-up to view.

**Exit criteria:** a real employee resets a password end-to-end · a bank-change request approved and visible on the next payslip bank line · one plant-specific custom field in use without a migration.

---

### Gate G5b — Phase 5 sign-off
- [ ] POSH IC constituted in-system; a full test case run; **the access-refusal test demonstrated to the sponsor**
- [ ] Grievance and whistleblower channels live, with an anonymous submission proven unattributable
- [ ] Form 12 / 15 / 22 generated for a real month and accepted by the compliance owner; reconciliation green
- [ ] Licence master complete for all 14 entities; expiry alerts firing; compliance calendar owned end-to-end
- [ ] Audit evidence pack produced and reviewed by the compliance owner
- [ ] Every new procedure declares exactly one permission code; new roles seeded and reviewed
- [ ] Forgot-password + profile-change request live (5.8)
- [ ] SCIM de-provision proven on a test exit when the IdP is available (5.2b) — not a blocker if IdP is not yet chosen
- [ ] `npm run verify` green in both projects; new E2E journeys (erasure, POSH refusal) in the Playwright suite
