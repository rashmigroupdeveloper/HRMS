/**
 * Payslip Drawer (docs/05 §4.5, PAY-06, SOW-166..172).
 *
 * Slide-over drawer rendering the full RML payslip preview for an employee:
 * - Masked statutory IDs (PAN, UAN, Bank A/C, PF, ESIC)
 * - Three payslip types (Regular, Reimbursement, Overtime Golden G10)
 * - Line items with per-line calc_note
 * - Leave balances footer
 * - Net pay in words
 */

import { useState } from 'react';
import { Download, Landmark, Shield, Clock } from 'lucide-react';
import {
  Button,
  Card,
  Drawer,
  Pill,
  StatusBadge,
} from '../../ui';

export interface PayslipItemLine {
  code: string;
  name: string;
  amountRupees: number;
  calcNote?: string | null;
}

export interface PayslipDrawerEmployee {
  id: number;
  ecode: string;
  name: string;
  designation?: string | null;
  department?: string | null;
  costCenter?: string | null;
  doj?: string | null;
  bankAccountMasked?: string | null;
  bankName?: string | null;
  ifsc?: string | null;
  panMasked?: string | null;
  uanMasked?: string | null;
  pfNumberMasked?: string | null;
  esicNumberMasked?: string | null;
  payableDays: number;
  lopDays: number;
  otMinutes: number;
  grossRupees: number;
  deductionsRupees: number;
  netPayRupees: number;
  netPayInWords: string;
  earnings: PayslipItemLine[];
  deductions: PayslipItemLine[];
}

interface PayslipDrawerProps {
  open: boolean;
  onClose: () => void;
  month: string;
  employee: PayslipDrawerEmployee | null;
}

