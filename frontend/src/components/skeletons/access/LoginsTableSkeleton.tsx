import { Ellipsis, UserCog } from 'lucide-react'
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
      <ul className="divide-y divide-border sm:hidden">{Array.from({ length: rows }, (_, r) => <li key={r} className="space-y-3 py-4 first:pt-1"><div className="flex items-start justify-between gap-3"><div className="space-y-1.5"><Skeleton className="h-4 w-32 rounded-full" /><Skeleton className="h-3 w-20 rounded-full" /></div><Skeleton className="h-6 w-16 rounded-full" /></div><Skeleton className="h-5 w-28 rounded-full" /><Skeleton className="h-3 w-44 max-w-full rounded-full" /><div className="flex flex-wrap items-center justify-between gap-2"><span className="flex items-center gap-1 text-xs text-muted-foreground">Last login:<Skeleton className="h-3 w-20 rounded-full" /></span>{canChange && <div className="flex gap-1"><Button variant="ghost" size="icon" disabled aria-label="Account actions"><Ellipsis /></Button><Button variant="secondary" size="sm" disabled><UserCog />Change roles</Button></div>}</div></li>)}</ul>
      <div className="max-sm:hidden"><Table>
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
                    <Button variant="ghost" size="icon" disabled aria-label="Account actions"><Ellipsis /></Button>
                    <Button variant="secondary" size="sm" disabled>
                      <UserCog /> Change roles
                    </Button>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table></div>
    </div>
  )
}
