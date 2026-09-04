/**
 * `/privacy` — DPO / privacy-ops console (Stage 5.3 · PRV-01..08, PRV-10).
 *
 * Tabs follow the plan order: Requests · Consents · Retention & purge ·
 * Processors · Breach · Notices. Empty states stay honest — never invent rows.
 * Permission gate lives in nav (`prv.rights.handle` | `prv.notice.manage`);
 * the API enforces writes.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  FileWarning,
  Hand,
  Lock,
  ScrollText,
  Server,
  Timer,
  TriangleAlert,
} from 'lucide-react';
import { ApiError, apiFetch } from '../../lib/api';
import {
  Button,
  Card,
  CardHeader,
  ConfirmModal,
  DataTable,
  EmptyState,
  PageHeader,
  Skeleton,
  StatusBadge,
  TextField,
  Textarea,
  toast,
} from '../../ui';
import type { Column, StatusTone } from '../../ui';
import {
  consentPurposeLabel,
  rightsKindLabel,
  retentionLabel,
} from '../my/privacy-labels';

type Tab = 'requests' | 'consents' | 'retention' | 'processors' | 'breach' | 'notices';

const TABS: { id: Tab; label: string }[] = [
  { id: 'requests', label: 'Requests' },
  { id: 'consents', label: 'Consents' },
  { id: 'retention', label: 'Retention & purge' },
  { id: 'processors', label: 'Processors' },
  { id: 'breach', label: 'Breach' },
  { id: 'notices', label: 'Notices' },
];

interface RightsRequest {
  id: number;
  employeeId: number;
  employeeName?: string | null;
  employeeEmail?: string | null;
  kind: string;
  status: string;
  reason: string | null;
  refusalReason: string | null;
  dueAt: string;
  closedAt: string | null;
  createdAt: string;
}

interface ConsentView {
  employeeId: number;
  employeeName?: string | null;
  purpose: string;
  granted: boolean;
  updatedAt: string | null;
}

interface RetentionRule {
  dataClass: string;
  retentionDays: number;
  openHolds?: number;
}

interface PurgeProposal {
  id: number;
  dataClass: string;
  rowCount: number;
  excludedHolds: number;
  proposedBy?: string | null;
  proposedAt: string;
  confirmedAt: string | null;
}

interface Processor {
  id: number;
  name: string;
  purpose: string;
  dpaStatus: string;
  dpaExpiresOn: string | null;
  ownerEmail: string | null;
}

interface BreachRow {
  id: number;
  discoveredAt: string;
  summary: string;
  notifiedBoardAt: string | null;
  notifiedPrincipalsAt: string | null;
}

interface NoticeRow {
  id: number;
  version: number;
  principalClass: string;
  title: string;
  effectiveFrom: string;
  isCurrent: boolean;
}

function statusTone(status: string): StatusTone {
  if (status === 'fulfilled' || status === 'active') return 'positive';
  if (status === 'refused' || status === 'expired' || status === 'missing') return 'negative';
  if (status === 'in_progress' || status === 'open') return 'warning';
  return 'neutral';
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function PrivacyOpsPage() {
  const [tab, setTab] = useState<Tab>('requests');

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Master control · privacy"
        title="Data protection"
        description="Rights requests, consents, retention and purge, processors, breach register and published notices — the DPDP operating surface."
      />

      <div
        className="flex w-full gap-1 overflow-x-auto rounded-full bg-surface-2 p-1"
        role="tablist"
        aria-label="Privacy sections"
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
        {tab === 'requests' ? (
          <RequestsTab />
        ) : tab === 'consents' ? (
          <ConsentsTab />
        ) : tab === 'retention' ? (
          <RetentionTab />
        ) : tab === 'processors' ? (
          <ProcessorsTab />
        ) : tab === 'breach' ? (
          <BreachTab />
        ) : (
          <NoticesTab />
        )}
      </div>
    </div>
  );
}

/* ── Requests ────────────────────────────────────────────────────────────── */

