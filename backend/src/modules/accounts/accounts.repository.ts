import { createdBy, prisma, recordAuditEvent, updatedBy, type AccessLevel, type ActorId, type DbClient, type Prisma } from '#core/db/prisma'

// Database access for user_accounts, user_account_roles and sessions.

// The roles of a login, with what each role allows and its data access - whose records it covers (2026-11-18)
const rolesSelect = {
  roles: {
    select: {
      id: true,
      role: { select: { id: true, name: true, isSuperAdmin: true, isApprovalFallback: true, permissions: { select: { area: true, level: true } } } },
      scopes: {
        select: {
          companyId: true,
          plantId: true,
          departmentId: true,
          level: true,
          company: { select: { code: true } },
          plant: { select: { plantCode: true, name: true } },
          department: { select: { name: true } },
        },
        orderBy: { id: 'asc' },
      },
    },
    orderBy: { role: { name: 'asc' } },
  },
} satisfies Prisma.UserAccountSelect

// The login of an employee with its password hash, or null. Only for checking a password.
export function findLoginByEmployeeId(employeeId: number, db: DbClient = prisma) {
  return db.userAccount.findUnique({
    where: { employeeId },
    select: { id: true, passwordHash: true, mustChangePassword: true, failedLoginCount: true, lockedUntil: true, disabledAt: true, ...rolesSelect },
  })
}

// The login of an employee and its roles (no password hash), or null.
export function findByEmployeeId(employeeId: number, db: DbClient = prisma) {
  return db.userAccount.findUnique({ where: { employeeId }, select: { id: true, ...rolesSelect } })
}

// Every login and its roles
export function list(db: DbClient = prisma) {
  return db.userAccount.findMany({
    select: {
      id: true,
      employeeId: true,
      mustChangePassword: true,
      lockedUntil: true,
      lastLoginAt: true,
      disabledAt: true,
      disabledById: true,
      disabledReason: true,
      ...rolesSelect,
    },
  })
}

// A temporary password: must be changed at the next sign-in; also unlocks the login.
const temporary = (passwordHash: string) => ({ passwordHash, mustChangePassword: true, failedLoginCount: 0, lockedUntil: null })

// Creates the login with a temporary password, or gives an existing login a new temporary password (script).
// `isTemporary: false` (test-data scripts only): the password does not have to be changed at the next sign-in.
export function upsert(employeeId: number, passwordHash: string, actorId: ActorId, db: DbClient = prisma, isTemporary = true) {
  const password = { ...temporary(passwordHash), mustChangePassword: isTemporary }
  return db.userAccount.upsert({
    where: { employeeId },
    create: { employeeId, ...password, ...createdBy(actorId) },
    update: { ...password, ...updatedBy(actorId) },
    select: { id: true },
  })
}

// A new login with a temporary password.
export function create(employeeId: number, passwordHash: string, actorId: ActorId, db: DbClient = prisma) {
  return db.userAccount.create({ data: { employeeId, ...temporary(passwordHash), ...createdBy(actorId) }, select: { id: true } })
}

// An admin reset: a new temporary password (and unlocked).
export function setTemporaryPassword(accountId: number, passwordHash: string, actorId: ActorId, db: DbClient = prisma) {
  return db.userAccount.update({ where: { id: accountId }, data: { ...temporary(passwordHash), ...updatedBy(actorId) }, select: { id: true } })
}

// The employee chose their own password: no longer temporary.
export function setOwnPassword(accountId: number, passwordHash: string, actorId: ActorId, db: DbClient = prisma) {
  return db.userAccount.update({
    where: { id: accountId },
    // (a "forgot password" code dies with it)
    data: {
      passwordHash,
      mustChangePassword: false,
      failedLoginCount: 0,
      lockedUntil: null,
      resetCodeHash: null,
      resetCodeValidUntil: null,
      resetCodeFailedAttempts: 0,
      ...updatedBy(actorId),
    },
    select: { id: true },
  })
}

// The login of an employee with what "forgot password" needs (the code, when the last one was sent), or null
export function findResetCode(employeeId: number, db: DbClient = prisma) {
  return db.userAccount.findUnique({
    where: { employeeId },
    select: {
      id: true,
      passwordHash: true,
      disabledAt: true,
      resetCodeHash: true,
      resetCodeValidUntil: true,
      resetCodeFailedAttempts: true,
      resetCodeSentAt: true,
      resetCodesSentToday: true,
    },
  })
}

