/**
 * Payroll Run 8-State Machine (PAY-03, docs/03 §10, docs/04 §3).
 *
 * States:
 *   draft -> inputs_locked -> computed -> under_review -> approved -> finalized -> paid
 *   Reversal: finalized/approved -> reopened (with mandatory audit note)
 *
 * Rules:
 *   1. Cannot transition to `computed` without a locked attendance month (`attendance_lock_id`).
 *   2. Cannot transition to `approved` without two-person rule: maker cannot self-approve.
 *   3. Cannot transition to `finalized` without exact-paisa reconciliation match.
 *   4. Finalized runs are strictly immutable at the database level.
 */

import type { PayrollRunStatus } from '../../../core/db/types.js';

export interface TransitionContext {
  fromStatus: PayrollRunStatus;
  toStatus: PayrollRunStatus;
  attendanceLockId?: number | null | undefined;
  makerUserId?: number | null | undefined;
  actorUserId: number;
  reconciliationDiffPaise?: number | undefined;
  reopenReason?: string | undefined;
}

export interface TransitionValidationResult {
  valid: boolean;
  error?: string;
}

/** Allowed state transitions */
const VALID_TRANSITIONS: Record<PayrollRunStatus, PayrollRunStatus[]> = {
  draft: ['inputs_locked'],
  inputs_locked: ['computed', 'draft'],
  computed: ['under_review', 'inputs_locked'],
  under_review: ['approved', 'computed', 'inputs_locked'],
  approved: ['finalized', 'under_review', 'reopened'],
  finalized: ['paid', 'reopened'],
  paid: [],
  reopened: ['inputs_locked', 'computed', 'draft'],
};

/**
 * Validate if a transition between two payroll run statuses is permitted.
 */
export function validateRunTransition(context: TransitionContext): TransitionValidationResult {
  const {
    fromStatus,
    toStatus,
    attendanceLockId,
    makerUserId,
    actorUserId,
    reconciliationDiffPaise,
    reopenReason,
  } = context;

  // 1. Check basic graph transitions
  const allowed = VALID_TRANSITIONS[fromStatus];
  if (!allowed.includes(toStatus)) {
    return {
      valid: false,
      error: `Illegal state transition from '${fromStatus}' to '${toStatus}'.`,
    };
  }

  // 2. Gate `computed`: attendance lock is mandatory (ATT-12/15, C11)
  if (toStatus === 'computed') {
    if (!attendanceLockId) {
      return {
        valid: false,
        error: `Cannot transition to 'computed': Attendance month must be locked first (attendance_lock_id is required).`,
      };
    }
  }

  // 3. Gate `approved`: Two-person authorization rule (maker != checker, C12, docs 03 §10)
  if (toStatus === 'approved') {
    if (
      makerUserId === null ||
      makerUserId === undefined ||
      !Number.isSafeInteger(makerUserId) ||
      makerUserId <= 0
    ) {
      return { valid: false, error: 'Approval requires a recorded payroll maker.' };
    }
    if (makerUserId === actorUserId) {
      return {
        valid: false,
        error: `Two-person authorization violation: The initiator of the payroll run (User #${makerUserId}) cannot approve their own run. An independent checker must approve.`,
      };
    }
  }

  // 4. Gate `finalized`: Independent secondary reconciliation must match to the exact paisa (doc 14 §7.7)
  if (toStatus === 'finalized') {
    if (reconciliationDiffPaise === undefined || !Number.isSafeInteger(reconciliationDiffPaise)) {
      return {
        valid: false,
        error: 'Finalization requires an exact integer-paise reconciliation result.',
      };
    }
    if (reconciliationDiffPaise !== 0) {
      return {
        valid: false,
        error: `Cannot finalize payroll run: Independent reconciliation mismatch of ${reconciliationDiffPaise} paise. Engine total must match SQL aggregate to the exact paisa.`,
      };
    }
  }

  // 5. Gate `reopened`: Must carry a non-empty audit reason
  if (toStatus === 'reopened') {
    if (!reopenReason || reopenReason.trim().length < 5) {
      return {
        valid: false,
        error: `Reopening a payroll run requires an audit justification of at least 5 characters.`,
      };
    }
  }

  return { valid: true };
}

/**
 * Check if a run status is closed/immutable
 */
export function isRunImmutable(status: PayrollRunStatus): boolean {
  return status === 'finalized' || status === 'paid';
}
