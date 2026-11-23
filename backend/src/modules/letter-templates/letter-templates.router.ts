import { accessProcedure } from '#core/rpc/procedures'
import {
  createTemplateInput,
  letterheadImageInput,
  listLetterheadImagesInput,
  previewTemplateInput,
  setTemplateImageInput,
  templateIdInput,
  updateTemplateInput,
  uploadTemplateImageInput,
} from './letter-templates.schema.js'
import * as letterTemplatesService from './letter-templates.service.js'

// Routes + controller layer: input validation -> service -> result. No business logic here.
// Viewing (and previewing): LETTER_TEMPLATES READ; changing the wording: LETTER_TEMPLATES WRITE.
// Writing a letter from a template (sending an offer) needs no access here - the offer API checks ONBOARDING.
const viewProcedure = accessProcedure('LETTER_TEMPLATES', 'READ')
const changeProcedure = accessProcedure('LETTER_TEMPLATES', 'WRITE')

export const letterTemplatesRouter = {
  list: viewProcedure.handler(() => letterTemplatesService.listTemplates()),
  // the kinds of letter (offer, Letter of Intent, appointment...) with the fields and blocks of each - for a new template
  kinds: viewProcedure.handler(() => letterTemplatesService.listKinds()),
  get: viewProcedure.input(templateIdInput).handler(({ input }) => letterTemplatesService.getTemplate(input.id)),
  create: changeProcedure.input(createTemplateInput).handler(({ input, context }) => letterTemplatesService.createTemplateFor(context.user, input)),
  update: changeProcedure.input(updateTemplateInput).handler(({ input, context }) => letterTemplatesService.updateTemplateFor(context.user, input)),
  preview: viewProcedure.input(previewTemplateInput).handler(({ input }) => letterTemplatesService.previewTemplate(input)),
  // letterhead images: upload a new one for a template, or pick one already uploaded (kept, never erased)
  uploadImage: changeProcedure.input(uploadTemplateImageInput).handler(({ input, context }) => letterTemplatesService.uploadImageFor(context.user, input)),
  setImage: changeProcedure.input(setTemplateImageInput).handler(({ input, context }) => letterTemplatesService.setImageFor(context.user, input)),
  images: viewProcedure.input(listLetterheadImagesInput).handler(({ input }) => letterTemplatesService.listImages(input)),
  image: viewProcedure.input(letterheadImageInput).handler(({ input }) => letterTemplatesService.getImage(input)),
}
