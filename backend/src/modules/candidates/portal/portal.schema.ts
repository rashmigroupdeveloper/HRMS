import { employeesSchemas } from '#modules/employees'
import { idSchema } from '#shared/schemas/common.schema'
import { z } from 'zod'
import { CANDIDATE_DOCUMENT_TYPES } from '../documents/documents.service.js'
import { joiningFormSchema } from '../joining-form/joining-form.schema.js'
import { codeSchema, tokenSchema } from '../offer-letters/offer-letters.schema.js'

// The candidate's own joining-form page. Signing in: the offer link + a one-time code e-mailed to them.

export const signInInput = z.object({ token: tokenSchema, code: codeSchema })

// Saved numbers are shown to the candidate only as their last 4 digits, so a number may be left out to keep the saved
// one (identity documents: by type; the bank account; a family member: by name + aadhaarLast4). The service puts the
// kept numbers back and validates the result with the joining form's own rules.
const keptIdentityDocument = employeesSchemas.keptIdentityDocumentSchema
const keptBankAccount = employeesSchemas.keptBankAccountSchema
const keptFamilyMember = employeesSchemas.keptFamilyMemberSchema

// Each section sent replaces that whole section (as candidates.joiningForm.save). `loadedAt`: when the page loaded the
// form - a section HR changed after that is not overwritten.
export const savePortalFormInput = joiningFormSchema
  .omit({ identityDocuments: true, bankAccount: true, familyMembers: true })
  .partial()
  .extend({
    identityDocuments: z.array(keptIdentityDocument).max(5).optional(),
    bankAccount: keptBankAccount.optional(),
    familyMembers: z.array(keptFamilyMember).max(15).optional(),
    loadedAt: z.date().optional(),
  })

const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024

export const uploadPortalDocumentInput = z.object({
  type: z.enum(CANDIDATE_DOCUMENT_TYPES),
  file: z.file().min(1, 'The file is empty').max(MAX_DOCUMENT_BYTES, 'The file must be 5 MB or smaller'),
})

export const portalDocumentIdInput = z.object({ id: idSchema })

// Submitting = signing online: the declaration ticked, the full name typed, and a fresh one-time code
export const submitPortalFormInput = z.object({
  code: codeSchema,
  name: z.string().trim().min(1, 'Type your full name').max(300),
  agreed: z.literal(true, 'Tick the declaration to sign the form'),
})
