/**
 * CEO / Executive dashboard (RPT-03) — docs/05 §4.8 + docs/06 §4.
 *
 * Large-monitor first (the spec says test at 1920×1080 and 2560×1440 — the
 * Workday lesson). Three bands, in the order the CEO reads them:
 *   1. Manpower demographics — the exact pptx table: 6 metric rows × 6
 *      category columns.
 *   2. Productivity & cost — gold/charcoal two-series only (locked palette).
 *   3. Attendance & engagement — absenteeism, attrition, new-hire attrition
 *      3/6/12 mo, burnout index.
 *
 * Two rules from the spec are load-bearing and visible in this code:
 *   - The **Contract** column reads "Phase 4" until that module exists —
 *     never fake data (docs/05 §4.8, verbatim).
 *   - Burnout is labelled an **index** with its definition on the tile; it is
 *     a composite proxy, never presented as a survey result (docs/06 §4).
 *
 * Reads precomputed `reporting.kpi_daily` rows — no live aggregation on CEO
 * open (CLAUDE.md §1.9), with the snapshot timestamp shown on the page.
 */
import { useState } from 'react';
import { Activity, Gauge, RefreshCw, TrendingDown, Users, UserX } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import {
  BarChart,
  Button,
  Card,
  CardHeader,
  DarkCard,
  DataTable,
  Drawer,
  KpiNumber,
  PageHeader,
  Pill,
  StatusBadge,
  Tooltip,
  TrendChart,
  toast,
} from '../../ui';
import type { Column } from '../../ui';
import { PendingModule } from '../_shared/ModuleState';
import { useModuleResource } from '../_shared/useModuleResource';

/** Columns exactly as the pptx (docs/06 §4). */
const CATEGORIES = ['Total', 'White collar', 'Trainee', 'Blue collar', 'Contract', 'Consultants'];

/** Rows exactly as the pptx, each with the implemented formula. */
const DEMOGRAPHIC_ROWS = [
  { label: 'Manpower count', formula: 'Active employees at date, by category' },
  { label: 'Average age', formula: 'AVG(age(dob)) by category' },
  { label: 'Tenure', formula: 'AVG(age(doj)) of active, by category' },
  { label: 'Leadership %', formula: 'Active with grade.rank ≥ leadership cutoff ÷ active' },
  { label: 'Gender diversity %', formula: 'Active female employees ÷ total headcount' },
  { label: 'Contract dependency ratio', formula: 'Contract count ÷ total manpower (Phase 4)' },
  { label: 'Average CTC', formula: 'AVG(annual_ctc) by category and grade band' },
];

const PRODUCTIVITY = [
  { label: 'Labour productivity', formula: 'Output ÷ total manpower' },
  { label: 'Output per man-hour', formula: 'Output ÷ Σ worked_minutes / 60' },
  { label: 'Cost per man-hour', formula: '(Gross payroll + ER contributions) ÷ Σ worked hours' },
  { label: 'Cost per unit', formula: 'Payroll cost ÷ output units' },
  { label: 'Gross salary spend MTD', formula: 'Σ Gross earnings + employer contributions' },
  { label: 'OT spend per ton', formula: 'Overtime wages ÷ monthly steel output units' },
  { label: 'Overtime hours & cost', formula: 'Σ approved OT minutes / 60 · Σ OT payroll lines' },
];

const ENGAGEMENT = [
  { label: 'Absenteeism %', formula: '(UAB + A) days ÷ scheduled working days, monthly trend' },
  { label: 'Attrition rate', formula: 'Leavers in period ÷ average headcount, annualised' },
  { label: 'Number of leavers', formula: 'Count by month' },
  { label: 'Voluntary attrition %', formula: 'Voluntary resignations ÷ total workforce' },
  { label: 'New-hire attrition 30d', formula: '% exited within 30 days of DOJ' },
  { label: 'New-hire attrition 90d', formula: '% exited within 90 days of DOJ' },
  { label: 'New-hire attrition 180d', formula: '% exited within 180 days of DOJ' },
  { label: 'New-hire attrition 365d', formula: '% exited within 365 days of DOJ' },
];

interface KpiMetric {
  companyId: number | null;
  category: string;
  metric: string;
  value: number | null;
  unavailableReason: string | null;
}

interface ExecutiveKpis {
  snapshotDate: string;
  computedAt: string | null;
  metrics: KpiMetric[];
}

