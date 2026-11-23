import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { FormError } from '@/components/FormError'
import { JobChangeDrawer } from '@/components/JobChangeDrawer'
import { ChangeListSkeleton } from '@/components/skeletons/pay-career/ChangeListSkeleton'
import { Button } from '@/components/ui/button'
import { useAccess } from '@/hooks/useAccess'
import { orpc } from '@/lib/orpc'
import { cn } from '@/lib/utils'
import { ChangeList, Pager } from './ChangeList'
import { RequestChangeStart } from './RequestChangeStart'

// "Raise a change" on Pay & career (/pay-career?view=raise - the user, 2026-11-21): for those with "Request job
// changes" or "Request salary changes" - ask for a change for an employee they look after (never for themselves), and follow
// the changes they asked for: pending (waiting for approval), approved (waiting for its day, or in force), rejected, cancelled.
const GROUPS = {
  pending: { label: 'Pending', statuses: ['PENDING'] },
  approved: { label: 'Approved', statuses: ['APPROVED', 'APPLIED'] },
  rejected: { label: 'Rejected', statuses: ['REJECTED'] },
  cancelled: { label: 'Cancelled', statuses: ['CANCELLED'] },
} as const
type Group = keyof typeof GROUPS
const PAGE_SIZE = 50

export function RaiseChangeView() {
  const [params, setParams] = useSearchParams()
  const group: Group = (params.get('group') as Group | null) ?? 'pending'
  const page = Number(params.get('page')) || 1
  const [open, setOpen] = useState<number | null>(null)
  const [requesting, setRequesting] = useState(false)
  const { can } = useAccess()
  const canList = can('EMPLOYEES')
  const list = useQuery(
    orpc.jobChanges.list.queryOptions({ input: { mine: 'ASKED_BY_ME', statuses: [...(GROUPS[group] ?? GROUPS.pending).statuses], page, pageSize: PAGE_SIZE } }),
  )
  const set = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries({ page: null, ...changes })) {
      if (value === null) next.delete(key)
      else next.set(key, value)
    }
    setParams(next, { replace: true })
  }
  const total = list.data?.total ?? 0

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex max-w-full gap-0.5 overflow-x-auto rounded-full bg-card p-1 shadow-card [scrollbar-width:none]">
          {(Object.keys(GROUPS) as Group[]).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={group === value}
              onClick={() => set({ group: value === 'pending' ? null : value })}
              className={cn(
                'shrink-0 rounded-full px-3 py-1 text-sm font-medium whitespace-nowrap',
                group === value ? 'bg-hero text-hero-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {GROUPS[value].label}
            </button>
          ))}
        </div>
        {list.data && (
          <span className="text-sm text-muted-foreground tabular-nums">
            {total} {total === 1 ? 'request' : 'requests'}
          </span>
        )}
        <Button variant="gold" className="ml-auto" onClick={() => setRequesting(true)}>
          <Plus /> Request a change
        </Button>
      </div>

      <FormError error={list.error} />
      {list.isPending ? (
        <ChangeListSkeleton label="Loading your requests" />
      ) : !list.data?.items.length ? (
        <EmptyState
          title={`No ${GROUPS[group].label.toLowerCase()} requests`}
          hint='A promotion, transfer, salary revision... you ask for an employee shows here - it goes through the approval chain and applies on its day.'
        />
      ) : (
        <ChangeList items={list.data.items} onOpen={setOpen} linkEmployee={canList} />
      )}
      <Pager page={page} pages={Math.max(1, Math.ceil(total / PAGE_SIZE))} onPage={(p) => set({ page: String(p) })} />
      {open !== null && <JobChangeDrawer id={open} onClose={() => setOpen(null)} />}
      {requesting && <RequestChangeStart onClose={() => setRequesting(false)} />}
    </div>
  )
}
