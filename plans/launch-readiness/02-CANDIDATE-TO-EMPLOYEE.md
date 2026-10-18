# Sponsor-locked candidate → employee boundary —17 Oct2026

Requirements LC-01/02, CORE-02/06/10, PAY-02/07. Sponsor explicitly clarified the ATS handoff and answered the joining-date question: **permanent employee ID only after HR confirms actual joining**, even if the completed onboarding form was approved earlier.

## Required sequence

ATS LOI issued → candidate accepts LOI → waiting/prejoining period → candidate completes application/documents → HR reviews/accepts the submitted data → HR confirms actual joining → atomic HRMS conversion and permanent company-prefix e-code. Until the final joining confirmation, retain the person only in the candidate/prejoining population. No employee row, permanent e-code allocation, employee login, employee salary, attendance/payroll entitlement or regular employee MIS/headcount may be created by LOI acceptance/form submission alone.

The legal entity is a configured master record. `core.companies.ecode_prefix` and the existing company-locked sequence allocate the permanent e-code (examples RML, KOIL). Never derive it from the person's name or hardcode10/11/14 entities; the entity catalog can grow. Existing imports retain existing e-codes. Candidate external IDs, onboarding link tokens and permanent employee IDs are distinct identities.

## Implementation acceptance

- Intake is idempotent for an authoritative ATS candidate/offer identity and does not allocate a permanent ID. Internal ATS offer approval/no-show is not evidence of candidate acceptance/rejection.
- Prejoin submission is validated, one-use and transactional, preserving candidate separation. Hashed tokens only at rest; expiry is policy data. Missing/expired/reused/no-show tokens fail without profile mutation.
- Conversion requires completed/accepted application plus explicit HR confirmation of actual joining. Reject a future actual joining date. Record actor, actual joining date, source candidate/offer and confirmation evidence in immutable audit, masking statutory/bank values. Enforce on server; disabling a button is insufficient.
- Check candidate/company/unit/department/location/salary/master population authority and consistency inside the transaction. A scoped HR operator cannot convert foreign-unit candidates, reassign them to bypass scope or inspect duplicates outside authority.
- Lock candidate and identity/company sequence consistently; concurrent/retried conversion cannot produce two employees, consume codes prematurely, duplicate salary/tasks or partly mark a candidate converted. Roll back code cursor, employee/user/salary/tasks/probation/candidate state and audit together on failure.
- Use the established salary allocator/money engine, approved entity-specific structure and actual offered/probation facts. No floating probation amount or empty component map. Do not silently invent a work email, usable password, biometric enrollment or statutory IDs. First-login/task authority must be real and independently permission checked.
- Candidate board is visibly separate from employee MIS. Show actual source states and missing readiness, dynamic entity options and configured prefix preview without consuming sequence. Final action explicitly confirms joining and creates the employee. No sample fallback rows or success without server evidence.
- Tests: every prejoin phase excluded from employee counts; future/no-confirmation/no-form/foreign-scope/malformed-data/invalid-structure refusal; rollback at downstream failure; concurrent same candidate and duplicate identities; per-entity prefix allocation including newly added entity; actual joined conversion returns one permanent employee and audit/ledger/task evidence. Money changes require golden cases and human review.

## Observed code gaps before repair

`backend/src/modules/lifecycle/onboarding/onboarding.service.ts` calls a sequence of independent DB writes despite an 'Atomic' comment, accepts incomplete candidates, generates fallback email and a placeholder active login, creates active employees before a joining gate, and optionally writes a floating probation salary with empty components. Ingest stores raw prejoin token and marks link_sent without a proved delivery. `prejoin.service.ts` validates then updates without row locking. Router lacks population checks. Frontend `OnboardingBoardPage.tsx` contains sample fallbacks and hardcoded master IDs. Repair is pending; this document records decisions and is not completion evidence.

## Verified partial repair —18 Oct2026

See [pack33](../sow-completion/33-ACTUAL-JOINING-AND-DEPLOYMENT-AUDIT.md) and its evidence for the actual joining/application/master/scope/transaction/UI repair, hash-only conditional single-use links, scoped protected application preview, required real organizational-unit assignment, case-insensitive email identity locks and no-fake-Kent guard.42 focused backend tests and full frontend298 tests pass. Migration1752330000000 was applied only to local test hrms; no columns/tables were added. Native browser proof is synthetic and cleaned.

LC-01/02 and G3 remain open. Initial salary still uses the old floating probation calculation and empty components; approved probation facts/due-date behavior, statutory/document verification/correction, actual delivery/resend, task-owner permission, independent-root conversion race proof, authoritative ATS acceptance and linked-account SSO are unfinished. Sponsor will provide raw Kent API data and production/integration locations later. Do not treat this partial repair as payroll or launch readiness.
