import { TeamRequests } from './components/TeamRequests'
import { ExportButton } from '@/components/ExportButton'
import { useQuery } from '@tanstack/react-query'
import { CircleCheck, CircleX, X } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { FormError } from '@/components/FormError'
import { PillTabsList, PillTabsTrigger } from '@/components/PillTabs'
import { RequestsSkeleton } from '@/components/skeletons/approvals/RequestsSkeleton'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { useAccess } from '@/hooks/useAccess'
import { client, orpc } from '@/lib/orpc'
import { cn } from '@/lib/utils'
import { ApprovalDrawer } from './components/ApprovalDrawer'
import { type ApprovalRow, type ListMode, REQUEST_KINDS } from './components/request-kinds'
import { type Decided, RequestList } from './components/RequestList'

// Approvals (/approvals - the user, 2026-11-20; redesigned 2026-11-22): everything waiting for the logged-in employee's
// decision, of every kind (job changes, salary revisions, shift changes, leave and its cancelling, regularization and on
// duty, comp off), what they approved or rejected before (Decided by me), the requests they raised, and - for those who can repair approval routing (Approval chains: Edit) -
// the requests held because nobody can decide them. Each list has a tab per kind (?kind=LEAVE), with its count.

export function ApprovalsPage() {
  const { can } = useAccess()
  const [params, setParams] = useSearchParams()
  const [open, setOpen] = useState<number | null>(null)
  const [decided, setDecided] = useState<Decided | null>(null)
  const canRepair = can('APPROVAL_CHAINS', 'WRITE')
  const toDecide = useQuery(orpc.approvals.listToDecide.queryOptions())
  const decidedList = useQuery(orpc.approvals.listDecided.queryOptions())
  const mine = useQuery(orpc.approvals.listMine.queryOptions())
  const held = useQuery({ ...orpc.approvals.listHeld.queryOptions(), enabled: canRepair })
  const tabs: [string, string, number | undefined][] = [
    ['waiting', 'Waiting for me', toDecide.data?.length],
    ['decided', 'Decided by me', undefined],
    ['mine', 'Raised by me', undefined],
    ['team', 'Team requests', undefined],
    ...(canRepair ? ([['held', 'Held', held.data?.length]] as [string, string, number | undefined][]) : []),
  ]
  const asked = params.get('tab')
  const tab = tabs.some(([value]) => value === asked) ? asked! : 'waiting'
  const kind = params.get('kind')
  const go = (next: { tab?: string; kind?: string | null }) => {
    const t = next.tab ?? tab
    const k = next.kind === undefined ? kind : next.kind
    const nextParams = new URLSearchParams(params)
    if (t !== 'waiting') nextParams.set('tab', t); else nextParams.delete('tab')
    if (k) nextParams.set('kind', k); else nextParams.delete('kind')
    setParams(nextParams, { replace: true })
  }
  const late = toDecide.data?.filter((r) => r.step?.late).length ?? 0

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-light tracking-tight sm:text-3xl">Approvals</h1>
          {tab !== 'team' && <p className="mt-1 max-w-2xl text-sm text-muted-foreground max-sm:hidden">
            Each request goes through its approval chain one step at a time, and applies on its day once the last step approves it.
          </p>}
        </div>
        {tab !== 'team' && <ExportButton load={() => client.approvals.export({ mode: tab as 'waiting' | 'decided' | 'mine' | 'held', feature: REQUEST_KINDS.some((k) => k.feature === kind) ? kind! : undefined })} />}
        {tab !== 'team' && late > 0 && (
          <p className="rounded-full bg-destructive/10 px-3 py-1.5 text-sm font-medium text-negative-ink">
            {late} {late === 1 ? 'request is' : 'requests are'} past the time limit
          </p>
        )}
      </div>
      <Tabs value={tab} onValueChange={(value) => go({ tab: String(value) })}>
        <PillTabsList>
          {tabs.map(([value, label, count]) => (
            <PillTabsTrigger key={value} value={value}>
              {label} {count !== undefined && count > 0 && <span className="text-xs opacity-70">{count}</span>}
            </PillTabsTrigger>
          ))}
        </PillTabsList>
        {decided && (
          <div
            role="status"
            className={cn(
              'mt-4 flex items-center gap-2 rounded-2xl px-4 py-2 text-sm',
              decided.approved ? 'bg-positive/12 text-positive-ink' : 'bg-destructive/10 text-negative-ink',
            )}
          >
            {decided.approved ? <CircleCheck className="size-4 shrink-0" /> : <CircleX className="size-4 shrink-0" />}
            <span className="min-w-0 flex-1">
              {decided.approved ? 'Approved' : 'Rejected'}: {decided.name} · {decided.label}
            </span>
            <Button variant="ghost" size="icon-xs" aria-label="Dismiss" onClick={() => setDecided(null)}>
              <X />
            </Button>
          </div>
        )}
        <TabsContent value="waiting" className="mt-4">
          <FormError error={toDecide.error} />
          <Requests
            rows={toDecide.data}
            loading={toDecide.isPending}
            mode="decide"
            kind={kind}
            onKind={(k) => go({ kind: k })}
            empty="Nothing waits for your decision."
            onOpen={setOpen}
            onDecided={setDecided}
          />
        </TabsContent>
        <TabsContent value="decided" className="mt-4">
          <FormError error={decidedList.error} />
          <Requests
            rows={decidedList.data}
            loading={decidedList.isPending}
            mode="decided"
            kind={kind}
            onKind={(k) => go({ kind: k })}
            empty="You have not approved or rejected a request yet."
            onOpen={setOpen}
          />
        </TabsContent>
        <TabsContent value="mine" className="mt-4">
          <FormError error={mine.error} />
          <Requests rows={mine.data} loading={mine.isPending} mode="mine" kind={kind} onKind={(k) => go({ kind: k })} empty="You have not raised a request." onOpen={setOpen} />
        </TabsContent>
        <TabsContent value="team" className="mt-4"><TeamRequests /></TabsContent>
        {canRepair && (
          <TabsContent value="held" className="mt-4">
            <FormError error={held.error} />
            <Requests
              rows={held.data}
              loading={held.isPending}
              mode="held"
              kind={kind}
              onKind={(k) => go({ kind: k })}
              empty="No request is held - every one has someone to decide it."
              onOpen={setOpen}
            />
          </TabsContent>
        )}
      </Tabs>
      {open !== null && <ApprovalDrawer id={open} onClose={() => setOpen(null)} />}
    </div>
  )
}

