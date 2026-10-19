import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { ApiError, apiFetch } from '../../lib/api';
import { hasPermission, type SessionUser } from '../../lib/session';
import { Button, Card, Checkbox, TextField, toast } from '../../ui';
import type { DeviceHealth } from '../home/dashboard-types';
import { DashboardError, DashboardSkeleton } from '../home/DashboardFeedback';
import { DeviceHealthDashboard } from '../home/DeviceHealthDashboard';
import { useDashboardResource } from '../home/useDashboardResource';

interface SyncResult { fetched: number; inserted: number; quarantined: number; unmatched: number; silentDoorsAlerted: string[] }

/** E2E-014 / GUIDE-02: "Sync now" runs one Kent pull cycle; it fails closed (503) when no Kent mode is configured. */
function SyncNow({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const r = await apiFetch<SyncResult>('/api/attendance/sync', { method: 'POST' });
      toast.success('Kent sync finished', { description: `${String(r.fetched)} fetched · ${String(r.inserted)} new · ${String(r.quarantined)} quarantined · ${String(r.unmatched)} unmatched${r.silentDoorsAlerted.length ? ` · silent: ${r.silentDoorsAlerted.join(', ')}` : ''}` });
      onDone();
    } catch (e) {
      toast.error('Sync did not run', { description: e instanceof Error ? e.message : 'Try again.' });
    } finally { setBusy(false); }
  };
  return <Button variant="secondary" leadingIcon={<RefreshCw />} loading={busy} onClick={() => void run()}>Sync now</Button>;
}

/** E2E-031: record biometric enrolment / access card after the employee is enrolled on the Kent device. */
function BiometricEnrolment() {
  const [ecode, setEcode] = useState('');
  const [card, setCard] = useState('');
  const [registered, setRegistered] = useState(true);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const r = await apiFetch<{ ecode: string; biometricRegistered: boolean }>('/api/attendance/biometric-enrolment', {
        method: 'POST', body: JSON.stringify({ ecode: ecode.trim(), registered, ...(card.trim() === '' ? {} : { accessCardNo: card.trim() }) }),
      });
      toast.success(`${r.ecode}: biometric ${r.biometricRegistered ? 'enrolled' : 'cleared'}`);
      setEcode(''); setCard('');
    } catch (e) { toast.error(e instanceof ApiError ? e.message : 'Could not save.'); }
    finally { setBusy(false); }
  };
  return (
    <Card>
      <div className="space-y-3 p-4">
        <h3 className="font-medium">Biometric enrolment</h3>
        <div className="flex flex-wrap items-end gap-3">
          <TextField label="E-code" value={ecode} onChange={(e) => { setEcode(e.target.value); }} />
          <TextField label="Access card no. (optional)" value={card} onChange={(e) => { setCard(e.target.value); }} />
          <Checkbox label="Enrolled on device" checked={registered} onChange={(e) => { setRegistered(e.target.checked); }} />
          <Button loading={busy} disabled={ecode.trim() === ''} onClick={() => void save()}>Save</Button>
        </div>
      </div>
    </Card>
  );
}

/** E2E-032: after a manual punch upload, confirm the doors are complete through a past date (audited). */
function MarkDoorsComplete({ onDone }: { onDone: () => void }) {
  const [through, setThrough] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const r = await apiFetch<{ doors: string[]; recomputed: number }>('/api/attendance/doors/mark-complete', {
        method: 'POST', body: JSON.stringify({ through, reason: reason.trim() }),
      });
      toast.success(`${String(r.doors.length)} door(s) complete through ${through}; ${String(r.recomputed)} day(s) recomputed`);
      setReason(''); onDone();
    } catch (e) { toast.error(e instanceof ApiError ? e.message : 'Could not save.'); }
    finally { setBusy(false); }
  };
  return (
    <Card>
      <div className="space-y-3 p-4">
        <h3 className="font-medium">Mark doors complete (manual upload)</h3>
        <div className="flex flex-wrap items-end gap-3">
          <TextField label="Complete through (YYYY-MM-DD)" value={through} onChange={(e) => { setThrough(e.target.value); }} />
          <TextField label="Reason (min 10 chars)" value={reason} onChange={(e) => { setReason(e.target.value); }} />
          <Button loading={busy} disabled={!/^\d{4}-\d{2}-\d{2}$/.test(through) || reason.trim().length < 10} onClick={() => void save()}>Mark complete</Button>
        </div>
      </div>
    </Card>
  );
}

export function DeviceHealthPage({ user }: { user: SessionUser }) {
  const resource = useDashboardResource<DeviceHealth[]>('/api/attendance/devices');
  if (resource.loading) return <DashboardSkeleton />;
  if (resource.error) return <DashboardError message={resource.error} onRetry={resource.reload} />;
  return (
    <div className="space-y-4">
      {hasPermission(user, 'admin.integrations') && <div className="flex justify-end"><SyncNow onDone={resource.reload} /></div>}
      {resource.data ? <DeviceHealthDashboard data={resource.data} /> : null}
      {hasPermission(user, 'admin.devices') && <MarkDoorsComplete onDone={resource.reload} />}
      {hasPermission(user, 'admin.devices') && <BiometricEnrolment />}
    </div>
  );
}
