/**
 * Payroll run console (M4, PAY-03..06) — docs/05 §4.5, "the most careful UI in the product".
 *
 * Implements:
 * - 7-state stepper reflecting pay.payroll_runs lifecycle:
 *   Draft -> Inputs Locked -> Computed -> Under Review -> Approved -> Finalized -> Paid
 * - Interactive Review Grid with month-over-month delta sorting and anomaly filters
 * - Payslip Drawer preview with per-line calc_note and Golden G10 Overtime formula
 * - Finalize Ceremony modal with typed confirmation ("FINALIZE JUNE 2026 RASHMI METALIKS")
 * - Outputs Card for bank bulk file, SAP JV, variance report, and statutory filings
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  Lock,
  Play,
  RotateCcw,
  ShieldCheck,
  Check,
} from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  ConfirmModal,
  DarkCard,
  PageHeader,
  StatusBadge,
  Timeline,
  toast,
} from '../../ui';
import type { TimelineStep } from '../../ui';
import { PayrollReviewGrid, type GridEmployeeItem } from './PayrollReviewGrid';
import { PayslipDrawer } from './PayslipDrawer';
import { OutputsCard } from './OutputsCard';

/** The `pay.payroll_runs` 7-state machine (docs/03 §10, PAY-03). */
const RUN_STATES = [
  {
    code: 'draft',
    label: 'Draft',
    gate: 'The month is opened. Pre-conditions checked: attendance month must be locked.',
  },
  {
    code: 'inputs_locked',
    label: 'Inputs locked',
    gate: 'Attendance frozen, variable inputs locked. No retro changes permitted in period.',
  },
  {
    code: 'computed',
    label: 'Computed',
    gate: 'Every rupee calculated down to integer paise. Reconciliation matched.',
  },
  {
    code: 'under_review',
    label: 'Under review',
    gate: 'Biggest month-to-month changes rise to top. Negative nets flagged.',
  },
  {
    code: 'approved',
    label: 'Approved',
    gate: 'Two-person check passed: independent checker verified register to the paisa.',
  },
  {
    code: 'finalized',
    label: 'Finalized',
    gate: 'Locked & immutable. Signed by payroll admin and HR head.',
  },
  {
    code: 'paid',
    label: 'Disbursed',
    gate: 'Bank bulk transfer file generated and processed by Treasury.',
  },
] as const;

type RunStatusCode = (typeof RUN_STATES)[number]['code'];

