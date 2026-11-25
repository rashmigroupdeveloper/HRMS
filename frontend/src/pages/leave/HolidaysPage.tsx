import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { orpc } from '@/lib/orpc'
import { ApplyLeaveDialog } from './components/ApplyLeaveDialog'
import { LeavePages } from './components/LeavePages'
import { MyHolidays } from './components/MyHolidays'

// Holidays (/holidays - every employee, the user 2026-11-25: a tab of its own beside My leave): the holidays of their own
// holiday list for this year / next - the days off, and the on-application ones (restricted / election) with the balance left
// and Apply.
export function HolidaysPage() {
  const balances = useQuery(orpc.leave.balances.get.queryOptions({ input: {} }))
  const mine = useQuery(orpc.leave.applications.mine.queryOptions())
  const [applying, setApplying] = useState<{ typeId: number; date: Date } | null>(null)
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Time off</p>
          <h1 className="mt-1 text-3xl font-light tracking-tight sm:text-4xl">Holidays</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground max-sm:hidden">The holidays of your holiday list - and the optional ones you may apply for.</p>
        </div>
        <LeavePages />
      </header>
      <MyHolidays balances={balances.data?.balances} applications={mine.data} onApply={(typeId, date) => setApplying({ typeId, date })} />
      {applying && balances.data && <ApplyLeaveDialog balances={balances.data.balances} initialTypeId={applying.typeId} initialDate={applying.date} onClose={() => setApplying(null)} />}
    </div>
  )
}
