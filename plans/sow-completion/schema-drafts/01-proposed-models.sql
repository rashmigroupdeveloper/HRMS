-- REVIEW DRAFT ONLY. NOT A node-pg-migrate migration. Do not apply to hrms.
-- Remove this guard only in a separately reviewed, stage-specific migration.
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $review_guard$ BEGIN
  RAISE EXCEPTION 'Schema proposal is not approved or migration-ordered. Read packs13-15 and resolve D decisions.';
END $review_guard$;

CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE SCHEMA IF NOT EXISTS te;
-- Referenced baseline tables must first be reconciled/created in their owning stages.
-- Foreign keys are attached after model declarations so cyclic model links are reviewable.

-- core.employee_assignments | CORE-01 CORE-03 LC-05 RPT-05 | blockers D07 D09 D11
CREATE TABLE core.employee_assignments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  employee_id BIGINT NOT NULL,
  company_id BIGINT NOT NULL,
  location_id BIGINT NOT NULL,
  org_unit_id BIGINT NOT NULL,
  cost_center_id BIGINT NOT NULL,
  department_id BIGINT NOT NULL,
  designation_id BIGINT NOT NULL,
  grade_id BIGINT,
  reporting_manager_id BIGINT,
  functional_manager_id BIGINT,
  effective_from DATE NOT NULL,
  effective_to DATE,
  workflow_request_id BIGINT,
  approved_by BIGINT NOT NULL,
  source_key TEXT NOT NULL UNIQUE,
  CHECK (effective_to IS NULL OR effective_to > effective_from),
  EXCLUDE USING gist (employee_id WITH =, daterange(effective_from, effective_to, '[)') WITH &&)
);
-- Cross-row/business rules: CHECK effective_to > effective_from when present; temporal EXCLUDE(employee_id, daterange(...,[))); composite site/OU/CC-company checks; cycle-free managers. Backfill verified history, never infer old placement from current master. Closing an interval is a separately audited controlled change; immutable financial snapshots retain original placement/version.

-- core.import_batches | CORE-12 TE-12 | blockers D09 D11
CREATE TABLE core.import_batches (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_system TEXT NOT NULL,
  source_snapshot_at TIMESTAMPTZ NOT NULL,
  source_checksum TEXT NOT NULL,
  mapping_version TEXT NOT NULL,
  status TEXT NOT NULL,
  requested_by BIGINT NOT NULL,
  result_document_id BIGINT,
  source_key TEXT NOT NULL UNIQUE
);
-- Cross-row/business rules: Unique source snapshot/mapping identity as approved; raw staging separated and access restricted; counts/checksums recorded in validation artifact, no mandatory-field fabrication.

-- core.source_mappings | CORE-12 TE-12 LC-01 | blockers D09 D11
CREATE TABLE core.source_mappings (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  import_batch_id BIGINT NOT NULL,
  source_system TEXT NOT NULL,
  source_entity TEXT NOT NULL,
  external_id TEXT NOT NULL,
  target_entity TEXT NOT NULL,
  target_id BIGINT NOT NULL,
  source_checksum TEXT NOT NULL
);
-- Cross-row/business rules: UNIQUE(source_system,source_entity,external_id); validate target exists and matches approved target type; no fuzzy identity matching; never store credential material.
-- REQUIRED BEFORE USE: append-only trigger + revoke UPDATE/DELETE; controlled compensation only.

-- wf.definition_versions | WF-01 WF-04 | blockers D03 D04 D11
CREATE TABLE wf.definition_versions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  definition_code TEXT NOT NULL,
  version INTEGER NOT NULL,
  steps JSONB NOT NULL,
  published_by BIGINT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL,
  UNIQUE (definition_code, version),
  CHECK (version > 0)
);
-- Cross-row/business rules: UNIQUE(definition_code,version), version > 0; require contiguous step numbers and valid scoped approver selectors. JSON is typed configuration, not arbitrary financial input.
-- REQUIRED BEFORE USE: append-only trigger + revoke UPDATE/DELETE; controlled compensation only.

-- wf.request_revisions | WF-01 WF-04 LV-03 | blockers D03 D11
CREATE TABLE wf.request_revisions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  request_id BIGINT NOT NULL,
  revision INTEGER NOT NULL,
  chain_version_id BIGINT NOT NULL,
  domain_entity TEXT NOT NULL,
  domain_id BIGINT NOT NULL,
  payload JSONB NOT NULL,
  submitted_by BIGINT NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL,
  source_key TEXT NOT NULL UNIQUE,
  UNIQUE (request_id, revision),
  CHECK (revision > 0)
);
-- Cross-row/business rules: UNIQUE(request_id,revision); positive revision; validated domain existence, subject equality, owned amount/date/version. Steps reference revision; never UNIQUE(request_id,step_no) across all attempts.
-- REQUIRED BEFORE USE: append-only trigger + revoke UPDATE/DELETE; controlled compensation only.

-- wf.notification_attempts | WF-02 WF-04 | blockers D04 D11
CREATE TABLE wf.notification_attempts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notification_id BIGINT NOT NULL,
  attempt_no INTEGER NOT NULL,
  provider_reference TEXT,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  outcome TEXT NOT NULL,
  error_code TEXT,
  source_key TEXT NOT NULL UNIQUE,
  UNIQUE (notification_id, attempt_no),
  CHECK (attempt_no > 0),
  CHECK (finished_at IS NULL OR finished_at >= started_at)
);
-- Cross-row/business rules: UNIQUE(notification_id,attempt_no); valid time ordering; accepted is not read; no fabricated notified_at rewrite. Queue needs lease_owner/lease_until/next_attempt_at/event_key and conditional claim.
-- REQUIRED BEFORE USE: append-only trigger + revoke UPDATE/DELETE; controlled compensation only.

-- core.document_operations | CORE-09 NFR-04 | blockers D11
CREATE TABLE core.document_operations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  document_id BIGINT,
  operation TEXT NOT NULL,
  object_key TEXT NOT NULL,
  content_sha256 TEXT,
  size_bytes BIGINT,
  status TEXT NOT NULL,
  source_key TEXT NOT NULL UNIQUE,
  requested_by BIGINT,
  CHECK (size_bytes IS NULL OR size_bytes >= 0)
);
-- Cross-row/business rules: Valid size/hash/MIME under approved document type; access via authorized parent; no globally accessible raw storage keys. Retention/legal-hold subject to recovered scope.

