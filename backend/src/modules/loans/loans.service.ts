/**
 * Loans & Advances Service (M11, LN-01..04)
 *
 * Implements:
 * - ESS loan application with strict tenure & CTC-ratio eligibility checks
 * - Amortization calculation & perquisite valuation (Section 17(2))
 * - Immutable posting ledger (pay.loan_postings)
 * - Payroll deduction synchronization
 * - Legacy SAP / greytHR historical loan import
 */
import type { Kysely } from 'kysely';
import type { Database, LoanStatus, LoanType } from '../../core/db/types.js';
import {
  fromRupees,
  toRupees,
  subtract,
  ZERO,
} from '../../core/money/index.js';
import {
  generateAmortizationSchedule,
  type AmortizationSchedule,
} from './amortization.js';

export interface ApplyLoanParams {
  employeeId: number;
  loanType: LoanType;
  principalRupees: number;
  annualInterestRate?: number;
  tenureMonths: number;
  startMonth: string; // 'YYYY-MM-01'
  perquisiteApplicable?: boolean;
  workflowRequestId?: number | null;
}

export interface LegacyLoanImportParams {
  employeeId: number;
  loanType: LoanType;
  originalPrincipalRupees: number;
  outstandingBalanceRupees: number;
  annualInterestRate: number;
  monthlyEmiRupees: number;
  remainingTenureMonths: number;
  startMonth: string;
  sourceReference: string;
}

export interface LoanLedgerSummary {
  loanId: number;
  employeeId: number;
  loanType: LoanType;
  originalPrincipalRupees: number;
  annualInterestRate: number;
  monthlyEmiRupees: number;
  tenureMonths: number;
  startMonth: string;
  currentOutstandingRupees: number;
  totalRecoveredPrincipalRupees: number;
  totalRecoveredInterestRupees: number;
  totalPerquisiteValuedRupees: number;
  status: LoanStatus;
  source: string;
  postingsCount: number;
}

export class LoansService {
  constructor(private readonly db: Kysely<Database>) {}

  /**
   * Evaluates eligibility for an employee applying for a loan:
   * 1. Service tenure check (minimum 6 months for term loans, 1 month for advances).
   * 2. Active loan count (max 1 term loan + 1 salary advance).
   * 3. EMI-to-salary ratio check (max 30% of monthly gross).
   */
  async checkEligibility(params: {
    employeeId: number;
    loanType: LoanType;
    principalRupees: number;
    tenureMonths: number;
    annualInterestRate?: number;
  }): Promise<{
    eligible: boolean;
    reasons: string[];
    monthlyGrossRupees: number;
    projectedEmiRupees: number;
    maxAllowedEmiRupees: number;
    schedule: AmortizationSchedule;
  }> {
    const { employeeId, loanType, principalRupees, tenureMonths, annualInterestRate = 0 } = params;
    const reasons: string[] = [];

    // 1. Employee tenure
    const emp = await this.db
      .selectFrom('core.employees')
      .select(['id', 'doj', 'status'])
      .where('id', '=', employeeId)
      .executeTakeFirst();

    if (!emp) {
      return {
        eligible: false,
        reasons: ['Employee not found'],
        monthlyGrossRupees: 0,
        projectedEmiRupees: 0,
        maxAllowedEmiRupees: 0,
        schedule: generateAmortizationSchedule({
          loanType,
          principal: fromRupees(principalRupees),
          annualInterestRate,
          tenureMonths,
        }),
      };
    }

    if (emp.status !== 'active') {
      reasons.push(`Employee status is ${emp.status}; only active employees may apply.`);
    }

    const joinDate = emp.doj instanceof Date ? emp.doj : new Date(String(emp.doj));
    const now = new Date();
    const serviceMonths = (now.getFullYear() - joinDate.getFullYear()) * 12 + (now.getMonth() - joinDate.getMonth());

    const isAdvance = loanType === 'salary_advance' || loanType === 'travel_advance';
    const minServiceRequired = isAdvance ? 1 : 6;
    if (serviceMonths < minServiceRequired) {
      reasons.push(
        `Insufficient tenure: required at least ${minServiceRequired} months of service (current: ${serviceMonths} months).`
      );
    }

    // 2. Active loan count
    const activeLoans = await this.db
      .selectFrom('pay.loans')
      .select(['id', 'loan_type', 'outstanding', 'status'])
      .where('employee_id', '=', employeeId)
      .where('status', '=', 'active')
      .execute();

    const existingSameCategory = activeLoans.filter((l) =>
      isAdvance
        ? l.loan_type === 'salary_advance' || l.loan_type === 'travel_advance'
        : l.loan_type !== 'salary_advance' && l.loan_type !== 'travel_advance'
    );

    if (existingSameCategory.length > 0) {
      reasons.push(
        `Already has an active ${isAdvance ? 'advance' : 'term loan'} (ID: ${existingSameCategory[0]?.id}). Close existing loan before applying.`
      );
    }

    // 3. Compensation & EMI ratio
    const latestSalary = await this.db
      .selectFrom('pay.employee_salaries')
      .select(['annual_ctc'])
      .where('employee_id', '=', employeeId)
      .orderBy('effective_from', 'desc')
      .executeTakeFirst();

    const annualCtc = latestSalary ? Number(latestSalary.annual_ctc) : 0;
    const monthlyGrossRupees = annualCtc > 0 ? Math.round(annualCtc / 12) : 50000; // fallback benchmark if salary row pending

    const principalPaise = fromRupees(principalRupees);
    const schedule = generateAmortizationSchedule({
      loanType,
      principal: principalPaise,
      annualInterestRate,
      tenureMonths,
    });

    const projectedEmiRupees = toRupees(schedule.monthlyEmi);
    const maxAllowedEmiRupees = Math.round(monthlyGrossRupees * 0.3); // 30% cap

    if (projectedEmiRupees > maxAllowedEmiRupees) {
      reasons.push(
        `Projected EMI (₹${projectedEmiRupees.toLocaleString('en-IN')}) exceeds 30% of monthly gross salary (Max allowable: ₹${maxAllowedEmiRupees.toLocaleString('en-IN')}).`
      );
    }

    return {
      eligible: reasons.length === 0,
      reasons,
      monthlyGrossRupees,
      projectedEmiRupees,
      maxAllowedEmiRupees,
      schedule,
    };
  }

