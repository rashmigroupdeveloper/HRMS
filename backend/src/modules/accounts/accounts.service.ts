import { writeReport } from '#core/excel/report'
import { ACCESS_AREAS, assertAccess, hasAccess, higherLevel, type AccessMap } from '#core/auth/access'
import { assertPasswordConfirmed } from '#core/auth/confirm'
import { ALL_OF_GROUP, beyondGiver, hasLevelAt, levelOver, type Placement, type RoleGrant, scopeAllows, scopeOf, type ScopeRow, type Slice, sliceContains, sliceCovers } from '#core/auth/scope'
import { countAccountTry, countPasswordTry } from '#core/auth/rate-limit'
import { generatePassword, hashPassword, verifyPassword } from '#core/auth/password'
import { clearSessionCookie, hashSessionToken, newSessionToken, readSessionToken, writeSessionCookie } from '#core/auth/session'
import { env } from '#core/config/env'
import { prisma, SYSTEM_ACTOR, type AccessArea, type AccessLevel, type DbClient, type EmployeeStatus } from '#core/db/prisma'
import { sendMail } from '#core/mail/mailer'
import type { CurrentUser } from '#core/rpc/procedures'
import { employeesService, hodsService } from '#modules/employees'
import { plantsService } from '#modules/organization'
import { today } from '#shared/utils/dates'
import { ORPCError } from '@orpc/server'
import { AsyncLocalStorage } from 'node:async_hooks'
import { createHash, randomInt, timingSafeEqual } from 'node:crypto'
import type { IncomingHttpHeaders } from 'node:http'
import type { z } from 'zod'
import * as accountsRepository from './accounts.repository.js'
import * as securityService from './security/security.service.js'
import type {
  confirmPasswordInput,
  disableLoginInput,
  sessionIdInput,
  accountCodeInput,
  changePasswordInput,
  loginInput,
  requestPasswordResetInput,
  resetPasswordWithCodeInput,
  setRolesInput,
} from './accounts.schema.js'
import * as rolesService from './roles/roles.service.js'

// Logins, sessions, and which roles each login has. Who may do what is NOT written here: roles are data
// (accounts.roles.*), and each API checks an area + level with accessProcedure (core/rpc/procedures.ts).

// The security rules (lockout, how long a sign-in lasts, password length and history, code and re-entered-password
// minutes) can be changed on the Roles & access page - security/security.service.ts (2026-11-16)
// old HRMS rules (2026-11-16): 10+ characters, and not one of the last 5 passwords (the one in use + 4 earlier ones)
// a session's "last used" is written at most this often
const TOUCH_SECONDS = 60
// Exited employees cannot log in
const CAN_LOG_IN: readonly EmployeeStatus[] = ['ACTIVE', 'ON_NOTICE']
// Same message for an unknown code and a wrong password, so codes cannot be discovered by guessing
const INVALID_LOGIN = 'Invalid employee code / e-mail or password'
// Lockout: maxFailedLogins wrong passwords in a row lock the login for lockMinutes (an admin can unlock it earlier)

function lockedMessage(lockedUntil: Date) {
  const minutes = Math.max(1, Math.ceil((lockedUntil.getTime() - Date.now()) / 60_000))
  return `Too many wrong passwords - this login is locked. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}, or ask an admin to unlock it.`
}

// Checked against when the employee code is unknown, so that takes as long as a wrong password
let dummyHash: Promise<string> | undefined

type AccountRoles = {
  roles: {
    role: { id: number; name: string; isSuperAdmin: boolean; isApprovalFallback: boolean; permissions: { area: AccessArea; level: AccessLevel }[] }
    scopes: ScopeRow[]
  }[]
}

// A role given to someone as the rule engine sees it: its level per area and its data-access rows (a Super Admin role
// covers the whole group whatever its rows)
function grantOf({ role, scopes }: AccountRoles['roles'][number]): RoleGrant {
  return {
    access: rolesService.accessOf(role),
    rows: role.isSuperAdmin
      ? [{ ...ALL_OF_GROUP, level: 'WRITE' }]
      : scopes.map(({ companyId, plantId, departmentId, level }) => ({ companyId, plantId, departmentId, level })),
  }
}

// Where an employee is, for data-access checks
const placementOf = (employee: { companyId: number; plantId: number; departmentId: number | null }): Placement => ({
  companyId: employee.companyId,
  plantId: employee.plantId,
  departmentId: employee.departmentId,
})

function fullName(employee: { firstName: string; middleName: string | null; lastName: string | null }) {
  return [employee.firstName, employee.middleName, employee.lastName].filter(Boolean).join(' ')
}

// The roles of a login and the access they add up to: per area, the highest level any role gives
function accessFromRoles(account: AccountRoles): Pick<CurrentUser, 'roles' | 'isSuperAdmin' | 'access' | 'grants'> {
  const roles = account.roles.map((r) => r.role)
  const perRole = roles.map(rolesService.accessOf)
  const access: AccessMap = {}
  for (const area of ACCESS_AREAS) {
    const level = perRole.reduce<AccessLevel | undefined>((best, a) => higherLevel(best, a[area]), undefined)
    if (level) access[area] = level
  }
  return {
    roles: roles.map((r) => ({ id: r.id, name: r.name })),
    isSuperAdmin: roles.some((r) => r.isSuperAdmin),
    access,
    grants: account.roles.map(grantOf),
  }
}

// A role selection can only narrow an authenticated account's existing grants. No selection = Employee self-service
// (no role at all - the user, 2026-11-25: everyone signs in to the employee portal and picks a role to open the role
// portal). Unknown / revoked selections have no role permissions either, so a stale tab never silently regains another
// role's privileges.
function selectActiveRole(account: AccountRoles, selection?: string) {
  const assigned = [...account.roles].sort((a, b) => a.role.id - b.role.id)
  const selected = selection === undefined || selection === '' ? undefined : assigned.find((given) => String(given.role.id) === selection)
  return {
    ...accessFromRoles({ roles: selected ? [selected] : [] }),
    availableRoles: assigned.map(({ role }) => ({ id: role.id, name: role.name })),
    activeRoleId: selected?.role.id ?? null,
    activeRoleIsFallback: selected?.role.isApprovalFallback ?? false,
  }
}

// What the frontend gets about the logged-in employee. Pages and menus are shown from `access`.
async function toMe(
  user: Pick<CurrentUser, 'employeeId' | 'employeeCode' | 'name' | 'roles' | 'isSuperAdmin' | 'access' | 'grants' | 'mustChangePassword' | 'passwordConfirmedUntil' | 'availableRoles' | 'activeRoleId'>,
) {
  return {
    // what the password pages say a new password needs (security rules)
    passwordRule: await securityService.passwordRule(),
    employeeCode: user.employeeCode,
    name: user.name,
    roles: user.availableRoles.map((r) => r.name),
    availableRoles: user.availableRoles,
    activeRoleId: user.activeRoleId ?? null,
    isSuperAdmin: user.isSuperAdmin,
    access: user.access,
    // whose records each area covers, to view (READ) and to change (WRITE): 'ALL' or slices of the group (null = every
    // company / plant / department) - forms offer only what may be chosen; the backend checks it on every call
    dataAccess: Object.fromEntries(
      (Object.keys(user.access) as AccessArea[]).map((area) => [area, { READ: scopeOf(user, area, 'READ').slices, WRITE: scopeOf(user, area, 'WRITE').slices }]),
    ) as Partial<Record<AccessArea, { READ: ReturnType<typeof scopeOf>['slices']; WRITE: ReturnType<typeof scopeOf>['slices'] }>>,
    // how many HOD posts the employee holds now (0: no "My department" page - BACKLOG 3e)
    hodPosts: await hodsService.countHeldPosts(user.employeeId),
    // true = signed in with a temporary password; the frontend sends them to "Change password" first
    mustChangePassword: user.mustChangePassword,
    // until when the password counts as re-entered (changing roles asks for it again after that)
    passwordConfirmedUntil: user.passwordConfirmedUntil,
  }
}

