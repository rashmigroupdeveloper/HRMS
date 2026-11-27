import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileText, Plus } from 'lucide-react'
import { FormDialog, DialogCancel } from '@/components/FormDialog'
import { FormError } from '@/components/FormError'
import { PersonDetailsSkeleton } from '@/components/skeletons/payroll/PersonDetailsSkeleton'
import { Button } from '@/components/ui/button'
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { EMPLOYMENT_TYPE, SALARY_REASON, WORKFORCE } from '@/lib/choices'
import { client, orpc } from '@/lib/orpc'
import { cn, formatDate, formatMoney, openPdf } from '@/lib/utils'
import { InputDrawer } from './InputDrawer'
import { AGAIN_NOTE, ALL_ABSENT_NOTE, DAYS_LEGEND, DAYS_NOT_WORKED_OUT, DAY_TOTAL_LABELS, DEDUCTIONS_TITLE, EMPLOYER_TITLE, HOLD_REASON, PAY_TITLE, SALARY_HIDDEN_NOTE, STATUS_CODE, dayCount } from './payroll-labels'

type Status = keyof typeof STATUS_CODE
type PayClass = 'PAID' | 'UNPAID' | 'UNCLEAR'
type Day = { date: Date; firstHalf: PayClass; secondHalf: PayClass; firstStatus: Status | null; secondStatus: Status | null; firstLeaveCode: string | null; secondLeaveCode: string | null }

// what attendance said of a half: its code, a leave half by its type ("CL"), nothing known as "?"
const codeOf = (status: Status | null, leaveCode: string | null) => (status === null ? '?' : status === 'LEAVE' ? (leaveCode ?? '?') : STATUS_CODE[status])
const CLASS_WORD = { PAID: 'paid', UNPAID: 'unpaid', UNCLEAR: 'to check' } as const

// One person's days in a stretch, as the run took them from attendance: the day of the month over its code; red when a
// half is unpaid, amber when a half is not known
export function DayStrip({ days }: { days: Day[] }) {
  return (
    <ul aria-label="Days" className="flex flex-wrap gap-1">
      {days.map((day) => {
        const first = codeOf(day.firstStatus, day.firstLeaveCode)
        const second = codeOf(day.secondStatus, day.secondLeaveCode)
        const classes = [day.firstHalf, day.secondHalf]
        return (
          <li
            key={day.date.getTime()}
            title={`${formatDate(day.date)}: first half ${CLASS_WORD[day.firstHalf]}, second half ${CLASS_WORD[day.secondHalf]}`}
            className={cn(
              'flex h-10 min-w-10 flex-col items-center justify-center rounded-lg px-1 text-[11px] leading-tight tabular-nums',
              classes.includes('UNCLEAR') ? 'bg-warning/15 text-warning-ink' : classes.includes('UNPAID') ? 'bg-destructive/10 text-negative-ink' : 'bg-surface-2/50',
            )}
          >
            <span className="text-[10px] opacity-70">{day.date.getUTCDate()}</span>
            <span className="font-medium">{first === second ? first : `${first}/${second}`}</span>
          </li>
        )
      })}
    </ul>
  )
}

type PayLine = { component: { id: number; name: string; kind: string; cutForUnpaidDays: boolean }; amount: number; base: number | null; fromInput: boolean }

// A group of a person's pay lines - each with what it was worked out on ("on 15,000": the PF / ESI wages, the gross) -
// and their total
function PayLines({ title, lines, note, total, muted = false }: { title: string; lines: PayLine[]; note: (line: PayLine) => string | null; total: [string, number | null]; muted?: boolean }) {
  return (
    <div className={cn('rounded-xl bg-surface-2/40 p-2 text-xs', muted && 'text-muted-foreground')}>
      <p className="mb-1 text-muted-foreground">{title}</p>
      {lines.length ? (
        <table className="w-full tabular-nums">
          <tbody>
            {lines.map((l) => {
              const hint = note(l)
              return (
                <tr key={l.component.id}>
                  <td className="py-0.5">
                    {l.component.name}
                    {hint && <span className="text-[11px] text-muted-foreground"> ({hint})</span>}
                    {l.base !== null && <span className="text-[11px] text-muted-foreground"> on {formatMoney(l.base, 'INR')}</span>}
                  </td>
                  <td className="py-0.5 text-right">{formatMoney(l.amount, 'INR')}</td>
                </tr>
              )
            })}
            <tr className="border-t font-medium"><td className="py-1">{total[0]}</td><td className="py-1 text-right">{formatMoney(total[1] ?? 0, 'INR')}</td></tr>
          </tbody>
        </table>
      ) : <p className="py-0.5">None</p>}
    </div>
  )
}

