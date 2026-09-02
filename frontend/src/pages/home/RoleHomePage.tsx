/** Role-resolved Stage 1 dashboard (docs/08 §3, 05 §4.1/§4.9). */
import type { SessionUser } from '../../lib/session';
import { hasPermission, hasRole } from '../../lib/session';
import { todayLongIST } from '../../lib/date';
import { Card, CardHeader, Pill, PageHeader } from '../../ui';
import { BusinessUnitDashboard } from './BusinessUnitDashboard';
import { DashboardError, DashboardSkeleton } from './DashboardFeedback';
import { DeviceHealthDashboard } from './DeviceHealthDashboard';
import { EssDashboard } from './EssDashboard';
import { HrOpsDashboard } from './HrOpsDashboard';
import { ManagerDashboard } from './ManagerDashboard';
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
      body: 'The group dashboard at /executive ships in Phase 3. Reports already export what is live today — we show nothing invented.',
    };
  }
  if (hasRole(user, 'payroll_admin')) {
    return {
      title: 'Payroll console',
      body: 'You will run payroll here. The engine is still being built in Phase 2 — this landing stays empty rather than showing figures that were never computed.',
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
      <PageHeader
        eyebrow={todayLongIST()}
        title={`Hello ${name}`}
        description={blurb.body}
      />

      <Card>
        <CardHeader title={blurb.title} subtitle="What this login can already do" />
        <div className="flex flex-wrap gap-2">
          {user.roles.map((role) => (
            <Pill key={role}>{ROLE_LABEL[role] ?? role}</Pill>
          ))}
          {user.roles.length === 0 && (
            <p className="text-sm text-ink-muted">No roles assigned yet — IT provisions access at onboarding.</p>
          )}
        </div>
      </Card>
    </div>
  );
}

function EssHome() {
  const resource = useDashboardResource<EssDashboardData>('/api/dashboards/ess');
  if (resource.loading) return <DashboardSkeleton />;
  if (resource.error) return <DashboardError message={resource.error} onRetry={resource.reload} />;
  return resource.data ? <EssDashboard data={resource.data} /> : null;
}

function HrHome() {
  const resource = useDashboardResource<HrDashboardData>('/api/dashboards/hr-ops');
  if (resource.loading) return <DashboardSkeleton />;
  if (resource.error) return <DashboardError message={resource.error} onRetry={resource.reload} />;
  return resource.data ? <HrOpsDashboard data={resource.data} /> : null;
}

function ManagerHome({ subtree }: { subtree: boolean }) {
  const month = currentMonthIST();
  const query = new URLSearchParams({ month, subtree: String(subtree) });
  const resource = useDashboardResource<TeamMemberMonth[]>(`/api/my/team/grid?${query.toString()}`);
  const today = ISO_DATE_IST.format(new Date());
  if (resource.loading) return <DashboardSkeleton />;
  if (resource.error) return <DashboardError message={resource.error} onRetry={resource.reload} />;
  return resource.data ? <ManagerDashboard data={resource.data} today={today} /> : null;
}

function DeviceHome() {
  const resource = useDashboardResource<DeviceHealth[]>('/api/attendance/devices');
  if (resource.loading) return <DashboardSkeleton />;
  if (resource.error) return <DashboardError message={resource.error} onRetry={resource.reload} />;
  return resource.data ? <DeviceHealthDashboard data={resource.data} /> : null;
}

export function RoleHomePage({ user }: RoleHomePageProps) {
  // RPT-04: plant/BU heads get their own scoped dashboard (docs/06 §5),
  // checked BEFORE the HR dashboard so a plant head never lands on a
  // company-wide operational screen.
  if (hasPermission(user, 'reports.bu') && !hasPermission(user, 'reports.hr')) {
    return <BusinessUnitDashboard />;
  }
  if (hasPermission(user, 'reports.hr')) return <HrHome />;
  if (hasPermission(user, 'attendance.team.read')) {
    return <ManagerHome subtree={hasRole(user, 'senior_manager')} />;
  }
  if (hasPermission(user, 'admin.devices')) return <DeviceHome />;
  if (hasPermission(user, 'attendance.own')) return <EssHome />;
  return <DeferredDashboard user={user} />;
}
