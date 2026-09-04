/**
 * RPT-03 — the CEO dashboard KPI snapshot (docs/06 §4).
 *
 * Every metric below cites the formula from docs/06 §4 verbatim. Metrics that
 * depend on tables that do not exist yet (all payroll cost figures) are written
 * with a NULL value and an explicit `unavailable_reason`, so the dashboard can
 * say *why* a cell is empty rather than rendering a zero that reads like a
 * measurement. Absence and zero are different facts.
 *
 * This runs as a job (nightly, or on demand); the read API only ever selects
 * precomputed rows — the CEO opening the page must never start an aggregation
 * over att.day_records (CLAUDE.md §1.9).
 */
import { sql, type Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { formatDbDate, istDateString } from '../../core/dates.js';
import { getTypedSetting } from '../settings/index.js';

const EMPLOYMENT_CATEGORIES = [
  'white_collar',
  'trainee',
  'blue_collar',
  'contract',
  'consultant',
] as const;

/** Reason strings are stable so the UI can key off them. */
const NEEDS_PAYROLL = 'Requires the Phase-2 payroll tables (pay.*)';
const NEEDS_OUTPUT = 'Requires monthly production output (core.settings: reporting.monthly_output_units)';
const NEEDS_PHASE4 = 'Contract workforce arrives with Phase 4';

interface MetricRow {
  companyId: number | null;
  category: string;
  metric: string;
  value: number | null;
  unavailableReason?: string | null;
}

export interface KpiSnapshot {
  snapshotDate: string;
  computedAt: string | null;
  metrics: {
    companyId: number | null;
    category: string;
    metric: string;
    value: number | null;
    unavailableReason: string | null;
  }[];
}

/**
 * Recompute the whole snapshot for a date. Idempotent: re-running replaces the
 * day's rows rather than appending, so a mid-day rebuild is safe.
 */
export async function buildKpiSnapshot(
  db: Kysely<Database>,
  params: { date?: string | undefined } = {},
): Promise<{ snapshotDate: string; metrics: number }> {
  const date = params.date ?? istDateString();
  const leadershipRank = await getTypedSetting(db, 'reporting.leadership_rank_cutoff', 'number', 8);
  const outputUnits = await getTypedSetting(db, 'reporting.monthly_output_units', 'number', 0);

  const rows: MetricRow[] = [];

  // ── Manpower count — "active employees at date, by category" ──────────────
  const activeAtDate = (alias: string) => sql<boolean>`
    ${sql.ref(`${alias}.doj`)} IS NOT NULL
    AND ${sql.ref(`${alias}.doj`)} <= ${date}::date
    AND (
      ${sql.ref(`${alias}.dol`)} IS NULL
      OR ${sql.ref(`${alias}.dol`)} > ${date}::date
    )
  `;

  const headcount = await db
    .selectFrom('core.employees as e')
    .select(['e.category as category'])
    .select((eb) => eb.fn.countAll<string>().as('n'))
    .where(activeAtDate('e'))
    .groupBy('e.category')
    .execute();

  const totalActive = headcount.reduce((sum, r) => sum + Number(r.n), 0);
  rows.push({ companyId: null, category: 'total', metric: 'manpower_count', value: totalActive });
  for (const category of EMPLOYMENT_CATEGORIES) {
    const categoryCount = headcount.find((row) => row.category === category);
    rows.push({
      companyId: null,
      category,
      metric: 'manpower_count',
      value: Number(categoryCount?.n ?? 0),
    });
  }

  // ── Average age — "AVG(age(dob)) by category" ─────────────────────────────
  const ages = await db
    .selectFrom('core.employees as e')
    .select(['e.category as category'])
    .select(sql<string | null>`AVG(EXTRACT(YEAR FROM age(${date}::date, e.dob)))`.as('avg_years'))
    .select((eb) => eb.fn.countAll<string>().as('n'))
    .where(activeAtDate('e'))
    .where('e.dob', 'is not', null)
    .groupBy('e.category')
    .execute();
  for (const r of ages) {
    rows.push({
      companyId: null,
      category: r.category ?? 'unspecified',
      metric: 'average_age',
      value: r.avg_years === null ? null : Number(r.avg_years),
    });
  }
  const ageCount = ages.reduce((sum, row) => sum + Number(row.n), 0);
  const ageSum = ages.reduce(
    (sum, row) => sum + Number(row.avg_years ?? 0) * Number(row.n),
    0,
  );
  rows.push({
    companyId: null,
    category: 'total',
    metric: 'average_age',
    value: ageCount === 0 ? null : ageSum / ageCount,
    unavailableReason: ageCount === 0 ? 'No active employees have a date of birth' : null,
  });

  // ── Tenure — "AVG(age(doj)) of active, by category" ───────────────────────
  const tenure = await db
    .selectFrom('core.employees as e')
    .select(['e.category as category'])
    .select(sql<string | null>`AVG(EXTRACT(YEAR FROM age(${date}::date, e.doj)))`.as('avg_years'))
    .select((eb) => eb.fn.countAll<string>().as('n'))
    .where(activeAtDate('e'))
    .groupBy('e.category')
    .execute();
  for (const r of tenure) {
    rows.push({
      companyId: null,
      category: r.category ?? 'unspecified',
      metric: 'tenure_years',
      value: r.avg_years === null ? null : Number(r.avg_years),
    });
  }
  const tenureCount = tenure.reduce((sum, row) => sum + Number(row.n), 0);
  const tenureSum = tenure.reduce(
    (sum, row) => sum + Number(row.avg_years ?? 0) * Number(row.n),
    0,
  );
  rows.push({
    companyId: null,
    category: 'total',
    metric: 'tenure_years',
    value: tenureCount === 0 ? null : tenureSum / tenureCount,
    unavailableReason: tenureCount === 0 ? 'No active employees have a joining date' : null,
  });

  // ── Leadership % — "active with grade.rank >= cutoff ÷ active" ────────────
  const leaders = await db
    .selectFrom('core.employees as e')
    .innerJoin('core.grades as g', 'g.id', 'e.grade_id')
    .select((eb) => eb.fn.countAll<string>().as('n'))
    .where(activeAtDate('e'))
    .where('g.rank', '>=', leadershipRank)
    .executeTakeFirst();
  rows.push({
    companyId: null,
    category: 'total',
    metric: 'leadership_pct',
    value: totalActive === 0 ? null : (Number(leaders?.n ?? 0) / totalActive) * 100,
  });

  // ── Contract dependency — computable on an ON-ROLL basis only ─────────────
  const contractOnRoll = headcount.find((r) => r.category === 'contract');
  rows.push({
    companyId: null,
    category: 'total',
    metric: 'contract_dependency_ratio',
    value:
      totalActive === 0 ? null : (Number(contractOnRoll?.n ?? 0) / totalActive) * 100,
    unavailableReason: NEEDS_PHASE4,
  });

  // ── Leavers + attrition — "leavers in period ÷ average headcount, annualized"
  const monthStart = `${date.slice(0, 7)}-01`;
  const leavers = await db
    .selectFrom('core.employees')
    .select((eb) => eb.fn.countAll<string>().as('n'))
    .where('status', '=', 'exited')
    .where('dol', '>=', sql<Date>`${monthStart}::date`)
    .where('dol', '<=', sql<Date>`${date}::date`)
    .executeTakeFirst();
  const leaverCount = Number(leavers?.n ?? 0);
  const headcountAtMonthStart = await db
    .selectFrom('core.employees as e')
    .select((eb) => eb.fn.countAll<string>().as('n'))
    .where('e.doj', 'is not', null)
    .where('e.doj', '<=', sql<Date>`${monthStart}::date`)
    .where((eb) =>
      eb.or([eb('e.dol', 'is', null), eb('e.dol', '>', sql<Date>`${monthStart}::date`)]),
    )
    .executeTakeFirst();
  const averageHeadcount = (Number(headcountAtMonthStart?.n ?? 0) + totalActive) / 2;
  rows.push({ companyId: null, category: 'total', metric: 'leavers_mtd', value: leaverCount });
  rows.push({
    companyId: null,
    category: 'total',
    metric: 'attrition_rate_annualised_pct',
    // Monthly leavers ÷ average(start-of-month, snapshot-date headcount), annualised ×12.
    value: averageHeadcount === 0 ? null : (leaverCount / averageHeadcount) * 12 * 100,
  });

  // ── New-hire attrition 3/6/12 mo (pptx slide 2) ───────────────────────────
  for (const [label, days] of [
    ['new_hire_attrition_3m_pct', 90],
    ['new_hire_attrition_6m_pct', 180],
    ['new_hire_attrition_12m_pct', 365],
  ] as const) {
    const cohort = await db
      .selectFrom('core.employees')
      .select((eb) => eb.fn.countAll<string>().as('n'))
      .where('doj', 'is not', null)
      .where('doj', '>=', sql<Date>`(${date}::date - ${days + 365} * INTERVAL '1 day')`)
      .where('doj', '<', sql<Date>`(${date}::date - ${days} * INTERVAL '1 day')`)
      .executeTakeFirst();
    const exited = await db
      .selectFrom('core.employees')
      .select((eb) => eb.fn.countAll<string>().as('n'))
      .where('doj', 'is not', null)
      .where('doj', '>=', sql<Date>`(${date}::date - ${days + 365} * INTERVAL '1 day')`)
      .where('doj', '<', sql<Date>`(${date}::date - ${days} * INTERVAL '1 day')`)
      .where('status', '=', 'exited')
      .where('dol', 'is not', null)
      .where('dol', '<=', sql<Date>`${date}::date`)
      .where(sql<boolean>`(dol - doj) <= ${days}`)
      .executeTakeFirst();
    const cohortSize = Number(cohort?.n ?? 0);
    rows.push({
      companyId: null,
      category: 'total',
      metric: label,
      value: cohortSize === 0 ? null : (Number(exited?.n ?? 0) / cohortSize) * 100,
      unavailableReason: cohortSize === 0 ? 'No joiner cohort in this window yet' : null,
    });
  }

  // ── Absenteeism % — "(UAB + A) days ÷ scheduled working days" ─────────────
  const absence = await db
    .selectFrom('att.day_records')
    .select(sql<string>`COUNT(*) FILTER (WHERE status IN ('A','UAB'))`.as('absent'))
    .select(sql<string>`COUNT(*) FILTER (WHERE status NOT IN ('WO','H'))`.as('scheduled'))
    .where('work_date', '>=', sql<Date>`${monthStart}::date`)
    .where('work_date', '<=', sql<Date>`${date}::date`)
    .executeTakeFirst();
  const scheduled = Number(absence?.scheduled ?? 0);
  rows.push({
    companyId: null,
    category: 'total',
    metric: 'absenteeism_pct',
    value: scheduled === 0 ? null : (Number(absence?.absent ?? 0) / scheduled) * 100,
    unavailableReason: scheduled === 0 ? 'No processed attendance in this period' : null,
  });

  // ── Overtime hours — "Σ approved OT minutes / 60" ─────────────────────────
  const ot = await db
    .selectFrom('att.overtime_entries')
    .select(sql<string>`COALESCE(SUM(approved_minutes), 0)`.as('minutes'))
    .where('work_date', '>=', sql<Date>`${monthStart}::date`)
    .where('work_date', '<=', sql<Date>`${date}::date`)
    .where('status', '=', 'approved')
    .executeTakeFirst();
  const otHours = Number(ot?.minutes ?? 0) / 60;
  rows.push({ companyId: null, category: 'total', metric: 'overtime_hours', value: otHours });

  // ── Output-dependent metrics ──────────────────────────────────────────────
  const workedHours = await db
    .selectFrom('att.day_records')
    .select(sql<string>`COALESCE(SUM(worked_minutes), 0)`.as('minutes'))
    .where('work_date', '>=', sql<Date>`${monthStart}::date`)
    .where('work_date', '<=', sql<Date>`${date}::date`)
    .executeTakeFirst();
  const totalWorkedHours = Number(workedHours?.minutes ?? 0) / 60;

  rows.push({
    companyId: null,
    category: 'total',
    metric: 'labour_productivity',
    value: outputUnits > 0 && totalActive > 0 ? outputUnits / totalActive : null,
    unavailableReason: outputUnits > 0 ? null : NEEDS_OUTPUT,
  });
  rows.push({
    companyId: null,
    category: 'total',
    metric: 'output_per_man_hour',
    value: outputUnits > 0 && totalWorkedHours > 0 ? outputUnits / totalWorkedHours : null,
    unavailableReason: outputUnits > 0 ? null : NEEDS_OUTPUT,
  });

  // ── Cost metrics — honestly absent until payroll exists ───────────────────
  for (const metric of [
    'average_ctc',
    'cost_per_man_hour',
    'cost_per_unit',
    'overtime_cost',
    'burnout_index',
  ]) {
    rows.push({
      companyId: null,
      category: 'total',
      metric,
      value: null,
      unavailableReason: metric === 'burnout_index' ? 'Composite weights not yet configured' : NEEDS_PAYROLL,
    });
  }

  // Replace the day's rows atomically — a half-written snapshot would be read
  // by the dashboard as though it were complete.
  await db.transaction().execute(async (trx) => {
    await trx
      .deleteFrom('reporting.kpi_daily')
      .where('snapshot_date', '=', sql<Date>`${date}::date`)
      .execute();
    await trx
      .insertInto('reporting.kpi_daily')
      .values(
        rows.map((r) => ({
          snapshot_date: sql<Date>`${date}::date` as unknown as Date,
          company_id: r.companyId,
          category: r.category,
          metric: r.metric,
          value: r.value === null ? null : String(r.value),
          unavailable_reason: r.unavailableReason ?? null,
        })),
      )
      .execute();
  });

  return { snapshotDate: date, metrics: rows.length };
}

/** Read the most recent snapshot on or before `date`. Never aggregates. */
export async function readKpiSnapshot(
  db: Kysely<Database>,
  params: { date?: string | undefined } = {},
): Promise<KpiSnapshot | null> {
  const asOf = params.date ?? istDateString();
  const latest = await db
    .selectFrom('reporting.kpi_daily')
    .select(['snapshot_date'])
    .where('snapshot_date', '<=', sql<Date>`${asOf}::date`)
    .orderBy('snapshot_date', 'desc')
    .limit(1)
    .executeTakeFirst();
  if (!latest) return null;

  const rows = await db
    .selectFrom('reporting.kpi_daily')
    .selectAll()
    .where('snapshot_date', '=', latest.snapshot_date)
    .orderBy('metric')
    .execute();

  const first = rows[0];
  return {
    snapshotDate: formatDbDate(latest.snapshot_date),
    computedAt:
      first?.computed_at instanceof Date ? first.computed_at.toISOString() : null,
    metrics: rows.map((r) => ({
      companyId: r.company_id,
      category: r.category,
      metric: r.metric,
      value: r.value === null ? null : Number(r.value),
      unavailableReason: r.unavailable_reason,
    })),
  };
}

/**
 * KPI trend — the same precomputed rows, read across time (docs/06 §4:
 * "absenteeism %, monthly trend"; §5 BU dashboard "absenteeism trend").
 *
 * Still no aggregation: this reads `reporting.kpi_daily`, which the nightly job
 * already wrote. A month with no snapshot comes back as `null` rather than 0 —
 * the chart breaks its line at a gap instead of drawing a false dip to zero.
 */
export async function kpiTrend(
  db: Kysely<Database>,
  params: { metric: string; months?: number | undefined; category?: string | undefined },
): Promise<{ label: string; date: string; value: number | null }[]> {
  const months = Math.min(Math.max(params.months ?? 6, 1), 24);
  const category = params.category ?? 'total';

  // One row per month: the LAST snapshot in each month is that month's value.
  const rows = await sql<{ month: string; value: string | null }>`
    SELECT to_char(date_trunc('month', snapshot_date), 'YYYY-MM') AS month,
           (array_agg(value ORDER BY snapshot_date DESC))[1] AS value
      FROM reporting.kpi_daily
     WHERE metric = ${params.metric}
       AND category = ${category}
       AND snapshot_date >= (date_trunc('month', CURRENT_DATE) - ${months - 1} * INTERVAL '1 month')
     GROUP BY 1
     ORDER BY 1
  `.execute(db);

  const byMonth = new Map(rows.rows.map((r) => [r.month, r.value]));

  // Emit EVERY month in the window, so a gap is visible as a gap.
  const out: { label: string; date: string; value: number | null }[] = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = `${String(d.getUTCFullYear())}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const raw = byMonth.get(key);
    out.push({
      label: d.toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' }),
      date: key,
      value: raw === undefined || raw === null ? null : Number(raw),
    });
  }
  return out;
}
