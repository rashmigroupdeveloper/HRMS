# 16 — Micro-Feature Inventory (every capability, every role)

The exhaustive checklist. Doc [`15-FEATURE-GAP-AUDIT`](15-FEATURE-GAP-AUDIT.md) says *what is missing and why it
matters*; **this document lists every individual capability, switch, screen, field-group and rule** a complete HRMS
needs, marked with what we have.

**Legend** — `B` built (code shipped) · `S` specced, not built · `P` partial (headline specced, named parts absent)
· `G` **gap** (in no doc, no plan) · `X` deliberate non-goal with a recorded decision.
`→` points at the doc-15 gap ID that tracks it.

**How to use it**
- Building a module? Read its section top-to-bottom before writing the first migration — the `G`/`P` rows are the
  ones that get retrofitted expensively.
- Writing a requirement? Give it an ID here first, then promote it into `01-REQUIREMENTS-PRD`.
- Evaluating "are we done"? A module is done when every row is `B` or has a recorded `X`.

---

# PART 1 — MODULE INVENTORY

## 1. Identity, access & security

| # | Micro-feature | Status | Note |
|---|---|---|---|
| 1.1 | Login by employee code (e-code / greytHR `userid`) | **B** | `auth.login` |
| 1.2 | JWT access + refresh token rotation, logout | **B** | |
| 1.3 | Password hashing (bcrypt), failed-attempt lockout counter | **B** | `currentFails`, `maxAttempts` |
| 1.4 | Password policy object (length, complexity, reuse history, rotation, breached-password check) | **G** | → C07 |
| 1.5 | Forgot password / self-service reset with verified channel | **P** | not in shipped router |
| 1.6 | First-login forced password change + T&C/privacy-notice acceptance | **G** | → A10 |
| 1.7 | **MFA / TOTP / OTP** for privileged roles | **G** | → C03 |
| 1.8 | **Step-up re-authentication** before salary / statutory-ID / payroll-finalize actions | **G** | → C03 |
| 1.9 | **SSO — SAML 2.0 / OIDC** against corporate IdP | **G** | → C01 |
| 1.10 | **SCIM provisioning / de-provisioning** | **G** | → C02 |
| 1.11 | Active session list + remote revoke + idle timeout + concurrent-session policy | **G** | → C04 |
| 1.12 | Device registration / binding for mobile punch | **P** | `mobileDeviceId` column exists |
| 1.13 | IP allow-list / network restriction per role | **G** | → C05 |
| 1.14 | Role catalog (10 roles) + additive role holding | **B** | `rbac.matrix` |
| 1.15 | Permission catalog, one permission code per procedure | **B** | 21 codes live |
| 1.16 | Role↔permission grant/revoke at runtime, effective next request | **B** | `rbac.grant/revoke` |
| 1.17 | User↔role assign/remove with org-unit scope | **B** | `assignRole` + `scopeOrgUnitId` |
| 1.18 | Data scoping: own / subtree / org-unit / entity / all | **B** | `employee-scope.ts`, `reporting_tree` |
| 1.19 | Field-level masking (PAN/Aadhaar/UAN/ESIC/bank) by permission | **B** | `statutoryMasked` |
| 1.20 | Separation of duties (it_admin ≠ compensation; two-person payroll finalize) | **S** | documented in 08; payroll unbuilt |
| 1.21 | Hash-chained append-only audit log + verify + export + facets | **B** | `audit.verify` — better than market norm |
| 1.22 | **Purpose-of-access capture** on sensitive reads | **G** | → A17 |
| 1.23 | **Employee-visible "who accessed my record" log** | **G** | → A17 |
| 1.24 | Break-glass / emergency access with mandatory reason + alert | **G** | |
| 1.25 | Quarterly access review / recertification campaign | **G** | 08 says "reviewed quarterly" — no tooling |
| 1.26 | Rate limiting on auth + all endpoints | **S** | NFR-03 |
| 1.27 | Service accounts / API keys / machine clients with scoped permissions | **G** | → C06 |
| 1.28 | Encryption at rest for biometric templates & sensitive columns | **P** | → A16 |

## 2. Core HR — employee master

| # | Micro-feature | Status | Note |
|---|---|---|---|
| 2.1 | Single master record: personal, employment, statutory, financial | **B** | CORE-01 |
| 2.2 | E-code generation per entity series, sequence-enforced, duplicate-proof | **S** | CORE-02 |
| 2.3 | Reporting Manager **and** Functional Reporting Manager | **B** | CORE-03 |
| 2.4 | Cost centre / plant code on every employee | **B** | CORE-04 |
| 2.5 | Employment category (white/blue collar, trainee, consultant, contract-reserved) | **B** | CORE-05 |
| 2.6 | **Fixed-term employment category** with its own benefit rules | **G** | → A04 |
| 2.7 | Grade / band / designation / department / division / location | **B** | |
| 2.8 | Personal: DOB, gender, marital status, blood group, emergency contact, addresses | **B** | |
| 2.9 | Family / dependants (name, relation, DOB) for insurance + nominations + statutory | **P** | nominee columns only → B06/A23 |
| 2.10 | Education, prior experience, certifications | **G** | → B04 |
| 2.11 | Statutory IDs: PAN, Aadhaar, UAN, PF no, ESIC IP, bank + IFSC | **B** | permission-masked |
| 2.12 | Photo / ID card issue | **P** | `photoPath` exists; no card generation |
| 2.13 | Multi-entity employment + inter-entity transfer preserving service continuity | **S** | LC-05 |
| 2.14 | Effective-dated attribute history (every change is a dated row, not an overwrite) | **S** | temporal `EXCLUDE` rule in CLAUDE.md |
| 2.15 | Employee status machine: pre-joining → probation → confirmed → exited → alumni | **P** | statuses exist; lifecycle unbuilt |
| 2.16 | Never hard-delete (FK from append-only audit) | **B** | CORE-06 |
| 2.17 | Bulk import with validation report + dry run | **P** | `import.service.ts`; no dry-run/rollback → C16 |
| 2.18 | Bulk edit / mass update (transfers, cost-centre re-map, grade revision) | **G** | → C16 |
| 2.19 | Directory search with facets + filters | **B** | `employees.list/facets` |
| 2.20 | Employee profile page with tabbed sections + edit-request workflow (employee proposes, HR approves) | **P** | `getOwn`/`getByEcode`; no self-edit request |
| 2.21 | **Interactive org chart** (browse, search, span of control, dotted line) | **G** | → C13 |
| 2.22 | **Position / establishment management** (sanctioned posts, vacancy, budget) | **G** | → B08 |
| 2.23 | Probation / confirmation due date on the record | **B** | `probationDueDate` |
| 2.24 | Notice period, retirement date, contract end date + expiry alerts | **P** | |
| 2.25 | Attendance mode per employee (biometric / mobile / exempt) | **B** | `setScheme` |
| 2.26 | Custom fields / extensible attributes without a migration | **G** | |

## 3. Documents, letters & e-signature

| # | Micro-feature | Status | Note |
|---|---|---|---|
| 3.1 | Letter templates, versioned, per entity | **B** | `listTemplates/upsertTemplate` |
| 3.2 | Letter issuance with merge fields + signatory approval chain | **B** | `letters.issue`, chain in 08 §4 |
| 3.3 | Employee letter inbox + HR letter history | **B** | `myLetters/employeeLetters` |
| 3.4 | Absence / show-cause case letters | **B** | `issueCaseLetter` |
| 3.5 | **Mandatory appointment letter coverage report** ("who has none on file") | **G** | → A03 |
| 3.6 | **Employee document vault** — categorised uploads, mandatory-doc checklist per category | **G** | → B09 |
| 3.7 | **Document expiry tracking + alerts** (contract, medical fitness, licence, visa, apprentice cert) | **G** | → B09 |
| 3.8 | Bulk document request ("collect PAN from these 40 people") | **G** | → B09 |
| 3.9 | **Aadhaar eSign / DSC** on offers, appointment letters, F&F, Form 16 | **G** | → B10 |
| 3.10 | Digitally-signed payslip & Form 16 PDFs | **S** | PAY-06 / E17 |
| 3.11 | Watermarking / access-controlled download of sensitive letters | **G** | |
| 3.12 | Document retention + purge per class, with legal hold | **G** | → A13 |

## 4. Policies & acknowledgement

