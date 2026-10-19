# guides job progress
- 02:05 IST 19 Oct 2026: worktree /workspace/wt/guides (job/guides) from main ee78307. Docs only, no app code.
- Wrote /workspace/STATE/MOBILE_RECOMMENDATION.md (PWA → Capacitor 8 Android → widgets + iOS; no RN/Flutter rewrite). Includes widgets, store launch and enterprise distribution sections.
- Wrote docs/guides/: README.md (index + getting around + install + refresh notes) and one guide per role: employee, manager, hod, hr_ops, hr_head, payroll_admin, plant_head, ceo_cell, it_admin, super_admin.
- Labels and routes taken from frontend/src/app/{nav-config,bottom-tabs,quick-actions,router}.tsx and page sources at ee78307. Anything without a UI is tagged **(coming)**.
- Screenshots: 49 in docs/guides/img/, listed in docs/guides/images.txt. 41 come from screens/after; 8 from screens/before (ceo_cell, it_admin and super_admin have no after crawl yet). img/SOURCES.txt records the origin of each.

## How to refresh when the UI changes
1. After a new uiux crawl: `docs/guides/refresh-images.sh` (it prefers after/ and falls back to before/).
2. If nav labels change (nav-config.ts / bottom-tabs.ts), update the "Where to find things" and "On your phone" lines in each guide.
3. When a (coming) item ships (e.g. Kent "Sync now" button, leave cancel, ESS resign, geo check-in, delegation screen, offer/LOI chain, off-cycle payroll, manual attendance override screen, user unlock/reset, SMTP status), replace the tag with numbered steps.

## Gaps noticed while writing guides (for code-fix/uiux; not bugs filed)
- No employee-facing entry point for resignation (the Separation board "Apply for Resignation (ESS)" sits under /lifecycle, which employees can't reach).
- No UI for Kent "Sync now" (API only), manual attendance override, leave adjustment, leave cancel/encashment, approval delegation, or user unlock/reset/deactivate.
- Ops roles (hr_ops/hr_head/payroll_admin/plant_head) have no My Attendance / My Leave in the nav. They reach their own records through Profile links only.
- The CEO cell has no approvals inbox (no approval permissions), so the CEO offer/separation steps would need one.
