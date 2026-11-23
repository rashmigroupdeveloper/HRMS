import { accessProcedure } from '#core/rpc/procedures'
import {
  candidateIdInput,
  closeCandidateInput,
  createCandidateInput,
  listCandidatesInput,
  recordMedicalInput,
  updateCandidateInput,
} from './candidates.schema.js'
import * as candidatesService from './candidates.service.js'
import { backgroundChecksRouter } from './background-checks/background-checks.router.js'
import { documentsRouter } from './documents/documents.router.js'
import { joiningFormRouter } from './joining-form/joining-form.router.js'
import { joiningRouter } from './joining/joining.router.js'
import { offerLettersRouter, offerResponseRouter } from './offer-letters/offer-letters.router.js'
import { offerTemplateInput } from './offer-letters/offer-letters.schema.js'
import * as offerLettersService from './offer-letters/offer-letters.service.js'
import { portalRouter } from './portal/portal.router.js'
import { printedFormsRouter } from './printed-forms/printed-forms.router.js'

// Routes + controller layer: input validation -> service -> result. No business logic here.
// Viewing: ONBOARDING READ; anything that changes data: ONBOARDING WRITE.
const viewProcedure = accessProcedure('ONBOARDING', 'READ')
const changeProcedure = accessProcedure('ONBOARDING', 'WRITE')

export const candidatesRouter = {
  list: viewProcedure.input(listCandidatesInput).handler(({ input, context }) => candidatesService.listCandidates(input, context.user)),
  // The offers and candidates (same filters as list) as an Excel file - the "Offers & candidates" report
  export: viewProcedure.input(listCandidatesInput).handler(({ input, context }) => candidatesService.exportCandidates(input, context.user)),
  get: viewProcedure.input(candidateIdInput).handler(({ input, context }) => candidatesService.getCandidateDetails(input.id, context.user)),
  create: changeProcedure.input(createCandidateInput).handler(({ input, context }) => candidatesService.createCandidate(input, context.user)),
  update: changeProcedure.input(updateCandidateInput).handler(({ input, context }) => candidatesService.updateCandidate(input, context.user)),
  // writes the offer letter from the template HR picked, gives the offer number, e-mails the letter + the candidate's link
  send: changeProcedure
    .input(offerTemplateInput)
    .handler(({ input, context }) => offerLettersService.sendOffer(input.id, input.templateId, context.user)),
  // accepted on paper - needs the signed copy uploaded (online acceptance: offerResponse.accept)
  accept: changeProcedure.input(candidateIdInput).handler(({ input, context }) => offerLettersService.acceptOnPaper(input.id, context.user)),
  close: changeProcedure.input(closeCandidateInput).handler(({ input, context }) => candidatesService.closeCandidateFor(input, context.user)),
  offerLetters: offerLettersRouter,
  // the candidate's own page (public, secret link)
  offerResponse: offerResponseRouter,
  // the candidate's own joining-form page (offer link + one-time code -> candidate session)
  portal: portalRouter,
  // pre-joining (after acceptance)
  recordMedical: changeProcedure.input(recordMedicalInput).handler(({ input, context }) => candidatesService.recordMedical(input, context.user)),
  confirmJoining: changeProcedure.input(candidateIdInput).handler(({ input, context }) => candidatesService.confirmJoining(input.id, context.user)),
  joiningForm: joiningFormRouter,
  // HR's paper forms (joining form, Form F, ESIC Form 1, EPF Form 11, medical pages) printed filled in, to be signed
  printedForms: printedFormsRouter,
  documents: documentsRouter,
  backgroundChecks: backgroundChecksRouter,
  // joining day: candidate -> employee
  joining: joiningRouter,
}
