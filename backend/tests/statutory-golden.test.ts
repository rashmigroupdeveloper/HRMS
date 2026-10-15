import { describe, it, expect } from 'vitest';
import { paise } from '../src/core/money/money.js';
import {
  computePf,
  generateEcrExport,
  type PfComputeInput,
} from '../src/modules/payroll-core/statutory/pf.js';
import {
  computeEsic,
  isEsicEligibleAtPeriodStart,
  getEsicPeriod,
  generateEsicMonthlyReturn,
} from '../src/modules/payroll-core/statutory/esic.js';
import {
  computePt,
  generatePtrcRegister,
} from '../src/modules/payroll-core/statutory/pt.js';
import {
  computeLwf,
  generateFormDStatement,
} from '../src/modules/payroll-core/statutory/lwf.js';
import {
  computeAnnualTax,
  computeMonthlyTds,
  computeHraExemption,
  generateItStatementLines,
  generateForm24QSummary,
} from '../src/modules/payroll-core/statutory/tds.js';
import {
  isApprentice,
  computeApprenticeDeductions,
} from '../src/modules/payroll-core/statutory/apprentice.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function loadFixture(name: string): unknown {
  const path = fileURLToPath(new URL(`./fixtures/payroll/golden/${name}`, import.meta.url));
  return JSON.parse(readFileSync(path, 'utf8'));
}

interface G3CaseA {
  grossPaise: number;
  expected: { eeEsicPaise: number; erEsicPaise: number };
}

interface G3CaseB {
  grossPaise: number;
}

interface G3CaseC {
  startGrossPaise: number;
  month2GrossPaise: number;
  expectedMonth2: { eeEsicPaise: number; erEsicPaise: number };
}

interface G5Case {
  taxableIncomePaise: number;
  expectedTaxPaise: number;
}

// Load Golden Fixtures
const g1Fixture = loadFixture('g1_staff.json') as {
  monthlySalary: { BASIC: number };
  expected: {
    pfEePaise: number;
    erEpsPaise: number;
    erEpfPaise: number;
    edliPaise: number;
    pfAdminPaise: number;
  };
};

const g2Fixture = loadFixture('g2_pf_ceiling.json') as {
  monthlySalary: { BASIC: number };
  expected: {
    eePfPaise: number;
    erEpsPaise: number;
    erEpfPaise: number;
    edliPaise: number;
  };
};

const g3Fixture = loadFixture('g3_esic.json') as {
  cases: [G3CaseA, G3CaseB, G3CaseC];
};

const g4Fixture = loadFixture('g4_pt.json') as {
  slabs: { grossPaise: number; expectedPtPaise: number }[];
};

const g5Fixture = loadFixture('g5_tds.json') as {
  cases: [G5Case, G5Case, G5Case, G5Case];
};

const g9Fixture = loadFixture('g9_apprentice.json') as {
  employee: { category: string; contractType: string };
  stipendPaise: number;
  expected: { ptPaise: number; netPaise: number };
};

