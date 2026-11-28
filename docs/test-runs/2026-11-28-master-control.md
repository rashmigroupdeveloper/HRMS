# Master Control — developer-only operations, 2026-11-28

## Scope and account

Built the first complete read-only operational slice requested by the user, with Crextio-informed visual refinement.
The user identified `core_developers@rashmigroup.com`, employee `RML033903`, as the sole owner. Both exact work-email
lookup and employee-code/former-code lookup found no matching record in the current development database. No real
employee/login was invented, no password was reset, no production account was changed and no deployment was performed.
Activation needs the real existing account in its owning environment and its `user_accounts.id` configured as
`MASTER_CONTROL_ACCOUNT_ID`. Missing pin disables this capability for everyone. The current email, employee/account
association, enabled login and ACTIVE/ON_NOTICE status are checked on each Master Control call. Temporary-password
sessions are refused. Other Super Admins cannot call these APIs or transfer the capability by changing their email.
This gate is a technical capability, not an HR role grant; ordinary business permissions remain unchanged.

## Built and observed

- `/ess/master-control` and `/manage/master-control`, with an owner-only menu entry based on `accounts.me.canMasterControl`.
- Real JobRun counts and exact hourly aggregates over 24 hours; open outcome numerals and proportional execution mix.
- Selectable database/worker/files/mail topology. The database probe measures query latency; storage checks filesystem
  permissions/capacity without a file write; migration metadata can be unavailable. Recent mail-retry execution is
  activity evidence, not a heartbeat. SMTP configuration is not delivery proof. Recovery is explicitly unconnected.
- Job-name search, result/time filters, 20-row pagination and inline fixed failure guidance. Raw errors never reach the
  client. Namespace wrapping keeps long identifiers legible. No job-run or mail-resend action exists in this slice.
- MailRetry counts, oldest waiting time, retry attempts and dates. No recipients, subjects, bodies or attachments are
  selected. The queue does not retain successful delivery history; terminal payloads are removed by the existing worker.
- API runtime and progressively disclosed diagnostics; redacted diagnostic JSON copy/download generated in the browser.
- Automatic refresh every 15 seconds while visible; pause, manual refresh and stale-snapshot labelling. A denied refresh
  stops displaying the old private workspace. Initial failure shows a clear retry state.
- An hourly bar can be selected by keyboard; a native 38px-high hour selector provides a reliable phone touch target.
  Full date/time/count accessible labels and selected-hour text avoid relying only on chart colors.

## Verification

Automated checks passed:

- `npm run typecheck`
- `npm run lint -w frontend` — exit 0; existing Fast Refresh warning in `HodDialogs.tsx` remains.
- `npm run build` — exit 0; existing large-bundle advisory remains.
- `npm run check:api-tracker` — 341 APIs, each documented with Scope.
- `npm run check:data-access` — 148 watched repository functions covered or explained. Run after repository edits and
  again before completion. The new APIs return installation operational metadata, not bulk people's records.
- `npm run test` — 71 files / 406 tests passed. PostgreSQL driver deprecation warnings remain.
- Focused owner-boundary tests — 5 passed: exclusive pin + exact live email, other Super Admin denial, unauthenticated
  and temporary-password rejection, disabled/exited owner, changed/moved email, missing/mismatched pin, employee/account
  mismatch, filtered counts/paging, invalid input and omission of raw errors/private mail fields.

A separate local production-build preview used `TEST_DATABASE_URL` (guarded `_test` name), synthetic company/people,
short-lived synthetic sessions, 80 job records plus one worker-activity record, and 3 mail retry records. SMTP was removed
from that process and the worker was not started. The preview never sent mail. No synthetic metrics are shipped in the
application: the screenshot counts come from the isolated preview's real API/database path.

Browser checks at 1440, 768 and 390px:

