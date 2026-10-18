/**
 * The application router — every module's procedures assembled in one tree.
 * This object's shape IS the API; the OpenAPI spec is generated from it.
 */
import { atsBridgeRouter } from '../modules/ats-bridge/index.js';
import {ssoRouter} from '../modules/sso/index.js';
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
import { auditRouter } from '../modules/audit/index.js';
import { assetsRouter } from '../modules/assets/index.js';
import { helpdeskRouter } from '../modules/helpdesk/index.js';
import { engagementRouter } from '../modules/engagement/index.js';
import { payrollCoreRouter } from '../modules/payroll-core/index.js';
import { payrollOutputsRouter } from '../modules/payroll-outputs/index.js';
import { loansRouter } from '../modules/loans/index.js';
import { claimsRouter } from '../modules/claims/index.js';
import { travelRouter } from '../modules/travel/index.js';
import { coreRouter } from '../modules/core/index.js';
import { bulkRouter } from '../modules/bulk/index.js';

export const appRouter = {
  atsBridge: atsBridgeRouter,
  sso:ssoRouter,
  system: systemRouter,
  core: coreRouter,
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
  audit: auditRouter,
  assets: assetsRouter,
  helpdesk: helpdeskRouter,
  engagement: engagementRouter,
  payroll: {
    ...payrollCoreRouter,
    outputs: payrollOutputsRouter,
  },
  loans: loansRouter,
  claims: claimsRouter,
  travel: travelRouter,
  bulk: bulkRouter,
};

export type AppRouter = typeof appRouter;
