# Role-specific Home composition polish — 2026-11-25

Continued the 24 November Home pass after the user requested stronger Crextio layout inspiration and a more cohesive,
useful dashboard per role. Current branch: hrms-new. During the overnight interruption the initial dashboard work was
committed and newer holiday changes landed; final verification below covers the resumed branch, not only the earlier
246-test result. No schema, API, permission, dependency or production change was introduced by this polish pass.

## Composition

The reference was local `crextio-ref/crextio-08.webp`: a wide light work surface alongside a narrower charcoal focus,
with consistent rounded panels, quiet elevation, compact rows and restrained gold actions. Main remains the business
reference. No sample salary, headcount, chart or trend values were copied into the product.

- HR: decisions in the wide work area, joining work/pre-joining in the side column, scoped People today below.
- Manager/HOD: decisions beside charcoal People today; recent requests and personal tools remain available.
- Employee: recent requests beside own attendance cycle; details, leave and workspace tools remain available.
- Administration: permitted tools lead, with scoped attendance/decisions according to actual access and relationships.
- Phone: primary work then role focus, followed by personal tools. Existing active-role authorization and actual
  manager/HOD relationships continue to decide visible capabilities. No role names are hard-coded.
- Uniform panels no longer lift as if the entire container were a button. Individual controls retain focus/hover.
- Known HR/admin work layouts do not wait for attendance overview. The decision reader starts alongside overview,
  using the same typed query/cache, avoiding an unnecessary sequential decision-list load.
- Pending unknown layouts use neutral light/dark workspace placeholders; attendance errors expose the existing error
  and an attendance retry destination. Compact empty decisions omit repeated guidance.

## Browser and screenshot review

Used localhost 5191/5291 against TEST_DATABASE_URL ending `_test`, existing synthetic accounts and no mail transport.
Restarted only this task's temporary preview, regenerating the existing Prisma client to match the newer committed
HolidayTone schema. No new fixture records or database migration were created by this continuation. The regular test
runner applies required existing test migrations as part of its normal setup.

Captured before/after desktop (CSS 1440) and phone (CSS 390) layouts. The browser sometimes scales PNG output; checked
DOM width/scrollWidth and scrollY. Evidence is temporary at `/tmp/hrms-home-polish/`, including eight role captures,
`before-desktop.png`, `before-phone.png`, and held `loading-desktop.png`/`loading-phone.png`.

- Signed into synthetic employee and manager accounts; switched real manager/HR/admin roles.
- Opened an employee request from Recent requests into ApprovalDrawer and closed it; no decisions or withdrawals.
- Checked the manager report link retains TEAM scope and today's explicit dates.
- Held API responses in temporary preview middleware, compared attendance/request skeletons with loaded panels:
  headings, actions, attendance metric labels and recent-day slots remain present. Removed the hold afterward.
- Reviewed before/after against `.claude/agents/ui-critic.md`. Independent reviewer opened all role captures and
  Crextio reference: materially improved composition, no high-severity defects, useful work exceeds half the desktop
  first screen. Fixed a medium empty-request spacing issue plus repeated guidance.
- Recaptured HR at scrollY 0 to remove sticky-navigation capture occlusion and verified its updated four-column People
  today. Final bounded reviewer disposition: **Ship — requested findings resolved**. Last copy/spacing refinements were
  checked in source; this is not a blanket contrast/keyboard/error-state certification.
- Detector returned `[]`. Earlier in-process Vite missing-export messages came from splitting HomeOnboarding exports;
  the completed source builds and renders correctly after reload.

## Final checks on resumed branch

- `npm run typecheck` — passed.
- `npm run lint -w frontend` — passed; existing HodDialogs.tsx fast-refresh export warning remains.
- `npm run build` — passed; existing large-chunk advisory remains.
- `npm run check:api-tracker` — passed: 286 documented APIs, all with scope lines. No API changed in this polish.
- `npm run check:data-access` — passed: 121 repository readers / 42 watched tables.
- `npm run test` — passed: 49 files, 265 tests, default unchanged command. pg client-query deprecation warnings remain.
- `git diff --check` — passed.

Docs updated: README.md, BACKLOG.md, this record. CLAUDE.md and API_TRACKER.md describe unchanged rules/contracts.
No deployment or push performed. Other specialist-report stages and broader HR/payroll/executive/device metrics remain
in BACKLOG; this delivery is the Home composition slice only.
