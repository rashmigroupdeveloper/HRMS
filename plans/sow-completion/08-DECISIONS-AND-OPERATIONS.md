# Decisions, human service duties and release operations

These are unresolved decisions and completion controls, not a request to approve a code diff now. No rates, schema amendments, scopes or phase gates are approved by this file. Independent work can proceed within a current stage; dependent implementation cannot fill a missing decision with an AI assumption. Record decision owner, exact question, evidence, approved answer, effective date, requirement/spec amendment and affected tasks. A chat answer must be captured in the spec/typed setting before it becomes a durable rule.

## Decision register

| ID / owner | Unresolved facts or conflicts | Required decision artifact / blocks |
|---|---|---|
| D01 — Payroll + Legal/compliance + sponsor | Target FY/effective law, entity/jurisdiction eligibility, PF membership/wage basis/ceilings/EPS split/admin-minimum scope, ESIC coverage vs contribution wages including OT, PT/LWF state/site/period applicability, TDS regimes/slabs/deductions/rebate/surcharge/cess/projection, bonus/gratuity eligibility/caps; wage payment deadline vs SOW F&F TAT. Existing docs10 are a baseline, not a verified future statutory update. | Official dated source per rule, applicability opinion, effective policy table, independent approved G1–G10 values and bank/payslip/filing formats. Blocks P03/L05 statutory calculation and compliance release; do not transplant a current website rate into every historical month. |
| D02 — HR attendance/leave owner | ATT-12 implies manager approval before credit; docs04 accrual says gaps flag employees without blocking credit. Leave year, qualifying accrual events and expiry/carry allocation need explicit settings. | Signed accrual readiness/exception behavior and year boundary. Blocks changes to A04 accrual scheduling; existing behavior is not silently changed. |
| D03 — Sponsor + security/HR | One business permission sponsor rule vs existing `authed`/`withAnyPermission` paths; central role grid vs IT sensitive-access exceptions; invitation public access; exited user disable vs alumni login; ownership vs entity/subtree scopes. | Per-procedure single-code map, grants and scope rules, masked fields, narrowly specified invitation access and alumni status. Blocks F03/L01/L05 business authorization completion. Never implement role strings inside handlers. |
| D04 — HR operations + IT | Workflow `notified_at` means queued in current code, while reliability requires notification proof. OT's 48h intimation deadline needs a precise accepted event; SMTP acceptance is not recipient read. Missing/vacant recipient and escalation timing semantics unspecified. | Event receipt state/timestamps, accepted channels, clock-start definition, retries/SLA calendar and responsibility. Blocks F04/A03 notification/SLA release. |
| D05 — Attendance policy owner + Payroll | Split-session FILO-overlap vs actual worked duration; grace/break/minimum-session thresholds; half-day work + paid/unpaid leave; O/mixed session display; paid WO qualifying days and half-day KPI/pay weights. | Real roster/punch/request examples with expected sessions/status/payable units and policy sources. Blocks changed A02/P02/R1/KPI calculations; retain already-fixed stale session clearing. |
| D06 — HR/manager + Payroll | SOW preapproved OT vs post-detection workflow; preapproval evidence and permitted excess; encashment request shrinking balance currently clamps on approval; pay vs CO choice and week-off qualifying interpretation. | Signed preapproval model, cap/expiry/consumption rules and clamp vs send-back/reapproval behavior. Blocks A03/A04 affected flows; approved minutes and actual ledger debit drive pay. |
| D07 — HR data owner + IT/Kent | Effective shift/rotation/flex assignments vs one current row; holiday department vs location; stable raw swipe identity when unmatched; late watermark corrections; transfer history and pending approvals. | Effective-date model and source identity reconciliation design, exact Kent completeness/backfill contract, approved calendar/shift patterns. Blocks A01/A02/L03 migrations and historical recomputation. |
| D08 — Sponsor + HR/report owner | SOW rows113–115 modes conflict with explicit exclusions in source row112; general policy adherence/department calendar; data-driven survey recommendations row194; ad hoc report/commercial row143; F&F communication protocol row222. BU/recruitment templates said to be shared are absent. | Include/exclude disposition per clause; documented algorithm/template if included; responsible manual protocol and future scope boundary. Blocks those optional modes/reports. Scores of zero are not authorization to implement excluded behavior. |
| D09 — HR master/Finance | Exact identifier validation/account lengths, duplicate ESIC scope, entity alias/holding-company disposition, SOW department/designation character stripping vs valid names, e-code policy on legal entity transfer. | Signed normalization/validation/mapping catalog; original values retained in staging; per-field error rules. Blocks F02 real import and L03 e-code treatment; no invented regex or silent substitution. |
| D10 — Payroll/Finance + Legal | Component bases/formula DAG, payroll divisors/proration, mid-month salary segment vs docs04 simplified lookup, payable/NCP rounding; loan flat/diminishing/perquisite policy; hold release and negative-net deduction ordering; flex activation SOW130/132–134; travel wallet credit at approval vs funding, FX precision/conversion, carry/recovery and claim tax treatment. | Named policy setting/table with effective provenance and worked independent examples per path. Blocks money branches P01–P06/L05/T01–T02; hardcoded defaults are forbidden. |
| D11 — Domain owners + DB/security architect | 13 historical migrations missing; 43 historical untyped relations; unique run key cannot model versions/two F&F cycles; claim schema diverges; mutable loan outstanding conflicts with ledger directive; structured survey differs from current pulse; workflow resubmit attempts, effective organization/payroll input provenance, snapshot denominators, helpdesk events, prejoin token security and withdrawal after settlement. | Reconciled table/field/FK/check/unique/temporal/trigger design and approved spec amendment, recovered migration sources, migration/restore plan. Proposed fields in this pack cannot be represented as already existing. Blocks schema-changing dependent work. |
| D12 — Sponsor + source owner | Historical `sec/cmp/prv/ird/doc` and scheduling modules exist in DB evidence, but governing specifications/source migrations are absent; microfeature evidence mentions absent docs16. | Recover actual approved specifications and ownership; classify preserve/adopt/defer/quarantine. Blocks implementing unscoped MFA/privacy/POSH/grievance/document products merely because table names exist. Do not delete historical data to make source and DB match. |

