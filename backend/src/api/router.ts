/**
 * The application router — every module's procedures assembled in one tree.
 * This object's shape IS the API; the OpenAPI spec is generated from it.
 */
import { documentsRouter } from '../modules/documents/index.js';
import { atsBridgeRouter } from '../modules/ats-bridge/index.js';
import {ssoRouter} from '../modules/sso/index.js';
import { systemRouter } from '../modules/system/index.js';
import { authRouter, sessionsRouter } from '../modules/auth/index.js';
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
import { employeesRouter, familyRouter } from '../modules/employees/index.js';
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
import { coreRouter, mastersRouter } from '../modules/core/index.js';
import { bulkRouter, employeeMasterRouter } from '../modules/bulk/index.js';
import { tdsRouter } from '../modules/tds/index.js';
import { irdRouter } from '../modules/ird/index.js';
import { complianceRouter } from '../modules/compliance/index.js';
import { privacyRouter } from '../modules/privacy/index.js';

export const appRouter = {
  compliance: complianceRouter,
  privacy: privacyRouter,
  ird: irdRouter,
  documents: documentsRouter,
  atsBridge: atsBridgeRouter,
  sso:ssoRouter,
  system: systemRouter,
  core: coreRouter,
  masters: mastersRouter,
  auth: authRouter,
  sessions: sessionsRouter,
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
  family: familyRouter,
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
  employeeMaster: employeeMasterRouter,
  tds: tdsRouter,
};

export type AppRouter = typeof appRouter;
