import { ORPCError } from '@orpc/server'
import { assertAccess } from '#core/auth/access'
import { assertWholeSlice, levelOver, wholeCompanyScopeOf } from '#core/auth/scope'
import { decrypt } from '#core/crypto/encryption'
import { prisma, type DbClient } from '#core/db/prisma'
import { reportFile, reportSheet } from '#core/excel/report'
import type { CurrentUser } from '#core/rpc/procedures'
import { employeesService } from '#modules/employees'
import { companiesService } from '#modules/organization'
import { today } from '#shared/utils/dates'
import { fromPaise, toPaise } from '#shared/utils/money'
import * as statutoryService from '../statutory/statutory.service.js'
import * as paymentsRepository from './payments.repository.js'
import type { BatchesInput, CreateBatchInput, HoldInput, MarkPaidInput, MarkReturnedInput, OwedInput, OwedState, ReleaseHoldInput } from './payments.schema.js'

// Payroll stage 6 slice 2 (approved by the user 2026-11-28): paying the approved runs. Each person of a FINALISED run is
// paid their net pay as the run worked it out, in batches of one company (a bank transfer, cheques or cash): made up
// (OPEN), sent (uploaded / handed over), then each payment paid - with the day and the bank's reference - or returned with
// the bank's reason (it is owed again and paid in a later batch); a batch closes once nothing in it waits. Pay can be held
// with a reason and released. Everything not paid yet is owed, worked out from these rows (the owed list), with the days
// overdue from the payroll setting `paymentDueDays`. Access: the "Payroll payments" area over the whole company (apart
// from preparing the payroll - the user's choice); nobody acts on their own payment (adding, removing, holding, releasing,
// marking it paid or returned on its own). A batch-wide step (sent, paid, given up) covers everyone in it.

const DAY = 86_400_000
const companySlice = (companyId: number) => ({ companyId, plantId: null, departmentId: null })
const MONTH = new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' })
const sum = (amounts: number[]) => fromPaise(amounts.reduce((total, a) => total + toPaise(a), 0))
const calendarDay = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))

// The companies whose payments the viewer sees (Payroll payments over the whole company) and whether they may pay them
async function companiesOf(viewer: CurrentUser) {
  return (await companiesService.listCompanies())
    .map((c) => ({ id: c.id, code: c.code, name: c.name, level: levelOver(viewer, 'PAYROLL_PAYMENTS', companySlice(c.id)) }))
    .filter((c) => c.level !== undefined)
    .map(({ level, ...c }) => ({ ...c, canPay: level === 'WRITE' }))
}

// A company's payments may be changed by the viewer: seen (else NOT_FOUND - never reveal it), then Edit over the whole company
function assertMayPay(viewer: CurrentUser, companyId: number, what: string) {
  if (levelOver(viewer, 'PAYROLL_PAYMENTS', companySlice(companyId)) === undefined) throw new ORPCError('NOT_FOUND', { message: 'Not found' })
  assertWholeSlice(viewer, 'PAYROLL_PAYMENTS', companySlice(companyId), what)
}

const ownRefused = () => new ORPCError('FORBIDDEN', { message: 'Nobody acts on their own payment - ask a colleague with Payroll payments access' })

// --- What is owed ---

