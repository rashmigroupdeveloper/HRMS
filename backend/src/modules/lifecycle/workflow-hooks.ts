/**
 * Lifecycle reactions to its workflow chains reaching a final state
 * (resignation, confirmation, transfer). Import direction lifecycle →
 * workflows only; called from app.ts + worker.ts.
 */
import { onWorkflowFinal } from '../workflows/index.js';
import { applyOfferOnFinal } from './offers/offer.service.js';
import { applyResignationOnFinal } from './separation/separation.service.js';
import { applyTransferOnFinal } from './transfers/transfer.service.js';

let registered = false;

export function registerLifecycleWorkflowHooks(): void {
  if (registered) return; // createApp runs per test file — never double-apply
  registered = true;
  onWorkflowFinal('resignation', applyResignationOnFinal);
  onWorkflowFinal('offer_approval', applyOfferOnFinal);
  // C-17: a transfer is approved (or scheduled) only when RM → HR complete.
  onWorkflowFinal('transfer', applyTransferOnFinal);
}
