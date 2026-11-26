import { AsyncLocalStorage } from 'node:async_hooks'
import { Prisma, type PrismaClient } from '../../generated/prisma/client.js'
import { GENESIS_HASH, hashEntry, stableJson } from './hash.js'
import { currentAuditRequest } from './request.js'

// The change history is recorded here, automatically (decided 2026-11-16): a hook on the app's database client sees
// every create / change / delete of every table, reads the row before and after, and writes one audit_logs row per
// changed record - in the same transaction, so a change and its history are saved (or rolled back) together.
// - The hash chain: before its first change a transaction takes one database lock (pg_advisory_xact_lock) held until
//   it ends, so history rows are written one transaction at a time, each with the fingerprint of the row before.
//   Taking that lock FIRST in every transaction also means two transactions can never wait for each other forever.
// - Not recorded: the audit log itself and login / candidate sessions (noise). Secrets (password hashes, codes, tokens,
//   encrypted numbers) only as "(secret)".
// - Who: the record's own "by" column (updatedById / createdById - what the app decided), else the logged-in user,
//   else System. What made it: the API or script (core/audit/request.ts).

// (job_runs: the worker's own log of its runs; mail_retries: e-mails waiting to be tried again - encrypted messages;
// punches: raw machine data - their upload is recorded; attendance_days: worked out again and again from the punches -
// HR's corrections are recorded; the pay run's people / salary copy: rebuilt from the employee records on every refresh -
// the refresh itself is recorded on payroll_runs, and payroll inputs are recorded - decided 2026-11-26; the pay run's
// days: the run's copy of the locked attendance, rebuilt each time the days are worked out - recorded on payroll_runs
// (computedAt / ById) - approved 2026-11-27)
const SKIP_MODELS = new Set([
  'AuditLog', 'Session', 'CandidateSession', 'JobRun', 'MailRetry', 'Punch', 'AttendanceDay',
  'PayrollRunEmployee', 'PayrollRunSalarySegment', 'PayrollRunSalaryLine', 'PayrollRunDay',
])
const WRITES = new Set(['create', 'createMany', 'createManyAndReturn', 'update', 'updateMany', 'updateManyAndReturn', 'upsert', 'delete', 'deleteMany'])
// every row has them; who / when is the history row itself
const BOOKKEEPING = new Set(['id', 'createdAt', 'updatedAt', 'createdById', 'updatedById'])
// changed on every sign-in, which is recorded as its own event - not a change worth a line of its own
const QUIET = new Set(['lastLoginAt'])
const SECRET = /(Encrypted|Hash|Token)$/
const SECRET_VALUE = '(secret)'
// any number - only this app takes it
const LOCK_KEY = 727_0011

type Row = Record<string, unknown> & { id: number }
type Delegate = {
  findUnique(args: unknown): Promise<Row | null>
  findMany(args: unknown): Promise<Row[]>
  aggregate(args: unknown): Promise<{ _max: { id: number | null } }>
}
type Args = Record<string, any>
type TxState = { tx: Prisma.TransactionClient; locked: boolean; lastHash?: string; queue?: Promise<void> }
export type AuditEvent = {
  action: 'SIGN_IN' | 'SIGN_IN_FAILED' | 'SIGN_OUT'
  actorId: number
  employeeId?: number | null
  details?: Record<string, unknown>
}

// the transaction the app is in (set by the client's $transaction below)
const transactions = new AsyncLocalStorage<TxState>()
const delegateName = (model: string) => model[0]!.toLowerCase() + model.slice(1)
const delegate = (state: TxState, model: string) => (state.tx as unknown as Record<string, Delegate>)[delegateName(model)]!