### Statutory source conflicts requiring review

The official ESIC FAQ distinguishes overtime excluded for coverage eligibility from overtime included in contribution wages; doc10's contribution base exclusion needs correction or a documented applicability explanation before code. [ESIC FAQ](https://www.esic.gov.in/attachments/files/faq.pdf).

Code on Wages §17(2) provides a two-working-day wage payment requirement for specified separation events. Legal must verify commencement/applicability and which amounts it governs; the SOW's three-day vendor processing target cannot be assumed to replace it. [Official Code text](https://labour.gov.in/sites/default/files/the_code_on_wages_as_passed_in_lok_sabha.pdf).

These are source conflicts, not this plan asserting all F&F amounts are legally due in two days or that every statutory rule has been verified. Recheck authoritative effective sources at implementation/release, including official PF/ESIC/state/tax portals and signed applicability review. Do not reuse unsupported historical golden expected values as current legal truth.

## M01 — Manual/service duties are part of completion

SOW duties assigned to a vendor are not automatically software capabilities or authorization for Codex to file/remit/contact a third party. The 29 rows classified manual/service remain tracked. Software prepares masked source data, portal-ready files, reminder/assignment and evidence links where specified; designated humans perform government filings, enrollment/corrections/inspections, legal interpretation and external communications. The point ledger below names suggested accountable functions; actual people/provider contracts must be assigned by sponsor.

For each duty record legal entity/period/case, responsible and reviewer, source approval, due date from official policy, deliverable/version checksum, submitted-at, portal acknowledgment/challan/reference, paid amount/date and reconciled ledger/run, unresolved exception and archival retention. This is a **proposed operational evidence contract**, not an assertion a compliance case table/API exists today. If approved, add it through D11; until then use a controlled evidence register with document access restrictions. Do not store portal passwords/OTPs in a plan or automate human statutory filing contrary to docs01 non-goal.

Generated PF/ESIC/PT/LWF/TDS files and bank batches remain pending until validated/submitted/paid evidence is supplied. A receipt upload must be verified against entity/period/amount and cannot mark an unrelated run paid. Corrections retain original return and amendment/version; audit/ledger history is never deleted.

### All 29 manual/service points

