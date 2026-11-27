import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { FormError } from '@/components/FormError'
import { DrawerCancel, FormDrawer } from '@/components/FormDrawer'
import { StatutoryTableSkeleton } from '@/components/skeletons/payroll/StatutoryTableSkeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { client, orpc } from '@/lib/orpc'
import { formatDate, fromDateInput, toDateInput } from '@/lib/utils'
import {
  GENDER, LWF_COLUMNS, LWF_WIDTHS, MONTHS, PARAMETERS, PT_COLUMNS, PT_WIDTHS, RATE_COLUMNS, RATE_WIDTHS, REGIME, TAX_COLUMNS, TAX_WIDTHS, amountText, taxYearLabel, type Parameter,
} from './statutory-labels'

// The statutory settings (payroll stage 4): dated rates, professional-tax slabs per State, the labour welfare fund per
// State and the income-tax slabs per regime and tax year - one list for the group, read with Payroll View and changed
// only with Payroll Edit for every company (checked on the server too). Every figure carries its notification.

export type Settings = Awaited<ReturnType<typeof client.payroll.statutory.list>>
type Rate = Settings['rates'][number]
type PtSet = Settings['ptSets'][number]
type Lwf = Settings['lwf'][number]
type TaxSet = Settings['taxSets'][number]

const cell = 'px-2 py-2 align-top'
const head = 'h-8 px-2 text-xs'
const useReload = () => {
  const queryClient = useQueryClient()
  return () => void queryClient.invalidateQueries({ queryKey: orpc.payroll.statutory.key() })
}
const wholeOrEmpty = (text: string) => /^\d+$/.test(text.trim())
const decimal = (text: string, places: number) => new RegExp(`^\\d+(\\.\\d{1,${places}})?$`).test(text.trim())

function Actions({ canChange, edit, remove, what }: { canChange: boolean; edit: () => void; remove: () => void; what: string }) {
  if (!canChange) return null
  return (
    <div className="flex justify-end gap-0.5">
      <Button size="icon-sm" variant="ghost" aria-label={`Change ${what}`} onClick={edit}><Pencil aria-hidden /></Button>
      <Button size="icon-sm" variant="ghost" aria-label={`Remove ${what}`} onClick={remove}><Trash2 aria-hidden /></Button>
    </div>
  )
}