| # | Micro-feature | Status | Note |
|---|---|---|---|
| 4.1 | Policy catalog, publish, versioning, body + summary | **B** | `policies.publish/policyCatalog` |
| 4.2 | Targeted audience (entity / department / grade / location) | **B** | `audience.ts` |
| 4.3 | Employee acknowledgement with timestamp | **B** | `ack` |
| 4.4 | Pending-acknowledgement nag + coverage report + Excel | **B** | `nag`, `ackReport`, `ackReportExcel` — CORE-13 |
| 4.5 | Re-acknowledge on new version | **P** | |
| 4.6 | Mandatory-read gating (cannot proceed until acknowledged) | **P** | |
| 4.7 | **Multi-language policy body** (Hindi / Odia / Bengali) | **X→revisit** | → C12; also a POSH-training expectation |
| 4.8 | Policy quiz / comprehension check | **G** | |

## 5. Attendance & time

| # | Micro-feature | Status | Note |
|---|---|---|---|
| 5.1 | Kent biometric ingestion behind a connector interface + mock | **B** | `kent-connector.ts`, `MockKentConnector` |
| 5.2 | Per-device sync watermark, monotonic, gap detection | **B** | migrations 1751920/1751930 |
| 5.3 | Device health: last-seen, silent doors, pending doors, alerts | **B** | `devices`, `silentDoorsAlerted` |
| 5.4 | Swipe quarantine for unmatched / malformed records + re-ingest | **B** | `quarantined`, `unmatched`, `reingest` |
| 5.5 | Monthly partitioned swipe tables | **B** | `att.ensure_swipe_partition` |
| 5.6 | Day-status algorithm (P / A / WO / HD / OD / L) with shift window & midnight crossing | **B** | `day-status.service.ts` |
| 5.7 | Late-in / early-exit minutes, grace, thresholds — all from `core.settings` | **B** | zero hardcoded policy |
| 5.8 | Week-off eligibility rules | **B** | `weekClose` — ATT-09 |
| 5.9 | Overtime detection, 48-hour approval SLA, lapse sweep | **B** | `myOvertime`, `decideOt`, `lapseSweep` |
| 5.10 | **Statutory OT ceilings** (daily/weekly/quarterly caps, spread-over) enforced at roster & approval time | **G** | → A09 |
| 5.11 | Regularization (AR) request + approval | **B** | `submitRequest` type AR |
| 5.12 | On-Duty (OD) incl. future-dated | **B** | type OD |
| 5.13 | Short-leave / "Permission" request | **B** | type PERMISSION |
| 5.14 | Permission/short-leave **quota & entitlement engine** (n per month, max minutes) | **P** | → E06 |
| 5.15 | Comp-off credit from week-off/holiday work, with expiry sweep | **B** | `compOffExpiryRun` |
| 5.16 | Absenteeism engine: case creation, stages, escalation, show-cause letters | **B** | `absence.cases/escalate/scan` — ATT-10/11 |
| 5.17 | Manual override by HR (managers explicitly barred) | **B** | `overrideDay` + PP-v2-18 rule |
| 5.18 | Recompute on demand / on late-arriving swipes | **B** | `recompute` |
| 5.19 | Month lock, lock checklist, finalization holds, immutability triggers | **B** | ATT-15 — DB-enforced |
| 5.20 | Manager month approval ledger | **B** | `managerApprovalLedger` |
| 5.21 | Muster build + list + export | **B** | R1 |
| 5.22 | Cross-plant punching vs cost centre flag | **B** | `crossPlantFlag` — ATT-16 |
| 5.23 | Mobile / geo check-in with GPS coordinates (PWA) | **S** | ATT-14 |
| 5.24 | **Geofence definition object** (site polygon/radius, per-site allow-list, validation) | **G** | → E04 |
| 5.25 | **Selfie + face match + liveness / anti-spoof** (buddy-punch prevention) | **G** | → E03 |
| 5.26 | **Offline punch queue + background sync** | **G** | → C09 |
| 5.27 | Attendance for **contract workers / third parties** | **X→revisit** | → D01/E05 |
| 5.28 | Attendance-vs-swipe reconciliation report for auditors | **P** | → E07 |
| 5.29 | Attendance correction audit (who changed what, before/after) | **B** | audit log |
| 5.30 | **Form 12 register of adult workers** derived from roster+master | **G** | → A26 |

## 6. Shift & roster / workforce management

| # | Micro-feature | Status | Note |
|---|---|---|---|
| 6.1 | Shift master: start/end, break, min full/half-day hours, grace, crosses-midnight | **B** | `upsertShift` |
| 6.2 | Roster read/write per team, per date | **B** | `getTeamRoster`, `setRoster` |
| 6.3 | Roster no-op approval guard (prevent silent overwrite) | **B** | migration 1752030 |
| 6.4 | Holiday calendar per location/entity | **B** | `listHolidays/upsertHoliday` |
| 6.5 | Restricted / floating holiday publish + employee selection | **B** | `publishRestrictedHoliday`, `selectRh` |
| 6.6 | Rotating shift patterns / cyclic templates applied in bulk | **P** | "default shift pattern" referenced in 04 |
| 6.7 | **Auto-rostering** from demand/coverage rules | **G** | → E01 |
| 6.8 | **Shift swap / shift bid between employees** with approval | **G** | → E02 |
| 6.9 | **Fatigue rules**: max consecutive nights, min rest between shifts, no double shift | **G** | → D09 |
| 6.10 | **Women night-shift consent + transport evidence** gate | **G** | → A08 |
| 6.11 | Coverage / shortfall view vs planned manpower per line/section | **G** | → D10 |
| 6.12 | Roster publish + notify + deadline nag to managers | **P** | nag is in the UI spec (08 §3) |
| 6.13 | Roster change history & effective-dated audit | **B** | |

## 7. Leave & absence

| # | Micro-feature | Status | Note |
|---|---|---|---|
| 7.1 | Leave type catalog with per-type rules (accrual, carry-forward cap, encashable, half-day, service-months gate) | **B** | `listTypes/upsertType` |
| 7.2 | Monthly fractional accrual job | **B** | `accrualRun` — LV-02 |
| 7.3 | Immutable leave **ledger** (balance = SUM of rows) | **B** | `myLedger` |
| 7.4 | Apply / cancel / approve with workflow + ledger reversal on cancel | **B** | `apply`, `cancel` |
| 7.5 | Half-day + session (first/second half) | **B** | `fromHalf/toHalf` |
| 7.6 | Sandwich rule (weekend/holiday inside a span) per type | **B** | `sandwichRule` |
| 7.7 | Encashment request → approval → payroll | **B** (request) / **S** (payout) | `encash` |
| 7.8 | HR adjustment with reason + audit | **B** | `adjust` |
| 7.9 | Year-end run: carry-forward / lapse / encash | **B** | `yearEndRun` |
| 7.10 | Comp-off apply + expiry | **B** | |
| 7.11 | Restricted holiday quota per calendar per grade | **P** | → E11 |
| 7.12 | **Statutory leave types**: paternity, adoption, bereavement, marriage, quarantine, sabbatical | **P** | → E08 |
| 7.13 | **Maternity Benefit Act mechanics**: 26 weeks, medical bonus, post-natal WFH, no-dismissal protection, register | **P** | → A22 |
| 7.14 | **Crèche facility register (50+ employees)** | **G** | → A22 |
| 7.15 | **Leave planner / team calendar** with blackout dates & minimum-coverage rules | **G** | → E09 |
| 7.16 | Negative balance / advance leave policy object | **G** | → E10 |
| 7.17 | Leave donation / leave bank | **G** | → E10 |
| 7.18 | LOP computation feeding payroll paid-days | **S** | payroll unbuilt |
| 7.19 | **Form 15 register of leave with wages** | **G** | → A27 |
| 7.20 | Leave balance visible in ESS with projection to a future date | **B** (balance) / **G** (projection) | |

## 8. Workflow engine

