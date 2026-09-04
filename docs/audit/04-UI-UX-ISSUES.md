# 04 — Frontend, UX & Accessibility Issues

## Scope of what was actually verified

**Verified statically and by build:** the design firewall (colour tokens, component-library ban), the
component inventory, route/nav wiring, responsive class usage, ARIA attribute usage, the test and axe
harness, bundle output, and the API-client error paths. Frontend `npm run verify` was executed and is
**fully green** (typecheck · lint · knip · 290 tests · build).

**NOT verified — stated plainly rather than guessed:** I did **not** walk all 44 routes for all 12 roles
in a browser, and I did **not** capture screenshots or measure per-page contrast ratios. Doing so requires
either a real browser session per role or the page-level test harness that finding [F1] says is missing.
Any claim in this file about a specific page's rendered appearance would be fabricated, so there are none.
The remediation plan makes building that harness a Wave 1 task, and re-running this dimension against it
a Wave 2 task.

---

## 1. The design firewall — fully compliant

This is the strictest rule in docs/05 (§0.1) and it holds without exception.

| Check | Result |
|---|---|
| Hardcoded hex outside `src/tokens/tokens.css` | `grep -rnoE "#[0-9a-fA-F]{3,8}\b"` → **0** |
| `rgb()`/`rgba()`/`hsl()`/`oklch()` literals outside tokens | **0** |
| MUI / Ant / Chakra / Bootstrap / Mantine / Radix / Headless UI | **none** in `package.json` |
| UI dependencies | `lucide-react` (icons — docs/05 §7b) and `sonner` (toasts) only |
| `color-mix` usage | 11 occurrences in `src/index.css` |
| Invented primitives outside `src/ui` | **none found** — pages compose from the 30-component kit |
| Charts | token-driven SVG in `src/ui/Chart.tsx`, no charting library, deliberately no colour prop and no third series |

`src/ui` contains 30 primitives (Button, Card, DarkCard, DataTable, DatePicker, Drawer, EmptyState,
FilterPanel, IconButton, KpiNumber, KpiPillRow, MetricMark, MonthCalendar, PageHeader, SegmentedProgress,
Select, Skeleton, StatusBadge, Switch, TextField, Textarea, ThemeToggle, Timeline, Toast, Tooltip,
Checkbox, Chart, ConfirmModal, DotMatrix, HatchFill) with a shared `theme.ts` and `cn.ts`.

**Nothing in this section should be touched during remediation.**

---

## 2. Accessibility

### 2.1 [F1] [P1] axe runs on primitives only — no page has an accessibility test

`axe-core` is a devDependency and `src/test/axe.ts` exposes `runAxe`. It is used in exactly **three**
files — `ui/Button.test.tsx`, `ui/forms.test.tsx`, `ui/surfaces.test.tsx` — and correctly runs
`it.each(THEMES)` so both light and dark are covered.

For **primitives in isolation**. Not one real screen is tested: not `MusterPage`, not `ApprovalsPage`
(the ≤2-click approval inbox), not `ProfilePage`, not `DirectoryPage`, not `MonthLockPage`,
not `ExecutivePage`, not `AccessControlPage`.

CLAUDE.md rule 10 requires contrast ≥ 4.5:1 **in both themes**, colour never the only signal,
keyboard-completeness with visible focus, and reduced-motion respect. Those properties are compositional —
a Button that passes alone can fail inside a table row on a `--surface-2` card. Today that is unmeasured.

**Fix:** an axe smoke test per route, rendered in both themes, plus interaction tests on the daily
actions. This is the single highest-value frontend task, because it also unblocks re-grading this
dimension honestly.

### 2.2 What the a11y foundations do get right

- **ARIA is used substantively, not decoratively:** 73 `aria-hidden` (icons correctly hidden from
  screen readers), 50 `aria-label`, 12 `aria-describedby` (error association on form fields), 12
  `aria-busy` (loading state announced), 10 `aria-live` (async result announcements), 10 `aria-selected`,
  7 `aria-expanded`, 6 `aria-modal`, 5 `aria-invalid`, 5 `aria-haspopup`.
