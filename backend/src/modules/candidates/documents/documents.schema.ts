import { DocumentType } from '#core/db/prisma'
import { idSchema } from '#shared/schemas/common.schema'
import { z } from 'zod'

const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024

export const listDocumentsInput = z.object({ candidateId: idSchema })

export const documentIdInput = z.object({ id: idSchema })

// Deleting keeps the document (hidden, can be restored) - the reason is required
export const deleteDocumentInput = z.object({
  id: idSchema,
  reason: z.string().trim().min(1, 'Give the reason for deleting the document').max(500),
})

// The file's real type (PDF / JPG / PNG) is checked from its content in the service, not from what the browser says.
export const uploadDocumentInput = z.object({
  candidateId: idSchema,
  type: z.enum(DocumentType),
  file: z.file().min(1, 'The file is empty').max(MAX_DOCUMENT_BYTES, 'The file must be 5 MB or smaller'),
})

export const reviewDocumentInput = z.object({
  id: idSchema,
  status: z.enum(['VERIFIED', 'REJECTED']),
  // Required when REJECTED (checked in the service) - tells the candidate what to fix
  rejectionReason: z.string().trim().min(1).max(500).optional(),
})
