# Remaining work — 19 Oct 2026

All wip/job branches (fix, payroll, joining, laptop, e2e, uiux) are now merged into `main`.
The merge got a typecheck only. Full `npm run verify`, payroll recon and e2e have **not** been run since.

## 1. Verify the merge
- `npm run verify` in backend and frontend. Payroll recon must show all 44 matching, with RML033625 netting 59124.
- Full role e2e. Watch the merge-touched areas:
  - `POST /attendance/recompute`: the company materialise mode and the ecode mode were merged into one union.
  - Access control tabs: the laptop's "Connected accounts" tab sits alongside IT's "Login accounts".
  - The Kent simulator now uses Kent's webhook event shape.
  - The EPF columns are defined once, in `types.ts`, and no longer in `types.joining.ts`.

## 2. Open bugs (details in BUGS.md)
- E2E-023: duplicate bank batches.
- E2E-030, E2E-031, E2E-032.
- Confirm the fixes for E2E-022 (F&F double pay) and E2E-027 (payroll worker on a fresh DB) hold after the merge.

## 3. Kent
- Test the webhook, API pull, DB-read and CSV/SFTP modes against a real CamAttendance device and account.
- Needs the URL, token or SFTP details from Kent / RML IT. See KENT_RESEARCH.md and docs/integrations/KENT.md.

## 4. Joining form and master data
- REQ-001..015: every RML/HR/02/01 field, plus pre-join validators (PAN, Aadhaar, bank) when a pre-joiner is converted. See JOINING_FORM_MAP.md.

## 5. SOW Missing rows (see the SOW Tracker xlsx)
- Offer letter and LOI generation.
- CTC templates. Part of this is merged from payroll; finish it.
- Special-character sanitising.
- Section 24 home-loan declaration.
- Survey recommendations.
- F&F cycle calendar and F&F TAT tracking.
- Employee access to resignation.

## 6. UI
- Leadership dashboards for ceo_cell, plant_head and hr_head.
- Sick-leave label wraps on phones.
- Styling for the new joining and travel forms.
- Missing after screenshots for ceo_cell, it_admin and super_admin.

## 7. Guides
- GUIDE-01..04: update the role guides for the new features and refresh their screenshots.

## 8. Final pass
- Full e2e for all 10 roles, on desktop and phone.
- axe and Lighthouse.
- Write VERIFY_REPORT.

## 9. Client decisions
- Kent / RML IT connection details.
- Which joining pack applies to which staff category, and whether agency contract labour is in scope.
- Who counts as Business Head and as Finance.
- App: the publishing entity, whether RML has MDM, and who gets geo check-in. See MOBILE_RECOMMENDATION.md.
- Sign-off on the Node/React stack as a deliberate change from the blueprint.
