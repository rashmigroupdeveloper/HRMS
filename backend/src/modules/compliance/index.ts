/** Public API of the compliance module (Phase 5). */
import { complianceRouter as hubRouter } from './compliance.router.js';
import { registersRouter } from './registers.router.js';
import { wageRouter } from './wage.router.js';

export const complianceRouter = { ...hubRouter, ...wageRouter, ...registersRouter };
export { assertWageDefinition, type WageComponent, type WageViolation } from './wage-definition.js';
export {
  listRegisterCatalog,
  PAYROLL_BLOCK_REASON,
  REGISTER_CATALOG,
  REGISTER_CODES,
} from './registers.service.js';
// Shared expiry ladder — documents, gate passes and certifications import from here.
export {
  expiryState,
  expiryUrgency,
  parseAlertStages,
  type ExpiryState,
  type ExpiryView,
} from './expiry.js';