// A wrong password (signing in or re-entering it): counted; at maxFailedLogins the login locks for lockMinutes and the count
// starts again. Recorded as System: a wrong password may not be the employee at all.
async function recordWrongPassword(accountId: number) {
  const rules = await securityService.getRules()
  const failed = await accountsRepository.addLoginFailure(accountId, SYSTEM_ACTOR)
  const lockedUntil = failed >= rules.maxFailedLogins ? new Date(Date.now() + rules.lockMinutes * 60_000) : null
  if (lockedUntil) await accountsRepository.setLoginFailures(accountId, { failedLoginCount: 0, lockedUntil }, SYSTEM_ACTOR)
  return { failed, lockedUntil, rules }
}

// Checks the employee code or work e-mail + password, starts a session and sets its cookie.
// maxFailedLogins wrong passwords in a row lock the login for lockMinutes (security rules); a correct password resets
// the count.
// `client`: where the sign-in comes from (shown in the Sessions lists).
export async function login(
  { login: loginName, password }: z.infer<typeof loginInput>,
  resHeaders: Headers | undefined,
  client: { ip: string | null; userAgent: string | null },
) {
  countPasswordTry('signIn', loginName, client.ip)
  const employee = await employeesService.findSummaryByLogin(loginName)
  const account = employee ? await accountsRepository.findLoginByEmployeeId(employee.id) : null
  // a failed sign-in goes into the change history as System - it may not be the employee at all
  const failedSignIn = (reason: string) =>
    accountsRepository.recordSignInEvent({ action: 'SIGN_IN_FAILED', actorId: SYSTEM_ACTOR, employeeId: employee?.id ?? null, details: { login: loginName, reason } })
  if (account?.lockedUntil && account.lockedUntil > new Date()) {
    await failedSignIn('Login locked')
    throw new ORPCError('UNAUTHORIZED', { message: lockedMessage(account.lockedUntil) })
  }
  // the employee code, the work e-mail and former codes reach the same login: its own count of tries too (2026-11-23)
  if (account) countAccountTry('signIn', account.id)
  const passwordOk = await verifyPassword(password, account?.passwordHash ?? (await (dummyHash ??= hashPassword('-'))))
  if (!employee || !account || !CAN_LOG_IN.includes(employee.status)) {
    await failedSignIn(!employee ? 'No such employee code / e-mail' : !account ? 'No login' : `Employee is ${employee.status}`)
    throw new ORPCError('UNAUTHORIZED', { message: INVALID_LOGIN })
  }
  if (!passwordOk) {
    const { lockedUntil } = await recordWrongPassword(account.id)
    await failedSignIn(lockedUntil ? 'Wrong password - login locked' : 'Wrong password')
    throw new ORPCError('UNAUTHORIZED', { message: lockedUntil ? lockedMessage(lockedUntil) : INVALID_LOGIN })
  }
  // a login turned off: said only after the right password, so it tells a stranger nothing
  if (account.disabledAt) {
    await failedSignIn('Login turned off')
    throw new ORPCError('UNAUTHORIZED', { message: 'This login is turned off - ask HR' })
  }
  if (account.failedLoginCount > 0 || account.lockedUntil) {
    await accountsRepository.setLoginFailures(account.id, { failedLoginCount: 0, lockedUntil: null }, employee.id)
  }

  await accountsRepository.deleteSessions(account.id, { onlyExpired: true })
  const token = newSessionToken()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + (await securityService.getRules()).sessionHours * 60 * 60 * 1000)
  await accountsRepository.createSession(
    { accountId: account.id, tokenHash: hashSessionToken(token), expiresAt, ip: client.ip, userAgent: client.userAgent?.slice(0, 300) ?? null },
    employee.id,
  )
  await accountsRepository.setLastLogin(account.id, now)
  writeSessionCookie(resHeaders, token, expiresAt)
  await accountsRepository.recordSignInEvent({ action: 'SIGN_IN', actorId: employee.id, employeeId: employee.id })
  return toMe({
    employeeId: employee.id,
    employeeCode: employee.employeeCode,
    name: fullName(employee),
    mustChangePassword: account.mustChangePassword,
    passwordConfirmedUntil: null,
    ...selectActiveRole(account),
  })
}

// Ends this session and removes the cookie.
export async function logout(user: CurrentUser, resHeaders: Headers | undefined) {
  await accountsRepository.deleteSession(user.sessionId)
  await accountsRepository.recordSignInEvent({ action: 'SIGN_OUT', actorId: user.employeeId, employeeId: user.employeeId })
  clearSessionCookie(resHeaders)
  return { loggedOut: true }
}

export function me(user: CurrentUser) {
  return toMe(user)
}

// How many earlier passwords are kept besides the one in use (the rules count the one in use too)
async function earlierPasswordsKept() {
  return Math.max(0, (await securityService.getRules()).passwordHistory - 1)
}

// The logged-in user of a request, or null: no / unknown / expired session, or the employee may no longer log in.
// Roles are read on every request, so a role change applies at once. Passed to the RPC handler by app.ts.
export async function resolveUser(headers: IncomingHttpHeaders): Promise<CurrentUser | null> {
  const token = readSessionToken(headers)
  if (!token) return null
  const session = await accountsRepository.findSessionByTokenHash(hashSessionToken(token))
  const now = new Date()
  if (!session || session.expiresAt <= now || session.account.disabledAt) return null
  const employee = await employeesService.findSummaryById(session.account.employeeId)
  if (!employee || !CAN_LOG_IN.includes(employee.status)) return null
  // "last used" for the Sessions lists, at most once a minute
  if (now.getTime() - session.lastSeenAt.getTime() > TOUCH_SECONDS * 1000) await accountsRepository.touchSession(session.id, now)
  return {
    sessionId: session.id,
    accountId: session.account.id,
    employeeId: employee.id,
    employeeCode: employee.employeeCode,
    name: fullName(employee),
    mustChangePassword: session.account.mustChangePassword,
    passwordConfirmedUntil: session.confirmedUntil && session.confirmedUntil > now ? session.confirmedUntil : null,
    ...selectActiveRole(session.account, typeof headers['x-hrms-role'] === 'string' ? headers['x-hrms-role'] : undefined),
  }
}

// Rules for a password the employee chooses themself (old HRMS, 2026-11-16): 10+ characters, a letter and a digit, not
// the employee code, and not one of the last 5 - `recentHashes`: the one in use and the earlier ones kept
async function assertGoodPassword(password: string, employeeCode: string, recentHashes: string[]) {
  const { minPasswordLength } = await securityService.getRules()
  if (password.length < minPasswordLength) badRequest(`The new password needs at least ${minPasswordLength} characters`)
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) badRequest('The new password needs at least one letter and one digit')
  if (password.toUpperCase().includes(employeeCode)) badRequest('The new password must not contain your employee code')
  for (const hash of recentHashes) {
    if (await verifyPassword(password, hash)) badRequest('You used this password recently - choose one that is not among your last 5')
  }
}

// The password in use and the earlier ones kept - a new one may not be any of them
async function recentPasswords(account: { id: number; passwordHash: string }) {
  return [account.passwordHash, ...(await accountsRepository.listEarlierPasswords(account.id, await earlierPasswordsKept()))]
}

function badRequest(message: string): never {
  throw new ORPCError('BAD_REQUEST', { message })
}

