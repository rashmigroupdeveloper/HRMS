import { useQuery } from '@tanstack/react-query'
import { orpc } from '@/lib/orpc'
import { todayDay } from '@/lib/utils'
import type { Overview } from '@/pages/attendance/components/labels'

// The latest pay month's runs (2026-11-27 - the "Payroll runs" card and the role home's attention order read the same
// queries) and whether the pay month that ended last has no run yet (`dueMissing` - only when runs are visible at all:
// a viewer with part of a company sees none, which says nothing about the month). `enabled`: Payroll View.
export function usePayrollRuns(overview: Overview | undefined, enabled = true) {
  const year = todayDay().getUTCFullYear()
  const runs = useQuery({ ...orpc.payroll.list.queryOptions({ input: { year, pageSize: 50 } }), enabled })
  // early in a year the latest runs are last year's
  const lookBack = !!runs.data && runs.data.items.length === 0
  const lastYear = useQuery({ ...orpc.payroll.list.queryOptions({ input: { year: year - 1, pageSize: 50 } }), enabled: enabled && lookBack })
  const items = lookBack ? (lastYear.data?.items ?? []) : (runs.data?.items ?? [])
  const pending = runs.isPending || (lookBack && lastYear.isPending)
  const latest = items[0]?.payMonth
  const ofLatest = latest ? items.filter((r) => r.payMonth.getTime() === latest.getTime()) : []
  // the attendance month that ended last (the one before today's) - the month to pay next
  const c = overview?.currentMonth
  const due = c && new Date(Date.UTC(c.month === 1 ? c.year - 1 : c.year, (c.month === 1 ? 12 : c.month - 1) - 1, 1))
  const dueMissing = !pending && !!due && !!latest && latest.getTime() < due.getTime()
  return { pending, latest, ofLatest, due, dueMissing, error: runs.error ?? lastYear.error }
}
