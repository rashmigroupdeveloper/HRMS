import { accessProcedure } from '#core/rpc/procedures'
import { removeChainInput, saveChainInput } from './chains.schema.js'
import * as chainsService from './chains.service.js'

// approvals.chains.* - routes + controller layer. Viewing: Approval chains View; changing: Approval chains Edit (all
// companies for a shared chain, the whole company for its own - checked in the service).
export const chainsRouter = {
  export: accessProcedure('APPROVAL_CHAINS','READ').handler(({context})=>chainsService.exportChains(context.user)),
  list: accessProcedure('APPROVAL_CHAINS', 'READ').handler(() => chainsService.listChains()),
  save: accessProcedure('APPROVAL_CHAINS', 'WRITE').input(saveChainInput).handler(({ input, context }) => chainsService.saveChain(context.user, input)),
  remove: accessProcedure('APPROVAL_CHAINS', 'WRITE').input(removeChainInput).handler(({ input, context }) => chainsService.removeChain(context.user, input)),
}
