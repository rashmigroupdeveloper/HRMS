import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileText } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { FormError } from '@/components/FormError'
import { PayslipListSkeleton } from '@/components/skeletons/pay-career/PayslipListSkeleton'
import { Button } from '@/components/ui/button'
import { client, orpc } from '@/lib/orpc'
import { formatDate, openPdf } from '@/lib/utils'

// the section's heading and note - the skeleton draws the list only (they stay real while it loads)
const PAYSLIPS_TITLE = 'Payslips'
const PAYSLIPS_NOTE = 'Each month’s payslip shows here once HR releases it.'
const MONTH = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })

// "Payslips" of Pay & career in self-service (payroll stage 6): one's own payslips, newest month first - a month just
// released shows "Being made" until the payslip is ready (a few minutes). Opens the PDF as it was made; it shows the full
// bank account number and PAN, so it is never e-mailed - only a link is.
export function MyPayslipsView() {
  const query = useQuery(orpc.payroll.payslips.mine.queryOptions())
  const [error, setError] = useState<string | null>(null)
  const items = query.data ?? []
  return (
    <section className="space-y-3 rounded-2xl bg-card p-3 shadow-card sm:p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-base font-medium">{PAYSLIPS_TITLE}</h2>
        <p className="text-xs text-muted-foreground">{PAYSLIPS_NOTE}</p>
      </div>
      <FormError error={query.error} />
      {query.isPending ? (
        <PayslipListSkeleton label="Loading your payslips" />
      ) : items.length === 0 ? (
        !query.error && <EmptyState className="py-6" title="No payslips yet" hint="A month’s payslip shows here once its pay run is approved and HR releases the payslips." />
      ) : (
        <ul className="divide-y">
          {items.map((p) => {
            const details = `${formatDate(p.payFrom)} – ${formatDate(p.payTo)} · ${p.company.name} · ${p.employeeCode}`
            // one line a row on every screen (the period first; the rest cut short on a phone, whole on hover)
            return (
              <li key={p.personId} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="font-medium">{MONTH.format(p.payMonth)}</p>
                  <p className="truncate text-xs text-muted-foreground tabular-nums" title={details}>{details}</p>
                </div>
                {p.id !== null ? (
                  <Button variant="secondary" size="sm" className="min-h-9 shrink-0 gap-1.5 rounded-full" onClick={() => void openPdf(() => client.payroll.payslips.downloadMine({ id: p.id! }), setError)}>
                    <FileText className="size-4" aria-hidden />Open
                  </Button>
                ) : (
                  <span className="shrink-0 text-xs text-muted-foreground" title="Ready in a few minutes">Being made</span>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {error && <p role="alert" className="text-xs text-negative-ink">{error}</p>}
    </section>
  )
}