-- att.source_receipts | ATT-01 ATT-02 ATT-15 | blockers D07 D11
CREATE TABLE att.source_receipts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  device_id BIGINT NOT NULL,
  source TEXT NOT NULL,
  covered_from TIMESTAMPTZ NOT NULL,
  covered_through TIMESTAMPTZ NOT NULL,
  connector_reference TEXT NOT NULL,
  has_gap BOOLEAN NOT NULL,
  source_key TEXT NOT NULL UNIQUE,
  CHECK (covered_through >= covered_from)
);
-- Cross-row/business rules: covered_through >= covered_from; prohibit mock receipts in real namespace; stable device receipt uniqueness; gap receipt cannot advance completeness.
-- REQUIRED BEFORE USE: append-only trigger + revoke UPDATE/DELETE; controlled compensation only.

-- lv.credit_allocations | LV-04 LV-05 | blockers D02 D06 D11
CREATE TABLE lv.credit_allocations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  credit_ledger_id BIGINT NOT NULL,
  debit_ledger_id BIGINT NOT NULL,
  units NUMERIC(5,2) NOT NULL,
  reverses_allocation_id BIGINT,
  source_key TEXT NOT NULL UNIQUE,
  CHECK (units > 0),
  CHECK (credit_ledger_id <> debit_ledger_id)
);
-- Cross-row/business rules: Same employee/type and valid credit/debit polarity; units > 0; serially enforce sum of unreversed consumption <= credit. Allocation must not post a second balance debit. FIFO/expiry/cancellation policy signed first.
-- REQUIRED BEFORE USE: append-only trigger + revoke UPDATE/DELETE; controlled compensation only.

-- lv.operation_keys | LV-02 LV-04 LV-05 | blockers D02 D06 D11
CREATE TABLE lv.operation_keys (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  employee_id BIGINT NOT NULL,
  leave_type_id BIGINT NOT NULL,
  operation TEXT NOT NULL,
  period_from DATE NOT NULL,
  period_to DATE NOT NULL,
  policy_version TEXT NOT NULL,
  source_key TEXT NOT NULL UNIQUE,
  ledger_txn_id BIGINT,
  CHECK (period_to >= period_from)
);
-- Cross-row/business rules: period_to >= period_from; deterministic occurrence uniqueness; backdated policy correction uses distinct authorized compensation, not another routine job credit.

-- pay.salary_structure_versions | PAY-01 PAY-02 | blockers D01 D10 D11
CREATE TABLE pay.salary_structure_versions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  structure_id BIGINT NOT NULL,
  version INTEGER NOT NULL,
  components JSONB NOT NULL,
  policy_version TEXT NOT NULL,
  published_by BIGINT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL,
  UNIQUE (structure_id, version),
  CHECK (version > 0)
);
-- Cross-row/business rules: UNIQUE(structure_id,version), version > 0; reject unknown components, cycles and unsafe expressions; no float money or guessed salary/rates.
-- REQUIRED BEFORE USE: append-only trigger + revoke UPDATE/DELETE; controlled compensation only.

-- pay.run_input_refs | PAY-03 PAY-16 NFR-04 | blockers D10 D11
CREATE TABLE pay.run_input_refs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  run_id BIGINT NOT NULL,
  employee_id BIGINT,
  source_entity TEXT NOT NULL,
  source_id BIGINT NOT NULL,
  source_version TEXT NOT NULL,
  source_checksum TEXT NOT NULL
);
-- Cross-row/business rules: Unique(run,source kind,id,version,employee) including NULL shared sources; validate payer and eligibility as of period; complete expected employee/date population.
-- REQUIRED BEFORE USE: append-only trigger + revoke UPDATE/DELETE; controlled compensation only.

-- pay.payment_obligations | PAY-05 PAY-08 LN-03 CLM-04 CLM-07 | blockers D01 D10 D11
CREATE TABLE pay.payment_obligations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  employee_id BIGINT NOT NULL,
  company_id BIGINT NOT NULL,
  direction TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  source_kind TEXT NOT NULL,
  source_id BIGINT NOT NULL,
  source_version TEXT NOT NULL,
  workflow_request_id BIGINT,
  source_key TEXT NOT NULL UNIQUE,
  CHECK (amount > 0),
  CHECK (direction IN ('payable', 'recoverable'))
);
-- Cross-row/business rules: amount > 0; allowed direction; same employee/payer/version; polymorphic source requires explicit allow-list and trigger/domain checks, never assumed FK. Partial recovery/carry derives from immutable consumption/event sums.
-- REQUIRED BEFORE USE: append-only trigger + revoke UPDATE/DELETE; controlled compensation only.

-- pay.source_consumptions | PAY-03 PAY-05 LN-03 CLM-04 | blockers D10 D11
CREATE TABLE pay.source_consumptions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  obligation_id BIGINT NOT NULL,
  payroll_item_id BIGINT,
  bank_batch_line_id BIGINT,
  amount NUMERIC(14,2) NOT NULL,
  reverses_consumption_id BIGINT,
  source_key TEXT NOT NULL UNIQUE,
  CHECK (amount > 0),
  CHECK ((payroll_item_id IS NOT NULL) <> (bank_batch_line_id IS NOT NULL))
);
-- Cross-row/business rules: Exactly one route; same payer/subject; amount > 0; serialized total unreversed consumption <= approved amount. Single full-payout sources additionally unique active consumption. Final paid receipt separate from run consumption.
-- REQUIRED BEFORE USE: append-only trigger + revoke UPDATE/DELETE; controlled compensation only.

-- pay.payment_events | PAY-05 PAY-08 CLM-04 LN-03 | blockers D10 D11
CREATE TABLE pay.payment_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  obligation_id BIGINT NOT NULL,
  bank_batch_line_id BIGINT,
  event_type TEXT NOT NULL,
  amount NUMERIC(14,2),
  provider_reference TEXT,
  occurred_at TIMESTAMPTZ NOT NULL,
  evidence_document_id BIGINT,
  recorded_by BIGINT,
  source_key TEXT NOT NULL UNIQUE,
  CHECK (amount IS NULL OR amount >= 0)
);
-- Cross-row/business rules: No queued event counted paid; receipt must match employee/company/amount/source; valid nonnegative amount; unique provider occurrence per channel. Manual evidence requires independent review.
-- REQUIRED BEFORE USE: append-only trigger + revoke UPDATE/DELETE; controlled compensation only.

-- pay.bank_batch_lines | PAY-05 CLM-04 | blockers D10 D11
CREATE TABLE pay.bank_batch_lines (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  batch_id BIGINT NOT NULL,
  obligation_id BIGINT NOT NULL,
  employee_id BIGINT NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  payee_snapshot JSONB NOT NULL,
  payment_reference TEXT NOT NULL,
  UNIQUE (batch_id, payment_reference),
  CHECK (amount > 0)
);
-- Cross-row/business rules: UNIQUE(batch_id,payment_reference); amount > 0; cross-check batch payer/employee/obligation and batch count/sum; prevent duplication through source_consumptions, not merely uniqueness inside a batch.
-- REQUIRED BEFORE USE: append-only trigger + revoke UPDATE/DELETE; controlled compensation only.