| Source point | Suggested accountable function | Required evidence / boundary |
|---|---|---|
| [SOW-125](07-SOW-CROSSWALK.md) | Finance / external lender liaison owner | Honor exclusion: no assumed vendor third-party remittance. Record authorized direct recovery/remittance owner and receipts if sponsor assigns it; P05 only posts approved salary recovery. |
| [SOW-130](07-SOW-CROSSWALK.md) | HR joining / statutory / Payroll | Weekly sanctioned ESIC new-joiner/IP handoff with portal receipt; decide flex activation after first payroll under D10. P01/P06 implement the accepted timing, not this human duty. |
| [SOW-140](07-SOW-CROSSWALK.md) | HR/Finance audit SPOC | Agree audit scope, secure data access, due date and delivery receipt; software export is P04/W04, agreed vendor turnaround remains manual. |
| [SOW-149](07-SOW-CROSSWALK.md) | PF compliance owner | UAN/KYC portal submission and acknowledgment, employee mapping and authorized evidence; never assume generated UAN or OTP automation. |
| [SOW-151](07-SOW-CROSSWALK.md) | PF compliance / Legal | Case/inspection query, authorized response, submitted evidence and closure receipt. |
| [SOW-152](07-SOW-CROSSWALK.md) | PF/EDLI compliance / Legal | Verify correct EDLI form/procedure and applicability before submission; source calls it Form 7IF. Retain case and official acknowledgment. |
| [SOW-153](07-SOW-CROSSWALK.md) | PF compliance / HR exit | Approved LWD/reason from L04 matched to UAN; portal DOL update acknowledgment, not just HRMS employee status. |
| [SOW-154](07-SOW-CROSSWALK.md) | Company statutory owner | Approved ownership details and Form 5A submission/version/acknowledgment. |
| [SOW-155](07-SOW-CROSSWALK.md) | Company statutory owner | Sanctioned establishment change and portal acknowledgment; retain prior registration reference. |
| [SOW-156](07-SOW-CROSSWALK.md) | PF compliance / employee liaison | Authorized joint declaration, supporting documents and submission/outcome record. |
| [SOW-157](07-SOW-CROSSWALK.md) | PF/EDLI compliance / Legal | Authorized death-claim documents, claimant relationship and submission/outcome; restrict sensitive evidence. |
| [SOW-158](07-SOW-CROSSWALK.md) | PF compliance / Legal | Claim rejection reference, reason, reviewed correction/appeal and official resolution. |
| [SOW-159](07-SOW-CROSSWALK.md) | PF compliance / Legal | Notice due date, assigned responder, approved response/evidence and acknowledgment. |
| [SOW-160](07-SOW-CROSSWALK.md) | Legal/statutory policy owner | Track official amendment, effective applicability, reviewed policy/spec/setting update and affected historical/future runs; an AI browser result does not approve a rate. |
| [SOW-162](07-SOW-CROSSWALK.md) | ESIC compliance / HR joining | Authorized IP generation/e-Pehchan issuance, employee mapping and portal evidence. |
| [SOW-164](07-SOW-CROSSWALK.md) | ESIC compliance / Legal | Verify applicable return frequency/procedure; source half-yearly wording is historical. Retain submitted version, audit response and receipt. |
| [SOW-165](07-SOW-CROSSWALK.md) | ESIC compliance / HR | Verified dependent/family changes and portal acknowledgment; own-data permissions and sensitive retention. |
| [SOW-166](07-SOW-CROSSWALK.md) | Finance / ESIC compliance | Client downloads paid challan; verify entity/period/amount/reference against P03 liability and payment, archive evidence. |
| [SOW-167](07-SOW-CROSSWALK.md) | ESIC compliance / HR | Verified name/DOJ/gender correction documents, authorized office submission and official accepted result. |
| [SOW-168](07-SOW-CROSSWALK.md) | Company statutory owner | Approved employer-name/address update and registration/portal acknowledgment. |
| [SOW-171](07-SOW-CROSSWALK.md) | State PT compliance | Applicable enrollment/renewal approval, registration identifiers and receipt. |
| [SOW-172](07-SOW-CROSSWALK.md) | Finance / State PT compliance | Enrollment certificate remittance applicability, payment approval and acknowledged receipt, separate from employee PT deductions. |
| [SOW-173](07-SOW-CROSSWALK.md) | State PT compliance | Enrollment-certificate return applicability/period, reviewed filing and acknowledgment. |
| [SOW-174](07-SOW-CROSSWALK.md) | Finance / company tax owner | Identify jurisdiction/company tax obligation explicitly; do not fold into employee PT deduction by name. Payment evidence and reconciliation. |
| [SOW-175](07-SOW-CROSSWALK.md) | Finance / State PT compliance | Verified remitted/acknowledged challan by entity/period/amount and archived receipt. |
| [SOW-176](07-SOW-CROSSWALK.md) | State PT compliance / Legal | Inspection/notice case, due date, approved response and official acknowledgment. |
| [SOW-179](07-SOW-CROSSWALK.md) | LWF compliance / Legal | Applicable welfare-board inspection/reporting requirement, reviewed response and acknowledgment. |
| [SOW-217](07-SOW-CROSSWALK.md) | HR statutory/Legal helpdesk owner | Route regulatory ticket to authorized human; record reviewed advice/response/evidence; helpdesk does not autonomously decide law. |
| [SOW-229](07-SOW-CROSSWALK.md) | RML F&F SPOC / contracted provider | Source vendor communicates only via SPOC. Record contracted communication protocol; alumni own access remains separate L05/D03 decision. No unsolicited messages to resigned employees. |

