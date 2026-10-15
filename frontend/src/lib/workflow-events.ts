/** Refresh approval counts after the server commits a workflow mutation. */
export const WORKFLOW_CHANGED_EVENT = 'hrms:workflow-changed';

export function notifyWorkflowChanged(): void {
  window.dispatchEvent(new Event(WORKFLOW_CHANGED_EVENT));
}
