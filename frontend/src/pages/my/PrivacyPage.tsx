/**
 * `/my/privacy` — everything about MY account and MY data in one place
 * (SEC-05/11 + Stage 5.3 DPDP PRV-02..04, PRV-10 + docs/15 GAP-A17).
 *
 * Ordered by anxiety, then by transparency obligation:
 *   1. Where am I signed in?
 *   2. Is my account protected by a second factor?
 *   3. Who has looked at my record?
 *   4. How do I change my password?
 *   5. What do you hold and why? · my consents · rights request · who to contact
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Copy,
  Eye,
  KeyRound,
  Laptop,
  LogOut,
  ShieldCheck,
  ShieldAlert,
  Smartphone,
} from 'lucide-react';
import { ApiError, StepUpRequiredError, apiFetch } from '../../lib/api';
import type { SessionUser } from '../../lib/session';
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  Pill,
  Skeleton,
  StatusBadge,
  TextField,
  toast,
} from '../../ui';
import { StepUpDialog, type StepUpRequest } from '../../app/StepUpDialog';
import {
  ConsentsCard,
  DpoContactCard,
  ProcessingRegisterCard,
  RightsRequestCard,
} from './PrivacyEssSections';

interface SessionRow {
  sid: string;
  deviceLabel: string | null;
  ip: string | null;
  createdAt: string;
  lastSeenAt: string;
  isCurrent: boolean;
}
interface AccessEvent {
  occurredAt: string;
  actorName: string | null;
  actorEmail: string;
  resource: string;
  fieldClass: string;
  purpose: string;
  recordCount: number;
}
interface MfaState {
  enrolled: boolean;
  confirmedAt: string | null;
  recoveryCodesRemaining: number;
  required: boolean;
  enforcement: 'off' | 'grace' | 'required';
}

/** "2 minutes ago" beats a timestamp when the question is "is that me?". */
function relative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${String(minutes)} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${String(hours)} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${String(days)} d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const FIELD_CLASS_LABEL: Record<string, string> = {
  statutory_id: 'PAN / Aadhaar / UAN',
  compensation: 'Salary',
  bank: 'Bank details',
  health: 'Health',
  disciplinary: 'Disciplinary',
};

interface PrivacyPageProps {
  user: SessionUser;
  onSessionChanged: () => void;
}

export function PrivacyPage({ user, onSessionChanged }: PrivacyPageProps) {
  const [stepUp, setStepUp] = useState<StepUpRequest | null>(null);
  const [mfa, setMfa] = useState<MfaState | null>(null);
  const [reload, setReload] = useState(0);

  const refresh = useCallback(() => {
    setReload((n) => n + 1);
  }, []);

  useEffect(() => {
    void apiFetch<MfaState>('/api/security/my/mfa')
      .then(setMfa)
      .catch(() => {
        setMfa(null);
      });
  }, [reload]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="My account"
        title="Security & privacy"
        description="Where you are signed in, how your account is protected, who has looked at your record, and how your data is handled."
      />

      {/* Order = anxiety first, then DPDP transparency. */}
      <div className="u-enter" style={{ ['--enter-delay' as string]: '0ms' }}>
        <SessionsCard onChanged={onSessionChanged} reloadKey={reload} onReload={refresh} />
      </div>

      <div className="u-enter" style={{ ['--enter-delay' as string]: '60ms' }}>
        <MfaCard
          state={mfa}
          onChanged={refresh}
          onStepUp={setStepUp}
        />
      </div>

      <div className="u-enter" style={{ ['--enter-delay' as string]: '120ms' }}>
        <AccessHistoryCard />
      </div>

      <div className="u-enter" style={{ ['--enter-delay' as string]: '180ms' }}>
        <PasswordCard onChanged={onSessionChanged} />
      </div>

      <div className="u-enter" style={{ ['--enter-delay' as string]: '220ms' }}>
        <ProcessingRegisterCard />
      </div>

      <div className="u-enter" style={{ ['--enter-delay' as string]: '260ms' }}>
        <ConsentsCard />
      </div>

      <div className="u-enter" style={{ ['--enter-delay' as string]: '300ms' }}>
        <RightsRequestCard />
      </div>

      <div className="u-enter" style={{ ['--enter-delay' as string]: '340ms' }}>
        <DpoContactCard />
      </div>

      <StepUpDialog
        request={stepUp}
        onClose={() => {
          setStepUp(null);
        }}
        onElevated={onSessionChanged}
        mfaEnrolled={mfa?.enrolled ?? user.mfa.enrolled}
      />
    </div>
  );
}

