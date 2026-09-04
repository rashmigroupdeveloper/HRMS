/**
 * DPDP ESS sections for `/my/privacy` (PRV-02, PRV-03, PRV-04, PRV-10).
 * Kept separate from the security half so PrivacyPage stays scannable.
 */
import { useCallback, useEffect, useState } from 'react';
import { FileStack, Hand, Mail, Scale } from 'lucide-react';
import { ApiError, apiFetch } from '../../lib/api';
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Select,
  Skeleton,
  StatusBadge,
  Textarea,
  toast,
} from '../../ui';
import {
  consentPurposeLabel,
  lawfulBasisLabel,
  retentionLabel,
  rightsKindLabel,
  type RightsKind,
} from './privacy-labels';

interface RegisterEntry {
  dataClass: string;
  purpose: string;
  lawfulBasis: string;
  retentionDays: number;
  recipients: string;
}

interface ConsentRow {
  purpose: string;
  granted: boolean;
  updatedAt: string | null;
}

interface DpoContact {
  name: string;
  email: string;
  phone?: string | null;
  responseSlaDays?: number | null;
}

const RIGHTS_OPTIONS = [
  { value: 'access', label: rightsKindLabel('access') },
  { value: 'correction', label: rightsKindLabel('correction') },
  { value: 'erasure', label: rightsKindLabel('erasure') },
];

