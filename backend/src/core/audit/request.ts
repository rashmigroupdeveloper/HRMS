import { AsyncLocalStorage } from 'node:async_hooks'
import { basename } from 'node:path'

// What the change history records about the request that made a change: the API, the IP and browser, and who is
// logged in. Set by core/rpc for every API call (the actor once the session is known); outside a request (a script,
// a job) the source is the script's name and the actor System.

export type AuditRequest = {
  // the API, e.g. "employees.update"
  source: string
  ip: string | null
  userAgent: string | null
  // the logged-in employee's id, or 0 (System - also the candidate on their own pages); undefined until known
  actorId?: number
}

const requests = new AsyncLocalStorage<AuditRequest>()

// Runs `fn` with these request details (everything it awaits sees them)
export function runWithAuditRequest<T>(request: AuditRequest, fn: () => T): T {
  return requests.run(request, fn)
}

// Who is acting in this request - called once the session (or the candidate's session) is known
export function setAuditActor(actorId: number) {
  const request = requests.getStore()
  if (request) request.actorId = actorId
}

// The current request's details; outside a request: the script that runs
export function currentAuditRequest(): AuditRequest {
  return requests.getStore() ?? { source: `script:${basename(process.argv[1] ?? 'unknown').replace(/\.[cm]?[jt]s$/, '')}`, ip: null, userAgent: null }
}
