import { accessProcedure } from '#core/rpc/procedures'
import { addManualPunchesInput, linkUnmatchedInput, uploadPunchesInput } from './punches.schema.js'
import * as punchesService from './punches.service.js'

// attendance.punches.* - the biometric machines' punches. Upload / link: Attendance setup: Edit; lists: Attendance setup: View.
export const punchesRouter = {
  upload: accessProcedure('ATTENDANCE_SETUP', 'WRITE')
    .input(uploadPunchesInput)
    .handler(({ input, context }) => punchesService.uploadPunches(input, context.user)),
  // for testing only - refused in production (2026-11-22)
  addManual: accessProcedure('ATTENDANCE_SETUP', 'WRITE')
    .input(addManualPunchesInput)
    .handler(({ input, context }) => punchesService.addManualPunches(input, context.user)),
  uploads: accessProcedure('ATTENDANCE_SETUP', 'READ').handler(() => punchesService.listUploads()),
  unmatched: accessProcedure('ATTENDANCE_SETUP', 'READ').handler(() => punchesService.listUnmatched()),
  link: accessProcedure('ATTENDANCE_SETUP', 'WRITE')
    .input(linkUnmatchedInput)
    .handler(({ input, context }) => punchesService.linkUnmatched(input, context.user)),
}
