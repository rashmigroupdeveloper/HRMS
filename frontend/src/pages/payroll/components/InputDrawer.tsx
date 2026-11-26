import { useDeferredValue, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DrawerCancel, FormDrawer } from '@/components/FormDrawer'
import { FormError } from '@/components/FormError'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { orpc } from '@/lib/orpc'

type Person = { id: number; employeeCode: string; name: string }
type Existing = { id: number; person: Person; salaryComponentId: number; amount: number; note: string }

// Add or change one input of a run (an incentive, a canteen recovery...). The person is fixed when it opens from a
// person or an existing input; otherwise it is found by code or name among the run's people.
export function InputDrawer({ runId, person, existing, close }: { runId: number; person?: Person; existing?: Existing; close: () => void }) {
  const fixed = existing?.person ?? person
  const [personId, setPersonId] = useState(fixed ? String(fixed.id) : '')
  const [find, setFind] = useState('')
  const [componentId, setComponentId] = useState(existing ? String(existing.salaryComponentId) : '')
  const [amount, setAmount] = useState(existing ? String(existing.amount) : '')
  const [note, setNote] = useState(existing?.note ?? '')
  const [closed, setClosed] = useState(false)
  const [warning, setWarning] = useState('')
  const deferred = useDeferredValue(find.trim())
  const queryClient = useQueryClient()
  const components = useQuery(orpc.organization.salaryComponents.list.queryOptions())
  const monthly = (components.data ?? []).filter((c) => c.enteredMonthly)
  const people = useQuery({ ...orpc.payroll.people.list.queryOptions({ input: { runId, search: deferred || undefined, page: 1, pageSize: 20 } }), enabled: !fixed })
  const done = (result: { duplicate: boolean }) => {
    void queryClient.invalidateQueries({ queryKey: orpc.payroll.key() })
    if (result.duplicate) setWarning('Saved. The same item and amount was already entered for this person - check it is not counted twice.')
    else setClosed(true)
  }
  const create = useMutation({ ...orpc.payroll.inputs.create.mutationOptions(), onSuccess: done })
  const update = useMutation({ ...orpc.payroll.inputs.update.mutationOptions(), onSuccess: done })
  const saving = create.isPending || update.isPending
  const value = Number(amount)
  const valid = !!personId && !!componentId && amount.trim() !== '' && value > 0 && /^\d+(\.\d{1,2})?$/.test(amount.trim()) && note.trim().length >= 2
  const dirty = !warning && (existing ? amount !== String(existing.amount) || note !== existing.note || componentId !== String(existing.salaryComponentId) : !!(componentId || amount || note || (!fixed && personId)))
  const submit = () => {
    if (!valid || saving) return
    if (existing) update.mutate({ runId, id: existing.id, salaryComponentId: Number(componentId), amount: value, note: note.trim() })
    else create.mutate({ runId, personId: Number(personId), salaryComponentId: Number(componentId), amount: value, note: note.trim() })
  }
  return (
    <FormDrawer
      onClose={close}
      closed={closed}
      dirty={dirty && !create.isSuccess && !update.isSuccess}
      title={existing ? 'Change input' : 'Add input'}
      description="An amount for this month only. Items come from the salary components marked “entered each month”."
      footer={warning ? <Button onClick={() => setClosed(true)}>Done</Button> : <><DrawerCancel /><Button disabled={!valid || saving} onClick={submit}>{saving ? 'Saving…' : 'Save'}</Button></>}
    >
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit() }}>
        <fieldset disabled={saving || !!warning} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="in-person">Employee</Label>
            {fixed ? <p id="in-person" className="text-sm">{fixed.name || fixed.employeeCode} · {fixed.employeeCode}</p> : (
              <>
                <Input id="in-find" className="h-9" placeholder="Find by code or name" value={find} onChange={(e) => setFind(e.target.value)} aria-label="Find employee" />
                <NativeSelect id="in-person" className="w-full [&_select]:h-9" value={personId} onChange={(e) => setPersonId(e.target.value)}>
                  <NativeSelectOption value="">{people.isPending ? 'Loading…' : people.data?.total ? 'Choose an employee' : 'Nobody matches'}</NativeSelectOption>
                  {people.data?.items.map((p) => <NativeSelectOption key={p.id} value={String(p.id)}>{p.employeeCode} · {p.name}</NativeSelectOption>)}
                </NativeSelect>
              </>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="in-item">Item</Label>
            <NativeSelect id="in-item" className="w-full [&_select]:h-9" value={componentId} onChange={(e) => setComponentId(e.target.value)}>
              <NativeSelectOption value="">{components.isPending ? 'Loading…' : monthly.length ? 'Choose an item' : 'No item is marked “entered each month” yet'}</NativeSelectOption>
              {monthly.map((c) => <NativeSelectOption key={c.id} value={String(c.id)}>{c.name} ({c.kind === 'DEDUCTION' ? 'deduction' : 'earning'})</NativeSelectOption>)}
            </NativeSelect>
            {!components.isPending && !monthly.length && <p className="text-xs text-muted-foreground">Mark items such as Incentive or Canteen recovery on Organization › Salary components.</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="in-amount">Amount (₹)</Label>
            <Input id="in-amount" className="h-9 tabular-nums" inputMode="decimal" placeholder="e.g. 800" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="in-note">Why</Label>
            <Textarea id="in-note" rows={3} placeholder="e.g. Canteen, November" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </fieldset>
        {warning && <p role="status" className="rounded-xl bg-warning/10 px-3 py-2 text-sm text-warning-ink">{warning}</p>}
        <FormError error={create.error ?? update.error ?? components.error ?? people.error} />
      </form>
    </FormDrawer>
  )
}
