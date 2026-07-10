/**
 * The authoritative workflow catalog — docs/08 §4, confirmed against RML's
 * LIVE greytHR manager Review page (09 §10.2). These are shipped DEFAULTS:
 * every chain is runtime-editable via the definitions API (admin.settings).
 *
 * Notable rules: Overtime breaches LAPSE (the hard 48h rule, ATT-08);
 * Restricted Holiday auto-approves at cutoff; money-adjacent chains end at
 * payroll_admin.
 */
import type { StepSpec } from './workflow.service.js';

export interface DefinitionSeed {
  code: string;
  name: string;
  steps: StepSpec[];
}

const rm = (slaHours = 48, onBreach: StepSpec['onBreach'] = 'escalate'): StepSpec => ({
  step: 1,
  approver: 'reporting_manager',
  slaHours,
  onBreach,
});

export const WORKFLOW_DEFINITIONS: readonly DefinitionSeed[] = [
  { code: 'leave', name: 'Leave', steps: [rm()] },
  { code: 'leave_cancel', name: 'Leave Cancel (re-approval)', steps: [rm()] },
  {
    code: 'leave_encashment',
    name: 'Leave Encashment',
    steps: [
      { step: 1, approver: 'reporting_manager', slaHours: 72, onBreach: 'escalate' },
      { step: 2, approver: 'role:hr_ops', slaHours: 72, onBreach: 'escalate' },
      { step: 3, approver: 'role:payroll_admin', slaHours: 72, onBreach: 'escalate' },
    ],
  },
  { code: 'comp_off', name: 'Compensatory Off', steps: [rm()] },
  {
    code: 'restricted_holiday',
    name: 'Restricted Holiday',
    steps: [{ step: 1, approver: 'reporting_manager', slaHours: 48, onBreach: 'auto_approve' }],
  },
  { code: 'regularization', name: 'Regularization & Permission', steps: [rm()] },
  { code: 'od', name: 'On Duty', steps: [rm()] },
  {
    code: 'overtime',
    name: 'Overtime (48h hard rule)',
    steps: [{ step: 1, approver: 'reporting_manager', slaHours: 48, onBreach: 'lapse' }],
  },
  {
    code: 'claim',
    name: 'Expense Claim',
    steps: [
      { step: 1, approver: 'reporting_manager', slaHours: 72, onBreach: 'escalate' },
      { step: 2, approver: 'role:hr_ops', slaHours: 72, onBreach: 'escalate' },
      { step: 3, approver: 'role:payroll_admin', slaHours: 72, onBreach: 'escalate' },
    ],
  },
  {
    code: 'loan',
    name: 'Loan / Advance',
    steps: [
      { step: 1, approver: 'reporting_manager', slaHours: 72, onBreach: 'escalate' },
      { step: 2, approver: 'role:hr_head', slaHours: 72, onBreach: 'escalate' },
      { step: 3, approver: 'role:payroll_admin', slaHours: 72, onBreach: 'escalate' },
    ],
  },
  {
    code: 'travel_advance_domestic',
    name: 'Travel Advance (Domestic)',
    steps: [
      { step: 1, approver: 'reporting_manager', slaHours: 48, onBreach: 'escalate' },
      { step: 2, approver: 'functional_manager', slaHours: 48, onBreach: 'escalate' },
    ],
  },
  {
    code: 'confirmation',
    name: 'Probation Confirmation',
    steps: [
      { step: 1, approver: 'reporting_manager', slaHours: 168, onBreach: 'escalate' },
      { step: 2, approver: 'role:hr_head', slaHours: 168, onBreach: 'escalate' },
    ],
  },
  {
    code: 'resignation',
    name: 'Resignation',
    steps: [
      { step: 1, approver: 'reporting_manager', slaHours: 72, onBreach: 'escalate' },
      { step: 2, approver: 'role:hr_head', slaHours: 72, onBreach: 'escalate' },
      { step: 3, approver: 'role:hr_ops', slaHours: 72, onBreach: 'escalate' },
    ],
  },
  {
    code: 'transfer',
    name: 'Transfer',
    steps: [
      { step: 1, approver: 'reporting_manager', slaHours: 72, onBreach: 'escalate' },
      { step: 2, approver: 'role:hr_ops', slaHours: 72, onBreach: 'escalate' },
    ],
  },
  {
    code: 'letter_signature',
    name: 'Letter Signature Approval',
    steps: [
      { step: 1, approver: 'role:hr_ops', slaHours: 48, onBreach: 'escalate' },
      { step: 2, approver: 'role:hr_head', slaHours: 48, onBreach: 'escalate' },
    ],
  },
] as const;