## Production readiness and operating sequence

**09 Oct source audit baseline:** [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md) records 37 open code/connection gaps. Frontend verify passed233 tests. Backend static checks and build passed; full verify failed coverage with164 DB tests skipped. These results do not close any gate. Use [11-REQUIREMENT-TO-CODE.md](11-REQUIREMENT-TO-CODE.md) and [12-TRANSACTION-AND-CONNECTION-MAP.md](12-TRANSACTION-AND-CONNECTION-MAP.md) to ensure every requirement, source repair and transaction dependency is included in the selected stage.

1. **Reproduce safely:** recover migration provenance; clean dedicated test schema from source; align typed tables/constraints/hash version; run baseline verify. Historical dirty DB is backed up and reconciled, not truncated or repaired by weakening append-only triggers. Record source commit plus uncommitted snapshot hashes. Database names are not alone proof of isolation: verify test endpoint credentials/role/host and no live target collision.
2. **Validate real master and integrations:** sanctioned EMS `userid` seed + greytHR enrich; canonical 14-entity mapping, rejection report and reviewed hierarchy. Resolve real Kent watermark/17-column format, SSO, SMTP/SeaweedFS, queue boot/drain and recipient receipt proof. No unreviewed production imports or reused chat credentials.
3. **Prove attendance gate:** a whole real month, device source counts/gaps, mismatch list, session/leave/OT/roster and every manager sign-off; documented month-lock preconditions and export times. Same scoped populations in muster/leave/payroll. G1 cannot be substituted with mock Kent tests.
4. **Prove payroll gate:** signed applicable policy/formats and independent golden calculations; at least two consecutive real comparisons; per-component/employee explanations approved, bank/JV/statutory reconciled; real payment acknowledgment and no double payouts. Hold/retro/F&F paths tested separately. Human review for money/statutory diffs is mandatory before release.
5. **Prove restore/reliability:** backups off-box plus WAL and rehearsed restore against doc14 targets, checksum/audit/ledger verification after restore; pgBouncer/read/report boundaries/partition maintenance; crash/retry queues, stale connector, recipient failure, storage orphan and duplicate consumption scenarios; provision for 3k/architecture10k evidence. Never mark reliability from a PM2 running process alone.
6. **Cutover under explicit sponsor operation:** source systems become read-only at recorded boundaries; final delta import and opening/YTD balances signed; one writer per domain/payment obligation. Announce rollback checkpoint and maintenance/run-day restrictions per docs14. HR training/runbook and access review accompany G0–G3.5; only then approved retirement actions. This planning task performs none of those external mutations.

### Responsibility and evidence

| Owner function | Owns sign-off, not only code |
|---|---|
| Sponsor/HR leadership | Scope decisions, stage priority, real scenario acceptance, gates and cutover |
| HR master/attendance | Identity/org/calendar/leave/shift policies, real muster and approvals |
| Payroll/Finance | CTC/components/input approval, monetary conservation, bank/JV/claim/loan/F&F payment and comparison |
| Legal/statutory owner | Effective applicability/rates/deadlines, filing/corrections/inspection and statutory evidence |
| IT/Kent/operations | Authorized connectors, storage/delivery, access mapping, observability/backups/restore and migration provenance |
| Backend/frontend implementers | Approved contracts/state transitions/scopes, tests, API generation, exact screens and verify output |
| Human reviewer | Mandatory money/statutory diff review and independently computed expectations |

## What the next AI must report at the end of a stage

Report exact SOW/requirement IDs and existing stage; changed source/schema/types/API/UI paths; old→new observed behavior; test and `npm run verify` output with limits; manual/UAT evidence still missing; unresolved decision IDs; conservative checklist/gate edits. An implemented capability may be “code complete, pending real UAT”; an unchecked plan item may already have code. Both facts must remain visible. Stop after the current stage; don't quietly start the next or turn this pack's proposed task into a passed gate.