// The app's database client with the change history, and a function to record events that are not row changes
// (sign-ins). Used once, by core/db/prisma.ts.
export function withAudit(base: PrismaClient) {
  const inOwnTransaction = <T>(fn: (state: TxState) => Promise<T>) => base.$transaction((tx) => fn({ tx, locked: false }))

  const extended = base.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || SKIP_MODELS.has(model) || !WRITES.has(operation)) return query(args)
          const state = transactions.getStore()
          if (state) return capture(state, model, operation, args as Args, (a) => query(a as never))
          // not inside a transaction: one of its own, so the change and its history are saved together
          return inOwnTransaction((own) =>
            capture(own, model, operation, args as Args, (a) => (delegate(own, model) as unknown as Record<string, (x: unknown) => Promise<unknown>>)[operation]!(a)),
          )
        },
      },
    },
  })

  // $transaction(fn) remembers the transaction, so the hook writes the history inside it
  const client = new Proxy(extended, {
    get(target, prop) {
      if (prop === '$transaction') {
        return (fn: unknown, options?: unknown) =>
          typeof fn === 'function'
            ? target.$transaction((tx) => transactions.run({ tx: tx as Prisma.TransactionClient, locked: false }, () => (fn as (t: unknown) => Promise<unknown>)(tx)), options as never)
            : target.$transaction(fn as never, options as never)
      }
      const value: unknown = Reflect.get(target, prop)
      return typeof value === 'function' ? value.bind(target) : value
    },
    // a query-only hook changes no model API, so the app keeps the plain client's type
  }) as unknown as PrismaClient

  // An event that is not a row change (sign in / out), in the current transaction or one of its own
  async function record(event: AuditEvent) {
    const write = (state: TxState) =>
      writeEntry(state, {
        action: event.action,
        createdById: event.actorId,
        model: null,
        recordId: null,
        employeeId: event.employeeId ?? null,
        candidateId: null,
        changes: null,
        details: event.details ?? null,
      })
    const state = transactions.getStore()
    return state ? write(state) : inOwnTransaction(write)
  }

  return { client, record }
}

// Runs `fn` as if outside any transaction - its writes save (with their history) on their own. For the worker, whose
// lock is held in a transaction while the job's work runs.
export function outsideTransaction<T>(fn: () => T): T {
  return transactions.exit(fn)
}

// --- one write ---

async function capture(state: TxState, model: string, operation: string, args: Args, run: (args: Args) => Promise<unknown>) {
  await lock(state)
  const d = delegate(state, model)
  switch (operation) {
    case 'create': {
      // the new row's id is needed - asked for when the caller's select leaves it out, and removed again
      const addId = !!args.select && !args.select.id
      const result = (await run(addId ? { ...args, select: { ...args.select, id: true } } : args)) as Row
      const after = await d.findUnique({ where: { id: result.id } })
      if (after) await writeChange(state, 'CREATE', model, null, after, args.data)
      if (addId) delete (result as Partial<Row>).id
      return result
    }
    case 'update': {
      const before = await d.findUnique({ where: args.where })
      const result = await run(args)
      const after = before && (await d.findUnique({ where: { id: before.id } }))
      if (before && after) await writeChange(state, 'UPDATE', model, before, after, args.data)
      return result
    }
    case 'upsert': {
      const before = await d.findUnique({ where: args.where })
      const result = await run(args)
      const after = await d.findUnique({ where: before ? { id: before.id } : args.where })
      if (after) await writeChange(state, before ? 'UPDATE' : 'CREATE', model, before, after, before ? args.update : args.create)
      return result
    }
    case 'delete': {
      const before = await d.findUnique({ where: args.where })
      const result = await run(args)
      if (before) await writeChange(state, 'DELETE', model, before, null)
      return result
    }
    case 'createMany':
    case 'createManyAndReturn': {
      // the new rows are those after the highest id before: nobody else can insert meanwhile (the lock above)
      const highest = (await d.aggregate({ _max: { id: true } }))._max.id ?? 0
      const result = await run(args)
      for (const after of await d.findMany({ where: { id: { gt: highest } }, orderBy: { id: 'asc' } })) await writeChange(state, 'CREATE', model, null, after)
      return result
    }
    case 'updateMany':
    case 'updateManyAndReturn': {
      const befores = await d.findMany({ where: args.where })
      const result = await run(args)
      if (befores.length) {
        const afters = new Map((await d.findMany({ where: { id: { in: befores.map((b) => b.id) } } })).map((a) => [a.id, a]))
        for (const before of befores) {
          const after = afters.get(before.id)
          if (after) await writeChange(state, 'UPDATE', model, before, after, args.data)
        }
      }
      return result
    }
    case 'deleteMany': {
      const befores = await d.findMany({ where: args.where })
      const result = await run(args)
      for (const before of befores) await writeChange(state, 'DELETE', model, before, null)
      return result
    }
    default:
      return run(args)
  }
}

async function lock(state: TxState) {
  if (state.locked) return
  state.locked = true
  await state.tx.$queryRaw`SELECT pg_advisory_xact_lock(${LOCK_KEY})::text AS locked`
}

