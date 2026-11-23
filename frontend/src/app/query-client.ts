import { ORPCError } from '@orpc/client'
import { matchQuery, MutationCache, QueryCache, QueryClient, type Query } from '@tanstack/react-query'
import { orpc } from '@/lib/orpc'
import { isUnauthorized } from '@/lib/utils'

// Another API call says "not logged in" (session expired, logged out elsewhere, employee exited): re-check who is
// logged in. accounts.me then fails too, and RequireLogin sends the user to the login page.
// (A failing accounts.me itself is left alone - re-checking it would loop forever.)
// The same when an API says the password is temporary (reset by an admin meanwhile): RequireLogin then sends the
// user to "Change password".
function onUnauthorized(error: unknown, query?: Query<unknown, unknown, unknown, readonly unknown[]>) {
  const passwordChangeRequired =
    error instanceof ORPCError && (error.data as { passwordChangeRequired?: boolean } | undefined)?.passwordChangeRequired === true
  if (!isUnauthorized(error) && !passwordChangeRequired) return
  if (query && matchQuery({ queryKey: orpc.accounts.me.key() }, query)) {
    // the session is gone: drop the user's data; accounts.me stays with its error, which sends RequireLogin to /login
    if (isUnauthorized(error)) queryClient.removeQueries({ predicate: (q) => !matchQuery({ queryKey: orpc.accounts.me.key() }, q) })
    return
  }
  void queryClient.invalidateQueries({ queryKey: orpc.accounts.me.key() })
}

export const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({ onError: (error, query) => onUnauthorized(error, query) }),
  mutationCache: new MutationCache({ onError: (error) => onUnauthorized(error) }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Retry network/server failures once, but never retry 4xx errors (they won't fix themselves).
      retry: (failureCount, error) => {
        if (error instanceof ORPCError && error.status < 500) return false
        return failureCount < 1
      },
    },
  },
})
