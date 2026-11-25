import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { History } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { ChangeHistoryList } from '@/components/ChangeHistoryList'
import { ChangeHistorySkeleton } from '@/components/skeletons/common/ChangeHistorySkeleton'
import { Button } from '@/components/ui/button'
import { useAccess } from '@/hooks/useAccess'
import { orpc } from '@/lib/orpc'
import { errorMessage } from '@/lib/utils'
import { CardTitle } from '@/components/ProfileCards'

// One employee's change history on the profile's Record tab (HR's view - Employees: View): every change to their
// records and their sign-ins, newest first.
export function EmployeeHistory({ employeeCode }: { employeeCode: string }) {
  const { can } = useAccess()
  const [shown, setShown] = useState(20)
  const history = useQuery({
    ...orpc.changeHistory.list.queryOptions({ input: { employeeCode, pageSize: shown } }),
    placeholderData: keepPreviousData,
  })
  return (
    <section className="rounded-3xl bg-card p-4 shadow-card sm:p-5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <CardTitle icon={History}>Change history</CardTitle>
        {can('CHANGE_HISTORY') && (
          <Link to={`/manage/change-history?employee=${employeeCode}`} className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            Open in Change history
          </Link>
        )}
      </div>
      {history.isPending ? (
        <ChangeHistorySkeleton days={[8]} label="Loading the change history" />
      ) : history.error ? (
        <p className="text-sm text-negative-ink">{errorMessage(history.error)}</p>
      ) : (
        <>
          <ChangeHistoryList items={history.data.items} hideEmployee />
          {history.data.total > history.data.items.length && (
            <Button variant="secondary" size="sm" className="mt-2" disabled={history.isFetching} onClick={() => setShown((n) => Math.min(n + 40, 100))}>
              {shown >= 100 ? 'Open in Change history for older entries' : `Show older (${history.data.total - history.data.items.length} more)`}
            </Button>
          )}
        </>
      )}
    </section>
  )
}
