/**
 * Payslip Template Engine (PAY-06, SOW crosswalk).
 *
 * Implements the fixed RML layout matching the live reference:
 * PAN, UAN, PF No, ESIC No, masked Bank A/C, payable days, LOP days,
 * OT hours, earnings, deductions, net pay in words, leave balance footer.
 *
 * Supports 3 payslip types:
 *   1. Regular Payslip
 *   2. Reimbursement Payslip
 *   3. Overtime Payslip (Factories Act base calculation, Golden G10)
 */

import { SimplePdfDocument } from './pdf-builder.js';
import { formatCurrencyInWords } from './number-to-words.js';

export type PayslipType = 'regular' | 'reimbursement' | 'overtime';

export interface PayslipEmployee {
  id: number;
  ecode: string;
  name: string;
  designation?: string | null | undefined;
  department?: string | null | undefined;
  costCenter?: string | null | undefined;
  doj?: string | null | undefined;
  bankAccountMasked?: string | null | undefined;
  bankName?: string | null | undefined;
  ifsc?: string | null | undefined;
  panMasked?: string | null | undefined;
  uanMasked?: string | null | undefined;
  pfNumberMasked?: string | null | undefined;
  esicNumberMasked?: string | null | undefined;
}

export interface PayslipAttendance {
  daysInMonth: number;
  payableDays: number;
  lopDays: number;
  lopReversalDays: number;
  otMinutes: number;
}

export interface PayslipLineItem {
  code: string;
  name: string;
  amountRupees: number;
  calcNote?: string | null | undefined;
}

export interface OvertimeBreakdown {
  basicRupees: number;
  daRupees: number;
  otAllowancesRupees: number;
  otBaseRupees: number;
  divisorHours: number; // Factories Act default = 208
  hourlyRateRupees: number; // otBase / 208
  multiplier: number; // 2x
  otHours: number;
  totalOtRupees: number;
}

export interface LeaveBalanceItem {
  type: string;
  opening: number;
  accrued: number;
  availed: number;
  balance: number;
}

export interface PayslipData {
  companyName: string;
  monthStr: string; // YYYY-MM
  monthName: string; // e.g. "June 2026"
  type: PayslipType;
  employee: PayslipEmployee;
  attendance: PayslipAttendance;
  earnings: PayslipLineItem[];
  deductions: PayslipLineItem[];
  employerContributions?: PayslipLineItem[] | undefined;
  grossRupees: number;
  totalDeductionsRupees: number;
  netPayRupees: number;
  netPayInWords: string;
  overtimeBreakdown?: OvertimeBreakdown | undefined;
  leaveBalances?: LeaveBalanceItem[] | undefined;
}

/**
 * Format a number as Indian Rupee string without symbol: e.g. 57,999.00
 */