export function ProcessingRegisterCard() {
  const [rows, setRows] = useState<RegisterEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch<{ entries: RegisterEntry[] }>('/api/privacy/register')
      .then((r) => {
        setRows(r.entries);
      })
      .catch((caught: unknown) => {
        if (caught instanceof ApiError && caught.status === 404) {
          setRows([]);
          setError(null);
          return;
        }
        setError(caught instanceof ApiError ? caught.message : 'Could not load the register');
        setRows([]);
      });
  }, []);

  return (
    <Card>
      <CardHeader
        title="What we hold and why"
        subtitle="Every class of personal data we process, the purpose, the lawful basis, and how long we keep it."
      />
      {rows === null ? (
        <div className="space-y-2 p-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : error !== null ? (
        <div className="p-4">
          <EmptyState icon={<FileStack />} title="Register unavailable" description={error} />
        </div>
      ) : rows.length === 0 ? (
        <div className="p-4">
          <EmptyState
            icon={<FileStack />}
            title="Processing register not published yet"
            description="When the DPO publishes the register, every data class will appear here with its purpose and retention."
          />
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((row) => (
            <li key={row.dataClass} className="px-4 py-3">
              <p className="text-sm font-medium text-ink">{row.dataClass}</p>
              <p className="mt-0.5 text-sm text-ink-muted">{row.purpose}</p>
              <p className="mt-1 text-xs text-ink-muted">
                {lawfulBasisLabel(row.lawfulBasis)} · kept {retentionLabel(row.retentionDays)} ·{' '}
                {row.recipients}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function ConsentsCard() {
  const [rows, setRows] = useState<ConsentRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback((): void => {
    void apiFetch<{ consents: ConsentRow[] }>('/api/privacy/consents')
      .then((r) => {
        setRows(r.consents);
      })
      .catch((caught: unknown) => {
        if (caught instanceof ApiError && caught.status === 404) {
          setRows([]);
          return;
        }
        setRows([]);
        toast.error(caught instanceof ApiError ? caught.message : 'Could not load consents');
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setGranted = async (purpose: string, granted: boolean): Promise<void> => {
    setBusy(purpose);
    try {
      await apiFetch('/api/privacy/consents', {
        method: 'PUT',
        body: JSON.stringify({ purpose, granted }),
      });
      toast.success(granted ? 'Consent recorded' : 'Consent withdrawn');
      load();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not update consent');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader
        title="My consents"
        subtitle="Optional processing outside employment. Withdrawal takes effect immediately."
      />
      {rows === null ? (
        <div className="space-y-2 p-4">
          <Skeleton className="h-12 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <div className="p-4">
          <EmptyState
            icon={<Hand />}
            title="No optional consents on file"
            description="Employment processing does not need a separate consent. Optional purposes (photo, wellness, alumni) will appear here when offered."
          />
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((row) => (
            <li
              key={row.purpose}
              className="flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink">{consentPurposeLabel(row.purpose)}</p>
                <p className="text-xs text-ink-muted">
                  {row.granted ? 'Granted' : 'Withdrawn'}
                  {row.updatedAt
                    ? ` · ${new Date(row.updatedAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}`
                    : ''}
                </p>
              </div>
              {row.granted ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy === row.purpose}
                  onClick={() => {
                    void setGranted(row.purpose, false);
                  }}
                >
                  Withdraw
                </Button>
              ) : (
                <Button
                  size="sm"
                  disabled={busy === row.purpose}
                  onClick={() => {
                    void setGranted(row.purpose, true);
                  }}
                >
                  Grant
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function RightsRequestCard() {
  const [kind, setKind] = useState<RightsKind | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (): Promise<void> => {
    if (kind === null) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/api/privacy/rights', {
        method: 'POST',
        body: JSON.stringify({
          kind,
          reason: reason.trim() === '' ? undefined : reason.trim(),
        }),
      });
      toast.success('Rights request submitted — the DPO will respond within the statutory clock');
      setKind(null);
      setReason('');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not submit the request');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Request my data / correct it / delete it"
        subtitle="Access, correction and erasure under the DPDP Act. Identity is verified before fulfilment."
      />
      <form
        className="grid gap-4 p-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Select
          label="What do you need?"
          options={RIGHTS_OPTIONS}
          value={kind}
          onChange={(value) => {
            setKind(value as RightsKind);
          }}
          placeholder="Choose a request type"
          required
        />
        <Textarea
          label="Details (optional)"
          hint="For a correction, say what is wrong. For erasure, say what should be removed."
          value={reason}
          onChange={(event) => {
            setReason(event.target.value);
          }}
          rows={3}
          maxLength={1000}
          showCount
        />
        {error === null ? null : (
          <p role="alert" className="text-sm text-negative">
            {error}
          </p>
        )}
        <div>
          <Button type="submit" disabled={busy || kind === null}>
            <Scale className="size-4" aria-hidden="true" />
            Submit request
          </Button>
        </div>
      </form>
    </Card>
  );
}

export function DpoContactCard() {
  const [dpo, setDpo] = useState<DpoContact | null | undefined>(undefined);

  useEffect(() => {
    void apiFetch<DpoContact>('/api/privacy/dpo')
      .then(setDpo)
      .catch((caught: unknown) => {
        if (caught instanceof ApiError && caught.status === 404) {
          setDpo(null);
          return;
        }
        setDpo(null);
      });
  }, []);

  return (
    <Card>
      <CardHeader
        title="Who to contact"
        subtitle="The Data Protection Officer publishes name, contact and response SLA for every employee."
      />
      {dpo === undefined ? (
        <div className="p-4">
          <Skeleton className="h-16 w-full" />
        </div>
      ) : dpo === null ? (
        <div className="p-4">
          <EmptyState
            icon={<Mail />}
            title="DPO details not published yet"
            description="When the organisation names a Data Protection Officer, their contact will appear here and in your account menu."
          />
        </div>
      ) : (
        <div className="flex flex-wrap items-start gap-4 p-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-muted">
            <Mail className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink">{dpo.name}</p>
            <a
              href={`mailto:${dpo.email}`}
              className="mt-0.5 block text-sm text-ink underline-offset-2 hover:underline"
            >
              {dpo.email}
            </a>
            {dpo.phone ? (
              <p className="mt-0.5 text-sm text-ink-muted">{dpo.phone}</p>
            ) : null}
            {dpo.responseSlaDays !== null && dpo.responseSlaDays !== undefined ? (
              <p className="mt-2">
                <StatusBadge tone="neutral">
                  Responds within {String(dpo.responseSlaDays)} day
                  {dpo.responseSlaDays === 1 ? '' : 's'}
                </StatusBadge>
              </p>
            ) : null}
          </div>
        </div>
      )}
    </Card>
  );
}
