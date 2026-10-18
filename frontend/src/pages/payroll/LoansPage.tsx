/**
 * Loans & Advances Page (M11, LN-01..04)
 *
 * Implements:
 * - ESS: My loans, live balance, repayment schedule with Section 17(2) perquisite valuation
 * - Live Loan Calculator & Application form with tenure and 30% salary eligibility checks
 * - Admin: Company loans registry, ledger inspection, and legacy SAP balance import
 */
import { authFetch, responseError } from '../../lib/api';
import { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  PlusCircle,
} from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  DataTable,
  type Column,
  Drawer,
  PageHeader,
  Select,
  StatusBadge,
  type StatusTone,
  TextField,
  ConfirmModal,
  toast,
  StatGrid, StatTile,
} from '../../ui';

type Tab = 'my' | 'apply' | 'admin';

interface LoanSummary {
  loanId: number;
  employeeId: number;
  ecode?: string;
  employeeName?: string;
  loanType: string;
  originalPrincipalRupees: number;
  annualInterestRate: number;
  monthlyEmiRupees: number;
  tenureMonths: number;
  startMonth: string;
  currentOutstandingRupees: number;
  totalRecoveredPrincipalRupees: number;
  totalRecoveredInterestRupees: number;
  totalPerquisiteValuedRupees: number;
  status: 'active' | 'closed' | 'written_off';
  source: string;
  postingsCount: number;
}

interface ScheduleItem {
  installmentNumber: number;
  principalPart: number;
  interestPart: number;
  totalEmi: number;
  closingOutstanding: number;
  perquisiteValue: number;
}

interface SchedulePreviewResponse {
  eligible: boolean;
  reasons: string[];
  monthlyGrossRupees: number;
  projectedEmiRupees: number;
  maxAllowedEmiRupees: number;
  monthlyEmi: number;
  totalInterest: number;
  totalPayment: number;
  schedule: ScheduleItem[];
}

const LOAN_TYPE_LABELS: Record<string, string> = {
  loan_diminishing: 'Reducing Balance',
  loan_flat: 'Flat Rate',
  emi_no_interest: 'Zero Interest EMI',
  salary_advance: 'Salary Advance',
  travel_advance: 'Travel Advance',
};

const LOAN_TYPE_OPTIONS = [
  { value: 'loan_diminishing', label: 'Reducing Balance (Diminishing)' },
  { value: 'loan_flat', label: 'Flat Rate Interest' },
  { value: 'emi_no_interest', label: 'Zero Interest EMI' },
  { value: 'salary_advance', label: 'Salary Advance (1-3 months)' },
];

