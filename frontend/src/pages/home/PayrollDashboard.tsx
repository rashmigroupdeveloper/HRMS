/**
 * Payroll home (docs/08 §3 payroll_admin, docs/06 §5 "Payroll console":
 * run states, exceptions, statutory calendar). Reads the real run list —
 * nothing here is a placeholder figure (docs/05 §4.8 honesty rule).
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Banknote,
  CalendarClock,
  Coins,
  FileSpreadsheet,
  Layers,
  ReceiptText,
  Settings2,
  TrendingUp,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { todayLongIST } from '../../lib/date';
import {
  Card,
  CardHeader,
  DarkCard,
  EmptyState,
  KpiNumber,
  KpiPillRow,
  PageHeader,
  QuickLinks,
  StatusBadge,
  cn,
  todayISOIST,
} from '../../ui';
import type { StatusTone } from '../../ui';
import { DashboardError, DashboardSkeleton } from './DashboardFeedback';

interface RunSummary {
  id: number;
  companyId: number;
  month: string;
  status: string;
  employeeCount: number;
  grossRupees: number;
  totalDeductionsRupees: number;
  netPayRupees: number;
}
interface Company {
  id: number;
  name: string;
  code: string;
}
interface LoanRow {
  loanId: number;
  status?: string;
  currentOutstandingRupees: number;
}

const STATES = [
  'draft',
  'inputs_locked',
  'computed',
  'under_review',
  'approved',
  'finalized',
  'paid',
] as const;
const STATE_LABEL: Record<string, string> = {
  draft: 'Draft',
  inputs_locked: 'Inputs locked',
  computed: 'Computed',
  under_review: 'Under review',
  approved: 'Approved',
  finalized: 'Finalized',
  paid: 'Paid',
  reopened: 'Reopened',
};
const OPEN = new Set([
  'draft',
  'inputs_locked',
  'computed',
  'under_review',
  'approved',
  'reopened',
]);

const monthLabel = (m: string): string =>
  new Date(`${m.slice(0, 7)}-01T00:00:00Z`).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
const tone = (s: string): StatusTone =>
  s === 'paid' || s === 'finalized'
    ? 'positive'
    : s === 'approved' || s === 'under_review'
      ? 'info'
      : s === 'reopened'
        ? 'warning'
        : 'neutral';

/** PF ECR and ESIC challan are due by the 15th of the following month (docs/10 §PF, §ESIC). */
function nextStatutoryDue(todayIso: string): { label: string; date: string; days: number } {
  const [y, m, d] = todayIso.split('-').map(Number) as [number, number, number];
  const dueThisMonth = d <= 15;
  const due = new Date(Date.UTC(y, dueThisMonth ? m - 1 : m, 15));
  const today = new Date(Date.UTC(y, m - 1, d));
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  const forMonth = new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth() - 1, 1));
  return {
    label: forMonth.toLocaleDateString('en-IN', { month: 'long', timeZone: 'UTC' }),
    date: due.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }),
    days,
  };
}

