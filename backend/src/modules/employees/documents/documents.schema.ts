import { DocumentType } from '#core/db/prisma'
import { idSchema } from '#shared/schemas/common.schema'
import { z } from 'zod'
import { employeeCodeSchema } from '../employees.schema.js'

export const listEmployeeDocumentsInput = z.object({ employeeCode: employeeCodeSchema })

export const employeeDocumentIdInput = z.object({ id: idSchema })

const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024

// HR adds a document, or an employee submits one to their own record for HR review (2026-11-25). The file's
// real type (PDF / JPG / PNG) is checked from its content in the service.
export const uploadEmployeeDocumentInput = z.object({
  employeeCode: employeeCodeSchema,
  type: z.enum(DocumentType),
  file: z.file().min(1, 'The file is empty').max(MAX_DOCUMENT_BYTES, 'The file must be 5 MB or smaller'),
})

export const reviewEmployeeDocumentInput = z.object({
  id: idSchema,
  status: z.enum(['VERIFIED', 'REJECTED']),
  // required when REJECTED (checked in the service)
  rejectionReason: z.string().trim().min(1).max(500).optional(),
})

export const deleteEmployeeDocumentInput = z.object({
  id: idSchema,
  reason: z.string().trim().min(1, 'Give the reason for deleting the document').max(500),
})