async function writeChange(state: TxState, action: 'CREATE' | 'UPDATE' | 'DELETE', model: string, before: Row | null, after: Row | null, data?: unknown) {
  const changes = diff(before, after, data)
  if (action === 'UPDATE' && !Object.keys(changes).length) return
  const row = (after ?? before)!
  const request = currentAuditRequest()
  const by = (value: unknown) => (typeof value === 'number' ? value : undefined)
  // the record's own "by" column says who the app decided did it; a delete leaves none
  const actorId = (action === 'DELETE' ? undefined : (by(after?.updatedById) ?? by(after?.createdById))) ?? request.actorId ?? 0
  // whose record: the employee itself, a row of theirs (employeeId), or a row of their login (accountId - roles given)
  const employeeId =
    model === 'Employee'
      ? row.id
      : (by(row.employeeId) ??
        (typeof row.accountId === 'number'
          ? ((await state.tx.userAccount.findUnique({ where: { id: row.accountId }, select: { employeeId: true } }))?.employeeId ?? null)
          : null))
  await writeEntry(state, {
    action,
    createdById: actorId,
    model,
    recordId: row.id,
    employeeId,
    candidateId: model === 'Candidate' ? row.id : (by(row.candidateId) ?? null),
    changes,
    details: null,
  })
}

type Entry = {
  action: string
  createdById: number
  model: string | null
  recordId: number | null
  employeeId: number | null
  candidateId: number | null
  changes: Record<string, unknown> | null
  details: Record<string, unknown> | null
}

// Appends one row to the chain. Rows of one transaction are written one after another (a queue), so two changes
// made at the same moment never take the same "row before".
function writeEntry(state: TxState, entry: Entry): Promise<void> {
  state.queue = (state.queue ?? Promise.resolve()).then(async () => {
    await lock(state)
    state.lastHash ??= (await state.tx.auditLog.findFirst({ orderBy: { id: 'desc' }, select: { hash: true } }))?.hash ?? GENESIS_HASH
    const request = currentAuditRequest()
    const full = { ...entry, source: request.source, ip: request.ip, userAgent: request.userAgent, createdAt: new Date() }
    const hash = hashEntry(state.lastHash, full)
    await state.tx.auditLog.create({
      data: {
        ...full,
        action: full.action as never,
        changes: (full.changes as Prisma.InputJsonValue | null) ?? Prisma.DbNull,
        details: (full.details as Prisma.InputJsonValue | null) ?? Prisma.DbNull,
        previousHash: state.lastHash,
        hash,
        updatedAt: full.createdAt,
        updatedById: full.createdById,
      },
    })
    state.lastHash = hash
  })
  return state.queue
}

// --- what changed ---

// The fields that differ, as { field: [before, after] } (a create: the values given; a delete: the values removed).
// Rows linked in the same write (e.g. an employee's addresses on the joining day) are noted as "N added".
function diff(before: Row | null, after: Row | null, data?: unknown): Record<string, unknown> {
  const changes: Record<string, unknown> = {}
  for (const key of new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])) {
    if (BOOKKEEPING.has(key) || QUIET.has(key)) continue
    const old = plain(before?.[key])
    const now = plain(after?.[key])
    if (stableJson(old) === stableJson(now)) continue
    if (!before && now === null) continue
    if (!after && old === null) continue
    changes[key] = SECRET.test(key) ? [old === null ? null : SECRET_VALUE, now === null ? null : SECRET_VALUE] : [old, now]
  }
  if (data && typeof data === 'object') {
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (key in changes || !value || typeof value !== 'object' || value instanceof Date || Array.isArray(value)) continue
      const nested = value as Record<string, unknown>
      const created = Array.isArray(nested.create) ? nested.create.length : nested.create ? 1 : 0
      const many = (nested.createMany as { data?: unknown[] } | undefined)?.data?.length ?? 0
      if (created + many) changes[key] = [null, `${created + many} added`]
      else if (['update', 'updateMany', 'delete', 'deleteMany', 'upsert', 'set', 'connect', 'disconnect'].some((op) => op in nested)) changes[key] = [null, 'changed']
    }
  }
  return changes
}

// A value as stored in the history (JSON): dates as ISO text, decimals as text
function plain(value: unknown): unknown {
  if (value === undefined || value === null) return null
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'bigint') return value.toString()
  if (Prisma.Decimal.isDecimal(value)) return (value as { toString(): string }).toString()
  if (value instanceof Uint8Array) return '(file data)'
  return value
}
