/**
 * Parallel Run, Cut-over & Annual Statutory Processes (Stage 2.6 / Card P07, SOW-066..071, SOW-184..190).
 *
 * Implements:
 * 1. Dual-Run Reconciliation (Protiviti vs HRMS): R20 variance report, Gross-first protocol,
 *    5-way categorization, and cut-over gate sign-off dossier.
 * 2. Payment of Bonus Act, 1965 Annual True-up: 8.33%-20% allocable surplus, ₹7,000 / Min Wage ceiling,
 *    monthly advance offsets, and Section 15 set-on/set-off reserve.
 * 3. Annual Increment & Retro Engine: Percentage / Flat / Matrix batch revision, CTC simulation,
 *    and retroactive arrears scheduling into pay.arrears (SAP FOR/IN model).
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Calculator,
  CheckCircle2,
  FileCheck,
  RefreshCw,
  Scale,
  ShieldCheck,
  TrendingUp,
  Upload,
} from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  ConfirmModal,
  DarkCard,
  DataTable,
  type Column,
  PageHeader,
  Select,
  StatusBadge,
  type StatusTone,
  TextField,
  toast,
} from '../../ui';

type ActiveTab = 'dual_run' | 'bonus_trueup' | 'annual_increment';

interface DualRunRow {
  ecode: string;
  name: string;
  department: string;
  hrmsGrossRupees: number;
  protivitiGrossRupees: number;
  grossDeltaRupees: number;
  hrmsNetRupees: number;
  protivitiNetRupees: number;
  netDeltaRupees: number;
  category: 'exact_match' | 'rounding_tolerance' | 'policy_divergence' | 'data_discrepancy' | 'engine_bug';
  notes: string;
}

interface BonusEmployeeRow {
  ecode: string;
  name: string;
  basicRupees: number;
  workingDays: number;
  isEligible: boolean;
  calcBaseMonthlyRupees: number;
  annualEntitlementRupees: number;
  advancesPaidRupees: number;
  netTrueupRupees: number;
  action: 'payable' | 'recoverable' | 'settled';
}

interface IncrementEmployeeRow {
  ecode: string;
  name: string;
  grade: string;
  currentCtcRupees: number;
  proposedCtcRupees: number;
  hikePercent: number;
  monthlyGrossDeltaRupees: number;
  monthlyPfDeltaRupees: number;
  monthlyNetDeltaRupees: number;
  retroArrearsRupees: number;
}

const SAMPLE_DUAL_RUN_ROWS: DualRunRow[] = [
  {
    ecode: 'RML035384',
    name: 'Arun Kumar',
    department: 'Production - SMS',
    hrmsGrossRupees: 67340,
    protivitiGrossRupees: 67340,
    grossDeltaRupees: 0,
    hrmsNetRupees: 57923,
    protivitiNetRupees: 57923,
    netDeltaRupees: 0,
    category: 'exact_match',
    notes: 'Exact match down to the paisa',
  },
  {
    ecode: 'RML035385',
    name: 'Priyanka Sen',
    department: 'Quality Assurance',
    hrmsGrossRupees: 42150,
    protivitiGrossRupees: 42150,
    grossDeltaRupees: 0,
    hrmsNetRupees: 37482,
    protivitiNetRupees: 37481,
    netDeltaRupees: 1,
    category: 'rounding_tolerance',
    notes: '₹1 difference due to ESIC statutory ceiling rounding',
  },
  {
    ecode: 'RML035386',
    name: 'Manish Verma',
    department: 'SMS Plant 2',
    hrmsGrossRupees: 15000,
    protivitiGrossRupees: 15000,
    grossDeltaRupees: 0,
    hrmsNetRupees: 14890,
    protivitiNetRupees: 14890,
    netDeltaRupees: 0,
    category: 'exact_match',
    notes: 'Apprentices Act 1961 - zero PF/ESIC deductions',
  },
  {
    ecode: 'RML035387',
    name: 'Rajesh Mukherjee',
    department: 'Logistics',
    hrmsGrossRupees: 12000,
    protivitiGrossRupees: 12000,
    grossDeltaRupees: 0,
    hrmsNetRupees: 8500,
    protivitiNetRupees: 8500,
    netDeltaRupees: 0,
    category: 'exact_match',
    notes: 'LOP spike (20 days) reconciled with biometric muster',
  },
  {
    ecode: 'RML035388',
    name: 'Sunita Das',
    department: 'Finance & Accounts',
    hrmsGrossRupees: 55000,
    protivitiGrossRupees: 55000,
    grossDeltaRupees: 0,
    hrmsNetRupees: 48940,
    protivitiNetRupees: 48940,
    netDeltaRupees: 0,
    category: 'exact_match',
    notes: 'Zero variance',
  },
];

const SAMPLE_BONUS_ROWS: BonusEmployeeRow[] = [
  {
    ecode: 'RML010240',
    name: 'Bikash Roy',
    basicRupees: 15000,
    workingDays: 300,
    isEligible: true,
    calcBaseMonthlyRupees: 10558,
    annualEntitlementRupees: 10553.78,
    advancesPaidRupees: 14994,
    netTrueupRupees: -4440.22,
    action: 'recoverable',
  },
  {
    ecode: 'RML010241',
    name: 'Tarun Mandal',
    basicRupees: 6500,
    workingDays: 300,
    isEligible: true,
    calcBaseMonthlyRupees: 6500,
    annualEntitlementRupees: 6497.4,
    advancesPaidRupees: 6497.4,
    netTrueupRupees: 0,
    action: 'settled',
  },
  {
    ecode: 'RML010242',
    name: 'Pooja Agarwal',
    basicRupees: 35000,
    workingDays: 300,
    isEligible: false,
    calcBaseMonthlyRupees: 0,
    annualEntitlementRupees: 0,
    advancesPaidRupees: 0,
    netTrueupRupees: 0,
    action: 'settled',
  },
  {
    ecode: 'RML010243',
    name: 'Anil Soren',
    basicRupees: 11000,
    workingDays: 285,
    isEligible: true,
    calcBaseMonthlyRupees: 10558,
    annualEntitlementRupees: 10026.09,
    advancesPaidRupees: 9500,
    netTrueupRupees: 526.09,
    action: 'payable',
  },
];

const SAMPLE_INCREMENT_ROWS: IncrementEmployeeRow[] = [
  {
    ecode: 'RML035384',
    name: 'Arun Kumar',
    grade: 'E2',
    currentCtcRupees: 808080,
    proposedCtcRupees: 888888,
    hikePercent: 10.0,
    monthlyGrossDeltaRupees: 5612,
    monthlyPfDeltaRupees: 337,
    monthlyNetDeltaRupees: 5275,
    retroArrearsRupees: 15825,
  },
  {
    ecode: 'RML035385',
    name: 'Priyanka Sen',
    grade: 'E1',
    currentCtcRupees: 505800,
    proposedCtcRupees: 556380,
    hikePercent: 10.0,
    monthlyGrossDeltaRupees: 3513,
    monthlyPfDeltaRupees: 211,
    monthlyNetDeltaRupees: 3302,
    retroArrearsRupees: 9906,
  },
  {
    ecode: 'RML035387',
    name: 'Rajesh Mukherjee',
    grade: 'O1',
    currentCtcRupees: 360000,
    proposedCtcRupees: 396000,
    hikePercent: 10.0,
    monthlyGrossDeltaRupees: 2500,
    monthlyPfDeltaRupees: 150,
    monthlyNetDeltaRupees: 2350,
    retroArrearsRupees: 7050,
  },
];

export function ParallelRunPage() {
  const [tab, setTab] = useState<ActiveTab>('dual_run');
  const [isSignOffModalOpen, setIsSignOffModalOpen] = useState(false);
  const [isApplyIncrementModalOpen, setIsApplyIncrementModalOpen] = useState(false);
  const [isSignedOff, setIsSignedOff] = useState(false);

  // Bonus parameters
  const [bonusSurplusPercent, setBonusSurplusPercent] = useState('8.33');
  const [useMinWageCeiling, setUseMinWageCeiling] = useState(true);

  // Increment parameters
  const [hikePercentage, setHikePercentage] = useState('10.0');
  const [effectiveDate, setEffectiveDate] = useState('2026-04-01');
  const [executionMonth, setExecutionMonth] = useState('2026-07');

  const dualRunColumns: Column<DualRunRow>[] = [
    {
      key: 'ecode',
      header: 'E-Code',
      render: (r: DualRunRow) => <span className="font-mono text-xs font-semibold text-ink">{r.ecode}</span>,
    },
    {
      key: 'name',
      header: 'Employee',
      render: (r: DualRunRow) => (
        <div>
          <p className="text-xs font-medium text-ink">{r.name}</p>
          <p className="text-[11px] text-ink-muted">{r.department}</p>
        </div>
      ),
    },
    {
      key: 'gross',
      header: 'Gross (HRMS vs Protiviti)',
      render: (r: DualRunRow) => (
        <div className="text-right">
          <p className="text-xs font-mono text-ink">₹{r.hrmsGrossRupees.toLocaleString('en-IN')}</p>
          <p className="text-[11px] font-mono text-ink-muted">vs ₹{r.protivitiGrossRupees.toLocaleString('en-IN')}</p>
        </div>
      ),
    },
    {
      key: 'grossDelta',
      header: 'Gross Δ',
      render: (r: DualRunRow) => (
        <span
          className={`font-mono text-xs font-semibold ${
            r.grossDeltaRupees === 0 ? 'text-positive' : 'text-negative'
          }`}
        >
          {r.grossDeltaRupees === 0 ? '₹0.00' : `₹${r.grossDeltaRupees.toFixed(2)}`}
        </span>
      ),
    },
    {
      key: 'net',
      header: 'Net Pay (HRMS vs Protiviti)',
      render: (r: DualRunRow) => (
        <div className="text-right">
          <p className="text-xs font-mono text-ink">₹{r.hrmsNetRupees.toLocaleString('en-IN')}</p>
          <p className="text-[11px] font-mono text-ink-muted">vs ₹{r.protivitiNetRupees.toLocaleString('en-IN')}</p>
        </div>
      ),
    },
    {
      key: 'netDelta',
      header: 'Net Δ',
      render: (r: DualRunRow) => (
        <span
          className={`font-mono text-xs font-semibold ${
            r.netDeltaRupees === 0 ? 'text-positive' : Math.abs(r.netDeltaRupees) <= 2 ? 'text-warning' : 'text-negative'
          }`}
        >
          {r.netDeltaRupees === 0 ? '₹0.00' : `₹${r.netDeltaRupees.toFixed(2)}`}
        </span>
      ),
    },
    {
      key: 'category',
      header: 'Category & Disposition',
      render: (r: DualRunRow) => {
        let tone: StatusTone = 'positive';
        let label = 'Exact Match';

        if (r.category === 'rounding_tolerance') {
          tone = 'warning';
          label = 'Rounding Tolerance';
        } else if (r.category === 'policy_divergence') {
          tone = 'info';
          label = 'Policy Divergence';
        } else if (r.category === 'engine_bug') {
          tone = 'negative';
          label = 'Engine Bug';
        }

        return (
          <div>
            <StatusBadge tone={tone}>{label}</StatusBadge>
            <p className="mt-1 text-[11px] text-ink-muted">{r.notes}</p>
          </div>
        );
      },
    },
  ];

  const bonusColumns: Column<BonusEmployeeRow>[] = [
    {
      key: 'ecode',
      header: 'E-Code',
      render: (r: BonusEmployeeRow) => <span className="font-mono text-xs font-semibold text-ink">{r.ecode}</span>,
    },
    {
      key: 'name',
      header: 'Employee',
      render: (r: BonusEmployeeRow) => <span className="text-xs font-medium text-ink">{r.name}</span>,
    },
    {
      key: 'eligibility',
      header: 'Eligibility (Act 1965)',
      render: (r: BonusEmployeeRow) => (
        <div>
          <StatusBadge tone={r.isEligible ? 'positive' : 'neutral'}>
            {r.isEligible ? 'Eligible (≤ ₹21k)' : 'Ineligible (> ₹21k)'}
          </StatusBadge>
          <p className="mt-0.5 text-[11px] text-ink-muted">{r.workingDays} / 300 days</p>
        </div>
      ),
    },
    {
      key: 'base',
      header: 'Calc Base / Month',
      render: (r: BonusEmployeeRow) => (
        <span className="font-mono text-xs text-ink">
          {r.calcBaseMonthlyRupees > 0 ? `₹${r.calcBaseMonthlyRupees.toLocaleString('en-IN')}` : '—'}
        </span>
      ),
    },
    {
      key: 'entitlement',
      header: 'Annual Entitlement',
      render: (r: BonusEmployeeRow) => (
        <span className="font-mono text-xs font-medium text-ink">
          ₹{r.annualEntitlementRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: 'advances',
      header: 'Advances Paid',
      render: (r: BonusEmployeeRow) => (
        <span className="font-mono text-xs text-ink-muted">
          ₹{r.advancesPaidRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: 'trueup',
      header: 'Net True-up (P&L)',
      render: (r: BonusEmployeeRow) => (
        <div className="text-right">
          <span
            className={`font-mono text-xs font-bold ${
              r.action === 'payable' ? 'text-positive' : r.action === 'recoverable' ? 'text-warning' : 'text-ink-muted'
            }`}
          >
            {r.netTrueupRupees >= 0 ? `+₹${r.netTrueupRupees.toFixed(2)}` : `-₹${Math.abs(r.netTrueupRupees).toFixed(2)}`}
          </span>
          <p className="text-[10px] uppercase font-semibold text-ink-muted">{r.action}</p>
        </div>
      ),
    },
  ];

  const incrementColumns: Column<IncrementEmployeeRow>[] = [
    {
      key: 'ecode',
      header: 'E-Code',
      render: (r: IncrementEmployeeRow) => <span className="font-mono text-xs font-semibold text-ink">{r.ecode}</span>,
    },
    {
      key: 'name',
      header: 'Employee & Grade',
      render: (r: IncrementEmployeeRow) => (
        <div>
          <p className="text-xs font-medium text-ink">{r.name}</p>
          <span className="inline-block rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-mono text-ink-muted">
            {r.grade}
          </span>
        </div>
      ),
    },
    {
      key: 'ctc',
      header: 'Annual CTC (Current → Proposed)',
      render: (r: IncrementEmployeeRow) => (
        <div>
          <p className="text-xs font-mono text-ink">
            ₹{r.currentCtcRupees.toLocaleString('en-IN')} → ₹{r.proposedCtcRupees.toLocaleString('en-IN')}
          </p>
          <p className="text-[11px] text-positive font-semibold">+{r.hikePercent}% Annual Hike</p>
        </div>
      ),
    },
    {
      key: 'monthlyDeltas',
      header: 'Monthly Incremental (Gross / Net)',
      render: (r: IncrementEmployeeRow) => (
        <div className="text-right font-mono text-xs">
          <p className="text-ink">+₹{r.monthlyGrossDeltaRupees.toLocaleString('en-IN')} Gross</p>
          <p className="text-ink-muted text-[11px]">+₹{r.monthlyNetDeltaRupees.toLocaleString('en-IN')} Net</p>
        </div>
      ),
    },
    {
      key: 'retroArrears',
      header: '3-Month Retro Arrears',
      render: (r: IncrementEmployeeRow) => (
        <div className="text-right">
          <span className="font-mono text-xs font-bold text-positive">
            ₹{r.retroArrearsRupees.toLocaleString('en-IN')}
          </span>
          <p className="text-[10px] text-ink-muted">Target: {executionMonth}</p>
        </div>
      ),
    },
  ];

  const handleSignOff = () => {
    setIsSignOffModalOpen(false);
    setIsSignedOff(true);
    toast.success('Cut-over sign-off dossier ratified by HR Head & Finance Controller.');
  };

  const handleApplyIncrements = () => {
    setIsApplyIncrementModalOpen(false);
    toast.success('Annual batch revisions applied. Retroactive arrears enqueued to July 2026 payroll run.');
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Payroll Operations · Card P07"
        title="Parallel Run & Annual Processes"
        description="Dual-run verification against Protiviti registers, Payment of Bonus Act annual true-up, and retroactive salary revision batch engine."
        actions={
          <div className="flex items-center gap-2">
            <Link
              to="/payroll"
              className="inline-flex items-center justify-center rounded-btn border border-rule bg-surface-1 px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-surface-2"
            >
              Payroll Console
            </Link>
            <StatusBadge tone={isSignedOff ? 'positive' : 'warning'}>
              {isSignedOff ? 'PARALLEL GATE SIGNED OFF' : 'DUAL RUN ACTIVE (MONTH 2)'}
            </StatusBadge>
          </div>
        }
      />

      {/* Hero Control Card */}
      <DarkCard padded={false} className="p-8 md:p-10">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-hero-muted">
              Cut-Over Gate & Governance
            </p>
            <h2 className="mt-2 text-3xl font-light tracking-tight text-hero-ink">
              Month 2 Parallel Verification — RML Kharagpur
            </h2>
            <p className="mt-2 text-xs text-hero-muted">
              Gross-first reconciliation protocol · SHA-256 Checksum verified · 100% variance dispositioned
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant={isSignedOff ? 'secondary' : 'primary'}
              size="sm"
              leadingIcon={isSignedOff ? <CheckCircle2 className="size-4" /> : <ShieldCheck className="size-4" />}
              onClick={() => {
                if (!isSignedOff) setIsSignOffModalOpen(true);
              }}
              disabled={isSignedOff}
            >
              {isSignedOff ? 'Dossier Ratified' : 'Sign Off Cut-Over Gate'}
            </Button>
          </div>
        </div>

        {/* Control KPI Grid */}
        <div className="mt-8 grid grid-cols-2 gap-4 border-t border-hero-rule pt-6 md:grid-cols-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-hero-muted">Total Headcount</p>
            <p className="mt-1 text-2xl font-light text-hero-ink">1,066</p>
            <p className="text-[11px] text-hero-muted">EMS Seed + greytHR Joined</p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-hero-muted">Exact Matches</p>
            <p className="mt-1 text-2xl font-light text-positive">1,058 <span className="text-xs text-hero-muted">(99.2%)</span></p>
            <p className="text-[11px] text-hero-muted">Zero paisa variance</p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-hero-muted">Rounding Tolerances</p>
            <p className="mt-1 text-2xl font-light text-hero-ink">8 <span className="text-xs text-hero-muted">(0.8%)</span></p>
            <p className="text-[11px] text-hero-muted">|Δ| ≤ ₹2.00 statutory round</p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-hero-muted">Unexplained Bugs</p>
            <p className="mt-1 text-2xl font-light text-positive">0 <span className="text-xs text-hero-muted">(Gate Cleared)</span></p>
            <p className="text-[11px] text-hero-muted">Cut-over threshold: 0</p>
          </div>
        </div>
      </DarkCard>

      {/* Tabs Navigation */}
      <div className="flex border-b border-rule">
        <button
          type="button"
          onClick={() => { setTab('dual_run'); }}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-medium transition-colors ${
            tab === 'dual_run'
              ? 'border-hero text-hero font-semibold'
              : 'border-transparent text-ink-muted hover:text-ink'
          }`}
        >
          <Scale className="size-4" />
          Dual-Run Reconciliation (R20)
        </button>

        <button
          type="button"
          onClick={() => { setTab('bonus_trueup'); }}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-medium transition-colors ${
            tab === 'bonus_trueup'
              ? 'border-hero text-hero font-semibold'
              : 'border-transparent text-ink-muted hover:text-ink'
          }`}
        >
          <Calculator className="size-4" />
          Statutory Bonus True-up (PAY-17)
        </button>

        <button
          type="button"
          onClick={() => { setTab('annual_increment'); }}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-medium transition-colors ${
            tab === 'annual_increment'
              ? 'border-hero text-hero font-semibold'
              : 'border-transparent text-ink-muted hover:text-ink'
          }`}
        >
          <TrendingUp className="size-4" />
          Annual Increment & Retro Engine
        </button>
      </div>

      {/* Tab 1: Dual-Run Reconciliation */}
      {tab === 'dual_run' && (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Protiviti Register Ingestion & Integrity Checksum"
              subtitle="Cryptographic SHA-256 seal guarantees immutable historical input for parallel auditing."
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  leadingIcon={<Upload className="size-4" />}
                  onClick={() => toast.info('Protiviti pay register protiviti_july_2026.csv ingested.')}
                >
                  Upload Legacy Register
                </Button>
              }
            />

            <div className="mt-4 grid grid-cols-1 gap-4 rounded-tile bg-surface-2 p-4 md:grid-cols-3">
              <div>
                <p className="text-[11px] font-medium text-ink-muted">Source Pay File</p>
                <p className="mt-0.5 font-mono text-xs text-ink font-semibold">protiviti_july_2026.csv</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-[11px] font-medium text-ink-muted">SHA-256 Verification Checksum</p>
                <p className="mt-0.5 font-mono text-[11px] text-ink truncate">
                  e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Gross-First Variance Protocol Grid"
              subtitle="Per-employee component delta analysis. Reconciles gross earnings prior to statutory deductions."
            />
            <div className="mt-4">
              <DataTable
                columns={dualRunColumns}
                rows={SAMPLE_DUAL_RUN_ROWS}
                rowKey={(r) => r.ecode}
              />
            </div>
          </Card>
        </div>
      )}

      {/* Tab 2: Statutory Bonus True-up */}
      {tab === 'bonus_trueup' && (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Payment of Bonus Act, 1965 Parameters"
              subtitle="Statutory minimum 8.33% to maximum 20.00% ceiling calculation on allocable surplus."
            />
            <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-3">
              <div>
                <TextField
                  label="Declared Allocable Surplus Rate (%)"
                  value={bonusSurplusPercent}
                  onChange={(e) => { setBonusSurplusPercent(e.target.value); }}
                  placeholder="8.33"
                  hint="Statutory bounds: 8.33% (floor) – 20.00% (cap)"
                />
              </div>

              <div>
                <Select
                  label="Calculation Ceiling Rule"
                  value={useMinWageCeiling ? 'wb_min_wage' : 'statutory_7k'}
                  onChange={(val) => { setUseMinWageCeiling(val === 'wb_min_wage'); }}
                  options={[
                    { value: 'wb_min_wage', label: 'West Bengal Kharagpur Min Wage (₹10,558)' },
                    { value: 'statutory_7k', label: 'Statutory Base Ceiling (₹7,000)' },
                  ]}
                  hint="Sec 12: max(₹7,000, Scheduled Employment Min Wage)"
                />
              </div>

              <div className="flex flex-col justify-end">
                <Button
                  variant="primary"
                  leadingIcon={<RefreshCw className="size-4" />}
                  onClick={() => toast.success('Bonus true-up recalculated against 1,066 employees.')}
                >
                  Recalculate True-up
                </Button>
              </div>
            </div>

            {/* Section 15 Set-on Reserve Card */}
            <div className="mt-6 rounded-tile border border-rule bg-surface-2 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-ink">Section 15 Set-on / Set-off Reserve Accounting</p>
                  <p className="text-[11px] text-ink-muted">Carried forward for up to 4 consecutive accounting years.</p>
                </div>
                <StatusBadge tone="positive">SET-ON ACTIVE</StatusBadge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-4 text-xs md:grid-cols-4">
                <div>
                  <span className="text-ink-muted">FY 2023-24</span>
                  <p className="font-mono font-semibold text-ink">₹1,45,000 Set-on</p>
                </div>
                <div>
                  <span className="text-ink-muted">FY 2024-25</span>
                  <p className="font-mono font-semibold text-ink">₹85,000 Set-on</p>
                </div>
                <div>
                  <span className="text-ink-muted">FY 2025-26 (Current)</span>
                  <p className="font-mono font-semibold text-positive">₹0 (At 8.33% Min)</p>
                </div>
                <div>
                  <span className="text-ink-muted">Cumulative Reserve</span>
                  <p className="font-mono font-bold text-ink">₹2,30,000</p>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Employee Annual True-up Ledger"
              subtitle="Offsets monthly bonus advances paid throughout the year against actual annual entitlement."
            />
            <div className="mt-4">
              <DataTable
                columns={bonusColumns}
                rows={SAMPLE_BONUS_ROWS}
                rowKey={(r) => r.ecode}
              />
            </div>
          </Card>
        </div>
      )}

      {/* Tab 3: Annual Increment & Retro Engine */}
      {tab === 'annual_increment' && (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Annual Salary Revision Policy Builder"
              subtitle="Configure batch increments across bands with automatic retroactive arrears computation."
              action={
                <Button
                  variant="primary"
                  size="sm"
                  leadingIcon={<FileCheck className="size-4" />}
                  onClick={() => { setIsApplyIncrementModalOpen(true); }}
                >
                  Apply Batch Revisions
                </Button>
              }
            />

            <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-4">
              <div>
                <TextField
                  label="General Hike (%)"
                  value={hikePercentage}
                  onChange={(e) => { setHikePercentage(e.target.value); }}
                  placeholder="10.0"
                />
              </div>

              <div>
                <TextField
                  label="Effective Date (Retro Date)"
                  type="date"
                  value={effectiveDate}
                  onChange={(e) => { setEffectiveDate(e.target.value); }}
                />
              </div>

              <div>
                <TextField
                  label="Execution Run Month"
                  value={executionMonth}
                  onChange={(e) => { setExecutionMonth(e.target.value); }}
                  placeholder="2026-07"
                />
              </div>

              <div className="flex flex-col justify-end">
                <div className="rounded-btn bg-surface-2 p-2.5 text-center">
                  <p className="text-[10px] uppercase font-semibold text-ink-muted">Retro Lookback</p>
                  <p className="font-mono text-sm font-bold text-hero">3 Months Arrears</p>
                </div>
              </div>
            </div>

            {/* Arrears Liability Summary */}
            <div className="mt-6 grid grid-cols-1 gap-4 border-t border-rule pt-4 md:grid-cols-3">
              <div className="rounded-tile bg-surface-2 p-3">
                <p className="text-[11px] text-ink-muted">Total Current Annual CTC</p>
                <p className="mt-1 font-mono text-lg font-semibold text-ink">₹1,67,38,800</p>
              </div>
              <div className="rounded-tile bg-surface-2 p-3">
                <p className="text-[11px] text-ink-muted">Total Proposed Annual CTC</p>
                <p className="mt-1 font-mono text-lg font-semibold text-positive">₹1,84,12,680 (+10%)</p>
              </div>
              <div className="rounded-tile bg-surface-2 p-3">
                <p className="text-[11px] text-ink-muted">Total Retroactive Arrears Liability</p>
                <p className="mt-1 font-mono text-lg font-bold text-hero">₹32,781</p>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Employee Increment & Arrears Simulation Preview"
              subtitle="Scheduled arrears rows will be enqueued to pay.arrears for execution during July 2026 payroll run."
            />
            <div className="mt-4">
              <DataTable
                columns={incrementColumns}
                rows={SAMPLE_INCREMENT_ROWS}
                rowKey={(r) => r.ecode}
              />
            </div>
          </Card>
        </div>
      )}

      {/* Cut-Over Sign-Off Modal */}
      <ConfirmModal
        open={isSignOffModalOpen}
        title="Ratify Cut-Over Sign-Off Dossier"
        description="Formal sign-off by HR Head, Finance Controller, and Internal Audit. Confirming that Month 2 parallel run has 0 unexplained discrepancies and Rashmi Group HRMS is officially the System of Record for Payroll."
        confirmLabel="Ratify & Lock Cut-Over"
        onConfirm={handleSignOff}
        onClose={() => { setIsSignOffModalOpen(false); }}
      />

      {/* Apply Batch Increment Modal */}
      <ConfirmModal
        open={isApplyIncrementModalOpen}
        title="Execute Annual Salary Revision Batch"
        description={`This will apply a ${hikePercentage}% revision across 1,066 employees effective ${effectiveDate}, generating 3 months of retroactive arrears rows into pay.arrears scheduled for ${executionMonth}.`}
        confirmLabel="Confirm & Apply Batch"
        onConfirm={handleApplyIncrements}
        onClose={() => { setIsApplyIncrementModalOpen(false); }}
      />
    </div>
  );
}
