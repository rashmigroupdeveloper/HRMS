/** Live sessions (handover item 6): IT admin sees who is signed in where and can force a logout. */
import { useCallback, useEffect, useState } from 'react';
import { ApiError, apiFetch } from '../../lib/api';
import { Button, Card, ConfirmModal, DataTable, Pill, toast } from '../../ui';
import type { Column } from '../../ui';

interface Session {
  id: number; userId: number; email: string; name: string | null; ip: string | null; userAgent: string | null;
  createdAt: string; lastSeenAt: string; expiresAt: string; current: boolean;
}

const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export function SessionsPanel() {
  const [rows, setRows] = useState<Session[] | null>(null);
  const [target, setTarget] = useState<{ kind: 'one' | 'user'; s: Session } | null>(null);

  const load = useCallback(() => {
    apiFetch<Session[]>('/api/auth/sessions').then(setRows)
      .catch((e: unknown) => { setRows([]); toast.error(e instanceof ApiError ? e.message : 'Could not load sessions.'); });
  }, []);
  useEffect(load, [load]);

  const revoke = async () => {
    if (!target) return;
    try {
      const path = target.kind === 'one' ? `/api/auth/sessions/${String(target.s.id)}/revoke` : `/api/auth/users/${String(target.s.userId)}/sessions/revoke`;
      const r = await apiFetch<{ revoked: number }>(path, { method: 'POST', body: '{}' });
      toast.success(`${String(r.revoked)} session(s) signed out.`);
      load();
    } catch (e: unknown) {
      toast.error(e instanceof ApiError ? e.message : 'Could not sign out.');
    } finally { setTarget(null); }
  };

  const columns: Column<Session>[] = [
    { key: 'who', header: 'Account', label: 'Account', render: (s) => (<span>{s.name ?? s.email}{s.current && <> <Pill accent>This session</Pill></>}</span>), sortValue: (s) => s.email },
    { key: 'ip', header: 'IP', render: (s) => s.ip ?? '—', width: '130px' },
    { key: 'ua', header: 'Device', render: (s) => s.userAgent ?? '—' },
    { key: 'seen', header: 'Last active (IST)', label: 'Last active', render: (s) => when(s.lastSeenAt), sortValue: (s) => s.lastSeenAt, width: '160px' },
    { key: 'act', header: '', width: '220px', render: (s) => s.current ? null : (
      <div className="flex gap-1">
        <Button size="sm" variant="ghost" onClick={() => { setTarget({ kind: 'one', s }); }}>Sign out</Button>
        <Button size="sm" variant="ghost" onClick={() => { setTarget({ kind: 'user', s }); }}>All devices</Button>
      </div>) },
  ];

  return (
    <Card>
      <DataTable tableId="admin-sessions" columns={columns} rows={rows ?? []} rowKey={(s) => String(s.id)} searchable caption="Live sessions"
        empty={rows === null ? 'Loading…' : 'No live sessions.'} />
      <ConfirmModal open={target !== null} onClose={() => { setTarget(null); }} onConfirm={() => void revoke()} danger
        title={target?.kind === 'user' ? `Sign ${target.s.email} out everywhere?` : 'Sign this session out?'}
        description="They will need to sign in again on their next action. Audited." confirmLabel="Sign out" />
    </Card>
  );
}
