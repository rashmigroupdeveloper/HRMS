/**
 * `/compliance` — statutory registrations, licences, compliance calendar & IRD redressal
 * (Phase 5 Stage 5.5 & Stage 5.7 · CMP-15..20, PSH-01..10, GRV-01..06).
 *
 * Warm Editorial compliance center:
 *  - Posture board: entity-level compliance risk at a glance.
 *  - Licences & registrations: tracking validity, perpetual status, and alert stages.
 *  - Compliance calendar: statutory filings, append-only challan evidence, waivers.
 *  - Reminder receipts: proven notifications dispatched to owners.
 *  - Concerns & redressal: confidential POSH, grievances, and whistleblower intake.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Bell,
  CalendarClock,
  FileCheck2,
  ScrollText,
  ShieldAlert,
  TriangleAlert,
} from 'lucide-react';
import { ApiError, apiFetch } from '../../lib/api';
import {
  Button,
  Card,
  CardHeader,
  DataTable,
  EmptyState,
  PageHeader,
  Skeleton,
  StatusBadge,
  TextField,
  toast,
} from '../../ui';
import type { Column, StatusTone } from '../../ui';
import { IrdCompliancePanels } from './IrdCompliancePanels';

type Tab = 'posture' | 'licences' | 'calendar' | 'ird';

type ExpiryState = 'perpetual' | 'valid' | 'expiring' | 'expired';

interface Expiry {
  state: ExpiryState;
  daysRemaining: number | null;
  stage: number | null;
}

interface Registration {
  id: number;
  companyName: string;
  locationName: string | null;
  kind: string;
  registrationNo: string;
  validTo: string | null;
  renewalOwnerEmail: string | null;
  expiry: Expiry;
}

interface CalendarItem {
  id: number;
  companyName: string;
  obligationCode: string;
  title: string;
  periodLabel: string;
  dueOn: string;
  ownerEmail: string | null;
  status: 'due' | 'overdue' | 'filed' | 'waived';
  daysUntilDue: number;
  evidenceCount: number;
}

interface Posture {
  companies: {
    companyId: number;
    companyName: string;
    expired: number;
    expiring: number;
    valid: number;
    perpetual: number;
  }[];
  overdueFilings: number;
}

const KIND_LABEL: Record<string, string> = {
  pf: 'PF',
  esic: 'ESIC',
  pt: 'Professional Tax',
  lwf: 'Labour Welfare Fund',
  factory_licence: 'Factory licence',
  clra_licence: 'CLRA licence',
  shops: 'Shops & Establishments',
  single_registration: 'Single registration',
  other: 'Other',
};

const EXPIRY_TONE: Record<ExpiryState, StatusTone> = {
  expired: 'negative',
  expiring: 'warning',
  valid: 'positive',
  perpetual: 'neutral',
};

function expiryLabel(expiry: Expiry): string {
  if (expiry.state === 'perpetual') return 'No expiry';
  if (expiry.state === 'expired') return `Expired ${String(Math.abs(expiry.daysRemaining ?? 0))} d ago`;
  if (expiry.state === 'expiring') return `${String(expiry.daysRemaining ?? 0)} d left`;
  return 'Valid';
}

const STATUS_TONE: Record<CalendarItem['status'], StatusTone> = {
  overdue: 'negative',
  due: 'info',
  filed: 'positive',
  waived: 'neutral',
};

const TABS: { id: Tab; label: string }[] = [
  { id: 'posture', label: 'Posture' },
  { id: 'licences', label: 'Licences' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'ird', label: 'Concerns & Redressal' },
];

export function CompliancePage() {
  const [tab, setTab] = useState<Tab>('posture');

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Compliance & Governance"
        title="Registrations, Calendar & Concerns"
        description="Statutory registrations, licence renewal ladders, filing calendar evidence, and confidential workplace grievance redressal."
      />

      <div
        className="flex w-full gap-1 overflow-x-auto rounded-full bg-surface-2 p-1"
        role="tablist"
        aria-label="Compliance sections"
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
        {tab === 'posture' ? (
          <PostureBoard onDrill={setTab} />
        ) : tab === 'licences' ? (
          <Licences />
        ) : tab === 'calendar' ? (
          <CalendarBoard />
        ) : (
          <IrdCompliancePanels />
        )}
      </div>
    </div>
  );
}

/* ── Posture Board ────────────────────────────────────────────────────────── */

