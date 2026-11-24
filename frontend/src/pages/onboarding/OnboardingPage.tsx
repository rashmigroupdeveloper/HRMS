import { ExportButton } from '@/components/ExportButton'
import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight, CalendarClock, FileSignature, PhoneCall, Plus, Search, X } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { CandidatesTableSkeleton } from '@/components/skeletons/onboarding/CandidatesTableSkeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAccess } from '@/hooks/useAccess'
import { client, orpc } from '@/lib/orpc'
import { cn, errorMessage, formatDate, initialsOf, relativeDay } from '@/lib/utils'
import { type CandidateRow, type CandidateStatus, CLOSED_STATUSES, fullName, JOINING_TYPE, progressOf, PROGRESS_STEPS, statusLabel, STATUS_TONE } from './components/labels'
import { OfferDialog } from './components/OfferDialog'
import { EmptyState } from '@/components/EmptyState'
import { Pill } from '@/components/Pill'

// The stages of the strip on top - each one also filters the table (click again for everyone). `tone` draws its bar.
const STAGES: { key: string; label: string; statuses: CandidateStatus[]; tone: string }[] = [
  { key: 'draft', label: 'Draft', statuses: ['DRAFT'], tone: 'border border-foreground/25 text-foreground' },
  { key: 'offered', label: 'Offer sent', statuses: ['OFFERED', 'LOI_ACCEPTED'], tone: 'bg-gold text-gold-foreground' },
  { key: 'prejoining', label: 'Pre-joining', statuses: ['ACCEPTED'], tone: 'bg-hero text-hero-foreground' },
  { key: 'joined', label: 'Joined', statuses: ['JOINED'], tone: 'bg-positive text-white' },
  { key: 'closed', label: 'Did not join', statuses: CLOSED_STATUSES, tone: 'u-hatch border border-foreground/10 text-foreground' },
]

const DAY = 24 * 60 * 60 * 1000
const OPEN: CandidateStatus[] = ['DRAFT', 'OFFERED', 'LOI_ACCEPTED', 'ACCEPTED']

