import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarPlus, FileClock, Repeat } from 'lucide-react'
import { useState } from 'react'
import { FormError } from '@/components/FormError'
import { Pill } from '@/components/Pill'
import { MonthSkeleton } from '@/components/skeletons/attendance/MonthSkeleton'
import { Button } from '@/components/ui/button'
import { orpc } from '@/lib/orpc'
import { formatDate } from '@/lib/utils'
import { compOffDays, cycleRange, type MonthDay, REQUEST_STATUS, todayDay, type Regularization } from './labels'
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
  const [ym, setYm] = useState(useAttendanceMonth())
  const month = useQuery({ ...orpc.attendance.days.myMonth.queryOptions({ input: ym }), placeholderData: keepPreviousData })
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
  const claimable = (day: MonthDay) =>
    (day.planned === 'WEEKLY_OFF' || day.planned === 'HOLIDAY') && day.date < now && day.date.getTime() >= now.getTime() - 30 * 86_400_000 && compOffDays(day.workedMinutes) > 0
  // a day can be regularized when it has come (up to 30 days back) and was not worked in full; on duty for days to come
  const regularizable = (day: { date: Date; planned: string | null; status: string | null; covers: { status: string }[] }) =>
    day.planned === 'WORK' &&
    !day.covers.length &&
    (day.date > now || (day.date.getTime() >= now.getTime() - 30 * 86_400_000 && (day.status === 'ABSENT' || day.status === 'MISSED_PUNCH' || day.status === 'HALF_DAY' || !day.status)))

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-3xl bg-card p-4 shadow-card sm:p-5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h2 className="mr-auto text-lg font-light tracking-tight">My month</h2>
          {/* a phone: the title and the button on one line, the month under them */}
          <div className="order-last flex w-full justify-center sm:order-none sm:w-auto">
            <MonthPicker year={ym.year} month={ym.month} onChange={(year, month) => setYm({ year, month })} range={month.data ?? range} locked={month.data?.locked} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => setRegularizing({})}>
              <FileClock /> Regularize / on duty
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setAsking({})}>
              <Repeat /> Ask for a shift change
            </Button>
          </div>
        </div>
        <FormError error={month.error} />
        {month.isPending && <MonthSkeleton year={ym.year} month={ym.month} range={range} label="Loading the month" />}
        {month.data && (
          <>
            <MonthTotals totals={month.data.totals} />
            <MonthCalendar
              data={month.data}
              actions={(day) => {
                const change = day.date >= now && day.planned !== 'HOLIDAY'
                const regularize = regularizable(day)
                const compOff = claimable(day)
                if (!change && !regularize && !compOff) return null
                return (
                  <div className="flex flex-wrap gap-2">
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
      </section>

      {!!requests.data?.length && (
        <section className="space-y-2 rounded-3xl bg-card p-4 shadow-card sm:p-5">
          <h2 className="text-lg font-light tracking-tight">My shift-change requests</h2>
          <FormError error={cancel.error} />
          <ul className="divide-y">
            {requests.data.map((r) => (
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
      )}
      {!!regularizations.data?.length && (
        <section className="space-y-2 rounded-3xl bg-card p-4 shadow-card sm:p-5">
          <h2 className="text-lg font-light tracking-tight">My regularization &amp; on-duty requests</h2>
          <FormError error={withdraw.error} />
          <ul className="divide-y">
            {regularizations.data.map((r) => (
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
      )}
      {asking && <ShiftChangeDialog initialDate={asking.date} onClose={() => setAsking(null)} />}
      {claiming && <CompOffDialog day={claiming} onClose={() => setClaiming(null)} />}
      {regularizing && <RegularizationDialog initialDate={regularizing.date} onClose={() => setRegularizing(null)} />}
    </div>
  )
}

// "12 Nov 2026 (first half)" / "12 Nov – 14 Nov 2026"
function requestDays(r: Pick<Regularization, 'fromDate' | 'toDate' | 'portion'>) {
  const half = r.portion === 'FIRST_HALF' ? ' (first half)' : r.portion === 'SECOND_HALF' ? ' (second half)' : ''
  return r.fromDate.getTime() === r.toDate.getTime() ? `${formatDate(r.fromDate)}${half}` : `${formatDate(r.fromDate)} – ${formatDate(r.toDate)}`
}
