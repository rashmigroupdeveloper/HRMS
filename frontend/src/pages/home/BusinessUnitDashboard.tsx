/**
 * Business-Unit dashboard (docs/06 §5, RPT-04) — the plant/BU head's landing.
 *
 * §5 names the content exactly: headcount, absenteeism, OT, joiners/exits and
 * absence cases, scoped to their org unit. Scoping happens in the QUERY, not
 * here — a plant head must never receive another plant's rows in the first
 * place, so there is nothing to filter client-side.
 *
 * Absenteeism with no scheduled days shows an em dash, not 0% — a plant that
 * has not been processed yet has not achieved perfect attendance.
 */
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarClock, Timer, UserMinus, UserPlus } from 'lucide-react';
import {
  BarChart,
  Card,
  CardHeader,
  DarkCard,
  DataTable,
  EmptyState,
  KpiNumber,
  PageHeader,
  Pill,
  StatusBadge,
  TrendChart,
} from '../../ui';
import type { Column } from '../../ui';
import { todayLongIST } from '../../lib/date';
import { DashboardError, DashboardSkeleton } from './DashboardFeedback';
import { useDashboardResource } from './useDashboardResource';

interface BuDashboard {
  scopeLabel: string;
  headcount: { category: string; count: number }[];
  headcountTotal: number;
  absentToday: number;
  scheduledToday: number;
  absenteeismTodayPct: number | null;
  otHoursMtd: number;
  joinersMtd: number;
  exitsMtd: number;
  openAbsenceCases: { stage: string; count: number }[];
}

interface TrendPoint {
  label: string;
  date: string;
  value: number | null;
}

const CATEGORY_LABEL: Record<string, string> = {
  white_collar: 'White collar',
  blue_collar: 'Blue collar',
  trainee: 'Trainee',
  consultant: 'Consultant',
  contract: 'Contract',
  unspecified: 'Unspecified',
};

const STAGE_TONE: Record<string, 'warning' | 'negative' | 'neutral'> = {
  watch: 'warning',
  show_cause: 'negative',
};

function TrendTable({ points, unit }: { points: TrendPoint[]; unit: string }) {
  const columns: Column<TrendPoint>[] = [
    { key: 'm', header: 'Month', width: '110px', render: (r) => r.label },
    {
      key: 'v',
      header: `Value (${unit})`,
      width: '130px',
      numeric: true,
      render: (r) =>
        r.value === null ? (
          <span className="text-ink-faint">not measured</span>
        ) : (
          <span>{r.value.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</span>
        ),
    },
  ];
  return <DataTable rows={points} columns={columns} rowKey={(r) => r.date} maxHeight={220} />;
}

export function BusinessUnitDashboard() {
  const bu = useDashboardResource<BuDashboard>('/api/dashboards/business-unit');
  const absenteeism = useDashboardResource<TrendPoint[]>(
    '/api/reports/executive/trend?metric=absenteeism_pct&months=6',
  );
  const overtime = useDashboardResource<TrendPoint[]>(
    '/api/reports/executive/trend?metric=overtime_hours&months=6',
  );

  if (bu.loading) return <DashboardSkeleton />;
  if (bu.error !== null) return <DashboardError message={bu.error} onRetry={bu.reload} />;
  const data = bu.data;
  if (data === null) return <DashboardSkeleton />;

  const openCases = data.openAbsenceCases.reduce((sum, c) => sum + c.count, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={todayLongIST()}
        title="Business unit"
        description={`${data.scopeLabel} · every figure below is scoped to your unit (RPT-04).`}
      />

      <DarkCard className="grid gap-8 md:grid-cols-[1.3fr_1fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-hero-muted">
            Absent today
          </p>
          <h2 className="mt-4 text-5xl font-light tabular-nums">
            <KpiNumber value={data.absentToday} />
          </h2>
          <p className="mt-1 text-sm text-hero-muted">
            {data.absenteeismTodayPct === null
              ? 'of an unprocessed day — no scheduled days recorded yet'
              : `${data.absenteeismTodayPct.toFixed(1)}% of ${data.scheduledToday.toLocaleString('en-IN')} scheduled`}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/attendance/muster"
              className="u-press inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink"
            >
              Open plant muster <ArrowRight className="size-4" />
            </Link>
            <Link
              to="/attendance/absence-cases"
              className="u-press inline-flex items-center rounded-full bg-[color-mix(in_srgb,var(--surface)_12%,transparent)] px-5 py-2.5 text-sm font-semibold text-hero-ink"
            >
              Absence cases
            </Link>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-4 self-center">
          {[
            { icon: CalendarClock, label: 'Headcount', value: data.headcountTotal },
            { icon: Timer, label: 'OT hours MTD', value: Math.round(data.otHoursMtd) },
            { icon: UserPlus, label: 'Joiners MTD', value: data.joinersMtd },
            { icon: UserMinus, label: 'Exits MTD', value: data.exitsMtd },
          ].map((tile) => (
            <div key={tile.label} className="rounded-row bg-[color-mix(in_srgb,var(--surface)_10%,transparent)] p-4">
              <dt className="flex items-center gap-2 text-xs text-hero-muted">
                <tile.icon className="size-3.5" />
                {tile.label}
              </dt>
              <dd className="mt-1 text-2xl font-light tabular-nums">
                <KpiNumber value={tile.value} />
              </dd>
            </div>
          ))}
        </dl>
      </DarkCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Absenteeism trend"
            subtitle="(UAB + A) ÷ scheduled working days, by month"
          />
          <TrendChart
            points={absenteeism.data ?? []}
            seriesLabel="Absenteeism %"
            unit="%"
            precision={1}
            emptyMessage="No monthly snapshots yet — the nightly job builds these."
            tableAlternative={<TrendTable points={absenteeism.data ?? []} unit="%" />}
          />
        </Card>

        <Card>
          <CardHeader title="Overtime hours" subtitle="Σ approved OT minutes ÷ 60, by month" />
          <TrendChart
            points={overtime.data ?? []}
            seriesLabel="OT hours"
            unit=" h"
            emptyMessage="No monthly snapshots yet — the nightly job builds these."
            tableAlternative={<TrendTable points={overtime.data ?? []} unit="hours" />}
          />
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader title="Headcount by category" subtitle="Active and on-notice, in your unit" />
          <BarChart
            points={data.headcount.map((h) => ({
              label: CATEGORY_LABEL[h.category] ?? h.category,
              value: h.count,
            }))}
            seriesLabel="Employees"
            emptyMessage="No employees mapped to this unit yet."
            tableAlternative={
              <p className="mt-3 text-xs text-ink-muted">
                {data.headcountTotal.toLocaleString('en-IN')} people across{' '}
                {data.headcount.length} categories.
              </p>
            }
          />
        </Card>

        <Card>
          <CardHeader
            title="Open absence cases"
            subtitle="ATT-14 · watch and show-cause stages"
            action={openCases > 0 ? <Pill>{openCases}</Pill> : undefined}
          />
          {data.openAbsenceCases.length === 0 ? (
            <EmptyState
              title="No open cases"
              description="Nobody in your unit is currently in the absence escalation path."
            />
          ) : (
            <ul className="space-y-2">
              {data.openAbsenceCases.map((c) => (
                <li
                  key={c.stage}
                  className="flex items-center justify-between rounded-row bg-surface-2 px-4 py-3"
                >
                  <StatusBadge tone={STAGE_TONE[c.stage] ?? 'neutral'}>
                    {c.stage.replace(/_/g, ' ')}
                  </StatusBadge>
                  <span className="text-lg font-light tabular-nums text-ink">{c.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