// Onboarding: offer -> acceptance -> pre-joining. The stage strip (filters the table), the numbers that need action,
// and the candidate table; a candidate opens on its own page (CandidatePage).
export function OnboardingPage() {
  const candidates = useQuery(orpc.candidates.list.queryOptions())
  const [filter, setFilter] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const navigate = useNavigate()
  const open = (id: number) => void navigate(`/onboarding/${id}`)
  const canChange = useAccess().can('ONBOARDING', 'WRITE')

  const rows = candidates.data ?? []
  const stage = STAGES.find((s) => s.key === filter)
  const statuses = stage?.statuses
  const inStage = statuses ? rows.filter((r) => statuses.includes(r.status)) : rows
  const words = search.trim().toLowerCase()
  const shown = words
    ? inStage.filter((r) => [fullName(r), r.mobile, r.designation.name, r.offerNumber ?? ''].join(' ').toLowerCase().includes(words))
    : inStage
  const [now] = useState(() => Date.now())
  // null while the list loads (a bar where the number goes)
  const count = (fn: (r: CandidateRow) => boolean) => (candidates.data ? rows.filter(fn).length : null)
  const stageCounts = STAGES.map((s) => count((r) => s.statuses.includes(r.status)))
  const total = rows.length

  const prejoining = (r: CandidateRow) => r.status === 'ACCEPTED'
  const actions = [
    { label: 'Joining in 7 days', icon: CalendarClock, value: count((r) => prejoining(r) && r.proposedJoiningDate.getTime() - now <= 7 * DAY) },
    { label: 'Joining forms pending', icon: FileSignature, value: count((r) => prejoining(r) && !r.joiningFormSubmittedAt) },
    { label: 'Joining not confirmed', icon: PhoneCall, value: count((r) => prejoining(r) && !r.joiningConfirmedAt) },
  ]

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Lifecycle</p>
          <h1 className="mt-1 text-3xl font-light tracking-tight sm:text-4xl">Onboarding</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground max-sm:hidden">
            From the offer to the joining day: send offers, record answers, collect the joining form and documents, run background checks and
            the medical.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* The report follows the selected stage. */}
          <ExportButton
            load={() => client.candidates.export({ statuses: statuses ?? undefined })}
            disabled={!inStage.length || candidates.isFetching}
            title="Export the candidates of the selected stage"
          />
          {canChange ? (
            <Button variant="gold" onClick={() => setCreating(true)}>
              <Plus /> New offer
            </Button>
          ) : (
            <span className="rounded-full bg-card px-4 py-2 text-sm text-muted-foreground shadow-card">View only</span>
          )}
        </div>
      </header>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:gap-10">
        {/* the stages: each bar as wide as its share of the candidates (an empty one keeps a small bar); a click filters */}
        <div role="group" aria-label="Candidates by stage" className="flex min-w-0 flex-1 gap-1.5">
          {STAGES.map((s, index) => {
            const n = stageCounts[index]
            const selected = filter === s.key
            return (
              <button
                key={s.key}
                type="button"
                aria-pressed={selected}
                title={selected ? 'Show every stage' : `Show only: ${s.label}`}
                onClick={() => setFilter(selected ? null : s.key)}
                className="group min-w-0 basis-0 text-left"
                style={{ flexGrow: (n ?? 0) + (total ? total * 0.12 : 1) }}
              >
                <span className={cn('block truncate px-1 pb-1.5 text-xs', selected ? 'font-medium text-foreground' : 'text-muted-foreground group-hover:text-foreground')}>
                  {s.label}
                </span>
                <span
                  className={cn(
                    'flex h-10 items-center rounded-full px-3 text-sm font-medium tabular-nums transition sm:px-4',
                    s.tone,
                    filter && !selected && 'opacity-40 group-hover:opacity-70',
                    selected && 'ring-2 ring-foreground ring-offset-2 ring-offset-background',
                  )}
                >
                  {n === null ? <Skeleton className="h-3.5 w-5 rounded-full bg-current/15" /> : n}
                </span>
              </button>
            )
          })}
        </div>

        {/* what needs action: big light numbers */}
        <dl className="grid shrink-0 grid-cols-3 gap-4 sm:gap-8">
          {actions.map(({ label, icon: Icon, value }) => (
            <div key={label} className="flex flex-col-reverse">
              <dt className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Icon className="size-3.5 shrink-0" />
                {label}
              </dt>
              <dd className="flex h-12 items-end text-5xl leading-none font-light tracking-tight tabular-nums">
                {value === null ? <Skeleton className="mb-1 h-9 w-10 rounded-lg" /> : value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <section className="space-y-3 rounded-3xl bg-card p-4 shadow-card sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <h2 className="text-lg font-light tracking-tight">Candidates</h2>
            {candidates.data && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">{shown.length}</span>}
            {stage && (
              <button
                type="button"
                onClick={() => setFilter(null)}
                className="flex items-center gap-1 rounded-full bg-hero py-1 pr-2 pl-3 text-xs font-medium text-hero-foreground"
              >
                {stage.label}
                <X className="size-3.5" />
                <span className="sr-only">- show every stage</span>
              </button>
            )}
          </div>
          <div className="relative w-full sm:w-64">
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Find a candidate"
              placeholder="Name, mobile, position, offer no."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 rounded-full pl-9"
            />
          </div>
        </div>

        {candidates.isPending ? (
          <CandidatesTableSkeleton label="Loading candidates" />
        ) : candidates.error ? (
          <p className="py-10 text-center text-sm text-negative-ink">{errorMessage(candidates.error)}</p>
        ) : shown.length === 0 ? (
          <EmptyState
            className="py-8"
            title={words ? 'No candidate matches' : 'No candidates here yet'}
            hint={words ? 'Check the spelling, or clear the search.' : stage ? 'No candidate is at this stage - click it again to see everyone.' : 'Start with “New offer”.'}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidate</TableHead>
                <TableHead className="hidden md:table-cell">Position</TableHead>
                <TableHead className="hidden sm:table-cell">Joining date</TableHead>
                <TableHead className="hidden lg:table-cell">Progress</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden w-12 sm:table-cell">
                  <span className="sr-only">Open</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((r) => {
                const name = fullName(r)
                const progress = progressOf(r)
                const closed = CLOSED_STATUSES.includes(r.status)
                return (
                  <TableRow key={r.id} className="group cursor-pointer" onClick={() => open(r.id)}>
                    <TableCell className="max-sm:whitespace-normal">
                      <div className="flex items-center gap-3">
                        <span
                          aria-hidden
                          className={cn(
                            'grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold',
                            r.status === 'ACCEPTED' ? 'bg-hero text-hero-foreground' : 'bg-gold-soft text-foreground',
                          )}
                        >
                          {initialsOf(name)}
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium">{name}</p>
                          <p className="text-xs text-muted-foreground">{r.mobile}</p>
                          {/* narrow screens: the columns that are hidden */}
                          <p className="text-xs text-muted-foreground md:hidden">
                            {r.designation.name}
                            <span className="sm:hidden"> · joining {formatDate(r.proposedJoiningDate)}</span>
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <p>{r.designation.name}</p>
                      <p className="text-xs text-muted-foreground">{[r.company.code, r.workLocation?.name, JOINING_TYPE[r.joiningType]].filter(Boolean).join(' · ')}</p>
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap sm:table-cell">
                      <p>{formatDate(r.proposedJoiningDate)}</p>
                      {OPEN.includes(r.status) && <p className="text-xs text-muted-foreground">{relativeDay(r.proposedJoiningDate.getTime(), now)}</p>}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="w-40" title={`${progress.done} of ${PROGRESS_STEPS.length} steps done`}>
                        <div className="flex gap-1">
                          {PROGRESS_STEPS.map((step, i) => (
                            <span
                              key={step}
                              className={cn(
                                'h-1.5 flex-1 rounded-full',
                                i < progress.done ? (closed ? 'bg-muted-foreground/40' : 'bg-hero') : i === progress.done && !closed ? 'bg-gold' : 'bg-surface-2',
                              )}
                            />
                          ))}
                        </div>
                        <p className="mt-1.5 truncate text-xs text-muted-foreground">{progress.next}</p>
                      </div>
                    </TableCell>
                    <TableCell className="max-sm:whitespace-normal">
                      <Pill tone={STATUS_TONE[r.status]}>{statusLabel(r)}</Pill>
                      {/* below lg the progress column is hidden: its next step under the status */}
                      <p className="mt-1 text-xs text-muted-foreground lg:hidden">{progress.next}</p>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span
                        aria-hidden
                        className="grid size-8 place-items-center rounded-full border border-border text-muted-foreground transition-colors group-hover:border-hero group-hover:bg-hero group-hover:text-hero-foreground"
                      >
                        <ArrowUpRight className="size-4" />
                      </span>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </section>

      <OfferDialog open={creating} onOpenChange={setCreating} onCreated={open} />
    </div>
  )
}
