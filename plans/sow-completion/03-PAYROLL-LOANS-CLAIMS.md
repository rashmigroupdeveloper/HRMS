# Payroll, statutory, loans and claims

Authority: PAY-01..18, LN-01..04, CLM-01..07; CORE-07/08/12, ATT-08/12/15, LV-06, WF; docs03 §6, docs04 **in full**, docs06/08/09/10 **in full**, docs14 §6–10. Stages 2.1–2.6. This pack defines completion contracts; it does not certify statutory rates for FY2026-27 or authorize money implementation before signed decisions.

**Actual code:** Money/rounding utilities and `tests/money.test.ts`; workflow seeds; PayrollPage/LoansPage/ClaimsPage/MyPayPage shells. No payroll/loan/claim business routers registered in current `api/router.ts`; no complete salary/run models in current `Database` type. Historical live DB has `pay.budgets/claims/claim_lines/claim_reservations/claim_types/gl_accounts` from missing migration sources, with a different shape from docs03. Reconcile before adding any same-name table. A database schema named pay is not a payroll engine.

## 1. Model ownership and precise links

The baseline column contract is docs03 §6. Every migration proposal must show which columns are baseline, recovered-existing, or new required amendment. New design below is labelled **proposed extension** and must be reconciled in specs before migration.

| Record/grain | Baseline references | Required ownership/meaning |
|---|---|---|
| salary_components | unique code; formula, kind, tax/gross/PF/proration/display flags | Formula references only allowed component/settings/input variables, no arbitrary executable code |
| salary_structures | company_id → company; components refer to component codes | Grade/category/location selection needs explicit approved mapping/version; JSON component refs validated |
| employee_salaries | employee_id → employee; structure_id → structure; approved_by → user | Structure belongs to payer; effective span, annual_ctc and resolved components frozen; overlap exclusion needs effective_to extension from doc14 |
| payroll_runs | company_id → company; attendance_lock_id → company/month lock; finalized_by → user | Lock company/month agrees with run. Unique company/month/type must be revised under D11 for versions and multiple F&F/off-cycle cycles |
| payroll_items | run_id → run; employee_id → employee; payslip_document_id → document | Exactly one item per employee/run-result version; employee effective employer agrees with run |
| payroll_item_lines | item_id → payroll_items; component_code → salary_components.code | Amount + calc_note + contributing source/rule version; EE deduction differs from ER cost |
| inputs | run_id → run; employee_id → employee; component_code → component; entered_by → user | Typed source identity prevents duplicate import/claim/loan/OT consumption; not arbitrary adjustment JSON |
| salary_holds | employee_id → employee; created_by → user | Payment hold withholds payment only; process hold drives approved LOP treatment. Held liability release does not create new wages |
| arrears | employee_id → employee; source_salary_id → salary; paid_in_run_id → run; component_code → component | FOR period old/new frozen versions and IN payment period; delta, not overwritten old results |
| rates/slabs | statutory_rates effective date/source; PT state/effective interval; IT FY/regime/slabs | Law parameters must match target period/version. Incomplete/missing rule blocks computation |
| investment_declarations | employee_id → employee; proof_document_id → document; verified_by → user; employee/FY/section key | Declared and verified amounts remain separate; proof ownership and verification window explicit |
| tds_challans | company_id → company; amount/payment reference/period | Baseline TDS receipt table; additional scheme receipt model is a proposed reconciled extension. Generated file isn't government payment |
| GL/bank | GL component → component and cost-center → master; bank_batch.run_id → run; file → document | Same frozen result version, currency, count and control total; effective cost-center allocation |
| loans/postings | loan.employee_id → employee; workflow → request; posting.loan_id → loan and run_id → run | Balance derived from principal/opening/recovery/reversal events, not mutable outstanding field |
| claims/bills | claim.employee_id → employee; type → claim_type; workflow → request; advance → loan; payout run XOR batch; bill.claim_id → claim/document → registry | Approved ≤ claimed, bill verification owned, same-subject funding and source payout once |

**Proposed extensions required for reliability:** effective input/policy snapshot or immutable references; result versions and retro old/new linkage; maker/checker approval records; payment/consumption obligation references with unique source keys; installment/opening/reversal loan events; document output version/checksum. Do not create catch-all event tables or duplicate a recovered model. First amend docs03 with exact keys, nullability, constraints, owner and retention for each accepted extension.

## P01 — Salary configuration, CTC and effective assignments