// The employee changes their own password (also the way out of a temporary password). Other devices are logged
// out; this session stays.
export async function changePassword(user: CurrentUser, { currentPassword, newPassword }: z.infer<typeof changePasswordInput>, ip: string | null) {
  countPasswordTry('changePassword', user.employeeCode, ip)
  const account = await accountsRepository.findLoginByEmployeeId(user.employeeId)
  if (!account) throw new ORPCError('NOT_FOUND', { message: 'Login not found' })
  // BAD_REQUEST, not UNAUTHORIZED: a wrong current password must not look like a logged-out session
  if (!(await verifyPassword(currentPassword, account.passwordHash))) badRequest('Your current password is not correct')
  if (newPassword === currentPassword) badRequest('The new password must be different from the current one')
  await assertGoodPassword(newPassword, user.employeeCode, await recentPasswords(account))
  const passwordHash = await hashPassword(newPassword)
  await prisma.$transaction(async (tx) => {
    await accountsRepository.rememberPassword(account.id, account.passwordHash, await earlierPasswordsKept(), user.employeeId, tx)
    await accountsRepository.setOwnPassword(account.id, passwordHash, user.employeeId, tx)
    await accountsRepository.deleteOtherSessions(account.id, user.sessionId, tx)
  })
  return { changed: true }
}

// --- Forgot password (2026-11-15): a 6-digit code to the employee's personal e-mail, then a new password ---

const RESET_RESEND_SECONDS = 60
// at most this many codes a day per login (2026-11-23, the review: with only the minute's gap a login could be sent 1,440
// codes a day - 7,200 guesses at a 6-digit code); the day is India's calendar day
const MAX_RESET_CODES_A_DAY = 5
const indianDay = (at: Date) => new Date(at.getTime() + 330 * 60_000).toISOString().slice(0, 10)
const MAX_WRONG_RESET_CODES = 5
// Shown whatever the employee code is, so codes and e-mail addresses cannot be discovered by asking
const RESET_SENT =
  'If this employee code has a login and an e-mail address, a code has been sent to it. It is valid for 10 minutes. No e-mail? Ask HR to reset your password.'
const RESET_CODE_WRONG = 'The code is wrong or has expired. Ask for a new code.'

const resetCodeHash = (accountId: number, code: string) => createHash('sha256').update(`reset:${accountId}:${code}`).digest('hex')

// Sends a code when the employee can log in and has a personal e-mail; always answers the same. A new code at most
// once a minute and 5 a day (more asks get the same answer, and no e-mail). The e-mail is sent in the background (a failure is only logged on the server).
export async function requestPasswordReset({ employeeCode }: z.infer<typeof requestPasswordResetInput>, ip: string | null) {
  countPasswordTry('requestReset', employeeCode, ip)
  const employee = await employeesService.findContactByCode(employeeCode)
  const found = employee && CAN_LOG_IN.includes(employee.status) && employee.personalEmail ? await accountsRepository.findResetCode(employee.id) : null
  // a turned-off login gets no code (2026-11-23, the review) - the same answer
  const account = found && !found.disabledAt ? found : null
  const rules = await securityService.getRules()
  // the same answer whatever the employee code is, with what the new password needs (the next step's page shows it)
  const answer = { message: RESET_SENT, passwordRule: { minLength: rules.minPasswordLength, history: rules.passwordHistory } }
  if (!employee?.personalEmail || !account) return answer
  if (account.resetCodeSentAt && Date.now() - account.resetCodeSentAt.getTime() < RESET_RESEND_SECONDS * 1000) return answer
  const now = new Date()
  const sentToday = account.resetCodeSentAt && indianDay(account.resetCodeSentAt) === indianDay(now) ? account.resetCodesSentToday : 0
  if (sentToday >= MAX_RESET_CODES_A_DAY) return answer
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  const stored = await accountsRepository.storeNewResetCode(
    account.id,
    account.resetCodeSentAt,
    {
      resetCodeHash: resetCodeHash(account.id, code),
      resetCodeValidUntil: new Date(now.getTime() + rules.resetCodeMinutes * 60_000),
      resetCodeSentAt: now,
      resetCodesSentToday: sentToday + 1,
    },
    SYSTEM_ACTOR,
  )
  // another ask at the same moment sent its code
  if (!stored) return answer
  void sendMail({
    to: employee.personalEmail,
    subject: `Your code to reset your HRMS password - ${employee.company.name}`,
    text: [
      `Hello ${fullName(employee)},`,
      '',
      `Your code to set a new password for employee code ${employee.employeeCode} is ${code}`,
      '',
      `It is valid for ${rules.resetCodeMinutes} minutes. If you did not ask for it, ignore this e-mail - your password stays as it is.`,
    ].join('\n'),
  }).catch((error: unknown) => console.error(`[mail] the password reset code for ${employee.employeeCode} failed:`, error))
  return answer
}

// Sets the new password with the code: a wrong code counts, and after 5 wrong tries it stops working. Unlocks the
// login, logs it out everywhere, and the password is no longer temporary. Every wrong, used-up or expired code, an
// unknown employee code and a turned-off login get the same answer, so the answer never tells a real employee code
// apart (2026-11-23, the review - it said "4 tries left" only for a real one).
export async function resetPasswordWithCode({ employeeCode, code, newPassword }: z.infer<typeof resetPasswordWithCodeInput>, ip: string | null) {
  countPasswordTry('resetWithCode', employeeCode, ip)
  const employee = await employeesService.findContactByCode(employeeCode)
  const account = employee && CAN_LOG_IN.includes(employee.status) ? await accountsRepository.findResetCode(employee.id) : null
  if (!employee || !account || account.disabledAt || !account.resetCodeHash || !account.resetCodeValidUntil || account.resetCodeValidUntil < new Date())
    badRequest(RESET_CODE_WRONG)
  // every try is counted before the code is compared (in the database: parallel guesses each count - 2026-11-23)
  const failed = await accountsRepository.takeResetCodeTry(account.id, account.resetCodeHash, MAX_WRONG_RESET_CODES, SYSTEM_ACTOR)
  if (failed === null) badRequest(RESET_CODE_WRONG)
  const expected = Buffer.from(account.resetCodeHash, 'hex')
  const given = Buffer.from(resetCodeHash(account.id, code), 'hex')
  if (!timingSafeEqual(expected, given)) {
    if (failed >= MAX_WRONG_RESET_CODES) await accountsRepository.updateResetCode(account.id, { resetCodeHash: null, resetCodeValidUntil: null }, SYSTEM_ACTOR)
    badRequest(RESET_CODE_WRONG)
  }
  await assertGoodPassword(newPassword, employee.employeeCode, await recentPasswords(account))
  const passwordHash = await hashPassword(newPassword)
  await prisma.$transaction(async (tx) => {
    await accountsRepository.rememberPassword(account.id, account.passwordHash, await earlierPasswordsKept(), SYSTEM_ACTOR, tx)
    await accountsRepository.setOwnPassword(account.id, passwordHash, SYSTEM_ACTOR, tx)
    await accountsRepository.deleteSessions(account.id, { onlyExpired: false }, tx)
  })
  return { changed: true }
}

// --- A login for a new joiner (the joining day) ---

// Creates the login of an employee who has just joined, with a temporary password (changed at the first sign-in).
// Inside the joining transaction; the password is returned to be e-mailed (emailNewLogin) or shown to HR.
export async function createJoinerLogin(employeeId: number, actorId: number, db?: DbClient) {
  const temporaryPassword = generatePassword()
  await accountsRepository.create(employeeId, await hashPassword(temporaryPassword), actorId, db)
  return temporaryPassword
}

