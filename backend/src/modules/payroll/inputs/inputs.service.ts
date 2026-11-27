import { ORPCError } from '@orpc/server'
import { prisma } from '#core/db/prisma'
import type { CurrentUser } from '#core/rpc/procedures'
import { employeesService } from '#modules/employees'
import { salaryComponentsService } from '#modules/organization'
import * as calculationRepository from '../calculation/calculation.repository.js'
import { draftRunFor, runFor } from '../people/people.service.js'
import * as inputsRepository from './inputs.repository.js'
import type { InputsListInput } from './inputs.schema.js'

// Payroll stage 2 (approved 2026-11-26): amounts typed for a person in a run - an incentive, a canteen recovery. Only
// while the run is a draft, only by someone with Payroll Edit covering the whole company (a plant-level HR person sends
// their figures to them - the user, 2026-11-26), never for one's own record, and only with a component marked "entered
// monthly". Every input is kept in the change history. A change to a person's inputs removes the pay worked out for them
// (stage 3): the run then lists them as "work out again" until the pay is worked out once more.

// The component, active and marked "entered monthly"
async function monthlyComponent(id: number) {
  const component = (await salaryComponentsService.listSalaryComponents()).find((c) => c.id === id)
  if (!component) throw new ORPCError('BAD_REQUEST', { message: 'Choose an active salary component' })
  if (!component.enteredMonthly) throw new ORPCError('BAD_REQUEST', { message: `${component.name} comes from the salary - only components entered each month can be typed here` })
  return component
}

function assertNotOwn(viewer: CurrentUser, employeeId: number) {
  if (viewer.employeeId === employeeId) throw new ORPCError('FORBIDDEN', { message: 'Nobody enters payroll inputs for themselves - ask a colleague with Payroll access' })
}

export async function listInputs(viewer: CurrentUser, input: InputsListInput) {
  const run = await runFor(viewer, input.runId)
  const rows = await inputsRepository.list(run.id, { personId: input.personId, salaryComponentId: input.salaryComponentId })
  const person = await employeesService.lookupPeople(rows.flatMap((r) => [r.runEmployee.employeeId, r.createdById, r.updatedById]))
  const all = rows.map(({ runEmployee, createdById, updatedById, ...row }) => ({
    ...row,
    person: { id: runEmployee.id, employeeCode: runEmployee.employeeCode, name: person(runEmployee.employeeId)?.name ?? '' },
    createdBy: person(createdById),
    updatedBy: person(updatedById),
  }))
  const text = input.search?.toLowerCase()
  const matching = text ? all.filter((r) => r.person.employeeCode.toLowerCase().includes(text) || r.person.name.toLowerCase().includes(text)) : all
  return { items: matching.slice((input.page - 1) * input.pageSize, input.page * input.pageSize), total: matching.length }
}

export async function createInput(viewer: CurrentUser, input: { runId: number; personId: number; salaryComponentId: number; amount: number; note: string }) {
  return prisma.$transaction(async (tx) => {
    const run = await draftRunFor(viewer, input.runId, 'Payroll inputs', tx)
    const member = await inputsRepository.findPerson(run.id, input.personId, tx)
    if (!member) throw new ORPCError('NOT_FOUND', { message: 'This person is not in the payroll run' })
    assertNotOwn(viewer, member.employeeId)
    await monthlyComponent(input.salaryComponentId)
    const duplicate = await inputsRepository.hasSame(member.id, input.salaryComponentId, input.amount, null, tx)
    const { id } = await inputsRepository.create({ personId: member.id, salaryComponentId: input.salaryComponentId, amount: input.amount, note: input.note }, viewer.employeeId, tx)
    await calculationRepository.clearPersonLines(member.id, tx)
    return { id, duplicate }
  })
}

export async function updateInput(viewer: CurrentUser, { runId, id, ...changes }: { runId: number; id: number; salaryComponentId?: number; amount?: number; note?: string }) {
  return prisma.$transaction(async (tx) => {
    const run = await draftRunFor(viewer, runId, 'Payroll inputs', tx)
    const current = await inputsRepository.find(run.id, id, tx)
    if (!current) throw new ORPCError('NOT_FOUND', { message: 'No such input in this payroll run' })
    assertNotOwn(viewer, current.runEmployee.employeeId)
    if (changes.salaryComponentId !== undefined) await monthlyComponent(changes.salaryComponentId)
    const componentId = changes.salaryComponentId ?? current.salaryComponent.id
    const amount = changes.amount ?? current.amount
    const duplicate = await inputsRepository.hasSame(current.runEmployee.id, componentId, amount, id, tx)
    await inputsRepository.update(id, changes, viewer.employeeId, tx)
    // (a new note alone changes no amount)
    if (changes.salaryComponentId !== undefined || changes.amount !== undefined) await calculationRepository.clearPersonLines(current.runEmployee.id, tx)
    return { id, duplicate }
  })
}

export async function deleteInput(viewer: CurrentUser, { runId, id }: { runId: number; id: number }) {
  return prisma.$transaction(async (tx) => {
    const run = await draftRunFor(viewer, runId, 'Payroll inputs', tx)
    const current = await inputsRepository.find(run.id, id, tx)
    if (!current) throw new ORPCError('NOT_FOUND', { message: 'No such input in this payroll run' })
    assertNotOwn(viewer, current.runEmployee.employeeId)
    await inputsRepository.deleteInput(id, tx)
    await calculationRepository.clearPersonLines(current.runEmployee.id, tx)
    return { id }
  })
}

// How many inputs a run has (for its header)
export function countInputs(runId: number) {
  return inputsRepository.count(runId)
}
