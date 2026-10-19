/** GUIDE-01: every employee can resign, see the case and withdraw it while pending (ESS /my/resignation). */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { LogOut } from 'lucide-react';
import { ApiError, apiFetch } from '../../lib/api';
import { Button, Card, CardHeader, ConfirmModal, Skeleton, StatusBadge, TextField, toast } from '../../ui';

interface Sep { id: number; status: 'pending' | 'approved' | 'withdrawn' | 'rejected' | 'completed'; reason: string; resignationDate: string; requestedLwd: string; approvedLwd: string | null; shortfallDays: number; noticePeriodDays: number }
interface Notice { noticePeriodDays: number; ecode: string; name: string }
const msg = (e: unknown, f: string) => (e instanceof ApiError ? e.message : f);
const TONE: Record<Sep['status'], 'warning' | 'positive' | 'neutral' | 'negative'> = { pending: 'warning', approved: 'positive', completed: 'positive', withdrawn: 'neutral', rejected: 'negative' };
const plusDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

export function MyResignationPage() {
  const [cases, setCases] = useState<Sep[] | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [lwd, setLwd] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [withdrawing, setWithdrawing] = useState<Sep | null>(null);
  const [withdrawReason, setWithdrawReason] = useState('');

  const load = useCallback(() => {
    apiFetch<{ items: Sep[] }>('/api/lifecycle/separations/mine').then((r) => { setCases(r.items); }).catch((e: unknown) => { setCases([]); toast.error(msg(e, 'Could not load your resignation.')); });
  }, []);
  useEffect(() => {
    load();
    apiFetch<Notice>('/api/lifecycle/separations/my-notice').then((n) => { setNotice(n); setLwd((v) => v || plusDays(n.noticePeriodDays)); }).catch(() => undefined);
  }, [load]);

  const shortfall = useMemo(() => {
    if (!notice || !lwd) return 0;
    const days = Math.ceil((new Date(lwd).getTime() - new Date(new Date().toISOString().slice(0, 10)).getTime()) / 86_400_000);
    return Math.max(0, notice.noticePeriodDays - Math.max(0, days));
  }, [lwd, notice]);
  const open = cases?.find((c) => c.status === 'pending' || c.status === 'approved');

  async function submit() {
    setBusy(true);
    try {
      await apiFetch('/api/lifecycle/separations/apply', { method: 'POST', body: JSON.stringify({ reason: reason.trim(), requestedLwd: lwd }) });
      toast.success('Resignation submitted', { description: 'Your manager and HR have been notified.' });
      setReason(''); load();
    } catch (e) { toast.error(msg(e, 'Could not submit.')); } finally { setBusy(false); }
  }
  async function withdraw() {
    if (!withdrawing) return;
    try {
      await apiFetch(`/api/lifecycle/separations/${String(withdrawing.id)}/withdraw`, { method: 'POST', body: JSON.stringify({ reason: withdrawReason.trim() }) });
      toast.success('Resignation withdrawn'); setWithdrawing(null); setWithdrawReason(''); load();
    } catch (e) { toast.error(msg(e, 'Could not withdraw.')); }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-ink-muted">My account</p>
        <h1 className="mt-1 text-4xl font-light tracking-tight text-ink">Resignation</h1>
      </header>
      {cases === null ? <Skeleton className="h-40" /> : open ? (
        <Card>
          <CardHeader title="Your resignation" subtitle={`Submitted ${open.resignationDate}`} />
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-ink-muted">Status</dt><dd><StatusBadge tone={TONE[open.status]}>{open.status}</StatusBadge></dd></div>
            <div><dt className="text-ink-muted">Last working day</dt><dd>{open.approvedLwd ?? `${open.requestedLwd} (requested)`}</dd></div>
            <div><dt className="text-ink-muted">Notice period</dt><dd>{open.noticePeriodDays} days</dd></div>
            <div><dt className="text-ink-muted">Notice shortfall</dt><dd>{open.shortfallDays > 0 ? `${String(open.shortfallDays)} days (recovered in F&F)` : 'None'}</dd></div>
            <div className="sm:col-span-2"><dt className="text-ink-muted">Reason</dt><dd>{open.reason}</dd></div>
          </dl>
          {open.status === 'pending' && <div className="mt-4"><Button variant="ghost" onClick={() => { setWithdrawing(open); }}>Withdraw resignation</Button></div>}
        </Card>
      ) : (
        <Card>
          <CardHeader title="Submit your resignation" subtitle={notice ? `${notice.ecode} · ${notice.name} · notice period ${String(notice.noticePeriodDays)} days` : 'Loading your notice policy…'} />
          <div className="mt-4 grid max-w-xl gap-4">
            <TextField label="Requested last working day *" type="date" value={lwd} min={new Date().toISOString().slice(0, 10)} onChange={(e) => { setLwd(e.target.value); }} />
            <p className={shortfall > 0 ? 'text-sm text-negative-ink' : 'text-sm text-positive-ink'}>
              {shortfall > 0 ? `Notice shortfall of ${String(shortfall)} days; it is recovered in your full & final settlement unless waived.` : 'Full notice served: no recovery.'}
            </p>
            <TextField label="Reason *" value={reason} onChange={(e) => { setReason(e.target.value); }} />
            <div><Button variant="primary" leadingIcon={<LogOut />} disabled={busy || !lwd || reason.trim().length < 3} onClick={() => void submit()}>Submit resignation</Button></div>
          </div>
        </Card>
      )}
      {cases && cases.filter((c) => c !== open).length > 0 && (
        <Card>
          <CardHeader title="Earlier cases" />
          <ul className="mt-3 space-y-2 text-sm">{cases.filter((c) => c !== open).map((c) => <li key={c.id}>{c.resignationDate} · <StatusBadge tone={TONE[c.status]}>{c.status}</StatusBadge> · {c.reason}</li>)}</ul>
        </Card>
      )}
      <ConfirmModal open={withdrawing !== null} onClose={() => { setWithdrawing(null); }} title="Withdraw your resignation?" confirmLabel="Withdraw" onConfirm={() => { if (withdrawReason.trim().length >= 3) void withdraw(); else toast.error('Give a reason (3+ characters).'); }}
        description={<div className="space-y-3"><p>Your manager and HR will be told.</p><TextField label="Reason" value={withdrawReason} onChange={(e) => { setWithdrawReason(e.target.value); }} /></div>} />
    </div>
  );
}
