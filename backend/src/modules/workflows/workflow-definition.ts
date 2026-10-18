/** WF-01: runtime approval definitions and their validated contract. */
import { z } from 'zod';
import type { Kysely, Transaction } from 'kysely';
import type { Database } from '../../core/db/types.js';
type Db = Kysely<Database> | Transaction<Database>;

/** Schema-level default when a chain omits slaHours; the real SLA is per-step
 *  chain DATA (editable via the definitions API). */
export const DEFAULT_STEP_SLA_HOURS = 48;

const approverSpec = z.string().regex(/^(reporting_manager|functional_manager|role:[A-Za-z0-9_.-]+|user:[1-9]\d*)$/,
  'Use a reporting manager, functional manager, role code or positive user ID')
  .refine(value => !value.startsWith('user:') || Number.isSafeInteger(Number(value.slice(5))), 'User ID is out of range');

const stepSpecSchema = z.object({
  step: z.number().int().positive(),
  /** 'reporting_manager' | 'functional_manager' | 'role:<code>' | 'user:<id>' */
  approver: approverSpec,
  slaHours: z.number().positive().default(DEFAULT_STEP_SLA_HOURS),
  onBreach: z.enum(['escalate', 'auto_reject', 'lapse', 'auto_approve']).default('escalate'),
  /** approver spec for escalation target; default = approver's own manager. */
  escalateTo: approverSpec.optional(),
});
export type StepSpec = z.infer<typeof stepSpecSchema>;
export const stepsSchema = z.array(stepSpecSchema).min(1).superRefine((steps, context) => {
  const numbers = new Set<number>();
  steps.forEach((step, index) => {
    if (numbers.has(step.step)) context.addIssue({ code: z.ZodIssueCode.custom,
      path: [index, 'step'], message: 'Step numbers must be unique; duplicate steps would bypass an approval' });
    numbers.add(step.step);
  });
});

export async function getSteps(db: Db, definitionCode: string): Promise<StepSpec[]> {
  const def = await db.selectFrom('wf.definitions').select(['steps', 'is_active']).where('code', '=', definitionCode).executeTakeFirst();
  if (def?.is_active !== true) throw new Error(`Unknown or inactive workflow: ${definitionCode}`);
  return stepsSchema.parse(def.steps);
}

