/**
 * Salary Component Definitions & Zod Schemas (PAY-01, SOW crosswalk, docs/09 §2, docs/03 §6).
 */
import { z } from 'zod';

const COMPONENT_KINDS = ['earning', 'deduction', 'employer_contribution'] as const;
export type ComponentKind = (typeof COMPONENT_KINDS)[number];

const ROUNDING_MODES = ['round', 'floor', 'ceil', 'nearest_10'] as const;
export type RoundingRule = (typeof ROUNDING_MODES)[number];

export const salaryComponentSchema = z.object({
  code: z.string().min(2).max(64).regex(/^[A-Z0-9_]+$/, 'Component code must be UPPERCASE letters, numbers, and underscores'),
  name: z.string().min(2).max(128),
  kind: z.enum(COMPONENT_KINDS),
  formula: z.string().nullable().optional(),
  rounding: z.enum(ROUNDING_MODES).default('round'),
  taxable: z.boolean().default(true),
  part_of_gross: z.boolean().default(true),
  part_of_pf_wages: z.boolean().default(false),
  prorate_on_lop: z.boolean().default(true),
  display_order: z.number().int().min(1).max(999),
  is_active: z.boolean().default(true),
});

export type SalaryComponent = z.infer<typeof salaryComponentSchema>;

export const updateComponentInputSchema = z.object({
  code: z.string().min(2).max(64),
  name: z.string().min(2).max(128).optional(),
  kind: z.enum(COMPONENT_KINDS).optional(),
  formula: z.string().nullable().optional(),
  rounding: z.enum(ROUNDING_MODES).optional(),
  taxable: z.boolean().optional(),
  part_of_gross: z.boolean().optional(),
  part_of_pf_wages: z.boolean().optional(),
  prorate_on_lop: z.boolean().optional(),
  display_order: z.number().int().min(1).max(999).optional(),
  is_active: z.boolean().optional(),
});
export type UpdateComponentInput = z.infer<typeof updateComponentInputSchema>;
