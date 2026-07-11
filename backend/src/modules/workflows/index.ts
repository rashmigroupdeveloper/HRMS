/** Workflows module public API (module pattern — see ../README.md). */
export { workflowsRouter } from './workflows.router.js';
export {
  createRequest,
  act,
  resubmit,
  runEscalations,
  inbox,
  timeline,
  onWorkflowFinal,
  clearWorkflowFinalHooks,
  type WorkflowFinalStatus,
  type RequestRow,
} from './workflow.service.js';
export { WORKFLOW_DEFINITIONS } from './definitions.seed.js';