function RequestsTab() {
  const [rows, setRows] = useState<RightsRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refuseTarget, setRefuseTarget] = useState<RightsRequest | null>(null);
  const [refuseReason, setRefuseReason] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback((): void => {
    void apiFetch<{ requests: RightsRequest[] }>('/api/privacy/rights')
      .then((r) => {
        setRows(r.requests);
        setError(null);
      })
      .catch((caught: unknown) => {
        setRows([]);
        setError(caught instanceof ApiError ? caught.message : 'Could not load rights requests');
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const fulfill = async (row: RightsRequest): Promise<void> => {
    setBusyId(row.id);
    try {
      await apiFetch('/api/privacy/rights/fulfill', {
        method: 'POST',
        body: JSON.stringify({ id: row.id }),
      });
      toast.success('Request marked fulfilled');
      load();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not fulfil');
    } finally {
      setBusyId(null);
    }
  };

  const refuse = async (id: number, reason: string): Promise<void> => {
    if (reason.trim() === '') {
      toast.error('A refusal needs a reason');
      return;
    }
    setBusyId(id);
    try {
      await apiFetch('/api/privacy/rights/refuse', {
        method: 'POST',
        body: JSON.stringify({ id, reason: reason.trim() }),
      });
      toast.success('Request refused with reason');
      setRefuseTarget(null);
      setRefuseReason('');
      load();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not refuse');
    } finally {
      setBusyId(null);
    }
  };

  const columns: Column<RightsRequest>[] = [
    {
      key: 'who',
      header: 'Person',
      render: (row) => row.employeeName ?? row.employeeEmail ?? `#${String(row.employeeId)}`,
    },
    {
      key: 'kind',
      header: 'Kind',
      render: (row) => rightsKindLabel(row.kind),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge tone={statusTone(row.status)}>{row.status}</StatusBadge>,
    },
    {
      key: 'due',
      header: 'Due',
      render: (row) => formatDay(row.dueAt),
    },
    {
      key: 'actions',
      header: '',
      render: (row) =>
        row.status === 'open' || row.status === 'in_progress' ? (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={busyId === row.id}
              onClick={() => {
                void fulfill(row);
              }}
            >
              Fulfil
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busyId === row.id}
              onClick={() => {
                setRefuseTarget(row);
                setRefuseReason('');
              }}
            >
              Refuse
            </Button>
          </div>
        ) : (
          <span className="text-xs text-ink-muted">{row.refusalReason ?? '—'}</span>
        ),
    },
  ];

  if (rows === null) {
    return (
      <Card>
        <div className="space-y-2 p-4">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader
          title="Rights requests"
          subtitle="Access, correction and erasure — identity verified, statutory clock running."
        />
        {error !== null && rows.length === 0 ? (
          <div className="p-4">
            <EmptyState icon={<TriangleAlert />} title="Requests unavailable" description={error} />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={<Lock />}
              title="No open rights requests"
              description="When an employee submits access, correction or erasure from Security & privacy, it lands here."
            />
          </div>
        ) : (
          <div className="p-2">
            <DataTable columns={columns} rows={rows} rowKey={(row) => String(row.id)} />
          </div>
        )}
      </Card>

      <ConfirmModal
        open={refuseTarget !== null}
        onClose={() => {
          setRefuseTarget(null);
        }}
        onConfirm={() => {
          const target = refuseTarget;
          const reason = refuseReason;
          if (target === null) return;
          void refuse(target.id, reason);
        }}
        title="Refuse this rights request?"
        description={
          <div className="space-y-3">
            <p>A refusal must carry a reason — it is recorded on the register.</p>
            <Textarea
              label="Refusal reason"
              value={refuseReason}
              onChange={(event) => {
                setRefuseReason(event.target.value);
              }}
              rows={3}
              required
            />
          </div>
        }
        confirmLabel="Refuse"
        danger
      />
    </>
  );
}

/* ── Consents (read) ─────────────────────────────────────────────────────── */

function ConsentsTab() {
  const [rows, setRows] = useState<ConsentView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch<{ consents: ConsentView[] }>('/api/privacy/consents?scope=all')
      .then((r) => {
        setRows(r.consents);
      })
      .catch((caught: unknown) => {
        setRows([]);
        setError(caught instanceof ApiError ? caught.message : 'Could not load consents');
      });
  }, []);

  const columns: Column<ConsentView>[] = [
    {
      key: 'who',
      header: 'Person',
      render: (row) => row.employeeName ?? `#${String(row.employeeId)}`,
    },
    {
      key: 'purpose',
      header: 'Purpose',
      render: (row) => consentPurposeLabel(row.purpose),
    },
    {
      key: 'state',
      header: 'State',
      render: (row) => (
        <StatusBadge tone={row.granted ? 'positive' : 'neutral'}>
          {row.granted ? 'Granted' : 'Withdrawn'}
        </StatusBadge>
      ),
    },
    {
      key: 'when',
      header: 'Updated',
      render: (row) => (row.updatedAt ? formatDay(row.updatedAt) : '—'),
    },
  ];

  return (
    <Card>
      <CardHeader
        title="Consent registry"
        subtitle="Read-only view of optional consents. Employees grant and withdraw from Security & privacy."
      />
      {rows === null ? (
        <div className="space-y-2 p-4">
          <Skeleton className="h-12 w-full" />
        </div>
      ) : error !== null && rows.length === 0 ? (
        <div className="p-4">
          <EmptyState icon={<TriangleAlert />} title="Consents unavailable" description={error} />
        </div>
      ) : rows.length === 0 ? (
        <div className="p-4">
          <EmptyState
            icon={<Hand />}
            title="No consent rows yet"
            description="Optional purposes appear here once an employee grants or withdraws them."
          />
        </div>
      ) : (
        <div className="p-2">
          <DataTable columns={columns} rows={rows} rowKey={(r) => `${String(r.employeeId)}-${r.purpose}`} />
        </div>
      )}
    </Card>
  );
}

/* ── Retention & purge ───────────────────────────────────────────────────── */

function RetentionTab() {
  const [rules, setRules] = useState<RetentionRule[] | null>(null);
  const [proposals, setProposals] = useState<PurgeProposal[] | null>(null);
  const [dataClass, setDataClass] = useState('');
  const [confirmTarget, setConfirmTarget] = useState<PurgeProposal | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback((): void => {
    void apiFetch<{ rules: RetentionRule[]; proposals: PurgeProposal[] }>(
      '/api/privacy/retention',
    )
      .then((r) => {
        setRules(r.rules);
        setProposals(r.proposals);
      })
      .catch((caught: unknown) => {
        // Fall back to empty — never invent purge counts.
        setRules([]);
        setProposals([]);
        if (!(caught instanceof ApiError && caught.status === 404)) {
          toast.error(caught instanceof ApiError ? caught.message : 'Could not load retention');
        }
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const propose = async (): Promise<void> => {
    const trimmed = dataClass.trim();
    if (trimmed === '') return;
    setBusy(true);
    try {
      const proposal = await apiFetch<PurgeProposal>('/api/privacy/purge/propose', {
        method: 'POST',
        body: JSON.stringify({ dataClass: trimmed }),
      });
      toast.success(
        `Purge proposed: ${String(proposal.rowCount)} row${proposal.rowCount === 1 ? '' : 's'} · ${String(proposal.excludedHolds)} under legal hold`,
      );
      setDataClass('');
      load();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not propose purge');
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (proposalId: number): Promise<void> => {
    setBusy(true);
    try {
      await apiFetch('/api/privacy/purge/confirm', {
        method: 'POST',
        body: JSON.stringify({ proposalId }),
      });
      toast.success('Purge confirmed and logged');
      setConfirmTarget(null);
      load();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not confirm purge');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Retention rules"
          subtitle="Every data class in the processing register must have a retention period."
        />
        {rules === null ? (
          <div className="p-4">
            <Skeleton className="h-12 w-full" />
          </div>
        ) : rules.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={<Timer />}
              title="No retention rules published"
              description="Rules are authored with the processing register. Nothing is purged until a rule exists."
            />
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {rules.map((rule) => (
              <li key={rule.dataClass} className="flex flex-wrap items-center gap-2 px-4 py-3">
                <span className="min-w-0 flex-1 text-sm text-ink">{rule.dataClass}</span>
                <span className="text-sm text-ink-muted">{retentionLabel(rule.retentionDays)}</span>
                {rule.openHolds !== undefined && rule.openHolds > 0 ? (
                  <StatusBadge tone="warning">
                    {String(rule.openHolds)} legal hold{rule.openHolds === 1 ? '' : 's'}
                  </StatusBadge>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Propose a purge"
          subtitle="DPO proposes; a different super_admin confirms. The proposal shows exact row counts and holds excluded."
        />
        <div className="flex flex-wrap items-end gap-3 p-4">
          <TextField
            label="Data class"
            className="min-w-[12rem] flex-1"
            value={dataClass}
            onChange={(event) => {
              setDataClass(event.target.value);
            }}
            placeholder="e.g. att.day_status"
          />
          <Button
            disabled={busy || dataClass.trim() === ''}
            onClick={() => {
              void propose();
            }}
          >
            Propose purge
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader title="Open proposals" subtitle="Two-person rule: proposer cannot confirm." />
        {proposals === null ? (
          <div className="p-4">
            <Skeleton className="h-12 w-full" />
          </div>
        ) : proposals.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={<Timer />}
              title="No open purge proposals"
              description="Propose a class above. Confirmation requires a second person and step-up."
            />
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {proposals.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink">{p.dataClass}</p>
                  <p className="text-xs text-ink-muted">
                    {String(p.rowCount)} row{p.rowCount === 1 ? '' : 's'} ·{' '}
                    {String(p.excludedHolds)} excluded by legal hold · proposed{' '}
                    {formatDay(p.proposedAt)}
                    {p.proposedBy ? ` by ${p.proposedBy}` : ''}
                  </p>
                </div>
                {p.confirmedAt ? (
                  <StatusBadge tone="positive">Confirmed</StatusBadge>
                ) : (
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={busy}
                    onClick={() => {
                      setConfirmTarget(p);
                    }}
                  >
                    Confirm purge
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ConfirmModal
        open={confirmTarget !== null}
        onClose={() => {
          setConfirmTarget(null);
        }}
        onConfirm={() => {
          const target = confirmTarget;
          if (target === null) return;
          void confirm(target.id);
        }}
        title="Confirm irreversible purge?"
        description={
          confirmTarget === null
            ? undefined
            : `This will remove ${String(confirmTarget.rowCount)} row(s) of ${confirmTarget.dataClass}. Legal holds already excluded ${String(confirmTarget.excludedHolds)}. The purge log records the class and count — never the content.`
        }
        confirmLabel="Confirm purge"
        typedConfirmation="PURGE"
        danger
      />
    </div>
  );
}

/* ── Processors ──────────────────────────────────────────────────────────── */

function ProcessorsTab() {
  const [rows, setRows] = useState<Processor[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch<{ processors: Processor[] }>('/api/privacy/processors')
      .then((r) => {
        setRows(r.processors);
      })
      .catch((caught: unknown) => {
        setRows([]);
        setError(caught instanceof ApiError ? caught.message : 'Could not load processors');
      });
  }, []);

  return (
    <Card>
      <CardHeader
        title="Processors & DPAs"
        subtitle="Every third party that processes personal data — DPA status, expiry and owner."
      />
      {rows === null ? (
        <div className="p-4">
          <Skeleton className="h-12 w-full" />
        </div>
      ) : error !== null && rows.length === 0 ? (
        <div className="p-4">
          <EmptyState icon={<TriangleAlert />} title="Processors unavailable" description={error} />
        </div>
      ) : rows.length === 0 ? (
        <div className="p-4">
          <EmptyState
            icon={<Server />}
            title="No processors registered"
            description="Storage host, SMTP, Kent, booking and messaging providers belong here once a DPA row exists."
          />
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">{row.name}</p>
                <p className="text-xs text-ink-muted">
                  {row.purpose}
                  {row.ownerEmail ? ` · ${row.ownerEmail}` : ''}
                  {row.dpaExpiresOn ? ` · DPA to ${formatDay(row.dpaExpiresOn)}` : ''}
                </p>
              </div>
              <StatusBadge tone={statusTone(row.dpaStatus)}>{row.dpaStatus}</StatusBadge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ── Breach ──────────────────────────────────────────────────────────────── */

function BreachTab() {
  const [rows, setRows] = useState<BreachRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch<{ breaches: BreachRow[] }>('/api/privacy/breaches')
      .then((r) => {
        setRows(r.breaches);
      })
      .catch((caught: unknown) => {
        setRows([]);
        setError(caught instanceof ApiError ? caught.message : 'Could not load the breach register');
      });
  }, []);

  return (
    <Card>
      <CardHeader
        title="Breach register"
        subtitle="Append-only. Board and affected-principal notifications are recorded, never asserted."
      />
      {rows === null ? (
        <div className="p-4">
          <Skeleton className="h-12 w-full" />
        </div>
      ) : error !== null && rows.length === 0 ? (
        <div className="p-4">
          <EmptyState icon={<TriangleAlert />} title="Breach register unavailable" description={error} />
        </div>
      ) : rows.length === 0 ? (
        <div className="p-4">
          <EmptyState
            icon={<FileWarning />}
            title="No breaches recorded"
            description="When an incident is logged, discovery time and notification timestamps appear here."
          />
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((row) => (
            <li key={row.id} className="px-4 py-3">
              <p className="text-sm text-ink">{row.summary}</p>
              <p className="mt-1 text-xs text-ink-muted">
                Discovered {formatDay(row.discoveredAt)}
                {row.notifiedBoardAt
                  ? ` · board notified ${formatDay(row.notifiedBoardAt)}`
                  : ' · board not yet notified'}
                {row.notifiedPrincipalsAt
                  ? ` · principals notified ${formatDay(row.notifiedPrincipalsAt)}`
                  : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ── Notices ─────────────────────────────────────────────────────────────── */

function NoticesTab() {
  const [rows, setRows] = useState<NoticeRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch<{ notices: NoticeRow[] }>('/api/privacy/notices')
      .then((r) => {
        setRows(r.notices);
      })
      .catch((caught: unknown) => {
        // Current notice alone may still be available.
        void apiFetch<NoticeRow>('/api/privacy/notice')
          .then((notice) => {
            setRows([
              {
                id: notice.id,
                version: notice.version,
                principalClass: notice.principalClass,
                title: notice.title,
                effectiveFrom: notice.effectiveFrom,
                isCurrent: true,
              },
            ]);
          })
          .catch((inner: unknown) => {
            setRows([]);
            setError(
              inner instanceof ApiError
                ? inner.message
                : caught instanceof ApiError
                  ? caught.message
                  : 'Could not load notices',
            );
          });
      });
  }, []);

  return (
    <Card>
      <CardHeader
        title="Published notices"
        subtitle="Versioned per data-principal class. A new version forces re-acknowledgement."
      />
      {rows === null ? (
        <div className="p-4">
          <Skeleton className="h-12 w-full" />
        </div>
      ) : error !== null && rows.length === 0 ? (
        <div className="p-4">
          <EmptyState icon={<TriangleAlert />} title="Notices unavailable" description={error} />
        </div>
      ) : rows.length === 0 ? (
        <div className="p-4">
          <EmptyState
            icon={<ScrollText />}
            title="No privacy notice published"
            description="Publish a versioned notice before first login can collect acknowledgements."
          />
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">
                  {row.title}{' '}
                  <span className="font-normal text-ink-muted">v{String(row.version)}</span>
                </p>
                <p className="text-xs text-ink-muted">
                  {row.principalClass} · effective {formatDay(row.effectiveFrom)}
                </p>
              </div>
              {row.isCurrent ? <StatusBadge tone="positive">Current</StatusBadge> : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
