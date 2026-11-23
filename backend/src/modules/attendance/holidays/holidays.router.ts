import { accessProcedure, authedProcedure } from '#core/rpc/procedures'
import { createHolidayInput, holidayIdInput, listHolidaysInput, updateHolidayInput } from './holidays.schema.js'
import * as holidaysService from './holidays.service.js'

// attendance.holidays.* - the holiday calendar. Read: any logged-in employee; changed: Attendance setup: Edit.
const editProcedure = accessProcedure('ATTENDANCE_SETUP', 'WRITE')

export const holidaysRouter = {
  list: authedProcedure.input(listHolidaysInput).handler(({ input }) => holidaysService.listHolidays(input.year)),
  create: editProcedure.input(createHolidayInput).handler(({ input, context }) => holidaysService.createHoliday(input, context.user)),
  update: editProcedure.input(updateHolidayInput).handler(({ input, context }) => holidaysService.updateHoliday(input, context.user)),
  delete: editProcedure.input(holidayIdInput).handler(({ input, context }) => holidaysService.deleteHoliday(input.id, context.user)),
}
