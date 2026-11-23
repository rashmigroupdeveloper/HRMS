import { authedProcedure } from '#core/rpc/procedures'
import * as attendanceService from './attendance.service.js'
import { daysRouter } from './days/days.router.js'
import { holidaysRouter } from './holidays/holidays.router.js'
import { locksRouter } from './locks/locks.router.js'
import { policiesRouter } from './policies/policies.router.js'
import { punchesRouter } from './punches/punches.router.js'
import { regularizationsRouter } from './regularizations/regularizations.router.js'
import { rostersRouter } from './rosters/rosters.router.js'
import { shiftChangesRouter } from './shift-changes/shift-changes.router.js'
import { shiftsRouter } from './shifts/shifts.router.js'

// attendance.* (2026-11-16): one's own attendance for everyone; a manager's reporting tree; the "Attendance" area for
// everyone's (View) and the setup, corrections and HR's approvals (Edit).
export const attendanceRouter = {
  // the viewer's today, team size, what waits for them, what they may do
  overview: authedProcedure.handler(({ context }) => attendanceService.getOverview(context.user)),
  days: daysRouter,
  shifts: shiftsRouter,
  policies: policiesRouter,
  // the attendance month lock (2026-11-22)
  locks: locksRouter,
  holidays: holidaysRouter,
  punches: punchesRouter,
  rosters: rostersRouter,
  shiftChanges: shiftChangesRouter,
  // missed-punch regularizations and on-duty requests (2026-11-22)
  regularizations: regularizationsRouter,
}
