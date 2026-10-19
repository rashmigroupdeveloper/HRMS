/** E2E-013 (RQ-WF-004, M11): hand your approvals to a colleague while you are away. */
import { useCallback, useEffect, useState } from 'react';
import { UserRoundCheck } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { Button, Card, CardHeader, TextField, formatDateIN, todayISOIST, toast } from '../../ui';

interface Delegation { id: number; toUserId: number; toEmail: string; fromDate: string; toDate: string }

export function DelegationPanel() {
  const [rows, setRows] = useState<Delegation[]>([]);
  const [to, setTo] = useState('');
  const [from, setFrom] = useState(todayISOIST());
  const [until, setUntil] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => { apiFetch<Delegation[]>('/api/workflows/delegations').then(setRows).catch(() => { setRows([]); }); }, []);
  useEffect(load, [load]);
  const save = async () => {
    setBusy(true);
    try {
      await apiFetch('/api/workflows/delegations', { method: 'PUT', body: JSON.stringify({ to: to.trim(), fromDate: from, toDate: until }) });
      toast.success('Delegation set', { description: `${to.trim()} decides your approvals ${formatDateIN(from)} – ${formatDateIN(until)}.` });
      setTo(''); setUntil(''); load();
    } catch (e) { toast.error('Could not delegate', { description: e instanceof Error ? e.message : 'Try again.' }); } finally { setBusy(false); }
  };
  const end = async (d: Delegation) => {
    try { await apiFetch(`/api/workflows/delegations/${String(d.id)}`, { method: 'DELETE' }); toast.success('Delegation ended'); load(); }
    catch (e) { toast.error('Could not end it', { description: e instanceof Error ? e.message : 'Try again.' }); }
  };
  return (
    <Card>
      <CardHeader title="Out of office" subtitle="While delegated, new and waiting approvals also reach your delegate. Everything they decide is audited in their name on your behalf." />
      {rows.length > 0 && (
        <ul className="mt-3 space-y-2 text-sm" aria-label="Your delegations">
          {rows.map((d) => (
            <li key={d.id} className="flex items-center justify-between rounded-row bg-surface-2 px-4 py-2">
              <span><UserRoundCheck className="mr-2 inline size-4" />{d.toEmail} · {formatDateIN(d.fromDate)} – {formatDateIN(d.toDate)}</span>
              <Button size="sm" variant="ghost" onClick={() => void end(d)}>End now</Button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div className="w-64"><TextField label="Delegate to (work email or e-code)" value={to} onChange={(e) => { setTo(e.target.value); }} /></div>
        <div className="w-40"><TextField label="From" type="date" value={from} onChange={(e) => { setFrom(e.target.value); }} /></div>
        <div className="w-40"><TextField label="Until" type="date" value={until} min={from} onChange={(e) => { setUntil(e.target.value); }} /></div>
        <Button variant="secondary" disabled={busy || to.trim().length < 2 || !until} onClick={() => void save()}>Delegate</Button>
      </div>
    </Card>
  );
}
