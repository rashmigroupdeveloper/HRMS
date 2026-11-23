import { assertGroupWide, levelOver, SYSTEM_SCOPE } from '#core/auth/scope'
import type { CurrentUser } from '#core/rpc/procedures'
import { employeesService } from '#modules/employees'
import { today } from '#shared/utils/dates'
import { ORPCError } from '@orpc/server'
import type { z } from 'zod'
import * as daysService from '../days/days.service.js'
import * as holidaysRepository from './holidays.repository.js'
import type { createHolidayInput, updateHolidayInput } from './holidays.schema.js'

// The holiday calendar (attendance, 2026-11-16): everyone sees it; Attendance setup: Edit keeps it. A holiday on a day already
// passed works that day out again for everyone (leave will use the same calendar).

export function listHolidays(year: number) {
  return holidaysRepository.listBetween(new Date(Date.UTC(year, 0, 1)), new Date(Date.UTC(year, 11, 31)))
}

async function getHoliday(id: number) {
  const holiday = await holidaysRepository.find(id)
  if (!holiday) throw new ORPCError('NOT_FOUND', { message: `No holiday with id ${id}` })
  return holiday
}

async function assertNotTwice(date: Date, companyId: number | null, workLocationId: number | null, exceptId?: number) {
  const same = await holidaysRepository.findSame(date, companyId, workLocationId)
  if (same && same.id !== exceptId) throw new ORPCError('CONFLICT', { message: 'There is already a holiday on that date for the same company and location' })
}

// Days already passed are worked out again (everyone employed that day - the holiday may concern only some)
async function reworkDays(...dates: Date[]) {
  for (const date of new Set(dates.filter((d) => d <= today()).map((d) => d.getTime()))) {
    const day = new Date(date)
    const people = await employeesService.listAttendancePeople({ scope: SYSTEM_SCOPE, from: day, to: day })
    await daysService.recompute(
      people.map((p) => p.id),
      day,
      day,
    )
  }
}

// A holiday of one company needs Attendance setup Edit for that whole company; one for every company, for all companies (A4,
// 2026-11-18)
function assertMayChange(viewer: CurrentUser, companyId: number | null) {
  if (companyId === null) assertGroupWide(viewer, 'ATTENDANCE_SETUP', 'A holiday for every company')
  else if (levelOver(viewer, 'ATTENDANCE_SETUP', { companyId, plantId: null, departmentId: null }) !== 'WRITE') {
    throw new ORPCError('FORBIDDEN', { message: "A company's holiday needs Attendance setup Edit for the whole company" })
  }
}

export async function createHoliday(input: z.infer<typeof createHolidayInput>, viewer: CurrentUser) {
  const actorId = viewer.employeeId
  const data = { date: input.date, name: input.name, companyId: input.companyId ?? null, workLocationId: input.workLocationId ?? null }
  assertMayChange(viewer, data.companyId)
  await assertNotTwice(data.date, data.companyId, data.workLocationId)
  const holiday = await holidaysRepository.create(data, actorId)
  await reworkDays(holiday.date)
  return holiday
}

export async function updateHoliday({ id, ...changes }: z.infer<typeof updateHolidayInput>, viewer: CurrentUser) {
  const actorId = viewer.employeeId
  const current = await getHoliday(id)
  const next = {
    date: changes.date ?? current.date,
    companyId: changes.companyId === undefined ? current.companyId : changes.companyId,
    workLocationId: changes.workLocationId === undefined ? current.workLocationId : changes.workLocationId,
  }
  // the company it was for and the one it will be for
  assertMayChange(viewer, current.companyId)
  assertMayChange(viewer, next.companyId)
  await assertNotTwice(next.date, next.companyId, next.workLocationId, id)
  const holiday = await holidaysRepository.update(id, { ...changes }, actorId)
  await reworkDays(current.date, holiday.date)
  return holiday
}

export async function deleteHoliday(id: number, viewer: CurrentUser) {
  const current = await getHoliday(id)
  assertMayChange(viewer, current.companyId)
  await holidaysRepository.remove(id)
  await reworkDays(current.date)
  return { deleted: true }
}
