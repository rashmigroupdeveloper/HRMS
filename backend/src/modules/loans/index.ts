/**
 * @module modules/loans — Staff loans, advances, amortization and perquisite valuation (M11, LN-01..04).
 */
export {
  generateAmortizationSchedule,
  calculateMonthlyPerquisite,
  formatLoanAmount,
  type ScheduleLoanType,
  type InstallmentScheduleItem,
  type AmortizationSchedule,
  type PerquisiteParams,
} from './amortization.js';

export {
  LoansService,
  type ApplyLoanParams,
  type LegacyLoanImportParams,
  type LoanLedgerSummary,
} from './loans.service.js';

export { loansRouter } from './loans.router.js';
