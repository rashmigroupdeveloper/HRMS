import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { FormError } from '@/components/FormError'
import { DrawerCancel, FormDrawer } from '@/components/FormDrawer'
import { Pill } from '@/components/Pill'
import { SharedListNote } from '@/components/SharedListNote'
import { LeaveTypesSkeleton } from '@/components/skeletons/leave/LeaveTypesSkeleton'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAccess } from '@/hooks/useAccess'
import { EMPLOYMENT_TYPE } from '@/lib/choices'
import { orpc } from '@/lib/orpc'
import { cn } from '@/lib/utils'
import { type LeaveType, TYPE_HEADINGS } from './labels'

// The leave types and their rules (Leave View; changing them: Leave Edit for every company - one list for all companies):
// credited on the 1st of each month, carried forward up to a limit at the year end, at most so many days at once, half
// days, the "sandwich" rule (weekly offs / holidays inside count), and whom they apply to. HR can also credit now what the
// nightly job would (after adding a type or employees).
const GENDERS = [
  ['MALE', 'Men'],
  ['FEMALE', 'Women'],
  ['TRANSGENDER', 'Transgender'],
] as const

function rules(t: LeaveType) {
  return [
    t.isCompOff && 'receives comp-off',
    !t.isPaid && 'unpaid',
    t.creditAfterMonths > 0 && `after ${t.creditAfterMonths} months`,
    t.allowHalfDay ? 'half days' : 'whole days only',
    t.countsOffDays && 'counts weekly offs & holidays',
    t.genders.length > 0 && t.genders.map((g) => GENDERS.find(([v]) => v === g)?.[1] ?? g).join(', '),
    t.employmentTypes.length > 0 && t.employmentTypes.map((e) => EMPLOYMENT_TYPE[e]).join(', '),
  ]
    .filter(Boolean)
    .join(' · ')
}

