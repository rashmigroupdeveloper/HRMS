# Remaining backend schema — proposed changes

Prepared 2026-10-10. All fields below are **proposed design**, not existing/approved columns. The physical catalog remains in pack14. Every proposal has a requirement, business grain, ownership, integrity and transaction purpose. D11 governs schema review; additional D IDs identify unresolved policy. No policy number/rate or live record is inserted.

Use [pack13](13-BACKEND-SCHEMA-PLAN.md) for ordering/coverage, packs01–06 for business/screens/API behavior, pack10 for source defects, and pack12 for end-to-end transactions. **Common proposed model columns:** `id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`. Mutable operational projections may receive `updated_at`; immutable ledgers/events must not have an update path. The SQL draft omits unspecified policy defaults.

## A. New model responsibilities and fields


### core.employee_assignments

**Grain:** One approved effective placement interval per employee. **Cards:** F02, A02, P01, L01, L03, W04. **Requirements:** CORE-01, CORE-03, LC-05, RPT-05. **Decisions:** D07, D09, D11.

| Proposed column definition | Purpose/provenance |

|---|---|

| `employee_id BIGINT NOT NULL REFERENCES core.employees(id)` | Person whose historical placement is authoritative |

| `company_id BIGINT NOT NULL REFERENCES core.companies(id)` | Legal employer for this effective interval |

| `location_id BIGINT NOT NULL REFERENCES core.locations(id)` | Work site and calendar/jurisdiction |

| `org_unit_id BIGINT NOT NULL REFERENCES core.org_units(id)` | Historical permission and reporting dimension |

| `cost_center_id BIGINT NOT NULL REFERENCES core.cost_centers(id)` | Historical payroll/JV allocation |

| `department_id BIGINT NOT NULL REFERENCES core.departments(id)` | Historical department |

| `designation_id BIGINT NOT NULL REFERENCES core.designations(id)` | Historical designation |

| `grade_id BIGINT REFERENCES core.grades(id)` | Verified grade; applicability determines requiredness |

| `reporting_manager_id BIGINT REFERENCES core.employees(id)` | Historical direct manager, cross-entity allowed |

| `functional_manager_id BIGINT REFERENCES core.employees(id)` | Historical functional manager |

| `effective_from DATE NOT NULL` | First included business date |

| `effective_to DATE` | Exclusive end; NULL open interval |

| `workflow_request_id BIGINT REFERENCES wf.requests(id)` | Authorized transfer/join/change |

| `approved_by BIGINT NOT NULL REFERENCES core.users(id)` | Actual approving actor |

| `source_key TEXT NOT NULL UNIQUE` | Stable import/approval occurrence identity |

**Integrity:** CHECK effective_to > effective_from when present; temporal EXCLUDE(employee_id, daterange(...,[))); composite site/OU/CC-company checks; cycle-free managers. Backfill verified history, never infer old placement from current master. Closing an interval is a separately audited controlled change; immutable financial snapshots retain original placement/version.

**Atomic business boundary:** Lock employee; validate old/new links and effective interval; close/open assignment, history, projection, dirty revisions, audit/outbox together.

**History:** Operational state allowed only through approved transition/audit/version rules; no implicit financial balance authority.


### core.import_batches

**Grain:** One sanitized source snapshot/import attempt. **Cards:** F02, T04, P07. **Requirements:** CORE-12, TE-12. **Decisions:** D09, D11.

| Proposed column definition | Purpose/provenance |

|---|---|

| `source_system TEXT NOT NULL` | EMS, greytHR, ATS or comparison source contract |

| `source_snapshot_at TIMESTAMPTZ NOT NULL` | Frozen source capture time |

| `source_checksum TEXT NOT NULL` | Digest of reviewed input |

| `mapping_version TEXT NOT NULL` | Approved mapping/validation version |

| `status TEXT NOT NULL` | Prepared, validated, applied or rejected per approved state contract |

| `requested_by BIGINT NOT NULL REFERENCES core.users(id)` | Authorized importer |

| `result_document_id BIGINT REFERENCES core.documents(id)` | Masked reconciliation report |

| `source_key TEXT NOT NULL UNIQUE` | Import retry key |

**Integrity:** Unique source snapshot/mapping identity as approved; raw staging separated and access restricted; counts/checksums recorded in validation artifact, no mandatory-field fabrication.

**Atomic business boundary:** Stage/validate first; apply each bounded batch with mapping/domain/audit/outbox together; retain rejected rows through restricted evidence.

**History:** Operational state allowed only through approved transition/audit/version rules; no implicit financial balance authority.


### core.source_mappings

**Grain:** One immutable external ID to internal domain record mapping. **Cards:** F02, T04, R01, L01. **Requirements:** CORE-12, TE-12, LC-01. **Decisions:** D09, D11.

| Proposed column definition | Purpose/provenance |

|---|---|

| `import_batch_id BIGINT NOT NULL REFERENCES core.import_batches(id)` | Provenance of mapping |

| `source_system TEXT NOT NULL` | External namespace |

| `source_entity TEXT NOT NULL` | External collection/table/record type |

| `external_id TEXT NOT NULL` | Exact source key; Mongo IDs and e-codes remain distinct |

| `target_entity TEXT NOT NULL` | Allow-listed owned target domain |

| `target_id BIGINT NOT NULL` | Validated internal PK; polymorphic target needs service/trigger checks |

| `source_checksum TEXT NOT NULL` | Reviewed source record/version digest |

**Integrity:** UNIQUE(source_system,source_entity,external_id); validate target exists and matches approved target type; no fuzzy identity matching; never store credential material.

**Atomic business boundary:** Insert mapping with domain creation; retry resolves same record, not a second employee/e-code.

**History:** Append-only rows; UPDATE/DELETE rejected by trigger and app grants; corrections reference original row.


### wf.definition_versions

**Grain:** One immutable published approval-chain version. **Cards:** A03, F03. **Requirements:** WF-01, WF-04. **Decisions:** D03, D04, D11.

| Proposed column definition | Purpose/provenance |

|---|---|

| `definition_code TEXT NOT NULL REFERENCES wf.definitions(code)` | Stable existing request-type code |

| `version INTEGER NOT NULL` | Published positive revision |

| `steps JSONB NOT NULL` | Validated ordered chain schema and receipt/SLA rules |

| `published_by BIGINT NOT NULL REFERENCES core.users(id)` | Authorized publisher |

| `published_at TIMESTAMPTZ NOT NULL` | Version effective/publish time |

**Integrity:** UNIQUE(definition_code,version), version > 0; require contiguous step numbers and valid scoped approver selectors. JSON is typed configuration, not arbitrary financial input.

**Atomic business boundary:** Validate and publish new version; open requests remain pinned unless a separately approved migration rule applies.

**History:** Append-only rows; UPDATE/DELETE rejected by trigger and app grants; corrections reference original row.


### wf.request_revisions

**Grain:** One validated domain/request revision. **Cards:** A03, A04, F03. **Requirements:** WF-01, WF-04, LV-03. **Decisions:** D03, D11.

| Proposed column definition | Purpose/provenance |

|---|---|

| `request_id BIGINT NOT NULL REFERENCES wf.requests(id)` | Approval instance |

| `revision INTEGER NOT NULL` | Attempt/revision number |

| `chain_version_id BIGINT NOT NULL REFERENCES wf.definition_versions(id)` | Frozen chain used for this attempt |

| `domain_entity TEXT NOT NULL` | Allow-listed authoritative request table |

| `domain_id BIGINT NOT NULL` | Validated domain PK with same subject |

| `payload JSONB NOT NULL` | Exact typed review snapshot, not sole financial authority |

| `submitted_by BIGINT NOT NULL REFERENCES core.users(id)` | Resubmitting actor |

| `submitted_at TIMESTAMPTZ NOT NULL` | Revision submission time |

| `source_key TEXT NOT NULL UNIQUE` | Stable submission retry identity |

**Integrity:** UNIQUE(request_id,revision); positive revision; validated domain existence, subject equality, owned amount/date/version. Steps reference revision; never UNIQUE(request_id,step_no) across all attempts.

**Atomic business boundary:** Resubmit under subject/request lock; recompute balance/reservations and domain dates, append revision/steps, audit/outbox atomically.

**History:** Append-only rows; UPDATE/DELETE rejected by trigger and app grants; corrections reference original row.


### wf.notification_attempts

**Grain:** One immutable transport attempt/receipt. **Cards:** F04, A03, W02. **Requirements:** WF-02, WF-04. **Decisions:** D04, D11.

| Proposed column definition | Purpose/provenance |

|---|---|

| `notification_id BIGINT NOT NULL REFERENCES wf.notifications(id)` | Queued event/recipient |

| `attempt_no INTEGER NOT NULL` | Attempt sequence |

| `provider_reference TEXT` | Transport idempotency/accepted reference, sanitized |

| `started_at TIMESTAMPTZ NOT NULL` | Actual send attempt start |

| `finished_at TIMESTAMPTZ` | End/receipt time when known |

| `outcome TEXT NOT NULL` | Accepted, failed or uncertain; delivery/read tracked separately |

| `error_code TEXT` | Sanitized classification, no payload/credentials |

| `source_key TEXT NOT NULL UNIQUE` | Attempt identity surviving retries |

**Integrity:** UNIQUE(notification_id,attempt_no); valid time ordering; accepted is not read; no fabricated notified_at rewrite. Queue needs lease_owner/lease_until/next_attempt_at/event_key and conditional claim.

**Atomic business boundary:** Short claim transaction → transport outside DB transaction → conditional receipt/lease update; uncertain external outcome reconciled before retry.

**History:** Append-only rows; UPDATE/DELETE rejected by trigger and app grants; corrections reference original row.


### core.document_operations

**Grain:** One staged object operation/reconciliation intent. **Cards:** F04, T04. **Requirements:** CORE-09, NFR-04. **Decisions:** D11.

| Proposed column definition | Purpose/provenance |

|---|---|

| `document_id BIGINT REFERENCES core.documents(id)` | Metadata parent once committed |

| `operation TEXT NOT NULL` | Upload/render/mirror operation type |

| `object_key TEXT NOT NULL` | Immutable adapter key, no public URL authority |

| `content_sha256 TEXT` | Expected/confirmed bytes integrity |

| `size_bytes BIGINT` | Nonnegative confirmed size |

| `status TEXT NOT NULL` | Staged, committed, failed or orphan-review state |

| `source_key TEXT NOT NULL UNIQUE` | Stable render/upload/migration retry identity |

| `requested_by BIGINT REFERENCES core.users(id)` | Actor; NULL for authorized job |

**Integrity:** Valid size/hash/MIME under approved document type; access via authorized parent; no globally accessible raw storage keys. Retention/legal-hold subject to recovered scope.

**Atomic business boundary:** Persist intent, write object, then metadata/parent/audit commit; failures reconciled by intent, never silently delete issued documents.

**History:** Operational state allowed only through approved transition/audit/version rules; no implicit financial balance authority.


### att.source_receipts

**Grain:** One connector completeness receipt per device and covered interval. **Cards:** A01, A02, A05. **Requirements:** ATT-01, ATT-02, ATT-15. **Decisions:** D07, D11.

| Proposed column definition | Purpose/provenance |

|---|---|

| `device_id BIGINT NOT NULL REFERENCES att.devices(id)` | Device whose stream is certified |

| `source TEXT NOT NULL` | Real/simulation provenance |

| `covered_from TIMESTAMPTZ NOT NULL` | Interval start |

| `covered_through TIMESTAMPTZ NOT NULL` | Proven complete end; not last swipe arrival |

| `connector_reference TEXT NOT NULL` | Sanctioned source cursor/receipt |

| `has_gap BOOLEAN NOT NULL` | Explicit unresolved-gap indication |

| `source_key TEXT NOT NULL UNIQUE` | Idempotent receipt identity |

**Integrity:** covered_through >= covered_from; prohibit mock receipts in real namespace; stable device receipt uniqueness; gap receipt cannot advance completeness.

**Atomic business boundary:** Events/quarantine + receipt + monotonic device/source watermarks + dirty revision atomically.

**History:** Append-only rows; UPDATE/DELETE rejected by trigger and app grants; corrections reference original row.


