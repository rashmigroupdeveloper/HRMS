/**
 * `/compliance` — statutory registrations, licences and the filing calendar
 * (Phase 5 Stage 5.7 · CMP-15..CMP-20).
 *
 * The screen is built around one question a compliance owner actually asks:
 * *what is about to go wrong, and whose name is against it?* So the landing
 * tab is a posture board, not a list — a filing cabinet sorted alphabetically
 * is what this replaces.
 *
 * Two rules from the extended-roadmap UX contract are load-bearing here:
 *  §8 evidence over assertion — a filed obligation shows its challan reference,
 *     never just a green tick;
 *  §9 expiry is a first-class state — `valid → expiring → expired` uses the
 *     same colour language that documents, gate passes and certifications will
 *     reuse in later stages.
 */
import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, FileCheck2, Percent, ScrollText, ShieldAlert, TriangleAlert } from 'lucide-react';
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
import { RegistersTab } from './RegistersTab';
import { IrdCompliancePanels } from './IrdCompliancePanels';
import { buildWageCheckComponents } from './wage-check';

type Tab = 'posture' | 'licences' | 'calendar' | 'wage' | 'registers' | 'ird';

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

/** ONE mapping from expiry state to tone, so every surface reads identically. */
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

const TABS: { id: Tab; label: string }[] = [
  { id: 'posture', label: 'Posture' },
  { id: 'licences', label: 'Licences' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'registers', label: 'Registers' },
  { id: 'wage', label: 'Wage rule' },
  { id: 'ird', label: 'POSH & concerns' },
];

export function CompliancePage() {
  const [tab, setTab] = useState<Tab>('posture');

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Master control · compliance"
        title="Registrations & filings"
        description="Every statutory registration across the group, when it expires, who owns the renewal — and every filing that is due, overdue or evidenced."
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
        ) : tab === 'registers' ? (
          <RegistersTab />
        ) : tab === 'ird' ? (
          <IrdCompliancePanels />
        ) : (
          <WageRuleBoard />
        )}
      </div>
    </div>
  );
}

/* ── Posture ─────────────────────────────────────────────────────────────── */

