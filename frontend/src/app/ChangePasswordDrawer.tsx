import { useState } from 'react';
import { apiFetch } from '../lib/api';
import { Button, Drawer, TextField, toast } from '../ui';

/** AUTH-05: server policy stays authoritative; passwords exist only while the drawer is mounted. */
export function ChangePasswordDrawer({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save() {
    if (!current || !next || next !== confirm || busy) return;
    setBusy(true); setError(null);
    try {
      await apiFetch('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword: current, newPassword: next }) });
      toast.success('Password changed', { description: 'Your other sessions have been signed out.' });
      onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not change your password.'); }
    finally { setBusy(false); }
  }
  return <Drawer open onClose={() => { if (!busy) onClose(); }} title="Change password"
    footer={<Button loading={busy} disabled={!current || !next || next !== confirm} onClick={() => void save()}>Save password</Button>}>
    <form className="space-y-4" onSubmit={event => { event.preventDefault(); void save(); }}>
      <TextField label="Current password" type="password" autoComplete="current-password" value={current} onChange={event => { setCurrent(event.target.value); }} />
      <TextField label="New password" type="password" autoComplete="new-password" maxLength={128} value={next} onChange={event => { setNext(event.target.value); }} hint="Your organization's current password policy is checked when you save." />
      <TextField label="Confirm new password" type="password" autoComplete="new-password" maxLength={128} value={confirm} onChange={event => { setConfirm(event.target.value); }} error={confirm && next !== confirm ? 'New passwords must match.' : undefined} />
      {error && <p role="alert" className="text-sm text-negative-ink">{error}</p>}
    </form>
  </Drawer>;
}