### lv.credit_allocations

**Grain:** One debit/reversal allocation against a specific leave credit. **Cards:** A04. **Requirements:** LV-04, LV-05. **Decisions:** D02, D06, D11.

| Proposed column definition | Purpose/provenance |

|---|---|

| `credit_ledger_id BIGINT NOT NULL REFERENCES lv.ledger(id)` | Original earn/grant/accrual credit |

| `debit_ledger_id BIGINT NOT NULL REFERENCES lv.ledger(id)` | Application/expiry/encash debit or approved reversal |

| `units NUMERIC(5,2) NOT NULL` | Positive consumed units; reversal links original allocation below |

| `reverses_allocation_id BIGINT REFERENCES lv.credit_allocations(id)` | Compensation, never delete original allocation |

| `source_key TEXT NOT NULL UNIQUE` | Posting/allocation retry identity |

**Integrity:** Same employee/type and valid credit/debit polarity; units > 0; serially enforce sum of unreversed consumption <= credit. Allocation must not post a second balance debit. FIFO/expiry/cancellation policy signed first.

**Atomic business boundary:** Lock employee/type bucket and ordered credits; post ledger plus allocations, domain state, audit/outbox together.

**History:** Append-only rows; UPDATE/DELETE rejected by trigger and app grants; corrections reference original row.


### lv.operation_keys

**Grain:** One deterministic accrual/lapse/year-end operation. **Cards:** A04. **Requirements:** LV-02, LV-04, LV-05. **Decisions:** D02, D06, D11.

| Proposed column definition | Purpose/provenance |

|---|---|

| `employee_id BIGINT NOT NULL REFERENCES core.employees(id)` | Subject bucket |

| `leave_type_id BIGINT NOT NULL REFERENCES lv.leave_types(id)` | Leave bucket |

| `operation TEXT NOT NULL` | Accrual, expiry, year-end or approved correction kind |

| `period_from DATE NOT NULL` | Eligible operation period start |

| `period_to DATE NOT NULL` | Inclusive operation period end |

| `policy_version TEXT NOT NULL` | Approved effective policy identifier |

| `source_key TEXT NOT NULL UNIQUE` | Same occurrence on retry |

| `ledger_txn_id BIGINT REFERENCES lv.ledger(id)` | Actual once-only posting; nullable until committed decision |

**Integrity:** period_to >= period_from; deterministic occurrence uniqueness; backdated policy correction uses distinct authorized compensation, not another routine job credit.

**Atomic business boundary:** Check operation identity and lock bucket; ledger/allocation/operation/audit commit together.

**History:** Operational state allowed only through approved transition/audit/version rules; no implicit financial balance authority.


### pay.salary_structure_versions

**Grain:** One immutable published salary-template version. **Cards:** P01. **Requirements:** PAY-01, PAY-02. **Decisions:** D01, D10, D11.

| Proposed column definition | Purpose/provenance |

|---|---|

| `structure_id BIGINT NOT NULL REFERENCES pay.salary_structures(id)` | Existing template identity |

| `version INTEGER NOT NULL` | Positive template revision |

| `components JSONB NOT NULL` | Validated component/formula DAG; amounts represented as decimal strings |

| `policy_version TEXT NOT NULL` | Approved basis/proration/CTC policy |

| `published_by BIGINT NOT NULL REFERENCES core.users(id)` | Authorized publisher |

| `published_at TIMESTAMPTZ NOT NULL` | Publication time |

**Integrity:** UNIQUE(structure_id,version), version > 0; reject unknown components, cycles and unsafe expressions; no float money or guessed salary/rates.

**Atomic business boundary:** Approve/version template then salary assignment references exact version and approved effective range.

**History:** Append-only rows; UPDATE/DELETE rejected by trigger and app grants; corrections reference original row.


### pay.run_input_refs

**Grain:** One frozen input provenance entry per payroll result version. **Cards:** P02. **Requirements:** PAY-03, PAY-16, NFR-04. **Decisions:** D10, D11.

| Proposed column definition | Purpose/provenance |

|---|---|

| `run_id BIGINT NOT NULL REFERENCES pay.payroll_runs(id)` | Versioned result run |

| `employee_id BIGINT REFERENCES core.employees(id)` | NULL only for shared company policy source |

| `source_entity TEXT NOT NULL` | Allow-listed locked attendance/salary/policy/input/obligation kind |

| `source_id BIGINT NOT NULL` | Exact authoritative source PK |

| `source_version TEXT NOT NULL` | Frozen revision/checksum |

| `source_checksum TEXT NOT NULL` | Verifiable input snapshot digest |

**Integrity:** Unique(run,source kind,id,version,employee) including NULL shared sources; validate payer and eligibility as of period; complete expected employee/date population.

**Atomic business boundary:** Freeze references with inputs_locked under compatible attendance/version lock; result computation consumes that frozen set.

**History:** Append-only rows; UPDATE/DELETE rejected by trigger and app grants; corrections reference original row.


### pay.payment_obligations

**Grain:** One approved source amount owed to/from an employee/payer. **Cards:** P02, P04, P05, P06, A04, L05, T02. **Requirements:** PAY-05, PAY-08, LN-03, CLM-04, CLM-07. **Decisions:** D01, D10, D11.

| Proposed column definition | Purpose/provenance |

|---|---|

| `employee_id BIGINT NOT NULL REFERENCES core.employees(id)` | Payee or debtor |

| `company_id BIGINT NOT NULL REFERENCES core.companies(id)` | Legal payer/creditor frozen at source authorization |

| `direction TEXT NOT NULL` | Payable or recoverable |

| `amount NUMERIC(14,2) NOT NULL` | Approved positive INR amount, not display net or inventory cost |

| `source_kind TEXT NOT NULL` | Allow-listed salary/claim/loan/encash/travel/exit source |

| `source_id BIGINT NOT NULL` | Authoritative source PK, validated by domain handler/constraint |

| `source_version TEXT NOT NULL` | Approved source revision |

| `workflow_request_id BIGINT REFERENCES wf.requests(id)` | Source authorization when applicable |

| `source_key TEXT NOT NULL UNIQUE` | Same business obligation across retries |

**Integrity:** amount > 0; allowed direction; same employee/payer/version; polymorphic source requires explicit allow-list and trigger/domain checks, never assumed FK. Partial recovery/carry derives from immutable consumption/event sums.

**Atomic business boundary:** Create with final authorized domain posting + audit/outbox; consumers lock obligation and enforce remaining amount. No mutable balance authority.

**History:** Append-only rows; UPDATE/DELETE rejected by trigger and app grants; corrections reference original row.


### pay.source_consumptions

**Grain:** One immutable source obligation consumed by an accepted output/result. **Cards:** P02, P04, P05, P06, T02. **Requirements:** PAY-03, PAY-05, LN-03, CLM-04. **Decisions:** D10, D11.

| Proposed column definition | Purpose/provenance |

|---|---|

| `obligation_id BIGINT NOT NULL REFERENCES pay.payment_obligations(id)` | Approved source obligation |

| `payroll_item_id BIGINT REFERENCES pay.payroll_items(id)` | Payroll consumption route |

| `bank_batch_line_id BIGINT REFERENCES pay.bank_batch_lines(id)` | Off-cycle payment route |

| `amount NUMERIC(14,2) NOT NULL` | Positive reserved/consumed portion |

| `reverses_consumption_id BIGINT REFERENCES pay.source_consumptions(id)` | Authorized compensation after failed/voided route |

| `source_key TEXT NOT NULL UNIQUE` | Stable route/portion occurrence key |

**Integrity:** Exactly one route; same payer/subject; amount > 0; serialized total unreversed consumption <= approved amount. Single full-payout sources additionally unique active consumption. Final paid receipt separate from run consumption.

**Atomic business boundary:** Lock obligation; post accepted consumption, item/bank line, audit/outbox atomically; use compensating rows when release is authorized.

**History:** Append-only rows; UPDATE/DELETE rejected by trigger and app grants; corrections reference original row.


### pay.payment_events

**Grain:** One immutable external payment/recovery evidence event. **Cards:** P04, P05, P06, T02, L05. **Requirements:** PAY-05, PAY-08, CLM-04, LN-03. **Decisions:** D10, D11.

| Proposed column definition | Purpose/provenance |

|---|---|

| `obligation_id BIGINT NOT NULL REFERENCES pay.payment_obligations(id)` | Liability acknowledged or corrected |

| `bank_batch_line_id BIGINT REFERENCES pay.bank_batch_lines(id)` | Bank route if used |

| `event_type TEXT NOT NULL` | Submitted, accepted, paid, failed, uncertain, returned or verified recovery |

| `amount NUMERIC(14,2)` | Actual event amount; requiredness depends on event |

| `provider_reference TEXT` | Bank/cash/recovery acknowledgment |

| `occurred_at TIMESTAMPTZ NOT NULL` | Actual external business time |

| `evidence_document_id BIGINT REFERENCES core.documents(id)` | Authorized receipt/challan evidence |

| `recorded_by BIGINT REFERENCES core.users(id)` | Reviewer or authorized system |

| `source_key TEXT NOT NULL UNIQUE` | Callback/manual receipt dedupe |

**Integrity:** No queued event counted paid; receipt must match employee/company/amount/source; valid nonnegative amount; unique provider occurrence per channel. Manual evidence requires independent review.

**Atomic business boundary:** Persist external intent; call outside transaction; authenticate/dedupe receipt and post event + audit. Timeout stays uncertain.

**History:** Append-only rows; UPDATE/DELETE rejected by trigger and app grants; corrections reference original row.


### pay.bank_batch_lines

**Grain:** One payable obligation portion in one frozen bank file version. **Cards:** P04, P06. **Requirements:** PAY-05, CLM-04. **Decisions:** D10, D11.

| Proposed column definition | Purpose/provenance |

|---|---|

| `batch_id BIGINT NOT NULL REFERENCES pay.bank_batches(id)` | Frozen batch header |

| `obligation_id BIGINT NOT NULL REFERENCES pay.payment_obligations(id)` | What is paid |

| `employee_id BIGINT NOT NULL REFERENCES core.employees(id)` | Verified payee |

| `amount NUMERIC(14,2) NOT NULL` | Positive INR amount |

| `payee_snapshot JSONB NOT NULL` | Restricted validated bank details snapshot; masked in API/logs |

| `payment_reference TEXT NOT NULL` | Stable bank submission reference |

**Integrity:** UNIQUE(batch_id,payment_reference); amount > 0; cross-check batch payer/employee/obligation and batch count/sum; prevent duplication through source_consumptions, not merely uniqueness inside a batch.

**Atomic business boundary:** Lock obligations; construct frozen rows/control sums/document intent/consumption/audit atomically before external submit.

**History:** Append-only rows; UPDATE/DELETE rejected by trigger and app grants; corrections reference original row.


### pay.output_artifacts

**Grain:** One immutable result/return/document artifact version. **Cards:** P03, P04, P07. **Requirements:** PAY-05, PAY-06, PAY-09, PAY-10, PAY-11, PAY-12, PAY-13. **Decisions:** D01, D10, D11.

| Proposed column definition | Purpose/provenance |

|---|---|

| `run_id BIGINT REFERENCES pay.payroll_runs(id)` | Source run when monthly |

| `company_id BIGINT NOT NULL REFERENCES core.companies(id)` | Legal entity for output |

| `employee_id BIGINT REFERENCES core.employees(id)` | Own payslip/Form16, NULL company return |

| `kind TEXT NOT NULL` | Regular/OT/reimbursement payslip, bank/JV/statutory/Form16 artifact type |

| `period_from DATE NOT NULL` | Artifact period |

| `period_to DATE NOT NULL` | Artifact period end |

| `version INTEGER NOT NULL` | Output revision |

| `source_checksum TEXT NOT NULL` | Frozen result/rate/template digest |

| `document_id BIGINT NOT NULL REFERENCES core.documents(id)` | Immutable stored bytes |

| `control_amount NUMERIC(16,2)` | Applicable output control amount |

| `record_count INTEGER` | Applicable record count |

| `source_key TEXT NOT NULL UNIQUE` | Render/export retry identity |

