import { BgvCheckStatus, BgvCheckType } from '#core/db/prisma'
import { idSchema } from '#shared/schemas/common.schema'
import { z } from 'zod'

const text = (max: number) => z.string().trim().min(1).max(max)

export const listBackgroundChecksInput = z.object({ candidateId: idSchema })

export const backgroundCheckIdInput = z.object({ id: idSchema })

// Starts a check (status IN_PROGRESS).
export const createBackgroundCheckInput = z.object({
  candidateId: idSchema,
  type: z.enum(BgvCheckType),
  subject: text(200).optional(),
  vendorName: text(100).optional(),
  vendorReference: text(100).optional(),
})

// Only the fields sent are changed; `null` clears an optional text.
export const updateBackgroundCheckInput = z.object({
  id: idSchema,
  status: z.enum(BgvCheckStatus).optional(),
  subject: text(200).nullable().optional(),
  vendorName: text(100).nullable().optional(),
  vendorReference: text(100).nullable().optional(),
  // Required for DISCREPANCY / FAILED (checked in the service)
  remarks: text(1000).nullable().optional(),
})
