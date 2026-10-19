/** D4/CORE-10: named account selection and explicit verification, never silent email/ID joins. */
import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { Button, Card, Select, TextField } from '../../ui';
interface LocalAccount {
  userId: number;
  email: string;
  ecode: string | null;
  name: string | null;
}
interface ExternalAccount {
  subject: string;
  email: string;
  employeeCode: string | null;
  name: string;
}
interface LinkRow {
  id: number;
  userId: number;
  email: string;
  clientId: string;
  externalSubject: string;
  active: boolean;
}
export function ConnectedAccountsPanel() {
  const [localQuery, setLocalQuery] = useState('');
  const [externalQuery, setExternalQuery] = useState('');
  const [local, setLocal] = useState<LocalAccount[]>([]);
  const [external, setExternal] = useState<ExternalAccount[]>([]);
  const [userId, setUserId] = useState('');
  const [subject, setSubject] = useState('');
  const [reason, setReason] = useState('');
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  async function reload() {
    const result = await apiFetch<{ links: LinkRow[] }>('/api/sso/links');
    setLinks(result.links);
  }
  useEffect(() => {
    let active = true;
    void apiFetch<{ links: LinkRow[] }>('/api/sso/links')
      .then((result) => {
        if (active) setLinks(result.links);
      })
      .catch((cause: unknown) => {
        if (active)
          setError(cause instanceof Error ? cause.message : 'Could not load account links');
      });
    return () => {
      active = false;
    };
  }, []);
  async function search(which: 'local' | 'external') {
    setBusy(true);
    setError(null);
    try {
      if (which === 'local') {
        setUserId('');
        const result = await apiFetch<LocalAccount[]>(
          `/api/sso/local-accounts?q=${encodeURIComponent(localQuery.trim())}`,
        );
        setLocal(result);
      } else {
        setSubject('');
        const result = await apiFetch<{ accounts: ExternalAccount[] }>(
          `/api/sso/external-accounts?q=${encodeURIComponent(externalQuery.trim())}`,
        );
        setExternal(result.accounts);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Account search failed');
    } finally {
      setBusy(false);
    }
  }
  async function mutate(link?: LinkRow) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (link)
        await apiFetch(`/api/sso/links/${String(link.id)}/unlink`, {
          method: 'POST',
          body: JSON.stringify({ reason }),
        });
      else
        await apiFetch('/api/sso/links', {
          method: 'POST',
          body: JSON.stringify({ userId: Number(userId), externalSubject: subject, reason }),
        });
      setMessage(
        link
          ? 'Account unlinked. Earlier ATS sessions cannot be revived by relinking.'
          : 'Accounts verified and linked. Each app keeps its own permissions.',
      );
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update the account link');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="space-y-5 p-6">
      <div>
        <h2 className="text-xl font-semibold text-balance">Connected ATS accounts</h2>
        <p className="mt-2 text-sm text-ink-muted text-pretty">
          Select the same person in both systems. Active email and employee-code checks run on the
          server. No role is copied between applications.
        </p>
      </div>
      {error && (
        <p role="alert" className="text-sm text-negative-ink">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm text-positive-ink">
          {message}
        </p>
      )}
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-3">
          <TextField
            label="Find HRMS account"
            value={localQuery}
            onChange={(e) => {
              setLocalQuery(e.target.value);
              setUserId('');
            }}
          />
          <Button
            size="sm"
            variant="secondary"
            disabled={busy || localQuery.trim().length < 2}
            onClick={() => {
              void search('local');
            }}
          >
            Search HRMS
          </Button>
          <Select
            label="HRMS person"
            value={userId}
            onChange={setUserId}
            disabled={busy}
            options={local.map((u) => ({
              value: String(u.userId),
              label: `${u.name ?? u.email} · ${u.ecode ?? 'No employee profile'} · ${u.email}`,
            }))}
          />
        </div>
        <div className="space-y-3">
          <TextField
            label="Find ATS account"
            value={externalQuery}
            onChange={(e) => {
              setExternalQuery(e.target.value);
              setSubject('');
            }}
          />
          <Button
            size="sm"
            variant="secondary"
            disabled={busy || externalQuery.trim().length < 2}
            onClick={() => {
              void search('external');
            }}
          >
            Search ATS
          </Button>
          <Select
            label="ATS person"
            value={subject}
            onChange={setSubject}
            disabled={busy}
            options={external.map((u) => ({
              value: u.subject,
              label: `${u.name} · ${u.employeeCode ?? 'No employee code'} · ${u.email}`,
            }))}
          />
        </div>
      </div>
      <TextField
        label="Verification / change reason"
        value={reason}
        onChange={(e) => {
          setReason(e.target.value);
        }}
      />
      <Button
        disabled={busy || !userId || !subject || !reason.trim()}
        onClick={() => {
          void mutate();
        }}
      >
        {busy ? 'Working…' : 'Verify and link accounts'}
      </Button>
      <ul className="space-y-3" aria-label="Existing connected accounts">
        {links.map((link) => (
          <li
            key={link.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-2 p-3"
          >
            <div>
              <p className="text-sm font-medium">{link.email}</p>
              <p className="text-xs text-ink-muted">
                {link.clientId} · ATS account {link.externalSubject} ·{' '}
                {link.active ? 'Linked' : 'Unlinked'}
              </p>
            </div>
            {link.active && (
              <Button
                size="sm"
                variant="secondary"
                disabled={busy || !reason.trim()}
                onClick={() => {
                  void mutate(link);
                }}
              >
                Unlink
              </Button>
            )}
          </li>
        ))}
      </ul>
      {links.length === 50 && (
        <p className="text-xs text-ink-muted">Showing the latest 50 links.</p>
      )}
    </Card>
  );
}
