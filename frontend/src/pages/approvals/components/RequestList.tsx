import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, ChevronRight, X } from 'lucide-react'
import { useState } from 'react'
import { ApprovalStatusPill } from '@/components/ApprovalTrail'
import { Pill } from '@/components/Pill'
import { ReasonDialog } from '@/components/ReasonDialog'
import { Button } from '@/components/ui/button'
import { orpc } from '@/lib/orpc'
import { cn, errorMessage, formatDate, initialsOf } from '@/lib/utils'
import { type ApprovalRow, kindOf, type ListMode, refreshAfterDecision, ROW_GRID } from './request-kinds'

// The requests of one Approvals tab (redesigned with the user 2026-11-22 - was a plain table): one row per request with
// its kind, what is asked, where its steps stand and how long it waits; "Waiting for me" rows have Approve / Reject
// right on the row (the user: "so that I don't have to open it when I already know what it is for"). A click elsewhere
// on the row opens the whole request.

export type Decided = { name: string; label: string; approved: boolean }


const DAY = 86_400_000
const waited = (since: Date) => {
  const days = Math.floor((Date.now() - since.getTime()) / DAY)
  return days < 1 ? 'since today' : days === 1 ? '1 day' : `${days} days`
}

export function RequestList({ rows, mode, onOpen, onDecided }: { rows: ApprovalRow[]; mode: ListMode; onOpen: (id: number) => void; onDecided?: (d: Decided) => void }) {
  return (
    <ul className="divide-y divide-border/70 overflow-hidden rounded-2xl bg-card shadow-card">
      {rows.map((r) => (
        <RequestRow key={r.id} r={r} mode={mode} onOpen={() => onOpen(r.id)} onDecided={onDecided} />
      ))}
    </ul>
  )
}

function RequestRow({ r, mode, onOpen, onDecided }: { r: ApprovalRow; mode: ListMode; onOpen: () => void; onDecided?: (d: Decided) => void }) {
  const kind = kindOf(r.feature)
  const Icon = kind.icon
  const late = r.step?.late
  return (
    <li
      className={cn(
        'group relative grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3 transition-colors hover:bg-surface-2/50 lg:gap-x-5',
        ROW_GRID,
        late && mode === 'decide' && 'before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-destructive/70',
      )}
      onClick={onOpen}
    >
      {/* who + kind */}
      <div className="col-span-2 flex min-w-0 items-center gap-3 lg:col-span-1">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-hero text-xs font-semibold text-hero-foreground">{initialsOf(r.employee.name)}</span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {r.employee.name} <span className="text-xs font-normal text-muted-foreground">{r.employee.employeeCode}</span>
          </p>
          <span className={cn('mt-0.5 inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', kind.tint)}>
            <Icon aria-hidden className="size-3 shrink-0" />
            <span className="truncate">{r.label}</span>
          </span>
        </div>
      </div>

      {/* what is asked */}
      <p className="col-span-2 line-clamp-2 text-sm lg:col-span-1">{r.summary}</p>

      {/* where it stands */}
      <div className="col-span-2 min-w-0 text-sm lg:col-span-1">
        {mode === 'held' ? (
          <span className="text-warning-ink">{r.held?.reason}</span>
        ) : mode === 'decided' && r.decision ? (
          <MyDecision r={r} />
        ) : mode === 'mine' && r.status !== 'PENDING' ? (
          <ApprovalStatusPill status={r.status} />
        ) : r.held ? (
          <Pill tone="warning">Held</Pill>
        ) : r.step ? (
          <StepProgress step={r.step} />
        ) : null}
      </div>

      {/* when */}
      <div className="text-xs text-muted-foreground tabular-nums">
        <span className="text-sm text-foreground">{formatDate(r.raisedAt)}</span>
        <span className="block">
          {mode === 'decide' && r.step?.openedAt ? `waiting ${waited(r.step.openedAt)}` : mode !== 'mine' && r.requestedBy ? `by ${r.requestedBy.name}` : null}
        </span>
      </div>

      {/* act */}
      <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
        {mode === 'decide' ? (
          <DecideButtons r={r} onDecided={onDecided} />
        ) : (
          <Button variant="ghost" size="icon-sm" aria-label="Open the request" onClick={onOpen}>
            <ChevronRight />
          </Button>
        )}
      </div>
    </li>
  )
}

