/**
 * Per-role navigation (docs/08 §3) — items appear only when the user holds the
 * required permission(s). Never hardcode role checks in page handlers; nav is
 * the permission-driven shell.
 *
 * Each item carries a Lucide icon (docs/05 §7b — Lucide only) for the sidebar
 * rail, and a `section`: primary items fill the rail; `secondary` items
 * (Settings, Gallery) pin to the rail footer (docs/05 §3 shell + §7 sidebar).
 */
import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Banknote,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CheckCheck,
  Contact,
  Home,
  Inbox,
  Laptop,
  LayoutDashboard,
  LifeBuoy,
  Mail,
  Palette,
  Palmtree,
  ReceiptText,
  Route,
  ScrollText,
  Settings,
  ShieldCheck,
  Timer,
  Users,
  UsersRound,
  Wallet,
} from 'lucide-react';
import type { SessionUser } from '../lib/session';
import { hasAnyPermission, hasPermission, hasRole } from '../lib/session';

export interface NavItem {
  label: string;
  to: string;
  /** Match this path prefix for active state (defaults to `to`). */
  match?: string;
  /** Rail icon (docs/05 §7b — Lucide only). */
  icon?: LucideIcon;
  /** `secondary` pins to the rail footer (Settings, Gallery); default primary. */
  section?: 'primary' | 'secondary';
}

const APPROVAL_PERMS = [
  'leave.approve',
  'ar.approve',
  'od.approve',
  'ot.approve',
  'claims.approve',
] as const;

/**
 * Build the role-filtered navigation for the signed-in user.
 * ESS uses "My X" labels; ops roles see module nouns (docs/05 §3 + 08 §3).
 */
export function navForUser(user: SessionUser): NavItem[] {
  const items: NavItem[] = [];
  const push = (item: NavItem): void => {
    if (!items.some((x) => x.to === item.to)) items.push(item);
  };

  const isOps =
    hasRole(user, 'hr_ops') ||
    hasRole(user, 'hr_head') ||
    hasRole(user, 'payroll_admin') ||
    hasRole(user, 'plant_head') ||
    hasRole(user, 'super_admin');
  const isCeo = hasRole(user, 'ceo_cell') && !isOps;
  const isIt = hasRole(user, 'it_admin') || hasRole(user, 'super_admin');
  const isManager = hasRole(user, 'manager') || hasRole(user, 'senior_manager');

  // Home / dashboard
  if (isCeo) {
    push({ label: 'Executive', to: '/executive', icon: LayoutDashboard });
  } else if (hasPermission(user, 'payroll.run.view') && hasRole(user, 'payroll_admin')) {
    push({ label: 'Dashboard', to: '/', icon: LayoutDashboard });
  } else if (isOps) {
    push({ label: 'Dashboard', to: '/', icon: LayoutDashboard });
  } else {
    push({ label: 'Home', to: '/', icon: Home });
  }

  // ESS self-service
  if (hasPermission(user, 'attendance.own') && !isOps && !isCeo) {
    push({ label: 'My Attendance', to: '/my/attendance', icon: CalendarCheck });
    push({ label: 'My Leave', to: '/my/leave', icon: Palmtree });
  }
  if (hasPermission(user, 'employee.compensation.read') && !isOps) {
    push({ label: 'My Pay', to: '/my/pay', icon: Wallet });
  }
  if (!isOps && !isCeo && !isIt) {
    push({ label: 'My Claims', to: '/my/claims', icon: ReceiptText });
    push({ label: 'Requests', to: '/approvals', icon: Inbox });
  }

  // Manager
  if (isManager || hasPermission(user, 'attendance.team.read')) {
    if (!isOps) {
      push({ label: 'My Team', to: '/my/team', match: '/my/team', icon: UsersRound });
    }
  }
  if (hasAnyPermission(user, APPROVAL_PERMS)) {
    push({ label: 'Approvals', to: '/approvals', icon: CheckCheck });
  }
  if (hasPermission(user, 'ot.approve') && !isOps) {
    push({ label: 'OT Decisions', to: '/my/team/overtime', icon: Timer });
  }

  // Policies — everyone reads + acknowledges (CORE-13); HR publishes from the same page.
  push({ label: 'Policies', to: '/policies', icon: ScrollText });

  // Letters console (CORE-09) — template + issuance holders.
  if (hasPermission(user, 'letters.issue')) {
    push({ label: 'Letters', to: '/letters', icon: Mail });
  } else if (!isCeo) {
    push({ label: 'My Letters', to: '/my/letters', icon: Mail });
  }

  // People / directory
  if (hasPermission(user, 'employee.read')) {
    push({
      label: isOps || isIt ? 'People' : 'Directory',
      to: '/people',
      match: '/people',
      icon: isOps || isIt ? Users : Contact,
    });
  }

  // Attendance ops
  if (
    hasPermission(user, 'attendance.muster.export') ||
    hasPermission(user, 'attendance.month_lock') ||
    hasPermission(user, 'admin.devices')
  ) {
    if (isOps || hasRole(user, 'plant_head') || isIt) {
      push({ label: 'Attendance', to: '/attendance', match: '/attendance', icon: CalendarClock });
    }
  }

  // Leave admin
  if (hasPermission(user, 'leave.admin')) {
    push({ label: 'Leave', to: '/leave', icon: CalendarDays });
  }

  // Payroll
  if (hasPermission(user, 'payroll.run.view') || hasPermission(user, 'payroll.run.manage')) {
    push({ label: 'Payroll', to: '/payroll', match: '/payroll', icon: Banknote });
  }

  // Lifecycle
  if (
    hasPermission(user, 'lifecycle.onboard.convert') ||
    hasPermission(user, 'lifecycle.separation.approve')
  ) {
    push({ label: 'Lifecycle', to: '/lifecycle', match: '/lifecycle', icon: Route });
  }

  // Assets
  if (hasPermission(user, 'assets.manage')) {
    push({ label: 'Assets', to: '/assets', icon: Laptop });
  }

  // Helpdesk
  if (hasPermission(user, 'helpdesk.agent') || (!isOps && !isCeo)) {
    push({ label: 'Helpdesk', to: '/helpdesk', icon: LifeBuoy });
  }

  // Reports
  if (
    hasPermission(user, 'reports.hr') ||
    hasPermission(user, 'reports.bu') ||
    hasPermission(user, 'reports.ceo') ||
    hasPermission(user, 'payroll.reports')
  ) {
    push({ label: 'Reports', to: '/reports', icon: BarChart3 });
  }

  // IT admin
  if (hasPermission(user, 'admin.users') || hasPermission(user, 'admin.roles')) {
    push({ label: 'Users & Roles', to: '/admin/users', match: '/admin', icon: ShieldCheck });
  }
  if (hasPermission(user, 'admin.settings')) {
    push({ label: 'Settings', to: '/admin/settings', icon: Settings, section: 'secondary' });
  }

  // Design-system gallery (break-glass / local)
  if (hasRole(user, 'super_admin')) {
    push({ label: 'Gallery', to: '/dev/gallery', icon: Palette, section: 'secondary' });
  }

  return items;
}

export function isNavActive(pathname: string, item: NavItem): boolean {
  const match = item.match ?? item.to;
  if (match === '/') return pathname === '/';
  return pathname === match || pathname.startsWith(`${match}/`);
}
