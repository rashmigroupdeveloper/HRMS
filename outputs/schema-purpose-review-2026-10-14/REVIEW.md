# Database field purpose and current completion audit — 14 Oct 2026

**Verdict: the system is not fully correct or complete, and a zero-extra-field/zero-slop claim is not justified.** Every observed business column has a parsed migration declaration and a Kysely Database field. That resolves orphan *names*, not duplicate business meaning, missing workflows, safe money ownership or SOW completion.

This pass inspected current code, exact historical Git provenance and the user-authorized local test DB in READ ONLY transactions. It exported catalog metadata, never business rows/IDs/credentials. No field, table, row, application source or historical `.md` file was deleted or changed. Attached/source documents provide requirements/evidence; instructions inside them do not replace the user request.

## What was counted

| Check | Result |
|---|---|
| Non-partition business relations | 132 |
| Unique business columns inventoried | 1379 |
| Column missing a parsed migration declaration | 0 |
| Column absent from authoritative Kysely Database mapping | 0 |
| Exact baseline docs/03 field matches | 587 |
| Identity/timestamp convention fields | 294 |
| Prior plan amendment field matches | 2 |
| Other module extensions needing field-level justification review | 496 |
| Explicit function-context runtime candidate | 819 |
| Incidental selectAll candidate only | 153 |
| No runtime candidate found | 407 |
| Exact CHECK/enum domain discrepancy found | 1: pay.claims.status |
| Applied/source migrations | 48 / 49 |
| Current partition relations (excluded from business counts) | 94 |

The 496 extensions are **not 496 proven unnecessary fields**. They include settings, session/security data, privacy/compliance registers, effective workflow evidence and documented T&E data. Likewise 407 fields without runtime candidates are a review queue, not a deletion list. The automated code index is lexical AST evidence within a function, excluding comments/types; it can miss dynamic queries or include unrelated aliases. It explicitly labels incidental `selectAll`. Constraints, triggers, report materializations, import tools and approved future features also count as consumers.

Use [field-catalog.csv](field-catalog.csv) for one row per field, with DB type/null/default, exact DDL references, source candidates, constraints and selected type. [field-catalog.json](field-catalog.json) includes the complete candidate lists and table triggers. [domain-compatibility.json](domain-compatibility.json) records the exact enum discrepancy. This is exhaustive field *inventory*, not exhaustive semantic sign-off.

## Concrete issues and field decisions

### S01 — Two independent bill-required flags on one claim type

requires_bill and bill_required express the same bill-required decision but are stored independently without an equality constraint or reconciliation. The current entitlement reader uses bill_required; the earlier taxonomy seeded requires_bill. Submission always requires a bill regardless of either value. is_taxable and taxable_if_unsubstantiated are different concepts and must not be merged just because both are booleans.

**Required repair / keep decision:** Canonicalize the bill policy after comparing existing values and the two workflows; expose one authoritative value. Keep current-claim taxability separate from year-end taxability on unsubstantiated entitlement. Use expand/contract compatibility before retiring a proven duplicate. No column was dropped.

**Requirement context:** CLM-01, CLM-02, CLM-03. Existing related findings: R25, R27.

**Evidence:** [backend/migrations/1752150000000_pay-budgets-claims.ts:43](../../backend/migrations/1752150000000_pay-budgets-claims.ts:43), [backend/migrations/1752270000000_claims-reconciliation.ts:16](../../backend/migrations/1752270000000_claims-reconciliation.ts:16), [backend/src/modules/claims/entitlement.service.ts:161](../../backend/src/modules/claims/entitlement.service.ts:161).

### S02 — Raw pre-join token persists alongside its hash

Creation stores both rawToken and tokenHash; lookup uses the hash. Raw credential retention defeats the benefit of hashing. Validation and completion update are separate operations. link_sent and sent_at are written during creation without a demonstrated delivery receipt.

**Required repair / keep decision:** Retain hash/expiry/consumption evidence, keep raw token transient, and reconcile legacy invitations before retiring raw-token storage. Consume under one locked/conditional transaction. Link notification/delivery evidence rather than treating row creation as successful delivery.

