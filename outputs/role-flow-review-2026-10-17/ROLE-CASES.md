# Role and action cases — 17 Oct 2026

Each role is evaluated separately. **Automated coverage** means the named existing suites cover a slice; **native** means the19 current loopback HTTP/PostgreSQL observations. **Source-confirmed** is code evidence. No real Kent, ATS, SMTP, bank/portal or human acceptance was claimed. The native fixture was rolled back.

## Employee

| Case | Action | Required result | Current result | Evidence |
|---|---|---|---|---|
| E01 | Clock in/out through Kent | Actual device event commits once; own identity, IST work date and source retained. | Integration blocked | F01; source mock adapter; no live Kent contact |
| E02 | Only first half is attended | P:A → Half-day present; first/second result and configured times shown separately. | Automated cases covered; live preview evidence from16Oct | Pack26/27; half-attendance integration + AttendanceHalfDetails tests |
| E03 | Only second half is attended | A:P → Half-day present, not full Present. | Automated cases covered | Pack26/27 session-format and half-request tests |
| E04 | Regularise first half | Configured half time, reason, own request; selected half only becomes P after final approval. | Implemented slice; broader attendance gaps remain | Pack26/27 tests; F02–F06 |
| E05 | Request second-half OD in future | Configured second window; approved selected half only; other half not prematurely absent. | Implemented slice with automated cases | Pack26 native future coverage/queue tests; no external-device UAT |
| E06 | Resubmit sent-back AR/OD | Preserve/edit selected half; current date timing fetched again, overlap/lock rechecked. | Implemented slice with automated cases | Pack26/27 request/resubmit tests |
| E07 | Request bounded short permission | Separate from half-day AR/OD; actual bounded from/to time and configured cap. | Existing service; not independently browser rerun today | regularization.service.ts; current test suite |
| E08 | Request/cancel leave | Ledger reservation→approval debit→approved cancellation reversal; half-leave overlap reconciled. | Partial; leave/off-half reconciliation remains | stage15 tests; pack26 limit; A04 plan |

## Manager

| Case | Action | Required result | Current result | Evidence |
|---|---|---|---|---|
| M01 | Approve/reject/send back own team request | Only assigned authorized active step; out-of-scope/self/closed actions refused. | Core workflow automated coverage; version/delegation acceptance still open | stage13/workflow-scope/half-request tests; pack21 remaining |
| M02 | No configured approver is active | Hold for HR; no automatic consent; explicit lapse policy preserved. | Implemented/tested | Pack21; workflow holds integration tests; F15 UI missing |
| M03 | Directly mark an employee Present | Denied unless separately authorized HR override permission is explicitly held. | Permission protection exists; other scope checks unsafe | Seed grid; earlier H manager403 positive control; RF03 ordinary employee403 |
| M04 | Assign shifts/roster | Only permitted employees, active shift and unlocked facts; audit/recompute. | Scheme path unsafe | RF08; F05; bulk roster route has a scope assertion but scheme does not |
| M05 | Approve team month | Attest exact company/month and reviewed facts before HR lock. | Partial; approval policy disabled in native fixture context | RF16; manager-approval service; F06 |
| M06 | Decide OT within deadline | Approved minutes or WO/H comp-off alternative; lapse at configured deadline; no duplicate benefit. | Request slice tested; payroll consumption incomplete | stage14/half-request tests; F09 |

## HR Ops

| Case | Action | Required result | Current result | Evidence |
|---|---|---|---|---|
| H01 | Mark own-unit day A/P/HD | Reasoned scoped correction with old/new audit and consistent session/derived facts. | Unsafe | RF02 works but RF04/RF06 show reason/derived failures; F03/F04 |
| H02 | Mark another unit employee Absent | 403 and zero mutation outside authorized population. | Failed: returned200 and wrote day | RF01; F02 |
| H03 | Correct an already locked day | Clear refusal; no success/audit for unchanged facts; approved retro path only. | Failed:200 with original P unchanged | RF05; F03 |
| H04 | Read other-unit attendance | Denied or filtered by authorized scope. | Failed:foreign day returned200 | RF07; F02 |
| H05 | Issue absence letter | Scoped case, authorized signatory, actual generated document/delivery history. | Open source-confirmed scope and delivery acceptance | F14; prior H12 |
| H06 | Export muster/AR/OD/HR reports | Same population/filters/half labels as list; statutory masking and audit. | Selected muster/AR tests pass; all HR report families not safe | Pack26 R1/R3 exports; F14 R21/asset gaps |
| H07 | Convert joined candidate | Approved accepted-offer revision, DOJ/readiness, correct entity/org masters, one transaction. | Unsafe | F10; prior H08/H14 evidence + current code |

## HR Head

