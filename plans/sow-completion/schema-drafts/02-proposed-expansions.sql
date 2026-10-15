-- REVIEW DRAFT ONLY. NOT A node-pg-migrate migration. Do not apply to hrms.
-- Remove this guard only in a separately reviewed, stage-specific migration.
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $review_guard$ BEGIN
  RAISE EXCEPTION 'Schema proposal is not approved or migration-ordered. Read packs13-15 and resolve D decisions.';
END $review_guard$;

-- Proposed expansion only. All additions remain nullable until reviewed backfill/validation.
-- No IF NOT EXISTS: never mask incompatible pre-existing columns.
-- core.documents | CORE-09 NFR-04 | decisions D11 D12
-- Immutable bytes digest after staged upload
ALTER TABLE core.documents ADD COLUMN content_sha256 TEXT;
-- Object adapter version, not a public URL
ALTER TABLE core.documents ADD COLUMN storage_version TEXT;
-- Allow-listed authoritative parent kind
ALTER TABLE core.documents ADD COLUMN parent_entity TEXT;
-- Parent PK validated by owning domain
ALTER TABLE core.documents ADD COLUMN parent_id BIGINT;
-- Required integrity/logic amendment: Reconcile doc.types/extra actual columns before adding; preserve existing documents.id and ownership. Validate MIME/size/group consistency, immutable bytes/version; download checks authoritative parent entitlement. No MinIO-specific storage contract.

-- wf.requests | WF-01 WF-04 | decisions D03 D11
-- Current validated approval attempt
ALTER TABLE wf.requests ADD COLUMN current_revision_id BIGINT REFERENCES wf.request_revisions(id);
-- Required integrity/logic amendment: Same request/subject/revision; final effect consumes authoritative domain record, never arbitrary payload. Reject unvalidated generic domain creation. Status changes, masked audit and outbox share one transaction.

-- wf.request_steps | WF-01 WF-04 | decisions D03 D04 D11
-- Attempt to which step belongs
ALTER TABLE wf.request_steps ADD COLUMN request_revision_id BIGINT REFERENCES wf.request_revisions(id);
-- Actual queued message and receipt trail
ALTER TABLE wf.request_steps ADD COLUMN notification_id BIGINT REFERENCES wf.notifications(id);
-- Required integrity/logic amendment: Backfill old attempt identity before making required. Unique revision/step/eligible approver under approved N-of-M policy; stable eligible role scope, delegation ceilings/window, mandatory reasons. Keep notified_at historical queued meaning; do not rewrite as delivery evidence.

-- wf.notifications | WF-02 WF-04 | decisions D04 D11
-- Deterministic domain occurrence/recipient/channel identity
ALTER TABLE wf.notifications ADD COLUMN event_key TEXT;
-- Worker claim owner
ALTER TABLE wf.notifications ADD COLUMN lease_owner TEXT;
-- Recoverable claim expiry
ALTER TABLE wf.notifications ADD COLUMN lease_until TIMESTAMPTZ;
-- Configured retry/backoff due time
ALTER TABLE wf.notifications ADD COLUMN next_attempt_at TIMESTAMPTZ;
-- Required integrity/logic amendment: Current local table has no lease fields. Reconcile missing notification-sending-state migration seen only in removed test DB before forward amendment. Unique event/recipient/channel using NULL-safe indexes; short claim/ack transactions; no external send under long DB transaction. Max attempts/backoff are typed settings, not schema defaults.

-- att.recompute_queue | ATT-03 | decisions D07 D11
-- Monotonic semantic input-change revision
ALTER TABLE att.recompute_queue ADD COLUMN dirty_revision BIGINT;
-- Revision claimed by this work lease
ALTER TABLE att.recompute_queue ADD COLUMN claimed_revision BIGINT;
-- Worker identity
ALTER TABLE att.recompute_queue ADD COLUMN lease_owner TEXT;
-- Crash-recovery expiry
ALTER TABLE att.recompute_queue ADD COLUMN lease_until TIMESTAMPTZ;
-- Required integrity/logic amendment: Do not DELETE the sole durable item before work. Claim/compute/ack conditionally; a newer revision arriving during work remains pending. Unique employee/date already exists; use same lock protocol as month finalization. Configuration-loading failures remain replayable.