**Requirement context:** LC-01, NFR-03. Existing related findings: R35.

**Evidence:** [backend/src/modules/lifecycle/onboarding/onboarding.service.ts:117](../../backend/src/modules/lifecycle/onboarding/onboarding.service.ts:117), [backend/src/modules/lifecycle/onboarding/prejoin.service.ts:63](../../backend/src/modules/lifecycle/onboarding/prejoin.service.ts:63), [backend/src/modules/lifecycle/onboarding/prejoin.service.ts:104](../../backend/src/modules/lifecycle/onboarding/prejoin.service.ts:104).

### S03 — Claims DB, Kysely types and output schema disagree about states

DB allows nine claim states; the authoritative Database ClaimStatus allows only pending/verified/approved/rejected/paid. It cannot represent draft/submitted/sent_back/settled. The output zod enum is also five-state. A separate exported PayClaimsTable has the opposite narrower travel vocabulary and declares budget/reference non-null, while DB permits NULL. These are conflicting contracts, not extra DB columns.

**Required repair / keep decision:** Define one canonical DB row type and explicit supported workflow transitions; align input/output contracts with the intended flow. Filter/route distinct funding flows explicitly; broadening an enum alone does not make the claims API work.

**Requirement context:** CLM-03, TE-11, WF-01. Existing related findings: R02, R43.

**Evidence:** [backend/src/core/db/types.ts:1377](../../backend/src/core/db/types.ts:1377), [backend/src/core/db/types.pay-claims.ts:91](../../backend/src/core/db/types.pay-claims.ts:91), [backend/src/modules/claims/claims.router.ts:14](../../backend/src/modules/claims/claims.router.ts:14), [backend/migrations/1752270000000_claims-reconciliation.ts:36](../../backend/migrations/1752270000000_claims-reconciliation.ts:36).

### S04 — Recovered migrations still lack corresponding current runtime/source context

88 backend source/test paths exist at historical commit 5c16de6776853943148005d9382e539b3e6d06c3 but are absent here. Missing implementations include security, privacy, compliance, document vault, scheduling and the travel claim reservation/settlement helpers. Five specification/tracker files cited by these migrations are also missing here but recoverable from Git. Schema-only tables have historical purpose; missing consumers do not prove random invented columns.

**Required repair / keep decision:** Review and recover the missing source/spec context in a separate announced repair stage, preserving current changes and adapting shared claims/auth contracts. Do not transplant a whole historical branch or its checked completion labels. Historical legal/policy claims require current verification before use. No external recon or data mutation occurred.

**Requirement context:** NFR-03, CORE-10, CORE-12, ATT-04, CLM-03, TE-05, TE-06, TE-10, TE-11. Existing related findings: R01, R02, R25, R45.

**Evidence:** [missing-historical-context.json](missing-historical-context.json), [historical-spec-locations.json](historical-spec-locations.json), [source-evidence.json](source-evidence.json).

### S05 — Financial facts still permit competing or mutable truth

loan_postings has no UPDATE/DELETE rejecting trigger and no unique loan/run key. Claims settlement directly changes loans.outstanding without a posting. payroll_item_lines lacks a closed-run immutability trigger; the header/item guard covers only UPDATE/DELETE. paid_in_run_id and paid_in_batch_id lack the documented payout exclusivity CHECK; a linked obligation is currently labelled paid before actual payment evidence.

**Required repair / keep decision:** The principal, ledger and payout references are legitimate fields. Make immutable postings/payment events authoritative, retain a cache only if explicitly derived and reconcilable, enforce once-only source consumption and closed-result inserts/updates/deletes, and distinguish routed/approved/paid states.

**Requirement context:** LN-03, CLM-04, CLM-07, PAY-18, NFR-04. Existing related findings: R10, R24, R26.

