import { accessProcedure, authedProcedure } from '#core/rpc/procedures'
import { listInput } from '#shared/schemas/common.schema'
import { assignShiftInput, createPatternInput, createShiftInput, employeeAssignmentsInput, listSchedulesInput, updatePatternInput, updateShiftInput } from './shifts.schema.js'
import * as shiftsService from './shifts.service.js'

// attendance.shifts.* - shifts, default shifts and roster patterns. Read: any logged-in employee (retired ones:
// Attendance setup: View); set up: Attendance setup: Edit.
const editProcedure = accessProcedure('ATTENDANCE_SETUP', 'WRITE')

export const shiftsRouter = {
  list: authedProcedure.input(listInput).handler(({ input, context }) => shiftsService.listShifts(context.user, input?.includeInactive)),
  create: editProcedure.input(createShiftInput).handler(({ input, context }) => shiftsService.createShift(input, context.user)),
  update: editProcedure.input(updateShiftInput).handler(({ input, context }) => shiftsService.updateShift(input, context.user)),
  // the default shift + weekly offs of employees from a date (in bulk)
  assign: editProcedure.input(assignShiftInput).handler(({ input, context }) => shiftsService.assignShift(input, context.user)),
  // who follows which pattern and policy today (Attendance setup: View - inside its data access)
  schedules: accessProcedure('ATTENDANCE_SETUP', 'READ').input(listSchedulesInput).handler(({ input, context }) => shiftsService.listSchedules(context.user, input ?? {})),
  // one employee's schedules (own, or Attendance setup: View)
  assignments: authedProcedure.input(employeeAssignmentsInput).handler(({ input, context }) => shiftsService.listEmployeeAssignments(context.user, input.employeeCode)),
  patterns: {
    list: authedProcedure.input(listInput).handler(({ input, context }) => shiftsService.listPatterns(context.user, input?.includeInactive)),
    create: editProcedure.input(createPatternInput).handler(({ input, context }) => shiftsService.createPattern(input, context.user)),
    update: editProcedure.input(updatePatternInput).handler(({ input, context }) => shiftsService.updatePattern(input, context.user)),
  },
}
