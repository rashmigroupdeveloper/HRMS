/**
 * Transfers & Employee Mobility Console (LC-05, SOW-029..031, SOW-033..035).
 *
 * Implements:
 * 1. 4 distinct transfer workflows:
 *    - Department / Unit Transfer (dept & manager changes)
 *    - Location / Plant Transfer (shift & location movement)
 *    - Inter-Entity Transfer (Company movement with new target e-code series and leave continuity)
 *    - Promotion / Designation Change (grade, designation, and salary revision CTC)
 * 2. Immutable Career History Timeline from core.employee_history.
 * 3. Organization As-Of Date Reconstruction Explorer.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  ArrowRightLeft,
  Building2,
  Clock,
  History,
  MapPin,
  RefreshCw,
  Search,
  TrendingUp,
} from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  DataTable,
  Drawer,
  PageHeader,
  Select,
  StatusBadge,
  TextField,
  Textarea,
  toast,
  type Column,
  type SelectOption,
  type StatusTone,
  StatGrid, StatTile,
} from '../../ui';
import { apiFetch } from '../../lib/api';

type TransferType = 'department' | 'location' | 'inter_entity' | 'promotion';
type TransferStatus = 'pending' | 'approved' | 'rejected' | 'completed' | 'cancelled';

interface TransferItem {
  id: number;
  employeeId: number;
  ecode: string;
  employeeName: string;
  transferType: TransferType;
  effectiveDate: string;
  status: TransferStatus;
  currentCompanyId: number;
  currentCompanyName: string;
  targetCompanyId: number | null;
  targetCompanyName: string | null;
  currentDepartmentId: number | null;
  currentDepartmentName: string | null;
  targetDepartmentId: number | null;
  targetDepartmentName: string | null;
  currentLocationId: number | null;
  currentLocationName: string | null;
  targetLocationId: number | null;
  targetLocationName: string | null;
  currentDesignationId: number | null;
  currentDesignationName: string | null;
  targetDesignationId: number | null;
  targetDesignationName: string | null;
  currentGradeId: number | null;
  currentGradeName: string | null;
  targetGradeId: number | null;
  targetGradeName: string | null;
  currentReportingManagerId: number | null;
  currentReportingManagerName: string | null;
  targetReportingManagerId: number | null;
  targetReportingManagerName: string | null;
  currentEcode: string;
  targetEcode: string | null;
  salaryRevisionAmount: number | null;
  leaveTreatment: 'transfer' | 'encash';
  reason: string;
  remarks: string | null;
  approvedBy: number | null;
  approvedAt: string | null;
  /** C-17: decided by RM → HR in the Approvals inbox, not from this table. */
  workflowRequestId?: number | null;
  notifiedAt: string | null;
  createdAt: string;
}

interface HistoryItem {
  id: number;
  employeeId: number;
  effectiveDate: string;
  changeType: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  referenceId: number | null;
  createdAt: string;
}

interface AsOfState {
  employeeId: number;
  asOfDate: string;
  ecode: string;
  companyId: number;
  departmentId: number | null;
  locationId: number | null;
  designationId: number | null;
  gradeId: number | null;
  reportingManagerId: number | null;
}

type TabMode = 'all' | 'department' | 'location' | 'inter_entity' | 'promotion';