**Integrity:** Valid period/version/count; subject/payer matches source; independent totals equal register; original and amendment retained. File generation does not certify filing/payment.

**Atomic business boundary:** Stage bytes then metadata/artifact/audit registration; require maker-checker and frozen input version.

**History:** Append-only rows; UPDATE/DELETE rejected by trigger and app grants; corrections reference original row.


### pay.statutory_memberships

**Grain:** One effective employee/entity/scheme eligibility interval. **Cards:** P03. **Requirements:** PAY-09, PAY-10, PAY-14. **Decisions:** D01, D11.

| Proposed column definition | Purpose/provenance |

|---|---|

| `employee_id BIGINT NOT NULL REFERENCES core.employees(id)` | Covered person |

| `company_id BIGINT NOT NULL REFERENCES core.companies(id)` | Establishment/legal payer |

| `scheme TEXT NOT NULL` | Approved PF/EPS/ESIC/PT/LWF/bonus/gratuity applicability kind |

| `effective_from DATE NOT NULL` | Eligibility/contribution-period start |

| `effective_to DATE` | Exclusive period end |

| `is_covered BOOLEAN NOT NULL` | Reviewed eligibility, not category inference |

| `basis_salary_id BIGINT REFERENCES pay.employee_salaries(id)` | Salary evidence establishing coverage |

| `policy_version TEXT NOT NULL` | Applicable signed policy/rate set |

| `evidence_document_id BIGINT REFERENCES core.documents(id)` | Membership/exemption evidence |

**Integrity:** Temporal EXCLUDE(employee,company,scheme,range); interval valid; preserve ESIC period eligibility independently from actual contribution wages; D01 controls rules, no rate seed.

**Atomic business boundary:** Review eligibility under person/period lock; finalize immutable coverage snapshot in each run.

**History:** Operational state allowed only through approved transition/audit/version rules; no implicit financial balance authority.


### pay.tax_elections

**Grain:** One authorized employee/FY election version. **Cards:** P03. **Requirements:** PAY-13. **Decisions:** D01, D11.

| Proposed column definition | Purpose/provenance |

|---|---|

| `employee_id BIGINT NOT NULL REFERENCES core.employees(id)` | Tax subject |

| `fy TEXT NOT NULL` | Approved FY identifier |

| `version INTEGER NOT NULL` | Election revision |

| `regime TEXT NOT NULL` | Approved regime identifier |

| `submitted_at TIMESTAMPTZ NOT NULL` | Election time |

| `effective_from DATE NOT NULL` | Approved applicability date |

| `workflow_request_id BIGINT REFERENCES wf.requests(id)` | Review when policy requires |

**Integrity:** UNIQUE(employee_id,fy,version); one approved effective election at calculation time; permitted changes signed under D01.

**Atomic business boundary:** Append election/review and freeze elected version in result inputs.

**History:** Append-only rows; UPDATE/DELETE rejected by trigger and app grants; corrections reference original row.


### pay.previous_employer_income

**Grain:** One verified prior-employer/FY declaration version. **Cards:** P03. **Requirements:** PAY-13. **Decisions:** D01, D11.

| Proposed column definition | Purpose/provenance |

|---|---|

| `employee_id BIGINT NOT NULL REFERENCES core.employees(id)` | Current employee |

| `fy TEXT NOT NULL` | Tax year |

| `employer_reference TEXT NOT NULL` | Declared prior employer identity |

| `version INTEGER NOT NULL` | Declaration revision |

| `taxable_income NUMERIC(14,2) NOT NULL` | Verified income basis |

| `tds_paid NUMERIC(14,2) NOT NULL` | TDS evidence, not current payroll deduction |

| `proof_document_id BIGINT REFERENCES core.documents(id)` | Form12B/supporting proof |

| `verified_by BIGINT REFERENCES core.users(id)` | Authorized verifier |

| `verified_at TIMESTAMPTZ` | Verification time |

**Integrity:** Unique employee/FY/employer/version; nonnegative amounts; missing verification is not zero income; sum authoritative accepted declaration versions only.

**Atomic business boundary:** Review/append version; source freeze distinguishes declared from verified windows.

**History:** Append-only rows; UPDATE/DELETE rejected by trigger and app grants; corrections reference original row.


### pay.statutory_postings

**Grain:** One immutable result-linked liability/YTD movement. **Cards:** P03, P07. **Requirements:** PAY-09, PAY-10, PAY-11, PAY-12, PAY-13, PAY-17. **Decisions:** D01, D11.

| Proposed column definition | Purpose/provenance |

|---|---|

| `item_id BIGINT REFERENCES pay.payroll_items(id)` | Payroll result source; opening import may be NULL |

| `import_batch_id BIGINT REFERENCES core.import_batches(id)` | Signed opening balance source, never both opening and same historic movements |

| `employee_id BIGINT REFERENCES core.employees(id)` | NULL for true establishment-level liabilities |

| `company_id BIGINT NOT NULL REFERENCES core.companies(id)` | Establishment entity |

| `scheme TEXT NOT NULL` | Signed liability scheme |

| `period DATE NOT NULL` | Monthly/approved period key |

| `component_code TEXT NOT NULL` | EE/ER/EPS/tax or approved head |

| `amount NUMERIC(14,2) NOT NULL` | Signed movement; correction references original |

| `policy_version TEXT NOT NULL` | Effective rules used |

| `reverses_posting_id BIGINT REFERENCES pay.statutory_postings(id)` | Authorized immutable correction |

| `source_key TEXT NOT NULL UNIQUE` | Once-only liability/opening occurrence |

**Integrity:** Exactly one result/import source; validate scheme/component and source payer/person; immutable signed movement; YTD = SUM accepted postings, no counter. Avoid counting both item lines and duplicate liability ledger as expense.

**Atomic business boundary:** Create postings with accepted result version; new correction version posts authorized delta.

**History:** Append-only rows; UPDATE/DELETE rejected by trigger and app grants; corrections reference original row.


### pay.journal_batches

**Grain:** One frozen balanced JV version per accepted result. **Cards:** P04. **Requirements:** PAY-05. **Decisions:** D10, D11.

| Proposed column definition | Purpose/provenance |

|---|---|

| `run_id BIGINT NOT NULL REFERENCES pay.payroll_runs(id)` | Source frozen run |

| `version INTEGER NOT NULL` | JV/export revision |

| `document_id BIGINT REFERENCES core.documents(id)` | SAP-consumable artifact |

| `source_checksum TEXT NOT NULL` | Result/GL-map version digest |

| `approved_by BIGINT REFERENCES core.users(id)` | Reviewed export |

**Integrity:** UNIQUE(run_id,version); version > 0; sum debits = credits to paise before ready; GL mapping version pinned.

**Atomic business boundary:** Batch+lines+independent control totals+artifact intent+audit transaction; SAP acknowledgment external.

**History:** Append-only rows; UPDATE/DELETE rejected by trigger and app grants; corrections reference original row.


### pay.journal_lines

**Grain:** One GL/cost-center allocation line in a JV batch. **Cards:** P04. **Requirements:** PAY-05. **Decisions:** D10, D11.

| Proposed column definition | Purpose/provenance |

|---|---|

| `batch_id BIGINT NOT NULL REFERENCES pay.journal_batches(id)` | Frozen JV header |

| `cost_center_id BIGINT REFERENCES core.cost_centers(id)` | Historical allocation, NULL only approved default |

| `gl_code TEXT NOT NULL` | Frozen approved SAP GL mapping |

| `debit NUMERIC(16,2) NOT NULL` | Nonnegative debit |

| `credit NUMERIC(16,2) NOT NULL` | Nonnegative credit |

| `source_component_code TEXT NOT NULL` | Explainable payroll aggregation head |

**Integrity:** Exactly one positive side; same company allocation; no fan-out double aggregation; batch deferred balance constraint/validator required.

**Atomic business boundary:** Insert only with parent balanced frozen JV.

**History:** Append-only rows; UPDATE/DELETE rejected by trigger and app grants; corrections reference original row.


### pay.loan_installments

**Grain:** One authorized scheduled installment/version for a loan. **Cards:** P05. **Requirements:** LN-01, LN-03. **Decisions:** D10, D11.

| Proposed column definition | Purpose/provenance |

|---|---|

| `loan_id BIGINT NOT NULL REFERENCES pay.loans(id)` | Approved/funded loan |

| `schedule_version INTEGER NOT NULL` | Approved reschedule version |

| `installment_no INTEGER NOT NULL` | Positive ordinal |

| `month DATE NOT NULL` | Due period first day |

| `principal_part NUMERIC(14,2) NOT NULL` | Planned principal recovery |

| `interest_part NUMERIC(14,2) NOT NULL` | Planned interest, signed method |

**Integrity:** UNIQUE(loan_id,schedule_version,installment_no); principal/interest >= 0; approved schedule principal sum reconciles funded balance; actual recoveries are postings/receipts, not schedule status.

**Atomic business boundary:** Create reviewed schedule after funding decision; missed/partial recovery adds postings/carry events, never decrements mutable outstanding.

**History:** Append-only rows; UPDATE/DELETE rejected by trigger and app grants; corrections reference original row.


### pay.parallel_comparisons

**Grain:** One frozen external register versus HRMS result comparison. **Cards:** P07. **Requirements:** PAY-03. **Decisions:** D11.

| Proposed column definition | Purpose/provenance |

|---|---|

| `run_id BIGINT NOT NULL REFERENCES pay.payroll_runs(id)` | Compared result version |

| `import_batch_id BIGINT NOT NULL REFERENCES core.import_batches(id)` | Frozen signed vendor export |

| `status TEXT NOT NULL` | Open or signed comparison disposition |

| `reviewed_by BIGINT REFERENCES core.users(id)` | HR/Finance reviewer |

| `reviewed_at TIMESTAMPTZ` | Sign-off time |

**Integrity:** UNIQUE(run_id,import_batch_id); required tolerances established before run; every variance dispositioned; two consecutive cycles remain original gate.

**Atomic business boundary:** Comparison creation/lines together; human sign-off appends audit evidence.

**History:** Operational state allowed only through approved transition/audit/version rules; no implicit financial balance authority.


### pay.parallel_comparison_lines

**Grain:** One employee/component variance with source lineage. **Cards:** P07. **Requirements:** PAY-03. **Decisions:** D11.

| Proposed column definition | Purpose/provenance |

|---|---|

| `comparison_id BIGINT NOT NULL REFERENCES pay.parallel_comparisons(id)` | Parent comparison |

| `employee_id BIGINT NOT NULL REFERENCES core.employees(id)` | Exact reviewed e-code mapping |

| `component_code TEXT NOT NULL` | Approved mapping to component |

| `external_amount NUMERIC(14,2) NOT NULL` | Frozen vendor amount |

| `hrms_amount NUMERIC(14,2) NOT NULL` | Frozen HRMS amount |

| `disposition TEXT` | Explained rounding, true error or approved difference |

| `review_note TEXT` | Independent explanation/evidence |

**Integrity:** Unique comparison/employee/component; difference derived exactly, no float or silent tolerance; gross reconciliation precedes net.

**Atomic business boundary:** Create exact comparison snapshot; reviewed disposition audited without changing money sources.

**History:** Operational state allowed only through approved transition/audit/version rules; no implicit financial balance authority.


### core.prejoin_invitations

**Grain:** One purpose-scoped invitation issuance, not a reusable login. **Cards:** L01, F03. **Requirements:** LC-01, NFR-03. **Decisions:** D03, D11.

| Proposed column definition | Purpose/provenance |

|---|---|

| `candidate_id BIGINT NOT NULL REFERENCES core.onboarding_candidates(id)` | Authorized prejoin subject |

| `token_digest TEXT NOT NULL UNIQUE` | Hash of random token; plaintext token never stored in DB/logs |

| `expires_at TIMESTAMPTZ NOT NULL` | Signed expiry policy |

| `issued_by BIGINT NOT NULL REFERENCES core.users(id)` | Authorized inviter |

| `consumed_at TIMESTAMPTZ` | Once-only completion when contract requires |

| `revoked_at TIMESTAMPTZ` | Resend/revocation without deleting history |

| `notification_id BIGINT REFERENCES wf.notifications(id)` | Actual dispatch/receipt trace |

