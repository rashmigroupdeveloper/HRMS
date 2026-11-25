import { dailyMovementReportsRouter } from '#modules/daily-movement-reports'
import { accountsRouter } from '#modules/accounts'
import { approvalsRouter } from '#modules/approvals'
import { attendanceRouter } from '#modules/attendance'
import { leaveRouter } from '#modules/leave'
import { candidatesRouter } from '#modules/candidates'
import { changeHistoryRouter } from '#modules/change-history'
import { employeeLettersRouter } from '#modules/employee-letters'
import { employeesRouter } from '#modules/employees'
import { healthRouter } from '#modules/health'
import { jobChangesRouter } from '#modules/job-changes'
import { joiningTasksRouter } from '#modules/joining-tasks'
import { letterTemplatesRouter } from '#modules/letter-templates'
import { organizationRouter } from '#modules/organization'

// The whole API. Every module's router is added here.
// The frontend imports the *type* of this object, so it always knows every input and output.
export const router = {
  health: healthRouter,
  accounts: accountsRouter,
  dailyMovementReports: dailyMovementReportsRouter,
  organization: organizationRouter,
  employees: employeesRouter,
  candidates: candidatesRouter,
  letterTemplates: letterTemplatesRouter,
  changeHistory: changeHistoryRouter,
  employeeLetters: employeeLettersRouter,
  joiningTasks: joiningTasksRouter,
  attendance: attendanceRouter,
  leave: leaveRouter,
  approvals: approvalsRouter,
  jobChanges: jobChangesRouter,
}

export type AppRouter = typeof router
