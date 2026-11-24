import { accessProcedure, authedProcedure } from '#core/rpc/procedures'
import {
  exportTasksInput,
  assigneesInput,
  assignTaskInput,
  completeTaskInput,
  createTaskTypeInput,
  employeeTasksInput,
  listTasksInput,
  listTaskTypesInput,
  taskIdInput,
  updateTaskTypeInput,
} from './joining-tasks.schema.js'
import * as joiningTasksService from './joining-tasks.service.js'

// Routes + controller layer. The task list (types): Joining task types View to see it - or Onboarding Edit, the active
// ones for the joining dialog (checked in the service) - Joining task types Edit to change it (2026-11-21). The tasks: each person sees the ones given to them (Joining tasks View) and
// marks them done (Joining tasks Edit); HR sees all (Onboarding View), reassigns them and marks any done (Onboarding Edit).
const hrProcedure = accessProcedure('ONBOARDING', 'WRITE')
const typesProcedure = accessProcedure('JOINING_TASK_TYPES', 'WRITE')

export const joiningTasksRouter = {
  export: authedProcedure.input(exportTasksInput).handler(({ input, context }) => joiningTasksService.exportTasks(input, context.user)),
  types: {
    export: authedProcedure.input(listTaskTypesInput).handler(({ input, context }) => joiningTasksService.exportTaskTypes(context.user, input?.includeInactive)),
    list: authedProcedure.input(listTaskTypesInput).handler(({ input, context }) => joiningTasksService.listTaskTypes(context.user, input?.includeInactive)),
    create: typesProcedure.input(createTaskTypeInput).handler(({ input, context }) => joiningTasksService.createTaskType(input, context.user)),
    update: typesProcedure.input(updateTaskTypeInput).handler(({ input, context }) => joiningTasksService.updateTaskType(input, context.user)),
  },
  // The teams (roles with "Joining tasks: Edit") and their people - with a placement, those covering a new employee there
  // (Onboarding View or Joining task types View - checked in the service)
  assignees: authedProcedure.input(assigneesInput).handler(({ input, context }) => joiningTasksService.listAssignees(context.user, input)),
  // My tasks (MINE: Joining tasks View; ALL: Onboarding View - checked in the service)
  list: authedProcedure.input(listTasksInput).handler(({ input, context }) => joiningTasksService.listTasks(input, context.user)),
  // One employee's tasks (profile): own record, or Employee · Directory & job View (checked in the service)
  forEmployee: authedProcedure.input(employeeTasksInput).handler(({ input, context }) => joiningTasksService.listForEmployee(context.user, input.employeeCode)),
  // For an employee HR added directly (not through onboarding)
  createForEmployee: hrProcedure
    .input(employeeTasksInput)
    .handler(({ input, context }) => joiningTasksService.createForEmployeeCode(input.employeeCode, context.user)),
  // Done / undo: the person it is given to, or HR (checked in the service)
  complete: authedProcedure.input(completeTaskInput).handler(({ input, context }) => joiningTasksService.completeTask(input, context.user)),
  reopen: authedProcedure.input(taskIdInput).handler(({ input, context }) => joiningTasksService.reopenTask(input.id, context.user)),
  // Give an open task to someone else
  assign: hrProcedure.input(assignTaskInput).handler(({ input, context }) => joiningTasksService.assignTask(input, context.user)),
}
