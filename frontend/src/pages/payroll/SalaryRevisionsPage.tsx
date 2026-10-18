/**
 * Employee Salary Revisions & History Page (PAY-02, PAY-07, PAY-16, SOW-082..090).
 * Warm Editorial design system — docs/05 §4.5 & docs/12.
 */
import { useEffect, useState } from 'react';
import {
  Calendar,
  AlertCircle,
  Plus,
  ArrowUpRight,
  ShieldAlert,
  UserCheck,
} from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  DatePicker,
  Drawer,
  EmptyState,
  PageHeader,
  Select,
  StatusBadge,
  TextField,
  toast,
} from '../../ui';
import { apiFetch } from '../../lib/api';

interface SalaryRevisionDiff {
  id: number;
  structure_id: number;
  structure_name?: string;
  effective_from: string;
  effective_to: string;
  annual_ctc_rupees: number;
  phase: 'probation' | 'confirmed';
  probation_percent: number | null;
  revision_reason: string | null;
  monthly_components: Record<string, number>;
  previous_annual_ctc_rupees?: number;
  ctc_change_percent?: number;
  ctc_delta_rupees?: number;
  retro_months_affected: string[];
}

interface EffectiveSalaryResponse {
  salary: {
    id: number;
    employee_id: number;
    structure_id: number;
    effective_from: string;
    effective_to: string;
    annual_ctc: string;
    phase: string;
    probation_percent: string | null;
    revision_reason: string | null;
  } | null;
  structure: {
    id: number;
    name: string;
  } | null;
  componentsInRupees: Record<string, number>;
  annualCtcRupees: number;
}

interface SalaryStructure {
  id: number;
  name: string;
}

