import { JoiningType, LetterKind } from '#core/db/prisma'
import { letterFontSize, LETTER_FONTS, type LetterNode } from '#core/pdf/letter-pdf'
import { idSchema } from '#shared/schemas/common.schema'
import { z } from 'zod'

const templateNameSchema = z.string().trim().min(1, 'Name is required').max(100)

// The letter as the editor saves it (TipTap JSON): only the nodes and marks the letter writer knows
// (core/pdf/letter-pdf.ts); anything else is refused. Extra keys TipTap adds are dropped.
const NODE_TYPES = [
  'doc',
  'paragraph',
  'text',
  'hardBreak',
  'orderedList',
  'bulletList',
  'listItem',
  'splitLine',
  'pageBreak',
  'field',
  'letterBlock',
] as const

const letterNodeSchema: z.ZodType<LetterNode> = z.lazy(() =>
  z.object({
    type: z.enum(NODE_TYPES),
    attrs: z.record(z.string(), z.unknown()).nullable().optional(),
    content: z.array(letterNodeSchema).max(5000).optional(),
    text: z.string().max(20_000).optional(),
    marks: z
      .array(
        z.object({
          type: z.enum(['bold', 'italic', 'underline', 'textStyle']),
          // textStyle: the font and size of the text (empty = the default Roboto 10 pt)
          attrs: z
            .object({
              fontFamily: z
                .enum(Object.keys(LETTER_FONTS) as [keyof typeof LETTER_FONTS])
                .nullable()
                .optional(),
              fontSize: z
                .string()
                .refine((size) => letterFontSize(size) !== undefined, 'Font size: 1 - 400 pt, at most one decimal (e.g. 10.7pt)')
                .nullable()
                .optional(),
            })
            .nullable()
            .optional(),
        }),
      )
      .max(4)
      .optional(),
  }),
)

const letterDocumentSchema = letterNodeSchema.refine(
  (doc) => doc.type === 'doc' && (doc.content ?? []).some((n) => (n.content ?? []).length > 0 || n.type === 'letterBlock'),
  'The letter text is empty',
)

export const templateIdInput = z.object({ id: idSchema })

// The three letterhead images of a template
export const TEMPLATE_IMAGE_PARTS = ['HEADER', 'FOOTER', 'SIGNATURE'] as const

const MAX_IMAGE_BYTES = 2 * 1024 * 1024

export const templateImageInput = z.object({ id: idSchema, part: z.enum(TEMPLATE_IMAGE_PARTS) })

// Letterhead images already uploaded, picked by id (e.g. for a new template); each must be of its part
export const templateImageIdsSchema = z.object({ header: idSchema.optional(), footer: idSchema.optional(), signature: idSchema.optional() })

// One uploaded letterhead image (a thumbnail when picking, or the template page)
export const letterheadImageInput = z.object({ imageId: idSchema })

// The uploaded images of one part, to pick from
export const listLetterheadImagesInput = z.object({ part: z.enum(TEMPLATE_IMAGE_PARTS) })

// Use an image already uploaded as the template's header / footer / stamp + signature
export const setTemplateImageInput = templateImageInput.extend({ imageId: idSchema })

// PNG or JPEG - checked from the file's content in the service
export const uploadTemplateImageInput = templateImageInput.extend({
  file: z.file().min(1, 'The file is empty').max(MAX_IMAGE_BYTES, 'The image must be 2 MB or smaller'),
})

export const createTemplateInput = z.object({
  kind: z.enum(LetterKind),
  // none = for every joining type without a template of its own
  joiningType: z.enum(JoiningType).optional(),
  name: templateNameSchema,
  body: letterDocumentSchema,
  // letterhead images picked from the ones already uploaded (more can be uploaded once it is created)
  imageIds: templateImageIdsSchema.optional(),
})

// Only the fields sent change; `joiningType: null` makes it the template for every joining type
export const updateTemplateInput = z.object({
  id: idSchema,
  joiningType: z.enum(JoiningType).nullable().optional(),
  name: templateNameSchema.optional(),
  body: letterDocumentSchema.optional(),
  isActive: z.boolean().optional(),
})

// A PDF of the given (possibly unsaved) letter filled with example values; with the letterhead of template `id` if
// given (the template being edited)
export const previewTemplateInput = z.object({
  kind: z.enum(LetterKind),
  body: letterDocumentSchema,
  id: idSchema.optional(),
  // a template not created yet: the letterhead images picked for it
  imageIds: templateImageIdsSchema.optional(),
})
