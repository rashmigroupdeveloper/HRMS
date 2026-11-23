import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Lock, LockOpen } from 'lucide-react'
import { useState } from 'react'
import { DialogCancel, FormDialog } from '@/components/FormDialog'
import { FormError } from '@/components/FormError'
import { Pill } from '@/components/Pill'
import { LockChecklistSkeleton } from '@/components/skeletons/attendance/LockChecklistSkeleton'
import { ReasonDialog } from '@/components/ReasonDialog'
import { Button } from '@/components/ui/button'
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAccess } from '@/hooks/useAccess'
import { type client, orpc } from '@/lib/orpc'
import { cn, errorMessage, formatDate, formatDoneBy, todayDay } from '@/lib/utils'

type MonthRow = Awaited<ReturnType<typeof client.attendance.locks.months>>['months'][number]
type CardProps = { title: string; hint?: string; action?: React.ReactNode; children: React.ReactNode }

// The attendance month lock (the user, 2026-11-22 - for payroll): one lock for the whole group (Attendance setup Edit for all
// companies). Each attendance month of a year (RML: the 26th to the 25th) with its state; "Lock" shows what is still open
// (a warning - it does not block), works the month out once more and locks it; "Open again" needs a reason. The month's
// start day is set here too (not while a month is locked).
export function MonthLockSetup({ card: Card }: { card: (props: CardProps) => React.ReactNode }) {
  const queryClient = useQueryClient()
  const [year, setYear] = useState(todayDay().getUTCFullYear())
  const canChange = useAccess().coversGroup('ATTENDANCE_SETUP')
  const months = useQuery({ ...orpc.attendance.locks.months.queryOptions({ input: { year } }), enabled: canChange })
  const [locking, setLocking] = useState<MonthRow | null>(null)
  const [opening, setOpening] = useState<MonthRow | null>(null)
  const refresh = () => void queryClient.invalidateQueries({ queryKey: orpc.attendance.key() })
  const unlock = useMutation(orpc.attendance.locks.unlock.mutationOptions({ onSuccess: () => (refresh(), setOpening(null)) }))
  const range = (m: MonthRow) => `${formatDate(m.from)} – ${formatDate(m.to)}`

  if (!canChange) {
    return (
      <Card title="Month lock">
        <p className="text-sm text-muted-foreground">Locking a month is for the whole group - it needs Attendance setup: Edit for all companies.</p>
      </Card>
    )
  }
  return (
    <div className="space-y-3">
      <Card
        title="Month lock"
        hint="A locked month does not change any more - its days are not worked out again, and punches, corrections, roster days and shift changes for it are refused. For payroll. One lock for every company."
        action={
          <NativeSelect className="[&_select]:h-9 [&_select]:rounded-full" aria-label="Year" value={String(year)} onChange={(e) => setYear(Number(e.target.value))}>
            {[year - 1, year, year + 1].map((y) => (
              <NativeSelectOption key={y} value={String(y)}>
                {y}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        }
      >
        <FormError error={months.error ?? unlock.error} />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Month</TableHead>
              <TableHead className="hidden sm:table-cell">Days</TableHead>
              <TableHead>State</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {months.data?.months.map((m) => (
              <TableRow key={m.month}>
                <TableCell className="font-medium">{m.name}</TableCell>
                <TableCell className="hidden text-sm tabular-nums sm:table-cell">{range(m)}</TableCell>
                <TableCell className="text-sm">
                  {m.locked ? (
                    <span className="flex flex-wrap items-center gap-1.5">
                      <Pill tone="info">
                        <Lock className="size-3" /> Locked
                      </Pill>
                      <span className="text-xs text-muted-foreground">{formatDoneBy(m.locked.at, m.locked.by)}</span>
                    </span>
                  ) : m.ended ? (
                    <Pill tone="neutral">Open</Pill>
                  ) : (
                    <span className="text-xs text-muted-foreground">Not over yet</span>
                  )}
                  {m.reopened.length > 0 && (
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      Opened again {m.reopened.length}× - last: {m.reopened[0]!.reason}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {m.locked ? (
                    <Button variant="ghost" size="sm" onClick={() => setOpening(m)}>
                      <LockOpen /> Open again
                    </Button>
                  ) : (
                    m.ended && (
                      <Button variant="secondary" size="sm" onClick={() => setLocking(m)}>
                        <Lock /> Lock
                      </Button>
                    )
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      {months.data && <CycleStart current={months.data.cycleStartDay} anyLocked={months.data.months.some((m) => m.locked)} onSaved={refresh} card={Card} />}
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
    </div>
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

// The day an attendance month starts (1 = the calendar month; RML: 26)
function CycleStart({ current, anyLocked, onSaved, card: Card }: { current: number; anyLocked: boolean; onSaved: () => void; card: (props: CardProps) => React.ReactNode }) {
  const [day, setDay] = useState(String(current))
  const save = useMutation(orpc.attendance.locks.setCycleStart.mutationOptions({ onSuccess: onSaved }))
  return (
    <Card title="Attendance month" hint="The day each attendance month starts - e.g. 26: “November” is 26 Oct – 25 Nov; 1: the calendar month. The muster, the month views, the late count and the lock follow it.">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="cycle-start" className="text-sm">
          Starts on day
        </label>
        <Input id="cycle-start" type="number" min={1} max={28} className="h-9 w-20 rounded-xl" value={day} onChange={(e) => setDay(e.target.value)} />
        <Button variant="secondary" size="sm" disabled={anyLocked || save.isPending || Number(day) === current || !(Number(day) >= 1 && Number(day) <= 28)} onClick={() => save.mutate({ cycleStartDay: Number(day) })}>
          Save
        </Button>
        {anyLocked && <span className="text-xs text-muted-foreground">Open the locked months again to change it.</span>}
      </div>
      <FormError error={save.error} />
    </Card>
  )
}