function Field({ id, label, children, hint }: { id: string; label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

// --- Rates ---

export function RatesTab({ data, pending, canChange }: { data: Settings | undefined; pending: boolean; canChange: boolean }) {
  const [editing, setEditing] = useState<Rate | 'new' | null>(null)
  const [removing, setRemoving] = useState<Rate | null>(null)
  const reload = useReload()
  const remove = useMutation({ ...orpc.payroll.statutory.deleteRate.mutationOptions(), onSuccess: () => { setRemoving(null); reload() } })
  const order = Object.keys(PARAMETERS) as Parameter[]
  const rows = [...(data?.rates ?? [])].sort((a, b) => order.indexOf(a.parameter) - order.indexOf(b.parameter) || b.effectiveFrom.getTime() - a.effectiveFrom.getTime())
  return (
    <>
      {canChange && <div className="flex justify-end"><Button className="min-h-9 gap-1.5 rounded-full" disabled={pending} onClick={() => setEditing('new')}><Plus className="size-4" aria-hidden />Add a rate</Button></div>}
      <FormError error={remove.error} />
      {pending ? <StatutoryTableSkeleton columns={RATE_COLUMNS} widths={RATE_WIDTHS} rows={8} lines={[2]} /> : !rows.length ? (
        <EmptyState className="py-6" title="No rates yet" hint="Add each PF, ESIC and income-tax figure from its notification." />
      ) : (
        <div className="overflow-x-auto">
          <Table aria-label="Statutory rates" className="min-w-[720px] table-fixed text-[13px]">
            <TableHeader><TableRow>{RATE_COLUMNS.map((h, i) => <TableHead key={`${h}-${i}`} style={{ width: RATE_WIDTHS[i] }} className={head}>{h}</TableHead>)}</TableRow></TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className={cell}><p className="font-medium">{PARAMETERS[r.parameter].label}</p><p className="text-xs text-muted-foreground">{PARAMETERS[r.parameter].group}</p></TableCell>
                  <TableCell className={`${cell} tabular-nums`}>{formatDate(r.effectiveFrom)}</TableCell>
                  <TableCell className={`${cell} tabular-nums`}>{amountText(r.value)} <span className="text-xs text-muted-foreground">{PARAMETERS[r.parameter].unit}</span></TableCell>
                  <TableCell className={`${cell} break-words text-xs`}>{r.reference}</TableCell>
                  <TableCell className={cell}><Actions canChange={canChange} what={PARAMETERS[r.parameter].label} edit={() => setEditing(r)} remove={() => setRemoving(r)} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {editing && <RateDrawer existing={editing === 'new' ? undefined : editing} close={() => setEditing(null)} />}
      {removing && (
        <ConfirmDialog
          title="Remove this rate?"
          description={`${PARAMETERS[removing.parameter].label} from ${formatDate(removing.effectiveFrom)}. Draft runs use the figure in force when their pay is worked out next.`}
          confirm={remove.isPending ? 'Removing…' : 'Remove'}
          pending={remove.isPending}
          onConfirm={() => remove.mutate({ id: removing.id })}
          onClose={() => { if (!remove.isPending) setRemoving(null) }}
        />
      )}
    </>
  )
}

function RateDrawer({ existing, close }: { existing?: Rate; close: () => void }) {
  const [parameter, setParameter] = useState<Parameter | ''>(existing?.parameter ?? '')
  const [from, setFrom] = useState(toDateInput(existing?.effectiveFrom))
  const [value, setValue] = useState(existing ? String(existing.value) : '')
  const [reference, setReference] = useState(existing?.reference ?? '')
  const reload = useReload()
  const save = useMutation({ ...orpc.payroll.statutory.saveRate.mutationOptions(), onSuccess: reload })
  const tax = parameter.startsWith('TAX_')
  const valid = !!parameter && !!fromDateInput(from) && decimal(value, 4) && reference.trim().length >= 3
  const dirty = existing ? parameter !== existing.parameter || from !== toDateInput(existing.effectiveFrom) || value !== String(existing.value) || reference !== existing.reference : !!(parameter || from || value || reference)
  const submit = () => {
    if (!valid || save.isPending) return
    save.mutate({ ...(existing && { id: existing.id }), parameter: parameter as Parameter, effectiveFrom: fromDateInput(from)!, value: Number(value), reference: reference.trim() })
  }
  return (
    <FormDrawer
      onClose={close}
      closed={save.isSuccess}
      dirty={dirty && !save.isSuccess}
      title={existing ? 'Change rate' : 'Add a rate'}
      description="One figure from a date. A change inside a pay period is split by days; income-tax figures go by tax year (from 1 April)."
      footer={<><DrawerCancel /><Button disabled={!valid || save.isPending} onClick={submit}>{save.isPending ? 'Saving…' : 'Save'}</Button></>}
    >
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit() }}>
        <fieldset disabled={save.isPending} className="space-y-4">
          <Field id="sr-parameter" label="Rate">
            <NativeSelect id="sr-parameter" className="w-full [&_select]:h-9" value={parameter} onChange={(e) => setParameter(e.target.value as Parameter)}>
              <NativeSelectOption value="">Choose a rate</NativeSelectOption>
              {(Object.keys(PARAMETERS) as Parameter[]).map((p) => <NativeSelectOption key={p} value={p}>{PARAMETERS[p].group} · {PARAMETERS[p].label}</NativeSelectOption>)}
            </NativeSelect>
          </Field>
          <Field id="sr-from" label="From" hint={tax ? 'Income-tax figures start on 1 April.' : undefined}>
            <Input id="sr-from" type="date" className="h-9" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field id="sr-value" label={`Value${parameter ? ` (${PARAMETERS[parameter].unit})` : ''}`}>
            <Input id="sr-value" className="h-9 tabular-nums" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
          </Field>
          <Field id="sr-reference" label="Notification" hint="e.g. the S.O. number and date, or the section of the Act">
            <Input id="sr-reference" className="h-9" value={reference} onChange={(e) => setReference(e.target.value)} />
          </Field>
        </fieldset>
        <FormError error={save.error} />
      </form>
    </FormDrawer>
  )
}

// --- Professional tax ---

const ptSummary = (set: PtSet) =>
  set.slabs.map((s) => `${s.gender ? `${GENDER[s.gender]}: ` : ''}${amountText(s.wagesFrom)}${s.wagesTo === null ? '+' : `–${amountText(s.wagesTo)}`} → ${amountText(s.amount)}${s.specialMonth ? ` (${MONTHS[s.specialMonth - 1]} ${amountText(s.specialAmount ?? 0)})` : ''}`)

export function PtTab({ data, pending, canChange }: { data: Settings | undefined; pending: boolean; canChange: boolean }) {
  const [editing, setEditing] = useState<PtSet | 'new' | null>(null)
  const [removing, setRemoving] = useState<PtSet | null>(null)
  const reload = useReload()
  const remove = useMutation({ ...orpc.payroll.statutory.deletePtSlabs.mutationOptions(), onSuccess: () => { setRemoving(null); reload() } })
  const rows = data?.ptSets ?? []
  return (
    <>
      {canChange && <div className="flex justify-end"><Button className="min-h-9 gap-1.5 rounded-full" disabled={pending} onClick={() => setEditing('new')}><Plus className="size-4" aria-hidden />Add slabs</Button></div>}
      <FormError error={remove.error} />
      {pending ? <StatutoryTableSkeleton columns={PT_COLUMNS} widths={PT_WIDTHS} rows={4} lines={[1, 1, 3]} /> : !rows.length ? (
        <EmptyState className="py-6" title="No professional-tax slabs yet" hint="One set per State from a date. A State without professional tax gets a nil slab (0, no upper limit, 0)." />
      ) : (
        <div className="overflow-x-auto">
          <Table aria-label="Professional-tax slabs" className="min-w-[720px] table-fixed text-[13px]">
            <TableHeader><TableRow>{PT_COLUMNS.map((h, i) => <TableHead key={`${h}-${i}`} style={{ width: PT_WIDTHS[i] }} className={head}>{h}</TableHead>)}</TableRow></TableHeader>
            <TableBody>
              {rows.map((set) => (
                <TableRow key={`${set.stateCode}-${set.effectiveFrom.getTime()}`}>
                  <TableCell className={`${cell} font-medium`}>{set.stateCode}</TableCell>
                  <TableCell className={`${cell} tabular-nums`}>{formatDate(set.effectiveFrom)}</TableCell>
                  <TableCell className={`${cell} text-xs tabular-nums`}>{ptSummary(set).map((t) => <p key={t}>{t}</p>)}</TableCell>
                  <TableCell className={`${cell} break-words text-xs`}>{set.reference}</TableCell>
                  <TableCell className={cell}><Actions canChange={canChange} what={`${set.stateCode} slabs`} edit={() => setEditing(set)} remove={() => setRemoving(set)} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {editing && <PtDrawer existing={editing === 'new' ? undefined : editing} close={() => setEditing(null)} />}
      {removing && (
        <ConfirmDialog
          title={`Remove the slabs of ${removing.stateCode}?`}
          description={`From ${formatDate(removing.effectiveFrom)}. People placed in ${removing.stateCode} are held until slabs are in force again.`}
          confirm={remove.isPending ? 'Removing…' : 'Remove'}
          pending={remove.isPending}
          onConfirm={() => remove.mutate({ stateCode: removing.stateCode, effectiveFrom: removing.effectiveFrom })}
          onClose={() => { if (!remove.isPending) setRemoving(null) }}
        />
      )}
    </>
  )
}

type PtRow = { gender: '' | keyof typeof GENDER; from: string; to: string; amount: string; month: string; special: string }
const ptRowOf = (s: PtSet['slabs'][number]): PtRow => ({ gender: s.gender ?? '', from: String(s.wagesFrom), to: s.wagesTo === null ? '' : String(s.wagesTo), amount: String(s.amount), month: s.specialMonth ? String(s.specialMonth) : '', special: s.specialAmount === null ? '' : String(s.specialAmount) })
const EMPTY_PT: PtRow = { gender: '', from: '', to: '', amount: '', month: '', special: '' }

function PtDrawer({ existing, close }: { existing?: PtSet; close: () => void }) {
  const [state, setState] = useState(existing?.stateCode ?? '')
  const [from, setFrom] = useState(toDateInput(existing?.effectiveFrom))
  const [reference, setReference] = useState(existing?.reference ?? '')
  const [rows, setRows] = useState<PtRow[]>(existing ? existing.slabs.map(ptRowOf) : [{ ...EMPTY_PT, from: '0' }])
  const [initial] = useState(() => JSON.stringify({ state, from, reference, rows }))
  const reload = useReload()
  const save = useMutation({ ...orpc.payroll.statutory.savePtSlabs.mutationOptions(), onSuccess: reload })
  const set = (i: number, patch: Partial<PtRow>) => setRows(rows.map((r, n) => (n === i ? { ...r, ...patch } : r)))
  const rowValid = (r: PtRow) => wholeOrEmpty(r.from) && (r.to === '' || wholeOrEmpty(r.to)) && wholeOrEmpty(r.amount) && (r.month === '') === (r.special === '') && (r.special === '' || wholeOrEmpty(r.special))
  const valid = /^[A-Za-z]{2}$/.test(state.trim()) && !!fromDateInput(from) && reference.trim().length >= 3 && rows.length > 0 && rows.every(rowValid)
  const dirty = JSON.stringify({ state, from, reference, rows }) !== initial
  const submit = () => {
    if (!valid || save.isPending) return
    save.mutate({
      stateCode: state.trim().toUpperCase(),
      effectiveFrom: fromDateInput(from)!,
      reference: reference.trim(),
      slabs: rows.map((r) => ({ gender: r.gender || null, wagesFrom: Number(r.from), wagesTo: r.to === '' ? null : Number(r.to), amount: Number(r.amount), specialMonth: r.month ? Number(r.month) : null, specialAmount: r.special === '' ? null : Number(r.special) })),
      ...(existing && (existing.stateCode !== state.trim().toUpperCase() || toDateInput(existing.effectiveFrom) !== from) && { replaces: { stateCode: existing.stateCode, effectiveFrom: existing.effectiveFrom } }),
    })
  }
  return (
    <FormDrawer
      onClose={close}
      closed={save.isSuccess}
      dirty={dirty && !save.isSuccess}
      width={640}
      title={existing ? `Slabs of ${existing.stateCode}` : 'Add professional-tax slabs'}
      description="The month's tax by the month's earned gross (whole rupees). The slabs start at 0, follow on without gaps, and the last has no upper limit; women's slabs (Maharashtra) form their own list."
      footer={<><DrawerCancel /><Button disabled={!valid || save.isPending} onClick={submit}>{save.isPending ? 'Saving…' : 'Save'}</Button></>}
    >
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit() }}>
        <fieldset disabled={save.isPending} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field id="pt-state" label="State" hint="As on the work locations, e.g. WB"><Input id="pt-state" className="h-9 uppercase" maxLength={2} value={state} onChange={(e) => setState(e.target.value)} /></Field>
            <Field id="pt-from" label="From"><Input id="pt-from" type="date" className="h-9" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          </div>
          <Field id="pt-reference" label="Notification"><Input id="pt-reference" className="h-9" value={reference} onChange={(e) => setReference(e.target.value)} /></Field>
          <div className="space-y-2">
            <p className="text-sm font-medium">Slabs</p>
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-1.5 rounded-xl bg-surface-2/40 p-2 sm:grid-cols-[1.1fr_1fr_1fr_0.9fr_0.9fr_0.9fr_auto]">
                <NativeSelect aria-label={`Slab ${i + 1}: for`} className="col-span-2 w-full [&_select]:h-8 sm:col-span-1" value={r.gender} onChange={(e) => set(i, { gender: e.target.value as PtRow['gender'] })}>
                  <NativeSelectOption value="">Everyone</NativeSelectOption>
                  {(Object.keys(GENDER) as (keyof typeof GENDER)[]).map((g) => <NativeSelectOption key={g} value={g}>{GENDER[g]}</NativeSelectOption>)}
                </NativeSelect>
                <Input aria-label={`Slab ${i + 1}: gross from`} placeholder="From" className="h-8 tabular-nums" inputMode="numeric" value={r.from} onChange={(e) => set(i, { from: e.target.value })} />
                <Input aria-label={`Slab ${i + 1}: gross to`} placeholder="To (empty: no limit)" className="h-8 tabular-nums" inputMode="numeric" value={r.to} onChange={(e) => set(i, { to: e.target.value })} />
                <Input aria-label={`Slab ${i + 1}: tax`} placeholder="Tax" className="h-8 tabular-nums" inputMode="numeric" value={r.amount} onChange={(e) => set(i, { amount: e.target.value })} />
                <NativeSelect aria-label={`Slab ${i + 1}: special month`} className="w-full [&_select]:h-8" value={r.month} onChange={(e) => set(i, { month: e.target.value })}>
                  <NativeSelectOption value="">No special month</NativeSelectOption>
                  {MONTHS.map((m, n) => <NativeSelectOption key={m} value={String(n + 1)}>{m}</NativeSelectOption>)}
                </NativeSelect>
                <Input aria-label={`Slab ${i + 1}: special month's tax`} placeholder="Its tax" className="h-8 tabular-nums" inputMode="numeric" value={r.special} disabled={!r.month} onChange={(e) => set(i, { special: e.target.value })} />
                <Button type="button" size="icon-sm" variant="ghost" aria-label={`Remove slab ${i + 1}`} disabled={rows.length === 1} onClick={() => setRows(rows.filter((_, n) => n !== i))}><X aria-hidden /></Button>
              </div>
            ))}
            <Button type="button" variant="secondary" size="sm" className="gap-1.5" onClick={() => setRows([...rows, { ...EMPTY_PT, from: rows.at(-1)?.to ? String(Number(rows.at(-1)!.to) + 1) : '', gender: rows.at(-1)?.gender ?? '' }])}><Plus className="size-3.5" aria-hidden />Add a slab</Button>
          </div>
        </fieldset>
        <FormError error={save.error} />
      </form>
    </FormDrawer>
  )
}

// --- Labour welfare fund ---

export function LwfTab({ data, pending, canChange }: { data: Settings | undefined; pending: boolean; canChange: boolean }) {
  const [editing, setEditing] = useState<Lwf | 'new' | null>(null)
  const [removing, setRemoving] = useState<Lwf | null>(null)
  const reload = useReload()
  const remove = useMutation({ ...orpc.payroll.statutory.deleteLwf.mutationOptions(), onSuccess: () => { setRemoving(null); reload() } })
  const rows = data?.lwf ?? []
  return (
    <>
      {canChange && <div className="flex justify-end"><Button className="min-h-9 gap-1.5 rounded-full" disabled={pending} onClick={() => setEditing('new')}><Plus className="size-4" aria-hidden />Add a State</Button></div>}
      <FormError error={remove.error} />
      {pending ? <StatutoryTableSkeleton columns={LWF_COLUMNS} widths={LWF_WIDTHS} rows={4} /> : !rows.length ? (
        <EmptyState className="py-6" title="No labour welfare fund rows yet" hint="One per State from a date. A State without the fund gets a nil row (0 and 0)." />
      ) : (
        <div className="overflow-x-auto">
          <Table aria-label="Labour welfare fund" className="min-w-[720px] table-fixed text-[13px]">
            <TableHeader><TableRow>{LWF_COLUMNS.map((h, i) => <TableHead key={`${h}-${i}`} style={{ width: LWF_WIDTHS[i] }} className={head}>{h}</TableHead>)}</TableRow></TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className={`${cell} font-medium`}>{r.stateCode}</TableCell>
                  <TableCell className={`${cell} tabular-nums`}>{formatDate(r.effectiveFrom)}</TableCell>
                  <TableCell className={`${cell} tabular-nums`}>{amountText(r.employeeAmount)}</TableCell>
                  <TableCell className={`${cell} tabular-nums`}>{amountText(r.employerAmount)}</TableCell>
                  <TableCell className={`${cell} text-xs`}>{r.months.length ? r.months.map((m) => MONTHS[m - 1]).join(', ') : 'Every month'}</TableCell>
                  <TableCell className={`${cell} break-words text-xs`}>{r.reference}</TableCell>
                  <TableCell className={cell}><Actions canChange={canChange} what={`${r.stateCode} fund`} edit={() => setEditing(r)} remove={() => setRemoving(r)} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {editing && <LwfDrawer existing={editing === 'new' ? undefined : editing} close={() => setEditing(null)} />}
      {removing && (
        <ConfirmDialog
          title={`Remove the fund of ${removing.stateCode}?`}
          description={`From ${formatDate(removing.effectiveFrom)}. People placed in ${removing.stateCode} are held until a row is in force again.`}
          confirm={remove.isPending ? 'Removing…' : 'Remove'}
          pending={remove.isPending}
          onConfirm={() => remove.mutate({ id: removing.id })}
          onClose={() => { if (!remove.isPending) setRemoving(null) }}
        />
      )}
    </>
  )
}

function LwfDrawer({ existing, close }: { existing?: Lwf; close: () => void }) {
  const [state, setState] = useState(existing?.stateCode ?? '')
  const [from, setFrom] = useState(toDateInput(existing?.effectiveFrom))
  const [employee, setEmployee] = useState(existing ? String(existing.employeeAmount) : '')
  const [employer, setEmployer] = useState(existing ? String(existing.employerAmount) : '')
  const [months, setMonths] = useState<number[]>(existing?.months ?? [])
  const [reference, setReference] = useState(existing?.reference ?? '')
  const [initial] = useState(() => JSON.stringify({ state, from, employee, employer, months, reference }))
  const reload = useReload()
  const save = useMutation({ ...orpc.payroll.statutory.saveLwf.mutationOptions(), onSuccess: reload })
  const valid = /^[A-Za-z]{2}$/.test(state.trim()) && !!fromDateInput(from) && decimal(employee, 2) && decimal(employer, 2) && reference.trim().length >= 3
  const dirty = JSON.stringify({ state, from, employee, employer, months, reference }) !== initial
  const submit = () => {
    if (!valid || save.isPending) return
    save.mutate({ ...(existing && { id: existing.id }), stateCode: state.trim().toUpperCase(), effectiveFrom: fromDateInput(from)!, employeeAmount: Number(employee), employerAmount: Number(employer), months, reference: reference.trim() })
  }
  return (
    <FormDrawer
      onClose={close}
      closed={save.isSuccess}
      dirty={dirty && !save.isSuccess}
      title={existing ? `Fund of ${existing.stateCode}` : 'Add a labour welfare fund'}
      description="The employee's and the employer's amount, deducted in the pay months ticked (none ticked: every month)."
      footer={<><DrawerCancel /><Button disabled={!valid || save.isPending} onClick={submit}>{save.isPending ? 'Saving…' : 'Save'}</Button></>}
    >
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit() }}>
        <fieldset disabled={save.isPending} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field id="lwf-state" label="State"><Input id="lwf-state" className="h-9 uppercase" maxLength={2} value={state} onChange={(e) => setState(e.target.value)} /></Field>
            <Field id="lwf-from" label="From"><Input id="lwf-from" type="date" className="h-9" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
            <Field id="lwf-employee" label="Employee (₹)"><Input id="lwf-employee" className="h-9 tabular-nums" inputMode="decimal" value={employee} onChange={(e) => setEmployee(e.target.value)} /></Field>
            <Field id="lwf-employer" label="Employer (₹)"><Input id="lwf-employer" className="h-9 tabular-nums" inputMode="decimal" value={employer} onChange={(e) => setEmployer(e.target.value)} /></Field>
          </div>
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">Pay months</legend>
            <div className="flex flex-wrap gap-1.5">
              {MONTHS.map((m, n) => {
                const on = months.includes(n + 1)
                return <Button key={m} type="button" size="sm" variant={on ? 'default' : 'secondary'} aria-pressed={on} className="min-w-12 rounded-full" onClick={() => setMonths(on ? months.filter((x) => x !== n + 1) : [...months, n + 1].sort((a, b) => a - b))}>{m}</Button>
              })}
            </div>
          </fieldset>
          <Field id="lwf-reference" label="Notification"><Input id="lwf-reference" className="h-9" value={reference} onChange={(e) => setReference(e.target.value)} /></Field>
        </fieldset>
        <FormError error={save.error} />
      </form>
    </FormDrawer>
  )
}

// --- Income tax ---

export function TaxTab({ data, pending, canChange }: { data: Settings | undefined; pending: boolean; canChange: boolean }) {
  const [editing, setEditing] = useState<TaxSet | 'new' | null>(null)
  const [removing, setRemoving] = useState<TaxSet | null>(null)
  const reload = useReload()
  const remove = useMutation({ ...orpc.payroll.statutory.deleteTaxSlabs.mutationOptions(), onSuccess: () => { setRemoving(null); reload() } })
  const rows = data?.taxSets ?? []
  return (
    <>
      {canChange && <div className="flex justify-end"><Button className="min-h-9 gap-1.5 rounded-full" disabled={pending} onClick={() => setEditing('new')}><Plus className="size-4" aria-hidden />Add slabs</Button></div>}
      <FormError error={remove.error} />
      {pending ? <StatutoryTableSkeleton columns={TAX_COLUMNS} widths={TAX_WIDTHS} rows={2} lines={[1, 1, 3]} /> : !rows.length ? (
        <EmptyState className="py-6" title="No income-tax slabs yet" hint="The new-regime slabs of each tax year; the standard deduction, rebate and cess are on Rates." />
      ) : (
        <div className="overflow-x-auto">
          <Table aria-label="Income-tax slabs" className="min-w-[720px] table-fixed text-[13px]">
            <TableHeader><TableRow>{TAX_COLUMNS.map((h, i) => <TableHead key={`${h}-${i}`} style={{ width: TAX_WIDTHS[i] }} className={head}>{h}</TableHead>)}</TableRow></TableHeader>
            <TableBody>
              {rows.map((set) => (
                <TableRow key={`${set.regime}-${set.taxYearFrom.getTime()}`}>
                  <TableCell className={`${cell} font-medium tabular-nums`}>{taxYearLabel(set.taxYearFrom)}</TableCell>
                  <TableCell className={cell}>{REGIME[set.regime]}</TableCell>
                  <TableCell className={`${cell} text-xs tabular-nums`}>{set.slabs.map((s) => <p key={s.incomeFrom}>{amountText(s.incomeFrom)}{s.incomeTo === null ? '+' : `–${amountText(s.incomeTo)}`} → {amountText(s.ratePercent)}%</p>)}</TableCell>
                  <TableCell className={`${cell} break-words text-xs`}>{set.reference}</TableCell>
                  <TableCell className={cell}><Actions canChange={canChange} what={`${taxYearLabel(set.taxYearFrom)} slabs`} edit={() => setEditing(set)} remove={() => setRemoving(set)} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {editing && <TaxDrawer existing={editing === 'new' ? undefined : editing} close={() => setEditing(null)} />}
      {removing && (
        <ConfirmDialog
          title={`Remove the ${taxYearLabel(removing.taxYearFrom)} slabs?`}
          description={`${REGIME[removing.regime]} regime. TDS cannot be worked out for that tax year until slabs are entered again.`}
          confirm={remove.isPending ? 'Removing…' : 'Remove'}
          pending={remove.isPending}
          onConfirm={() => remove.mutate({ regime: removing.regime, taxYearFrom: removing.taxYearFrom })}
          onClose={() => { if (!remove.isPending) setRemoving(null) }}
        />
      )}
    </>
  )
}

type TaxRow = { from: string; to: string; rate: string }

function TaxDrawer({ existing, close }: { existing?: TaxSet; close: () => void }) {
  const [regime, setRegime] = useState<'NEW' | 'OLD'>(existing?.regime ?? 'NEW')
  const [year, setYear] = useState(existing ? String(existing.taxYearFrom.getUTCFullYear()) : '')
  const [reference, setReference] = useState(existing?.reference ?? '')
  const [rows, setRows] = useState<TaxRow[]>(existing ? existing.slabs.map((s) => ({ from: String(s.incomeFrom), to: s.incomeTo === null ? '' : String(s.incomeTo), rate: String(s.ratePercent) })) : [{ from: '0', to: '', rate: '' }])
  const [initial] = useState(() => JSON.stringify({ regime, year, reference, rows }))
  const reload = useReload()
  const save = useMutation({ ...orpc.payroll.statutory.saveTaxSlabs.mutationOptions(), onSuccess: reload })
  const set = (i: number, patch: Partial<TaxRow>) => setRows(rows.map((r, n) => (n === i ? { ...r, ...patch } : r)))
  const taxYearFrom = /^\d{4}$/.test(year) ? new Date(Date.UTC(Number(year), 3, 1)) : null
  const valid = !!taxYearFrom && reference.trim().length >= 3 && rows.length > 0 && rows.every((r) => wholeOrEmpty(r.from) && (r.to === '' || wholeOrEmpty(r.to)) && decimal(r.rate, 2))
  const dirty = JSON.stringify({ regime, year, reference, rows }) !== initial
  const submit = () => {
    if (!valid || save.isPending) return
    save.mutate({
      regime,
      taxYearFrom: taxYearFrom!,
      reference: reference.trim(),
      slabs: rows.map((r) => ({ incomeFrom: Number(r.from), incomeTo: r.to === '' ? null : Number(r.to), ratePercent: Number(r.rate) })),
      ...(existing && (existing.regime !== regime || existing.taxYearFrom.getTime() !== taxYearFrom!.getTime()) && { replaces: { regime: existing.regime, taxYearFrom: existing.taxYearFrom } }),
    })
  }
  return (
    <FormDrawer
      onClose={close}
      closed={save.isSuccess}
      dirty={dirty && !save.isSuccess}
      width={520}
      title={existing ? `${taxYearLabel(existing.taxYearFrom)} slabs` : 'Add income-tax slabs'}
      description="The rate on the taxable income between from and to, for one tax year (from 1 April). The slabs start at 0, each where the one before ends; the last has no upper limit."
      footer={<><DrawerCancel /><Button disabled={!valid || save.isPending} onClick={submit}>{save.isPending ? 'Saving…' : 'Save'}</Button></>}
    >
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit() }}>
        <fieldset disabled={save.isPending} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field id="tx-year" label="Tax year from 1 April" hint={taxYearFrom ? `Tax year ${taxYearLabel(taxYearFrom)}` : 'e.g. 2026'}><Input id="tx-year" className="h-9 tabular-nums" inputMode="numeric" maxLength={4} value={year} onChange={(e) => setYear(e.target.value)} /></Field>
            <Field id="tx-regime" label="Regime" hint="Only the new regime is worked out today; the old one is typed.">
              <NativeSelect id="tx-regime" className="w-full [&_select]:h-9" value={regime} onChange={(e) => setRegime(e.target.value as 'NEW' | 'OLD')}>
                <NativeSelectOption value="NEW">New</NativeSelectOption>
                <NativeSelectOption value="OLD">Old</NativeSelectOption>
              </NativeSelect>
            </Field>
          </div>
          <Field id="tx-reference" label="Notification" hint="e.g. the Finance Act and section"><Input id="tx-reference" className="h-9" value={reference} onChange={(e) => setReference(e.target.value)} /></Field>
          <div className="space-y-2">
            <p className="text-sm font-medium">Slabs</p>
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_0.8fr_auto] gap-1.5 rounded-xl bg-surface-2/40 p-2">
                <Input aria-label={`Slab ${i + 1}: income from`} placeholder="From" className="h-8 tabular-nums" inputMode="numeric" value={r.from} onChange={(e) => set(i, { from: e.target.value })} />
                <Input aria-label={`Slab ${i + 1}: income to`} placeholder="To (empty: no limit)" className="h-8 tabular-nums" inputMode="numeric" value={r.to} onChange={(e) => set(i, { to: e.target.value })} />
                <Input aria-label={`Slab ${i + 1}: rate %`} placeholder="Rate %" className="h-8 tabular-nums" inputMode="decimal" value={r.rate} onChange={(e) => set(i, { rate: e.target.value })} />
                <Button type="button" size="icon-sm" variant="ghost" aria-label={`Remove slab ${i + 1}`} disabled={rows.length === 1} onClick={() => setRows(rows.filter((_, n) => n !== i))}><X aria-hidden /></Button>
              </div>
            ))}
            <Button type="button" variant="secondary" size="sm" className="gap-1.5" onClick={() => setRows([...rows, { from: rows.at(-1)?.to ?? '', to: '', rate: '' }])}><Plus className="size-3.5" aria-hidden />Add a slab</Button>
          </div>
        </fieldset>
        <FormError error={save.error} />
      </form>
    </FormDrawer>
  )
}
