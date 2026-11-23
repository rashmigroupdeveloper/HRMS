import { accessProcedure } from '#core/rpc/procedures'
import { getJoiningFormInput, saveJoiningFormInput, sendBackJoiningFormInput } from './joining-form.schema.js'
import * as joiningFormService from './joining-form.service.js'

// candidates.joiningForm.* - routes + controller layer (HR; the candidate fills it through candidates.portal.*).
// Viewing: ONBOARDING READ; anything that changes data: ONBOARDING WRITE.
const viewProcedure = accessProcedure('ONBOARDING', 'READ')
const changeProcedure = accessProcedure('ONBOARDING', 'WRITE')

export const joiningFormRouter = {
  // the medical information only with MEDICAL READ covering the candidate (to change it, MEDICAL WRITE - the service)
  get: viewProcedure.input(getJoiningFormInput).handler(({ input, context }) => joiningFormService.getJoiningFormFor(context.user, input.candidateId)),
  save: changeProcedure.input(saveJoiningFormInput).handler(({ input, context }) => joiningFormService.saveJoiningFormFor(context.user, input)),
  sendBack: changeProcedure
    .input(sendBackJoiningFormInput)
    .handler(({ input, context }) => joiningFormService.sendBackJoiningForm(input, context.user)),
}
