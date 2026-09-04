# Extended Roadmap — Phases 5–8 (closing the doc-15 gap register)

**Status:** proposed, awaiting sponsor sign-off on decisions **D8–D14** (docs/15 §9.3 + foreign-entity local payroll).
**Source of truth:** [`docs/15-FEATURE-GAP-AUDIT.md`](../docs/15-FEATURE-GAP-AUDIT.md) (116 gap IDs) and
[`docs/16-MICROFEATURE-INVENTORY.md`](../docs/16-MICROFEATURE-INVENTORY.md) (~507 capability rows).

> **This file is the architecture of the extension.** It defines the *shared* decisions — new requirement-ID
> prefixes, new DB schemas, new roles/permissions, **where every new surface sits in the navigation**, the
> cross-cutting UX contract, and the test program — so the four phase files below can be pure execution.
>
> Read this first. Then the phase file you are working in.

| Phase file | Scope | Duration | Gate | Sequencing |
|---|---|---|---|---|
| [phase-5-compliance-and-trust.md](phase-5-compliance-and-trust.md) | Labour Codes, DPDP, POSH/grievance, statutory registers, licences, identity hardening, document vault + e-sign, sandbox | 7–9 wk | **G5** | **Stages 5.1–5.4 must land BEFORE Phase 2 payroll starts** |
| [phase-6-plant-operations.md](phase-6-plant-operations.md) | Contract labour (CLRA), gate pass, canteen, transport, PPE, EHS/safety, IR & discipline | 9–11 wk | **G6** | after G2 (payroll) — canteen/transport recover through payroll |
| [phase-7-talent-and-growth.md](phase-7-talent-and-growth.md) | Performance, training matrix & skills, compensation review, benefits admin, recruitment depth, exit intelligence | 8–10 wk | **G7** | after G3 (lifecycle) |
| [phase-8-frontline-and-intelligence.md](phase-8-frontline-and-intelligence.md) | Native mobile + offline punch, push/WhatsApp/SMS, multi-language, report builder, integrations platform, AI | 7–9 wk | **G8** | after G6 (needs plant surfaces to be worth putting on a phone) |
| [amendments-existing-phases.md](amendments-existing-phases.md) | The 30 **E-register** depth gaps folded into Phases 1–4 where they belong | inline | existing gates | continuous |

---

## 0. Why this order (and the one hard constraint)

```
G1 ✅ ──► 5.1 Labour-Codes conformance ──┐
         5.2 Identity hardening         ├──► G5a ──► Phase 2 Payroll ──► G2 ──► Phase 3 ──► G3 ──┬─► Phase 7 Talent ──► G7
         5.3 DPDP baseline              │                                                        │
         5.4 Sandbox + doc vault + eSign┘                                                        │
                                                                                                 │
         5.5 POSH/grievance ─ 5.6 registers ─ 5.7 licences+calendar ──► G5b ───────────────► Phase 6 Plant Ops ──► G6 ──► Phase 8
```

**The hard constraint:** *five* things must exist before a single line of money code is written —
(1) the wage-definition rule, (2) MFA + step-up on privileged roles, (3) the retention/consent baseline,
(4) a masked **sandbox** to rehearse payroll in, (5) the F&F 48-hour clock definition. Retrofitting any of these
into a live payroll is an order of magnitude more expensive, and two of them (1, 5) change the engine's arithmetic.
This is why Phase 5 is split into **G5a (blocking)** and **G5b (parallelisable)**.

Everything else in Phases 6–8 is genuinely additive and can be re-ordered by business priority.

---

## 1. New requirement-ID prefixes

Promoted into `docs/01-REQUIREMENTS-PRD` at the start of each phase. Every PR title cites one.