interface LeaverRow {
  separationId: number;
  employeeName: string;
  ecode: string;
  department: string | null;
  location: string | null;
  resignationDate: string;
  lwd: string | null;
  exitType: 'Voluntary' | 'Involuntary';
  reason: string | null;
}

/** docs/06 §4 metric keys → the row they belong to. */
const DEMOGRAPHIC_METRIC: Record<string, string> = {
  'Manpower count': 'manpower_count',
  'Average age': 'average_age',
  Tenure: 'tenure_years',
  'Leadership %': 'leadership_pct',
  'Gender diversity %': 'gender_diversity_ratio_pct',
  'Contract dependency ratio': 'contract_dependency_ratio',
  'Average CTC': 'average_ctc',
};

const PRODUCTIVITY_METRIC: Record<string, string> = {
  'Labour productivity': 'labour_productivity',
  'Output per man-hour': 'output_per_man_hour',
  'Cost per man-hour': 'cost_per_man_hour',
  'Cost per unit': 'cost_per_unit',
  'Gross salary spend MTD': 'gross_salary_cost_mtd',
  'OT spend per ton': 'ot_spend_per_ton',
  'Overtime hours & cost': 'overtime_hours',
};

const ENGAGEMENT_METRIC: Record<string, string> = {
  'Absenteeism %': 'absenteeism_pct',
  'Attrition rate': 'attrition_rate_annualised_pct',
  'Number of leavers': 'leavers_mtd',
  'Voluntary attrition %': 'voluntary_attrition_pct',
  'New-hire attrition 30d': 'new_hire_attrition_30d_pct',
  'New-hire attrition 90d': 'new_hire_attrition_90d_pct',
  'New-hire attrition 180d': 'new_hire_attrition_180d_pct',
  'New-hire attrition 365d': 'new_hire_attrition_365d_pct',
};

/** The pptx column label → the employment category stored on the employee. */
const CATEGORY_KEY: Record<string, string> = {
  Total: 'total',
  'White collar': 'white_collar',
  Trainee: 'trainee',
  'Blue collar': 'blue_collar',
  Consultants: 'consultant',
};

/** A metric cell that has no value yet reads as an explicit dash, never a zero
 *  — zero is a measurement, absence is not. */
function NoValue({ label }: { label?: string }) {
  return (
    <span className="text-ink-subtle" aria-label={label ?? 'No data yet'}>
      —
    </span>
  );
}

/**
 * The opening (docs/05 §6): counters roll in ONCE on first paint with a 40ms
 * stagger, then never re-animate. "Feels alive, never busy."
 *
 * The stagger is capped so a long band never turns into a slow wave — §2.3
 * puts the ceiling at ~300ms total regardless of item count.
 */
const STAGGER_MS = 40;
const STAGGER_CAP_MS = 300;

function staggerDelay(index: number): number {
  return Math.min(index * STAGGER_MS, STAGGER_CAP_MS);
}

/**
 * A KPI that either shows a real measured number, or an honest dash carrying
 * the REASON it is absent. A zero here would read as a measurement.
 */
function Metric({
  metric,
  index,
  label,
}: {
  metric: { value: number | null; unavailableReason: string | null } | undefined;
  index: number;
  label: string;
}) {
  if (metric?.value === undefined || metric.value === null) {
    return (
      <Tooltip label={metric?.unavailableReason ?? 'Not measured in this snapshot'}>
        <span>
          <NoValue label={label} />
        </span>
      </Tooltip>
    );
  }
  return (
    <KpiNumber
      value={metric.value}
      precision={Number.isInteger(metric.value) ? 0 : 1}
      delay={staggerDelay(index)}
    />
  );
}

interface TrendPoint {
  label: string;
  date: string;
  value: number | null;
}

