import { Check, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn, formatMoney } from '@/lib/utils'
import { type BreakupValues, breakupLines } from '@/lib/form-values'
import type { client } from '@/lib/orpc'

// The salary breakup of an offer (offer letter Annexure-I) or a salary revision (2026-11-20): HR types the monthly amount
// of each salary component;
// the annual amounts, the Monthly Gross and the total are worked out here. The total x 12 must equal the annual CTC
// (the backend checks it too).

type SalaryComponent = Awaited<ReturnType<typeof client.organization.salaryComponents.list>>[number]
type Line = { id: number; name: string; kind: SalaryComponent['kind'] }

const amount = (value: string | undefined) => (value && /^\d+$/.test(value) ? Number(value) : 0)

export function SalaryBreakupFields({
  components,
  values,
  onChange,
  annualCtc,
  currency,
  onUseTotal,
  disabled,
}: {
  // active components + any retired one this offer already uses
  components: Line[]
  values: BreakupValues
  onChange: (values: BreakupValues) => void
  annualCtc: number
  currency: string
  // sets the annual CTC to the breakup total
  onUseTotal: (annual: number) => void
  disabled?: boolean
}) {
  const earnings = components.filter((c) => c.kind === 'EARNING')
  const employer = components.filter((c) => c.kind === 'EMPLOYER_CONTRIBUTION')
  const sum = (lines: Line[]) => lines.reduce((total, c) => total + amount(values[c.id]), 0)
  const gross = sum(earnings)
  const total = gross + sum(employer)
  const used = breakupLines(values).length > 0
  const matches = total * 12 === annualCtc
  const money = (n: number) => formatMoney(n, currency || 'INR')

  const row = (c: Line) => (
    <div key={c.id} className="grid grid-cols-[minmax(0,1fr)_7rem] sm:grid-cols-[1fr_8rem_8rem] items-center gap-x-3 py-1">
      <label htmlFor={`line-${c.id}`} className="text-sm">
        {c.name}
      </label>
      <Input
        id={`line-${c.id}`}
        inputMode="numeric"
        className="h-8 rounded-xl text-right tabular-nums"
        placeholder="—"
        value={values[c.id] ?? ''}
        disabled={disabled}
        onChange={(e) => onChange({ ...values, [c.id]: e.target.value.replace(/\D/g, '').slice(0, 9) })}
      />
      {/* the annual amount: its own column from sm, under the input on a phone */}
      <span className="col-start-2 pr-3 text-right text-xs text-muted-foreground tabular-nums sm:col-start-auto sm:pr-0 sm:text-sm">
        {values[c.id] ? <><span className="sm:hidden">a year </span>{money(amount(values[c.id]) * 12)}</> : <span className="max-sm:hidden">—</span>}
      </span>
    </div>
  )
  const subtotal = (label: string, monthly: number, strong = false) => (
    <div className={cn('grid grid-cols-[minmax(0,1fr)_7rem] sm:grid-cols-[1fr_8rem_8rem] items-center gap-x-3 py-2 text-sm', strong ? 'border-t font-semibold' : 'my-1 -mx-2 rounded-lg bg-surface-2 px-2 font-medium')}>
      <span>{label}</span>
      <span className="pr-3 text-right tabular-nums">{money(monthly)}</span>
      <span className="col-start-2 pr-3 text-right text-xs font-normal text-muted-foreground tabular-nums sm:col-start-auto sm:pr-0 sm:text-sm sm:text-foreground">
        <span className="sm:hidden">a year </span>
        {money(monthly * 12)}
      </span>
    </div>
  )

  return (
    <div className="rounded-2xl border bg-surface-2/40 p-3 sm:p-4">
      <div className="grid grid-cols-[minmax(0,1fr)_7rem] sm:grid-cols-[1fr_8rem_8rem] gap-x-3 pb-1 text-xs font-medium text-muted-foreground">
        <span>Component</span>
        <span className="pr-3 text-right">Monthly</span>
        <span className="hidden text-right sm:block">Annual</span>
      </div>
      {earnings.map(row)}
      {subtotal('Monthly gross', gross)}
      {employer.map(row)}
      {subtotal('Total (fixed CTC)', total, true)}
      {used && (
        <div
          role="status"
          className={cn(
            'mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm',
            matches ? 'bg-positive/10 text-positive-ink' : 'bg-gold-soft text-foreground',
          )}
        >
          <span className="flex items-center gap-2">
            {matches ? <Check className="size-4" /> : <TriangleAlert className="size-4" />}
            {matches
              ? 'Matches the annual CTC.'
              : `${money(total * 12)} a year - the annual CTC is ${annualCtc ? money(annualCtc) : 'not set'} (difference ${money(Math.abs(total * 12 - annualCtc))}).`}
          </span>
          {!matches && !disabled && total > 0 && (
            <Button type="button" size="sm" variant="secondary" onClick={() => onUseTotal(total * 12)}>
              Use {money(total * 12)} as annual CTC
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
