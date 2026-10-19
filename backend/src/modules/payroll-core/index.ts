import { payrollConfigRouter } from './config/config.router.js';
/**
 * @module payroll-core — Salary Components, Structures, Assignments & Pipeline Engine.
 * Public barrel for the payroll-core module (docs/14 §2).
 */
import { componentRouter } from './components/component.router.js';
import { structureRouter } from './structures/structure.router.js';
import { salaryRouter } from './salaries/salary.router.js';
import { payrollRunsRouter } from './runs/run.router.js';
import { salaryHoldsRouter } from './holds/holds.router.js';
import { statutoryRouter } from './statutory/statutory.router.js';
import { parallelRunRouter } from './parallel-run/parallel-run.router.js';
import { annualProcessesRouter } from './annual/annual.router.js';

export const payrollCoreRouter = {
  components: componentRouter,
  structures: structureRouter,
  salaries: salaryRouter,
  runs: payrollRunsRouter,
  holds: salaryHoldsRouter,
  statutory: statutoryRouter,
  parallelRun: parallelRunRouter,
  annual: annualProcessesRouter,
  config: payrollConfigRouter,
};

export {
  listComponents,
  getComponent,
  createComponent,
  updateComponent,
} from './components/component.service.js';

export {
  listStructures,
  getStructure,
  createStructure,
  updateStructure,
  previewStructureBreakup,
} from './structures/structure.service.js';

export {
  assignSalary,
  getEffectiveSalary,
  getSalaryRevisionHistory,
  autoSwitchConfirmation,
} from './salaries/salary.service.js';

export {
  buildAndValidateDag,
  resolveSalaryStructure,
  structureLineNode,
  validateCtcBreakup,
  evaluateExpression,
  applyRounding,
  type ComponentFormulaNode,
  type EvaluatedBreakup,
} from './structures/dag-evaluator.js';

export {
  validateRunTransition,
  isRunImmutable,
  type TransitionContext,
  type TransitionValidationResult,
} from './runs/run-state-machine.js';

export {
  PayrollRunService,
  type CreateRunInput,
  type RunSummary,
} from './runs/run.service.js';

export {
  computeAttendanceSummary,
  prorateComponent,
  prorateComponents,
  type ProrationInput,
  type ProrationResult,
  type AttendanceProrationSummary,
} from './engine/proration.js';

export {
  computeEmployeePayroll,
  computeWestBengalPt,
  type ComponentMetadata,
  type EmployeeComputeInput,
  type ComputedEmployeePayroll,
  type ComputedPayrollLine,
} from './engine/compute-engine.js';

export {
  computeRetroDeltas,
  aggregateArrearsForRun,
  type RetroMonthComparison,
  type ArrearScheduleItem,
} from './engine/arrears.js';

export {
  SalaryHoldsService,
  type CreateHoldInput,
  type ReleaseHoldInput,
} from './holds/holds.service.js';

export {
  ReconciliationService,
  type ReconciliationReport,
} from './reconciliation/reconciliation.service.js';

export {
  computePf,
  generateEcrExport,
  type PfComputeInput,
  type PfComputeResult,
  type EcrRecordInput,
  type PfWageBaseMode,
} from './statutory/pf.js';

export {
  computeEsic,
  isEsicEligibleAtPeriodStart,
  getEsicPeriod,
  generateEsicMonthlyReturn,
  STATUTORY_ESIC_CEILING_PAISE,
  type EsicComputeResult,
  type EsicPeriodInfo,
  type EsicReturnInput,
} from './statutory/esic.js';

export {
  computePt,
  generatePtrcRegister,
  WEST_BENGAL_PT_SLABS,
  type PtSlab,
  type PtrcEmployeeRecord,
  type PtrcRegisterSummary,
} from './statutory/pt.js';

export {
  computeLwf,
  generateFormDStatement,
  type LwfComputeResult,
  type FormDStatement,
  type FormDEmployeeRecord,
} from './statutory/lwf.js';

export {
  computeAnnualTax,
  computeMonthlyTds,
  computeHraExemption,
  generateItStatementLines,
  generateForm24QSummary,
  NEW_REGIME_SD_PAISE,
  OLD_REGIME_SD_PAISE,
  type TaxRegime,
  type AnnualTaxResult,
  type MonthlyTdsInput,
  type HraExemptionInput,
  type ItStatementInput,
  type ItStatementLayout,
  type Form24QRecord,
  type Form24QSummary,
} from './statutory/tds.js';

export {
  isApprentice,
  computeApprenticeDeductions,
  type ApprenticeDeductionsInput,
  type ApprenticeDeductionsResult,
} from './statutory/apprentice.js';

export {
  TaxDeclarationService,
  type TaxDeclarationRecord,
  type DeclareInvestmentInput,
  type VerifyDeclarationInput,
} from './tax-declaration/declaration.service.js';

export {
  parseAndValidateProtivitiRegister,
  type ProtivitiRegisterRow,
  type IngestedRegister,
  type NormalizedRegisterItem,
} from './parallel-run/parallel-import.js';

export {
  ParallelRunVarianceService,
  type DiscrepancyCategory,
  type EmployeeParallelVariance,
  type ParallelRunReconciliationReport,
} from './parallel-run/variance-reporter.js';

export {
  YtdHistoricalLoader,
  type YtdOpeningRecord,
  type NormalizedYtdSummary,
  type YtdImportResult,
} from './parallel-run/ytd-loader.js';

export {
  BonusTrueupEngine,
  type EmployeeBonusInput,
  type EmployeeBonusResult,
  type BonusTrueupSummary,
  type SetOnSetOffLedger,
} from './annual/bonus-trueup.js';

export {
  IncrementBatchEngine,
  type IncrementType,
  type IncrementPolicy,
  type EmployeeIncrementInput,
  type EmployeeIncrementResult,
  type IncrementSimulationSummary,
  type ScheduledArrearRecord,
} from './annual/increment-batch.js';

export {
  calculateGratuity,
  calculateServiceTenure,
  type GratuityCalculationInput,
  type GratuityCalculationResult,
} from './fnf/gratuity-calculator.js';

export {
  computeFnfSettlement,
  calculateWorkingDaysTat,
  calculateWorkingDaysElapsed,
  type FnfComputeParams,
  type FnfSettlementCalculation,
  type FnfBreakdownLine,
} from './fnf/fnf-engine.js';

export { fnfCycles, fnfCycleForDate, fnfTatState, type FnfCycle, type FnfTatState } from './fnf/fnf-calendar.js';

export { readLockedPayableDays } from './runs/attendance.repository.js';

// Bulk import (CSV/Excel) building blocks — consumed by modules/bulk.
export { addRunInputs, runInputProblems, enterableComponentCodes, addStatutoryRate, setPtSlabs, STATUTORY_PARAMS } from './config/config.service.js';

// Muster LOP parity (owner bar #2): the muster counts LOP exactly as payroll deducts it.
export { unpaidDayEquivalents, parseLopDivisor, type DayFact } from './runs/payable-days.js';