export function SalaryRevisionsPage() {
  const [employeeId, setEmployeeId] = useState<number>(1);
  const [effectiveData, setEffectiveData] = useState<EffectiveSalaryResponse | null>(null);
  const [history, setHistory] = useState<SalaryRevisionDiff[]>([]);
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [loading, setLoading] = useState(false);

  // Assignment Drawer State
  const [assignDrawerOpen, setAssignDrawerOpen] = useState(false);
  const [selectedStructureId, setSelectedStructureId] = useState<number | undefined>(undefined);
  const [effectiveFrom, setEffectiveFrom] = useState<string>(new Date().toISOString().slice(0, 10));
  const [newCtcRupees, setNewCtcRupees] = useState<number>(600000);
  const [phase, setPhase] = useState<'probation' | 'confirmed'>('confirmed');
  const [probationPercent, setProbationPercent] = useState<number>(80);
  const [revisionReason, setRevisionReason] = useState<string>('annual_increment');
  const [submitting, setSubmitting] = useState(false);
  const [confirmingSwitch, setConfirmingSwitch] = useState(false);

  useEffect(() => {
    void loadStructures();
  }, []);

  useEffect(() => {
    if (employeeId) {
      void loadEmployeeSalary(employeeId);
    }
  }, [employeeId]);

  async function loadStructures() {
    try {
      const list = await apiFetch<SalaryStructure[]>('/api/payroll/structures');
      setStructures(list);
      if (list.length > 0) {
        setSelectedStructureId(list[0]?.id);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not load salary structures.');
    }
  }

  async function loadEmployeeSalary(empId: number) {
    setLoading(true);
    try {
      const [effRes, histRes] = await Promise.all([
        apiFetch<EffectiveSalaryResponse>(`/api/payroll/salaries/effective/${String(empId)}`).catch(() => null),
        apiFetch<SalaryRevisionDiff[]>(`/api/payroll/salaries/history/${String(empId)}`).catch(() => []),
      ]);
      setEffectiveData(effRes);
      setHistory(histRes);
    } catch (err: unknown) {
      toast.error('Error loading salary history', {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleAssignSalary() {
    if (!selectedStructureId || !newCtcRupees || !effectiveFrom) {
      toast.warning('Please complete all required fields');
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch('/api/payroll/salaries/assign', {
        method: 'POST',
        body: JSON.stringify({
          employee_id: employeeId,
          structure_id: selectedStructureId,
          effective_from: effectiveFrom,
          annual_ctc_rupees: newCtcRupees,
          phase,
          probation_percent: phase === 'probation' ? probationPercent : null,
          revision_reason: revisionReason,
        }),
      });
      toast.success('Salary revision assigned successfully');
      setAssignDrawerOpen(false);
      void loadEmployeeSalary(employeeId);
    } catch (err: unknown) {
      toast.error('Failed to assign salary revision', {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAutoSwitchConfirmation() {
    setConfirmingSwitch(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const res = await apiFetch<{ success: boolean; message: string }>('/api/payroll/salaries/auto-switch-confirmation', {
        method: 'POST',
        body: JSON.stringify({
          employee_id: employeeId,
          confirmation_date: today,
        }),
      });

      if (res.success) {
        toast.success(res.message);
        void loadEmployeeSalary(employeeId);
      } else {
        toast.warning(res.message);
      }
    } catch (err: unknown) {
      toast.error('Auto-switch failed', {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setConfirmingSwitch(false);
    }
  }

  const isProbation = effectiveData?.salary?.phase === 'probation';

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Salary revisions"
        description="Effective-dated revisions with before-and-after CTC, arrears preview and the probation switch."
        actions={
          <div className="flex gap-2">
            <Button
              variant="primary"
              leadingIcon={<Plus className="size-4" />}
              onClick={() => {
                setAssignDrawerOpen(true);
              }}
            >
              Assign Revision
            </Button>
          </div>
        }
      />

      {/* Employee Selector Bar */}
      <Card className="p-4 flex items-center gap-4">
        <div className="w-48">
          <TextField
            label="Employee ID"
            type="number"
            value={String(employeeId)}
            onChange={(e) => {
              setEmployeeId(Number(e.target.value) || 1);
            }}
            placeholder="Employee ID"
          />
        </div>
        <Button
          variant="secondary"
          className="mt-5"
          onClick={() => {
            void loadEmployeeSalary(employeeId);
          }}
        >
          Load Profile
        </Button>
      </Card>

      {/* Active Compensation Summary */}
      {effectiveData?.salary ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-5">
            <div className="text-xs text-ink-muted font-semibold">
              Current Annual CTC
            </div>
            <div className="text-2xl font-bold font-mono mt-1 text-ink">
              ₹{effectiveData.annualCtcRupees.toLocaleString('en-IN')}
            </div>
            <div className="text-xs text-ink-muted mt-1">
              Structure: {effectiveData.structure?.name ?? 'Standard'}
            </div>
          </Card>

          <Card className="p-5">
            <div className="text-xs text-ink-muted font-semibold">
              Employment Phase
            </div>
            <div className="mt-2 flex items-center gap-2">
              <StatusBadge tone={isProbation ? 'warning' : 'positive'}>
                {isProbation
                  ? `Probation (${effectiveData.salary.probation_percent ?? '80'}%)`
                  : 'Confirmed (100%)'}
              </StatusBadge>
            </div>
            <div className="text-xs text-ink-muted mt-2">
              Effective from: {effectiveData.salary.effective_from}
            </div>
          </Card>

          <Card className="p-5">
            <div className="text-xs text-ink-muted font-semibold">
              Revision Reason
            </div>
            <div className="text-base font-semibold mt-1 text-ink capitalize">
              {effectiveData.salary.revision_reason?.replace('_', ' ') ?? 'Joining'}
            </div>
            <div className="text-xs text-ink-muted mt-1">
              Valid until: {effectiveData.salary.effective_to}
            </div>
          </Card>

          <Card className="p-5 flex flex-col justify-between">
            <div>
              <div className="text-xs text-ink-muted font-semibold">
                Probation Actions
              </div>
              <div className="text-xs text-ink-muted mt-1">
                {isProbation
                  ? 'Ready for confirmation auto-switch'
                  : 'Already confirmed at 100%'}
              </div>
            </div>
            {isProbation && (
              <Button
                variant="primary"
                size="sm"
                leadingIcon={<UserCheck className="size-4" />}
                loading={confirmingSwitch}
                onClick={() => {
                  void handleAutoSwitchConfirmation();
                }}
              >
                Confirm & Switch to 100%
              </Button>
            )}
          </Card>
        </div>
      ) : (
        !loading && (
          <EmptyState
            icon={<AlertCircle className="size-6" />}
            title="No Active Salary"
            description="This employee has no active salary assignment. Create a new revision to assign a structure."
            action={
              <Button
                variant="primary"
                onClick={() => {
                  setAssignDrawerOpen(true);
                }}
              >
                Assign Salary
              </Button>
            }
          />
        )
      )}

      {/* Revision History Timeline */}
      <Card>
        <CardHeader
          title="Salary Revision History & Retro Preview"
          subtitle="All effective-dated revisions with diff percentages and backdated retro period warnings."
        />
        <div className="p-6">
          {history.length === 0 ? (
            <div className="text-sm text-ink-muted">No revision history found for this employee.</div>
          ) : (
            <div className="space-y-6">
              {history.map((rev, idx) => (
                <div
                  key={rev.id}
                  className="p-5 rounded-card border border-line bg-surface space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-full bg-surface-2 flex items-center justify-center font-mono text-xs font-bold text-ink">
                        #{history.length - idx}
                      </div>
                      <div>
                        <div className="font-semibold text-sm text-ink">
                          ₹{rev.annual_ctc_rupees.toLocaleString('en-IN')}{' '}
                          <span className="text-xs font-normal text-ink-muted">
                            / year
                          </span>
                        </div>
                        <div className="text-xs text-ink-muted flex items-center gap-2 mt-0.5">
                          <Calendar className="size-3.5" />
                          <span>
                            {rev.effective_from} → {rev.effective_to}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <StatusBadge tone={rev.phase === 'probation' ? 'warning' : 'positive'}>
                        {rev.phase === 'probation'
                          ? `Probation ${String(rev.probation_percent ?? 80)}%`
                          : 'Confirmed'}
                      </StatusBadge>
                      <StatusBadge tone="neutral">
                        {rev.revision_reason?.replace('_', ' ') ?? 'Revision'}
                      </StatusBadge>
                      {rev.ctc_change_percent !== undefined && (
                        <div
                          className={`flex items-center text-xs font-mono font-semibold px-2 py-1 rounded-row ${
                            rev.ctc_change_percent >= 0
                              ? 'bg-[color-mix(in_srgb,var(--positive)_12%,var(--surface))] text-positive-ink'
                              : 'bg-[color-mix(in_srgb,var(--negative)_12%,var(--surface))] text-negative-ink'
                          }`}
                        >
                          <ArrowUpRight className="size-3.5 mr-0.5" />
                          {rev.ctc_change_percent > 0 ? '+' : ''}
                          {rev.ctc_change_percent}% (₹{Math.abs(rev.ctc_delta_rupees ?? 0).toLocaleString('en-IN')})
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Retro period alert if applicable */}
                  {rev.retro_months_affected.length > 0 && (
                    <div className="p-3 bg-[color-mix(in_srgb,var(--warning)_12%,var(--surface))] border border-warning rounded-row flex items-start gap-2.5 text-xs text-warning-ink">
                      <ShieldAlert className="size-4 mt-0.5 shrink-0" />
                      <div>
                        <div className="font-semibold">
                          Backdated Revision — Retro Arrears Pending
                        </div>
                        <div>
                          This revision took effect prior to the current payroll month. The
                          following {String(rev.retro_months_affected.length)} month(s) will be recomputed
                          and deltas paid as arrears: {rev.retro_months_affected.join(', ')}.
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Resolved Component Pills */}
                  <div>
                    <div className="text-xs font-medium text-ink-muted mb-2">
                      Monthly Resolved Components:
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {Object.entries(rev.monthly_components).map(([code, amt]) => (
                        <div
                          key={code}
                          className="p-2 rounded-row bg-surface-2 flex justify-between items-center text-xs"
                        >
                          <span className="font-mono text-ink-muted">
                            {code}
                          </span>
                          <span className="font-mono font-semibold text-ink">
                            ₹{amt.toLocaleString('en-IN')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Salary Assignment Drawer */}
      <Drawer
        open={assignDrawerOpen}
        onClose={() => {
          setAssignDrawerOpen(false);
        }}
        title="Assign Salary Revision"
      >
        <div className="space-y-4 p-4">
          <div>
            <Select
              label="Salary Structure *"
              value={selectedStructureId ? String(selectedStructureId) : null}
              onChange={(val) => {
                setSelectedStructureId(Number(val));
              }}
              options={structures.map((s) => ({ value: String(s.id), label: s.name }))}
            />
          </div>

          <div>
            <TextField
              label="Annual CTC (₹) *"
              type="number"
              value={String(newCtcRupees)}
              onChange={(e) => {
                setNewCtcRupees(Number(e.target.value));
              }}
              placeholder="e.g. 600000"
            />
          </div>

          <div>
            <DatePicker
              label="Effective Date *"
              value={effectiveFrom}
              onChange={(val) => {
                setEffectiveFrom(val);
              }}
              hint="Past dates trigger automatic retro arrears computation."
            />
          </div>

          <div>
            <Select
              label="Employment Phase *"
              value={phase}
              onChange={(val) => {
                setPhase(val as 'probation' | 'confirmed');
              }}
              options={[
                { value: 'confirmed', label: 'Confirmed (100%)' },
                { value: 'probation', label: 'Probation' },
              ]}
            />
          </div>

          {phase === 'probation' && (
            <div>
              <Select
                label="Probation Percentage (%)"
                value={String(probationPercent)}
                onChange={(val) => {
                  setProbationPercent(Number(val));
                }}
                options={[
                  { value: '70', label: '70%' },
                  { value: '80', label: '80%' },
                  { value: '90', label: '90%' },
                ]}
              />
            </div>
          )}

          <div>
            <Select
              label="Revision Reason *"
              value={revisionReason}
              onChange={(val) => {
                setRevisionReason(val);
              }}
              options={[
                { value: 'annual_increment', label: 'Annual Increment' },
                { value: 'promotion', label: 'Promotion' },
                { value: 'confirmation', label: 'Probation Confirmation' },
                { value: 'joining', label: 'Initial Joining' },
                { value: 'correction', label: 'Data Correction' },
              ]}
            />
          </div>

          <div className="pt-4 flex gap-2">
            <Button
              variant="primary"
              className="w-full"
              loading={submitting}
              onClick={() => {
                void handleAssignSalary();
              }}
            >
              Commit Revision
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setAssignDrawerOpen(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Drawer>
    </div>
  );
}