export function formatRupeeAmount(amount: number): string {
  return amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Mask statutory identifiers (keep first 2, mask middle with bullet dots, keep last 3 or 4)
 */
export function maskIdentifier(val: string | null | undefined, visibleEnd = 4): string {
  if (!val || val.length <= visibleEnd) return val ?? '—';
  const startVisible = Math.min(2, Math.floor((val.length - visibleEnd) / 2));
  const prefix = val.slice(0, startVisible);
  const suffix = val.slice(-visibleEnd);
  const maskLen = val.length - startVisible - visibleEnd;
  return `${prefix}${'•'.repeat(Math.max(3, maskLen))}${suffix}`;
}

/**
 * Render printable HTML for the RML payslip.
 */
export function renderPayslipHtml(data: PayslipData): string {
  const typeTitle =
    data.type === 'overtime'
      ? 'OVERTIME PAYSLIP'
      : data.type === 'reimbursement'
        ? 'REIMBURSEMENT PAYSLIP'
        : 'PAYSLIP';

  const earningsRows = data.earnings
    .map(
      (e) => `<tr>
        <td class="col-name">${e.name}<br><small class="calc-note">${e.calcNote ?? ''}</small></td>
        <td class="col-amt">${formatRupeeAmount(e.amountRupees)}</td>
      </tr>`
    )
    .join('');

  const deductionsRows = data.deductions
    .map(
      (d) => `<tr>
        <td class="col-name">${d.name}<br><small class="calc-note">${d.calcNote ?? ''}</small></td>
        <td class="col-amt">${formatRupeeAmount(d.amountRupees)}</td>
      </tr>`
    )
    .join('');

  const leaveRows = (data.leaveBalances ?? [])
    .map(
      (l) => `<tr>
        <td>${l.type}</td>
        <td>${l.opening.toFixed(1)}</td>
        <td>${l.accrued.toFixed(1)}</td>
        <td>${l.availed.toFixed(1)}</td>
        <td><strong>${l.balance.toFixed(1)}</strong></td>
      </tr>`
    )
    .join('');

  const otSection = data.overtimeBreakdown
    ? `<div class="ot-breakdown">
        <h3>Factories Act Overtime Computation (Golden G10)</h3>
        <table class="sub-table">
          <tr><td>OT Base (Basic + DA + Allowances):</td><td>₹${formatRupeeAmount(data.overtimeBreakdown.otBaseRupees)}</td></tr>
          <tr><td>Monthly Divisor:</td><td>${String(data.overtimeBreakdown.divisorHours)} hours</td></tr>
          <tr><td>Ordinary Hourly Rate:</td><td>₹${formatRupeeAmount(data.overtimeBreakdown.hourlyRateRupees)} / hr</td></tr>
          <tr><td>Overtime Rate Multiplier:</td><td>${String(data.overtimeBreakdown.multiplier)}×</td></tr>
          <tr><td>Overtime Hours:</td><td>${data.overtimeBreakdown.otHours.toFixed(2)} hrs</td></tr>
          <tr><td><strong>Total Overtime Payable:</strong></td><td><strong>₹${formatRupeeAmount(data.overtimeBreakdown.totalOtRupees)}</strong></td></tr>
        </table>
      </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${data.companyName} - ${typeTitle} - ${data.monthName} - ${data.employee.ecode}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 11px; color: #1c1917; margin: 0; padding: 24px; background: #fff; }
    .slip-container { max-width: 800px; margin: 0 auto; border: 1px solid #e7e5e4; padding: 24px; border-radius: 4px; }
    .header { text-align: center; border-bottom: 2px solid #1c1917; padding-bottom: 12px; margin-bottom: 16px; }
    .header h1 { margin: 0; font-size: 18px; text-transform: uppercase; letter-spacing: 0.05em; }
    .header h2 { margin: 4px 0 0; font-size: 13px; font-weight: normal; color: #57534e; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; font-size: 11px; }
    .meta-table { width: 100%; border-collapse: collapse; }
    .meta-table td { padding: 3px 6px; }
    .meta-table td.label { font-weight: 600; color: #78716c; width: 38%; }
    .table-container { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
    .line-table { width: 100%; border-collapse: collapse; border: 1px solid #e7e5e4; }
    .line-table th { background: #f5f5f4; padding: 6px; text-align: left; font-size: 11px; border-bottom: 1px solid #d6d3d1; }
    .line-table td { padding: 5px 6px; border-bottom: 1px solid #f5f5f4; font-size: 10.5px; }
    .line-table td.col-amt { text-align: right; font-family: monospace; font-size: 11px; }
    .calc-note { color: #78716c; font-size: 9px; }
    .totals-row { font-weight: bold; background: #fafaf9; }
    .summary-card { background: #fafaf9; border: 1px solid #e7e5e4; border-radius: 4px; padding: 12px; margin-bottom: 16px; }
    .net-figure { font-size: 16px; font-weight: bold; color: #b45309; }
    .net-words { margin-top: 4px; color: #44403c; font-weight: 500; font-size: 11px; }
    .footer-section { border-top: 1px dashed #d6d3d1; padding-top: 12px; margin-top: 16px; font-size: 10px; }
    .leave-table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 10px; }
    .leave-table th, .leave-table td { padding: 4px; text-align: center; border: 1px solid #e7e5e4; }
    .leave-table th { background: #f5f5f4; }
    .ot-breakdown { margin-bottom: 16px; padding: 10px; background: #fffbeb; border: 1px solid #fef3c7; border-radius: 4px; }
    .ot-breakdown h3 { margin: 0 0 6px 0; font-size: 11px; color: #92400e; }
    .sub-table td { padding: 2px 6px; }
    @media print { body { padding: 0; } .slip-container { border: none; padding: 0; } }
  </style>
</head>
<body>
  <div class="slip-container">
    <div class="header">
      <h1>${data.companyName}</h1>
      <h2>${typeTitle} — ${data.monthName}</h2>
    </div>

    <div class="meta-grid">
      <table class="meta-table">
        <tr><td class="label">Employee ID:</td><td>${data.employee.ecode}</td></tr>
        <tr><td class="label">Employee Name:</td><td><strong>${data.employee.name}</strong></td></tr>
        <tr><td class="label">Designation:</td><td>${data.employee.designation ?? '—'}</td></tr>
        <tr><td class="label">Department:</td><td>${data.employee.department ?? '—'}</td></tr>
        <tr><td class="label">Cost Center:</td><td>${data.employee.costCenter ?? '—'}</td></tr>
        <tr><td class="label">Date of Joining:</td><td>${data.employee.doj ?? '—'}</td></tr>
        <tr><td class="label">Bank A/C (Masked):</td><td>${data.employee.bankAccountMasked ?? '—'}</td></tr>
        <tr><td class="label">Bank Name & IFSC:</td><td>${data.employee.bankName ? `${data.employee.bankName} (${data.employee.ifsc ?? ''})` : '—'}</td></tr>
      </table>

      <table class="meta-table">
        <tr><td class="label">PAN (Masked):</td><td>${data.employee.panMasked ?? '—'}</td></tr>
        <tr><td class="label">UAN (Masked):</td><td>${data.employee.uanMasked ?? '—'}</td></tr>
        <tr><td class="label">PF No (Masked):</td><td>${data.employee.pfNumberMasked ?? '—'}</td></tr>
        <tr><td class="label">ESIC No (Masked):</td><td>${data.employee.esicNumberMasked ?? '—'}</td></tr>
        <tr><td class="label">Days in Month:</td><td>${String(data.attendance.daysInMonth)}</td></tr>
        <tr><td class="label">Payable Days:</td><td><strong>${data.attendance.payableDays.toFixed(1)}</strong></td></tr>
        <tr><td class="label">LOP / Unpaid Days:</td><td>${data.attendance.lopDays.toFixed(1)}</td></tr>
        <tr><td class="label">Overtime Hours:</td><td>${(data.attendance.otMinutes / 60).toFixed(1)} hrs</td></tr>
      </table>
    </div>

    ${otSection}

    <div class="table-container">
      <table class="line-table">
        <thead>
          <tr><th>Earnings</th><th style="text-align:right">Amount (₹)</th></tr>
        </thead>
        <tbody>
          ${earningsRows}
          <tr class="totals-row">
            <td>Gross Earnings</td>
            <td class="col-amt">${formatRupeeAmount(data.grossRupees)}</td>
          </tr>
        </tbody>
      </table>

      <table class="line-table">
        <thead>
          <tr><th>Deductions</th><th style="text-align:right">Amount (₹)</th></tr>
        </thead>
        <tbody>
          ${deductionsRows}
          <tr class="totals-row">
            <td>Total Deductions</td>
            <td class="col-amt">${formatRupeeAmount(data.totalDeductionsRupees)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="summary-card">
      <div>
        <span>NET PAY: </span>
        <span class="net-figure">₹${formatRupeeAmount(data.netPayRupees)}</span>
      </div>
      <div class="net-words">In Words: ${data.netPayInWords}</div>
    </div>

    ${
      data.leaveBalances && data.leaveBalances.length > 0
        ? `<div class="footer-section">
            <strong>Leave Balances</strong>
            <table class="leave-table">
              <thead>
                <tr><th>Leave Type</th><th>Opening</th><th>Accrued</th><th>Availed</th><th>Closing Balance</th></tr>
              </thead>
              <tbody>
                ${leaveRows}
              </tbody>
            </table>
          </div>`
        : ''
    }

    <div class="footer-section" style="text-align:center; color:#78716c;">
      This is a system-generated payslip issued by Rashmi Group HRMS. No signature required.
    </div>
  </div>
</body>
</html>`;
}

/**
 * Render a binary PDF 1.4 document for the payslip.
 */
export function renderPayslipPdf(data: PayslipData): Buffer {
  const doc = new SimplePdfDocument();

  // Margins & Geometry
  const mx = 36;
  const pageW = doc.width - mx * 2;
  let y = doc.height - 40;

  // Header Box
  doc.drawRect({
    x: mx,
    y: y - 55,
    width: pageW,
    height: 55,
    fill: [0.97, 0.96, 0.95],
    stroke: [0.85, 0.83, 0.8],
    lineWidth: 1,
  });

  doc.drawText({
    text: data.companyName.toUpperCase(),
    x: mx + 16,
    y: y - 24,
    fontSize: 14,
    bold: true,
    color: [0.1, 0.1, 0.1],
  });

  const title =
    data.type === 'overtime'
      ? 'OVERTIME PAYSLIP'
      : data.type === 'reimbursement'
        ? 'REIMBURSEMENT PAYSLIP'
        : 'PAYSLIP';

  doc.drawText({
    text: `${title} — ${data.monthName.toUpperCase()}`,
    x: mx + 16,
    y: y - 42,
    fontSize: 10,
    bold: false,
    color: [0.35, 0.33, 0.3],
  });

  y -= 70;

  // Employee Meta Table (2 columns)
  const metaH = 110;
  doc.drawRect({
    x: mx,
    y: y - metaH,
    width: pageW,
    height: metaH,
    stroke: [0.85, 0.83, 0.8],
    lineWidth: 0.5,
  });

  const midX = mx + pageW / 2;
  doc.drawLine({
    x1: midX,
    y1: y,
    x2: midX,
    y2: y - metaH,
    stroke: [0.85, 0.83, 0.8],
    lineWidth: 0.5,
  });

  // Left col
  const leftLines = [
    `Employee ID:  ${data.employee.ecode}`,
    `Name:         ${data.employee.name}`,
    `Designation:  ${data.employee.designation ?? '—'}`,
    `Department:   ${data.employee.department ?? '—'}`,
    `Cost Center:  ${data.employee.costCenter ?? '—'}`,
    `Bank A/C:     ${data.employee.bankAccountMasked ?? '—'}`,
    `Bank/IFSC:    ${data.employee.bankName ? `${data.employee.bankName} (${data.employee.ifsc ?? ''})` : '—'}`,
  ];

  let curY = y - 14;
  for (const line of leftLines) {
    doc.drawText({
      text: line,
      x: mx + 8,
      y: curY,
      fontSize: 8.5,
      color: [0.15, 0.15, 0.15],
    });
    curY -= 14;
  }

  // Right col
  const rightLines = [
    `PAN (Masked):  ${data.employee.panMasked ?? '—'}`,
    `UAN (Masked):  ${data.employee.uanMasked ?? '—'}`,
    `PF No:         ${data.employee.pfNumberMasked ?? '—'}`,
    `ESIC No:       ${data.employee.esicNumberMasked ?? '—'}`,
    `Days in Month: ${String(data.attendance.daysInMonth)}`,
    `Payable Days:  ${data.attendance.payableDays.toFixed(1)}`,
    `LOP Days:      ${data.attendance.lopDays.toFixed(1)}  |  OT: ${(data.attendance.otMinutes / 60).toFixed(1)} hrs`,
  ];

  curY = y - 14;
  for (const line of rightLines) {
    doc.drawText({
      text: line,
      x: midX + 8,
      y: curY,
      fontSize: 8.5,
      color: [0.15, 0.15, 0.15],
    });
    curY -= 14;
  }

  y -= metaH + 15;

  // Earnings & Deductions Tables side-by-side
  const colW = (pageW - 12) / 2;
  const earnX = mx;
  const dedX = mx + colW + 12;

  // Header band
  doc.drawRect({
    x: earnX,
    y: y - 16,
    width: colW,
    height: 16,
    fill: [0.93, 0.92, 0.9],
  });
  doc.drawText({
    text: 'EARNINGS',
    x: earnX + 6,
    y: y - 12,
    fontSize: 8.5,
    bold: true,
  });
  doc.drawText({
    text: 'AMOUNT (INR)',
    x: earnX + colW - 75,
    y: y - 12,
    fontSize: 8.5,
    bold: true,
  });

  doc.drawRect({
    x: dedX,
    y: y - 16,
    width: colW,
    height: 16,
    fill: [0.93, 0.92, 0.9],
  });
  doc.drawText({
    text: 'DEDUCTIONS',
    x: dedX + 6,
    y: y - 12,
    fontSize: 8.5,
    bold: true,
  });
  doc.drawText({
    text: 'AMOUNT (INR)',
    x: dedX + colW - 75,
    y: y - 12,
    fontSize: 8.5,
    bold: true,
  });

  y -= 22;

  // Rows
  const maxRows = Math.max(data.earnings.length, data.deductions.length, 1);
  const rowH = 14;

  for (let i = 0; i < maxRows; i++) {
    const earn = data.earnings[i];
    const ded = data.deductions[i];

    if (earn) {
      doc.drawText({
        text: earn.name.slice(0, 26),
        x: earnX + 6,
        y,
        fontSize: 8,
      });
      doc.drawText({
        text: formatRupeeAmount(earn.amountRupees).padStart(12),
        x: earnX + colW - 75,
        y,
        fontSize: 8,
      });
    }

    if (ded) {
      doc.drawText({
        text: ded.name.slice(0, 26),
        x: dedX + 6,
        y,
        fontSize: 8,
      });
      doc.drawText({
        text: formatRupeeAmount(ded.amountRupees).padStart(12),
        x: dedX + colW - 75,
        y,
        fontSize: 8,
      });
    }

    y -= rowH;
  }

  // Totals divider
  doc.drawLine({
    x1: earnX,
    y1: y + 2,
    x2: earnX + colW,
    y2: y + 2,
    stroke: [0.7, 0.7, 0.7],
  });
  doc.drawLine({
    x1: dedX,
    y1: y + 2,
    x2: dedX + colW,
    y2: y + 2,
    stroke: [0.7, 0.7, 0.7],
  });

  // Totals line
  doc.drawText({
    text: 'Gross Earnings:',
    x: earnX + 6,
    y: y - 8,
    fontSize: 8.5,
    bold: true,
  });
  doc.drawText({
    text: formatRupeeAmount(data.grossRupees).padStart(12),
    x: earnX + colW - 75,
    y: y - 8,
    fontSize: 8.5,
    bold: true,
  });

  doc.drawText({
    text: 'Total Deductions:',
    x: dedX + 6,
    y: y - 8,
    fontSize: 8.5,
    bold: true,
  });
  doc.drawText({
    text: formatRupeeAmount(data.totalDeductionsRupees).padStart(12),
    x: dedX + colW - 75,
    y: y - 8,
    fontSize: 8.5,
    bold: true,
  });

  y -= 30;

  // Net Pay Highlight Box
  doc.drawRect({
    x: mx,
    y: y - 40,
    width: pageW,
    height: 40,
    fill: [0.98, 0.96, 0.92],
    stroke: [0.85, 0.75, 0.55],
    lineWidth: 1,
  });

  doc.drawText({
    text: `NET PAYABLE: INR ${formatRupeeAmount(data.netPayRupees)}`,
    x: mx + 16,
    y: y - 18,
    fontSize: 11,
    bold: true,
    color: [0.65, 0.3, 0.05],
  });

  doc.drawText({
    text: `Amount in words: ${data.netPayInWords}`,
    x: mx + 16,
    y: y - 32,
    fontSize: 8.5,
    color: [0.25, 0.2, 0.15],
  });

  y -= 55;

  // Leave Balances section
  if (data.leaveBalances && data.leaveBalances.length > 0) {
    doc.drawText({
      text: 'LEAVE SUMMARY',
      x: mx,
      y,
      fontSize: 8.5,
      bold: true,
    });
    y -= 12;

    const leaveHeaders = ['Leave Type', 'Opening', 'Accrued', 'Availed', 'Balance'];
    let lx = mx;
    for (const h of leaveHeaders) {
      doc.drawText({ text: h, x: lx, y, fontSize: 7.5, bold: true });
      lx += 65;
    }
    y -= 10;

    for (const lb of data.leaveBalances) {
      lx = mx;
      doc.drawText({ text: lb.type, x: lx, y, fontSize: 7.5 });
      lx += 65;
      doc.drawText({ text: lb.opening.toFixed(1), x: lx, y, fontSize: 7.5 });
      lx += 65;
      doc.drawText({ text: lb.accrued.toFixed(1), x: lx, y, fontSize: 7.5 });
      lx += 65;
      doc.drawText({ text: lb.availed.toFixed(1), x: lx, y, fontSize: 7.5 });
      lx += 65;
      doc.drawText({ text: lb.balance.toFixed(1), x: lx, y, fontSize: 7.5, bold: true });
      y -= 10;
    }
  }

  // Footer text
  doc.drawText({
    text: 'This is a computer-generated document. Generated by Rashmi Group HRMS.',
    x: mx + 80,
    y: 35,
    fontSize: 7.5,
    color: [0.5, 0.5, 0.5],
  });

  return doc.build();
}

/**
 * Compute Overtime breakdown according to Factories Act (Golden G10):
 * Divisor = 208 hrs, ordinary rate = (Basic + DA + allowances) / 208, 2x multiplier.
 */
export function computeFactoriesActOt(
  basicRupees: number,
  daRupees: number,
  otAllowancesRupees: number,
  otMinutes: number,
  divisorHours = 208,
  multiplier = 2
): OvertimeBreakdown {
  const otBaseRupees = basicRupees + daRupees + otAllowancesRupees;
  const hourlyRateRupees = divisorHours > 0 ? otBaseRupees / divisorHours : 0;
  const otHours = otMinutes / 60;
  const totalOtRupees = otHours * hourlyRateRupees * multiplier;

  return {
    basicRupees,
    daRupees,
    otAllowancesRupees,
    otBaseRupees,
    divisorHours,
    hourlyRateRupees,
    multiplier,
    otHours,
    totalOtRupees,
  };
}

export { formatCurrencyInWords };