-- pay.output_artifacts | PAY-05 PAY-06 PAY-09 PAY-10 PAY-11 PAY-12 PAY-13 | blockers D01 D10 D11
CREATE TABLE pay.output_artifacts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  run_id BIGINT,
  company_id BIGINT NOT NULL,
  employee_id BIGINT,
  kind TEXT NOT NULL,
  period_from DATE NOT NULL,
  period_to DATE NOT NULL,
  version INTEGER NOT NULL,
  source_checksum TEXT NOT NULL,
  document_id BIGINT NOT NULL,
  control_amount NUMERIC(16,2),
  record_count INTEGER,
  source_key TEXT NOT NULL UNIQUE,
  CHECK (period_to >= period_from),
  CHECK (version > 0),
  CHECK (record_count IS NULL OR record_count >= 0)
);
-- Cross-row/business rules: Valid period/version/count; subject/payer matches source; independent totals equal register; original and amendment retained. File generation does not certify filing/payment.
-- REQUIRED BEFORE USE: append-only trigger + revoke UPDATE/DELETE; controlled compensation only.

-- pay.statutory_memberships | PAY-09 PAY-10 PAY-14 | blockers D01 D11
CREATE TABLE pay.statutory_memberships (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  employee_id BIGINT NOT NULL,
  company_id BIGINT NOT NULL,
  scheme TEXT NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,
  is_covered BOOLEAN NOT NULL,
  basis_salary_id BIGINT,
  policy_version TEXT NOT NULL,
  evidence_document_id BIGINT,
  CHECK (effective_to IS NULL OR effective_to > effective_from),
  EXCLUDE USING gist (employee_id WITH =, company_id WITH =, scheme WITH =, daterange(effective_from, effective_to, '[)') WITH &&)
);
-- Cross-row/business rules: Temporal EXCLUDE(employee,company,scheme,range); interval valid; preserve ESIC period eligibility independently from actual contribution wages; D01 controls rules, no rate seed.

-- pay.tax_elections | PAY-13 | blockers D01 D11
CREATE TABLE pay.tax_elections (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  employee_id BIGINT NOT NULL,
  fy TEXT NOT NULL,
  version INTEGER NOT NULL,
  regime TEXT NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL,
  effective_from DATE NOT NULL,
  workflow_request_id BIGINT,
  UNIQUE (employee_id, fy, version),
  CHECK (version > 0)
);
-- Cross-row/business rules: UNIQUE(employee_id,fy,version); one approved effective election at calculation time; permitted changes signed under D01.
-- REQUIRED BEFORE USE: append-only trigger + revoke UPDATE/DELETE; controlled compensation only.

-- pay.previous_employer_income | PAY-13 | blockers D01 D11
CREATE TABLE pay.previous_employer_income (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  employee_id BIGINT NOT NULL,
  fy TEXT NOT NULL,
  employer_reference TEXT NOT NULL,
  version INTEGER NOT NULL,
  taxable_income NUMERIC(14,2) NOT NULL,
  tds_paid NUMERIC(14,2) NOT NULL,
  proof_document_id BIGINT,
  verified_by BIGINT,
  verified_at TIMESTAMPTZ,
  UNIQUE (employee_id, fy, employer_reference, version),
  CHECK (version > 0),
  CHECK (taxable_income >= 0 AND tds_paid >= 0)
);
-- Cross-row/business rules: Unique employee/FY/employer/version; nonnegative amounts; missing verification is not zero income; sum authoritative accepted declaration versions only.
-- REQUIRED BEFORE USE: append-only trigger + revoke UPDATE/DELETE; controlled compensation only.

-- pay.statutory_postings | PAY-09 PAY-10 PAY-11 PAY-12 PAY-13 PAY-17 | blockers D01 D11
CREATE TABLE pay.statutory_postings (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  item_id BIGINT,
  import_batch_id BIGINT,
  employee_id BIGINT,
  company_id BIGINT NOT NULL,
  scheme TEXT NOT NULL,
  period DATE NOT NULL,
  component_code TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  policy_version TEXT NOT NULL,
  reverses_posting_id BIGINT,
  source_key TEXT NOT NULL UNIQUE,
  CHECK ((item_id IS NOT NULL) <> (import_batch_id IS NOT NULL))
);
-- Cross-row/business rules: Exactly one result/import source; validate scheme/component and source payer/person; immutable signed movement; YTD = SUM accepted postings, no counter. Avoid counting both item lines and duplicate liability ledger as expense.
-- REQUIRED BEFORE USE: append-only trigger + revoke UPDATE/DELETE; controlled compensation only.

-- pay.journal_batches | PAY-05 | blockers D10 D11
CREATE TABLE pay.journal_batches (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  run_id BIGINT NOT NULL,
  version INTEGER NOT NULL,
  document_id BIGINT,
  source_checksum TEXT NOT NULL,
  approved_by BIGINT,
  UNIQUE (run_id, version),
  CHECK (version > 0)
);
-- Cross-row/business rules: UNIQUE(run_id,version); version > 0; sum debits = credits to paise before ready; GL mapping version pinned.
-- REQUIRED BEFORE USE: append-only trigger + revoke UPDATE/DELETE; controlled compensation only.

-- pay.journal_lines | PAY-05 | blockers D10 D11
CREATE TABLE pay.journal_lines (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  batch_id BIGINT NOT NULL,
  cost_center_id BIGINT,
  gl_code TEXT NOT NULL,
  debit NUMERIC(16,2) NOT NULL,
  credit NUMERIC(16,2) NOT NULL,
  source_component_code TEXT NOT NULL,
  CHECK ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0))
);
-- Cross-row/business rules: Exactly one positive side; same company allocation; no fan-out double aggregation; batch deferred balance constraint/validator required.
-- REQUIRED BEFORE USE: append-only trigger + revoke UPDATE/DELETE; controlled compensation only.

