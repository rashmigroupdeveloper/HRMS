/**
 * Stage 2.3 & 2.4 — Payslip Generation & Outputs Test Suite (PAY-06, SOW Crosswalk).
 *
 * Verifies:
 * 1. Number to Words converter (Indian numbering system: Crores, Lakhs, Thousands, Paise).
 * 2. Statutory identifier masking (PAN, UAN, PF, ESIC, Bank A/C).
 * 3. Factories Act overtime computation (Base = Basic + DA + OT Allowances, 208h divisor, 2x multiplier).
 * 4. PDF builder primitives (rects, lines, text escaping, valid %PDF- header).
 * 5. HTML and PDF payslip rendering for Regular, Reimbursement, and Overtime layouts.
 * 6. PayslipGeneratorService data assembly, leave balance aggregation, and error guards.
 */

import { describe, it, expect } from 'vitest';
import { formatCurrencyInWords } from '../src/modules/payroll-outputs/payslip/number-to-words.js';
import { SimplePdfDocument } from '../src/modules/payroll-outputs/payslip/pdf-builder.js';
import {
  formatRupeeAmount,
  maskIdentifier,
  computeFactoriesActOt,
  renderPayslipHtml,
  renderPayslipPdf,
  type PayslipData,
} from '../src/modules/payroll-outputs/payslip/template.service.js';
import { PayslipGeneratorService } from '../src/modules/payroll-outputs/payslip/payslip-generator.js';
import type { Database } from '../src/core/db/types.js';
import type { Kysely } from 'kysely';

describe('Number to Words Converter (Indian Numbering System)', () => {
  it('converts zero and simple integers', () => {
    expect(formatCurrencyInWords(0)).toBe('Rupees Zero Only');
    expect(formatCurrencyInWords(1)).toBe('Rupees One Only');
    expect(formatCurrencyInWords(15)).toBe('Rupees Fifteen Only');
    expect(formatCurrencyInWords(42)).toBe('Rupees Forty-Two Only');
    expect(formatCurrencyInWords(100)).toBe('Rupees One Hundred Only');
    expect(formatCurrencyInWords(105)).toBe('Rupees One Hundred Five Only');
    expect(formatCurrencyInWords(999)).toBe('Rupees Nine Hundred Ninety-Nine Only');
  });

  it('converts thousands, lakhs, and crores accurately', () => {
    expect(formatCurrencyInWords(1000)).toBe('Rupees One Thousand Only');
    expect(formatCurrencyInWords(25400)).toBe('Rupees Twenty-Five Thousand Four Hundred Only');
    expect(formatCurrencyInWords(100000)).toBe('Rupees One Lakh Only');
    expect(formatCurrencyInWords(3500000)).toBe('Rupees Thirty-Five Lakh Only');
    expect(formatCurrencyInWords(10000000)).toBe('Rupees One Crore Only');
    expect(formatCurrencyInWords(12345678)).toBe(
      'Rupees One Crore Twenty-Three Lakh Forty-Five Thousand Six Hundred Seventy-Eight Only'
    );
  });

  it('handles paise and negative amounts', () => {
    expect(formatCurrencyInWords(0.5)).toBe('Rupees Zero and Fifty Paise Only');
    expect(formatCurrencyInWords(1.01)).toBe('Rupees One and One Paise Only');
    expect(formatCurrencyInWords(500.75)).toBe('Rupees Five Hundred and Seventy-Five Paise Only');
    expect(formatCurrencyInWords(-250)).toBe('Minus Rupees Two Hundred Fifty Only');
  });
});

