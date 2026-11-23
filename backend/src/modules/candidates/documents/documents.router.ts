import { accessProcedure } from '#core/rpc/procedures'
import { deleteDocumentInput, documentIdInput, listDocumentsInput, reviewDocumentInput, uploadDocumentInput } from './documents.schema.js'
import * as documentsService from './documents.service.js'

// candidates.documents.* - routes + controller layer.
// Viewing: ONBOARDING READ; anything that changes data: ONBOARDING WRITE.
const viewProcedure = accessProcedure('ONBOARDING', 'READ')
const changeProcedure = accessProcedure('ONBOARDING', 'WRITE')

export const documentsRouter = {
  list: viewProcedure.input(listDocumentsInput).handler(({ input, context }) => documentsService.listDocuments(input.candidateId, context.user)),
  upload: changeProcedure.input(uploadDocumentInput).handler(({ input, context }) => documentsService.uploadDocumentFor(input, context.user)),
  download: viewProcedure.input(documentIdInput).handler(({ input, context }) => documentsService.downloadDocument(input.id, context.user)),
  review: changeProcedure.input(reviewDocumentInput).handler(({ input, context }) => documentsService.reviewDocument(input, context.user)),
  delete: changeProcedure.input(deleteDocumentInput).handler(({ input, context }) => documentsService.deleteDocument(input, context.user)),
  restore: changeProcedure.input(documentIdInput).handler(({ input, context }) => documentsService.restoreDocument(input.id, context.user)),
  // the compulsory documents per pack and what an offer may ask for (the offer form's checklist) - no personal data
  requirements: viewProcedure.handler(() => documentsService.documentRequirements()),
}
