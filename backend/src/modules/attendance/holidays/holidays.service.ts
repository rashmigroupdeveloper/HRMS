import { prisma } from '#core/db/prisma'
import type { CurrentUser } from '#core/rpc/procedures'
import { formatDate } from '#shared/utils/dates'
import { ORPCError } from '@orpc/server'
import type { z } from 'zod'
import * as daysService from '../days/days.service.js'
import * as categoriesService from '../holiday-categories/holiday-categories.service.js'
import * as listsService from '../holiday-lists/holiday-lists.service.js'
import * as holidaysRepository from './holidays.repository.js'
import type { copyYearInput, createHolidayInput, updateHolidayInput } from './holidays.schema.js'

// The holidays (attendance, 2026-11-16; in holiday lists since 2026-11-24 - the user): a holiday is entered once and put
// in the lists that have it (26 January in every list, Durga Puja only in the West Bengal ones); everyone following one of
// those lists that day is off - the whole day, or one half with the other worked. Each has one of HR's categories. A list
// has at most one holiday a day.
// Who changes one (data access, section 8): Attendance setup Edit for every list it is (or will be) in - a company's list:
// for that whole company, a list of every company: for all companies. Every list's holidays: Attendance setup View (the
// setup page); each employee reads their own list's - "My holidays" on My leave (2026-11-24).
// A holiday on a day already worked out works that attendance month out again - only for those whose days of it are
// already worked out (never days before attendance started); never inside a locked attendance month.
// How it is given (the user, 2026-11-24): AUTOMATIC - everyone on its lists is off; ON_APPLICATION - a working day unless
// someone on its lists applies for it, taken from a leave type's balance ("only on its holiday dates"), the whole day - or
// half, when allowed - approved like leave; the day then shows as a holiday for them. A change of an on-application holiday
// (moved, removed, other lists, made automatic) cancels the leave taking it that no longer fits and gives the days back.

type Holiday = holidaysRepository.HolidayRow

// For the API: the lists as a plain list
const toHoliday = ({ lists, ...h }: Holiday) => ({ ...h, lists: lists.map((l) => l.holidayList) })

export async function listHolidays(year: number, holidayListId?: number) {
  return (await holidaysRepository.listBetween(new Date(Date.UTC(year, 0, 1)), new Date(Date.UTC(year, 11, 31)), holidayListId)).map(toHoliday)
}

async function getHoliday(id: number) {
  const holiday = await holidaysRepository.find(id)
  if (!holiday) throw new ORPCError('NOT_FOUND', { message: `No holiday with id ${id}` })
  return holiday
}

// The lists a holiday goes in: each there, and the viewer may change each one's holidays; a list it is put in newly must be
// in use (one it is in already may have been retired since - the holiday stays editable)
async function checkLists(viewer: CurrentUser, holidayListIds: number[], alreadyIn: number[] = []) {
  const lists = await listsService.getHolidayLists(holidayListIds)
  for (const list of lists) {
    if (!list.isActive && !alreadyIn.includes(list.id)) throw new ORPCError('BAD_REQUEST', { message: `${list.name} is retired` })
    listsService.assertMayChange(viewer, list.companyId)
  }
  return lists
}

// How it is given, checked (2026-11-24): an on-application holiday names its leave type (one "only on its holiday dates")
// and is a whole-day holiday (half days: `allowHalfDay`); an automatic one names none
type HowGiven = { mode: 'AUTOMATIC' | 'ON_APPLICATION'; portion: 'FULL_DAY' | 'FIRST_HALF' | 'SECOND_HALF'; allowHalfDay: boolean; leaveTypeId: number | null }
async function checkHowGiven(h: HowGiven, leaveTypeChanged: boolean) {
  if (h.mode === 'ON_APPLICATION') {
    if (h.leaveTypeId === null) throw new ORPCError('BAD_REQUEST', { message: 'An on-application holiday needs the leave type it is taken from' })
    if (h.portion !== 'FULL_DAY') throw new ORPCError('BAD_REQUEST', { message: 'An on-application holiday is a whole day - allow half days to let people take half of it' })
    if (leaveTypeChanged) await daysService.holidayLeaveHooks().assertLeaveType(h.leaveTypeId)
  } else if (h.leaveTypeId !== null || h.allowHalfDay) {
    throw new ORPCError('BAD_REQUEST', { message: 'An automatic holiday is taken from no leave type - use the part of the day off instead' })
  }
}

