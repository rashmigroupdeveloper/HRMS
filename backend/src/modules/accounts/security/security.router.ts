import { accessProcedure } from '#core/rpc/procedures'
import { updateSecurityRulesInput } from './security.schema.js'
import * as securityService from './security.service.js'

// accounts.security.* - routes + controller layer. Viewing: ACCESS READ; changing: ACCESS WRITE (+ the password
// re-entered, checked in the service). The password rule reaches the password pages with accounts.me and
// accounts.requestPasswordReset (no API of its own - public APIs are a fixed list, CLAUDE.md section 4).
export const securityRouter = {
  get: accessProcedure('ACCESS', 'READ').handler(() => securityService.getSecurityRules()),
  update: accessProcedure('ACCESS', 'WRITE')
    .input(updateSecurityRulesInput)
    .handler(({ input, context }) => securityService.updateSecurityRules(input, context.user)),
}
