import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { DialogCancel, FormDialog } from '@/components/FormDialog'
import { EmptyState } from '@/components/EmptyState'
import { FormError } from '@/components/FormError'
import { Pill } from '@/components/Pill'
import { SharedListNote } from '@/components/SharedListNote'
import { PolicyRowsSkeleton } from '@/components/skeletons/attendance/SetupSkeleton'
import { Button } from '@/components/ui/button'
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAccess } from '@/hooks/useAccess'
import { type client, orpc } from '@/lib/orpc'
import { formatDate, fromDateInput, toDateInput, todayDay } from '@/lib/utils'
import { hours } from './labels'

type Policy = Awaited<ReturnType<typeof client.attendance.policies.list>>[number]

// The attendance policies (the user, 2026-11-22): the rules a day is judged by, apart from the shift's timing - the grace,
// the full / half day hours from the first in to the last out, every Nth late day of a month losing its first half, very
// late in / very early out making that half absent. Given on an employee's schedule; without one, the default policy.
// Shared by every company: changing them needs Attendance setup Edit for all companies. Dated (the user, 2026-11-23): a
// change of the rules applies from a date - the days before keep the rules they had.
export function PoliciesSetup({ card: Card }: { card: (props: { title: string; hint?: string; action?: React.ReactNode; children: React.ReactNode }) => React.ReactNode }) {
  const policies = useQuery(orpc.attendance.policies.list.queryOptions({ input: { includeInactive: true } }))
  const canChange = useAccess().coversGroup('ATTENDANCE_SETUP')
  const [editing, setEditing] = useState<Policy | 'new' | null>(null)
  const rules = (p: Policy) =>
    [
      p.latesPerHalfDayCut && `every ${p.latesPerHalfDayCut === 1 ? '' : `${ordinal(p.latesPerHalfDayCut)} `}late = first half absent`,
      p.veryLateMinutes !== null && `in > ${hours(p.veryLateMinutes)} late = first half absent`,
      p.veryEarlyMinutes !== null && `out > ${hours(p.veryEarlyMinutes)} early = second half absent`,
    ].filter(Boolean)
  return (
    <Card
      title="Attendance policies"
      hint="The rules a day is judged by: grace, the hours from the first punch in to the last out for a full and a half day, and the late rules. Given on an employee's schedule - without one, the default policy. A change applies from a date you choose; the days before keep the rules they had."
      action={
        canChange && (
          <Button variant="gold" size="sm" onClick={() => setEditing('new')}>
            <Plus /> Add a policy
          </Button>
        )
      }
    >
      <SharedListNote area="ATTENDANCE_SETUP" label="Attendance setup" what="changing the policies" />
      <FormError error={policies.error} />
      {policies.data?.length === 0 && <EmptyState className="py-6" title="No policies yet" hint="Add the first policy." />}
      <Table className={policies.data?.length === 0 ? 'hidden' : undefined}>
        <TableHeader>
          <TableRow>
            <TableHead>Policy</TableHead>
            <TableHead>Grace</TableHead>
            <TableHead>Full / half day</TableHead>
            <TableHead className="hidden md:table-cell">Late rules</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {policies.isPending && <PolicyRowsSkeleton />}
          {policies.data?.map((p) => (
            <TableRow key={p.id} className={p.isActive ? undefined : 'text-muted-foreground'}>
              <TableCell>
                <span className="font-medium">{p.name}</span>
                <span className="ml-2 inline-flex gap-1">
                  {p.isDefault && <Pill tone="gold">Default</Pill>}
                  {!p.isActive && <Pill tone="neutral">Retired</Pill>}
                  {p.versions.some((x) => x.upcoming) && <Pill tone="info">Changes {formatDate(p.versions.find((x) => x.upcoming)!.effectiveFrom)}</Pill>}
                </span>
                {sinceText(p.from) && <span className="block text-xs text-muted-foreground">{sinceText(p.from)}</span>}
              </TableCell>
              <TableCell className="tabular-nums">{p.graceMinutes}m</TableCell>
              <TableCell className="tabular-nums">
                {p.fullDayMinutes === null ? 'whole shift' : hours(p.fullDayMinutes)} / {hours(p.halfDayMinutes)}
              </TableCell>
              <TableCell className="hidden text-xs text-muted-foreground md:table-cell">{rules(p).join(' · ') || '—'}</TableCell>
              <TableCell className="text-right">
                {canChange && (
                  <Button variant="ghost" size="sm" onClick={() => setEditing(p)}>
                    <Pencil /> Edit
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {editing && <PolicyDialog policy={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </Card>
  )
}

// a version from the start (2000-01-01) has no date worth showing
const FROM_THE_START = Date.UTC(2000, 0, 1)
const sinceText = (from: Date) => (from.getTime() <= FROM_THE_START ? null : `These rules since ${formatDate(from)}`)

// 3 -> "3rd" (the simulation of 2026-11-22 found "3th")
const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')}`

// hours as typed ("9", "4.5") -> minutes; '' -> null
const toMinutes = (text: string) => (text.trim() === '' ? null : Math.round(Number(text) * 60))
const toNumber = (text: string) => (text.trim() === '' ? null : Math.round(Number(text)))

function PolicyDialog({ policy, onClose }: { policy: Policy | null; onClose: () => void }) {
  const queryClient = useQueryClient()
  // what the form opened with - anything different is unsaved input
  const [initial] = useState(() => ({
    name: policy?.name ?? '',
    grace: String(policy?.graceMinutes ?? 10),
    full: policy?.fullDayMinutes === null || policy === null ? '' : String(policy.fullDayMinutes / 60),
    half: String((policy?.halfDayMinutes ?? 240) / 60),
    lates: policy?.latesPerHalfDayCut ? String(policy.latesPerHalfDayCut) : '',
    veryLate: policy?.veryLateMinutes != null ? String(policy.veryLateMinutes) : '',
    veryEarly: policy?.veryEarlyMinutes != null ? String(policy.veryEarlyMinutes) : '',
    isDefault: policy?.isDefault ?? false,
    // the date changed rules apply from (an existing policy - 2026-11-23)
    from: toDateInput(todayDay()),
  }))
  const [v, setV] = useState(initial)
  const dirty = (Object.keys(v) as (keyof typeof v)[]).some((k) => v[k] !== initial[k])
  const RULES = ['grace', 'full', 'half', 'lates', 'veryLate', 'veryEarly'] as const
  const rulesChanged = !!policy && RULES.some((k) => v[k] !== initial[k])
  const past = rulesChanged && !!v.from && fromDateInput(v.from)! < todayDay()
  const done = {
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orpc.attendance.key() })
      onClose()
    },
  }
  const create = useMutation(orpc.attendance.policies.create.mutationOptions(done))
  const update = useMutation(orpc.attendance.policies.update.mutationOptions(done))
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV((x) => ({ ...x, [k]: e.target.value }))
  const data = {
    name: v.name,
    graceMinutes: Number(v.grace) || 0,
    fullDayMinutes: toMinutes(v.full),
    halfDayMinutes: toMinutes(v.half) ?? 0,
    latesPerHalfDayCut: toNumber(v.lates),
    veryLateMinutes: toNumber(v.veryLate),
    veryEarlyMinutes: toNumber(v.veryEarly),
  }
  const field = (id: keyof typeof v, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="space-y-1">
      <Label htmlFor={`po-${id}`} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Input id={`po-${id}`} className="h-9 rounded-xl" value={String(v[id])} onChange={set(id)} {...props} />
    </div>
  )
  return (
    <FormDialog onOpenChange={(open) => !open && onClose()} dirty={dirty} className="rounded-3xl sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{policy ? `Edit ${policy.name}` : 'Add a policy'}</DialogTitle>
        <DialogDescription>{policy ? 'A change of the rules applies from the date you choose below.' : 'Its rules apply once a schedule names it, or it is the default.'}</DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">{field('name', 'Name', { placeholder: 'e.g. Staff, Workers' })}</div>
        {field('grace', 'Grace minutes (late after)', { type: 'number', min: 0, max: 120 })}
        {field('half', 'Half day: hours from in to out', { type: 'number', min: 0, step: 0.5 })}
        {field('full', 'Full day: hours (empty = the whole shift)', { type: 'number', min: 0, step: 0.5, placeholder: 'whole shift' })}
        {field('lates', 'Every Nth late = first half absent (empty = off)', { type: 'number', min: 1, max: 31, placeholder: 'e.g. 3' })}
        {field('veryLate', 'In later than (minutes) = first half absent', { type: 'number', min: 0, placeholder: 'e.g. 120' })}
        {field('veryEarly', 'Out earlier than (minutes) = second half absent', { type: 'number', min: 0, placeholder: 'e.g. 120' })}
      </div>
      <p className="text-xs text-muted-foreground">
        The hours count from the first punch in to the last out, the break inside them. Lates count after the grace, in each calendar month.
      </p>
      {rulesChanged && (
        <div className="space-y-1 rounded-2xl bg-gold-soft/40 p-3">
          <Label htmlFor="po-from" className="text-xs text-muted-foreground">
            The new rules apply from
          </Label>
          <Input id="po-from" type="date" className="h-9 w-48 rounded-xl" value={v.from} onChange={set('from')} />
          <p className="text-xs text-muted-foreground">
            Days before this date keep the rules they had.{past ? ' The days from this date up to today are worked out again now.' : ''}
          </p>
        </div>
      )}
      {policy && policy.versions.length > 1 && (
        <section className="space-y-1">
          <h3 className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">History</h3>
          <ul className="divide-y text-xs">
            {[...policy.versions].reverse().map((x) => (
              <li key={String(x.effectiveFrom)} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-1.5">
                <span className="font-medium">
                  {x.effectiveFrom.getTime() <= FROM_THE_START ? 'From the start' : `From ${formatDate(x.effectiveFrom)}`}
                  {x.current && <span className="ml-1.5 text-positive-ink">in force</span>}
                  {x.upcoming && <span className="ml-1.5 text-info-ink">upcoming</span>}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  grace {x.graceMinutes}m · {x.fullDayMinutes === null ? 'whole shift' : hours(x.fullDayMinutes)} / {hours(x.halfDayMinutes)}
                  {x.by ? ` · ${x.by.name}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {!policy?.isDefault && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={v.isDefault} onChange={(e) => setV((x) => ({ ...x, isDefault: e.target.checked }))} /> The default policy (for employees with none set)
        </label>
      )}
      <FormError error={create.error ?? update.error} />
      <DialogFooter>
        {policy && !policy.isDefault && (
          <Button variant="ghost" className="mr-auto" disabled={update.isPending} onClick={() => update.mutate({ id: policy.id, isActive: !policy.isActive })}>
            {policy.isActive ? 'Retire' : 'Re-activate'}
          </Button>
        )}
        <DialogCancel />
        <Button
          variant="gold"
          disabled={!v.name.trim() || !v.half || (rulesChanged && !v.from) || create.isPending || update.isPending}
          onClick={() => {
            if (!policy) return create.mutate({ ...data, isDefault: v.isDefault })
            // the rules only when changed - then with their date
            const { name, ...rules } = data
            update.mutate({ id: policy.id, name, ...(rulesChanged && { ...rules, effectiveFrom: fromDateInput(v.from)! }), ...(v.isDefault && !policy.isDefault && { isDefault: true as const }) })
          }}
        >
          Save
        </Button>
      </DialogFooter>
    </FormDialog>
  )
}
