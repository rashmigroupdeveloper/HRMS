import { prisma, SYSTEM_ACTOR } from '#core/db/prisma'
import * as listsService from '../../src/modules/attendance/holiday-lists/holiday-lists.service.js'

// Holidays for tests (2026-11-24 - a day's holiday comes from the holiday list the employee follows): a category and a
// list of the test's own, and its employees on the list. The test database is never wiped - each name is unique.

let next = 0
const unique = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}${++next}`

// a category and a list (`companyId` null: a list of every company)
export async function holidaySetup(companyId: number | null) {
  const n = unique()
  const category = await prisma.holidayCategory.create({ data: { name: `Test category ${n}`, tone: 'INFO', createdById: SYSTEM_ACTOR, updatedById: SYSTEM_ACTOR }, select: { id: true } })
  const list = await prisma.holidayList.create({ data: { name: `Test list ${n}`, companyId, createdById: SYSTEM_ACTOR, updatedById: SYSTEM_ACTOR }, select: { id: true } })
  return { categoryId: category.id, holidayListId: list.id }
}

// the employees follow the list from `from` (long ago by default) - as on their joining day, without the lock checks
export async function followList(employeeIds: number[], holidayListId: number, from = new Date(Date.UTC(2020, 0, 1))) {
  for (const employeeId of employeeIds) await listsService.giveOnJoining(employeeId, holidayListId, from, SYSTEM_ACTOR, prisma)
}
