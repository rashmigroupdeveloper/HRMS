/**
 * Registers the claims module's reaction to workflow final states.
 * Import direction is claims → workflows ONLY; the engine stays generic.
 * Called once from app assembly and once from the worker — both processes
 * finalize requests (an API decision, or an SLA escalation sweep).
 */
import { onWorkflowFinal } from '../workflows/index.js';
import { applyClaimOnFinal } from './claims.service.js';

let registered = false;

export function registerClaimsWorkflowHooks(): void {
  if (registered) return; // createApp runs per test file — never double-apply
  registered = true;
  onWorkflowFinal('claim', applyClaimOnFinal);
}