**Stage2.1 / P2-T01/T02 / SOW12–14,26,38,82,90.** Depends F02/F03 and signed D01 policies. Existing money module is reused; salary module is proposed under `backend/src/modules/payroll/` through a public index. Exact file split follows ≤400-line/domain boundary rule; `payroll-core` changes require human review.

**Theory:** gross, net and annual CTC are different quantities. CTC includes signed employee earnings, employer costs and relevant benefit provisions; it cannot be reconstructed as net×12. Probation salary is a phase of an approved structure, with effective-date changes, not an arbitrary percentage of net salary.

**Logic:** configured components form an acyclic dependency graph. Parse a restricted deterministic expression language; validate references/cycles/division-zero/rounding; no eval or JS arbitrary code. Resolve a signed structure using company/grade/category/location, compute amounts in backend Money, show employee earnings/deductions/employer costs separately, balance any residual only into the approved balancing component. Annualization of fixed/variable/perquisite/bonus/provisions is signed. Reject negative or mismatched breakup; do not silently correct entered CTC.

Create dated probation/confirmed assignments with approved reference; use half-open or inclusive effective periods consistently and document conversion. EXCLUDE rejects employee overlap. Confirmed-phase switch comes from L02 approval/effective date; no orphan manual salary row. Mid-month revision uses multiple effective segments rather than latest-at-month-end for every day; docs04 simplified lookup conflict is D10.

**API proposals:** salary catalog/structure preview/assignment create/history/revision under existing `salary.write` and relevant reads; no endpoint exists merely because this plan names it. Generate OpenAPI before frontend wiring. Read masking differentiates own payslip, HR/payroll individual and CEO aggregate.

**Screens:** structures editor with component code/name/kind/formula/flags/display order; grade/category/location applicability; preview from approved example; employee compensation history by effective date/phase/CTC/breakup/approval; revision drawer with before/after and retro period preview. All money values from API, with rounding trace and validation. Gates disable assignment when grade/source/policy is missing.

**Acceptance:** independently computed staff/works/probation70/80/90 examples; dependency cycle rejection; CTC equality in paise; effective overlap rejected; confirmation auto-switch exactly once; historical slip unchanged after template edit; restricted fields masked.

## P02 — Inputs, immutable run lifecycle and calculation

**Stage2.2 / P2-T03/T04 / PAY-03/04/08/16/18; SOW65,68,72–77,81,91,93,95–116,127–137.** Depends trusted attendance lock, effective salary, signed proration/penalty/OT policy, clean data and restore readiness.

**Input contracts:** new joiner from verified effective master/salary; revisions from approved salary history; attendance payable units from lock; OT only approved and not converted/consumed; loan recovery from open eligible installment; approved claim/encash obligation from owning module; variable pay/deductions from typed validated source; holds from approved dated hold record; prior employer/YTD from reconciled import. At ingestion validate employee eligibility in that period, payer, component, amount/date/currency and duplicate source key. Show duplicate/conflicting rows with source line numbers, never summing duplicates unnoticed.

**Run transition contract:**

| Command/state | Conditions | Persisted result |
|---|---|---|
| Create → draft | India-payroll entity; supported period/type; valid lock/preconditions | Unique run/cycle identity; no payments |
| Lock inputs → inputs_locked | Complete salaries/master, attendance locked, input exceptions dispositioned | Frozen employee set, attendance/input/rule versions and source controls |
| Compute → computed | Unchanged frozen inputs; engine/rate version valid | Chunked result version; one item/employee and explained lines |
| Review → under_review | All chunks successful; independent totals equal | Variances/exceptions and reviewer dispositions |
| Approve → approved | Negative nets and statutory/duplicate/hold errors resolved; authorized independent checker | Immutable maker/checker actions; cannot self-co-sign |
| Finalize → finalized | Approved same result/input hashes; permissions and two-person rule | Immutable result + unique domain consumption postings + output requests |
| Reopen → reopened | Authorized reason and downstream payment/filing state reviewed | New revision/result version; old results retained; downstream correction obligation, not duplicate payment |

Illegal transitions are DB-rejected and audited. A crash mid-chunk does not expose partial computed results as final. Retry keys include run-version/employee/chunk; finalization row locks and unique consumed-source keys prevent two workers paying twice. Domain posting callbacks cannot modify an already finalized run. Input changes before finalization invalidate result/approvals instead of quietly changing net.

**Calculation, per effective salary segment and employee:**

