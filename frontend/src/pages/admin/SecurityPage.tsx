/**
 * `/admin/security` — the IT half of Stage 5.2 (SEC-05/10 + MFA operations).
 *
 * Scope discipline worth stating: this console governs how people
 * AUTHENTICATE, never what HR data they may see. `it_admin` holds
 * `sec.session.revoke` and `sec.mfa.manage` and still cannot read a salary —
 * the separation of duties in docs/08 §2, enforced at the field.
 *
 * Resetting someone's second factor is the one genuinely dangerous action
 * here (it is the account-takeover path an attacker would want), so it is
 * step-up gated and audited, and the UI says so before you click.
 */
import { useCallback, useEffect, useState } from 'react';
import { Eye, ShieldAlert, ShieldCheck, Users } from 'lucide-react';
import { ApiError, StepUpRequiredError, apiFetch } from '../../lib/api';
import { isSteppedUp, type SessionUser } from '../../lib/session';
import {
  Button,
  Card,
  CardHeader,
  DataTable,
  EmptyState,
  PageHeader,
  Select,
  Skeleton,
  StatusBadge,
  TextField,
  toast,
} from '../../ui';
import type { Column } from '../../ui';
import { StepUpDialog, type StepUpRequest } from '../../app/StepUpDialog';

type Tab = 'mfa' | 'access' | 'sessions';

interface CoverageRow {
  userId: number;
  email: string;
  roles: string[];
  enrolled: boolean;
}
interface AccessRow {
  occurredAt: string;
  actorName: string | null;
  actorEmail: string;
  subjectEmployeeId: number | null;
  resource: string;
  fieldClass: string;
  purpose: string;
  recordCount: number;
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'mfa', label: 'Two-step coverage' },
  { id: 'access', label: 'Access log' },
  { id: 'sessions', label: 'Sessions' },
];

interface SecurityPageProps {
  user: SessionUser;
  onSessionChanged: () => void;
}

export function SecurityPage({ user, onSessionChanged }: SecurityPageProps) {
  const [tab, setTab] = useState<Tab>('mfa');
  const [stepUp, setStepUp] = useState<StepUpRequest | null>(null);
  const elevated = isSteppedUp(user);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Master control · security"
        title="Sign-in & access"
        description="How people authenticate — second factors, live sessions, and every read of someone's sensitive details. No HR data lives here."
        actions={
          elevated ? (
            // Says why the next dangerous action will NOT re-prompt. Silent
            // elevation is the thing that makes people distrust a prompt.
            <StatusBadge tone="info">Confirmed — you won&rsquo;t be asked again for a few minutes</StatusBadge>
          ) : undefined
        }
      />

      <div
        className="flex w-full gap-1 overflow-x-auto rounded-full bg-surface-2 p-1"
        role="tablist"
        aria-label="Security sections"
      >
        {TABS.map((entry) => (
          <Button
            key={entry.id}
            size="sm"
            role="tab"
            aria-selected={tab === entry.id}
            variant={tab === entry.id ? 'primary' : 'ghost'}
            onClick={() => {
              setTab(entry.id);
            }}
          >
            {entry.label}
          </Button>
        ))}
      </div>

      <div className="u-enter">
        {tab === 'mfa' ? (
          <MfaCoverage onStepUp={setStepUp} />
        ) : tab === 'access' ? (
          <AccessLog />
        ) : (
          <SessionsAdmin />
        )}
      </div>

      <StepUpDialog
        request={stepUp}
        onClose={() => {
          setStepUp(null);
        }}
        onElevated={onSessionChanged}
        mfaEnrolled={user.mfa.enrolled}
      />
    </div>
  );
}

/* ── Two-step coverage ───────────────────────────────────────────────────── */