| # | Micro-feature | Status | Note |
|---|---|---|---|
| 8.1 | Named chains per request type, sequence of role/person steps | **B** | `definitions.seed.ts` |
| 8.2 | Actions: approve / reject / **send_back** | **B** | `act` |
| 8.3 | Per-step SLA + escalation on breach | **B** | `slaDueAt`, `breached`, `escalateTo` |
| 8.4 | **`notified_at` receipt per step** (the "approver never notified" bug made impossible) | **B** | flagship control |
| 8.5 | Delegation window with `delegated_from` preserved | **B** | |
| 8.6 | Approval inbox with badge counts + SLA countdown | **B** | `inbox` |
| 8.7 | Request timeline visible to the requester | **B** | `timeline` |
| 8.8 | Resubmit after send-back | **B** | `resubmit` |
| 8.9 | Auto-approve at cutoff (restricted holiday) / lapse (OT 48h) | **B** | |
| 8.10 | Chains span entities (manager in another company can approve) | **B** | company-agnostic resolution |
| 8.11 | **No-code chain builder UI for hr_head** | **P** | → E21 |
| 8.12 | **Conditional routing on data attributes** (amount, grade, entity, plant) | **P** | → E22 |
| 8.13 | **Parallel / quorum approval steps** | **G** | → E23 |
| 8.14 | **Approve from email / push deep-link** | **G** | → E24 |
| 8.15 | Bulk approve across request types | **P** | → E25 |
| 8.16 | Out-of-office auto-delegation trigger | **P** | delegation exists; no auto-trigger |
| 8.17 | Withdrawal by requester before first action | **P** | |
| 8.18 | Chain simulation / "who will approve this?" preview | **G** | |
| 8.19 | No hidden date cutoffs in chains (PP-v2-20 regression test) | **S** | test case named in 01 |

## 9. Payroll engine (M4 — Phase 2, nothing built yet)

| # | Micro-feature | Status | Note |
|---|---|---|---|
| 9.1 | Salary structure / CTC builder with components, formulas, effective dates | **S** | |
| 9.2 | **Wage-definition conformance check (basic+DA ≥ 50%)** at structure save | **G** | → A01 |
| 9.3 | Grade-wise structure templates + bulk assignment | **P** | grade structures = open decision (10 §15) |
| 9.4 | Salary revision with reason (`annual_increment` / `promotion` / `confirmation` / `correction`) | **S** | schema line 474 |
| 9.5 | Integer-paise branded `Money` type; floats never touch money | **S** | 14 §6 |
| 9.6 | One rounding-policy file (PF → nearest rupee, ESIC → round up) | **S** | |
| 9.7 | Payroll run stepper: create → inputs → compute → review → finalize | **S** | |
| 9.8 | Chunked compute per cost centre as a background job | **S** | 13 §16 |
| 9.9 | **Input freeze / cut-off calendar** with per-source status | **P** | → E20 |
| 9.10 | Attendance/LOP, leave, OT, comp-off, claims, loans as declared inputs | **S** | |
| 9.11 | Review grid with exceptions (negative net, missing salary, ESIC boundary crossing) | **S** | |
| 9.12 | **Variance vs prior month dashboard** (the pre-finalize control) | **P** | → E19 |
| 9.13 | Two-person finalize (payroll_admin + hr_head co-sign) | **S** | 08 hard rule |
| 9.14 | Month immutability after lock; reopen only by super_admin, audited | **S** | |
| 9.15 | **Retro = recompute + delta** (closed periods never edited) | **S** | 14 §7 |
| 9.16 | Arrears generation & propagation across statutory bases | **S** | |
| 9.17 | **Off-cycle / supplementary run type** | **P** | → E13 |
| 9.18 | **Salary hold / withheld payment + release workflow** | **G** | → E12 |
| 9.19 | Mid-month joiner / exit proration | **S** | PAY-07 |
| 9.20 | Payslip with `calc_note` per line (explainable numbers) | **S** | PAY-06 |
| 9.21 | Payslip publish + email + ESS download + reissue | **S** | |
| 9.22 | **Bank advice files per bank/entity** + payment status reconciliation (returns/failures) | **P** | → E14 |
| 9.23 | **GL / JV posting to SAP** with cost-centre map, posting status, re-post | **P** | → E15 |
| 9.24 | Payroll registers: gross, deduction, net, component-wise, cost-centre-wise | **S** | R7–R20 range |
| 9.25 | Parallel run: 2 cycles minimum, tolerances agreed up front, gross-before-net reconciliation | **S** | 14 §75 |
| 9.26 | Golden-file tests to the rupee, hand-computed (G1–G10) | **S** | 10 §13 — non-negotiable |
| 9.27 | 100% branch coverage on payroll-core | **S** | |
| 9.28 | Annual bonus true-up (8.33–20% band, set-on/set-off) | **S** | PAY-17 |
| 9.29 | Increment processing with effective dates | **S** | PAY-17 — mechanical only, see §19 |
| 9.30 | F&F: notice recovery, encashment, gratuity, dues, clearance gate | **S** | PAY-15 |
| 9.31 | **F&F SLA clock (48h / 2 working days) + breach alert** | **P** | → A02 |
| 9.32 | **Fixed-term gratuity at 1 year** | **G** | → A04 |

## 10. Statutory & compliance (India)

| # | Micro-feature | Status | Note |
|---|---|---|---|
| 10.1 | Statutory rates as **versioned data** (`statutory_rates`), not code | **S** | doc 10 — excellent design |
| 10.2 | PF: wage base, 12%, EPS split, VPF, rounding | **S** | PAY-09 |
| 10.3 | ESIC: 0.75/3.25%, ₹21k threshold, contribution-period boundary rule | **S** | PAY-10 |
| 10.4 | PT (West Bengal + other states), LWF | **S** | PAY-11/12 |
| 10.5 | TDS: old vs new regime, slabs, surcharge, cess, projection, 12BB proofs | **S** | PAY-13 |
| 10.6 | **Regime election capture per employee per FY, with lock date + change audit** | **P** | → E16 |
| 10.7 | Investment declaration + proof upload + HR verification | **S** | PI-ESS-15 |
| 10.8 | **Perquisites beyond loans (car, accommodation, ESOP) + Form 12BA** | **G** | → E18 |
| 10.9 | Loan perquisite at SBI rate | **S** | LN-01 |
| 10.10 | Portal-ready outputs: **ECR**, ESIC, PT challan, **24Q** data, LWF, challan registers | **S** | filing stays human (01 §11) |
| 10.11 | **Form 16 Part A + B assembly, bulk digital signing, distribution, reissue** | **P** | → E17 |
| 10.12 | Apprentice / trainee statutory exemptions | **S** | PAY-14 |
| 10.13 | **NAPS/NATS apprentice registration, stipend, completion certificates, returns** | **P** | → D13 |
| 10.14 | Gratuity engine (5y / 240d decision) | **S** | 10 §15 open decision |
| 10.15 | **Statutory nomination forms**: EPF Form 2, Form 11, ESIC Form 1, **Gratuity Form F**, with e-sign + coverage report | **P** | → A23 |
| 10.16 | **Statutory registration & licence master** per entity/plant with expiry + renewal owner + T-30/15/7 alerts | **G** | → A24 |
| 10.17 | **Compliance calendar** — all due dates, owner, evidence upload, missed-filing alarm | **P** | → A25 |
| 10.18 | **Factories Act registers**: Form 12 (adult workers), Form 15 (leave with wages), **Form 22 (muster-cum-wages)**, overtime register, accident register, Form 4 general register, annual return | **G** | → A26–A29 |
| 10.19 | **State-configurable register/return layout generator** (14 entities, multiple states) | **G** | → A30 |
| 10.20 | **Labour-Codes conformance pack**: wage definition, 48h F&F, appointment letters, FTE benefits, single registration/return, standing orders (300+) | **P** | → A01–A06 |
| 10.21 | Minimum-wage master by state / skill category with revision alerts | **G** | |
| 10.22 | Bonus register (Payment of Bonus Act), eligibility ₹21k | **S** | PAY-17 |
| 10.23 | Statutory audit evidence pack export (inspector-ready bundle) | **G** | |

## 11. Data protection & privacy operations (DPDP) — entirely new

| # | Micro-feature | Status | Note |
|---|---|---|---|
| 11.1 | Versioned **privacy notice** at collection, per data-principal class (employee / candidate / contractor worker / dependant) | **G** | → A10 |
| 11.2 | **Consent registry** for non-employment processing, with granular purposes + withdrawal | **G** | → A11 |
| 11.3 | **Rights-request workflow**: access, correction, erasure — identity verification, statutory clock, outcome, refusal reasons, register | **G** | → A12 |
| 11.4 | **Retention schedule per data class** + automated purge job + legal-hold override | **G** | → A13 |
| 11.5 | **Breach register + Data Protection Board notification runbook** + affected-principal notice | **G** | → A14 |
| 11.6 | **Processor register + DPA tracking** (storage host, SMTP, Kent vendor, booking provider, BSP) | **G** | → A15 |
| 11.7 | Cross-border transfer record (if any vendor is offshore) | **G** | |
| 11.8 | Published **grievance officer / DPO** contact + response SLA | **G** | → A18 |
| 11.9 | Purpose-stamped access log + employee-visible access history | **G** | → A17 |
| 11.10 | Data-minimisation review per field ("why do we hold this?") | **G** | |
| 11.11 | Full **data-export pack** for a data principal | **G** | → C25 |
| 11.12 | Biometric template encryption + retention limit + no raw export | **P** | → A16 |

