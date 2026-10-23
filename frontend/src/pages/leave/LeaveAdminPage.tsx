import { useRef, useState } from 'react';
import { CalendarSync, History, SlidersHorizontal } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { Button, Card, CardHeader, DarkCard, DataTable, Drawer, StatusBadge, TextField, toast, type Column } from '../../ui';
import { useCallback, useEffect } from 'react';
import { useDashboardResource } from '../home/useDashboardResource';
import { DashboardError, DashboardSkeleton } from '../home/DashboardFeedback';
import { LeaveTypesPanel, type LeaveCatalog } from './LeaveTypesPanel';

export function LeaveAdminPage() {
  const catalog = useDashboardResource<LeaveCatalog>('/api/leave/admin/types');
  const [registerVersion, setRegisterVersion] = useState(0);
  const refresh = () => { catalog.reload(); setRegisterVersion(value => value + 1); };
  const [loading, setLoading] = useState<'accrual' | 'lapse' | null>(null);
  const run = async (kind: 'accrual' | 'lapse') => {
    setLoading(kind);
    try {
      const result = await apiFetch<Record<string, number>>(
        kind === 'accrual' ? '/api/leave/accrual/run' : '/api/leave/comp-off/expire',
        { method: 'POST' },
      );
      refresh();
      toast.success(kind === 'accrual' ? 'Accrual run completed' : 'Expired comp-off lapsed', {
        description: Object.entries(result)
          .map(([key, value]) => `${key}: ${String(value)}`)
          .join(' · '),
      });
    } catch (cause) {
      toast.error('Operation failed', {
        description: cause instanceof Error ? cause.message : 'Try again.',
      });
    } finally {
      setLoading(null);
    }
  };
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-ink-muted">Leave administration</p>
        <h1 className="mt-1 text-4xl font-light tracking-tight text-ink">
          Leave operations
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Who is on leave, every balance, and audited corrections for the employees in your scope.
        </p>
      </header>
      <DarkCard>
        <p className="text-sm font-medium text-hero-muted">
          Ledger discipline
        </p>
        <h2 className="mt-3 text-3xl font-light">Every balance has a full history</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-hero-muted">
          Accruals, adjustments, leave taken and comp-off lapses are recorded as entries that never
          change. A balance is simply their total.
        </p>
      </DarkCard>
      {catalog.data?.canRunJobs && <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader
            title="Monthly accrual"
            subtitle="Runs automatically on the first day at 00:05 IST"
          />
          <Button
            variant="primary"
            loading={loading === 'accrual'}
            leadingIcon={<CalendarSync className="size-4" />}
            onClick={() => void run('accrual')}
          >
            Run accrual now
          </Button>
        </Card>
        <Card>
          <CardHeader
            title="Comp-off expiry"
            subtitle="Lapse credits whose configured expiry has passed"
          />
          <Button
            loading={loading === 'lapse'}
            leadingIcon={<History className="size-4" />}
            onClick={() => void run('lapse')}
          >
            Run expiry sweep
          </Button>
        </Card>
      </div>}
      {catalog.loading ? <DashboardSkeleton /> : catalog.error ? <DashboardError message={catalog.error} onRetry={catalog.reload} />
        : catalog.data ? <LeaveTypesPanel catalog={catalog.data} onSaved={refresh} /> : null}
      <LeaveRegister version={registerVersion} />
    </div>
  );
}

interface RegisterRow { employeeId: number; ecode: string; name: string; balances: Record<string, number>; onLeave: { type: string; fromDate: string; toDate: string; status: string } | null }
interface Register { onDate: string; types: { code: string; name: string }[]; rows: RegisterRow[] }