export async function listOwed(viewer: CurrentUser, input: OwedInput) {
  assertAccess(viewer.access, 'PAYROLL_PAYMENTS', 'READ')
  const scope = wholeCompanyScopeOf(viewer, 'PAYROLL_PAYMENTS')
  const [rows, settings, companies] = await Promise.all([
    paymentsRepository.listUnpaid(scope, { companyId: input.companyId, runId: input.runId }),
    statutoryService.runSettings(),
    companiesOf(viewer),
  ])
  const [nets, accounts, person] = await Promise.all([
    paymentsRepository.netsOf(rows.map((r) => r.id)),
    employeesService.listSalaryAccounts([...new Set(rows.map((r) => r.employeeId))]),
    employeesService.lookupPeople(rows.flatMap((r) => [r.employeeId, r.paymentHolds[0]?.createdById])),
  ])
  const now = today()
  const all = rows.flatMap((r) => {
    const amount = nets.get(r.id) ?? 0
    // nothing to pay (net nil)
    if (amount <= 0) return []
    const payment = r.payments[0]
    const hold = r.paymentHolds[0]
    const account = accounts.get(r.employeeId)
    const state: OwedState = payment?.status === 'IN_BATCH' ? 'IN_BATCH' : hold ? 'HELD' : payment?.status === 'RETURNED' ? 'RETURNED' : !account ? 'NO_ACCOUNT' : 'TO_PAY'
    const dueOn = new Date(r.run.attendanceTo.getTime() + settings.paymentDueDays * DAY)
    return [
      {
        personId: r.id,
        employeeCode: r.employeeCode,
        name: person(r.employeeId)?.name ?? '',
        run: { id: r.run.id, payMonth: r.run.payMonth },
        company: r.run.company,
        amount,
        state,
        batchId: payment?.status === 'IN_BATCH' ? payment.batchId : null,
        returned: payment?.status === 'RETURNED' ? { reason: payment.returnReason, at: payment.returnedAt } : null,
        hold: hold ? { reason: hold.reason, at: hold.createdAt, by: person(hold.createdById) } : null,
        account: account ? { bankName: account.bankName, last4: account.accountNumberLast4 } : null,
        dueOn,
        daysOverdue: Math.max(0, Math.round((now.getTime() - dueOn.getTime()) / DAY)),
        // one's own pay: someone else pays it
        own: r.employeeId === viewer.employeeId,
      },
    ]
  })
  const counts = Object.fromEntries(
    (['TO_PAY', 'NO_ACCOUNT', 'HELD', 'IN_BATCH', 'RETURNED'] as const).map((s) => {
      const of = all.filter((p) => p.state === s)
      return [s, { count: of.length, amount: sum(of.map((p) => p.amount)) }]
    }),
  ) as Record<OwedState, { count: number; amount: number }>
  const text = input.search?.toLowerCase()
  const matching = all.filter((p) => (!input.state || p.state === input.state) && (!text || p.employeeCode.toLowerCase().includes(text) || p.name.toLowerCase().includes(text)))
  // the runs with something owed, for the filter
  const runs = [...new Map(all.map((p) => [p.run.id, { id: p.run.id, payMonth: p.run.payMonth, company: p.company }])).values()]
  return {
    items: matching.slice((input.page - 1) * input.pageSize, input.page * input.pageSize),
    total: matching.length,
    counts,
    owed: { count: all.length, amount: sum(all.map((p) => p.amount)) },
    paymentDueDays: settings.paymentDueDays,
    companies,
    runs,
  }
}

// Where one approved run's people stand (the run page): paid, in a batch, held, returned, to pay - null for a run not final
// or a viewer without Payroll payments over its company
export async function runSummaryOf(viewer: CurrentUser, run: { id: number; company: { id: number }; status: string }) {
  if (run.status !== 'FINALISED' || levelOver(viewer, 'PAYROLL_PAYMENTS', companySlice(run.company.id)) === undefined) return null
  const all = await paymentsRepository.listRunPeople(run.id)
  // (nothing to pay - net nil - is left out, as on the owed list)
  const nets = await paymentsRepository.netsOf(all.map((p) => p.id))
  const people = all.filter((p) => (nets.get(p.id) ?? 0) > 0)
  const stateOf = (p: (typeof people)[number]) =>
    p.payments[0]?.status === 'PAID' ? 'paid' : p.payments[0]?.status === 'IN_BATCH' ? 'inBatch' : p.paymentHolds.length ? 'held' : p.payments[0]?.status === 'RETURNED' ? 'returned' : 'toPay'
  const counts = { paid: 0, inBatch: 0, held: 0, returned: 0, toPay: 0 }
  for (const p of people) counts[stateOf(p)]++
  return { ...counts, total: people.length }
}