1. Resolve dated salary, statutory applicability, payer, approved policy version and employment days.
2. From frozen attendance compute payable units, paid/unpaid WO/H/leave/OD/CO and LOP; split half-day presence and paid leave explicitly. Month basis CALENDAR/FIXED/WORKING_DAYS requires signed interpretation; SOW exclusions113–115 stay blocked D08. Payable-day/LOP counts must avoid counting unpaid WOs twice in NCP.
3. Prorate only flagged components; apply actual effective change segments; add approved OT at configured ordinary-rate base/divisor/multiplier, retro delta, permitted variable inputs and taxable perquisites. No floats through money.
4. Sum gross bases with separate tax/ESIC/PF flags; statutory calculations in order PF → ESIC → PT → LWF → TDS; other deductions/loan recovery after applicable statutory projection.
5. Net = earning payouts − EE deductions; negative net is a review error/approved recovery decision, never clamped to zero. Employer contributions go to CTC/JV, not net deductions.
6. Persist totals and component trace: original value, payable factor, effective rule/rate, rounding, source record/version, amount. Independent SQL/source reconciliation must equal engine totals in paise.

**Retro:** closed-period correction creates new FOR-period result, compare to old stored component version, post only delta in IN-period. Link and dedupe correction source/run. Apply earliest-retro bound and statutory/YTD correction policy. For pre-go-live periods without reconstructable inputs, accept signed component-wise external arrear breakup with source period and reconciliation; do not invent old salary calculations.

**Holds:** payment hold computes earnings/statutory liabilities as normal, excludes net from bank, records held net liability. Release transfers liability once without new gross/TDS. Process hold applies documented full LOP until release; later LOP reversal is a versioned correction with statutory impact. Do not conflate the two modes or reimport held net as ordinary taxable wages. Limit/deduction order/negative-net treatment is D10.

**Screen:** console run/type/cycle/company/month/source freshness; gate checklist; input imports with row errors/control totals; hold register; stepper reflecting actual state; compute progress; review grid payable/LOP/gross/deductions/net/prior delta; drawer line calculations/source; exception disposition; separate maker/checker; typed finalize confirmation. Shell `/api/payroll/runs` path is a proposal, not an implemented contract.

**Acceptance:** segment/proration/LOP-reversal/night/half-day fixtures; input duplicate rejection; independent total equality; repeated compute byte-identical from frozen facts; concurrent finalize doesn't double-post OT/claims/loan/encash; locked history cannot mutate; bank hold release conserves liability; interrupted chunk retry and illegal transition tests.

## P03 — Statutory engines, declarations and filing data

**Stage2.3 / P2-T05.** Money arithmetic tests are foundational, not complete G1–G10 payroll fixtures. D01/D10 must resolve authoritative target-FY law, applicability and doc conflicts before formula code.

| Engine | Separate facts and rule order | Evidence/tests |
|---|---|---|
| PF/EPS/EDLI/admin | Membership/applicability, PF-wage component flags, approved actual/ceiling/voluntary policy; EE/ER bases distinct; pension eligibility/split/caps and establishment charges separate | Hand-computed boundary/full-basic/ceiling/NCP examples; establishment control totals; accepted ECR layout |
| ESIC | Coverage wage at period entry versus contribution wages paid; preserve period membership after salary increase; exemptions and rounding per verified rule | Mid-period join/revision, coverage boundary, OT contribution distinction, daily-wage exemption if applicable, duplicate period evaluation |
| PT | Actual relevant state/entity/period rule, decimal-safe interval lookup with no gap/overlap; exemption applicability | Every slab edge in paise; state change and effective rate; matching register |
| LWF | State/category applicability, contribution cycle, employee/employer amounts and deduction timing | Half-year/rejoin/exit and duplicate cycle; approved output format |
| TDS | FY/regime election; actual YTD + remaining projected taxable earnings + prior-employer income + perquisites; regime-dependent exemptions and deductions → tax/slabs/rebate/marginal relief/surcharge/cess → YTD-paid offset → current recovery | Complete old/new independently computed numbers, last-month denominator, negative projected adjustment policy, rebate/surcharge edges; verified proof cutoff |
| Apprentice/trainee | Legal apprentice contract evidence versus ordinary trainee status; each scheme separately applicable | True apprentice/general trainee/consultant scenarios; never infer statutory exemption from label alone |
| Bonus/gratuity | Accounting year/eligibility/qualifying wage/min-wage/cap/advance/set-on/off and service-law exception | P07/L05 independently computed fixtures; no reuse of net-pay shortcut |