## 12. Loans & advances (M11 — Phase 2)

| # | Micro-feature | Status |
|---|---|---|
| 12.1 | Loan type config: diminishing / flat / EMI-without-interest | **S** |
| 12.2 | Eligibility policy (grade, tenure, multiple-of-basic), **not open to all** | **S** |
| 12.3 | ESS application + approval chain (RM → HR head → payroll) | **S** |
| 12.4 | EMI schedule generation + auto-deduction in payroll | **S** |
| 12.5 | Perquisite valuation at SBI lending rate | **S** |
| 12.6 | Legacy SAP loan balance import | **S** |
| 12.7 | Balance + schedule visible in ESS | **S** |
| 12.8 | Foreclosure / part-prepayment / moratorium / EMI pause | **G** |
| 12.9 | Recovery on exit through F&F | **S** |
| 12.10 | Salary advance (distinct from loan) with monthly deduction | **S** |

## 13. Claims & reimbursements (M12) + Travel & Expense (M13 — Phase 3.5)

| # | Micro-feature | Status | Note |
|---|---|---|---|
| 13.1 | Claim types with entitlement per grade, bill-required flag, taxability rule | **S** | CLM-01 |
| 13.2 | ESS submission with running entitlement balance shown pre-submit | **S** | CLM-02 |
| 13.3 | Approval chain RM → HR verify → payroll batch, partial approval | **S** | CLM-03 |
| 13.4 | Payout via payroll or off-cycle batch + reimbursement payslip | **S** | CLM-04 |
| 13.5 | Year-end TDS on unclaimed entitlement; lapse/carry rules | **S** | CLM-05 |
| 13.6 | Trip request with itinerary segments, visa flag, attachments | **S** | TE-01/02 |
| 13.7 | Booking connector (MakeMyTrip Corporate) behind an interface; own-arrangement path | **S** | TE-03 |
| 13.8 | Budget engine: air class, lowest-logical-fare, flying-hours, hotel/night, DA, visa cost, grade entitlements | **S** | TE-05 |
| 13.9 | Over-budget flagged for higher approval, not blocked | **S** | TE-06 |
| 13.10 | Travel advance + approval chain incl. CHRO stage for global | **S** | TE-07 |
| 13.11 | **Employee wallet as an immutable transaction ledger** | **S** | TE-08 |
| 13.12 | Settlement: claimed vs advance → net payable / recoverable → payroll | **S** | TE-09 |
| 13.13 | Multi-currency with exchange-rate capture | **S** | TE-10 |
| 13.14 | Yatra Avedan data migration + decommission | **S** | TE-12 |
| 13.15 | **OCR receipt capture / auto-fill from bill image** | **G** | market standard |
| 13.16 | **GST input-credit capture** (GSTIN, invoice no, tax split) on expense lines | **G** | material for a manufacturer |
| 13.17 | **Corporate card feed + statement reconciliation** | **G** | |
| 13.18 | **Per-diem/DA auto-computation by city slab + half-day rule** | **P** | budget engine covers DA loosely |
| 13.19 | Duplicate-receipt / duplicate-claim detection | **G** | |
| 13.20 | Mileage / own-vehicle claim with rate master | **G** | |

## 14. Benefits administration — entirely new

| # | Micro-feature | Status | Note |
|---|---|---|---|
| 14.1 | Group mediclaim / GPA / GTLI policy master per entity | **G** | → B06 |
| 14.2 | Enrolment + dependants + mid-year additions/deletions + endorsement file to insurer | **G** | → B06 |
| 14.3 | Sum-insured by grade, top-up / voluntary parental cover with payroll deduction | **G** | |
| 14.4 | Claim intimation & status assist (TPA hand-off) | **G** | |
| 14.5 | Superannuation scheme + NPS (employer/employee contribution, PRAN) | **G** | |
| 14.6 | Gratuity fund / LIC trust reconciliation vs computed liability | **G** | |
| 14.7 | Flexi-benefit plan declaration + lock window + payroll effect | **P** | flexi-basket named in CLM-01 |
| 14.8 | Benefit statement / total-rewards statement per employee | **G** | |
| 14.9 | **Annual health check-up campaign + occupational health record** | **G** | → A07 |

## 15. Employee lifecycle (M5 — Phase 3)

| # | Micro-feature | Status | Note |
|---|---|---|---|
| 15.1 | Pre-joining link: candidate fills own data before day 1 | **S** | LC-01 |
| 15.2 | Onboarding task fan-out (IT / HR / admin / plant queues) with owners + due dates | **S** | LC-02 |
| 15.3 | Joining document checklist + collection status | **P** | → B09 |
| 15.4 | **Statutory joining forms (Form 2/11/F/ESIC 1/12BB) e-signed** | **P** | → A23 |
| 15.5 | Convert candidate → employee with e-code allocation | **S** | `lifecycle.onboard.convert` permission planned |
| 15.6 | **Daily boarding/exit email to HR/BH/CEO** | **B** | LC-03 — `lifecycle.report/send/excel` |
| 15.7 | **Buddy assignment, 30/60/90 check-ins, onboarding feedback survey** | **G** | → B17 |
| 15.8 | Probation tracking + reminders + confirmation workflow | **S** | LC-04 |
| 15.9 | Probation **extension** path with letter | **P** | |
| 15.10 | Confirmation appraisal instrument (the input to the decision) | **G** | → B01 |
| 15.11 | Salary switch on confirmation (probation % → full) | **S** | PAY-02 |
| 15.12 | Transfer / deputation / promotion — incl. **inter-entity** with service continuity | **S** | LC-05 |
| 15.13 | Resignation in ESS → chain → LWD → clearance fan-out → status timeline | **S** | LC-06 |
| 15.14 | Absconding / HR-initiated separation via the disciplinary path | **P** | → D11 |
| 15.15 | Clearance matrix (IT, assets, finance, library, quarters, canteen, transport) | **P** | assets covered |
| 15.16 | **Exit interview instrument + attrition reason taxonomy** | **G** | → B14 |
| 15.17 | **Knowledge-transfer / handover checklist** | **G** | → B14 |
| 15.18 | **Rehire-eligibility flag + blacklist** | **G** | → B14 |
| 15.19 | Exit day: status/DOL set once, removed from lists/rosters/approvals, open items reassigned | **S** | LC-07 |
| 15.20 | Alumni mode ESS (payslip / Form 16 only) | **S** | LC-07 |
| 15.21 | **Alumni engagement / referral network** | **G** | → B14 |
| 15.22 | Retirement pipeline + superannuation processing | **G** | |

## 16. Recruitment / ATS (M14 — Phase 4 = "absorption" only)

| # | Micro-feature | Status | Note |
|---|---|---|---|
| 16.1 | **Manpower requisition (MRF) with headcount-budget check** + approval chain | **G** | → B07/B08 |
| 16.2 | Job description library + requisition→JD link | **G** | |
| 16.3 | Job posting to career site / boards / internal | **P** | in the external ATS |
| 16.4 | Resume parsing + candidate database + de-duplication | **P** | external ATS |
| 16.5 | Pipeline stages, tags, notes, collaboration | **P** | external ATS |
| 16.6 | Interview scheduling + panel + **scorecards** | **G** | |
| 16.7 | Offer modelling (CTC breakup preview) + **LOI approval chain** | **S** | WF-01 LOI chain, PP-20 |
| 16.8 | Offer letter generation + **e-sign** + acceptance tracking | **P** | → B10 |
| 16.9 | **Background verification (BGV)** order + status + adverse-action handling | **G** | → B07 |
| 16.10 | Candidate portal + status communication | **P** | |
| 16.11 | **Referral programme** with payout via payroll | **G** | → B16 |
| 16.12 | **Internal job posting / internal mobility** | **G** | → B15 |
| 16.13 | Joined-candidate → onboarding handoff | **S** | Phase 4 |
| 16.14 | Recruitment analytics: time-to-fill, source-of-hire, offer-drop, funnel | **P** | R21/R22 read ATS data |
| 16.15 | Candidate data privacy: notice, consent, retention/purge | **G** | → A10/A13 |

## 17. Performance management — non-goal today (docs 01 §11)