- Loaded overview, job list/detail, failure filter, mail and Toolbox screens: no horizontal overflow or JavaScript errors.
- Every topology node selected; selected service observation updated.
- Job result filter produced only failed rows; page 2 and an empty search rendered correctly.
- Downloaded JSON parsed and contained operational data without credentials, mail contents or employee records.
- Pause prevented polling for more than 15 seconds; manual Refresh still requested fresh data.
- Failed background refresh retained a labelled stale snapshot. Initial API failure rendered recovery copy.
- A different account saw the ordinary 404 screen; a direct overview request returned HTTP 404.
- Space on a focused hourly bar selected it; native hour selection updated the same count text. The native selector
  measured 38px high at all checked widths and 326px wide on phone.
- Reduced-motion disabled the authored signal animation; no overflow or JavaScript errors in that mode.
- Overview loading captured at 1440/390; job/mail/Toolbox loading also captured. Titles, labels, map geometry, icons and
  lower panels remain present while values load. Unknown conditional observations can change height when data arrives.

## Visual evidence and review

Before work, captured and reviewed the incumbent login at 1440/390 for the Warm Editorial palette/type/control baseline;
there was no existing Master Control page. No authenticated before-state of this new page is claimed.
Reference images inspected from `main:crextio-ref`: crextio-02, crextio-010 and crextio-021; no photographs or other
reference assets were reused. The established Geist/cream/charcoal/gold identity stays intact.

First independent visual review requested attention-first ordering on phone, removal of empty attention space,
consistent node geometry, better namespace wrapping and fuller skeletons. These were implemented. The user's Crextio
comparison prompted lighter open numerals, the execution mix, charcoal chart bars and softer cream panels. Attention
now comes first whenever the panels stack. The final narrow touch-target finding was addressed with the native hour
selector; selected chart bars retain a charcoal outline, preserving gold for Refresh.

Mechanical design detector reported no findings. Final real-browser design inspection reported **0 failures** at
1440/768/390, with warnings for dense 12px operational sublabels and differing panel content heights. The repository's
minimum is 12px; primary job labels are 13px. Independent utility panels keep natural heights to avoid empty stretching.
Explicit allowances retain the repository/user-required cream palette and soft header-control shadows. The active nav's
existing charcoal background was made explicit for automated contrast measurement, with no visual identity change.

Working evidence is under `/tmp/hrms-master-control/` (loaded/loading/state PNGs, inspector report, command logs and
browser assertion JSON). A persistent desktop preview, using synthetic data, is at:
`/Users/anooppratapsingh/.codex/visualizations/2026/11/28/01a22076-a972-7b51-b658-f74b8e9ffe1b/master-control-preview.png`.

The reviewer judged the refined interface 8.5/10 within the incumbent identity and still less expressive than the
reference art direction; this is a qualitative assessment, not user acceptance or a claim of visual superiority.
Final reviewer disposition: **ship this visual slice**; hour selection scored 9/10 and final loading finish 8.5/10.
The preview process was stopped gracefully, its sessions revoked, reserved email released and its own job/mail fixtures
removed after verification. The main development server and real accounts were left unchanged.

## Documentation and limits

Updated `CLAUDE.md`, `README.md`, `API_TRACKER.md`, `BACKLOG.md` item 34, backend `.env.example` and relevant code comments.
Independent documentation review found no material inaccuracies. No new root design documents, schema models, database
fields or libraries were added. Concurrent payroll edits were preserved; a user/external commit included the initial
Master Control work during this session, and later visual refinements remain local.

Deferred controls are named in BACKLOG item 34: actual backup/restore evidence and drills, dedicated worker heartbeat,
schedule-aware overdue jobs, incident alerts, correlated logs, workflow-specific retries/regeneration, maintenance
writes, permission diagnostics, sensitive-read auditing and integration health/replay. This console does not implement
those controls or independently harden the existing employee-account recovery model. Account exclusivity applies to
requests authenticated as the pinned account; existing credential-recovery/server-administration mechanisms remain
separate trust boundaries.