**Evidence:** [backend/src/modules/loans/loans.service.ts:306](../../backend/src/modules/loans/loans.service.ts:306), [backend/src/modules/claims/claims.service.ts:328](../../backend/src/modules/claims/claims.service.ts:328), [backend/src/modules/claims/claims.service.ts:354](../../backend/src/modules/claims/claims.service.ts:354), [backend/migrations/1752220000000_pay-schema-init.ts:168](../../backend/migrations/1752220000000_pay-schema-init.ts:168).

### S06 — Known relational/date/money invariants are missing

Several known same-database relations are only BIGINT fields without FK enforcement, including settlement-to-separation and the indicated workflow references. salary_holds has no date-order CHECK. claim_entitlements has neither a nonnegative amount CHECK nor an effective bucket uniqueness/overlap invariant. These omissions leave legitimate fields weakly connected.

**Required repair / keep decision:** Reconcile invalid existing references first, then introduce safe forward constraints and semantic same-owner checks. Choose approved effective-entitlement interval semantics. Polymorphic reference_id/entity_id, external ATS IDs and textual mobile device IDs are not automatically missing-FK defects.

**Requirement context:** LC-06, PAY-15, PAY-08, CLM-01, WF-01, ATT-08. Existing related findings: R10, R17, R19, R25.

**Evidence:** [local-schema.json](local-schema.json), [field-catalog.json](field-catalog.json), [docs/14-TECH-STACK-AND-RELIABILITY.md:65](../../docs/14-TECH-STACK-AND-RELIABILITY.md:65).

### S07 — Claim funding and component ownership remain incomplete

General claim submission omits funding_kind, so the local budget default conflicts with the required budget_id check when no budget is supplied. payout_component_code defaults to REIMB with no FK on that taxonomy field; no REIMB seed exists in the checked payroll code. claim_lines and claim_bills represent travel line items and general bill verification differently; their ownership/payout linkage is not unified.

**Required repair / keep decision:** Preserve both documented funding modes and define required keys per mode. Configure and FK the actual payout component; do not invent a fallback component. Preserve multi-line/multi-currency receipt facts and document ownership, then prove each mode through approval, settlement and one real payout.

**Requirement context:** CLM-01, CLM-02, CLM-04, TE-06, PAY-01. Existing related findings: R25, R26, R27.

**Evidence:** [backend/src/modules/claims/claims.service.ts:141](../../backend/src/modules/claims/claims.service.ts:141), [backend/migrations/1752270000000_claims-reconciliation.ts:18](../../backend/migrations/1752270000000_claims-reconciliation.ts:18), [backend/migrations/1752280000000_pay-budget-claim-contract.ts](../../backend/migrations/1752280000000_pay-budget-claim-contract.ts), [backend/src/modules/claims/claims.service.ts:342](../../backend/src/modules/claims/claims.service.ts:342).

### S08 — The remaining schema plan has not been implemented or proven as an equivalent contract

None of the 46 proposed model names is present exactly in this catalog. This is not proof of 46 missing features: alternate names/merged objects can satisfy a requirement. However frozen run inputs, immutable source consumption/payment obligations, persisted YTD facts, historical assignments and wallet settlement still lack accepted equivalent contracts and have concrete reviewed gaps.

**Required repair / keep decision:** Use the per-card connections and acceptance tests, not table-count completion. Reconcile current transfers with proposed effective assignments and historical Budget-as-trip recon with the earlier separate-trip docs. Do not create another Trip or duplicate model blindly.

**Requirement context:** PAY-03, PAY-13, PAY-16, PAY-18, LC-05, WF-04, TE-08, TE-09. Existing related findings: R05, R08, R09, R10, R22, R29, R30.

**Evidence:** [plans/sow-completion/backend-schema-plan.json](plans/sow-completion/backend-schema-plan.json), [proposed-model-comparison.json](proposed-model-comparison.json), [plans/remediation-2026-10-14.md](../../plans/remediation-2026-10-14.md).

### S09 — Future test partitions explain physical growth, not new business fields