| # | Micro-feature | Status | Note |
|---|---|---|---|
| 17.1 | Goal / KRA / KPI setting with weightings | **X** | → B01 |
| 17.2 | OKR cascade org→dept→individual with auto-rollup + alignment view | **X** | |
| 17.3 | Review cycles: annual, mid-year, quarterly, **probation (30/60/90)**, project-based | **X** | 15.10 needs the probation one |
| 17.4 | Self / manager / peer / skip-level assessment | **X** | |
| 17.5 | **360° feedback** with reviewer nomination, weighting, anonymity | **X** | |
| 17.6 | Competency framework + gap analysis | **X** | → B04 |
| 17.7 | Rating scales (3/4/5-point, custom) | **X** | |
| 17.8 | **Calibration sessions + bell-curve normalisation + audit trail of adjustments** | **X** | |
| 17.9 | **9-box performance/potential matrix** | **X** | |
| 17.10 | PIP with milestones and review | **X** | |
| 17.11 | Continuous feedback / kudos / 1:1 notes | **X** | |
| 17.12 | Rating → increment / bonus hand-off to compensation | **X** | ties PAY-17 |
| 17.13 | Performance analytics: distribution, reviewer consistency, bias flags | **X** | |

## 18. Learning, training & skills — non-goal today

| # | Micro-feature | Status | Note |
|---|---|---|---|
| 18.1 | **Training matrix: role → mandatory training map** | **X→revisit** | → B03; audit requirement |
| 18.2 | **Certification & validity tracking with expiry alerts** | **X→revisit** | safety licences, forklift, first-aid |
| 18.3 | **Mandatory-training register**: safety induction, POSH, fire, first-aid, ISO/IATF | **X→revisit** | → A19 (POSH training coverage) |
| 18.4 | Training calendar, nomination, attendance capture, feedback | **X** | |
| 18.5 | Training effectiveness / post-assessment | **X** | |
| 18.6 | Courseware delivery (SCORM/video) | **X** | genuinely defer |
| 18.7 | **Skill inventory + proficiency + gap by role/line** | **G** | → B04 |
| 18.8 | Multi-language training content | **X→revisit** | → C12 |
| 18.9 | Training cost & budget tracking | **X** | |
| 18.10 | **Career paths / IDP / succession & bench strength** | **G** | → B05 |

## 19. Compensation planning — partial today

| # | Micro-feature | Status | Note |
|---|---|---|---|
| 19.1 | Increment processing with effective dates | **S** | PAY-17 — the *mechanics* only |
| 19.2 | **Merit / increment cycle** with budget pot per unit | **G** | → B02 |
| 19.3 | **Manager proposal worksheet** with guidelines & guardrails | **G** | |
| 19.4 | Pay bands / ranges / compa-ratio / range penetration | **G** | |
| 19.5 | Multi-level cycle approval + freeze + publish | **G** | |
| 19.6 | **Increment / promotion letter generation from the cycle** | **P** | letters exist; no cycle |
| 19.7 | Variable pay / incentive plan definition + payout computation | **P** | bonus true-up only |
| 19.8 | Pay-equity / parity analysis | **G** | |
| 19.9 | Total-rewards statement | **G** | → B08/14.8 |

## 20. Engagement, communication & recognition (M10)

| # | Micro-feature | Status | Note |
|---|---|---|---|
| 20.1 | Announcements publish / withdraw with targeted audience | **B** | `engagement.publish/withdraw` |
| 20.2 | Employee announcement feed | **B** | `myAnnouncements` |
| 20.3 | Opinion polls: create, respond, results, close, anonymous + dedupe | **B** | migration 1752040 |
| 20.4 | **Structured pulse surveys with response analytics** | **S** | EN-03 — specced, **not built** |
| 20.5 | **eNPS + driver analysis + manager-level heatmap + action plans** | **G** | → B13 |
| 20.6 | Policy acknowledgement tracking | **B** | see §4 |
| 20.7 | **Rewards & recognition**: spot award, peer kudos, nomination→approval, points/budget, payout | **G** | → B11 |
| 20.8 | Birthdays / work anniversaries / milestones feed | **G** | |
| 20.9 | **Wellness programmes / EAP (confidential referral)** | **G** | → B12 |
| 20.10 | Read-receipt + reach analytics on announcements | **P** | |
| 20.11 | **Multi-channel delivery (push / WhatsApp / SMS) for the frontline** | **G** | → C11 |
| 20.12 | Multi-language announcements | **X→revisit** | → C12 |
| 20.13 | Suggestion box / idea management | **G** | |

## 21. Helpdesk & knowledge (M9)

| # | Micro-feature | Status | Note |
|---|---|---|---|
| 21.1 | Category catalog + auto-assignment | **B** | `categories` |
| 21.2 | Raise / my tickets / agent queue / threaded replies | **B** | |
| 21.3 | Ticket numbering sequence | **B** | migration 1752020 |
| 21.4 | SLA per category, escalation matrix, breach tracking | **B** | `escalate`, `slaHours` |
| 21.5 | Status lifecycle + resolution + monthly performance report + Excel | **B** | `performance` — HD-01 |
| 21.6 | "HRMS platform" category from day one (adoption feedback loop) | **S** | 07 §4b |
| 21.7 | **Knowledge base / FAQ with deflection at ticket creation** | **G** | → E28 |
| 21.8 | **Confidential / sensitive ticket class** with restricted visibility | **G** | → E29 — prerequisite for POSH/grievance |
| 21.9 | **CSAT on resolution** | **G** | → E30 |
| 21.10 | Attachments on tickets | **P** | |
| 21.11 | Re-open window + linked/duplicate tickets | **G** | |
| 21.12 | **AI auto-triage + suggested answer** | **G** | → C21 |

## 22. Assets (M8)

| # | Micro-feature | Status | Note |
|---|---|---|---|
| 22.1 | Asset registry + search (asset no, type, holder) with trigram index | **B** | migration 1752010 — AST-01 |
| 22.2 | Warranty date accepting past dates | **B** | AST-02 |
| 22.3 | Allocation to employees **and third-party/contract persons** | **B** | `holderKind` — AST-03 |
| 22.4 | Return recording + resigned-employee holdings view | **B** | `recordReturn`, `heldByEmployee` — AST-04 |
| 22.5 | Non-returned / outstanding dashboard + export | **B** | AST-05 |
| 22.6 | Maintenance log + add maintenance | **B** | AST-06 |
| 22.7 | Incident / damage / lost-asset handling with recovery to payroll | **P** | AST-06 partial |
| 22.8 | Asset request by employee (ESS) with approval | **G** | |
| 22.9 | Depreciation / book value / finance-asset-register reconciliation | **G** | |
| 22.10 | **Uniform & PPE issue/return with entitlement cycle and size** | **G** | → D06 |
| 22.11 | Barcode / QR / RFID tagging + scan-based audit | **G** | |

## 23. Plant operations — entirely new (Register D)

### 23.1 Contract labour — **OUT OF SCOPE (separate product, D8 settled 3 Sep 2026)**
The rows below are retained as a record of what the CLMS must cover, so nothing is assumed to be
handled that isn't. HRMS builds **none** of them; it builds the integration in 23.1.15–23.1.18.
| # | Micro-feature | Status |
|---|---|---|
| 23.1.1 | Contractor master: PAN/GST, PF/ESIC codes, bank, category, rating | **X** — CLMS |
| 23.1.2 | **CLRA licence** + validity + coverage ceiling, renewal alerts, auto-block on expiry | **X** — CLMS |
| 23.1.3 | Work order / contract: scope, period, rates, manpower ceiling by trade | **X** — CLMS |
| 23.1.4 | Worker enrolment: KYC, Aadhaar/PAN, bank, skill category, photo, family | **X** — CLMS |
| 23.1.5 | **Medical fitness certificate + validity**; safety induction record | **X** — CLMS |
| 23.1.6 | **Gate pass issue / renew / block / lost-pass**, tied to licence + induction + medical validity | **X** — CLMS |
| 23.1.7 | Contractor worker biometric attendance & muster | **X** — CLMS |
| 23.1.8 | **Contractor wage register + minimum-wage verification by state/skill** | **X** — CLMS |
| 23.1.9 | **PF/ESIC challan upload & verification before invoice release** | **X** — CLMS |
| 23.1.10 | Invoice / billing reconciliation vs attendance & rates | **X** — CLMS |
| 23.1.11 | Statutory forms for contract labour (Form 12/13/14/15 series as applicable), returns | **X** — CLMS |
| 23.1.12 | Blacklist / debarment + incident history | **X** — CLMS |
| 23.1.13 | Principal-employer compliance dashboard per contractor / plant | **X** — CLMS |
| 23.1.14 | Contractor supervisor as an **external limited-scope role** | **X** — CLMS |
| **23.1.15** | **`external_worker_ref`** value object — source + external id + cached display name. Never an FK | **G** — ours |
| **23.1.16** | **Contractor headcount feed** per plant/trade, watermarked, behind a connector interface with a mock | **G** — ours |
| **23.1.17** | **Contractor licence expiry into `cmp.calendar_items`** so the Stage 5.7 ladder covers it | **G** — ours |
| **23.1.18** | **Staleness visible** on every contractor-derived number (`cached_at`), never rendered as zero | **G** — ours |

