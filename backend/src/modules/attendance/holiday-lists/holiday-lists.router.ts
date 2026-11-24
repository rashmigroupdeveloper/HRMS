import { accessProcedure, authedProcedure } from '#core/rpc/procedures'
import { listInput } from '#shared/schemas/common.schema'
import { assignHolidayListInput, createHolidayListInput, fillMissingInput, setPlantDefaultInput, updateHolidayListInput } from './holiday-lists.schema.js'
import * as listsService from './holiday-lists.service.js'

// attendance.holidayLists.* (2026-11-24) - read: any logged-in employee (retired ones: Attendance setup: View); changed:
// Attendance setup: Edit over the list's company (every company's list: all companies) or the plant (checked in the service).
const editProcedure = accessProcedure('ATTENDANCE_SETUP', 'WRITE')

export const holidayListsRouter = {
  list: authedProcedure.input(listInput).handler(({ input, context }) => listsService.listHolidayLists(context.user, input?.includeInactive)),
  create: editProcedure.input(createHolidayListInput).handler(({ input, context }) => listsService.createHolidayList(input, context.user)),
  update: editProcedure.input(updateHolidayListInput).handler(({ input, context }) => listsService.updateHolidayList(input, context.user)),
  setPlantDefault: editProcedure.input(setPlantDefaultInput).handler(({ input, context }) => listsService.setPlantDefault(input, context.user)),
  // employees follow a list from a date (one or many - 2026-11-24)
  assign: editProcedure.input(assignHolidayListInput).handler(({ input, context }) => listsService.assignHolidayList(input, context.user)),
  // everyone without a list gets their plant's default
  fillMissing: editProcedure.input(fillMissingInput).handler(({ input, context }) => listsService.fillMissing(input, context.user)),
}
