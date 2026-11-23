import { idSchema, nameSchema } from '#shared/schemas/common.schema'
import { z } from 'zod'

export const offerLetterIdInput = z.object({ id: idSchema })

// Sending / previewing an offer letter: the candidate (`id`) and the letter template HR picked
export const offerTemplateInput = z.object({ id: idSchema, templateId: idSchema })

// The templates to pick from for this candidate: the full offer (default) or the Letter of Intent (2026-11-16)
export const offerTemplatesInput = z.object({ id: idSchema, kind: z.enum(['OFFER_LETTER', 'LETTER_OF_INTENT']).optional() })

// --- The candidate's page (public, no login): the secret link token is the only key ---

// 32 random bytes, base64url (43 characters)
export const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/, 'This link is not valid')
// The 6-digit one-time code e-mailed to the candidate
export const codeSchema = z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code from the e-mail')

export const tokenInput = z.object({ token: tokenSchema })

export const acceptOnlineInput = z.object({
  token: tokenSchema,
  code: codeSchema,
  // The candidate types their full name as it is on the letter - their electronic acceptance
  name: z.string().trim().min(1, 'Type your full name').max(300),
})

export const declineOnlineInput = z.object({
  token: tokenSchema,
  code: codeSchema,
  // Optional: why - drop-out analysis
  reason: nameSchema.max(500).optional(),
})
