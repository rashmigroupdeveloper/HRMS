import { useQuery } from '@tanstack/react-query'
import { EmptyState } from '@/components/EmptyState'
import { FormError } from '@/components/FormError'
import { Pill } from '@/components/Pill'
import { DepositStatusSkeleton } from '@/components/skeletons/pay-career/DepositStatusSkeleton'
import { orpc } from '@/lib/orpc'
import { formatDate, formatMoney } from '@/lib/utils'
import { GAP_REASON, SCHEME } from '@/pages/payroll/components/deposits-labels'

// the section's heading and note - the skeleton draws the list only (they stay real while it loads)
const DEPOSITS_TITLE = 'Statutory deposits'
const DEPOSITS_NOTE = 'Whether what was deducted from your pay reached PF, ESIC, professional tax and LWF - each month once its payslip is released.'
const MONTH = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })

// "Statutory deposits" of Pay & career in self-service (payroll stage 6 slice 3): one's own deductions of each approved
// month whose payslips are released, scheme by scheme - "deposited" with the day only when the month's deposit is complete
// and one is not left out of the return; otherwise pending (with why, when left out). The deduction is the company's to
// deposit - the employee is never responsible for it (Code on Wages s.18(5)).
export function MyDepositsView() {
  const query = useQuery(orpc.payroll.deposits.mine.queryOptions())
  const items = query.data ?? []
  return (
    <section className="space-y-3 rounded-2xl bg-card p-3 shadow-card sm:p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-base font-medium">{DEPOSITS_TITLE}</h2>
        <p className="text-xs text-muted-foreground">{DEPOSITS_NOTE}</p>
      </div>
      <FormError error={query.error} />
      {query.isPending ? (
        <DepositStatusSkeleton label="Loading your deposits" />
      ) : items.length === 0 ? (
        !query.error && <EmptyState className="py-6" title="Nothing yet" hint="A month shows here once its payslip is released and something was deducted for PF, ESIC, professional tax or LWF." />
      ) : (
        <ul className="divide-y">
          {items.map((m) => (
            <li key={`${m.company.code}-${m.payMonth.getTime()}`} className="space-y-1.5 py-2.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="font-medium">{MONTH.format(m.payMonth)}</p>
                <p className="truncate text-xs text-muted-foreground">{m.company.name} · {m.employeeCode}</p>
              </div>
              <ul className="flex flex-wrap gap-1.5">
                {m.schemes.map((s) => (
                  <li key={s.scheme} className="max-w-full">
                    <Pill tone={s.deposited ? 'positive' : s.leftOut ? 'warning' : 'neutral'} className="max-w-full truncate py-0.5">
                      {SCHEME[s.scheme]} {formatMoney(s.amount, 'INR')} ·{' '}
                      {s.deposited ? `deposited ${formatDate(s.depositedOn)}` : s.leftOut ? `pending - ${GAP_REASON[s.leftOut].toLowerCase()}` : `pending${s.dueOn ? `, due ${formatDate(s.dueOn)}` : ''}`}
                    </Pill>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