/** The data table every chart must offer (docs/05 §7 `data-table`). */
function TrendTable({ points, unit }: { points: TrendPoint[]; unit: string }) {
  const columns: Column<TrendPoint>[] = [
    { key: 'month', header: 'Month', width: '120px', render: (r) => r.label },
    {
      key: 'value',
      header: `Value (${unit})`,
      width: '140px',
      numeric: true,
      render: (r) =>
        r.value === null ? (
          <span className="text-ink-subtle">not measured</span>
        ) : (
          <span>{r.value.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</span>
        ),
    },
  ];
  return <DataTable rows={points} columns={columns} rowKey={(r) => r.date} maxHeight={240} />;
}

const leaverColumns: Column<LeaverRow>[] = [
  {
    key: 'emp',
    header: 'Employee',
    width: 'minmax(160px,1.2fr)',
    render: (r) => (
      <div>
        <p className="font-semibold text-ink">{r.employeeName}</p>
        <p className="text-xs text-ink-muted">{r.ecode} · {r.department ?? '—'}</p>
      </div>
    ),
  },
  {
    key: 'type',
    header: 'Exit type',
    width: '110px',
    render: (r) => (
      <StatusBadge tone={r.exitType === 'Voluntary' ? 'neutral' : 'negative'}>
        {r.exitType}
      </StatusBadge>
    ),
  },
  { key: 'resDate', header: 'Resigned', width: '100px', render: (r) => r.resignationDate },
  { key: 'lwd', header: 'LWD', width: '100px', render: (r) => r.lwd ?? '—' },
  { key: 'reason', header: 'Reason', width: 'minmax(140px,1fr)', render: (r) => <span className="text-xs text-ink-muted">{r.reason ?? '—'}</span> },
];

export function ExecutivePage() {
  const [rebuilding, setRebuilding] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [leavers, setLeavers] = useState<LeaverRow[]>([]);
  const [loadingLeavers, setLoadingLeavers] = useState(false);

  const kpis = useModuleResource<ExecutiveKpis>('/api/reports/executive');
  const absenteeism = useModuleResource<TrendPoint[]>(
    '/api/reports/executive/trend?metric=absenteeism_pct&months=6',
  );
  const overtime = useModuleResource<TrendPoint[]>(
    '/api/reports/executive/trend?metric=overtime_hours&months=6',
  );

  const openLeaversDrawer = async () => {
    setDrawerOpen(true);
    setLoadingLeavers(true);
    try {
      const res = await apiFetch<LeaverRow[]>('/api/reports/executive/leavers');
      setLeavers(res);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load leavers');
    } finally {
      setLoadingLeavers(false);
    }
  };

  /** Look a metric up by (metric, category); absent stays absent. */
  const find = (metric: string, category = 'total'): KpiMetric | undefined =>
    kpis.data === null
      ? undefined
      : kpis.data.metrics.find((m) => m.metric === metric && m.category === category);

  const burnoutMetric = find('burnout_index');
  const headcount = find('manpower_count')?.value ?? null;

  const handleRebuild = async () => {
    setRebuilding(true);
    try {
      await apiFetch('/api/reports/executive/rebuild', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      toast.success('Executive KPI snapshot rebuilt successfully');
      kpis.reload();
      absenteeism.reload();
      overtime.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to rebuild snapshot');
    } finally {
      setRebuilding(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Executive"
        title="Group dashboard"
        description="See how the group is doing — headcount, cost, absence and attrition — from last night’s snapshot, never a live guess."
        actions={
          <div className="flex items-center gap-2">
            {kpis.data === null ? (
              <StatusBadge tone="neutral">No snapshot yet</StatusBadge>
            ) : (
              <StatusBadge tone="positive">Snapshot {kpis.data.snapshotDate}</StatusBadge>
            )}
            <Button
              variant="secondary"
              size="sm"
              loading={rebuilding}
              leadingIcon={<RefreshCw className="size-3.5" />}
              onClick={() => { void handleRebuild(); }}
            >
              Rebuild snapshot
            </Button>
          </div>
        }
      />

      {/* Group hero (docs/06 §4, docs/12 Crextio): the one charcoal surface
          carries the headline number; tiles are the four the CEO asks first.
          A dash is "not measured yet", never a made-up figure. */}
      <DarkCard className="grid gap-8 lg:grid-cols-[1.1fr_1.4fr]">
        <div className="flex flex-col justify-between gap-6">
          <div>
            <p className="text-sm text-hero-muted">People on rolls · all companies</p>
            <p className="mt-3 text-6xl font-light tabular-nums tracking-tight text-hero-ink sm:text-7xl">
              {headcount === null ? '—' : <KpiNumber value={headcount} />}
            </p>
          </div>
          <p className="max-w-md text-sm leading-6 text-hero-muted">
            From last night’s snapshot — opening this page never runs a heavy query. A dash means
            not measured yet.
          </p>
        </div>
        <dl className="u-stagger grid grid-cols-2 gap-3">
          {(
            [
              ['Gross salary MTD', 'gross_salary_cost_mtd', '₹', '', 0],
              ['Average CTC', 'average_ctc', '₹', '', 0],
              ['Absenteeism', 'absenteeism_pct', '', '%', 1],
              ['Attrition (annualised)', 'attrition_rate_annualised_pct', '', '%', 1],
            ] as const
          ).map(([label, metric, prefix, suffix, precision]) => {
            const value = find(metric)?.value ?? null;
            return (
              <div
                key={metric}
                className="min-w-0 rounded-tile bg-[color-mix(in_srgb,var(--surface)_8%,transparent)] p-3.5 sm:p-5"
              >
                <dt className="text-xs text-hero-muted">{label}</dt>
                <dd className="mt-3 truncate text-xl font-light tabular-nums text-hero-ink sm:text-3xl">
                  {value === null ? (
                    '—'
                  ) : (
                    <KpiNumber value={value} prefix={prefix} suffix={suffix} precision={precision} />
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
      </DarkCard>

      {/* ── Band 1: manpower demographics ─────────────────────────────────── */}
      <Card padded={false}>
        <div className="p-6 pb-0">
          <CardHeader
            title="Manpower & demographics"
            subtitle="The pptx table, column for column. Contract reads “Phase 4” until that module exists — it is never estimated."
          />
        </div>
        <div className="overflow-x-auto" role="region" aria-label="Manpower and demographics table" tabIndex={0}>
          <div className="min-w-max p-6 pt-2">
            <div
              className="grid text-sm"
              style={{ gridTemplateColumns: `minmax(240px,1.4fr) repeat(${String(CATEGORIES.length)}, minmax(120px,1fr))` }}
            >
              <div className="border-b border-line px-3 py-3 text-xs font-medium text-ink-muted">
                Metric
              </div>
              {CATEGORIES.map((category) => (
                <div
                  key={category}
                  className="border-b border-line px-3 py-3 text-right text-xs font-medium text-ink-muted"
                >
                  {category}
                </div>
              ))}

              {DEMOGRAPHIC_ROWS.map((row) => (
                <div key={row.label} className="contents">
                  <div className="border-b border-line/50 px-3 py-3">
                    <Tooltip label={row.formula}>
                      <span className="font-medium text-ink">{row.label}</span>
                    </Tooltip>
                  </div>
                  {CATEGORIES.map((category, colIndex) => {
                    // docs/05 §4.8, verbatim: the Contract column reads
                    // "Phase 4" until that module exists — never estimated.
                    if (category === 'Contract') {
                      return (
                        <div
                          key={category}
                          className="border-b border-line/50 px-3 py-3 text-right"
                        >
                          <Pill>Phase 4</Pill>
                        </div>
                      );
                    }
                    const metricKey = DEMOGRAPHIC_METRIC[row.label] ?? '';
                    const cell = find(metricKey, CATEGORY_KEY[category] ?? 'total');
                    return (
                      <div
                        key={category}
                        className="border-b border-line/50 px-3 py-3 text-right tabular-nums"
                      >
                        {cell?.value === undefined || cell.value === null ? (
                          <Tooltip label={cell?.unavailableReason ?? 'Not measured in this snapshot'}>
                            <span>
                              <NoValue label={`${row.label}, ${category}`} />
                            </span>
                          </Tooltip>
                        ) : (
                          <KpiNumber
                            value={cell.value}
                            precision={row.label === 'Manpower count' ? 0 : 1}
                            suffix={row.label.includes('%') ? '%' : undefined}
                            delay={staggerDelay(colIndex)}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* ── Band 2: productivity & cost ───────────────────────────────────── */}
      <Card>
        <CardHeader
          title="Productivity & cost"
          subtitle="Two-series gold/charcoal charts only — the locked chart palette (docs/05 §4.8)."
          action={<Gauge className="size-5 text-ink-subtle" />}
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PRODUCTIVITY.map((metric, index) => (
            <div key={metric.label} className="rounded-row bg-surface-2 p-4">
              <p className="text-xs font-medium text-ink-muted">
                {metric.label}
              </p>
              <p className="mt-2 text-3xl font-light tabular-nums text-ink">
                <Metric
                  metric={find(PRODUCTIVITY_METRIC[metric.label] ?? '')}
                  index={index}
                  label={metric.label}
                />
              </p>
              <p className="mt-1 text-xs leading-5 text-ink-muted">{metric.formula}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs leading-5 text-ink-muted">
          Production output is a monthly figure in <code>core.settings</code> until the ERP feed
          exists — the source is stated rather than assumed.
        </p>
      </Card>

      {/* ── Band 3: attendance & engagement ───────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader
            title="Attendance & attrition"
            subtitle="Absenteeism trend, voluntary/involuntary attrition and 30/90/180/365d cohorts."
            action={
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  leadingIcon={<UserX className="size-3.5" />}
                  onClick={() => void openLeaversDrawer()}
                >
                  View leavers
                </Button>
                <TrendingDown className="size-5 text-ink-subtle" />
              </div>
            }
          />
          <div className="space-y-2">
            {ENGAGEMENT.map((metric, index) => (
              <div
                key={metric.label}
                className="flex items-center justify-between gap-4 rounded-row bg-surface-2 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-ink">{metric.label}</p>
                  <p className="mt-0.5 text-xs leading-5 text-ink-muted">{metric.formula}</p>
                </div>
                <span className="shrink-0 text-2xl font-light tabular-nums">
                  <Metric
                    metric={find(ENGAGEMENT_METRIC[metric.label] ?? '')}
                    index={index}
                    label={metric.label}
                  />
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Burnout index"
            subtitle="A composite proxy — labelled an index, never presented as a survey result."
            action={<Activity className="size-5 text-ink-subtle" />}
          />
          <p className="text-5xl font-light tabular-nums text-ink">
            {burnoutMetric?.value !== null && burnoutMetric?.value !== undefined ? (
              <KpiNumber value={burnoutMetric.value} precision={1} />
            ) : (
              <NoValue label="Burnout index" />
            )}
          </p>
          <div className="mt-4 space-y-2 text-xs leading-5 text-ink-muted">
            <p>Weighted z-score of:</p>
            <ul className="space-y-1">
              <li className="flex items-center gap-2">
                <Users className="size-3.5 shrink-0" /> OT hours per head
              </li>
              <li className="flex items-center gap-2">
                <Users className="size-3.5 shrink-0" /> Consecutive-workday streaks
              </li>
              <li className="flex items-center gap-2">
                <Users className="size-3.5 shrink-0" /> Unused-leave percentage
              </li>
              <li className="flex items-center gap-2">
                <Users className="size-3.5 shrink-0" /> Late-night swipe frequency
              </li>
            </ul>
            <p className="pt-1">
              The weights live in <code>core.settings</code>, so the definition is auditable and
              tunable without a deploy.
            </p>
          </div>
        </Card>
      </div>

      {/* ── Trends — the locked two-series palette, gold = subject ────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Absenteeism trend"
            subtitle="(UAB + A) days ÷ scheduled working days, by month (docs/06 §4)"
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
          <CardHeader
            title="Overtime hours"
            subtitle="Σ approved OT minutes ÷ 60, by month"
          />
          <TrendChart
            points={overtime.data ?? []}
            seriesLabel="OT hours"
            unit=" h"
            emptyMessage="No monthly snapshots yet — the nightly job builds these."
            tableAlternative={<TrendTable points={overtime.data ?? []} unit="hours" />}
          />
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Manpower by category"
          subtitle="Active employees at the snapshot date — the same numbers as the table above."
        />
        <BarChart
          points={CATEGORIES.filter((c) => c !== 'Contract' && c !== 'Total').map((category) => ({
            label: category,
            value: find('manpower_count', CATEGORY_KEY[category] ?? 'total')?.value ?? null,
          }))}
          seriesLabel="Headcount"
          tableAlternative={
            <p className="text-xs text-ink-muted">
              The demographics table above is this chart&rsquo;s data table — same snapshot, same
              numbers.
            </p>
          }
          emptyMessage="No snapshot yet."
        />
      </Card>

      {kpis.data === null ? (
        <PendingModule
          phase="Phase 3"
          task="RPT-03"
          description="You will read group KPIs here. A snapshot has not been built yet — dashes mean not measured, never a made-up number."
        />
      ) : (
        <p className="text-xs leading-5 text-ink-muted">
          Read from a precomputed nightly snapshot — opening this page never runs an aggregation
          (docs/06 §4). Cells showing an em dash carry the reason on hover; not measured is not the
          same as zero.
        </p>
      )}

      <Drawer
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); }}
        title="Recent leavers & attrition drill-down"
        subtitle="Employees separated in the current period with recorded notice and reasons."
        width={640}
      >
        {loadingLeavers ? (
          <div className="py-8 text-center text-sm text-ink-muted">Loading leavers...</div>
        ) : leavers.length === 0 ? (
          <div className="py-8 text-center text-sm text-ink-muted">No recorded leavers in the current period.</div>
        ) : (
          <DataTable
            rows={leavers}
            columns={leaverColumns}
            rowKey={(r) => String(r.separationId)}
            maxHeight={480}
          />
        )}
      </Drawer>
    </div>
  );
}
