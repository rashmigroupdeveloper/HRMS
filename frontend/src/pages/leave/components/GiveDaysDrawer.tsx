import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { useState } from 'react'
import { EmployeePicker, type PickedEmployee } from '@/components/EmployeePicker'
import { FormError } from '@/components/FormError'
import { DrawerCancel, FormDrawer } from '@/components/FormDrawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { orpc } from '@/lib/orpc'
import { cn } from '@/lib/utils'
import { segment, SEGMENTS } from '@/pages/attendance/components/labels'

// HR gives days of a leave type to many at once (the user, 2026-11-24 - e.g. 1 day of election leave to everyone on the
// West Bengal holiday list, or the year's restricted holidays): everyone matching a filter (inside HR's Leave Edit data
// access, employed today or joining later), or the employees chosen. The count is shown before anything is given; each
// gets the days with HR's reason. People joining later get nothing - HR gives it to them too.
const splitCodes = (text: string) =>
  text
    .split(/[\s,;]+/)
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean)

export function GiveDaysDrawer({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const types = useQuery(orpc.leave.types.list.queryOptions({ input: {} }))
  const companies = useQuery(orpc.organization.companies.list.queryOptions())
  const lists = useQuery(orpc.attendance.holidayLists.list.queryOptions({ input: {} }))
  const [typeId, setTypeId] = useState('')
  const [days, setDays] = useState('1')
  const [note, setNote] = useState('')
  const [who, setWho] = useState<'MATCHING' | 'CHOSEN'>('MATCHING')
  const [companyId, setCompanyId] = useState('')
  const [plantId, setPlantId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [listId, setListId] = useState('')
  const [people, setPeople] = useState<PickedEmployee[]>([])
  const [picker, setPicker] = useState(0)
  const [pasted, setPasted] = useState('')
  const plants = useQuery({ ...orpc.organization.plants.list.queryOptions({ input: { companyId: Number(companyId) } }), enabled: !!companyId })
  const departments = useQuery(orpc.organization.departments.list.queryOptions({ input: plantId ? { plantId: Number(plantId) } : {} }))
  const one = (v: string) => (v ? [Number(v)] : undefined)
  const codes = [...new Set([...people.map((p) => p.employeeCode), ...splitCodes(pasted)])]
  const target =
    who === 'CHOSEN'
      ? codes.length
        ? { employeeCodes: codes }
        : null
      : { companyIds: one(companyId), plantIds: one(plantId), departmentIds: one(departmentId), holidayListIds: one(listId) }
  const amount = Number(days)
  const input = typeId && target && amount > 0 ? { leaveTypeId: Number(typeId), days: amount, note: note.trim().length >= 5 ? note.trim() : 'Counting only', ...target } : null
  // the count first - nothing is given until Save
  const count = useQuery({ ...orpc.leave.balances.giveMany.queryOptions({ input: { ...input!, dryRun: true } }), enabled: !!input, placeholderData: keepPreviousData })
  const give = useMutation(orpc.leave.balances.giveMany.mutationOptions({ onSuccess: () => void queryClient.invalidateQueries({ queryKey: orpc.leave.key() }) }))
  const type = types.data?.find((t) => String(t.id) === typeId)
  const dirty = !!typeId || days !== '1' || !!note.trim() || who !== 'MATCHING' || !!companyId || !!plantId || !!departmentId || !!listId || people.length > 0 || !!pasted.trim()
  const c = input ? count.data : undefined
  return (
    <FormDrawer
      onClose={onClose}
      closed={give.isSuccess}
      dirty={dirty && !give.isSuccess}
      width={560}
      title="Give days"
      description="Days of a leave type to many at once - e.g. one day of election leave to everyone on a state's holiday list. Each gets them with your reason."
      footer={
        <>
          <DrawerCancel />
          <Button variant="gold" disabled={!input || note.trim().length < 5 || !c?.toGive || count.isFetching || give.isPending} onClick={() => input && give.mutate({ ...input, note: note.trim() })}>
            {give.isPending ? 'Giving…' : c?.toGive ? `Give ${c.toGive} employee${c.toGive === 1 ? '' : 's'} ${amount} day${amount === 1 ? '' : 's'}` : 'Give'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
          <div className="space-y-1">
            <Label htmlFor="gd-type" className="text-xs text-muted-foreground">
              Leave type
            </Label>
            <NativeSelect id="gd-type" className="w-full [&_select]:h-10 [&_select]:rounded-xl" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
              <NativeSelectOption value="">{types.isPending ? 'Loading…' : 'Choose…'}</NativeSelectOption>
              {types.data
                ?.filter((t) => t.isPaid)
                .map((t) => (
                  <NativeSelectOption key={t.id} value={String(t.id)}>
                    {t.name} ({t.code})
                  </NativeSelectOption>
                ))}
            </NativeSelect>
          </div>
          <div className="space-y-1">
            <Label htmlFor="gd-days" className="text-xs text-muted-foreground">
              Days each
            </Label>
            <Input id="gd-days" type="number" min={0.5} step={0.5} className="h-10 rounded-xl" value={days} onChange={(e) => setDays(e.target.value)} />
          </div>
        </div>
        {type?.holidaysOnly && <p className="text-xs text-muted-foreground">{type.name} is taken only on its holiday dates; what is left lapses at the year end.</p>}
        <div className="space-y-1">
          <Label htmlFor="gd-note" className="text-xs text-muted-foreground">
            Reason
          </Label>
          <Textarea id="gd-note" className="min-h-16 rounded-xl" placeholder="e.g. West Bengal election 2026 - one day" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        <div className="space-y-2">
          <div className={SEGMENTS}>
            {(
              [
                ['MATCHING', 'Everyone matching'],
                ['CHOSEN', 'Chosen employees'],
              ] as const
            ).map(([value, label]) => (
              <button key={value} type="button" aria-pressed={who === value} onClick={() => setWho(value)} className={segment(who === value)}>
                {label}
              </button>
            ))}
          </div>
          {who === 'MATCHING' ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <NativeSelect
                aria-label="Company"
                className="w-full [&_select]:h-10 [&_select]:rounded-xl"
                value={companyId}
                onChange={(e) => {
                  setCompanyId(e.target.value)
                  setPlantId('')
                  setDepartmentId('')
                }}
              >
                <NativeSelectOption value="">Every company</NativeSelectOption>
                {companies.data?.map((co) => (
                  <NativeSelectOption key={co.id} value={String(co.id)}>
                    {co.code}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <NativeSelect aria-label="Plant" className="w-full [&_select]:h-10 [&_select]:rounded-xl" value={plantId} disabled={!companyId} onChange={(e) => setPlantId(e.target.value)}>
                <NativeSelectOption value="">{companyId ? 'Every plant' : 'Plant (pick a company)'}</NativeSelectOption>
                {plants.data?.map((p) => (
                  <NativeSelectOption key={p.id} value={String(p.id)}>
                    {p.plantCode} {p.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <NativeSelect aria-label="Department" className="w-full [&_select]:h-10 [&_select]:rounded-xl" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
                <NativeSelectOption value="">Every department</NativeSelectOption>
                {departments.data?.map((d) => (
                  <NativeSelectOption key={d.id} value={String(d.id)}>
                    {d.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <NativeSelect aria-label="Holiday list" className="w-full [&_select]:h-10 [&_select]:rounded-xl" value={listId} onChange={(e) => setListId(e.target.value)}>
                <NativeSelectOption value="">Every holiday list</NativeSelectOption>
                {lists.data?.map((l) => (
                  <NativeSelectOption key={l.id} value={String(l.id)}>
                    {l.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          ) : (
            <div className="space-y-2">
              <EmployeePicker
                key={picker}
                value=""
                onChange={(p) => {
                  if (p && !people.some((x) => x.employeeCode === p.employeeCode)) setPeople((l) => [...l, p])
                  setPicker((n) => n + 1)
                }}
                placeholder="Add an employee…"
              />
              <textarea
                className="min-h-16 w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm"
                placeholder="…or paste employee codes (one per line or comma-separated)"
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
              />
              {people.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {people.map((p) => (
                    <span key={p.employeeCode} className="inline-flex items-center gap-1 rounded-full bg-gold-soft py-0.5 pr-1 pl-2.5 text-xs">
                      {p.name} ({p.employeeCode})
                      <button
                        type="button"
                        aria-label={`Remove ${p.name}`}
                        onClick={() => setPeople((l) => l.filter((x) => x.employeeCode !== p.employeeCode))}
                        className="grid size-4 place-items-center rounded-full hover:bg-foreground/10"
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* the count before anything is given */}
        {c && (
          <p className={cn('rounded-2xl px-3 py-2 text-sm', c.toGive ? 'bg-surface-2/70' : 'bg-warning/15 text-warning-ink')}>
            {c.toGive
              ? `${c.toGive} employee${c.toGive === 1 ? '' : 's'} will get ${amount} day${amount === 1 ? '' : 's'} of ${type?.code ?? 'this leave'}.`
              : 'Nobody matches - change the filters.'}
            {c.notForThem > 0 && ` ${c.notForThem} left out: the type is not for them (gender / employment type).`}
          </p>
        )}
        <FormError error={(input ? count.error : null) ?? give.error} />
      </div>
    </FormDrawer>
  )
}
