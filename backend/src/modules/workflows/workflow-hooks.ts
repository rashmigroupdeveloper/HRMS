/** WF-01/04: domain reactions remain inside the workflow transaction. */
import { isDeepStrictEqual } from 'node:util';
import type { Kysely, Selectable, Transaction } from 'kysely';
import type { Database, WfRequestsTable } from '../../core/db/types.js';
type Db = Kysely<Database> | Transaction<Database>;
type RequestRow = Selectable<WfRequestsTable>;

/**
 * COMPLETION HOOKS — how domain modules react to a request reaching a final
 * state WITHOUT the workflows module importing them (no dependency cycle):
 * the domain registers `onWorkflowFinal('regularization', handler)` at app
 * wiring time; the engine fires the handler inside the SAME transaction that
 * finalized the request, so domain side-effects are atomic with the decision.
 */
export type WorkflowFinalStatus = 'approved' | 'rejected' | 'lapsed';
export type WorkflowFinalHook = (db: Db, request: RequestRow, status: WorkflowFinalStatus) => Promise<void>;

const finalHooks = new Map<string, WorkflowFinalHook[]>();

export function onWorkflowFinal(definitionCode: string, hook: WorkflowFinalHook): void {
  const list = finalHooks.get(definitionCode) ?? [];
  list.push(hook);
  finalHooks.set(definitionCode, list);
}

/** Test/bootstrap helper: clears registered hooks (idempotent re-registration). */
export function clearWorkflowFinalHooks(): void {
  finalHooks.clear();
}

export async function fireFinalHooks(db: Db, requestId: number, status: WorkflowFinalStatus): Promise<void> {
  const request = await db.selectFrom('wf.requests').selectAll().where('id', '=', requestId).executeTakeFirst();
  if (!request) return;
  for (const hook of finalHooks.get(request.definition_code) ?? []) {
    await hook(db, request, status);
  }
}


export const DOMAIN_RESERVED_DEFINITIONS = new Set([
  'leave', 'leave_cancel', 'leave_encashment', 'comp_off', 'restricted_holiday',
  'regularization', 'od', 'overtime',
  // Domain-owned chains: their requests are only created by the owning module,
  // so a final approval always has a real domain row behind it.
  'loan', 'resignation', 'confirmation', 'transfer', 'claim', 'travel_advance_domestic',
  'travel_claim', 'letter_signature', 'offer_approval', 'requisition_approval',
]);
type ResubmitHook = (db: Db, request: RequestRow, payload: Record<string, unknown>) => Promise<Record<string, unknown>>;
const resubmitHooks = new Map<string, ResubmitHook>();
export function onWorkflowResubmit(code: string, hook: ResubmitHook): void { resubmitHooks.set(code, hook); }
export async function prepareResubmission(db: Db, request: RequestRow, payload: Record<string, unknown>) {
  const hook = resubmitHooks.get(request.definition_code);
  if (hook) return hook(db, request, payload);
  if (DOMAIN_RESERVED_DEFINITIONS.has(request.definition_code) && !isDeepStrictEqual(request.payload, payload)) {
    throw new Error('This request needs a validated domain correction; its dates or amounts cannot be edited through the generic workflow API');
  }
  return payload;
}