-- att.day_records | ATT-03 ATT-05 ATT-15 | decisions D05 D07 D11
-- Semantic derived-attendance version
ALTER TABLE att.day_records ADD COLUMN fact_revision BIGINT;
-- Frozen punches/roster/exception/placement/policy digest
ALTER TABLE att.day_records ADD COLUMN input_checksum TEXT;
-- Approved effective computation policy
ALTER TABLE att.day_records ADD COLUMN policy_version TEXT;
-- Required integrity/logic amendment: Increment/invalidate manager approval only on semantic facts, never computed_at or is_locked alone. Preserve existing session clearing. Month partitioning requires explicit forward migration with partition-aware PK/FKs; no direct conversion/drop of used table. Store canonical payable session units only after D05 signs exact rules.

-- att.manager_month_approvals | ATT-12 ATT-15 | decisions D05 D11
-- Digest of exact approved team/month attendance facts
ALTER TABLE att.manager_month_approvals ADD COLUMN approved_fact_revision TEXT;
-- Required integrity/logic amendment: Existing append-only approval/invalidation ledger remains. Locking/no-change recomputation must preserve sign-off. Genuine source/roster/exception change appends invalidation; sign-off and month lock must certify same expected population/revision.

-- att.month_locks | ATT-15 PAY-03 | decisions D05 D07 D11
-- Complete frozen company/month input digest
ALTER TABLE att.month_locks ADD COLUMN locked_fact_revision TEXT;
-- Reconciled muster/completeness evidence
ALTER TABLE att.month_locks ADD COLUMN snapshot_build_id BIGINT REFERENCES reporting.snapshot_builds(id);
-- Required integrity/logic amendment: Lock requires source completeness, expected employee/date coverage, empty eligible dirty queue, approved exceptions/carry policy and current manager approval. Month first-of-month CHECK; compatible subject/month locking with final approval prevents races. No closed-history overwrite.

-- att.regularizations | ATT-06 ATT-07 | decisions D05 D11
-- Validated dates/status revision
ALTER TABLE att.regularizations ADD COLUMN request_revision_id BIGINT REFERENCES wf.request_revisions(id);
-- Required integrity/logic amendment: Valid date/time intervals, same employee as workflow, typed kind/requested status; final applied flag requires exact affected-row checks. Lock-protected skipped day writes cannot be reported applied. D05 resolves Permission payable semantics before changing whole-day P.

-- att.overtime_entries | ATT-08 LV-04 | decisions D04 D06 D11
-- Current approved OT attempt
ALTER TABLE att.overtime_entries ADD COLUMN request_revision_id BIGINT REFERENCES wf.request_revisions(id);
-- Once-only approved pay route
ALTER TABLE att.overtime_entries ADD COLUMN payment_obligation_id BIGINT REFERENCES pay.payment_obligations(id);
-- Approved deadline-start evidence
ALTER TABLE att.overtime_entries ADD COLUMN intimation_notification_id BIGINT REFERENCES wf.notifications(id);
-- Required integrity/logic amendment: Approved minutes bounded by signed eligible detected/preapproved minutes, nonnegative; pay vs CO exclusive. Final workflow decision/entry/CO ledger or pay obligation/audit/outbox atomic; lock and recheck pending state/deadline. Inspect conditional write count. Deadline sweep cannot make a stale approval valid.

-- lv.applications | LV-03 LV-05 | decisions D02 D05 D06 D11
-- Validated leave-date/units attempt
ALTER TABLE lv.applications ADD COLUMN request_revision_id BIGINT REFERENCES wf.request_revisions(id);
-- Required integrity/logic amendment: Reserve available bucket under serialized employee/type lock; protect overlap at approved session/day grain with DB exclusion or reservation footprints after D05/D11. RH caps/cancellations/encash use same lock discipline. Ledger and actual attendance effects must commit with final approval; immutable actual debit drives payout.

-- pay.salary_components | PAY-01 PAY-09 PAY-10 PAY-13 | decisions D01 D10 D11
-- Required integrity/logic amendment: Version component flags/formulas/rounding and distinguish ESIC eligibility wages from contribution wages. No signed rate/basis inserted by this draft. Formula DAG and supported rounding identifiers validated; new metadata must not alter old result lines.

