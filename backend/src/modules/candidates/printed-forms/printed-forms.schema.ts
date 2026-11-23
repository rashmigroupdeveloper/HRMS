import { idSchema } from '#shared/schemas/common.schema'
import { z } from 'zod'

// The candidate whose joining forms are printed
export const printFormsInput = z.object({ candidateId: idSchema })
