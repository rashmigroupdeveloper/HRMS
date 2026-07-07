/**
 * The application router — every module's procedures assembled in one tree.
 * This object's shape IS the API; the OpenAPI spec is generated from it.
 */
import { systemRouter } from '../modules/system/index.js';
import { authRouter } from '../modules/auth/index.js';
import { settingsRouter } from '../modules/settings/index.js';
import { rbacRouter } from '../modules/rbac/index.js';

export const appRouter = {
  system: systemRouter,
  auth: authRouter,
  settings: settingsRouter,
  rbac: rbacRouter,
};

export type AppRouter = typeof appRouter;
