import { accessProcedure, authedProcedure, publicProcedure, sessionProcedure } from '#core/rpc/procedures'
import {
  accountCodeInput,
  changePasswordInput,
  confirmPasswordInput,
  disableLoginInput,
  loginInput,
  requestPasswordResetInput,
  resetPasswordWithCodeInput,
  sessionIdInput,
  setRolesInput,
} from './accounts.schema.js'
import * as accountsService from './accounts.service.js'
import { rolesRouter } from './roles/roles.router.js'
import { securityRouter } from './security/security.router.js'

// accounts.* - log in / out, who is logged in, and who has which role. Routes + controller layer.
export const accountsRouter = {
  login: publicProcedure
    .input(loginInput)
    .handler(({ input, context }) =>
      accountsService.login(input, context.resHeaders, { ip: context.clientIp, userAgent: context.headers['user-agent'] ?? null }),
    ),
  // These three also work with a temporary password (sessionProcedure); everything else needs it changed first.
  // "Forgot password" on the sign-in page (not logged in - approved 2026-11-15): a code to the personal e-mail, then
  // a new password with it
  requestPasswordReset: publicProcedure
    .input(requestPasswordResetInput)
    .handler(({ input, context }) => accountsService.requestPasswordReset(input, context.clientIp)),
  resetPasswordWithCode: publicProcedure
    .input(resetPasswordWithCodeInput)
    .handler(({ input, context }) => accountsService.resetPasswordWithCode(input, context.clientIp)),
  logout: sessionProcedure.handler(({ context }) => accountsService.logout(context.user, context.resHeaders)),
  me: sessionProcedure.handler(({ context }) => accountsService.me(context.user)),
  changePassword: sessionProcedure
    .input(changePasswordInput)
    .handler(({ input, context }) => accountsService.changePassword(context.user, input, context.clientIp)),
  // Logins of other employees (Roles & access: Edit)
  create: accessProcedure('ACCESS', 'WRITE').input(accountCodeInput).handler(({ input, context }) => accountsService.createLogin(context.user, input)),
  resetPassword: accessProcedure('ACCESS', 'WRITE')
    .input(accountCodeInput)
    .handler(({ input, context }) => accountsService.resetPassword(context.user, input)),
  unlock: accessProcedure('ACCESS', 'WRITE').input(accountCodeInput).handler(({ input, context }) => accountsService.unlockLogin(context.user, input)),
  // Turn someone's login off (e.g. a suspension) / back on
  disable: accessProcedure('ACCESS', 'WRITE')
    .input(disableLoginInput)
    .handler(({ input, context }) => accountsService.disableLogin(context.user, input)),
  enable: accessProcedure('ACCESS', 'WRITE').input(accountCodeInput).handler(({ input, context }) => accountsService.enableLogin(context.user, input)),
  // Re-enter one's own password before changing roles (valid 10 minutes)
  confirmPassword: authedProcedure
    .input(confirmPasswordInput)
    .handler(({ input, context }) => accountsService.confirmPassword(context.user, input, context.clientIp)),
  // Where people are signed in
  sessions: {
    // everyone's (Roles & access: View)
    list: accessProcedure('ACCESS', 'READ').handler(({ context }) => accountsService.listAllSessions(context.user)),
    // one's own
    mine: authedProcedure.handler(({ context }) => accountsService.listMySessions(context.user)),
    // log one session out: one's own other device, or anyone's with Roles & access: Edit (checked in the service)
    end: authedProcedure.input(sessionIdInput).handler(({ input, context }) => accountsService.endSession(context.user, input)),
    // log someone out everywhere (for oneself: every other device)
    endAll: accessProcedure('ACCESS', 'WRITE')
      .input(accountCodeInput)
      .handler(({ input, context }) => accountsService.endAllSessions(context.user, input)),
  },
  list: accessProcedure('ACCESS', 'READ').handler(({ context }) => accountsService.listAccounts(context.user)),
  setRoles: accessProcedure('ACCESS', 'WRITE')
    .input(setRolesInput)
    .handler(({ input, context }) => accountsService.setAccountRoles(input, context.user)),
  roles: rolesRouter,
  // the security rules (lockout, sign-in length, password rules) - Roles & access page
  security: securityRouter,
}
