import { ExportButton } from '@/components/ExportButton'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Lock, LockOpen } from 'lucide-react'
import { useState } from 'react'
import { DialogCancel, FormDialog } from '@/components/FormDialog'
import { FormError } from '@/components/FormError'
import { LockChecklistSkeleton } from '@/components/skeletons/attendance/LockChecklistSkeleton'
import { CycleStartSkeleton, MonthTilesSkeleton } from '@/components/skeletons/attendance/MonthLockSkeleton'
import { ReasonDialog } from '@/components/ReasonDialog'
import { Button } from '@/components/ui/button'
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { useAccess } from '@/hooks/useAccess'
import { client, orpc } from '@/lib/orpc'
import { cn, errorMessage, formatDate, formatDoneBy, todayDay } from '@/lib/utils'
import { CYCLE_HINT, CYCLE_LABEL, FILTER_SELECT, LOCK_HINT, SETUP_ICONS } from './labels'
import { SetupCard } from './SetupCard'

type MonthRow = Awaited<ReturnType<typeof client.attendance.locks.months>>['months'][number]

// "26 Oct" - a day of a month's range on its tile
const shortDay = (d: Date) => d.toLocaleDateString('en-IN', { timeZone: 'UTC', day: 'numeric', month: 'short' })

// The attendance month lock (the user, 2026-11-22 - for payroll): one lock for the whole group (Attendance setup Edit for all
// companies). Each attendance month of a year (RML: the 26th to the 25th) as a tile with its state - locked quiet grey, over
// and still open soft gold (the one to act on), not over yet hatched (the redesign, 2026-11-25); "Lock" shows what is still open (a warning - it does not
// block), works the month out once more and locks it; "Open again" needs a reason. The month's start day is set at the
// foot of the card (not while a month is locked).
export function MonthLockSetup() {
  const queryClient = useQueryClient()
  const [year, setYear] = useState(todayDay().getUTCFullYear())
  const canChange = useAccess().coversGroup('ATTENDANCE_SETUP')
  const months = useQuery({ ...orpc.attendance.locks.months.queryOptions({ input: { year } }), enabled: canChange })
  const [locking, setLocking] = useState<MonthRow | null>(null)
  const [opening, setOpening] = useState<MonthRow | null>(null)
  const refresh = () => void queryClient.invalidateQueries({ queryKey: orpc.attendance.key() })
  const unlock = useMutation(orpc.attendance.locks.unlock.mutationOptions({ onSuccess: () => (refresh(), setOpening(null)) }))
  const lockedCount = months.data?.months.filter((m) => m.locked).length

  if (!canChange) {
    return (
      <SetupCard icon={SETUP_ICONS.lock} title="Month lock">
        <p className="text-sm text-muted-foreground">Locking a month is for the whole group - it needs Attendance setup: Edit for all companies.</p>
      </SetupCard>
    )
  }
  return (
    <SetupCard
      icon={SETUP_ICONS.lock}
      title="Month lock"
      count={lockedCount === undefined ? undefined : `${lockedCount} locked`}
      summary="A locked month no longer changes - for payroll, one lock for every company"
      hint={LOCK_HINT}
      action={
        <div className="flex flex-wrap items-center gap-2">
          <ExportButton disabled={!months.data || months.isFetching} load={() => client.attendance.exportSetup({ section: 'locks', year })} />
          <NativeSelect className={FILTER_SELECT} aria-label="Year" value={String(year)} onChange={(e) => setYear(Number(e.target.value))}>
            {[year - 1, year, year + 1].map((y) => (
              <NativeSelectOption key={y} value={String(y)}>
                {y}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      }
    >
      <FormError error={months.error ?? unlock.error} />
      {months.isPending && <MonthTilesSkeleton label="Loading the months" />}
      {months.data && (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {months.data.months.map((m) => (
            <li
              key={m.month}
              className={cn(
                'flex min-w-0 flex-col justify-between gap-2 rounded-2xl p-3',
                m.locked ? 'bg-surface-2' : m.ended ? 'bg-gold-soft' : 'u-hatch ring-1 ring-border ring-inset',
              )}
            >
              <div className="min-w-0">
                <p className="flex items-center justify-between gap-1 text-sm font-medium">
                  <span className="truncate">{m.name}</span>
                  {m.locked && <Lock aria-label="Locked" className="size-3.5 shrink-0 text-muted-foreground" />}
                </p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {shortDay(m.from)} – {shortDay(m.to)}
                </p>
              </div>
              <div className="min-w-0 space-y-1.5">
                {m.locked ? (
                  <p className="text-xs text-muted-foreground">Locked {formatDoneBy(m.locked.at, m.locked.by)}</p>
                ) : (
                  <p className={cn('text-xs', m.ended ? 'font-medium' : 'text-muted-foreground')}>{m.ended ? 'Over - not locked yet' : 'Not over yet'}</p>
                )}
                {m.reopened.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Opened again {m.reopened.length}× - last: {m.reopened[0]!.reason}
                  </p>
                )}
                {m.locked ? (
                  <Button variant="ghost" size="sm" className="-ml-2 hover:bg-card" onClick={() => setOpening(m)}>
                    <LockOpen /> Open again
                  </Button>
                ) : (
                  m.ended && (
                    <Button variant="outline" size="sm" className="bg-card" onClick={() => setLocking(m)}>
                      <Lock /> Lock
                    </Button>
                  )
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {months.isPending && <CycleStartSkeleton />}
      {months.data && <CycleStart current={months.data.cycleStartDay} anyLocked={months.data.months.some((m) => m.locked)} onSaved={refresh} />}
      {locking && <LockDialog month={locking} onClose={() => setLocking(null)} onLocked={refresh} />}
      {opening && (
        <ReasonDialog
          title={`Open ${opening.name} again?`}
          description="Its days can change again (punches, corrections, roster days) until it is locked again. The reason is kept."
          label="Why"
          confirm="Open again"
          required
          pending={unlock.isPending}
          error={unlock.error ? errorMessage(unlock.error) : null}
          onConfirm={(reason) => unlock.mutate({ year: opening.year, month: opening.month, reason: reason ?? '' })}
          onClose={() => setOpening(null)}
        />
      )}
    </SetupCard>
  )
}

// What "Lock" checks in the month: its name and hint (the dialog and its skeleton)
const LOCK_CHECKS = [
  ['Missed punches', 'days with only one punch, not fixed'],
  ['Shift changes waiting', 'requests for its days not decided yet'],
  ['Unknown machine codes', 'punches not linked to an employee'],
] as const

// "Lock November 2026?" - what is still open in the month (a warning), then lock
function LockDialog({ month, onClose, onLocked }: { month: MonthRow; onClose: () => void; onLocked: () => void }) {
  const checklist = useQuery(orpc.attendance.locks.checklist.queryOptions({ input: { year: month.year, month: month.month } }))
  const lock = useMutation(orpc.attendance.locks.lock.mutationOptions({ onSuccess: () => (onLocked(), onClose()) }))
  const c = checklist.data
  const counts = c ? [c.missedPunches, c.pendingShiftChanges, c.unmatchedPunches] : []
  const items: [string, number, string][] = counts.map((count, i) => [LOCK_CHECKS[i]![0], count, LOCK_CHECKS[i]![1]])
  const open = items.reduce((n, [, count]) => n + count, 0)
  return (
    <FormDialog onOpenChange={(o) => !o && onClose()} dirty={false} className="rounded-3xl sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Lock {month.name}?</DialogTitle>
        <DialogDescription>
          {formatDate(month.from)} – {formatDate(month.to)}, every company. The days are worked out once more, then nothing in the month changes until it is opened again.
        </DialogDescription>
      </DialogHeader>
      {checklist.isPending ? (
        <LockChecklistSkeleton checks={LOCK_CHECKS} label="Checking the month" />
      ) : (
        <ul className="divide-y rounded-2xl bg-surface-2/60 px-3 text-sm">
          {items.map(([label, count, hint]) => (
            <li key={label} className="flex items-center justify-between gap-3 py-2">
              <span>
                {label}
                <span className="block text-xs text-muted-foreground">{hint}</span>
              </span>
              <span className={cn('font-semibold tabular-nums', count ? 'text-warning-ink' : 'text-positive-ink')}>{count}</span>
            </li>
          ))}
        </ul>
      )}
      {open > 0 && <p className="text-xs text-warning-ink">Some things are still open - you can lock anyway, or fix them first.</p>}
      <FormError error={checklist.error ?? lock.error} />
      <DialogFooter>
        <DialogCancel />
        <Button variant="gold" disabled={!c || lock.isPending} onClick={() => lock.mutate({ year: month.year, month: month.month })}>
          <Lock /> {lock.isPending ? 'Locking…' : open ? 'Lock anyway' : 'Lock'}
        </Button>
      </DialogFooter>
    </FormDialog>
  )
}

// The day an attendance month starts (1 = the calendar month; RML: 26) - a row at the foot of the month lock's card
function CycleStart({ current, anyLocked, onSaved }: { current: number; anyLocked: boolean; onSaved: () => void }) {
  const [day, setDay] = useState(String(current))
  const save = useMutation(orpc.attendance.locks.setCycleStart.mutationOptions({ onSuccess: onSaved }))
  return (
    <div className="space-y-2 border-t border-border/60 pt-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <label htmlFor="cycle-start" className="text-sm font-medium">
          {CYCLE_LABEL}
        </label>
        <Input id="cycle-start" type="number" min={1} max={28} className="h-9 w-20 rounded-xl" value={day} onChange={(e) => setDay(e.target.value)} />
        <Button variant="secondary" size="sm" disabled={anyLocked || save.isPending || Number(day) === current || !(Number(day) >= 1 && Number(day) <= 28)} onClick={() => save.mutate({ cycleStartDay: Number(day) })}>
          Save
        </Button>
        <span className="text-xs text-muted-foreground">{anyLocked ? 'Open the locked months again to change it.' : CYCLE_HINT}</span>
      </div>
      <FormError error={save.error} />
    </div>
  )
}