// --- Batches ---

export async function listBatches(viewer: CurrentUser, input: BatchesInput) {
  assertAccess(viewer.access, 'PAYROLL_PAYMENTS', 'READ')
  const scope = wholeCompanyScopeOf(viewer, 'PAYROLL_PAYMENTS')
  const [{ items, total }, companies] = await Promise.all([
    paymentsRepository.listBatches(scope, { companyId: input.companyId, status: input.status }, { skip: (input.page - 1) * input.pageSize, take: input.pageSize }),
    companiesOf(viewer),
  ])
  const [counts, person] = await Promise.all([paymentsRepository.countsOf(items.map((b) => b.id)), employeesService.lookupPeople(items.map((b) => b.createdById))])
  return {
    items: items.map(({ createdById, sentById: _sent, closedById: _closed, ...b }) => {
      const of = (status: string) => counts.find((c) => c.batchId === b.id && c.status === status) ?? { count: 0, amount: 0 }
      const live = counts.filter((c) => c.batchId === b.id && c.status !== 'REMOVED')
      return {
        ...b,
        createdBy: person(createdById),
        payments: live.reduce((n, c) => n + c.count, 0),
        amount: sum(live.map((c) => c.amount)),
        paid: of('PAID'),
        inBatch: of('IN_BATCH'),
        returned: of('RETURNED'),
      }
    }),
    total,
    companies,
  }
}

async function batchFor(viewer: CurrentUser, id: number, db?: DbClient) {
  const batch = await paymentsRepository.findBatch(id, wholeCompanyScopeOf(viewer, 'PAYROLL_PAYMENTS'), db)
  if (!batch) throw new ORPCError('NOT_FOUND', { message: 'No payment batch found' })
  return batch
}

// One batch with its payments (the account by bank and last 4 digits - the full number only in the payment list)
export async function getBatch(viewer: CurrentUser, { id }: { id: number }) {
  assertAccess(viewer.access, 'PAYROLL_PAYMENTS', 'READ')
  const batch = await batchFor(viewer, id)
  const payments = await paymentsRepository.listPayments(batch.id)
  const person = await employeesService.lookupPeople([
    batch.createdById,
    batch.sentById,
    batch.closedById,
    ...payments.flatMap((p) => [p.runEmployee.employeeId, p.paidById, p.returnedById, p.removedById]),
  ])
  const live = payments.filter((p) => p.status !== 'REMOVED')
  const { createdById, sentById, closedById, ...rest } = batch
  return {
    ...rest,
    createdBy: person(createdById),
    sentBy: person(sentById),
    closedBy: person(closedById),
    canChange: levelOver(viewer, 'PAYROLL_PAYMENTS', companySlice(batch.company.id)) === 'WRITE',
    totals: {
      payments: live.length,
      amount: sum(live.map((p) => p.amount)),
      paid: sum(live.filter((p) => p.status === 'PAID').map((p) => p.amount)),
      paidCount: live.filter((p) => p.status === 'PAID').length,
      inBatchCount: live.filter((p) => p.status === 'IN_BATCH').length,
      returnedCount: live.filter((p) => p.status === 'RETURNED').length,
    },
    payments: payments.map((p) => ({
      id: p.id,
      personId: p.runEmployee.id,
      employeeCode: p.runEmployee.employeeCode,
      name: person(p.runEmployee.employeeId)?.name ?? '',
      run: p.runEmployee.run,
      amount: p.amount,
      status: p.status,
      account: p.accountNumberLast4 ? { bankName: p.bankName, last4: p.accountNumberLast4, ifsc: p.ifsc } : null,
      chequeNumber: p.chequeNumber,
      paidOn: p.paidOn,
      bankReference: p.bankReference,
      paidAt: p.paidAt,
      paidBy: person(p.paidById),
      returnReason: p.returnReason,
      returnedAt: p.returnedAt,
      returnedBy: person(p.returnedById),
      removedAt: p.removedAt,
      removedBy: person(p.removedById),
      own: p.runEmployee.employeeId === viewer.employeeId,
    })),
  }
}

