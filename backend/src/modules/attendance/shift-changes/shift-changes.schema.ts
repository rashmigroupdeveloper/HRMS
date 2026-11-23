import { idSchema } from '#shared/schemas/common.schema'
import { z } from 'zod'
import { employeeCodeSchema } from '../attendance.schema.js'

// Shift-change requests (2026-11-16): an employee asks to change one day (another shift, or off) or to swap it with a
// colleague; it is approved through the approval service (2026-11-22).

export const createShiftChangeInput = z
  .object({
    date: z.date(),
    kind: z.enum(['CHANGE', 'SWAP']),
    // CHANGE: the shift asked for; null = off
    requestedShiftId: idSchema.nullable().optional(),
    // SWAP: the colleague's employee code
    swapWithCode: employeeCodeSchema.optional(),
    reason: z.string().trim().min(3, 'Give the reason').max(500),
  })
  .refine((v) => v.kind !== 'CHANGE' || v.requestedShiftId !== undefined, { message: 'Pick the shift (or off)', path: ['requestedShiftId'] })
  .refine((v) => v.kind !== 'SWAP' || !!v.swapWithCode, { message: 'Pick the colleague to swap with', path: ['swapWithCode'] })

export const shiftChangeIdInput = z.object({ id: idSchema })
