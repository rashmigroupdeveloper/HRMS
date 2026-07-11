/**
 * The application router — every module's procedures assembled in one tree.
 * This object's shape IS the API; the OpenAPI spec is generated from it.
 */
import { systemRouter } from '../modules/system/index.js';
import { authRouter } from '../modules/auth/index.js';
import { settingsRouter } from '../modules/settings/index.js';
import { rbacRouter } from '../modules/rbac/index.js';
import { attendanceRouter, attendanceConfigRouter, attendanceRequestsRouter } from '../modules/attendance/index.js';
import { workflowsRouter } from '../modules/workflows/index.js';

export const appRouter = {
  system: systemRouter,
  auth: authRouter,
  settings: settingsRouter,
  rbac: rbacRouter,
  attendance: { ...attendanceRouter, ...attendanceConfigRouter, ...attendanceRequestsRouter },
  workflows: workflowsRouter,
};

export type AppRouter = typeof appRouter;
