# Daily movement report settings — 25 November 2026

## Scope and implementation

Approved configuration stage only on `hrms-new`: `DailyMovementReportSetting`, with 09:00 IST, previous-day
coverage and no-movement summaries on by default. No recipient/delivery models, scheduler registration or email
sending were added. Delivery is kept disabled and cannot be enabled through this API.

- Generated migration `20261125055737_daily_movement_report_setting`, supplemented before application with singleton
  (id 1) and IST minute range constraints. Applied to `hrms_new_test`; Prisma client generated.
- One HR Head role FK, deletion restricted; standard actor/time audit columns. Reads return virtual defaults before
  the first save, without choosing a role or creating a row.
- Dedicated `daily-movement-reports` module avoids an employees → accounts → employees dependency cycle. Uses the
  accounts service's metadata-only role picker, not a bulk list of employee holders.
- `dailyMovementReports.settings.get/save` require active `CurrentUser.isSuperAdmin`. Section 8 rule: one global
  setting reserved to Super Admin, no employee records returned; choosing a role never grants access.
- Saves validate the role has Employee directory & job View and reject stale timestamps/duplicate initial creates.
  Audit actors come from the session. Strict validation rejects activation/audit fields in input.

## Automated coverage

`backend/tests/data-access-movement-settings.test.ts`: five integration tests cover limited company and group-wide
ACCESS Edit denial, assigned-but-inactive Super Admin denial, read-only defaults, eligible/unknown/non-reporting roles,
time boundaries/invalid enum/unknown fields, saved values and attribution, stale writes, singleton/time constraints
and selected-role deletion protection. The test preserves/restores any prior singleton; the test database is never wiped.

## Browser checks

Test-only preview at 127.0.0.1:5191, API 5291, forced `_test` database with SMTP removed. Synthetic people/roles only.
Before and after screenshots at 1440 × 900 and 390 × 844 were reviewed against `.claude/agents/ui-critic.md`.

1. HR role has no Email settings button, including while a Super Admin role is assigned but inactive.
2. Active Super Admin sees People → Joiners & leavers → Email settings.
3. Initial form: no selected role, 09:00 IST, Previous day, no-movement checkbox checked; Save disabled until eligible role.
4. Select synthetic HR role, Cancel: Discard changes question appears. Keep editing retains values.
5. Save closes the form; reopening restores role and options.
6. Found and fixed cached defaults on immediate reopen: successful save now updates the typed query cache before invalidation.
7. Changed no-movement option, saved/reopened and confirmed changed value; restored approved true value.
8. Held API loading screenshots retain headings, field labels, helper text and footer. Fixed original height/footer differences.
   Final loaded/loading dialog layouts align on desktop and phone. Document width equals viewport width (1440/390).
9. Viewport override reset; own hold marker removed. Temporary synthetic Super Admin grant/configuration cleanup verified separately.

Evidence (local, synthetic data only): `/tmp/hrms-movement-settings-qa/`:
`before-desktop.png`, `before-phone.png`, `final-loaded-desktop.png`, `final-loaded-phone.png`,
`final-loading-desktop.png`, `final-loading-phone.png`, `final-report-desktop.png`, `final-report-phone.png`.

## UI finish review

The independent Impeccable reviewer failed because the workspace reported no credits. Replaced with the documented
in-thread fallback review; this is not an independent reviewer approval. Detector ran once and returned `[]`.

Disposition: ship (configuration UI, screenshot review only).

- **persistence:** implementation follows existing components/tokens. PRODUCT.md/DESIGN.md/sidecar are absent; this
  narrow extension preserves the incumbent system rather than creating new root artifacts or a visual identity.
- **fidelity:** type matches existing sans hierarchy; materials match cream surfaces/soft shadows; ground matches
  Warm Editorial; labels, required controls, protected form and configuration-only status match the approved stage.
  Phone stacks footer/actions to preserve readable controls. Loaded/loading geometry matches at both required sizes.
- **ceiling:** reached for this compact settings extension. No new visual system or imagery is needed.
- **material_fixes:** none outstanding in the six final screenshot captures. This does not certify unobserved states.
- **keep:** preserve compact labels, explicit disabled delivery, protected edits and role-based visibility.

Design documentation pass: no shared design changes. Checked `frontend/src/index.css`, shared FormDialog/Input/NativeSelect/
Label components, the settings form/skeleton and final captures. Palette: existing cream/ink; typography: existing sans
with compact headings; spacing: existing field gaps; shapes: existing dialogs/pills; states: matching skeletons and
disabled controls. No new design rule or pre-existing drift was canonized.

## Migration boundary

Read-only `prisma migrate status` on local app DB `hrms_new` reports this migration plus 11 earlier pending salary/
holiday/leave migrations. No app database migration batch was applied as part of this isolated stage. The pending
chain needs its own reviewed rollout before the app database can serve these settings. Test migration deployment passes.
No actual HR Head role or production recipient is chosen, and no real mail was sent.

## Final checks

All required checks pass on the final implementation:

- `npm run typecheck`: pass (backend, scripts and frontend).
- `npm run lint -w frontend`: pass; existing HodDialogs.tsx fast-refresh warning.
- `npm run build`: pass; existing large client-chunk advisory.
- `npm run check:api-tracker`: pass, 290 APIs with Scope entries.
- `npm run check:data-access`: pass, 122 watched repository reads.
- `npm run test`: pass, 53 files / 284 tests, 87.82 seconds. Existing pg query-concurrency deprecation warnings.
- `git diff --check`: pass.

Cleanup verification: the synthetic preview account no longer has Super Admin, and the test singleton table has
zero rows, matching the pre-UI state. The stage's migration remains applied only in the test database.

Updated documentation: README.md (module tree/usage/migration requirement), BACKLOG.md (approved and built stage,
remaining recipient/delivery work), API_TRACKER.md (two configuration APIs), and this test-run record.
CLAUDE.md's general structure/access rules remain accurate and were not changed.

