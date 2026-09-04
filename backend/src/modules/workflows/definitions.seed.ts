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
  { code: 'overtime', name: 'Overtime (48h hard rule)', steps: [{ step: 1, approver: 'reporting_manager', slaHours: 48, onBreach: 'lapse' }] },
  { code: 'shift_swap', name: 'Shift swap / bid', steps: [rm()] },
  {
    // Ported from the live EMS: reporting manager -> head of department ->
    // final approver (docs/recon/ems-claims-live-schema.md §3). The engine
    // skips a vacant step, skips an approver who IS the requester, and skips
    // anyone already on the chain — so an RM who also heads the department
    // collapses to one step rather than approving twice.
    //
    // The final step is a ROLE, not a named person: the live system routes
    // every claim in the group through ONE admin account, which is the
    // availability and audit single point of failure recorded as docs/15
    // GAP-D01. A role queue keeps the rule and removes the bottleneck.
    code: 'claim',
    name: 'Expense Claim',
    steps: [
      { step: 1, approver: 'reporting_manager', slaHours: 72, onBreach: 'escalate' },
      { step: 2, approver: 'hod', slaHours: 72, onBreach: 'escalate' },
      { step: 3, approver: 'role:hr_head', slaHours: 72, onBreach: 'escalate' },
    ],
  },
  {
    // A budget must be approved before anything can be claimed against it, so
    // it carries the same chain — the money is committed at the same three
    // desks that will later see the claim.
    code: 'travel_budget',
    name: 'Travel Budget',
    steps: [
      { step: 1, approver: 'reporting_manager', slaHours: 72, onBreach: 'escalate' },
      { step: 2, approver: 'hod', slaHours: 72, onBreach: 'escalate' },
      { step: 3, approver: 'role:hr_head', slaHours: 72, onBreach: 'escalate' },
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
  {
    code: 'privacy_rights',
    name: 'DPDP rights request',
    steps: [{ step: 1, approver: 'role:dpo', slaHours: 360, onBreach: 'escalate' }],
  },
  {
    code: 'profile_change',
    name: 'Profile change',
    steps: [{ step: 1, approver: 'role:hr_ops', slaHours: 72, onBreach: 'escalate' }],
  },
] as const;
