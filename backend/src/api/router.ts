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
  schedulingRouter,
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
import { securityRouter } from '../modules/security/index.js';
import { complianceRouter } from '../modules/compliance/index.js';
import { claimsRouter } from '../modules/claims/index.js';
import { orgRouter } from '../modules/org/index.js';
import { documentsRouter } from '../modules/documents/index.js';
import { privacyRouter } from '../modules/privacy/index.js';
import { irdRouter } from '../modules/ird/index.js';

export const appRouter = {
  system: systemRouter,
  auth: authRouter,
  settings: settingsRouter,
  rbac: rbacRouter,
  attendance: {
    ...attendanceRouter,
    ...attendanceConfigRouter,
    ...attendanceRequestsRouter,
    ...absenceRouter,
    ...schedulingRouter,
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
  security: securityRouter,
  compliance: complianceRouter,
  claims: claimsRouter,
  org: orgRouter,
  documents: documentsRouter,
  privacy: privacyRouter,
  ird: irdRouter,
};

export type AppRouter = typeof appRouter;