// A new batch of these people of one company's approved runs - each with pay worked out, not held, not in a batch or paid
// already, never the viewer; a bank transfer needs a salary account (copied onto the payment). Everything is checked
// before anything is saved; a problem lists who cannot be paid and why.
export async function createBatch(viewer: CurrentUser, input: CreateBatchInput) {
  assertAccess(viewer.access, 'PAYROLL_PAYMENTS', 'WRITE')
  assertMayPay(viewer, input.companyId, 'Paying salaries')
  const ids = [...new Set(input.personIds)]
  return prisma.$transaction(
    async (tx) => {
      // (holding them at the same moment waits for this - never held and in a batch at once)
      await paymentsRepository.lockPeople(ids, tx)
      const people = await paymentsRepository.listPayable(ids, tx)
      if (people.length !== ids.length) throw new ORPCError('NOT_FOUND', { message: 'A person picked is not in a pay run - reload the list' })
      if (people.some((p) => p.employeeId === viewer.employeeId)) throw ownRefused()
      const [nets, accounts] = await Promise.all([paymentsRepository.netsOf(ids, tx), employeesService.listSalaryAccounts(people.map((p) => p.employeeId), tx)])
      const problems = people.flatMap((p) => {
        const why =
          p.run.companyId !== input.companyId || p.run.status !== 'FINALISED'
            ? 'not in an approved run of this company'
            : p.paymentHolds.length
              ? 'pay held - release it first'
              : p.payments.length
                ? 'already in a batch or paid'
                : (nets.get(p.id) ?? 0) <= 0
                  ? 'nothing to pay'
                  : input.method === 'BANK' && !accounts.get(p.employeeId)
                    ? 'no salary account - pay by cheque or cash, or add the account first'
                    : null
        return why ? [`${p.employeeCode} (${why})`] : []
      })
      if (problems.length) {
        throw new ORPCError('CONFLICT', { message: `${problems.length} of the people picked cannot be paid in this batch: ${problems.slice(0, 10).join('; ')}${problems.length > 10 ? '…' : ''}` })
      }
      const batch = await paymentsRepository.createBatch({ companyId: input.companyId, method: input.method, note: input.note || null }, viewer.employeeId, tx)
      await paymentsRepository.createPayments(
        people.map((p) => {
          const account = input.method === 'BANK' ? accounts.get(p.employeeId) : undefined
          return {
            payrollRunEmployeeId: p.id,
            batchId: batch.id,
            amount: nets.get(p.id)!,
            bankName: account?.bankName ?? null,
            accountNumberEncrypted: account?.accountNumberEncrypted ?? null,
            accountNumberLast4: account?.accountNumberLast4 ?? null,
            ifsc: account?.ifsc ?? null,
          }
        }),
        viewer.employeeId,
        tx,
      )
      return { id: batch.id }
    },
    { timeout: 60_000 },
  )
}

// Takes a payment out of a batch not sent yet (kept as REMOVED); the person is to pay again
export async function removePayment(viewer: CurrentUser, { paymentId }: { paymentId: number }) {
  assertAccess(viewer.access, 'PAYROLL_PAYMENTS', 'WRITE')
  const payment = await paymentsRepository.findPayment(paymentId, wholeCompanyScopeOf(viewer, 'PAYROLL_PAYMENTS'))
  if (!payment) throw new ORPCError('NOT_FOUND', { message: 'No payment found' })
  assertMayPay(viewer, payment.batch.company.id, 'Paying salaries')
  if (payment.runEmployee.employeeId === viewer.employeeId) throw ownRefused()
  if (payment.batch.status !== 'OPEN') throw new ORPCError('CONFLICT', { message: 'Only a batch not sent yet can change - mark the payment returned instead' })
  if (!(await paymentsRepository.updatePaymentIf(paymentId, ['IN_BATCH'], { status: 'REMOVED', removedAt: new Date(), removedById: viewer.employeeId }, viewer.employeeId, prisma))) {
    throw new ORPCError('CONFLICT', { message: 'This payment changed a moment ago - reload the batch' })
  }
  return { removed: true }
}