/** E2E-039: the HR leave register; E2E-012/GUIDE-02: balance adjustment with a mandatory note. */
function LeaveRegister({ version }: { version: number }) {
  const [q, setQ] = useState('');
  const [onDate, setOnDate] = useState('');
  const [onlyOnLeave, setOnlyOnLeave] = useState(false);
  const [data, setData] = useState<Register | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);
  const [adjust, setAdjust] = useState<{ row: RegisterRow; type: string; delta: string; note: string } | null>(null);
  const load = useCallback(() => {
    const id = ++requestVersion.current;
    setLoading(true); setError(null);
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (onDate) p.set('onDate', onDate);
    if (onlyOnLeave) p.set('onLeaveOnly', 'true');
    void apiFetch<Register>(`/api/leave/register?${p.toString()}`).then(result => { if (id === requestVersion.current) setData(result); }).catch((cause: unknown) => { if (id === requestVersion.current) setError(cause instanceof Error ? cause.message : 'Could not load the register'); }).finally(() => { if (id === requestVersion.current) setLoading(false); });
  }, [q, onDate, onlyOnLeave, version]);
  useEffect(() => { const t = setTimeout(load, 250); return () => { clearTimeout(t); ++requestVersion.current; }; }, [load]);
  const types = data?.types ?? [];
  const cols: Column<RegisterRow>[] = [
    { key: 'emp', header: 'Employee', render: (r) => <div><div className="font-medium">{r.name}</div><div className="text-xs text-ink-muted">{r.ecode}</div></div>, sortValue: (r) => r.ecode, exportValue: (r) => `${r.ecode} ${r.name}` },
    { key: 'today', header: data ? `On ${data.onDate}` : 'Today', render: (r) => r.onLeave ? <StatusBadge tone={r.onLeave.status === 'approved' ? 'warning' : 'neutral'}>{r.onLeave.type} {r.onLeave.status === 'pending' ? '(pending)' : ''}</StatusBadge> : <span className="text-ink-subtle">—</span>, exportValue: (r) => r.onLeave ? `${r.onLeave.type} ${r.onLeave.status}` : '' },
    ...types.map((t): Column<RegisterRow> => ({ key: t.code, header: t.code, label: t.name, render: (r) => <span className="tabular-nums">{r.balances[t.code] ?? 0}</span>, sortValue: (r) => r.balances[t.code] ?? 0, exportValue: (r) => String(r.balances[t.code] ?? 0) })),
    { key: 'x', header: '', label: 'Actions', render: (r) => <Button size="sm" variant="ghost" leadingIcon={<SlidersHorizontal />} onClick={() => { setAdjust({ row: r, type: types[0]?.code ?? '', delta: '', note: '' }); }}>Adjust</Button> },
  ];
  const save = async () => {
    if (!adjust) return;
    try {
      await apiFetch('/api/leave/adjustments', { method: 'POST', body: JSON.stringify({ employeeId: adjust.row.employeeId, leaveType: adjust.type, delta: Number(adjust.delta), note: adjust.note.trim() }) });
      toast.success('Balance adjusted', { description: `${adjust.row.ecode} ${adjust.type} ${Number(adjust.delta) > 0 ? '+' : ''}${adjust.delta}. Audited.` });
      setAdjust(null); load();
    } catch (e) { toast.error('Adjustment failed', { description: e instanceof Error ? e.message : 'Try again.' }); }
  };
  return (
    <Card>
      <CardHeader title="Leave register" subtitle="Balances are the sum of the ledger; on-leave reflects approved and pending applications." />
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div className="w-64"><TextField label="Find an employee" value={q} onChange={(e) => { setQ(e.target.value); }} /></div>
        <div className="w-44"><TextField label="On date" type="date" value={onDate} onChange={(e) => { setOnDate(e.target.value); }} /></div>
        <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" checked={onlyOnLeave} onChange={(e) => { setOnlyOnLeave(e.target.checked); }} /> Only people on leave</label>
      </div>
      {error && <DashboardError message={error} onRetry={load} />}
      {loading ? <DashboardSkeleton /> : !error && <div className="mt-4"><DataTable tableId="leave-register" columns={cols} rows={data?.rows ?? []} rowKey={(r) => String(r.employeeId)} exportName="leave-register" caption="Leave register" empty="No employees match." /></div>}
      <Drawer open={adjust !== null} onClose={() => { setAdjust(null); }} title={adjust ? `Adjust balance · ${adjust.row.ecode}` : ''}
        footer={<div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => { setAdjust(null); }}>Cancel</Button><Button variant="primary" disabled={!adjust || !Number(adjust.delta) || adjust.note.trim().length < 5} onClick={() => void save()}>Save adjustment</Button></div>}>
        {adjust && (
          <div className="grid gap-4">
            <label className="text-sm"><span className="mb-1 block text-ink-muted">Leave type</span>
              <select className="w-full rounded-field border border-line bg-surface px-3 py-2" value={adjust.type} onChange={(e) => { const v = e.target.value; setAdjust((a) => (a ? { ...a, type: v } : a)); }}>
                {types.map((t) => <option key={t.code} value={t.code}>{t.code} · {t.name} (now {adjust.row.balances[t.code] ?? 0})</option>)}
              </select>
            </label>
            <TextField label="Days (+ credit / − debit) *" type="number" value={adjust.delta} onChange={(e) => { const v = e.target.value; setAdjust((a) => (a ? { ...a, delta: v } : a)); }} />
            <TextField label="Note (why) *" value={adjust.note} onChange={(e) => { const v = e.target.value; setAdjust((a) => (a ? { ...a, note: v } : a)); }} />
          </div>
        )}
      </Drawer>
    </Card>
  );
}