describe('Payslip Formatting & Calculation Helpers', () => {
  it('formatRupeeAmount formats with Indian locale commas', () => {
    expect(formatRupeeAmount(0)).toBe('0.00');
    expect(formatRupeeAmount(1000)).toBe('1,000.00');
    expect(formatRupeeAmount(100000)).toBe('1,00,000.00');
    expect(formatRupeeAmount(52345.5)).toBe('52,345.50');
  });

  it('maskIdentifier preserves prefix & suffix, masking middle characters', () => {
    expect(maskIdentifier(null)).toBe('—');
    expect(maskIdentifier(undefined)).toBe('—');
    expect(maskIdentifier('')).toBe('');
    expect(maskIdentifier('ABC')).toBe('ABC');

    // PAN: 10 chars -> first 2, 4 dots, last 4
    const maskedPan = maskIdentifier('ABCDE1234F', 4);
    expect(maskedPan).toBe('AB••••234F');

    // Bank Account: 12 chars -> first 2, 6 dots, last 4
    const maskedBank = maskIdentifier('123456789012', 4);
    expect(maskedBank).toBe('12••••••9012');
  });

  it('computeFactoriesActOt calculates double rate based on 208-hour divisor', () => {
    // Basic: ₹20,800, DA: ₹0, Allowances: ₹0 -> Hourly base = ₹100, 2x = ₹200/hr
    // 120 minutes = 2 hours -> Total OT = ₹400
    const ot = computeFactoriesActOt(20800, 0, 0, 120, 208);
    expect(ot.otBaseRupees).toBe(20800);
    expect(ot.divisorHours).toBe(208);
    expect(ot.hourlyRateRupees).toBe(100);
    expect(ot.multiplier).toBe(2);
    expect(ot.otHours).toBe(2);
    expect(ot.totalOtRupees).toBe(400);

    // With DA and OT Allowances
    const otWithAllow = computeFactoriesActOt(20000, 5000, 1000, 60, 260);
    expect(otWithAllow.otBaseRupees).toBe(26000);
    expect(otWithAllow.hourlyRateRupees).toBe(100);
    expect(otWithAllow.otHours).toBe(1);
    expect(otWithAllow.totalOtRupees).toBe(200);
  });
});

describe('PDF Builder (SimplePdfDocument)', () => {
  it('generates a valid binary PDF document', () => {
    const pdf = new SimplePdfDocument();
    pdf.drawRect({ x: 40, y: 40, width: 200, height: 100, fill: [0.95, 0.95, 0.95], stroke: [0.8, 0.8, 0.8], lineWidth: 1 });
    pdf.drawLine({ x1: 40, y1: 150, x2: 240, y2: 150, stroke: [0.2, 0.2, 0.2], lineWidth: 0.5 });
    pdf.drawText({ text: 'RASHMI METALIKS LIMITED', x: 50, y: 60, fontSize: 14, bold: true });
    pdf.drawText({ text: 'Special chars: (Test) & \\escaped\\ and non-ascii: ₹ 100', x: 50, y: 80, fontSize: 10 });

    const buffer = pdf.build();
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(100);

    const pdfString = buffer.toString('latin1');
    expect(pdfString.startsWith('%PDF-1.4')).toBe(true);
    expect(pdfString).toContain('%%EOF');
    expect(pdfString).toContain('/Font');
    expect(pdfString).toContain('RASHMI METALIKS LIMITED');
  });
});