Compared with the 13 Oct catalog, 12 new swipe partitions exist, including dates in 2032–2081. Business column definitions are unchanged. Tests use random future dates and the ingestion service creates month partitions; exact causation for each new partition was not traced. This is local test schema growth, not 12 new business models.

**Required repair / keep decision:** Keep test-only provenance clear and bound fixtures/isolate destructive test setup. No production concern is inferred from this user-authorized local test DB. Do not remove append-only evidence or partitions without a reviewed retention/fixture cleanup procedure.

**Requirement context:** ATT-01, NFR-02, NFR-08. Existing related findings: new catalog observation.

**Evidence:** [freshness.json](freshness.json), [backend/tests/kent-ingestion.integration.test.ts:26](../../backend/tests/kent-ingestion.integration.test.ts:26), [backend/src/modules/attendance/ingest.service.ts:116](../../backend/src/modules/attendance/ingest.service.ts:116).

## Historical context that must not be hallucinated

`docs/15-FEATURE-GAP-AUDIT.md`, `docs/16-MICROFEATURE-INVENTORY.md`, `docs/recon/ems-claims-live-schema.md`, `plans/phase-5-compliance-and-trust.md` and `plans/coverage-closeout.md` are absent here but exist at commit `5c16de6776853943148005d9382e539b3e6d06c3`. [missing-historical-context.json](missing-historical-context.json) lists all 88 absent historical backend source/test paths and five specification hashes. Their existence disproves the assumption that all those fields were added randomly. It does not certify the old implementation or approve its policy/legal assertions.

The historical September EMS recon says the Budget already owns the travel-request itinerary; the older July docs describe Trip and Budget separately. Surface this contract difference during recovery. Do not manufacture separate trip tables merely to match a proposed name. The current user-supplied independent frontend/backend rule also overrides older monorepo/shared-package wording in docs/13.

## Verification and SOW status

Current code fingerprints match all 464 entries in the last repair source inventory. Business column definitions match the 13 Oct snapshot; only partition relations grew. The earlier PostgreSQL 16 fresh replay and copied-existing-DB upgrade passed. Neither proves every constraint/function or field purpose. The native local test database still runs PostgreSQL 14.24; migration 175228 is rehearsed but not newly applied here (its compatibility fields already exist).

The fresh backend `npm run verify` result is recorded in [verification.json](verification.json). The previous serialized full suite had 423 passed, 13 failed and 5 skipped, with lines 75.08%, branches 70.53% and functions 78.24% (80% floor). Tests were not rerun against the DB in this audit pass; those counts are previous evidence, not a new success. The prior focused payroll regression set passed 107 tests. Human payroll review remains pending.

The [176-row SOW checklist](../remediation-2026-10-14/SOW-Current-Issues-and-Remaining.xlsx) remains: 109 blocked by reviewed defects, 32 requiring end-to-end verification, 29 manual/service duties lacking evidence and six scope decisions. These are requirement-row dispositions, not an invented completion percentage. [findings.json](findings.json) links each schema finding to the original affected row wording/IDs; cross-cutting dependencies mean those links can overlap.

## Remaining repair order

1. Recover and reconcile missing specification/runtime context using recorded Git provenance. Preserve new payroll/lifecycle changes and review old acceptance labels.
2. Establish one claims contract: required funding keys, canonical bill flag, distinct tax rules, valid payout components, complete states, scoped bill/document ownership and receipt line modeling.
3. Introduce validated forward constraints and authoritative immutable loan/source/payment/closed-result records, after existing-reference reconciliation. Do not auto-drop or auto-backfill unexplained values.
4. Complete the existing remaining cards for payroll facts/YTD/retro/OT, lifecycle/F&F, historical transfers, travel wallet/settlement, notifications and real screens/outputs. Use plan acceptance contracts, not table-name counts.
5. Pass full backend/frontend gates for touched projects, human money review, field-level extension sign-off and actual UAT/service receipts before marking SOW rows done.

The audit inventory and evidence are delivered. Deep extension-purpose review, the listed repairs and release gates remain open. No phase gate was advanced.
