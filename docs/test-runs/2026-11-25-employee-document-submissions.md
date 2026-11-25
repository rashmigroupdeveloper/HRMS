# Employee document submissions — 2026-11-25

## Decisions and slice

The user selected employee submissions with HR review, superseding the 16 November exclusion for documents and
family/nominee requests. The HR Head will receive the planned daily joiner/leaver email; Super Admin may configure
additional recipients. Those recipients were recorded as a decision, not configured or emailed during this slice.

This implementation completes **own document submission only**, with the systematic new-only follow-on plan and
schema proposals in BACKLOG item 32. Family/nominee requests, daily report/email, other imports and biometric adapters
are not implemented by this change. No new schema fields/models, library, root folder, migration or deployment.
Pre-existing Home changes were preserved.

## Implementation

- Existing employees.documents.upload is now authenticated with business checks in the service: own employee ID is
  allowed; another employee still requires EMPLOYEES READ, EMPLOYEE_DOCUMENTS WRITE and sensitive-type access.
  Outside-range employees remain NOT_FOUND. No direct family/nominee editing was opened.
- The existing EmployeeDocument model/defaults, readable storage keys, content detection, 5 MB/file validation,
  attribution, status/rejection reasons and scoped HR review/delete/restore are reused.
- Self-submitted files always start PENDING. No caller may supply trusted review fields. The submitting employee
  cannot review their own upload even after activating an HR role.
- A self-submitted pending file cannot satisfy document-evidence/consent checks (for example before a background
  check). Existing HR-uploaded evidence retains its non-rejected/non-deleted rule.
- Verified copies stay current until a replacement is verified. Pending replacements remain visible and included in
  the pending-review count; older/rejected files are retained. Employees can submit a corrected copy after rejection.
- My profile → Documents offers Add document and the existing guarded FormDialog. Owner UI shows upload/view/status,
  not verify/reject/delete/restore. HR continues review on the employee's existing Documents tab.
- Profile and document skeletons share the upload note and include the same button/header/columns. HR letter-issue
  controls were kept separate from the new own-upload permission.

## Verification

Tests use only TEST_DATABASE_URL (`*_test`) with unique synthetic records. Added five integration tests in
backend/tests/data-access-self-service-documents.test.ts: own pending upload/download and trusted attribution;
colleague/read-only/outside-company denial; scoped HR review plus self-review/removal denial; rejection/resubmission;
pending consent protection and existing verified copy survival; bad signatures/empty/oversized files.

Browser preview 5191/5291 runs on that test database with no mail transport. Used the existing synthetic employee
TEBJMTV05 (active test HR role without document-management permission) to submit synthetic-review.pdf. Upload succeeded,
returned pending status with employee attribution, and showed no verify/reject/delete/restore buttons for the owner.
Roleless ownership and HR outcomes are additionally covered by the integration tests. No real employee documents or
live review decisions were used. No additional permissions were granted to the preview account in this slice.

Before/after desktop (1440 CSS px) and phone (390 CSS px) screenshots are at /tmp/hrms-self-service-qa/. The phone table
keeps the existing internal horizontal scroll; document scrollWidth was 390, matching the viewport. Held preview API
responses to compare loading-desktop/loading-phone with loaded titles, note, button and columns; removed the hold
and reset viewport afterward. File chooser/form submission was exercised, including real multipart backend routing.

The screenshot-only reviewer reported one medium issue: the new header action had a 32px phone target. Fixed loaded,
document-loading and profile-loading versions to 36px on phone (desktop remains compact), measured 36px in the DOM,
and recaptured. Final scoped reviewer verdict: **clears for ship**. Detector returned `[]`. This is not a blanket
accessibility or every-browser certification.

Final commands:
- npm run typecheck — passed (initial test type annotation included unsupported roleId; removed and reran).
- npm run lint -w frontend — passed; existing HodDialogs.tsx fast-refresh export warning remains.
- npm run build — passed; existing large frontend chunk advisory remains.
- npm run check:api-tracker — passed, 286 APIs, all with scope lines.
- npm run check:data-access — passed after repository edits and final checks, 121 readers / 42 watched tables.
- npm run test — passed, 50 files / 270 tests; focused new suite also passed 5/5. No test thresholds weakened.
- git diff --check — passed.

Docs updated: CLAUDE.md, README.md, BACKLOG.md, API_TRACKER.md, this record; stale canonical-edit comments corrected.
The next schema-free report slice and all schema/IT/business dependencies remain explicit in BACKLOG item 32.
