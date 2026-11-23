import { useQuery } from '@tanstack/react-query'
import { orpc } from '@/lib/orpc'

// The logged-in employee ({ employeeCode, name, roles, isSuperAdmin, access }).
// Fails with UNAUTHORIZED when nobody is logged in. To decide what to show, use useAccess() - it reads `access`
// (the level per area), never role names.
export function useCurrentUser() {
  return useQuery({ ...orpc.accounts.me.queryOptions(), staleTime: 5 * 60_000 })
}