| Prefix | Domain | Phase | Range |
|---|---|---|---|
| `SEC-` | Identity, authentication, session, API security, **SCIM** | 5 | SEC-01..15 |
| `PRV-` | Data protection / DPDP operations | 5 | PRV-01..12 |
| `CMP-` | Statutory registers, licences, compliance calendar, Labour Codes | 5 | CMP-01..20 |
| `PSH-` | POSH / Internal Committee | 5 | PSH-01..10 |
| `GRV-` | Grievance & whistleblower | 5 | GRV-01..06 |
| `DOC-` | Document vault & e-signature | 5 | DOC-01..09 |
| `CLB-` | Contract labour (CLRA / CLMS) | 6 | CLB-01..16 |
| `FAC-` | Facilities: gate pass, visitor, canteen, transport, quarters, **ID card** | 6 | FAC-01..15 |
| `EHS-` | Safety, incidents, permits, occupational health | 6 | EHS-01..12 |
| `IRD-` | Industrial relations & discipline | 6 | IRD-01..10 |
| `PMS-` | Performance management | 7 | PMS-01..14 |
| `LRN-` | Learning, training matrix, skills | 7 | LRN-01..11 |
| `CMR-` | Compensation review / merit cycle | 7 | CMR-01..09 |
| `BEN-` | Benefits administration | 7 | BEN-01..10 |
| `REC-` | Recruitment depth (MRF, BGV, scorecards, **workforce scenarios**) | 7 | REC-01..13 |
| `FRT-` | Frontline: mobile, offline, channels, localisation | 8 | FRT-01..17 |
| `PLT-` | Platform: API, webhooks, report builder, sandbox ops | 8 | PLT-01..15 |
| `AIX-` | AI capabilities + governance | 8 | AIX-01..14 |
| `ORG-` | Company / plant / MIS / department spine | 2.0 | ORG-01..08 |
| `SHF-` | Shift micro-controls, scheduling, chain preview | 1.11 | SHF-01..16 |
| `FGN-` | Foreign-entity local payroll / WPS (**needs D14**) | 2.8 | FGN-01..08 |
| `ESS-` | Daily ESS: password reset, profile-change, custom fields | 5.8 | ESS-01..03 |
| `ENG-` | R&R, eNPS, birthdays, EAP, education history | 7.8 | ENG-01..05 |
| `NAP-` | NAPS/NATS apprentice register | 6.8 | NAP-01..04 |
| `FAT-` | Fatigue rules at roster save | 6.8 | FAT-01 |
| `PAY-` | Payroll completeness (holds, off-cycle, MIS registers, loan life-cycle) | 2.7 | PAY-18..24 |

---

## 2. New database schemas

Schema-per-module mirrors the backend module boundary (CLAUDE.md §2). Every new table follows the house rules:
`NOT NULL` by default, `CHECK` on every money/date invariant, FK always, temporal `EXCLUDE USING gist` on
effective-dated rows, append-only trigger on anything ledger- or evidence-shaped, monthly partitioning on
anything time-series, and `core/db/types.ts` updated **in the same commit as the migration**.

| Schema | Owns | Append-only tables |
|---|---|---|
| `sec` | sessions, MFA enrolments, API keys, IP rules, access reviews | `sec.access_events` |
| `prv` | privacy notices, consents, rights requests, retention rules, purge runs, processors/DPAs, breach register | `prv.consent_events`, `prv.purge_log`, `prv.breach_register` |
| `cmp` | statutory registrations & licences, compliance calendar, register definitions & generated registers, Labour-Code conformance checks | `cmp.register_runs`, `cmp.filing_evidence` |
| `psh` | IC constitution, cases, hearings, findings, annual returns — **isolated, restricted, sealed** | all of it |
| `grv` | grievances, whistleblower disclosures, investigations | all of it |
| `doc` | document types, employee documents, expiry rules, e-sign envelopes | `doc.esign_events` |
| `fac` | gate passes, visitors, canteen meals, transport routes/allocations, quarters | `fac.meal_punches`, `fac.gate_events` |
| `ehs` | incidents, investigations, CAPA, permits, inductions, health checks, PPE issues | `ehs.incident_events` |
| `ird` | standing orders, misconduct, notices, enquiries, punishments, unions, settlements | `ird.case_events` |
| `pms` | goal cycles, goals, reviews, feedback, competencies, calibration | `pms.rating_history` |
| `lrn` | training catalog, matrix, sessions, records, certifications, skills | `lrn.training_records` |
| `cmr` | comp cycles, budgets, proposals, approvals, letters | `cmr.proposal_history` |
| `ben` | benefit plans, enrolments, dependants, insurer files, NPS/superannuation | `ben.enrolment_events` |
| `rec` | requisitions, JDs, candidates, interviews, scorecards, offers, BGV | `rec.stage_events` |

