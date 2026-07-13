/**
 * Registers leave's reactions to workflow final states (Stage 1.5).
 * Import direction is leave → workflows ONLY. Called from app assembly and
 * the worker — both processes finalize requests.
 */
import { onWorkflowFinal } from '../workflows/index.js';
import { applyCancelOnFinal, applyEncashmentOnFinal, applyLeaveOnFinal, applyRhOnFinal } from './leave-apply.service.js';

let registered = false;

export function registerLeaveWorkflowHooks(): void {
  if (registered) return; // createApp runs per test file — never double-apply
  registered = true;
  onWorkflowFinal('leave', applyLeaveOnFinal);
  onWorkflowFinal('comp_off', applyLeaveOnFinal);
  onWorkflowFinal('leave_cancel', applyCancelOnFinal);
  onWorkflowFinal('leave_encashment', applyEncashmentOnFinal);
  onWorkflowFinal('restricted_holiday', applyRhOnFinal);
}
