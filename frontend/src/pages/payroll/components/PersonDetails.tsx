import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { FormDialog, DialogCancel } from '@/components/FormDialog'
import { FormError } from '@/components/FormError'
import { PersonDetailsSkeleton } from '@/components/skeletons/payroll/PersonDetailsSkeleton'
import { Button } from '@/components/ui/button'
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EMPLOYMENT_TYPE, SALARY_REASON, WORKFORCE } from '@/lib/choices'
import { orpc } from '@/lib/orpc'
import { formatDate, formatMoney } from '@/lib/utils'
import { InputDrawer } from './InputDrawer'
import { SALARY_HIDDEN_NOTE } from './payroll-labels'

// One person of a run: each stretch of days with its placement and the salary copied for it (read only - the salary
// changes through job changes; the copy follows on the next refresh)
export function PersonDetails({ runId, personId, canChange, close }: { runId: number; personId: number; canChange: boolean; close: () => void }) {
  const query = useQuery(orpc.payroll.people.get.queryOptions({ input: { runId, personId } }))
  const [adding, setAdding] = useState(false)
  const p = query.data
  return (
    <>
      <FormDialog onOpenChange={close} className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{p ? `${p.name || p.employeeCode} · ${p.employeeCode}` : 'Person in the run'}</DialogTitle>
          <DialogDescription>The salary and placement copied for each stretch of days in the pay period.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-3 overflow-y-auto">
          {query.isPending ? <PersonDetailsSkeleton /> : p ? (
            <>
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
            </>
          ) : <FormError error={query.error} />}
        </div>
        <DialogFooter>
          {canChange && p && <Button variant="secondary" className="gap-1.5" onClick={() => setAdding(true)}><Plus className="size-4" aria-hidden />Add input</Button>}
          <DialogCancel>Close</DialogCancel>
        </DialogFooter>
      </FormDialog>
      {adding && p && <InputDrawer runId={runId} person={{ id: p.id, employeeCode: p.employeeCode, name: p.name }} close={() => setAdding(false)} />}
    </>
  )
}
