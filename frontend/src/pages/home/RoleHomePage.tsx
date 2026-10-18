/** Role-resolved Stage 1 dashboard (docs/08 §3, 05 §4.1/§4.9). */
import { Navigate } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
  CalendarCheck,
  CalendarClock,
  CheckCheck,
  FileClock,
  Fingerprint,
  GitBranch,
  LifeBuoy,
  Lock,
  Mail,
  Palmtree,
  RadioTower,
  ReceiptText,
  Route,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Timer,
  Users,
  UsersRound,
  Wallet,
} from 'lucide-react';
import type { SessionUser } from '../../lib/session';
import { hasAnyPermission, hasPermission, hasRole } from '../../lib/session';
import { navForUser } from '../../app/nav-config';
import { useCompanyScope } from '../../app/company-scope';
import { useInboxCount } from '../../app/useInboxCount';
import type { QuickLink } from '../../ui';
import { todayLongIST } from '../../lib/date';
import { Card, CardHeader, Pill, PageHeader } from '../../ui';
import { BusinessUnitDashboard } from './BusinessUnitDashboard';
import { DashboardError, DashboardSkeleton } from './DashboardFeedback';
import { DeviceHealthDashboard } from './DeviceHealthDashboard';
import { EssDashboard } from './EssDashboard';
import { HrOpsDashboard } from './HrOpsDashboard';
import { LeadershipInsights } from './LeadershipInsights';
import { ManagerDashboard } from './ManagerDashboard';
import { PayrollDashboard } from './PayrollDashboard';
import type {
  DeviceHealth,
  EssDashboardData,
  HrDashboardData,
  TeamMemberMonth,
} from './dashboard-types';
import { currentMonthIST } from './dashboard-format';
import { useDashboardResource } from './useDashboardResource';

interface RoleHomePageProps {
  user: SessionUser;
}

const ISO_DATE_IST = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function greetingFromEmail(email: string): string {
  const local = email.split('@')[0] ?? email;
  const first = local.split(/[._-]/)[0] ?? local;
  return first.charAt(0).toUpperCase() + first.slice(1);
}

const ROLE_LABEL: Record<string, string> = {
  employee: 'Employee',
  manager: 'Manager',
  senior_manager: 'Senior manager',
  hr_ops: 'HR operations',
  hr_head: 'HR head',
  payroll_admin: 'Payroll',
  plant_head: 'Plant head',
  ceo_cell: 'CEO cell',
  it_admin: 'IT admin',
  super_admin: 'Super admin',
};

function homeBlurb(user: SessionUser): { title: string; body: string } {
  if (hasRole(user, 'ceo_cell')) {
    return {
      title: 'Executive overview',
      body: 'The group dashboard is not live yet. Reports already export what is available today.',
    };
  }
  if (hasRole(user, 'payroll_admin')) {
    return {
      title: 'Payroll console',
      body: 'You will run payroll here. Until it is live this page stays empty rather than showing figures that were never computed.',
    };
  }
  if (hasRole(user, 'hr_ops') || hasRole(user, 'hr_head') || hasRole(user, 'super_admin')) {
    return {
      title: 'HR operations',
      body: 'Muster, absence cases and the people directory are live. Use the rail to open today’s queue.',
    };
  }
  if (hasRole(user, 'it_admin')) {
    return {
      title: 'IT administration',
      body: 'Users & roles, device health and integrations sit in Admin. Nothing here is a placeholder number.',
    };
  }
  return {
    title: 'Your day',
    body: 'My Attendance, My Leave and this home are live when your login has self-service access. If you are seeing this card, IT still needs to attach those permissions.',
  };
}

