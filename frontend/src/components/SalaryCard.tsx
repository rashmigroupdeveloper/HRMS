import { Wallet } from 'lucide-react'
import type { client } from '@/lib/orpc'
import { cn, formatDate, formatMoney } from '@/lib/utils'
import { Chip, InfoCard } from './ProfileCards'

type EmployeeProfile = Awaited<ReturnType<typeof client.employees.getByCode>>

// The salary in effect: the CTC figures as tiles, then the monthly breakup (earnings, then employer contributions) -
// shared by the profile and the Pay & career page (2026-11-21). `tiles={false}`: the breakup only, its day in the card's
// header (the Pay & career page shows the CTC in its own header)
export function SalaryCard({ s, tiles: showTiles = true }: { s: NonNullable<EmployeeProfile['salary']>; tiles?: boolean }) {
  const money = (amount: number) => formatMoney(amount, s.currency)
  const earnings = s.lines.filter((l) => l.salaryComponent.kind === 'EARNING')
  const employer = s.lines.filter((l) => l.salaryComponent.kind === 'EMPLOYER_CONTRIBUTION')
  const gross = earnings.reduce((sum, l) => sum + l.monthlyAmount, 0)
  const total = s.lines.reduce((sum, l) => sum + l.monthlyAmount, 0)
  const tiles: [string, string, boolean?][] = [
    ['Fixed CTC / year', money(s.annualCtc)],
    ['Performance pay / year', s.performancePayAnnual ? money(s.performancePayAnnual) : '—'],
    ['Total CTC / year', money(s.annualCtc + (s.performancePayAnnual ?? 0)), true],
    ['Effective from', formatDate(s.effectiveFrom)],
  ]
  const group = (title: string, lines: typeof s.lines) =>
    lines.length > 0 && (
      <>
        <tr>
          <td colSpan={3} className="pt-3 pb-1 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            {title}
          </td>
        </tr>
        {lines.map((l) => (
          <tr key={l.salaryComponent.id} className="border-b border-dashed border-border/80">
            <td className="py-1.5">{l.salaryComponent.name}</td>
            <td className="py-1.5 text-right">{money(l.monthlyAmount)}</td>
            <td className="py-1.5 text-right text-muted-foreground">{money(l.monthlyAmount * 12)}</td>
          </tr>
        ))}
      </>
    )
  return (
    <div className="space-y-4">
      {showTiles && (
      <section className="grid grid-cols-2 gap-2 rounded-3xl bg-card p-3 shadow-card lg:grid-cols-4">
        {tiles.map(([label, value, strong]) => (
          <div key={label} className={cn('rounded-2xl px-3.5 py-3', strong ? 'bg-gold/25' : 'bg-surface-2/70')}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={cn('mt-0.5 text-lg tracking-tight tabular-nums', strong ? 'font-semibold' : 'font-medium', value === '—' && 'text-muted-foreground')}>{value}</p>
          </div>
        ))}
      </section>
      )}
      {s.lines.length > 0 && (
        <InfoCard icon={Wallet} title="Monthly breakup" aside={<Chip>{showTiles ? `${s.lines.length} components` : `From ${formatDate(s.effectiveFrom)}`}</Chip>}>
          <table className="w-full text-sm tabular-nums [&_td+td]:pl-3">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="py-1 text-left font-medium">Component</th>
                <th className="py-1 text-right font-medium">Monthly</th>
                <th className="py-1 text-right font-medium">Annual</th>
              </tr>
            </thead>
            <tbody>
              {group('Earnings', earnings)}
              {earnings.length > 0 && (
                <tr className="text-muted-foreground">
                  <td className="py-1.5">Monthly gross</td>
                  <td className="py-1.5 text-right">{money(gross)}</td>
                  <td className="py-1.5 text-right">{money(gross * 12)}</td>
                </tr>
              )}
              {group('Employer contributions', employer)}
              <tr className="font-semibold">
                <td className="pt-3">Total (fixed CTC)</td>
                <td className="pt-3 text-right">{money(total)}</td>
                <td className="pt-3 text-right">{money(total * 12)}</td>
              </tr>
            </tbody>
          </table>
        </InfoCard>
      )}
    </div>
  )
}
