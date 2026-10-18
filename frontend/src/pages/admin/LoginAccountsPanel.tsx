/** E2E-006 (RQ-NFR-003): login lifecycle for it_admin — create, unlock, temporary password, activate/deactivate. */
import { useCallback, useEffect, useState } from 'react';
import { KeyRound, Lock, Power, UserPlus } from 'lucide-react';
import { ApiError, apiFetch } from '../../lib/api';
import { Button, Card, ConfirmModal, DataTable, Drawer, StatusBadge, TextField, toast, type Column } from '../../ui';

interface Account { id: number; email: string; isActive: boolean; locked: boolean; failedAttempts: number; lastLoginAt: string | null; mustChangePassword: boolean; ecode: string | null; name: string | null }
const msg = (e: unknown, f: string) => (e instanceof ApiError ? e.message : f);

export function LoginAccountsPanel() {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Account[]>([]);
  const [temp, setTemp] = useState<{ email: string; password: string } | null>(null);
  const [confirm, setConfirm] = useState<{ row: Account; action: 'reset' | 'active' } | null>(null);
  const [create, setCreate] = useState<{ email: string; ecode: string } | null>(null);

  const load = useCallback(() => {
    apiFetch<Account[]>(`/api/auth/users?limit=100${q ? `&q=${encodeURIComponent(q)}` : ''}`).then(setRows).catch((e: unknown) => { toast.error(msg(e, 'Could not load accounts.')); });
  }, [q]);
  useEffect(() => { const t = setTimeout(load, 250); return () => { clearTimeout(t); }; }, [load]);

  async function act(row: Account, action: 'unlock' | 'reset' | 'active') {
    try {
      if (action === 'unlock') { await apiFetch(`/api/auth/users/${String(row.id)}/unlock`, { method: 'POST', body: '{}' }); toast.success('Account unlocked.'); }
      if (action === 'active') { await apiFetch(`/api/auth/users/${String(row.id)}/active`, { method: 'POST', body: JSON.stringify({ active: !row.isActive }) }); toast.success(row.isActive ? 'Deactivated; sessions revoked.' : 'Activated.'); }
      if (action === 'reset') { const r = await apiFetch<{ temporaryPassword: string }>(`/api/auth/users/${String(row.id)}/reset-password`, { method: 'POST', body: '{}' }); setTemp({ email: row.email, password: r.temporaryPassword }); }
      load();
    } catch (e) { toast.error(msg(e, 'Action failed.')); }
  }
  async function createLogin() {
    if (!create) return;
    try {
      const r = await apiFetch<{ temporaryPassword: string }>('/api/auth/users', { method: 'POST', body: JSON.stringify({ email: create.email.trim(), ...(create.ecode.trim() ? { ecode: create.ecode.trim() } : {}) }) });
      setTemp({ email: create.email.trim(), password: r.temporaryPassword }); setCreate(null); load();
    } catch (e) { toast.error(msg(e, 'Could not create the login.')); }
  }

  const cols: Column<Account>[] = [
    { key: 'who', header: 'Account', render: (r) => <div><div className="font-medium">{r.name ?? r.email}</div><div className="text-xs text-ink-muted">{[r.ecode, r.email].filter(Boolean).join(' · ')}</div></div>, sortValue: (r) => r.email },
    { key: 'state', header: 'State', render: (r) => <span className="flex flex-wrap gap-1">{!r.isActive && <StatusBadge tone="neutral">Inactive</StatusBadge>}{r.locked && <StatusBadge tone="negative">Locked</StatusBadge>}{r.mustChangePassword && <StatusBadge tone="warning">Temp password</StatusBadge>}{r.isActive && !r.locked && !r.mustChangePassword && <StatusBadge tone="positive">Active</StatusBadge>}</span>, exportValue: (r) => (r.isActive ? (r.locked ? 'locked' : 'active') : 'inactive') },
    { key: 'last', header: 'Last login', render: (r) => (r.lastLoginAt ? new Date(r.lastLoginAt).toLocaleString('en-IN') : '—') },
    { key: 'x', header: '', label: 'Actions', render: (r) => (
      <span className="flex flex-wrap gap-1">
        {r.locked && <Button size="sm" variant="ghost" leadingIcon={<Lock />} onClick={() => void act(r, 'unlock')}>Unlock</Button>}
        <Button size="sm" variant="ghost" leadingIcon={<KeyRound />} onClick={() => { setConfirm({ row: r, action: 'reset' }); }}>Reset password</Button>
        <Button size="sm" variant="ghost" leadingIcon={<Power />} onClick={() => { setConfirm({ row: r, action: 'active' }); }}>{r.isActive ? 'Deactivate' : 'Activate'}</Button>
      </span>
    ) },
  ];

  return (
    <Card>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="w-72"><TextField label="Find an account" value={q} onChange={(e) => { setQ(e.target.value); }} /></div>
        <Button variant="primary" leadingIcon={<UserPlus />} onClick={() => { setCreate({ email: '', ecode: '' }); }}>Create login</Button>
      </div>
      <div className="mt-4"><DataTable tableId="login-accounts" columns={cols} rows={rows} rowKey={(r) => String(r.id)} exportName="login-accounts" caption="Login accounts" empty="No accounts match." /></div>
      <ConfirmModal open={confirm !== null} onClose={() => { setConfirm(null); }} danger={confirm?.action === 'active' && confirm.row.isActive}
        title={confirm?.action === 'reset' ? 'Issue a temporary password?' : confirm?.row.isActive ? 'Deactivate this login?' : 'Activate this login?'}
        description={confirm ? `${confirm.row.email}. ${confirm.action === 'reset' ? 'They must change it at next sign-in.' : confirm.row.isActive ? 'All their sessions end now.' : ''}` : ''}
        confirmLabel="Confirm" onConfirm={() => { if (confirm) void act(confirm.row, confirm.action); setConfirm(null); }} />
      <Drawer open={temp !== null} onClose={() => { setTemp(null); }} title="Temporary password">
        <p className="text-sm">Give this to <b>{temp?.email}</b> through a trusted channel. It is shown once.</p>
        <code className="mt-3 block rounded bg-surface-2 p-3 font-mono text-lg" data-testid="temp-password">{temp?.password}</code>
      </Drawer>
      <Drawer open={create !== null} onClose={() => { setCreate(null); }} title="Create login"
        footer={<div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => { setCreate(null); }}>Cancel</Button><Button variant="primary" disabled={!create?.email.includes('@')} onClick={() => void createLogin()}>Create</Button></div>}>
        <div className="grid gap-4">
          <TextField label="Email *" type="email" value={create?.email ?? ''} onChange={(e) => { const v = e.target.value; setCreate((p) => (p ? { ...p, email: v } : p)); }} />
          <TextField label="Employee e-code (optional)" value={create?.ecode ?? ''} onChange={(e) => { const v = e.target.value; setCreate((p) => (p ? { ...p, ecode: v } : p)); }} />
        </div>
      </Drawer>
    </Card>
  );
}
