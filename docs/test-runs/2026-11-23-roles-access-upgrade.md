# Roles & access — review and upgrade, 23 November 2026

## Scope and references

Reviewed `/access` and the role editor, employee assignment controls, account actions and security-rule drafts. Used the repository's Crextio references, particularly `crextio-010.webp` (desktop People), `crextio-019.webp` (phone hierarchy) and `crextio-024.webp` (phone People cards). These informed warm surfaces, a restrained charcoal role summary, compact pill controls and responsive cards; no reference assets were reused.

No API, backend authorization rule, schema field, dependency or production role assignment changed. Role definitions remain shared settings requiring ACCESS Edit over all companies; employee accounts and sessions retain their existing backend ACCESS scopes. UI searches only narrow the records returned by those APIs.

## Screenshot review

| Surface | Before | After | Main finding |
| --- | --- | --- | --- |
| Roles, desktop 1440 | Needs rework | Good | The old 21-column permission matrix required substantial sideways scrolling; the new role selector and vertical permission panel keep each permission readable. |
| Roles, phone 390 | Needs rework | Good | The old page repeated every area for every role; the new native selector inspects one role at a time, with no horizontal page overflow. |
| People, phone 390 | Not scored before (source review only) | Good | Login details now use cards; account operations are in an accessible menu, with Change roles visible. |

Before screenshots were captured in authenticated Safari at 1440 and 390 CSS px. That native window subsequently became unavailable. After screenshots and interactions used a separate localhost preview against the protected `_test` database with disposable synthetic employees and roles. The preview and tab were closed afterward. No real employee login or role was edited.

### Findings fixed

1. Wide matrix and repeated phone permission lists obscured the role being inspected. Replaced with a searchable role navigator, focused summary, permission search, group filters and expandable View/Edit explanations.
2. The copy incorrectly described union permissions after active-role switching. It now explains that the active role supplies permissions and data access; inspecting a role does not activate it.
3. Immediate cell saves submitted whole permission maps and could overlap a stale role snapshot. Permission changes now use the existing explicit Save/password-confirmation role drawer.
4. The role editor lacked permission search and used custom radio buttons without native arrow-key behavior. Added search and native radio inputs, preserving the existing permission bounds.
5. The employee row exposed several competing account operations. Moved secondary operations into an account menu and retained Change roles as a direct action; phones use cards.
6. Security drafts could disappear on tab changes or route navigation. Kept the editor mounted across tabs and added route/refresh protection; no security setting was saved during this check.
7. Unchanged forms could be submitted and assignment fields remained editable during save. Disabled unchanged saves and protected pending/restricted fields.
8. Error responses could also render empty-success content. Roles, people and sessions now retain their error presentation without the misleading empty state.
9. Loading markup initially produced a nested-div-in-paragraph warning. Corrected the markup and confirmed no new console errors after reload.

The after screenshots show a compact header and task controls; the role panel occupies the main working area. At 390 px the first permission is visible without traversing other roles. At 1024 px and 390 px, measured document width equaled viewport width (no page overflow).

## Full-flow verification

Story: select a role → inspect its API-backed permissions → edit a draft → confirm password → save through `accounts.roles.update` → see refreshed permissions.

- Searched for a disposable test role and selected it without changing the employee's active role.
- Permission search narrowed the visible areas; the phone role selector switched to Admin and displayed its fallback-approver badge.
- Opened Edit role, searched Attendance, and used Arrow Left to select View from Edit using the native radio group.
- Cancel displayed Discard / Keep editing. Keep editing preserved the draft.
- Save role required password confirmation. Confirming with the disposable test account's password produced `accounts.confirmPassword 200` and `accounts.roles.update 200`.
- The drawer closed and the refreshed role displayed Attendance: View (a narrowing of a synthetic role with no holders). No production privilege was granted.
- Changed a security-rule draft from 168 to 167 hours, switched to People and back: the draft remained 167. Navigating Home showed the unsaved-rules prompt; Keep editing retained the page. Restored 168 without saving.
- Verified the phone account menu exposes Reset password, Turn off login and Log out everywhere, with unavailable session actions disabled. Did not execute those actions.
- Captured held loading states at 1440 and 390 by delaying only the roles-list response in the temporary test preview. Compared the sidebar/selector, dark summary, real filter labels and permission-row skeletons with loaded layouts.
- New motion is bounded to role-panel/tab transitions, with reduced-motion overrides. Runtime OS reduced motion was not toggled; its source path was reviewed.

## Checks

- `npm run typecheck`: passed.
- `npm run lint -w frontend`: passed; existing `HodDialogs.tsx` Fast Refresh warning remains.
- `npm run build`: passed; existing large-chunk advisory remains.
- `npm run check:api-tracker`: passed, 250 APIs.
- `npm run check:data-access`: passed, 108 repository functions / 41 watched tables.
- `npm run test`: passed, 209 tests / 41 files, against the protected test database. Existing Node/pg deprecation warnings remain.
- `git diff --check`: passed.
- React quality review: stable role IDs, native radio grouping, labeled searches/menus, bounded role-list scrolling, cache invalidation after successful writes, cleanup for navigation listeners and reduced-motion paths reviewed.

Prisma's client was regenerated from the current repository schema after an initial check exposed stale generated types for concurrent attendance changes. No migration was applied to the app database as part of this UI work.