-- pay.employee_salaries | PAY-01 PAY-02 PAY-16 | decisions D01 D10 D11
-- Exclusive end of salary applicability
ALTER TABLE pay.employee_salaries ADD COLUMN effective_to DATE;
-- Exact approved template
ALTER TABLE pay.employee_salaries ADD COLUMN structure_version_id BIGINT REFERENCES pay.salary_structure_versions(id);
-- Effective legal placement
ALTER TABLE pay.employee_salaries ADD COLUMN assignment_id BIGINT REFERENCES core.employee_assignments(id);
-- Salary approval authority
ALTER TABLE pay.employee_salaries ADD COLUMN workflow_request_id BIGINT REFERENCES wf.requests(id);
-- Deterministic revision/import identity
ALTER TABLE pay.employee_salaries ADD COLUMN source_key TEXT;
-- Required integrity/logic amendment: Temporal EXCLUDE(employee,effective range) and valid dates, same payer/template. Midmonth segmentation signed. Decimal-string component snapshots; independently validate annual CTC. Historical source-backed rows preserved; confirmation creates new effective salary, not edit of closed result.

-- pay.payroll_runs | PAY-03 PAY-15 PAY-16 | decisions D10 D11
-- Stable logical run identity across result versions
ALTER TABLE pay.payroll_runs ADD COLUMN run_key UUID;
-- Positive frozen result revision
ALTER TABLE pay.payroll_runs ADD COLUMN result_version INTEGER;
-- Prior immutable result
ALTER TABLE pay.payroll_runs ADD COLUMN supersedes_run_id BIGINT REFERENCES pay.payroll_runs(id);
-- Approved regular/F&F/off-cycle occurrence identity
ALTER TABLE pay.payroll_runs ADD COLUMN cycle_no INTEGER;
-- Maker
ALTER TABLE pay.payroll_runs ADD COLUMN computed_by BIGINT REFERENCES core.users(id);
-- Independent checker
ALTER TABLE pay.payroll_runs ADD COLUMN approved_by BIGINT REFERENCES core.users(id);
-- Approved effective calculation configuration
ALTER TABLE pay.payroll_runs ADD COLUMN policy_version TEXT;
-- Complete frozen source digest
ALTER TABLE pay.payroll_runs ADD COLUMN input_checksum TEXT;
-- Required integrity/logic amendment: Replace inadequate UNIQUE(company,month,type) only after approved version/cycle contract. Unique run_key/result_version; validate prior run entity/type/period; maker != checker. Explicit transition table/trigger; inputs_locked pins input set. Computed regular runs require matching complete attendance lock; special-run preconditions signed. Reopen creates new result/delta and artifacts, never edits finalized rows.

-- pay.payroll_items | PAY-03 PAY-05 PAY-06 | decisions D05 D10 D11
-- Historical subject/payer/allocation
ALTER TABLE pay.payroll_items ADD COLUMN assignment_id BIGINT REFERENCES core.employee_assignments(id);
-- Exact salary source; segments carried in input refs
ALTER TABLE pay.payroll_items ADD COLUMN salary_id BIGINT REFERENCES pay.employee_salaries(id);
-- Required integrity/logic amendment: UNIQUE(run,employee) per result; same subject and historical payer across assignment/run. Numeric days/minutes checked for valid units. net_pay = gross - total_deductions; negative result remains explicit review and cannot silently clamp/finalize. Payment status is separate from calculation status.

-- pay.payroll_item_lines | PAY-03 PAY-06 | decisions D10 D11
-- Required integrity/logic amendment: calc_note required on every monetary line; component FK; signed component amount semantics; stable line/source allocation key if one component has multiple sources. Line totals independently match header. All finalized lines append-only by trigger and grants.

-- pay.inputs | PAY-03 NFR-04 | decisions D10 D11
-- Input approval where required
ALTER TABLE pay.inputs ADD COLUMN workflow_request_id BIGINT REFERENCES wf.requests(id);
-- Stable import/manual occurrence
ALTER TABLE pay.inputs ADD COLUMN source_key TEXT;
-- Validated input revision
ALTER TABLE pay.inputs ADD COLUMN source_version TEXT;
-- Required integrity/logic amendment: Component FK and subject/payer/period checks; no arbitrary input on inactive/ineligible subject. Approved signed amount semantics per component. Freeze with run source digest; post-lock correction becomes later recompute+delta, not in-place change.