// The leave taking on-application holidays on these dates is checked again (those no longer fitting are cancelled)
async function recheckTaken(dates: Date[]) {
  const times = dates.map((d) => d.getTime())
  await daysService.holidayLeaveHooks().recheck({ from: new Date(Math.min(...times)), to: new Date(Math.max(...times)) })
}

// a list has at most one holiday a day
async function assertFree(date: Date, holidayListIds: number[], exceptId?: number) {
  const other = await holidaysRepository.findOnDateInLists(date, holidayListIds, exceptId)
  if (other) {
    throw new ORPCError('CONFLICT', { message: `${other.lists.map((l) => l.holidayList.name).join(', ')} already ${other.lists.length === 1 ? 'has' : 'have'} ${other.name} on ${formatDate(date)}` })
  }
}

export async function createHoliday({ holidayListIds, ...data }: z.infer<typeof createHolidayInput>, viewer: CurrentUser) {
  await checkLists(viewer, holidayListIds)
  await categoriesService.getActiveCategory(data.categoryId)
  const how: HowGiven = { mode: data.mode ?? 'AUTOMATIC', portion: data.portion ?? 'FULL_DAY', allowHalfDay: data.allowHalfDay ?? false, leaveTypeId: data.leaveTypeId ?? null }
  await checkHowGiven(how, true)
  // never inside a locked attendance month: its planned days would change under the lock (2026-11-23)
  await daysService.assertOpenDays([data.date])
  await assertFree(data.date, holidayListIds)
  const { id } = await prisma.$transaction(async (tx) => {
    const created = await holidaysRepository.create({ date: data.date, name: data.name, categoryId: data.categoryId, ...how }, viewer.employeeId, tx)
    await holidaysRepository.setLists(created.id, holidayListIds, viewer.employeeId, tx)
    return created
  })
  if (how.mode === 'AUTOMATIC') await daysService.reworkWorkedOut([data.date])
  return toHoliday(await getHoliday(id))
}

// The lists it was in and those it will be in: the viewer may change each. Moved, given to other lists or another part of
// the day: both dates in open months (a new name or category alone may be fixed in a locked month - 2026-11-23)
export async function updateHoliday({ id, holidayListIds, ...changes }: z.infer<typeof updateHolidayInput>, viewer: CurrentUser) {
  const current = await getHoliday(id)
  for (const { holidayList } of current.lists) listsService.assertMayChange(viewer, holidayList.companyId)
  const lists = holidayListIds ?? current.lists.map((l) => l.holidayList.id)
  if (holidayListIds) await checkLists(viewer, holidayListIds, current.lists.map((l) => l.holidayList.id))
  if (changes.categoryId !== undefined && changes.categoryId !== current.category.id) await categoriesService.getActiveCategory(changes.categoryId)
  const date = changes.date ?? current.date
  const how: HowGiven = {
    mode: changes.mode ?? current.mode,
    portion: changes.portion ?? current.portion,
    allowHalfDay: changes.allowHalfDay ?? current.allowHalfDay,
    leaveTypeId: changes.leaveTypeId === undefined ? (current.leaveType?.id ?? null) : changes.leaveTypeId,
  }
  // (an automatic holiday made on-application: no leave type unless given; on-application made automatic: none any more)
  if (changes.mode === 'AUTOMATIC' && changes.leaveTypeId === undefined) {
    how.leaveTypeId = null
    how.allowHalfDay = false
  }
  await checkHowGiven(how, how.leaveTypeId !== (current.leaveType?.id ?? null))
  const listsChanged = !!holidayListIds && [...holidayListIds].sort().join() !== current.lists.map((l) => l.holidayList.id).sort().join()
  const moved =
    date.getTime() !== current.date.getTime() ||
    listsChanged ||
    how.portion !== current.portion ||
    how.mode !== current.mode ||
    how.leaveTypeId !== (current.leaveType?.id ?? null) ||
    how.allowHalfDay !== current.allowHalfDay
  if (moved) await daysService.assertOpenDays([current.date, date])
  await assertFree(date, lists, id)
  await prisma.$transaction(async (tx) => {
    const { mode: _mode, portion: _portion, allowHalfDay: _half, leaveTypeId: _type, ...rest } = changes
    await holidaysRepository.update(id, { ...rest, ...how }, viewer.employeeId, tx)
    if (holidayListIds) await holidaysRepository.setLists(id, holidayListIds, viewer.employeeId, tx)
  })
  if (moved) {
    await daysService.reworkWorkedOut([current.date, date])
    // (the leave taking it, before and after: still fitting?)
    if (current.mode === 'ON_APPLICATION' || how.mode === 'ON_APPLICATION') await recheckTaken([current.date, date])
  }
  return toHoliday(await getHoliday(id))
}

