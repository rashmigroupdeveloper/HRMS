import { accessProcedure, authedProcedure } from '#core/rpc/procedures'
import { approvalIdInput, cancelApprovalInput, decideApprovalInput } from './approvals.schema.js'
import * as approvalsService from './approvals.service.js'
import { chainsRouter } from './chains/chains.router.js'

// approvals.* - routes + controller layer. Any logged-in employee sees what waits for them and what they raised; whether
// they may see, decide or cancel a request is checked in the service (it depends on the request). Held requests:
// Approval chains Edit (covering the employee - in the service).
export const approvalsRouter = {
  listToDecide: authedProcedure.handler(({ context }) => approvalsService.listToDecide(context.user)),
  countToDecide: authedProcedure.handler(({ context }) => approvalsService.countToDecide(context.user)),
  listMine: authedProcedure.handler(({ context }) => approvalsService.listMine(context.user)),
  listDecided: authedProcedure.handler(({ context }) => approvalsService.listDecided(context.user)),
  get: authedProcedure.input(approvalIdInput).handler(({ input, context }) => approvalsService.getRequest(context.user, input.id)),
  decide: authedProcedure.input(decideApprovalInput).handler(({ input, context }) => approvalsService.decide(context.user, input)),
  cancel: authedProcedure.input(cancelApprovalInput).handler(({ input, context }) => approvalsService.cancel(context.user, input)),
  listHeld: accessProcedure('APPROVAL_CHAINS', 'WRITE').handler(({ context }) => approvalsService.listHeld(context.user)),
  retryRouting: accessProcedure('APPROVAL_CHAINS', 'WRITE').input(approvalIdInput).handler(({ input, context }) => approvalsService.retryRouting(context.user, input.id)),
  chains: chainsRouter,
}
