import { JoiningType } from '#core/db/prisma'
import { idSchema, nameSchema } from '#shared/schemas/common.schema'
import { employeesSchemas } from '#modules/employees'
import { z } from 'zod'

// Input schemas of the joining tasks (2026-11-16): the list of task types HR keeps, and the tasks of new employees.

// the team's name on a task (the role's name when the task was made) - the filter of My tasks
const teamSchema = z.string().trim().min(1, 'Team is required').max(50)
const descriptionSchema = z.string().trim().max(1000)
// due this many days after the date of joining (0 = on the joining day)
const dueDaysSchema = z.number().int().min(0).max(365)
// only for these joining types; empty = every joining type
const joiningTypesSchema = z.array(z.enum(JoiningType)).max(3)
// a holder of the task's role (the team), by employee code (checked in the service)
const assigneeCodeSchema = employeesSchemas.employeeCodeSchema

export const listTaskTypesInput = z.object({ includeInactive: z.boolean().optional() }).optional()

export const createTaskTypeInput = z.object({
  name: nameSchema,
  // the team: a role that gives "Joining tasks: Edit" (the user, 2026-11-20)
  roleId: idSchema,
  description: descriptionSchema.nullish(),
  dueDays: dueDaysSchema,
  joiningTypes: joiningTypesSchema.default([]),
  // the person it is given to by default - a holder of the role (HR can pick another at joining)
  defaultAssigneeCode: assigneeCodeSchema.nullish(),
})

// Only the fields sent change; `defaultAssigneeCode: null` removes the default person
export const updateTaskTypeInput = z.object({
  id: idSchema,
  name: nameSchema.optional(),
  roleId: idSchema.optional(),
  description: descriptionSchema.nullish(),
  dueDays: dueDaysSchema.optional(),
  joiningTypes: joiningTypesSchema.optional(),
  defaultAssigneeCode: assigneeCodeSchema.nullish(),
  isActive: z.boolean().optional(),
})

// The teams (roles with "Joining tasks: Edit") and their people; with `placement` (a new employee's company / plant /
// department): only the people whose data access on that role covers it
export const assigneesInput = z
  .object({ placement: z.object({ companyId: idSchema, plantId: idSchema, departmentId: idSchema.nullable() }).optional() })
  .optional()

// Who does each task of a new employee, picked by HR at joining (a task type left out: its default person)
export const taskAssigneesSchema = z.array(z.object({ taskTypeId: idSchema, assigneeCode: assigneeCodeSchema })).max(100)

// My tasks: the tasks given to me (MINE) or - Onboarding: View - every task (ALL); open ones (oldest due first) or done
// ones (latest first); a team; a name / employee code
export const listTasksInput = z.object({
  scope: z.enum(['MINE', 'ALL']).default('MINE'),
  status: z.enum(['OPEN', 'DONE']).default('OPEN'),
  team: teamSchema.optional(),
  search: z.string().trim().max(100).optional(),
})

export const employeeTasksInput = z.object({ employeeCode: employeesSchemas.employeeCodeSchema })

export const completeTaskInput = z.object({ id: idSchema, note: z.string().trim().max(500).nullish() })

export const assignTaskInput = z.object({ id: idSchema, assigneeCode: assigneeCodeSchema })

export const taskIdInput = z.object({ id: idSchema })

export const exportTasksInput = listTasksInput.extend({ ids: z.array(idSchema).max(1000).optional() })
