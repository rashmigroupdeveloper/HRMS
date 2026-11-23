import { useQuery } from '@tanstack/react-query'
import { CalendarCheck, Search } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { FormError } from '@/components/FormError'
import { DepartmentTableSkeleton } from '@/components/skeletons/my-department/DepartmentTableSkeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { orpc } from '@/lib/orpc'
import { cn, formatDate, formatLastDay, formatMoment } from '@/lib/utils'

const HEADINGS = ['Employee', 'Designation', 'Department · plant', 'Joined', 'Reports to', 'Work e-mail']

// "My department" (BACKLOG 3e, agreed 2026-11-18): the employees whose HOD the logged-in employee is - their directory &
// job details, read-only, no role needed (their attendance: the Attendance page, "My department" tab). Approvals come
// with the leave module. Names are not links: an HOD may have no access to profiles.
export function MyDepartmentPage() {
  const department = useQuery(orpc.employees.hods.myDepartment.queryOptions())
  const [search, setSearch] = useState('')
  // one post's employees (when the viewer heads several), null = all
  const [postId, setPostId] = useState<number | null>(null)
  const data = department.data
  const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const rows = (data?.employees ?? []).filter(
    (e) => (postId === null || e.postId === postId) && words.every((w) => e.employeeCode.toLowerCase().includes(w) || e.name.toLowerCase().includes(w)),
  )

  // the search - also on the skeleton while the list loads
  const searchBox = (
    <div className="relative ml-auto w-full sm:w-56">
      <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input type="search" aria-label="Search employees" placeholder="Name or code" className="h-9 rounded-full pl-8 sm:h-8" value={search} onChange={(e) => setSearch(e.target.value)} />
    </div>
  )

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Head of department</p>
          <h1 className="mt-1 text-3xl font-light tracking-tight sm:text-4xl">My department</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground max-sm:hidden">The employees whose HOD you are. View only - HR keeps their records.</p>
        </div>
        {data && data.employees.length > 0 && (
          <Button variant="secondary" nativeButton={false} render={<Link to="/team-attendance?view=department" />}>
            <CalendarCheck /> Their attendance
          </Button>
        )}
      </header>

      <FormError error={department.error} />
      {department.isPending ? (
        <DepartmentTableSkeleton headings={HEADINGS} search={searchBox} label="Loading your department" />
      ) : !data?.posts.length ? (
        <EmptyState title="You are not an HOD" hint="HR appoints HODs on the Organization page (Department heads)." />
      ) : (
        <section className="space-y-3 rounded-3xl bg-card p-4 shadow-card sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            {/* the posts the viewer holds - a filter when there are several */}
            {data.posts.map((post) => (
              <button
                key={post.id}
                type="button"
                aria-pressed={postId === post.id}
                disabled={data.posts.length === 1}
                onClick={() => setPostId(postId === post.id ? null : post.id)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-left text-xs transition-colors',
                  postId === post.id ? 'bg-hero text-hero-foreground' : 'bg-surface-2 enabled:hover:bg-surface-2/70',
                )}
              >
                <span className="font-medium">{post.label}</span>
                <span className={postId === post.id ? 'opacity-80' : 'text-muted-foreground'}>
                  {' '}
                  · {post.employees} · since {formatMoment(post.since)}
                  {post.until && ` · until ${formatLastDay(post.until)}`}
                </span>
              </button>
            ))}
            {searchBox}
          </div>
          {rows.length === 0 ? (
            <EmptyState className="py-6" title={data.employees.length ? 'Nobody matches' : 'No employees yet'} hint={data.employees.length ? undefined : 'Nobody works in the places you head yet.'} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {HEADINGS.map((label) => (
                    <TableHead key={label} className="text-xs text-muted-foreground">
                      {label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((e) => (
                  <TableRow key={e.employeeCode}>
                    <TableCell className="min-w-44 whitespace-normal">
                      <span className="font-medium">{e.name}</span> <span className="text-xs text-muted-foreground tabular-nums">{e.employeeCode}</span>
                      {e.status === 'ON_NOTICE' && <span className="ml-1.5 text-xs text-warning-ink">on notice</span>}
                    </TableCell>
                    <TableCell>{e.designation ?? '—'}</TableCell>
                    <TableCell className="whitespace-normal">
                      {e.department}
                      <span className="block text-xs text-muted-foreground">
                        {e.company} · {e.plant.plantCode} {e.plant.name}
                      </span>
                    </TableCell>
                    <TableCell className="tabular-nums">{formatDate(e.dateOfJoining)}</TableCell>
                    <TableCell>{e.reportingManager?.name ?? '—'}</TableCell>
                    <TableCell>{e.workEmail ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      )}
    </div>
  )
}