| `source_key TEXT NOT NULL UNIQUE` | Issuance retry identity |

**Integrity:** Expiry after issuance; scoped form/document-only grant, never employee/payroll login; old plaintext tokens invalidated safely after reviewed cutover.

**Atomic business boundary:** Create candidate-bound invitation/outbox/audit; consume via conditional subject/expiry check in validated completion transaction.

**History:** Operational state allowed only through approved transition/audit/version rules; no implicit financial balance authority.


### core.transfer_requests

**Grain:** One approved effective placement change request. **Cards:** L03. **Requirements:** LC-05. **Decisions:** D07, D09, D10, D11.

| Proposed column definition | Purpose/provenance |

|---|---|

| `employee_id BIGINT NOT NULL REFERENCES core.employees(id)` | Continuing person |

| `from_assignment_id BIGINT NOT NULL REFERENCES core.employee_assignments(id)` | Verified old placement/version |

| `to_company_id BIGINT NOT NULL REFERENCES core.companies(id)` | Intended legal employer |

| `to_location_id BIGINT NOT NULL REFERENCES core.locations(id)` | Intended location |

| `to_org_unit_id BIGINT NOT NULL REFERENCES core.org_units(id)` | Intended OU |

| `to_cost_center_id BIGINT NOT NULL REFERENCES core.cost_centers(id)` | Intended allocation |

| `effective_date DATE NOT NULL` | Authorized business boundary |

| `proposed_change JSONB NOT NULL` | Typed approved designation/grade/manager changes, not arbitrary employee patch |

| `workflow_request_id BIGINT NOT NULL REFERENCES wf.requests(id)` | Current/receiving manager + HR authorization |

| `applied_assignment_id BIGINT REFERENCES core.employee_assignments(id)` | Actual once-only result |

**Integrity:** Same subject in request/from/applied assignments; selected target links belong to target company; e-code and payer/YTD continuity signed; FK alone not sufficient.

**Atomic business boundary:** Final approved revision schedules effective application; apply under employee lock with interval/history/projection/audit/outbox and dirty fact revisions.

**History:** Operational state allowed only through approved transition/audit/version rules; no implicit financial balance authority.


### ast.custody_events

**Grain:** One immutable physical receipt/loss/clearance disposition. **Cards:** W01, L04. **Requirements:** AST-04, AST-05. **Decisions:** D11.

| Proposed column definition | Purpose/provenance |

|---|---|

| `assignment_id BIGINT NOT NULL REFERENCES ast.assignments(id)` | Original custody record |

| `event_type TEXT NOT NULL` | Physical return, not-returned, damage, write-off or clearance disposition |

| `occurred_at TIMESTAMPTZ NOT NULL` | Actual physical/business time |

| `recorded_by BIGINT NOT NULL REFERENCES core.users(id)` | Responsible actor |

| `separation_id BIGINT REFERENCES core.separations(id)` | Exit clearance context when applicable |

| `recovery_obligation_id BIGINT REFERENCES pay.payment_obligations(id)` | Separately approved loss recovery, not inventory cost auto-deduction |

| `note TEXT NOT NULL` | Condition/evidence/reason |

| `source_key TEXT NOT NULL UNIQUE` | Once-only disposition occurrence |

**Integrity:** Same employee/asset/separation; physical receipt alone closes custody and returns eligible stock. Not-returned must keep outstanding custody; final write-off does not fabricate receipt.

**Atomic business boundary:** Lock assignment/asset; event+allowed custody/status projection+clearance/audit/outbox together.

**History:** Append-only rows; UPDATE/DELETE rejected by trigger and app grants; corrections reference original row.


### hd.ticket_events

**Grain:** One immutable ticket lifecycle/SLA-cycle event. **Cards:** W02. **Requirements:** HD-01. **Decisions:** D04, D11.

| Proposed column definition | Purpose/provenance |

|---|---|

| `ticket_id BIGINT NOT NULL REFERENCES hd.tickets(id)` | Authorized ticket subject |

| `cycle_no INTEGER NOT NULL` | Reopen cycle identifier |

| `event_type TEXT NOT NULL` | Created, assigned, ack-receipt, escalated, resolved, reopened or closed |

| `actor_user_id BIGINT REFERENCES core.users(id)` | Authorized participant/agent or system |

| `assignee_user_id BIGINT REFERENCES core.users(id)` | Actual recipient/agent |

| `occurred_at TIMESTAMPTZ NOT NULL` | Business event time |

| `sla_due_at TIMESTAMPTZ` | Frozen due date for this cycle/event |

| `notification_id BIGINT REFERENCES wf.notifications(id)` | Actual intimation trace |

| `source_key TEXT NOT NULL UNIQUE` | Concurrent sweep/receipt dedupe |

**Integrity:** cycle_no > 0; scoped participant/agent rules; resolution after SLA remains a breach in history; ordered events validated under ticket lock.

**Atomic business boundary:** Ticket projection+event+notification/audit together; reopen begins new cycle without erasing earlier hit/miss.

**History:** Append-only rows; UPDATE/DELETE rejected by trigger and app grants; corrections reference original row.


### hd.escalation_rules

**Grain:** One effective category/level routing rule. **Cards:** W02. **Requirements:** HD-01. **Decisions:** D03, D04, D11.

| Proposed column definition | Purpose/provenance |

|---|---|

| `category_id BIGINT NOT NULL REFERENCES hd.categories(id)` | Existing configurable category |

| `level INTEGER NOT NULL` | Escalation level |

| `recipient_kind TEXT NOT NULL` | Approved role/user/relative selector |

| `recipient_ref TEXT NOT NULL` | Validated selector reference; runtime subject scope enforced |

| `policy_version TEXT NOT NULL` | SLA/calendar/routing version |

| `is_active BOOLEAN NOT NULL` | Published applicability |

**Integrity:** Unique category/policy/level; contiguous level order; invalid/vacant recipient visibly rejected, not silent reuse of same assignee.

**Atomic business boundary:** Publish audited configuration; sweep locks cycle/version and enqueues eligible recipient once.

**History:** Operational state allowed only through approved transition/audit/version rules; no implicit financial balance authority.


### core.policy_versions

**Grain:** One immutable published policy content/audience version. **Cards:** W03. **Requirements:** CORE-13, EN-04. **Decisions:** D03, D11.

| Proposed column definition | Purpose/provenance |

|---|---|

| `policy_id BIGINT NOT NULL REFERENCES core.policies(id)` | Policy identity |

| `version INTEGER NOT NULL` | Published revision |

| `document_id BIGINT NOT NULL REFERENCES core.documents(id)` | Exact immutable policy bytes |

| `effective_date DATE NOT NULL` | Effective business date |

| `audience JSONB NOT NULL` | Approved typed population filter; same query for read/ack/tile/reminder/report |

| `published_by BIGINT NOT NULL REFERENCES core.users(id)` | Authorized policy publisher |

**Integrity:** UNIQUE(policy_id,version); acknowledgment must reference version; historical legitimate acknowledgments retained and not mixed across populations.

**Atomic business boundary:** Publish version/audit/outbox; acknowledgment checks effective eligibility and inserts unique employee/version receipt.

**History:** Append-only rows; UPDATE/DELETE rejected by trigger and app grants; corrections reference original row.


### reporting.snapshot_builds

**Grain:** One versioned reporting build with source population/freshness. **Cards:** W04, A05. **Requirements:** RPT-01, RPT-03, RPT-04. **Decisions:** D05, D11.

| Proposed column definition | Purpose/provenance |

|---|---|

| `company_id BIGINT REFERENCES core.companies(id)` | NULL only explicit reviewed aggregate scope |

| `period_from DATE NOT NULL` | Source period |

| `period_to DATE NOT NULL` | Source period end |

| `kind TEXT NOT NULL` | Muster/KPI/report build type |

| `source_revision TEXT NOT NULL` | Attendance/result/placement/policy digest |

| `formula_version TEXT NOT NULL` | Approved denominator/metric definition |

| `expected_records INTEGER NOT NULL` | Full eligible population/dates, not only processed rows |

| `processed_records INTEGER NOT NULL` | Actually processed source count |

| `completed_at TIMESTAMPTZ` | Completed build timestamp |

| `unavailable_reason TEXT` | Explicit incomplete/uncomputable result |

| `source_key TEXT NOT NULL UNIQUE` | Build retry identity |

**Integrity:** Valid period/nonnegative counts; complete iff correct population/missing rows reconciled; child snapshots carry build_id and frozen scope dimensions; null value is not zero.

**Atomic business boundary:** Build staging snapshot, reconcile exact totals, publish build+child rows in bounded atomic swap; hot paths read scoped snapshots.

**History:** Operational state allowed only through approved transition/audit/version rules; no implicit financial balance authority.


### te.trips

**Grain:** One employee/payer travel intent revision. **Cards:** T01, T02. **Requirements:** TE-01, TE-02. **Decisions:** D10, D11.

| Proposed column definition | Purpose/provenance |

|---|---|

| `employee_id BIGINT NOT NULL REFERENCES core.employees(id)` | Traveler |

| `company_id BIGINT NOT NULL REFERENCES core.companies(id)` | Accountable payer |

| `reference TEXT NOT NULL UNIQUE` | Human trip reference |

| `travel_type TEXT NOT NULL` | Approved domestic/international taxonomy |

| `purpose TEXT NOT NULL` | Business justification |

| `start_date DATE NOT NULL` | Intended first travel date |

| `end_date DATE NOT NULL` | Intended final travel date |

| `policy_version_id BIGINT NOT NULL REFERENCES te.policy_versions(id)` | Approved travel policy |

| `workflow_request_id BIGINT REFERENCES wf.requests(id)` | Authorization trace |

| `status TEXT NOT NULL` | Approved ported EMS state vocabulary |

| `source_key TEXT NOT NULL UNIQUE` | Source/import/create identity |

**Integrity:** Valid dates/payer/subject; exact EMS model capture required for uncaptured 40+ budget fields; travel tier != HR pay grade.

**Atomic business boundary:** Create/approve immutable revision and link existing pay.budgets as authoritative budget; no duplicate te.budgets.

**History:** Operational state allowed only through approved transition/audit/version rules; no implicit financial balance authority.


### te.itinerary_segments

**Grain:** One ordered trip/segment with stay/travel evidence. **Cards:** T01, T03. **Requirements:** TE-02, TE-04. **Decisions:** D10, D11.

| Proposed column definition | Purpose/provenance |

|---|---|

| `trip_id BIGINT NOT NULL REFERENCES te.trips(id)` | Parent trip |

| `segment_no INTEGER NOT NULL` | Stable segment ordinal |

| `kind TEXT NOT NULL` | Flight/train/bus/hotel/car/visa per approved contract |

| `from_location TEXT` | Source/provider-normalized origin |

| `to_location TEXT` | Destination/stay location |

| `starts_at TIMESTAMPTZ NOT NULL` | Segment/stay start |

| `ends_at TIMESTAMPTZ NOT NULL` | Segment/stay end |

| `own_arrangement_reason TEXT` | Required when approved self-arranged booking branch is chosen |

**Integrity:** UNIQUE(trip_id,segment_no), valid chronology, approved overlap/stay/night-count rules; IDs remain stable across revision/cancel.

**Atomic business boundary:** Trip revision/segment/budget amendment is validated and reapproved when policy changes obligations.

**History:** Operational state allowed only through approved transition/audit/version rules; no implicit financial balance authority.


### te.travel_levels

**Grain:** One source-approved domestic/international entitlement tier. **Cards:** T01. **Requirements:** TE-03, TE-06. **Decisions:** D10, D11.

| Proposed column definition | Purpose/provenance |

|---|---|

| `code TEXT NOT NULL UNIQUE` | Exact approved EMS tier identifier |

| `name TEXT NOT NULL` | Human label |

| `travel_type TEXT NOT NULL` | Domestic or international applicability |

**Integrity:** No guessed rate/class from level name; capture EMS policy and mapping first.

**Atomic business boundary:** Publish audited lookup/mapping; missing verified tier blocks budget rather than defaulting.

**History:** Operational state allowed only through approved transition/audit/version rules; no implicit financial balance authority.


### te.employee_travel_levels

