# Phase 0, Stage 0.2 — complete database semantic review

Scope: sponsor requested full review of all1,813 application fields,19 October2026. No business schema/application changes or destructive cleanup are authorized by a field's lack of references alone. Claims/travel fields are reviewed structurally despite deferred implementation; MFA remains excluded.

- [x] Read governing specifications and capture read-only logical catalog; distinguish physical partitions, application schema and migration bookkeeping.
- [x] Establish syntax-level operation evidence separately from manual meaning/ownership decisions; reference counts are never an acceptance test.
- [ ] Review every application table and column: purpose/source, canonical authority vs snapshot/cache, writers/readers, relationships, invariants, scope/masking, lifecycle, duplicate/conflicting representations and requirement disposition.
- [ ] Publish per-field decisions and table dossiers, prioritized findings with code/DDL references, exact remediation/retest instructions and reviewed coverage validation.
- [ ] Validate every live field appears exactly once, all references exist, no unresolved field is labeled accepted, and input/source changes are detected.

Completion means every field has a reviewed disposition, including justified gaps, conflicts and excluded/deferred scope. It does not mean every feature is implemented, every invariant is enforced, or deployment/UAT is accepted. Review runtime operations/constraints; do not infer passing behavior from a typed declaration or a green historic test suite. No live employee values or credential contents are needed.

## Data dictionary deliverable — 11 Nov 2026 (CORE-08/NFR-04)

- [x] Export a fresh metadata-only catalog in a repeatable-read/read-only transaction; no migration or business-row read/write by the exporter.
- [x] Publish [the complete data dictionary](../docs/data-dictionary/README.md), module references, CSV and structured JSON: **1,843 defined fields / 165 logical relations**, including 1,840 application fields and three migration bookkeeping fields. Physical child partitions inherit parent definitions; vendor/system schemas are excluded.
- [x] Include per-field meaning and basis, SQL type, nullability, default, relationships, full column-linked constraints, finite value meanings where declared, code declaration/source, monetary units, table indexes and lifecycle triggers.
- [x] Validate exact catalog coverage, zero duplicate or blank definitions and zero application type fields missing from the database. Capture source hashes and preserve compatibility/excluded MFA and historical combined-payment distinctions.

This completes the requested persisted-field dictionary. It does **not** complete the broader semantic implementation/disposition audit above, certify every nested JSON payload/HTTP field, advance a release gate, or establish production parity. Historical purpose explanations are documentation inputs, not current runtime acceptance evidence. Verification outcome is recorded with the dictionary's coverage evidence.

Validation: dictionary coverage/link/format checks pass; backend verification passes typecheck and ESLint, then stops at knip's existing unused `absenceRun` export in `attendance/absence.service.ts:54`. Full verification is not green; later gates were not reached. See [verification record](../docs/data-dictionary/VERIFICATION.md).

## Nontechnical explanations — 11 Nov 2026

- [x] Add an everyday-language explanation, reason for keeping the detail and illustrative example for all 1,843 fields, alongside the technical definition in module pages, JSON and CSV.
- [x] Publish [HRMS explained for everyone](../docs/data-dictionary/plain-language/README.md), with 17 subject guides, a purpose statement for all 165 tables/views, a plain-language glossary and available choice meanings.
- [x] Verify all 1,843 fields appear once in the reader guides; explanation/reason/example coverage matches CSV and JSON; all local document links resolve and documentation generators compile.

This increment changes documentation and its generation tools only. It preserves the existing catalog snapshot and technical rules; examples explain meaning and do not establish policy rates, new features or production acceptance. No backend or frontend application code changed in this increment, so the earlier backend verification result remains recorded without another application test run.

## Verification of sponsor's dictionary changes — 11 Nov 2026

- [x] Independently regenerate the current type index and dictionary; check exact catalog/JSON/CSV and reader-guide field coverage, links and syntax.
- [x] Correct day-count units, non-FK reference examples and expiry/deadline wording; require source/index provenance before generation and derive reader counts dynamically.
- [x] Exercise stale-source and modified-index rejection; confirm `git diff --check` passes after CSV line-ending correction.

Evidence: [dictionary verification](../docs/data-dictionary/VERIFICATION.md). Application code/schema were unchanged. Backend knip still reports the existing unused `absenceRun` export; no full-green application verification or complete runtime semantic disposition review is claimed.
