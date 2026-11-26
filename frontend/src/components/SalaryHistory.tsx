import { useQuery } from '@tanstack/react-query'
import { TrendingUp } from 'lucide-react'
import { useState } from 'react'
import { Pill } from '@/components/Pill'
import { SALARY_REASON } from '@/lib/choices'
import { orpc } from '@/lib/orpc'
import { cn, errorMessage, formatDate, formatMoney } from '@/lib/utils'
import { InfoCard } from './ProfileCards'

// The salary history on the profile's Salary tab (the user, 2026-11-20): every salary from its day, latest first - why it
// changed (the joining, an increment, a promotion, a correction...), the fixed CTC and its change from the one before, who
// approved it; open one for its monthly breakup. Seen by the employee themselves and Employee · Salary: View.

export function SalaryHistory({ employeeCode }: { employeeCode: string }) {
  const history = useQuery(orpc.employees.salaryHistory.queryOptions({ input: { employeeCode } }))
  const [open, setOpen] = useState<number | null>(null)
  const rows = history.data ?? []
  if (history.isSuccess && rows.length < 2) return null

  return (
    <InfoCard icon={TrendingUp} title="Salary history">
      {history.error && <p className="text-sm text-negative-ink">{errorMessage(history.error)}</p>}
      <ul className="divide-y divide-dashed divide-border/80">
        {rows.map((row) => (
          <li key={row.id} className="py-2 text-sm">
            <button type="button" className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 text-left" onClick={() => setOpen(open === row.id ? null : row.id)}>
              <span className="w-24 text-xs text-muted-foreground tabular-nums">{formatDate(row.effectiveFrom)}</span>
              <span className="font-medium tabular-nums">{formatMoney(row.annualCtc, row.currency)}</span>
              {row.changePercent !== null && <Pill tone={row.changePercent >= 0 ? 'positive' : 'negative'}>{`${row.changePercent > 0 ? '+' : ''}${row.changePercent}%`}</Pill>}
              <span className="text-xs text-muted-foreground">{SALARY_REASON[row.reason]}</span>
              {row.inForce && <Pill tone="gold">In force</Pill>}
              {row.upcoming && <Pill tone="info">From a later day</Pill>}
              {row.approvedBy && <span className="ml-auto text-xs text-muted-foreground">approved by {row.approvedBy.name}</span>}
            </button>
            <table className={cn('mt-2 w-full text-xs', open !== row.id && 'hidden')}>
              <tbody>
                {row.lines.map((line) => (
                  <tr key={line.salaryComponent.id} className="border-t border-dashed">
                    <td className="py-1">{line.salaryComponent.name}</td>
                    <td className="py-1 text-right tabular-nums">{formatMoney(line.monthlyAmount, row.currency)} / month</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </li>
        ))}
      </ul>
    </InfoCard>
  )
}