**Statutory source review:** docs10 is FY2025-26 and includes unverified 2026 assertions. The official [ESIC FAQ](https://www.esic.gov.in/attachments/files/faq.pdf) distinguishes overtime excluded for coverage from overtime included for contribution wages; docs10's blanket gross-excluding-OT wording must be reconciled. The official [Code on Wages text](https://labour.gov.in/sites/default/files/the_code_on_wages_as_passed_in_lok_sabha.pdf), §17(2), specifies a two-working-day wage-payment rule for listed exit cases; commencement/applicability and treatment of other settlement heads require Legal's recorded decision. Do not make an old three-day post-clearance SOW clock the legal wages deadline. Current EPF scheme/ceiling, IT/CEA and WB minimum-wage/LWF changes require exact operative notification evidence; this planning search does not certify them.

Maintain approved effective rates/source documents and source verification date; freeze exact rule snapshot in each run. No missing rule fallback to previous FY. Payroll admin/Legal resolve conflict; specs corrected before new goldens. Existing docs10 G5 has incomplete exact tax expectation and G6/G7/G9 need full component outcomes; complete all fixtures independently, including corrected G8 ₹1,67,639 rather than the stale Phase3 ₹1,67,008. Rates/formulas are tested with versioned fixtures; never derive expected values from engine output.

**Declarations/proofs:** own FY election and section-wise declarations, previous-employer Form12B fields, HRA rent/location and applicable proof files; separate proof-window/HR verification and amounts. Rejected/late proofs and withdrawal are auditable, not silent replacements. Calculator/IT statement must use the same versioned calculation primitive as payroll and label estimates. A–R layout exactly docs09/10, with regime, remaining months, actual paid and projected values distinguished.

**Filing model:** generated ECR/ESIC/PT/LWF/24Q data belongs to company/registration/period/run-version; accepted/paid filing is human M01 with acknowledgment/challan receipt. Form16 Part B generation differs from Part A imported from TRACES. TDS liability/challan reconciliation records actual payment and mismatches. Never label a generated bank/statutory file “paid”.

**Screens:** verified rate/registration calendar with source/effective/FY; declarations/proofs queue; A–R own tax sheet; statutory control totals/validation/export and human receipt status. Per-employee statutory/bank IDs served only under documented masking/access policy.

**Acceptance:** exact G1–G10 expanded and independent expected tax/ESIC/etc.; property/golden-master/mutation tests; portal data accepted through human workflow; source/rule sign-offs; no temporal gaps/slab overlap; correct rounding once at mandated boundary.

## P04 — Outputs, bank/JV, three payslip types and console

**Stage2.4 / P2-T06/T07/T08.** Depends approved frozen result and signed sample templates/formats D01.

Outputs reference a specific immutable result version; file registry metadata and per-file totals/count/checksum/provenance accompany it. Bank rows = payable items less payment holds/previously-paid obligations; required bank fields validated. JV groups approved component↔GL mapping by payer/effective cost-center; every source line accounted and balanced under Finance's signed template. Statutory files use their exact approved layout and validation—not a generic CSV inferred from report headings.

Regular, reimbursement and OT payslips share fixed RML identity/statutory/header template; each head paid once across outputs. The OT slip is a view of paid OT, not a second payout. Net in words/leave footer/year-to-date/tax sheet derive from same run/ledger snapshot. Payslip ownership is employee and result version; alumni uses restricted history. Archive old output versions when reopened, mark superseded and reconcile previously uploaded/paid files before replacement.

**Screens:** output cards show type/version/generated-at/readiness/control total and authorized download; bulk archive respects per-subject access; review drawer renders actual same-version payslip; ESS month/type picker, masked bank, declarations and A–R tax links; discrepancy ticket links to run/item rather than free text only. Finance payment acknowledgment is separate from export generation/finalization.

**Acceptance:** R7–R20 exact catalog coverage; masked access; hold exclusion; bank/JV/payslip/register tie to paise; template visual review/print; rendering failure recoverable without duplicate payment; version replacement and post-payment correction fixtures; target-size exports under docs13 thresholds.

## P05 — Loans, advance recovery and perquisites

**Stage2.5 / P2-T09; LN-01..04, SOW118–124.** Seeded loan workflow and LoansPage are existing scaffolds; scheduler/service/DB types/API are missing. Reuse workflow and Money; SAP legacy import format/eligibility/rate policy are prerequisites.

Loan request belongs to employee; eligibility from signed policy/history/grade/basic, not access to form. Approval records terms/principal/rate/tenure/start/repayment type; actual disbursement evidence is distinct from approval. Diminishing/flat/no-interest schedulers calculate full principal/interest installments in backend Money with final residual handling; disclose total cost and dates before submit.

Loan balance = signed opening/disbursement principal − posted principal recoveries + authorized reversal/adjustment events. Docs03's mutable outstanding must be a reconciled projection or removed under approved amendment. Each deduction posting links loan + run/item/source installment; unique consumption prevents repeated finalize reducing balance twice. Interest/perquisite is not principal repayment. SBI reference-rate/category/date and exemptions require signed official source; employee tax proof for housing deduction remains declaration evidence.

Salary advance recovery comes from approved monthly inputs; travel advances use T02 wallet/settlement, never a second loan balance that can recover the same rupee. Legacy SAP opening balance has source date/ID and signed reconciliation; write-off/prepay/exit recovery rules need explicit authority.

**Screens:** own eligibility explanation; type/amount/term/rate/repayment schedule/approval; loan history opening/disbursed/principal recovered/interest/remaining/next installment; payroll recovery exceptions and SAP import; perquisite trace. Third-party loan remittance remains manual/excluded SOW125.

**Acceptance:** all scheduler types, rounding residual and full closure; concurrent run consumption; principal conservation; eligibility denies correctly; partial salary/negative-net/exit recovery policy; imported balance match; perquisite independently computed.

## P06 — Claims, benefits, entitlement and payment

**Stage2.5 / P2-T10; CLM-01..07, SOW27/73/123/181/187/223.** Recover existing pay budget/claim migration sources before choosing shape. Missing HRMS router/UI doesn't imply DB tables absent. Choose one claims model for salary claims and T&E, with explicit funding-kind/extension, not competing balances in pay and te. D11 approves convergence.

Claim type defines period/grade entitlement, bill rules/tax treatment/mapped payout component; entitlement version is effective-dated. Available = bucket entitlement − consumed approved/paid obligations − valid pending reservations if signed policy requires reservations; prevent both approved and paid from being counted twice. Concurrency serializes employee/type/bucket; category budget reservations must conserve amounts across send-back/edit/budget switch/reject/cancel.

Submit: own employee, period/amount/type/receipts verified → reservation + claim + workflow attach atomically. RM validates business purpose; HR verifies bills and approved amount≤claimed; final approved claim creates a unique payable obligation. Reject reason mandatory; partial approval releases unused reservation and keeps trace. Resubmit updates domain line amounts/FX/reservation and workflow payload in one transaction.

Pay: obligation consumed by regular run **or** off-cycle reimbursement batch, never both; advance adjustment offsets same-subject outstanding first; only excess paid, recoverable balance explicit. Bank acceptance/payment receipt closes liability; “in approved run” differs from “paid”. Unpaid approved claims appear in F&F review. Year-end unsubstantiated/unclaimed entitlement taxability uses signed rules; do not tax every unused limit automatically or tax reimbursed/substantiated money twice.

Receipts reference `core.documents` with claim subject authorization; capture original amount/currency/FX source/date, converted INR and category. Flexi-basket activation timing for new joiners (SOW130/132–134), election changes and eligible first payroll require D10. No arbitrary benefit types beyond signed catalog.

**Screens:** own entitlement posted/pending/available and period; draft-safe multi-bill form; history with claimed/verified/approved/paid; HR receipt-preview/verification/partial reason queue; payroll payment queue regular-vs-off-cycle choice, control totals, outstanding obligation; R31 utilization/unsubstantiated trace.

**Acceptance:** concurrent bucket claims cannot overspend; rejection/resubmit/budget-switch releases exact reservation; duplicate callbacks and run/batch XOR; claimed→verified→approved→paid trace; bill ownership; advance conservation; reimbursement bank/payslip/register same result; year-end exceptions reviewed.

## P07 — Historical/YTD load, annual bonus/increment and takeover

**Stage2.6 / P2-T11/T12.** A sample import or Money golden is not a real payroll comparison. Scope SOW5,116,184–185 plus transition gate.

Freeze legacy source files/periods and checksums; reconcile employee ecode/entity/period/component mapping; import opening YTD earnings/deductions/TDS/PF/ESIC/loan/leave/held liabilities with explicit source type. Opening historical facts must not create present-month payment obligations. Resolve missing/duplicate/exited/transferred subjects and unknown components; retain per-row exceptions and signed total controls.

Annual bonus: signed eligibility, qualifying wages/minimum wage, accounting year, monthly advance and final true-up/set-on-off; approved postings/reconciliation, no double-paying advance. Increment: effective dated approved revisions with P01/P02 retro; not overwrite old structure. Year-end TDS/proof verification/claims tax uses P03/P06, one final-FY adjustment primitive.

**Parallel run:** ≥2 consecutive cycles. Agree tolerances **before** comparing; gross/components first, then deductions/net/payment/files. Log every variance, source, calculation trace, true defect versus accepted improvement, owner and disposition; no forced matching to erroneous legacy output. HR Head + Finance sign; accepted government outputs via M01, restore drill, meaningful branch/property/golden/mutation/shadow evidence, training and cut-over runbook. Old vendor retired only after G2.

**Screens:** source load/reconciliation; component delta grid; unresolved variance count; evidence/signature timeline; annual bonus/increment preview with eligible/excluded reason; no completion percentage from code count.

**Acceptance:** exact historical control totals; no duplicate openings/current payment; two-cycle signed comparison; portal/bank/JV acceptance; restore within agreed RTO/RPO; future engine changes protected by shadow old-vs-new run and independent reconciliation.

<!-- DEEP-AUDIT -->
## Current code repair obligations (09 Oct deep review)

These are required additions to the relevant cards, not implementation ticks. Read [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md) for exact symbols/lines, transactions and independent acceptance cases. All PRD requirements are covered in [11-REQUIREMENT-TO-CODE.md](11-REQUIREMENT-TO-CODE.md).

- **C06 — OT workflow decision and domain posting are split** (P02): Carry validated requested minutes and pay-vs-CO choice as authoritative decision facts. Apply final workflow state, OT status, unique CO posting, audit and outbox in the same final transaction. Recheck authority, pending state and accepted intimation deadline under D04/D06. Intermediate approval must not authorize payment/credit; add one posting key per OT entry and inspect affected rows.
- **C08 — Approved request write-back can silently skip attendance** (P02): Share the company-month synchronization boundary between lock and request finalization. Define manual precedence and post-lock cancellation/retro policy under D05/D11. Count intended/applied days explicitly; either complete approved effects atomically, reject/defer, or create an approved historical correction obligation. Never claim applied when protected rows were silently skipped.
- **C11 — Month lock omits dirty-queue and expected-day completeness** (P02): Add scoped completeness and dirty-work blockers, accepted carry decisions, effective eligible population and source reconciliation. Lock/recompute/final hooks must share synchronization so evidence cannot turn stale between checklist and commit. Preserve current device coverage and advisory-lock protections.
- **C25 — Attendance/report figures use incomplete or wrong source semantics** (P02): Define authoritative payable-session units and approved OT aggregation under D05/D06, effective population/history and exact docs06 denominators. Use validated immutable/snapshot inputs with freshness metadata and drilldowns; preserve unavailable nulls until payroll/contract inputs exist. Snapshot/filter/export populations must remain consistent after transfers.
- **C30 — Pending screens and workflow definitions are not domain implementations** (P01, P02, P03, P04, P05, P06, P07): Build the already-specified P/L/T/R/X cards in existing stage order, using the verified foundational boundaries and signed decisions. Keep pending UI honest; replace hand-authored assumed DTOs with the approved generated contract when each domain lands. Obtain external source/checkouts before claiming ATS/EMS absorption coverage.
- **C31 — Master import/read implementation does not complete master governance** (P01): Implement the full signed F02 field ownership/validation/catalog/editor/import plan and C01 scope. Define deliberate active/onboarding populations and align facets/list without hiding exited discoverability. Account/entity normalization is approved mapping, not fuzzy inference.
- **C33 — Reliability artifacts require operating proof** (P07): Execute and retain docs14 tiered reliability evidence at the appropriate stages; role-separated DB credentials, pool/read/report topology, worker lag/dead-letter/device alarms, restore drill and real scale fixtures. Add payroll independent goldens/property/mutation/shadow checks as P02/P03 land. Avoid counting a configuration file as a completed operational control.
- **C35 — Money discipline must include asset costs and future obligations** (P01, P02): Use approved decimal-string/paise DTO conversion and core Money for monetary operations, central rounding and preserved NUMERIC storage. Link inventory cost to an independently approved recovery obligation rather than silently deducting cost; FX precision and rate provenance remain D10.