function MfaCoverage({ onStepUp }: { onStepUp: (request: StepUpRequest) => void }) {
  const [data, setData] = useState<{
    enforcement: string;
    graceDays: number;
    rows: CoverageRow[];
  } | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    void apiFetch<{ enforcement: string; graceDays: number; rows: CoverageRow[] }>(
      '/api/security/admin/mfa/coverage',
    )
      .then(setData)
      .catch(() => {
        setData(null);
      });
  }, [reload]);

  const reset = useCallback(
    async (row: CoverageRow): Promise<void> => {
      try {
        await apiFetch('/api/security/admin/mfa/reset', {
          method: 'POST',
          body: JSON.stringify({ userId: row.userId, reason: 'lost or replaced device' }),
        });
        toast.success(`${row.email} can set up two-step again`);
        setReload((n) => n + 1);
      } catch (caught) {
        if (caught instanceof StepUpRequiredError) {
          onStepUp({
            reason: `Clearing ${row.email}'s second factor is how an account gets taken over, so we confirm it is you first.`,
            retry: () => reset(row),
          });
          return;
        }
        toast.error(caught instanceof ApiError ? caught.message : 'Could not reset');
      }
    },
    [onStepUp],
  );

  if (data === null) {
    return (
      <Card>
        <div className="space-y-2 p-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </Card>
    );
  }

  const missing = data.rows.filter((r) => !r.enrolled).length;

  const columns: Column<CoverageRow>[] = [
    { key: 'email', header: 'Account', render: (row) => row.email },
    {
      key: 'roles',
      header: 'Roles',
      render: (row) => <span className="text-ink-muted">{row.roles.join(', ')}</span>,
    },
    {
      key: 'enrolled',
      header: 'Two-step',
      render: (row) =>
        row.enrolled ? (
          <StatusBadge tone="positive">On</StatusBadge>
        ) : (
          <StatusBadge tone="warning">Not set up</StatusBadge>
        ),
    },
    {
      key: 'action',
      header: '',
      render: (row) =>
        row.enrolled ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              void reset(row);
            }}
          >
            Reset
          </Button>
        ) : null,
    },
  ];

  return (
    <Card>
      <CardHeader
        title="Roles that must hold a second factor"
        subtitle={
          missing === 0
            ? 'Everyone in a required role is covered.'
            : `${String(missing)} of ${String(data.rows.length)} accounts have not set it up. Enforcement is “${data.enforcement}” with a ${String(data.graceDays)}-day grace period.`
        }
        action={
          missing === 0 ? (
            <StatusBadge tone="positive">
              <ShieldCheck className="size-3.5" aria-hidden="true" /> Covered
            </StatusBadge>
          ) : (
            <StatusBadge tone="warning">
              <ShieldAlert className="size-3.5" aria-hidden="true" /> {missing} missing
            </StatusBadge>
          )
        }
      />
      {data.rows.length === 0 ? (
        <div className="p-4">
          <EmptyState
            icon={<Users />}
            title="No roles require a second factor yet"
            description="Set sec.mfa_required_roles in Settings to turn this on."
          />
        </div>
      ) : (
        <DataTable rows={data.rows} columns={columns} rowKey={(row) => String(row.userId)} />
      )}
    </Card>
  );
}

/* ── Access log ──────────────────────────────────────────────────────────── */