function PostureBoard({ onDrill }: { onDrill: (tab: Tab) => void }) {
  const [data, setData] = useState<Posture | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch<Posture>('/api/compliance/posture')
      .then(setData)
      .catch((caught: unknown) => {
        setError(caught instanceof ApiError ? caught.message : 'Could not load compliance posture');
      });
  }, []);

  if (error !== null) {
    return (
      <Card>
        <div className="p-4">
          <EmptyState icon={<TriangleAlert />} title="Posture unavailable" description={error} />
        </div>
      </Card>
    );
  }

  if (data === null) {
    return (
      <Card>
        <div className="space-y-2 p-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </Card>
    );
  }

  const atRisk = data.companies.filter((c) => c.expired > 0 || c.expiring > 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <button
            type="button"
            className="u-press flex w-full items-center gap-4 p-4 text-left"
            onClick={() => {
              onDrill('calendar');
            }}
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-muted">
              <CalendarClock className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span
                className={`block text-3xl font-light tabular-nums ${
                  data.overdueFilings > 0 ? 'text-negative' : 'text-ink'
                }`}
              >
                {data.overdueFilings}
              </span>
              <span className="block text-sm text-ink-muted">
                overdue filing{data.overdueFilings === 1 ? '' : 's'}
              </span>
            </span>
          </button>
        </Card>
        <Card>
          <button
            type="button"
            className="u-press flex w-full items-center gap-4 p-4 text-left"
            onClick={() => {
              onDrill('licences');
            }}
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-muted">
              <ShieldAlert className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span
                className={`block text-3xl font-light tabular-nums ${
                  atRisk.length > 0 ? 'text-warning' : 'text-ink'
                }`}
              >
                {atRisk.length}
              </span>
              <span className="block text-sm text-ink-muted">
                entit{atRisk.length === 1 ? 'y' : 'ies'} with a licence expiring or expired
              </span>
            </span>
          </button>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Entity Conformance"
          subtitle="Statutory registrations and licences across all group entities. Expired first."
        />
        {data.companies.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={<ScrollText />}
              title="No registrations recorded yet"
              description="Add entity PF, ESIC, PT, LWF, Factory and CLRA registrations to track expiry alerts."
            />
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {data.companies.map((row) => (
              <li
                key={row.companyId}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <span className="text-sm font-medium text-ink">{row.companyName}</span>
                <span className="flex flex-wrap items-center gap-2">
                  {row.expired > 0 ? (
                    <StatusBadge tone="negative">{row.expired} expired</StatusBadge>
                  ) : null}
                  {row.expiring > 0 ? (
                    <StatusBadge tone="warning">{row.expiring} expiring</StatusBadge>
                  ) : null}
                  {row.expired === 0 && row.expiring === 0 ? (
                    <StatusBadge tone="positive">In order</StatusBadge>
                  ) : null}
                  <span className="text-xs text-ink-muted">
                    {row.valid + row.perpetual} other{row.valid + row.perpetual === 1 ? '' : 's'}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ── Licences Tab ─────────────────────────────────────────────────────────── */

function Licences() {
  const [rows, setRows] = useState<Registration[] | null>(null);
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [alertingId, setAlertingId] = useState<number | null>(null);

  const fetchRows = useCallback(() => {
    const query = attentionOnly ? '?needsAttentionOnly=true' : '';
    void apiFetch<{ rows: Registration[] }>(`/api/compliance/registrations${query}`)
      .then((result) => {
        setRows(result.rows);
      })
      .catch(() => {
        setRows([]);
      });
  }, [attentionOnly]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const triggerAlert = async (registrationId: number): Promise<void> => {
    setAlertingId(registrationId);
    try {
      const res = await apiFetch<{ ok: boolean; receipt?: { notificationId: number } }>(
        '/api/compliance/registrations/remind',
        {
          method: 'POST',
          body: JSON.stringify({ registrationId }),
        },
      );
      if (res.ok && res.receipt) {
        toast.success(`Expiry alert sent to renewal owner (receipt #${String(res.receipt.notificationId)})`);
      } else {
        toast.error('Could not send expiry alert');
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Alert dispatch failed');
    } finally {
      setAlertingId(null);
    }
  };

  const columns: Column<Registration>[] = [
    {
      key: 'kind',
      header: 'Registration',
      render: (row) => (
        <span>
          <span className="block font-medium text-ink">{KIND_LABEL[row.kind] ?? row.kind}</span>
          <span className="block text-xs text-ink-muted">{row.registrationNo}</span>
        </span>
      ),
    },
    {
      key: 'where',
      header: 'Held by',
      render: (row) => (
        <span>
          <span className="block text-ink">{row.companyName}</span>
          <span className="block text-xs text-ink-muted">{row.locationName ?? 'Entity level'}</span>
        </span>
      ),
    },
    {
      key: 'expiry',
      header: 'Validity',
      render: (row) => (
        <span className="flex flex-col gap-1">
          <StatusBadge tone={EXPIRY_TONE[row.expiry.state]}>{expiryLabel(row.expiry)}</StatusBadge>
          {row.validTo === null ? null : (
            <span className="text-xs text-ink-muted">to {row.validTo}</span>
          )}
        </span>
      ),
    },
    {
      key: 'owner',
      header: 'Renewal Owner & Action',
      render: (row) => (
        <div className="flex flex-wrap items-center gap-2">
          {row.renewalOwnerEmail === null ? (
            <StatusBadge tone="warning">Unassigned</StatusBadge>
          ) : (
            <>
              <span className="text-xs text-ink-muted">{row.renewalOwnerEmail}</span>
              {(row.expiry.state === 'expiring' || row.expiry.state === 'expired') && (
                <Button
                  size="sm"
                  variant="ghost"
                  loading={alertingId === row.id}
                  onClick={() => {
                    void triggerAlert(row.id);
                  }}
                  title="Dispatch alert receipt"
                >
                  <Bell className="size-3.5" aria-hidden="true" />
                  Alert
                </Button>
              )}
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader
        title="Registrations & Licences"
        subtitle="PF and perpetual registrations never expire; licences with end dates alert against T-90/30/15/7 ladders."
        action={
          <Button
            size="sm"
            variant={attentionOnly ? 'primary' : 'ghost'}
            onClick={() => {
              setAttentionOnly((value) => !value);
            }}
          >
            Needs attention
          </Button>
        }
      />
      {rows === null ? (
        <div className="space-y-2 p-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <div className="p-4">
          <EmptyState
            icon={<ScrollText />}
            title={attentionOnly ? 'Nothing needs attention' : 'No registrations recorded yet'}
            description={
              attentionOnly
                ? 'No licence is expired or inside its alert window.'
                : 'All statutory registrations will appear here once recorded.'
            }
          />
        </div>
      ) : (
        <DataTable rows={rows} columns={columns} rowKey={(row) => String(row.id)} />
      )}
    </Card>
  );
}

/* ── Calendar Tab ─────────────────────────────────────────────────────────── */

function CalendarBoard() {
  const [rows, setRows] = useState<CalendarItem[] | null>(null);
  const [includeSettled, setIncludeSettled] = useState(false);
  const [filing, setFiling] = useState<CalendarItem | null>(null);
  const [waiving, setWaiving] = useState<CalendarItem | null>(null);
  const [reference, setReference] = useState('');
  const [waiverReason, setWaiverReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [remindingId, setRemindingId] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => {
    setReloadKey((n) => n + 1);
  }, []);

  useEffect(() => {
    void apiFetch<{ rows: CalendarItem[] }>(
      `/api/compliance/calendar?includeSettled=${String(includeSettled)}`,
    )
      .then((result) => {
        setRows(result.rows);
      })
      .catch(() => {
        setRows([]);
      });
  }, [includeSettled, reloadKey]);

  const submitFiling = async (): Promise<void> => {
    if (filing === null) return;
    setBusy(true);
    try {
      await apiFetch('/api/compliance/calendar/file', {
        method: 'POST',
        body: JSON.stringify({
          itemId: filing.id,
          reference: reference.trim(),
          documentPath: null,
          remark: null,
        }),
      });
      toast.success(`${filing.title} recorded as filed with challan reference`);
      setFiling(null);
      setReference('');
      reload();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not record the filing');
    } finally {
      setBusy(false);
    }
  };

  const submitWaiver = async (): Promise<void> => {
    if (waiving === null) return;
    if (waiverReason.trim().length < 3) {
      toast.error('Waiver reason must be at least 3 characters');
      return;
    }
    setBusy(true);
    try {
      await apiFetch('/api/compliance/calendar/waive', {
        method: 'POST',
        body: JSON.stringify({
          itemId: waiving.id,
          reason: waiverReason.trim(),
        }),
      });
      toast.success(`${waiving.title} marked as waived`);
      setWaiving(null);
      setWaiverReason('');
      reload();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not waive the obligation');
    } finally {
      setBusy(false);
    }
  };

  const sendReminder = async (itemId: number): Promise<void> => {
    setRemindingId(itemId);
    try {
      const res = await apiFetch<{ ok: boolean; receipt?: { notificationId: number } }>(
        '/api/compliance/calendar/remind',
        {
          method: 'POST',
          body: JSON.stringify({ itemId }),
        },
      );
      if (res.ok && res.receipt) {
        toast.success(`Reminder receipt #${String(res.receipt.notificationId)} sent to obligation owner`);
      } else {
        toast.error('Could not send reminder');
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Reminder dispatch failed');
    } finally {
      setRemindingId(null);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Statutory Obligations Calendar"
        subtitle="Overdue filings are derived on read and always show. Evidence (challan reference) is append-only."
        action={
          <Button
            size="sm"
            variant={includeSettled ? 'primary' : 'ghost'}
            onClick={() => {
              setIncludeSettled((value) => !value);
            }}
          >
            {includeSettled ? 'Hide settled' : 'Show settled'}
          </Button>
        }
      />
      {rows === null ? (
        <div className="space-y-2 p-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <div className="p-4">
          <EmptyState
            icon={<FileCheck2 />}
            title="Nothing due"
            description="Recurring statutory obligations (ECR, ESIC, PT, LWF, 24Q, POSH annual) will appear here."
          />
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((row) => (
            <li key={row.id} className="px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                    {row.title}
                    <StatusBadge tone={STATUS_TONE[row.status]}>
                      {row.status === 'overdue'
                        ? `${String(Math.abs(row.daysUntilDue))} d late`
                        : row.status === 'due'
                          ? `due in ${String(row.daysUntilDue)} d`
                          : row.status}
                    </StatusBadge>
                  </p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {row.companyName} · {row.periodLabel} · due {row.dueOn}
                    {row.ownerEmail === null ? ' · unassigned' : ` · ${row.ownerEmail}`}
                    {row.evidenceCount > 0
                      ? ` · ${String(row.evidenceCount)} evidence record${row.evidenceCount === 1 ? '' : 's'}`
                      : ''}
                  </p>
                </div>

                {(row.status === 'due' || row.status === 'overdue') && (
                  <div className="flex flex-wrap items-center gap-2">
                    {row.ownerEmail !== null && (
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={remindingId === row.id}
                        onClick={() => {
                          void sendReminder(row.id);
                        }}
                        title="Send reminder receipt"
                      >
                        <Bell className="size-3.5" aria-hidden="true" />
                        Remind
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setFiling(row);
                        setWaiving(null);
                        setReference('');
                      }}
                    >
                      Record filing
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setWaiving(row);
                        setFiling(null);
                        setWaiverReason('');
                      }}
                    >
                      Waive
                    </Button>
                  </div>
                )}
              </div>

              {filing?.id === row.id && (
                <form
                  className="u-pop-in mt-3 flex flex-wrap items-end gap-2 rounded-xl border border-line bg-surface-2 p-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submitFiling();
                  }}
                >
                  <TextField
                    label="Challan / acknowledgement reference"
                    hint="Stored as append-only evidence — cannot be edited or deleted later."
                    className="min-w-56 flex-1"
                    value={reference}
                    onChange={(event) => {
                      setReference(event.target.value);
                    }}
                    required
                  />
                  <Button type="submit" loading={busy} disabled={reference.trim().length < 2}>
                    Save Evidence
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => {
                      setFiling(null);
                    }}
                  >
                    Cancel
                  </Button>
                </form>
              )}

              {waiving?.id === row.id && (
                <form
                  className="u-pop-in mt-3 flex flex-wrap items-end gap-2 rounded-xl border border-line bg-surface-2 p-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submitWaiver();
                  }}
                >
                  <TextField
                    label="Reason for waiver"
                    hint="Mandatory statutory waiver explanation (minimum 3 characters, audited)."
                    className="min-w-56 flex-1"
                    value={waiverReason}
                    onChange={(event) => {
                      setWaiverReason(event.target.value);
                    }}
                    required
                  />
                  <Button type="submit" loading={busy} disabled={waiverReason.trim().length < 3}>
                    Confirm Waiver
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => {
                      setWaiving(null);
                    }}
                  >
                    Cancel
                  </Button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
