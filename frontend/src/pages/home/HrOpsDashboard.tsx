import { AlertTriangle, ArrowRight, CheckCircle2, UserMinus, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { todayLongIST } from '../../lib/date';
import {
  Card,
  CardHeader,
  DarkCard,
  EmptyState,
  KpiNumber,
  KpiPillRow,
  PageHeader,
  Pill,
  StatusBadge,
} from '../../ui';
import type { HrDashboardData } from './dashboard-types';

const GOLD =
  'u-press inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink';
const CREAM =
  'u-press inline-flex items-center rounded-full bg-[color-mix(in_srgb,var(--surface)_12%,transparent)] px-5 py-2.5 text-sm font-semibold text-hero-ink';

function stageLabel(stage: string): string {
  return stage.replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());
}

export function HrOpsDashboard({ data }: { data: HrDashboardData }) {
  const headcount = data.headcountByCategory.reduce((sum, row) => sum + row.count, 0);
  const openAbsences = data.openAbsenceByStage.reduce((sum, row) => sum + row.count, 0);
  const absentIsTheJob = data.absentToday > 0;
  const approvalsAreTheJob = !absentIsTheJob && data.pendingApprovals > 0;
  const goldOnCta = !absentIsTheJob && !approvalsAreTheJob;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
      <PageHeader
        eyebrow={todayLongIST()}
        title="HR operations"
        description={`Company-wide signals as of ${data.asOf}. Every tile opens the list behind the number.`}
      />

      <KpiPillRow
        pills={[
          { label: 'Headcount', value: headcount, state: 'filled', icon: <Users />, to: '/people' },
          {
            label: 'Absent today',
            value: data.absentToday,
            state: absentIsTheJob ? 'accent' : 'outline',
            icon: <AlertTriangle />,
            to: '/attendance',
          },
          {
            label: 'Pending approvals',
            value: data.pendingApprovals,
            state: approvalsAreTheJob ? 'accent' : data.pendingApprovals > 0 ? 'hatched' : 'outline',
            icon: <CheckCircle2 />,
            to: '/approvals',
          },
          {
            label: 'Exits MTD',
            value: data.exitsMtd,
            state: 'outline',
            icon: <UserMinus />,
            to: '/people',
          },
        ]}
      />
      </div>

      <DarkCard className="grid gap-8 md:grid-cols-[1.4fr_1fr]">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-hero-muted">
              Attendance today
            </p>
            <StatusBadge tone={data.silentDevices > 0 ? 'negative' : 'positive'}>
              {data.silentDevices > 0
                ? `${String(data.silentDevices)} silent devices`
                : 'All monitored devices reporting'}
            </StatusBadge>
          </div>
          <h2 className="mt-4 text-5xl font-light tabular-nums">
            <KpiNumber value={data.absentToday} />
          </h2>
          <p className="mt-1 text-sm text-hero-muted">
            marked A or UAB, against {headcount.toLocaleString('en-IN')} people on rolls — not a
            scheduled-day rate.
          </p>
          {data.silentDevices > 0 && (
            <p className="mt-3 max-w-xl text-sm leading-6 text-hero-muted">
              Month lock waits on every expected door. A silent device is a real cutoff risk, not a
              reminder.
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/attendance" className={goldOnCta ? GOLD : CREAM}>
              Open attendance ops <ArrowRight className="size-4" />
            </Link>
            <Link to="/approvals" className={CREAM}>
              Review approvals
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 self-end">
          <Link
            to="/attendance/absence-cases"
            className="rounded-tile bg-[color-mix(in_srgb,var(--surface)_9%,transparent)] p-4 u-press"
          >
            <p className="text-xs text-hero-muted">Open absence cases</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{openAbsences}</p>
          </Link>
          <Link
            to="/approvals"
            className="rounded-tile bg-[color-mix(in_srgb,var(--surface)_9%,transparent)] p-4 u-press"
          >
            <p className="text-xs text-hero-muted">OT awaiting decision</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{data.pendingOt}</p>
          </Link>
        </div>
      </DarkCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Absence cases"
            subtitle="Open cases by action stage"
            action={
              <Link to="/attendance/absence-cases" className="text-sm font-semibold text-ink hover:underline">
                Open queue
              </Link>
            }
          />
          {data.openAbsenceByStage.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 />}
              title="No open absence cases"
              description="There are no watch, show-cause or disciplinary cases awaiting action."
            />
          ) : (
            <div className="space-y-2">
              {data.openAbsenceByStage.map((row) => (
                <Link
                  key={row.stage}
                  to="/attendance/absence-cases"
                  className="flex items-center justify-between rounded-row bg-surface-2 px-4 py-3 transition-colors hover:bg-accent-soft"
                >
                  <span className="text-sm font-medium text-ink">{stageLabel(row.stage)}</span>
                  <Pill>{row.count.toLocaleString('en-IN')}</Pill>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Workforce mix"
            subtitle={`${data.joinersMtd.toLocaleString('en-IN')} joiners this month · active and on-notice`}
          />
          <div className="space-y-3">
            {data.headcountByCategory.map((row) => {
              const percent = headcount === 0 ? 0 : (row.count / headcount) * 100;
              return (
                <div key={row.category ?? 'Unclassified'}>
                  <div className="flex justify-between gap-4 text-sm">
                    <span className="font-medium text-ink">{row.category ?? 'Unclassified'}</span>
                    <span className="tabular-nums text-ink-muted">
                      {row.count.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-hero"
                      style={{ width: `${String(percent)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <Link
            to="/policies"
            className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-row bg-surface-2 p-4 transition-colors hover:bg-accent-soft"
          >
            <div>
              <p className="text-xs text-ink-muted">Policy acknowledgement</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-ink">
                {data.policyAckPercent}%
              </p>
            </div>
            <StatusBadge tone={data.policyAckPercent >= 100 ? 'positive' : 'warning'}>
              {data.policyAckPercent >= 100 ? 'Complete' : 'Follow-up required'}
            </StatusBadge>
          </Link>
        </Card>
      </div>
    </div>
  );
}