**Grain:** One effective employee travel-tier assignment. **Cards:** T01. **Requirements:** TE-03. **Decisions:** D09, D10, D11.

| Proposed column definition | Purpose/provenance |

|---|---|

| `employee_id BIGINT NOT NULL REFERENCES core.employees(id)` | Traveler |

| `level_id BIGINT NOT NULL REFERENCES te.travel_levels(id)` | Approved travel tier |

| `travel_type TEXT NOT NULL` | Tier applicability dimension |

| `effective_from DATE NOT NULL` | Assignment starts |

| `effective_to DATE` | Exclusive end |

| `source_key TEXT NOT NULL UNIQUE` | Approved import/change identity |

**Integrity:** Valid interval and EXCLUDE(employee,travel_type,range); source travel class is independent of core.grades.

**Atomic business boundary:** Lock employee/type; reviewed effective change+audit; old trip keeps approved tier/policy snapshot.

**History:** Operational state allowed only through approved transition/audit/version rules; no implicit financial balance authority.


### te.policy_versions

**Grain:** One reviewed effective travel-policy publication. **Cards:** T01, T02. **Requirements:** TE-03, TE-06. **Decisions:** D10, D11.

| Proposed column definition | Purpose/provenance |

|---|---|

| `version INTEGER NOT NULL` | Published positive revision |

| `travel_type TEXT NOT NULL` | Applicability taxonomy |

| `policy JSONB NOT NULL` | Exact typed ported allowances/booking/limit rules; decimal strings for amounts |

| `effective_from DATE NOT NULL` | Applicability start |

| `effective_to DATE` | Exclusive end |

| `source_checksum TEXT NOT NULL` | Reviewed EMS rules/spec digest |

| `approved_by BIGINT NOT NULL REFERENCES core.users(id)` | HR/Finance policy owner |

**Integrity:** Valid nonoverlapping policy scope/range; no invented rates/amount thresholds/foreign currency precision. JSON contract must be captured, reviewed and versioned.

**Atomic business boundary:** Publish only approved typed policy; trip/budget references version and travel-level evidence.

**History:** Append-only rows; UPDATE/DELETE rejected by trigger and app grants; corrections reference original row.


### te.currency_rates

**Grain:** One captured currency-to-INR source quote. **Cards:** T01, T02. **Requirements:** TE-05. **Decisions:** D10, D11.

| Proposed column definition | Purpose/provenance |

|---|---|

| `currency_code TEXT NOT NULL` | Approved ISO/source currency identifier |

| `rate_to_inr NUMERIC(20,10) NOT NULL` | Proposed precision; D10 must confirm source/currency rounding |

| `quoted_at TIMESTAMPTZ NOT NULL` | Effective quote time |

| `source TEXT NOT NULL` | Approved rate provider/manual evidence |

| `source_reference TEXT NOT NULL` | Stable source quote ID |

| `approved_by BIGINT REFERENCES core.users(id)` | Manual quote reviewer if applicable |

**Integrity:** rate > 0; UNIQUE(currency,source,source_reference); currency minor units and conversion rounding signed before computation; retain original line amount and captured rate.

**Atomic business boundary:** Capture quote then freeze in each claim/line; never recompute settled history at today’s rate.

**History:** Append-only rows; UPDATE/DELETE rejected by trigger and app grants; corrections reference original row.


### te.advances

**Grain:** One approved accountable advance, authorization distinct from funding. **Cards:** T02. **Requirements:** TE-07, LN-04. **Decisions:** D10, D11.

| Proposed column definition | Purpose/provenance |

|---|---|

| `trip_id BIGINT NOT NULL REFERENCES te.trips(id)` | Travel purpose |

| `budget_id BIGINT NOT NULL REFERENCES pay.budgets(id)` | Existing authorized budget |

| `employee_id BIGINT NOT NULL REFERENCES core.employees(id)` | Traveler/debtor |

| `company_id BIGINT NOT NULL REFERENCES core.companies(id)` | Actual funder |

| `requested_amount NUMERIC(14,2) NOT NULL` | Requested INR preview |

| `approved_amount NUMERIC(14,2)` | Final authorized amount |

| `workflow_request_id BIGINT NOT NULL REFERENCES wf.requests(id)` | Approval trace |

| `funding_obligation_id BIGINT REFERENCES pay.payment_obligations(id)` | Actual funding obligation/payment evidence |

| `source_key TEXT NOT NULL UNIQUE` | Advance occurrence retry identity |

**Integrity:** Positive request/nonnegative approval; same trip/budget/employee/payer; do not recover undisbursed funds unless signed D10 model explicitly authorizes committed funding semantics.

**Atomic business boundary:** Approve domain/obligation once; acknowledged funding creates wallet posting under same source identity.

**History:** Operational state allowed only through approved transition/audit/version rules; no implicit financial balance authority.


### te.wallet_postings

**Grain:** One immutable accountable-funds movement. **Cards:** T02, T04. **Requirements:** TE-08, TE-09, LN-04. **Decisions:** D10, D11.

| Proposed column definition | Purpose/provenance |

|---|---|

| `employee_id BIGINT NOT NULL REFERENCES core.employees(id)` | Wallet subject |

| `company_id BIGINT NOT NULL REFERENCES core.companies(id)` | Accountable payer, never cross-entity silent net |

| `advance_id BIGINT REFERENCES te.advances(id)` | Advance funding/return source |

| `settlement_id BIGINT REFERENCES te.settlements(id)` | Expense clearing source |

| `import_batch_id BIGINT REFERENCES core.import_batches(id)` | Signed opening import instead of duplicated historical movements |

| `delta NUMERIC(14,2) NOT NULL` | Signed INR credit/debit |

| `original_amount NUMERIC(20,6)` | Proposed precision subject to D10 |

| `original_currency TEXT` | Original approved currency |

| `currency_rate_id BIGINT REFERENCES te.currency_rates(id)` | Captured conversion evidence |

| `reverses_posting_id BIGINT REFERENCES te.wallet_postings(id)` | Compensation, never edit posting |

| `transaction_reference TEXT NOT NULL UNIQUE` | EMS idempotency key preserved |

**Integrity:** Exactly one source kind, validated same employee/payer; original currency amount/rate group consistent. Wallet = SUM(delta); optional balanceAfter projection is not authority.

**Atomic business boundary:** Lock subject/payer; source event+wallet movement+settlement/reservation/audit/outbox atomic.

**History:** Append-only rows; UPDATE/DELETE rejected by trigger and app grants; corrections reference original row.


### te.settlements

**Grain:** One approved claim revision settlement result. **Cards:** T02. **Requirements:** TE-09, TE-10, CLM-07. **Decisions:** D10, D11.

| Proposed column definition | Purpose/provenance |

|---|---|

| `claim_id BIGINT NOT NULL REFERENCES pay.claims(id)` | Shared authoritative claim; no parallel te.claims |

| `claim_revision INTEGER NOT NULL` | Frozen approved claim revision |

| `employee_id BIGINT NOT NULL REFERENCES core.employees(id)` | Subject |

| `company_id BIGINT NOT NULL REFERENCES core.companies(id)` | Payer |

| `mode TEXT NOT NULL` | AUTO/MANUAL per approved port contract |

| `approved_expense NUMERIC(14,2) NOT NULL` | Verified eligible INR expense |

| `advance_cleared NUMERIC(14,2) NOT NULL` | Eligible funded advance actually allocated |

| `net_amount NUMERIC(14,2) NOT NULL` | Signed expense minus accountable advance under approved model |

| `net_obligation_id BIGINT REFERENCES pay.payment_obligations(id)` | Positive payable or recoverable; NULL for exact zero |

| `settled_by BIGINT NOT NULL REFERENCES core.users(id)` | Authorized settlement actor |

| `settled_at TIMESTAMPTZ NOT NULL` | Business settlement time |

| `source_key TEXT NOT NULL UNIQUE` | Once-only settlement identity |

**Integrity:** UNIQUE(claim_id,claim_revision); nonnegative expense/cleared; signed net independently reconciled under D10; eligible advances may exceed expense, remainder explicitly payable/recoverable. Exact same payer/employee; settlement does not certify net paid/recovered.

**Atomic business boundary:** Lock claim revision/budget/wallet; settlement, advance allocations, wallet postings, reservation release, net obligation, audit/outbox atomically.

**History:** Append-only rows; UPDATE/DELETE rejected by trigger and app grants; corrections reference original row.


### te.settlement_advances

**Grain:** One settlement allocation against a funded advance. **Cards:** T02. **Requirements:** TE-09, CLM-07. **Decisions:** D10, D11.

| Proposed column definition | Purpose/provenance |

|---|---|

| `settlement_id BIGINT NOT NULL REFERENCES te.settlements(id)` | Frozen settlement |

| `advance_id BIGINT NOT NULL REFERENCES te.advances(id)` | Acknowledged funded advance |

| `allocated_amount NUMERIC(14,2) NOT NULL` | Positive allocated portion |

| `source_key TEXT NOT NULL UNIQUE` | Allocation occurrence identity |

**Integrity:** UNIQUE(settlement_id,advance_id); amount > 0; same subject/payer/trip; serial total allocations/returns cannot exceed eligible funds.

**Atomic business boundary:** Post inside settlement transaction with advance/wallet lock.

**History:** Append-only rows; UPDATE/DELETE rejected by trigger and app grants; corrections reference original row.


### te.booking_operations

**Grain:** One durable booking/cancel/refund provider intent. **Cards:** T03. **Requirements:** TE-04. **Decisions:** D10, D11.

| Proposed column definition | Purpose/provenance |

|---|---|

| `segment_id BIGINT NOT NULL REFERENCES te.itinerary_segments(id)` | Authorized itinerary segment |

| `operation TEXT NOT NULL` | Approved booking/cancellation/refund contract kind |

| `provider TEXT NOT NULL` | Swappable provider identifier |

| `provider_reference TEXT` | Returned stable provider booking/operation ID |

| `status TEXT NOT NULL` | Requested, accepted, failed or uncertain under captured contract |

| `request_checksum TEXT NOT NULL` | Approved request version digest |

| `source_key TEXT NOT NULL UNIQUE` | Provider operation retry key |

**Integrity:** No guessed provider endpoints/statuses/URLs; allowable input/output captured from sanctioned contract; uncertain operation not blindly repeated.

**Atomic business boundary:** Persist intent/audit before external call; authenticate and dedupe receipt; obligation/refund effects through approved source models.

**History:** Operational state allowed only through approved transition/audit/version rules; no implicit financial balance authority.


### te.booking_events

**Grain:** One immutable provider acknowledgment/status/cost event. **Cards:** T03. **Requirements:** TE-04. **Decisions:** D10, D11.

| Proposed column definition | Purpose/provenance |

|---|---|

| `operation_id BIGINT NOT NULL REFERENCES te.booking_operations(id)` | Persisted external intent |

| `event_type TEXT NOT NULL` | Contract-validated event kind |

| `provider_event_id TEXT NOT NULL` | Provider replay/dedupe key |

| `occurred_at TIMESTAMPTZ NOT NULL` | Actual provider event time |

| `original_amount NUMERIC(20,6)` | Proposed precision; cost/refund amount when applicable |

| `currency_code TEXT` | Original currency if monetary event |

| `currency_rate_id BIGINT REFERENCES te.currency_rates(id)` | Frozen conversion for obligations |

**Integrity:** UNIQUE(operation_id,provider_event_id); verify callback signature and allowed status transition; no negative expense tricks for refund/cancellation.

**Atomic business boundary:** Record receipt and conditional operation projection/audit atomically; settlement amendment uses approved compensation.

**History:** Append-only rows; UPDATE/DELETE rejected by trigger and app grants; corrections reference original row.


### att.mobile_submissions

**Grain:** One authenticated mobile capture/queue attempt. **Cards:** X01. **Requirements:** ATT-14. **Decisions:** D03, D07, D11.

| Proposed column definition | Purpose/provenance |

|---|---|

| `employee_id BIGINT NOT NULL REFERENCES core.employees(id)` | Authenticated self subject |

| `client_event_key TEXT NOT NULL` | Offline retry identity |

| `captured_at TIMESTAMPTZ NOT NULL` | Client capture evidence, not inherently trusted |