-- pay.salary_holds | PAY-08 | decisions D10 D11
-- Authorized hold/release decision
ALTER TABLE pay.salary_holds ADD COLUMN workflow_request_id BIGINT REFERENCES wf.requests(id);
-- Required integrity/logic amendment: Valid first-of-month range and actor/scope; distinguish payment hold liability from process hold payable units. Release consumes existing outstanding obligation once, never recomputes and pays a second salary. Immutable hold/release evidence after policy model approval.

-- pay.arrears | PAY-16 | decisions D10 D11
-- Closed result being corrected
ALTER TABLE pay.arrears ADD COLUMN original_run_id BIGINT REFERENCES pay.payroll_runs(id);
-- New deterministic result version
ALTER TABLE pay.arrears ADD COLUMN recomputed_run_id BIGINT REFERENCES pay.payroll_runs(id);
-- Unique employee/component/for-period/correction occurrence
ALTER TABLE pay.arrears ADD COLUMN source_key TEXT;
-- Required integrity/logic amendment: Amount = independently checked recomputed minus original component; same person/entity/period; original finalized lines unchanged. Consumption reference identifies current approved payout/recovery exactly once.

-- pay.statutory_rates | PAY-09 PAY-10 PAY-11 PAY-12 PAY-13 PAY-17 | decisions D01 D11
-- Exclusive end of rate applicability
ALTER TABLE pay.statutory_rates ADD COLUMN effective_to DATE;
-- Approved establishment/state/scheme scope
ALTER TABLE pay.statutory_rates ADD COLUMN jurisdiction TEXT;
-- Policy owner sign-off
ALTER TABLE pay.statutory_rates ADD COLUMN approved_by BIGINT REFERENCES core.users(id);
-- Required integrity/logic amendment: Unique/EXCLUDE scheme+param+jurisdiction+effective interval after nullable-scope semantics signed. Rate vs amount vs ceiling units explicitly validated. Official source and effective applicability required. No rates seeded; existing doc10 conflicts remain D01.

-- pay.pt_slabs | PAY-11 | decisions D01 D11
-- Exclusive policy interval end
ALTER TABLE pay.pt_slabs ADD COLUMN effective_to DATE;
-- Reviewed state slab set
ALTER TABLE pay.pt_slabs ADD COLUMN policy_version TEXT;
-- Required integrity/logic amendment: Valid continuous wage ranges and nonoverlap within state/version; decimal wages must not fall in an integer-gap boundary. Applicable slab sets effective-dated and signed; no hardcoded top amount.

-- pay.it_slabs | PAY-13 | decisions D01 D11
-- Reviewed FY/regime ruleset and source digest
ALTER TABLE pay.it_slabs ADD COLUMN policy_version TEXT;
-- Required integrity/logic amendment: Nonoverlapping and complete approved taxable-income ranges; independently reviewed marginal relief/surcharge/cess/deduction schema. Rate data numeric; no current website value copied into historical years.

-- pay.investment_declarations | PAY-13 | decisions D01 D11
-- Immutable submitted/verified declaration version
ALTER TABLE pay.investment_declarations ADD COLUMN version INTEGER;
-- Required integrity/logic amendment: Unique employee/FY/section/version; declared amount and verified amount separate, nonnegative and authorized section bounds. Exact evidence belongs to same employee/version; final proof window uses signed policy. Keep declaration/proof correction history.

-- pay.loans | LN-01 LN-02 LN-03 | decisions D10 D11
-- Authorized loan principal payment
ALTER TABLE pay.loans ADD COLUMN funding_obligation_id BIGINT REFERENCES pay.payment_obligations(id);
-- Required integrity/logic amendment: Principal/tenure/method validity under signed eligibility; exact amount math through Money. outstanding is a derived SUM projection, never financial authority. Opening, funding, recoveries, writeoffs/reversals require immutable postings and verified payment evidence; never double-import opening and full historic ledger.

