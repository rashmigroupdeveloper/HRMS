/**
 * E2E-001 (RQ-RBAC-012): route-level permission guard. A route is reachable when
 *  1. an explicit rule names the permissions its APIs check (longest prefix wins), or
 *  2. otherwise the user's own nav catalog contains it (same rules that build the menu), or
 *  3. it is a self-service path every signed-in user has.
 * The server still enforces everything; this stops the UI offering forbidden screens.
 */
import { hasAnyPermission, hasRole, type SessionUser } from '../lib/session';
import { navForUser } from './nav-config';

const RULES: readonly [prefix: string, anyOf: readonly string[]][] = [
  ['/my/documents', ['doc.vault.own']],
  ['/documents', ['doc.vault.manage']],
  ['/payroll/structures', ['salary.write', 'payroll.run.view']],
  ['/admin/salary-structures', ['salary.write', 'payroll.run.view']],
  ['/payroll/revisions', ['salary.write', 'payroll.run.manage']],
  ['/payroll/parallel-run', ['payroll.run.manage', 'payroll.run.view']],
  ['/payroll/tds', ['payroll.run.view']],
  ['/payroll/settings', ['payroll.run.manage', 'payroll.run.view']],
  ['/payroll', ['payroll.run.view', 'payroll.run.manage']],
  ['/executive', ['reports.ceo']],
  ['/claims', ['claims.approve', 'payroll.run.manage', 'payroll.reports']],
  ['/attendance/month-lock', ['attendance.month_lock']],
  ['/attendance/devices', ['admin.devices']],
  ['/attendance/muster', ['attendance.muster.export', 'attendance.team.read']],
  ['/admin/workflows', ['admin.settings', 'workflow.routing_holds']],
  ['/admin/settings', ['admin.settings']],
  ['/admin/users', ['admin.users', 'admin.roles', 'admin.rbac.read']],
  ['/admin/org-masters', ['org.masters.manage']],
  ['/admin/audit', ['audit.read']],
  ['/my/team/overtime', ['ot.approve']],
  ['/lifecycle/probation', ['lifecycle.probation.view']],
];

const SELF_SERVICE = ['/', '/me', '/approvals', '/policies', '/compliance', '/my/attendance', '/my/leave', '/my/pay', '/my/tax', '/my/claims', '/my/loans', '/my/letters', '/my/resignation', '/helpdesk', '/travel', '/onboard/prejoin', '/alumni', '/people', '/lifecycle/separation'];

const under = (path: string, prefix: string) => (prefix === '/' ? path === '/' : path === prefix || path.startsWith(`${prefix}/`));

export function canAccessRoute(user: SessionUser, pathname: string): boolean {
  if (hasRole(user, 'super_admin')) return true;
  const path = pathname.replace(/\/+$/, '') || '/';
  const rule = RULES.filter(([prefix]) => under(path, prefix)).sort((a, b) => b[0].length - a[0].length)[0];
  if (rule) return hasAnyPermission(user, rule[1]);
  if (navForUser(user).some((item) => under(path, item.match ?? item.to))) return true;
  return SELF_SERVICE.some((p) => under(path, p));
}
