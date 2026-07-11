/**
 * Per-role navigation (docs/08 §3) — items appear only when the user holds the
 * required permission(s). Never hardcode role checks in page handlers; nav is
 * the permission-driven shell.
 */
import type { SessionUser } from '../lib/session';
import { hasAnyPermission, hasPermission, hasRole } from '../lib/session';

interface NavItem {
  label: string;
  to: string;
  /** Match this path prefix for active state (defaults to `to`). */
  match?: string;
}

const APPROVAL_PERMS = [
  'leave.approve',
  'ar.approve',
  'od.approve',
  'ot.approve',
  'claims.approve',
] as const;

/**
 * Build the masthead pill list for the signed-in user.
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
  const isManager =
    hasRole(user, 'manager') || hasRole(user, 'senior_manager');

  // Home / dashboard
  if (isCeo) {
    push({ label: 'Executive', to: '/executive' });
  } else if (hasPermission(user, 'payroll.run.view') && hasRole(user, 'payroll_admin')) {
    push({ label: 'Dashboard', to: '/' });
  } else if (isOps) {
    push({ label: 'Dashboard', to: '/' });
  } else {
    push({ label: 'Home', to: '/' });
  }

  // ESS self-service
  if (hasPermission(user, 'attendance.own') && !isOps && !isCeo) {
    push({ label: 'My Attendance', to: '/my/attendance' });
    push({ label: 'My Leave', to: '/my/leave' });
  }
  if (hasPermission(user, 'employee.compensation.read') && !isOps) {
    push({ label: 'My Pay', to: '/my/pay' });
  }
  if (!isOps && !isCeo && !isIt) {
    push({ label: 'My Claims', to: '/my/claims' });
    push({ label: 'Requests', to: '/approvals' });
  }

  // Manager
  if (isManager || hasPermission(user, 'attendance.team.read')) {
    if (!isOps) {
      push({ label: 'My Team', to: '/my/team' });
    }
  }
  if (hasAnyPermission(user, APPROVAL_PERMS)) {
    push({ label: 'Approvals', to: '/approvals' });
  }

  // People / directory
  if (hasPermission(user, 'employee.read')) {
    push({
      label: isOps || isIt ? 'People' : 'Directory',
      to: '/people',
      match: '/people',
    });
  }

  // Attendance ops
  if (
    hasPermission(user, 'attendance.muster.export') ||
    hasPermission(user, 'attendance.month_lock') ||
    hasPermission(user, 'admin.devices')
  ) {
    if (isOps || hasRole(user, 'plant_head') || isIt) {
      push({ label: 'Attendance', to: '/attendance', match: '/attendance' });
    }
  }

  // Leave admin
  if (hasPermission(user, 'leave.admin')) {
    push({ label: 'Leave', to: '/leave' });
  }

  // Payroll
  if (hasPermission(user, 'payroll.run.view') || hasPermission(user, 'payroll.run.manage')) {
    push({ label: 'Payroll', to: '/payroll', match: '/payroll' });
  }

  // Lifecycle
  if (
    hasPermission(user, 'lifecycle.onboard.convert') ||
    hasPermission(user, 'lifecycle.separation.approve')
  ) {
    push({ label: 'Lifecycle', to: '/lifecycle', match: '/lifecycle' });
  }

  // Assets
  if (hasPermission(user, 'assets.manage')) {
    push({ label: 'Assets', to: '/assets' });
  }

  // Helpdesk
  if (hasPermission(user, 'helpdesk.agent') || (!isOps && !isCeo)) {
    push({ label: 'Helpdesk', to: '/helpdesk' });
  }

  // Reports
  if (
    hasPermission(user, 'reports.hr') ||
    hasPermission(user, 'reports.bu') ||
    hasPermission(user, 'reports.ceo') ||
    hasPermission(user, 'payroll.reports')
  ) {
    push({ label: 'Reports', to: '/reports' });
  }

  // IT admin
  if (hasPermission(user, 'admin.users') || hasPermission(user, 'admin.roles')) {
    push({ label: 'Users & Roles', to: '/admin/users', match: '/admin' });
  }

  // Design-system gallery (break-glass / local)
  if (hasRole(user, 'super_admin')) {
    push({ label: 'Gallery', to: '/dev/gallery' });
  }

  return items;
}

export function isNavActive(pathname: string, item: NavItem): boolean {
  const match = item.match ?? item.to;
  if (match === '/') return pathname === '/';
  return pathname === match || pathname.startsWith(`${match}/`);
}