function AccessLog() {
  const [fieldClass, setFieldClass] = useState('');
  const [rows, setRows] = useState<AccessRow[] | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const query = new URLSearchParams({ sinceDays: '30', pageSize: '50' });
    if (fieldClass !== '') query.set('fieldClass', fieldClass);
    void apiFetch<{ rows: AccessRow[]; total: number }>(
      `/api/security/admin/access-log?${query.toString()}`,
    )
      .then((result) => {
        setRows(result.rows);
        setTotal(result.total);
      })
      .catch(() => {
        setRows([]);
      });
  }, [fieldClass]);

  const columns: Column<AccessRow>[] = [
    {
      key: 'when',
      header: 'When',
      render: (row) =>
        new Date(row.occurredAt).toLocaleString('en-IN', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        }),
    },
    { key: 'actor', header: 'Who', render: (row) => row.actorName ?? row.actorEmail },
    { key: 'what', header: 'Looked at', render: (row) => row.fieldClass },
    {
      key: 'subject',
      header: 'Whose',
      render: (row) => (row.subjectEmployeeId === null ? '—' : `#${String(row.subjectEmployeeId)}`),
    },
    {
      key: 'purpose',
      header: 'Stated purpose',
      render: (row) => <span className="text-ink-muted">{row.purpose}</span>,
    },
  ];

  return (
    <Card>
      <CardHeader
        title="Sensitive reads, last 30 days"
        subtitle={`${String(total)} recorded. Every row was written by the system, and none of them can be edited or deleted.`}
        action={
          <Select
            label="Type"
            value={fieldClass}
            onChange={setFieldClass}
            options={[
              { value: '', label: 'All types' },
              { value: 'statutory_id', label: 'PAN / Aadhaar / UAN' },
              { value: 'compensation', label: 'Salary' },
              { value: 'bank', label: 'Bank details' },
              { value: 'health', label: 'Health' },
              { value: 'disciplinary', label: 'Disciplinary' },
            ]}
          />
        }
      />
      {rows === null ? (
        <div className="space-y-2 p-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <div className="p-4">
          <EmptyState
            icon={<Eye />}
            title="No sensitive reads recorded"
            description="This fills up once payroll and statutory screens are in use."
          />
        </div>
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(row) => `${row.occurredAt}-${row.actorEmail}-${row.fieldClass}`}
        />
      )}
    </Card>
  );
}

/* ── Sessions ────────────────────────────────────────────────────────────── */

interface AdminSession {
  sid: string;
  deviceLabel: string | null;
  ip: string | null;
  lastSeenAt: string;
}

// Ending a session is reversible (the person signs in again) and is already
// permission-gated + audited, so it is deliberately NOT step-up gated. Only
// clearing someone's second factor is.
function SessionsAdmin() {
  const [userId, setUserId] = useState('');
  const [rows, setRows] = useState<AdminSession[] | null>(null);
  const [reason, setReason] = useState('');

  const load = async (): Promise<void> => {
    if (userId === '') return;
    try {
      const result = await apiFetch<{ sessions: AdminSession[] }>(
        `/api/security/admin/sessions?userId=${userId}`,
      );
      setRows(result.sessions);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not load sessions');
    }
  };

  const revokeAll = async (): Promise<void> => {
    try {
      const result = await apiFetch<{ revoked: number }>('/api/security/admin/sessions/revoke', {
        method: 'POST',
        body: JSON.stringify({ userId: Number(userId), reason }),
      });
      toast.success(
        `${String(result.revoked)} session${result.revoked === 1 ? '' : 's'} ended — effective on their next request`,
      );
      setReason('');
      void load();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not end sessions');
    }
  };

  return (
    <Card>
      <CardHeader
        title="Someone else's sessions"
        subtitle="Ending a session takes effect on that person's very next request — not whenever their token expires."
      />
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-end gap-2">
          <TextField
            label="User id"
            inputMode="numeric"
            className="w-32"
            value={userId}
            onChange={(event) => {
              setUserId(event.target.value.replace(/\D/g, ''));
            }}
          />
          <Button
            variant="ghost"
            disabled={userId === ''}
            onClick={() => {
              void load();
            }}
          >
            Look up
          </Button>
        </div>

        {rows === null ? null : rows.length === 0 ? (
          <EmptyState title="No active sessions" description="That account is not signed in anywhere." />
        ) : (
          <>
            <ul className="divide-y divide-line rounded-xl border border-line">
              {rows.map((row) => (
                <li key={row.sid} className="px-3 py-2 text-sm">
                  <span className="text-ink">{row.deviceLabel ?? 'Unknown device'}</span>
                  <span className="text-ink-muted">
                    {' '}
                    · {row.ip ?? 'no address'} ·{' '}
                    {new Date(row.lastSeenAt).toLocaleString('en-IN')}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-end gap-2">
              <TextField
                label="Why are you ending these?"
                hint="Recorded in the audit log."
                className="min-w-56 flex-1"
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value);
                }}
              />
              <Button
                disabled={reason.trim().length < 3}
                onClick={() => {
                  void revokeAll();
                }}
              >
                End all sessions
              </Button>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