**Payroll touchpoints** (these are the interfaces, do not invent others): canteen recovery, transport recovery,
loan/advance EMI, travel settlement recovery, disciplinary fine/suspension subsistence, comp-review revised
structures, benefit deductions — **all** arrive as rows in the existing payroll *input* tables, never as direct
writes to a payroll run.

---

## 3. New roles & permission codes

Roles are **data** (`core.roles` / `core.role_permissions`), added to `core/rbac/seed-data.ts` + `npm run seed:rbac`.
Every business procedure still declares exactly **one** permission code. No handler ever checks a role.

| Role code | Charter | Scope | Notably CANNOT |
|---|---|---|---|
| `compliance_officer` | Registers, returns, licences, calendar, audit evidence | all entities, read-across | edit employee master; see salaries |
| `dpo` | DPDP: notices, consents, rights requests, breach, processors, purge approval | all entities | approve their own purge (two-person) |
| `posh_ic_member` | POSH cases assigned to their IC | **case-scoped only** | see any case they are not on; see HR data beyond the parties |
| `ic_external_member` | External IC member (non-employee), time-boxed | single case | anything outside the case file |
| `grievance_officer` | Grievance + whistleblower intake and investigation | entity | see POSH cases |
| `safety_officer` | EHS incidents, CAPA, permits, inductions, health checks | plant | payroll, compensation |
| `training_admin` | Training matrix, sessions, certifications | entity | performance ratings |
| `comp_admin` | Merit cycle administration | entity | run payroll; approve own increment |

### New permission codes (one per business procedure)

```
sec.mfa.manage · sec.session.revoke · sec.apikey.manage · sec.access_review
prv.notice.manage · prv.consent.read · prv.rights.handle · prv.retention.manage · prv.breach.manage
cmp.register.generate · cmp.licence.manage · cmp.calendar.manage · cmp.evidence.upload
psh.case.own · psh.case.manage · psh.ic.manage · psh.return.file
grv.case.raise · grv.case.handle
doc.vault.own · doc.vault.manage · doc.esign.send
fac.gate.manage · fac.visitor.manage · fac.canteen.manage · fac.transport.manage
ehs.incident.raise · ehs.incident.investigate · ehs.permit.issue · ehs.health.manage
ird.case.initiate · ird.case.manage · ird.enquiry.conduct · ird.union.manage
pms.goal.own · pms.review.manage · pms.calibrate
lrn.matrix.manage · lrn.record.manage · lrn.own
cmr.cycle.manage · cmr.propose · cmr.approve
ben.plan.manage · ben.enrol.own
rec.requisition.raise · rec.requisition.approve · rec.pipeline.manage · rec.bgv.manage
plt.report.build · plt.webhook.manage · aix.assist.use · aix.governance.manage
```

**Two-person rules to seed** (mirroring the existing payroll finalize rule):
purge execution (`dpo` proposes + `super_admin` confirms) · contractor invoice release (`contractor_admin` +
`payroll_admin`) · POSH case closure (IC quorum, not a single member) · merit-cycle publish (`comp_admin` + `hr_head`).

---

## 4. Navigation architecture — where every new surface lives