- **`focus-visible` styling** is present in `src/index.css` and on six interactive primitives
  (Checkbox, DatePicker, Select, Switch, KpiPillRow, Chart).
- **Reduced motion is honoured** — `@media (prefers-reduced-motion: reduce)` at `src/index.css:242`.
- `ui/Chart.tsx:151` carries a comment about an axe rule (*"image may not contain interactive
  descendants"*), i.e. axe findings have actually been acted on.

---

## 3. The docs/05 §6 micro-frustration kill-list

The kill-list is quoted by rule number throughout the code, which shows it was read rather than skimmed.

| Kill-list item | State | Evidence |
|---|---|---|
| #2 filters persist per user | **partial** — `ui/FilterPanel.tsx:22` explicitly delegates persistence to *"the SCREEN's job"*, and only 6 pages implement any storage | `grep localStorage\|draft src/pages` → 6 files |
| #3 never a blank table | **done** — `EmptyState` is enforced by a test: *"shows the empty state instead of a blank table (§6 kill-list #3)"* | `ui/data-display.test.tsx:68` |
| #7 virtualise long lists | **done** — `DataTable` uses `@tanstack/react-virtual` above a threshold, plain flow below | `ui/DataTable.tsx:3,58` |
| #9 right widget for dates | **done** — a single `DatePicker` primitive, referenced to the rule | `ui/DatePicker.tsx:16` |
| state preservation on step-up | **done and thoughtful** — `StepUpRequiredError` is a distinct error class the caller catches to reopen the dialog and retry the exact action, so the user never loses their work | `lib/api.ts:25-30`, `app/StepUpDialog.tsx:4` |
| **form autosave** | **[P2] not implemented** — no autosave anywhere; only 6 pages persist any draft state. A long claim or leave form lost to a session expiry is unrecoverable | — |
| **≤2-click daily actions** | **UNVERIFIED** — punch, apply leave and approve each *appear* to be 1–2 interactions from their entry point by reading the components, but I did not measure this in a browser | — |
| **pagination on large lists** | **[P2] thin** — only 2 pages implement pagination controls, while `GET /employees` supports `page`/`pageSize` up to 200. A 1,066-row directory relies entirely on virtualisation | `grep setPage\|pageSize src/pages` → 2 files |

---

## 4. Localisation and formatting

**Compliant with NFR-09 / docs/05 §10:**
- **INR lakh/crore grouping** is the *default*, not an option: `KpiNumber.tsx:49` and
  `SegmentedProgress.tsx:31` default `locale = 'en-IN'`, and `Chart.tsx:49` pins
  `CHART_LOCALE = 'en-IN'` for every axis and label. Tested in two places, with the reasoning written
  into the test file: *"because a payroll system that groups in thousands is wrong."*
- **`DD MMM YYYY` dates** via `src/lib/date.ts`, documented against docs/05 §10.
- Backend `formatINR` uses the same `en-IN` currency formatter.

**Out of scope by decision:** multi-language UI is an explicit non-goal (docs/01 §11).

---

## 5. Responsive behaviour

Tailwind breakpoint usage across `src/**/*.tsx`: `sm:` 53 · `md:` 27 · `lg:` 63 · `xl:` 11 · **`2xl:` 0**.

- **360 px / 768 px / 1280 px** are all addressed by the `sm`/`md`/`lg` distribution.
- **[P3] 1920 px is not.** There is no `2xl:` rule anywhere, so above 1280 px the layout simply keeps its
  `lg` arrangement. docs/01 NFR-07 warns specifically about large monitors — *"managers use large
  monitors — don't repeat Workday's scaling failure"* — and docs/08 §3 promises ceo_cell a
  *"large-monitor layout"*. Worth a deliberate check on the executive and muster screens.
- **[P2] Only 8 `overflow-x` containers** exist across the app. CLAUDE.md requires wide content to scroll
  inside its own container so the page body never scrolls horizontally; with 47 pages containing muster
  grids, registers and month tables, 8 is likely under-covered. **UNVERIFIED** without a browser pass.

---

## 6. Performance

### 6.1 [F2] [P2] No code splitting — one 790 kB chunk

```
dist/index.html                   1.25 kB │ gzip:   0.68 kB
dist/assets/index-B8wHUJhM.css   62.38 kB │ gzip:  11.41 kB
dist/assets/index-C4eNKQ_B.js   790.55 kB │ gzip: 221.41 kB
(!) Some chunks are larger than 500 kB after minification.
```

`src/app/router.tsx` statically imports all 44 page components; `grep "React.lazy|Suspense"` finds none.
An ESS user on a plant-floor tablet downloads the payroll console, the executive dashboard, privacy-ops
and compliance code in order to punch in. NFR-01 requires dashboard first paint < 2 s.

**Fix:** `React.lazy` per route with a `Suspense` skeleton (the `Skeleton` primitive already exists), plus
a `manualChunks` split for the chart primitives.

### 6.2 [F5] [P2] `apiFetch` has no timeout, no abort, no in-flight dedup

`frontend/src/lib/api.ts:47-88` — no `AbortController`, no timeout, no cancellation on unmount, no
request coalescing. A stalled request leaves a page in `aria-busy` forever; navigating away resolves a
promise into an unmounted tree. The 401→refresh→retry path is correct and bounded to one retry.

### 6.3 Not assessed
Re-render hot spots, memo misuse and request waterfalls need a profiler session against real data volumes.
**UNVERIFIED.** The muster performance test on the backend side does exist
(`tests/stage17-muster-performance.integration.test.ts`), which covers the NFR-01 10-second export target
server-side but says nothing about client render cost.

---

## 7. Error, empty and loading states

**Genuinely good:** `src/pages/_shared/{ModuleState.tsx,useModuleResource.ts}` distinguishes
*"this backend arrives in Phase N"* (a calm panel naming the phase, task and endpoint) from a real failure
(a loud error), and **never renders invented data**. This is docs/05 §4.8 implemented rather than quoted,
and for a payroll system it is the right instinct — a fabricated net-pay figure on screen is
indistinguishable from a real one.

**Gaps:**

| # | Issue | Severity |
|---|---|---|
| 7.1 | Only **11 of 47** pages use the shared `ModuleState`/`useModuleResource` pattern; the rest hand-roll their states, so consistency is unenforced | P2 |
| 7.2 | `src/pages/reports/ReportsPage.tsx` has **no** loading/empty/error primitive at all — the only page with none | P2 |
| 7.3 | **Server errors arrive as HTML, not JSON.** With no backend error middleware ([D8]), a 413 or an unhandled throw returns an Express HTML page; `lib/api.ts:74-79` cannot parse it and falls through to *"Request failed (413)"*. The user is told nothing actionable — and 413 is what every real document upload returns today ([D10]) | P1 |
| 7.4 | **Session-expiry handling is silent.** When `tryRefresh()` fails, `clearAccessToken()` is called and the original `ApiError(401)` is thrown to the calling page. There is no global listener that routes to `/login` with a "your session ended" message, so each page shows its own generic error | P2 |
| 7.5 | **No double-submit protection** is visible in the shared layer. Individual forms may disable their buttons; there is no `apiFetch`-level guard, and no idempotency key on mutating requests | P2 |
| 7.6 | **No offline handling** — no service worker, no `navigator.onLine` awareness. docs/01 NFR-07 asks for a PWA for geo check-in (ATT-14), which is Phase 8 | P3 |

---

## 8. Nav, routing and role fidelity

### 8.1 [F4] [P2] `nav-config.ts` contradicts its own rule

The file's docblock states *"Never hardcode role checks in page handlers; nav is the permission-driven
shell."* It then calls `hasRole()` **14 times** (lines 87-94, 101, 192, 315). `RoleHomePage.tsx` adds five
more (52, 58, 64, 70, 163) and `router.tsx:143` gates `/dev/gallery` on `hasRole(user,'super_admin')`.

Frontend-only, so not a security hole — the backend must enforce regardless. But it defeats CORE-10's
promise that a runtime permission change takes effect on the next request: re-granting a permission in the
RBAC console will not change what the user sees in the nav until their *role* changes.

**Fix:** derive every nav decision from permissions. `hasPermission` and `hasAnyPermission` already exist
and are already used alongside the role checks.

### 8.2 [F3] [P2] The Compensation tab appears on colleagues' profiles

`GET /api/employees/{ecode}` returns `canViewCompensation: true` for a plain ESS user viewing **another**
employee (verified live — see [`05-SECURITY-REVIEW.md`](05-SECURITY-REVIEW.md) §1). The flag is
`permissions.has('employee.compensation.read')` with no subject or scope check, and the `employee` role
holds that permission at scope `own`. `ProfilePage` gates the Compensation tab on this flag.

It is empty today only because `pay.*` does not exist. **The moment Phase 2 lands, it fills.** Fix the
flag before the data exists, not after.

### 8.3 Two roles have no navigation defined

`compliance_officer` and `dpo` are seeded in `backend/src/core/rbac/seed-data.ts` but appear in neither
docs/08 §1's role catalog nor §3's per-role navigation. Their users land on whatever the permission filter
happens to produce. See [I4].

### 8.4 Routing is otherwise complete and honest
44 product routes, `PlaceholderPage` deleted, every route resolving to a real designed screen with a
phase-labelled pending panel where the backend is not yet built. `nav-config.test.ts` carries 34 tests
covering the per-role shells.

---

## 9. Test coverage of the UI

290 tests across 33 files, all green — but concentrated in `src/ui` (14 files) and `src/lib`/`src/app`
(7 files). **44 of 47 pages have no test file**, including every one of the ops screens.

Pages with no test: `AttendanceOpsPage`, `AbsenceCasesPage`, `DeviceHealthPage`, `MyAttendancePage`,
`ExceptionsPage`, `MonthLockPage`, `LettersPage`, `MyLettersPage`, `PrivacyOpsPage`, `ResetPasswordPage`,
`RecruitmentPage`, `EngagementPage`, `HelpdeskPage`, `AssetsPage`, `SettingsPage`, `SecurityPage`,
`AuditLogPage`, `WorkflowsPage`, `AttendanceMastersPage`, `AccessControlPage`, `LifecyclePage`,
`CompliancePage`, `PoliciesPage`, `TeamPage`, `OtDecisionsPage`, `MyDocumentsPage`, `PrivacyPage`,
`DirectoryPage`, `ProfilePage`, `GalleryPage`, `DocumentsPage`, `PayrollPage`, `LoansPage`, `ClaimsPage`,
`MyClaimsPage`, `MyPayPage`, `ApprovalsPage`, `TravelPage`, `MyLeavePage`, `LeaveAdminPage`,
`SupportingReportPage`, `ReportsPage`, `MusterPage`, `ExecutivePage`.

There is also **no end-to-end test of any kind** ([F6]) — no Playwright, no Cypress. docs/14 §10 Tier-2
item 12 requires 10–20 smoke journeys, and plans/README calls it *"the one missing gate"*. This is why
the three authorization bypasses in the security review were invisible to a fully green test suite.

---

## 10. Oversized files

18 frontend files exceed the ~400-line guidance in CLAUDE.md §2:

| File | Lines |
|---|---:|
| `pages/privacy/PrivacyOpsPage.tsx` | 851 |
| `pages/reports/SupportingReports.tsx` | 802 |
| `pages/workplace/HelpdeskPage.tsx` | 771 |
| `pages/compliance/CompliancePage.tsx` | 758 |
| `pages/workplace/AssetsPage.tsx` | 740 |
| `pages/my/PrivacyPage.tsx` | 663 |
| `pages/team/TeamRosterEditor.tsx` | 650 |
| `pages/payroll/MyClaimsPage.tsx` | 619 |
| `pages/dev/GalleryPage.tsx` | 487 |
| `pages/executive/ExecutivePage.tsx` | 484 |
| …plus 8 more between 400 and 470 | |

Low urgency, but `SupportingReports.tsx` at 802 lines exports seven separate report pages from one file
and is the natural first split.
