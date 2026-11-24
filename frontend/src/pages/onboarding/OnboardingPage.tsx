import { ExportButton } from '@/components/ExportButton'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { CandidatesTableSkeleton } from '@/components/skeletons/onboarding/CandidatesTableSkeleton'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAccess } from '@/hooks/useAccess'
import { client, orpc } from '@/lib/orpc'
import { cn, errorMessage, formatDate } from '@/lib/utils'
import { type CandidateRow, type CandidateStatus, CLOSED_STATUSES, fullName, JOINING_TYPE, statusLabel, STATUS_TONE } from './components/labels'
import { OfferDialog } from './components/OfferDialog'
import { EmptyState } from '@/components/EmptyState'
import { Pill } from '@/components/Pill'

const FILTERS: { key: string; label: string; statuses: CandidateStatus[] | null }[] = [
  { key: 'all', label: 'All', statuses: null },
  { key: 'draft', label: 'Draft', statuses: ['DRAFT'] },
  { key: 'offered', label: 'Offer sent', statuses: ['OFFERED', 'LOI_ACCEPTED'] },
  { key: 'prejoining', label: 'Pre-joining', statuses: ['ACCEPTED'] },
  { key: 'joined', label: 'Joined', statuses: ['JOINED'] },
  { key: 'closed', label: 'Did not join', statuses: CLOSED_STATUSES },
]

const DAY = 24 * 60 * 60 * 1000

// Onboarding: offer -> acceptance -> pre-joining. Layout from the old HRMS onboarding board:
// page header, stat tiles and a candidate table; a candidate opens on its own page (CandidatePage).
export function OnboardingPage() {
  const candidates = useQuery(orpc.candidates.list.queryOptions())
  const [filter, setFilter] = useState('all')
  const [creating, setCreating] = useState(false)
  const navigate = useNavigate()
  const open = (id: number) => void navigate(`/onboarding/${id}`)
  const canChange = useAccess().can('ONBOARDING', 'WRITE')

  const rows = candidates.data ?? []
  const statuses = FILTERS.find((f) => f.key === filter)?.statuses
  const shown = statuses ? rows.filter((r) => statuses.includes(r.status)) : rows
  const [now] = useState(() => Date.now())
  // null while the list loads (the tile shows a bar)
  const count = (fn: (r: CandidateRow) => boolean) => (candidates.data ? rows.filter(fn).length : candidates.isPending ? null : '—')

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
          {/* The report follows the selected lifecycle group. */}
          <ExportButton load={() => client.candidates.export({statuses:statuses ?? undefined})} disabled={!shown.length || candidates.isFetching} title="Export candidates in the selected lifecycle group" />
          {canChange ? (
            <Button variant="gold" onClick={() => setCreating(true)}>
              <Plus /> New offer
            </Button>
          ) : (
            <span className="rounded-full bg-card px-4 py-2 text-sm text-muted-foreground shadow-card">View only</span>
          )}
        </div>

      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Offers out" value={count((r) => r.status === 'DRAFT' || r.status === 'OFFERED' || r.status === 'LOI_ACCEPTED')} hint="draft or sent" />
        <StatTile tone="hero" label="Pre-joining" value={count((r) => r.status === 'ACCEPTED')} hint="accepted, not joined yet" />
        <StatTile
          label="Joining in 7 days"
          value={count((r) => r.status === 'ACCEPTED' && r.proposedJoiningDate.getTime() - now <= 7 * DAY)}
          hint="call to confirm"
        />
        <StatTile tone="hatched" label="Did not join" value={count((r) => CLOSED_STATUSES.includes(r.status))} hint="declined, withdrawn or no-show" />
      </div>

      <section className="space-y-3 rounded-3xl bg-card p-4 shadow-card sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-light tracking-tight">Candidates</h2>
          <div className="flex max-w-full gap-1 overflow-x-auto rounded-full bg-surface-2 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={cn(
                  'shrink-0 rounded-full px-3.5 py-2 text-xs font-medium whitespace-nowrap transition-colors sm:py-1.5',
                  filter === f.key ? 'bg-hero text-hero-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {candidates.isPending ? (
          <CandidatesTableSkeleton label="Loading candidates" />
        ) : candidates.error ? (
          <p className="py-10 text-center text-sm text-negative-ink">{errorMessage(candidates.error)}</p>
        ) : shown.length === 0 ? (
          <EmptyState
            className="py-8"
            title="No candidates here yet"
            hint={filter === 'all' ? 'Start with “New offer”.' : 'No candidate is at this step - choose “All” to see everyone.'}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidate</TableHead>
                <TableHead className="hidden md:table-cell">Position</TableHead>
                <TableHead className="hidden sm:table-cell">Joining date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">Joining confirmed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((r) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => open(r.id)}>
                  <TableCell className="max-sm:whitespace-normal">
                    <p className="font-medium">{fullName(r)}</p>
                    <p className="text-xs text-muted-foreground">{r.mobile}</p>
                    {/* narrow screens: the columns that are hidden */}
                    <p className="text-xs text-muted-foreground md:hidden">
                      {r.designation.name}
                      <span className="sm:hidden"> · joining {formatDate(r.proposedJoiningDate)}</span>
                    </p>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <p>{r.designation.name}</p>
                    <p className="text-xs text-muted-foreground">{[r.company.code, r.workLocation?.name, JOINING_TYPE[r.joiningType]].filter(Boolean).join(' · ')}</p>
                  </TableCell>
                  <TableCell className="hidden whitespace-nowrap sm:table-cell">{formatDate(r.proposedJoiningDate)}</TableCell>
                  <TableCell className="max-sm:whitespace-normal">
                    <Pill tone={STATUS_TONE[r.status]}>{statusLabel(r)}</Pill>
                    {r.status === 'ACCEPTED' && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Joining form: {r.joiningFormSubmittedAt ? 'signed' : r.joiningFormReturnedAt ? 'sent back' : 'not submitted'}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground lg:table-cell">{r.status === 'ACCEPTED' ? (r.joiningConfirmedAt ? 'Yes' : 'Not yet') : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <OfferDialog open={creating} onOpenChange={setCreating} onCreated={open} />
    </div>
  )
}

// `value` null: still loading - a bar where the number goes
function StatTile({ label, value, hint, tone }: { label: string; value: number | string | null; hint: string; tone?: 'hero' | 'hatched' }) {
  return (
    <div className={cn('rounded-2xl px-4 py-3 shadow-card', tone === 'hero' ? 'bg-hero text-hero-foreground' : 'bg-card', tone === 'hatched' && 'u-hatch')}>
      <p className={cn('text-sm', tone === 'hero' ? 'text-hero-foreground/75' : 'text-muted-foreground')}>{label}</p>
      {value === null ? (
        <div className="mt-0.5 flex h-9 items-center">
          <Skeleton className={cn('h-7 w-10 rounded-lg', tone === 'hero' && 'bg-hero-foreground/10')} />
        </div>
      ) : (
        <p className="mt-0.5 text-3xl font-light tracking-tight tabular-nums">{value}</p>
      )}
      <p className={cn('text-xs', tone === 'hero' ? 'text-hero-foreground/75' : 'text-muted-foreground')}>{hint}</p>
    </div>
  )
}
