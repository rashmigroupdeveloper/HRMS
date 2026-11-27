import { ExportButton } from '@/components/ExportButton'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { FormError } from '@/components/FormError'
import { JobChangeDrawer } from '@/components/JobChangeDrawer'
import { ChangeListSkeleton } from '@/components/skeletons/pay-career/ChangeListSkeleton'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { JOB_CHANGE_KIND } from '@/lib/choices'
import { client, orpc } from '@/lib/orpc'
import { cn } from '@/lib/utils'
import { Pager } from '@/components/Pager'
import { ChangeList } from './ChangeList'

// "Change register" on Pay & career (/pay-career?view=register; the Job changes page of 2026-11-20, a sidebar item since
// 2026-11-21 - Employees: View): every promotion, transfer, salary revision... asked for the employees inside the viewer's
// data access, with where each stands - waiting for approval (and for whom), approved for a later day, in force, rejected or
// cancelled. Filter by status and kind; Excel export of the same list. Asking for a change is on "Raise a change".

type Status = 'PENDING' | 'APPROVED' | 'APPLIED' | 'REJECTED' | 'CANCELLED'
type Kind = keyof typeof JOB_CHANGE_KIND
const STATUSES: [Status | 'ALL', string][] = [
  ['ALL', 'All'],
  ['PENDING', 'Waiting for approval'],
  ['APPROVED', 'Approved'],
  ['APPLIED', 'In force'],
  ['REJECTED', 'Rejected'],
  ['CANCELLED', 'Cancelled'],
]
const PAGE_SIZE = 50

export function ChangeRegisterView() {
  const [params, setParams] = useSearchParams()
  const status = (params.get('status') ?? 'ALL') as Status | 'ALL'
  const kind = (params.get('kind') ?? '') as Kind | ''
  const page = Number(params.get('page')) || 1
  const [open, setOpen] = useState<number | null>(null)
  const filters = { ...(status !== 'ALL' && { statuses: [status] }), ...(kind && { kinds: [kind] }) }
  const list = useQuery(orpc.jobChanges.list.queryOptions({ input: { ...filters, page, pageSize: PAGE_SIZE } }))
  const set = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries({ page: null, ...changes })) {
      if (value === null || value === '' || value === 'ALL') next.delete(key)
      else next.set(key, value)
    }
    setParams(next, { replace: true })
  }
  const total = list.data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex max-w-full gap-0.5 overflow-x-auto rounded-full bg-card p-1 shadow-card [scrollbar-width:none]">
          {STATUSES.map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={status === value}
              onClick={() => set({ status: value })}
              className={cn(
                'shrink-0 rounded-full px-3 py-1 text-sm font-medium whitespace-nowrap',
                status === value ? 'bg-hero text-hero-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <label htmlFor="kind-filter" className="sr-only">
          Kind
        </label>
        <NativeSelect id="kind-filter" value={kind} onChange={(e) => set({ kind: e.target.value })} className="h-9 rounded-full bg-card shadow-card">
          <NativeSelectOption value="">Every kind</NativeSelectOption>
          {(Object.keys(JOB_CHANGE_KIND) as Kind[])
            .filter((k) => k !== 'JOINING')
            .map((k) => (
              <NativeSelectOption key={k} value={k}>
                {JOB_CHANGE_KIND[k]}
              </NativeSelectOption>
            ))}
        </NativeSelect>
        {list.data && (
          <span className="text-sm text-muted-foreground tabular-nums">
            {total} {total === 1 ? 'change' : 'changes'}
          </span>
        )}
        <ExportButton load={() => client.jobChanges.export(filters)} />

      </div>

      <FormError error={list.error} />
      {list.isPending ? (
        <ChangeListSkeleton label="Loading the job changes" />
      ) : !list.data?.items.length ? (
        <EmptyState title="No job changes" hint="Promotions, transfers, salary revisions... of the employees you look after show here." />
      ) : (
        <ChangeList items={list.data.items} onOpen={setOpen} />
      )}
      <Pager page={page} pages={pages} onPage={(p) => set({ page: String(p) })} />
      {open !== null && <JobChangeDrawer id={open} onClose={() => setOpen(null)} />}
    </div>
  )
}
