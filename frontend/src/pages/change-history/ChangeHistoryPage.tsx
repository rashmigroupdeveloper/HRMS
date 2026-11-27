import { ExportButton } from '@/components/ExportButton'
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, ShieldCheck, SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { ChangeHistoryList } from '@/components/ChangeHistoryList'
import { EmployeePicker } from '@/components/EmployeePicker'
import { SearchableSelect } from '@/components/SearchableSelect'
import { ChangeHistorySkeleton } from '@/components/skeletons/common/ChangeHistorySkeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useAccess } from '@/hooks/useAccess'
import { HISTORY_ACTION_OPTIONS as ACTION_OPTIONS, type HistoryAction } from '@/lib/choices'
import { client, orpc } from '@/lib/orpc'
import { cn, errorMessage, formatDateTime, fromDateInput } from '@/lib/utils'

const PAGE_SIZE = 50

// The change history (Change history: View): who changed what and when - every record of the app, and sign-ins -
// newest first, with filters kept in the page address. "Check integrity" verifies the hash chain: that no row was
// changed or removed directly in the database.
export function ChangeHistoryPage() {
  const { can } = useAccess()
  const [params, setParams] = useSearchParams()
  const get = (key: string) => params.get(key) ?? ''
  const page = Math.max(1, Number(params.get('page')) || 1)
  function update(changes: Record<string, string | null>) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        for (const [key, value] of Object.entries({ page: null, ...changes })) {
          if (value) next.set(key, value)
          else next.delete(key)
        }
        return next
      },
      { replace: true },
    )
  }
  // the pickers are reset by "Clear" (they keep their own typed text)
  const [resets, setResets] = useState(0)

  // the filters - also what the Excel download takes
  const filters = {
    from: fromDateInput(get('from')),
    to: fromDateInput(get('to')),
    actorCode: get('by') || undefined,
    employeeCode: get('employee') || undefined,
    model: get('type') || undefined,
    action: (get('action') || undefined) as HistoryAction | undefined,
  }
  const history = useQuery({
    ...orpc.changeHistory.list.queryOptions({ input: { ...filters, page, pageSize: PAGE_SIZE } }),
    placeholderData: keepPreviousData,
  })
  const verify = useMutation(orpc.changeHistory.verify.mutationOptions())
  const total = history.data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const filtered = ['from', 'to', 'by', 'employee', 'type', 'action'].some((k) => params.get(k))
  // a phone shows the two dates; the other four filters open with "Filters" (open already when one of them is set)
  const moreSet = ['by', 'employee', 'type', 'action'].filter((k) => params.get(k)).length
  const [moreOpen, setMoreOpen] = useState(moreSet > 0)
  const more = cn('col-span-2 space-y-1 sm:col-span-1', !moreOpen && 'max-sm:hidden')
  // the same box for all six filters
  const box = 'h-9 w-full rounded-xl bg-card'
  // "Newer / Page 1 of 7 / Older" - above the list and below it
  const pager = pages > 1 && (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Button variant="secondary" size="sm" className="max-sm:h-9" disabled={page <= 1 || history.isFetching} onClick={() => update({ page: page - 1 > 1 ? String(page - 1) : null })}>
        <ChevronLeft /> Newer
      </Button>
      <span className="text-xs whitespace-nowrap tabular-nums">
        Page {page} of {pages}
      </span>
      <Button variant="secondary" size="sm" className="max-sm:h-9" disabled={page >= pages || history.isFetching} onClick={() => update({ page: String(page + 1) })}>
        Older <ChevronRight />
      </Button>
    </div>
  )

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-light tracking-tight sm:text-4xl">Change history</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Who changed what, and whether the record still holds.
          </p>
        </div>
        <ExportButton load={() => client.changeHistory.export(filters)} disabled={!total} title="All matching audit entries; narrow the filters if the report is too large" />
      </header>

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-hero px-5 py-4 text-hero-foreground shadow-card sm:px-6">
        <div className="flex min-w-0 items-center gap-4">
          <Seal ok={verify.data?.ok} pending={verify.isPending} broken={Boolean(verify.data && !verify.data.ok)} />
          <div className="min-w-0">
            <p className="text-lg font-light tracking-tight">
              {verify.isPending ? 'Checking the chain…' : verify.data?.ok ? 'The record is intact' : verify.data ? 'The record was altered' : 'A sealed register'}
            </p>
            <p className="mt-0.5 text-sm text-hero-foreground/75">
              {verify.data?.ok
                ? `All ${verify.data.checked.toLocaleString('en-IN')} entries match the chain.`
                : verify.data
                  ? `Altered at entry #${verify.data.brokenAt?.id} (${formatDateTime(verify.data.brokenAt?.at)}). ${verify.data.checked.toLocaleString('en-IN')} entries before it are intact.`
                  : 'Every change and every sign-in is kept. Nothing on this page can be edited.'}
            </p>
            {verify.error && <p className="mt-1 text-xs text-hero-foreground">{errorMessage(verify.error)}</p>}
          </div>
        </div>
        <Button
          variant="gold"
          size="lg"
          className="transition-transform duration-100 active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100"
          disabled={verify.isPending}
          onClick={() => verify.mutate({})}
        >
          <ShieldCheck /> {verify.isPending ? 'Checking…' : 'Check integrity'}
        </Button>
      </section>

      <section className="space-y-3 rounded-3xl bg-card p-4 shadow-card sm:p-5">
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 lg:grid-cols-[9.5rem_9.5rem_minmax(0,3fr)_minmax(0,3fr)_minmax(0,2fr)_minmax(0,2fr)]">
          <div className="space-y-1">
            <Label htmlFor="h-from" className="text-xs text-muted-foreground">
              From
            </Label>
            <Input id="h-from" type="date" className={box} value={get('from')} onChange={(e) => update({ from: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="h-to" className="text-xs text-muted-foreground">
              To
            </Label>
            <Input id="h-to" type="date" className={box} value={get('to')} onChange={(e) => update({ to: e.target.value })} />
          </div>
          <Button variant="secondary" size="sm" className="col-span-2 h-9 justify-self-start sm:hidden" aria-expanded={moreOpen} onClick={() => setMoreOpen((o) => !o)}>
            <SlidersHorizontal /> {moreOpen ? 'Fewer filters' : 'Filters'}
            {moreSet > 0 && <span className="tabular-nums">· {moreSet}</span>}
          </Button>
          <div className={more}>
            <Label htmlFor="h-by" className="text-xs text-muted-foreground">
              Changed by
            </Label>
            <EmployeePicker key={`by-${resets}`} id="h-by" className={box} value={get('by')} placeholder="Anyone" onChange={(p) => update({ by: p?.employeeCode ?? null })} />
          </div>
          <div className={more}>
            <Label htmlFor="h-employee" className="text-xs text-muted-foreground">
              Whose record
            </Label>
            <EmployeePicker key={`emp-${resets}`} id="h-employee" className={box} value={get('employee')} placeholder="Any employee" onChange={(p) => update({ employee: p?.employeeCode ?? null })} />
          </div>
          <div className={more}>
            <Label htmlFor="h-type" className="text-xs text-muted-foreground">
              Record type
            </Label>
            <SearchableSelect
              key={`type-${resets}`}
              id="h-type"
              value={get('type')}
              placeholder="Any"
              options={history.data?.models ?? []}
              onChange={(value) => update({ type: value })}
              className={box}
            />
          </div>
          <div className={more}>
            <Label htmlFor="h-action" className="text-xs text-muted-foreground">
              Action
            </Label>
            <SearchableSelect
              key={`action-${resets}`}
              id="h-action"
              value={get('action')}
              placeholder="Any"
              options={ACTION_OPTIONS}
              onChange={(value) => update({ action: value })}
              className={box}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
          {history.isPending ? (
            <Skeleton className="h-3.5 w-20 rounded-full" />
          ) : (
            <span className="tabular-nums">{history.data ? `${total.toLocaleString('en-IN')} ${total === 1 ? 'entry' : 'entries'}` : ''}</span>
          )}
          {filtered && (
            <button
              type="button"
              className="text-xs font-medium underline-offset-4 hover:text-foreground hover:underline max-sm:min-h-9"
              onClick={() => {
                setParams(new URLSearchParams(), { replace: true })
                setResets((n) => n + 1)
                setMoreOpen(false)
              }}
            >
              Clear filters
            </button>
          )}
          <div className="ml-auto">
            {history.isPending ? (
              // the pager's place while the count loads (most filters give more than one page)
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" className="max-sm:h-9" disabled>
                  <ChevronLeft /> Newer
                </Button>
                <Skeleton className="h-3 w-20 rounded-full" />
                <Button variant="secondary" size="sm" className="max-sm:h-9" disabled>
                  Older <ChevronRight />
                </Button>
              </div>
            ) : (
              pager
            )}
          </div>
        </div>

        {history.isPending ? (
          <ChangeHistorySkeleton variant="ledger" label="Loading the change history" />
        ) : history.error ? (
          <p className="py-10 text-center text-sm text-negative-ink">{errorMessage(history.error)}</p>
        ) : (
          <div className={cn('transition-opacity duration-200', history.isFetching && 'opacity-60')}>
            <ChangeHistoryList variant="ledger" items={history.data.items} linkEmployees={can('EMPLOYEES')} />
          </div>
        )}

        {pager && <div className="flex justify-end pt-3">{pager}</div>}
      </section>
    </div>
  )
}

// The chain's seal. It draws once when a check comes back intact; a broken chain stays open.
function Seal({ ok, pending, broken }: { ok?: boolean; pending: boolean; broken: boolean }) {
  return (
    <svg viewBox="0 0 44 44" className="size-11 shrink-0" aria-hidden>
      <circle cx="22" cy="22" r="20" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1.5" />
      {(ok || broken) && (
        <circle
          key={ok ? 'ok' : 'broken'}
          className="history-seal-ring"
          cx="22"
          cy="22"
          r="20"
          fill="none"
          stroke={broken ? 'var(--destructive)' : 'var(--gold)'}
          strokeWidth="1.5"
          strokeLinecap="round"
          transform="rotate(-90 22 22)"
        />
      )}
      {pending && <circle cx="22" cy="22" r="3" className="fill-gold motion-reduce:animate-none animate-pulse" />}
    </svg>
  )
}