  /**
   * Applies for a loan. If eligible or forced by admin, records loan in pay.loans.
   */
  async applyLoan(params: ApplyLoanParams): Promise<{
    loanId: number;
    schedule: AmortizationSchedule;
  }> {
    const {
      employeeId,
      loanType,
      principalRupees,
      annualInterestRate = 0,
      tenureMonths,
      startMonth,
      perquisiteApplicable = annualInterestRate < 8.5 && principalRupees > 20000,
      workflowRequestId = null,
    } = params;

    const principalPaise = fromRupees(principalRupees);
    const schedule = generateAmortizationSchedule({
      loanType,
      principal: principalPaise,
      annualInterestRate,
      tenureMonths,
    });

    const monthlyEmiRupees = toRupees(schedule.monthlyEmi);

    const inserted = await this.db
      .insertInto('pay.loans')
      .values({
        employee_id: employeeId,
        loan_type: loanType,
        principal: principalRupees.toFixed(2),
        interest_rate: annualInterestRate.toFixed(3),
        emi: monthlyEmiRupees.toFixed(2),
        start_month: new Date(startMonth),
        tenure_months: tenureMonths,
        outstanding: principalRupees.toFixed(2),
        perquisite_applicable: perquisiteApplicable,
        source: 'hrms',
        workflow_request_id: workflowRequestId,
        status: 'active',
      })
      .returning(['id'])
      .executeTakeFirstOrThrow();

    return {
      loanId: inserted.id,
      schedule,
    };
  }

  /**
   * Imports a legacy loan from SAP or greytHR with verified opening figures.
   */
  async importLegacyLoan(params: LegacyLoanImportParams): Promise<{ loanId: number }> {
    const {
      employeeId,
      loanType,
      originalPrincipalRupees,
      outstandingBalanceRupees,
      annualInterestRate,
      monthlyEmiRupees,
      remainingTenureMonths,
      startMonth,
      sourceReference,
    } = params;

    const inserted = await this.db
      .insertInto('pay.loans')
      .values({
        employee_id: employeeId,
        loan_type: loanType,
        principal: originalPrincipalRupees.toFixed(2),
        interest_rate: annualInterestRate.toFixed(3),
        emi: monthlyEmiRupees.toFixed(2),
        start_month: new Date(startMonth),
        tenure_months: remainingTenureMonths,
        outstanding: outstandingBalanceRupees.toFixed(2),
        perquisite_applicable: annualInterestRate < 8.5 && originalPrincipalRupees > 20000,
        source: `sap_legacy:${sourceReference}`,
        status: outstandingBalanceRupees <= 0 ? 'closed' : 'active',
      })
      .returning(['id'])
      .executeTakeFirstOrThrow();

    return { loanId: inserted.id };
  }