**The constraint that governs everything:** `frontend/src/app/nav-config.ts` caps the centre pill strip at
`MAX_PILLS = 8`, and the ops order already lists **9** destinations — `/reports` already falls through to the
More menu. **No new module may be added to `PILL_ORDER`.** Everything lands in the grouped More menu, or in an
existing hub page as a tab.

### 4.1 Existing groups (unchanged) + three new ones

| Group | Today | Phase 5–8 additions |
|---|---|---|
| `People` | People, Letters, Lifecycle, Recruitment | **Discipline** (`/discipline`) |
| `Attendance` | Attendance, Leave | — |
| `Workplace` | Policies, Assets, Helpdesk, Engagement, Travel | **Benefits** (`/benefits`) |
| `Admin` | Users & Roles, Approval chains, Attendance masters, Audit log | **Security** (`/admin/security`), **Integrations** (`/admin/integrations`) |
| **`Compliance`** *(new)* | — | Registers & Returns, Licences, Compliance Calendar, Privacy, Cases |
| **`Plant`** *(new)* | — | Contractors, Gate, Canteen, Transport, Safety |
| **`Talent`** *(new)* | — | Performance, Learning, Compensation |

### 4.2 Route map — every new surface, its permission, its icon, its group

| Route | Label | Group | Permission gate | Icon (Lucide) | Phase |
|---|---|---|---|---|---|
| `/compliance` | Compliance | Compliance | `cmp.register.generate` \| `cmp.calendar.manage` | `ShieldAlert` | 5 |
| `/compliance/registers` | *(tab)* Registers | — | `cmp.register.generate` | — | 5 |
| `/compliance/calendar` | *(tab)* Calendar | — | `cmp.calendar.manage` | — | 5 |
| `/compliance/licences` | *(tab)* Licences | — | `cmp.licence.manage` | — | 5 |
| `/compliance/labour-codes` | *(tab)* Conformance | — | `cmp.register.generate` | — | 5 |
| `/privacy` | Privacy | Compliance | `prv.rights.handle` | `Lock` | 5 |
| `/cases` | Cases | Compliance | `psh.case.own` \| `grv.case.handle` | `Scale` | 5 |
| `/admin/security` | Security | Admin | `sec.mfa.manage` | `KeyRound` | 5 |
| `/documents` | Documents | People | `doc.vault.manage` | `FolderLock` | 5 |
| `/plant/gate` | Gate | Plant | `fac.gate.manage` | `DoorOpen` | 6 |
| `/plant/canteen` | Canteen | Plant | `fac.canteen.manage` | `UtensilsCrossed` | 6 |
| `/plant/transport` | Transport | Plant | `fac.transport.manage` | `Bus` | 6 |
| `/safety` | Safety | Plant | `ehs.incident.investigate` | `TriangleAlert` | 6 |
| `/discipline` | Discipline | People | `ird.case.manage` | `Gavel` | 6 |
| `/performance` | Performance | Talent | `pms.review.manage` | `Target` | 7 |
| `/learning` | Learning | Talent | `lrn.matrix.manage` | `GraduationCap` | 7 |
| `/compensation` | Compensation | Talent | `cmr.cycle.manage` | `TrendingUp` | 7 |
| `/benefits` | Benefits | Workplace | `ben.plan.manage` | `HeartPulse` | 7 |
| `/admin/integrations` | Integrations | Admin | `admin.integrations` | `Plug` | 8 |
| `/reports/builder` | *(tab)* Builder | — | `plt.report.build` | — | 8 |

### 4.3 ESS additions — the employee's own surfaces

ESS pills are `/ · /my/attendance · /my/leave · /my/pay · /my/claims · /helpdesk · /people` (7 of 8). **The
eighth slot is deliberately left empty** so the strip never overflows on a 320px viewport. All ESS additions go
to the More menu, and the *high-frequency* ones surface as **home cards**, not nav items:

