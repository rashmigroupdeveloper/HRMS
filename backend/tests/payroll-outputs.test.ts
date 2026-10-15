/**
 * Tests for Payroll Outputs & Golden G10 Overtime (PAY-05, PAY-06, docs/10 §13 G10).
 */

import { describe, it, expect } from 'vitest';
import {
  computeFactoriesActOt,
  renderPayslipHtml,
  renderPayslipPdf,
  maskIdentifier,
  formatCurrencyInWords,
  type PayslipData,
} from '../src/modules/payroll-outputs/index.js';

describe('Golden G10 — Factories Act Overtime Payslip', () => {
  it('computes exact hourly rate and overtime payable according to Golden G10 specification', () => {
    // Golden G10:
    // Basic ₹20,000, DA ₹5,000, OT base allowances ₹3,000
    // OT Base = 28,000
    // Hourly = 28,000 / 208 = ₹134.61538...
    // 4 hrs OT @ 2x = 8 * 134.61538 = ₹1,076.923... -> ₹1,076.92
    const basic = 20000;
    const da = 5000;
    const allowances = 3000;
    const otMinutes = 240; // 4 hours

    const result = computeFactoriesActOt(basic, da, allowances, otMinutes);

    expect(result.otBaseRupees).toBe(28000);
    expect(result.divisorHours).toBe(208);
    expect(result.hourlyRateRupees).toBeCloseTo(134.6154, 3);
    expect(result.multiplier).toBe(2);
    expect(result.otHours).toBe(4);
    expect(result.totalOtRupees).toBeCloseTo(1076.92, 2);
  });
});

describe('Masking & Currency In Words', () => {
  it('masks statutory identifiers leaving only last digits visible', () => {
    expect(maskIdentifier('ABCDE1234F', 4)).toBe('AB••••234F');
    expect(maskIdentifier('123456789012', 4)).toBe('12••••••9012');
    expect(maskIdentifier('9876543210', 4)).toBe('98••••3210');
    expect(maskIdentifier(null)).toBe('—');
  });

  it('converts rupee amounts to Indian currency words', () => {
    expect(formatCurrencyInWords(0)).toBe('Rupees Zero Only');
    expect(formatCurrencyInWords(57999)).toBe(
      'Rupees Fifty-Seven Thousand Nine Hundred Ninety-Nine Only'
    );
    expect(formatCurrencyInWords(1076.92)).toBe(
      'Rupees One Thousand Seventy-Six and Ninety-Two Paise Only'
    );
    expect(formatCurrencyInWords(1250000)).toBe(
      'Rupees Twelve Lakh Fifty Thousand Only'
    );
  });
});

describe('Payslip Rendering (HTML & PDF)', () => {
  const sampleData: PayslipData = {
    companyName: 'Rashmi Metaliks Limited',
    monthStr: '2026-06',
    monthName: 'June 2026',
    type: 'regular',
    employee: {
      id: 1,
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
    },
    attendance: {
      daysInMonth: 30,
      payableDays: 28.5,
      lopDays: 1.5,
      lopReversalDays: 0,
      otMinutes: 240,
    },
    earnings: [
      { code: 'BASIC', name: 'Basic Salary', amountRupees: 32286, calcNote: 'Basic 32,286' },
      { code: 'HRA', name: 'House Rent Allowance', amountRupees: 16143, calcNote: '50% of Basic' },
      { code: 'SPECIAL', name: 'Special Allowance', amountRupees: 16144, calcNote: 'Residual' },
    ],
    deductions: [
      { code: 'PF_EE', name: 'Provident Fund (Employee)', amountRupees: 3874, calcNote: '12% of PF wages' },
      { code: 'PT', name: 'Professional Tax', amountRupees: 200, calcNote: 'West Bengal slab' },
      { code: 'TDS', name: 'Income Tax (TDS)', amountRupees: 2500, calcNote: 'Projected monthly TDS' },
    ],
    grossRupees: 64573,
    totalDeductionsRupees: 6574,
    netPayRupees: 57999,
    netPayInWords: 'Rupees Fifty-Seven Thousand Nine Hundred Ninety-Nine Only',
    leaveBalances: [
      { type: 'CL', opening: 5, accrued: 1, availed: 1, balance: 5 },
      { type: 'EL', opening: 12, accrued: 1.5, availed: 0, balance: 13.5 },
      { type: 'SL', opening: 7, accrued: 0.5, availed: 0, balance: 7.5 },
    ],
  };

  it('renders valid RML HTML containing all required blocks and masked identifiers', () => {
    const html = renderPayslipHtml(sampleData);

    expect(html).toContain('Rashmi Metaliks Limited');
    expect(html).toContain('June 2026');
    expect(html).toContain('RML035384');
    expect(html).toContain('Arun Kumar');
    expect(html).toContain('••••••••1234');
    expect(html).toContain('••••••123A');
    expect(html).toContain('Gross Earnings');
    expect(html).toContain('Total Deductions');
    expect(html).toContain('57,999.00');
    expect(html).toContain('Fifty-Seven Thousand Nine Hundred Ninety-Nine');
    expect(html).toContain('Leave Balances');
  });

  it('renders compliant PDF 1.4 binary buffer with header and trailer', () => {
    const pdfBuffer = renderPayslipPdf(sampleData);

    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(500);

    const pdfString = pdfBuffer.toString('utf-8');
    expect(pdfString.startsWith('%PDF-1.4')).toBe(true);
    expect(pdfString).toContain('/Type /Catalog');
    expect(pdfString).toContain('/Type /Page');
    expect(pdfString.trim().endsWith('%%EOF')).toBe(true);
  });
});
