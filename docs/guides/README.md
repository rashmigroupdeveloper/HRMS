# Rashmi HRMS user guides

One guide per role. Each guide lists **daily**, **monthly** and **occasional** tasks as numbered steps, using the real menu names and screen labels in the app today, plus a phone section and an FAQ.

> **Status:** Checked against `main` @ `ee78307` on Mon 19 Oct 2026, 02:00 IST. The look of the app is still being polished, so colours and layout may change, but menu names and routes are stable. Anything marked **(coming)** isn't built in the app yet. Don't look for it.

| Role | Who this is | Guide |
|---|---|---|
| Employee | Every staff member (self-service) | [employee.md](employee.md) |
| Manager | Anyone with direct reports (senior managers too) | [manager.md](manager.md) |
| Head of department (HOD) | Designated head of a department | [hod.md](hod.md) |
| HR operations | Entity or plant HR team | [hr_ops.md](hr_ops.md) |
| HR head | Group HR head | [hr_head.md](hr_head.md) |
| Payroll admin | Payroll team | [payroll_admin.md](payroll_admin.md) |
| Plant head | Plant or business head | [plant_head.md](plant_head.md) |
| CEO cell | CEO office (read-only group view) | [ceo_cell.md](ceo_cell.md) |
| IT admin | IT team (users, devices, settings) | [it_admin.md](it_admin.md) |
| Super admin | Break-glass system administrator | [super_admin.md](super_admin.md) |

Most people hold more than one role. A manager is also an employee, and HR staff are employees too, so read your main guide plus [employee.md](employee.md).

## Getting around (all roles)

- **Sign in:**
  1. Open the HRMS address in Chrome or Edge.
  2. Enter your **Employee ID or email** and **Password**.
  3. Click **Sign in**. Tick **Remember my employee ID** on your own device only.
  4. If you've forgotten your password, use **Forgot password? Email HR Ops** on the sign-in page.
- **Top menu (desktop):** the pill bar in the middle shows your most-used pages. Everything else is under **More**. What you see depends on your role and permissions.
- **Search (magnifier icon, or Ctrl+K):** jump to any page or person.
- **Approvals icon (✓✓ with a badge):** opens your approvals inbox. It only appears if you approve anything.
- **Moon icon:** switches between light and dark theme.
- **Your initials (top right):** **View my info** opens your own profile (`/me`), and **My documents** opens your letters. Sign out is here too.
- **Phones:** a bottom bar shows four or five tabs for your role, plus a yellow **+** button with quick actions (apply leave, regularise a day, raise a claim, approve). See each guide's phone section.

## Installing on a phone (all roles)
- **Android (Chrome):** open the HRMS address, then tap **⋮ → Add to Home screen / Install app**. It opens full screen like an app. Long-press the icon for shortcuts: Attendance, Apply leave, Approvals, Payslip.
- **iPhone (Safari):** tap **Share → Add to Home Screen**.
- A dedicated Play Store / App Store app is planned (coming). See `/workspace/STATE/MOBILE_RECOMMENDATION.md` (programme notes).

## Keeping these guides fresh
- Screenshots are in `img/` and are listed in `images.txt` (destination name, role, viewport, shot).
- After a new screenshot crawl, run `docs/guides/refresh-images.sh`. It copies from `screens/after/…` and falls back to `screens/before/…`, then writes `img/SOURCES.txt` showing where each picture came from.
- Menu labels come from `frontend/src/app/nav-config.ts`, and phone tabs from `bottom-tabs.ts` and `quick-actions.ts`. If those change, update the "Where to find it" lines in each guide.
- When a **(coming)** item ships, replace the tag with numbered steps.
