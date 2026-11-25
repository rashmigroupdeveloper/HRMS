import { useState } from 'react'
import { Link } from 'react-router'
import { JobChangeKindTile, JobChangeStatusPill } from '@/components/JobChangeDetails'
import { Pill } from '@/components/Pill'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { client } from '@/lib/orpc'
import { cn, formatDate, initialsOf, relativeDay } from '@/lib/utils'

export type ChangeItem = Awaited<ReturnType<typeof client.jobChanges.list>>['items'][number]

// A list of job changes (Pay & career, 2026-11-21 - shared by "Change register" and "Raise a change"): a table on a wide
// screen, one card per change on a phone; a click opens the change. The employee links to their profile when `linkEmployee`.
export function ChangeList({ items, onOpen, linkEmployee = true }: { items: ChangeItem[]; onOpen: (id: number) => void; linkEmployee?: boolean }) {
  // today, read once - for "in 9 days" / "3 days ago"
  const [now] = useState(() => Date.now())
  return (
    <>
      {/* a wide screen: the table */}
      <div className="hidden overflow-hidden rounded-2xl bg-card shadow-card sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Change</TableHead>
              <TableHead className="w-32">From</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-36">Asked</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((c) => (
              <TableRow key={c.id} className="cursor-pointer" onClick={() => onOpen(c.id)}>
                <TableCell>
                  <span className="flex items-center gap-2.5">
                    <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-semibold text-muted-foreground">
                      {initialsOf(c.employee.name)}
                    </span>
                    <span className="min-w-0">
                      {linkEmployee ? (
                        <Link
                          to={`/manage/employees/${c.employee.employeeCode}?tab=job`}
                          onClick={(e) => e.stopPropagation()}
                          className="block font-medium underline-offset-4 hover:underline"
                        >
                          {c.employee.name}
                        </Link>
                      ) : (
                        <span className="block font-medium">{c.employee.name}</span>
                      )}
                      <span className="text-xs text-muted-foreground tabular-nums">{c.employee.employeeCode}</span>
                    </span>
                  </span>
                </TableCell>
                <TableCell className="max-w-sm">
                  <span className="flex items-center gap-2.5">
                    <JobChangeKindTile kind={c.kind} />
                    <span className="min-w-0">
                      <span className="block font-medium">{c.kindLabel}</span>
                      <span className="block truncate text-xs text-muted-foreground"><WhatChanges c={c} /></span>
                    </span>
                  </span>
                </TableCell>
                <TableCell className="text-sm tabular-nums">
                  {formatDate(c.effectiveFrom)}
                  <span className="block text-xs text-muted-foreground">{relativeDay(new Date(c.effectiveFrom).getTime(), now)}</span>
                </TableCell>
                <TableCell className="text-sm">
                  <Standing c={c} />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground tabular-nums">
                  {formatDate(c.raisedAt)}
                  {c.requestedBy && <span className="block text-xs">by {c.requestedBy.name}</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {/* a phone: one card per change, nothing hidden off the side */}
      <ul className="divide-y divide-border/70 overflow-hidden rounded-2xl bg-card shadow-card sm:hidden">
        {items.map((c) => (
          <li key={c.id}>
            <button type="button" onClick={() => onOpen(c.id)} className="flex w-full items-start gap-3 px-3 py-3 text-left">
              <JobChangeKindTile kind={c.kind} />
              <span className="min-w-0 flex-1 space-y-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-medium">{c.employee.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{c.employee.employeeCode}</span>
                </span>
                <span className="block text-sm">
                  {c.kindLabel} <span className="text-muted-foreground">· from {formatDate(c.effectiveFrom)}</span>
                </span>
                <span className="block truncate text-xs text-muted-foreground"><WhatChanges c={c} /></span>
                <Standing c={c} />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}

// Previous / next under a list
export function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (page: number) => void }) {
  if (pages <= 1) return null
  return (
    <div className="flex items-center justify-end gap-2 text-sm">
      <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </Button>
      <span className="text-muted-foreground tabular-nums">
        {page} / {pages}
      </span>
      <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Next
      </Button>
    </div>
  )
}

// what a change touches: "Designation, Grade, Salary"
export function WhatChanges({ c }: { c: ChangeItem }) {
  return <>{[...c.changed, ...(c.hasSalary ? ['Salary'] : [])].join(', ')}</>
}

// Where a change stands: its pill, and while it waits the approval's progress - a dot per step (done, now, to come) and who has it
export function Standing({ c }: { c: ChangeItem }) {
  const step = c.status === 'PENDING' ? c.approval?.step : null
  return (
    <span className="block space-y-1">
      <span className="flex flex-wrap items-center gap-1.5">
        <JobChangeStatusPill status={c.status} label={c.statusLabel} />
        {c.status === 'PENDING' && c.approval?.held && <Pill tone="warning">Held</Pill>}
        {step?.late && <Pill tone="negative">Late</Pill>}
        {c.applyError && <Pill tone="warning">Not applied</Pill>}
      </span>
      {step && (
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <span aria-hidden className="flex gap-1">
            {Array.from({ length: step.of }, (_, i) => (
              <span
                key={i}
                className={cn('size-1.5 rounded-full', i + 1 < step.stepNo ? 'bg-foreground/50' : i + 1 === step.stepNo ? 'bg-gold ring-2 ring-gold/30' : 'bg-border')}
              />
            ))}
          </span>
          Step {step.stepNo} of {step.of} · with {step.approver?.name ?? step.who}
        </span>
      )}
    </span>
  )
}