// Marks a batch sent (uploaded to the bank, cheques or cash handed over) - from then on its payments are paid or returned
export async function sendBatch(viewer: CurrentUser, { id }: { id: number }) {
  assertAccess(viewer.access, 'PAYROLL_PAYMENTS', 'WRITE')
  const batch = await batchFor(viewer, id)
  assertMayPay(viewer, batch.company.id, 'Paying salaries')
  if (batch.status !== 'OPEN') throw new ORPCError('CONFLICT', { message: 'This batch is already sent' })
  if (!(await paymentsRepository.listInBatch(batch.id)).length) throw new ORPCError('BAD_REQUEST', { message: 'The batch has nobody to pay' })
  if (!(await paymentsRepository.updateBatchIf(batch.id, 'OPEN', { status: 'SENT', sentAt: new Date(), sentById: viewer.employeeId }, viewer.employeeId, prisma))) {
    throw new ORPCError('CONFLICT', { message: 'This batch changed a moment ago - reload it' })
  }
  return { sent: true }
}

// Closes a sent batch once nothing in it waits any more (inside the caller's transaction)
async function closeIfDone(batchId: number, actorId: number, tx: DbClient) {
  if (!(await paymentsRepository.listInBatch(batchId, tx)).length) {
    await paymentsRepository.updateBatchIf(batchId, 'SENT', { status: 'CLOSED', closedAt: new Date(), closedById: actorId }, actorId, tx)
  }
}

// Marks payments of a sent batch paid on a day, with the bank's reference: the ones listed, or every one still in it; a
// cheque one at a time with its number. The batch closes when nothing in it waits.
export async function markPaid(viewer: CurrentUser, input: MarkPaidInput) {
  assertAccess(viewer.access, 'PAYROLL_PAYMENTS', 'WRITE')
  const batch = await batchFor(viewer, input.batchId)
  assertMayPay(viewer, batch.company.id, 'Paying salaries')
  if (batch.status !== 'SENT') throw new ORPCError('CONFLICT', { message: batch.status === 'OPEN' ? 'Mark the batch sent first' : 'This batch is closed' })
  const paidOn = calendarDay(input.paidOn)
  if (paidOn > today()) throw new ORPCError('BAD_REQUEST', { message: 'The day it was paid cannot be in the future' })
  if (batch.method === 'CHEQUE' ? !input.chequeNumber || input.paymentIds?.length !== 1 : !!input.chequeNumber) {
    throw new ORPCError('BAD_REQUEST', { message: batch.method === 'CHEQUE' ? 'A cheque is marked paid one at a time, with its number' : 'Only a cheque has a cheque number' })
  }
  return prisma.$transaction(async (tx) => {
    const waiting = await paymentsRepository.listInBatch(batch.id, tx)
    if (input.paymentIds) {
      const inBatch = new Map(waiting.map((p) => [p.id, p]))
      if (input.paymentIds.some((id) => !inBatch.has(id))) throw new ORPCError('CONFLICT', { message: 'A payment picked is no longer waiting in this batch - reload it' })
      if (input.paymentIds.some((id) => inBatch.get(id)!.runEmployee.employeeId === viewer.employeeId)) throw ownRefused()
    }
    const paid = await paymentsRepository.updatePaymentsIf(
      batch.id,
      input.paymentIds,
      { status: 'PAID', paidOn, bankReference: input.reference ?? null, chequeNumber: input.chequeNumber ?? null, paidAt: new Date(), paidById: viewer.employeeId },
      viewer.employeeId,
      tx,
    )
    if (!paid) throw new ORPCError('CONFLICT', { message: 'Nothing in this batch waits to be paid - reload it' })
    await closeIfDone(batch.id, viewer.employeeId, tx)
    return { paid }
  })
}