describe('Payslip Template Engine (HTML & PDF Rendering)', () => {
  const samplePayslipData: PayslipData = {
    companyName: 'Rashmi Metaliks Limited',
    monthStr: '2026-06',
    monthName: 'June 2026',
    type: 'regular',
    employee: {
      id: 101,
      ecode: 'RML01234',
      name: 'Santosh Kumar',
      designation: 'Senior Process Engineer',
      department: 'Blast Furnace Operations',
      costCenter: 'BF-UNIT-1',
      doj: '15 May 2018',
      bankAccountMasked: '12••••••9012',
      bankName: 'State Bank of India',
      ifsc: 'SBIN0001234',
      panMasked: 'AB••••1234F',
      uanMasked: '10••••••5678',
      pfNumberMasked: 'WB••••••001',
      esicNumberMasked: '—',
    },
    attendance: {
      daysInMonth: 30,
      payableDays: 29,
      lopDays: 1,
      lopReversalDays: 0,
      otMinutes: 240,
    },
    earnings: [
      { code: 'BASIC', name: 'Basic Salary', amountRupees: 35000 },
      { code: 'HRA', name: 'House Rent Allowance', amountRupees: 14000 },
      { code: 'SPECIAL', name: 'Special Allowance', amountRupees: 8000 },
    ],
    deductions: [
      { code: 'PF_EE', name: 'Provident Fund (Employee)', amountRupees: 1800, calcNote: 'Statutory 12% on ₹15k wage cap' },
      { code: 'PT', name: 'Professional Tax', amountRupees: 200 },
      { code: 'TDS', name: 'Income Tax (TDS)', amountRupees: 2500 },
    ],
    employerContributions: [
      { code: 'PF_ER', name: 'Provident Fund (Employer)', amountRupees: 1800 },
    ],
    grossRupees: 57000,
    totalDeductionsRupees: 4500,
    netPayRupees: 52500,
    netPayInWords: 'Rupees Fifty-Two Thousand Five Hundred Only',
    overtimeBreakdown: {
      basicRupees: 35000,
      daRupees: 0,
      otAllowancesRupees: 0,
      otBaseRupees: 35000,
      divisorHours: 208,
      hourlyRateRupees: 168.27,
      multiplier: 2,
      otHours: 4,
      totalOtRupees: 1346.15,
    },
    leaveBalances: [
      { type: 'CL', opening: 4, accrued: 1, availed: 1, balance: 4 },
      { type: 'EL', opening: 12, accrued: 1.5, availed: 0, balance: 13.5 },
      { type: 'SL', opening: 6, accrued: 0.5, availed: 0, balance: 6.5 },
    ],
  };

  it('renderPayslipHtml outputs complete semantic HTML with metadata and tables', () => {
    const html = renderPayslipHtml(samplePayslipData);
    expect(typeof html).toBe('string');
    expect(html).toContain('Rashmi Metaliks Limited');
    expect(html).toContain('PAYSLIP — June 2026');
    expect(html).toContain('RML01234');
    expect(html).toContain('Santosh Kumar');
    expect(html).toContain('Basic Salary');
    expect(html).toContain('57,000.00');
    expect(html).toContain('52,500.00');
    expect(html).toContain('Rupees Fifty-Two Thousand Five Hundred Only');
    expect(html).toContain('Leave Balances');
    expect(html).toContain('Factories Act Overtime Computation');
  });

  it('renderPayslipHtml renders correctly for reimbursement payslip type', () => {
    const reimbData: PayslipData = {
      ...samplePayslipData,
      type: 'reimbursement',
    };
    const html = renderPayslipHtml(reimbData);
    expect(html).toContain('REIMBURSEMENT PAYSLIP — June 2026');
  });

  it('renderPayslipHtml renders correctly for overtime payslip and handles missing optionals', () => {
    const otData: PayslipData = {
      ...samplePayslipData,
      type: 'overtime',
      overtimeBreakdown: undefined,
      leaveBalances: undefined,
      employee: {
        ...samplePayslipData.employee,
        designation: null,
        department: null,
        costCenter: null,
        doj: null,
        bankAccountMasked: null,
        bankName: null,
        ifsc: null,
        panMasked: null,
        uanMasked: null,
        pfNumberMasked: null,
        esicNumberMasked: null,
      },
    };
    const html = renderPayslipHtml(otData);
    expect(html).toContain('OVERTIME PAYSLIP — June 2026');
    expect(html).not.toContain('Factories Act Overtime Computation');
  });

  it('renderPayslipPdf handles overtime, reimbursement, missing leave, and uneven line counts', () => {
    // 1. Overtime PDF
    const otPdf = renderPayslipPdf({
      ...samplePayslipData,
      type: 'overtime',
      leaveBalances: undefined,
      employee: {
        ...samplePayslipData.employee,
        bankName: 'HDFC Bank',
        ifsc: undefined,
      },
    });
    expect(Buffer.isBuffer(otPdf)).toBe(true);

    // 2. Reimbursement PDF with empty leave balances and more deductions than earnings
    const reimbPdf = renderPayslipPdf({
      ...samplePayslipData,
      type: 'reimbursement',
      leaveBalances: [],
      earnings: [
        { code: 'BASIC', name: 'Basic', amountRupees: 10000 },
      ],
      deductions: [
        { code: 'D1', name: 'Deduction 1', amountRupees: 1000 },
        { code: 'D2', name: 'Deduction 2', amountRupees: 500 },
        { code: 'D3', name: 'Deduction 3', amountRupees: 200 },
      ],
      employee: {
        ...samplePayslipData.employee,
        bankName: undefined,
        designation: undefined,
        department: undefined,
        costCenter: undefined,
      },
    });
    expect(Buffer.isBuffer(reimbPdf)).toBe(true);
  });

  it('handles edge cases in maskIdentifier and computeFactoriesActOt', () => {
    expect(maskIdentifier('12345', 4)).toBe('•••2345');
    expect(maskIdentifier('123456', 4)).toBe('1•••3456');
    expect(maskIdentifier('1234', 4)).toBe('1234');
    expect(maskIdentifier('12', 4)).toBe('12');

    // divisorHours = 0 fallback
    const zeroDivisor = computeFactoriesActOt(10000, 0, 0, 60, 0);
    expect(zeroDivisor.hourlyRateRupees).toBe(0);
    expect(zeroDivisor.totalOtRupees).toBe(0);
  });

  it('renderPayslipPdf creates valid PDF buffer with earnings, deductions and leave', () => {
    const pdfBuffer = renderPayslipPdf(samplePayslipData);
    expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
    expect(pdfBuffer.length).toBeGreaterThan(500);

    const pdfString = pdfBuffer.toString('latin1');
    expect(pdfString.startsWith('%PDF-1.4')).toBe(true);
    expect(pdfString).toContain('%%EOF');
    expect(pdfString).toContain('RASHMI METALIKS LIMITED');
    expect(pdfString).toContain('RML01234');
    expect(pdfString).toContain('Santosh Kumar');
  });
});

