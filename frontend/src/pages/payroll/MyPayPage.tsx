/**
 * ESS payslip + YTD tax (PAY-06, PAY-13, SOW-179..186) — docs/05 §4.5 "ESS payslip view".
 *
 * The employee-facing half of payroll:
 * - Month picker
 * - Three payslip types (Regular, Reimbursement, Overtime Golden G10)
 * - Fixed RML payslip template with masked identifiers (PAN/UAN/PF/ESIC/Bank)
 * - Plain-language calc_note for every line item
 * - Net pay in words and leave balance footer
 * - Download printable PDF action
 * - Year-to-date tax computation statement
 */

import { useState } from 'react';
import { Download, Landmark, Percent, Shield, Wallet, Clock, FileText } from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  DarkCard,
  KpiNumber,
  PageHeader,
  Pill,
  StatusBadge,
  TextField,
  toast,
} from '../../ui';

function currentMonth(): string {
  const now = new Date();
  return `${String(now.getFullYear())}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function MyPayPage() {
  const [month, setMonth] = useState(currentMonth());
  const [slipType, setSlipType] = useState<'regular' | 'reimbursement' | 'overtime'>('regular');

  // Realistic employee baseline (RML Staff Golden G1 / G10 Overtime)
  const employeeData = {
    ecode: 'RML035384',
    name: 'Arun Kumar',
    designation: 'Senior Engineer',
    department: 'Production - SMS',
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
    otMinutes: 240, // 4 hours
    grossRupees: 64573,
    deductionsRupees: 6574,
    netPayRupees: 57999,
    netPayInWords: 'Rupees Fifty-Seven Thousand Nine Hundred Ninety-Nine Only',
    taxRegime: 'New Regime (Budget 2025/26)',
    taxDeductedYtdRupees: 7500,
    projectedAnnualTaxRupees: 30000,
    earnings: [
      { code: 'BASIC', label: 'Basic Salary', amount: 32286, note: 'Basic ₹34,000 prorated for 28.5 payable days' },
      { code: 'HRA', label: 'House Rent Allowance', amount: 16143, note: '50% of Basic salary' },
      { code: 'SPECIAL', label: 'Special Allowance', amount: 15067, note: 'Residual balancing component' },
      { code: 'OT_PAY', label: 'Overtime Wages', amount: 1077, note: 'Factories Act G10: 4 hrs @ 2x rate' },
    ],
    deductions: [
      { code: 'PF_EE', label: 'Provident Fund (Employee)', amount: 3874, note: '12% of PF wages' },
      { code: 'PT', label: 'Professional Tax', amount: 200, note: 'West Bengal slab (> ₹40,000)' },
      { code: 'TDS', label: 'Income Tax (TDS)', amount: 2500, note: 'Budget 2025 New Regime projected monthly' },
    ],
    leaveBalances: [
      { code: 'CL', opening: 5, accrued: 1, availed: 1, balance: 5 },
      { code: 'EL', opening: 12, accrued: 1.5, availed: 0, balance: 13.5 },
      { code: 'SL', opening: 7, accrued: 0.5, availed: 0, balance: 7.5 },
    ],
  };

  // Golden G10 Overtime computation breakdown
  const otBase = 20000 + 5000 + 3000;
  const otDivisor = 208;
  const otHourly = otBase / otDivisor;
  const otHours = employeeData.otMinutes / 60;
  const otTotal = otHours * otHourly * 2;

  const handleDownloadPdf = () => {
    toast.success(`Opening printable payslip view for ${month}...`);
    window.print();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Employee Self-Service (ESS)"
        title="My Pay & Tax"
        description="Your RML payslips, line-by-line calculations, and annual income tax projection. All statutory identifiers are permission-masked."
        actions={
          <div className="flex items-center gap-3">
            <div className="w-44">
              <TextField
                label="Month"
                type="month"
                value={month}
                onChange={(event) => {
                  setMonth(event.currentTarget.value);
                }}
              />
            </div>
            <Button variant="secondary" onClick={handleDownloadPdf}>
              <Download className="mr-1.5 size-4" /> Download PDF
            </Button>
          </div>
        }
      />

      {/* Hero Net Pay Card */}
      <DarkCard className="flex flex-wrap items-end justify-between gap-8">
        <div>
          <p className="text-xs font-medium tracking-tight text-hero-muted">Net Disbursed for {month}</p>
          <p className="mt-3 text-5xl font-light text-accent">
            <KpiNumber value={employeeData.netPayRupees} prefix="₹" precision={2} />
          </p>
          <p className="mt-2 text-sm text-hero-muted">
            {employeeData.netPayInWords}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Pill>Payable: {employeeData.payableDays.toFixed(1)} days</Pill>
          <Pill>LOP: {employeeData.lopDays.toFixed(1)} days</Pill>
          <Pill>OT: {(employeeData.otMinutes / 60).toFixed(1)} hrs</Pill>
          <StatusBadge tone="positive">Disbursed to Bank</StatusBadge>
        </div>
      </DarkCard>

      {/* Main Grid: Payslip Layout + Tax Card */}
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          {/* Slip Type Tabs */}
          <div className="flex items-center rounded-btn border border-rule bg-surface-2 p-1">
            <button
              type="button"
              onClick={() => { setSlipType('regular'); }}
              className={`flex-1 rounded-btn py-1.5 text-xs font-medium transition-colors ${
                slipType === 'regular'
                  ? 'bg-surface-1 text-ink shadow-sm'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              Regular Salary Slip
            </button>
            <button
              type="button"
              onClick={() => { setSlipType('reimbursement'); }}
              className={`flex-1 rounded-btn py-1.5 text-xs font-medium transition-colors ${
                slipType === 'reimbursement'
                  ? 'bg-surface-1 text-ink shadow-sm'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              Reimbursement Slip
            </button>
            <button
              type="button"
              onClick={() => { setSlipType('overtime'); }}
              className={`flex-1 rounded-btn py-1.5 text-xs font-medium transition-colors ${
                slipType === 'overtime'
                  ? 'bg-surface-1 text-ink shadow-sm'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              Overtime (Golden G10)
            </button>
          </div>

          {/* Masked Statutory Block */}
          <Card className="space-y-3 bg-surface-2 p-4 text-xs">
            <div className="flex items-center justify-between border-b border-rule pb-2">
              <span className="flex items-center gap-1.5 font-semibold text-ink">
                <Shield className="size-3.5 text-accent" /> Rashmi Metaliks Limited
              </span>
              <span className="font-mono text-ink-muted">{employeeData.ecode}</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-ink-muted">PAN: </span>
                <span className="font-mono text-ink">{employeeData.panMasked}</span>
              </div>
              <div>
                <span className="text-ink-muted">UAN: </span>
                <span className="font-mono text-ink">{employeeData.uanMasked}</span>
              </div>
              <div>
                <span className="text-ink-muted">PF No: </span>
                <span className="font-mono text-ink">{employeeData.pfNumberMasked}</span>
              </div>
              <div>
                <span className="text-ink-muted">ESIC No: </span>
                <span className="font-mono text-ink">{employeeData.esicNumberMasked}</span>
              </div>
              <div className="col-span-2 flex items-center gap-1.5">
                <Landmark className="size-3 text-ink-muted" />
                <span className="text-ink-muted">Bank A/C: </span>
                <span className="font-mono text-ink">{employeeData.bankAccountMasked}</span>
                <span className="text-ink-faint">({employeeData.bankName})</span>
              </div>
            </div>
          </Card>

          {/* Overtime G10 Card (if overtime tab) */}
          {slipType === 'overtime' && (
            <Card className="border-accent/40 bg-accent/5 p-4 text-xs">
              <p className="mb-2 flex items-center gap-1.5 font-semibold text-ink">
                <Clock className="size-3.5 text-accent" /> Factories Act Overtime Computation (Golden G10)
              </p>
              <div className="space-y-1.5 text-ink-muted">
                <div className="flex justify-between">
                  <span>OT Base (Basic ₹20k + DA ₹5k + Allowances ₹3k):</span>
                  <span className="font-medium text-ink">₹{otBase.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span>Monthly Divisor:</span>
                  <span className="font-medium text-ink">{otDivisor} hours</span>
                </div>
                <div className="flex justify-between">
                  <span>Ordinary Hourly Rate:</span>
                  <span className="font-medium text-ink">₹{otHourly.toFixed(2)} / hr</span>
                </div>
                <div className="flex justify-between">
                  <span>Rate Multiplier:</span>
                  <span className="font-medium text-ink">2.0×</span>
                </div>
                <div className="flex justify-between">
                  <span>Overtime Hours Worked:</span>
                  <span className="font-medium text-ink">{otHours.toFixed(2)} hrs</span>
                </div>
                <div className="flex justify-between border-t border-accent/20 pt-1 font-semibold text-ink">
                  <span>Total Overtime Wages:</span>
                  <span className="text-accent">₹{otTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </Card>
          )}

          {/* Line Items: Earnings & Deductions */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Earnings */}
            <Card className="space-y-3">
              <CardHeader title="Earnings" subtitle="Monthly recurring components" />
              <ul className="space-y-2">
                {employeeData.earnings.map((e) => (
                  <li key={e.code} className="rounded-row bg-surface-2 p-2.5 text-xs">
                    <div className="flex justify-between font-medium text-ink">
                      <span>{e.label}</span>
                      <span className="font-mono">₹{e.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-ink-muted">{e.note}</p>
                  </li>
                ))}
              </ul>
              <div className="flex justify-between border-t border-rule pt-2 text-xs font-semibold text-ink">
                <span>Gross Earnings</span>
                <span className="font-mono">₹{employeeData.grossRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </Card>

            {/* Deductions */}
            <Card className="space-y-3">
              <CardHeader title="Deductions" subtitle="Statutory & recoveries" />
              <ul className="space-y-2">
                {employeeData.deductions.map((d) => (
                  <li key={d.code} className="rounded-row bg-surface-2 p-2.5 text-xs">
                    <div className="flex justify-between font-medium text-ink">
                      <span>{d.label}</span>
                      <span className="font-mono">₹{d.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-ink-muted">{d.note}</p>
                  </li>
                ))}
              </ul>
              <div className="flex justify-between border-t border-rule pt-2 text-xs font-semibold text-ink">
                <span>Total Deductions</span>
                <span className="font-mono">₹{employeeData.deductionsRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </Card>
          </div>

          {/* Leave Balances Footer */}
          <div className="rounded-card border border-dashed border-rule p-4">
            <p className="text-xs font-semibold text-ink">Leave Summary (Closing Balances)</p>
            <div className="mt-2 grid grid-cols-3 gap-3 text-center text-xs">
              {employeeData.leaveBalances.map((lb) => (
                <div key={lb.code} className="rounded-row bg-surface-2 p-2.5">
                  <span className="text-xs text-ink-muted">{lb.code}</span>
                  <p className="mt-0.5 text-base font-bold text-ink">{lb.balance.toFixed(1)}</p>
                  <span className="text-[10px] text-ink-faint">
                    Accrued: {lb.accrued.toFixed(1)} · Availed: {lb.availed.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Year-to-Date Tax Card & Declarations */}
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Year-to-Date Tax"
              subtitle="Projected under Budget 2025/26 Section 192"
            />
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-row bg-surface-2 px-4 py-3">
                <span className="flex items-center gap-2 text-sm text-ink-muted">
                  <Percent className="size-4" /> Tax Regime
                </span>
                <Pill>New Regime</Pill>
              </div>

              <div className="flex items-center justify-between rounded-row bg-surface-2 px-4 py-3">
                <span className="flex items-center gap-2 text-sm text-ink-muted">
                  <Wallet className="size-4" /> Standard Deduction
                </span>
                <span className="font-mono text-sm font-medium text-ink">₹75,000</span>
              </div>

              <div className="flex items-center justify-between rounded-row bg-surface-2 px-4 py-3">
                <span className="flex items-center gap-2 text-sm text-ink-muted">
                  <Wallet className="size-4" /> Tax Deducted YTD
                </span>
                <span className="font-mono text-sm font-semibold text-accent">
                  ₹{employeeData.taxDeductedYtdRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-row bg-surface-2 px-4 py-3">
                <span className="flex items-center gap-2 text-sm text-ink-muted">
                  <Clock className="size-4" /> Projected Annual Tax
                </span>
                <span className="font-mono text-sm font-medium text-ink">
                  ₹{employeeData.projectedAnnualTaxRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-row bg-surface-2 px-4 py-3">
                <span className="flex items-center gap-2 text-sm text-ink-muted">
                  <Download className="size-4" /> Form 16 Part B
                </span>
                <span className="text-xs text-ink-faint">Available Year-End</span>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Investment Proofs"
              subtitle="Proof verification window (Nov–Jan)"
            />
            <div className="space-y-3 rounded-row bg-surface-2 p-4 text-xs text-ink-muted">
              <p>
                Under the default New Tax Regime, Section 87A rebate covers income up to ₹12 Lakhs
                with ₹75,000 standard deduction.
              </p>
              <p>
                To claim Chapter VI-A deductions or HRA exemption under the Old Tax Regime, you may
                submit investment declarations and rent receipts when the verification window opens.
              </p>
              <div className="pt-2">
                <Button variant="secondary" size="sm" className="w-full text-xs" onClick={() => { toast.info('Tax declaration window is currently closed for the active quarter.'); }}>
                  <FileText className="mr-1.5 size-3.5" /> View Declarations
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