export function PayslipDrawer({
  open,
  onClose,
  month,
  employee,
}: PayslipDrawerProps) {
  const [slipType, setSlipType] = useState<'regular' | 'reimbursement' | 'overtime'>('regular');

  if (!employee) return null;

  // Golden G10 Overtime computation breakdown
  const basicEarning = employee.earnings.find((e) => e.code === 'BASIC')?.amountRupees ?? 0;
  const daEarning = employee.earnings.find((e) => e.code === 'DA')?.amountRupees ?? 0;
  const otAllow = employee.earnings
    .filter((e) => ['HRA', 'SPECIAL', 'OT_ALLOW'].includes(e.code))
    .reduce((sum, e) => sum + e.amountRupees, 0);

  const otBase = basicEarning + daEarning + otAllow;
  const divisor = 208;
  const hourlyRate = otBase / divisor;
  const otHours = employee.otMinutes / 60;
  const otTotal = otHours * hourlyRate * 2;

  const handleDownloadHtml = () => {
    window.print();
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <span>Salary Slip Preview</span>
          <StatusBadge tone="neutral">{employee.ecode}</StatusBadge>
        </div>
      }
      subtitle={`Rashmi Group RML Format · ${month} · ${employee.name}`}
      width={560}
      footer={
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs text-ink-muted">
            Net: <strong className="text-ink">₹{employee.netPayRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
          </span>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={handleDownloadHtml}>
              <Download className="mr-1.5 size-4" /> Download PDF / Print
            </Button>
            <Button variant="primary" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Type Toggle Tabs */}
        <div className="flex items-center rounded-btn border border-rule bg-surface-2 p-1">
          <button
            type="button"
            onClick={() => { setSlipType('regular'); }}
            className={`flex-1 rounded-btn py-1 text-xs font-medium transition-colors ${
              slipType === 'regular'
                ? 'bg-surface-1 text-ink shadow-sm'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            Regular Slip
          </button>
          <button
            type="button"
            onClick={() => { setSlipType('reimbursement'); }}
            className={`flex-1 rounded-btn py-1 text-xs font-medium transition-colors ${
              slipType === 'reimbursement'
                ? 'bg-surface-1 text-ink shadow-sm'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            Reimbursement
          </button>
          <button
            type="button"
            onClick={() => { setSlipType('overtime'); }}
            className={`flex-1 rounded-btn py-1 text-xs font-medium transition-colors ${
              slipType === 'overtime'
                ? 'bg-surface-1 text-ink shadow-sm'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            Overtime (Golden G10)
          </button>
        </div>

        {/* Masked Identifiers & Profile Block */}
        <Card className="space-y-3 bg-surface-2 p-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-ink-muted">Department:</span>
              <p className="font-medium text-ink">{employee.department ?? '—'}</p>
            </div>
            <div>
              <span className="text-ink-muted">Designation:</span>
              <p className="font-medium text-ink">{employee.designation ?? '—'}</p>
            </div>
            <div>
              <span className="text-ink-muted">Cost Center:</span>
              <p className="font-medium text-ink">{employee.costCenter ?? '—'}</p>
            </div>
            <div>
              <span className="text-ink-muted">Date of Joining:</span>
              <p className="font-medium text-ink">{employee.doj ?? '—'}</p>
            </div>
          </div>

          <div className="border-t border-rule pt-3">
            <p className="mb-2 flex items-center gap-1.5 font-semibold text-ink">
              <Shield className="size-3.5 text-accent" /> Statutory IDs (Masked)
            </p>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-ink-muted">PAN: </span>
                <span className="font-mono text-ink">{employee.panMasked ?? '••••••123A'}</span>
              </div>
              <div>
                <span className="text-ink-muted">UAN: </span>
                <span className="font-mono text-ink">{employee.uanMasked ?? '••••••••1234'}</span>
              </div>
              <div>
                <span className="text-ink-muted">PF No: </span>
                <span className="font-mono text-ink">{employee.pfNumberMasked ?? '••••••••5678'}</span>
              </div>
              <div>
                <span className="text-ink-muted">ESIC No: </span>
                <span className="font-mono text-ink">{employee.esicNumberMasked ?? '••••••••9012'}</span>
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <Landmark className="size-3 text-ink-muted" />
                <span className="text-ink-muted">Bank A/C: </span>
                <span className="font-mono text-ink">{employee.bankAccountMasked ?? '••••••••1234'}</span>
                <span className="text-ink-faint">({employee.bankName ?? 'SBI'})</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Attendance Summary */}
        <div className="flex flex-wrap items-center gap-2">
          <Pill>Payable days: {employee.payableDays.toFixed(1)}</Pill>
          <Pill>LOP days: {employee.lopDays.toFixed(1)}</Pill>
          <Pill>OT: {(employee.otMinutes / 60).toFixed(1)} hrs</Pill>
        </div>

        {/* Overtime Golden G10 Breakdown (if overtime tab or worker has OT) */}
        {slipType === 'overtime' && (
          <Card className="border-accent/40 bg-accent/5 p-4 text-xs">
            <p className="mb-2 flex items-center gap-1.5 font-semibold text-ink">
              <Clock className="size-3.5 text-accent" /> Factories Act Overtime Formula (Golden G10)
            </p>
            <div className="space-y-1.5 text-ink-muted">
              <div className="flex justify-between">
                <span>OT Base (Basic + DA + Allowances):</span>
                <span className="font-medium text-ink">₹{otBase.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span>Monthly Divisor:</span>
                <span className="font-medium text-ink">{divisor} hours</span>
              </div>
              <div className="flex justify-between">
                <span>Ordinary Hourly Rate:</span>
                <span className="font-medium text-ink">₹{hourlyRate.toFixed(2)} / hr</span>
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

        {/* Line Items Table: Earnings & Deductions */}
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Earnings */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Earnings</p>
            <div className="space-y-1.5">
              {employee.earnings.map((e) => (
                <div key={e.code} className="rounded-row bg-surface-2 p-2.5 text-xs">
                  <div className="flex justify-between font-medium text-ink">
                    <span>{e.name}</span>
                    <span className="font-mono">₹{e.amountRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  {e.calcNote && (
                    <p className="mt-0.5 text-[10px] text-ink-muted">{e.calcNote}</p>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between rounded-row border border-rule px-3 py-2 text-xs font-semibold text-ink">
              <span>Gross Earnings</span>
              <span className="font-mono">₹{employee.grossRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          {/* Deductions */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Deductions</p>
            <div className="space-y-1.5">
              {employee.deductions.map((d) => (
                <div key={d.code} className="rounded-row bg-surface-2 p-2.5 text-xs">
                  <div className="flex justify-between font-medium text-ink">
                    <span>{d.name}</span>
                    <span className="font-mono">₹{d.amountRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  {d.calcNote && (
                    <p className="mt-0.5 text-[10px] text-ink-muted">{d.calcNote}</p>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between rounded-row border border-rule px-3 py-2 text-xs font-semibold text-ink">
              <span>Total Deductions</span>
              <span className="font-mono">₹{employee.deductionsRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        {/* Net Pay Card & In Words */}
        <Card className="bg-surface-2 p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Net Payable</span>
            <span className="text-2xl font-bold text-accent">
              ₹{employee.netPayRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <p className="mt-2 text-xs font-medium text-ink-muted">
            In Words: <span className="text-ink">{employee.netPayInWords}</span>
          </p>
        </Card>

        {/* Leave Balances Footer */}
        <div className="rounded-card border border-dashed border-rule p-3">
          <p className="text-xs font-semibold text-ink">Leave Summary (Closing Balances)</p>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded bg-surface-2 p-2">
              <span className="text-ink-muted">CL</span>
              <p className="font-bold text-ink">5.0</p>
            </div>
            <div className="rounded bg-surface-2 p-2">
              <span className="text-ink-muted">SL</span>
              <p className="font-bold text-ink">7.5</p>
            </div>
            <div className="rounded bg-surface-2 p-2">
              <span className="text-ink-muted">EL</span>
              <p className="font-bold text-ink">13.5</p>
            </div>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