| Route | Label | Where it actually gets discovered | Phase |
|---|---|---|---|
| `/my/documents` | My Documents | More menu **+ home card** when a document is missing or expiring | 5 |
| `/my/privacy` | My Privacy | More menu + a permanent link in the account menu | 5 |
| `/my/training` | My Training | More menu **+ home card** when a certification expires in ≤30 days | 7 |
| `/my/goals` | My Goals | More menu **+ home card** during an open review window | 7 |
| `/my/benefits` | My Benefits | More menu **+ home card** during an open enrolment window | 7 |
| `/my/safety` | Report a hazard | **Not a nav item** — a persistent action on the mobile shell | 6 |

**Rule:** a surface that matters only a few times a year is a *home card that appears when it matters* and a More
item the rest of the time. Adding it to the pill strip would push a daily action out. This is the docs/05 §6
micro-frustration kill-list applied to navigation itself.

### 4.4 Mobile (4 thumb tabs, `TAB_ORDER`)

Unchanged: `Home · My Attendance · My Leave · My Pay`. Phase 8 adds a **floating action button** on the mobile
shell whose contents are role-derived: *Punch* (frontline), *Report a hazard* (plant), *Raise a request* (all).
No new tab. Ever.

---

## 5. Cross-cutting UX contract for every new screen

Every screen delivered in Phases 5–8 satisfies this before it is called done. This is docs/05 restated as an
acceptance list, plus four rules the new domains need.

1. **Warm Editorial only.** Compose from `frontend/src/ui`. A new primitive requires a design review and lands in
   `frontend/src/ui` first, never inline in a page.
2. **All 7 interactive states**, zero hardcoded hex, contrast ≥4.5:1 in **both** themes, keyboard-complete,
   visible focus, reduced-motion respected.
3. **≤2 clicks for the daily action**; state preserved across navigation; forms autosave.
4. **Teaching empty state** on every list — what this is, who it's for, the one action to take.
5. **Never fake data.** A surface whose backend lands later renders its real layout plus an honest pending panel
   naming the phase and task (the pattern already established in the Phase-2/3 UI shells).
6. **Every number links to its rows.** No aggregate without a drill-down.
7. *(new)* **Confidentiality is visible.** Any screen that renders restricted content (POSH, grievance,
   whistleblower, health, disciplinary) carries a persistent "restricted — access logged" banner and a visible
   list of who else can see it. No silent privilege.
8. *(new)* **Evidence over assertion.** Compliance screens show the artefact (the generated register, the uploaded
   challan, the signed acknowledgement), never just a green tick.
9. *(new)* **Expiry is a first-class state.** Licences, certificates, medical fitness, gate passes and documents
   render as `valid → expiring (T-30/15/7) → expired → blocked`, with the same colour language everywhere.
10. *(new)* **The blocked action explains itself.** When a rule blocks something (invoice held for a missing
    challan, gate pass refused for lapsed induction, roster refused for an OT-cap breach), the UI names the rule,
    the failing condition, and who can override — never a bare disabled button.

---

## 6. Test program for Phases 5–8

On top of the standing gates (typecheck → lint → knip → dependency-cruiser → unit → integration → golden-master →
Playwright), each new domain carries a **characteristic test class** that is non-negotiable for that domain:

