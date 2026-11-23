import { accessProcedure } from '#core/rpc/procedures'
import { printFormsInput } from './printed-forms.schema.js'
import * as printedFormsService from './printed-forms.service.js'

// candidates.printedForms.* - routes + controller layer. Printing shows the full joining form: ONBOARDING READ (as
// candidates.joiningForm.get); the medical pages are filled only with MEDICAL READ.
const viewProcedure = accessProcedure('ONBOARDING', 'READ')

export const printedFormsRouter = {
  print: viewProcedure
    .input(printFormsInput)
    .handler(({ input, context }) => printedFormsService.printFormsFor(context.user, input.candidateId)),
}
