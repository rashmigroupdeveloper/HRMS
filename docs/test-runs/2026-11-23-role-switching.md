# Role switching and navbar motion — 2026-11-23

## Behavior and authorization

The account dropdown lists assigned roles and marks the active one. On phones, a compact role dropdown sits beside Menu. Each tab keeps its own selected role. Requests send `x-hrms-role`; the authenticated server validates membership afresh and builds permissions, Super Admin status and data scopes from that role alone. Missing header selects the lowest assigned role ID. Unknown or revoked choices have no role permissions and retain valid choices for recovery.

Switching navigates through React Router's unsaved-page blocker, shows a short status transition, then reloads Home. The fresh document discards previous caches and in-flight reads. Switching is disabled during mutations. Own records, manager/HOD relationships and personally assigned manager/HOD/person approval steps remain identity-based. Role/access/fallback approval pools require the corresponding active role. No role assignments are created by the selector. The attendance self-correction gap remains as requested.

## Motion

- Selected navbar background uses a named native View Transition; supported browsers carry the dark pill between links in 260 ms. Unsupported browsers navigate normally.
- Navbar controls have short hover/pressed feedback, and dropdown chevrons rotate when opened.
- Role changes briefly show the selected name and switching icon before committing the new request header. The underlying application is inert during this transition.
- Reduced motion removes the role-switch delay, spatial effects and view-transition movement; color feedback remains.
- No new animation dependency or database field.

## Verification

- Backend integration tests resolve real sessions with different role headers, verifying that inactive permissions, Super Admin and company scopes do not mix. Unknown/revoked IDs fail closed. An approval regression checks both inbox visibility and decision access.
- Existing approval fixtures now explicitly activate the role they hold; the production authorization path has no legacy union-permission bypass.
- Before the motion addition, Safari screenshots were reviewed at 1440 and 390 CSS px. The role dropdown fits both, selected state has a check mark, and phone controls remain compact. The authenticated demo account has only Super Admin assigned, so switching between multiple assigned roles was verified on the backend rather than by changing that demo account's assignments.
- A separate browser sign-in with the seed password failed; no password was reset or further guesses attempted.
- The initial full role-switching suite passed 170 tests in 33 files. Concurrent Leave changes subsequently required regenerating Prisma's client; final checks are recorded below.

### Final results

- `npm run typecheck`: passed after regenerating Prisma from the concurrently updated schema.
- `npm run lint -w frontend`: passed; existing `HodDialogs.tsx` Fast Refresh warning remains.
- `npm run build`: passed; existing large-chunk advisory remains.
- `npm run check:api-tracker`: passed, 250 APIs.
- `npm run check:data-access`: passed, 108 repository functions / 41 watched tables.
- `npm run test`: passed, 174 tests / 33 files, against the protected test database. Existing pg/Node deprecation warnings remain.
- `git diff --check`: passed.
- After motion changes, Safari navigation from Leave to My attendance succeeded. Screenshots at 1440 and 390 CSS px showed the active navbar pill and compact role controls in place. Responsive mode was then exited. The exact intermediate animation frames, reduced-motion runtime preference, full multi-role transition and matched held-loading header screenshots were not captured; reduced-motion branches and loading markup were reviewed in source.
- During the concurrent Leave update the local Leave balance card returned an internal server error. My attendance loaded normally. This was observed outside the role-switching slice; no Leave schema migration or record correction was applied as part of this work.

### Screenshot review against the UI critic brief

| Surface | Verdict | Findings |
| --- | --- | --- |
| Desktop header, 1440 | Good | Selected role remains in the existing account chip; role choices reuse the account dropdown and check marks. No new page-height cost. |
| Phone header, 390 | Good | Role button and Menu fit on one row; role text is bounded and dropdown stays inside the viewport. Touch targets are at least 36 px. |

No additional layout change was indicated by the rendered header screenshots. Multi-role rendering and intermediate animation-frame quality remain a scoped verification limit, rather than a release-readiness claim.