-- pay.loan_installments | LN-01 LN-03 | blockers D10 D11
CREATE TABLE pay.loan_installments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  loan_id BIGINT NOT NULL,
  schedule_version INTEGER NOT NULL,
  installment_no INTEGER NOT NULL,
  month DATE NOT NULL,
  principal_part NUMERIC(14,2) NOT NULL,
  interest_part NUMERIC(14,2) NOT NULL,
  UNIQUE (loan_id, schedule_version, installment_no),
  CHECK (schedule_version > 0 AND installment_no > 0),
  CHECK (principal_part >= 0 AND interest_part >= 0),
  CHECK (EXTRACT(DAY FROM month) = 1)
);
-- Cross-row/business rules: UNIQUE(loan_id,schedule_version,installment_no); principal/interest >= 0; approved schedule principal sum reconciles funded balance; actual recoveries are postings/receipts, not schedule status.
-- REQUIRED BEFORE USE: append-only trigger + revoke UPDATE/DELETE; controlled compensation only.

-- pay.parallel_comparisons | PAY-03 | blockers D11
CREATE TABLE pay.parallel_comparisons (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  run_id BIGINT NOT NULL,
  import_batch_id BIGINT NOT NULL,
  status TEXT NOT NULL,
  reviewed_by BIGINT,
  reviewed_at TIMESTAMPTZ,
  UNIQUE (run_id, import_batch_id)
);
-- Cross-row/business rules: UNIQUE(run_id,import_batch_id); required tolerances established before run; every variance dispositioned; two consecutive cycles remain original gate.

-- pay.parallel_comparison_lines | PAY-03 | blockers D11
CREATE TABLE pay.parallel_comparison_lines (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  comparison_id BIGINT NOT NULL,
  employee_id BIGINT NOT NULL,
  component_code TEXT NOT NULL,
  external_amount NUMERIC(14,2) NOT NULL,
  hrms_amount NUMERIC(14,2) NOT NULL,
  disposition TEXT,
  review_note TEXT,
  UNIQUE (comparison_id, employee_id, component_code)
);
-- Cross-row/business rules: Unique comparison/employee/component; difference derived exactly, no float or silent tolerance; gross reconciliation precedes net.

-- core.prejoin_invitations | LC-01 NFR-03 | blockers D03 D11
CREATE TABLE core.prejoin_invitations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  candidate_id BIGINT NOT NULL,
  token_digest TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  issued_by BIGINT NOT NULL,
  consumed_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  notification_id BIGINT,
  source_key TEXT NOT NULL UNIQUE,
  CHECK (expires_at > created_at)
);
-- Cross-row/business rules: Expiry after issuance; scoped form/document-only grant, never employee/payroll login; old plaintext tokens invalidated safely after reviewed cutover.

-- core.transfer_requests | LC-05 | blockers D07 D09 D10 D11
CREATE TABLE core.transfer_requests (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  employee_id BIGINT NOT NULL,
  from_assignment_id BIGINT NOT NULL,
  to_company_id BIGINT NOT NULL,
  to_location_id BIGINT NOT NULL,
  to_org_unit_id BIGINT NOT NULL,
  to_cost_center_id BIGINT NOT NULL,
  effective_date DATE NOT NULL,
  proposed_change JSONB NOT NULL,
  workflow_request_id BIGINT NOT NULL,
  applied_assignment_id BIGINT
);
-- Cross-row/business rules: Same subject in request/from/applied assignments; selected target links belong to target company; e-code and payer/YTD continuity signed; FK alone not sufficient.

-- ast.custody_events | AST-04 AST-05 | blockers D11
CREATE TABLE ast.custody_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assignment_id BIGINT NOT NULL,
  event_type TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  recorded_by BIGINT NOT NULL,
  separation_id BIGINT,
  recovery_obligation_id BIGINT,
  note TEXT NOT NULL,
  source_key TEXT NOT NULL UNIQUE
);
-- Cross-row/business rules: Same employee/asset/separation; physical receipt alone closes custody and returns eligible stock. Not-returned must keep outstanding custody; final write-off does not fabricate receipt.
-- REQUIRED BEFORE USE: append-only trigger + revoke UPDATE/DELETE; controlled compensation only.

-- hd.ticket_events | HD-01 | blockers D04 D11
CREATE TABLE hd.ticket_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ticket_id BIGINT NOT NULL,
  cycle_no INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  actor_user_id BIGINT,
  assignee_user_id BIGINT,
  occurred_at TIMESTAMPTZ NOT NULL,
  sla_due_at TIMESTAMPTZ,
  notification_id BIGINT,
  source_key TEXT NOT NULL UNIQUE,
  CHECK (cycle_no > 0)
);
-- Cross-row/business rules: cycle_no > 0; scoped participant/agent rules; resolution after SLA remains a breach in history; ordered events validated under ticket lock.
-- REQUIRED BEFORE USE: append-only trigger + revoke UPDATE/DELETE; controlled compensation only.

-- hd.escalation_rules | HD-01 | blockers D03 D04 D11
CREATE TABLE hd.escalation_rules (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  category_id BIGINT NOT NULL,
  level INTEGER NOT NULL,
  recipient_kind TEXT NOT NULL,
  recipient_ref TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  is_active BOOLEAN NOT NULL,
  UNIQUE (category_id, policy_version, level),
  CHECK (level > 0)
);
-- Cross-row/business rules: Unique category/policy/level; contiguous level order; invalid/vacant recipient visibly rejected, not silent reuse of same assignee.

-- core.policy_versions | CORE-13 EN-04 | blockers D03 D11
CREATE TABLE core.policy_versions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  policy_id BIGINT NOT NULL,
  version INTEGER NOT NULL,
  document_id BIGINT NOT NULL,
  effective_date DATE NOT NULL,
  audience JSONB NOT NULL,
  published_by BIGINT NOT NULL,
  UNIQUE (policy_id, version),
  CHECK (version > 0)
);
-- Cross-row/business rules: UNIQUE(policy_id,version); acknowledgment must reference version; historical legitimate acknowledgments retained and not mixed across populations.
-- REQUIRED BEFORE USE: append-only trigger + revoke UPDATE/DELETE; controlled compensation only.

-- reporting.snapshot_builds | RPT-01 RPT-03 RPT-04 | blockers D05 D11
CREATE TABLE reporting.snapshot_builds (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  company_id BIGINT,
  period_from DATE NOT NULL,
  period_to DATE NOT NULL,
  kind TEXT NOT NULL,
  source_revision TEXT NOT NULL,
  formula_version TEXT NOT NULL,
  expected_records INTEGER NOT NULL,
  processed_records INTEGER NOT NULL,
  completed_at TIMESTAMPTZ,
  unavailable_reason TEXT,
  source_key TEXT NOT NULL UNIQUE,
  CHECK (period_to >= period_from),
  CHECK (expected_records >= 0 AND processed_records >= 0)
);
-- Cross-row/business rules: Valid period/nonnegative counts; complete iff correct population/missing rows reconciled; child snapshots carry build_id and frozen scope dimensions; null value is not zero.