### 23.2 Facilities
| # | Micro-feature | Status |
|---|---|---|
| 23.2.1 | **Gate pass (employee)**: late-in / early-out authorisation, out-pass, return scan | **G** |
| 23.2.2 | **Visitor management**: pre-registration, host approval, safety briefing ack, badge, exit | **G** |
| 23.2.3 | **Canteen**: meal slots by shift, entitlement/subsidy, employee vs contractor rate, punch capture | **G** |
| 23.2.4 | Canteen **payroll recovery** + vendor reconciliation + consumption reports | **G** |
| 23.2.5 | **Transport**: route/stop master, seat allocation, shift-aligned trips, boarding scan | **G** |
| 23.2.6 | Transport recovery/subsidy in payroll; **night-shift women transport evidence** | **G** |
| 23.2.7 | Company accommodation / quarters allotment + recovery + exit clearance | **G** |
| 23.2.8 | Material gate pass linkage (returnable / non-returnable) | **G** |

### 23.3 EHS / safety
| # | Micro-feature | Status |
|---|---|---|
| 23.3.1 | **Incident / near-miss / accident report** (mobile, photo, location, severity) | **G** |
| 23.3.2 | Investigation + root cause + **CAPA with owner and due date** | **G** |
| 23.3.3 | **Accident register (Form 23-style) + statutory reporting to the Inspectorate** | **G** |
| 23.3.4 | Safety metrics: TRIR / LTIFR / DART / severity rate / near-miss ratio, per plant & contractor | **G** |
| 23.3.5 | **Permit to work**: hot work, confined space, height, electrical — issue/approve/gas reading/close | **G** |
| 23.3.6 | Safety induction & refresher records (employee + contractor + visitor) | **G** |
| 23.3.7 | PPE entitlement + issue + inspection + expiry | **G** |
| 23.3.8 | Safety observation / unsafe-act reporting with recognition | **G** |
| 23.3.9 | Emergency mustering / headcount roll-call from live attendance | **G** |
| 23.3.10 | **Annual health check-up campaign + occupational health record** (OSH Code) | **G** |

### 23.4 Industrial relations & discipline
| # | Micro-feature | Status |
|---|---|---|
| 23.4.1 | **Standing orders** (certified text, display, version) as the basis for misconduct grounds | **G** |
| 23.4.2 | **Misconduct log → show-cause notice → explanation → charge sheet** | **P** — one clause in 04 |
| 23.4.3 | **Domestic enquiry**: enquiry officer, witnesses, hearings, findings, report | **G** |
| 23.4.4 | **Suspension with subsistence allowance** flowing to payroll | **G** |
| 23.4.5 | Punishment order (warning / fine / withholding increment / demotion / dismissal) + letter + appeal | **G** |
| 23.4.6 | Disciplinary case file with full timeline + document set (litigation-ready) | **G** |
| 23.4.7 | Union register, office bearers, charter of demands, **long-term settlement terms → payroll effect** | **G** |
| 23.4.8 | Absenteeism → disciplinary bridge (existing absence cases feed the case file) | **P** — ATT-10 exists |

### 23.5 POSH, grievance & whistleblower
| # | Micro-feature | Status |
|---|---|---|
| 23.5.1 | **Internal Committee constitution per location** (≥4 members, ≥50% women, external member, 3-year term, expiry alerts) | **G** |
| 23.5.2 | **Confidential complaint intake** (not the normal helpdesk), restricted visibility to IC only | **G** |
| 23.5.3 | **90-day inquiry clock** with milestone reminders | **G** |
| 23.5.4 | Interim relief actions (transfer, leave, work-separation) recorded | **G** |
| 23.5.5 | Inquiry record, findings, recommendation, employer action, appeal | **G** |
| 23.5.6 | **Annual report to District Officer by 31 January** (auto-compiled, including "nil" years) | **G** |
| 23.5.7 | **POSH training coverage report** (who is trained, when, in which language) | **G** |
| 23.5.8 | **Grievance redressal committee** + case flow + escalation | **G** |
| 23.5.9 | **Whistleblower / ethics channel**: anonymous, protected disclosure, investigation file, retaliation flag | **G** |
| 23.5.10 | Sealed-record retention with restricted access + audit | **G** |

## 24. Notifications & channels (M6)

| # | Micro-feature | Status | Note |
|---|---|---|---|
| 24.1 | Event subscription model — recipients are **data**, not code | **B** | `wf.event_subscriptions`, `enqueueEvent` |
| 24.2 | `notified_at` receipt per workflow step | **B** | flagship control |
| 24.3 | Email delivery + queue + dead letters | **B**/**P** | notifications module; DLQ view is it_admin nav (08) |
| 24.4 | In-app notification centre | **P** | |
| 24.5 | Digest / daily summary emails (boarding-exit at 07:00) | **B** | LC-03 |
| 24.6 | **Mobile push** | **G** | → C10 |
| 24.7 | **WhatsApp Business API** | **P** | one mention in 04 → C11 |
| 24.8 | **SMS fallback** | **G** | → C11 |
| 24.9 | Teams / Slack connector | **G** | |
| 24.10 | Per-user notification preferences + quiet hours | **G** | |
| 24.11 | Template management with localisation | **P** | |
| 24.12 | Delivery-failure visibility to the sender ("this approver's email bounced") | **P** | |

## 25. Reports, dashboards & analytics (M7)

| # | Micro-feature | Status | Note |
|---|---|---|---|
| 25.1 | Muster (R1) build/list/export with RM, e-code, cost centre, dept columns | **B** | PP-5/8/15/25 |
| 25.2 | R2–R6 + exports (attendance/AR/OD/absence family) | **B** | |
| 25.3 | R24, R27 + exports | **B** | |
| 25.4 | R7–R23, R25–R26, R28–R31 | **S** | 22 reports remaining |
| 25.5 | HR dashboard | **B** | `hrDashboard` |
| 25.6 | Business-unit / plant dashboard | **B** | `businessUnit` |
| 25.7 | Executive/CEO KPIs + trend from precomputed snapshots | **B** | `executiveKpis`, `kpi_daily` |
| 25.8 | ESS + my-attendance + team-grid views | **B** | |
| 25.9 | Every KPI tile links to its underlying list (explainable numbers) | **S** | rule #7 |
| 25.10 | **Ad-hoc report builder** (pick fields, filter, group, save) | **G** | → C15 |
| 25.11 | **Saved views per user + shared views** | **G** | → C15 |
| 25.12 | **Scheduled report subscriptions** ("email me R6 every Monday 07:00") | **G** | → C15 |
| 25.13 | Export to Excel / PDF / CSV with the same numbers as the screen | **B** | |
| 25.14 | **Data dictionary / metric definitions** so two dashboards can't disagree on "headcount" | **G** | → E27 |
| 25.15 | Drill-down from aggregate to row level with scope enforcement | **P** | |
| 25.16 | Reporting reads isolated from OLTP (replica-ready), precomputed snapshots | **B**/**S** | rule #9 |
| 25.17 | Market-standard KPI set: attrition (voluntary/involuntary, new-hire 3/6/12mo), absenteeism %, OT hours & cost, span of control, cost per hire, time to fill, headcount by category/entity/cost-centre, manpower cost | **P** | RPT-03 has several; hiring metrics need ATS |
| 25.18 | **Budget vs actual headcount and manpower cost** | **G** | → B08 |
| 25.19 | **Attrition prediction / flight-risk model** | **G** | → C20 |
| 25.20 | Report access fully scope-aware (S/P/O scoping enforced in every report) | **B** | |

## 26. Integrations & APIs

