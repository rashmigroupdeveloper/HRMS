/** Workflows module public API (module pattern — see ../README.md). */
export { workflowsRouter } from './workflows.router.js';
export {
  createRequest,
  act,
  resubmit,
  cancelRequest,
  runEscalations,
  inbox,
  timeline,
  onWorkflowFinal,
  onWorkflowResubmit,
  clearWorkflowFinalHooks,
  type WorkflowFinalStatus,
  type RequestRow,
} from './workflow.service.js';
export { WORKFLOW_DEFINITIONS } from './definitions.seed.js';
