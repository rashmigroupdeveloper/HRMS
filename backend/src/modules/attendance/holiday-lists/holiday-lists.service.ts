import { assertAccess } from '#core/auth/access'
import { assertGroupWide, assertWholeSlice, scopeOf, SYSTEM_SCOPE } from '#core/auth/scope'
import { prisma, type ActorId, type DbClient } from '#core/db/prisma'
import type { CurrentUser } from '#core/rpc/procedures'
import { employeesService } from '#modules/employees'
import { companiesService, plantsService } from '#modules/organization'
import { today } from '#shared/utils/dates'
import { ORPCError } from '@orpc/server'
import type { z } from 'zod'
import * as daysService from '../days/days.service.js'

import * as listsRepository from './holiday-lists.repository.js'
import type { assignHolidayListInput, createHolidayListInput, fillMissingInput, setPlantDefaultInput, updateHolidayListInput } from './holiday-lists.schema.js'

// Holiday lists (the user, 2026-11-24): named lists of holidays ("Corporate", "RML6 Plant"). Every employee follows one
// from a date (EmployeeHolidayList), so two people at the same plant may get different holidays. A list is one company's
// (only its employees follow it) or every company's. Each plant may have a default list - offered on the joining day, and
// given by "fill in" to those without a list; HR gives or changes anyone's list later (one person or many). Moving plant
// keeps the list. No list: no holidays.
// Who changes what (data access, section 8): a company's list - Attendance setup Edit for that whole company; a list of
// every company - Edit for all companies; a plant's default - Edit for that whole plant; someone's list - Attendance setup
// Edit covering that person. Everyone sees the lists in use (names only); the retired ones need Attendance setup View.
// Giving someone a list from a day already passed works out again the holidays' dates since then (2026-11-24) - only the
// months of theirs already worked out.

// employed at any time (an EVER range for the people query)
const EVER = { from: new Date(Date.UTC(1950, 0, 1)), to: new Date(Date.UTC(2200, 0, 1)) }

async function getHolidayList(id: number) {
  const list = await listsRepository.find(id)
  if (!list) throw new ORPCError('NOT_FOUND', { message: `No holiday list with id ${id}` })
  return list
}

// Several lists by id (the holidays' lists) - each must exist
export async function getHolidayLists(ids: number[]) {
  const lists = await Promise.all([...new Set(ids)].map((id) => getHolidayList(id)))
  return lists
}

export function assertMayChange(viewer: CurrentUser, companyId: number | null) {
  if (companyId === null) assertGroupWide(viewer, 'ATTENDANCE_SETUP', 'A holiday list for every company')
  else assertWholeSlice(viewer, 'ATTENDANCE_SETUP', { companyId, plantId: null, departmentId: null }, "A company's holiday list")
}

const plantCodes = (plants: listsRepository.HolidayListRow['defaultPlants']) => plants.map((d) => d.plant.plantCode).join(', ')

// For the API: the default plants as a plain list
function toList({ defaultPlants, ...list }: listsRepository.HolidayListRow) {
  return { ...list, defaultPlants: defaultPlants.map((d) => d.plant) }
}

export async function listHolidayLists(viewer: CurrentUser, includeInactive = false) {
  if (includeInactive) assertAccess(viewer.access, 'ATTENDANCE_SETUP', 'READ')
  return (await listsRepository.list(includeInactive)).map(toList)
}

export async function createHolidayList({ name, companyId }: z.infer<typeof createHolidayListInput>, viewer: CurrentUser) {
  assertMayChange(viewer, companyId ?? null)
  if (companyId) await companiesService.getCompany(companyId)
  return toList(await listsRepository.create({ name, companyId: companyId ?? null }, viewer.employeeId))
}

// A list given to another company (or to every company) must still suit the plants it is the default of; a list that is a
// plant's default cannot be retired - give the plant another default first
export async function updateHolidayList({ id, ...changes }: z.infer<typeof updateHolidayListInput>, viewer: CurrentUser) {
  const current = await getHolidayList(id)
  assertMayChange(viewer, current.companyId)
  if (changes.companyId !== undefined && changes.companyId !== current.companyId) {
    assertMayChange(viewer, changes.companyId)
    if (changes.companyId !== null) {
      await companiesService.getCompany(changes.companyId)
      const others = current.defaultPlants.filter((d) => d.plant.companyId !== changes.companyId)
      if (others.length) throw new ORPCError('CONFLICT', { message: `This list is the default of ${plantCodes(others)} - another company's plants. Give them another default first` })
    }
  }
  if (changes.isActive === false && current.isActive && current.defaultPlants.length) {
    throw new ORPCError('CONFLICT', { message: `This list is the default of ${plantCodes(current.defaultPlants)} - give them another default before retiring it` })
  }
  // the employees following it (today or from a later date) must still be able to: not retired, not another company's
  const moved = changes.companyId !== undefined && changes.companyId !== null && changes.companyId !== current.companyId
  if ((changes.isActive === false && current.isActive) || moved) {
    const following = await followersOf(id)
    if (changes.isActive === false && following.length) {
      throw new ORPCError('CONFLICT', { message: `${people(following.length)} follow this list - give them another list before retiring it` })
    }
    const elsewhere = following.filter((f) => f.companyId !== changes.companyId)
    if (moved && elsewhere.length) throw new ORPCError('CONFLICT', { message: `${people(elsewhere.length)} of another company follow this list - give them another list first` })
  }
  return toList(await listsRepository.update(id, changes, viewer.employeeId))
}

