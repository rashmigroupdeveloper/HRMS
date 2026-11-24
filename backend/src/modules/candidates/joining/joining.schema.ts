import { employeesSchemas } from '#modules/employees'
import { joiningTasksSchemas } from '#modules/joining-tasks'
import { emailSchema, idSchema } from '#shared/schemas/common.schema'
import { z } from 'zod'

export const joiningChecklistInput = z.object({ candidateId: idSchema })

// What HR fills in on the joining day; everything else comes from the offer and the joining-form draft.
export const completeJoiningInput = z.object({
  candidateId: idSchema,
  // (no employee code: the next of the company's series is taken - 2026-11-16)
  // who the new employee reports to, by employee code
  reportingManagerCode: employeesSchemas.employeeCodeSchema.optional(),
  // the holiday list the new employee follows from the date of joining (the user, 2026-11-24 - the plant's default is
  // offered; HR changes it later on Attendance setup > Schedules). Left out: no list - no holidays until HR gives one
  holidayListId: idSchema.optional(),
  // The day the person actually joined (usually the proposed joining date)
  dateOfJoining: z.date(),
  workEmail: emailSchema.optional(),
  probationEndDate: z.date().optional(),
  // who does each joining task (2026-11-16) - left out: the task's default person; every task needs one (2026-11-20)
  taskAssignees: joiningTasksSchemas.taskAssigneesSchema.optional(),
  // the joining tasks HR unticked - not needed for this employee (the user, 2026-11-20); every other task needs a person
  skipTaskTypeIds: z.array(idSchema).max(100).optional(),
  // HR says the employee gets no joining tasks - required when none is set up for the joining type, refused otherwise
  noJoiningTasks: z.boolean().optional(),
})