// E-mails a new employee their employee code, the temporary password and where to sign in. Returns whether it went
// out (null: no e-mail address, no mail server - only saved in the outbox - or the mail server refused; then HR passes the
// password on).
export async function emailNewLogin(employeeCode: string, temporaryPassword: string): Promise<{ emailedTo: string | null }> {
  const employee = await employeesService.findContactByCode(employeeCode)
  if (!employee?.personalEmail) return { emailedTo: null }
  try {
    const result = await sendMail({
      to: employee.personalEmail,
      subject: `Welcome to ${employee.company.name} - your HRMS login`,
      text: [
        `Hello ${fullName(employee)},`,
        '',
        `Welcome to ${employee.company.name}! You can now sign in to the HRMS to see your profile.`,
        '',
        `Sign in at: ${env.APP_URL}/login`,
        `Employee code: ${employee.employeeCode}`,
        `Temporary password: ${temporaryPassword}`,
        '',
        'You will be asked to choose your own password the first time you sign in. Do not share this e-mail.',
        'Forgot your password later? Use "Forgot password?" on the sign-in page.',
      ].join('\n'),
    })
    // no mail server (only saved in the outbox folder): nothing reached the employee - HR is shown the password (2026-11-23)
    if (result === 'SAVED_TO_OUTBOX') return { emailedTo: null }
    return { emailedTo: maskEmail(employee.personalEmail) }
  } catch (error) {
    console.error(`[mail] the login e-mail for ${employee.employeeCode} failed:`, error)
    return { emailedTo: null }
  }
}

// "pr****@gmail.com"
function maskEmail(email: string) {
  const [name = '', domain = ''] = email.split('@')
  return `${name.slice(0, 2)}${'*'.repeat(Math.max(2, name.length - 2))}@${domain}`
}

// Someone managing another person's login (reset, unlock, roles) must not gain access by it:
// - the employee must be inside their Roles & access Edit range (data access, 2026-11-18) - outside it they are
//   "not found", as any record outside one's data access;
// - only a super admin may manage a super admin's login;
// - anyone else only logins whose roles - with their data access - are within their own access.
function assertCanManage(user: CurrentUser, employee: { employeeCode: string; companyId: number; plantId: number; departmentId: number | null }, roles: AccountRoles['roles']) {
  assertManagesEmployee(user, employee)
  for (const given of roles) {
    if (given.role.isSuperAdmin && !user.isSuperAdmin) {
      throw new ORPCError('FORBIDDEN', { message: "Only a super admin can manage a super admin's login" })
    }
    const grant = grantOf(given)
    assertCanGive(user, grant.access, grant.rows)
  }
}

// The employee must be inside the user's Roles & access Edit range
function assertManagesEmployee(user: CurrentUser, employee: { employeeCode: string; companyId: number; plantId: number; departmentId: number | null }) {
  if (!hasLevelAt(user, 'ACCESS', placementOf(employee), 'WRITE')) {
    throw new ORPCError('NOT_FOUND', { message: `No employee found with code ${employee.employeeCode}` })
  }
}

// A role with these data-access rows may be given (or taken away) only within the giver's own access and data access
function assertCanGive(user: CurrentUser, access: AccessMap, rows: ScopeRow[]) {
  rolesService.assertWithinOwnAccess(user, access)
  const beyond = beyondGiver(user, access, rows)
  if (beyond.length) {
    throw new ORPCError('FORBIDDEN', {
      message: `You can only give access you have yourself - your data access does not cover this for: ${beyond.map((a) => rolesService.AREA_INFO[a].label).join(', ')}`,
    })
  }
}

async function findEmployeeWithLogin(employeeCode: string) {
  const employee = await employeesService.findSummaryByCode(employeeCode)
  if (!employee) throw new ORPCError('NOT_FOUND', { message: `No employee found with code ${employeeCode}` })
  const account = await accountsRepository.findLoginByEmployeeId(employee.id)
  if (!account) throw new ORPCError('NOT_FOUND', { message: `${employee.employeeCode} has no login yet` })
  return { employee, account }
}

// Gives an employee a login with a temporary password (shown once to the admin; changed at the first sign-in).
// The new login has no roles - give them on the People tab.
export async function createLogin(user: CurrentUser, { employeeCode }: z.infer<typeof accountCodeInput>) {
  const employee = await employeesService.findSummaryByCode(employeeCode)
  if (!employee) throw new ORPCError('NOT_FOUND', { message: `No employee found with code ${employeeCode}` })
  assertManagesEmployee(user, employee)
  if (!CAN_LOG_IN.includes(employee.status)) {
    throw new ORPCError('CONFLICT', { message: `${employee.employeeCode} is ${employee.status} and cannot log in` })
  }
  if (await accountsRepository.findByEmployeeId(employee.id)) {
    throw new ORPCError('CONFLICT', { message: `${employee.employeeCode} already has a login - reset its password instead` })
  }
  const temporaryPassword = generatePassword()
  await accountsRepository.create(employee.id, await hashPassword(temporaryPassword), user.employeeId)
  return { employeeCode: employee.employeeCode, name: fullName(employee), temporaryPassword }
}

// A new temporary password for someone who forgot theirs (shown once). Logs them out everywhere and unlocks.
export async function resetPassword(user: CurrentUser, { employeeCode }: z.infer<typeof accountCodeInput>) {
  const { employee, account } = await findEmployeeWithLogin(employeeCode)
  if (account.id === user.accountId) throw new ORPCError('FORBIDDEN', { message: 'Use "Change password" for your own login' })
  assertCanManage(user, employee, account.roles)
  const temporaryPassword = generatePassword()
  const passwordHash = await hashPassword(temporaryPassword)
  await prisma.$transaction(async (tx) => {
    await accountsRepository.rememberPassword(account.id, account.passwordHash, await earlierPasswordsKept(), user.employeeId, tx)
    await accountsRepository.setTemporaryPassword(account.id, passwordHash, user.employeeId, tx)
    await accountsRepository.deleteSessions(account.id, { onlyExpired: false }, tx)
  })
  return { employeeCode: employee.employeeCode, name: fullName(employee), temporaryPassword }
}

// Lifts a lockout before it runs out.
export async function unlockLogin(user: CurrentUser, { employeeCode }: z.infer<typeof accountCodeInput>) {
  const { employee, account } = await findEmployeeWithLogin(employeeCode)
  assertCanManage(user, employee, account.roles)
  await accountsRepository.setLoginFailures(account.id, { failedLoginCount: 0, lockedUntil: null }, user.employeeId)
  return { employeeCode: employee.employeeCode, unlocked: true }
}

// A data-access row as shown: the slice (ids, null = every ...), its level, and readable names
function toDataAccessRow(row: ScopeRow & {
  company: { code: string } | null
  plant: { plantCode: string; name: string } | null
  department: { name: string } | null
}) {
  return {
    companyId: row.companyId,
    plantId: row.plantId,
    departmentId: row.departmentId,
    level: row.level,
    company: row.company?.code ?? null,
    plant: row.plant ? `${row.plant.plantCode} · ${row.plant.name}` : null,
    department: row.department?.name ?? null,
  }
}

// Every employee who has a login and is inside the viewer's Roles & access data access, with their roles and each
// role's data access (sorted by employee code)
export async function listAccounts(viewer: CurrentUser) {
  const accounts = await accountsRepository.list()
  const scope = scopeOf(viewer, 'ACCESS', 'READ')
  const employees = (await employeesService.listSummariesByIds(accounts.map((a) => a.employeeId))).filter((e) => scopeAllows(scope, placementOf(e)))
  const person = await employeesService.lookupPeople(accounts.map((a) => a.disabledById))
  const byId = new Map(employees.map((e) => [e.id, e]))
  const now = new Date()
  return accounts
    .flatMap((account) => {
      const employee = byId.get(account.employeeId)
      if (!employee) return []
      return [
        {
          employeeCode: employee.employeeCode,
          name: fullName(employee),
          status: employee.status,
          // the employee's own company - the data access suggested for a role newly given
          companyId: employee.companyId,
          canLogIn: CAN_LOG_IN.includes(employee.status),
          // still on a temporary password
          mustChangePassword: account.mustChangePassword,
          // set only while the login is locked
          lockedUntil: account.lockedUntil && account.lockedUntil > now ? account.lockedUntil : null,
          lastLoginAt: account.lastLoginAt,
          // turned off: when, by whom, why (null = on)
          disabled: account.disabledAt ? { at: account.disabledAt, by: person(account.disabledById), reason: account.disabledReason } : null,
          roles: account.roles.map(({ role, scopes }) => ({
            id: role.id,
            name: role.name,
            isSuperAdmin: role.isSuperAdmin,
            // whose records the role covers for this employee (a Super Admin role: everything, whatever is listed)
            dataAccess: scopes.map(toDataAccessRow),
          })),
        },
      ]
    })
    .sort((a, b) => a.employeeCode.localeCompare(b.employeeCode))
}