export function LeaveTypes() {
  const { coversGroup } = useAccess()
  const canEdit = coversGroup('LEAVE')
  const queryClient = useQueryClient()
  const types = useQuery(orpc.leave.types.list.queryOptions({ input: { includeInactive: true } }))
  const [editing, setEditing] = useState<LeaveType | 'new' | null>(null)
  const run = useMutation(orpc.leave.balances.runCredits.mutationOptions({ onSuccess: () => void queryClient.invalidateQueries({ queryKey: orpc.leave.key() }) }))
  return (
    <section className="space-y-3 rounded-3xl bg-card p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Leave is credited on the 1st of each month by the nightly job; at the year end the balance above the carry-forward limit lapses.</p>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" disabled={run.isPending} onClick={() => run.mutate({})}>
              <RefreshCw /> {run.isPending ? 'Crediting…' : 'Credit now'}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setEditing('new')}>
              <Plus /> Add leave type
            </Button>
          </div>
        )}
      </div>
      <SharedListNote area="LEAVE" label="Leave" />
      {run.data && (
        <p className="text-xs text-positive-ink">
          {run.data.credited} credits and {run.data.lapsed} lapses added (nothing is credited twice).
        </p>
      )}
      <FormError error={types.error ?? run.error} />
      {types.isPending && <LeaveTypesSkeleton label="Loading the leave types" />}
      {types.data && (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {TYPE_HEADINGS.map((h) => (
                  <TableHead key={h}>{h}</TableHead>
                ))}
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {types.data.map((t) => (
                <TableRow key={t.id} className={cn(!t.isActive && 'opacity-60')}>
                  <TableCell className="font-semibold">{t.code}</TableCell>
                  <TableCell>
                    {t.name} {!t.isActive && <Pill tone="neutral">Retired</Pill>}
                  </TableCell>
                  <TableCell className="tabular-nums">{t.creditPerMonth || '—'}</TableCell>
                  <TableCell className="tabular-nums">{!t.isPaid ? '—' : t.maxCarryForward === null ? 'All' : t.maxCarryForward === 0 ? 'Lapses' : `Up to ${t.maxCarryForward}`}</TableCell>
                  <TableCell className="tabular-nums">{t.maxPerRequest === null ? '—' : `${t.maxPerRequest} days`}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{rules(t)}</TableCell>
                  <TableCell className="text-right">
                    {canEdit && (
                      <Button variant="ghost" size="sm" onClick={() => setEditing(t)}>
                        Edit
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {editing && <TypeDrawer type={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </section>
  )
}

type Form = {
  code: string
  name: string
  isPaid: boolean
  creditPerMonth: string
  creditAfterMonths: string
  maxCarryForward: string
  maxPerRequest: string
  allowHalfDay: boolean
  countsOffDays: boolean
  genders: string[]
  employmentTypes: string[]
  isCompOff: boolean
  isActive: boolean
}
const formOf = (t: LeaveType | null): Form => ({
  code: t?.code ?? '',
  name: t?.name ?? '',
  isPaid: t?.isPaid ?? true,
  creditPerMonth: t ? String(t.creditPerMonth) : '0',
  creditAfterMonths: t ? String(t.creditAfterMonths) : '0',
  maxCarryForward: t?.maxCarryForward === null || t?.maxCarryForward === undefined ? '' : String(t.maxCarryForward),
  maxPerRequest: t?.maxPerRequest === null || t?.maxPerRequest === undefined ? '' : String(t.maxPerRequest),
  allowHalfDay: t?.allowHalfDay ?? true,
  countsOffDays: t?.countsOffDays ?? false,
  genders: t?.genders ?? [],
  employmentTypes: t?.employmentTypes ?? [],
  isCompOff: t?.isCompOff ?? false,
  isActive: t?.isActive ?? true,
})

function TypeDrawer({ type, onClose }: { type: LeaveType | null; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [initial] = useState(() => formOf(type))
  const [f, setF] = useState(initial)
  const [done, setDone] = useState(false)
  // the month changed credit rules credit from (2026-11-23): next month unless HR picks another - an earlier one back-dates
  const [creditsFrom, setCreditsFrom] = useState(() => {
    const n = new Date()
    const next = new Date(Date.UTC(n.getFullYear(), n.getMonth() + 1, 1))
    return next.toISOString().slice(0, 7)
  })
  const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x))
  // the same test as the server's: who is credited what changes
  const creditRulesChange =
    !!type &&
    f.isPaid &&
    (Number(f.creditPerMonth || 0) !== type.creditPerMonth ||
      Number(f.creditAfterMonths || 0) !== type.creditAfterMonths ||
      !sameSet(f.genders, type.genders) ||
      !sameSet(f.employmentTypes, type.employmentTypes) ||
      (f.isActive && !type.isActive))
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setF((v) => ({ ...v, [key]: value }))
  const onSuccess = () => {
    void queryClient.invalidateQueries({ queryKey: orpc.leave.key() })
    setDone(true)
  }
  const create = useMutation(orpc.leave.types.create.mutationOptions({ onSuccess }))
  const update = useMutation(orpc.leave.types.update.mutationOptions({ onSuccess }))
  const saving = create.isPending || update.isPending
  const toggle = (key: 'genders' | 'employmentTypes', value: string) => set(key, f[key].includes(value) ? f[key].filter((x) => x !== value) : [...f[key], value])
  const save = () => {
    const input = {
      code: f.code,
      name: f.name,
      isPaid: f.isPaid,
      creditPerMonth: f.isPaid ? Number(f.creditPerMonth || 0) : 0,
      creditAfterMonths: Number(f.creditAfterMonths || 0),
      maxCarryForward: f.maxCarryForward.trim() === '' ? null : Number(f.maxCarryForward),
      maxPerRequest: f.maxPerRequest.trim() === '' ? null : Number(f.maxPerRequest),
      allowHalfDay: f.allowHalfDay,
      countsOffDays: f.countsOffDays,
      genders: f.genders as LeaveType['genders'],
      employmentTypes: f.employmentTypes as LeaveType['employmentTypes'],
      isCompOff: f.isPaid && f.isCompOff,
      isActive: f.isActive,
    }
    if (type) update.mutate({ ...input, id: type.id, ...(creditRulesChange && { creditsFrom: new Date(`${creditsFrom}-01T00:00:00Z`) }) })
    else create.mutate(input)
  }
  const number = (key: 'creditPerMonth' | 'creditAfterMonths' | 'maxCarryForward' | 'maxPerRequest', label: string, hint: string, step = '0.01') => (
    <div className="space-y-1.5">
      <Label htmlFor={`lt-${key}`} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Input id={`lt-${key}`} type="number" min={0} step={step} className="h-10 rounded-xl" value={f[key]} onChange={(e) => set(key, e.target.value)} />
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  )
  const check = (checked: boolean, onChange: (v: boolean) => void, label: string) => (
    <label className="flex items-center gap-2 text-sm">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      {label}
    </label>
  )
  return (
    <FormDrawer
      onClose={onClose}
      closed={done}
      dirty={JSON.stringify(f) !== JSON.stringify(initial) && !done}
      title={type ? `Edit ${type.code}` : 'Add a leave type'}
      description="One list for every company. Credits already given stay; a change of the credits applies from the month you pick."
      footer={
        <>
          <DrawerCancel />
          <Button variant="gold" disabled={saving || !f.code.trim() || !f.name.trim() || (creditRulesChange && !creditsFrom)} onClick={save}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="lt-code" className="text-xs text-muted-foreground">
            Code
          </Label>
          <Input id="lt-code" className="h-10 rounded-xl uppercase" maxLength={10} value={f.code} onChange={(e) => set('code', e.target.value.toUpperCase())} placeholder="CL" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lt-name" className="text-xs text-muted-foreground">
            Name
          </Label>
          <Input id="lt-name" className="h-10 rounded-xl" maxLength={100} value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Casual leave" />
        </div>
      </div>
      {check(f.isPaid, (v) => set('isPaid', v), 'Paid leave (unchecked: leave without pay - no balance, payroll deducts the days)')}
      {f.isPaid && (
        <div className="grid grid-cols-2 gap-3">
          {number('creditPerMonth', 'Credit a month', 'Days on the 1st of each month (0: HR gives the days)')}
          {number('creditAfterMonths', 'Credit after (months)', 'Months of service before the credit starts', '1')}
          {number('maxCarryForward', 'Carry forward at most', 'Empty: all carries; 0: all lapses at the year end')}
          {number('maxPerRequest', 'At most at once', 'Days in one application (empty: no limit)', '0.5')}
        </div>
      )}
      {!f.isPaid && number('maxPerRequest', 'At most at once', 'Days in one application (empty: no limit)', '0.5')}
      <div className="space-y-2">
        {check(f.allowHalfDay, (v) => set('allowHalfDay', v), 'Half days allowed')}
        {check(f.countsOffDays, (v) => set('countsOffDays', v), 'Weekly offs and holidays inside the leave count as leave days')}
        {f.isPaid && check(f.isCompOff, (v) => set('isCompOff', v), 'Receives comp-off (approved claims for work on a weekly off / holiday; expires after 90 days)')}
      </div>
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground">Only for (none ticked: everyone)</p>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {GENDERS.map(([value, label]) => (
            <span key={value}>{check(f.genders.includes(value), () => toggle('genders', value), label)}</span>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {Object.entries(EMPLOYMENT_TYPE).map(([value, label]) => (
            <span key={value}>{check(f.employmentTypes.includes(value), () => toggle('employmentTypes', value), label)}</span>
          ))}
        </div>
      </div>
      {type && check(f.isActive, (v) => set('isActive', v), 'In use (unchecked: retired - no new applications; balances stay)')}
      {creditRulesChange && (
        <div className="space-y-1 rounded-2xl bg-gold-soft/40 p-3">
          <Label htmlFor="lt-from" className="text-xs text-muted-foreground">
            The new credits start from
          </Label>
          <Input id="lt-from" type="month" className="h-10 w-48 rounded-xl" value={creditsFrom} onChange={(e) => setCreditsFrom(e.target.value)} />
          <p className="text-xs text-muted-foreground">Months before it are not credited. A month already passed is credited at the next run - everyone the type now covers gets it.</p>
        </div>
      )}
      <FormError error={create.error ?? update.error} />
    </FormDrawer>
  )
}
