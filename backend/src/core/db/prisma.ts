import { PrismaPg } from '@prisma/adapter-pg'
import { withAudit } from '../audit/capture.js'
import { env } from '../config/env.js'
import { PrismaClient, type Prisma } from '../../generated/prisma/client.js'

// One shared database client for the whole app.
// TimeZone=UTC: the Prisma pg adapter sends timestamps without an offset, so Postgres reads them in the
// connection's time zone. With a non-UTC server (e.g. Asia/Kolkata) every stored time would be shifted.
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL, options: '-c TimeZone=UTC' })

// Transactions may wait a moment for the change history's lock (core/audit/capture.ts), so they get more time than
// Prisma's default 5 s.
const base = new PrismaClient({ adapter, transactionOptions: { maxWait: 10_000, timeout: 30_000 } })

// Every create / change / delete made through `prisma` is recorded in the change history (audit_logs), in the same
// transaction (decided 2026-11-16).
const audited = withAudit(base)
export const prisma = audited.client

// Records a sign-in / sign-out in the change history (row changes are recorded automatically). For repositories.
export const recordAuditEvent = audited.record

// Either the shared client or a transaction. Services take `db: DbClient = prisma`
// so a caller can run several services inside one prisma.$transaction(...).
export type DbClient = Prisma.TransactionClient

// WHO did something - every table has createdById / updatedById (and <action>ById next to other action times).
// It is the employees.id of the logged-in employee (context.user.employeeId), or SYSTEM_ACTOR for scripts,
// migrations and automatic jobs. Repositories take it as a required parameter on every create / update.
export type ActorId = number
export const SYSTEM_ACTOR: ActorId = 0

// The "by" columns of a new row, and of a change
export const createdBy = (actorId: ActorId) => ({ createdById: actorId, updatedById: actorId })
export const updatedBy = (actorId: ActorId) => ({ updatedById: actorId })
// Data for a new row without its "by" columns - the repository adds them from the actorId
export type NewRow<T> = Omit<T, 'createdById' | 'updatedById'>

// Re-export generated types and enums so modules import everything database-related from '#core/db/prisma'.
export * from '../../generated/prisma/client.js'
