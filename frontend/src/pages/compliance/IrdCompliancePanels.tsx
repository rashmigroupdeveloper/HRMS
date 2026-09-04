/**
 * Stage 5.5 — POSH / grievance / whistleblower surfaces on `/compliance`.
 *
 * Honest empty states only. The IC banner is mandatory and must never invent
 * members — "awaiting sponsor appointment" until at least one row exists.
 */
import { useEffect, useState } from 'react';
import { Scale, ShieldAlert, Megaphone, TriangleAlert } from 'lucide-react';
import { ApiError, apiFetch } from '../../lib/api';
import { Button, Card, CardHeader, EmptyState, TextField, Textarea, toast } from '../../ui';

type IrdTab = 'posh' | 'grievance' | 'whistle';

interface IcResponse {
  members: { id: number; role: string }[];
  constituted: boolean;
  banner: string;
}

interface PoshCaseRow {
  id: number;
  caseRef: string;
  status: string;
  filedAt: string;
  isAnonymous: boolean;
}

interface GrievanceRow {
  id: number;
  caseRef: string;
  status: string;
  filedAt: string;
}

const IRD_TABS: { id: IrdTab; label: string }[] = [
  { id: 'posh', label: 'POSH' },
  { id: 'grievance', label: 'Grievance' },
  { id: 'whistle', label: 'Whistleblower' },
];