-- pay.loan_postings | LN-03 | decisions D10 D11
-- Opening/funding/recovery/interest/writeoff/reversal vocabulary
ALTER TABLE pay.loan_postings ADD COLUMN posting_kind TEXT;
-- Signed opening source
ALTER TABLE pay.loan_postings ADD COLUMN import_batch_id BIGINT REFERENCES core.import_batches(id);
-- Funding/recovery acknowledgment
ALTER TABLE pay.loan_postings ADD COLUMN payment_event_id BIGINT REFERENCES pay.payment_events(id);
-- Authorized compensation
ALTER TABLE pay.loan_postings ADD COLUMN reverses_posting_id BIGINT REFERENCES pay.loan_postings(id);
-- Deterministic movement identity
ALTER TABLE pay.loan_postings ADD COLUMN source_key TEXT;
-- Required integrity/logic amendment: Current baseline run_id NOT NULL cannot represent all required movements; signed amendment chooses source XOR and signed principal/interest columns. Same loan/subject/payer and conserved amount; immutable ledger. Schedule amount alone is not collected cash.

-- pay.claims | CLM-02 CLM-03 CLM-04 CLM-07 | decisions D10 D11
-- Travel-owned purpose; NULL for pure salary reimbursement
ALTER TABLE pay.claims ADD COLUMN trip_id BIGINT REFERENCES te.trips(id);
-- Frozen approved claim attempt
ALTER TABLE pay.claims ADD COLUMN request_revision_id BIGINT REFERENCES wf.request_revisions(id);
-- Required integrity/logic amendment: REUSE current shared pay.claims/pay.claim_lines/pay.claim_reservations; DO NOT replace with docs03 CREATE or duplicate te.claims. Define funding_kind contract and salary entitlement bucket versus trip budget. One active claim per budget under captured EMS rule; old reserved_budget_id preserved on change. Approved/settled/paid distinct; one source obligation/consumption prevents payroll and offcycle double pay.

-- pay.claim_lines | CLM-02 CLM-03 TE-05 | decisions D10 D11
-- Authorized bill metadata replacing bare path gradually
ALTER TABLE pay.claim_lines ADD COLUMN document_id BIGINT REFERENCES core.documents(id);
-- Independent verified line amount
ALTER TABLE pay.claim_lines ADD COLUMN verified_amount NUMERIC(14,2);
-- Authorized bill verifier
ALTER TABLE pay.claim_lines ADD COLUMN verified_by BIGINT REFERENCES core.users(id);
-- Actual verification time
ALTER TABLE pay.claim_lines ADD COLUMN verified_at TIMESTAMPTZ;
-- Captured reviewed FX quote
ALTER TABLE pay.claim_lines ADD COLUMN currency_rate_id BIGINT REFERENCES te.currency_rates(id);
-- Required integrity/logic amendment: Do not create pay.claim_bills if it duplicates a line receipt; approved distinct multiple-document relation only if source capture needs it. Decimal original/INR money, positive FX, bill dates, subject document ownership. Lines immutable after approval except reviewed new request revision.

-- pay.claim_reservations | CLM-01 CLM-07 TE-09 | decisions D10 D11
-- Demand revision creating/releasing reservation
ALTER TABLE pay.claim_reservations ADD COLUMN request_revision_id BIGINT REFERENCES wf.request_revisions(id);
-- Deterministic reserve/release/change identity
ALTER TABLE pay.claim_reservations ADD COLUMN source_key TEXT;
-- Required integrity/logic amendment: Existing immutable movement table is authority. Normalize category movements after captured EMS schema review; JSON category totals use decimal strings and exact sum check meanwhile. Lock original budget/categories; compensation references original reservation, never a newly selected budget. No mutable remaining balance.

-- pay.claim_entitlements | CLM-01 CLM-05 | decisions D10 D11
-- Exclusive entitlement applicability end
ALTER TABLE pay.claim_entitlements ADD COLUMN effective_to DATE;
-- Reviewed annual/monthly/event bucket definition
ALTER TABLE pay.claim_entitlements ADD COLUMN policy_version TEXT;
-- Required integrity/logic amendment: Distinguish salary grade entitlement from te travel levels/budget. Temporal nonoverlap with NULL-safe default grade scope; reserve pending/approved demand under bucket lock. Explicit year-end taxable/lapse/carry behavior; never count claimed+approved+paid states three times.

