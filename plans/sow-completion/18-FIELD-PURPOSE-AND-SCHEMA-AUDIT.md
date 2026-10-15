# Current field-purpose and schema audit — 14 Oct 2026

Read this after [17 — repair status and current SOW](17-REPAIR-STATUS-AND-CURRENT-SOW.md). It adds evidence; it does not replace the specification or certify a completed phase.

The [current schema audit](../../outputs/schema-purpose-review-2026-10-14/REVIEW.md) inventories all **1,379 fields across 132 business relations**, excluding partition duplicates and framework/migration bookkeeping. Every observed field has a parsed migration declaration and an authoritative Kysely Database field. This proves name provenance, not semantic correctness.

The [field catalog](../../outputs/schema-purpose-review-2026-10-14/field-catalog.csv) records type, nullability/default, source declarations, candidate runtime references, constraints and SELECT type for each field. The [JSON catalog](../../outputs/schema-purpose-review-2026-10-14/field-catalog.json) preserves full candidate evidence. **Do not delete a field based on a lexical absence finding.** Defaults, keys, triggers, derived reports, imports and approved deferred workflows can justify fields.

- [x] Fresh local test DB catalog exported inside READ ONLY transactions; no business rows or credentials exported.
- [x] All 1,379 business fields indexed against source/migrations/types and baseline/proposal context.
- [x] Exact CHECK/enum probe performed; `pay.claims.status` mismatch recorded.
- [x] Historical missing source/spec context located in Git with commit/hash provenance.
- [x] Fresh backend `npm run verify` attempted: typecheck passes, lint blocks with 597 errors.
- [ ] Complete manual field-purpose sign-off for 496 module extensions; classification is not a finding that all 496 are unnecessary.
- [ ] Resolve duplicate `requires_bill` / `bill_required`; define separate current-claim vs unsubstantiated-entitlement tax rules.
- [ ] Remove raw invitation credential retention safely; enforce one-time consumption and real notification receipts.
- [ ] Align claims states and nullable/funding keys across DB, canonical types, output schemas and both funding workflows.
- [ ] Reconcile and recover absent historical runtime/spec context without replacing current work or importing old checked completion labels.
- [ ] Enforce immutable financial sources, posting idempotency, payout evidence, closed-run line guards and validated relational/date/money constraints.
- [ ] Prove equivalent implementations of remaining plan contracts; absence of a proposed table name alone is not a feature verdict.
- [ ] Pass full verification, human payroll review and the original per-row SOW/service/UAT acceptance criteria.

[Nine schema findings](../../outputs/schema-purpose-review-2026-10-14/findings.json) link to affected original SOW row IDs/wording and related R01–R46 findings. They overlap the existing review and are not silently added to the historical workbook counts. All 176 original SOW rows remain in the current checklist. No phase gate is advanced.

The current checkout lacks **88 backend source/test files** present at historical commit `5c16de6776853943148005d9382e539b3e6d06c3`, plus five referenced specification/tracker files. See [provenance](../../outputs/schema-purpose-review-2026-10-14/missing-historical-context.json). Historical source existence establishes recoverable context, not correctness or approval of every policy assertion. Read and reconcile it before calling its database fields speculative or rebuilding those modules.

This pass changed audit artifacts and trackers only. It did not modify application source/schema/data or remove any fields.