// The same slice twice keeps the higher level; sorted, so two lists can be compared
function normalizeRows(rows: ScopeRow[]) {
  const best = new Map<string, ScopeRow>()
  for (const { companyId, plantId, departmentId, level } of rows) {
    const key = `${companyId ?? '*'}/${plantId ?? '*'}/${departmentId ?? '*'}`
    const kept = best.get(key)
    if (!kept || (kept.level === 'READ' && level === 'WRITE')) best.set(key, { companyId, plantId, departmentId, level })
  }
  return [...best.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, row]) => row)
}
const sameRows = (a: ScopeRow[], b: ScopeRow[]) => JSON.stringify(normalizeRows(a)) === JSON.stringify(normalizeRows(b))

// Gives an employee exactly these roles, each with its data access (whose records it covers).
// - Nobody can change their own roles (no giving yourself more access, no locking yourself out).
// - The employee must be inside the giver's Roles & access Edit range ("not found" otherwise).
// - Only a super admin can give or take away the Super Admin role (it covers everything - its rows are not kept). Because
//   of these rules there is always at least one super admin: the one making the change.
// - Anyone else can only give, change or take away a role - with its data access - within their own access and data
//   access (a role kept with the same rows is not checked).
// - A plant in a row must be one of the row's company's.
export async function setAccountRoles({ employeeCode, roles }: z.infer<typeof setRolesInput>, user: CurrentUser) {
  assertPasswordConfirmed(user)
  const employee = await employeesService.findSummaryByCode(employeeCode)
  if (!employee) throw new ORPCError('NOT_FOUND', { message: `No employee found with code ${employeeCode}` })
  assertManagesEmployee(user, employee)
  const account = await accountsRepository.findByEmployeeId(employee.id)
  if (!account) {
    throw new ORPCError('NOT_FOUND', { message: `${employee.employeeCode} has no login yet - give one with npm run set-password` })
  }
  if (account.id === user.accountId) throw new ORPCError('FORBIDDEN', { message: 'You cannot change your own roles' })

  const wanted = await rolesService.getRolesByIds(roles.map((r) => r.roleId))
  const rowsOf = new Map(roles.map((r) => [r.roleId, wanted.find((role) => role.id === r.roleId)?.isSuperAdmin ? [] : normalizeRows(r.dataAccess)]))
  await assertPlantsOfCompanies([...rowsOf.values()].flat())
  checkedRoleChanges(user, account, wanted, rowsOf)

  await prisma.$transaction(async (tx) => {
    // the roles given and taken away, one change or giving of each at a time - checked again with them as saved now
    // (2026-11-23, the review: a role given with wide data access while another editor added areas to it passed both checks)
    await rolesService.lockRoles([...rowsOf.keys(), ...account.roles.map((given) => given.role.id)], tx)
    const fresh = await accountsRepository.findByEmployeeId(employee.id, tx)
    if (!fresh) throw new ORPCError('NOT_FOUND', { message: `${employee.employeeCode} has no login yet - give one with npm run set-password` })
    const { toSave, removed } = checkedRoleChanges(user, fresh, await rolesService.getRolesByIds([...rowsOf.keys()], tx), rowsOf)
    if (removed.length) await accountsRepository.removeRoles(fresh.id, removed.map((given) => given.role.id), tx)
    for (const { roleId, rows } of toSave) {
      const given = await accountsRepository.addRole(fresh.id, roleId, user.employeeId, tx)
      await accountsRepository.replaceScopes(given.id, rows, user.employeeId, tx)
    }
  })
  const saved = await accountsRepository.findByEmployeeId(employee.id)
  return {
    employeeCode: employee.employeeCode,
    name: fullName(employee),
    status: employee.status,
    canLogIn: CAN_LOG_IN.includes(employee.status),
    roles: (saved?.roles ?? []).map(({ role, scopes }) => ({ id: role.id, name: role.name, isSuperAdmin: role.isSuperAdmin, dataAccess: scopes.map(toDataAccessRow) })),
  }
}

// The roles to give (with their rows) and take away to leave the account with exactly `wanted` - each one added, changed or
// taken away checked against the giver's own access (setAccountRoles' rules)
function checkedRoleChanges(
  user: CurrentUser,
  account: AccountRoles,
  wanted: Awaited<ReturnType<typeof rolesService.getRolesByIds>>,
  rowsOf: Map<number, ScopeRow[]>,
) {
  const current = new Map(account.roles.map((given) => [given.role.id, given]))
  // added, changed (other rows) and taken away - each checked against the giver's own access
  const toCheck: { isSuperAdmin: boolean; access: AccessMap; rows: ScopeRow[] }[] = []
  const toSave: { roleId: number; rows: ScopeRow[] }[] = []
  for (const role of wanted) {
    const rows = rowsOf.get(role.id) ?? []
    const before = current.get(role.id)
    if (!before) {
      toCheck.push({ isSuperAdmin: role.isSuperAdmin, access: role.access, rows })
      toSave.push({ roleId: role.id, rows })
    } else if (!role.isSuperAdmin && !sameRows(grantOf(before).rows, rows)) {
      toCheck.push({ isSuperAdmin: role.isSuperAdmin, access: role.access, rows: [...grantOf(before).rows, ...rows] })
      toSave.push({ roleId: role.id, rows })
    }
  }
  const removed = account.roles.filter((given) => !rowsOf.has(given.role.id))
  for (const given of removed) toCheck.push({ isSuperAdmin: given.role.isSuperAdmin, ...grantOf(given) })
  for (const { isSuperAdmin, access, rows } of toCheck) {
    if (isSuperAdmin && !user.isSuperAdmin) {
      throw new ORPCError('FORBIDDEN', { message: 'Only a super admin can give or take away the Super Admin role' })
    }
    assertCanGive(user, access, rows)
  }
  // a role's rows also decide whose approval requests its holders may decide (approval chains, the fallback approver -
  // 2026-11-20), whatever the role's areas: the rows given must be inside the giver's own Roles & access Edit data access
  if (!user.isSuperAdmin) {
    for (const { rows } of toSave) {
      if (rows.some((row) => levelOver(user, 'ACCESS', row) !== 'WRITE')) {
        throw new ORPCError('FORBIDDEN', {
          message: "You can only give data access inside your own Roles & access data access - a role's rows also decide whose approvals its holders may decide",
        })
      }
    }
  }
  return { toSave, removed }
}

// A plant in a data-access row must be one of the row's company's (400)
async function assertPlantsOfCompanies(rows: ScopeRow[]) {
  for (const row of rows) {
    if (row.plantId === null) continue
    const plant = await plantsService.getPlant(row.plantId)
    if (plant.company.id !== row.companyId) {
      throw new ORPCError('BAD_REQUEST', { message: `Plant ${plant.plantCode} ${plant.name} is not a plant of the company chosen with it` })
    }
  }
}

