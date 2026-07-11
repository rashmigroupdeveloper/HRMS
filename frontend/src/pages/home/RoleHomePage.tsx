/**
 * Role-aware home stub (docs/08 §3, 05 §4.9 greeting shell).
 * Full ESS / HR Ops / Payroll dashboards land in Phase 1–2.
 */
import type { SessionUser } from '../../lib/session';
import { hasRole } from '../../lib/session';
import { todayLongIST } from '../../lib/date';
import { Card, CardHeader, Pill } from '../../ui';

interface RoleHomePageProps {
  user: SessionUser;
}

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
      body: 'BU headcount, absenteeism and plant muster export ship with Phase 1 reports.',
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

export function RoleHomePage({ user }: RoleHomePageProps) {
  const name = greetingFromEmail(user.email);
  const blurb = homeBlurb(user);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-ink-muted">{todayLongIST()}</p>
        <h1 className="mt-0.5 text-3xl font-light tracking-tight text-ink">
          Hello {name}
        </h1>
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