function formatINR(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function LoansPage() {
  const [tab, setTab] = useState<Tab>('my');
  const [myLoans, setMyLoans] = useState<LoanSummary[]>([]);
  const [allLoans, setAllLoans] = useState<LoanSummary[]>([]);

  // Application form state
  const [applyType, setApplyType] = useState('loan_diminishing');
  const [applyPrincipal, setApplyPrincipal] = useState('50000');
  const [applyRate, setApplyRate] = useState('8.5');
  const [applyTenure, setApplyTenure] = useState('12');
  const [applyStartMonth, setApplyStartMonth] = useState('2026-07-01');
  const [preview, setPreview] = useState<SchedulePreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Drawer / Details modal state
  const [selectedLoan, setSelectedLoan] = useState<LoanSummary | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loanSchedule, setLoanSchedule] = useState<ScheduleItem[]>([]);

  // Legacy SAP import modal state
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importEmpId, setImportEmpId] = useState('');
  const [importPrincipal, setImportPrincipal] = useState('');
  const [importBalance, setImportBalance] = useState('');
  const [importRate, setImportRate] = useState('8.5');
  const [importEmi, setImportEmi] = useState('');
  const [importTenure, setImportTenure] = useState('12');
  const [importRef, setImportRef] = useState('');

  // Initial load
  async function loadData() {
    try {
      if (tab === 'my') {
        const res = await authFetch('/api/loans/my');
        if (res.ok) {
          const data = (await res.json()) as LoanSummary[];
          setMyLoans(data);
        }
      } else if (tab === 'admin') {
        const res = await authFetch('/api/loans/all');
        if (res.ok) {
          const data = (await res.json()) as LoanSummary[];
          setAllLoans(data);
        }
      }
    } catch (e: unknown) {
      // No sample data: show the real failure.
      toast.error(e instanceof Error ? e.message : 'Could not load data. Please retry.');
    }
  }

  useEffect(() => {
    void loadData();
  }, [tab]);

  // Calculate live preview when parameters change
  useEffect(() => {
    if (tab === 'apply') {
      void calculatePreview();
    }
  }, [applyType, applyPrincipal, applyRate, applyTenure, tab]);

  async function calculatePreview() {
    const principalNum = parseFloat(applyPrincipal);
    const tenureNum = parseInt(applyTenure, 10);
    const rateNum = parseFloat(applyRate) || 0;

    if (isNaN(principalNum) || principalNum <= 0 || isNaN(tenureNum) || tenureNum <= 0) {
      setPreview(null);
      return;
    }

    setPreviewLoading(true);
    try {
      const res = await authFetch('/api/loans/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loanType: applyType,
          principalRupees: principalNum,
          annualInterestRate: rateNum,
          tenureMonths: tenureNum,
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as SchedulePreviewResponse;
        setPreview(data);
      } else {
        setPreview(null);
        toast.error(await responseError(res, 'Could not preview this loan.'));
      }
    } catch (e: unknown) {
      setPreview(null);
      toast.error(e instanceof Error ? e.message : 'Could not preview this loan.');
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleApplySubmit() {
    const principalNum = parseFloat(applyPrincipal);
    const tenureNum = parseInt(applyTenure, 10);
    const rateNum = parseFloat(applyRate) || 0;

    try {
      const res = await authFetch('/api/loans/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loanType: applyType,
          principalRupees: principalNum,
          annualInterestRate: rateNum,
          tenureMonths: tenureNum,
          startMonth: applyStartMonth,
        }),
      });

      if (res.ok) {
        toast.success('Loan application submitted successfully');
        setTab('my');
      } else {
        const err = (await res.json()) as { message?: string };
        toast.error(err.message ?? 'Application failed');
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not reach the server. Nothing was saved.');
    }
  }

  async function handleImportSubmit() {
    try {
      const res = await authFetch('/api/loans/legacy-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: parseInt(importEmpId, 10),
          loanType: 'loan_diminishing',
          originalPrincipalRupees: parseFloat(importPrincipal),
          outstandingBalanceRupees: parseFloat(importBalance),
          annualInterestRate: parseFloat(importRate),
          monthlyEmiRupees: parseFloat(importEmi),
          remainingTenureMonths: parseInt(importTenure, 10),
          startMonth: '2026-07-01',
          sourceReference: importRef,
        }),
      });

      if (res.ok) {
        toast.success('Legacy SAP loan imported successfully');
        setImportModalOpen(false);
        void loadData();
      } else {
        toast.error(await responseError(res, 'Import failed'));
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not reach the server. Nothing was saved.');
    }
  }

  async function handleOpenLedger(loan: LoanSummary) {
    setSelectedLoan(loan);
    setLoanSchedule([]);
    setDrawerOpen(true);
    // Show the recoveries actually posted by payroll runs (immutable ledger).
    try {
      const res = await authFetch(`/api/loans/${String(loan.loanId)}/ledger`);
      if (!res.ok) {
        toast.error(await responseError(res, 'Could not load the loan ledger.'));
        return;
      }
      const data = (await res.json()) as {
        postings: { id: number; principalPart: number; interestPart: number; perquisiteValue: number }[];
      };
      let balance = loan.originalPrincipalRupees;
      setLoanSchedule(
        data.postings.map((p, i) => {
          balance = Math.max(0, balance - p.principalPart);
          return {
            installmentNumber: i + 1,
            principalPart: p.principalPart,
            interestPart: p.interestPart,
            totalEmi: p.principalPart + p.interestPart,
            closingOutstanding: balance,
            perquisiteValue: p.perquisiteValue,
          };
        })
      );
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not load the loan ledger.');
    }
  }

  const columns: Column<LoanSummary>[] = [
    {
      key: 'loanId',
      header: 'Loan ID',
      render: (r) => <span className="font-mono text-xs font-semibold">LN-{r.loanId}</span>,
    },
    ...(tab === 'admin'
      ? [
          {
            key: 'employeeName',
            header: 'Employee',
            render: (r: LoanSummary) => (
              <div>
                <span className="font-medium text-ink">{r.employeeName ?? 'Employee'}</span>
                <span className="block text-xs font-mono text-ink-muted">{r.ecode}</span>
              </div>
            ),
          },
        ]
      : []),
    {
      key: 'loanType',
      header: 'Type',
      render: (r) => (
        <span className="text-xs font-medium text-ink">
          {LOAN_TYPE_LABELS[r.loanType] ?? r.loanType}
        </span>
      ),
    },
    {
      key: 'originalPrincipalRupees',
      header: 'Principal',
      render: (r) => <span className="tabular-nums font-medium">{formatINR(r.originalPrincipalRupees)}</span>,
    },
    {
      key: 'monthlyEmiRupees',
      header: 'Monthly EMI',
      render: (r) => <span className="tabular-nums font-medium text-ink">{formatINR(r.monthlyEmiRupees)}</span>,
    },
    {
      key: 'currentOutstandingRupees',
      header: 'Outstanding Balance',
      render: (r) => (
        <span className="tabular-nums font-semibold text-accent-ink">
          {formatINR(r.currentOutstandingRupees)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => {
        const tone: StatusTone = r.status === 'active' ? 'positive' : 'neutral';
        return <StatusBadge tone={tone}>{r.status.toUpperCase()}</StatusBadge>;
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (r) => (
        <Button size="sm" variant="ghost" onClick={() => { void handleOpenLedger(r); }}>
          View Ledger
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Payroll & Benefits"
        title="Staff Loans & Advances"
        description="Transparent loan application, automated payroll EMI recovery, and immutable balance ledgers under Section 17(2)."
        actions={
          <div className="flex items-center gap-2">
            <div className="flex min-w-0 max-w-full overflow-x-auto rounded-full bg-surface-2 p-1 [scrollbar-width:none] [&>*]:shrink-0">
              <Button
                size="sm"
                variant={tab === 'my' ? 'primary' : 'ghost'}
                onClick={() => { setTab('my'); }}
              >
                My Loans
              </Button>
              <Button
                size="sm"
                variant={tab === 'apply' ? 'primary' : 'ghost'}
                onClick={() => { setTab('apply'); }}
              >
                Apply
              </Button>
              <Button
                size="sm"
                variant={tab === 'admin' ? 'primary' : 'ghost'}
                onClick={() => { setTab('admin'); }}
              >
                Company Loans
              </Button>
            </div>
            {tab === 'admin' && (
              <Button
                size="sm"
                variant="secondary"
                leadingIcon={<FileSpreadsheet className="size-4" />}
                onClick={() => { setImportModalOpen(true); }}
              >
                Import Legacy SAP
              </Button>
            )}
          </div>
        }
      />

      {/* Overview Cards */}
      <StatGrid>
        <StatTile
          label="Active loans"
          value={tab === 'admin' ? allLoans.filter((l) => l.status === 'active').length : myLoans.filter((l) => l.status === 'active').length}
        />
        <StatTile
          tone="accent"
          label="Total outstanding"
          prefix="₹"
          value={(tab === 'admin' ? allLoans : myLoans).reduce((sum, l) => sum + (l.status === 'active' ? l.currentOutstandingRupees : 0), 0)}
        />
        <StatTile
          tone="hatched"
          label="Next deduction run"
          prefix="₹"
          value={(tab === 'admin' ? allLoans : myLoans).reduce((sum, l) => sum + (l.status === 'active' ? l.monthlyEmiRupees : 0), 0)}
          hint="EMIs recovered in the next payroll"
        />
        <StatTile label="Perquisite tax" value="Sec 17(2)" hint="Below SBI rate (8.5%) is taxed as a perquisite" />
      </StatGrid>

      {/* Tab: My Loans / Company Loans */}
      {(tab === 'my' || tab === 'admin') && (
        <Card padded={false}>
          <div className="p-6">
            <CardHeader
              title={tab === 'my' ? 'My Active & Historical Loans' : 'Company Staff Loan Register'}
              subtitle="Balances represent immutable sums of disbursements less verified payroll recoveries."
            />
          </div>
          <DataTable<LoanSummary>
            columns={columns}
            rows={tab === 'my' ? myLoans : allLoans}
            rowKey={(r) => String(r.loanId)}
          />
        </Card>
      )}

      {/* Tab: Apply for Loan */}
      {tab === 'apply' && (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Left Form */}
          <div className="lg:col-span-5 space-y-6">
            <Card className="p-6 space-y-4">
              <CardHeader
                title="Loan Application"
                subtitle="Calculate schedule and verify eligibility under company policy."
              />

              <Select
                label="Loan Scheme"
                value={applyType}
                onChange={(val) => { setApplyType(val); }}
                options={LOAN_TYPE_OPTIONS}
              />

              <TextField
                label="Principal Amount (₹)"
                type="number"
                value={applyPrincipal}
                onChange={(e) => { setApplyPrincipal(e.target.value); }}
                hint="Loans > ₹20,000 at concessional interest subject to Sec 17(2) perquisite"
              />

              <div className="grid grid-cols-2 gap-4">
                <TextField
                  label="Tenure (Months)"
                  type="number"
                  value={applyTenure}
                  onChange={(e) => { setApplyTenure(e.target.value); }}
                />
                <TextField
                  label="Interest Rate (% p.a.)"
                  type="number"
                  value={applyRate}
                  onChange={(e) => { setApplyRate(e.target.value); }}
                  disabled={applyType === 'emi_no_interest' || applyType === 'salary_advance'}
                />
              </div>

              <TextField
                label="First Deduction Month"
                type="date"
                value={applyStartMonth}
                onChange={(e) => { setApplyStartMonth(e.target.value); }}
              />

              <div className="pt-4">
                <Button
                  className="w-full"
                  variant="primary"
                  onClick={() => { void handleApplySubmit(); }}
                  disabled={!preview?.eligible}
                  leadingIcon={<PlusCircle className="size-4" />}
                >
                  Submit Loan Request
                </Button>
              </div>
            </Card>

            {/* Eligibility Feedback */}
            {preview && (
              <Card className="p-5">
                <p className="text-xs font-semibold text-ink-muted">
                  Policy Eligibility Status
                </p>
                {preview.eligible ? (
                  <div className="mt-3 flex items-center gap-2 text-sm text-positive-ink font-medium">
                    <StatusBadge tone="positive">Eligible</StatusBadge>
                    <span>EMI is within the 30% monthly salary ceiling</span>
                  </div>
                ) : (
                  <div className="mt-3 space-y-2">
                    <StatusBadge tone="negative">Ineligible</StatusBadge>
                    {preview.reasons.map((r, i) => (
                      <p key={i} className="text-xs text-negative-ink">
                        • {r}
                      </p>
                    ))}
                  </div>
                )}
                <div className="mt-4 pt-4 border-t border-line text-xs text-ink-muted space-y-1">
                  <div className="flex justify-between">
                    <span>Monthly Salary Benchmark:</span>
                    <span className="font-medium text-ink">{formatINR(preview.monthlyGrossRupees)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Max Allowable EMI (30% cap):</span>
                    <span className="font-medium text-ink">{formatINR(preview.maxAllowedEmiRupees)}</span>
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* Right Preview */}
          <div className="lg:col-span-7 space-y-6">
            <Card className="p-6">
              <CardHeader
                title="Amortization Schedule Preview"
                subtitle="Calculated in exact integer paise. Final installment absorbs rounding differences."
              />

              {previewLoading ? (
                <div className="py-12 text-center text-sm text-ink-muted">Calculating amortization schedule...</div>
              ) : preview ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-4 rounded-xl bg-surface-2 p-4 text-center">
                    <div>
                      <p className="text-xs text-ink-muted">Monthly EMI</p>
                      <p className="mt-1 text-lg font-semibold text-ink">{formatINR(preview.monthlyEmi)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-ink-muted">Total Interest</p>
                      <p className="mt-1 text-lg font-semibold text-ink">{formatINR(preview.totalInterest)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-ink-muted">Total Payable</p>
                      <p className="mt-1 text-lg font-semibold text-ink">{formatINR(preview.totalPayment)}</p>
                    </div>
                  </div>

                  <div className="max-h-96 overflow-y-auto border border-line rounded-lg">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-surface-2 text-ink-muted">
                        <tr>
                          <th className="p-2.5">#</th>
                          <th className="p-2.5">Principal</th>
                          <th className="p-2.5">Interest</th>
                          <th className="p-2.5">Total EMI</th>
                          <th className="p-2.5">Outstanding</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {preview.schedule.map((row) => (
                          <tr key={row.installmentNumber} className="hover:bg-surface-2">
                            <td className="p-2.5 font-mono">{row.installmentNumber}</td>
                            <td className="p-2.5 tabular-nums">{formatINR(row.principalPart)}</td>
                            <td className="p-2.5 tabular-nums">{formatINR(row.interestPart)}</td>
                            <td className="p-2.5 tabular-nums font-semibold text-ink">{formatINR(row.totalEmi)}</td>
                            <td className="p-2.5 tabular-nums text-ink-muted">{formatINR(row.closingOutstanding)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </Card>
          </div>
        </div>
      )}

      {/* Ledger Inspection Drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); }}
        title={selectedLoan ? `Loan Ledger: LN-${String(selectedLoan.loanId)}` : 'Loan Ledger'}
        subtitle={
          selectedLoan
            ? `${LOAN_TYPE_LABELS[selectedLoan.loanType] ?? selectedLoan.loanType} • Started ${selectedLoan.startMonth}`
            : ''
        }
        width={560}
      >
        {selectedLoan && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 rounded-xl bg-surface-2 p-4">
              <div>
                <span className="text-xs text-ink-muted">Original Principal</span>
                <p className="text-lg font-semibold text-ink">{formatINR(selectedLoan.originalPrincipalRupees)}</p>
              </div>
              <div>
                <span className="text-xs text-ink-muted">Current Outstanding</span>
                <p className="text-lg font-semibold text-accent-ink">{formatINR(selectedLoan.currentOutstandingRupees)}</p>
              </div>
              <div>
                <span className="text-xs text-ink-muted">Principal Recovered</span>
                <p className="text-sm font-medium text-positive-ink">{formatINR(selectedLoan.totalRecoveredPrincipalRupees)}</p>
              </div>
              <div>
                <span className="text-xs text-ink-muted">Interest Paid</span>
                <p className="text-sm font-medium text-ink-muted">{formatINR(selectedLoan.totalRecoveredInterestRupees)}</p>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-ink mb-3">Recoveries posted by payroll</h4>
              <div className="overflow-x-auto border border-line rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-2 text-ink-muted">
                    <tr>
                      <th className="p-2">Installment</th>
                      <th className="p-2">Principal</th>
                      <th className="p-2">Interest</th>
                      <th className="p-2">EMI</th>
                      <th className="p-2">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {loanSchedule.map((s) => (
                      <tr key={s.installmentNumber}>
                        <td className="p-2 font-mono">Month {s.installmentNumber}</td>
                        <td className="p-2 tabular-nums">{formatINR(s.principalPart)}</td>
                        <td className="p-2 tabular-nums">{formatINR(s.interestPart)}</td>
                        <td className="p-2 tabular-nums font-medium text-ink">{formatINR(s.totalEmi)}</td>
                        <td className="p-2 tabular-nums text-ink-muted">{formatINR(s.closingOutstanding)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </Drawer>

      {/* Legacy SAP Import Modal */}
      <ConfirmModal
        open={importModalOpen}
        onClose={() => { setImportModalOpen(false); }}
        onConfirm={() => { void handleImportSubmit(); }}
        title="Import Legacy SAP / greytHR Loan"
        confirmLabel="Import Loan"
        description={
          <div className="space-y-4 pt-2">
            <p className="text-xs text-ink-muted">
              Registers historical opening balance into the immutable ledger with verified prior recoveries.
            </p>
            <TextField
              label="Employee ID / Ecode"
              type="number"
              value={importEmpId}
              onChange={(e) => { setImportEmpId(e.target.value); }}
            />
            <div className="grid grid-cols-2 gap-4">
              <TextField
                label="Original Principal (₹)"
                type="number"
                value={importPrincipal}
                onChange={(e) => { setImportPrincipal(e.target.value); }}
              />
              <TextField
                label="Outstanding Balance (₹)"
                type="number"
                value={importBalance}
                onChange={(e) => { setImportBalance(e.target.value); }}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <TextField
                label="Monthly EMI (₹)"
                type="number"
                value={importEmi}
                onChange={(e) => { setImportEmi(e.target.value); }}
              />
              <TextField
                label="Interest Rate (%)"
                type="number"
                value={importRate}
                onChange={(e) => { setImportRate(e.target.value); }}
              />
              <TextField
                label="Tenure (Months)"
                type="number"
                value={importTenure}
                onChange={(e) => { setImportTenure(e.target.value); }}
              />
            </div>
            <TextField
              label="Legacy Source Ref / SAP Document ID"
              value={importRef}
              onChange={(e) => { setImportRef(e.target.value); }}
              placeholder="SAP-LOAN-2024-8841"
            />
          </div>
        }
      />
    </div>
  );
}
