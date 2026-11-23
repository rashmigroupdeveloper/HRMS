import type { AppRouter } from '@backend/router'
import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import type { RouterClient } from '@orpc/server'
import { createTanstackQueryUtils } from '@orpc/tanstack-query'
import { readActiveRole } from './active-role'

// Talks to the backend at /api/rpc (proxied by Vite in development).
// All input/output types come from the backend router - never write API types by hand.
const link = new RPCLink({
  url: `${window.location.origin}/api/rpc`,
  headers: () => {
    const role = readActiveRole()
    return role === undefined ? {} : { 'x-hrms-role': role }
  },
})

// Direct calls, e.g. await client.health.check()
export const client: RouterClient<AppRouter> = createORPCClient(link)

// TanStack Query helpers, e.g. useQuery(orpc.health.check.queryOptions())
export const orpc = createTanstackQueryUtils(client)
