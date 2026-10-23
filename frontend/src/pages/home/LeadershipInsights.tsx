/**
 * Leadership insights — the "value even on a quiet day" band for group and
 * plant leaders (hr_head, super_admin, ceo_cell, plant_head, payroll_admin).
 * Every widget loads on its own and quietly drops out when this login cannot
 * read its source (403/404), so one missing permission never blanks the page.
 * Numbers come only from live report APIs; nothing here is invented.
 */
import { CalendarClock, CheckCircle2, Sparkles, UserMinus } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError, apiFetch } from '../../lib/api';
import type { SessionUser } from '../../lib/session';
import { canAccessRoute } from '../../app/route-guard';
import {
  CalmEmpty,
  Card,
  CardHeader,
  CardLink,
  DarkCard,
  KpiNumber,
  MiniBars,
  Skeleton,
  Sparkline,
  StatusStrip,
  cn,
} from '../../ui';
import type { StripTone } from '../../ui';
import { currentMonthIST } from './dashboard-format';

type InsightKey = 'movement' | 'companies' | 'attrition' | 'payroll' | 'desk';

type Load<T> = { status: 'loading' } | { status: 'hidden' } | { status: 'error' } | { status: 'ready'; data: T };

function useOptional<T>(key: string, enabled: boolean, load: () => Promise<T>): Load<T> {
  const [state, setState] = useState<Load<T>>(enabled ? { status: 'loading' } : { status: 'hidden' });
  useEffect(() => {
    if (!enabled) {
      setState({ status: 'hidden' });
      return;
    }
    let cancelled = false;
    setState({ status: 'loading' });
    load()
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', data });
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        const quiet = cause instanceof ApiError && [400, 403, 404].includes(cause.status);
        setState({ status: quiet ? 'hidden' : 'error' });
      });
    return () => {
      cancelled = true;
    };
    // `key` captures every input of `load`.
  }, [key, enabled]);
  return state;
}

interface Company {
  id: number;
  name: string;
}
interface HeadcountRow {
  company: string;
  count: number;
  status: string;
}
interface BoardingRow {
  doj: string | null;
  dol: string | null;
}
interface AttritionRow {
  company: string;
  dol: string | null;
  exitType: string | null;
  tenureBand: string | null;
}
interface RunRow {
  companyId: number;
  month: string;
  status: string;
  grossRupees: number;
  employeeCount: number;
}
interface InboxRow {
  notifiedAt: string;
}
interface ProbationAlerts {
  d30ReviewIds: number[];
  d14ReviewIds: number[];
  d7ReviewIds: number[];
}

const MONTH_LABEL = new Intl.DateTimeFormat('en-IN', { month: 'short', timeZone: 'UTC' });

/** The last 12 calendar months ending with the current IST month, oldest first. */
function lastTwelveMonths(): { key: string; label: string; end: string }[] {
  const [y, m] = currentMonthIST().split('-').map(Number) as [number, number];
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 12 + i, 1));
    const key = d.toISOString().slice(0, 7);
    const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
    return { key, label: MONTH_LABEL.format(d), end };
  });
}

const fmt = (n: number) => n.toLocaleString('en-IN');

function lakh(rupees: number): { value: number; suffix: string } {
  if (rupees >= 1e7) return { value: Math.round(rupees / 1e5) / 100, suffix: ' Cr' };
  return { value: Math.round(rupees / 1e3) / 100, suffix: ' L' };
}

function WidgetSkeleton({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-6 h-12 w-24" />
      <Skeleton className="mt-6 h-20 w-full" />
    </Card>
  );
}

function Legend({ items }: { items: { label: string; swatch: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-1.5">
          <span aria-hidden="true" className={cn('size-2 rounded-full', it.swatch)} />
          {it.label}
        </li>
      ))}
    </ul>
  );
}