// One person of a run: their paid and unpaid days as taken from the locked attendance, what they earned, what is
// deducted and their net pay (stages 3-4), and each stretch of days with its placement and the salary copied for it (read
// only - the salary changes through job changes, the days in attendance; the copy follows on the next refresh / working
// out)
export function PersonDetails({ runId, personId, canChange, close }: { runId: number; personId: number; canChange: boolean; close: () => void }) {
  const query = useQuery(orpc.payroll.people.get.queryOptions({ input: { runId, personId } }))
  // the run (already loaded by the page): whether its payslips are released, and the templates to preview one with
  const payslips = useQuery(orpc.payroll.get.queryOptions({ input: { id: runId } })).data?.payslips ?? null
  const [adding, setAdding] = useState(false)
  const [templateId, setTemplateId] = useState<number | null>(null)
  const [payslipError, setPayslipError] = useState<string | null>(null)
  const p = query.data
  // stage 6: a final run's payslip - as made (released), or a preview with a payslip template (before the release); only
  // with the salaries in view and the pay worked out
  const withPay = !!p && !p.salaryHidden && p.pay?.status === 'WORKED_OUT'
  const previewWith = templateId ?? payslips?.templates[0]?.id ?? null
  const totals = p?.dayTotals ? [p.dayTotals.paidDays, p.dayTotals.unpaidDays, p.dayTotals.unclearDays] : null
  return (
    <>
      <FormDialog onOpenChange={close} className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{p ? `${p.name || p.employeeCode} · ${p.employeeCode}` : 'Person in the run'}</DialogTitle>
          <DialogDescription>Their days as taken from attendance, their pay worked out from them, and the salary and placement copied for each stretch of days in the pay period.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-3 overflow-y-auto">
          {query.isPending ? <PersonDetailsSkeleton /> : p ? (
            <>
              {totals ? (
                <dl className="grid grid-cols-3 gap-2 text-xs">
                  {DAY_TOTAL_LABELS.map((label, i) => (
                    <div key={label} className="rounded-xl bg-surface-2/40 px-3 py-1.5">
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className={cn('text-sm font-medium tabular-nums', i === 1 && totals[i]! > 0 && 'text-negative-ink', i === 2 && totals[i]! > 0 && 'text-warning-ink')}>{dayCount(totals[i]!)} {totals[i] === 1 ? 'day' : 'days'}</dd>
                    </div>
                  ))}
                </dl>
              ) : p.segments.length > 0 && <p className="text-xs text-muted-foreground">{DAYS_NOT_WORKED_OUT}</p>}
              {p.pay && p.pay.status !== 'WORKED_OUT' && (
                <p className="rounded-xl bg-warning/10 px-3 py-2 text-xs text-warning-ink">
                  {p.pay.status === 'AGAIN' ? AGAIN_NOTE : <><span className="font-medium">Pay held - {p.pay.heldFor.map((reason) => HOLD_REASON[reason]).join(', ')}.</span>{p.pay.heldNote && <> {p.pay.heldNote}.</>}</>}
                </p>
              )}
              {/* held by the deductions: what they earned still shows (the user, 2026-11-27) - never deductions or net */}
              {p.pay?.status === 'HELD' && !!p.pay.lines?.length && (
                <PayLines
                  title={`${PAY_TITLE} · ${p.pay.periodDays} days`}
                  lines={p.pay.lines.filter((l) => l.component.kind === 'EARNING')}
                  note={(l) => (l.fromInput ? 'input' : !l.component.cutForUnpaidDays ? 'not cut for unpaid days' : null)}
                  total={['Earned gross', p.pay.earnedGross]}
                />
              )}
              {p.pay?.status === 'WORKED_OUT' && p.pay.lines && (
                <div className="space-y-2">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <PayLines
                      title={`${PAY_TITLE} · ${p.pay.periodDays} days`}
                      lines={p.pay.lines.filter((l) => l.component.kind === 'EARNING')}
                      note={(l) => (l.fromInput ? 'input' : !l.component.cutForUnpaidDays ? 'not cut for unpaid days' : null)}
                      total={['Earned gross', p.pay.earnedGross]}
                    />
                    <div className="space-y-2">
                      <PayLines title={DEDUCTIONS_TITLE} lines={p.pay.lines.filter((l) => l.component.kind === 'DEDUCTION')} note={(l) => (l.fromInput ? 'input' : null)} total={['Total deducted', p.pay.deductions]} />
                      <PayLines title={EMPLOYER_TITLE} lines={p.pay.lines.filter((l) => l.component.kind === 'EMPLOYER_CONTRIBUTION')} note={() => null} total={['Total', p.pay.employerContributions]} muted />
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-hero px-3 py-2 text-hero-foreground">
                    <span className="text-sm">Net pay</span>
                    <span className="text-lg font-medium tabular-nums">{formatMoney(p.pay.netPay ?? 0, 'INR')}</span>
                  </div>
                </div>
              )}
              {p.dayTotals?.allAbsent && <p className="rounded-xl bg-warning/10 px-3 py-2 text-xs text-warning-ink">{ALL_ABSENT_NOTE}</p>}
              {p.salaryHidden && <p className="text-xs text-muted-foreground">{SALARY_HIDDEN_NOTE}</p>}
              {p.segments.length === 0 && <p className="text-sm text-muted-foreground">No days in this pay period any more (they left or moved before it). They stay in the run because inputs were entered for them.</p>}
              {p.segments.map((s) => (
                <div key={s.id} className="space-y-2 rounded-2xl border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium tabular-nums">{formatDate(s.fromDate)} – {formatDate(s.toDate)}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">{s.days} {s.days === 1 ? 'day' : 'days'}</p>
                  </div>
                  <dl className="grid grid-cols-2 gap-2 text-xs">
                    <div><dt className="text-muted-foreground">Plant</dt><dd>{s.plant.plantCode} · {s.plant.name}</dd></div>
                    <div><dt className="text-muted-foreground">Department</dt><dd>{s.department.name}</dd></div>
                    <div><dt className="text-muted-foreground">Cost centre</dt><dd>{s.costCenter ? `${s.costCenter.code} · ${s.costCenter.name}` : '—'}</dd></div>
                    <div><dt className="text-muted-foreground">Type</dt><dd>{EMPLOYMENT_TYPE[s.employmentType]} · {WORKFORCE[s.workforceCategory]}</dd></div>
                  </dl>
                  {p.days && <DayStrip days={p.days.filter((d) => d.date >= s.fromDate && d.date <= s.toDate)} />}
                  {!s.hasSalary ? (
                    <p className="rounded-xl bg-warning/10 px-3 py-2 text-xs text-warning-ink">No salary in force on these days - add one through a job change, then refresh the run.</p>
                  ) : s.salary ? (
                    <div className="rounded-xl bg-surface-2/40 p-2 text-xs">
                      <p className="mb-1 text-muted-foreground">
                        {formatMoney(s.salary.annualCtc, s.salary.currency ?? 'INR')} a year · from {s.salary.effectiveFrom ? formatDate(s.salary.effectiveFrom) : '—'}{s.salary.reason ? ` (${SALARY_REASON[s.salary.reason]})` : ''}
                      </p>
                      <table className="w-full tabular-nums">
                        <tbody>
                          {s.salary.lines.filter((l) => l.component.kind === 'EARNING').map((l) => (
                            <tr key={l.component.id}><td className="py-0.5">{l.component.name}</td><td className="py-0.5 text-right">{formatMoney(l.monthlyAmount, s.salary!.currency ?? 'INR')}</td></tr>
                          ))}
                          <tr className="border-t font-medium"><td className="py-1">Monthly gross</td><td className="py-1 text-right">{formatMoney(s.salary.monthlyGross, s.salary.currency ?? 'INR')}</td></tr>
                          {s.salary.lines.filter((l) => l.component.kind !== 'EARNING').map((l) => (
                            <tr key={l.component.id} className="text-muted-foreground"><td className="py-0.5">{l.component.name} <span className="text-[11px]">(paid by the company)</span></td><td className="py-0.5 text-right">{formatMoney(l.monthlyAmount, s.salary!.currency ?? 'INR')}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
              ))}
              {p.days && p.days.length > 0 && <p className="text-[11px] text-muted-foreground">{DAYS_LEGEND}</p>}
            </>
          ) : <FormError error={query.error} />}
        </div>
        {payslipError && <p role="alert" className="text-xs text-negative-ink">{payslipError}</p>}
        <DialogFooter>
          {withPay && payslips?.releasedAt && (
            <Button variant="secondary" className="gap-1.5" onClick={() => void openPdf(() => client.payroll.payslips.download({ runId, personId }), setPayslipError)}>
              <FileText className="size-4" aria-hidden />Payslip
            </Button>
          )}
          {withPay && payslips && !payslips.releasedAt && previewWith !== null && (
            <>
              {payslips.templates.length > 1 && (
                <NativeSelect aria-label="Payslip template" className="[&_select]:h-9" value={String(previewWith)} onChange={(e) => setTemplateId(Number(e.target.value))}>
                  {payslips.templates.map((t) => <NativeSelectOption key={t.id} value={String(t.id)}>{t.name}</NativeSelectOption>)}
                </NativeSelect>
              )}
              <Button variant="secondary" className="gap-1.5" onClick={() => void openPdf(() => client.payroll.payslips.preview({ runId, personId, templateId: previewWith }), setPayslipError)}>
                <FileText className="size-4" aria-hidden />Preview payslip
              </Button>
            </>
          )}
          {canChange && p && <Button variant="secondary" className="gap-1.5" onClick={() => setAdding(true)}><Plus className="size-4" aria-hidden />Add input</Button>}
          <DialogCancel>Close</DialogCancel>
        </DialogFooter>
      </FormDialog>
      {adding && p && <InputDrawer runId={runId} person={{ id: p.id, employeeCode: p.employeeCode, name: p.name }} close={() => setAdding(false)} />}
    </>
  )
}
