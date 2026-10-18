/** Loans react to the 'loan' approval chain (RM → HR head → payroll admin). */
import { onWorkflowFinal } from '../workflows/index.js';
import { applyLoanOnFinal } from './loans.service.js';

let registered = false;

export function registerLoansWorkflowHooks(): void {
  if (registered) return;
  registered = true;
  onWorkflowFinal('loan', applyLoanOnFinal);
}
