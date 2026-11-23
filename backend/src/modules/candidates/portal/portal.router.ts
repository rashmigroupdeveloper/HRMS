import { candidateProcedure, publicProcedure } from '#core/rpc/procedures'
import { portalDocumentIdInput, savePortalFormInput, signInInput, submitPortalFormInput, uploadPortalDocumentInput } from './portal.schema.js'
import * as portalService from './portal.service.js'

// candidates.portal.* - the candidate's own joining-form page (no employee login).
// signIn is PUBLIC (the offer link + a one-time code, like offerResponse.*); everything else needs the candidate
// session it starts (candidateProcedure) and works only on that candidate (approved 2026-11-13).
// The code itself is asked for with candidates.offerResponse.sendCode.
export const portalRouter = {
  signIn: publicProcedure.input(signInInput).handler(({ input, context }) => portalService.signIn(input, context.resHeaders)),
  me: candidateProcedure.handler(({ context }) => portalService.getPortal(context.candidate.candidateId)),
  save: candidateProcedure.input(savePortalFormInput).handler(({ input, context }) => portalService.saveForm(context.candidate.candidateId, input)),
  uploadDocument: candidateProcedure
    .input(uploadPortalDocumentInput)
    .handler(({ input, context }) => portalService.uploadDocument(context.candidate.candidateId, input)),
  removeDocument: candidateProcedure
    .input(portalDocumentIdInput)
    .handler(({ input, context }) => portalService.removeDocument(context.candidate.candidateId, input.id)),
  document: candidateProcedure
    .input(portalDocumentIdInput)
    .handler(({ input, context }) => portalService.downloadDocument(context.candidate.candidateId, input.id)),
  submit: candidateProcedure
    .input(submitPortalFormInput)
    .handler(({ input, context }) =>
      portalService.submit(context.candidate.candidateId, input, { ip: context.clientIp, userAgent: context.headers['user-agent'] ?? null }),
    ),
  signOut: candidateProcedure.handler(({ context }) => portalService.signOut(context.candidate, context.resHeaders)),
}
