import { accessProcedure } from '#core/rpc/procedures'
import { clearRosterInput, publishRosterInput, rosterGridInput, saveRosterInput } from './rosters.schema.js'
import * as rostersService from './rosters.service.js'

// attendance.rosters.* - part of the attendance setup (2026-11-22): seen with Attendance setup: View, changed with Edit -
// each employee inside the caller's data access (checked in the service).
export const rostersRouter = {
  grid: accessProcedure('ATTENDANCE_SETUP', 'READ').input(rosterGridInput).handler(({ input, context }) => rostersService.getGrid(context.user, input)),
  save: accessProcedure('ATTENDANCE_SETUP', 'WRITE').input(saveRosterInput).handler(({ input, context }) => rostersService.saveCells(context.user, input)),
  clear: accessProcedure('ATTENDANCE_SETUP', 'WRITE').input(clearRosterInput).handler(({ input, context }) => rostersService.clearCells(context.user, input)),
  publish: accessProcedure('ATTENDANCE_SETUP', 'WRITE').input(publishRosterInput).handler(({ input, context }) => rostersService.publish(context.user, input)),
}
