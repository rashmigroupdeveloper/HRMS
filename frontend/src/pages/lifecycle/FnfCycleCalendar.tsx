/**
 * SOW 10.2: two settlement cycles a month, and whether each case is inside
 * the three-working-day turnaround.
 */
import { useEffect, useState } from 'react';
import { Card, CardHeader, StatusBadge, type StatusTone } from '../../ui';
import { apiFetch } from '../../lib/api';
import { todayISOIST } from '../../lib/date';

interface Calendar {
  month: string;
  cycles: { cycle: 1 | 2; opens: string; closes: string }[];
  settlements: {
    id: number;
    ecode: string;
    name: string;
    status: string;
    lastWorkingDay: string;
    tatDue: string | null;
    cycle: 1 | 2;
    tat: 'on_track' | 'due_today' | 'overdue' | 'closed';
  }[];
}

const TONE: Record<Calendar['settlements'][number]['tat'], StatusTone> = {
  on_track: 'positive',
  due_today: 'warning',
  overdue: 'negative',
  closed: 'neutral',
};

export function FnfCycleCalendar() {
  const month = todayISOIST().slice(0, 7);
  const [data, setData] = useState<Calendar | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void apiFetch<Calendar>(`/api/lifecycle/fnf/calendar?month=${month}`)
      .then((rows) => { if (!cancelled) setData(rows); })
      .catch((cause: unknown) => { if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not load the F&F calendar'); });
    return () => { cancelled = true; };
  }, [month]);

  return (
    <Card>
      <CardHeader title="Settlement cycles" subtitle="Two cycles each month. A case is overdue when today is past its three-working-day due date." />
      {error && <p className="mt-3 text-sm text-ink" role="status">{error}</p>}
      {data && (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            {data.cycles.map((cycle) => (
              <div key={cycle.cycle} className="rounded-row bg-surface-2 px-4 py-3 text-sm">
                <p className="font-semibold text-ink">Cycle {cycle.cycle}</p>
                <p className="text-ink-muted">{cycle.opens} – {cycle.closes}</p>
              </div>
            ))}
          </div>
          {data.settlements.length === 0 ? (
            <p className="text-sm text-ink-muted">No settlements fall in {data.month}.</p>
          ) : (
            <ul className="space-y-2">
              {data.settlements.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="text-ink">{row.name} · {row.ecode} · cycle {row.cycle} · due {row.tatDue ?? '—'}</span>
                  <StatusBadge tone={TONE[row.tat]}>{row.tat.replace('_', ' ')}</StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