// Gives an employee a login, or resets the password (and logs them out everywhere), optionally adding a role.
// The password is temporary: it must be changed at the next sign-in - unless `temporary: false` (only for test data,
// scripts/import-employee-master.ts).
// Used by scripts/set-password.ts, so it is recorded as done by System. `employeeCode` must be upper-case.
export async function setPassword(employeeCode: string, password: string, roleName?: string, { temporary = true } = {}) {
  const { minPasswordLength } = await securityService.getRules()
  if (password.length < minPasswordLength) {
    throw new ORPCError('BAD_REQUEST', { message: `A password needs at least ${minPasswordLength} characters` })
  }
  const employee = await employeesService.findSummaryByCode(employeeCode)
  if (!employee) throw new ORPCError('NOT_FOUND', { message: `No employee found with code ${employeeCode}` })
  const role = roleName === undefined ? undefined : await rolesService.getRoleByName(roleName)
  const passwordHash = await hashPassword(password)

  await prisma.$transaction(async (tx) => {
    const account = await accountsRepository.upsert(employee.id, passwordHash, SYSTEM_ACTOR, tx, temporary)
    if (role) {
      // a role given by the script (run on the server, e.g. the first super admin) covers every company at Edit - narrow
      // it on the Roles & access page; a role the employee already had keeps its data access
      const given = await accountsRepository.addRole(account.id, role.id, SYSTEM_ACTOR, tx)
      if (given._count.scopes === 0 && !role.isSuperAdmin) await accountsRepository.replaceScopes(given.id, [{ ...ALL_OF_GROUP, level: 'WRITE' }], SYSTEM_ACTOR, tx)
    }
    await accountsRepository.deleteSessions(account.id, { onlyExpired: false }, tx)
  })
  const account = await accountsRepository.findByEmployeeId(employee.id)
  return {
    employeeCode: employee.employeeCode,
    name: fullName(employee),
    roles: account?.roles.map(({ role: r }) => r.name) ?? [],
    status: employee.status,
  }
}

// Role id -> name, for showing roles by name (e.g. in the change history)
export async function roleNames() {
  const { roles } = await rolesService.listRoles()
  return new Map(roles.map((role) => [role.id, role.name]))
}

// --- Re-entering the password (before changing roles - core/auth/confirm.ts) ---

// Checks the employee's own password and marks this session confirmed for confirmPasswordMinutes (security rules). Wrong passwords count like
// wrong sign-ins: the 5th locks the login and logs it out everywhere.
export async function confirmPassword(user: CurrentUser, { password }: z.infer<typeof confirmPasswordInput>, ip: string | null) {
  countPasswordTry('confirmPassword', user.employeeCode, ip)
  const account = await accountsRepository.findLoginByEmployeeId(user.employeeId)
  if (!account) throw new ORPCError('NOT_FOUND', { message: 'Login not found' })
  if (!(await verifyPassword(password, account.passwordHash))) {
    const { failed, lockedUntil, rules } = await recordWrongPassword(account.id)
    if (lockedUntil) {
      await accountsRepository.deleteSessions(account.id, { onlyExpired: false })
      throw new ORPCError('UNAUTHORIZED', { message: lockedMessage(lockedUntil) })
    }
    badRequest(`Your password is not correct. ${rules.maxFailedLogins - failed} tries left before the login is locked.`)
  }
  if (account.failedLoginCount > 0) await accountsRepository.setLoginFailures(account.id, { failedLoginCount: 0, lockedUntil: null }, user.employeeId)
  const confirmedUntil = new Date(Date.now() + (await securityService.getRules()).confirmPasswordMinutes * 60_000)
  await accountsRepository.confirmSession(user.sessionId, confirmedUntil)
  return { confirmedUntil }
}

// --- Turning a login off / on (old HRMS, 2026-11-16) ---

// Turns someone's login off (e.g. during a suspension): no sign-in although still employed; logged out everywhere.
export async function disableLogin(user: CurrentUser, { employeeCode, reason }: z.infer<typeof disableLoginInput>) {
  const { employee, account } = await findEmployeeWithLogin(employeeCode)
  if (account.id === user.accountId) throw new ORPCError('FORBIDDEN', { message: 'You cannot turn off your own login' })
  assertCanManage(user, employee, account.roles)
  await prisma.$transaction(async (tx) => {
    await accountsRepository.setDisabled(account.id, { disabledAt: new Date(), disabledById: user.employeeId, disabledReason: reason }, user.employeeId, tx)
    await accountsRepository.deleteSessions(account.id, { onlyExpired: false }, tx)
  })
  return { employeeCode: employee.employeeCode, disabled: true }
}

export async function enableLogin(user: CurrentUser, { employeeCode }: z.infer<typeof accountCodeInput>) {
  const { employee, account } = await findEmployeeWithLogin(employeeCode)
  assertCanManage(user, employee, account.roles)
  await accountsRepository.setDisabled(account.id, { disabledAt: null, disabledById: null, disabledReason: null }, user.employeeId)
  return { employeeCode: employee.employeeCode, disabled: false }
}

// --- Sessions (old HRMS, 2026-11-16): where people are signed in ---

// "Chrome on Windows" from the browser's user-agent text
function describeBrowser(userAgent: string | null) {
  if (!userAgent) return 'Unknown browser'
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /OPR\//.test(userAgent)
      ? 'Opera'
      : /Firefox\//.test(userAgent)
        ? 'Firefox'
        : /Chrome\//.test(userAgent)
          ? 'Chrome'
          : /Safari\//.test(userAgent)
            ? 'Safari'
            : 'A browser'
  const system = /Windows/.test(userAgent)
    ? 'Windows'
    : /Android/.test(userAgent)
      ? 'Android'
      : /iPhone|iPad/.test(userAgent)
        ? 'iPhone / iPad'
        : /Mac OS X/.test(userAgent)
          ? 'Mac'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : null
  return system ? `${browser} on ${system}` : browser
}

type SessionRow = { id: number; createdAt: Date; lastSeenAt: Date; expiresAt: Date; ip: string | null; userAgent: string | null }
const toSession = (row: SessionRow, currentSessionId: number) => ({
  id: row.id,
  startedAt: row.createdAt,
  lastSeenAt: row.lastSeenAt,
  expiresAt: row.expiresAt,
  ip: row.ip,
  browser: describeBrowser(row.userAgent),
  // the session this request comes from
  current: row.id === currentSessionId,
})

// Everyone's sessions not expired yet (Roles & access: View) - of the employees inside the viewer's data access
export async function listAllSessions(user: CurrentUser) {
  const all = await accountsRepository.listLiveSessions(new Date())
  const scope = scopeOf(user, 'ACCESS', 'READ')
  const employees = await employeesService.listSummariesByIds([...new Set(all.map((r) => r.account.employeeId))])
  const visible = new Set(employees.filter((e) => scopeAllows(scope, placementOf(e))).map((e) => e.id))
  const rows = all.filter((row) => visible.has(row.account.employeeId))
  const person = await employeesService.lookupPeople(rows.map((r) => r.account.employeeId))
  return rows.map((row) => ({ ...toSession(row, user.sessionId), employee: person(row.account.employeeId) }))
}

// The logged-in employee's own sessions
export async function listMySessions(user: CurrentUser) {
  return (await accountsRepository.listAccountSessions(user.accountId, new Date())).map((row) => toSession(row, user.sessionId))
}

// Logs one session out: one's own (another device) - or anyone's with Roles & access: Edit (not a super admin's unless
// one is a super admin). The current session is ended with "Log out".
export async function endSession(user: CurrentUser, { sessionId }: z.infer<typeof sessionIdInput>) {
  const session = await accountsRepository.findSessionById(sessionId)
  if (!session) throw new ORPCError('NOT_FOUND', { message: 'This session has already ended' })
  if (session.id === user.sessionId) throw new ORPCError('BAD_REQUEST', { message: 'This is the session you are using - use "Log out"' })
  if (session.accountId !== user.accountId) {
    assertAccess(user.access, 'ACCESS', 'WRITE')
    const employee = await employeesService.findSummaryById(session.account.employeeId)
    if (!employee) throw new ORPCError('NOT_FOUND', { message: 'This session has already ended' })
    assertCanManage(user, employee, session.account.roles)
  }
  await accountsRepository.deleteSession(session.id)
  await accountsRepository.recordSignInEvent({
    action: 'SIGN_OUT',
    actorId: user.employeeId,
    employeeId: session.account.employeeId,
    details: { reason: session.accountId === user.accountId ? 'Logged out from another device' : `Logged out by ${user.name}` },
  })
  return { ended: 1 }
}