| # | Micro-feature | Status | Note |
|---|---|---|---|
| 26.1 | oRPC procedures with zod input **and** output, OpenAPI generated | **B** | CORE-10 |
| 26.2 | Frontend client generated from OpenAPI | **B** | |
| 26.3 | Kent biometric connector behind an interface, with mock | **B** | |
| 26.4 | Sync watermark + job queue + dead-letter visibility | **B**/**P** | |
| 26.5 | **SAP posting (payroll JV, cost centres, vendor)** | **S** | → E15 |
| 26.6 | ATS integration (read offers/recruitment for R21/R22) then absorption | **S** | Phase 4 |
| 26.7 | Travel-booking connector (MakeMyTrip Corporate) behind an interface | **S** | TE-03 |
| 26.8 | **Outbound webhooks with retry, signing, replay** | **G** | → C06 |
| 26.9 | **Service accounts / API keys / scoped machine permissions** | **G** | → C06 |
| 26.10 | **Idempotency-key contract on write endpoints** | **G** | → C06 |
| 26.11 | Bank API / bank-file exchange per entity | **P** | → E14 |
| 26.12 | Insurer / TPA file exchange | **G** | → B06 |
| 26.13 | Email (SMTP) + BSP (WhatsApp) + SMS gateway adapters | **P** | |
| 26.14 | Integration health dashboard for it_admin | **B** | `devices`, watermarks |
| 26.15 | S3-compatible object storage adapter (SeaweedFS) | **S** | 14 |

## 27. Administration & configuration

| # | Micro-feature | Status | Note |
|---|---|---|---|
| 27.1 | `core.settings` for **every** policy number, typed get/set, audited | **B** | `settings.get/list/set` |
| 27.2 | Setting scope: global / entity / plant / grade | **P** | |
| 27.3 | Setting change history + effective dates + who changed it | **B** | audited |
| 27.4 | Workflow definition seeding + runtime edit by hr_head | **B**/**P** | seeds built; builder UI → E21 |
| 27.5 | RBAC admin API (grant/revoke/assign) with next-request effect | **B** | |
| 27.6 | Entity / org-unit / cost-centre / location masters | **B** | |
| 27.7 | **Per-entity branding on letters, payslips, portal** (14 legal entities) | **P** | |
| 27.8 | **Per-entity statutory registration numbers** | **G** | → A24 |
| 27.9 | Per-entity approval matrices | **B** | chains are entity-agnostic by design |
| 27.10 | **Config promotion dev→prod** (settings, chains, templates) | **G** | → C17 |
| 27.11 | **Sandbox / UAT tenant with masked production data** | **G** | → C17 |
| 27.12 | Feature flags / phased rollout per entity | **G** | |
| 27.13 | In-app contextual help + teaching empty states + role quick-guides | **S** | CORE-14 |
| 27.14 | System health endpoint + job monitoring | **B** | `system.health` |
| 27.15 | Backup / PITR / restore drill | **S** | NFR-05 |
| 27.16 | **Archival of exited-employee data + restore path** | **G** | → C25 |

## 28. AI capabilities — no position recorded anywhere

| # | Micro-feature | Status | Note |
|---|---|---|---|
| 28.1 | **Anomaly detection** on payroll & attendance (outlier net pay, impossible punches, duplicate bank accounts, ghost workers) | **G** | → C19 — **highest-ROI first build** |
| 28.2 | **HR copilot / assistant** over policies + own data | **G** | → C18 |
| 28.3 | Payslip explainer ("why is my net lower?") | **G** | → C18 |
| 28.4 | Ticket auto-triage + suggested KB answer | **G** | → C21 |
| 28.5 | Attrition / flight-risk prediction | **G** | → C20 |
| 28.6 | Resume screening & candidate matching | **G** | → B07 |
| 28.7 | Document data extraction (OCR on bills, certificates, IDs) | **G** | → 13.15 |
| 28.8 | **AI governance position + employee disclosure** | **G** | → C22 |

---

# PART 2 — ROLE-BY-ROLE CAPABILITY MATRIX

What each role needs to do their whole job. `✓` = available (built or specced), **bold** = gap.

## 29. Existing roles (docs 08 §1)

### 29.1 `employee` — ESS
✓ own profile view · own attendance + swipe history · apply AR / OD / permission / comp-off · OT visibility ·
leave balance + apply + cancel + encash + ledger · restricted-holiday pick · policy acknowledgement · announcements ·
polls · helpdesk raise + track · own letters · own assets held · request timeline.
Specced: payslip + Form 16 + investment declaration + claims + loans + travel + wallet + resignation + alumni mode.
**Gaps:** self-service **profile-change request** (2.20) · **document vault + upload** (3.6) · **statutory nomination forms**
(10.15) · **privacy notice + consent + rights request** (11.1–11.3) · **"who accessed my record"** (1.23) ·
**mobile app + offline punch + push** (5.26, C08–C10) · **local-language UI** (C12) · **KB self-help** (21.7) ·
**confidential channel for POSH/grievance/whistleblowing** (23.5.2, 23.5.9) · **recognition & wellness** (20.7, 20.9) ·
**exit interview** (15.16) · **benefit enrolment & statement** (14.2, 14.8) · **training record & certificate expiry** (18.2).

### 29.2 `manager` / `senior_manager` — MSS
✓ team month-grid · roster editor · approvals inbox with SLA pills · leave/AR/OD/OT decisions · muster export (subtree) ·
team attendance/absence view · delegation · escalations received.
**Gaps:** **team leave planner with coverage rules** (7.15) · **shift-swap approvals** (6.8) · **fatigue/OT-cap warnings
at roster time** (6.9, 5.10) · **approve from email/push** (8.14) · **bulk approve across types** (8.15) ·
**chain preview** (8.18) · **team skills/training-expiry view** (18.1, 18.7) · **goal setting / reviews / confirmation
appraisal** (17.x) · **increment proposal worksheet** (19.3) · **raise a manpower requisition** (16.1) ·
**disciplinary initiation (show-cause)** (23.4.2) · **team budget vs actual headcount** (25.18) ·
**exit-interview visibility & handover checklist** (15.16–15.17).

### 29.3 `hr_ops`
✓ directory + master edit (scoped) · attendance ops (muster, exceptions, device health, month-lock checklist) ·
manual override · leave admin (types, balances, adjustments) · letters issue · policies publish + nag + ack report ·
assets manage · engagement publish · helpdesk agent · absence cases + show-cause letters · reports (scoped).
Specced: onboarding board · probation board · separation pipeline · claims verify.
**Gaps:** **document vault + mandatory-doc checklist + expiry** (3.6–3.7) · **appointment-letter coverage** (3.5) ·
**statutory forms coverage** (10.15) · **compliance calendar** (10.17) · **registers Form 12/15/22** (10.18) ·
**bulk edit with dry-run** (2.18, C16) · **ad-hoc report builder + scheduled subscriptions** (25.10–25.12) ·
**exit interview + attrition taxonomy** (15.16) · **onboarding buddy/30-60-90** (15.7) · **survey module** (20.4) ·
**KB authoring** (21.7) · **grievance & POSH case handling** (23.5) · **training matrix** (18.1).

### 29.4 `hr_head`
✓ everything hr_ops company-wide · approvals of record (confirmation, separation, offers) · HR policy settings ·
audit view (scoped) · workflow chain configuration (in principle).
**Gaps:** **no-code chain builder** (8.11) · **conditional routing** (8.12) · **compensation cycle ownership** (19.2–19.5) ·
**performance cycle ownership** (17.x) · **POSH/IC oversight + annual report** (23.5.6) · **statutory registration &
licence master** (10.16) · **compliance dashboard & audit evidence pack** (10.23) · **access recertification** (1.25) ·
**headcount budget approval** (25.18).

### 29.5 `payroll_admin`
Specced: run stepper · inputs · review grid · outputs (bank/JV/statutory) · salary structures · loans · claims batch ·
declaration verification · statutory calendar · payroll reports · unmasked statutory IDs.
**Gaps:** **wage-definition conformance check** (9.2) · **variance-vs-prior-month control** (9.12) · **input-freeze
calendar** (9.9) · **salary hold/release** (9.18) · **off-cycle run type** (9.17) · **bank payment-status
reconciliation** (9.22) · **SAP JV posting status/re-post** (9.23) · **regime election lock** (10.6) ·
**Form 16 bulk signing** (10.11) · **Form 12BA perquisites** (10.8) · **F&F 48h SLA clock** (9.31) ·
**FTE gratuity at 1 year** (9.32) · **MFA/step-up before finalize** (1.7–1.8) · **sandbox to rehearse in** (27.11).

### 29.6 `plant_head`
✓ plant dashboard · plant muster (read/export) · absence cases (plant) · BU reports · daily boarding/exit email.
**Gaps:** **manpower deployment vs plan + shortfall alerts** (6.11) · **contract-labour headcount & compliance
dashboard** (23.1.13) · **safety metrics TRIR/LTIFR + incident queue** (23.3.4) · **OT statutory-cap exposure**
(5.10) · **gate/canteen/transport operational views** (23.2) · **disciplinary pipeline for the plant** (23.4) ·
**training/licence expiry for critical roles** (18.2) · **budget vs actual headcount for the plant** (25.18).

