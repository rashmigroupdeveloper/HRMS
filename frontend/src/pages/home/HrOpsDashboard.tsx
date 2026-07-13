import { AlertTriangle, ArrowRight, CheckCircle2, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { todayLongIST } from '../../lib/date';
import { Card, CardHeader, DarkCard, EmptyState, KpiPillRow, Pill, StatusBadge } from '../../ui';
import type { HrDashboardData } from './dashboard-types';

function stageLabel(stage: string): string {
  return stage.replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());
}

export function HrOpsDashboard({ data }: { data: HrDashboardData }) {
  const headcount = data.headcountByCategory.reduce((sum, row) => sum + row.count, 0);
  const openAbsences = data.openAbsenceByStage.reduce((sum, row) => sum + row.count, 0);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-ink-muted">{todayLongIST()}</p>
        <h1 className="mt-1 font-serif text-4xl font-light tracking-tight text-ink">
          HR operations
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Company-wide workforce signals as of {data.asOf}.
        </p>
      </header>

      <KpiPillRow
        pills={[
          { label: 'Headcount', value: headcount, state: 'filled', icon: <Users /> },
          {
            label: 'Absent today',
            value: data.absentToday,
            state: 'accent',
            icon: <AlertTriangle />,
          },
          {
            label: 'Pending approvals',
            value: data.pendingApprovals,
            state: 'hatched',
            icon: <CheckCircle2 />,
          },
          { label: 'Joiners MTD', value: data.joinersMtd, state: 'outline', icon: <Users /> },
        ]}
      />

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
            {data.absentToday.toLocaleString('en-IN')}
          </h2>
          <p className="mt-1 text-sm text-hero-muted">employees marked A or UAB today</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/attendance"
              className="u-press inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink"
            >
              Open attendance ops <ArrowRight className="size-4" />
            </Link>
            <Link
              to="/approvals"
              className="u-press inline-flex items-center rounded-full bg-[color-mix(in_srgb,var(--surface)_12%,transparent)] px-5 py-2.5 text-sm font-semibold text-hero-ink"
            >
              Review approvals
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 self-end">
          <div className="rounded-tile bg-[color-mix(in_srgb,var(--surface)_9%,transparent)] p-4">
            <p className="text-xs text-hero-muted">Open absence cases</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{openAbsences}</p>
          </div>
          <div className="rounded-tile bg-[color-mix(in_srgb,var(--surface)_9%,transparent)] p-4">
            <p className="text-xs text-hero-muted">OT awaiting decision</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{data.pendingOt}</p>
          </div>
        </div>
      </DarkCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Absence cases" subtitle="Open cases by action stage" />
          {data.openAbsenceByStage.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 />}
              title="No open absence cases"
              description="There are no watch, show-cause or disciplinary cases awaiting action."
            />
          ) : (
            <div className="space-y-2">
              {data.openAbsenceByStage.map((row) => (
                <div
                  key={row.stage}
                  className="flex items-center justify-between rounded-row bg-surface-2 px-4 py-3"
                >
                  <span className="text-sm font-medium text-ink">{stageLabel(row.stage)}</span>
                  <Pill
                    accent={
                      row.count === Math.max(...data.openAbsenceByStage.map((item) => item.count))
                    }
                  >
                    {row.count.toLocaleString('en-IN')}
                  </Pill>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Workforce mix" subtitle="Active and on-notice employees" />
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
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-row bg-accent-soft p-4">
            <div>
              <p className="text-xs text-ink-muted">Policy acknowledgement</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-ink">
                {data.policyAckPercent}%
              </p>
            </div>
            <StatusBadge tone={data.policyAckPercent >= 100 ? 'positive' : 'warning'}>
              {data.policyAckPercent >= 100 ? 'Complete' : 'Follow-up required'}
            </StatusBadge>
          </div>
        </Card>
      </div>

      {data.exitsMtd > 0 && (
        <p className="text-xs text-ink-muted">
          Exits this month: {data.exitsMtd.toLocaleString('en-IN')}
        </p>
      )}
    </div>
  );
}
