import { prisma, type DbClient } from '#core/db/prisma'
import type { CurrentUser } from '#core/rpc/procedures'
import { ORPCError } from '@orpc/server'
import type { z } from 'zod'
import { assertCanChange, getEmployeeFor, lookupPeople } from '../employees.service.js'
import * as layoffsRepository from './layoffs.repository.js'
import type { createLayoffInput, updateLayoffInput } from './layoffs.schema.js'

// Business rules for an employee's lay offs (the user, 2026-11-19): a history HR keeps - each from a day until the day
// the employee is back at work. Seen by the employee themselves and by "Employee · Directory & job" View covering them;
// changed with Edit covering them. The employee's status does not change (BACKLOG.md: attendance and pay).

type LayoffRow = Awaited<ReturnType<typeof layoffsRepository.list>>[number]

// For the API: who entered / last changed each lay off, as { employeeCode, name }
async function withPeople(rows: LayoffRow[]) {
  const person = await lookupPeople(rows.flatMap((l) => [l.createdById, l.updatedById]))
  return rows.map(({ createdById, updatedById, ...l }) => ({ ...l, addedBy: person(createdById), changedBy: person(updatedById) }))
}

const day = (date: Date) => date.toISOString().slice(0, 10)

// The rules of one lay off among the employee's others: not before joining, back at work after it starts, never
// overlapping another, and only one still open
async function checkRules(employeeId: number, dateOfJoining: Date, layoff: { startDate: Date; rejoinDate: Date | null }, exceptId?: number, db?: DbClient) {
  if (layoff.startDate < dateOfJoining) {
    throw new ORPCError('BAD_REQUEST', { message: `A lay off cannot start before the date of joining (${day(dateOfJoining)})` })
  }
  if (layoff.rejoinDate && layoff.rejoinDate <= layoff.startDate) {
    throw new ORPCError('BAD_REQUEST', { message: 'The day back at work must be after the first day of the lay off' })
  }
  const end = (l: { rejoinDate: Date | null }) => l.rejoinDate?.getTime() ?? Infinity
  for (const other of await layoffsRepository.list(employeeId, db)) {
    if (other.id === exceptId) continue
    if (!other.rejoinDate && !layoff.rejoinDate) {
      throw new ORPCError('CONFLICT', { message: `The lay off from ${day(other.startDate)} is still open - give its day back at work first` })
    }
    if (layoff.startDate.getTime() < end(other) && other.startDate.getTime() < end(layoff)) {
      throw new ORPCError('CONFLICT', { message: `It overlaps the lay off from ${day(other.startDate)}` })
    }
  }
}

// The employee's lay offs, latest first (own record, or Employees View covering them - else NOT_FOUND)
export async function listLayoffs(viewer: CurrentUser, employeeCode: string) {
  const employee = await getEmployeeFor(viewer, employeeCode)
  return withPeople(await layoffsRepository.list(employee.id))
}

// --- HR enters them (Employees Edit covering the employee - the router and here) ---

export async function createLayoff({ employeeCode, ...input }: z.infer<typeof createLayoffInput>, viewer: CurrentUser) {
  const employee = await getEmployeeFor(viewer, employeeCode)
  assertCanChange(viewer, employee)
  return prisma.$transaction(async (tx) => {
    const joined = await layoffsRepository.findDateOfJoining(employee.id, tx)
    await checkRules(employee.id, joined!.dateOfJoining, { startDate: input.startDate, rejoinDate: input.rejoinDate ?? null }, undefined, tx)
    const [created] = await withPeople([await layoffsRepository.create({ ...input, employeeId: employee.id }, viewer.employeeId, tx)])
    return created!
  })
}

// The lay off, for a change by `viewer`: its employee first (NOT_FOUND outside their View, FORBIDDEN with View only)
async function getLayoffToChange(id: number, viewer: CurrentUser) {
  const layoff = await layoffsRepository.findById(id)
  if (!layoff) throw new ORPCError('NOT_FOUND', { message: `No lay off found with id ${id}` })
  assertCanChange(viewer, layoff.employee)
  return layoff
}

export async function updateLayoff({ id, ...changes }: z.infer<typeof updateLayoffInput>, viewer: CurrentUser) {
  const current = await getLayoffToChange(id, viewer)
  const after = {
    startDate: changes.startDate ?? current.startDate,
    rejoinDate: changes.rejoinDate === undefined ? current.rejoinDate : changes.rejoinDate,
  }
  await checkRules(current.employee.id, current.employee.dateOfJoining, after, id)
  const [updated] = await withPeople([await layoffsRepository.update(id, changes, viewer.employeeId)])
  return updated!
}

// Removes a lay off entered by mistake (the change history keeps what it was)
export async function deleteLayoff(id: number, viewer: CurrentUser) {
  await getLayoffToChange(id, viewer)
  return layoffsRepository.remove(id)
}