| `received_at TIMESTAMPTZ NOT NULL` | Server receipt time |

| `latitude NUMERIC(9,6)` | Purpose-approved coordinate |

| `longitude NUMERIC(9,6)` | Purpose-approved coordinate |

| `accuracy_metres NUMERIC(10,2)` | Claimed capture accuracy evidence |

| `device_reference TEXT` | Approved device evidence; not alone identity proof |

| `status TEXT NOT NULL` | Queued/accepted/rejected/held contract |

| `swipe_event_id BIGINT` | Accepted immutable swipe mapping; partition-aware FK must be designed |

| `rejection_code TEXT` | Concrete signed validation/hold reason |

**Integrity:** UNIQUE(employee_id,client_event_key); coordinate bounds and group consistency; approved accuracy/fence/time/retention policy required, no invented radius. Partitioned swipe identity/FK must include partition key if needed.

**Atomic business boundary:** Validate self/mode/evidence; immutable swipe or quarantine + submission outcome + dirty/source receipt/audit atomically. No all-day tracking.

**History:** Operational state allowed only through approved transition/audit/version rules; no implicit financial balance authority.


## B. Existing/baseline table amendments


### core.documents

**Cards:** F04, T04. **Requirements:** CORE-09, NFR-04. **Decisions:** D11, D12.

| Proposed addition | Purpose |

|---|---|

| `content_sha256 TEXT` | Immutable bytes digest after staged upload |

| `storage_version TEXT` | Object adapter version, not a public URL |

| `parent_entity TEXT` | Allow-listed authoritative parent kind |

| `parent_id BIGINT` | Parent PK validated by owning domain |

**Required logic/constraint change:** Reconcile doc.types/extra actual columns before adding; preserve existing documents.id and ownership. Validate MIME/size/group consistency, immutable bytes/version; download checks authoritative parent entitlement. No MinIO-specific storage contract.


### wf.requests

**Cards:** A03, F03. **Requirements:** WF-01, WF-04. **Decisions:** D03, D11.

| Proposed addition | Purpose |

|---|---|

| `current_revision_id BIGINT REFERENCES wf.request_revisions(id)` | Current validated approval attempt |

**Required logic/constraint change:** Same request/subject/revision; final effect consumes authoritative domain record, never arbitrary payload. Reject unvalidated generic domain creation. Status changes, masked audit and outbox share one transaction.


### wf.request_steps

**Cards:** A03, F03. **Requirements:** WF-01, WF-04. **Decisions:** D03, D04, D11.

| Proposed addition | Purpose |

|---|---|

| `request_revision_id BIGINT REFERENCES wf.request_revisions(id)` | Attempt to which step belongs |

| `notification_id BIGINT REFERENCES wf.notifications(id)` | Actual queued message and receipt trail |

**Required logic/constraint change:** Backfill old attempt identity before making required. Unique revision/step/eligible approver under approved N-of-M policy; stable eligible role scope, delegation ceilings/window, mandatory reasons. Keep notified_at historical queued meaning; do not rewrite as delivery evidence.


### wf.notifications

**Cards:** F04, A03, W02. **Requirements:** WF-02, WF-04. **Decisions:** D04, D11.

| Proposed addition | Purpose |

|---|---|

| `event_key TEXT` | Deterministic domain occurrence/recipient/channel identity |

| `lease_owner TEXT` | Worker claim owner |

| `lease_until TIMESTAMPTZ` | Recoverable claim expiry |

| `next_attempt_at TIMESTAMPTZ` | Configured retry/backoff due time |

**Required logic/constraint change:** Current local table has no lease fields. Reconcile missing notification-sending-state migration seen only in removed test DB before forward amendment. Unique event/recipient/channel using NULL-safe indexes; short claim/ack transactions; no external send under long DB transaction. Max attempts/backoff are typed settings, not schema defaults.


### att.recompute_queue

**Cards:** A02, F04. **Requirements:** ATT-03. **Decisions:** D07, D11.

| Proposed addition | Purpose |

|---|---|

| `dirty_revision BIGINT` | Monotonic semantic input-change revision |

| `claimed_revision BIGINT` | Revision claimed by this work lease |

| `lease_owner TEXT` | Worker identity |

| `lease_until TIMESTAMPTZ` | Crash-recovery expiry |

**Required logic/constraint change:** Do not DELETE the sole durable item before work. Claim/compute/ack conditionally; a newer revision arriving during work remains pending. Unique employee/date already exists; use same lock protocol as month finalization. Configuration-loading failures remain replayable.


### att.day_records

**Cards:** A02, A05, P02. **Requirements:** ATT-03, ATT-05, ATT-15. **Decisions:** D05, D07, D11.

| Proposed addition | Purpose |

|---|---|

| `fact_revision BIGINT` | Semantic derived-attendance version |

| `input_checksum TEXT` | Frozen punches/roster/exception/placement/policy digest |

| `policy_version TEXT` | Approved effective computation policy |

**Required logic/constraint change:** Increment/invalidate manager approval only on semantic facts, never computed_at or is_locked alone. Preserve existing session clearing. Month partitioning requires explicit forward migration with partition-aware PK/FKs; no direct conversion/drop of used table. Store canonical payable session units only after D05 signs exact rules.


### att.manager_month_approvals

**Cards:** A05. **Requirements:** ATT-12, ATT-15. **Decisions:** D05, D11.

| Proposed addition | Purpose |

|---|---|

| `approved_fact_revision TEXT` | Digest of exact approved team/month attendance facts |

**Required logic/constraint change:** Existing append-only approval/invalidation ledger remains. Locking/no-change recomputation must preserve sign-off. Genuine source/roster/exception change appends invalidation; sign-off and month lock must certify same expected population/revision.


### att.month_locks

**Cards:** A05, P02. **Requirements:** ATT-15, PAY-03. **Decisions:** D05, D07, D11.

| Proposed addition | Purpose |

|---|---|

| `locked_fact_revision TEXT` | Complete frozen company/month input digest |

| `snapshot_build_id BIGINT REFERENCES reporting.snapshot_builds(id)` | Reconciled muster/completeness evidence |

**Required logic/constraint change:** Lock requires source completeness, expected employee/date coverage, empty eligible dirty queue, approved exceptions/carry policy and current manager approval. Month first-of-month CHECK; compatible subject/month locking with final approval prevents races. No closed-history overwrite.


### att.regularizations

**Cards:** A03. **Requirements:** ATT-06, ATT-07. **Decisions:** D05, D11.

| Proposed addition | Purpose |

|---|---|

| `request_revision_id BIGINT REFERENCES wf.request_revisions(id)` | Validated dates/status revision |

**Required logic/constraint change:** Valid date/time intervals, same employee as workflow, typed kind/requested status; final applied flag requires exact affected-row checks. Lock-protected skipped day writes cannot be reported applied. D05 resolves Permission payable semantics before changing whole-day P.


### att.overtime_entries

**Cards:** A03, A04, P02. **Requirements:** ATT-08, LV-04. **Decisions:** D04, D06, D11.

| Proposed addition | Purpose |

|---|---|

| `request_revision_id BIGINT REFERENCES wf.request_revisions(id)` | Current approved OT attempt |

| `payment_obligation_id BIGINT REFERENCES pay.payment_obligations(id)` | Once-only approved pay route |

| `intimation_notification_id BIGINT REFERENCES wf.notifications(id)` | Approved deadline-start evidence |

**Required logic/constraint change:** Approved minutes bounded by signed eligible detected/preapproved minutes, nonnegative; pay vs CO exclusive. Final workflow decision/entry/CO ledger or pay obligation/audit/outbox atomic; lock and recheck pending state/deadline. Inspect conditional write count. Deadline sweep cannot make a stale approval valid.


### lv.applications

**Cards:** A04, A03. **Requirements:** LV-03, LV-05. **Decisions:** D02, D05, D06, D11.

| Proposed addition | Purpose |

|---|---|

| `request_revision_id BIGINT REFERENCES wf.request_revisions(id)` | Validated leave-date/units attempt |

**Required logic/constraint change:** Reserve available bucket under serialized employee/type lock; protect overlap at approved session/day grain with DB exclusion or reservation footprints after D05/D11. RH caps/cancellations/encash use same lock discipline. Ledger and actual attendance effects must commit with final approval; immutable actual debit drives payout.


### pay.salary_components

**Cards:** P01, P03. **Requirements:** PAY-01, PAY-09, PAY-10, PAY-13. **Decisions:** D01, D10, D11.

No new column is asserted solely to close this gap; use the approved model and enforce the required invariant.

**Required logic/constraint change:** Version component flags/formulas/rounding and distinguish ESIC eligibility wages from contribution wages. No signed rate/basis inserted by this draft. Formula DAG and supported rounding identifiers validated; new metadata must not alter old result lines.


### pay.employee_salaries

**Cards:** P01, L02, L03. **Requirements:** PAY-01, PAY-02, PAY-16. **Decisions:** D01, D10, D11.

| Proposed addition | Purpose |

|---|---|

| `effective_to DATE` | Exclusive end of salary applicability |

| `structure_version_id BIGINT REFERENCES pay.salary_structure_versions(id)` | Exact approved template |

| `assignment_id BIGINT REFERENCES core.employee_assignments(id)` | Effective legal placement |

| `workflow_request_id BIGINT REFERENCES wf.requests(id)` | Salary approval authority |

| `source_key TEXT` | Deterministic revision/import identity |

**Required logic/constraint change:** Temporal EXCLUDE(employee,effective range) and valid dates, same payer/template. Midmonth segmentation signed. Decimal-string component snapshots; independently validate annual CTC. Historical source-backed rows preserved; confirmation creates new effective salary, not edit of closed result.


### pay.payroll_runs

**Cards:** P02, L05. **Requirements:** PAY-03, PAY-15, PAY-16. **Decisions:** D10, D11.

| Proposed addition | Purpose |

|---|---|

| `run_key UUID` | Stable logical run identity across result versions |

| `result_version INTEGER` | Positive frozen result revision |

| `supersedes_run_id BIGINT REFERENCES pay.payroll_runs(id)` | Prior immutable result |

| `cycle_no INTEGER` | Approved regular/F&F/off-cycle occurrence identity |

| `computed_by BIGINT REFERENCES core.users(id)` | Maker |

| `approved_by BIGINT REFERENCES core.users(id)` | Independent checker |

| `policy_version TEXT` | Approved effective calculation configuration |

| `input_checksum TEXT` | Complete frozen source digest |

**Required logic/constraint change:** Replace inadequate UNIQUE(company,month,type) only after approved version/cycle contract. Unique run_key/result_version; validate prior run entity/type/period; maker != checker. Explicit transition table/trigger; inputs_locked pins input set. Computed regular runs require matching complete attendance lock; special-run preconditions signed. Reopen creates new result/delta and artifacts, never edits finalized rows.


### pay.payroll_items

**Cards:** P02, P04. **Requirements:** PAY-03, PAY-05, PAY-06. **Decisions:** D05, D10, D11.

| Proposed addition | Purpose |

|---|---|

| `assignment_id BIGINT REFERENCES core.employee_assignments(id)` | Historical subject/payer/allocation |

| `salary_id BIGINT REFERENCES pay.employee_salaries(id)` | Exact salary source; segments carried in input refs |

**Required logic/constraint change:** UNIQUE(run,employee) per result; same subject and historical payer across assignment/run. Numeric days/minutes checked for valid units. net_pay = gross - total_deductions; negative result remains explicit review and cannot silently clamp/finalize. Payment status is separate from calculation status.


### pay.payroll_item_lines

**Cards:** P02, P04. **Requirements:** PAY-03, PAY-06. **Decisions:** D10, D11.

No new column is asserted solely to close this gap; use the approved model and enforce the required invariant.

**Required logic/constraint change:** calc_note required on every monetary line; component FK; signed component amount semantics; stable line/source allocation key if one component has multiple sources. Line totals independently match header. All finalized lines append-only by trigger and grants.


### pay.inputs

**Cards:** P02. **Requirements:** PAY-03, NFR-04. **Decisions:** D10, D11.

| Proposed addition | Purpose |

|---|---|

| `workflow_request_id BIGINT REFERENCES wf.requests(id)` | Input approval where required |

