import { ExportButton } from '@/components/ExportButton'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarPlus, Check, FileClock, Repeat } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { FormError } from '@/components/FormError'
import { Pill } from '@/components/Pill'
import { MonthSkeleton } from '@/components/skeletons/attendance/MonthSkeleton'
import { AttendanceRequestsSkeleton } from '@/components/skeletons/attendance/AttendanceRequestsSkeleton'
import { Button } from '@/components/ui/button'
import { client, orpc } from '@/lib/orpc'
import { formatDate, todayDay } from '@/lib/utils'
import { compOffDays, cycleRange, type MonthDay, REQUEST_STATUS, type Regularization } from './labels'
import { useAttendanceMonth, useCycleStartDay } from './useAttendanceMonth'
import { MonthCalendar, MonthPicker, MonthTotals } from './MonthCalendar'
import { CompOffDialog } from './CompOffDialog'
import { RegularizationDialog } from './RegularizationDialog'
import { ShiftChangeDialog } from './ShiftChangeDialog'

// The employee's own attendance: the month calendar with the totals, their shift-change requests and their regularization /
// on-duty requests (2026-11-22).
export function MyAttendance() {
  const queryClient = useQueryClient()
  const now = todayDay()
  // the attendance month today is in (26th to 25th)
  const currentMonth = useAttendanceMonth()
  // Follow the server's attendance cycle until the employee explicitly chooses a month.
  const [chosenMonth, setYm] = useState<typeof currentMonth | null>(null)
  const ym = chosenMonth ?? currentMonth
  const month = useQuery(orpc.attendance.days.myMonth.queryOptions({ input: ym }))
  // the month's days before they load (26 Oct - 25 Nov with RML's start day) - the picker's line and the placeholder
  const range = cycleRange(ym.year, ym.month, useCycleStartDay())
  const requests = useQuery(orpc.attendance.shiftChanges.mine.queryOptions())
  const cancel = useMutation(orpc.attendance.shiftChanges.cancel.mutationOptions({ onSuccess: () => void queryClient.invalidateQueries({ queryKey: orpc.attendance.key() }) }))
  const [asking, setAsking] = useState<{ date?: Date } | null>(null)
  const regularizations = useQuery(orpc.attendance.regularizations.mine.queryOptions())
  const withdraw = useMutation(orpc.attendance.regularizations.cancel.mutationOptions({ onSuccess: () => void queryClient.invalidateQueries({ queryKey: orpc.attendance.key() }) }))
  const [regularizing, setRegularizing] = useState<{ date?: Date } | null>(null)
  // comp-off (2026-11-22): a weekly off / holiday already over (up to 30 days back) worked at least 4 hours
  const [claiming, setClaiming] = useState<MonthDay | null>(null)
  // the days already claimed (waiting or approved) - one claim per day; a claim reloads these (leave.*)
  const claims = useQuery(orpc.leave.compOff.mine.queryOptions())
  const claimed = new Set((claims.data ?? []).filter((c) => c.status === 'PENDING' || c.status === 'APPROVED').map((c) => c.workDate.getTime()))
  const [notice, setNotice] = useState<{ id: number; text: string } | null>(null)
  const noticeId = useRef(0)
  const sent = (text: string) => {
    noticeId.current += 1
    setNotice({ id: noticeId.current, text })
  }
  const [direction, setDirection] = useState<'next' | 'previous' | null>(null)
  const showMonth = (year: number, month: number) => {
    setDirection(year * 12 + month > ym.year * 12 + ym.month ? 'next' : 'previous')
    setYm({ year, month })
  }
  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(null), 4000)
    return () => window.clearTimeout(timeout)
  }, [notice])
  const claimable = (day: MonthDay) =>
    (day.planned === 'WEEKLY_OFF' || day.planned === 'HOLIDAY') && day.date < now && day.date.getTime() >= now.getTime() - 30 * 86_400_000 && compOffDays(day.workedMinutes) > 0 && claims.isSuccess && !claimed.has(day.date.getTime())
  // any working day already come, today included, back 30 days — the same limit as the request — can be regularized,
  // whatever the punches currently say. A working day still to come is on duty. Weekly offs and holidays are not.
  const regularizable = (day: MonthDay) => {
    if (!day.employed) return false
    if (day.planned === 'WEEKLY_OFF' || day.planned === 'HOLIDAY' || day.status === 'WEEKLY_OFF' || day.status === 'HOLIDAY') return false
    if (day.planned != null && day.planned !== 'WORK') return false
    return day.date.getTime() >= now.getTime() - 30 * 86_400_000
  }

  return (
    <div className="space-y-6">
      <section aria-label="My attendance month" className="space-y-4 rounded-3xl bg-card p-3 shadow-card sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:gap-4">
            <h2 className="text-lg font-light tracking-tight">My month</h2>
            <MonthPicker year={ym.year} month={ym.month} onChange={showMonth} range={month.data ?? range} locked={month.data?.locked} />
            <ExportButton disabled={!month.data || month.isFetching} load={() => client.attendance.days.exportMonth(ym)} />
            {chosenMonth && (chosenMonth.year !== currentMonth.year || chosenMonth.month !== currentMonth.month) && (
              <Button variant="ghost" size="sm" onClick={() => { showMonth(currentMonth.year, currentMonth.month); setYm(null) }}>
                Current month
              </Button>
            )}
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto [&>button]:min-h-9">
            <Button variant="gold" size="sm" onClick={() => setRegularizing({})}>
              <FileClock /> Regularize / on duty
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setAsking({})}>
              <Repeat /> Shift change
            </Button>
          </div>
        </div>
        <FormError error={month.error} />
        {month.isError && <Button variant="secondary" size="sm" onClick={() => void month.refetch()}>Retry month</Button>}
        {notice && (
          <p key={notice.id} role="status" className="attendance-confirmation flex items-start gap-1.5 text-sm text-positive-ink">
            <Check className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {notice.text}
          </p>
        )}
        <div key={`${ym.year}-${ym.month}`} data-direction={direction ?? undefined} className="attendance-month-content space-y-3">
        {month.isPending && <MonthSkeleton year={ym.year} month={ym.month} range={range} label="Loading the month" />}
        {month.data && (
          <>
            <MonthTotals totals={month.data.totals} />
            <MonthCalendar
                data={month.data}
                actions={(day) => {
                if (month.data.locked) return <p className="text-xs text-hero-foreground/70">This attendance month is locked. Contact HR about a correction.</p>
                const change = day.date >= now && day.planned !== 'HOLIDAY'
                const regularize = regularizable(day)
                const compOff = claimable(day)
                if (!change && !regularize && !compOff) return null
                return (
                  <div className="flex flex-wrap gap-2 [&>button]:min-h-9">
                    {compOff && (
                      <Button variant="secondary" size="sm" onClick={() => setClaiming(day)}>
                        <CalendarPlus /> Claim comp-off
                      </Button>
                    )}
                    {regularize && (
                      <Button variant="secondary" size="sm" onClick={() => setRegularizing({ date: day.date })}>
                        <FileClock /> {day.date > now ? 'Ask for on duty' : 'Regularize this day'}
                      </Button>
                    )}
                    {change && (
                      <Button variant="secondary" size="sm" onClick={() => setAsking({ date: day.date })}>
                        <Repeat /> Ask to change this day
                      </Button>
                    )}
                  </div>
                )
              }}
            />
          </>
        )}
        </div>
      </section>

      <div className="grid items-start gap-3 lg:grid-cols-2">
        <section className="space-y-2 rounded-3xl bg-card p-4 shadow-card sm:p-5">
          <h2 className="text-lg font-light tracking-tight">My shift-change requests</h2>
          <FormError error={requests.error} />
          {requests.isError && <Button variant="secondary" size="sm" onClick={() => void requests.refetch()}>Retry shift requests</Button>}
          {requests.isPending && <AttendanceRequestsSkeleton label="Loading shift-change requests" />}
          {requests.data?.length === 0 && <p className="py-1 text-sm text-muted-foreground">No shift-change requests yet.</p>}
          <FormError error={cancel.error} />
          <ul className="divide-y">
            {requests.data?.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">
                    {formatDate(r.date)} ·{' '}
                    {r.kind === 'SWAP' ? `swap with ${r.swapWith?.name ?? '—'}` : r.requestedShift ? `${r.requestedShift.name} shift` : 'off'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {r.reason}
                    {/* where its approval stands (the approval service - 2026-11-22) */}
                    {r.status === 'PENDING' && r.approval?.step && ` · step ${r.approval.step.stepNo} of ${r.approval.step.of}: with ${r.approval.step.approver?.name ?? r.approval.step.who}`}
                    {r.status === 'PENDING' && r.approval?.held && <span className="text-warning-ink"> · held: {r.approval.held}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Pill tone={REQUEST_STATUS[r.status].tone}>{REQUEST_STATUS[r.status].label}</Pill>
                  {r.status === 'PENDING' && (
                    <Button variant="ghost" size="sm" disabled={cancel.isPending} onClick={() => cancel.mutate({ id: r.id })}>
                      Cancel
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
        <section className="space-y-2 rounded-3xl bg-card p-4 shadow-card sm:p-5">
          <h2 className="text-lg font-light tracking-tight">My regularization &amp; on-duty requests</h2>
          <FormError error={regularizations.error} />
          {regularizations.isError && <Button variant="secondary" size="sm" onClick={() => void regularizations.refetch()}>Retry attendance requests</Button>}
          {regularizations.isPending && <AttendanceRequestsSkeleton label="Loading regularization and on-duty requests" />}
          {regularizations.data?.length === 0 && <p className="py-1 text-sm text-muted-foreground">No regularization or on-duty requests yet.</p>}
          <FormError error={withdraw.error} />
          <ul className="divide-y">
            {regularizations.data?.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">
                    {r.kind === 'ON_DUTY' ? 'On duty' : 'Missed punch'} · {requestDays(r)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {r.reason}
                    {r.status === 'PENDING' && r.approval?.step && ` · step ${r.approval.step.stepNo} of ${r.approval.step.of}: with ${r.approval.step.approver?.name ?? r.approval.step.who}`}
                    {r.status === 'PENDING' && r.approval?.held && <span className="text-warning-ink"> · held: {r.approval.held}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Pill tone={REQUEST_STATUS[r.status].tone}>{REQUEST_STATUS[r.status].label}</Pill>
                  {r.status === 'PENDING' && (
                    <Button variant="ghost" size="sm" disabled={withdraw.isPending} onClick={() => withdraw.mutate({ id: r.id })}>
                      Withdraw
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
      {asking && <ShiftChangeDialog initialDate={asking.date} onClose={() => setAsking(null)} onSent={sent} />}
      {claiming && <CompOffDialog day={claiming} onClose={() => setClaiming(null)} onSent={sent} />}
      {regularizing && <RegularizationDialog initialDate={regularizing.date} onClose={() => setRegularizing(null)} onSent={sent} />}
    </div>
  )
}

// "12 Nov 2026 (first half)" / "12 Nov – 14 Nov 2026"
function requestDays(r: Pick<Regularization, 'fromDate' | 'toDate' | 'portion'>) {
  const half = r.portion === 'FIRST_HALF' ? ' (first half)' : r.portion === 'SECOND_HALF' ? ' (second half)' : ''
  return r.fromDate.getTime() === r.toDate.getTime() ? `${formatDate(r.fromDate)}${half}` : `${formatDate(r.fromDate)} – ${formatDate(r.toDate)}`
}