export async function deleteHoliday(id: number, viewer: CurrentUser) {
  const current = await getHoliday(id)
  for (const { holidayList } of current.lists) listsService.assertMayChange(viewer, holidayList.companyId)
  await daysService.assertOpenDays([current.date])
  await holidaysRepository.remove(id)
  if (current.mode === 'AUTOMATIC') await daysService.reworkWorkedOut([current.date])
  else await recheckTaken([current.date])
  return { deleted: true }
}

// The same day and month a year on (29 February -> 28 February)
function aYearOn(date: Date, year: number) {
  const month = date.getUTCMonth()
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  return new Date(Date.UTC(year, month, Math.min(date.getUTCDate(), last)))
}

// "Copy from last year" (the user, 2026-11-24): the year before's holidays into `year`, on the same day and month, in the
// same lists - only the lists the viewer may change; a list that already has a holiday that day keeps it. HR then moves
// the festivals whose dates differ. Days in a locked attendance month are left out.
export async function copyYear({ year }: z.infer<typeof copyYearInput>, viewer: CurrentUser) {
  const source = await holidaysRepository.listBetween(new Date(Date.UTC(year - 1, 0, 1)), new Date(Date.UTC(year - 1, 11, 31)))
  let copied = 0
  let skipped = 0
  const dates: Date[] = []
  for (const holiday of source) {
    const date = aYearOn(holiday.date, year)
    const mine = holiday.lists.map((l) => l.holidayList).filter((l) => mayChange(viewer, l.companyId))
    const free: number[] = []
    for (const list of mine) if (!(await holidaysRepository.findOnDateInLists(date, [list.id], undefined))) free.push(list.id)
    const open = await daysService.assertOpenDays([date]).then(
      () => true,
      () => false,
    )
    if (!free.length || !open) {
      skipped++
      continue
    }
    await prisma.$transaction(async (tx) => {
      const created = await holidaysRepository.create(
        { date, name: holiday.name, categoryId: holiday.category.id, portion: holiday.portion, mode: holiday.mode, allowHalfDay: holiday.allowHalfDay, leaveTypeId: holiday.leaveType?.id ?? null },
        viewer.employeeId,
        tx,
      )
      await holidaysRepository.setLists(created.id, free, viewer.employeeId, tx)
    })
    dates.push(date)
    copied++
  }
  await daysService.reworkWorkedOut(dates)
  return { copied, skipped }
}

const mayChange = (viewer: CurrentUser, companyId: number | null) => {
  try {
    listsService.assertMayChange(viewer, companyId)
    return true
  } catch {
    return false
  }
}

// The on-application holidays an employee may take from..to (2026-11-24 - for the leave module): those of the list they
// follow on each date, with the leave type each is taken from and whether half of it may be taken
export async function onApplicationHolidaysOf(employeeId: number, from: Date, to: Date) {
  const [rows, holidays] = await Promise.all([listsService.listRowsOf([employeeId]), holidaysRepository.listOnApplication(from, to)])
  return holidays
    .filter((h) => {
      const listId = rows.filter((r) => r.effectiveFrom <= h.date).at(-1)?.holidayList.id
      return listId !== undefined && h.lists.some((l) => l.holidayListId === listId)
    })
    .map((h) => ({ date: h.date, name: h.name, leaveTypeId: h.leaveTypeId!, allowHalfDay: h.allowHalfDay }))
}

// "My holidays" (2026-11-24): the viewer's own holidays of a year - those of the list they follow on each date (a list changed
// in the year: each part of the year its own) - automatic ones (off) and on-application ones (theirs to apply for), with the
// list followed today and a change already set for later. No list: none.
export async function myHolidays(viewer: CurrentUser, year: number) {
  const [rows, holidays, lists] = await Promise.all([
    listsService.listRowsOf([viewer.employeeId]),
    holidaysRepository.listBetween(new Date(Date.UTC(year, 0, 1)), new Date(Date.UTC(year, 11, 31))),
    listsService.listsOn([viewer.employeeId]),
  ])
  const mine = holidays.flatMap(({ lists: entries, ...h }) => {
    const list = rows.filter((r) => r.effectiveFrom <= h.date).at(-1)?.holidayList
    return list && entries.some((e) => e.holidayList.id === list.id) ? [{ ...h, list }] : []
  })
  const now = lists.get(viewer.employeeId)!
  return { holidayList: now.holidayList, next: now.next, holidays: mine }
}
