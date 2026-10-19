# Database field relevance audit —19 October 2026

**Verdict: compatibility inventory complete; semantic audit remains open. This is not a no-slop or deployment-ready certificate.**

The authorized local TEST database contains **162 application tables/views and1,813 application fields**. Every application field has a matching TypeScript declaration, and no declared application field is missing from the live schema. This checks presence, not exhaustive SQL/TypeScript type, nullability or runtime serialization compatibility. Physical partitions inherit their parent definition and are not counted again. Canonical migration bookkeeping adds one infrastructure table/three fields.

## Evidence for every field

`field-register.json` contains one entry per live column: table/type/nullability/default, constraints and FK relationships, trigger context, exact type declaration, purpose comments when present, candidate production references, migration/spec pointers and review decision. `type-symbols.json` uses the TypeScript compiler to resolve inherited interfaces. `source-fingerprints.json` identifies the source files scanned. `database-metadata-before-bookkeeping-cleanup.json` preserves the initial structural snapshot; `database-metadata.json` is the current snapshot. No employee values or credentials are included. **147 fields now have individual manual purpose/connection annotations** in `field-purposes-reviewed.json`; the other inventory entries are not claimed semantically accepted.

Reference detection is lexical and deliberately conservative. A filename/column mention does not prove a correct read/write, scope or transaction. Conversely, selectAll, aliases, dynamic field maps, SQL functions/triggers and approved planned modules can explain a field without a direct reference. **Never turn a zero-reference count into a DROP migration.** Direct column comments are sparse; that is a documentation gap, not evidence that all uncommented fields are junk. Cross-check the governing requirement and its actual flow.

## Findings and fixes

Read `reviewed-findings.json` for exact references and decisions.

1. **Removed proven duplicate migration bookkeeping.** `public.undefined` contained only the two targeted holiday/vault migration records already in canonical `public.pgmigrations`. Migration1753000000400 checks exact columns and known/canonical records and uses no CASCADE. Native regression proves it refuses unknown columns or records. No HR rows were deleted. Future programmatic runners must explicitly set `migrationsTable: 'pgmigrations'`.
2. **Connected document classification.** Generic `kind` and catalog FK `doc_type` now have distinct purposes. The vault recognizes converted joining files, supports old kind-only rows, and deduplicates both formats by the existing content digest under employee locking. Catalog retention class now protects statutory-ID/health files, with a separate configured compensation class list; a general HR vault grant does not bypass field authority. No new business column.
3. **Connected ignored attendance fields.** Separate session start/end, paid breaks, OT start offset and explicit swipe direction now feed computation. AR/OD use the same stored half windows. Device completeness waits through the final session. A working day with no configured shift fails closed. Existing half-presence/payable policy remains unchanged. Net late/early calculation now follows the documented subtraction of grace (09:25 minus09:00 minus10 grace=15 late minutes); the old calculation/test expected25. The shift API now persists and returns all recovered micro-fields while preserving omitted fields from older clients.
4. **Protected swap context.** Existing workflow JSON holds both original shift IDs and week-off values. Requests and decisions lock both employees before workflow rows; final effects recheck current actor authority for both people. Generic bypass is reserved. Old pending requests without a snapshot need withdrawal/recreation. Independent-connection concurrency and plant acceptance remain open.
5. **Tax configuration is disconnected.** `pay.it_slabs` has no current direct application consumer, while TDS functions contain embedded slab arrays and run context calls them. Treat this as a release blocker and configuration-source conflict, not proof the tax table is useless. Read docs04/10 in full, choose/freeze the effective fiscal rule source, verify statutory facts, hand-compute goldens and obtain payroll human review before money changes. No money formula changed here.
6. **Joining schema is ahead of its code.** Structured addresses, education/experience/certifications, statutory profile, nominations/declarations and medical tables have joining-form requirement references but no current production table consumers beyond types in this snapshot. Those features are incomplete. Keep the documented fields and implement their validated atomic conversion/read/write/version/export paths. Legacy address text is specified as a derived read copy, not a second editable authority. Clarify master physical attributes versus medical-exam snapshots before wiring collection.
7. **MFA is excluded, but its legacy tables are nonempty.** Metadata counts show32 enrollment rows and320 recovery-code rows; no secret/hash values were read. Leave the feature disabled. Safe retirement requires record provenance/retention review; absence of runtime code is not permission to discard these records.
8. **New source/catalog gaps found.** Kent passthrough fields and ATT-14 mobile attributes have documented purposes but are not transported by the current RawSwipe contract. Device expected hourly traffic, joining checklist inclusion and per-type file limits have incomplete runtime consumers. Keep these as explicit implementation gaps, not invented active features or DROP candidates.
9. **Penalty rule editing repaired.** Saving another shift field now preserves exact existing custom rules. Only explicitly edited simplified controls regenerate their own cause; invalid, fractional, negative and overlapping ranges are rejected. Corrected the misleading “forces HD” text. A pending swap also rechecks both participants remain active at approval.
10. **Privacy recovery remains open.** Retention/rights/notices/consents/access-event schema has approved purpose but does not establish delivered behavior. Preserve immutable events and retained facts. A cached current-consent projection needs atomic event updates and rebuild proof.

## Open gate and next work

- Continue table-by-table semantic review of each register entry, including candidate writers/readers, field masking, provenance, canonical ownership, lifecycle/versioning, invariants and reporting/export paths.
- For every unused field, classify **required but not implemented**, **DB-managed/derived**, **historical compatibility**, **source duplication needing consolidation**, or **unjustified**. Supply requirement and code evidence; no invented purposes.
- Fix the remaining API integration gaps and payroll-rule configuration conflict. Sponsor confirmed preserving attendance facts and showing penalties separately. One new `att.day_records.penalty_evaluation` snapshot records exact matched rules and observed minutes. It is validated by the DB, frozen by existing day locks and exposed separately in own/scoped-HR APIs and the employee drill-down. NULL preserves historical unknown/not-evaluated meaning; [] records an evaluated clean day. Existing boolean is constrained compatibility, never a day quantity. No payroll stacking/cap/consumption formula is inferred.
- Re-run full backend/frontend verify on a stable checkout and record final counts. Other software is editing this checkout, so an earlier pass does not certify later files. Do not lower coverage or raise timeouts to hide failures. Source branch remains required until all meaningful deltas are recovered and durably preserved.

## Reproduce the read-only inventory

From `/Users/anooppratapsingh/Documents/HRMS/backend`, use Node24:

```sh
/opt/homebrew/opt/node@24/bin/node scripts/run-local-check.mjs node_modules/tsx/dist/cli.mjs scripts/audit-schema-relevance.ts
/opt/homebrew/opt/node@24/bin/node scripts/index-schema-types.mjs
python3 scripts/analyze-schema-relevance.py
```

The snapshot command enforces loopback `/hrms` and a PostgreSQL READ ONLY transaction. Analysis scripts only read repository files and write audit artifacts. Schema cleanup was a separate guarded, explicitly selected migration, recorded in `bookkeeping-cleanup-applied.json`; it is not part of the read-only command.

Latest full verification checkpoint: backend971 tests/132 files and frontend365 tests/51 files pass with static/build gates. Backend branches81.44%, lines86.28%. Read wave-0 `verification.json` for log hashes, exclusions and remaining acceptance gates. A green suite is not proof that every field or source-only branch feature is semantically complete.
