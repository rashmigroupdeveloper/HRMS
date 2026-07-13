/**
 * The application router — every module's procedures assembled in one tree.
 * This object's shape IS the API; the OpenAPI spec is generated from it.
 */
import { systemRouter } from '../modules/system/index.js';
import { authRouter } from '../modules/auth/index.js';
import { settingsRouter } from '../modules/settings/index.js';
import { rbacRouter } from '../modules/rbac/index.js';
import {
  attendanceRouter,
  attendanceConfigRouter,
  attendanceRequestsRouter,
  absenceRouter,
} from '../modules/attendance/index.js';
import { workflowsRouter } from '../modules/workflows/index.js';
import { employeesRouter } from '../modules/employees/index.js';
import { leaveRouter } from '../modules/leave/index.js';
import { lettersRouter } from '../modules/letters/index.js';
import { policiesRouter } from '../modules/policies/index.js';
import { reportsRouter } from '../modules/reports/index.js';
import { lifecycleRouter } from '../modules/lifecycle/index.js';

export const appRouter = {
  system: systemRouter,
  auth: authRouter,
  settings: settingsRouter,
  rbac: rbacRouter,
  attendance: {
    ...attendanceRouter,
    ...attendanceConfigRouter,
    ...attendanceRequestsRouter,
    ...absenceRouter
  },
  workflows: workflowsRouter,
  employees: employeesRouter,
  leave: leaveRouter,
  letters: lettersRouter,
  policies: policiesRouter,
  reports: reportsRouter,
  lifecycle: lifecycleRouter,
};

export type AppRouter = typeof appRouter;
