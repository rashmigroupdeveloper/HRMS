import type { IncomingHttpHeaders } from 'node:http'
import { ORPCError, os } from '@orpc/server'
import type { ResponseHeadersPluginContext } from '@orpc/server/plugins'
import { setAuditActor } from '../audit/request.js'
import { assertAccess, type AccessMap } from '../auth/access.js'
import type { RoleGrant } from '../auth/scope.js'
import type { AccessArea, AccessLevel } from '../db/prisma.js'

// The logged-in employee, from the session cookie.
export type CurrentUser = {
  sessionId: number
  accountId: number
  employeeId: number
  employeeCode: string
  name: string
  roles: { id: number; name: string }[]
  isSuperAdmin: boolean
  // The level per area, from all of the employee's roles (read fresh on every request)
  access: AccessMap
  // Each role given to the employee with its data access - whose records it covers (core/auth/scope.ts, 2026-11-18)
  grants: RoleGrant[]
  // Signed in with a temporary password (new login / admin reset): only changing it is allowed until then
  mustChangePassword: boolean
  // Until when this session's password was re-entered (core/auth/confirm.ts) - null: not recently
  passwordConfirmedUntil: Date | null
}

// A candidate signed in to their joining-form page (offer link + one-time code), from the candidate cookie.
export type CurrentCandidate = { sessionId: number; candidateId: number }

// What every procedure receives as `context`.
export type Context = ResponseHeadersPluginContext & {
  headers: IncomingHttpHeaders
  // The caller's IP address (kept as proof when a candidate answers an offer online). Through a proxy on the same
  // machine (Vite in development, nginx / IIS) it is the browser's address - app.ts trusts a local proxy.
  clientIp: string | null
  // The logged-in user, or null. Looked up only when a procedure needs it, at most once per request
  // (provided by app.ts, so core does not depend on the accounts module).
  getCurrentUser: () => Promise<CurrentUser | null>
  // The signed-in candidate, or null - same idea (provided by app.ts from the candidates module)
  getCurrentCandidate: () => Promise<CurrentCandidate | null>
}

const base = os.$context<Context>()

// Anyone can call these - no login needed.
export const publicProcedure = base

// A candidate signed in to their own joining-form page (candidates.portal.*): the handler gets `context.candidate`
// and may only touch that candidate's data. Not an employee login - employees use the procedures below.
export const candidateProcedure = base.use(async ({ context, next }) => {
  const candidate = await context.getCurrentCandidate()
  if (!candidate) throw new ORPCError('UNAUTHORIZED', { message: 'Your session has ended. Please open the link from your e-mail again.' })
  // the candidate's own changes are "by" System (0), shown as "Candidate (online)"
  setAuditActor(0)
  return next({ context: { candidate } })
})

// Needs a session, even one with a temporary password. ONLY for accounts.me, accounts.logout and
// accounts.changePassword - everything else uses authedProcedure.
export const sessionProcedure = base.use(async ({ context, next }) => {
  const user = await context.getCurrentUser()
  if (!user) throw new ORPCError('UNAUTHORIZED', { message: 'Please log in' })
  // the change history records this employee as who made this call's changes
  setAuditActor(user.employeeId)
  return next({ context: { user } })
})

// Needs a logged-in employee whose password is not temporary; the handler gets `context.user`.
export const authedProcedure = sessionProcedure.use(({ context, next }) => {
  if (context.user.mustChangePassword) {
    throw new ORPCError('FORBIDDEN', { message: 'Change your temporary password first', data: { passwordChangeRequired: true } })
  }
  return next()
})

// Needs several areas at once - e.g. a part of an employee's record: its own area plus "Employee · Directory & job"
// (EMPLOYEES) View, the way into anyone else's profile (2026-11-16).
export function accessAllProcedure(...needs: [AccessArea, AccessLevel][]) {
  return authedProcedure.use(({ context, next }) => {
    for (const [area, level] of needs) assertAccess(context.user.access, area, level)
    return next()
  })
}

// Needs a logged-in employee whose roles give at least this level in this area.
// READ = view only, WRITE = view + change. Which roles have which level is data, set on the "Roles & access" page.
export function accessProcedure(area: AccessArea, level: AccessLevel) {
  return authedProcedure.use(({ context, next }) => {
    assertAccess(context.user.access, area, level)
    return next()
  })
}
