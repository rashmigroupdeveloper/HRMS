/** Workflows module public API (module pattern — see ../README.md). */
export { workflowsRouter } from './workflows.router.js';
export { createRequest, act, resubmit, runEscalations, inbox, timeline } from './workflow.service.js';
export { WORKFLOW_DEFINITIONS } from './definitions.seed.js';