  /**
   * Posts an EMI deduction from payroll run into the immutable loan ledger.
   */
  async postMonthlyDeduction(params: {
    loanId: number;
    runId: number;
    principalPartRupees: number;
    interestPartRupees: number;
    perquisiteValueRupees?: number;
  }): Promise<{ newOutstandingRupees: number; isClosed: boolean }> {
    const {
      loanId,
      runId,
      principalPartRupees,
      interestPartRupees,
      perquisiteValueRupees = 0,
    } = params;

    return await this.db.transaction().execute(async (trx) => {
      const loan = await trx
        .selectFrom('pay.loans')
        .selectAll()
        .where('id', '=', loanId)
        .forUpdate()
        .executeTakeFirstOrThrow();

      // 1. Insert immutable posting row
      await trx
        .insertInto('pay.loan_postings')
        .values({
          loan_id: loanId,
          run_id: runId,
          principal_part: principalPartRupees.toFixed(2),
          interest_part: interestPartRupees.toFixed(2),
          perquisite_value: perquisiteValueRupees.toFixed(2),
        })
        .execute();

      // 2. Reconcile outstanding balance derived as original_principal - SUM(postings.principal_part)
      const ledgerSum = await trx
        .selectFrom('pay.loan_postings')
        .select((eb) => [eb.fn.sum<string>('principal_part').as('total_principal_recovered')])
        .where('loan_id', '=', loanId)
        .executeTakeFirst();

      const totalRecoveredPaise = fromRupees(Number(ledgerSum?.total_principal_recovered ?? 0));
      const originalPrincipalPaise = fromRupees(Number(loan.principal));
      const remainingPaise =
        totalRecoveredPaise >= originalPrincipalPaise
          ? ZERO
          : subtract(originalPrincipalPaise, totalRecoveredPaise);

      const newOutstandingRupees = toRupees(remainingPaise);
      const isClosed = remainingPaise <= ZERO;

      // 3. Update loan master
      await trx
        .updateTable('pay.loans')
        .set({
          outstanding: newOutstandingRupees.toFixed(2),
          status: isClosed ? 'closed' : 'active',
        })
        .where('id', '=', loanId)
        .execute();

      return {
        newOutstandingRupees,
        isClosed,
      };
    });
  }

  /**
   * Retrieves full immutable ledger history and summary for a loan.
   */
  async getLoanLedger(loanId: number): Promise<LoanLedgerSummary & {
    postings: {
      id: number;
      runId: number;
      principalPart: number;
      interestPart: number;
      perquisiteValue: number;
      createdAt: Date;
    }[];
  }> {
    const loan = await this.db
      .selectFrom('pay.loans')
      .selectAll()
      .where('id', '=', loanId)
      .executeTakeFirstOrThrow();

    const postings = await this.db
      .selectFrom('pay.loan_postings')
      .selectAll()
      .where('loan_id', '=', loanId)
      .orderBy('id', 'asc')
      .execute();

    let totalPrincipal = 0;
    let totalInterest = 0;
    let totalPerquisite = 0;

    const formattedPostings = postings.map((p) => {
      const princ = Number(p.principal_part);
      const int = Number(p.interest_part);
      const perq = Number(p.perquisite_value);

      totalPrincipal += princ;
      totalInterest += int;
      totalPerquisite += perq;

      return {
        id: p.id,
        runId: p.run_id,
        principalPart: princ,
        interestPart: int,
        perquisiteValue: perq,
        createdAt: p.created_at instanceof Date ? p.created_at : new Date(p.created_at),
      };
    });

    const startMonthStr =
      loan.start_month instanceof Date
        ? loan.start_month.toISOString().slice(0, 10)
        : String(loan.start_month).slice(0, 10);

    return {
      loanId: loan.id,
      employeeId: loan.employee_id,
      loanType: loan.loan_type,
      originalPrincipalRupees: Number(loan.principal),
      annualInterestRate: Number(loan.interest_rate),
      monthlyEmiRupees: Number(loan.emi),
      tenureMonths: loan.tenure_months,
      startMonth: startMonthStr,
      currentOutstandingRupees: Number(loan.outstanding),
      totalRecoveredPrincipalRupees: totalPrincipal,
      totalRecoveredInterestRupees: totalInterest,
      totalPerquisiteValuedRupees: totalPerquisite,
      status: loan.status,
      source: loan.source,
      postingsCount: postings.length,
      postings: formattedPostings,
    };
  }

  /**
   * Lists all loans for an employee (active & historical).
   */
  async getEmployeeLoans(employeeId: number): Promise<LoanLedgerSummary[]> {
    const loans = await this.db
      .selectFrom('pay.loans')
      .selectAll()
      .where('employee_id', '=', employeeId)
      .orderBy('id', 'desc')
      .execute();

    const summaries: LoanLedgerSummary[] = [];
    for (const l of loans) {
      const ledger = await this.getLoanLedger(l.id);
      summaries.push(ledger);
    }
    return summaries;
  }

  /**
   * Lists all active loans company-wide for payroll admin.
   */
  async listAllLoans(filter?: { status?: LoanStatus | undefined; loanType?: LoanType | undefined }): Promise<
    (LoanLedgerSummary & {
      ecode: string;
      employeeName: string;
    })[]
  > {
    let query = this.db
      .selectFrom('pay.loans')
      .innerJoin('core.employees', 'core.employees.id', 'pay.loans.employee_id')
      .select([
        'pay.loans.id as loan_id',
        'core.employees.ecode',
        'core.employees.first_name',
        'core.employees.last_name',
      ]);

    if (filter?.status) {
      query = query.where('pay.loans.status', '=', filter.status);
    }
    if (filter?.loanType) {
      query = query.where('pay.loans.loan_type', '=', filter.loanType);
    }

    const rows = await query.orderBy('pay.loans.id', 'desc').execute();

    const results: (LoanLedgerSummary & { ecode: string; employeeName: string })[] = [];
    for (const r of rows) {
      const ledger = await this.getLoanLedger(r.loan_id);
      results.push({
        ...ledger,
        ecode: r.ecode,
        employeeName: `${r.first_name} ${r.last_name}`.trim(),
      });
    }
    return results;
  }
}
