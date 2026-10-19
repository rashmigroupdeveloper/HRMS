/**
 * Stage 5.5 — POSH / grievance / whistleblower surfaces.
 *
 * Enforces honest contracts:
 * - IC constitution banner: "IC not constituted — awaiting sponsor appointment"
 *   when empty (never invent committee members).
 * - POSH inquiries: assigned-case isolation, password step-up before case opening,
 *   explicit warning that all case opens are logged to an append-only audit trail.
 * - Anonymous channels: immediate single-use claim token generation with follow-up
 *   lookup without identifying disclosure.
 */
import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Copy,
  FileCheck,
  Megaphone,
  Scale,
  Search,
  Shield,
  ShieldAlert,
  UserCheck,
} from 'lucide-react';
import { ApiError, apiFetch } from '../../lib/api';
import {
  Button,
  Card,
  CardHeader,
  Drawer,
  EmptyState,
  StatusBadge,
  TextField,
  Textarea,
  toast,
} from '../../ui';
import { useStepUpAction } from '../../app/useStepUpAction';

type IrdTab = 'posh' | 'grievance' | 'whistle';

interface IcMember {
  id: number;
  employeeId: number;
  role: 'presiding_officer' | 'member' | 'external';
  active: boolean;
  appointedOn: string;
}

interface IcResponse {
  members: IcMember[];
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

interface PoshCaseDetail {
  id: number;
  caseRef: string;
  status: string;
  filedAt: string;
  isAnonymous: boolean;
  summary: string;
}

interface GrievanceRow {
  id: number;
  caseRef: string;
  status: string;
  filedAt: string;
}

interface WhistleReportRow {
  id: number;
  status: string;
  filedAt: string;
  summary: string;
}

const TABS: { id: IrdTab; label: string; icon: typeof Scale }[] = [
  { id: 'posh', label: 'POSH & Harassment', icon: Scale },
  { id: 'grievance', label: 'Workplace Grievances', icon: Megaphone },
  { id: 'whistle', label: 'Whistleblower Disclosures', icon: ShieldAlert },
];

export function IrdCompliancePanels() {
  const [activeTab, setActiveTab] = useState<IrdTab>('posh');
  const [icData, setIcData] = useState<IcResponse | null>(null);

  useEffect(() => {
    void apiFetch<IcResponse>('/api/ird/ic')
      .then(setIcData)
      .catch(() => {
        setIcData(null);
      });
  }, []);

  return (
    <div className="space-y-6">
      {/* IC Constitution Banner */}
      {icData !== null && (
        <div
          role="region"
          aria-label="Committee Status"
          className={`rounded-2xl border p-4 ${
            icData.constituted
              ? 'border-emerald-500/20 bg-emerald-500/5 text-ink'
              : 'border-amber-500/20 bg-amber-500/5 text-ink'
          }`}
        >
          <div className="flex items-center gap-3">
            {icData.constituted ? (
              <UserCheck className="h-5 w-5 text-emerald-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-amber-600" />
            )}
            <div>
              <p className="font-semibold">{icData.banner}</p>
              <p className="text-xs text-ink-muted">
                {icData.constituted
                  ? `${String(icData.members.length)} appointed internal committee members active.`
                  : 'Zero members seeded — formal appointment of the Internal Committee is a sponsor decision.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div
        className="flex w-full gap-1 overflow-x-auto rounded-full bg-surface-2 p-1"
        role="tablist"
        aria-label="Concerns and Redressal Sections"
      >
        {TABS.map((entry) => {
          const Icon = entry.icon;
          const isSelected = activeTab === entry.id;
          return (
            <Button
              key={entry.id}
              size="sm"
              role="tab"
              aria-selected={isSelected}
              variant={isSelected ? 'primary' : 'ghost'}
              onClick={() => {
                setActiveTab(entry.id);
              }}
              className="flex items-center gap-2"
            >
              <Icon className="h-4 w-4" />
              <span>{entry.label}</span>
            </Button>
          );
        })}
      </div>

      {/* Panels */}
      {activeTab === 'posh' ? (
        <PoshPanel />
      ) : activeTab === 'grievance' ? (
        <GrievancePanel />
      ) : (
        <WhistlePanel />
      )}
    </div>
  );
}

/* ── POSH Panel ─────────────────────────────────────────────────────────── */

function PoshPanel() {
  const [summary, setSummary] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [anonClaimToken, setAnonClaimToken] = useState<string | null>(null);

  // Queue state (for inquiry handlers)
  const [cases, setCases] = useState<PoshCaseRow[] | null>(null);
  const [selectedCase, setSelectedCase] = useState<PoshCaseDetail | null>(null);
  const { run: runWithStepUp, dialog: stepUpDialog } = useStepUpAction();

  // Claim tracking
  const [lookupToken, setLookupToken] = useState('');
  const [claimStatus, setClaimStatus] = useState<{
    caseRef: string;
    status: string;
    filedAt: string;
  } | null>(null);
  const [claimLooking, setClaimLooking] = useState(false);

  useEffect(() => {
    void apiFetch<{ cases: PoshCaseRow[] }>('/api/ird/posh/cases')
      .then((data) => {
        setCases(data.cases);
      })
      .catch((caught: unknown) => {
        if (caught instanceof ApiError && caught.status === 403) {
          setCases([]); // Non-handlers see empty queue
        } else {
          setCases([]);
        }
      });
  }, []);

  async function onFile(): Promise<void> {
    setSubmitting(true);
    try {
      if (isAnonymous) {
        const result = await apiFetch<{ id: number; caseRef: string; claimToken: string }>(
          '/api/ird/posh/file-anonymous',
          {
            method: 'POST',
            body: JSON.stringify({ summary }),
          },
        );
        setAnonClaimToken(result.claimToken);
        setSummary('');
        toast.success(`Filed anonymously as ${result.caseRef}`);
      } else {
        const result = await apiFetch<{ id: number; caseRef: string }>('/api/ird/posh/file', {
          method: 'POST',
          body: JSON.stringify({ summary }),
        });
        toast.success(`Complaint filed: ${result.caseRef}`);
        setSummary('');
      }
    } catch (caught: unknown) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not submit complaint');
    } finally {
      setSubmitting(false);
    }
  }

  async function onOpenCase(caseId: number): Promise<void> {
    try {
      await runWithStepUp(
        async () => {
          const detail = await apiFetch<PoshCaseDetail>(`/api/ird/posh/cases/${String(caseId)}`);
          setSelectedCase(detail);
        },
        'Re-enter your password to open this confidential inquiry file. Access is logged to the audit trail.',
      );
    } catch (caught: unknown) {
      toast.error(caught instanceof ApiError ? caught.message : 'Access denied to this case');
    }
  }

  async function onCheckClaim(): Promise<void> {
    if (lookupToken.trim().length !== 64) {
      toast.error('Claim code must be exactly 64 hexadecimal characters');
      return;
    }
    setClaimLooking(true);
    try {
      const res = await apiFetch<{ caseRef: string; status: string; filedAt: string }>(
        '/api/ird/posh/claim-status',
        {
          method: 'POST',
          body: JSON.stringify({ claimToken: lookupToken.trim() }),
        },
      );
      setClaimStatus(res);
    } catch (caught: unknown) {
      toast.error(caught instanceof ApiError ? caught.message : 'Complaint not found');
      setClaimStatus(null);
    } finally {
      setClaimLooking(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Filing Card */}
        <Card>
          <CardHeader
            title="File a POSH complaint"
            subtitle="Confidential inquiry channel under the Sexual Harassment of Women at Workplace Act 2013."
          />
          <div className="space-y-4">
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="radio"
                  name="posh_type"
                  checked={!isAnonymous}
                  onChange={() => {
                    setIsAnonymous(false);
                  }}
                  className="accent-primary"
                />
                <span>Authenticated (File as myself)</span>
              </label>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="radio"
                  name="posh_type"
                  checked={isAnonymous}
                  onChange={() => {
                    setIsAnonymous(true);
                  }}
                  className="accent-primary"
                />
                <span>Anonymous (QR Channel)</span>
              </label>
            </div>

            <Textarea
              label="Incident Description & Specifics"
              value={summary}
              onChange={(e) => {
                setSummary(e.target.value);
              }}
              rows={6}
              maxLength={8000}
              placeholder="Describe the incident, date, location, and involved persons..."
            />

            <div className="flex items-center justify-between">
              <span className="text-xs text-ink-muted">
                {summary.trim().length < 10
                  ? 'Minimum 10 characters required'
                  : `${String(summary.length)} / 8000 chars`}
              </span>
              <Button
                disabled={submitting || summary.trim().length < 10}
                onClick={() => {
                  void onFile();
                }}
              >
                {isAnonymous ? 'Submit Anonymously' : 'Submit to Inquiry Intake'}
              </Button>
            </div>

            {anonClaimToken !== null && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-primary">
                    Anonymous Claim Code (Store Safely)
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      void navigator.clipboard.writeText(anonClaimToken);
                      toast.success('Claim code copied');
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </Button>
                </div>
                <p className="font-mono text-xs break-all text-ink select-all">{anonClaimToken}</p>
                <p className="text-xs text-ink-muted">
                  This code is shown only once. You will need it to check progress on your submission.
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Assigned Handler Queue */}
        <Card>
          <CardHeader
            title="Inquiry queue"
            subtitle="Restricted to assigned inquiry officers and active Presiding Officers. Opening a case requires password confirmation and is logged."
          />
          {cases === null ? (
            <p className="text-sm text-ink-muted">Loading assigned cases…</p>
          ) : cases.length === 0 ? (
            <EmptyState
              icon={<Scale />}
              title="No assigned cases"
              description="Under assigned-case isolation, only cases explicitly assigned to you are listed. General HR browsing is blocked."
            />
          ) : (
            <ul className="space-y-3">
              {cases.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between rounded-xl border border-surface-3 bg-surface-2 p-3 text-sm"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-ink">{row.caseRef}</span>
                      {row.isAnonymous && (
                        <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[10px] text-ink-muted">
                          Anonymous
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-ink-muted">
                      Filed {new Date(row.filedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge
                      tone={
                        row.status === 'closed'
                          ? 'positive'
                          : row.status === 'under_inquiry'
                            ? 'warning'
                            : 'neutral'
                      }
                    >
                      {row.status.replace('_', ' ')}
                    </StatusBadge>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        void onOpenCase(row.id);
                      }}
                    >
                      Open Case
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Anonymous Follow-Up Section */}
      <Card>
        <CardHeader
          title="Track anonymous complaint status"
          subtitle="Enter your 64-character claim token to inspect the status of your filing."
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <TextField
              label="Claim Code"
              value={lookupToken}
              onChange={(e) => {
                setLookupToken(e.target.value);
              }}
              placeholder="Paste 64-character hex claim code..."
            />
          </div>
          <Button
            disabled={claimLooking || lookupToken.trim().length !== 64}
            onClick={() => {
              void onCheckClaim();
            }}
          >
            <Search className="h-4 w-4" />
            Check Status
          </Button>
        </div>

        {claimStatus !== null && (
          <div className="mt-4 rounded-xl border border-surface-3 bg-surface-2 p-4 flex items-center justify-between">
            <div>
              <p className="font-semibold text-ink">{claimStatus.caseRef}</p>
              <p className="text-xs text-ink-muted">
                Filed on {new Date(claimStatus.filedAt).toLocaleString()}
              </p>
            </div>
            <StatusBadge tone={claimStatus.status === 'closed' ? 'positive' : 'warning'}>
              {claimStatus.status.replace('_', ' ')}
            </StatusBadge>
          </div>
        )}
      </Card>

      {/* Case Detail Drawer */}
      <Drawer
        open={selectedCase !== null}
        onClose={() => {
          setSelectedCase(null);
        }}
        title={selectedCase ? `Inquiry File — ${selectedCase.caseRef}` : 'Inquiry File'}
        subtitle="Confidential POSH case details"
        width={520}
      >
        {selectedCase !== null && (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-900">
              <div className="flex items-center gap-2 font-semibold">
                <Shield className="h-4 w-4 text-amber-700" />
                <span>Restricted inquiry file — access logged</span>
              </div>
              <p className="mt-1 text-ink-muted">
                Your user session, timestamp, and network address have been recorded to the
                append-only case access log.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-xs text-ink-muted">Status</span>
                <p className="font-medium capitalize">{selectedCase.status.replace('_', ' ')}</p>
              </div>
              <div>
                <span className="text-xs text-ink-muted">Filed At</span>
                <p className="font-medium">{new Date(selectedCase.filedAt).toLocaleString()}</p>
              </div>
            </div>

            <div>
              <span className="text-xs text-ink-muted">Case Statement / Summary</span>
              <div className="mt-1 whitespace-pre-wrap rounded-lg bg-surface-2 p-3 text-sm text-ink">
                {selectedCase.summary}
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-surface-3">
              <Button
                variant="secondary"
                onClick={() => {
                  setSelectedCase(null);
                }}
              >
                Close File
              </Button>
            </div>
          </div>
        )}
      </Drawer>

      {stepUpDialog}
    </div>
  );
}

/* ── Grievance Panel ─────────────────────────────────────────────────────── */

function GrievancePanel() {
  const [summary, setSummary] = useState('');
  const [myGrievances, setMyGrievances] = useState<GrievanceRow[] | null>(null);
  const [hrGrievances, setHrGrievances] = useState<GrievanceRow[] | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void apiFetch<{ grievances: GrievanceRow[] }>('/api/ird/grievances/mine')
      .then((data) => {
        setMyGrievances(data.grievances);
      })
      .catch(() => {
        setMyGrievances([]);
      });

    void apiFetch<{ grievances: GrievanceRow[] }>('/api/ird/grievances')
      .then((data) => {
        setHrGrievances(data.grievances);
      })
      .catch(() => {
        setHrGrievances(null); // Not an HR handler
      });
  }, []);

  async function onFile(): Promise<void> {
    setSubmitting(true);
    try {
      const res = await apiFetch<{ id: number; caseRef: string }>('/api/ird/grievances/file', {
        method: 'POST',
        body: JSON.stringify({ summary }),
      });
      toast.success(`Grievance raised: ${res.caseRef}`);
      setSummary('');
      // Reload my list
      const updated = await apiFetch<{ grievances: GrievanceRow[] }>('/api/ird/grievances/mine');
      setMyGrievances(updated.grievances);
    } catch (caught: unknown) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not raise grievance');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader
          title="Raise a workplace grievance"
          subtitle="Formal workplace grievance redressal under the Industrial Relations Code."
        />
        <div className="space-y-4">
          <Textarea
            label="Grievance Details"
            value={summary}
            onChange={(e) => {
              setSummary(e.target.value);
            }}
            rows={6}
            maxLength={8000}
            placeholder="Describe your workplace grievance, affected policies, or supervisory concerns..."
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink-muted">
              {summary.trim().length < 10
                ? 'Minimum 10 characters required'
                : `${String(summary.length)} / 8000 chars`}
            </span>
            <Button
              disabled={submitting || summary.trim().length < 10}
              onClick={() => {
                void onFile();
              }}
            >
              Submit Grievance
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="My grievances"
          subtitle="Redressal status of grievances raised by your account."
        />
        {myGrievances === null ? (
          <p className="text-sm text-ink-muted">Loading your grievances…</p>
        ) : myGrievances.length === 0 ? (
          <EmptyState
            icon={<Megaphone />}
            title="No grievances raised"
            description="When you submit a grievance, track its review and escalation timeline here."
          />
        ) : (
          <ul className="space-y-2">
            {myGrievances.map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-sm"
              >
                <div>
                  <span className="font-medium text-ink">{row.caseRef}</span>
                  <p className="text-xs text-ink-muted">
                    Filed {new Date(row.filedAt).toLocaleDateString()}
                  </p>
                </div>
                <StatusBadge tone={row.status === 'closed' ? 'positive' : 'neutral'}>
                  {row.status.replace('_', ' ')}
                </StatusBadge>
              </li>
            ))}
          </ul>
        )}

        {/* HR Handler Queue if user holds ird.grievance.handle */}
        {hrGrievances !== null && (
          <div className="mt-6 border-t border-surface-3 pt-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-3">
              HR Grievance Handler Queue ({String(hrGrievances.length)})
            </h4>
            <ul className="space-y-2">
              {hrGrievances.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-sm"
                >
                  <span className="font-medium text-ink">{row.caseRef}</span>
                  <StatusBadge tone={row.status === 'resolved' ? 'positive' : 'warning'}>
                    {row.status.replace('_', ' ')}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ── Whistleblower Panel ─────────────────────────────────────────────────── */

function WhistlePanel() {
  const [summary, setSummary] = useState('');
  const [claimToken, setClaimToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Status check
  const [lookupToken, setLookupToken] = useState('');
  const [lookupResult, setLookupResult] = useState<{ status: string; filedAt: string } | null>(
    null,
  );
  const [looking, setLooking] = useState(false);

  // Triage queue (for ird.whistle.intake holders)
  const [reports, setReports] = useState<WhistleReportRow[] | null>(null);

  useEffect(() => {
    void apiFetch<{ reports: WhistleReportRow[] }>('/api/ird/whistle/reports')
      .then((data) => {
        setReports(data.reports);
      })
      .catch(() => {
        setReports(null); // Not a whistle triage handler
      });
  }, []);

  async function onFile(): Promise<void> {
    setSubmitting(true);
    try {
      const res = await apiFetch<{ id: number; claimToken: string }>('/api/ird/whistle/file', {
        method: 'POST',
        body: JSON.stringify({ summary }),
      });
      setClaimToken(res.claimToken);
      setSummary('');
      toast.success('Protected disclosure received. Save your claim code.');
    } catch (caught: unknown) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not submit disclosure');
    } finally {
      setSubmitting(false);
    }
  }

  async function onLookup(): Promise<void> {
    if (lookupToken.trim().length !== 64) {
      toast.error('Claim code must be 64 characters');
      return;
    }
    setLooking(true);
    try {
      const res = await apiFetch<{ status: string; filedAt: string }>(
        '/api/ird/whistle/claim-status',
        {
          method: 'POST',
          body: JSON.stringify({ claimToken: lookupToken.trim() }),
        },
      );
      setLookupResult(res);
    } catch (caught: unknown) {
      toast.error(caught instanceof ApiError ? caught.message : 'Report not found');
      setLookupResult(null);
    } finally {
      setLooking(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Make a protected disclosure"
            subtitle="Completely anonymous. No name, email, IP, or employee account is linked or stored."
          />
          {claimToken !== null ? (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
              <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                <FileCheck className="h-5 w-5" />
                <span>Disclosure Accepted — Save Claim Code</span>
              </div>
              <p className="text-xs text-ink-muted">
                This 64-character code is generated once. Without it, you cannot retrieve status or
                submit follow-up evidence.
              </p>
              <div className="flex items-center justify-between rounded-lg bg-surface-1 p-2 font-mono text-xs break-all">
                <span>{claimToken}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    void navigator.clipboard.writeText(claimToken);
                    toast.success('Claim code copied');
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setClaimToken(null);
                }}
              >
                Submit another disclosure
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <Textarea
                label="Protected Disclosure Details"
                value={summary}
                onChange={(e) => {
                  setSummary(e.target.value);
                }}
                rows={6}
                maxLength={8000}
                placeholder="Disclose illegal acts, environmental safety violations, fraud, or kickbacks..."
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-ink-muted">
                  {summary.trim().length < 10
                    ? 'Minimum 10 characters required'
                    : `${String(summary.length)} / 8000 chars`}
                </span>
                <Button
                  disabled={submitting || summary.trim().length < 10}
                  onClick={() => {
                    void onFile();
                  }}
                >
                  Submit Anonymously
                </Button>
              </div>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Follow up on your disclosure"
            subtitle="Inspect status of your report using your confidential claim token."
          />
          <div className="space-y-4">
            <TextField
              label="Claim Code"
              value={lookupToken}
              onChange={(e) => {
                setLookupToken(e.target.value);
              }}
              placeholder="Paste 64-character hex claim code..."
            />
            <Button
              disabled={looking || lookupToken.trim().length !== 64}
              onClick={() => {
                void onLookup();
              }}
            >
              <Search className="h-4 w-4" />
              Check Status
            </Button>

            {lookupResult !== null && (
              <div className="rounded-xl border border-surface-3 bg-surface-2 p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs text-ink-muted">Report Status</span>
                  <p className="font-semibold capitalize text-ink">
                    {lookupResult.status.replace('_', ' ')}
                  </p>
                  <p className="text-xs text-ink-muted">
                    Filed on {new Date(lookupResult.filedAt).toLocaleString()}
                  </p>
                </div>
                <StatusBadge tone={lookupResult.status === 'closed' ? 'positive' : 'warning'}>
                  {lookupResult.status}
                </StatusBadge>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Triage queue for authorized whistle handlers */}
      {reports !== null && (
        <Card>
          <CardHeader
            title="Whistleblower intake & triage"
            subtitle="Restricted queue for authorized ethics & audit intake officers (ird.whistle.intake)."
          />
          {reports.length === 0 ? (
            <EmptyState
              icon={<ShieldAlert />}
              title="No reports to triage"
              description="New protected disclosures will appear here for audit review."
            />
          ) : (
            <ul className="space-y-3">
              {reports.map((row) => (
                <li
                  key={row.id}
                  className="rounded-xl border border-surface-3 bg-surface-2 p-4 space-y-2 text-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-ink-muted">
                      Received {new Date(row.filedAt).toLocaleString()}
                    </span>
                    <StatusBadge tone={row.status === 'closed' ? 'positive' : 'warning'}>
                      {row.status}
                    </StatusBadge>
                  </div>
                  <p className="text-ink">{row.summary}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
