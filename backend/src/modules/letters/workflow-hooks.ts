/**
 * Registers letters' reaction to the 'letter_signature' chain final state.
 * Import direction letters → workflows only; called from app.ts + worker.ts.
 */
import { onWorkflowFinal } from '../workflows/index.js';
import { applyLetterOnFinal } from './letters.service.js';

let registered = false;

export function registerLettersWorkflowHooks(): void {
  if (registered) return; // createApp runs per test file — never double-apply
  registered = true;
  onWorkflowFinal('letter_signature', applyLetterOnFinal);
}