// "Decided by me": what the viewer did and when (with their reason for a rejection), and where the request stands now
function MyDecision({ r }: { r: ApprovalRow }) {
  const d = r.decision!
  const approved = d.status === 'APPROVED'
  return (
    <div className="min-w-0 space-y-1">
      <p className="flex flex-wrap items-center gap-1.5">
        <Pill tone={approved ? 'positive' : 'negative'}>{approved ? 'You approved' : 'You rejected'}</Pill>
        <span className="text-xs text-muted-foreground tabular-nums">{formatDate(d.decidedAt)}</span>
      </p>
      {!approved && d.comment ? (
        <p className="truncate text-xs text-muted-foreground" title={d.comment}>
          “{d.comment}”
        </p>
      ) : r.status === 'PENDING' ? (
        <p className="truncate text-xs text-muted-foreground">{r.step ? `Now at step ${r.step.stepNo} of ${r.step.of} · ${r.step.approver?.name ?? r.step.who}` : 'Held'}</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Request <span className="lowercase">{r.status === 'APPROVED' ? 'approved' : r.status === 'REJECTED' ? 'rejected' : r.status === 'CANCELLED' ? 'withdrawn' : 'expired'}</span>
        </p>
      )}
    </div>
  )
}

// "Step 1 of 2" as segments - done, the one waiting (gold), the ones after - with who decides it
function StepProgress({ step }: { step: NonNullable<ApprovalRow['step']> }) {
  return (
    <div className="min-w-0 space-y-1">
      <div className="flex items-center gap-1" aria-hidden>
        {Array.from({ length: step.of }, (_, i) => (
          <span key={i} className={cn('h-1.5 flex-1 rounded-full', i + 1 < step.stepNo ? 'bg-positive' : i + 1 === step.stepNo ? 'bg-gold' : 'bg-surface-2')} />
        ))}
      </div>
      <p className="flex min-w-0 items-center gap-1.5">
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          Step {step.stepNo} of {step.of}
        </span>
        <span className="truncate">{step.approver?.name ?? step.who}</span>
        {step.byFallback && <Pill tone="gold">Fallback</Pill>}
        {step.late && <Pill tone="negative">Late</Pill>}
      </p>
    </div>
  )
}

function DecideButtons({ r, onDecided }: { r: ApprovalRow; onDecided?: (d: Decided) => void }) {
  const queryClient = useQueryClient()
  const [rejecting, setRejecting] = useState(false)
  const decide = useMutation(
    orpc.approvals.decide.mutationOptions({
      onSuccess: (_, input) => {
        setRejecting(false)
        onDecided?.({ name: r.employee.name, label: r.label, approved: input.approve })
        refreshAfterDecision(queryClient)
      },
    }),
  )
  return (
    <>
      {decide.error && !rejecting && <span className="mr-1 max-w-48 text-xs text-negative-ink">{errorMessage(decide.error)}</span>}
      <Button variant="destructive" size="sm" onClick={() => setRejecting(true)} disabled={decide.isPending} aria-label={`Reject - ${r.employee.name}`}>
        <X /> Reject
      </Button>
      <Button
        variant="secondary"
        size="sm"
        className="bg-positive/15 text-positive-ink hover:bg-positive/25"
        onClick={() => decide.mutate({ id: r.id, approve: true })}
        disabled={decide.isPending}
        aria-label={`Approve - ${r.employee.name}`}
      >
        <Check /> {decide.isPending && decide.variables?.approve ? 'Saving…' : 'Approve'}
      </Button>
      {rejecting && (
        <ReasonDialog
          title={`Reject ${r.employee.name}'s request?`}
          description={`${r.label}: ${r.summary}. The person who asked is told, with your reason.`}
          label="Reason"
          confirm="Reject"
          required
          pending={decide.isPending}
          error={decide.error ? errorMessage(decide.error) : null}
          onConfirm={(comment) => decide.mutate({ id: r.id, approve: false, comment })}
          onClose={() => setRejecting(false)}
        />
      )}
    </>
  )
}