// Stores a new "forgot password" code only if no other one was sent since `lastSentAt` was read (two requests at once send
// one code - 2026-11-23); 0 = another request was first
export async function storeNewResetCode(
  accountId: number,
  lastSentAt: Date | null,
  data: { resetCodeHash: string; resetCodeValidUntil: Date; resetCodeSentAt: Date; resetCodesSentToday: number },
  actorId: ActorId,
  db: DbClient = prisma,
) {
  const { count } = await db.userAccount.updateMany({
    where: { id: accountId, resetCodeSentAt: lastSentAt },
    data: { ...data, resetCodeFailedAttempts: 0, resetCodeSentById: actorId, ...updatedBy(actorId) },
  })
  return count
}

// Sets / counts / clears the "forgot password" code (by System - the employee is not logged in)
export function updateResetCode(
  accountId: number,
  data: {
    resetCodeHash?: string | null
    resetCodeValidUntil?: Date | null
    resetCodeFailedAttempts?: number
    resetCodeSentAt?: Date
    resetCodeSentById?: number
  },
  actorId: ActorId,
  db: DbClient = prisma,
) {
  return db.userAccount.update({ where: { id: accountId }, data: { ...data, ...updatedBy(actorId) }, select: { id: true } })
}

// Wrong passwords in a row, and the lock (null = not locked).
// One more wrong password, counted in the database itself - parallel wrong passwords each count (2026-11-23: each read
// the same count and wrote count + 1). Returns the count with this one.
export async function addLoginFailure(accountId: number, actorId: ActorId, db: DbClient = prisma) {
  const row = await db.userAccount.update({ where: { id: accountId }, data: { failedLoginCount: { increment: 1 }, ...updatedBy(actorId) }, select: { failedLoginCount: true } })
  return row.failedLoginCount
}

// Takes one try of the live reset code (`resetCodeHash`) before it is compared - null when none is left, or the code was
// replaced or used meanwhile. Counted in the database itself, as addLoginFailure. Returns the tries used, with this one.
export async function takeResetCodeTry(accountId: number, resetCodeHash: string, maxTries: number, actorId: ActorId, db: DbClient = prisma) {
  const [row] = await db.userAccount.updateManyAndReturn({
    where: { id: accountId, resetCodeHash, resetCodeFailedAttempts: { lt: maxTries } },
    data: { resetCodeFailedAttempts: { increment: 1 }, ...updatedBy(actorId) },
    select: { resetCodeFailedAttempts: true },
  })
  return row?.resetCodeFailedAttempts ?? null
}

export function setLoginFailures(
  accountId: number,
  data: { failedLoginCount: number; lockedUntil: Date | null },
  actorId: ActorId,
  db: DbClient = prisma,
) {
  return db.userAccount.update({ where: { id: accountId }, data: { ...data, ...updatedBy(actorId) }, select: { id: true } })
}

// Gives the login exactly these roles (removes the others).
// Roles the login keeps are left as they are (their createdById still says who gave them).
// One data-access row as saved: a slice (null = every company / plant / department) and its level
export type ScopeRowData = { companyId: number | null; plantId: number | null; departmentId: number | null; level: AccessLevel }

// Takes these roles away from the login (their data-access rows go with them)
export function removeRoles(accountId: number, roleIds: number[], db: DbClient = prisma) {
  return db.userAccountRole.deleteMany({ where: { accountId, roleId: { in: roleIds } } })
}

// Gives the login a role (nothing happens if it already has it) - returns the given role's id and how many data-access
// rows it has
export function addRole(accountId: number, roleId: number, actorId: ActorId, db: DbClient = prisma) {
  return db.userAccountRole.upsert({
    where: { accountId_roleId: { accountId, roleId } },
    create: { accountId, roleId, ...createdBy(actorId) },
    update: {},
    select: { id: true, _count: { select: { scopes: true } } },
  })
}

// Replaces the data-access rows of a role given to a login
export async function replaceScopes(accountRoleId: number, rows: ScopeRowData[], actorId: ActorId, db: DbClient = prisma) {
  await db.userAccountRoleScope.deleteMany({ where: { accountRoleId } })
  if (rows.length) await db.userAccountRoleScope.createMany({ data: rows.map((row) => ({ accountRoleId, ...row, ...createdBy(actorId) })) })
}

// `actorId`: the employee who is logging in
export function createSession(
  data: { accountId: number; tokenHash: string; expiresAt: Date; ip: string | null; userAgent: string | null },
  actorId: ActorId,
  db: DbClient = prisma,
) {
  return db.session.create({ data: { ...data, ...createdBy(actorId) }, select: { id: true } })
}