export function PayrollDashboard() {
  const [runs, setRuns] = useState<RunSummary[] | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setError(null);
    Promise.all([
      apiFetch<RunSummary[]>('/api/payroll/runs/list', {
        method: 'POST',
        body: JSON.stringify({}),
      }),
      apiFetch<{ companies: Company[] }>('/api/core/companies').catch(() => ({ companies: [] })),
      apiFetch<LoanRow[]>('/api/loans/all').catch(() => []),
    ])
      .then(([list, comp, loanRows]) => {
        if (!alive) return;
        setRuns(
          [...list].sort((a, b) => b.month.localeCompare(a.month) || a.companyId - b.companyId),
        );
        setCompanies(comp.companies);
        setLoans(loanRows);
      })
      .catch((cause: unknown) => {
        if (alive)
          setError(cause instanceof Error ? cause.message : 'Payroll runs could not be loaded.');
      });
    return () => {
      alive = false;
    };
  }, [attempt]);

  if (error)
    return (
      <DashboardError
        message={error}
        onRetry={() => {
          setAttempt((n) => n + 1);
        }}
      />
    );
  if (runs === null) return <DashboardSkeleton />;

  const open = runs.filter((run) => OPEN.has(run.status));
  const awaiting = runs.filter((run) => run.status === 'under_review' || run.status === 'approved');
  const finalized = runs.filter((run) => run.status === 'finalized' || run.status === 'paid');
  const current = open[0] ?? runs[0] ?? null;
  const companyName = (id: number): string =>
    companies.find((c) => c.id === id)?.name ?? `Company ${String(id)}`;
  const due = nextStatutoryDue(todayISOIST());
  const activeLoans = loans.filter((loan) => loan.currentOutstandingRupees > 0).length;
  const stepIndex = current
    ? Math.max(0, STATES.indexOf(current.status as (typeof STATES)[number]))
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <PageHeader
          eyebrow={todayLongIST()}
          title="Payroll"
          description="Run state, the next statutory deadline and what is waiting on you. Every tile opens the screen behind it."
        />
        <KpiPillRow
          pills={[
            {
              label: 'Open runs',
              value: open.length,
              state: 'hatched',
              icon: <Layers />,
              to: '/payroll',
            },
            {
              label: 'Awaiting sign-off',
              value: awaiting.length,
              state: awaiting.length > 0 ? 'accent' : 'outline',
              icon: <TrendingUp />,
              to: '/payroll',
            },
            {
              label: 'Finalized',
              value: finalized.length,
              state: 'filled',
              icon: <Banknote />,
              to: '/payroll',
            },
            {
              label: 'Active loans',
              value: activeLoans,
              state: 'outline',
              icon: <Coins />,
              to: '/loans',
            },
          ]}
        />
      </div>

      <QuickLinks
        links={[
          {
            to: '/payroll',
            label: 'Run console',
            icon: <Banknote />,
            primary: awaiting.length === 0 && open.length > 0,
          },
          { to: '/payroll/structures', label: 'Salary structures', icon: <Layers /> },
          { to: '/payroll/revisions', label: 'Revisions', icon: <TrendingUp /> },
          { to: '/loans', label: 'Loans', icon: <Coins /> },
          { to: '/claims', label: 'Claims pay batch', icon: <ReceiptText /> },
          { to: '/payroll/parallel-run', label: 'Parallel run', icon: <FileSpreadsheet /> },
          { to: '/admin/settings', label: 'Payroll settings', icon: <Settings2 /> },
        ]}
      />

      {current ? (
        <DarkCard className="grid gap-8 lg:grid-cols-[1.35fr_1fr]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-hero-muted">{companyName(current.companyId)}</p>
              <StatusBadge tone={tone(current.status)}>
                {STATE_LABEL[current.status] ?? current.status}
              </StatusBadge>
            </div>
            <h2 className="mt-3 text-4xl font-light tracking-tight sm:text-5xl">
              {monthLabel(current.month)}
            </h2>
            <ol aria-label="Run progress" className="mt-6 grid grid-cols-7 gap-1.5">
              {STATES.map((state, index) => (
                <li key={state} className="min-w-0">
                  <span
                    aria-hidden
                    className={cn(
                      'block h-2 rounded-full',
                      index < stepIndex
                        ? 'bg-hero-ink'
                        : index === stepIndex
                          ? 'bg-accent'
                          : 'u-hatch bg-[color-mix(in_srgb,var(--hero-ink)_10%,transparent)]',
                    )}
                  />
                  <span
                    className={cn(
                      'mt-2 hidden truncate text-[11px] md:block',
                      index === stepIndex ? 'text-hero-ink' : 'text-hero-muted',
                    )}
                  >
                    {STATE_LABEL[state]}
                  </span>
                  <span className="sr-only">
                    {STATE_LABEL[state]}:{' '}
                    {index < stepIndex ? 'done' : index === stepIndex ? 'current' : 'to do'}
                  </span>
                </li>
              ))}
            </ol>
            <Link
              to="/payroll"
              className="u-press mt-7 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink"
            >
              Open run console <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          <dl className="grid grid-cols-2 gap-3 self-end">
            {[
              { label: 'Employees', value: current.employeeCount, prefix: '' },
              { label: 'Gross', value: current.grossRupees, prefix: '₹' },
              { label: 'Deductions', value: current.totalDeductionsRupees, prefix: '₹' },
              { label: 'Net pay', value: current.netPayRupees, prefix: '₹' },
            ].map((tile) => (
              <div
                key={tile.label}
                className="rounded-tile bg-[color-mix(in_srgb,var(--hero-ink)_8%,transparent)] p-4"
              >
                <dt className="text-xs text-hero-muted">{tile.label}</dt>
                <dd className="mt-1 truncate text-2xl font-semibold">
                  <KpiNumber value={tile.value} prefix={tile.prefix} />
                </dd>
              </div>
            ))}
            {current.employeeCount === 0 ? (
              <div className="col-span-2">
                <dt className="sr-only">Status</dt>
                <dd className="text-xs leading-5 text-hero-muted">Not computed yet — figures appear after Compute.</dd>
              </div>
            ) : null}
          </dl>
        </DarkCard>
      ) : (
        <Card>
          <EmptyState
            icon={<Banknote />}
            title="No payroll runs yet"
            description="Create the first draft run from the run console."
          />
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader
            title="Recent runs"
            subtitle={`${String(runs.length)} run${runs.length === 1 ? '' : 's'} across ${String(new Set(runs.map((r) => r.companyId)).size)} compan${new Set(runs.map((r) => r.companyId)).size === 1 ? 'y' : 'ies'}`}
            action={
              <Link to="/payroll" className="text-sm font-semibold text-ink hover:underline">
                All runs
              </Link>
            }
          />
          <ul className="u-stagger divide-y divide-dotted divide-line-strong">
            {runs.slice(0, 6).map((run) => (
              <li key={run.id}>
                <Link
                  to="/payroll"
                  className="u-press flex items-center justify-between gap-3 rounded-row px-2 py-3 hover:bg-accent-soft"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink">
                      {monthLabel(run.month)}
                    </span>
                    <span className="block truncate text-xs text-ink-muted">
                      {companyName(run.companyId)}
                    </span>
                  </span>
                  <StatusBadge tone={tone(run.status)}>
                    {STATE_LABEL[run.status] ?? run.status}
                  </StatusBadge>
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Statutory calendar" subtitle="Next filing deadline" />
          <div className="rounded-tile bg-surface-2 p-5">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-full bg-surface u-shadow-card">
                <CalendarClock className="size-5 text-ink" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">PF ECR + ESIC challan</p>
                <p className="text-xs text-ink-muted">
                  For {due.label} wages · due {due.date}
                </p>
              </div>
            </div>
            <p className="mt-5 text-5xl font-light tabular-nums text-ink">
              <KpiNumber value={due.days} />
              <span className="ml-2 text-base font-medium text-ink-muted">
                day{due.days === 1 ? '' : 's'} left
              </span>
            </p>
            <p className="mt-3 text-xs leading-5 text-ink-muted">
              ECR is uploaded to the EPFO portal and the ESIC challan paid by the 15th of the
              following month (docs/10).
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
