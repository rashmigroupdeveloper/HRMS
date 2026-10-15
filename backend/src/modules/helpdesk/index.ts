/** Helpdesk module public API (module pattern — see ../README.md). */
export { helpdeskRouter } from './helpdesk.router.js';
export { escalateBreachedTickets } from './helpdesk.service.js';
export { runHelpdeskEscalationJob } from './escalation.job.js';