const people = (n: number) => `${n} employee${n === 1 ? '' : 's'}`

// Every row of these employees' lists (from a date each), oldest first - the on-application holidays they may take
export function listRowsOf(employeeIds: number[]) {
  return employeeIds.length ? listsRepository.listEmployeeRows(employeeIds) : Promise.resolve([])
}

// The list each employee follows on a day (null: none), since when, and the change already set for later
export async function listsOn(employeeIds: number[], day = today(), db?: DbClient) {
  const rows = employeeIds.length ? await listsRepository.listEmployeeRows(employeeIds, db) : []
  const result = new Map<number, { holidayList: { id: number; name: string } | null; since: Date | null; next: { from: Date; holidayList: { id: number; name: string } } | null }>()
  for (const id of employeeIds) {
    const own = rows.filter((r) => r.employeeId === id)
    const current = own.filter((r) => r.effectiveFrom <= day).at(-1)
    const next = own.find((r) => r.effectiveFrom > day)
    result.set(id, { holidayList: current?.holidayList ?? null, since: current?.effectiveFrom ?? null, next: next ? { from: next.effectiveFrom, holidayList: next.holidayList } : null })
  }
  return result
}

// The employees following a list today or from a later date, with their company
async function followersOf(holidayListId: number) {
  const rows = await listsRepository.listRowsOfList(holidayListId)
  const companyOf = new Map(rows.map((r) => [r.employeeId, r.employee.companyId]))
  const ids = [...companyOf.keys()]
  if (!ids.length) return []
  const all = await listsRepository.listEmployeeRows(ids)
  const day = today()
  return ids
    .filter((id) => {
      const own = all.filter((r) => r.employeeId === id)
      const current = own.filter((r) => r.effectiveFrom <= day).at(-1)
      return [current, ...own.filter((r) => r.effectiveFrom > day)].some((r) => r?.holidayList.id === holidayListId)
    })
    .map((id) => ({ employeeId: id, companyId: companyOf.get(id)! }))
}

// A list someone of this company may follow: in use, of their company or of every company
function assertListFits(list: listsRepository.HolidayListRow, people: { employeeCode: string; companyId: number }[]) {
  if (!list.isActive) throw new ORPCError('BAD_REQUEST', { message: `${list.name} is retired` })
  const others = people.filter((p) => list.companyId !== null && p.companyId !== list.companyId)
  if (others.length) {
    throw new ORPCError('BAD_REQUEST', { message: `${list.name} is ${list.company?.code}'s list - ${others.slice(0, 5).map((p) => p.employeeCode).join(', ')} work for another company` })
  }
}

// Employees follow a list from a date until their next row (one person or many - the Schedules part). Each one: Attendance
// setup Edit covering them; never across a locked attendance month. Those already following it from that day on are left as
// they are.
export async function assignHolidayList({ employeeCodes, holidayListId, effectiveFrom }: z.infer<typeof assignHolidayListInput>, viewer: CurrentUser) {
  const list = await getHolidayList(holidayListId)
  await daysService.assertNothingLockedFrom(effectiveFrom)
  const ids = await employeesService.mapCodesToIds(employeeCodes)
  const unknown = [...new Set(employeeCodes)].filter((code) => !ids.has(code))
  if (unknown.length) throw new ORPCError('BAD_REQUEST', { message: `No employee found with code ${unknown.slice(0, 5).join(', ')}` })
  const found = await employeesService.listAttendancePeople({ scope: SYSTEM_SCOPE, ids: [...new Set(ids.values())], ...EVER })
  for (const person of found) daysService.assertAttendanceEdit(viewer, person, 'ATTENDANCE_SETUP')
  assertListFits(list, found)
  const lists = await listsOn(
    found.map((p) => p.id),
    effectiveFrom,
  )
  const changed = found.filter((p) => {
    const now = lists.get(p.id)
    return now?.holidayList?.id !== holidayListId || now.next !== null
  })
  await saveInBatches(
    changed.map((person) => ({ employeeId: person.id, holidayListId, effectiveFrom })),
    viewer.employeeId,
  )
  await daysService.reworkHolidayDates(
    changed.map((p) => p.id),
    effectiveFrom,
  )
  // on-application holidays they took or asked for from then: still on their list? (cancelled if not - 2026-11-24)
  await daysService.holidayLeaveHooks().recheck({ from: effectiveFrom, to: EVER.to, employeeIds: changed.map((p) => p.id) })
  return { assigned: changed.length, unchanged: found.length - changed.length }
}

// One employee's holiday list today, and a change set for later (their profile shows its name - the user, 2026-11-25): their
// own, or with Employees View covering them (else "not found")
export async function holidayListOf(viewer: CurrentUser, employeeCode: string) {
  const employee = await employeesService.getEmployeeFor(viewer, employeeCode)
  return (await listsOn([employee.id])).get(employee.id)!
}