// The session with this token hash, its account and the account's roles, or null.
export function findSessionByTokenHash(tokenHash: string, db: DbClient = prisma) {
  return db.session.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      expiresAt: true,
      lastSeenAt: true,
      confirmedUntil: true,
      account: { select: { id: true, employeeId: true, mustChangePassword: true, disabledAt: true, ...rolesSelect } },
    },
  })
}

export function deleteSession(id: number, db: DbClient = prisma) {
  return db.session.deleteMany({ where: { id } })
}

// All sessions of an account (log out everywhere), or only the expired ones.
export function deleteSessions(accountId: number, options: { onlyExpired: boolean }, db: DbClient = prisma) {
  return db.session.deleteMany({
    where: { accountId, ...(options.onlyExpired && { expiresAt: { lte: new Date() } }) },
  })
}

// Logs the account out everywhere except this session (after changing one's own password).
export function deleteOtherSessions(accountId: number, keepSessionId: number, db: DbClient = prisma) {
  return db.session.deleteMany({ where: { accountId, id: { not: keepSessionId } } })
}

// A sign-in, failed sign-in or sign-out in the change history (row changes are recorded on their own)
export function recordSignInEvent(event: Parameters<typeof recordAuditEvent>[0]) {
  return recordAuditEvent(event)
}

// --- last login, turning a login off ---

// When the employee signed in (no "by" column - always themselves; quiet in the change history, which has the sign-in)
export function setLastLogin(accountId: number, at: Date, db: DbClient = prisma) {
  return db.userAccount.update({ where: { id: accountId }, data: { lastLoginAt: at }, select: { id: true } })
}

// Turns the login off (when, by whom, why) or back on (all three null)
export function setDisabled(
  accountId: number,
  data: { disabledAt: Date | null; disabledById: number | null; disabledReason: string | null },
  actorId: ActorId,
  db: DbClient = prisma,
) {
  return db.userAccount.update({ where: { id: accountId }, data: { ...data, ...updatedBy(actorId) }, select: { id: true } })
}

// --- earlier passwords ---

// The hashes of the login's latest earlier passwords, newest first
export async function listEarlierPasswords(accountId: number, take: number, db: DbClient = prisma) {
  const rows = await db.passwordHistory.findMany({ where: { accountId }, orderBy: { id: 'desc' }, take, select: { passwordHash: true } })
  return rows.map((row) => row.passwordHash)
}

// Remembers the password the login had until now, and forgets all but the newest `keep`
export async function rememberPassword(accountId: number, passwordHash: string, keep: number, actorId: ActorId, db: DbClient = prisma) {
  await db.passwordHistory.create({ data: { accountId, passwordHash, ...createdBy(actorId) }, select: { id: true } })
  const kept = await db.passwordHistory.findMany({ where: { accountId }, orderBy: { id: 'desc' }, take: keep, select: { id: true } })
  await db.passwordHistory.deleteMany({ where: { accountId, id: { notIn: kept.map((row) => row.id) } } })
}

// --- sessions ---

const sessionSelect = { id: true, createdAt: true, lastSeenAt: true, expiresAt: true, ip: true, userAgent: true, accountId: true } satisfies Prisma.SessionSelect

// Marks the session used now (at most once a minute - the caller checks)
export function touchSession(id: number, at: Date, db: DbClient = prisma) {
  return db.session.update({ where: { id }, data: { lastSeenAt: at }, select: { id: true } })
}

// The password was re-entered: confirmed until then
export function confirmSession(id: number, until: Date, db: DbClient = prisma) {
  return db.session.update({ where: { id }, data: { confirmedUntil: until }, select: { id: true } })
}

// Every session not expired yet, with whose login it is, newest first
export function listLiveSessions(now: Date, db: DbClient = prisma) {
  return db.session.findMany({
    where: { expiresAt: { gt: now } },
    orderBy: { lastSeenAt: 'desc' },
    select: { ...sessionSelect, account: { select: { employeeId: true } } },
  })
}

// One login's sessions not expired yet, newest first
export function listAccountSessions(accountId: number, now: Date, db: DbClient = prisma) {
  return db.session.findMany({ where: { accountId, expiresAt: { gt: now } }, orderBy: { lastSeenAt: 'desc' }, select: sessionSelect })
}

// One session with whose login it is (and that login's roles - who may end it), or null
export function findSessionById(id: number, db: DbClient = prisma) {
  return db.session.findUnique({ where: { id }, select: { ...sessionSelect, account: { select: { employeeId: true, ...rolesSelect } } } })
}

// Removes every session past its end (the worker, hourly); returns how many
export async function deleteExpiredSessions(now: Date, db: DbClient = prisma) {
  return (await db.session.deleteMany({ where: { expiresAt: { lte: now } } })).count
}
