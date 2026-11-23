import { accessProcedure, publicProcedure } from '#core/rpc/procedures'
import { candidateIdInput } from '../candidates.schema.js'
import { acceptOnlineInput, declineOnlineInput, offerLetterIdInput, offerTemplateInput, offerTemplatesInput, tokenInput } from './offer-letters.schema.js'
import * as offerLettersService from './offer-letters.service.js'

// candidates.offerLetters.* - for HR. Viewing: ONBOARDING READ; a new link: ONBOARDING WRITE.
// (Sending the offer and accepting it on paper are candidates.send / candidates.accept.)
const viewProcedure = accessProcedure('ONBOARDING', 'READ')
const changeProcedure = accessProcedure('ONBOARDING', 'WRITE')

export const offerLettersRouter = {
  // the templates HR can pick for this offer or Letter of Intent (+ the one to pre-select)
  templates: viewProcedure.input(offerTemplatesInput).handler(({ input, context }) => offerLettersService.listTemplatesForOffer(input.id, input.kind, context.user)),
  preview: viewProcedure.input(offerTemplateInput).handler(({ input, context }) => offerLettersService.previewOfferLetter(input.id, input.templateId, context.user)),
  list: viewProcedure.input(candidateIdInput).handler(({ input, context }) => offerLettersService.listOfferLetters(input.id, context.user)),
  download: viewProcedure.input(offerLetterIdInput).handler(({ input, context }) => offerLettersService.downloadOfferLetter(input.id, context.user)),
  newLink: changeProcedure.input(candidateIdInput).handler(({ input, context }) => offerLettersService.newLink(input.id, context.user)),
}

// candidates.offerResponse.* - the candidate's page. PUBLIC (no login): the secret link token is the key, and
// accepting / declining also needs the one-time code e-mailed to the candidate (approved 2026-11-12).
export const offerResponseRouter = {
  view: publicProcedure.input(tokenInput).handler(({ input }) => offerLettersService.viewByToken(input.token)),
  download: publicProcedure.input(tokenInput).handler(({ input }) => offerLettersService.downloadByToken(input.token)),
  sendCode: publicProcedure.input(tokenInput).handler(({ input }) => offerLettersService.sendCode(input.token)),
  accept: publicProcedure
    .input(acceptOnlineInput)
    .handler(({ input, context }) => offerLettersService.acceptOnline(input, { ip: context.clientIp, userAgent: context.headers['user-agent'] ?? null })),
  decline: publicProcedure
    .input(declineOnlineInput)
    .handler(({ input, context }) => offerLettersService.declineOnline(input, { ip: context.clientIp, userAgent: context.headers['user-agent'] ?? null })),
}
