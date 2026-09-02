import { ArrowRight, CalendarDays, Clock3, ScanLine, UserMinus, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, DarkCard, PageHeader } from '../../ui';

const featured = {
  code: 'R1',
  title: 'Muster summary',
  body: 'Employee day glyphs, totals, managers and cost centres. Defaults to this month; list and Excel share the same filters.',
  to: '/attendance/muster',
};

const reports = [
  {
    code: 'R2',
    title: 'Swipe detail',
    body: 'First-in, last-out, doors, late/early and raw-swipe reconciliation.',
    to: '/reports/r2-swipes',
    icon: ScanLine,
  },
  {
    code: 'R3',
    title: 'AR / OD register',
    body: 'Regularisation type, period, workflow and applied state.',
    to: '/reports/r3-regularizations',
    icon: CalendarDays,
  },
  {
    code: 'R4',
    title: 'Attendance exceptions',
    body: 'Late, early exit and unauthorised absence by month.',
    to: '/reports/r4-exceptions',
    icon: Clock3,
  },
  {
    code: 'R5',
    title: 'Overtime register',
    body: 'Detected, claimed, approved and 48-hour decision latency.',
    to: '/reports/r5-ot',
    icon: Clock3,
  },
  {
    code: 'R6',
    title: 'Absence cases',
    body: 'Watch, show-cause and resolution stages.',
    to: '/reports/r6-absence',
    icon: UserMinus,
  },
  {
    code: 'R24',
    title: 'Boarding and exits',
    body: 'Daily joiners and exits behind the 07:00 notification.',
    to: '/reports/r24-boarding',
    icon: Users,
  },
  {
    code: 'R27',
    title: 'Headcount demographics',
    body: 'Status × category × department counts.',
    to: '/reports/r27-headcount',
    icon: Users,
  },
];

export function ReportsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Self-service reporting · RPT-01"
        title="Reports catalog"
        description="Stage 1 attendance and workforce reports. Each row opens the live filter + Excel surface. Muster is this month until you change it."
      />

      <DarkCard>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-hero-muted">
          {featured.code} · daily loop
        </p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-6">
          <div>
            <h2 className="text-3xl font-light tracking-tight text-hero-ink">{featured.title}</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-hero-muted">{featured.body}</p>
          </div>
          <Link
            to={featured.to}
            className="u-press inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink"
          >
            Open this month <ArrowRight className="size-4" />
          </Link>
        </div>
      </DarkCard>

      <Card padded={false}>
        <ul>
          {reports.map(({ code, title, body, to, icon: Icon }) => (
            <li key={code} className="border-b border-dashed border-line last:border-0">
              <Link
                to={to}
                className="flex items-start gap-4 px-6 py-5 transition-colors duration-[var(--motion-micro)] ease-[var(--ease-std)] hover:bg-accent-soft"
              >
                <div className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-2 text-ink">
                  <Icon className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs tabular-nums text-ink-muted">{code}</p>
                  <h2 className="mt-0.5 text-base font-semibold text-ink">{title}</h2>
                  <p className="mt-1 text-sm leading-6 text-ink-muted">{body}</p>
                </div>
                <span className="shrink-0 pt-5 text-sm font-semibold text-ink">Open →</span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
