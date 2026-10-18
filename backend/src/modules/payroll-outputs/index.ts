/**
 * @module payroll-outputs — Payslips, Banking, SAP JV, and Variance Reports (Card P04).
 * Public barrel for the payroll-outputs module (docs/14 §2).
 */

export { payrollOutputsRouter } from './payroll-outputs.router.js';

export { SimplePdfDocument } from './payslip/pdf-builder.js';

export {
  PayslipGeneratorService,
} from './payslip/payslip-generator.js';

export {
  renderPayslipHtml,
  renderPayslipPdf,
  computeFactoriesActOt,
  formatCurrencyInWords,
  formatRupeeAmount,
  maskIdentifier,
  type PayslipData,
  type PayslipType,
  type PayslipEmployee,
  type PayslipAttendance,
  type PayslipLineItem,
  type OvertimeBreakdown,
  type LeaveBalanceItem,
} from './payslip/template.service.js';

export {
  BankFileService,
  type BankPaymentRecord,
  type BankBatchSummary,
} from './bank/bank-file.service.js';

export {
  SapJvService,
  type SapJvLine,
  type SapJvReport,
} from './gl/sap-jv.service.js';

export {
  VarianceReportService,
  type EmployeeVariance,
  type VarianceReportSummary,
} from './variance/variance.service.js';

export {
  OutputsBundleService,
  type RunOutputItem,
  type RunOutputsStatus,
} from './outputs-bundle.service.js';
