/** Compliance module public API (module pattern — see ../README.md). */
export { complianceRouter } from './compliance.router.js';
export {
  expiryState,
  expiryUrgency,
  parseAlertStages,
  type ExpiryState,
  type ExpiryView,
} from './expiry.js';
export {
  listRegistrations,
  registrationPosture,
  retireRegistration,
  sendRegistrationAlert,
  upsertRegistration,
  type CompanyPosture,
  type RegistrationFilters,
  type RegistrationInput,
  type RegistrationView,
} from './registrations.service.js';
export {
  deriveStatus,
  listCalendar,
  listEvidence,
  recordFiling,
  sendCalendarReminder,
  upsertCalendarItem,
  waiveItem,
  type CalendarFilters,
  type CalendarItemInput,
  type CalendarItemView,
  type DerivedStatus,
  type FilingResult,
} from './calendar.service.js';
