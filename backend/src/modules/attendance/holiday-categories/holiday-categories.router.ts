import { accessProcedure, authedProcedure } from '#core/rpc/procedures'
import { listInput } from '#shared/schemas/common.schema'
import { createHolidayCategoryInput, updateHolidayCategoryInput } from './holiday-categories.schema.js'
import * as categoriesService from './holiday-categories.service.js'

// attendance.holidayCategories.* (2026-11-24) - read: any logged-in employee (retired ones: Attendance setup: View); changed:
// Attendance setup: Edit for all companies (checked in the service).
const editProcedure = accessProcedure('ATTENDANCE_SETUP', 'WRITE')

export const holidayCategoriesRouter = {
  list: authedProcedure.input(listInput).handler(({ input, context }) => categoriesService.listHolidayCategories(context.user, input?.includeInactive)),
  create: editProcedure.input(createHolidayCategoryInput).handler(({ input, context }) => categoriesService.createHolidayCategory(input, context.user)),
  update: editProcedure.input(updateHolidayCategoryInput).handler(({ input, context }) => categoriesService.updateHolidayCategory(input, context.user)),
}