-- te.trips | TE-01 TE-02 | blockers D10 D11
CREATE TABLE te.trips (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  employee_id BIGINT NOT NULL,
  company_id BIGINT NOT NULL,
  reference TEXT NOT NULL UNIQUE,
  travel_type TEXT NOT NULL,
  purpose TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  policy_version_id BIGINT NOT NULL,
  workflow_request_id BIGINT,
  status TEXT NOT NULL,
  source_key TEXT NOT NULL UNIQUE,
  CHECK (end_date >= start_date)
);
-- Cross-row/business rules: Valid dates/payer/subject; exact EMS model capture required for uncaptured 40+ budget fields; travel tier != HR pay grade.

-- te.itinerary_segments | TE-02 TE-04 | blockers D10 D11
CREATE TABLE te.itinerary_segments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  trip_id BIGINT NOT NULL,
  segment_no INTEGER NOT NULL,
  kind TEXT NOT NULL,
  from_location TEXT,
  to_location TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  own_arrangement_reason TEXT,
  UNIQUE (trip_id, segment_no),
  CHECK (segment_no > 0 AND ends_at >= starts_at)
);
-- Cross-row/business rules: UNIQUE(trip_id,segment_no), valid chronology, approved overlap/stay/night-count rules; IDs remain stable across revision/cancel.

-- te.travel_levels | TE-03 TE-06 | blockers D10 D11
CREATE TABLE te.travel_levels (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  travel_type TEXT NOT NULL
);
-- Cross-row/business rules: No guessed rate/class from level name; capture EMS policy and mapping first.

-- te.employee_travel_levels | TE-03 | blockers D09 D10 D11
CREATE TABLE te.employee_travel_levels (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  employee_id BIGINT NOT NULL,
  level_id BIGINT NOT NULL,
  travel_type TEXT NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,
  source_key TEXT NOT NULL UNIQUE,
  CHECK (effective_to IS NULL OR effective_to > effective_from),
  EXCLUDE USING gist (employee_id WITH =, travel_type WITH =, daterange(effective_from, effective_to, '[)') WITH &&)
);
-- Cross-row/business rules: Valid interval and EXCLUDE(employee,travel_type,range); source travel class is independent of core.grades.

-- te.policy_versions | TE-03 TE-06 | blockers D10 D11
CREATE TABLE te.policy_versions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version INTEGER NOT NULL,
  travel_type TEXT NOT NULL,
  policy JSONB NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,
  source_checksum TEXT NOT NULL,
  approved_by BIGINT NOT NULL,
  CHECK (version > 0),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);
-- Cross-row/business rules: Valid nonoverlapping policy scope/range; no invented rates/amount thresholds/foreign currency precision. JSON contract must be captured, reviewed and versioned.
-- REQUIRED BEFORE USE: append-only trigger + revoke UPDATE/DELETE; controlled compensation only.

-- te.currency_rates | TE-05 | blockers D10 D11
CREATE TABLE te.currency_rates (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  currency_code TEXT NOT NULL,
  rate_to_inr NUMERIC(20,10) NOT NULL,
  quoted_at TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL,
  source_reference TEXT NOT NULL,
  approved_by BIGINT,
  UNIQUE (currency_code, source, source_reference),
  CHECK (rate_to_inr > 0)
);
-- Cross-row/business rules: rate > 0; UNIQUE(currency,source,source_reference); currency minor units and conversion rounding signed before computation; retain original line amount and captured rate.
-- REQUIRED BEFORE USE: append-only trigger + revoke UPDATE/DELETE; controlled compensation only.

-- te.advances | TE-07 LN-04 | blockers D10 D11
CREATE TABLE te.advances (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  trip_id BIGINT NOT NULL,
  budget_id BIGINT NOT NULL,
  employee_id BIGINT NOT NULL,
  company_id BIGINT NOT NULL,
  requested_amount NUMERIC(14,2) NOT NULL,
  approved_amount NUMERIC(14,2),
  workflow_request_id BIGINT NOT NULL,
  funding_obligation_id BIGINT,
  source_key TEXT NOT NULL UNIQUE,
  CHECK (requested_amount > 0),
  CHECK (approved_amount IS NULL OR approved_amount >= 0)
);
-- Cross-row/business rules: Positive request/nonnegative approval; same trip/budget/employee/payer; do not recover undisbursed funds unless signed D10 model explicitly authorizes committed funding semantics.

-- te.wallet_postings | TE-08 TE-09 LN-04 | blockers D10 D11
CREATE TABLE te.wallet_postings (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  employee_id BIGINT NOT NULL,
  company_id BIGINT NOT NULL,
  advance_id BIGINT,
  settlement_id BIGINT,
  import_batch_id BIGINT,
  delta NUMERIC(14,2) NOT NULL,
  original_amount NUMERIC(20,6),
  original_currency TEXT,
  currency_rate_id BIGINT,
  reverses_posting_id BIGINT,
  transaction_reference TEXT NOT NULL UNIQUE,
  CHECK ((advance_id IS NOT NULL)::integer + (settlement_id IS NOT NULL)::integer + (import_batch_id IS NOT NULL)::integer = 1),
  CHECK ((original_amount IS NULL) = (original_currency IS NULL))
);
-- Cross-row/business rules: Exactly one source kind, validated same employee/payer; original currency amount/rate group consistent. Wallet = SUM(delta); optional balanceAfter projection is not authority.
-- REQUIRED BEFORE USE: append-only trigger + revoke UPDATE/DELETE; controlled compensation only.

-- te.settlements | TE-09 TE-10 CLM-07 | blockers D10 D11
CREATE TABLE te.settlements (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  claim_id BIGINT NOT NULL,
  claim_revision INTEGER NOT NULL,
  employee_id BIGINT NOT NULL,
  company_id BIGINT NOT NULL,
  mode TEXT NOT NULL,
  approved_expense NUMERIC(14,2) NOT NULL,
  advance_cleared NUMERIC(14,2) NOT NULL,
  net_amount NUMERIC(14,2) NOT NULL,
  net_obligation_id BIGINT,
  settled_by BIGINT NOT NULL,
  settled_at TIMESTAMPTZ NOT NULL,
  source_key TEXT NOT NULL UNIQUE,
  UNIQUE (claim_id, claim_revision),
  CHECK (claim_revision > 0),
  CHECK (approved_expense >= 0 AND advance_cleared >= 0),
  CHECK (net_amount = approved_expense - advance_cleared)
);
-- Cross-row/business rules: UNIQUE(claim_id,claim_revision); nonnegative expense/cleared; signed net independently reconciled under D10; eligible advances may exceed expense, remainder explicitly payable/recoverable. Exact same payer/employee; settlement does not certify net paid/recovered.
-- REQUIRED BEFORE USE: append-only trigger + revoke UPDATE/DELETE; controlled compensation only.

