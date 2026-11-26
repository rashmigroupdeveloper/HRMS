import { Check, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Input } from '@/components/ui/input'
import { cn, formatMoney, monthlyOf, sumMoney, toPaise } from '@/lib/utils'
import { AMOUNT_PATTERN, type BreakupValues, breakupLines } from '@/lib/form-values'
import type { client } from '@/lib/orpc'

// The salary breakup of an offer (offer letter Annexure-I) or a salary revision (2026-11-20): HR types the monthly amount
// of each salary component, to the paisa;
// the annual amounts, the Monthly Gross and the total are worked out here. The total must equal the annual CTC / 12 to the
// paisa (2026-11-24 - the backend checks it too).

type SalaryComponent = Awaited<ReturnType<typeof client.organization.salaryComponents.list>>[number]
type Line = { id: number; name: string; kind: SalaryComponent['kind']; enteredMonthly?: boolean }

const amount = (value: string | undefined) => (value && AMOUNT_PATTERN.test(value) ? Number(value) : 0)
// what a box keeps of what is typed: digits and one decimal point with at most 2 decimals
const typedAmount = (text: string) => {
  const [whole = '', ...rest] = text.replace(/[^\d.]/g, '').split('.')
  return rest.length ? `${whole.slice(0, 9)}.${rest.join('').slice(0, 2)}` : whole.slice(0, 9)
}

export function SalaryBreakupFields({
  components,
  values,
  onChange,
  annualCtc,
  currency,
  onUseTotal,
  disabled,
  hideEmpty = false,
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
  // a breakup worked out by a salary structure (2026-11-24): only the lines with an amount show; the others can be added
  // by hand from "Add a component"
  hideEmpty?: boolean
}) {
  // a line with an entry shows - even one HR emptied to type again, or just added; the ones the calculation left out do not
  const shown = (c: Line) => !hideEmpty || values[c.id] !== undefined
  const hidden = components.filter((c) => c.kind !== 'DEDUCTION' && !c.enteredMonthly && !shown(c))
  // an earning entered each month in payroll (Incentive) is never a breakup line (payroll stage 2)
  const earnings = components.filter((c) => c.kind === 'EARNING' && !c.enteredMonthly && shown(c))
  const employer = components.filter((c) => c.kind === 'EMPLOYER_CONTRIBUTION' && shown(c))
  const sum = (lines: Line[]) => sumMoney(lines.map((c) => amount(values[c.id])))
  const gross = sum(earnings)
  const total = sumMoney([gross, sum(employer)])
  const used = breakupLines(values).length > 0
  const expected = monthlyOf(annualCtc)
  const matches = toPaise(total) === toPaise(expected)
  // the whole-rupee annual CTC this total stands for, when there is one (12 x 48,666.67 = 5,84,000.04 -> 5,84,000)
  const annualOfTotal = Math.round(total * 12)
  const canUseTotal = toPaise(monthlyOf(annualOfTotal)) === toPaise(total)
  const money = (n: number) => formatMoney(n, currency || 'INR')

  const row = (c: Line) => (
    <div key={c.id} className="grid grid-cols-[minmax(0,1fr)_7rem] sm:grid-cols-[1fr_8rem_8rem] items-center gap-x-3 py-1">
      <label htmlFor={`line-${c.id}`} className="text-sm">
        {c.name}
      </label>
      <Input
        id={`line-${c.id}`}
        inputMode="decimal"
        className="h-8 rounded-xl text-right tabular-nums"
        placeholder="—"
        value={values[c.id] ?? ''}
        disabled={disabled}
        onChange={(e) => onChange({ ...values, [c.id]: typedAmount(e.target.value) })}
      />
      {/* the annual amount: its own column from sm, under the input on a phone */}
      <span className="col-start-2 pr-3 text-right text-xs text-muted-foreground tabular-nums sm:col-start-auto sm:pr-0 sm:text-sm">
        {values[c.id] ? <><span className="sm:hidden">a year </span>{money(sumMoney([amount(values[c.id]) * 12]))}</> : <span className="max-sm:hidden">—</span>}
      </span>
    </div>
  )
  const subtotal = (label: string, monthly: number, strong = false, annual = sumMoney([monthly * 12])) => (
    <div className={cn('grid grid-cols-[minmax(0,1fr)_7rem] sm:grid-cols-[1fr_8rem_8rem] items-center gap-x-3 py-2 text-sm', strong ? 'border-t font-semibold' : 'my-1 -mx-2 rounded-lg bg-surface-2 px-2 font-medium')}>
      <span>{label}</span>
      <span className="pr-3 text-right tabular-nums">{money(monthly)}</span>
      <span className="col-start-2 pr-3 text-right text-xs font-normal text-muted-foreground tabular-nums sm:col-start-auto sm:pr-0 sm:text-sm sm:text-foreground">
        <span className="sm:hidden">a year </span>
        {money(annual)}
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
      {subtotal('Total (fixed CTC)', total, true, matches ? annualCtc : sumMoney([total * 12]))}
      {hideEmpty && hidden.length > 0 && !disabled && (
        <NativeSelect
          aria-label="Add a component"
          className="mt-2 w-full sm:w-64 [&_select]:h-9 [&_select]:rounded-full"
          value=""
          onChange={(e) => e.target.value && onChange({ ...values, [Number(e.target.value)]: '' })}
        >
          <NativeSelectOption value="">+ Add a component…</NativeSelectOption>
          {hidden.map((c) => (
            <NativeSelectOption key={c.id} value={String(c.id)}>
              {c.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      )}
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
              : annualCtc
                ? `${money(total)} a month - the annual CTC ${money(annualCtc)} is ${money(expected)} a month (difference ${money(Math.abs(sumMoney([total, -expected])))}).`
                : `${money(total)} a month - the annual CTC is not set.`}
          </span>
          {!matches && !disabled && total > 0 && canUseTotal && (
            <Button type="button" size="sm" variant="secondary" onClick={() => onUseTotal(annualOfTotal)}>
              Use {money(annualOfTotal)} as annual CTC
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
