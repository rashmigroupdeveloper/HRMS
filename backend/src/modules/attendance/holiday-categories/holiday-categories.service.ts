import { assertAccess } from '#core/auth/access'
import { assertGroupWide } from '#core/auth/scope'
import type { CurrentUser } from '#core/rpc/procedures'
import { ORPCError } from '@orpc/server'
import type { z } from 'zod'
import * as categoriesRepository from './holiday-categories.repository.js'
import type { createHolidayCategoryInput, updateHolidayCategoryInput } from './holiday-categories.schema.js'

// Holiday categories (the user, 2026-11-24): HR's labels for holidays (National, Festival, Election...), each with one of
// the app's colours - shown on the calendars and reports. One list for every company: everyone sees the categories in use
// (the retired ones: Attendance setup View); changing them needs Attendance setup Edit for all companies.

export function listHolidayCategories(viewer: CurrentUser, includeInactive = false) {
  if (includeInactive) assertAccess(viewer.access, 'ATTENDANCE_SETUP', 'READ')
  return categoriesRepository.list(includeInactive)
}

// A category a holiday may be given: there and in use
export async function getActiveCategory(id: number) {
  const category = await categoriesRepository.find(id)
  if (!category) throw new ORPCError('NOT_FOUND', { message: `No holiday category with id ${id}` })
  if (!category.isActive) throw new ORPCError('BAD_REQUEST', { message: `${category.name} is retired` })
  return category
}

export async function createHolidayCategory(input: z.infer<typeof createHolidayCategoryInput>, viewer: CurrentUser) {
  assertGroupWide(viewer, 'ATTENDANCE_SETUP', 'A holiday category')
  return categoriesRepository.create(input, viewer.employeeId)
}

export async function updateHolidayCategory({ id, ...changes }: z.infer<typeof updateHolidayCategoryInput>, viewer: CurrentUser) {
  assertGroupWide(viewer, 'ATTENDANCE_SETUP', 'A holiday category')
  if (!(await categoriesRepository.find(id))) throw new ORPCError('NOT_FOUND', { message: `No holiday category with id ${id}` })
  return categoriesRepository.update(id, changes, viewer.employeeId)
}
