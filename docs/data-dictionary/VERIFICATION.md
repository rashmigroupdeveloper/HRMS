# Dictionary validation — 11 Nov 2026

- PASS: fresh local catalog exported using read-only, repeatable-read transaction; 165 logical tables/views and 1,843 columns.
- PASS: all 1,840 application columns match the current Database type interface; the other three fields belong to migration bookkeeping.
- PASS: 1,843 unique, nonblank definitions; Markdown field headings, CSV rows and JSON records match the catalog exactly.
- PASS: all local Markdown document links resolve. Structured JSON field keys are not presented as scalar enum values.
- PASS: generator runs successfully; JavaScript syntax check passes; plan diff whitespace check passes.
- PASS: backend `npm run verify` completes typecheck and ESLint.
- BLOCKED: backend `npm run verify` stops at knip because existing `absenceRun` export in `backend/src/modules/attendance/absence.service.ts:54` is unused. This file was already modified before this documentation task and was not changed here. Dependency checks, coverage tests and build were not reached by that command. No full-green repository verification is claimed.

The deliverable changes documentation and adds a read-only metadata exporter. No application behavior, policy, schema or migration was changed. Broader semantic implementation review, nested payload/API dictionaries, deployment and acceptance remain separate work.
