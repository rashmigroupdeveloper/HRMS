import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FormDialog, DialogCancel } from '@/components/FormDialog'
import { FormError } from '@/components/FormError'
import { SearchableSelect } from '@/components/SearchableSelect'
import { PayrollPeriodSkeleton } from '@/components/skeletons/payroll/PayrollPeriodSkeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { orpc } from '@/lib/orpc'
import { formatDate } from '@/lib/utils'

export function NewPayrollRun({ initialMonth, close, created }: { initialMonth: string; close: () => void; created: (id: number) => void }) {
  const [month, setMonth] = useState(initialMonth)
  const [company, setCompany] = useState('')
  const validMonth = /^(20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(month)
  const setup = useQuery({ ...orpc.payroll.setup.queryOptions({ input: { payMonth: new Date(`${validMonth ? month : initialMonth}-01T00:00:00Z`) } }), enabled: validMonth })
  const queryClient = useQueryClient()
  const save = useMutation({ ...orpc.payroll.create.mutationOptions(), onSuccess: result => { void queryClient.invalidateQueries({ queryKey: orpc.payroll.list.key() }); created(result.id) } })
  const choices = setup.data?.companies.filter(c => c.canCreate) ?? []
  const valid = validMonth && choices.some(c => String(c.id) === company) && !setup.isFetching && !setup.isError
  return <FormDialog onOpenChange={() => { if (!save.isPending) close() }} dirty={(!!company || month !== initialMonth) && !save.isSuccess} className="sm:max-w-lg">
    <DialogHeader><DialogTitle>New payroll run</DialogTitle><DialogDescription>Create a regular monthly draft for one India payroll company. It pays the attendance cycle of the pay month; the dates are captured when you create it.</DialogDescription></DialogHeader>
    <form className="space-y-4" onSubmit={e => { e.preventDefault(); if (!valid || !setup.data || save.isPending) return; save.mutate({ companyId: Number(company), payMonth: new Date(`${month}-01T00:00:00Z`), expectedAttendanceFrom: setup.data.attendanceFrom, expectedAttendanceTo: setup.data.attendanceTo }) }}>
      <fieldset disabled={save.isPending} className="space-y-4">
        <div className="space-y-1.5"><Label htmlFor="payroll-company">Company</Label><SearchableSelect id="payroll-company" className="h-9 w-full" value={company} onChange={setCompany} options={choices.map(c => ({ value: String(c.id), label: `${c.code} · ${c.name}` }))} disabled={setup.isPending || save.isPending} placeholder={setup.isPending ? 'Loading…' : 'Choose a company'} /></div>
        <div className="space-y-1.5"><Label htmlFor="payroll-month">Pay month</Label><Input className="h-9" id="payroll-month" type="month" min="2000-01" max="2100-12" required value={month} onChange={e => setMonth(e.target.value)} /></div>
        <div className="space-y-1.5"><p className="text-sm font-medium">Pay period</p>{validMonth && setup.isPending ? <PayrollPeriodSkeleton /> : setup.data && validMonth ? <p className="text-sm">{formatDate(setup.data.attendanceFrom)} – {formatDate(setup.data.attendanceTo)}</p> : <p className="text-sm text-muted-foreground">Choose a valid pay month.</p>}</div>
      </fieldset>
      {!validMonth && <p role="alert" className="text-sm text-negative-ink">Choose a month from January 2000 to December 2100.</p>}
      {setup.data && !setup.isFetching && !choices.length && <p className="text-sm text-muted-foreground">No active India payroll company is covered by your whole-company Payroll Edit access.</p>}
      <FormError error={setup.error ?? save.error} />
      {setup.isError && <Button type="button" variant="secondary" onClick={() => void setup.refetch()}>Try again</Button>}
      <DialogFooter><DialogCancel disabled={save.isPending} /><Button type="submit" disabled={!valid || save.isPending}>{save.isPending ? 'Creating…' : 'Create draft'}</Button></DialogFooter>
    </form>
  </FormDialog>
}
