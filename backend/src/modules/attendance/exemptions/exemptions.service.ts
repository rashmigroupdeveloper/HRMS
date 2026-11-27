import { SYSTEM_SCOPE } from '#core/auth/scope'
import { prisma, type DbClient } from '#core/db/prisma'
import type { CurrentUser } from '#core/rpc/procedures'
import { employeesService } from '#modules/employees'
import { today } from '#shared/utils/dates'
import { addDays } from '#shared/utils/time'
import { ORPCError } from '@orpc/server'
import * as daysRepository from '../days/days.repository.js'
import * as daysService from '../days/days.service.js'
import * as exemptionsRepository from './exemptions.repository.js'
import type { CreateExemptionInput, UpdateExemptionInput } from './exemptions.schema.js'

// "Attendance not tracked" (approved by the user 2026-11-27, for payroll): someone who does not punch counts present
// on their working days - from a day, to a last day or until ended. Without it attendance marks them absent every
// working day and payroll would pay nothing. Set on Attendance setup > Schedules, for one person or many at once, by
// someone with Attendance setup Edit covering each employee (data access - outside the View range "not found", View
// only "forbidden"). Rules:
// - one person's stretches never overlap;
// - no stretch changes a day of a locked attendance month - open the month first;
// - the days already worked out that the change touches are worked out again at once (months never worked out stay so).
// What a marked day becomes is the day calculation's (days.service - countPresent).

const EVER = { from: new Date(Date.UTC(1950, 0, 1)), to: new Date(Date.UTC(2200, 0, 1)) }

type Stretch = { fromDate: Date; toDate: Date | null }
// does the stretch hold every day of from..to (to null: with no end)?
const holdsAll = (s: Stretch, from: Date, to: Date | null) => s.fromDate <= from && (s.toDate === null || (to !== null && s.toDate >= to))

// One date in every attendance month from..to (months are 28 to 31 days long, so every 20th day never skips one)
function oneDayPerMonth(from: Date, to: Date) {
  const days: Date[] = []
  for (let day = from; day <= to; day = addDays(day, 20)) days.push(day)
  days.push(to)
  return days
}

// Works out again the days from..to (up to today) that are already worked out for these employees
async function rework(employeeIds: number[], from: Date, to: Date | null) {
  const last = to && to < today() ? to : today()
  if (!employeeIds.length || from > last) return
  await daysService.reworkWorkedOut(oneDayPerMonth(from, last), employeeIds)
}

// For the Schedules list: each employee's stretch in force on a day - or, when none is, the next one to start
// (`current` false); employees whose attendance is tracked have no entry
export async function markersOn(employeeIds: number[], day = today(), db?: DbClient) {
  const result = new Map<number, { id: number; fromDate: Date; toDate: Date | null; reason: string; current: boolean }>()
  if (!employeeIds.length) return result
  // (the earliest first: the one in force comes before those still to start)
  for (const { employeeId, ...row } of await exemptionsRepository.listFrom(employeeIds, day, db)) {
    if (!result.has(employeeId)) result.set(employeeId, { ...row, current: row.fromDate <= day })
  }
  return result
}

