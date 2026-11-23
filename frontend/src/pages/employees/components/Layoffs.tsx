import { useQuery } from '@tanstack/react-query'
import { CalendarOff } from 'lucide-react'
import { Pill } from '@/components/Pill'
import { orpc } from '@/lib/orpc'
import { errorMessage, formatDate } from '@/lib/utils'
import { InfoCard } from '@/components/ProfileCards'

// The profile's lay offs (the user, 2026-11-19): each from a day until the day the employee is back at work. Shown on the
// Job tab to the employee and to HR - only when there is one (the user, 2026-11-21: the profile only shows the record;
// lay offs are recorded on a page of their own, with resignations - BACKLOG 26).
export function Layoffs({ employeeCode }: { employeeCode: string }) {
  const layoffs = useQuery(orpc.employees.layoffs.list.queryOptions({ input: { employeeCode } }))
  const rows = layoffs.data ?? []
  if (!rows.length && !layoffs.error) return null

  return (
    <InfoCard icon={CalendarOff} title="Lay offs">
      {layoffs.error && <p className="text-sm text-negative-ink">{errorMessage(layoffs.error)}</p>}
      <ul className="divide-y divide-dashed divide-border/80">
        {rows.map((l) => (
          <li key={l.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 text-sm">
            <span className="font-medium tabular-nums">
              {formatDate(l.startDate)} → {l.rejoinDate ? formatDate(l.rejoinDate) : ''}
            </span>
            {!l.rejoinDate && <Pill tone="warning">Still laid off</Pill>}
            <span className="min-w-0 flex-1 text-muted-foreground">{l.reason}</span>
            {l.addedBy && <span className="text-xs text-muted-foreground">by {l.addedBy.name}</span>}
          </li>
        ))}
      </ul>
    </InfoCard>
  )
}