| `source_key TEXT` | Stable import/manual occurrence |

| `source_version TEXT` | Validated input revision |

**Required logic/constraint change:** Component FK and subject/payer/period checks; no arbitrary input on inactive/ineligible subject. Approved signed amount semantics per component. Freeze with run source digest; post-lock correction becomes later recompute+delta, not in-place change.


### pay.salary_holds

**Cards:** P02, P04, L05. **Requirements:** PAY-08. **Decisions:** D10, D11.

| Proposed addition | Purpose |

|---|---|

| `workflow_request_id BIGINT REFERENCES wf.requests(id)` | Authorized hold/release decision |

**Required logic/constraint change:** Valid first-of-month range and actor/scope; distinguish payment hold liability from process hold payable units. Release consumes existing outstanding obligation once, never recomputes and pays a second salary. Immutable hold/release evidence after policy model approval.


### pay.arrears

**Cards:** P02, P07. **Requirements:** PAY-16. **Decisions:** D10, D11.

| Proposed addition | Purpose |

|---|---|

| `original_run_id BIGINT REFERENCES pay.payroll_runs(id)` | Closed result being corrected |

| `recomputed_run_id BIGINT REFERENCES pay.payroll_runs(id)` | New deterministic result version |

| `source_key TEXT` | Unique employee/component/for-period/correction occurrence |

**Required logic/constraint change:** Amount = independently checked recomputed minus original component; same person/entity/period; original finalized lines unchanged. Consumption reference identifies current approved payout/recovery exactly once.


### pay.statutory_rates

**Cards:** P03. **Requirements:** PAY-09, PAY-10, PAY-11, PAY-12, PAY-13, PAY-17. **Decisions:** D01, D11.

| Proposed addition | Purpose |

|---|---|

| `effective_to DATE` | Exclusive end of rate applicability |

| `jurisdiction TEXT` | Approved establishment/state/scheme scope |

| `approved_by BIGINT REFERENCES core.users(id)` | Policy owner sign-off |

**Required logic/constraint change:** Unique/EXCLUDE scheme+param+jurisdiction+effective interval after nullable-scope semantics signed. Rate vs amount vs ceiling units explicitly validated. Official source and effective applicability required. No rates seeded; existing doc10 conflicts remain D01.


### pay.pt_slabs

**Cards:** P03. **Requirements:** PAY-11. **Decisions:** D01, D11.

| Proposed addition | Purpose |

|---|---|

| `effective_to DATE` | Exclusive policy interval end |

| `policy_version TEXT` | Reviewed state slab set |

**Required logic/constraint change:** Valid continuous wage ranges and nonoverlap within state/version; decimal wages must not fall in an integer-gap boundary. Applicable slab sets effective-dated and signed; no hardcoded top amount.


### pay.it_slabs

**Cards:** P03. **Requirements:** PAY-13. **Decisions:** D01, D11.

| Proposed addition | Purpose |

|---|---|

| `policy_version TEXT` | Reviewed FY/regime ruleset and source digest |

**Required logic/constraint change:** Nonoverlapping and complete approved taxable-income ranges; independently reviewed marginal relief/surcharge/cess/deduction schema. Rate data numeric; no current website value copied into historical years.


### pay.investment_declarations

**Cards:** P03. **Requirements:** PAY-13. **Decisions:** D01, D11.

| Proposed addition | Purpose |

|---|---|

| `version INTEGER` | Immutable submitted/verified declaration version |

**Required logic/constraint change:** Unique employee/FY/section/version; declared amount and verified amount separate, nonnegative and authorized section bounds. Exact evidence belongs to same employee/version; final proof window uses signed policy. Keep declaration/proof correction history.


### pay.loans

**Cards:** P05. **Requirements:** LN-01, LN-02, LN-03. **Decisions:** D10, D11.

| Proposed addition | Purpose |

|---|---|

| `funding_obligation_id BIGINT REFERENCES pay.payment_obligations(id)` | Authorized loan principal payment |

**Required logic/constraint change:** Principal/tenure/method validity under signed eligibility; exact amount math through Money. outstanding is a derived SUM projection, never financial authority. Opening, funding, recoveries, writeoffs/reversals require immutable postings and verified payment evidence; never double-import opening and full historic ledger.


### pay.loan_postings

**Cards:** P05. **Requirements:** LN-03. **Decisions:** D10, D11.

| Proposed addition | Purpose |

|---|---|

| `posting_kind TEXT` | Opening/funding/recovery/interest/writeoff/reversal vocabulary |

| `import_batch_id BIGINT REFERENCES core.import_batches(id)` | Signed opening source |

| `payment_event_id BIGINT REFERENCES pay.payment_events(id)` | Funding/recovery acknowledgment |

| `reverses_posting_id BIGINT REFERENCES pay.loan_postings(id)` | Authorized compensation |

| `source_key TEXT` | Deterministic movement identity |

**Required logic/constraint change:** Current baseline run_id NOT NULL cannot represent all required movements; signed amendment chooses source XOR and signed principal/interest columns. Same loan/subject/payer and conserved amount; immutable ledger. Schedule amount alone is not collected cash.


### pay.claims

**Cards:** P06, T01, T02. **Requirements:** CLM-02, CLM-03, CLM-04, CLM-07. **Decisions:** D10, D11.

| Proposed addition | Purpose |

|---|---|

| `trip_id BIGINT REFERENCES te.trips(id)` | Travel-owned purpose; NULL for pure salary reimbursement |

| `request_revision_id BIGINT REFERENCES wf.request_revisions(id)` | Frozen approved claim attempt |

**Required logic/constraint change:** REUSE current shared pay.claims/pay.claim_lines/pay.claim_reservations; DO NOT replace with docs03 CREATE or duplicate te.claims. Define funding_kind contract and salary entitlement bucket versus trip budget. One active claim per budget under captured EMS rule; old reserved_budget_id preserved on change. Approved/settled/paid distinct; one source obligation/consumption prevents payroll and offcycle double pay.


### pay.claim_lines

**Cards:** P06, T02. **Requirements:** CLM-02, CLM-03, TE-05. **Decisions:** D10, D11.

| Proposed addition | Purpose |

|---|---|

| `document_id BIGINT REFERENCES core.documents(id)` | Authorized bill metadata replacing bare path gradually |

| `verified_amount NUMERIC(14,2)` | Independent verified line amount |

| `verified_by BIGINT REFERENCES core.users(id)` | Authorized bill verifier |

| `verified_at TIMESTAMPTZ` | Actual verification time |

| `currency_rate_id BIGINT REFERENCES te.currency_rates(id)` | Captured reviewed FX quote |

**Required logic/constraint change:** Do not create pay.claim_bills if it duplicates a line receipt; approved distinct multiple-document relation only if source capture needs it. Decimal original/INR money, positive FX, bill dates, subject document ownership. Lines immutable after approval except reviewed new request revision.


### pay.claim_reservations

**Cards:** P06, T02. **Requirements:** CLM-01, CLM-07, TE-09. **Decisions:** D10, D11.

| Proposed addition | Purpose |

|---|---|

| `request_revision_id BIGINT REFERENCES wf.request_revisions(id)` | Demand revision creating/releasing reservation |

| `source_key TEXT` | Deterministic reserve/release/change identity |

**Required logic/constraint change:** Existing immutable movement table is authority. Normalize category movements after captured EMS schema review; JSON category totals use decimal strings and exact sum check meanwhile. Lock original budget/categories; compensation references original reservation, never a newly selected budget. No mutable remaining balance.


### pay.claim_entitlements

**Cards:** P06. **Requirements:** CLM-01, CLM-05. **Decisions:** D10, D11.

| Proposed addition | Purpose |

|---|---|

| `effective_to DATE` | Exclusive entitlement applicability end |

| `policy_version TEXT` | Reviewed annual/monthly/event bucket definition |

**Required logic/constraint change:** Distinguish salary grade entitlement from te travel levels/budget. Temporal nonoverlap with NULL-safe default grade scope; reserve pending/approved demand under bucket lock. Explicit year-end taxable/lapse/carry behavior; never count claimed+approved+paid states three times.


### pay.bank_batches

**Cards:** P04, P06. **Requirements:** PAY-05, CLM-04. **Decisions:** D10, D11.

| Proposed addition | Purpose |

|---|---|

| `company_id BIGINT REFERENCES core.companies(id)` | Frozen legal payer |

| `version INTEGER` | Bank-file revision |

| `source_checksum TEXT` | Frozen result/obligation/payee input digest |

**Required logic/constraint change:** Offcycle parent run/batch contract must be signed; no bank amount default. Line count and sum match header, immutable file reference and stable payment identity. Regenerate new artifact version; uncertain external submit reconciles before retry.


### pay.gl_accounts

**Cards:** P04. **Requirements:** PAY-05. **Decisions:** D10, D11.

| Proposed addition | Purpose |

|---|---|

| `company_id BIGINT REFERENCES core.companies(id)` | Entity-specific SAP mapping |

| `effective_from DATE` | Approved mapping start |

| `effective_to DATE` | Exclusive mapping end |

**Required logic/constraint change:** Existing DB-only GL table source must be recovered. Unique temporal component/company/cost-center default scope; historical JV freezes mapping. Do not silently adopt schema solely because a table is present.


### pay.fnf_settlements

**Cards:** L05. **Requirements:** PAY-15. **Decisions:** D01, D10, D11.

| Proposed addition | Purpose |

|---|---|

| `cycle_no INTEGER` | Approved first/second settlement occurrence |

| `result_version INTEGER` | Immutable settlement result revision |

| `supersedes_settlement_id BIGINT REFERENCES pay.fnf_settlements(id)` | Prior result version |

**Required logic/constraint change:** Real FK separation_id→core.separations and same employee; unique separation/cycle/version, not simplistic one-row-per-employee. Settlement lines use same payroll item engine/source references. Statutory wage deadline and vendor processing TAT are separately signed D01; no default guessed legal deadline. Clearance/recoveries/held liability/payout consumed once.


### core.onboarding_candidates

**Cards:** L01, R01. **Requirements:** LC-01. **Decisions:** D03, D09, D11.

| Proposed addition | Purpose |

|---|---|

| `source_mapping_id BIGINT REFERENCES core.source_mappings(id)` | Exact ATS candidate/LOI source identity |

**Required logic/constraint change:** Keep full approved doc03 LOI field catalog; do not infer candidate=employee. Token digest lives in prejoin invitation and replaces insecure plaintext token through reviewed cutover. Same accepted offer/version converts once to employee and salary; authoritative merge fields cannot be overridden.


### core.onboarding_tasks

**Cards:** L01. **Requirements:** LC-02. **Decisions:** D03, D04, D11.

| Proposed addition | Purpose |

|---|---|

| `owner_user_id BIGINT REFERENCES core.users(id)` | Actual scoped task recipient resolved at creation |

| `notification_id BIGINT REFERENCES wf.notifications(id)` | Delivery trail |

| `source_key TEXT` | Idempotent employee/onboarding-task occurrence |

**Required logic/constraint change:** UNIQUE employee/task/approved join occurrence; eligible runtime recipient, real receipt and configured due/escalation policy. Task completion requires actor and timestamp; conversion is not completion of every stakeholder task.


### core.probation_reviews

**Cards:** L02. **Requirements:** LC-04, PAY-02. **Decisions:** D10, D11.

| Proposed addition | Purpose |

|---|---|

| `applied_salary_id BIGINT REFERENCES pay.employee_salaries(id)` | Effective confirmed salary projection |

**Required logic/constraint change:** Valid due/recommendation/extension and same employee/workflow; confirm vs extend vs separate explicit. Approval creates exactly one future/effective salary phase, history, letter eligibility/audit/outbox. Repeated job/approval must not switch twice.


### core.separations

**Cards:** L04, L05. **Requirements:** LC-06, LC-07, PAY-15. **Decisions:** D01, D03, D10, D11.

No new column is asserted solely to close this gap; use the approved model and enforce the required invariant.

**Required logic/constraint change:** Reason/notice/LWD validity and same workflow subject. Historical fnf_id must become reviewed latest-result projection if two cycles/versioning are approved, never sole financial authority. Approved separation != employee exited != settlement paid. Exit status requires DOL and restricted alumni rules; reassign pending work safely.


