import { KeyRound, LogOut, PowerOff, UserCog } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

const NAME = ['w-28', 'w-32', 'w-36', 'w-24']
const ROLE = ['w-44', 'w-36', 'w-52', 'w-28']

// Loading placeholder for the employees with a login (Roles & access, People tab), drawn like the real table: its real
// headings (Employee, Status, Roles, Last login) and per row the name and code, a status pill, a role pill, the last
// login and - with `canChange` - the row's buttons in real text, disabled until the rows arrive.
export function LoginsTableSkeleton({ rows = 7, canChange = false, label = 'Loading' }: { rows?: number; canChange?: boolean; label?: string }) {
  return (
    <div role="status" aria-label={label}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Roles</TableHead>
            <TableHead>Last login</TableHead>
            <TableHead className="text-right" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }, (_, r) => (
            <TableRow key={r}>
              <TableCell className="py-1.5">
                <div className="flex h-5 items-center">
                  <Skeleton className={cn('h-3.5 max-w-full rounded-full max-sm:w-20', NAME[r % NAME.length])} />
                </div>
                {/* a phone: the name runs onto a second line */}
                <div className="flex h-5 items-center sm:hidden">
                  <Skeleton className="h-3.5 w-14 rounded-full" />
                </div>
                <div className="flex h-4 items-center">
                  <Skeleton className="h-3 w-20 rounded-full" />
                </div>
              </TableCell>
              <TableCell>
                <Skeleton className="h-6 w-16 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className={cn('h-6 rounded-full', ROLE[r % ROLE.length])} />
              </TableCell>
              <TableCell>
                <Skeleton className="h-3 w-28 rounded-full" />
              </TableCell>
              <TableCell className="text-right whitespace-nowrap">
                {canChange && (
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" disabled>
                      <KeyRound /> Reset password
                    </Button>
                    <Button variant="ghost" size="sm" disabled>
                      <PowerOff /> Turn off
                    </Button>
                    <Button variant="ghost" size="sm" disabled>
                      <LogOut /> Log out everywhere
                    </Button>
                    <Button variant="secondary" size="sm" disabled>
                      <UserCog /> Change roles
                    </Button>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
