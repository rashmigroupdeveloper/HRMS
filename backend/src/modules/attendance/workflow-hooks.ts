/**
 * Registers attendance's reactions to workflow final states (Stage 1.4).
 * Import direction is attendance → workflows ONLY; the engine stays generic.
 * Called once from app assembly (app.ts) and the worker (jobs/worker.ts) —
 * both processes finalize requests (API acts, escalation sweeps).
 */
import { onWorkflowFinal, onWorkflowResubmit } from '../workflows/index.js';
import { applyRegularizationOnFinal, resubmitRegularization } from './regularization.service.js';
import { applyOvertimeOnFinal } from './overtime.service.js';

let registered = false;

export function registerAttendanceWorkflowHooks(): void {
  if (registered) return; // createApp runs per test file — never double-apply
  registered = true;
  onWorkflowFinal('regularization', applyRegularizationOnFinal);
  onWorkflowFinal('od', applyRegularizationOnFinal);
  onWorkflowResubmit('regularization', resubmitRegularization);
  onWorkflowResubmit('od', resubmitRegularization);
  onWorkflowFinal('overtime', applyOvertimeOnFinal);
}