export function LeadershipInsights({
  user,
  companyId = null,
  only,
  title = 'Across the group',
  subtitle = 'The last twelve months at a glance, from live reports.',
}: {
  user: SessionUser;
  companyId?: number | null;
  /** Restrict to these widgets (e.g. payroll admins only get payroll + desk). */
  only?: readonly InsightKey[];
  title?: string;
  subtitle?: string;
}) {
  const want = (k: InsightKey) => !only || only.includes(k);
  const months = useMemo(lastTwelveMonths, []);
  const from = `${months[0]?.key ?? ''}-01`;
  const to = months.at(-1)?.end ?? '';
  const needPeople = want('movement') || want('companies') || want('attrition');

  const companies = useOptional<Company[]>(`co`, needPeople || want('payroll'), () =>
    apiFetch<{ companies: Company[] }>('/api/core/companies').then((r) => r.companies),
  );
  const companyName =
    companyId === null || companies.status !== 'ready'
      ? null
      : (companies.data.find((c) => c.id === companyId)?.name ?? null);

  const headcount = useOptional<HeadcountRow[]>(`hc`, needPeople, () =>
    apiFetch<HeadcountRow[]>('/api/reports/r27-headcount'),
  );
  const boarding = useOptional<{ joins: BoardingRow[]; exits: BoardingRow[] }>(
    `b-${String(companyId)}`,
    want('movement'),
    () => apiFetch<{ joins: BoardingRow[]; exits: BoardingRow[] }>(
      `/api/reports/r24-boarding?fromDate=${from}&toDate=${to}${companyId === null ? '' : `&companyId=${String(companyId)}`}`,
    ),
  );
  const attrition = useOptional<AttritionRow[]>(`at`, want('attrition'), () =>
    apiFetch<AttritionRow[]>('/api/reports/r26-attrition'),
  );
  const runs = useOptional<RunRow[]>(`runs`, want('payroll'), () =>
    apiFetch<RunRow[]>('/api/payroll/runs/list', { method: 'POST', body: JSON.stringify({}) }),
  );
  const inbox = useOptional<InboxRow[]>(`inbox`, want('desk'), () => apiFetch<InboxRow[]>('/api/workflows/inbox'));
  const probation = useOptional<ProbationAlerts>(`prob`, want('desk'), () =>
    apiFetch<ProbationAlerts>('/api/lifecycle/probation/alerts'),
  );

  // Rows of r27/r26 carry the company NAME; filter by it when scoped.
  const inScope = (company: string) => companyName === null || company === companyName;
  const headcountRows = headcount.status === 'ready' ? headcount.data.filter((r) => inScope(r.company)) : [];
  const total = headcountRows.reduce((s, r) => s + r.count, 0);
  const link = (path: string, label: string, tone: 'light' | 'dark' = 'light') =>
    canAccessRoute(user, path) ? <CardLink to={path} label={label} tone={tone} /> : undefined;

  const cards: ReactNode[] = [];

  // ── People movement (joiners vs exits + derived headcount line) ──────────
  let movement: ReactNode = null;
  if (want('movement')) {
    if (boarding.status === 'loading' || headcount.status === 'loading' || companies.status === 'loading') {
      movement = <WidgetSkeleton key="m" className="lg:col-span-2" />;
    } else if (boarding.status === 'ready') {
      const bucket = (rows: BoardingRow[], field: 'doj' | 'dol') =>
        months.map((mo) => rows.filter((r) => r[field]?.startsWith(mo.key)).length);
      const joins = bucket(boarding.data.joins, 'doj');
      const exits = bucket(boarding.data.exits, 'dol');
      // Walk back from today's roll: month-end headcount = now − later joins + later exits.
      const line = months.map((_, i) => {
        const laterJ = joins.slice(i + 1).reduce((s, v) => s + v, 0);
        const laterE = exits.slice(i + 1).reduce((s, v) => s + v, 0);
        return headcount.status === 'ready' ? Math.max(0, total - laterJ + laterE) : null;
      });
      const joined = joins.reduce((s, v) => s + v, 0);
      const left = exits.reduce((s, v) => s + v, 0);
      const net = joined - left;
      movement = (
        <Card key="m" className="lg:col-span-2">
          <CardHeader
            headingLevel={3}
            title="People movement"
            subtitle="Joiners and exits, month by month"
            action={link('/reports/r24-boarding', 'Open joiners and exits report')}
          />
          <div className="grid gap-6 md:grid-cols-[minmax(0,14rem)_1fr] md:items-end">
            <div className="space-y-4">
              <div className="flex items-baseline gap-6">
                <div>
                  <p className="text-4xl font-light tabular-nums text-ink sm:text-5xl">
                    <KpiNumber value={joined} />
                  </p>
                  <p className="mt-1 text-xs text-ink-muted">joined</p>
                </div>
                <div>
                  <p className="text-4xl font-light tabular-nums text-ink sm:text-5xl">
                    <KpiNumber value={left} />
                  </p>
                  <p className="mt-1 text-xs text-ink-muted">left</p>
                </div>
              </div>
              <div>
                <Sparkline values={line} label={`Headcount trend, now ${fmt(total)}`} />
                <p className="mt-1 text-xs text-ink-muted">
                  Active today {fmt(total)} · net {net >= 0 ? '+' : '−'}
                  {fmt(Math.abs(net))} in 12 months
                </p>
              </div>
            </div>
            <div>
              <MiniBars
                bars={months.map((mo, i) => ({ label: mo.label, value: joins[i] ?? 0, compare: exits[i] ?? 0 }))}
                seriesLabel="Joined"
                compareLabel="Left"
              />
              <Legend
                items={[
                  { label: 'Joined', swatch: 'bg-accent' },
                  { label: 'Left', swatch: 'bg-hero' },
                ]}
              />
            </div>
          </div>
        </Card>
      );
    }
  }

  // ── Headcount by company (or by nothing when scoped to one) ───────────────
  let byCompany: ReactNode = null;
  if (want('companies') && headcount.status !== 'hidden' && headcount.status !== 'error') {
    if (headcount.status === 'loading') byCompany = <WidgetSkeleton key="c" />;
    else {
      const map = new Map<string, number>();
      for (const r of headcountRows) map.set(r.company, (map.get(r.company) ?? 0) + r.count);
      const rows = [...map.entries()].sort((a, b) => b[1] - a[1]);
      const top = rows.slice(0, 5);
      const rest = rows.slice(5).reduce((s, [, n]) => s + n, 0);
      const list = rest > 0 ? [...top, ['Other companies', rest] as [string, number]] : top;
      const max = Math.max(1, ...list.map(([, n]) => n));
      byCompany = (
        <Card key="c">
          <CardHeader
            headingLevel={3}
            title={companyName ? 'Headcount' : 'Headcount by company'}
            subtitle={`${fmt(total)} on rolls today`}
            action={link('/reports/r27-headcount', 'Open headcount report')}
          />
          {list.length === 0 ? (
            <CalmEmpty icon={<Sparkles />} title="No one on rolls in this scope yet" hint="Headcount appears as soon as employees are added." />
          ) : (
            <ul className="space-y-3">
              {list.map(([name, n]) => (
                <li key={name}>
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="truncate text-ink">{name}</span>
                    <span className="tabular-nums text-ink-muted">{fmt(n)}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div className="u-grow-x h-full rounded-full bg-hero" style={{ width: `${String((n / max) * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      );
    }
  }

  if (movement) cards.push(movement);
  if (byCompany) cards.push(byCompany);

  // ── Attrition ──────────────────────────────────────────────────────────
  const second: ReactNode[] = [];
  if (want('attrition') && attrition.status !== 'hidden' && attrition.status !== 'error') {
    if (attrition.status === 'loading' || headcount.status === 'loading') second.push(<WidgetSkeleton key="a" />);
    else {
      const rows = attrition.data.filter(
        (r) => inScope(r.company) && r.dol !== null && r.dol >= from && r.dol <= to,
      );
      const avg = total + rows.length / 2; // mid-year roll ≈ today + half the leavers
      const rate = avg === 0 ? 0 : Math.round((rows.length / avg) * 1000) / 10;
      const voluntary = rows.filter((r) => (r.exitType ?? '').toLowerCase().startsWith('vol')).length;
      const bands = new Map<string, number>();
      for (const r of rows) bands.set(r.tenureBand ?? 'Unknown', (bands.get(r.tenureBand ?? 'Unknown') ?? 0) + 1);
      const tones: StripTone[] = ['dark', 'hatched', 'outline', 'outline'];
      second.push(
        <Card key="a">
          <CardHeader
            headingLevel={3}
            title="Attrition"
            subtitle="Last 12 months, annualised"
            action={link('/reports/r26-attrition', 'Open attrition report')}
          />
          {rows.length === 0 ? (
            <CalmEmpty icon={<CheckCircle2 />} title="No exits in the last 12 months" hint="Everyone who was here a year ago is still here." />
          ) : (
            <div className="space-y-5">
              <div className="flex items-baseline gap-3">
                <p className="text-5xl font-light tabular-nums text-ink">
                  <KpiNumber value={rate} suffix="%" precision={1} />
                </p>
                <p className="text-xs text-ink-muted">
                  {fmt(rows.length)} {rows.length === 1 ? 'exit' : 'exits'} · {fmt(voluntary)} voluntary
                </p>
              </div>
              <StatusStrip
                label="Exits by tenure"
                segments={[...bands.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 4)
                  .map(([label, value], i) => ({ label, value, tone: tones[i] ?? 'outline' }))}
              />
            </div>
          )}
        </Card>,
      );
    }
  }

  // ── Payroll cost (dark card — the money story) ─────────────────────────
  if (want('payroll') && runs.status !== 'hidden' && runs.status !== 'error') {
    if (runs.status === 'loading') second.push(<WidgetSkeleton key="p" />);
    else {
      const counted = runs.data.filter(
        (r) => (companyId === null || r.companyId === companyId) && r.grossRupees > 0 && r.status !== 'draft',
      );
      const byMonth = months.map((mo) =>
        counted.filter((r) => r.month.startsWith(mo.key)).reduce<number | null>((s, r) => (s ?? 0) + r.grossRupees, null),
      );
      const filled = byMonth.map((v, i) => ({ v, i })).filter((x) => x.v !== null) as { v: number; i: number }[];
      const latest = filled.at(-1);
      const prev = filled.at(-2);
      const delta = latest && prev && prev.v > 0 ? Math.round(((latest.v - prev.v) / prev.v) * 1000) / 10 : null;
      const amount = latest ? lakh(latest.v) : null;
      const latestKey = latest ? (months[latest.i]?.key ?? '') : '';
      const latestHeads = counted
        .filter((r) => r.month.startsWith(latestKey))
        .reduce((sum, r) => sum + r.employeeCount, 0);
      second.push(
        <DarkCard key="p" className="flex flex-col">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-medium text-hero-ink">Payroll cost</h3>
              <p className="mt-0.5 text-xs text-hero-muted">Gross pay of computed runs</p>
            </div>
            {link('/payroll', 'Open payroll runs', 'dark')}
          </div>
          {latest && amount ? (
            <div className="mt-auto space-y-4 pt-6">
              <div>
                <p className="text-5xl font-light tabular-nums text-hero-ink">
                  <KpiNumber value={amount.value} prefix="₹" suffix={amount.suffix} precision={2} />
                </p>
                <p className="mt-1 text-xs text-hero-muted">
                  {months[latest.i]?.label} {months[latest.i]?.key.slice(0, 4)}
                  {delta !== null && ` · ${delta >= 0 ? '+' : '−'}${String(Math.abs(delta))}% on the month before`}
                </p>
              </div>
              {filled.length >= 2 ? (
                <Sparkline values={byMonth} tone="light" label="Monthly gross payroll trend" />
              ) : (
                <dl className="grid grid-cols-2 gap-3">
                  <div className="rounded-tile bg-[color-mix(in_srgb,var(--surface)_9%,transparent)] p-3">
                    <dt className="text-xs text-hero-muted">People paid</dt>
                    <dd className="mt-1 text-2xl font-light tabular-nums text-hero-ink">
                      <KpiNumber value={latestHeads} />
                    </dd>
                  </div>
                  <div className="rounded-tile bg-[color-mix(in_srgb,var(--surface)_9%,transparent)] p-3">
                    <dt className="text-xs text-hero-muted">Average gross</dt>
                    <dd className="mt-1 text-2xl font-light tabular-nums text-hero-ink">
                      <KpiNumber value={latestHeads === 0 ? 0 : Math.round(latest.v / latestHeads)} prefix="₹" />
                    </dd>
                  </div>
                </dl>
              )}
            </div>
          ) : (
            <CalmEmpty
              tone="dark"
              className="mt-auto pt-6"
              icon={<CalendarClock />}
              title="No computed runs in the last 12 months"
              hint="The trend fills in from the first computed run."
            />
          )}
        </DarkCard>,
      );
    }
  }

  // ── On your desk: approvals by age + probation reviews due ────────────────
  if (want('desk') && !(inbox.status === 'hidden' && probation.status === 'hidden')) {
    if (inbox.status === 'loading' || probation.status === 'loading') second.push(<WidgetSkeleton key="d" />);
    else {
      const now = Date.now();
      const ages = inbox.status === 'ready' ? inbox.data.map((r) => (now - new Date(r.notifiedAt).getTime()) / 864e5) : [];
      const buckets = [
        { label: 'Under a day', value: ages.filter((a) => a < 1).length, tone: 'outline' as const },
        { label: '1–3 days', value: ages.filter((a) => a >= 1 && a < 3).length, tone: 'hatched' as const },
        { label: '3–7 days', value: ages.filter((a) => a >= 3 && a < 7).length, tone: 'dark' as const },
        { label: 'Over a week', value: ages.filter((a) => a >= 7).length, tone: 'gold' as const },
      ];
      const p = probation.status === 'ready' ? probation.data : null;
      const due = p ? [p.d7ReviewIds.length, p.d14ReviewIds.length, p.d30ReviewIds.length] : null;
      second.push(
        <Card key="d">
          <CardHeader
            headingLevel={3}
            title="On your desk"
            subtitle="What is waiting, and for how long"
            action={link('/approvals', 'Open approvals inbox')}
          />
          <div className="space-y-6">
            {inbox.status === 'ready' &&
              (ages.length === 0 ? (
                <CalmEmpty icon={<CheckCircle2 />} title="Nothing waiting on you" hint="New approvals land here the moment they are raised." />
              ) : (
                <StatusStrip label={`${fmt(ages.length)} approvals by age`} segments={buckets} />
              ))}
            {due && (
              <div>
                <p className="text-xs text-ink-muted">Probation reviews due</p>
                {due.every((n) => n === 0) ? (
                  <CalmEmpty className="mt-2" icon={<UserMinus />} title="No reviews due in the next 30 days" />
                ) : (
                  <dl className="mt-2 grid grid-cols-3 gap-2">
                    {(['7 days', '14 days', '30 days'] as const).map((l, i) => (
                      <div key={l} className="rounded-tile bg-surface-2 p-3">
                        <dt className="text-xs text-ink-muted">Within {l}</dt>
                        <dd className="mt-1 text-2xl font-light tabular-nums text-ink">
                          <KpiNumber value={due[i] ?? 0} />
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            )}
          </div>
        </Card>,
      );
    }
  }

  if (cards.length === 0 && second.length === 0) return null;
  const cols = second.length >= 3 ? 'lg:grid-cols-3' : second.length === 2 ? 'lg:grid-cols-2' : '';
  return (
    <section aria-labelledby="insights-title" className="space-y-4">
      <div>
        <h2 id="insights-title" className="text-xl font-medium text-ink">
          {title}
        </h2>
        <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p>
      </div>
      {cards.length > 0 && <div className="u-stagger grid gap-6 lg:grid-cols-3">{cards}</div>}
      {second.length > 0 && <div className={cn('u-stagger grid gap-6 md:grid-cols-2', cols)}>{second}</div>}
    </section>
  );
}