-- te.settlement_advances | TE-09 CLM-07 | blockers D10 D11
CREATE TABLE te.settlement_advances (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  settlement_id BIGINT NOT NULL,
  advance_id BIGINT NOT NULL,
  allocated_amount NUMERIC(14,2) NOT NULL,
  source_key TEXT NOT NULL UNIQUE,
  UNIQUE (settlement_id, advance_id),
  CHECK (allocated_amount > 0)
);
-- Cross-row/business rules: UNIQUE(settlement_id,advance_id); amount > 0; same subject/payer/trip; serial total allocations/returns cannot exceed eligible funds.
-- REQUIRED BEFORE USE: append-only trigger + revoke UPDATE/DELETE; controlled compensation only.

-- te.booking_operations | TE-04 | blockers D10 D11
CREATE TABLE te.booking_operations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  segment_id BIGINT NOT NULL,
  operation TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_reference TEXT,
  status TEXT NOT NULL,
  request_checksum TEXT NOT NULL,
  source_key TEXT NOT NULL UNIQUE
);
-- Cross-row/business rules: No guessed provider endpoints/statuses/URLs; allowable input/output captured from sanctioned contract; uncertain operation not blindly repeated.

-- te.booking_events | TE-04 | blockers D10 D11
CREATE TABLE te.booking_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  operation_id BIGINT NOT NULL,
  event_type TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  original_amount NUMERIC(20,6),
  currency_code TEXT,
  currency_rate_id BIGINT,
  UNIQUE (operation_id, provider_event_id)
);
-- Cross-row/business rules: UNIQUE(operation_id,provider_event_id); verify callback signature and allowed status transition; no negative expense tricks for refund/cancellation.
-- REQUIRED BEFORE USE: append-only trigger + revoke UPDATE/DELETE; controlled compensation only.

-- att.mobile_submissions | ATT-14 | blockers D03 D07 D11
CREATE TABLE att.mobile_submissions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  employee_id BIGINT NOT NULL,
  client_event_key TEXT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL,
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  accuracy_metres NUMERIC(10,2),
  device_reference TEXT,
  status TEXT NOT NULL,
  swipe_event_id BIGINT,
  rejection_code TEXT,
  UNIQUE (employee_id, client_event_key),
  CHECK ((latitude IS NULL) = (longitude IS NULL)),
  CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  CHECK (accuracy_metres IS NULL OR accuracy_metres >= 0)
);
-- Cross-row/business rules: UNIQUE(employee_id,client_event_key); coordinate bounds and group consistency; approved accuracy/fence/time/retention policy required, no invented radius. Partitioned swipe identity/FK must include partition key if needed.


