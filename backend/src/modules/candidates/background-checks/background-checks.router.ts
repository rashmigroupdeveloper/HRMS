import { accessProcedure } from '#core/rpc/procedures'
import {
  backgroundCheckIdInput,
  createBackgroundCheckInput,
  listBackgroundChecksInput,
  updateBackgroundCheckInput,
} from './background-checks.schema.js'
import * as backgroundChecksService from './background-checks.service.js'

// candidates.backgroundChecks.* - routes + controller layer.
// Viewing: ONBOARDING READ; anything that changes data: ONBOARDING WRITE.
const viewProcedure = accessProcedure('ONBOARDING', 'READ')
const changeProcedure = accessProcedure('ONBOARDING', 'WRITE')

export const backgroundChecksRouter = {
  list: viewProcedure
    .input(listBackgroundChecksInput)
    .handler(({ input, context }) => backgroundChecksService.listBackgroundChecks(input.candidateId, context.user)),
  create: changeProcedure
    .input(createBackgroundCheckInput)
    .handler(({ input, context }) => backgroundChecksService.createBackgroundCheck(input, context.user)),
  update: changeProcedure
    .input(updateBackgroundCheckInput)
    .handler(({ input, context }) => backgroundChecksService.updateBackgroundCheck(input, context.user)),
  delete: changeProcedure
    .input(backgroundCheckIdInput)
    .handler(({ input, context }) => backgroundChecksService.deleteBackgroundCheck(input.id, context.user)),
}