// Logs someone out everywhere (Roles & access: Edit) - for one's own login: every other device
export async function endAllSessions(user: CurrentUser, { employeeCode }: z.infer<typeof accountCodeInput>) {
  const { employee, account } = await findEmployeeWithLogin(employeeCode)
  const own = account.id === user.accountId
  if (!own) assertCanManage(user, employee, account.roles)
  const { count } = own ? await accountsRepository.deleteOtherSessions(account.id, user.sessionId) : await accountsRepository.deleteSessions(account.id, { onlyExpired: false })
  if (count) {
    await accountsRepository.recordSignInEvent({
      action: 'SIGN_OUT',
      actorId: user.employeeId,
      employeeId: employee.id,
      details: { reason: own ? `Logged out on ${count} other device(s)` : `Logged out everywhere by ${user.name}` },
    })
  }
  return { ended: count }
}

// --- Roles x access as Excel (old HRMS, 2026-11-16) ---

// Two sheets: every role with its level per area, and everyone with a login and their roles
export async function exportAccess(viewer: CurrentUser) {
  const [{ areas, roles }, accounts] = await Promise.all([rolesService.listRoles(), listAccounts(viewer)])
  const level = { READ: 'View', WRITE: 'Edit' } as const
  const bytes = await writeReport([
    {
      name: 'Roles',
      columns: [
        { header: 'Role', key: 'role', width: 26 },
        { header: 'Description', key: 'description', width: 40 },
        { header: 'People', key: 'people', width: 9 },
        ...areas.map((a) => ({ header: a.label, key: a.area, width: Math.max(12, a.label.length + 2) })),
      ],
      rows: roles.map((role) => ({
        role: role.isSuperAdmin ? `${role.name} (all access)` : role.name,
        description: role.description,
        people: role.employeeCount,
        ...Object.fromEntries(areas.map((a) => [a.area, role.access[a.area] ? level[role.access[a.area]!] : '—'])),
      })),
    },
    {
      name: 'People',
      columns: [
        { header: 'Employee code', key: 'code', width: 14 },
        { header: 'Name', key: 'name', width: 28 },
        { header: 'Employee status', key: 'status', width: 15 },
        { header: 'Login', key: 'login', width: 26 },
        { header: 'Roles', key: 'roles', width: 40 },
        { header: 'Last login', key: 'lastLogin', width: 18 },
      ],
      rows: accounts.map((a) => ({
        code: a.employeeCode,
        name: a.name,
        status: a.status,
        login: a.disabled ? `Turned off - ${a.disabled.reason ?? ''}` : a.lockedUntil ? 'Locked' : a.mustChangePassword ? 'Temporary password' : 'Active',
        roles: a.roles.map((r) => r.name).join(', '),
        lastLogin: a.lastLoginAt ? a.lastLoginAt.toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : 'Never',
      })),
    },
  ], { title: 'Roles and access', preparedBy: `${viewer.name} (${viewer.employeeCode})`, coverage: 'All roles; employee logins within the active role data scope.' })
  return new File([new Uint8Array(bytes)], `roles-and-access-${today().toISOString().slice(0, 10)}.xlsx`, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

// --- for the background worker (accounts.jobs.ts) ---

// Removes sessions past their 7 days (they were also removed at that login's next sign-in)
export async function removeExpiredSessions() {
  return accountsRepository.deleteExpiredSessions(new Date())
}

// Whether a login's roles give at least this level in an area - for a record at `placement` when given (data access)
function accountHas(account: AccountRoles & { disabledAt: Date | null }, area: AccessArea, level: AccessLevel, placement?: Placement) {
  if (account.disabledAt) return false
  const user = accessFromRoles(account)
  return placement ? hasLevelAt(user, area, placement, level) : hasAccess(user.access, area, level)
}

// For a reminder about several records: each person whose roles give at least this level in the area for one or more
// of them (data access), with the ones they cover - who can still log in and has an e-mail address
export async function mailRecipientsFor<T extends { placement: Placement }>(area: AccessArea, level: AccessLevel, items: T[]) {
  const accounts = await accountsRepository.list()
  const covered = new Map<number, T[]>()
  for (const account of accounts) {
    const mine = items.filter((item) => accountHas(account, area, level, item.placement))
    if (mine.length) covered.set(account.employeeId, mine)
  }
  const people = (await employeesService.listMailContacts([...covered.keys()])).filter((person) => CAN_LOG_IN.includes(person.status))
  return people.map((person) => ({ person, items: covered.get(person.id) ?? [] }))
}

// For a reminder about things that belong to a whole company (its statutory deposits - payroll stage 6 slice 3): each
// person whose roles give at least this level over the WHOLE slice of one or more of them - one data-access row covering
// it all, as payroll needs - with the ones they cover; who can still log in and has an e-mail address
export async function mailRecipientsOver<T extends { slice: Slice }>(area: AccessArea, level: AccessLevel, items: T[]) {
  const accounts = await accountsRepository.list()
  const covered = new Map<number, T[]>()
  for (const account of accounts) {
    if (account.disabledAt) continue
    const user = accessFromRoles(account)
    const mine = items.filter((item) => {
      const has = levelOver(user, area, item.slice)
      return level === 'WRITE' ? has === 'WRITE' : has !== undefined
    })
    if (mine.length) covered.set(account.employeeId, mine)
  }
  const people = (await employeesService.listMailContacts([...covered.keys()])).filter((person) => CAN_LOG_IN.includes(person.status))
  return people.map((person) => ({ person, items: covered.get(person.id) ?? [] }))
}

// --- Approvers (modules/approvals, the user 2026-11-20) ---

// The enabled logins (with their roles and data-access rows) and who of them can still sign in
type SignIns = { accounts: Awaited<ReturnType<typeof accountsRepository.list>>; canSignIn: Set<number> }
async function readSignIns(): Promise<SignIns> {
  const accounts = (await accountsRepository.list()).filter((account) => !account.disabledAt)
  const people = accounts.length ? await employeesService.listSummariesByIds(accounts.map((account) => account.employeeId)) : []
  return { accounts, canSignIn: new Set(people.filter((person) => CAN_LOG_IN.includes(person.status)).map((person) => person.id)) }
}

// A job going through many requests reads the logins once per run, not once per request (2026-11-20: the nightly
// approvals job read them 168 times, 4.6 of its 7.2 s, on the test database). Only inside `withSignInsReadOnce`, a new
// read each run - what someone does on a page always reads them fresh.
const runSignIns = new AsyncLocalStorage<{ read?: Promise<SignIns> }>()
export function withSignInsReadOnce<T>(run: () => Promise<T>): Promise<T> {
  return runSignIns.run({}, run)
}
function signIns() {
  const store = runSignIns.getStore()
  if (!store) return readSignIns()
  // read on first use: a run with nothing to look up reads nothing
  store.read ??= readSignIns()
  return store.read
}

// Who may decide an approval step: the holders of a role whose data-access rows cover every placement (`roleId`), of an
// access area at Edit covering every placement (`area`), or of the fallback-approver role covering every placement
// (`fallback`) - with an enabled login and still able to sign in. One read of the logins for all the queries; the
// answer has one list of employee ids per query, in order.
// `wholeCompanyId`: a request about a whole company (a pay run - payroll stage 5): the holder needs one data-access row
// covering that whole company (never plant rows stitched together); `placements` is then empty
export type ApproverQuery = { roleId?: number | null; area?: AccessArea | null; fallback?: boolean; placements: Placement[]; wholeCompanyId?: number }
export async function listApprovers(queries: ApproverQuery[]): Promise<number[][]> {
  if (!queries.length) return []
  const { accounts, canSignIn } = await signIns()
  const qualifies = (account: (typeof accounts)[number], query: ApproverQuery) => {
    const whole = query.wholeCompanyId !== undefined ? { companyId: query.wholeCompanyId, plantId: null, departmentId: null } : null
    if (query.area) {
      const user = accessFromRoles(account)
      if (whole) return levelOver(user, query.area, whole) === 'WRITE'
      return query.placements.every((placement) => hasLevelAt(user, query.area!, placement, 'WRITE'))
    }
    const roles = account.roles.filter((r) => (query.fallback ? r.role.isApprovalFallback : r.role.id === query.roleId))
    return roles.some((r) => {
      const grant = grantOf(r)
      if (whole) return grant.rows.some((row) => sliceContains(row, whole))
      return query.placements.every((placement) => grant.rows.some((row) => sliceCovers(row, placement)))
    })
  }
  return queries.map((query) => accounts.filter((account) => canSignIn.has(account.employeeId) && qualifies(account, query)).map((account) => account.employeeId))
}

// Who a ROLE / ACCESS step of an approval chain can be named to (the user, 2026-11-20): the holders able to sign in, with
// how far they hold it whole - every company (`everyCompany`: the shared chain) or each whole company (`companyIds`: that
// company's own chain). A role counts its own data-access rows; an access counts every role the holder has, at Edit.
export type ChainApproverChoice = { employeeId: number; employeeCode: string; name: string; everyCompany: boolean; companyIds: number[] }
export async function listChainApproverChoices() {
  const accounts = (await accountsRepository.list()).filter((account) => !account.disabledAt)
  const people = accounts.length ? await employeesService.listSummariesByIds(accounts.map((account) => account.employeeId)) : []
  const person = new Map(people.filter((p) => CAN_LOG_IN.includes(p.status)).map((p) => [p.id, p]))
  const byRole: Record<number, ChainApproverChoice[]> = {}
  const byArea: Partial<Record<AccessArea, ChainApproverChoice[]>> = {}
  const choice = (p: NonNullable<ReturnType<typeof person.get>>, everyCompany: boolean, companyIds: number[]): ChainApproverChoice => ({
    employeeId: p.id,
    employeeCode: p.employeeCode,
    name: employeesService.fullName(p),
    everyCompany,
    companyIds: [...new Set(companyIds)],
  })
  // the companies a row covers whole (a row for every company covers them all - `everyCompany`)
  const wholeCompanies = (rows: ScopeRow[]) => rows.filter((row) => row.companyId !== null && row.plantId === null && row.departmentId === null).map((row) => row.companyId!)
  for (const account of accounts) {
    const p = person.get(account.employeeId)
    if (!p) continue
    for (const r of account.roles) {
      const { rows } = grantOf(r)
      const everyCompany = rows.some((row) => row.companyId === null && row.plantId === null && row.departmentId === null)
      const companyIds = wholeCompanies(rows)
      if (everyCompany || companyIds.length) (byRole[r.role.id] ??= []).push(choice(p, everyCompany, companyIds))
    }
    const user = accessFromRoles(account)
    const candidates = [...new Set(user.grants.flatMap((grant) => wholeCompanies(grant.rows)))]
    for (const area of ACCESS_AREAS) {
      const everyCompany = levelOver(user, area, ALL_OF_GROUP) === 'WRITE'
      const companyIds = everyCompany ? [] : candidates.filter((companyId) => levelOver(user, area, { companyId, plantId: null, departmentId: null }) === 'WRITE')
      if (everyCompany || companyIds.length) (byArea[area] ??= []).push(choice(p, everyCompany, companyIds))
    }
  }
  const byName = (a: ChainApproverChoice, b: ChainApproverChoice) => a.name.localeCompare(b.name)
  for (const list of [...Object.values(byRole), ...Object.values(byArea)]) list.sort(byName)
  return { byRole, byArea }
}

// --- Joining-task teams (modules/joining-tasks, the user 2026-11-20) ---

// The roles that give this area at this level (a joining task's team: "Joining tasks: Edit"), each with its holders who
// can sign in, by name. With `placement`: only the holders whose rows on THAT role give the level there (data access) -
// the people a task for a new employee there can go to.
export async function listRolesWithAccess(area: AccessArea, level: AccessLevel, placement?: Placement) {
  const [{ roles }, accounts] = await Promise.all([rolesService.listRoles(), accountsRepository.list()])
  const enabled = accounts.filter((account) => !account.disabledAt)
  const people = enabled.length ? await employeesService.listSummariesByIds(enabled.map((account) => account.employeeId)) : []
  const person = new Map(people.filter((p) => CAN_LOG_IN.includes(p.status)).map((p) => [p.id, p]))
  return roles
    .filter((role) => hasAccess(role.access, area, level))
    .map((role) => ({
      id: role.id,
      name: role.name,
      people: enabled
        .flatMap((account) => {
          const p = person.get(account.employeeId)
          const held = account.roles.find((r) => r.role.id === role.id)
          if (!p || !held) return []
          if (placement && !hasLevelAt({ isSuperAdmin: held.role.isSuperAdmin, grants: [grantOf(held)] }, area, placement, level)) return []
          return [{ id: p.id, employeeCode: p.employeeCode, name: employeesService.fullName(p) }]
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
    }))
}

// The roles a step of an approval chain can name, with the fallback approver marked (the Approval rules page)
export async function listRoleChoices() {
  const { roles } = await rolesService.listRoles()
  return roles.map((role) => ({ id: role.id, name: role.name, isApprovalFallback: role.isApprovalFallback }))
}

// The access areas, in the Roles & access page's order, with their names (an approval-chain step can name one)
export function listAreaChoices() {
  return rolesService.listAreas().map(({ area, label }) => ({ area, label }))
}

// How an access area is called on the Roles & access page ("Approve job & salary changes")
export function areaLabel(area: AccessArea) {
  return rolesService.AREA_INFO[area].label
}

// Which of these employees can sign in (an enabled login, not exited) - a named approver (manager, HOD) must
export async function listSignInIds(ids: number[]) {
  if (!ids.length) return new Set<number>()
  // inside a job run: from the logins read once for the run
  if (runSignIns.getStore()) {
    const { canSignIn } = await signIns()
    return new Set(ids.filter((id) => canSignIn.has(id)))
  }
  const accounts = (await accountsRepository.list()).filter((account) => !account.disabledAt && ids.includes(account.employeeId))
  const people = accounts.length ? await employeesService.listSummariesByIds(accounts.map((account) => account.employeeId)) : []
  return new Set(people.filter((person) => CAN_LOG_IN.includes(person.status)).map((person) => person.id))
}

// Who gets an HR reminder about an area: everyone whose roles give at least this level there - for a record at
// `placement` when given (data access) - (decided 2026-11-16 - it follows the roles, no address list to keep), who can
// still log in and has an e-mail address
export async function mailRecipients(area: AccessArea, level: AccessLevel, placement?: Placement) {
  const accounts = await accountsRepository.list()
  const ids = accounts.filter((a) => accountHas(a, area, level, placement)).map((a) => a.employeeId)
  return (await employeesService.listMailContacts(ids)).filter((person) => CAN_LOG_IN.includes(person.status))
}

// Shared configuration uses this metadata-only picker; choosing a role never changes its permissions.
export function listRoleChoicesForAccess(area: AccessArea, level: AccessLevel) {
  return rolesService.listRoleChoicesForAccess(area, level)
}
