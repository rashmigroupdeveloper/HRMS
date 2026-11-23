import { accessProcedure } from '#core/rpc/procedures'
import { completeJoiningInput, joiningChecklistInput } from './joining.schema.js'
import * as joiningService from './joining.service.js'

// candidates.joining.* - routes + controller layer. Checklist: ONBOARDING READ; completing joining: ONBOARDING WRITE.
export const joiningRouter = {
  checklist: accessProcedure('ONBOARDING', 'READ')
    .input(joiningChecklistInput)
    .handler(({ input, context }) => joiningService.getChecklistFor(context.user, input.candidateId)),
  complete: accessProcedure('ONBOARDING', 'WRITE')
    .input(completeJoiningInput)
    .handler(({ input, context }) => joiningService.completeJoining(input, context.user)),
}
