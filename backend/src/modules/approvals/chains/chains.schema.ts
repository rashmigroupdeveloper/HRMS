import { AccessArea, ApprovalBreachAction, ApprovalKind, ApproverType } from '#core/db/prisma'
import { idSchema } from '#shared/schemas/common.schema'
import { z } from 'zod'

// One step of a chain: who decides it - a ROLE step names its role, an ACCESS step its area (checked in the service)
const chainStepSchema = z.object({
  // FALLBACK is never a step of a chain - it is added to a request when every step was skipped
  approverType: z.enum(ApproverType).exclude(['FALLBACK', 'ESCALATION']),
  roleId: idSchema.nullable().optional(),
  accessArea: z.enum(AccessArea).nullable().optional(),
  // a ROLE / ACCESS step named to one holder of it over the chain's whole reach (empty: anyone holding it)
  approverId: idSchema.nullable().optional(),
  seesConfidential: z.boolean().default(false),
  // the SLA in hours and what happens when it passes (2026-11-20): WAIT reminds the approver every SLA hours - without
  // hours it waits with no reminder; any other action needs the hours
  slaHours: z.number().int().min(1).max(2160).nullable().optional(),
  onBreach: z.enum(ApprovalBreachAction).default('WAIT'),
  // ESCALATE to this role (empty: the late approver's reporting manager - for a role / access step, the fallback approver)
  escalateRoleId: idSchema.nullable().optional(),
})

// A chain: the shared one of a kind (companyId null) or one company's own; the steps replace the whole list, in order
export const saveChainInput = z.object({
  kind: z.enum(ApprovalKind),
  companyId: idSchema.nullable(),
  // switched off: new requests of the kind are refused (requests already raised go on)
  isActive: z.boolean().default(true),
  steps: z.array(chainStepSchema).min(1, 'A chain needs at least one step').max(10, 'At most 10 steps'),
})

// Removes one company's own chain - its requests then follow the shared chain
export const removeChainInput = z.object({ kind: z.enum(ApprovalKind), companyId: idSchema })