// The bank returned a payment (or took it back after paying): RETURNED with its reason - the person is owed it again
export async function markReturned(viewer: CurrentUser, { paymentId, reason }: MarkReturnedInput) {
  assertAccess(viewer.access, 'PAYROLL_PAYMENTS', 'WRITE')
  const payment = await paymentsRepository.findPayment(paymentId, wholeCompanyScopeOf(viewer, 'PAYROLL_PAYMENTS'))
  if (!payment) throw new ORPCError('NOT_FOUND', { message: 'No payment found' })
  assertMayPay(viewer, payment.batch.company.id, 'Paying salaries')
  if (payment.runEmployee.employeeId === viewer.employeeId) throw ownRefused()
  const sentOrPaid = (payment.status === 'IN_BATCH' && payment.batch.status === 'SENT') || payment.status === 'PAID'
  if (!sentOrPaid) throw new ORPCError('CONFLICT', { message: 'Only a payment sent or paid can be returned - take it out of the batch instead' })
  return prisma.$transaction(async (tx) => {
    const from = payment.status as 'IN_BATCH' | 'PAID'
    if (!(await paymentsRepository.updatePaymentIf(paymentId, [from], { status: 'RETURNED', returnReason: reason, returnedAt: new Date(), returnedById: viewer.employeeId }, viewer.employeeId, tx))) {
      throw new ORPCError('CONFLICT', { message: 'This payment changed a moment ago - reload the batch' })
    }
    if (from === 'IN_BATCH') await closeIfDone(payment.batchId, viewer.employeeId, tx)
    return { returned: true }
  })
}

// Gives up a batch not sent yet: its payments are taken out (REMOVED) and it is closed
export async function cancelBatch(viewer: CurrentUser, { id }: { id: number }) {
  assertAccess(viewer.access, 'PAYROLL_PAYMENTS', 'WRITE')
  const batch = await batchFor(viewer, id)
  assertMayPay(viewer, batch.company.id, 'Paying salaries')
  if (batch.status !== 'OPEN') throw new ORPCError('CONFLICT', { message: 'Only a batch not sent yet can be given up - mark its payments returned instead' })
  return prisma.$transaction(async (tx) => {
    await paymentsRepository.updatePaymentsIf(batch.id, undefined, { status: 'REMOVED', removedAt: new Date(), removedById: viewer.employeeId }, viewer.employeeId, tx)
    if (!(await paymentsRepository.updateBatchIf(batch.id, 'OPEN', { status: 'CLOSED', closedAt: new Date(), closedById: viewer.employeeId }, viewer.employeeId, tx))) {
      throw new ORPCError('CONFLICT', { message: 'This batch changed a moment ago - reload it' })
    }
    return { cancelled: true }
  })
}

