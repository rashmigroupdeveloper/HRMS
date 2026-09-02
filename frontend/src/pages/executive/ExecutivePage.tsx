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
import { Activity, Gauge, RefreshCw, TrendingDown, Users } from 'lucide-react';
import {
  BarChart,
  Card,
  CardHeader,
  DarkCard,
  DataTable,
  KpiNumber,
  PageHeader,
  Pill,
  StatusBadge,
  Tooltip,
  TrendChart,
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
  { label: 'Contract dependency ratio', formula: 'Contract count ÷ total manpower (Phase 4)' },
  { label: 'Average CTC', formula: 'AVG(annual_ctc) by category and grade band' },
];

const PRODUCTIVITY = [
  { label: 'Labour productivity', formula: 'Output ÷ total manpower' },
  { label: 'Output per man-hour', formula: 'Output ÷ Σ worked_minutes / 60' },
  { label: 'Cost per man-hour', formula: '(Gross payroll + ER contributions) ÷ Σ worked hours' },
  { label: 'Cost per unit', formula: 'Payroll cost ÷ output units' },
  { label: 'Overtime hours & cost', formula: 'Σ approved OT minutes / 60 · Σ OT payroll lines' },
];

const ENGAGEMENT = [
  { label: 'Absenteeism %', formula: '(UAB + A) days ÷ scheduled working days, monthly trend' },
  { label: 'Attrition rate', formula: 'Leavers in period ÷ average headcount, annualised' },
  { label: 'Number of leavers', formula: 'Count by month' },
  { label: 'New-hire attrition 3 / 6 / 12 mo', formula: '% of a joiner cohort exited within 90 / 180 / 365 days of DOJ' },
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

/** docs/06 §4 metric keys → the row they belong to. */
const DEMOGRAPHIC_METRIC: Record<string, string> = {
  'Manpower count': 'manpower_count',
  'Average age': 'average_age',
  Tenure: 'tenure_years',
  'Leadership %': 'leadership_pct',
  'Contract dependency ratio': 'contract_dependency_ratio',
  'Average CTC': 'average_ctc',
};

const PRODUCTIVITY_METRIC: Record<string, string> = {
  'Labour productivity': 'labour_productivity',
  'Output per man-hour': 'output_per_man_hour',
  'Cost per man-hour': 'cost_per_man_hour',
  'Cost per unit': 'cost_per_unit',
  'Overtime hours & cost': 'overtime_hours',
};

const ENGAGEMENT_METRIC: Record<string, string> = {
  'Absenteeism %': 'absenteeism_pct',
  'Attrition rate': 'attrition_rate_annualised_pct',
  'Number of leavers': 'leavers_mtd',
  'New-hire attrition 3 / 6 / 12 mo': 'new_hire_attrition_3m_pct',
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
    <span className="text-ink-faint" aria-label={label ?? 'No data yet'}>
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
          <span className="text-ink-faint">not measured</span>
        ) : (
          <span>{r.value.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</span>
        ),
    },
  ];
  return <DataTable rows={points} columns={columns} rowKey={(r) => r.date} maxHeight={240} />;
}

export function ExecutivePage() {
  const kpis = useModuleResource<ExecutiveKpis>('/api/reports/executive');
  const absenteeism = useModuleResource<TrendPoint[]>(
    '/api/reports/executive/trend?metric=absenteeism_pct&months=6',
  );
  const overtime = useModuleResource<TrendPoint[]>(
    '/api/reports/executive/trend?metric=overtime_hours&months=6',
  );

  /** Look a metric up by (metric, category); absent stays absent. */
  const find = (metric: string, category = 'total'): KpiMetric | undefined =>
    kpis.data === null
      ? undefined
      : kpis.data.metrics.find((m) => m.metric === metric && m.category === category);

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
            <Pill>
              <RefreshCw className="mr-1 inline size-3" />
              Nightly
            </Pill>
          </div>
        }
      />

      <DarkCard padded={false} className="p-8 md:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-hero-muted">
          What you will see here
        </p>
        <h2 className="mt-4 max-w-xl text-4xl font-light tracking-tight text-hero-ink">
          How the group is doing — without guessing.
        </h2>
        <p className="mt-4 max-w-xl text-sm leading-7 text-hero-muted">
          You will read headcount, cost, absence and attrition from last night’s snapshot. A dash
          means not measured yet — never a made-up number. Opening this page never runs a heavy
          query.
        </p>
      </DarkCard>

      {/* ── Band 1: manpower demographics ─────────────────────────────────── */}
      <Card padded={false}>
        <div className="p-6 pb-0">
          <CardHeader
            title="Manpower & demographics"
            subtitle="The pptx table, column for column. Contract reads “Phase 4” until that module exists — it is never estimated."
          />
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-max p-6 pt-2">
            <div
              className="grid text-sm"
              style={{ gridTemplateColumns: `minmax(240px,1.4fr) repeat(${String(CATEGORIES.length)}, minmax(120px,1fr))` }}
            >
              <div className="border-b border-line px-3 py-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Metric
              </div>
              {CATEGORIES.map((category) => (
                <div
                  key={category}
                  className="border-b border-line px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-ink-muted"
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
          action={<Gauge className="size-5 text-ink-faint" />}
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PRODUCTIVITY.map((metric, index) => (
            <div key={metric.label} className="rounded-row bg-surface-2 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
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
            subtitle="Absenteeism trend, attrition and the new-hire cohort view from slide 2."
            action={<TrendingDown className="size-5 text-ink-faint" />}
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
            action={<Activity className="size-5 text-ink-faint" />}
          />
          <p className="text-5xl font-light tabular-nums text-ink">
            <NoValue label="Burnout index" />
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
            subtitle="Σ approved OT minutes ÷ 60, by month (ATT-08)"
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
    </div>
  );
}
