import { accessProcedure, authedProcedure } from '#core/rpc/procedures'
import { copyYearInput, createHolidayInput, holidayIdInput, listHolidaysInput, myHolidaysInput, updateHolidayInput } from './holidays.schema.js'
import * as holidaysService from './holidays.service.js'

// attendance.holidays.* - the holidays, each in the holiday lists that have it (2026-11-24). Every list's: Attendance setup:
// View (the setup page - 2026-11-24: employees see only their own, `mine`); changed: Attendance setup: Edit over every list
// it is in (checked in the service).
const editProcedure = accessProcedure('ATTENDANCE_SETUP', 'WRITE')

export const holidaysRouter = {
  list: accessProcedure('ATTENDANCE_SETUP', 'READ').input(listHolidaysInput).handler(({ input }) => holidaysService.listHolidays(input.year, input.holidayListId)),
  // one's own: the holidays of the list followed on each date (My leave - 2026-11-24)
  mine: authedProcedure.input(myHolidaysInput).handler(({ input, context }) => holidaysService.myHolidays(context.user, input.year)),
  create: editProcedure.input(createHolidayInput).handler(({ input, context }) => holidaysService.createHoliday(input, context.user)),
  update: editProcedure.input(updateHolidayInput).handler(({ input, context }) => holidaysService.updateHoliday(input, context.user)),
  delete: editProcedure.input(holidayIdInput).handler(({ input, context }) => holidaysService.deleteHoliday(input.id, context.user)),
  // "copy from last year" (2026-11-24)
  copyYear: editProcedure.input(copyYearInput).handler(({ input, context }) => holidaysService.copyYear(input, context.user)),
}
