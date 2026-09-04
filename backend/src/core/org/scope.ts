/**
 * ORG-05 — one filter predicate for every list, report and export.
 * Empty arrays mean "caller's RBAC scope, no extra slice".
 */
import { z } from 'zod';

export interface OrgScopeFilter {
  companyCode: string[];
  plantCode: string[];
  misCode: string[];
  departmentId: number[];
  costCenterCode: string[];
}

const orgScopeInput = z.object({
  companyCode: z.array(z.string().min(1)).default([]),
  plantCode: z.array(z.string().min(1)).default([]),
  misCode: z.array(z.string().min(1)).default([]),
  departmentId: z.array(z.number().int().positive()).default([]),
  costCenterCode: z.array(z.string().min(1)).default([]),
});

export function emptyOrgScope(): OrgScopeFilter {
  return { companyCode: [], plantCode: [], misCode: [], departmentId: [], costCenterCode: [] };
}

/** Normalize query-string or body input into the shared filter. */
export function parseOrgScope(input: Partial<OrgScopeFilter> | undefined): OrgScopeFilter {
  const parsed = orgScopeInput.parse({
    companyCode: input?.companyCode ?? [],
    plantCode: input?.plantCode ?? [],
    misCode: input?.misCode ?? [],
    departmentId: input?.departmentId ?? [],
    costCenterCode: input?.costCenterCode ?? [],
  });
  return parsed;
}
