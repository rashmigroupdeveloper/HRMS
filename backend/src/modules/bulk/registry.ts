/** Every bulk import in the product, keyed for the /bulk/{importer} API. */
import type { BulkImporter } from '../../core/bulk/index.js';
import { assetsImporter } from './importers/assets.js';
import { employeesImporter } from './importers/employees.js';
import { holidaysImporter } from './importers/holidays.js';
import { leaveBalancesImporter } from './importers/leave.js';
import { legacyLoansImporter } from './importers/loans.js';
import { payrollInputsImporter } from './importers/payroll-inputs.js';
import { punchesImporter } from './importers/punches.js';
import { salaryAssignmentsImporter } from './importers/salaries.js';
import { ptSlabsImporter, statutoryRatesImporter } from './importers/statutory.js';

export const IMPORTERS: readonly BulkImporter<never>[] = [
  employeesImporter,
  salaryAssignmentsImporter,
  payrollInputsImporter,
  punchesImporter,
  leaveBalancesImporter,
  legacyLoansImporter,
  holidaysImporter,
  assetsImporter,
  statutoryRatesImporter,
  ptSlabsImporter,
] as unknown as readonly BulkImporter<never>[];

export function findImporter(key: string): BulkImporter<unknown> | undefined {
  return IMPORTERS.find((i) => i.key === key);
}