// Initial synthetic employees for display & review
const INITIAL_REVIEW_ITEMS: GridEmployeeItem[] = [
  {
    id: 1,
    ecode: 'RML035384',
    name: 'Arun Kumar',
    department: 'Production - SMS',
    designation: 'Senior Engineer',
    costCenter: 'SMS Plant 1',
    doj: '15 Jan 2022',
    bankAccountMasked: '••••••••1234',
    bankName: 'State Bank of India',
    ifsc: 'SBIN0001234',
    panMasked: '••••••123A',
    uanMasked: '••••••••1234',
    pfNumberMasked: '••••••••5678',
    esicNumberMasked: '••••••••9012',
    payableDays: 28.5,
    lopDays: 1.5,
    otMinutes: 240, // 4 hrs
    grossRupees: 64573,
    deductionsRupees: 6574,
    netPayRupees: 57999,
    netPayInWords: 'Rupees Fifty-Seven Thousand Nine Hundred Ninety-Nine Only',
    grossDelta: 1250,
    netDelta: 1100,
    anomalies: [],
    isHold: false,
    earnings: [
      { code: 'BASIC', name: 'Basic Salary', amountRupees: 32286, calcNote: 'Basic ₹34,000 × 28.5/30' },
      { code: 'HRA', name: 'House Rent Allowance', amountRupees: 16143, calcNote: '50% of Basic' },
      { code: 'SPECIAL', name: 'Special Allowance', amountRupees: 15067, calcNote: 'Residual balancing component' },
      { code: 'OT_PAY', name: 'Overtime Wages', amountRupees: 1077, calcNote: 'Factories Act G10: 4 hrs @ 2x rate' },
    ],
    deductions: [
      { code: 'PF_EE', name: 'Provident Fund (Employee)', amountRupees: 3874, calcNote: '12% on PF wages' },
      { code: 'PT', name: 'Professional Tax', amountRupees: 200, calcNote: 'West Bengal slab (> ₹40k)' },
      { code: 'TDS', name: 'Income Tax (TDS)', amountRupees: 2500, calcNote: 'Budget 2025 New Regime monthly' },
    ],
  },
  {
    id: 2,
    ecode: 'RML035385',
    name: 'Priyanka Ghosh',
    department: 'Quality Assurance',
    designation: 'QA Executive',
    costCenter: 'Quality Lab',
    doj: '01 Jun 2023',
    bankAccountMasked: '••••••••5678',
    bankName: 'HDFC Bank',
    ifsc: 'HDFC0001234',
    panMasked: '••••••567B',
    uanMasked: '••••••••5678',
    pfNumberMasked: '••••••••9012',
    esicNumberMasked: '••••••••3456',
    payableDays: 30,
    lopDays: 0,
    otMinutes: 0,
    grossRupees: 20999, // ESIC boundary case G3a
    deductionsRupees: 1685,
    netPayRupees: 19314,
    netPayInWords: 'Rupees Nineteen Thousand Three Hundred Fourteen Only',
    grossDelta: 0,
    netDelta: 0,
    anomalies: [],
    isHold: false,
    earnings: [
      { code: 'BASIC', name: 'Basic Salary', amountRupees: 12000, calcNote: 'Full month basic' },
      { code: 'HRA', name: 'House Rent Allowance', amountRupees: 5000, calcNote: 'HRA allowance' },
      { code: 'SPECIAL', name: 'Special Allowance', amountRupees: 3999, calcNote: 'Balancing allowance' },
    ],
    deductions: [
      { code: 'PF_EE', name: 'Provident Fund', amountRupees: 1440, calcNote: '12% of basic' },
      { code: 'ESIC_EE', name: 'ESIC (Employee)', amountRupees: 158, calcNote: '0.75% of ₹20,999 rounded UP' },
      { code: 'PT', name: 'Professional Tax', amountRupees: 87, calcNote: 'West Bengal slab' },
    ],
  },
  {
    id: 3,
    ecode: 'RML035386',
    name: 'Bikram Mondal',
    department: 'Maintenance',
    designation: 'Technician Apprentice',
    costCenter: 'Plant Maintenance',
    doj: '01 Apr 2024',
    bankAccountMasked: '••••••••9012',
    bankName: 'Punjab National Bank',
    ifsc: 'PUNB0001234',
    panMasked: '••••••890C',
    uanMasked: '••••••••9012',
    pfNumberMasked: '—',
    esicNumberMasked: '—',
    payableDays: 30,
    lopDays: 0,
    otMinutes: 0,
    grossRupees: 15000, // Apprentice G9
    deductionsRupees: 110,
    netPayRupees: 14890,
    netPayInWords: 'Rupees Fourteen Thousand Eight Hundred Ninety Only',
    grossDelta: 0,
    netDelta: 0,
    anomalies: [],
    isHold: false,
    earnings: [
      { code: 'STIPEND', name: 'Apprentice Stipend', amountRupees: 15000, calcNote: 'Apprentices Act 1961 excluded from PF/ESIC' },
    ],
    deductions: [
      { code: 'PT', name: 'Professional Tax', amountRupees: 110, calcNote: 'West Bengal slab (₹10k–₹15k)' },
    ],
  },
  {
    id: 4,
    ecode: 'RML035387',
    name: 'Rajesh Mukherjee',
    department: 'Logistics',
    designation: 'Officer - Logistics',
    costCenter: 'Dispatch',
    doj: '10 Nov 2020',
    bankAccountMasked: '••••••••3456',
    bankName: 'Axis Bank',
    ifsc: 'UTIB0001234',
    panMasked: '••••••234D',
    uanMasked: '••••••••3456',
    pfNumberMasked: '••••••••7890',
    esicNumberMasked: '—',
    payableDays: 10,
    lopDays: 20, // High LOP spike!
    otMinutes: 0,
    grossRupees: 12000,
    deductionsRupees: 3500,
    netPayRupees: 8500,
    netPayInWords: 'Rupees Eight Thousand Five Hundred Only',
    grossDelta: -24000,
    netDelta: -21500,
    anomalies: ['High Gross Variance (-₹24,000)', 'LOP Spike (+20 days)'],
    isHold: false,
    earnings: [
      { code: 'BASIC', name: 'Basic Salary', amountRupees: 6000, calcNote: 'Basic ₹18,000 × 10/30' },
      { code: 'HRA', name: 'House Rent Allowance', amountRupees: 3000, calcNote: 'HRA × 10/30' },
      { code: 'SPECIAL', name: 'Special Allowance', amountRupees: 3000, calcNote: 'Allowance × 10/30' },
    ],
    deductions: [
      { code: 'PF_EE', name: 'Provident Fund', amountRupees: 720, calcNote: '12% of basic' },
      { code: 'LOAN_EMI', name: 'Staff Loan Recovery', amountRupees: 2500, calcNote: 'Monthly EMI recovery' },
      { code: 'PT', name: 'Professional Tax', amountRupees: 110, calcNote: 'West Bengal slab' },
      { code: 'TDS', name: 'Income Tax', amountRupees: 170, calcNote: 'Monthly TDS' },
    ],
  },
  {
    id: 5,
    ecode: 'RML035388',
    name: 'Sunita Das',
    department: 'Finance & Accounts',
    designation: 'Senior Accountant',
    costCenter: 'Finance',
    doj: '05 Mar 2021',
    bankAccountMasked: '••••••••7890',
    bankName: 'ICICI Bank',
    ifsc: 'ICIC0001234',
    panMasked: '••••••456E',
    uanMasked: '••••••••7890',
    pfNumberMasked: '••••••••1234',
    esicNumberMasked: '—',
    payableDays: 30,
    lopDays: 0,
    otMinutes: 0,
    grossRupees: 55000,
    deductionsRupees: 5800,
    netPayRupees: 49200,
    netPayInWords: 'Rupees Forty-Nine Thousand Two Hundred Only',
    grossDelta: 0,
    netDelta: 0,
    anomalies: ['Salary On Hold (Disciplinary inquiry)'],
    isHold: true,
    earnings: [
      { code: 'BASIC', name: 'Basic Salary', amountRupees: 27500, calcNote: 'Full basic' },
      { code: 'HRA', name: 'House Rent Allowance', amountRupees: 13750, calcNote: '50% of Basic' },
      { code: 'SPECIAL', name: 'Special Allowance', amountRupees: 13750, calcNote: 'Residual' },
    ],
    deductions: [
      { code: 'PF_EE', name: 'Provident Fund', amountRupees: 3300, calcNote: '12% of basic' },
      { code: 'PT', name: 'Professional Tax', amountRupees: 200, calcNote: 'West Bengal slab' },
      { code: 'TDS', name: 'Income Tax', amountRupees: 2300, calcNote: 'Monthly TDS' },
    ],
  },
];

