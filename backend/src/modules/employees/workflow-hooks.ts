/** Employees reactions to workflow finals (family_update). Called from app.ts + worker.ts. */
import { onWorkflowFinal } from '../workflows/index.js';
import { applyFamilyOnFinal } from './family.service.js';

let registered = false;

export function registerEmployeesWorkflowHooks(): void {
  if (registered) return;
  registered = true;
  onWorkflowFinal('family_update', applyFamilyOnFinal);
}