| Domain | Characteristic tests | Why |
|---|---|---|
| Labour Codes (5) | **Golden fixtures** for the wage-definition check and the 48-hour F&F clock, hand-computed; property test: no structure can be saved where basic+DA < 50% | It is arithmetic that changes money |
| DPDP (5) | **Retention property test** (nothing survives its class's retention unless a legal hold exists); rights-request SLA clock test; **negative test: purge cannot run single-handed** | Deletion bugs are unrecoverable |
| POSH / grievance (5) | **Access-control negative tests are the primary suite** — `hr_ops`, `hr_head`, `super_admin` and a non-assigned IC member each get 403 on a case; audit row written on every read | A single leak destroys the process |
| Registers (5) | **Golden-file tests** comparing generated Form 12/15/22 against hand-built expected layouts for a seeded month | An inspector compares layouts, not logic |
| Identity (5) | Step-up required before every salary/statutory-ID read; session revoke takes effect on the next request; API key scope cannot exceed its grant | |
| CLMS integration (6) | Connector contract tests against recorded responses; a stale feed renders as **stale, never as zero**; an incident and a muster line both reference a contract worker with no row in our database | A silently stale contractor headcount during a shutdown is the PP-9 failure repeating |
| Facilities (6) | Canteen/transport recovery reconciles to the rupee against payroll input rows; meal punches are append-only | Money |
| EHS (6) | CAPA overdue escalation fires; accident register completeness; mustering roll-call equals live attendance | Life-safety |
| IR & discipline (6) | Timeline immutability; suspension subsistence reaches payroll; **case file exports complete** (litigation-ready) | Evidence |
| Performance (7) | Calibration audit trail: every adjusted rating has a before/after and an actor; rating→increment hand-off is idempotent | Disputes |
| Learning (7) | Certificate-expiry alerting at T-30/15/7; matrix coverage report matches the record set exactly | Audit evidence |
| Compensation (7) | Budget cannot be exceeded without an explicit override + approver; revised structure re-runs the ≥50% wage check | Money |
| Benefits (7) | Enrolment→insurer file round-trip; deduction reaches payroll input; dependant changes are effective-dated | Money |
| Frontline (8) | **Offline queue property test**: N punches queued offline, arbitrary reconnect order, exactly-once ingestion, no duplicates, no loss | The single riskiest frontline mechanic |
| Platform (8) | Webhook retry/backoff/signature verification; idempotency-key replay returns the original result | |
| AI (8) | **Every AI surface has a deterministic fallback path tested without the model**; no AI output writes to a money or statutory field without human confirmation | |

**E2E journeys added to the Playwright suite** (one per phase gate, each run as the real role):

- **G5:** an employee submits an erasure request → DPO triages → two-person purge → the audit chain still verifies.
- **G5:** an IC member opens a POSH case; `hr_head` attempts the same URL and is refused, and the refusal is audited.
- **G6:** a safety incident is raised against a contract worker who exists only in the CLMS, investigated,
  and closed through CAPA — proving the `external_worker_ref` path end to end.
- **G6:** a supervisor reports a near-miss on a phone → investigation → CAPA assigned → overdue escalation reaches
  the plant head.
- **G7:** a manager sets goals → mid-year review → calibration adjusts a rating with a recorded reason → the
  increment cycle proposes → HR head approves → an increment letter is issued → the revised structure passes the
  wage-definition check.
- **G8:** a frontline user punches offline four times on a phone in airplane mode, reconnects, and sees exactly
  four swipes and one day record.

---

## 7. Gates

| Gate | Signed off by | Criteria |
|---|---|---|
| **G5a** *(blocking Phase 2)* | sponsor + payroll admin + IT | Wage-definition check live · F&F clock defined · MFA enforced on privileged roles · retention & consent baseline live · masked sandbox usable for a payroll rehearsal |
| **G5b** | sponsor + HR head + legal/compliance owner | POSH IC constituted in-system with a real (test) case run end-to-end and access-refusal proven · Form 12/15/22 generated for a real month and accepted by the compliance owner · licence master populated for all 14 entities with expiry alerts firing |
| **G6** | sponsor + plant heads | One contractor taken through licence→worker→gate→muster→wage-verify→challan→invoice with a real block and release · one incident through report→investigation→CAPA→closure · canteen and transport recoveries land in a live payroll run and reconcile |
| **G7** | sponsor + HR head | One full review cycle including calibration · one merit cycle from budget to issued letters to revised structures · training matrix shows real coverage and a real expiry alert · benefits enrolment file accepted by the insurer |
| **G8** | sponsor + a real frontline user group | Offline punching proven on real devices in a real low-signal area · a WhatsApp payslip notification delivered and opened · one AI surface live with its deterministic fallback demonstrated · AI governance note published to employees |