function Requests({
  rows,
  loading,
  mode,
  kind,
  onKind,
  empty,
  onOpen,
  onDecided,
}: {
  rows: ApprovalRow[] | undefined
  loading: boolean
  mode: ListMode
  kind: string | null
  onKind: (kind: string | null) => void
  empty: string
  onOpen: (id: number) => void
  onDecided?: (d: Decided) => void
}) {
  const counts = new Map<string, number>()
  for (const r of rows ?? []) counts.set(r.feature, (counts.get(r.feature) ?? 0) + 1)
  const chosen = kind && REQUEST_KINDS.some((k) => k.feature === kind) ? kind : null
  const shown = chosen ? (rows ?? []).filter((r) => r.feature === chosen) : rows
  return (
    <div className="space-y-3">
      <KindTabs counts={counts} total={rows?.length} chosen={chosen} onKind={onKind} />
      {loading ? (
        <RequestsSkeleton mode={mode} label="Loading requests" />
      ) : !shown?.length ? (
        <EmptyState title={chosen ? `No ${REQUEST_KINDS.find((k) => k.feature === chosen)!.tab.toLowerCase()} requests here.` : empty} />
      ) : (
        <RequestList rows={shown} mode={mode} onOpen={onOpen} onDecided={onDecided} />
      )}
    </div>
  )
}

// A tab per kind of request, each with how many there are (stays usable while the list loads)
function KindTabs({ counts, total, chosen, onKind }: { counts: Map<string, number>; total?: number; chosen: string | null; onKind: (kind: string | null) => void }) {
  const chip = (active: boolean) =>
    cn(
      'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm transition-colors',
      active ? 'bg-hero text-hero-foreground' : 'bg-card text-muted-foreground shadow-card hover:text-foreground',
    )
  const count = (n: number | undefined) => (n ? <span className="text-xs tabular-nums opacity-70">{n}</span> : null)
  return (
    <div role="tablist" aria-label="Kind of request" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5 [scrollbar-width:none]">
      <button type="button" role="tab" aria-selected={!chosen} className={chip(!chosen)} onClick={() => onKind(null)}>
        All {count(total)}
      </button>
      {REQUEST_KINDS.map(({ feature, tab, icon: Icon }) => (
        <button key={feature} type="button" role="tab" aria-selected={chosen === feature} className={chip(chosen === feature)} onClick={() => onKind(feature)}>
          <Icon aria-hidden className="size-3.5" /> {tab} {count(counts.get(feature))}
        </button>
      ))}
    </div>
  )
}
