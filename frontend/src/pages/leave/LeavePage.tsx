import { ExportButton } from '@/components/ExportButton'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarPlus } from 'lucide-react'
import { useState } from 'react'
import { EmptyState } from '@/components/EmptyState'
import { FormError } from '@/components/FormError'
import { Pill } from '@/components/Pill'
import { ReasonDialog } from '@/components/ReasonDialog'
import { BalanceTilesSkeleton } from '@/components/skeletons/leave/BalanceTilesSkeleton'
import { LeaveRowsSkeleton } from '@/components/skeletons/leave/LeaveRowsSkeleton'
import { Button } from '@/components/ui/button'
import { client, orpc } from '@/lib/orpc'
import { cn, formatDate, todayDay } from '@/lib/utils'
import { ApplyLeaveDialog } from './components/ApplyLeaveDialog'
import { LeavePages } from './components/LeavePages'
import { BalanceTiles } from './components/BalanceTiles'
import { type Application, daysText, LEAVE_STATUS } from './components/labels'
import { LeaveList } from './components/LeaveList'
import { MyHolidays } from './components/MyHolidays'

// My leave (/leave - everyone, 2026-11-22): the balance of each leave type, applying for leave, one's own holidays (their
// holiday list's - 2026-11-24; an on-application one applied for from here), one's applications (withdraw one still
// waiting; ask to cancel an approved one - that goes for approval too) and the year's balance history (every credit and
// debit). The leave shows on My attendance as well.
export function LeavePage() {
  const queryClient = useQueryClient()
  const balances = useQuery(orpc.leave.balances.get.queryOptions({ input: {} }))
  const mine = useQuery(orpc.leave.applications.mine.queryOptions())
  // comp-off claims for work on a weekly off / holiday (2026-11-22) - claimed from My attendance
  const claims = useQuery(orpc.leave.compOff.mine.queryOptions())
  const withdrawClaim = useMutation(orpc.leave.compOff.cancel.mutationOptions({ onSuccess: refreshLater }))
  const [applying, setApplying] = useState<{ typeId?: number; date?: Date } | null>(null)
  const [cancelling, setCancelling] = useState<Application | null>(null)
  // the balance history grows all year: the latest 5 until asked
  const [allHistory, setAllHistory] = useState(false)
  function refreshLater() {
    void queryClient.invalidateQueries({ queryKey: orpc.leave.key() })
  }
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: orpc.leave.key() })
    void queryClient.invalidateQueries({ queryKey: orpc.attendance.key() })
  }
  const cancel = useMutation(
    orpc.leave.applications.cancel.mutationOptions({
      onSuccess: () => {
        refresh()
        setCancelling(null)
      },
    }),
  )
  const b = balances.data

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Time off</p>
          <h1 className="mt-1 text-3xl font-light tracking-tight sm:text-4xl">My leave</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground max-sm:hidden">Your leave balances, your applications and every credit and debit of the year.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <LeavePages />
          <ExportButton disabled={!b || balances.isFetching || mine.isFetching} load={() => client.leave.applications.exportMine()} title="Export your balances, ledger and latest 100 applications" />
          <Button variant="gold" disabled={!b} onClick={() => setApplying({})}>
            <CalendarPlus /> Apply for leave
          </Button>
        </div>
      </header>

      <section className="space-y-3 rounded-3xl bg-card p-4 shadow-card sm:p-5">
        <h2 className="text-lg font-light tracking-tight">Balances {b?.year ?? todayDay().getUTCFullYear()}</h2>
        <FormError error={balances.error} />
        {balances.isPending && <BalanceTilesSkeleton label="Loading your leave balances" />}
        {b && (b.balances.length ? <BalanceTiles balances={b.balances} year={b.year} onPick={(typeId) => setApplying({ typeId })} /> : <EmptyState title="No leave types apply to you yet" />)}
      </section>

      <MyHolidays balances={b?.balances} applications={mine.data} onApply={(typeId, date) => setApplying({ typeId, date })} />

      <section className="space-y-2 rounded-3xl bg-card p-4 shadow-card sm:p-5">
        <h2 className="text-lg font-light tracking-tight">My applications</h2>
        <FormError error={mine.error ?? cancel.error} />
        {mine.isPending && <LeaveRowsSkeleton label="Loading your applications" />}
        {mine.data &&
          (mine.data.length ? (
            <LeaveList
              rows={mine.data}
              actions={(a) =>
                a.status === 'PENDING' ? (
                  <Button variant="ghost" size="sm" disabled={cancel.isPending} onClick={() => cancel.mutate({ id: a.id })}>
                    Withdraw
                  </Button>
                ) : a.status === 'APPROVED' && a.cancelRequest?.status !== 'PENDING' ? (
                  <Button variant="ghost" size="sm" onClick={() => setCancelling(a)}>
                    Cancel
                  </Button>
                ) : null
              }
            />
          ) : (
            <p className="py-2 text-sm text-muted-foreground">You have not applied for leave yet.</p>
          ))}
      </section>

      {!!claims.data?.length && (
        <section className="space-y-2 rounded-3xl bg-card p-4 shadow-card sm:p-5">
          <h2 className="text-lg font-light tracking-tight">Comp-off claims</h2>
          <FormError error={withdrawClaim.error} />
          <ul className="divide-y">
            {claims.data.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2 text-sm">
                <div className="min-w-0 flex-1 basis-60">
                  <p>
                    <span className="font-medium">{formatDate(c.workDate)}</span> <span className="text-xs text-muted-foreground">{daysText(c.days)}</span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {c.reason}
                    {c.expiresOn && ` · use by ${formatDate(c.expiresOn)}`}
                    {c.status === 'PENDING' && c.approval?.step && ` · with ${c.approval.step.approver?.name ?? c.approval.step.who}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Pill tone={LEAVE_STATUS[c.status].tone}>{LEAVE_STATUS[c.status].label}</Pill>
                  {c.status === 'PENDING' && (
                    <Button variant="ghost" size="sm" disabled={withdrawClaim.isPending} onClick={() => withdrawClaim.mutate({ id: c.id })}>
                      Withdraw
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2 rounded-3xl bg-card p-4 shadow-card sm:p-5">
        <h2 className="text-lg font-light tracking-tight">Balance history</h2>
        {balances.isPending && <LeaveRowsSkeleton rows={4} label="Loading the balance history" />}
        {b &&
          (b.entries.length ? (
            <ul className="divide-y">
              {(allHistory ? b.entries : b.entries.slice(0, 5)).map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p>
                      <span className="font-semibold">{e.leaveType.code}</span> {e.what}
                      {e.leave && <span className="text-muted-foreground"> · {formatDate(e.leave.fromDate)}</span>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatDate(e.date)}
                      {e.note && ` · ${e.note}`}
                      {e.expiresOn && ` · use by ${formatDate(e.expiresOn)}`}
                      {e.by && ` · ${e.by.name}`}
                    </p>
                  </div>
                  <span className={cn('shrink-0 font-medium tabular-nums', e.days > 0 ? 'text-positive-ink' : 'text-negative-ink')}>
                    {e.days > 0 ? '+' : ''}
                    {e.days}
                  </span>
                </li>
              ))}
              {!allHistory && b.entries.length > 5 && (
                <li className="pt-2">
                  <Button variant="ghost" size="sm" onClick={() => setAllHistory(true)}>
                    Show all ({b.entries.length})
                  </Button>
                </li>
              )}
            </ul>
          ) : (
            <p className="py-2 text-sm text-muted-foreground">No credits or debits this year yet - leave is credited on the 1st of each month.</p>
          ))}
      </section>

      {applying && b && <ApplyLeaveDialog balances={b.balances} initialTypeId={applying.typeId} initialDate={applying.date} onClose={() => setApplying(null)} />}
      {cancelling && (
        <ReasonDialog
          title="Cancel this leave?"
          description="It was approved - cancelling it goes to your manager for approval; the days come back once approved."
          label="Why"
          confirm="Ask to cancel"
          required
          pending={cancel.isPending}
          error={cancel.error?.message}
          onConfirm={(reason) => cancel.mutate({ id: cancelling.id, reason })}
          onClose={() => setCancelling(null)}
        />
      )}
    </div>
  )
}
