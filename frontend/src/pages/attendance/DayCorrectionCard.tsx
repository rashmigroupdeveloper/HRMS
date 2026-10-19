/** E2E-007 (RQ-ATT-028/032; O7, O8): manual day correction with a mandatory reason, and recompute. */
import { useState } from 'react';
import { PencilLine, RefreshCw } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { hasPermission, type SessionUser } from '../../lib/session';
import { Button, Card, CardHeader, TextField, toast } from '../../ui';

const STATUSES = [['P', 'Present'], ['A', 'Absent'], ['HD', 'Half day'], ['WO', 'Week off'], ['H', 'Holiday'], ['UAB', 'Unauthorised absence']] as const;

export function DayCorrectionCard({ user }: { user: SessionUser }) {
  const [ecode, setEcode] = useState('');
  const [date, setDate] = useState('');
  const [status, setStatus] = useState<string>('P');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const canRecompute = hasPermission(user, 'admin.integrations');

  const save = async () => {
    setBusy(true);
    try {
      await apiFetch('/api/attendance/days/override', { method: 'PUT', body: JSON.stringify({ ecode: ecode.trim(), date, status, reason: reason.trim() }) });
      toast.success('Day corrected', { description: `${ecode.toUpperCase()} ${date} → ${status}. Audited with your reason.` });
      setReason('');
    } catch (e) { toast.error('Correction refused', { description: e instanceof Error ? e.message : 'Try again.' }); } finally { setBusy(false); }
  };
  const recompute = async (one: boolean) => {
    setBusy(true);
    try {
      const body = one ? { ecode: ecode.trim(), date } : {};
      const r = await apiFetch<{ processed: number; outcome: string | null }>('/api/attendance/recompute', { method: 'POST', body: JSON.stringify(body) });
      toast.success(one ? `Recomputed: ${r.outcome ?? 'no change'}` : `Recomputed ${String(r.processed)} queued day(s)`);
    } catch (e) { toast.error('Recompute failed', { description: e instanceof Error ? e.message : 'Try again.' }); } finally { setBusy(false); }
  };

  return (
    <Card>
      <CardHeader title="Correct a day" subtitle="Overrides the computed status. A reason is mandatory and audited; locked months refuse changes." />
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div className="w-40"><TextField label="E-code *" value={ecode} onChange={(e) => { setEcode(e.target.value); }} /></div>
        <div className="w-44"><TextField label="Date *" type="date" value={date} onChange={(e) => { setDate(e.target.value); }} /></div>
        <label className="text-sm"><span className="mb-1 block text-ink-muted">New status</span>
          <select className="rounded-field border border-line bg-surface px-3 py-2" value={status} onChange={(e) => { setStatus(e.target.value); }}>
            {STATUSES.map(([c, l]) => <option key={c} value={c}>{c} · {l}</option>)}
          </select>
        </label>
        <div className="min-w-64 flex-1"><TextField label="Reason *" value={reason} onChange={(e) => { setReason(e.target.value); }} /></div>
        <Button variant="primary" leadingIcon={<PencilLine />} disabled={busy || !ecode.trim() || !date || reason.trim().length < 5} onClick={() => void save()}>Save correction</Button>
      </div>
      {canRecompute && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" leadingIcon={<RefreshCw />} disabled={busy || !ecode.trim() || !date} onClick={() => void recompute(true)}>Recompute this day</Button>
          <Button size="sm" variant="ghost" leadingIcon={<RefreshCw />} disabled={busy} onClick={() => void recompute(false)}>Recompute all queued days</Button>
        </div>
      )}
    </Card>
  );
}
