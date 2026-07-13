/** Role-resolved Stage 1 dashboard (docs/08 §3, 05 §4.1/§4.9). */
import type { SessionUser } from '../../lib/session';
import { hasPermission, hasRole } from '../../lib/session';
import { todayLongIST } from '../../lib/date';
import { Card, CardHeader, Pill } from '../../ui';
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

function homeBlurb(user: SessionUser): { title: string; body: string } {
  if (hasRole(user, 'ceo_cell')) {
    return {
      title: 'Executive overview',
      body: 'The CEO dashboard at /executive ships in Phase 3. Use Reports for read-only exports meanwhile.',
    };
  }
  if (hasRole(user, 'payroll_admin')) {
    return {
      title: 'Payroll console',
      body: 'Run stepper, review grid and finalize ceremony arrive in Phase 2.',
    };
  }
  if (hasRole(user, 'hr_ops') || hasRole(user, 'hr_head') || hasRole(user, 'super_admin')) {
    return {
      title: 'HR operations',
      body: 'Muster, absence cases and the HR Ops KPI row land in Stage 1.7. People directory is live now.',
    };
  }
  if (hasRole(user, 'plant_head')) {
    return {
      title: 'Plant dashboard',
      body: 'Plant muster remains available through reports. The aggregated BU dashboard ships from reporting snapshots in Phase 3.',
    };
  }
  if (hasRole(user, 'it_admin')) {
    return {
      title: 'IT administration',
      body: 'Users & Roles, device health and integrations are reachable from the masthead.',
    };
  }
  return {
    title: 'Your day',
    body: 'My Attendance, My Leave and the full ESS home ship in Stage 1.7. Directory is available now.',
  };
}

function DeferredDashboard({ user }: RoleHomePageProps) {
  const name = greetingFromEmail(user.email);
  const blurb = homeBlurb(user);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-ink-muted">{todayLongIST()}</p>
        <h1 className="mt-0.5 text-3xl font-light tracking-tight text-ink">Hello {name}</h1>
        <p className="mt-1 text-sm text-ink-muted">{blurb.body}</p>
      </div>

      <Card>
        <CardHeader title={blurb.title} subtitle="Role shell" />
        <div className="flex flex-wrap gap-2">
          {user.roles.map((role) => (
            <Pill key={role} accent={role === 'super_admin'}>
              {role}
            </Pill>
          ))}
          {user.roles.length === 0 && (
            <p className="text-sm text-ink-muted">No roles assigned yet.</p>
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
  if (hasPermission(user, 'reports.hr')) return <HrHome />;
  if (hasPermission(user, 'attendance.team.read')) {
    return <ManagerHome subtree={hasRole(user, 'senior_manager')} />;
  }
  if (hasPermission(user, 'admin.devices')) return <DeviceHome />;
  if (hasPermission(user, 'attendance.own')) return <EssHome />;
  return <DeferredDashboard user={user} />;
}