-- pay.bank_batches | PAY-05 CLM-04 | decisions D10 D11
-- Frozen legal payer
ALTER TABLE pay.bank_batches ADD COLUMN company_id BIGINT REFERENCES core.companies(id);
-- Bank-file revision
ALTER TABLE pay.bank_batches ADD COLUMN version INTEGER;
-- Frozen result/obligation/payee input digest
ALTER TABLE pay.bank_batches ADD COLUMN source_checksum TEXT;
-- Required integrity/logic amendment: Offcycle parent run/batch contract must be signed; no bank amount default. Line count and sum match header, immutable file reference and stable payment identity. Regenerate new artifact version; uncertain external submit reconciles before retry.

-- pay.gl_accounts | PAY-05 | decisions D10 D11
-- Entity-specific SAP mapping
ALTER TABLE pay.gl_accounts ADD COLUMN company_id BIGINT REFERENCES core.companies(id);
-- Approved mapping start
ALTER TABLE pay.gl_accounts ADD COLUMN effective_from DATE;
-- Exclusive mapping end
ALTER TABLE pay.gl_accounts ADD COLUMN effective_to DATE;
-- Required integrity/logic amendment: Existing DB-only GL table source must be recovered. Unique temporal component/company/cost-center default scope; historical JV freezes mapping. Do not silently adopt schema solely because a table is present.

-- pay.fnf_settlements | PAY-15 | decisions D01 D10 D11
-- Approved first/second settlement occurrence
ALTER TABLE pay.fnf_settlements ADD COLUMN cycle_no INTEGER;
-- Immutable settlement result revision
ALTER TABLE pay.fnf_settlements ADD COLUMN result_version INTEGER;
-- Prior result version
ALTER TABLE pay.fnf_settlements ADD COLUMN supersedes_settlement_id BIGINT REFERENCES pay.fnf_settlements(id);
-- Required integrity/logic amendment: Real FK separation_id→core.separations and same employee; unique separation/cycle/version, not simplistic one-row-per-employee. Settlement lines use same payroll item engine/source references. Statutory wage deadline and vendor processing TAT are separately signed D01; no default guessed legal deadline. Clearance/recoveries/held liability/payout consumed once.

-- core.onboarding_candidates | LC-01 | decisions D03 D09 D11
-- Exact ATS candidate/LOI source identity
ALTER TABLE core.onboarding_candidates ADD COLUMN source_mapping_id BIGINT REFERENCES core.source_mappings(id);
-- Required integrity/logic amendment: Keep full approved doc03 LOI field catalog; do not infer candidate=employee. Token digest lives in prejoin invitation and replaces insecure plaintext token through reviewed cutover. Same accepted offer/version converts once to employee and salary; authoritative merge fields cannot be overridden.

-- core.onboarding_tasks | LC-02 | decisions D03 D04 D11
-- Actual scoped task recipient resolved at creation
ALTER TABLE core.onboarding_tasks ADD COLUMN owner_user_id BIGINT REFERENCES core.users(id);
-- Delivery trail
ALTER TABLE core.onboarding_tasks ADD COLUMN notification_id BIGINT REFERENCES wf.notifications(id);
-- Idempotent employee/onboarding-task occurrence
ALTER TABLE core.onboarding_tasks ADD COLUMN source_key TEXT;
-- Required integrity/logic amendment: UNIQUE employee/task/approved join occurrence; eligible runtime recipient, real receipt and configured due/escalation policy. Task completion requires actor and timestamp; conversion is not completion of every stakeholder task.

-- core.probation_reviews | LC-04 PAY-02 | decisions D10 D11
-- Effective confirmed salary projection
ALTER TABLE core.probation_reviews ADD COLUMN applied_salary_id BIGINT REFERENCES pay.employee_salaries(id);
-- Required integrity/logic amendment: Valid due/recommendation/extension and same employee/workflow; confirm vs extend vs separate explicit. Approval creates exactly one future/effective salary phase, history, letter eligibility/audit/outbox. Repeated job/approval must not switch twice.

-- core.separations | LC-06 LC-07 PAY-15 | decisions D01 D03 D10 D11
-- Required integrity/logic amendment: Reason/notice/LWD validity and same workflow subject. Historical fnf_id must become reviewed latest-result projection if two cycles/versioning are approved, never sole financial authority. Approved separation != employee exited != settlement paid. Exit status requires DOL and restricted alumni rules; reassign pending work safely.