// The plain payment list of a bank-transfer batch (the payments still in it) as Excel - with the FULL account numbers,
// needed to pay; our own sheet, not the bank's upload format (that comes when finance gives it)
export async function paymentList(viewer: CurrentUser, { id }: { id: number }) {
  assertAccess(viewer.access, 'PAYROLL_PAYMENTS', 'WRITE')
  const batch = await batchFor(viewer, id)
  assertMayPay(viewer, batch.company.id, 'The payment list')
  if (batch.method !== 'BANK') throw new ORPCError('BAD_REQUEST', { message: 'Only a bank-transfer batch has a payment list' })
  const payments = (await paymentsRepository.listPayments(batch.id)).filter((p) => p.status === 'IN_BATCH')
  if (!payments.length) throw new ORPCError('BAD_REQUEST', { message: 'Nothing in this batch waits to be paid' })
  const person = await employeesService.lookupPeople(payments.map((p) => p.runEmployee.employeeId))
  const rows = payments.map((p) => ({
    code: p.runEmployee.employeeCode,
    name: person(p.runEmployee.employeeId)?.name ?? '',
    bank: p.bankName,
    account: p.accountNumberEncrypted ? decrypt(p.accountNumberEncrypted) : '',
    ifsc: p.ifsc,
    amount: p.amount,
    narration: `Salary ${MONTH.format(p.runEmployee.run.payMonth)}`,
  }))
  const total = sum(rows.map((r) => r.amount))
  return reportFile(
    [
      reportSheet('Payment list', rows, [
        { header: 'Employee code', text: true, width: 14, value: (r) => r.code },
        { header: 'Name', width: 28, value: (r) => r.name },
        { header: 'Bank', width: 22, value: (r) => r.bank },
        { header: 'Account number', text: true, width: 22, value: (r) => r.account },
        { header: 'IFSC', text: true, width: 14, value: (r) => r.ifsc },
        { header: 'Amount', width: 14, value: (r) => r.amount },
        { header: 'Narration', width: 22, value: (r) => r.narration },
      ]),
    ],
    {
      title: `Payment list · ${batch.company.code} · batch ${batch.id}`,
      preparedBy: `${viewer.name} (${viewer.employeeCode})`,
      coverage: `${rows.length} payments, ${total.toLocaleString('en-IN', { minimumFractionDigits: 2 })} in total. A plain list made by the HRMS - not the bank's own upload format. It holds full bank account numbers: keep it safe and delete it once the payment is made.`,
      filters: [{ label: 'Company', value: `${batch.company.code} · ${batch.company.name}` }],
    },
    `payment-list-${batch.company.code}-batch-${batch.id}`,
  )
}

// --- Holds ---

async function personFor(viewer: CurrentUser, personId: number) {
  const person = await paymentsRepository.findPerson(personId)
  if (!person || levelOver(viewer, 'PAYROLL_PAYMENTS', companySlice(person.run.companyId)) === undefined) {
    throw new ORPCError('NOT_FOUND', { message: 'This person is not in a pay run' })
  }
  assertMayPay(viewer, person.run.companyId, 'Holding pay')
  if (person.employeeId === viewer.employeeId) throw ownRefused()
  return person
}

// Holds a person's pay of an approved run (left out of batches) with a reason - the person locked first, so a batch
// made at the same moment waits (never held and in a batch at once)
export async function hold(viewer: CurrentUser, { personId, reason }: HoldInput) {
  assertAccess(viewer.access, 'PAYROLL_PAYMENTS', 'WRITE')
  await personFor(viewer, personId)
  return prisma.$transaction(async (tx) => {
    await paymentsRepository.lockPeople([personId], tx)
    const person = (await paymentsRepository.findPerson(personId, tx))!
    if (person.run.status !== 'FINALISED') throw new ORPCError('CONFLICT', { message: 'Only the pay of an approved run can be held' })
    if (person.payments.length) throw new ORPCError('CONFLICT', { message: 'Already in a batch or paid - take it out of the batch first' })
    if (person.paymentHolds.length) throw new ORPCError('CONFLICT', { message: 'This pay is already held' })
    await paymentsRepository.createHold(person.id, reason, viewer.employeeId, tx)
    return { held: true }
  })
}

// Releases a held pay: the person is to pay again
export async function releaseHold(viewer: CurrentUser, { personId, note }: ReleaseHoldInput) {
  assertAccess(viewer.access, 'PAYROLL_PAYMENTS', 'WRITE')
  const person = await personFor(viewer, personId)
  const open = person.paymentHolds[0]
  if (!open || !(await paymentsRepository.releaseHold(open.id, note || null, viewer.employeeId))) throw new ORPCError('CONFLICT', { message: 'This pay is not held' })
  return { released: true }
}