describe('PayslipGeneratorService Integration', () => {
  it('throws error when payroll run is not found', async () => {
    const mockDb = {
      selectFrom: () => ({
        innerJoin: () => ({
          select: () => ({
            where: () => ({
              executeTakeFirst: () => Promise.resolve(null),
            }),
          }),
        }),
      }),
    } as unknown as Kysely<Database>;

    const service = new PayslipGeneratorService(mockDb);
    await expect(service.assemblePayslipData(999, 101)).rejects.toThrow('Payroll run #999 not found');
  });

  it('throws error when employee is not found', async () => {
    const mockDb = {
      selectFrom: (table: string) => {
        if (table === 'pay.payroll_runs as r') {
          return {
            innerJoin: () => ({
              select: () => ({
                where: () => ({
                  executeTakeFirst: () => Promise.resolve(({
                    id: 1,
                    month: '2026-06-01',
                    status: 'locked',
                    company_id: 1,
                    company_name: 'Rashmi Metaliks Ltd',
                  })),
                }),
              }),
            }),
          };
        }
        if (table === 'core.employees as e') {
          return {
            leftJoin: () => ({
              leftJoin: () => ({
                leftJoin: () => ({
                  select: () => ({
                    where: () => ({
                      executeTakeFirst: () => Promise.resolve(null),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        throw new Error(`Unexpected table ${table}`);
      },
    } as unknown as Kysely<Database>;

    const service = new PayslipGeneratorService(mockDb);
    await expect(service.assemblePayslipData(1, 999)).rejects.toThrow('Employee #999 not found');
  });

  it('assembles complete payslip data with items, lines, and leave balances', async () => {
    const mockDb = {
      selectFrom: (table: string) => {
        if (table === 'pay.payroll_runs as r') {
          return {
            innerJoin: () => ({
              select: () => ({
                where: () => ({
                  executeTakeFirst: () => Promise.resolve(({
                    id: 1,
                    month: '2026-06-01',
                    status: 'locked',
                    company_id: 1,
                    company_name: 'Rashmi Metaliks Ltd',
                  })),
                }),
              }),
            }),
          };
        }
        if (table === 'core.employees as e') {
          return {
            leftJoin: () => ({
              leftJoin: () => ({
                leftJoin: () => ({
                  select: () => ({
                    where: () => ({
                      executeTakeFirst: () => Promise.resolve(({
                        id: 101,
                        ecode: 'RML0101',
                        first_name: 'Amit',
                        last_name: 'Patel',
                        doj: '2020-01-10',
                        pan: 'ABCDE1234F',
                        uan: '100123456789',
                        pf_number: 'WB/123/001',
                        esic_ip_number: null,
                        bank_name: 'HDFC Bank',
                        bank_account: '987654321012',
                        bank_ifsc: 'HDFC0001234',
                        designation: 'Senior Manager',
                        department: 'Finance',
                        costCenter: 'HQ-FIN',
                      })),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'pay.payroll_items') {
          return {
            selectAll: () => ({
              where: () => ({
                where: () => ({
                  executeTakeFirst: () => Promise.resolve(({
                    id: 501,
                    run_id: 1,
                    employee_id: 101,
                    days_in_month: 30,
                    payable_days: 30,
                    lop_days: 0,
                    lop_reversal_days: 0,
                    ot_minutes: 0,
                    gross: '80000.00',
                    total_deductions: '10000.00',
                    net_pay: '70000.00',
                  })),
                }),
              }),
            }),
          };
        }
        if (table === 'pay.payroll_item_lines as l') {
          return {
            innerJoin: () => ({
              select: () => ({
                where: () => ({
                  orderBy: () => ({
                    execute: () => Promise.resolve([
                      { component_code: 'BASIC', name: 'Basic Salary', kind: 'earning', display_order: 1, amount: '50000.00', calc_note: null },
                      { component_code: 'HRA', name: 'HRA', kind: 'earning', display_order: 2, amount: '20000.00', calc_note: null },
                      { component_code: 'SPECIAL', name: 'Special Allowance', kind: 'earning', display_order: 3, amount: '10000.00', calc_note: null },
                      { component_code: 'PF_EE', name: 'Provident Fund', kind: 'deduction', display_order: 10, amount: '1800.00', calc_note: '12% cap' },
                      { component_code: 'TDS', name: 'Income Tax', kind: 'deduction', display_order: 11, amount: '8200.00', calc_note: 'New regime' },
                    ]),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'lv.leave_types') {
          return {
            select: () => ({
              where: () => ({
                execute: () => Promise.resolve([
                  { id: 1, code: 'CL' },
                  { id: 2, code: 'EL' },
                ]),
              }),
            }),
          };
        }
        if (table === 'lv.ledger') {
          return {
            select: () => ({
              where: () => ({
                where: () => ({
                  execute: () => Promise.resolve([
                    { txn_type: 'grant', delta: '12.0' },
                    { txn_type: 'application', delta: '-2.0' },
                  ]),
                }),
              }),
            }),
          };
        }
        throw new Error(`Unexpected table ${table}`);
      },
    } as unknown as Kysely<Database>;

    const service = new PayslipGeneratorService(mockDb);
    const data = await service.assemblePayslipData(1, 101);

    expect(data.companyName).toBe('Rashmi Metaliks Ltd');
    expect(data.employee.ecode).toBe('RML0101');
    expect(data.employee.name).toBe('Amit Patel');
    expect(data.earnings.length).toBe(3);
    expect(data.deductions.length).toBe(2);
    expect(data.grossRupees).toBe(80000);
    expect(data.totalDeductionsRupees).toBe(10000);
    expect(data.netPayRupees).toBe(70000);
    expect(data.netPayInWords).toBe('Rupees Seventy Thousand Only');
    expect(data.leaveBalances?.length).toBe(2);
  });
});