export function PayrollPage() {
  const [currentRunStatus, setCurrentRunStatus] = useState<RunStatusCode>('computed');
  const [selectedEmployee, setSelectedEmployee] = useState<GridEmployeeItem | null>(null);
  const [isFinalizeModalOpen, setIsFinalizeModalOpen] = useState(false);
  const [isReopenModalOpen, setIsReopenModalOpen] = useState(false);
  const [activeMonth] = useState('June 2026');
  const [companyName] = useState('Rashmi Metaliks Limited');

  const stepIndex = RUN_STATES.findIndex((s) => s.code === currentRunStatus);

  const steps: TimelineStep[] = RUN_STATES.map((state, idx) => ({
    id: state.code,
    title: state.label,
    description: state.gate,
    state: idx < stepIndex ? 'done' : idx === stepIndex ? 'current' : 'pending',
  }));

  // Stepper Transition Handlers
  const handleLockInputs = () => {
    setCurrentRunStatus('inputs_locked');
    toast.success('Attendance frozen and payroll inputs locked successfully.');
  };

  const handleCompute = () => {
    setCurrentRunStatus('computed');
    toast.success('Payroll computed deterministically: 5 employees processed in 42ms.');
  };

  const handleReview = () => {
    setCurrentRunStatus('under_review');
    toast.success('Payroll run submitted for maker/checker review.');
  };

  const handleApprove = () => {
    setCurrentRunStatus('approved');
    toast.success('Independent maker/checker approval signed off.');
  };

  const handleFinalizeConfirm = () => {
    setIsFinalizeModalOpen(false);
    setCurrentRunStatus('finalized');
    toast.success('Payroll run FINALIZED. All statutory outputs and payslips generated.');
  };

  const handleReopenConfirm = () => {
    setIsReopenModalOpen(false);
    setCurrentRunStatus('under_review');
    toast.info('Payroll run reopened with audit record.');
  };

  const handleDownloadOutput = (code: string) => {
    toast.success(`Exporting ${code.toUpperCase()} file...`);
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Monthly Run Console"
        title="Payroll"
        description="The money engine of Rashmi Group — lock attendance, verify calculations, execute maker/checker sign-off, and emit regulatory filings."
        actions={
          <div className="flex items-center gap-2">
            <Link
              to="/payroll/structures"
              className="inline-flex items-center justify-center rounded-btn border border-rule bg-surface-1 px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-surface-2"
            >
              Salary Structures
            </Link>
            <Link
              to="/payroll/revisions"
              className="inline-flex items-center justify-center rounded-btn border border-rule bg-surface-1 px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-surface-2"
            >
              Salary Revisions
            </Link>
            <Link
              to="/payroll/parallel-run"
              className="inline-flex items-center justify-center rounded-btn border border-rule bg-surface-1 px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-surface-2"
            >
              Parallel Run & Annual
            </Link>
            <StatusBadge tone={currentRunStatus === 'finalized' ? 'positive' : 'warning'}>
              {currentRunStatus.toUpperCase().replace('_', ' ')}
            </StatusBadge>
          </div>
        }
      />

      {/* Run Summary Banner */}
      <DarkCard padded={false} className="p-8 md:p-10">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-hero-muted">
              Active Payroll Run
            </p>
            <h2 className="mt-2 text-3xl font-light tracking-tight text-hero-ink">
              {companyName} — {activeMonth}
            </h2>
            <p className="mt-2 text-xs text-hero-muted">
              Pre-condition: Attendance Month Lock #102 verified · Zero float math · Money in integer paise
            </p>
          </div>

          {/* Contextual Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {currentRunStatus === 'draft' && (
              <Button variant="primary" onClick={handleLockInputs}>
                <Lock className="mr-1.5 size-4" /> Lock Inputs
              </Button>
            )}

            {currentRunStatus === 'inputs_locked' && (
              <Button variant="primary" onClick={handleCompute}>
                <Play className="mr-1.5 size-4" /> Compute Salaries
              </Button>
            )}

            {currentRunStatus === 'computed' && (
              <Button variant="primary" onClick={handleReview}>
                <Check className="mr-1.5 size-4" /> Submit for Review
              </Button>
            )}

            {currentRunStatus === 'under_review' && (
              <Button variant="primary" onClick={handleApprove}>
                <ShieldCheck className="mr-1.5 size-4" /> Approve Run (Checker)
              </Button>
            )}

            {currentRunStatus === 'approved' && (
              <Button
                variant="primary"
                onClick={() => { setIsFinalizeModalOpen(true); }}
              >
                <CheckCircle2 className="mr-1.5 size-4" /> Finalize Run
              </Button>
            )}

            {(currentRunStatus === 'approved' || currentRunStatus === 'finalized') && (
              <Button
                variant="secondary"
                onClick={() => { setIsReopenModalOpen(true); }}
              >
                <RotateCcw className="mr-1.5 size-4" /> Reopen Run
              </Button>
            )}
          </div>
        </div>

        {/* Totals KPI Pill Row */}
        <div className="mt-8 grid grid-cols-2 gap-4 border-t border-hero-muted/20 pt-6 sm:grid-cols-4">
          <div>
            <span className="text-xs text-hero-muted">Total Employees</span>
            <p className="mt-1 text-2xl font-light text-hero-ink">5</p>
          </div>
          <div>
            <span className="text-xs text-hero-muted">Gross Earnings</span>
            <p className="mt-1 text-2xl font-light text-hero-ink">₹1,67,572.00</p>
          </div>
          <div>
            <span className="text-xs text-hero-muted">Total Deductions</span>
            <p className="mt-1 text-2xl font-light text-hero-ink">₹17,669.00</p>
          </div>
          <div>
            <span className="text-xs text-hero-muted">Net Disbursable</span>
            <p className="mt-1 text-2xl font-light text-accent">₹1,49,903.00</p>
          </div>
        </div>
      </DarkCard>

      {/* Stepper Timeline */}
      <Card>
        <CardHeader
          title="Run Lifecycle Stepper"
          subtitle="Each phase must satisfy its deterministic gate before the next action enables."
        />
        <Timeline steps={steps} />
      </Card>

      {/* Employee Review Grid */}
      <PayrollReviewGrid
        items={INITIAL_REVIEW_ITEMS}
        onSelectEmployee={(emp) => { setSelectedEmployee(emp); }}
      />

      {/* Outputs Card */}
      <OutputsCard
        runId={1}
        month={activeMonth}
        isFinalized={currentRunStatus === 'finalized' || currentRunStatus === 'paid'}
        onDownloadOutput={handleDownloadOutput}
      />

      {/* Payslip Drawer */}
      <PayslipDrawer
        open={Boolean(selectedEmployee)}
        onClose={() => { setSelectedEmployee(null); }}
        month={activeMonth}
        employee={selectedEmployee}
      />

      {/* Typed Finalize Confirmation Ceremony Modal */}
      <ConfirmModal
        open={isFinalizeModalOpen}
        onClose={() => { setIsFinalizeModalOpen(false); }}
        onConfirm={handleFinalizeConfirm}
        title="Finalize Payroll Run"
        description={
          <div className="space-y-3">
            <p>
              Finalizing will lock all salary calculations for <strong>{activeMonth}</strong>.
              All employee payslips, NEFT/RTGS bank bulk transfer file, SAP Journal Voucher,
              and statutory returns (PF ECR, ESIC, PT, TDS) will be immutably sealed.
            </p>
            <div className="rounded-card bg-caution/10 p-3 text-xs text-caution">
              <AlertCircle className="mb-1 inline size-3.5 mr-1" />
              This action requires typed two-person authorization. To confirm, type the phrase below:
            </div>
          </div>
        }
        confirmLabel="Finalize & Seal Month"
        typedConfirmation={`FINALIZE ${activeMonth.toUpperCase()} ${companyName.toUpperCase()}`}
      />

      {/* Reopen Confirmation Modal */}
      <ConfirmModal
        open={isReopenModalOpen}
        onClose={() => { setIsReopenModalOpen(false); }}
        onConfirm={handleReopenConfirm}
        title="Reopen Payroll Run"
        description="Reopening will return the run to Under Review status. An immutable audit trail entry will be recorded with your user ID and timestamp."
        confirmLabel="Reopen for Corrections"
        danger
      />
    </div>
  );
}