export function IrdCompliancePanels() {
  const [tab, setTab] = useState<IrdTab>('posh');

  return (
    <div className="space-y-4">
      <IcBanner />
      <div
        className="flex w-full max-w-md gap-1 overflow-x-auto rounded-full bg-surface-2 p-1"
        role="tablist"
        aria-label="Confidential concerns"
      >
        {IRD_TABS.map((entry) => (
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
      {tab === 'posh' ? (
        <PoshPanel />
      ) : tab === 'grievance' ? (
        <GrievancePanel />
      ) : (
        <WhistlePanel />
      )}
    </div>
  );
}

function IcBanner() {
  const [ic, setIc] = useState<IcResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch<IcResponse>('/api/ird/ic')
      .then(setIc)
      .catch((caught: unknown) => {
        setError(caught instanceof ApiError ? caught.message : 'Could not load IC status');
      });
  }, []);

  if (error !== null) {
    return (
      <Card className="border-0 bg-accent-soft/40">
        <p className="text-sm text-ink-muted">{error}</p>
      </Card>
    );
  }

  if (ic === null) {
    return (
      <Card className="border-0 bg-surface-2">
        <p className="text-sm text-ink-muted">Checking Internal Committee…</p>
      </Card>
    );
  }

  if (!ic.constituted) {
    return (
      <Card className="border-0 bg-accent-soft/50" role="status">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-accent-ink" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-ink">{ic.banner}</p>
            <p className="mt-1 text-sm text-ink-muted">
              POSH inquiries cannot be assigned until the sponsor appoints the Internal Committee.
              No placeholder members are shown.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card role="status">
      <p className="text-sm text-ink">
        Internal Committee constituted — {String(ic.members.length)} active member
        {ic.members.length === 1 ? '' : 's'}.
      </p>
    </Card>
  );
}

function PoshPanel() {
  const [summary, setSummary] = useState('');
  const [cases, setCases] = useState<PoshCaseRow[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void apiFetch<{ cases: PoshCaseRow[] }>('/api/ird/posh/cases')
      .then((data) => {
        setCases(data.cases);
        setListError(null);
      })
      .catch((caught: unknown) => {
        // Non-handlers see an honest empty filing surface, not a case queue.
        setCases([]);
        setListError(
          caught instanceof ApiError && caught.status === 403
            ? null
            : caught instanceof ApiError
              ? caught.message
              : 'Could not load cases',
        );
      });
  }, []);

  async function onFile(): Promise<void> {
    setSubmitting(true);
    try {
      const result = await apiFetch<{ id: number; caseRef: string }>('/api/ird/posh/file', {
        method: 'POST',
        body: JSON.stringify({ summary }),
      });
      toast.success(`Filed as ${result.caseRef}`);
      setSummary('');
    } catch (caught: unknown) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not file');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader
          title="File a POSH complaint"
          subtitle="Restricted channel — access to case files is logged. File as yourself; anonymous intake is also available via the poster QR."
        />
        <Textarea
          label="What happened"
          value={summary}
          onChange={(event) => {
            setSummary(event.target.value);
          }}
          rows={6}
          maxLength={8000}
        />
        <div className="mt-4">
          <Button
            disabled={submitting || summary.trim().length < 10}
            onClick={() => {
              void onFile();
            }}
          >
            Submit to confidential intake
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader title="Handler queue" subtitle="Visible only with ird.posh.handle." />
        {listError !== null ? (
          <EmptyState icon={<TriangleAlert />} title="Unavailable" description={listError} />
        ) : cases === null ? (
          <p className="text-sm text-ink-muted">Loading…</p>
        ) : cases.length === 0 ? (
          <EmptyState
            icon={<Scale />}
            title="No POSH cases yet"
            description="When a complaint is filed, handlers with the POSH permission see it here. Opening a case requires step-up and is audited."
          />
        ) : (
          <ul className="space-y-2">
            {cases.map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-sm"
              >
                <span className="font-medium text-ink">{row.caseRef}</span>
                <span className="text-ink-muted">{row.status}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function GrievancePanel() {
  const [summary, setSummary] = useState('');
  const [rows, setRows] = useState<GrievanceRow[] | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void apiFetch<{ grievances: GrievanceRow[] }>('/api/ird/grievances')
      .then((data) => {
        setRows(data.grievances);
      })
      .catch(() => {
        setRows([]);
      });
  }, []);

  async function onFile(): Promise<void> {
    setSubmitting(true);
    try {
      const result = await apiFetch<{ caseRef: string }>('/api/ird/grievances/file', {
        method: 'POST',
        body: JSON.stringify({ summary }),
      });
      toast.success(`Grievance ${result.caseRef} filed`);
      setSummary('');
    } catch (caught: unknown) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not file');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader
          title="Raise a grievance"
          subtitle="Workplace grievance redressal (separate from POSH)."
        />
        <Textarea
          label="Describe the grievance"
          value={summary}
          onChange={(event) => {
            setSummary(event.target.value);
          }}
          rows={6}
          maxLength={8000}
        />
        <div className="mt-4">
          <Button
            disabled={submitting || summary.trim().length < 10}
            onClick={() => {
              void onFile();
            }}
          >
            Submit grievance
          </Button>
        </div>
      </Card>
      <Card>
        <CardHeader title="HR grievance queue" subtitle="Requires ird.grievance.handle." />
        {rows === null ? (
          <p className="text-sm text-ink-muted">Loading…</p>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Megaphone />}
            title="No grievances on file"
            description="Filed grievances appear here for HR handlers. The committee assignment is a later Stage 5.5 step."
          />
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-sm"
              >
                <span className="font-medium text-ink">{row.caseRef}</span>
                <span className="text-ink-muted">{row.status}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function WhistlePanel() {
  const [summary, setSummary] = useState('');
  const [claimToken, setClaimToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onFile(): Promise<void> {
    setSubmitting(true);
    try {
      const result = await apiFetch<{ id: number; claimToken: string }>('/api/ird/whistle/file', {
        method: 'POST',
        body: JSON.stringify({ summary }),
      });
      setClaimToken(result.claimToken);
      setSummary('');
      toast.success('Report accepted — save your claim code now');
    } catch (caught: unknown) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not submit');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Whistleblower channel"
        subtitle="Anonymous. No name, email or employee id is stored — only a claim-code hash for follow-up."
      />
      {claimToken !== null ? (
        <EmptyState
          icon={<ShieldAlert />}
          title="Save this claim code"
          description={
            <>
              This code is shown once. Store it safely to follow up later.
              <TextField label="Claim code" value={claimToken} readOnly />
            </>
          }
          action={
            <Button
              variant="ghost"
              onClick={() => {
                setClaimToken(null);
              }}
            >
              Submit another
            </Button>
          }
        />
      ) : (
        <>
          <Textarea
            label="Protected disclosure"
            value={summary}
            onChange={(event) => {
              setSummary(event.target.value);
            }}
            rows={6}
            maxLength={8000}
          />
          <div className="mt-4">
            <Button
              disabled={submitting || summary.trim().length < 10}
              onClick={() => {
                void onFile();
              }}
            >
              Submit anonymously
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
