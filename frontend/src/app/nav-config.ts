/**
 * Per-role navigation (docs/08 §3) — items appear only when the user holds the
 * required permission(s). Never hardcode role checks in page handlers; nav is
 * the permission-driven shell.
 *
 * Each item carries a Lucide icon (docs/05 §7b — Lucide only) for the More
 * menu and the mobile bar. `section`: `secondary` items (Settings, Gallery)
 * sit in More, never in the center pill strip (docs/05 §3 masthead).
 *
 * Same words everywhere: ESS raises *requests* (My Leave already lists them);
 * managers clear an *Approvals* inbox. Those are different jobs — never send
 * an employee to `/approvals`.
 */
import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Banknote,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CheckCheck,
  Coins,
  Contact,
  FileClock,
  GitBranch,
  Home,
  Laptop,
  LayoutDashboard,
  LifeBuoy,
  Mail,
  Megaphone,
  Palette,
  Palmtree,
  Plane,
  ReceiptText,
  Route,
  ScrollText,
  Settings,
  SlidersHorizontal,
  ShieldCheck,
  Timer,
  Users,
  UserSearch,
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
  /** Pills vs More menu (docs/05 §3 masthead). Unused on the item itself. */
  section?: 'primary' | 'secondary';
  /** Ops-only grouping inside the More menu. ESS items stay ungrouped. */
  group?: string;
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
  const grouped = (group: string, item: NavItem): NavItem =>
    isOps ? { ...item, group } : item;

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

  // ESS self-service — ungrouped. My Leave is the request list (JTBD ≠ Approvals).
  if (hasPermission(user, 'attendance.own') && !isOps && !isCeo) {
    push({ label: 'My Attendance', to: '/my/attendance', icon: CalendarCheck });
    push({ label: 'My Leave', to: '/my/leave', icon: Palmtree });
  }
  if (hasPermission(user, 'employee.compensation.read') && !isOps) {
    push({ label: 'My Pay', to: '/my/pay', icon: Wallet });
  }
  if (!isOps && !isCeo && !isIt) {
    push({ label: 'My Claims', to: '/my/claims', icon: ReceiptText });
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

  // People
  if (hasPermission(user, 'employee.read')) {
    push(
      grouped('People', {
        label: isOps || isIt ? 'People' : 'Directory',
        to: '/people',
        match: '/people',
        icon: isOps || isIt ? Users : Contact,
      }),
    );
  }
  if (hasPermission(user, 'letters.issue')) {
    push(grouped('People', { label: 'Letters', to: '/letters', icon: Mail }));
  } else if (!isCeo) {
    push(grouped('People', { label: 'My Letters', to: '/my/letters', icon: Mail }));
  }
  if (
    hasPermission(user, 'lifecycle.onboard.convert') ||
    hasPermission(user, 'lifecycle.separation.approve')
  ) {
    push(
      grouped('People', {
        label: 'Lifecycle',
        to: '/lifecycle',
        match: '/lifecycle',
        icon: Route,
      }),
    );
  }
  if (hasPermission(user, 'employee.write') || isOps) {
    push(
      grouped('People', {
        label: 'Recruitment',
        to: '/recruitment',
        match: '/recruitment',
        icon: UserSearch,
      }),
    );
  }

  // Attendance
  if (
    hasPermission(user, 'attendance.muster.export') ||
    hasPermission(user, 'attendance.month_lock') ||
    hasPermission(user, 'admin.devices')
  ) {
    if (isOps || hasRole(user, 'plant_head') || isIt) {
      push(
        grouped('Attendance', {
          label: 'Attendance',
          to: '/attendance',
          match: '/attendance',
          icon: CalendarClock,
        }),
      );
    }
  }
  if (hasPermission(user, 'leave.admin')) {
    push(grouped('Attendance', { label: 'Leave', to: '/leave', icon: CalendarDays }));
  }

  // Payroll
  if (hasPermission(user, 'payroll.run.view') || hasPermission(user, 'payroll.run.manage')) {
    push({ label: 'Payroll', to: '/payroll', match: '/payroll', icon: Banknote });
  }
  if (
    hasPermission(user, 'payroll.run.manage') || hasPermission(user, 'payroll.reports')
  ) {
    push({ label: 'Loans', to: '/loans', icon: Coins });
    push({ label: 'Claims', to: '/claims', icon: ReceiptText });
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

  // Workplace
  push(grouped('Workplace', { label: 'Policies', to: '/policies', icon: ScrollText }));
  if (hasPermission(user, 'assets.manage')) {
    push(grouped('Workplace', { label: 'Assets', to: '/assets', icon: Laptop }));
  }
  if (hasPermission(user, 'helpdesk.agent') || (!isOps && !isCeo)) {
    push(grouped('Workplace', { label: 'Helpdesk', to: '/helpdesk', icon: LifeBuoy }));
  }
  if (hasPermission(user, 'engagement.publish')) {
    push(grouped('Workplace', { label: 'Engagement', to: '/engagement', icon: Megaphone }));
  }
  if (!isCeo) {
    push(
      grouped('Workplace', {
        label: 'Travel',
        to: '/travel',
        match: '/travel',
        icon: Plane,
      }),
    );
  }

  // Admin
  if (hasPermission(user, 'admin.users') || hasPermission(user, 'admin.roles')) {
    push(grouped('Admin', { label: 'Users & Roles', to: '/admin/users', icon: ShieldCheck }));
  }
  if (hasPermission(user, 'admin.settings')) {
    push(
      grouped('Admin', { label: 'Approval chains', to: '/admin/workflows', icon: GitBranch }),
    );
    push(
      grouped('Admin', {
        label: 'Attendance masters',
        to: '/admin/masters',
        icon: SlidersHorizontal,
      }),
    );
  }
  if (hasPermission(user, 'audit.read')) {
    push(grouped('Admin', { label: 'Audit log', to: '/admin/audit', icon: FileClock }));
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

/** Cap the Crextio center cluster (docs/12 §7). The rest lives under More. */
const MAX_PILLS = 8;

const PILL_ORDER = {
  ceo: ['/executive', '/reports'],
  ops: [
    '/',
    '/people',
    '/attendance',
    '/leave',
    '/payroll',
    '/lifecycle',
    '/assets',
    '/helpdesk',
    '/reports',
  ],
  manager: [
    '/',
    '/my/attendance',
    '/my/leave',
    '/my/pay',
    '/my/claims',
    '/my/team',
    '/helpdesk',
    '/people',
  ],
  ess: ['/', '/my/attendance', '/my/leave', '/my/pay', '/my/claims', '/helpdesk', '/people'],
} as const;

function pillOrder(items: NavItem[]): readonly string[] {
  if (items[0]?.to === '/executive') return PILL_ORDER.ceo;
  if (items.some((item) => item.group !== undefined)) return PILL_ORDER.ops;
  if (items.some((item) => item.to === '/my/team')) return PILL_ORDER.manager;
  return PILL_ORDER.ess;
}

/**
 * Split the permission-built catalog into the center pill strip and the More
 * menu. Approvals stays in `more` because the masthead badge is the one-click
 * inbox (docs/05 §3). Settings/Gallery are already `secondary`.
 */
export function splitNav(items: NavItem[]): { pills: NavItem[]; more: NavItem[] } {
  const order = pillOrder(items);
  const byTo = new Map(items.map((item) => [item.to, item]));
  const pills: NavItem[] = [];
  const taken = new Set<string>();
  for (const to of order) {
    if (pills.length >= MAX_PILLS) break;
    const item = byTo.get(to);
    if (item === undefined || item.section === 'secondary') continue;
    pills.push(item);
    taken.add(to);
  }
  return { pills, more: items.filter((item) => !taken.has(item.to)) };
}

const TAB_ORDER = [
  '/',
  '/executive',
  '/my/attendance',
  '/my/leave',
  '/my/pay',
  '/people',
  '/attendance',
] as const;

/** Four thumb-zone actions for the ESS/mobile bar (docs/05 §7). */
export function mobileTabs(pills: NavItem[]): NavItem[] {
  const tabs: NavItem[] = [];
  const take = (item: NavItem): void => {
    if (tabs.length >= 4) return;
    if (tabs.some((row) => row.to === item.to)) return;
    tabs.push(item);
  };
  for (const to of TAB_ORDER) {
    const item = pills.find((pill) => pill.to === to);
    if (item) take(item);
  }
  for (const item of pills) take(item);
  return tabs;
}