export function TransfersPage() {
  const [activeTab, setActiveTab] = useState<TabMode>('all');
  const [transfers, setTransfers] = useState<TransferItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Initiate Drawer State
  const [showInitiateDrawer, setShowInitiateDrawer] = useState(false);
  const [formEmployeeId, setFormEmployeeId] = useState('');
  const [formTransferType, setFormTransferType] = useState<TransferType>('department');
  const [formEffectiveDate, setFormEffectiveDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [formTargetCompanyId, setFormTargetCompanyId] = useState('');
  const [formTargetDeptId, setFormTargetDeptId] = useState('');
  const [formTargetLocId, setFormTargetLocId] = useState('');
  const [formTargetDesigId, setFormTargetDesigId] = useState('');
  const [formTargetGradeId, setFormTargetGradeId] = useState('');
  const [formTargetMgrId, setFormTargetMgrId] = useState('');
  const [formSalaryCtc, setFormSalaryCtc] = useState('');
  const [formLeaveTreatment, setFormLeaveTreatment] = useState<'transfer' | 'encash'>('transfer');
  const [formReason, setFormReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // History Drawer State
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [selectedEmpHistory, setSelectedEmpHistory] = useState<HistoryItem[]>([]);
  const [selectedEmpName, setSelectedEmpName] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);

  // As-Of Explorer State
  const [showAsOfDrawer, setShowAsOfDrawer] = useState(false);
  const [asOfEmpId, setAsOfEmpId] = useState('');
  const [asOfDate, setAsOfDate] = useState('2025-01-01');
  const [asOfResult, setAsOfResult] = useState<AsOfState | null>(null);
  const [asOfLoading, setAsOfLoading] = useState(false);

  // Master Dropdown Options (loaded dynamically)
  const [companies, setCompanies] = useState<SelectOption[]>([]);
  const [departments, setDepartments] = useState<SelectOption[]>([]);
  const [locations, setLocations] = useState<SelectOption[]>([]);
  const [designations, setDesignations] = useState<SelectOption[]>([]);
  const [grades, setGrades] = useState<SelectOption[]>([]);

  const loadTransfers = useCallback(async () => {
    setLoading(true);
    try {
      const typeFilter = activeTab === 'all' ? undefined : activeTab;
      const res = await apiFetch<{ rows: TransferItem[]; total: number }>(
        `/api/lifecycle/transfers${typeFilter ? `?transferType=${typeFilter}` : ''}`,
      );
      setTransfers(res.rows);
    } catch (err: unknown) {
      setTransfers([]);
      toast.error(err instanceof Error ? err.message : 'Could not load transfers.');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  const loadMasters = useCallback(async () => {
    try {
      const compRes = await apiFetch<{ companies: { id: number; name: string }[] }>('/api/core/companies').catch(() => null);
      if (compRes?.companies) {
        setCompanies(compRes.companies.map((c) => ({ value: String(c.id), label: c.name })));
      }
      const deptRes = await apiFetch<{ departments: { id: number; name: string }[] }>('/api/core/departments').catch(() => null);
      if (deptRes?.departments) {
        setDepartments(deptRes.departments.map((d) => ({ value: String(d.id), label: d.name })));
      }
      const locRes = await apiFetch<{ locations: { id: number; name: string }[] }>('/api/core/locations').catch(() => null);
      if (locRes?.locations) {
        setLocations(locRes.locations.map((l) => ({ value: String(l.id), label: l.name })));
      }
      const desRes = await apiFetch<{ designations: { id: number; name: string }[] }>('/api/core/designations').catch(() => null);
      if (desRes?.designations) {
        setDesignations(desRes.designations.map((d) => ({ value: String(d.id), label: d.name })));
      }
      const grdRes = await apiFetch<{ grades: { id: number; name: string }[] }>('/api/core/grades').catch(() => null);
      if (grdRes?.grades) {
        setGrades(grdRes.grades.map((g) => ({ value: String(g.id), label: g.name })));
      }
    } catch {
      // Keep empty defaults
    }
  }, []);

  useEffect(() => {
    void loadTransfers();
  }, [loadTransfers]);

  useEffect(() => {
    void loadMasters();
  }, [loadMasters]);

  const handleApprove = async (id: number) => {
    try {
      const res = await apiFetch<{ success: boolean; newEcode: string | null; scheduled?: boolean }>(
        `/api/lifecycle/transfers/${String(id)}/approve`,
        { method: 'POST' },
      );
      if (res.success && res.scheduled === true) {
        toast.success('Transfer approved', { description: 'It takes effect on its effective date.' });
        void loadTransfers();
      } else if (res.success) {
        toast.success('Transfer Approved & Committed', {
          description: res.newEcode
            ? `Inter-entity transfer executed. New e-code: ${res.newEcode}`
            : 'Employee master and history timeline updated.',
        });
        void loadTransfers();
      }
    } catch (err: unknown) {
      toast.error('Failed to approve transfer', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  };

  const handleReject = async (id: number) => {
    const remarks = window.prompt('Enter rejection remarks:');
    if (!remarks) return;

    try {
      await apiFetch(`/api/lifecycle/transfers/${String(id)}/reject`, {
        method: 'POST',
        body: JSON.stringify({ remarks }),
      });
      toast.success('Transfer Rejected', { description: 'Request status marked as rejected.' });
      void loadTransfers();
    } catch (err: unknown) {
      toast.error('Failed to reject transfer', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  };

  const handleInitiateSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!formEmployeeId || !formReason) {
      toast.error('Validation Error', { description: 'Employee ID and reason are mandatory.' });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        employeeId: Number(formEmployeeId),
        transferType: formTransferType,
        effectiveDate: formEffectiveDate,
        targetCompanyId: formTargetCompanyId ? Number(formTargetCompanyId) : null,
        targetDepartmentId: formTargetDeptId ? Number(formTargetDeptId) : null,
        targetLocationId: formTargetLocId ? Number(formTargetLocId) : null,
        targetDesignationId: formTargetDesigId ? Number(formTargetDesigId) : null,
        targetGradeId: formTargetGradeId ? Number(formTargetGradeId) : null,
        targetReportingManagerId: formTargetMgrId ? Number(formTargetMgrId) : null,
        salaryRevisionAmount: formSalaryCtc ? Number(formSalaryCtc) : null,
        leaveTreatment: formLeaveTreatment,
        reason: formReason,
      };

      const res = await apiFetch<{ id: number; targetEcode: string | null }>(
        '/api/lifecycle/transfers',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
      );

      toast.success('Transfer Initiated', {
        description: res.targetEcode
          ? `Created request #${String(res.id)}. Target e-code preview: ${res.targetEcode}`
          : `Created transfer request #${String(res.id)}.`,
      });

      setShowInitiateDrawer(false);
      setFormReason('');
      void loadTransfers();
    } catch (err: unknown) {
      toast.error('Failed to initiate transfer', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewHistory = async (empId: number, empName: string) => {
    setSelectedEmpName(empName);
    setShowHistoryDrawer(true);
    setHistoryLoading(true);
    try {
      const res = await apiFetch<{ history: HistoryItem[] }>(
        `/api/lifecycle/transfers/history/${String(empId)}`,
      );
      setSelectedEmpHistory(res.history);
    } catch {
      setSelectedEmpHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleRunAsOfQuery = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!asOfEmpId || !asOfDate) return;
    setAsOfLoading(true);
    try {
      const res = await apiFetch<AsOfState>(
        `/api/lifecycle/transfers/as-of?employeeId=${asOfEmpId}&asOfDate=${asOfDate}`,
      );
      setAsOfResult(res);
    } catch (err: unknown) {
      toast.error('Failed to reconstruct state', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setAsOfLoading(false);
    }
  };

  const filteredTransfers = transfers.filter((t) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.employeeName.toLowerCase().includes(q) ||
      t.ecode.toLowerCase().includes(q) ||
      t.reason.toLowerCase().includes(q)
    );
  });

  const columns: Column<TransferItem>[] = [
    {
      key: 'employee',
      header: 'Employee',
      render: (r) => (
        <div>
          <div className="font-medium text-ink">{r.employeeName}</div>
          <div className="text-xs text-ink-muted">
            {r.ecode} • Current: {r.currentCompanyName}
          </div>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (r) => {
        let tone: StatusTone = 'neutral';
        let label = 'Department';
        if (r.transferType === 'inter_entity') {
          tone = 'info';
          label = 'Inter-Entity';
        } else if (r.transferType === 'promotion') {
          tone = 'positive';
          label = 'Promotion';
        } else if (r.transferType === 'location') {
          tone = 'warning';
          label = 'Plant Transfer';
        }
        return <StatusBadge tone={tone}>{label}</StatusBadge>;
      },
    },
    {
      key: 'change',
      header: 'Proposed Movement',
      render: (r) => (
        <div className="text-xs space-y-0.5">
          {r.transferType === 'department' && (
            <div>
              <span className="text-ink-muted">{r.currentDepartmentName ?? '—'}</span> →{' '}
              <span className="font-semibold text-ink">{r.targetDepartmentName ?? '—'}</span>
            </div>
          )}
          {r.transferType === 'location' && (
            <div>
              <span className="text-ink-muted">{r.currentLocationName ?? '—'}</span> →{' '}
              <span className="font-semibold text-ink">{r.targetLocationName ?? '—'}</span>
            </div>
          )}
          {r.transferType === 'inter_entity' && (
            <div>
              <span className="text-ink-muted">{r.currentCompanyName}</span> →{' '}
              <span className="font-semibold text-ink">{r.targetCompanyName}</span>
              {r.targetEcode && (
                <div className="text-accent font-mono text-[11px]">New E-Code: {r.targetEcode}</div>
              )}
            </div>
          )}
          {r.transferType === 'promotion' && (
            <div>
              <span className="text-ink-muted">{r.currentDesignationName ?? '—'}</span> →{' '}
              <span className="font-semibold text-ink">{r.targetDesignationName ?? '—'}</span>
              {r.salaryRevisionAmount && (
                <div className="text-positive-ink font-mono">
                  Rev. CTC: ₹{(r.salaryRevisionAmount / 100000).toFixed(2)}L
                </div>
              )}
            </div>
          )}
          <div className="text-[11px] text-ink-muted">Eff: {r.effectiveDate}</div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => {
        const tone: StatusTone =
          r.status === 'completed'
            ? 'positive'
            : r.status === 'approved'
            ? 'info'
            : r.status === 'rejected'
            ? 'negative'
            : 'warning';
        return <StatusBadge tone={tone}>{r.status === 'approved' ? 'SCHEDULED' : r.status.toUpperCase()}</StatusBadge>;
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (r) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              void handleViewHistory(r.employeeId, r.employeeName);
            }}
          >
            <History className="h-3.5 w-3.5 mr-1" />
            History
          </Button>

          {r.status === 'pending' && (r.workflowRequestId ?? null) !== null && (
            <StatusBadge tone="info">In approval chain</StatusBadge>
          )}
          {r.status === 'pending' && (r.workflowRequestId ?? null) === null && (
            <>
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  void handleApprove(r.id);
                }}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  void handleReject(r.id);
                }}
              >
                Reject
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employee Movement & Transfers"
        description="Manage department, plant, inter-entity company movements, and promotion grade revisions."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setShowAsOfDrawer(true);
              }}
            >
              <Clock className="h-4 w-4 mr-1.5" />
              As-Of Date Explorer
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setShowInitiateDrawer(true);
              }}
            >
              <ArrowRightLeft className="h-4 w-4 mr-1.5" />
              Initiate Transfer / Promotion
            </Button>
          </div>
        }
      />

      {/* Overview Stat Cards */}
      <StatGrid>
        <StatTile label="Department transfers" icon={<Building2 />} value={transfers.filter((t) => t.transferType === 'department').length} />
        <StatTile label="Location / plant" icon={<MapPin />} value={transfers.filter((t) => t.transferType === 'location').length} />
        <StatTile label="Inter-entity moves" icon={<ArrowRightLeft />} value={transfers.filter((t) => t.transferType === 'inter_entity').length} />
        <StatTile label="Promotions & revisions" icon={<TrendingUp />} value={transfers.filter((t) => t.transferType === 'promotion').length} />
      </StatGrid>

      {/* Tabs & Search Filter */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-3">
        <div className="flex min-w-0 max-w-full overflow-x-auto rounded-full bg-surface-2 p-1 [scrollbar-width:none] [&>*]:shrink-0">
          {(
            [
              { id: 'all', label: 'All Transfers' },
              { id: 'department', label: 'Department' },
              { id: 'location', label: 'Plant / Location' },
              { id: 'inter_entity', label: 'Inter-Entity' },
              { id: 'promotion', label: 'Promotions' },
            ] as { id: TabMode; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-surface text-ink shadow-sm'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              type="text"
              placeholder="Search employee, e-code..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
              }}
              className="pl-9 pr-3 py-1.5 text-xs rounded-lg border border-line bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-focus"
            />
          </div>
          <Button
            size="sm"
            variant="ghost"
            aria-label="Refresh transfers"
            onClick={() => {
              void loadTransfers();
            }}
          >
            <RefreshCw aria-hidden className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Main Transfers Queue */}
      <Card>
        <CardHeader
          title="Transfer Requests Queue"
          action={
            <StatusBadge tone="neutral">
              {filteredTransfers.length} {filteredTransfers.length === 1 ? 'record' : 'records'}
            </StatusBadge>
          }
        />
        <div className="p-0">
          <DataTable
            rows={filteredTransfers}
            columns={columns}
            rowKey={(r) => String(r.id)}
            empty={
              <div className="py-12 text-center text-ink-muted text-sm">
                No transfer requests matching selected filters.
              </div>
            }
          />
        </div>
      </Card>

      {/* Initiate Transfer / Promotion Drawer */}
      <Drawer
        open={showInitiateDrawer}
        onClose={() => {
          setShowInitiateDrawer(false);
        }}
        title="Initiate Employee Movement / Promotion"
        subtitle="Submit a formal movement request with effective date and approval routing."
      >
        <form onSubmit={(e) => { void handleInitiateSubmit(e); }} className="space-y-4 p-4">
          <TextField
            label="Employee ID"
            type="number"
            value={formEmployeeId}
            onChange={(e) => { setFormEmployeeId(e.target.value); }}
            placeholder="e.g. 101"
            required
          />

          <Select
            label="Movement Type"
            value={formTransferType}
            onChange={(val) => {
              setFormTransferType(val as TransferType);
            }}
            options={[
              { value: 'department', label: 'Department / Unit Transfer' },
              { value: 'location', label: 'Location / Plant Transfer' },
              { value: 'inter_entity', label: 'Inter-Entity (Company Movement)' },
              { value: 'promotion', label: 'Promotion / Designation Change' },
            ]}
          />

          <TextField
            label="Effective Date"
            type="date"
            value={formEffectiveDate}
            onChange={(e) => { setFormEffectiveDate(e.target.value); }}
            required
          />

          {/* Conditional Fields based on transfer type */}
          {formTransferType === 'department' && (
            <>
              <Select
                label="Target Department"
                value={formTargetDeptId}
                onChange={(val) => { setFormTargetDeptId(val); }}
                options={[{ value: '', label: '-- Select Department --' }, ...departments]}
              />
              <TextField
                label="Target Reporting Manager (Employee ID)"
                type="number"
                value={formTargetMgrId}
                onChange={(e) => { setFormTargetMgrId(e.target.value); }}
                placeholder="Manager Employee ID"
              />
            </>
          )}

          {formTransferType === 'location' && (
            <Select
              label="Target Location / Plant"
              value={formTargetLocId}
              onChange={(val) => { setFormTargetLocId(val); }}
              options={[{ value: '', label: '-- Select Location --' }, ...locations]}
            />
          )}

          {formTransferType === 'inter_entity' && (
            <>
              <Select
                label="Target Legal Entity (Company)"
                value={formTargetCompanyId}
                onChange={(val) => { setFormTargetCompanyId(val); }}
                options={[{ value: '', label: '-- Select Company --' }, ...companies]}
              />
              <Select
                label="Target Plant Location"
                value={formTargetLocId}
                onChange={(val) => { setFormTargetLocId(val); }}
                options={[{ value: '', label: '-- Select Location --' }, ...locations]}
              />
              <Select
                label="Leave Balances Treatment"
                value={formLeaveTreatment}
                onChange={(val) => {
                  setFormLeaveTreatment(val as 'transfer' | 'encash');
                }}
                options={[
                  { value: 'transfer', label: 'Transfer Leave Balances (Continuity)' },
                  { value: 'encash', label: 'Terminal Encashment (Old Entity Closeout)' },
                ]}
              />
            </>
          )}

          {formTransferType === 'promotion' && (
            <>
              <Select
                label="Target Designation"
                value={formTargetDesigId}
                onChange={(val) => { setFormTargetDesigId(val); }}
                options={[{ value: '', label: '-- Select Designation --' }, ...designations]}
              />
              <Select
                label="Target Grade Rank"
                value={formTargetGradeId}
                onChange={(val) => { setFormTargetGradeId(val); }}
                options={[{ value: '', label: '-- Select Grade --' }, ...grades]}
              />
              <TextField
                label="Revised Annual CTC (₹)"
                type="number"
                value={formSalaryCtc}
                onChange={(e) => { setFormSalaryCtc(e.target.value); }}
                placeholder="e.g. 1200000"
              />
            </>
          )}

          <Textarea
            label="Business Justification / Reason"
            value={formReason}
            onChange={(e) => { setFormReason(e.target.value); }}
            placeholder="State the business rationale for this movement..."
            rows={3}
            required
          />

          <div className="pt-4 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowInitiateDrawer(false);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Transfer'}
            </Button>
          </div>
        </form>
      </Drawer>

      {/* Career History Timeline Drawer */}
      <Drawer
        open={showHistoryDrawer}
        onClose={() => {
          setShowHistoryDrawer(false);
        }}
        title={`Career Progression: ${selectedEmpName}`}
        subtitle="Immutable effective-dated organization history from core.employee_history."
      >
        <div className="p-4 space-y-4">
          {historyLoading ? (
            <div className="py-8 text-center text-sm text-ink-muted">Loading timeline...</div>
          ) : selectedEmpHistory.length === 0 ? (
            <div className="py-8 text-center text-sm text-ink-muted">
              No historical organization changes recorded yet.
            </div>
          ) : (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-line">
              {selectedEmpHistory.map((item) => (
                <div key={item.id} className="relative">
                  <div className="absolute -left-6 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-surface bg-accent" />
                  <div className="text-xs font-semibold text-ink flex items-center gap-2">
                    <span>{item.changeType.replace('_', ' ').toUpperCase()}</span>
                    <span className="text-[11px] font-normal text-ink-muted">
                      • {item.effectiveDate}
                    </span>
                  </div>
                  <div className="text-xs text-ink-muted mt-1 bg-surface-2 p-2 rounded">
                    <div>
                      <span className="font-medium text-ink">Field Changed:</span> {item.field}
                    </div>
                    <div>
                      <span className="font-medium text-ink">Previous:</span> {item.oldValue ?? '—'}
                    </div>
                    <div>
                      <span className="font-medium text-ink">New Value:</span> {item.newValue ?? '—'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Drawer>

      {/* As-Of Date Explorer Drawer */}
      <Drawer
        open={showAsOfDrawer}
        onClose={() => {
          setShowAsOfDrawer(false);
        }}
        title="Organization As-Of Date Explorer"
        subtitle="Reconstruct employee placement and reporting structure as-of any past historical date."
      >
        <form onSubmit={(e) => { void handleRunAsOfQuery(e); }} className="space-y-4 p-4">
          <TextField
            label="Employee ID"
            type="number"
            value={asOfEmpId}
            onChange={(e) => { setAsOfEmpId(e.target.value); }}
            placeholder="e.g. 101"
            required
          />

          <TextField
            label="Historical Date (As-Of)"
            type="date"
            value={asOfDate}
            onChange={(e) => { setAsOfDate(e.target.value); }}
            required
          />

          <Button type="submit" variant="primary" disabled={asOfLoading} className="w-full">
            {asOfLoading ? 'Reconstructing...' : 'Inspect Historical State'}
          </Button>

          {asOfResult && (
            <div className="mt-6 p-4 rounded-xl border border-line bg-surface-2 space-y-3">
              <div className="flex items-center justify-between border-b border-line pb-2">
                <span className="font-semibold text-xs text-ink">
                  State as of {asOfResult.asOfDate}
                </span>
                <StatusBadge tone="info">Historical Snapshot</StatusBadge>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-ink-muted">E-Code:</div>
                  <div className="font-mono font-medium text-ink">{asOfResult.ecode}</div>
                </div>
                <div>
                  <div className="text-ink-muted">Company ID:</div>
                  <div className="font-medium text-ink">#{String(asOfResult.companyId)}</div>
                </div>
                <div>
                  <div className="text-ink-muted">Department ID:</div>
                  <div className="font-medium text-ink">
                    {asOfResult.departmentId ? `#${String(asOfResult.departmentId)}` : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-ink-muted">Location ID:</div>
                  <div className="font-medium text-ink">
                    {asOfResult.locationId ? `#${String(asOfResult.locationId)}` : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-ink-muted">Designation ID:</div>
                  <div className="font-medium text-ink">
                    {asOfResult.designationId ? `#${String(asOfResult.designationId)}` : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-ink-muted">Reporting Manager:</div>
                  <div className="font-medium text-ink">
                    {asOfResult.reportingManagerId ? `#${String(asOfResult.reportingManagerId)}` : '—'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </form>
      </Drawer>
    </div>
  );
}