-- core.clearances | LC-06 AST-04 | decisions D10 D11
-- Required integrity/logic amendment: Same employee through separation, unique department task, authorized clearing actor/time. Reference actual custody/debt/claim/advance obligations and reviewed recovery/writeoff, not free-text fake zero. Unreturned asset remains outstanding; cost does not automatically become recovery.

-- ast.assignments | AST-04 AST-05 | decisions D11
-- Required integrity/logic amendment: Keep employee XOR third-party holder CHECK and one-open-custody unique index. Do not set returned_at or return asset to stock for not_returned. Physical receipt/loss/writeoff events and approved financial recovery are distinct. Cross-company custody requires explicit authorized owner/holder contract.

-- hd.tickets | HD-01 | decisions D03 D04 D11
-- Reopen/SLA cycle identity
ALTER TABLE hd.tickets ADD COLUMN current_cycle_no INTEGER;
-- Required integrity/logic amendment: Existing counters/timestamps are projections over hd.ticket_events; preserve resolved-late breaches and prior reopen cycles. Participant/agent/internal-note scope checked server-side. Ticket status+immutable event+audit/outbox atomic; sweeps serialized and recipient eligibility rechecked.

-- core.policy_acknowledgments | CORE-13 EN-04 | decisions D03 D11
-- Exact content/audience acknowledged
ALTER TABLE core.policy_acknowledgments ADD COLUMN policy_version_id BIGINT REFERENCES core.policy_versions(id);
-- Required integrity/logic amendment: Backfill legitimate historical version, then unique employee/policy_version. Same effective population for read/ack/nag/tile/export; historical acknowledgment cannot inflate unrelated current numerator; append-only receipt.

-- eng.surveys | EN-03 | decisions D03 D11
-- Required integrity/logic amendment: Doc03 structured survey is a proposal absent from current catalog; current eng.polls pulse is not its complete substitute. Typed versioned questions/options/answer schema and audience/anonymous dedupe policy signed. Preserve HMAC anonymity; no automatic survey recommendations without D08 algorithm/scope.

-- reporting.kpi_daily | RPT-03 RPT-04 | decisions D05 D11
-- Formula/population/completeness lineage
ALTER TABLE reporting.kpi_daily ADD COLUMN snapshot_build_id BIGINT REFERENCES reporting.snapshot_builds(id);
-- Scope dimension when applicable
ALTER TABLE reporting.kpi_daily ADD COLUMN org_unit_id BIGINT REFERENCES core.org_units(id);
-- Required integrity/logic amendment: Reconcile current company/category/day/metric grain with scoped OU dimensions/version; no duplicate mixed grain rows. Null unavailable_reason is meaningful. Historical denominators from effective roster/placement, approved OT and average headcount. Scoped drilldown/export matches exact source population; hot paths avoid full live aggregation.

-- reporting.muster_month | RPT-01 | decisions D05 D11
-- Exact frozen attendance revision
ALTER TABLE reporting.muster_month ADD COLUMN snapshot_build_id BIGINT REFERENCES reporting.snapshot_builds(id);
-- Required integrity/logic amendment: Same employee/month/legal payer/history grain; exact signed session/paid-leave LOP formula, complete eligible days; source snapshot and export filters agree. Invalidated source has explicit stale/unavailable state.

-- pay.budgets | TE-02 TE-03 TE-06 | decisions D10 D11
-- Canonical travel intent
ALTER TABLE pay.budgets ADD COLUMN trip_id BIGINT REFERENCES te.trips(id);
-- Approved rule set
ALTER TABLE pay.budgets ADD COLUMN policy_version_id BIGINT REFERENCES te.policy_versions(id);
-- Reviewed tier, distinct from pay grade
ALTER TABLE pay.budgets ADD COLUMN travel_level_id BIGINT REFERENCES te.travel_levels(id);
-- Required integrity/logic amendment: REUSE actual budget/category records from recovered migration175215. Preserve original reservations and source key. Capture all EMS source fields before locking amendment; no new te.budgets/claim duplicates. Category totals, dates, payer/employee and allowed-excess authorization independently validated.

ROLLBACK;