### core.clearances

**Cards:** L04, L05. **Requirements:** LC-06, AST-04. **Decisions:** D10, D11.

No new column is asserted solely to close this gap; use the approved model and enforce the required invariant.

**Required logic/constraint change:** Same employee through separation, unique department task, authorized clearing actor/time. Reference actual custody/debt/claim/advance obligations and reviewed recovery/writeoff, not free-text fake zero. Unreturned asset remains outstanding; cost does not automatically become recovery.


### ast.assignments

**Cards:** W01, L04. **Requirements:** AST-04, AST-05. **Decisions:** D11.

No new column is asserted solely to close this gap; use the approved model and enforce the required invariant.

**Required logic/constraint change:** Keep employee XOR third-party holder CHECK and one-open-custody unique index. Do not set returned_at or return asset to stock for not_returned. Physical receipt/loss/writeoff events and approved financial recovery are distinct. Cross-company custody requires explicit authorized owner/holder contract.


### hd.tickets

**Cards:** W02. **Requirements:** HD-01. **Decisions:** D03, D04, D11.

| Proposed addition | Purpose |

|---|---|

| `current_cycle_no INTEGER` | Reopen/SLA cycle identity |

**Required logic/constraint change:** Existing counters/timestamps are projections over hd.ticket_events; preserve resolved-late breaches and prior reopen cycles. Participant/agent/internal-note scope checked server-side. Ticket status+immutable event+audit/outbox atomic; sweeps serialized and recipient eligibility rechecked.


### core.policy_acknowledgments

**Cards:** W03. **Requirements:** CORE-13, EN-04. **Decisions:** D03, D11.

| Proposed addition | Purpose |

|---|---|

| `policy_version_id BIGINT REFERENCES core.policy_versions(id)` | Exact content/audience acknowledged |

**Required logic/constraint change:** Backfill legitimate historical version, then unique employee/policy_version. Same effective population for read/ack/nag/tile/export; historical acknowledgment cannot inflate unrelated current numerator; append-only receipt.


### eng.surveys

**Cards:** W03. **Requirements:** EN-03. **Decisions:** D03, D11.

No new column is asserted solely to close this gap; use the approved model and enforce the required invariant.

**Required logic/constraint change:** Doc03 structured survey is a proposal absent from current catalog; current eng.polls pulse is not its complete substitute. Typed versioned questions/options/answer schema and audience/anonymous dedupe policy signed. Preserve HMAC anonymity; no automatic survey recommendations without D08 algorithm/scope.


### reporting.kpi_daily

**Cards:** W04. **Requirements:** RPT-03, RPT-04. **Decisions:** D05, D11.

| Proposed addition | Purpose |

|---|---|

| `snapshot_build_id BIGINT REFERENCES reporting.snapshot_builds(id)` | Formula/population/completeness lineage |

| `org_unit_id BIGINT REFERENCES core.org_units(id)` | Scope dimension when applicable |

**Required logic/constraint change:** Reconcile current company/category/day/metric grain with scoped OU dimensions/version; no duplicate mixed grain rows. Null unavailable_reason is meaningful. Historical denominators from effective roster/placement, approved OT and average headcount. Scoped drilldown/export matches exact source population; hot paths avoid full live aggregation.


### reporting.muster_month

**Cards:** A05, W04. **Requirements:** RPT-01. **Decisions:** D05, D11.

| Proposed addition | Purpose |

|---|---|

| `snapshot_build_id BIGINT REFERENCES reporting.snapshot_builds(id)` | Exact frozen attendance revision |

**Required logic/constraint change:** Same employee/month/legal payer/history grain; exact signed session/paid-leave LOP formula, complete eligible days; source snapshot and export filters agree. Invalidated source has explicit stale/unavailable state.


### pay.budgets

**Cards:** T01, T02. **Requirements:** TE-02, TE-03, TE-06. **Decisions:** D10, D11.

| Proposed addition | Purpose |

|---|---|

| `trip_id BIGINT REFERENCES te.trips(id)` | Canonical travel intent |

| `policy_version_id BIGINT REFERENCES te.policy_versions(id)` | Approved rule set |

| `travel_level_id BIGINT REFERENCES te.travel_levels(id)` | Reviewed tier, distinct from pay grade |

**Required logic/constraint change:** REUSE actual budget/category records from recovered migration175215. Preserve original reservations and source key. Capture all EMS source fields before locking amendment; no new te.budgets/claim duplicates. Category totals, dates, payer/employee and allowed-excess authorization independently validated.


## C. Missing source/scope cannot be fabricated

- **R01** — recruit.candidates, recruit.vacancies, recruit.offers: Only domain names/LOI chain are approved. Capture authorized ATS schema/code/contracts, review complete PRD and R22 template, then lock all fields/FKs/states. Existing core.onboarding_candidates supplies the exact approved handoff baseline; no fictitious screening/interview schema is supplied.

- **X01** — No extra table: Contract workers are expressly deferred (D3). Signed contractor/legal payer/gate-pass/muster/compliance workshop required before creating contractor tables; current core.employment_category reserves contract only.

- **W05** — No extra table: Contextual role guides/training are version-controlled content; no LMS or extra DB table is authorized.

- **M01** — cmp.calendar_items, cmp.filing_evidence, cmp.registrations: These tables exist, but missing migration/spec ownership is D12. Preserve catalog and use controlled evidence documents until formally adopted; no portal credential/OTP or automated filing model.


## D. Implementation acceptance for every table change

1. Recover source/migration provenance and approved meaning; review D decisions. Define exact owner, row grain, requiredness, FK, composite subject/payer alignment, date/amount constraints, temporal exclusions, retry uniqueness, mutable state machine and append-only protection.
2. Add expansion migration with lock_timeout, indexes/grants/types; backfill only verified source values; report exceptions, then validate constraints. Keep prior app compatible; no destructive down/rebuild on the used local DB.
3. Public module API and one oRPC permission with subject scope; frontend contract generated over HTTP. Implement domain+ledger+audit+outbox transaction and durable external operation receipts.
4. Independent tests cover unauthorized IDs, duplicate replay, concurrent reserve/approve/lapse/lock, crash before/after commit, uncertain external effect, historical placement, missing fields and financial conservation. Money uses hand-computed golden/property expectations and human review.
5. Full verify at original coverage floors plus actual target-version migration rehearsal; real UAT/phase gates remain separate. Draft SQL presence is not acceptance.

## E. Exact proposed SQL-level checks and uniqueness

These are design constraints to review, not applied DB guarantees. Cross-row conservation, scope/ownership, receipt evidence and conditional protected writes still require the corresponding transaction/trigger tests.

### core.employee_assignments

```sql
CHECK (effective_to IS NULL OR effective_to > effective_from);
EXCLUDE USING gist (employee_id WITH =, daterange(effective_from, effective_to, '[)') WITH &&);
```

### wf.definition_versions

```sql
UNIQUE (definition_code, version);
CHECK (version > 0);
```

### wf.request_revisions

```sql
UNIQUE (request_id, revision);
CHECK (revision > 0);
```

### wf.notification_attempts

```sql
UNIQUE (notification_id, attempt_no);
CHECK (attempt_no > 0);
CHECK (finished_at IS NULL OR finished_at >= started_at);
```

### core.document_operations

```sql
CHECK (size_bytes IS NULL OR size_bytes >= 0);
```

### att.source_receipts

```sql
CHECK (covered_through >= covered_from);
```

### lv.credit_allocations

```sql
CHECK (units > 0);
CHECK (credit_ledger_id <> debit_ledger_id);
```

### lv.operation_keys

```sql
CHECK (period_to >= period_from);
```

### pay.salary_structure_versions

```sql
UNIQUE (structure_id, version);
CHECK (version > 0);
```

### pay.payment_obligations

```sql
CHECK (amount > 0);
CHECK (direction IN ('payable', 'recoverable'));
```

### pay.source_consumptions

```sql
CHECK (amount > 0);
CHECK ((payroll_item_id IS NOT NULL) <> (bank_batch_line_id IS NOT NULL));
```

### pay.payment_events

```sql
CHECK (amount IS NULL OR amount >= 0);
```

### pay.bank_batch_lines

```sql
UNIQUE (batch_id, payment_reference);
CHECK (amount > 0);
```

### pay.output_artifacts

```sql
CHECK (period_to >= period_from);
CHECK (version > 0);
CHECK (record_count IS NULL OR record_count >= 0);
```

### pay.statutory_memberships

```sql
CHECK (effective_to IS NULL OR effective_to > effective_from);
EXCLUDE USING gist (employee_id WITH =, company_id WITH =, scheme WITH =, daterange(effective_from, effective_to, '[)') WITH &&);
```

### pay.tax_elections

```sql
UNIQUE (employee_id, fy, version);
CHECK (version > 0);
```

### pay.previous_employer_income

```sql
UNIQUE (employee_id, fy, employer_reference, version);
CHECK (version > 0);
CHECK (taxable_income >= 0 AND tds_paid >= 0);
```

### pay.statutory_postings

```sql
CHECK ((item_id IS NOT NULL) <> (import_batch_id IS NOT NULL));
```

### pay.journal_batches

```sql
UNIQUE (run_id, version);
CHECK (version > 0);
```

### pay.journal_lines

```sql
CHECK ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0));
```

### pay.loan_installments

```sql
UNIQUE (loan_id, schedule_version, installment_no);
CHECK (schedule_version > 0 AND installment_no > 0);
CHECK (principal_part >= 0 AND interest_part >= 0);
CHECK (EXTRACT(DAY FROM month) = 1);
```

### pay.parallel_comparisons

```sql
UNIQUE (run_id, import_batch_id);
```

### pay.parallel_comparison_lines

```sql
UNIQUE (comparison_id, employee_id, component_code);
```

### core.prejoin_invitations

```sql
CHECK (expires_at > created_at);
```

### hd.ticket_events

```sql
CHECK (cycle_no > 0);
```

### hd.escalation_rules

```sql
UNIQUE (category_id, policy_version, level);
CHECK (level > 0);
```

### core.policy_versions

```sql
UNIQUE (policy_id, version);
CHECK (version > 0);
```

### reporting.snapshot_builds

```sql
CHECK (period_to >= period_from);
CHECK (expected_records >= 0 AND processed_records >= 0);
```

### te.trips

```sql
CHECK (end_date >= start_date);
```

### te.itinerary_segments

```sql
UNIQUE (trip_id, segment_no);
CHECK (segment_no > 0 AND ends_at >= starts_at);
```

### te.employee_travel_levels

```sql
CHECK (effective_to IS NULL OR effective_to > effective_from);
EXCLUDE USING gist (employee_id WITH =, travel_type WITH =, daterange(effective_from, effective_to, '[)') WITH &&);
```

### te.policy_versions

```sql
CHECK (version > 0);
CHECK (effective_to IS NULL OR effective_to > effective_from);
```

### te.currency_rates

```sql
UNIQUE (currency_code, source, source_reference);
CHECK (rate_to_inr > 0);
```

### te.advances

```sql
CHECK (requested_amount > 0);
CHECK (approved_amount IS NULL OR approved_amount >= 0);
```

### te.wallet_postings

```sql
CHECK ((advance_id IS NOT NULL)::integer + (settlement_id IS NOT NULL)::integer + (import_batch_id IS NOT NULL)::integer = 1);
CHECK ((original_amount IS NULL) = (original_currency IS NULL));
```

### te.settlements

```sql
UNIQUE (claim_id, claim_revision);
CHECK (claim_revision > 0);
CHECK (approved_expense >= 0 AND advance_cleared >= 0);
CHECK (net_amount = approved_expense - advance_cleared);
```

### te.settlement_advances

```sql
UNIQUE (settlement_id, advance_id);
CHECK (allocated_amount > 0);
```

### te.booking_events

```sql
UNIQUE (operation_id, provider_event_id);
```

### att.mobile_submissions

```sql
UNIQUE (employee_id, client_event_key);
CHECK ((latitude IS NULL) = (longitude IS NULL));
CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90);
CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180);
CHECK (accuracy_metres IS NULL OR accuracy_metres >= 0);
```

