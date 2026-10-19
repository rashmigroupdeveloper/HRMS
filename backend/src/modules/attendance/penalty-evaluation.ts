/** ATT-05/SHF-01: explainable policy findings, never attendance or pay mutations. */
import { z } from 'zod';
const timeSlabSchema = z.object({
  fromMin: z.number().int().nonnegative(),
  toMin: z.number().int().nonnegative().nullable(),
  effect: z.enum(['none', 'late', 'half_day']),
}).strict();
export const timeSlabsSchema = z.array(timeSlabSchema).superRefine((slabs, ctx) => {
  for (let i = 0; i < slabs.length; i++) {
    const slab = slabs[i];
    if (!slab) continue;
    const previous = slabs[i - 1];
    if ((slab.toMin !== null && slab.toMin < slab.fromMin)
      || (previous && (previous.toMin === null || slab.fromMin <= previous.toMin))) {
      ctx.addIssue({ code: 'custom', path: [i], message: 'Use ordered, non-overlapping inclusive minute ranges' });
    }
  }
});
const findingSchema = z.object({
  cause: z.enum(['late_arrival', 'early_exit']),
  minutes: z.number().int().positive(),
  rule: timeSlabSchema.extend({ effect: z.enum(['late', 'half_day']) }),
}).strict();
export const penaltyEvaluationSchema = z.array(findingSchema).max(2).refine(
  findings => new Set(findings.map(f => f.cause)).size === findings.length,
  'Each penalty cause may appear only once',
).nullable();
export type PenaltyFinding = z.infer<typeof findingSchema>;
export function readPenaltyEvaluation(value: unknown) {
  return penaltyEvaluationSchema.parse(value);
}
export function evaluateAttendancePenalties(
  lateMinutes: number, earlyExitMinutes: number, lateRules: unknown, earlyRules: unknown,
): PenaltyFinding[] {
  const findings: PenaltyFinding[] = [];
  const evaluate = (cause: PenaltyFinding['cause'], minutes: number, rules: unknown) => {
    const slabs = timeSlabsSchema.parse(rules);
    if (!Number.isInteger(minutes) || minutes < 0) throw new Error('Invalid attendance deviation minutes');
    if (minutes === 0) return;
    const rule = slabs.find(s => minutes >= s.fromMin && (s.toMin === null || minutes <= s.toMin));
    if (rule && rule.effect !== 'none') findings.push({ cause, minutes, rule: { ...rule, effect: rule.effect } });
  };
  evaluate('late_arrival', lateMinutes, lateRules);
  evaluate('early_exit', earlyExitMinutes, earlyRules);
  return findings;
}