/* ── 1. Sessions ─────────────────────────────────────────────────────────── */

function SessionsCard({
  onChanged,
  reloadKey,
  onReload,
}: {
  onChanged: () => void;
  reloadKey: number;
  onReload: () => void;
}) {
  const [rows, setRows] = useState<SessionRow[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void apiFetch<{ sessions: SessionRow[] }>('/api/security/my/sessions')
      .then((r) => {
        setRows(r.sessions);
      })
      .catch(() => {
        setRows([]);
      });
  }, [reloadKey]);

  const endSession = async (sid: string): Promise<void> => {
    setBusy(true);
    try {
      await apiFetch('/api/security/my/sessions/revoke', {
        method: 'POST',
        body: JSON.stringify({ sid }),
      });
      toast.success('That device has been signed out');
      onReload();
      onChanged();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not end that session');
    } finally {
      setBusy(false);
    }
  };

  const signOutEverywhere = async (): Promise<void> => {
    setBusy(true);
    try {
      const result = await apiFetch<{ revoked: number }>(
        '/api/security/my/sessions/revoke-all',
        { method: 'POST', body: JSON.stringify({ includeCurrent: false }) },
      );
      toast.success(
        result.revoked === 0
          ? 'You were only signed in here'
          : `Signed out of ${String(result.revoked)} other device${result.revoked === 1 ? '' : 's'}`,
      );
      onReload();
      onChanged();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not sign out everywhere');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Where you're signed in"
        subtitle="If you don't recognise a device, end it — that takes effect immediately."
        action={
          rows !== null && rows.length > 1 ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                void signOutEverywhere();
              }}
            >
              <LogOut className="size-4" aria-hidden="true" />
              Sign out everywhere else
            </Button>
          ) : undefined
        }
      />
      {rows === null ? (
        <div className="space-y-2 p-4">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((row) => (
            <li
              key={row.sid}
              className="flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-muted">
                {(row.deviceLabel ?? '').includes('Android') ||
                (row.deviceLabel ?? '').includes('iOS') ? (
                  <Smartphone className="size-4" aria-hidden="true" />
                ) : (
                  <Laptop className="size-4" aria-hidden="true" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm text-ink">
                  {row.deviceLabel ?? 'Unknown device'}
                  {row.isCurrent ? <Pill accent>This device</Pill> : null}
                </p>
                <p className="text-xs text-ink-muted">
                  {row.ip ?? 'no address recorded'} · last active {relative(row.lastSeenAt)}
                </p>
              </div>
              {row.isCurrent ? null : (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    void endSession(row.sid);
                  }}
                >
                  End
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ── 2. Second factor ────────────────────────────────────────────────────── */

function MfaCard({
  state,
  onChanged,
  onStepUp,
}: {
  state: MfaState | null;
  onChanged: () => void;
  onStepUp: (request: StepUpRequest) => void;
}) {
  const [setup, setSetup] = useState<{ secret: string; otpauth: string } | null>(null);
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const begin = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      setSetup(await apiFetch<{ secret: string; otpauth: string }>('/api/security/my/mfa/begin', {
        method: 'POST',
      }));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not start setup');
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const result = await apiFetch<{ recoveryCodes: string[] }>(
        '/api/security/my/mfa/confirm',
        { method: 'POST', body: JSON.stringify({ code }) },
      );
      setRecovery(result.recoveryCodes);
      setSetup(null);
      setCode('');
      onChanged();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not confirm the code');
    } finally {
      setBusy(false);
    }
  };

  const turnOff = useCallback(async (): Promise<void> => {
    try {
      await apiFetch('/api/security/my/mfa/disable', { method: 'POST' });
      toast.success('Two-step verification is off');
      onChanged();
    } catch (caught) {
      if (caught instanceof StepUpRequiredError) {
        onStepUp({
          reason: 'Turning off two-step verification weakens your account, so we check it is you.',
          retry: turnOff,
        });
        return;
      }
      toast.error(caught instanceof ApiError ? caught.message : 'Could not turn it off');
    }
  }, [onChanged, onStepUp]);

  if (state === null) {
    return (
      <Card>
        <CardHeader title="Two-step verification" />
        <div className="p-4">
          <Skeleton className="h-16 w-full" />
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Two-step verification"
        subtitle="A code from your phone, on top of your password."
        action={
          state.enrolled ? (
            <StatusBadge tone="positive">
              <ShieldCheck className="size-3.5" aria-hidden="true" /> On
            </StatusBadge>
          ) : state.required ? (
            <StatusBadge tone="warning">
              <ShieldAlert className="size-3.5" aria-hidden="true" /> Needed for your role
            </StatusBadge>
          ) : (
            <StatusBadge tone="neutral">Off</StatusBadge>
          )
        }
      />

      <div className="space-y-4 p-4">
        {recovery === null ? null : (
          <div className="u-pop-in rounded-xl border border-line bg-surface-2 p-4">
            <p className="text-sm font-medium text-ink">Save these recovery codes now</p>
            <p className="mt-1 text-xs text-ink-muted">
              Each one works once, if you lose your phone. This is the only time they are shown.
            </p>
            <ul className="mt-3 grid grid-cols-2 gap-2 font-mono text-sm text-ink sm:grid-cols-5">
              {recovery.map((c) => (
                <li key={c} className="rounded-row bg-surface px-2 py-1 text-center">
                  {c}
                </li>
              ))}
            </ul>
            <Button
              size="sm"
              variant="ghost"
              className="mt-3"
              onClick={() => {
                void navigator.clipboard.writeText(recovery.join('\n'));
                toast.success('Recovery codes copied');
              }}
            >
              <Copy className="size-4" aria-hidden="true" />
              Copy all
            </Button>
          </div>
        )}

        {setup === null ? null : (
          <div className="u-pop-in space-y-3 rounded-xl border border-line bg-surface-2 p-4">
            <p className="text-sm text-ink">
              Add this key to your authenticator app, then type the 6-digit code it shows.
            </p>
            <code className="block break-all rounded-row bg-surface px-3 py-2 font-mono text-sm tracking-wider text-ink">
              {setup.secret.match(/.{1,4}/g)?.join(' ') ?? setup.secret}
            </code>
            <div className="flex flex-wrap items-end gap-2">
              <TextField
                label="6-digit code"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                className="w-40"
                value={code}
                onChange={(event) => {
                  setCode(event.target.value.replace(/\D/g, '').slice(0, 6));
                }}
              />
              <Button
                disabled={busy || code.length !== 6}
                onClick={() => {
                  void confirm();
                }}
              >
                Turn on
              </Button>
            </div>
          </div>
        )}

        {error === null ? null : (
          <p role="alert" className="text-sm text-negative">
            {error}
          </p>
        )}

        {state.enrolled ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-muted">
              {state.recoveryCodesRemaining} recovery code
              {state.recoveryCodesRemaining === 1 ? '' : 's'} left.
            </p>
            <Button
              variant="ghost"
              onClick={() => {
                void turnOff();
              }}
            >
              Turn off
            </Button>
          </div>
        ) : setup === null ? (
          <Button
            disabled={busy}
            onClick={() => {
              void begin();
            }}
          >
            <KeyRound className="size-4" aria-hidden="true" />
            Set it up
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

/* ── 3. Who looked at my record ──────────────────────────────────────────── */

function AccessHistoryCard() {
  const [state, setState] = useState<{ available: boolean; events: AccessEvent[] } | null>(null);

  useEffect(() => {
    void apiFetch<{ available: boolean; events: AccessEvent[] }>(
      '/api/security/my/access-history?limit=25',
    )
      .then(setState)
      .catch(() => {
        setState({ available: false, events: [] });
      });
  }, []);

  return (
    <Card>
      <CardHeader
        title="Who has looked at your record"
        subtitle="Every time someone opens your salary, bank or ID details, it is recorded here with the reason."
      />
      {state === null ? (
        <div className="space-y-2 p-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : state.events.length === 0 ? (
        <div className="p-4">
          <EmptyState
            icon={<Eye />}
            title="Nobody has opened your sensitive details"
            description="Ordinary things — your name, department, attendance — are not tracked here. Salary, bank and ID details are."
          />
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {state.events.map((event, index) => (
            <li key={`${event.occurredAt}-${String(index)}`} className="px-4 py-3">
              <p className="text-sm text-ink">
                {event.actorName ?? event.actorEmail}
                <span className="text-ink-muted"> opened your </span>
                {FIELD_CLASS_LABEL[event.fieldClass] ?? event.fieldClass}
              </p>
              <p className="mt-0.5 text-xs text-ink-muted">
                {event.purpose} · {relative(event.occurredAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ── 4. Password ─────────────────────────────────────────────────────────── */

interface PolicyView {
  minLength: number;
  requireUpper: boolean;
  requireLower: boolean;
  requireDigit: boolean;
  requireSymbol: boolean;
  historyDepth: number;
}

function PasswordCard({ onChanged }: { onChanged: () => void }) {
  const [policy, setPolicy] = useState<PolicyView | null>(null);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void apiFetch<PolicyView>('/api/security/password-policy')
      .then(setPolicy)
      .catch(() => {
        setPolicy(null);
      });
  }, []);

  // State the rules UP FRONT rather than revealing them one rejection at a
  // time — docs/05 §6, the same reasoning as returning every violation at once.
  const rules = policy === null
    ? []
    : [
        `at least ${String(policy.minLength)} characters`,
        policy.requireUpper ? 'a capital letter' : null,
        policy.requireLower ? 'a small letter' : null,
        policy.requireDigit ? 'a number' : null,
        policy.requireSymbol ? 'a symbol' : null,
        `not one of your last ${String(policy.historyDepth)}`,
      ].filter((rule): rule is string => rule !== null);

  const submit = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const result = await apiFetch<{ otherSessionsRevoked: number }>(
        '/api/security/my/password',
        {
          method: 'POST',
          body: JSON.stringify({ currentPassword: current, newPassword: next }),
        },
      );
      setCurrent('');
      setNext('');
      toast.success(
        result.otherSessionsRevoked > 0
          ? `Password changed — ${String(result.otherSessionsRevoked)} other device${result.otherSessionsRevoked === 1 ? ' was' : 's were'} signed out`
          : 'Password changed',
      );
      onChanged();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not change your password');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Password"
        subtitle={rules.length === 0 ? undefined : `Needs ${rules.join(', ')}.`}
      />
      <form
        className="grid gap-4 p-4 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <TextField
          label="Current password"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(event) => {
            setCurrent(event.target.value);
          }}
          required
        />
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(event) => {
            setNext(event.target.value);
          }}
          required
        />
        {error === null ? null : (
          <p role="alert" className="text-sm text-negative sm:col-span-2">
            {error}
          </p>
        )}
        <div className="sm:col-span-2">
          <Button type="submit" disabled={busy || current === '' || next === ''}>
            Change password
          </Button>
        </div>
      </form>
    </Card>
  );
}
