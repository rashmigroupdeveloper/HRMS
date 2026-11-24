import { accessProcedure, authedProcedure } from '#core/rpc/procedures'
import { boardInput, exportMonthInput, correctDayInput, dayPunchesInput, employeeMonthInput, musterInput, myMonthInput, removeCorrectionInput } from './days.schema.js'
import * as daysService from './days.service.js'

// attendance.days.* - the days' results. One's own: anyone; someone else's: their manager (reporting tree) or
// Attendance: View (checked in the service); corrections: Attendance: Edit.
export const daysRouter = {
  exportMonth: authedProcedure.input(exportMonthInput).handler(({ input, context }) => daysService.exportMonth(context.user, input)),
  exportBoard: authedProcedure.input(boardInput).handler(({ input, context }) => daysService.exportBoard(context.user, input)),
  myMonth: authedProcedure.input(myMonthInput).handler(({ input, context }) => daysService.getMyMonth(context.user, input)),
  employeeMonth: authedProcedure.input(employeeMonthInput).handler(({ input, context }) => daysService.getEmployeeMonth(context.user, input)),
  board: authedProcedure.input(boardInput).handler(({ input, context }) => daysService.getBoard(context.user, input)),
  muster: authedProcedure.input(musterInput).handler(({ input, context }) => daysService.getMuster(context.user, input)),
  exportMuster: authedProcedure.input(musterInput).handler(({ input, context }) => daysService.exportMuster(context.user, input)),
  punches: authedProcedure.input(dayPunchesInput).handler(({ input, context }) => daysService.getDayPunches(context.user, input)),
  correct: accessProcedure('ATTENDANCE', 'WRITE')
    .input(correctDayInput)
    .handler(({ input, context }) => daysService.correctDay(input, context.user)),
  removeCorrection: accessProcedure('ATTENDANCE', 'WRITE')
    .input(removeCorrectionInput)
    .handler(({ input, context }) => daysService.removeCorrection(input, context.user)),
}