| Case | Action | Required result | Current result | Evidence |
|---|---|---|---|---|
| HH01 | Review company HR dashboard | Authorized population; explainable KPI drill-down and no substituted financial values. | Partial; scope/KPI obligations open | F14/F17; H13/R32 |
| HH02 | Review held approvals and retry | Visible HR queue; repair configured hierarchy; reasoned retry only routes. | API tested; dedicated screen missing | F15 |
| HH03 | Read payroll register | Read permission works; compute denied without manage grant. | Native API positive control | RF12=200 readonly list; RF13=403 compute |
| HH04 | Co-sign payroll | Independent authorized HR decision bound to computed result revision, in addition to payroll maker. | Unsafe:two payroll users can replace HR co-sign | RF14/15; F08 |
| HH05 | Confirm probation | Manager review→HR decision→correct salary boundary/breakup→approved archived letter. | Incomplete chain and salary/document linkage | F12; R19/R20 |
| HH06 | Approve transfer/resignation | Required sequential approvers/receipts; effective-date application; clearance/settlement status distinct. | Incomplete | F12; R19/R22 |
| HH07 | Approve offer/LOI | Plant Head/GM and HR/CEO steps required as configured; issue only approved snapshot. | Planned Phase4 flow absent here | RF19; F13; ATS source contract required |

## Payroll Admin

| Case | Action | Required result | Current result | Evidence |
|---|---|---|---|---|
| P01 | Create company/month run | Locked correct attendance period; eligible entity and full employee population. | Backend primitives exist; UI disconnected | F06/F07/F09; run create/compute lock guards |
| P02 | Compute missing attendance/salary | Fail safely with affected employees; never silently skip or pay invented defaults. | Protective checks exist; segmentation still incomplete | readLockedPayableDays; run-compute salary snapshot/segment checks |
| P03 | Compute actual gross/statutory/net | Effective salary + locked days + policy statutory/YTD/loan sources; exact money/order and explanations. | Not fully connected | F09; R05/R08; unit statutory goldens alone are insufficient |
| P04 | Pay approved overtime | Consume approved obligation once with configured rate; comp-off never also paid. | Deliberately blocked pending integration | run-compute approved OT refusal; F09 |
| P05 | Approve own computation | Refused; useful domain message. | Guard blocks, error contract poor | RF14 HTTP500; F08 |
| P06 | Approve using a second payroll account | Cannot substitute for required HR co-sign. | Failed:200 | RF15; F08 |
| P07 | Finalize/reopen run | Exact independent reconciliation, required co-sign, immutable versions; reopen reason and artifact regeneration. | Partial primitives; UI simulated and full evidence incomplete | F07/F08; R10/R33 |
| P08 | Download payslip/bank/JV/statutory output | Artifact tied to company/run/version, held payments excluded, document bytes and totals reconciled. | Incomplete end-to-end ownership/generation | F07/F09; outputs-bundle filename-only SAP lookup; R33/R34 |
| P09 | Parallel run and annual/YTD actions | Two complete consecutive populations/components; durable opening facts; actual salary revisions. | Remaining | R29/R30/R31; prior financial audits, source reconfirmed |

## LOI / Onboarding

| Case | Action | Required result | Current result | Evidence |
|---|---|---|---|---|
| L01 | Create/modify LOI | Stable ATS candidate/offer identity and version; changed approved CTC/probation requires reapproval. | Source contract required; not implemented end-to-end | F13; R01 ATS plan |
| L02 | Approve then issue LOI | Initiator→Plant Head/GM→HR Head→CEO→issue; each actual step/delivery recorded. | Scheduled Phase4; not implemented here | RF19; docs08 catalog |
| L03 | Accept/reject an offer | Authoritative accepted/rejected event separate from prejoin/no-show. | Incorrect inference in report | RF18 no_show→Rejected; F13 |
| L04 | Nightly ATS handoff | Authorized read-only connector/cursor and replay-safe candidate intake from accepted/joined source. | No registered ATS sync worker found | F13; worker.ts; recruitment UI promise unsupported |
| L05 | Prejoin link and documents | Real dispatched link, single-use token handling, validated sensitive fields/documents and expiry. | Partial scaffold; token/delivery gaps retained | F10/F11; R35; no external SMTP tested |
| L06 | DOJ conversion to employee | Source/target scoped validated masters; employee↔candidate identity; usable login, pay, tasks and probation atomically. | Unsafe | F10; H08/H09/H14 |
| L07 | IT completes onboarding task | Only assigned limited task access; provider proof for biometric registration. | Failed access; false proof risk | RF17; F11 |

## Other HR / Exit

| Case | Action | Required result | Current result | Evidence |
|---|---|---|---|---|
| O01 | Separation clearances and F&F | Actual approval→clearances→true computed obligation→approval→payment acknowledgment→letters/alumni. | Not accepted; sample/pay-state gaps | F12; R16/R17 |
| O02 | Announcements/polls/surveys | Scoped audience and exact valid response/result contracts. | Previous defects remain; not rerun today | F17; O01–O03/O11 pack22 |
| O03 | Policy acknowledgment/helpdesk SLA | Authorized content/task population, category ownership and correct closed/reopen/history metrics. | Previous defects/metric decision remain | F17; O04–O08/O12 pack22 |
| O04 | Assets assignment and exit recovery | One custody chain, valid transitions, scoped report and approved recovery obligation. | Remaining custody/report/finance acceptance | F14/F17; prior asset findings |
| O05 | Training and rollout | Role guides, real HR UAT, Kent/SMTP/storage proof, restore/scale checks and signed gates. | Remaining | CORE-14; F17; all original phase gates retained |

