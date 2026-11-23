import { accessProcedure } from '#core/rpc/procedures'
import { cycleStartInput, monthLockInput, unlockMonthInput, yearInput } from './locks.schema.js'
import * as locksService from './locks.service.js'

// attendance.locks.* (2026-11-22) - the attendance month lock, one for the whole group: Attendance setup Edit for all companies
// (checked in the service).
const editProcedure = accessProcedure('ATTENDANCE_SETUP', 'WRITE')

export const locksRouter = {
  months: editProcedure.input(yearInput).handler(({ input, context }) => locksService.listMonths(context.user, input.year)),
  checklist: editProcedure.input(monthLockInput).handler(({ input, context }) => locksService.getChecklist(context.user, input)),
  lock: editProcedure.input(monthLockInput).handler(({ input, context }) => locksService.lockMonth(context.user, input)),
  unlock: editProcedure.input(unlockMonthInput).handler(({ input, context }) => locksService.unlockMonth(context.user, input)),
  setCycleStart: editProcedure.input(cycleStartInput).handler(({ input, context }) => locksService.setCycleStart(context.user, input)),
}
