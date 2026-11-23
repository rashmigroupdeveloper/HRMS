import { accessProcedure, authedProcedure } from '#core/rpc/procedures'
import { appointHodInput, endHodInput, hodHistoryInput } from './hods.schema.js'
import * as hodsService from './hods.service.js'

// HOD appointments (BACKLOG 3e - an HOD post is a plant-department). Routes + controller only - the rules are in
// hods.service.ts.
export const hodsRouter = {
  // The HODs with the posts each heads now or will head (inside the viewer's data access).
  list: accessProcedure('HOD_APPOINTMENTS', 'READ').handler(({ context }) => hodsService.listHods(context.user)),
  // Every post (company + plant + department) inside the viewer's data access, with who heads it now and next.
  places: accessProcedure('HOD_APPOINTMENTS', 'READ').handler(({ context }) => hodsService.listPlaces(context.user)),
  // Appoints an employee to posts now, from a later or an earlier moment (replacing their HODs then) - and ends some of
  // theirs at the same moment.
  appoint: accessProcedure('HOD_APPOINTMENTS', 'WRITE')
    .input(appointHodInput)
    .handler(({ input, context }) => hodsService.appointHod(input, context.user)),
  // Ends an employee's appointments on some posts (now, or after a last day) - cancels an upcoming one, or takes back a
  // planned end.
  end: accessProcedure('HOD_APPOINTMENTS', 'WRITE')
    .input(endHodInput)
    .handler(({ input, context }) => hodsService.endHod(input, context.user)),
  // Who headed a post when - or the posts an employee headed.
  history: accessProcedure('HOD_APPOINTMENTS', 'READ')
    .input(hodHistoryInput)
    .handler(({ input, context }) => hodsService.hodHistory(input, context.user)),
  // What needs HR: posts with employees but no HOD, HODs stopping with nobody after them, leavers still heading posts.
  gaps: accessProcedure('HOD_APPOINTMENTS', 'READ').handler(({ context }) => hodsService.listGaps(context.user)),
  // "My department": the employees whose HOD the logged-in employee is (read-only, no role needed).
  myDepartment: authedProcedure.handler(({ context }) => hodsService.myDepartment(context.user)),
}
