/**
 * Probation Board & Confirmation Console (LC-04, PAY-02, SOW-027..028).
 *
 * Implements:
 * - Automated reminder alerts at due -30d, -14d, -7d.
 * - Multi-tier evaluation workflow (Manager evaluation -> HR Decision).
 * - Atomic confirmation: transitions to 100% full CTC salary, updates contract type to permanent,
 *   and issues confirmation letter in core.letters.
 * - Extension handling with automatic subsequent review cycle scheduling.
 */

import { useState, useEffect, useId, useCallback } from 'react';
import { hasPermission, type SessionUser } from '../../lib/session';
import {
  Bell,
  CheckCircle2,
  Clock,
  UserCheck,
  AlertTriangle,
  Award,
  Send,
  Sliders,
} from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  DataTable,
  Drawer,
  PageHeader,
  StatusBadge,
  TextField,
  Select,
  toast,
  type Column,
  type SelectOption,
  StatTile,
} from '../../ui';
import { apiFetch } from '../../lib/api';

interface ProbationReviewItem {
  id: number;
  employeeId: number;
  ecode: string;
  name: string;
  department: string | null;
  designation: string | null;
  doj: string | null;
  dueDate: string;
  managerRecommendation: 'confirm' | 'extend' | 'separate' | null;
  extensionMonths: number | null;
  reviewNotes: string | null;
  status: 'pending' | 'under_review' | 'completed';
  outcome: 'confirmed' | 'extended' | 'separated' | null;
  confirmationDate: string | null;
}

interface UpcomingAlerts {
  d30: number[];
  d14: number[];
  d7: number[];
}

const STATUS_FILTERS: { code: string; label: string }[] = [
  { code: 'all', label: 'All Reviews' },
  { code: 'pending', label: 'Pending Evaluation' },
  { code: 'under_review', label: 'Under Review' },
  { code: 'completed', label: 'Completed' },
];

const RECOMMENDATION_OPTIONS: SelectOption[] = [
  { value: 'confirm', label: 'Confirm Employment (Permanent)' },
  { value: 'extend', label: 'Extend Probation (Further Evaluation)' },
  { value: 'separate', label: 'Initiate Separation' },
];

const EXTENSION_OPTIONS: SelectOption[] = [
  { value: '1', label: '1 Month' },
  { value: '2', label: '2 Months' },
  { value: '3', label: '3 Months (Standard)' },
  { value: '6', label: '6 Months (Maximum)' },
];

interface AlertsResponse { d30ReviewIds: number[]; d14ReviewIds: number[]; d7ReviewIds: number[] }