// Marks employees "attendance not tracked" from a day. Someone already marked for all of those days is left as they
// are; someone marked for only some of them is refused - their marker is changed or removed first.
export async function markNotTracked({ employeeCodes, fromDate, toDate, reason }: CreateExemptionInput, viewer: CurrentUser) {
  const to = toDate ?? null
  await daysService.assertNothingLockedIn(fromDate, to)
  const ids = await employeesService.mapCodesToIds(employeeCodes)
  const unknown = [...new Set(employeeCodes)].filter((code) => !ids.has(code))
  if (unknown.length) throw new ORPCError('BAD_REQUEST', { message: `No employee found with code ${unknown.slice(0, 5).join(', ')}` })
  // each employee: Attendance setup Edit covering where they are (data access)
  const people = await employeesService.listAttendancePeople({ scope: SYSTEM_SCOPE, ids: [...new Set(ids.values())], ...EVER })
  for (const person of people) daysService.assertAttendanceEdit(viewer, person, 'ATTENDANCE_SETUP')
  const marked = await prisma.$transaction(
    async (tx) => {
      // checked and saved while their days are held: two people marking the same employee make one marker
      await daysRepository.lockEmployees(people.map((p) => p.id), tx)
      const existing = await exemptionsRepository.listOverlapping(people.map((p) => p.id), fromDate, to, tx)
      const partly = people.filter((p) => existing.some((e) => e.employeeId === p.id && !holdsAll(e, fromDate, to)))
      if (partly.length) {
        throw new ORPCError('CONFLICT', {
          message: `${partly.slice(0, 5).map((p) => p.employeeCode).join(', ')}${partly.length > 5 ? ` and ${partly.length - 5} more` : ''}: attendance is already not tracked on some of these days - change or remove that marker first`,
        })
      }
      const fresh = people.filter((p) => !existing.some((e) => e.employeeId === p.id))
      if (fresh.length) await exemptionsRepository.createMany(fresh.map((p) => ({ employeeId: p.id, fromDate, toDate: to, reason })), viewer.employeeId, tx)
      return fresh.map((p) => p.id)
    },
    { timeout: 60_000 },
  )
  // everyone named, not only the newly marked: if working the days out stopped part-way last time, asking again (their
  // markers are saved, so they answer "unchanged") still brings their days up to date
  await rework(people.map((p) => p.id), fromDate, to)
  return { marked: marked.length, unchanged: people.length - marked.length }
}

// The marker, if the viewer may change it: Attendance setup Edit covering its employee
async function changeable(viewer: CurrentUser, id: number) {
  const marker = await exemptionsRepository.find(id)
  if (!marker) throw new ORPCError('NOT_FOUND', { message: 'No such marker found' })
  daysService.assertAttendanceEdit(viewer, marker.employee, 'ATTENDANCE_SETUP')
  return marker
}

// Ends a marker on a day, or lets it run on again (toDate null), and corrects its reason. Only the days between the old
// and the new last day change - those must be outside locked months, and are worked out again.
export async function updateMarker({ id, toDate, reason }: UpdateExemptionInput, viewer: CurrentUser) {
  const marker = await changeable(viewer, id)
  if (toDate && toDate < marker.fromDate) throw new ORPCError('BAD_REQUEST', { message: 'The last day is before the first day - to take the marker away altogether, remove it' })
  const oldTo = marker.toDate
  const same = (oldTo?.getTime() ?? null) === (toDate?.getTime() ?? null)
  // the days that change: after the earlier of the two last days, up to the later one (null: with no end)
  const earlier = oldTo === null ? toDate : toDate === null ? oldTo : oldTo < toDate ? oldTo : toDate
  const later = oldTo === null || toDate === null ? null : oldTo < toDate ? toDate : oldTo
  const changedFrom = same || !earlier ? null : addDays(earlier, 1)
  if (changedFrom) await daysService.assertNothingLockedIn(changedFrom, later)
  await prisma.$transaction(async (tx) => {
    await daysRepository.lockEmployees([marker.employeeId], tx)
    // made longer: never into another marker of theirs
    const longer = !same && (toDate === null || (oldTo !== null && toDate > oldTo))
    if (longer && (await exemptionsRepository.listOverlapping([marker.employeeId], marker.fromDate, toDate, tx)).some((e) => e.id !== id)) {
      throw new ORPCError('CONFLICT', { message: `${marker.employee.employeeCode} has another marker later on - end this one before it starts, or remove the other first` })
    }
    await exemptionsRepository.update(id, { toDate, ...(reason !== undefined && { reason }) }, viewer.employeeId, tx)
  })
  if (changedFrom) await rework([marker.employeeId], changedFrom, later)
  return { id }
}

// Removes a marker set by mistake: its days are tracked again (worked out from the punches)
export async function removeMarker({ id }: { id: number }, viewer: CurrentUser) {
  const marker = await changeable(viewer, id)
  await daysService.assertNothingLockedIn(marker.fromDate, marker.toDate)
  await prisma.$transaction(async (tx) => {
    await daysRepository.lockEmployees([marker.employeeId], tx)
    await exemptionsRepository.deleteExemption(id, tx)
  })
  await rework([marker.employeeId], marker.fromDate, marker.toDate)
  return { id }
}