### 29.7 `ceo_cell` / CEO
✓ executive dashboard from precomputed snapshots · trend · offer approvals (CEO stage) · read-only reports ·
aggregate-only compensation.
**Gaps:** **budget vs actual headcount & manpower cost** (25.18) · **attrition drivers from exit interviews** (15.16) ·
**flight-risk model** (25.19) · **compliance/risk tile** (10.17, 23.3.4) · **contract-labour headcount** (23.1) ·
**engagement/eNPS trend** (20.5) · **scheduled executive digest** (25.12).

### 29.8 `it_admin`
✓ users & roles · device health · integrations & watermarks · technical settings · audit log · helpdesk (IT category) ·
onboarding IT task queue · **never** compensation.
**Gaps:** **SSO/SCIM administration** (1.9–1.10) · **MFA enrolment management** (1.7) · **session/device revoke**
(1.11) · **IP allow-list config** (1.13) · **API key / service-account management** (26.9) · **webhook management**
(26.8) · **sandbox & config promotion** (27.10–27.11) · **feature flags** (27.12) · **archival/restore ops** (27.16).

### 29.9 `super_admin`
✓ everything it_admin + role grants + all settings + payroll unlock + full audit; all actions audited.
**Gaps:** **break-glass workflow with mandatory reason** (1.24) · **quarterly access recertification tooling** (1.25) ·
**audit-chain verification alerting** (currently on-demand `audit.verify`).

## 30. Roles that do not exist yet but the gaps require

| Proposed role | Why | Key permissions it would hold |
|---|---|---|
| `compliance_officer` | Owns registers, returns, licences, compliance calendar, audit evidence | `compliance.*`, register generation, licence master, read-only across entities |
| `dpo` / privacy officer | DPDP: notices, consents, rights requests, breach register, processor DPAs | `privacy.*`, purpose-stamped access-log review, purge approval |
| `posh_ic_member` | POSH Internal Committee — **must not** be an HR-wide role | `posh.case.*` on assigned cases only; sealed-record access |
| `safety_officer` | EHS incidents, CAPA, permits, inductions, accident register | `ehs.*` scoped to plant |
| `contractor_admin` | Internal owner of contractors, licences, work orders, billing gate | `clms.*` scoped to plant/entity |
| `contractor_supervisor` | **External** user: submit worker enrolments, view own workers' attendance | narrowly scoped `clms.own.*`; no employee data |
| `ic_external_member` | POSH external member (non-employee) with case-only access | time-boxed, case-scoped |

---

# PART 3 — CROSS-CUTTING MICRO-FEATURES (apply to every screen)

| # | Requirement | Status |
|---|---|---|
| 31.1 | Warm Editorial design language only; compose from `frontend/src/ui`; never invent a primitive | **B** (05 §0.1 firewall) |
| 31.2 | All 7 interactive states on every control | **S** |
| 31.3 | Zero hardcoded hex — tokens / `color-mix` only | **B** |
| 31.4 | Contrast ≥ 4.5:1 in **both** themes; colour never the only signal | **S** |
| 31.5 | Keyboard-complete with visible focus; reduced-motion respected | **S** |
| 31.6 | **WCAG 2.2 AA audit evidence as a gate artefact** | **G** → C24 |
| 31.7 | ≤2-click daily actions; state preservation across navigation; form autosave (kill-list, 05 §6) | **S** |
| 31.8 | Teaching empty states + in-app contextual help | **S** CORE-14 |
| 31.9 | INR lakh/crore grouping, IST, `DD MMM YYYY` | **B** |
| 31.10 | **Localised UI strings (Hindi / Odia / Bengali)** | **X→revisit** → C12 |
| 31.11 | Responsive desktop-first, functional on tablet/phone | **S** |
| 31.12 | Every list: filter + sort + facet + export + pagination + scope enforcement | **B** (where built) |
| 31.13 | Every mutation: audited, with before/after and actor | **B** |
| 31.14 | Every money field: integer paise, one rounding policy, `NUMERIC` in DB | **S** |
| 31.15 | Every date/money invariant expressed as a DB `CHECK`; FKs always; temporal `EXCLUDE` on effective-dated rows | **S** |
| 31.16 | Every big table partitioned; no full-table live aggregation on a hot path | **B** |
| 31.17 | Every request type: SLA, escalation, `notified_at`, send-back | **B** |
| 31.18 | Every policy number in `core.settings` — zero hardcoded policy values | **B** |
| 31.19 | Every procedure declares exactly one permission code; roles live in the DB | **B** |
| 31.20 | Every report/KPI links to its underlying rows | **S** |

---

# PART 4 — COVERAGE SUMMARY

| Area | Rows | B | S | P | G | X |
|---|---|---|---|---|---|---|
| Identity & security (§1) | 28 | 11 | 3 | 4 | 10 | 0 |
| Core HR (§2) | 26 | 11 | 4 | 7 | 4 | 0 |
| Documents & e-sign (§3) | 12 | 4 | 1 | 0 | 7 | 0 |
| Policies (§4) | 8 | 4 | 0 | 2 | 1 | 1 |
| Attendance (§5) | 30 | 20 | 2 | 3 | 5 | 0 |
| Shift & roster (§6) | 13 | 6 | 0 | 2 | 5 | 0 |
| Leave (§7) | 20 | 10 | 2 | 4 | 4 | 0 |
| Workflow (§8) | 19 | 11 | 1 | 4 | 3 | 0 |
| Payroll (§9) | 32 | 0 | 23 | 6 | 3 | 0 |
| Statutory (§10) | 23 | 0 | 11 | 5 | 7 | 0 |
| Privacy/DPDP (§11) | 12 | 0 | 0 | 1 | 11 | 0 |
| Loans (§12) | 10 | 0 | 9 | 0 | 1 | 0 |
| Claims & T&E (§13) | 20 | 0 | 14 | 1 | 5 | 0 |
| Benefits (§14) | 9 | 0 | 0 | 1 | 8 | 0 |
| Lifecycle (§15) | 22 | 1 | 11 | 4 | 6 | 0 |
| Recruitment (§16) | 15 | 0 | 2 | 6 | 7 | 0 |
| Performance (§17) | 13 | 0 | 0 | 0 | 0 | 13 |
| Learning & skills (§18) | 10 | 0 | 0 | 0 | 2 | 8 |
| Compensation (§19) | 9 | 0 | 1 | 2 | 6 | 0 |
| Engagement (§20) | 13 | 4 | 1 | 2 | 5 | 1 |
| Helpdesk (§21) | 12 | 5 | 1 | 1 | 5 | 0 |
| Assets (§22) | 11 | 6 | 0 | 1 | 4 | 0 |
| Plant ops (§23) | 49 | 0 | 0 | 2 | 47 | 0 |
| Notifications (§24) | 12 | 3 | 0 | 5 | 4 | 0 |
| Reports & analytics (§25) | 20 | 10 | 3 | 3 | 4 | 0 |
| Integrations (§26) | 15 | 5 | 4 | 3 | 3 | 0 |
| Administration (§27) | 16 | 7 | 3 | 2 | 4 | 0 |
| AI (§28) | 8 | 0 | 0 | 0 | 8 | 0 |
| Cross-cutting (§31) | 20 | 8 | 10 | 0 | 1 | 1 |
| **Total** | **~507** | **126** | **106** | **71** | **180** | **24** |

**Read it this way:** ~25% built (126), ~21% specced-and-scheduled (106), ~14% partially specified (71),
**~36% (180 rows) not written down anywhere before this audit**, ~5% deliberately excluded (24).

The unwritten 180 concentrate in three places:

| Where | Gap rows | What it is |
|---|---|---|
| **Plant operations** (§23) | 47 | contract labour, gate/canteen/transport, EHS, IR & discipline, POSH/grievance |
| **Platform: identity, integration, admin, AI** (§1, §26, §27, §28) | 25 | SSO/MFA/SCIM, service accounts & webhooks, sandbox, the whole AI question |
| **Compliance & privacy** (§10, §11) | 18 | statutory registers, licence master, and the entire DPDP surface |

The remaining ~90 are spread thinly across documents/e-sign (7), benefits (8), recruitment (7), lifecycle (6),
compensation (6), engagement (5), helpdesk (5), claims/T&E (5) and shift/leave/attendance depth (14).

That distribution is exactly the shape doc 15 §2 describes: **a well-built office-HRMS core sitting inside a
manufacturing group that also needs a compliance system and a frontline system.**
