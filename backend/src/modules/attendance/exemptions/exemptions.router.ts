import { accessProcedure } from '#core/rpc/procedures'
import { createExemptionInput, deleteExemptionInput, updateExemptionInput } from './exemptions.schema.js'
import * as exemptionsService from './exemptions.service.js'

// attendance.exemptions.* - "attendance not tracked" (2026-11-27): part of the attendance setup, changed with Attendance
// setup Edit - each employee inside the caller's data access (checked in the service). Who is marked is read with the
// Schedules list (attendance.shifts.schedules).
const editProcedure = accessProcedure('ATTENDANCE_SETUP', 'WRITE')

export const exemptionsRouter = {
  create: editProcedure.input(createExemptionInput).handler(({ input, context }) => exemptionsService.markNotTracked(input, context.user)),
  update: editProcedure.input(updateExemptionInput).handler(({ input, context }) => exemptionsService.updateMarker(input, context.user)),
  delete: editProcedure.input(deleteExemptionInput).handler(({ input, context }) => exemptionsService.removeMarker(input, context.user)),
}
