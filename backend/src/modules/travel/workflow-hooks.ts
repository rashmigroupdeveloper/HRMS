/** Travel reactions to its approval chains (trip, advance, expense claim). */
import { onWorkflowFinal } from '../workflows/index.js';
import { applyAdvanceOnFinal, applyTripOnFinal } from './travel.service.js';
import { applyTravelClaimOnFinal } from './settlement.service.js';

let registered = false;

export function registerTravelWorkflowHooks(): void {
  if (registered) return;
  registered = true;
  onWorkflowFinal('travel_trip', applyTripOnFinal);
  onWorkflowFinal('travel_advance_domestic', applyAdvanceOnFinal);
  onWorkflowFinal('travel_claim', applyTravelClaimOnFinal);
}