function PostureBoard({ onDrill }: { onDrill: (tab: Tab) => void }) {
  const [data, setData] = useState<Posture | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch<Posture>('/api/compliance/posture')
      .then(setData)
      .catch((caught: unknown) => {
        setError(caught instanceof ApiError ? caught.message : 'Could not load the posture');
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
          <Skeleton className="h-16 w-full" />
        </div>
      </Card>
    );
  }

  const atRisk = data.companies.filter((c) => c.expired > 0 || c.expiring > 0);

  return (
    <div className="space-y-4">
      {/* The two numbers that decide whether anyone needs to act today. */}
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
          title="By entity"
          subtitle="Fourteen legal entities, each with its own registrations. Expired first."
        />
        {data.companies.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={<ScrollText />}
              title="No registrations recorded yet"
              description="Add each entity's PF, ESIC, PT, LWF, Factory and CLRA registrations on the Licences tab. Expiry alerts start as soon as one has an end date."
            />
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {data.companies.map((row) => (
              <li
                key={row.companyId}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <span className="text-sm text-ink">{row.companyName}</span>
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

/* ── Licences ────────────────────────────────────────────────────────────── */

function Licences() {
  const [rows, setRows] = useState<Registration[] | null>(null);
  const [attentionOnly, setAttentionOnly] = useState(false);

  useEffect(() => {
    const query = attentionOnly ? '?needsAttentionOnly=true' : '';
    void apiFetch<{ rows: Registration[] }>(`/api/compliance/registrations${query}`)
      .then((result) => {
        setRows(result.rows);
      })
      .catch(() => {
        setRows([]);
      });
  }, [attentionOnly]);

  const columns: Column<Registration>[] = [
    {
      key: 'kind',
      header: 'Registration',
      render: (row) => (
        <span>
          <span className="block text-ink">{KIND_LABEL[row.kind] ?? row.kind}</span>
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
      header: 'Renewal owner',
      render: (row) =>
        row.renewalOwnerEmail === null ? (
          // An unowned renewal is the one that lapses, so it is called out.
          <StatusBadge tone="warning">Unassigned</StatusBadge>
        ) : (
          <span className="text-ink-muted">{row.renewalOwnerEmail}</span>
        ),
    },
  ];

  return (
    <Card>
      <CardHeader
        title="Registrations & licences"
        subtitle="A registration with no end date never expires; one with an end date is measured against the alert ladder."
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
                : "Record each entity's statutory registrations so their expiry can be tracked."
            }
          />
        </div>
      ) : (
        <DataTable rows={rows} columns={columns} rowKey={(row) => String(row.id)} />
      )}
    </Card>
  );
}

/* ── Calendar ────────────────────────────────────────────────────────────── */

const STATUS_TONE: Record<CalendarItem['status'], StatusTone> = {
  overdue: 'negative',
  due: 'info',
  filed: 'positive',
  waived: 'neutral',
};

function CalendarBoard() {
  const [rows, setRows] = useState<CalendarItem[] | null>(null);
  const [includeSettled, setIncludeSettled] = useState(false);
  const [filing, setFiling] = useState<CalendarItem | null>(null);
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
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
          reference,
          documentPath: null,
          remark: null,
        }),
      });
      toast.success(`${filing.title} recorded as filed`);
      setFiling(null);
      setReference('');
      reload();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not record the filing');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Statutory filings"
        subtitle="Overdue always shows, however far back. Recording a filing requires its challan or acknowledgement reference."
        action={
          <Button
            size="sm"
            variant={includeSettled ? 'primary' : 'ghost'}
            onClick={() => {
              setIncludeSettled((value) => !value);
            }}
          >
            Show settled
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
            description="Add the group's recurring obligations — ECR, ESIC, PT, LWF, 24Q, POSH annual return — and they will appear here as their dates approach."
          />
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((row) => (
            <li key={row.id} className="px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm text-ink">
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
                    {/* §8 evidence over assertion — show the proof, not a tick. */}
                    {row.evidenceCount > 0
                      ? ` · ${String(row.evidenceCount)} evidence record${row.evidenceCount === 1 ? '' : 's'}`
                      : ''}
                  </p>
                </div>
                {row.status === 'due' || row.status === 'overdue' ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setFiling(row);
                      setReference('');
                    }}
                  >
                    Record filing
                  </Button>
                ) : null}
              </div>

              {filing?.id === row.id ? (
                <form
                  className="u-pop-in mt-3 flex flex-wrap items-end gap-2 rounded-xl border border-line bg-surface-2 p-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submitFiling();
                  }}
                >
                  <TextField
                    label="Challan / acknowledgement number"
                    hint="Stored as append-only evidence — it cannot be edited later."
                    className="min-w-56 flex-1"
                    value={reference}
                    onChange={(event) => {
                      setReference(event.target.value);
                    }}
                    required
                  />
                  <Button type="submit" disabled={busy || reference.trim().length < 2}>
                    Save
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
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ── Wage rule (CMP-01) ──────────────────────────────────────────────────── */

interface WageRule {
  requiredPct: number;
  settingKey: string;
}

interface WageCheckResult {
  ok: boolean;
  requiredPct: number;
  actualPct: number | null;
  basicDaPaise: number | null;
  ctcPaise: number | null;
}

function parseRupees(raw: string): number | null {
  const trimmed = raw.trim().replace(/,/g, '');
  if (trimmed === '') return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

function formatPct(value: number | null): string {
  if (value === null) return '—';
  const rounded = Math.round(value * 100) / 100;
  return `${String(rounded)}%`;
}

function WageRuleBoard() {
  const [rule, setRule] = useState<WageRule | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [basic, setBasic] = useState('50000');
  const [da, setDa] = useState('0');
  const [ctc, setCtc] = useState('100000');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<WageCheckResult | null>(null);

  useEffect(() => {
    void apiFetch<WageRule>('/api/compliance/wage-rule')
      .then(setRule)
      .catch((caught: unknown) => {
        setError(caught instanceof ApiError ? caught.message : 'Could not load the wage rule');
      });
  }, []);

  const runCheck = async (): Promise<void> => {
    const basicRupees = parseRupees(basic);
    const daRupees = parseRupees(da);
    const ctcRupees = parseRupees(ctc);
    if (basicRupees === null || daRupees === null || ctcRupees === null) {
      toast.error('Enter Basic, DA and CTC as rupee amounts');
      return;
    }
    const built = buildWageCheckComponents(basicRupees, daRupees, ctcRupees);
    if (!built.ok) {
      toast.error(built.error);
      return;
    }
    setBusy(true);
    try {
      const response = await apiFetch<WageCheckResult>('/api/compliance/wage-check', {
        method: 'POST',
        body: JSON.stringify({ components: built.components }),
      });
      setResult(response);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Wage check failed');
    } finally {
      setBusy(false);
    }
  };

  if (error !== null) {
    return (
      <Card>
        <div className="p-4">
          <EmptyState icon={<TriangleAlert />} title="Wage rule unavailable" description={error} />
        </div>
      </Card>
    );
  }
  if (rule === null) {
    return (
      <Card>
        <div className="space-y-2 p-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Labour Codes wage floor"
          subtitle="Basic + DA must meet the configured share of CTC before a structure can be saved (CMP-01)."
        />
        <div className="flex flex-wrap items-center gap-4 p-4 pt-0">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-muted">
            <Percent className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-3xl font-light tabular-nums text-ink">{formatPct(rule.requiredPct)}</p>
            <p className="text-sm text-ink-muted">
              required Basic+DA · from <code className="text-xs">{rule.settingKey}</code>
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Structure calculator"
          subtitle="Enter monthly rupees. The check uses the live setting — it does not hardcode fifty percent."
        />
        <form
          className="space-y-4 p-4 pt-0"
          onSubmit={(event) => {
            event.preventDefault();
            void runCheck();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <TextField
              label="Basic (₹)"
              inputMode="decimal"
              value={basic}
              onChange={(event) => {
                setBasic(event.target.value);
              }}
              required
            />
            <TextField
              label="DA (₹)"
              inputMode="decimal"
              value={da}
              onChange={(event) => {
                setDa(event.target.value);
              }}
              required
            />
            <TextField
              label="CTC (₹)"
              inputMode="decimal"
              value={ctc}
              onChange={(event) => {
                setCtc(event.target.value);
              }}
              required
            />
          </div>
          <Button type="submit" loading={busy}>
            Check structure
          </Button>
        </form>

        {result === null ? null : (
          <div
            className="mx-4 mb-4 rounded-xl border border-line bg-surface-2 p-4"
            role="status"
            aria-live="polite"
          >
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={result.ok ? 'positive' : 'negative'}>
                {result.ok ? 'Pass' : 'Fail'}
              </StatusBadge>
              <span className="text-sm text-ink">
                {result.ok
                  ? `Structure meets the ${formatPct(result.requiredPct)} Basic+DA floor.`
                  : `Structure fails the ${formatPct(result.requiredPct)} Basic+DA floor.`}
              </span>
            </div>
            <p className="mt-2 text-sm text-ink-muted">
              Actual Basic+DA share: {formatPct(result.actualPct)}
              {result.basicDaPaise === null || result.ctcPaise === null
                ? ''
                : ` · ₹${(result.basicDaPaise / 100).toLocaleString('en-IN')} of ₹${(result.ctcPaise / 100).toLocaleString('en-IN')} CTC`}
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