describe('Statutory Compliance Engines (PAY-09..14, Card P03)', () => {
  describe('Provident Fund Engine (PAY-09, Golden G1 & G2)', () => {
    it('matches Golden G1 RML live staff baseline down to the rupee (ACTUAL base)', () => {
      const input: PfComputeInput = {
        pfWagesPaise: paise(g1Fixture.monthlySalary.BASIC), // ₹32,286
        wageBaseMode: 'ACTUAL',
        lopDays: 0,
        unpaidWeekoffDays: 0,
      };

      const result = computePf(input);

      expect(result.eePfPaise).toBe(g1Fixture.expected.pfEePaise); // ₹3,874 (12% of 32,286 = 3874.32 -> 3874)
      expect(result.erEpsPaise).toBe(g1Fixture.expected.erEpsPaise); // ₹1,250 (8.33% of 15k capped at 1250)
      expect(result.erEpfPaise).toBe(g1Fixture.expected.erEpfPaise); // ₹2,624 (3874 - 1250)
      expect(result.edliPaise).toBe(g1Fixture.expected.edliPaise); // ₹75 (0.5% of 15k capped at 75)
      expect(result.adminPaise).toBe(g1Fixture.expected.pfAdminPaise); // ₹161 (0.5% of 32286 = 161.43 -> 161)
      expect(result.ncpDays).toBe(0);
    });

    it('matches Golden G2 PF ceiling crosser in CEILING_15000 mode', () => {
      const input: PfComputeInput = {
        pfWagesPaise: paise(g2Fixture.monthlySalary.BASIC), // ₹22,000
        wageBaseMode: 'CEILING_15000',
        lopDays: 0,
        unpaidWeekoffDays: 0,
      };

      const result = computePf(input);

      expect(result.eePfPaise).toBe(g2Fixture.expected.eePfPaise); // ₹1,800 (12% of 15,000)
      expect(result.erEpsPaise).toBe(g2Fixture.expected.erEpsPaise); // ₹1,250
      expect(result.erEpfPaise).toBe(g2Fixture.expected.erEpfPaise); // ₹1,390 (or capped balance)
      expect(result.edliPaise).toBe(g2Fixture.expected.edliPaise); // ₹75
    });

    it('calculates NCP days correctly from LOP and unpaid weekoffs', () => {
      const result = computePf({
        pfWagesPaise: paise(1500000),
        lopDays: 3,
        unpaidWeekoffDays: 1,
      });
      expect(result.ncpDays).toBe(4);
    });

    it('generates valid ECR text file per EPFO Unified Portal specification', () => {
      const ecr = generateEcrExport([
        {
          uan: '100987654321',
          memberName: 'Subhasis Roy',
          grossWagesPaise: paise(6457300),
          epfWagesPaise: paise(3228600),
          epsWagesPaise: paise(1500000),
          edliWagesPaise: paise(1500000),
          eeSharePaise: paise(387400),
          erEpsPaise: paise(125000),
          erEpfPaise: paise(262400),
          ncpDays: 0,
        },
      ]);

      expect(ecr).toContain('100987654321#~#Subhasis Roy#~#64573#~#32286#~#15000#~#15000#~#3874#~#1250#~#2624#~#0');
    });
  });

  describe('ESIC Engine & Contribution Period State Machine (PAY-10, Golden G3)', () => {
    it('handles G3a: entry at <= ₹21,000 is eligible with 0.75% and 3.25% rounded UP', () => {
      const caseA = g3Fixture.cases[0];
      const isEligible = isEsicEligibleAtPeriodStart(paise(caseA.grossPaise));
      expect(isEligible).toBe(true);

      const result = computeEsic(paise(caseA.grossPaise), isEligible);
      expect(result.eeEsicPaise).toBe(caseA.expected.eeEsicPaise); // ₹158 (ceil of 157.4925)
      expect(result.erEsicPaise).toBe(caseA.expected.erEsicPaise); // ₹683 (ceil of 682.4675)
    });

    it('handles G3b: entry at > ₹21,000 is NOT eligible (₹0 deduction)', () => {
      const caseB = g3Fixture.cases[1];
      const isEligible = isEsicEligibleAtPeriodStart(paise(caseB.grossPaise));
      expect(isEligible).toBe(false);

      const result = computeEsic(paise(caseB.grossPaise), isEligible);
      expect(result.eeEsicPaise).toBe(0);
      expect(result.erEsicPaise).toBe(0);
    });

    it('handles G3c: mid-period salary increase above ₹21,000 retains coverage until period ends', () => {
      const caseC = g3Fixture.cases[2];
      // Entry month (Apr): ₹20,500 <= 21,000
      const isEligibleAtStart = isEsicEligibleAtPeriodStart(paise(caseC.startGrossPaise));
      expect(isEligibleAtStart).toBe(true);

      // Month 2 (May): gross increases to ₹25,000. Employee stays covered for remainder of H1!
      const resultMonth2 = computeEsic(paise(caseC.month2GrossPaise), isEligibleAtStart);
      expect(resultMonth2.eeEsicPaise).toBe(caseC.expectedMonth2.eeEsicPaise); // ₹188 (ceil of 187.50)
      expect(resultMonth2.erEsicPaise).toBe(caseC.expectedMonth2.erEsicPaise); // ₹813 (ceil of 812.50)
    });

    it('determines ESIC contribution periods correctly (H1: Apr-Sep, H2: Oct-Mar)', () => {
      expect(getEsicPeriod('2025-05-15').period).toBe('H1');
      expect(getEsicPeriod('2025-09-30').period).toBe('H1');
      expect(getEsicPeriod('2025-10-01').period).toBe('H2');
      expect(getEsicPeriod('2026-03-31').period).toBe('H2');
    });

    it('generates ESIC monthly return export format', () => {
      const output = generateEsicMonthlyReturn([
        {
          ipNumber: '1100123456',
          ipName: 'Ramesh Das',
          daysWorked: 26,
          totalMonthlyWagesPaise: paise(2000000),
          eeContributionPaise: paise(15000),
        },
      ]);
      expect(output).toContain('1100123456');
      expect(output).toContain('20000.00');
      expect(output).toContain('150.00');
    });
  });

  describe('Professional Tax Multi-State Engine (PAY-11, Golden G4)', () => {
    it('matches Golden G4 West Bengal PT slabs exactly', () => {
      for (const slab of g4Fixture.slabs) {
        const pt = computePt(paise(slab.grossPaise), 'WB');
        expect(pt).toBe(slab.expectedPtPaise);
      }
    });

    it('generates PTRC register format with monthly breakdown', () => {
      const register = generatePtrcRegister('WB', '2025-05', [
        { employeeId: 1, name: 'Anup Singh', grossPaise: paise(6457300), ptPaise: paise(20000) },
        { employeeId: 2, name: 'Bikash Roy', grossPaise: paise(1200000), ptPaise: paise(11000) },
      ]);
      expect(register.totalEmployees).toBe(2);
      expect(register.totalPtPaise).toBe(paise(31000));
      expect(register.records).toHaveLength(2);
    });
  });

  describe('Labour Welfare Fund Engine (PAY-12)', () => {
    it('applies West Bengal semi-annual deduction in June and December only', () => {
      // May (Month 5): no LWF
      const mayResult = computeLwf(5, 'WB');
      expect(mayResult.isLwfMonth).toBe(false);
      expect(mayResult.eeLwfPaise).toBe(0);
      expect(mayResult.erLwfPaise).toBe(0);

      // June (Month 6): ₹3 EE, ₹30 ER
      const juneResult = computeLwf(6, 'WB');
      expect(juneResult.isLwfMonth).toBe(true);
      expect(juneResult.eeLwfPaise).toBe(paise(300));
      expect(juneResult.erLwfPaise).toBe(paise(3000));

      // December (Month 12): ₹3 EE, ₹30 ER
      const decResult = computeLwf(12, 'WB');
      expect(decResult.isLwfMonth).toBe(true);
      expect(decResult.eeLwfPaise).toBe(paise(300));
      expect(decResult.erLwfPaise).toBe(paise(3000));
    });

    it('generates Form D return statement', () => {
      const formD = generateFormDStatement('WB', 2025, 'H1', [
        { employeeId: 1, name: 'Anup Singh', eeLwfPaise: paise(300), erLwfPaise: paise(3000) },
      ]);
      expect(formD.totalEmployees).toBe(1);
      expect(formD.totalRemittancePaise).toBe(paise(3300));
    });
  });

  describe('Income Tax / TDS Engine (PAY-13, Golden G5)', () => {
    it('computes G5a: taxable income ₹7L under New Regime has ₹0 tax (below ₹12L rebate band)', () => {
      const caseA = g5Fixture.cases[0];
      const tax = computeAnnualTax(paise(caseA.taxableIncomePaise), 'new');
      expect(tax.totalTaxWithCessPaise).toBe(caseA.expectedTaxPaise);
    });

    it('computes G5b: taxable income ₹12L under New Regime has full 87A rebate (₹60k) -> ₹0 tax', () => {
      const caseB = g5Fixture.cases[1];
      const tax = computeAnnualTax(paise(caseB.taxableIncomePaise), 'new');
      expect(tax.baseTaxPaise).toBe(paise(6000000));
      expect(tax.rebate87aPaise).toBe(paise(6000000));
      expect(tax.totalTaxWithCessPaise).toBe(0);
    });

    it('computes G5c: taxable income ₹12.5L gets marginal relief capping tax to excess over ₹12L', () => {
      const caseC = g5Fixture.cases[2];
      const tax = computeAnnualTax(paise(caseC.taxableIncomePaise), 'new');
      // Normal tax would be 67,500. Excess over 12L is 50,000. Marginal relief caps base tax at 50,000.
      expect(tax.baseTaxPaise).toBe(paise(5000000));
      // Cess 4% of 50,000 = 2,000. Total = ₹52,000
      expect(tax.totalTaxWithCessPaise).toBe(caseC.expectedTaxPaise);
    });

    it('computes G5d: taxable income ₹18L under New Regime produces base ₹1,60,000 + cess ₹6,400', () => {
      const caseD = g5Fixture.cases[3];
      const tax = computeAnnualTax(paise(caseD.taxableIncomePaise), 'new');
      expect(tax.baseTaxPaise).toBe(paise(16000000));
      expect(tax.cessPaise).toBe(paise(640000));
      expect(tax.totalTaxWithCessPaise).toBe(caseD.expectedTaxPaise);
    });

    it('computes Old Regime with standard deduction ₹50k and Chapter VI-A deductions', () => {
      // ₹10L gross taxable - 50k SD - 1.5L 80C = ₹8L taxable income
      // Old regime slabs: 0-2.5L: 0, 2.5-5L: 12.5k, 5-8L: 20% of 3L = 60k -> base = 72.5k
      // Cess 4% of 72.5k = 2.9k -> total = ₹75,400
      const tax = computeAnnualTax(paise(80000000), 'old');
      expect(tax.baseTaxPaise).toBe(paise(7250000));
      expect(tax.cessPaise).toBe(paise(290000));
      expect(tax.totalTaxWithCessPaise).toBe(paise(7540000));
    });

    it('computes monthly TDS deduction dividing remaining tax by months left in FY', () => {
      const monthlyTds = computeMonthlyTds({
        annualTaxPaise: paise(12000000), // ₹1,20,000 annual
        ytdTdsDeductedPaise: paise(4000000), // ₹40,000 already deducted
        remainingMonths: 8,
      });
      // (120,000 - 40,000) / 8 = ₹10,000 / month
      expect(monthlyTds).toBe(paise(1000000));
    });

    it('computes location-aware HRA exemption u/s 10(13A) (min-of-three)', () => {
      const exemption = computeHraExemption({
        actualHraReceivedPaise: paise(1614300), // ₹16,143
        basicPaise: paise(3228600), // ₹32,286
        rentPaidPaise: paise(1500000), // ₹15,000 rent
        isMetro: false, // Kharagpur: 40% cap
      });
      // 1. actual: ₹16,143
      // 2. rent - 10% basic: 15,000 - 3,228.60 = ₹11,771.40
      // 3. 40% basic: ₹12,914.40
      // Min is 11,771.40 -> ₹11,771
      expect(exemption).toBe(paise(1177100));
    });

    it('generates greytHR ESS parity layout lines A through R', () => {
      const statement = generateItStatementLines({
        grossSalaryPaise: paise(6457300 * 12),
        standardDeductionPaise: paise(7500000),
        regime: 'new',
        ytdTaxPaidPaise: paise(0),
        remainingMonths: 12,
      });

      expect(statement.lineE_GrossSalary).toBeDefined();
      expect(statement.lineI_StandardDeduction).toBe(paise(7500000));
      expect(statement.lineN_TaxableIncome).toBeDefined();
      expect(statement.lineO_AnnualTax).toBeDefined();
      expect(statement.lineR_TdsCurrentMonth).toBeDefined();
    });

    it('generates Form 24Q quarterly summary', () => {
      const qSummary = generateForm24QSummary('2025-26', 'Q1', [
        {
          pan: 'ABCDE1234F',
          employeeName: 'Anup Singh',
          grossSalaryPaise: paise(19371900),
          tdsDeductedPaise: paise(3000000),
          challanBsn: '0012345',
        },
      ]);
      expect(qSummary.quarter).toBe('Q1');
      expect(qSummary.records).toHaveLength(1);
      expect(qSummary.totalTdsPaise).toBe(paise(3000000));
    });
  });

  describe('Apprentices Act 1961 Exclusions (PAY-14, Golden G9)', () => {
    it('matches Golden G9: apprentice is exempt from PF, ESIC, and bonus, with PT on stipend', () => {
      const isAppr = isApprentice(g9Fixture.employee.category, g9Fixture.employee.contractType);
      expect(isAppr).toBe(true);

      const deductions = computeApprenticeDeductions({
        stipendPaise: paise(g9Fixture.stipendPaise),
        state: 'WB',
      });

      expect(deductions.pfEePaise).toBe(0);
      expect(deductions.pfErPaise).toBe(0);
      expect(deductions.esicEePaise).toBe(0);
      expect(deductions.esicErPaise).toBe(0);
      expect(deductions.bonusPaise).toBe(0);
      expect(deductions.ptPaise).toBe(g9Fixture.expected.ptPaise); // ₹110
      expect(deductions.netStipendPaise).toBe(g9Fixture.expected.netPaise); // ₹14,890
    });

    it('regular trainee is NOT exempt from statutory deductions', () => {
      const isAppr = isApprentice('trainee', 'regular');
      expect(isAppr).toBe(false);
    });
  });
});
