# Dictionary validation — 11 Nov 2026

- PASS: fresh local catalog exported using read-only, repeatable-read transaction; 165 logical tables/views and 1,843 columns.
- PASS: all 1,840 application columns match the current Database type interface; the other three fields belong to migration bookkeeping.
- PASS: 1,843 unique, nonblank definitions; Markdown field headings, CSV rows and JSON records match the catalog exactly.
- PASS: all local Markdown document links resolve. Structured JSON field keys are not presented as scalar enum values.
- PASS: generator runs successfully; JavaScript syntax check passes; plan diff whitespace check passes.
- PASS: backend `npm run verify` completes typecheck and ESLint.
- BLOCKED: backend `npm run verify` stops at knip because existing `absenceRun` export in `backend/src/modules/attendance/absence.service.ts:54` is unused. This file was already modified before this documentation task and was not changed here. Dependency checks, coverage tests and build were not reached by that command. No full-green repository verification is claimed.

The deliverable changes documentation and adds a read-only metadata exporter. No application behavior, policy, schema or migration was changed. Broader semantic implementation review, nested payload/API dictionaries, deployment and acceptance remain separate work.

## Everyday-language addition — 11 Nov 2026

PASS: all 1,843 fields have nonblank everyday-language explanations, reasons and examples in JSON and CSV, and appear once in the 17 reader guides. Every table/view has an introductory business purpose. Available choice meanings are included in reader guides. All local document links resolve and the three Python documentation tools compile. Application code and database were unchanged in this increment; no additional application verification run was required. The earlier knip limitation above remains the last recorded full backend verification outcome.

## Independent verification and corrections — 11 Nov 2026

Reviewed the current uncommitted dictionary/generator changes against the captured catalog and regenerated the type index from current application declarations. No business-row reads, migrations or application behavior changes were made.

Corrections:

- Day-count quantities (`pay.payroll_items.payable_days`, `pay.fnf_settlements.days_payable`, `pay.fnf_settlements.leave_encash_days`) no longer carry a rupee-unit label. Numeric day fields are explicitly described in days.
- Reference examples distinguish declared foreign keys from external/polymorphic/unconstrained identifiers. They no longer promise an existing database target for every `_id` field.
- Timestamp examples distinguish an expiry/deadline boundary from an event that already happened.
- Type-index provenance now binds the extracted index to the declaration file hashes and index output hashes. The builder refuses changed declarations or edited/stale index outputs before publishing. Merely hashing today's declarations alongside yesterday's extracted index is no longer accepted.
- Field-purpose keys are trimmed before lookup; reader-guide counts are generated from the actual field count; CSV uses LF line endings so the repository whitespace gate passes.

PASS: regenerated catalog/JSON/CSV sets match exactly: 1,843 unique fields, including 1,840 application fields. Everyday explanations, reasons and examples are nonblank and match between JSON and CSV. Each field appears once in its schema reader guide. All local Markdown links resolve. Type-index JavaScript syntax and all Python documentation-tool syntax checks pass. Both stale-source and modified-index rejection paths were exercised without altering source/catalog files. `git diff --check` passes.

Backend `npm run knip` was rerun and remains RED for the pre-existing unused `absenceRun` export in `src/modules/attendance/absence.service.ts:54`. No application code was changed to conceal this unrelated blocker; no new full-backend verification result is claimed. Frontend and deployment were outside this documentation-change verification.

These checks establish dictionary coverage and generator consistency, not a full per-field runtime semantic audit. Writer/reader tracing, ownership, authorization, invariants and disposition review remain open in the Stage 0.2 tracker.
