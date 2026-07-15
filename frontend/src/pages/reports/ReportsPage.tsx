import { CalendarDays, Clock3, FileSpreadsheet, ScanLine, UserMinus, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, Pill } from '../../ui';

const reports = [
  {
    code: 'R1',
    title: 'Muster summary',
    body: 'Employee day glyphs, totals, managers and cost centres.',
    to: '/attendance/muster',
    icon: FileSpreadsheet,
    ready: true,
  },
  {
    code: 'R2',
    title: 'Swipe detail',
    body: 'Processed first-in, last-out, late, early and OT evidence.',
    to: '/reports/r2',
    icon: ScanLine,
    ready: true,
  },
  {
    code: 'R3',
    title: 'AR / OD register',
    body: 'Regularisation type, period, workflow and applied state.',
    to: '/reports/r3',
    icon: CalendarDays,
    ready: true,
  },
  {
    code: 'R4',
    title: 'Attendance exceptions',
    body: 'Late, early exit and unauthorised absence by month.',
    to: '/reports/r4',
    icon: Clock3,
    ready: true,
  },
  {
    code: 'R5',
    title: 'Overtime register',
    body: 'Detected, claimed, approved and decision latency.',
    to: '/reports/r5',
    icon: Clock3,
    ready: true,
  },
  {
    code: 'R6',
    title: 'Absence cases',
    body: 'Watch, show-cause and resolution stages.',
    to: '/reports/r6',
    icon: UserMinus,
    ready: true,
  },
  {
    code: 'R24',
    title: 'Boarding and exits',
    body: 'Daily joiners and exits behind the 07:00 notification.',
    to: '/reports/boarding-exit',
    icon: Users,
    ready: true,
  },
  {
    code: 'R27',
    title: 'Headcount demographics',
    body: 'Status and employment-category counts.',
    to: '/reports/r27',
    icon: Users,
    ready: true,
  },
];

export function ReportsPage() {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-ink-muted">Self-service reporting</p>
        <h1 className="mt-1 font-serif text-4xl font-light tracking-tight text-ink">
          Reports catalog
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Stage 1 attendance and workforce reports. Exact-column completion remains tracked per
          report.
        </p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reports.map(({ code, title, body, to, icon: Icon, ready }) => {
          const content = (
            <Card interactive={Boolean(to)} className="h-full">
              <div className="flex items-start justify-between gap-3">
                <div className="grid size-11 place-items-center rounded-full bg-accent-soft text-accent-ink">
                  <Icon className="size-5" />
                </div>
                <Pill accent={code === 'R1'}>{code}</Pill>
              </div>
              <h2 className="mt-6 text-lg font-semibold text-ink">{title}</h2>
              <p className="mt-1 text-sm leading-6 text-ink-muted">{body}</p>
              <p className="mt-5 text-xs font-semibold text-ink">
                {to ? 'Open report →' : ready ? 'API ready · filter UI next' : 'Planned'}
              </p>
            </Card>
          );
          return to ? (
            <Link key={code} to={to}>
              {content}
            </Link>
          ) : (
            <div key={code}>{content}</div>
          );
        })}
      </div>
    </div>
  );
}