function DeferredDashboard({ user }: RoleHomePageProps) {
  const name = greetingFromEmail(user.email);
  const blurb = homeBlurb(user);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={todayLongIST()} title={`Hello ${name}`} description={blurb.body} />

      <Card>
        <CardHeader title={blurb.title} subtitle="What this login can already do" />
        <div className="flex flex-wrap gap-2">
          {user.roles.map((role) => (
            <Pill key={role}>{ROLE_LABEL[role] ?? role}</Pill>
          ))}
          {user.roles.length === 0 && (
            <p className="text-sm text-ink-muted">
              No roles assigned yet — IT provisions access at onboarding.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}

function EssHome({ links }: { links: QuickLink[] }) {
  const resource = useDashboardResource<EssDashboardData>('/api/dashboards/ess');
  if (resource.loading) return <DashboardSkeleton />;
  if (resource.error) return <DashboardError message={resource.error} onRetry={resource.reload} />;
  return resource.data ? <EssDashboard data={resource.data} quickLinks={links} /> : null;
}

function HrHome({ user, links, scoped }: { user: SessionUser; links: QuickLink[]; scoped: boolean }) {
  const scope = useCompanyScope();
  const companyId = scoped ? scope : null;
  const path =
    companyId === null
      ? '/api/dashboards/hr-ops'
      : `/api/dashboards/hr-ops?companyId=${String(companyId)}`;
  const resource = useDashboardResource<HrDashboardData>(path);
  const companies = useDashboardResource<{ companies: { id: number; name: string }[] }>(
    '/api/core/companies',
  );
  if (resource.loading) return <DashboardSkeleton />;
  if (resource.error) return <DashboardError message={resource.error} onRetry={resource.reload} />;
  const scopeLabel = !scoped
    ? undefined
    : companyId === null
      ? `All ${String(companies.data?.companies.length ?? '')} companies · consolidated`.replace(
          'All  ',
          'All ',
        )
      : (companies.data?.companies.find((company) => company.id === companyId)?.name ??
        'Selected company');
  return resource.data ? (
    <HrOpsDashboard
      data={resource.data}
      quickLinks={links}
      scopeLabel={scopeLabel}
      title={scoped ? (companyId === null ? 'Group people overview' : 'Company people overview') : 'HR operations'}
      insights={
        scoped ? (
          <LeadershipInsights
            user={user}
            companyId={companyId}
            title={companyId === null ? 'Across the group' : 'Across this company'}
          />
        ) : undefined
      }
    />
  ) : null;
}

function ManagerHome({ subtree, links, title }: { subtree: boolean; links: QuickLink[]; title?: string }) {
  const month = currentMonthIST();
  const query = new URLSearchParams({ month, subtree: String(subtree) });
  const resource = useDashboardResource<TeamMemberMonth[]>(`/api/my/team/grid?${query.toString()}`);
  const today = ISO_DATE_IST.format(new Date());
  if (resource.loading) return <DashboardSkeleton />;
  if (resource.error) return <DashboardError message={resource.error} onRetry={resource.reload} />;
  return resource.data ? (
    <ManagerDashboard data={resource.data} today={today} quickLinks={links} {...(title === undefined ? {} : { title })} />
  ) : null;
}

function DeviceHome({ links }: { links: QuickLink[] }) {
  const resource = useDashboardResource<DeviceHealth[]>('/api/attendance/devices');
  if (resource.loading) return <DashboardSkeleton />;
  if (resource.error) return <DashboardError message={resource.error} onRetry={resource.reload} />;
  return resource.data ? (
    <DeviceHealthDashboard data={resource.data} quickLinks={links} title="IT administration" />
  ) : null;
}

const APPROVAL_PERMS = [
  'leave.approve',
  'ar.approve',
  'od.approve',
  'ot.approve',
  'claims.approve',
] as const;

/** Quick links the user can actually open — built from the permission-driven nav. */
function useRoleLinks(
  user: SessionUser,
  inboxCount: number,
): Record<'ess' | 'manager' | 'hr' | 'it' | 'bu', QuickLink[]> {
  const catalog = navForUser(user);
  const can = (to: string): boolean =>
    catalog.some(
      (item) => item.to === to || (item.match !== undefined && to.startsWith(`${item.match}/`)),
    );
  const approvals: QuickLink | null = hasAnyPermission(user, APPROVAL_PERMS)
    ? {
        to: '/approvals',
        label: 'Approvals',
        icon: <CheckCheck />,
        count: inboxCount,
        primary: inboxCount > 0,
      }
    : null;
  const keep = (links: (QuickLink | null | false)[]): QuickLink[] =>
    links.filter(
      (link): link is QuickLink => Boolean(link) && can((link as QuickLink).to.split('?')[0] ?? ''),
    );
  const ess = keep([
    { to: '/my/attendance', label: 'Attendance', icon: <Fingerprint /> },
    { to: '/my/leave?action=apply', label: 'Apply leave', icon: <Palmtree /> },
    { to: '/my/attendance?action=request', label: 'Regularise', icon: <CalendarCheck /> },
    { to: '/my/pay', label: 'Payslip', icon: <Wallet /> },
    { to: '/my/claims?action=new', label: 'Raise claim', icon: <ReceiptText /> },
    { to: '/helpdesk', label: 'Helpdesk', icon: <LifeBuoy /> },
  ]);
  return {
    ess,
    manager: keep([
      approvals,
      { to: '/my/team', label: 'Team month grid', icon: <UsersRound /> },
      { to: '/my/team/overtime', label: 'OT decisions', icon: <Timer /> },
      { to: '/reports', label: 'Team reports', icon: <BarChart3 /> },
      { to: '/my/leave?action=apply', label: 'Apply leave', icon: <Palmtree /> },
      { to: '/my/pay', label: 'Payslip', icon: <Wallet /> },
    ]),
    hr: keep([
      approvals,
      { to: '/attendance/muster', label: 'Muster', icon: <CalendarClock /> },
      { to: '/attendance/exceptions', label: 'Exceptions', icon: <AlertTriangle /> },
      { to: '/attendance/month-lock', label: 'Month lock', icon: <Lock /> },
      { to: '/people', label: 'People', icon: <Users /> },
      { to: '/lifecycle', label: 'Lifecycle', icon: <Route /> },
      { to: '/letters', label: 'Letters', icon: <Mail /> },
      { to: '/reports', label: 'Reports', icon: <BarChart3 /> },
    ]),
    bu: keep([
      approvals,
      { to: '/attendance/muster', label: 'Plant muster', icon: <CalendarClock /> },
      { to: '/attendance/absence-cases', label: 'Absence cases', icon: <AlertTriangle /> },
      { to: '/reports', label: 'BU reports', icon: <BarChart3 /> },
      { to: '/people', label: 'People', icon: <Users /> },
    ]),
    it: keep([
      { to: '/admin/users', label: 'Users & roles', icon: <ShieldCheck /> },
      { to: '/attendance/devices', label: 'Device health', icon: <RadioTower /> },
      { to: '/admin/workflows', label: 'Approval chains', icon: <GitBranch /> },
      { to: '/admin/masters', label: 'Attendance masters', icon: <SlidersHorizontal /> },
      { to: '/admin/audit', label: 'Audit log', icon: <FileClock /> },
      { to: '/admin/settings', label: 'Settings', icon: <Settings /> },
    ]),
  };
}

/**
 * Landing per docs/08 §3 — resolved by ROLE precedence, because several roles
 * hold `reports.hr` with a narrow scope (a manager's is their subtree) and must
 * not land on the company-wide HR screen:
 *   CEO cell → executive · HR ops/head/super admin → HR dashboard (company
 *   switcher for group roles) · payroll → run console home · plant head → BU ·
 *   IT admin → device health + admin shortcuts · manager → team today ·
 *   everyone else → ESS.
 */
export function RoleHomePage({ user }: RoleHomePageProps) {
  const canApprove = hasAnyPermission(user, APPROVAL_PERMS);
  const inboxCount = useInboxCount(canApprove);
  const links = useRoleLinks(user, inboxCount);
  const isHr = hasRole(user, 'hr_ops') || hasRole(user, 'hr_head') || hasRole(user, 'super_admin');

  if (hasRole(user, 'ceo_cell') && !isHr && hasPermission(user, 'reports.ceo')) {
    return <Navigate to="/executive" replace />;
  }
  if (isHr && hasPermission(user, 'reports.hr')) {
    return (
      <HrHome user={user} links={links.hr} scoped={hasRole(user, 'hr_head') || hasRole(user, 'super_admin')} />
    );
  }
  if (hasRole(user, 'payroll_admin') && hasPermission(user, 'payroll.run.view'))
    return (
      <div className="space-y-8">
        <PayrollDashboard />
        <LeadershipInsights
          user={user}
          only={['payroll', 'desk']}
          title="Pay over the year"
          subtitle="Gross cost of computed runs and what is waiting on you."
        />
      </div>
    );
  if (hasRole(user, 'plant_head') && hasPermission(user, 'reports.bu')) {
    return (
      <div className="space-y-8">
        <BusinessUnitDashboard quickLinks={links.bu} />
        <LeadershipInsights user={user} title="Across your plant" />
      </div>
    );
  }
  if (hasPermission(user, 'admin.devices')) return <DeviceHome links={links.it} />;
  if (hasPermission(user, 'attendance.team.read')) {
    // HOD (C-02, derived role) reads the whole department subtree.
    if (hasRole(user, 'hod')) return <ManagerHome subtree links={links.manager} title="Your department today" />;
    return <ManagerHome subtree={hasRole(user, 'senior_manager')} links={links.manager} />;
  }
  if (hasPermission(user, 'attendance.own')) return <EssHome links={links.ess} />;
  return <DeferredDashboard user={user} />;
}
