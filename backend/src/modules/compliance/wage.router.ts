/**
 * CMP-01 — wage-definition check. Permission is the compliance generate
 * surface, not payroll.run: this is a Code-conformance tool, not a run.
 */
import { z } from 'zod';
import { withPermission } from '../../api/orpc.js';
import { getTypedSetting } from '../../core/settings/read.js';
import { assertWageDefinition } from './wage-definition.js';

const component = z.object({
  code: z.string().min(1).max(40),
  amountPaise: z.number().int().nonnegative(),
  countsAsBasicDa: z.boolean(),
});

const wageRule = withPermission('cmp.register.generate')
  .route({
    method: 'GET',
    path: '/compliance/wage-rule',
    summary: 'Active Basic+DA floor (CMP-01) — never hardcoded in the UI',
  })
  .output(
    z.object({
      requiredPct: z.number(),
      settingKey: z.literal('wages.basic_da_min_pct'),
      excludedComponents: z.array(z.string()),
    }),
  )
  .handler(async ({ context }) => {
    const [requiredPct, excludedRaw] = await Promise.all([
      getTypedSetting(context.db, 'wages.basic_da_min_pct', 'number', 50),
      getTypedSetting(context.db, 'wages.excluded_components', 'string', ''),
    ]);
    return {
      requiredPct,
      settingKey: 'wages.basic_da_min_pct' as const,
      excludedComponents: excludedRaw
        .split(',')
        .map((code) => code.trim())
        .filter((code) => code !== ''),
    };
  });

const wageCheck = withPermission('cmp.register.generate')
  .route({
    method: 'POST',
    path: '/compliance/wage-check',
    summary: 'Evaluate a structure against the Basic+DA floor (CMP-01)',
  })
  .input(z.object({ components: z.array(component).min(1) }))
  .output(
    z.object({
      ok: z.boolean(),
      requiredPct: z.number(),
      actualPct: z.number(),
      basicDaPaise: z.number().int(),
      ctcPaise: z.number().int(),
    }),
  )
  .handler(async ({ input, context }) => {
    const [requiredPct, excludedRaw] = await Promise.all([
      getTypedSetting(context.db, 'wages.basic_da_min_pct', 'number', 50),
      getTypedSetting(context.db, 'wages.excluded_components', 'string', ''),
    ]);
    const excluded = new Set(
      excludedRaw
        .split(',')
        .map((code) => code.trim())
        .filter((code) => code !== ''),
    );
    const counted = input.components.filter((row) => !excluded.has(row.code));
    const violation = assertWageDefinition(counted, requiredPct);
    if (violation === null) {
      const ctcPaise = counted.reduce((sum, row) => sum + row.amountPaise, 0);
      const basicDaPaise = counted
        .filter((row) => row.countsAsBasicDa)
        .reduce((sum, row) => sum + row.amountPaise, 0);
      return {
        ok: true,
        requiredPct,
        actualPct: ctcPaise === 0 ? 0 : (basicDaPaise * 100) / ctcPaise,
        basicDaPaise,
        ctcPaise,
      };
    }
    return {
      ok: false,
      requiredPct: violation.requiredPct,
      actualPct: violation.actualPct,
      basicDaPaise: violation.basicDaPaise,
      ctcPaise: violation.ctcPaise,
    };
  });

export const wageRouter = { wageRule, wageCheck };
