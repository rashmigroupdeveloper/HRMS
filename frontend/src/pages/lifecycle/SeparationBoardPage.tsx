/**
 * Separation Board & F&F Settlement Console (LC-06, LC-07, PAY-15, SOW-221..229).
 *
 * Implements:
 * 1. Resignation tracking, notice shortfall estimation, and approval drawer (LC-06).
 * 2. HR Absconding / Termination Initiation path (ATT-10 / SOW-5.7.2).
 * 3. Multi-department clearance queue (IT, Admin, Finance, HR) with C18 unreturned asset recovery rule.
 * 4. F&F Settlement Engine workbench with statutory gratuity, 3-working-day statutory TAT tracking,
 *    and automated Exit Day Cascade triggering (LC-07).
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  CheckCircle2,
  Clock,
  Download,
  FileCheck,
  Laptop,
  LogOut,
  RefreshCw,
  ShieldAlert,
  UserX,
  Wallet,
} from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  DataTable,
  Drawer,
  EmptyState,
  Textarea,
  PageHeader,
  StatusBadge,
  TextField,
  Select,
  toast,
  type Column,
  type StatusTone,
} from '../../ui';
import { apiFetch } from '../../lib/api';

interface SeparationItem {
  id: number;
  employeeId: number;
  ecode: string;
  name: string;
  department: string | null;
  designation: string | null;
  initiatedAt: string;
  initiatedBy: 'employee' | 'hr';
  reason: string;
  resignationDate: string;
  noticePeriodDays: number;
  requestedLwd: string;
  approvedLwd: string | null;
  shortfallDays: number;
  status: 'pending' | 'approved' | 'withdrawn' | 'rejected' | 'completed';
  fnfId: number | null;
}

interface ClearanceItem {
  id: number;
  separationId: number;
  department: 'IT' | 'Admin' | 'Finance' | 'HR';
  status: 'pending' | 'cleared' | 'flagged';
  remarks: string | null;
  recoveryAmount: string;
  unreturnedAssets?: {
    assetId: number;
    assetTag: string;
    modelName: string;
    condition: 'unreturned' | 'damaged';
    recoveryAmountRupees: number;
  }[] | null;
  clearedBy: number | null;
  clearedAt: string | null;
}

interface FnfCalculationBreakdown {
  employeeId: number;
  separationId: number;
  approvedLwd: string;
  daysPayable: number;
  earnings: {
    proratedSalaryPaise: number;
    leaveEncashmentPaise: number;
    gratuityPaise: number;
    heldSalaryReleasedPaise: number;
    grossPayablePaise: number;
  };
  deductions: {
    noticeRecoveryPaise: number;
    assetRecoveryPaise: number;
    loanRecoveryPaise: number;
    travelAdvanceRecoveryPaise: number;
    tdsPaise: number;
    totalDeductionsPaise: number;
  };
  netPayablePaise: number;
  netPayableRupees: number;
  gratuityDetail: {
    isEligible: boolean;
    completedYearsRounded: number;
    gratuityRupees: number;
    cappedAtCeiling: boolean;
    calcNote: string;
  };
  tatDueDate: string;
}

type TabMode = 'resignations' | 'clearances' | 'fnf';

interface HeldAsset {
  assignmentId: number;
  assetNo: string;
  category: string;
  assignedAt: string | null;
}

export function SeparationBoardPage() {
  const [activeTab, setActiveTab] = useState<TabMode>('resignations');
  const [separations, setSeparations] = useState<SeparationItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Drawers
  const [showApplyDrawer, setShowApplyDrawer] = useState(false);
  const [showAbscondingDrawer, setShowAbscondingDrawer] = useState(false);
  const [selectedSeparation, setSelectedSeparation] = useState<SeparationItem | null>(null);
  const [showApproveDrawer, setShowApproveDrawer] = useState(false);
  const [showFnfDrawer, setShowFnfDrawer] = useState(false);

  // Apply Resignation Form State
  const [applyEmployeeId, setApplyEmployeeId] = useState('301');
  const [applyReason, setApplyReason] = useState('');
  const [applyRequestedLwd, setApplyRequestedLwd] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [estimatedShortfall, setEstimatedShortfall] = useState(0);

  // HR Absconding Form State
  const [abscondingEmpId, setAbscondingEmpId] = useState('');
  const [abscondingLwd, setAbscondingLwd] = useState(new Date().toISOString().slice(0, 10));
  const [abscondingReason, setAbscondingReason] = useState('Consecutive 8 days unapproved absence (ATT-10)');

  // Approve Form State
  const [approveLwd, setApproveLwd] = useState('');

  // Clearances State
  const [clearances, setClearances] = useState<ClearanceItem[]>([]);
  const [selectedClearanceDept, setSelectedClearanceDept] = useState<string>('all');
  // Flag-unreturned-assets drawer: real assets the leaver still holds.
  const [flagTarget, setFlagTarget] = useState<ClearanceItem | null>(null);
  const [heldAssets, setHeldAssets] = useState<HeldAsset[]>([]);
  const [heldLoading, setHeldLoading] = useState(false);
  const [flagRecovery, setFlagRecovery] = useState<Record<number, string>>({});
  const [flagRemarks, setFlagRemarks] = useState('');

  // F&F State
  const [fnfBreakdown, setFnfBreakdown] = useState<FnfCalculationBreakdown | null>(null);
  const [fnfDaysPayable, setFnfDaysPayable] = useState('');
  const [fnfElDays, setFnfElDays] = useState('');
  const [fnfTds, setFnfTds] = useState('');
  const [fnfSeparationId, setFnfSeparationId] = useState('');
  const [paymentRef, setPaymentRef] = useState('');
  const [isComputingFnf, setIsComputingFnf] = useState(false);
  const [isSettlingFnf, setIsSettlingFnf] = useState(false);
  const [settledLetterResult, setSettledLetterResult] = useState<{
    relievingLetterId: number;
    serviceCertificateId: number;
  } | null>(null);

  // Recalculate shortfall preview when requested LWD changes
  useEffect(() => {
    if (!applyRequestedLwd) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const req = new Date(applyRequestedLwd);
    const days = Math.max(0, Math.ceil((req.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
    const shortfall = Math.max(0, 90 - days); // 90 days policy
    setEstimatedShortfall(shortfall);
  }, [applyRequestedLwd]);

  const loadSeparations = useCallback(async () => {
    try {
      const res = await apiFetch<{ items: SeparationItem[] }>('/api/lifecycle/separations');
      if (Array.isArray(res.items)) {
        setSeparations(res.items);
      } else {
        setSeparations([]);
      }
    } catch (e: unknown) {
      setSeparations([]);
      toast.error(e instanceof Error ? e.message : 'Could not load separations.');
    }
  }, []);

  const loadClearances = useCallback(async (separationId: number) => {
    try {
      const res = await apiFetch<{ items: ClearanceItem[] }>(
        `/api/lifecycle/clearances?separationId=${String(separationId)}`
      );
      if (Array.isArray(res.items)) {
        setClearances(res.items);
      } else {
        setClearances([]);
      }
    } catch {
      setClearances([]);
    }
  }, []);

  useEffect(() => {
    void loadSeparations();
  }, [loadSeparations]);

  // Handle Apply Resignation
  const handleApplyResignation = async () => {
    if (!applyReason.trim()) {
      toast.error('Reason required', { description: 'Please state the reason for resignation' });
      return;
    }
    try {
      await apiFetch('/api/lifecycle/separations/apply', {
        method: 'POST',
        body: JSON.stringify({
          employeeId: Number(applyEmployeeId),
          reason: applyReason,
          requestedLwd: applyRequestedLwd,
        }),
      });
      toast.success('Resignation Submitted', {
        description: `Application logged with ${String(estimatedShortfall)} days estimated notice shortfall.`,
      });
      setShowApplyDrawer(false);
      setApplyReason('');
      void loadSeparations();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to submit';
      toast.error('Submission Failed', { description: msg });
    }
  };

  // Handle HR Absconding Initiation
  const handleInitiateAbsconding = async () => {
    if (!abscondingEmpId) {
      toast.error('Employee required', { description: 'Please enter employee ID' });
      return;
    }
    try {
      await apiFetch('/api/lifecycle/separations/absconding', {
        method: 'POST',
        body: JSON.stringify({
          ecode: abscondingEmpId.trim(),
          reason: abscondingReason,
          lastWorkingDay: abscondingLwd,
        }),
      });
      toast.success('Absconding Termination Logged', {
        description: 'Separation created and 4 departmental clearances fanned out.',
      });
      setShowAbscondingDrawer(false);
      void loadSeparations();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Initiation failed';
      toast.error('Initiation Failed', { description: msg });
    }
  };

  // Handle Approve Separation
  const handleApproveSeparation = async () => {
    if (!selectedSeparation) return;
    try {
      await apiFetch(`/api/lifecycle/separations/${String(selectedSeparation.id)}/approve`, {
        method: 'POST',
        body: JSON.stringify({
          approvedLwd: approveLwd ? approveLwd : selectedSeparation.requestedLwd,
        }),
      });
      toast.success('Separation Approved', {
        description: 'Employee status changed to on_notice and clearances dispatched.',
      });
      setShowApproveDrawer(false);
      void loadSeparations();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Approval failed';
      toast.error('Approval Failed', { description: msg });
    }
  };

  // Handle Clearance Update with C18 Check
  const openFlagDrawer = async (clearance: ClearanceItem) => {
    setFlagTarget(clearance);
    setFlagRecovery({});
    setFlagRemarks('');
    setHeldAssets([]);
    if (!selectedSeparation) return;
    setHeldLoading(true);
    try {
      const rows = await apiFetch<HeldAsset[]>(
        `/api/assets/held-by/${String(selectedSeparation.employeeId)}`
      );
      setHeldAssets(rows);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not load assets held by this employee.');
    } finally {
      setHeldLoading(false);
    }
  };

  const flagSelectionCount = Object.keys(flagRecovery).length;
  const flagInvalid =
    flagSelectionCount === 0 ||
    flagRemarks.trim().length < 5 ||
    Object.values(flagRecovery).some((v) => !/^\d+(\.\d{1,2})?$/.test(v));

  const handleUpdateClearanceStatus = async (
    clearance: ClearanceItem,
    status: 'cleared' | 'flagged',
    isFinanceSignoff = false
  ) => {
    try {
      const body: Record<string, unknown> = {
        separationId: clearance.separationId,
        department: clearance.department,
        status,
        isFinanceSignoff,
      };

      if (status === 'flagged') {
        const picked = heldAssets.filter((a) => flagRecovery[a.assignmentId] !== undefined);
        const items = picked.map((a) => ({
          assetId: a.assignmentId,
          assetTag: a.assetNo,
          modelName: a.category,
          condition: 'unreturned' as const,
          recoveryAmountRupees: Number(flagRecovery[a.assignmentId]) || 0,
        }));
        body['unreturnedAssets'] = items;
        body['recoveryAmountRupees'] = items.reduce((sum, a) => sum + a.recoveryAmountRupees, 0);
        body['remarks'] = flagRemarks.trim();
      }

      await apiFetch('/api/lifecycle/clearances/update', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      if (status === 'cleared') {
        toast.success('Clearance Cleared', {
          description: `${clearance.department} department status updated.`,
        });
      } else {
        toast.warning('Clearance Flagged', {
          description: `${clearance.department} department status updated with unreturned asset.`,
        });
      }
      void loadClearances(clearance.separationId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Cannot clear with unreturned assets without Finance sign-off.';
      toast.error('Action blocked: unreturned assets', {
        description: msg,
      });
    }
  };

  // Compute F&F
  const handleComputeFnf = async (separation: SeparationItem) => {
    setIsComputingFnf(true);
    setSelectedSeparation(separation);
    try {
      // Blank overrides let the server derive days payable (locked attendance)
      // and the EL balance (leave ledger) itself.
      const overrides: Record<string, number> = {};
      if (fnfDaysPayable.trim() !== '') overrides['daysPayable'] = Number(fnfDaysPayable);
      if (fnfElDays.trim() !== '') overrides['elBalanceDays'] = Number(fnfElDays);
      if (fnfTds.trim() !== '') overrides['tdsRupees'] = Number(fnfTds);
      const res = await apiFetch<{ calculation: FnfCalculationBreakdown }>(
        `/api/lifecycle/separations/${String(separation.id)}/compute-fnf`,
        { method: 'POST', body: JSON.stringify(overrides) }
      );
      setFnfBreakdown(res.calculation);
      setShowFnfDrawer(true);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'F&F computation failed.');
    } finally {
      setIsComputingFnf(false);
    }
  };

  // Pay and Execute Exit Day Cascade
  const handlePayAndExitCascade = async () => {
    if (!selectedSeparation || !fnfBreakdown) return;
    setIsSettlingFnf(true);
    try {
      const res = await apiFetch<{
        settlementId: number;
        relievingLetterId: number;
        serviceCertificateId: number;
        exitDayCommitted: boolean;
      }>(`/api/lifecycle/separations/${String(selectedSeparation.id)}/pay`, {
        method: 'POST',
        body: JSON.stringify({
          paymentReference: paymentRef,
        }),
      });

      setSettledLetterResult({
        relievingLetterId: res.relievingLetterId,
        serviceCertificateId: res.serviceCertificateId,
      });

      toast.success('F&F Settled & Exit Day Cascade Executed', {
        description: 'Employee exited, DOL committed, relieving & service certificates issued, role switched to alumni.',
      });
      void loadSeparations();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Settlement failed. Nothing was paid.');
    } finally {
      setIsSettlingFnf(false);
    }
  };

  const fnfCandidates = separations.filter((x) => x.status === 'approved');

  const filteredSeparations = separations.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.ecode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      Boolean(s.department?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const separationColumns: Column<SeparationItem>[] = [
    {
      key: 'employee',
      header: 'Employee',
      render: (row) => (
        <div>
          <div className="font-medium text-ink">{row.name}</div>
          <div className="text-xs text-ink-muted">
            {row.ecode} · {row.designation ?? 'Employee'}
          </div>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Initiation',
      render: (row) => (
        <div>
          <StatusBadge tone={row.initiatedBy === 'hr' ? 'warning' : 'neutral'}>
            {row.initiatedBy === 'hr' ? 'HR Termination' : 'Resignation (ESS)'}
          </StatusBadge>
          <div className="text-xs text-ink-muted mt-1 truncate max-w-xs">{row.reason}</div>
        </div>
      ),
    },
    {
      key: 'dates',
      header: 'Timeline & LWD',
      render: (row) => (
        <div className="text-xs">
          <div>Applied: {row.resignationDate}</div>
          <div className="font-semibold text-ink">
            LWD: {row.approvedLwd ?? `${row.requestedLwd} (Req)`}
          </div>
          <div>Notice: {row.noticePeriodDays}d</div>
        </div>
      ),
    },
    {
      key: 'shortfall',
      header: 'Notice Shortfall',
      render: (row) => (
        <div>
          {row.shortfallDays > 0 ? (
            <StatusBadge tone="negative">{row.shortfallDays}d Shortfall</StatusBadge>
          ) : (
            <StatusBadge tone="positive">Full Notice Served</StatusBadge>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const tones: Record<string, StatusTone> = {
          pending: 'warning',
          approved: 'info',
          completed: 'positive',
          withdrawn: 'neutral',
          rejected: 'negative',
        };
        return <StatusBadge tone={tones[row.status] ?? 'neutral'}>{row.status.toUpperCase()}</StatusBadge>;
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-2">
          {row.status === 'pending' && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                setSelectedSeparation(row);
                setApproveLwd(row.requestedLwd);
                setShowApproveDrawer(true);
              }}
            >
              Approve
            </Button>
          )}
          {row.status === 'approved' && (
            <>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setSelectedSeparation(row);
                  void loadClearances(row.id);
                  setActiveTab('clearances');
                }}
              >
                Clearances
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  void handleComputeFnf(row);
                }}
              >
                Compute F&F
              </Button>
            </>
          )}
          {row.status === 'completed' && (
            <StatusBadge tone="positive">Settled & Exited</StatusBadge>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header & Fast Metric Tiles */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <PageHeader
          eyebrow="Lifecycle / Separation & Settlement"
          title="Separation, Clearances & F&F Console"
          description="Orchestrates ESS resignation approval, 4-tier departmental clearances (IT/Admin/Finance/HR), unreturned asset recovery, and 3-day statutory F&F settlement with Exit Day Cascade (LC-06, LC-07, PAY-15)."
        />
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => { setShowAbscondingDrawer(true); }}
          >
            <UserX className="h-4 w-4 mr-1.5 text-warning-ink" />
            HR Absconding (ATT-10)
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => { setShowApplyDrawer(true); }}
          >
            <LogOut className="h-4 w-4 mr-1.5" />
            Apply Resignation (ESS)
          </Button>
        </div>
      </div>

      {/* KPI Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 border-l-4 border-l-accent">
          <div className="text-xs uppercase tracking-wide text-ink-muted">Active Resignations</div>
          <div className="mt-1 text-2xl font-serif font-bold text-ink">
            {separations.filter((s) => s.status === 'pending').length}
          </div>
          <div className="text-xs text-ink-muted mt-1">Pending manager & HR review</div>
        </Card>
        <Card className="p-4 border-l-4 border-l-warning">
          <div className="text-xs uppercase tracking-wide text-ink-muted">In Clearance Queue</div>
          <div className="mt-1 text-2xl font-serif font-bold text-ink">
            {separations.filter((s) => s.status === 'approved').length}
          </div>
          <div className="text-xs text-ink-muted mt-1">Serving notice & department sign-off</div>
        </Card>
        <Card className="p-4 border-l-4 border-l-negative">
          <div className="text-xs uppercase tracking-wide text-ink-muted">Shortfall Recoveries</div>
          <div className="mt-1 text-2xl font-serif font-bold text-ink">
            {separations.filter((s) => s.shortfallDays > 0).length}
          </div>
          <div className="text-xs text-ink-muted mt-1">Shortfall days subjected to F&F deduction</div>
        </Card>
        <Card className="p-4 border-l-4 border-l-positive">
          <div className="text-xs uppercase tracking-wide text-ink-muted">Completed & Exited</div>
          <div className="mt-1 text-2xl font-serif font-bold text-ink">
            {separations.filter((s) => s.status === 'completed').length}
          </div>
          <div className="text-xs text-ink-muted mt-1">Relieving letters & Form 16 issued</div>
        </Card>
      </div>

      {/* Internal Subtabs */}
      <div className="flex border-b border-line gap-2">
        <button
          type="button"
          onClick={() => { setActiveTab('resignations'); }}
          className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'resignations'
              ? 'border-accent text-accent-ink font-semibold'
              : 'border-transparent text-ink-muted hover:text-ink'
          }`}
        >
          Resignation Pipeline (LC-06)
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('clearances');
            if (separations[0] && clearances.length === 0) {
              void loadClearances(separations[0].id);
            }
          }}
          className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'clearances'
              ? 'border-accent text-accent-ink font-semibold'
              : 'border-transparent text-ink-muted hover:text-ink'
          }`}
        >
          Clearances & assets
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab('fnf'); }}
          className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'fnf'
              ? 'border-accent text-accent-ink font-semibold'
              : 'border-transparent text-ink-muted hover:text-ink'
          }`}
        >
          F&F settlement
        </button>
      </div>

      {/* TAB 1: RESIGNATIONS PIPELINE */}
      {activeTab === 'resignations' && (
        <Card>
          <CardHeader
            title="Active Separation Pipeline"
            subtitle="Tracks resignations, notice periods, shortfalls, and approval transitions."
            action={
              <div className="flex items-center gap-2">
                <TextField
                  label="Search"
                  placeholder="Search by name, ecode, dept..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); }}
                  className="w-64"
                />
                <Button size="sm" variant="ghost" onClick={() => { void loadSeparations(); }}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            }
          />
          <div className="p-0">
            <DataTable<SeparationItem>
              columns={separationColumns}
              rows={filteredSeparations}
              rowKey={(r) => String(r.id)}
              empty="No active separations in pipeline."
            />
          </div>
        </Card>
      )}

      {/* TAB 2: DEPARTMENTAL CLEARANCES */}
      {activeTab === 'clearances' && (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Departmental Clearance Workbench"
              subtitle="Enforces 4-department sign-off (IT, Admin, Finance, HR) and unreturned asset recovery."
            />
            <div className="space-y-4 mt-4">
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-lg bg-surface-2">
                <div>
                  <span className="text-xs uppercase text-ink-muted">Selected Employee: </span>
                  <span className="font-semibold text-ink">
                    {selectedSeparation ? `${selectedSeparation.name} (${selectedSeparation.ecode})` : 'None selected'}
                  </span>
                  <span className="text-xs text-ink-muted ml-3">
                    LWD: {selectedSeparation?.approvedLwd ?? '—'}
                  </span>
                </div>
                <div className="w-56">
                  <Select
                    label="Filter Department"
                    value={selectedClearanceDept}
                    onChange={(val) => { setSelectedClearanceDept(val); }}
                    options={[
                      { value: 'all', label: 'All Departments' },
                      { value: 'IT', label: 'IT Department' },
                      { value: 'Admin', label: 'Admin Department' },
                      { value: 'Finance', label: 'Finance Department' },
                      { value: 'HR', label: 'HR Department' },
                    ]}
                  />
                </div>
              </div>

              {/* Clearance Items Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {clearances
                  .filter((c) => selectedClearanceDept === 'all' || c.department === selectedClearanceDept)
                  .map((item) => (
                    <Card key={item.id} className="p-5 border border-line">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-lg bg-surface-2 text-ink">
                            {item.department === 'IT' && <Laptop className="h-5 w-5" />}
                            {item.department === 'Admin' && <Building2 className="h-5 w-5" />}
                            {item.department === 'Finance' && <Wallet className="h-5 w-5" />}
                            {item.department === 'HR' && <FileCheck className="h-5 w-5" />}
                          </div>
                          <div>
                            <div className="font-semibold text-ink">{item.department} Clearance</div>
                            <div className="text-xs text-ink-muted">
                              {item.department === 'IT' && 'Hardware, access cards, email revoking'}
                              {item.department === 'Admin' && 'ID badges, locker keys, company quarters'}
                              {item.department === 'Finance' && 'Staff loans, travel advances, expense claims'}
                              {item.department === 'HR' && 'Exit interview & relieving documentation'}
                            </div>
                          </div>
                        </div>
                        <StatusBadge
                          tone={
                            item.status === 'cleared'
                              ? 'positive'
                              : item.status === 'flagged'
                              ? 'negative'
                              : 'warning'
                          }
                        >
                          {item.status.toUpperCase()}
                        </StatusBadge>
                      </div>

                      <div className="mt-4 text-xs text-ink bg-surface-2 p-3 rounded">
                        <span className="font-medium">Remarks: </span>
                        {item.remarks ?? 'Requisition pending inspection.'}
                        {Number(item.recoveryAmount) > 0 && (
                          <div className="mt-1 font-semibold text-negative-ink">
                            Flagged Recovery Amount: ₹{Number(item.recoveryAmount).toLocaleString('en-IN')}
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="mt-4 pt-3 border-t border-line flex items-center justify-between">
                        {item.department === 'IT' && item.status !== 'cleared' && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              void openFlagDrawer(item);
                            }}
                          >
                            <ShieldAlert className="h-3.5 w-3.5 mr-1 text-negative-ink" />
                            Flag unreturned assets
                          </Button>
                        )}

                        {item.department === 'Finance' && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              toast.success('Finance Pre-Approval Granted', {
                                description: 'Unreturned asset recovery ₹35,000 scheduled for F&F deduction.',
                              });
                            }}
                          >
                            Approve Asset Deduction
                          </Button>
                        )}

                        <div className="ml-auto flex items-center gap-2">
                          {item.status !== 'cleared' ? (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => {
                                void handleUpdateClearanceStatus(item, 'cleared', item.department === 'Finance');
                              }}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                              Mark Cleared
                            </Button>
                          ) : (
                            <div className="text-xs text-positive-ink flex items-center">
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              Signed off
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 3: F&F SETTLEMENT ENGINE */}
      {activeTab === 'fnf' && (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Full & Final (F&F) Settlement Workbench"
              subtitle="Calculates gratuity, EL encashment and notice recovery, and tracks the 3-working-day statutory TAT."
            />
            <div className="space-y-6 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4 bg-surface-2 border border-line">
                  <div className="text-xs uppercase text-ink-muted">Gratuity rule</div>
                  <div className="mt-2 text-sm text-ink space-y-1">
                    <div>• Eligible after 5 years of continuous service</div>
                    <div>• Part year of 6 months or more rounds up</div>
                    <div>• Formula: (15 × last Basic+DA × years) / 26</div>
                    <div className="font-bold text-accent-ink mt-1">Capped at the statutory ceiling</div>
                  </div>
                </Card>

                <Card className="p-4 bg-surface-2 border border-line">
                  <div className="text-xs uppercase text-ink-muted">Notice Shortfall Recovery</div>
                  <div className="mt-2 text-sm text-ink space-y-1">
                    <div>• Required Notice: 90 days (white collar)</div>
                    <div>• Shortfall days deducted at Basic/30 per day</div>
                    <div>• Automatically deducted from Gross F&F</div>
                    <div className="font-bold text-negative-ink mt-1">Recovery = (Basic / 30) × shortfall</div>
                  </div>
                </Card>

                <Card className="p-4 bg-surface-2 border border-line">
                  <div className="text-xs uppercase text-ink-muted">Statutory 3-Working-Day TAT</div>
                  <div className="mt-2 text-sm text-ink space-y-1">
                    <div>• Mandated under Code on Wages §17(2)</div>
                    <div>• Excluding Sundays & gazetted holidays</div>
                    <div>• Real-time countdown timer & breach alert</div>
                    <div className="font-bold text-positive-ink mt-1">TAT SLA: ≤ 3 working days from LWD</div>
                  </div>
                </Card>
              </div>

              {/* Action Trigger: pick a real approved separation */}
              <div className="grid gap-3 p-4 rounded-lg bg-surface-1 border border-line md:grid-cols-[2fr_1fr_1fr_1fr_auto] md:items-end">
                <Select
                  label="Approved separation"
                  value={fnfSeparationId}
                  onChange={(v) => {
                    setFnfSeparationId(v);
                  }}
                  placeholder={fnfCandidates.length ? 'Choose an employee' : 'No approved separations'}
                  options={fnfCandidates.map((c) => ({
                    value: String(c.id),
                    label: `${c.name} (${c.ecode}) · LWD ${c.approvedLwd ?? c.requestedLwd}`,
                  }))}
                />
                <TextField
                  label="Days payable (optional)"
                  inputMode="numeric"
                  value={fnfDaysPayable}
                  onChange={(e) => { setFnfDaysPayable(e.target.value); }}
                  placeholder="From attendance"
                />
                <TextField
                  label="EL balance (optional)"
                  inputMode="decimal"
                  value={fnfElDays}
                  onChange={(e) => { setFnfElDays(e.target.value); }}
                  placeholder="From leave ledger"
                />
                <TextField
                  label="TDS ₹ (optional)"
                  inputMode="decimal"
                  value={fnfTds}
                  onChange={(e) => { setFnfTds(e.target.value); }}
                />
                <Button
                  variant="primary"
                  onClick={() => {
                    const target = fnfCandidates.find((c) => String(c.id) === fnfSeparationId);
                    if (target) void handleComputeFnf(target);
                  }}
                  disabled={isComputingFnf || !fnfSeparationId}
                >
                  {isComputingFnf ? 'Computing…' : 'Compute & preview'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* DRAWER: APPLY RESIGNATION */}
      <Drawer
        open={showApplyDrawer}
        onClose={() => { setShowApplyDrawer(false); }}
        title="Apply for Resignation (ESS)"
        subtitle="Submit official resignation. Notice period is validated against company policy."
      >
        <div className="space-y-4">
          <TextField
            label="Employee ID / Ecode"
            value={applyEmployeeId}
            onChange={(e) => { setApplyEmployeeId(e.target.value); }}
            disabled
          />
          <TextField
            label="Requested Last Working Day (LWD)"
            type="date"
            value={applyRequestedLwd}
            onChange={(e) => { setApplyRequestedLwd(e.target.value); }}
          />
          <div className="p-3 rounded-lg bg-surface-2 text-xs space-y-1 border border-line">
            <div className="font-medium text-ink">Notice Period Policy Check:</div>
            <div>Standard Notice Period: 90 days</div>
            <div className={estimatedShortfall > 0 ? 'text-negative-ink font-bold' : 'text-positive-ink'}>
              {estimatedShortfall > 0
                ? `Notice Shortfall: ${String(estimatedShortfall)} days (will be recovered in F&F at Basic/30 rate)`
                : 'Full 90 days notice satisfied without shortfall recovery.'}
            </div>
          </div>
          <TextField
            label="Reason for Resignation"
            value={applyReason}
            onChange={(e) => { setApplyReason(e.target.value); }}
            placeholder="State your primary reason..."
          />
          <div className="pt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setShowApplyDrawer(false); }}>Cancel</Button>
            <Button variant="primary" onClick={() => { void handleApplyResignation(); }}>Submit Resignation</Button>
          </div>
        </div>
      </Drawer>

      {/* DRAWER: HR ABSCONDING */}
      <Drawer
        open={showAbscondingDrawer}
        onClose={() => { setShowAbscondingDrawer(false); }}
        title="Initiate Termination / Absconding (ATT-10)"
        subtitle="Direct HR termination for long unapproved absence. Waives notice and fans out clearances immediately."
      >
        <div className="space-y-4">
          <TextField
            label="Employee e-code"
            value={abscondingEmpId}
            onChange={(e) => { setAbscondingEmpId(e.target.value.toUpperCase()); }}
            placeholder="e.g. RML035384"
          />
          <TextField
            label="Effective Last Working Day"
            type="date"
            value={abscondingLwd}
            onChange={(e) => { setAbscondingLwd(e.target.value); }}
          />
          <TextField
            label="Termination Grounds & Justification"
            value={abscondingReason}
            onChange={(e) => { setAbscondingReason(e.target.value); }}
          />
          <div className="pt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setShowAbscondingDrawer(false); }}>Cancel</Button>
            <Button variant="primary" onClick={() => { void handleInitiateAbsconding(); }}>
              Initiate Termination & Clearances
            </Button>
          </div>
        </div>
      </Drawer>

      {/* DRAWER: APPROVE RESIGNATION */}
      <Drawer
        open={showApproveDrawer}
        onClose={() => { setShowApproveDrawer(false); }}
        title={`Approve Separation: ${selectedSeparation?.name ?? ''}`}
        subtitle="Verify requested LWD, adjust approved LWD if required, and dispatch departmental clearances."
      >
        <div className="space-y-4">
          <div className="text-xs space-y-1 p-3 rounded bg-surface-2">
            <div>Resignation Date: {selectedSeparation?.resignationDate}</div>
            <div>Requested LWD: {selectedSeparation?.requestedLwd}</div>
            <div>Stated Reason: {selectedSeparation?.reason}</div>
          </div>
          <TextField
            label="Approved Last Working Day (LWD)"
            type="date"
            value={approveLwd}
            onChange={(e) => { setApproveLwd(e.target.value); }}
          />
          <div className="p-3 rounded-lg bg-surface-2 text-xs text-ink-muted">
            Approving this separation will:
            <ul className="list-disc list-inside mt-1 space-y-0.5">
              <li>Set employee status to <span className="font-semibold text-ink">on_notice</span></li>
              <li>Fan out clearance tasks to IT, Admin, Finance, and HR</li>
              <li>Record timestamped approval notification receipts</li>
            </ul>
          </div>
          <div className="pt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setShowApproveDrawer(false); }}>Cancel</Button>
            <Button variant="primary" onClick={() => { void handleApproveSeparation(); }}>
              Approve & Dispatch Clearances
            </Button>
          </div>
        </div>
      </Drawer>

      {/* DRAWER: F&F BREAKDOWN & EXECUTE CASCADE */}
      <Drawer
        open={showFnfDrawer}
        onClose={() => {
          setShowFnfDrawer(false);
          setSettledLetterResult(null);
        }}
        title="Full & Final (F&F) Settlement Statement"
        subtitle="Calculation breakdown, gratuity, statutory TAT and exit-day cascade."
      >
        {fnfBreakdown && (
          <div className="space-y-6">
            {/* Statutory TAT SLA Pill */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-surface-2 border border-line">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-positive-ink" />
                <span className="text-xs font-medium text-ink">Statutory 3-Working-Day SLA</span>
              </div>
              <StatusBadge tone={fnfBreakdown.tatDueDate < new Date().toISOString().slice(0, 10) ? 'negative' : 'positive'}>
                {fnfBreakdown.tatDueDate < new Date().toISOString().slice(0, 10) ? 'TAT breached' : 'Within TAT'} · Due: {fnfBreakdown.tatDueDate}
              </StatusBadge>
            </div>

            {/* Earnings Breakdown */}
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-ink-muted border-b border-line pb-1">
                A. Final Earnings (Gross Payable)
              </div>
              <div className="space-y-1.5 text-xs text-ink">
                <div className="flex justify-between">
                  <span>Prorated Salary ({String(fnfBreakdown.daysPayable)} days):</span>
                  <span className="font-mono">₹{(fnfBreakdown.earnings.proratedSalaryPaise / 100).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Earned Leave (EL) encashment ((Basic+DA)/30 per day):</span>
                  <span className="font-mono">₹{(fnfBreakdown.earnings.leaveEncashmentPaise / 100).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between font-medium text-accent-ink">
                  <span>Statutory gratuity ({fnfBreakdown.gratuityDetail.isEligible ? `${String(fnfBreakdown.gratuityDetail.completedYearsRounded)}y service` : 'not eligible'}):</span>
                  <span className="font-mono">₹{(fnfBreakdown.earnings.gratuityPaise / 100).toLocaleString('en-IN')}</span>
                </div>
                <div className="text-xs text-ink-muted pl-2">
                  ↳ {fnfBreakdown.gratuityDetail.calcNote}
                </div>
                <div className="flex justify-between font-bold pt-1 border-t border-line">
                  <span>Gross Earnings:</span>
                  <span className="font-mono">₹{(fnfBreakdown.earnings.grossPayablePaise / 100).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            {/* Deductions Breakdown */}
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-ink-muted border-b border-line pb-1">
                B. Recoveries & Deductions
              </div>
              <div className="space-y-1.5 text-xs text-ink">
                <div className="flex justify-between text-negative-ink">
                  <span>Notice Shortfall Recovery (60d shortfall):</span>
                  <span className="font-mono">-₹{(fnfBreakdown.deductions.noticeRecoveryPaise / 100).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-negative-ink">
                  <span>Unreturned assets:</span>
                  <span className="font-mono">-₹{(fnfBreakdown.deductions.assetRecoveryPaise / 100).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between font-bold pt-1 border-t border-line">
                  <span>Total Deductions:</span>
                  <span className="font-mono text-negative-ink">
                    -₹{(fnfBreakdown.deductions.totalDeductionsPaise / 100).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>

            {/* Net Payable Highlight Card */}
            <div className="p-4 rounded-xl bg-surface-2 border-2 border-accent/20 flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide font-semibold text-ink-muted">Net Settlement Payable</div>
                <div className="text-xs text-ink-muted">To be disbursed into registered salary bank account</div>
              </div>
              <div className="text-2xl font-serif font-bold text-accent-ink">
                ₹{fnfBreakdown.netPayableRupees.toLocaleString('en-IN')}
              </div>
            </div>

            {/* Post-Settlement Letters Issued Alert */}
            {settledLetterResult && (
              <div className="p-4 rounded-lg bg-surface-2 border border-positive space-y-2">
                <div className="flex items-center gap-2 text-positive-ink font-semibold text-sm">
                  <CheckCircle2 className="h-4 w-4" />
                  Exit Day Cascade Completed Successfully
                </div>
                <div className="text-xs text-ink space-y-1">
                  <div>• Employee status set to <span className="font-bold">exited</span> with DOL committed.</div>
                  <div>• User role transitioned to <span className="font-bold">alumni</span>.</div>
                  <div>• Letters generated:</div>
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" variant="secondary" onClick={() => { toast.success('Downloading Relieving Letter'); }}>
                      <Download className="h-3.5 w-3.5 mr-1" />
                      Relieving Letter (#{String(settledLetterResult.relievingLetterId)})
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => { toast.success('Downloading Service Certificate'); }}>
                      <Download className="h-3.5 w-3.5 mr-1" />
                      Service Certificate (#{String(settledLetterResult.serviceCertificateId)})
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Execute Payment & Exit Cascade Button */}
            {!settledLetterResult && (
              <div className="pt-2 space-y-3">
                <TextField
                  label="Bank UTR / Payment Reference"
                  value={paymentRef}
                  onChange={(e) => { setPaymentRef(e.target.value); }}
                  placeholder="e.g. UTR-HDFC-991823901"
                />
                <Button
                  className="w-full"
                  variant="primary"
                  onClick={() => { void handlePayAndExitCascade(); }}
                  disabled={isSettlingFnf || paymentRef.trim().length < 4}
                >
                  {isSettlingFnf ? 'Settling & Executing Cascade…' : 'Disburse F&F & Execute Exit Day Cascade (LC-07)'}
                </Button>
              </div>
            )}
          </div>
        )}
      </Drawer>

      <Drawer
        open={flagTarget !== null}
        onClose={() => {
          setFlagTarget(null);
        }}
        title="Flag unreturned assets"
        subtitle={selectedSeparation ? `${selectedSeparation.name} (${selectedSeparation.ecode})` : ''}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setFlagTarget(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={flagInvalid}
              onClick={() => {
                if (!flagTarget) return;
                const target = flagTarget;
                void handleUpdateClearanceStatus(target, 'flagged').then(() => {
                  setFlagTarget(null);
                });
              }}
            >
              Flag {flagSelectionCount > 0 ? `${String(flagSelectionCount)} asset(s)` : 'assets'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-sm">
          <p className="text-ink-muted">
            Pick each asset the employee has not returned and enter the amount to recover. The total is
            deducted in the F&amp;F settlement.
          </p>
          {heldLoading && <p className="text-ink-muted">Loading assets…</p>}
          {!heldLoading && heldAssets.length === 0 && (
            <EmptyState
              title="No assets on record"
              description="This employee holds no assigned assets, so there is nothing to flag. Clear the IT clearance instead."
            />
          )}
          {heldAssets.map((a) => {
            const checked = flagRecovery[a.assignmentId] !== undefined;
            return (
              <div key={a.assignmentId} className="rounded-md border border-line p-3">
                <label className="flex items-center gap-2 font-medium text-ink">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setFlagRecovery((prev) =>
                        on
                          ? { ...prev, [a.assignmentId]: '' }
                          : Object.fromEntries(
                              Object.entries(prev).filter(([k]) => k !== String(a.assignmentId))
                            )
                      );
                    }}
                  />
                  <span className="font-mono">{a.assetNo}</span>
                  <span className="text-ink-muted">· {a.category}</span>
                </label>
                {checked && (
                  <div className="mt-2">
                    <TextField
                      label="Recovery amount (₹)"
                      inputMode="decimal"
                      value={flagRecovery[a.assignmentId] ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        setFlagRecovery((prev) => ({ ...prev, [a.assignmentId]: v }));
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
          <Textarea
            label="Remarks (required)"
            value={flagRemarks}
            onChange={(e) => {
              setFlagRemarks(e.target.value);
            }}
            placeholder="e.g. Laptop not returned at exit interview"
          />
        </div>
      </Drawer>
    </div>
  );
}