// The joining day (candidates module): the list HR chose, from the date of joining - checked first with
// assertJoiningList, saved in the joining's transaction
export async function assertJoiningList(holidayListId: number, companyId: number) {
  assertListFits(await getHolidayList(holidayListId), [{ employeeCode: 'the new employee', companyId }])
}

export function giveOnJoining(employeeId: number, holidayListId: number, dateOfJoining: Date, actorId: ActorId, db: DbClient) {
  return listsRepository.upsertEmployeeList({ employeeId, holidayListId, effectiveFrom: dateOfJoining }, actorId, db)
}

// Everyone without a list (employed today or joining later, inside the viewer's Attendance setup Edit data access) gets
// their plant's default, from their joining day - or the day after the last locked attendance month after it. `dryRun`:
// only how many would get one, and the plants without a default where others wait.
export async function fillMissing({ dryRun }: z.infer<typeof fillMissingInput>, viewer: CurrentUser) {
  const people = await employeesService.listAttendancePeople({ scope: scopeOf(viewer, 'ATTENDANCE_SETUP', 'WRITE'), from: today(), to: EVER.to })
  const withList = new Set((await listsRepository.listEmployeeRows(people.map((p) => p.id))).map((r) => r.employeeId))
  const without = people.filter((p) => !withList.has(p.id))
  const defaults = new Map((await listsRepository.listPlantDefaults()).filter((d) => d.holidayList.isActive).map((d) => [d.plantId, d.holidayList]))
  // (a default of another company's - never kept, but checked)
  const fits = (p: (typeof people)[number]) => {
    const list = defaults.get(p.plantId)
    return !!list && (list.companyId === null || list.companyId === p.companyId)
  }
  const toGive = without.filter(fits)
  const waiting = new Map<string, number>()
  for (const p of without.filter((x) => !fits(x))) waiting.set(`${p.plant.plantCode} ${p.plant.name}`, (waiting.get(`${p.plant.plantCode} ${p.plant.name}`) ?? 0) + 1)
  const noDefault = [...waiting].map(([plant, employees]) => ({ plant, employees })).sort((a, b) => b.employees - a.employees)
  if (dryRun || !toGive.length) return { withoutList: without.length, toGive: toGive.length, given: 0, noDefault }
  const startOf = new Map<number, Date>()
  for (const day of new Set(toGive.map((p) => p.dateOfJoining.getTime()))) startOf.set(day, await daysService.firstOpenDayFrom(new Date(day)))
  const rows = toGive.map((person) => ({ employeeId: person.id, holidayListId: defaults.get(person.plantId)!.id, effectiveFrom: startOf.get(person.dateOfJoining.getTime())! }))
  await saveInBatches(rows, viewer.employeeId)
  // their holidays' dates already passed (the months of theirs already worked out), from the earliest start
  const earliest = rows.reduce((min, r) => (r.effectiveFrom < min ? r.effectiveFrom : min), rows[0]!.effectiveFrom)
  await daysService.reworkHolidayDates(
    rows.map((r) => r.employeeId),
    earliest,
  )
  return { withoutList: without.length, toGive: toGive.length, given: toGive.length, noDefault }
}

// Thousands of rows at go-live: a hundred at a time, each batch in its own transaction (as attendance's recompute) - a run
// stopped half way leaves whole batches, and running it again gives only those still without a list
const BATCH = 100
async function saveInBatches(rows: { employeeId: number; holidayListId: number; effectiveFrom: Date }[], actorId: ActorId) {
  for (let i = 0; i < rows.length; i += BATCH) {
    await prisma.$transaction(
      async (tx) => {
        for (const row of rows.slice(i, i + BATCH)) await listsRepository.upsertEmployeeList(row, actorId, tx)
      },
      { timeout: 60_000 },
    )
  }
}

// A plant's default list (or none): a list in use, of the plant's company or of every company
export async function setPlantDefault({ plantId, holidayListId }: z.infer<typeof setPlantDefaultInput>, viewer: CurrentUser) {
  const plant = await plantsService.getPlant(plantId)
  assertWholeSlice(viewer, 'ATTENDANCE_SETUP', { companyId: plant.company.id, plantId, departmentId: null }, `Plant ${plant.plantCode}'s default holiday list`)
  if (holidayListId === null) {
    await listsRepository.deletePlantDefault(plantId)
    return { plantId, holidayList: null }
  }
  const list = await getHolidayList(holidayListId)
  if (!list.isActive) throw new ORPCError('BAD_REQUEST', { message: `${list.name} is retired` })
  if (list.companyId !== null && list.companyId !== plant.company.id) {
    throw new ORPCError('BAD_REQUEST', { message: `${list.name} belongs to ${list.company?.code} - a plant of ${plant.company.code} may use only its company's lists or those of every company` })
  }
  await listsRepository.upsertPlantDefault(plantId, holidayListId, viewer.employeeId)
  return { plantId, holidayList: { id: list.id, name: list.name } }
}
