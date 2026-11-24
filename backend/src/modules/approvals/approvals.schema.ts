import { reportFilter } from './reports/reports.schema.js'
import { idSchema } from '#shared/schemas/common.schema'
import { z } from 'zod'

export const approvalIdInput = z.object({ id: idSchema })

// An approver's decision on the step that waits for them; a rejection needs its reason
export const decideApprovalInput = z.object({
  id: idSchema,
  approve: z.boolean(),
  comment: z.string().trim().min(1).max(500).optional(),
})

// The requester (or someone the feature allows) takes back a request still waiting
export const cancelApprovalInput = z.object({
  id: idSchema,
  reason: z.string().trim().min(1).max(500).optional(),
})

const inboxExportInput = z.object({
  mode: z.enum(['waiting', 'decided', 'mine', 'held']),
  feature: z.string().max(50).optional(),
})

export const exportApprovalsInput = z.union([inboxExportInput, reportFilter.extend({mode:z.literal('team')})])