-- Reviewed FK attachments.
ALTER TABLE core.employee_assignments ADD FOREIGN KEY (employee_id) REFERENCES core.employees(id);
ALTER TABLE core.employee_assignments ADD FOREIGN KEY (company_id) REFERENCES core.companies(id);
ALTER TABLE core.employee_assignments ADD FOREIGN KEY (location_id) REFERENCES core.locations(id);
ALTER TABLE core.employee_assignments ADD FOREIGN KEY (org_unit_id) REFERENCES core.org_units(id);
ALTER TABLE core.employee_assignments ADD FOREIGN KEY (cost_center_id) REFERENCES core.cost_centers(id);
ALTER TABLE core.employee_assignments ADD FOREIGN KEY (department_id) REFERENCES core.departments(id);
ALTER TABLE core.employee_assignments ADD FOREIGN KEY (designation_id) REFERENCES core.designations(id);
ALTER TABLE core.employee_assignments ADD FOREIGN KEY (grade_id) REFERENCES core.grades(id);
ALTER TABLE core.employee_assignments ADD FOREIGN KEY (reporting_manager_id) REFERENCES core.employees(id);
ALTER TABLE core.employee_assignments ADD FOREIGN KEY (functional_manager_id) REFERENCES core.employees(id);
ALTER TABLE core.employee_assignments ADD FOREIGN KEY (workflow_request_id) REFERENCES wf.requests(id);
ALTER TABLE core.employee_assignments ADD FOREIGN KEY (approved_by) REFERENCES core.users(id);
ALTER TABLE core.import_batches ADD FOREIGN KEY (requested_by) REFERENCES core.users(id);
ALTER TABLE core.import_batches ADD FOREIGN KEY (result_document_id) REFERENCES core.documents(id);
ALTER TABLE core.source_mappings ADD FOREIGN KEY (import_batch_id) REFERENCES core.import_batches(id);
ALTER TABLE wf.definition_versions ADD FOREIGN KEY (definition_code) REFERENCES wf.definitions(code);
ALTER TABLE wf.definition_versions ADD FOREIGN KEY (published_by) REFERENCES core.users(id);
ALTER TABLE wf.request_revisions ADD FOREIGN KEY (request_id) REFERENCES wf.requests(id);
ALTER TABLE wf.request_revisions ADD FOREIGN KEY (chain_version_id) REFERENCES wf.definition_versions(id);
ALTER TABLE wf.request_revisions ADD FOREIGN KEY (submitted_by) REFERENCES core.users(id);
ALTER TABLE wf.notification_attempts ADD FOREIGN KEY (notification_id) REFERENCES wf.notifications(id);
ALTER TABLE core.document_operations ADD FOREIGN KEY (document_id) REFERENCES core.documents(id);
ALTER TABLE core.document_operations ADD FOREIGN KEY (requested_by) REFERENCES core.users(id);
ALTER TABLE att.source_receipts ADD FOREIGN KEY (device_id) REFERENCES att.devices(id);
ALTER TABLE lv.credit_allocations ADD FOREIGN KEY (credit_ledger_id) REFERENCES lv.ledger(id);
ALTER TABLE lv.credit_allocations ADD FOREIGN KEY (debit_ledger_id) REFERENCES lv.ledger(id);
ALTER TABLE lv.credit_allocations ADD FOREIGN KEY (reverses_allocation_id) REFERENCES lv.credit_allocations(id);
ALTER TABLE lv.operation_keys ADD FOREIGN KEY (employee_id) REFERENCES core.employees(id);
ALTER TABLE lv.operation_keys ADD FOREIGN KEY (leave_type_id) REFERENCES lv.leave_types(id);
ALTER TABLE lv.operation_keys ADD FOREIGN KEY (ledger_txn_id) REFERENCES lv.ledger(id);
ALTER TABLE pay.salary_structure_versions ADD FOREIGN KEY (structure_id) REFERENCES pay.salary_structures(id);
ALTER TABLE pay.salary_structure_versions ADD FOREIGN KEY (published_by) REFERENCES core.users(id);
ALTER TABLE pay.run_input_refs ADD FOREIGN KEY (run_id) REFERENCES pay.payroll_runs(id);
ALTER TABLE pay.run_input_refs ADD FOREIGN KEY (employee_id) REFERENCES core.employees(id);
ALTER TABLE pay.payment_obligations ADD FOREIGN KEY (employee_id) REFERENCES core.employees(id);
ALTER TABLE pay.payment_obligations ADD FOREIGN KEY (company_id) REFERENCES core.companies(id);
ALTER TABLE pay.payment_obligations ADD FOREIGN KEY (workflow_request_id) REFERENCES wf.requests(id);
ALTER TABLE pay.source_consumptions ADD FOREIGN KEY (obligation_id) REFERENCES pay.payment_obligations(id);
ALTER TABLE pay.source_consumptions ADD FOREIGN KEY (payroll_item_id) REFERENCES pay.payroll_items(id);
ALTER TABLE pay.source_consumptions ADD FOREIGN KEY (bank_batch_line_id) REFERENCES pay.bank_batch_lines(id);
ALTER TABLE pay.source_consumptions ADD FOREIGN KEY (reverses_consumption_id) REFERENCES pay.source_consumptions(id);
ALTER TABLE pay.payment_events ADD FOREIGN KEY (obligation_id) REFERENCES pay.payment_obligations(id);
ALTER TABLE pay.payment_events ADD FOREIGN KEY (bank_batch_line_id) REFERENCES pay.bank_batch_lines(id);
ALTER TABLE pay.payment_events ADD FOREIGN KEY (evidence_document_id) REFERENCES core.documents(id);
ALTER TABLE pay.payment_events ADD FOREIGN KEY (recorded_by) REFERENCES core.users(id);
ALTER TABLE pay.bank_batch_lines ADD FOREIGN KEY (batch_id) REFERENCES pay.bank_batches(id);
ALTER TABLE pay.bank_batch_lines ADD FOREIGN KEY (obligation_id) REFERENCES pay.payment_obligations(id);
ALTER TABLE pay.bank_batch_lines ADD FOREIGN KEY (employee_id) REFERENCES core.employees(id);
ALTER TABLE pay.output_artifacts ADD FOREIGN KEY (run_id) REFERENCES pay.payroll_runs(id);
ALTER TABLE pay.output_artifacts ADD FOREIGN KEY (company_id) REFERENCES core.companies(id);
ALTER TABLE pay.output_artifacts ADD FOREIGN KEY (employee_id) REFERENCES core.employees(id);
ALTER TABLE pay.output_artifacts ADD FOREIGN KEY (document_id) REFERENCES core.documents(id);
ALTER TABLE pay.statutory_memberships ADD FOREIGN KEY (employee_id) REFERENCES core.employees(id);
ALTER TABLE pay.statutory_memberships ADD FOREIGN KEY (company_id) REFERENCES core.companies(id);
ALTER TABLE pay.statutory_memberships ADD FOREIGN KEY (basis_salary_id) REFERENCES pay.employee_salaries(id);
ALTER TABLE pay.statutory_memberships ADD FOREIGN KEY (evidence_document_id) REFERENCES core.documents(id);
ALTER TABLE pay.tax_elections ADD FOREIGN KEY (employee_id) REFERENCES core.employees(id);
ALTER TABLE pay.tax_elections ADD FOREIGN KEY (workflow_request_id) REFERENCES wf.requests(id);
ALTER TABLE pay.previous_employer_income ADD FOREIGN KEY (employee_id) REFERENCES core.employees(id);
ALTER TABLE pay.previous_employer_income ADD FOREIGN KEY (proof_document_id) REFERENCES core.documents(id);
ALTER TABLE pay.previous_employer_income ADD FOREIGN KEY (verified_by) REFERENCES core.users(id);
ALTER TABLE pay.statutory_postings ADD FOREIGN KEY (item_id) REFERENCES pay.payroll_items(id);
ALTER TABLE pay.statutory_postings ADD FOREIGN KEY (import_batch_id) REFERENCES core.import_batches(id);
ALTER TABLE pay.statutory_postings ADD FOREIGN KEY (employee_id) REFERENCES core.employees(id);
ALTER TABLE pay.statutory_postings ADD FOREIGN KEY (company_id) REFERENCES core.companies(id);
ALTER TABLE pay.statutory_postings ADD FOREIGN KEY (reverses_posting_id) REFERENCES pay.statutory_postings(id);
ALTER TABLE pay.journal_batches ADD FOREIGN KEY (run_id) REFERENCES pay.payroll_runs(id);
ALTER TABLE pay.journal_batches ADD FOREIGN KEY (document_id) REFERENCES core.documents(id);
ALTER TABLE pay.journal_batches ADD FOREIGN KEY (approved_by) REFERENCES core.users(id);
ALTER TABLE pay.journal_lines ADD FOREIGN KEY (batch_id) REFERENCES pay.journal_batches(id);
ALTER TABLE pay.journal_lines ADD FOREIGN KEY (cost_center_id) REFERENCES core.cost_centers(id);
ALTER TABLE pay.loan_installments ADD FOREIGN KEY (loan_id) REFERENCES pay.loans(id);
ALTER TABLE pay.parallel_comparisons ADD FOREIGN KEY (run_id) REFERENCES pay.payroll_runs(id);
ALTER TABLE pay.parallel_comparisons ADD FOREIGN KEY (import_batch_id) REFERENCES core.import_batches(id);
ALTER TABLE pay.parallel_comparisons ADD FOREIGN KEY (reviewed_by) REFERENCES core.users(id);
ALTER TABLE pay.parallel_comparison_lines ADD FOREIGN KEY (comparison_id) REFERENCES pay.parallel_comparisons(id);
ALTER TABLE pay.parallel_comparison_lines ADD FOREIGN KEY (employee_id) REFERENCES core.employees(id);
ALTER TABLE core.prejoin_invitations ADD FOREIGN KEY (candidate_id) REFERENCES core.onboarding_candidates(id);
ALTER TABLE core.prejoin_invitations ADD FOREIGN KEY (issued_by) REFERENCES core.users(id);
ALTER TABLE core.prejoin_invitations ADD FOREIGN KEY (notification_id) REFERENCES wf.notifications(id);
ALTER TABLE core.transfer_requests ADD FOREIGN KEY (employee_id) REFERENCES core.employees(id);
ALTER TABLE core.transfer_requests ADD FOREIGN KEY (from_assignment_id) REFERENCES core.employee_assignments(id);
ALTER TABLE core.transfer_requests ADD FOREIGN KEY (to_company_id) REFERENCES core.companies(id);
ALTER TABLE core.transfer_requests ADD FOREIGN KEY (to_location_id) REFERENCES core.locations(id);
ALTER TABLE core.transfer_requests ADD FOREIGN KEY (to_org_unit_id) REFERENCES core.org_units(id);
ALTER TABLE core.transfer_requests ADD FOREIGN KEY (to_cost_center_id) REFERENCES core.cost_centers(id);
ALTER TABLE core.transfer_requests ADD FOREIGN KEY (workflow_request_id) REFERENCES wf.requests(id);
ALTER TABLE core.transfer_requests ADD FOREIGN KEY (applied_assignment_id) REFERENCES core.employee_assignments(id);
ALTER TABLE ast.custody_events ADD FOREIGN KEY (assignment_id) REFERENCES ast.assignments(id);
ALTER TABLE ast.custody_events ADD FOREIGN KEY (recorded_by) REFERENCES core.users(id);
ALTER TABLE ast.custody_events ADD FOREIGN KEY (separation_id) REFERENCES core.separations(id);
ALTER TABLE ast.custody_events ADD FOREIGN KEY (recovery_obligation_id) REFERENCES pay.payment_obligations(id);
ALTER TABLE hd.ticket_events ADD FOREIGN KEY (ticket_id) REFERENCES hd.tickets(id);
ALTER TABLE hd.ticket_events ADD FOREIGN KEY (actor_user_id) REFERENCES core.users(id);
ALTER TABLE hd.ticket_events ADD FOREIGN KEY (assignee_user_id) REFERENCES core.users(id);
ALTER TABLE hd.ticket_events ADD FOREIGN KEY (notification_id) REFERENCES wf.notifications(id);
ALTER TABLE hd.escalation_rules ADD FOREIGN KEY (category_id) REFERENCES hd.categories(id);
ALTER TABLE core.policy_versions ADD FOREIGN KEY (policy_id) REFERENCES core.policies(id);
ALTER TABLE core.policy_versions ADD FOREIGN KEY (document_id) REFERENCES core.documents(id);
ALTER TABLE core.policy_versions ADD FOREIGN KEY (published_by) REFERENCES core.users(id);
ALTER TABLE reporting.snapshot_builds ADD FOREIGN KEY (company_id) REFERENCES core.companies(id);
ALTER TABLE te.trips ADD FOREIGN KEY (employee_id) REFERENCES core.employees(id);
ALTER TABLE te.trips ADD FOREIGN KEY (company_id) REFERENCES core.companies(id);
ALTER TABLE te.trips ADD FOREIGN KEY (policy_version_id) REFERENCES te.policy_versions(id);
ALTER TABLE te.trips ADD FOREIGN KEY (workflow_request_id) REFERENCES wf.requests(id);
ALTER TABLE te.itinerary_segments ADD FOREIGN KEY (trip_id) REFERENCES te.trips(id);
ALTER TABLE te.employee_travel_levels ADD FOREIGN KEY (employee_id) REFERENCES core.employees(id);
ALTER TABLE te.employee_travel_levels ADD FOREIGN KEY (level_id) REFERENCES te.travel_levels(id);
ALTER TABLE te.policy_versions ADD FOREIGN KEY (approved_by) REFERENCES core.users(id);
ALTER TABLE te.currency_rates ADD FOREIGN KEY (approved_by) REFERENCES core.users(id);
ALTER TABLE te.advances ADD FOREIGN KEY (trip_id) REFERENCES te.trips(id);
ALTER TABLE te.advances ADD FOREIGN KEY (budget_id) REFERENCES pay.budgets(id);
ALTER TABLE te.advances ADD FOREIGN KEY (employee_id) REFERENCES core.employees(id);
ALTER TABLE te.advances ADD FOREIGN KEY (company_id) REFERENCES core.companies(id);
ALTER TABLE te.advances ADD FOREIGN KEY (workflow_request_id) REFERENCES wf.requests(id);
ALTER TABLE te.advances ADD FOREIGN KEY (funding_obligation_id) REFERENCES pay.payment_obligations(id);
ALTER TABLE te.wallet_postings ADD FOREIGN KEY (employee_id) REFERENCES core.employees(id);
ALTER TABLE te.wallet_postings ADD FOREIGN KEY (company_id) REFERENCES core.companies(id);
ALTER TABLE te.wallet_postings ADD FOREIGN KEY (advance_id) REFERENCES te.advances(id);
ALTER TABLE te.wallet_postings ADD FOREIGN KEY (settlement_id) REFERENCES te.settlements(id);
ALTER TABLE te.wallet_postings ADD FOREIGN KEY (import_batch_id) REFERENCES core.import_batches(id);
ALTER TABLE te.wallet_postings ADD FOREIGN KEY (currency_rate_id) REFERENCES te.currency_rates(id);
ALTER TABLE te.wallet_postings ADD FOREIGN KEY (reverses_posting_id) REFERENCES te.wallet_postings(id);
ALTER TABLE te.settlements ADD FOREIGN KEY (claim_id) REFERENCES pay.claims(id);
ALTER TABLE te.settlements ADD FOREIGN KEY (employee_id) REFERENCES core.employees(id);
ALTER TABLE te.settlements ADD FOREIGN KEY (company_id) REFERENCES core.companies(id);
ALTER TABLE te.settlements ADD FOREIGN KEY (net_obligation_id) REFERENCES pay.payment_obligations(id);
ALTER TABLE te.settlements ADD FOREIGN KEY (settled_by) REFERENCES core.users(id);
ALTER TABLE te.settlement_advances ADD FOREIGN KEY (settlement_id) REFERENCES te.settlements(id);
ALTER TABLE te.settlement_advances ADD FOREIGN KEY (advance_id) REFERENCES te.advances(id);
ALTER TABLE te.booking_operations ADD FOREIGN KEY (segment_id) REFERENCES te.itinerary_segments(id);
ALTER TABLE te.booking_events ADD FOREIGN KEY (operation_id) REFERENCES te.booking_operations(id);
ALTER TABLE te.booking_events ADD FOREIGN KEY (currency_rate_id) REFERENCES te.currency_rates(id);
ALTER TABLE att.mobile_submissions ADD FOREIGN KEY (employee_id) REFERENCES core.employees(id);
ROLLBACK;