export function ProbationBoardPage({ user }: { user?: SessionUser | undefined } = {}) {
  const canEvaluate = user !== undefined && hasPermission(user, 'lifecycle.confirmation.approve');
  const canDecide = user !== undefined && hasPermission(user, 'lifecycle.probation.decide');
  const [structureOptions, setStructureOptions] = useState<SelectOption[]>([]);
  const [reviews, setReviews] = useState<ProbationReviewItem[]>([]);
  const [alerts, setAlerts] = useState<UpcomingAlerts>({ d30: [], d14: [], d7: [] });
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);

  // Manager evaluation drawer
  const [evalOpen, setEvalOpen] = useState<boolean>(false);
  const [evalReview, setEvalReview] = useState<ProbationReviewItem | null>(null);
  const [evalForm, setEvalForm] = useState({
    recommendation: 'confirm' as 'confirm' | 'extend' | 'separate',
    extensionMonths: '3',
    reviewNotes: 'Demonstrated exceptional performance and adherence to plant safety standards.',
    ratingCompetence: '5',
    ratingAttendance: '5',
    ratingTeamwork: '4',
    ratingSafety: '5',
  });

  // Decision modal / drawer
  const [decisionOpen, setDecisionOpen] = useState<boolean>(false);
  const [decisionReview, setDecisionReview] = useState<ProbationReviewItem | null>(null);
  const [decisionForm, setDecisionForm] = useState({
    outcome: 'confirmed' as 'confirm' | 'extend' | 'separate' | 'confirmed' | 'extended' | 'separated',
    confirmationDate: new Date().toISOString().slice(0, 10),
    confirmedAnnualCtc: '600000',
    salaryStructureId: '',
    extensionMonths: '3',
    decisionNotes: 'Confirmed after comprehensive evaluation and manager recommendation.',
  });

  const filterSelectId = useId();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const rRes = await apiFetch<{ reviews: ProbationReviewItem[] }>('/api/lifecycle/probation/reviews');
      setReviews(rRes.reviews);
    } catch (e: unknown) {
      // No sample data: show the real failure.
      toast.error(e instanceof Error ? e.message : 'Could not load data. Please retry.');
    }

    try {
      const aRes = await apiFetch<AlertsResponse>('/api/lifecycle/probation/alerts');
      setAlerts({ d30: aRes.d30ReviewIds, d14: aRes.d14ReviewIds, d7: aRes.d7ReviewIds });
    } catch {
      setAlerts({ d30: [], d14: [], d7: [] });
    }
    if (canDecide) {
      const structures = await apiFetch<{ id: number; name: string }[]>('/api/payroll/structures').catch(() => []);
      setStructureOptions(structures.map((st) => ({ value: String(st.id), label: st.name })));
    }
    setLoading(false);
  }, [canDecide]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredReviews = reviews.filter((r) => {
    if (selectedStatus === 'all') return true;
    return r.status === selectedStatus;
  });

  const openEvaluationDrawer = (r: ProbationReviewItem) => {
    setEvalReview(r);
    setEvalForm({
      recommendation: r.managerRecommendation ?? 'confirm',
      extensionMonths: String(r.extensionMonths ?? 3),
      reviewNotes: r.reviewNotes ?? 'Employee has completed training objectives satisfactorily.',
      ratingCompetence: '5',
      ratingAttendance: '5',
      ratingTeamwork: '4',
      ratingSafety: '5',
    });
    setEvalOpen(true);
  };

  const handleEvaluationSubmit = async () => {
    if (!evalReview) return;
    try {
      await apiFetch<{ success: boolean }>('/api/lifecycle/probation/evaluate', {
        method: 'POST',
        body: JSON.stringify({
          reviewId: evalReview.id,
          managerRecommendation: evalForm.recommendation,
          extensionMonths: evalForm.recommendation === 'extend' ? Number(evalForm.extensionMonths) : undefined,
          reviewNotes: evalForm.reviewNotes,
          ratings: {
            competence: Number(evalForm.ratingCompetence),
            attendance: Number(evalForm.ratingAttendance),
            teamwork: Number(evalForm.ratingTeamwork),
            safety: Number(evalForm.ratingSafety),
          },
        }),
      });

      toast.success('Manager probation evaluation submitted successfully.');
      setEvalOpen(false);
      void loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Evaluation submission failed');
    }
  };

  const openDecisionDrawer = (r: ProbationReviewItem) => {
    setDecisionReview(r);
    const initialOutcome = r.managerRecommendation === 'extend' ? 'extended' : 'confirmed';
    setDecisionForm({
      outcome: initialOutcome,
      confirmationDate: r.dueDate,
      confirmedAnnualCtc: '600000',
      salaryStructureId: structureOptions[0]?.value ?? '',
      extensionMonths: String(r.extensionMonths ?? 3),
      decisionNotes: `Approved based on manager evaluation (${r.reviewNotes ?? 'Satisfactory completion'}).`,
    });
    setDecisionOpen(true);
  };

  const handleDecisionSubmit = async () => {
    if (!decisionReview) return;
    try {
      const outcomeVal = decisionForm.outcome === 'confirmed'
        ? 'confirmed'
        : decisionForm.outcome === 'extended'
        ? 'extended'
        : 'separated';

      const res = await apiFetch<{ outcome: string; confirmationLetterId?: number }>('/api/lifecycle/probation/decide', {
        method: 'POST',
        body: JSON.stringify({
          reviewId: decisionReview.id,
          outcome: outcomeVal,
          confirmationDate: outcomeVal === 'confirmed' ? decisionForm.confirmationDate : undefined,
          confirmedAnnualCtc: outcomeVal === 'confirmed' ? Number(decisionForm.confirmedAnnualCtc) : undefined,
          salaryStructureId: outcomeVal === 'confirmed' && decisionForm.salaryStructureId ? Number(decisionForm.salaryStructureId) : undefined,
          extensionMonths: outcomeVal === 'extended' ? Number(decisionForm.extensionMonths) : undefined,
          decisionNotes: decisionForm.decisionNotes,
        }),
      });

      if (res.outcome === 'confirmed') {
        toast.success(`Employee confirmed! Permanent status active and confirmation letter #${String(res.confirmationLetterId ?? '')} issued.`);
      } else if (res.outcome === 'extended') {
        toast.success('Probation extended. Next review cycle scheduled.');
      } else {
        toast.success('Separation recorded.');
      }
      setDecisionOpen(false);
      void loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Decision execution failed');
    }
  };

  const columns: Column<ProbationReviewItem>[] = [
    {
      key: 'ecode',
      header: 'Employee',
      render: (r) => (
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold text-ink">{r.ecode}</span>
            <p className="font-medium text-ink">{r.name}</p>
          </div>
          <p className="text-xs text-ink-muted">
            {r.designation ?? 'Trainee'} • {r.department ?? 'Plant Operations'}
          </p>
        </div>
      ),
    },
    {
      key: 'doj',
      header: 'DOJ & Due Date',
      render: (r) => (
        <div>
          <p className="text-xs text-ink">DOJ: {r.doj ?? '2026-05-01'}</p>
          <div className="mt-0.5 flex items-center gap-1.5 font-medium text-xs text-warning-ink">
            <Clock className="h-3 w-3" />
            <span>Due: {r.dueDate}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'managerRecommendation',
      header: 'Manager Recommendation',
      render: (r) => {
        if (!r.managerRecommendation) {
          return <span className="text-xs text-ink-subtle italic">Pending submission</span>;
        }
        if (r.managerRecommendation === 'confirm') {
          return <StatusBadge tone="positive">Confirm (Permanent)</StatusBadge>;
        }
        if (r.managerRecommendation === 'extend') {
          return <StatusBadge tone="warning">Extend ({r.extensionMonths ?? 3}m)</StatusBadge>;
        }
        return <StatusBadge tone="negative">Separate</StatusBadge>;
      },
    },
    {
      key: 'status',
      header: 'Review Status',
      render: (r) => {
        if (r.status === 'completed') {
          return (
            <StatusBadge tone="positive">
              {r.outcome === 'confirmed' ? 'Confirmed' : r.outcome === 'extended' ? 'Extended' : 'Separated'}
            </StatusBadge>
          );
        }
        if (r.status === 'under_review') {
          return <StatusBadge tone="info">Under HR Review</StatusBadge>;
        }
        return <StatusBadge tone="neutral">Pending Manager</StatusBadge>;
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (r) => (
        <div className="flex items-center gap-2">
          {r.status !== 'completed' && (
            <>
              {canEvaluate && <Button
                size="sm"
                variant="secondary"
                leadingIcon={<Sliders className="h-4 w-4" />}
                onClick={() => { openEvaluationDrawer(r); }}
              >
                Evaluate
              </Button>}
              {canDecide && <Button
                size="sm"
                variant="primary"
                leadingIcon={<UserCheck className="h-4 w-4" />}
                onClick={() => { openDecisionDrawer(r); }}
              >
                Decide
              </Button>}
            </>
          )}

          {r.status === 'completed' && r.outcome === 'confirmed' && (
            <div className="flex items-center gap-1.5 text-xs font-medium text-positive-ink">
              <CheckCircle2 className="h-4 w-4" />
              <span>Confirmed on {r.confirmationDate}</span>
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Lifecycle / Probation"
        title="Probation"
        description="Reviews due in the next 30 days, manager evaluations and confirmations — the confirmation letter and full salary follow automatically."
      />

      {/* Upcoming alerts — the 14-day queue is today's one gold figure. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:gap-4">
        <StatTile tone="hatched" label="Due in 30 days" icon={<Bell />} value={alerts.d30.length} suffix=" employees" />
        <StatTile tone="accent" label="Due in 14 days (urgent)" icon={<AlertTriangle />} value={alerts.d14.length} suffix=" employees" />
        <StatTile label="Confirmed this month" icon={<Award />} value={reviews.filter((r) => r.status === 'completed' && r.outcome === 'confirmed').length} suffix=" employees" />
      </div>

      {/* Main Probation Review Board Table */}
      <Card>
        <CardHeader
          title="Probation Review Queue"
          subtitle="Employees currently in probationary evaluation cycles across Rashmi Group entities."
          action={
            <div className="flex items-center gap-2">
              <label htmlFor={filterSelectId} className="sr-only">
                Filter by Status
              </label>
              <select
                id={filterSelectId}
                aria-label="Filter reviews by status"
                className="rounded-lg border border-line bg-surface-1 px-3 py-1.5 text-xs text-ink"
                value={selectedStatus}
                onChange={(e) => { setSelectedStatus(e.target.value); }}
              >
                {STATUS_FILTERS.map((opt) => (
                  <option key={opt.code} value={opt.code}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          }
        />

        {loading ? (
          <div className="p-8 text-center text-sm text-ink-muted">Loading probation review queue…</div>
        ) : (
          <DataTable
            rows={filteredReviews}
            columns={columns}
            rowKey={(r) => String(r.id)}
          />
        )}
      </Card>

      {/* Manager Evaluation Drawer */}
      <Drawer
        open={evalOpen}
        onClose={() => { setEvalOpen(false); }}
        title="Manager Probation Evaluation"
        subtitle="Submit appraisal rating and formal confirmation recommendation for this employee."
      >
        {evalReview && (
          <div className="space-y-4 p-4">
            <div className="rounded-lg bg-surface-2 p-3 text-xs space-y-1">
              <p className="font-semibold text-ink">{evalReview.name} ({evalReview.ecode})</p>
              <p className="text-ink-muted">{evalReview.designation} • {evalReview.department}</p>
              <p className="text-ink-muted">Due Date: {evalReview.dueDate}</p>
            </div>

            <Select
              label="Manager Recommendation"
              value={evalForm.recommendation}
              onChange={(val) => { setEvalForm({ ...evalForm, recommendation: val as 'confirm' | 'extend' | 'separate' }); }}
              options={RECOMMENDATION_OPTIONS}
            />

            {evalForm.recommendation === 'extend' && (
              <Select
                label="Extension Duration"
                value={evalForm.extensionMonths}
                onChange={(val) => { setEvalForm({ ...evalForm, extensionMonths: val }); }}
                options={EXTENSION_OPTIONS}
              />
            )}

            <div className="space-y-3 pt-2">
              <p className="text-xs font-semibold text-ink">Performance Ratings (1-5)</p>
              <div className="grid grid-cols-2 gap-3">
                <TextField
                  label="Technical Competence"
                  value={evalForm.ratingCompetence}
                  onChange={(e) => { setEvalForm({ ...evalForm, ratingCompetence: e.target.value }); }}
                />
                <TextField
                  label="Attendance & Punctuality"
                  value={evalForm.ratingAttendance}
                  onChange={(e) => { setEvalForm({ ...evalForm, ratingAttendance: e.target.value }); }}
                />
                <TextField
                  label="Teamwork & Collaboration"
                  value={evalForm.ratingTeamwork}
                  onChange={(e) => { setEvalForm({ ...evalForm, ratingTeamwork: e.target.value }); }}
                />
                <TextField
                  label="Safety & Plant Protocol"
                  value={evalForm.ratingSafety}
                  onChange={(e) => { setEvalForm({ ...evalForm, ratingSafety: e.target.value }); }}
                />
              </div>
            </div>

            <TextField
              label="Manager Evaluation Comments"
              value={evalForm.reviewNotes}
              onChange={(e) => { setEvalForm({ ...evalForm, reviewNotes: e.target.value }); }}
            />

            <div className="pt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => { setEvalOpen(false); }}>
                Cancel
              </Button>
              <Button
                variant="primary"
                leadingIcon={<Send className="h-4 w-4" />}
                onClick={() => { void handleEvaluationSubmit(); }}
              >
                Submit Evaluation
              </Button>
            </div>
          </div>
        )}
      </Drawer>

      {/* HR Confirmation / Extension Decision Drawer */}
      <Drawer
        open={decisionOpen}
        onClose={() => { setDecisionOpen(false); }}
        title="Execute Final Confirmation Decision"
        subtitle="Formal HR authorization: confirms contract, updates salary assignment to 100% CTC, and issues confirmation letter."
      >
        {decisionReview && (
          <div className="space-y-4 p-4">
            <div className="rounded-lg bg-surface-2 p-3 text-xs space-y-1">
              <p className="font-semibold text-ink">{decisionReview.name} ({decisionReview.ecode})</p>
              <p className="text-ink-muted">Manager Recommended: {decisionReview.managerRecommendation ?? 'Confirm'}</p>
              <p className="text-ink-muted">Notes: {decisionReview.reviewNotes ?? 'Satisfactory work'}</p>
            </div>

            <Select
              label="Authorized Decision"
              value={decisionForm.outcome}
              onChange={(val) => { setDecisionForm({ ...decisionForm, outcome: val as 'confirm' | 'extend' | 'separate' }); }}
              options={[
                { value: 'confirmed', label: 'Authorize Confirmation (Permanent Employment)' },
                { value: 'extended', label: 'Authorize Extension (Reschedule Review)' },
                { value: 'separated', label: 'Authorize Separation' },
              ]}
            />

            {decisionForm.outcome === 'confirmed' && (
              <>
                <TextField
                  label="Effective Confirmation Date"
                  value={decisionForm.confirmationDate}
                  onChange={(e) => { setDecisionForm({ ...decisionForm, confirmationDate: e.target.value }); }}
                />
                <TextField
                  label="Confirmed Annual CTC (100% full pay ₹)"
                  value={decisionForm.confirmedAnnualCtc}
                  onChange={(e) => { setDecisionForm({ ...decisionForm, confirmedAnnualCtc: e.target.value }); }}
                />
                <Select
                  label="Confirmed Salary Structure"
                  value={decisionForm.salaryStructureId}
                  onChange={(val) => { setDecisionForm({ ...decisionForm, salaryStructureId: val }); }}
                  options={structureOptions}
                />

                <div className="rounded-row bg-[color-mix(in_srgb,var(--positive)_10%,var(--surface))] p-3 text-xs text-ink">
                  <p className="font-semibold">Automatic Confirmation Actions:</p>
                  <ul className="mt-1 list-disc pl-4 space-y-0.5 text-[11px]">
                    <li>Transitions core.employees contract_type from 'probationary' to 'permanent'</li>
                    <li>Closes probation salary row effective {decisionForm.confirmationDate} minus 1 day</li>
                    <li>Opens confirmed salary row with 100% CTC in pay.employee_salaries</li>
                    <li>Generates official Confirmation Letter in core.letters</li>
                  </ul>
                </div>
              </>
            )}

            {decisionForm.outcome === 'extended' && (
              <Select
                label="Extension Months"
                value={decisionForm.extensionMonths}
                onChange={(val) => { setDecisionForm({ ...decisionForm, extensionMonths: val }); }}
                options={EXTENSION_OPTIONS}
              />
            )}

            <TextField
              label="HR Authorization Notes"
              value={decisionForm.decisionNotes}
              onChange={(e) => { setDecisionForm({ ...decisionForm, decisionNotes: e.target.value }); }}
            />

            <div className="pt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => { setDecisionOpen(false); }}>
                Cancel
              </Button>
              <Button
                variant="primary"
                leadingIcon={<Award className="h-4 w-4" />}
                onClick={() => { void handleDecisionSubmit(); }}
              >
                Execute Decision
              </Button>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
