import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { useState } from 'react'
import { EmployeePicker, type PickedEmployee } from '@/components/EmployeePicker'
import { FormError } from '@/components/FormError'
import { DrawerCancel, FormDrawer } from '@/components/FormDrawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { orpc } from '@/lib/orpc'
import { fromDateInput, toDateInput, todayDay } from '@/lib/utils'

// Gives employees a holiday list from a date (the user, 2026-11-24) - one person or many (ticked on Schedules, or added
// here) - in a drawer, so unsaved input is never lost by accident. The days before the date keep the list they had.
export type HolidayListStart = { people: PickedEmployee[]; holidayListId: string }

const splitCodes = (text: string) =>
  text
    .split(/[\s,;]+/)
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean)

export function HolidayListDrawer({ start, onClose, onSaved }: { start: HolidayListStart; onClose: () => void; onSaved?: () => void }) {
  const queryClient = useQueryClient()
  const lists = useQuery(orpc.attendance.holidayLists.list.queryOptions({ input: {} }))
  const [people, setPeople] = useState(start.people)
  const [picker, setPicker] = useState(0)
  const [pasted, setPasted] = useState('')
  const [holidayListId, setHolidayListId] = useState(start.holidayListId)
  const [initialFrom] = useState(() => toDateInput(todayDay()))
  const [from, setFrom] = useState(initialFrom)
  const assign = useMutation(
    orpc.attendance.holidayLists.assign.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: orpc.attendance.key() })
        onSaved?.()
      },
    }),
  )
  const codes = [...new Set([...people.map((p) => p.employeeCode), ...splitCodes(pasted)])]
  // a long list of names is folded (all ticked after a filter can be hundreds)
  const [showAll, setShowAll] = useState(false)
  const FOLD = 12
  const dirty =
    people.map((p) => p.employeeCode).join() !== start.people.map((p) => p.employeeCode).join() || pasted.trim() !== '' || holidayListId !== start.holidayListId || from !== initialFrom
  const one = start.people.length === 1 ? start.people[0]! : null
  return (
    <FormDrawer
      onClose={onClose}
      closed={assign.isSuccess}
      dirty={dirty && !assign.isSuccess}
      width={520}
      title={one ? `Holiday list of ${one.name}` : start.people.length ? `Holiday list of ${start.people.length} employees` : 'Give a holiday list'}
      description={one ? `${one.employeeCode} · from the date below until changed again` : 'The same list for everyone below, from the date below until changed again'}
      footer={
        <>
          <DrawerCancel />
          <Button
            variant="gold"
            disabled={!codes.length || !holidayListId || !from || assign.isPending}
            onClick={() => assign.mutate({ employeeCodes: codes, holidayListId: Number(holidayListId), effectiveFrom: fromDateInput(from)! })}
          >
            {assign.isPending ? 'Saving…' : one && codes.length === 1 ? 'Save' : `Set for ${codes.length} employee${codes.length === 1 ? '' : 's'}`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Employees</Label>
          <EmployeePicker
            key={picker}
            value=""
            onChange={(p) => {
              if (p && !people.some((x) => x.employeeCode === p.employeeCode)) setPeople((list) => [...list, p])
              setPicker((n) => n + 1)
            }}
            placeholder="Add an employee…"
          />
          {!one && (
            <textarea
              className="min-h-16 w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm"
              placeholder="…or paste employee codes (one per line or comma-separated)"
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
            />
          )}
          {people.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {(showAll ? people : people.slice(0, FOLD)).map((p) => (
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
              {people.length > FOLD && (
                <button type="button" className="text-xs font-medium underline-offset-4 hover:underline" onClick={() => setShowAll((v) => !v)}>
                  {showAll ? 'Show fewer' : `+${people.length - FOLD} more`}
                </button>
              )}
            </div>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="hld-list" className="text-xs text-muted-foreground">
              Holiday list
            </Label>
            <NativeSelect id="hld-list" className="w-full [&_select]:h-10 [&_select]:rounded-xl" value={holidayListId} onChange={(e) => setHolidayListId(e.target.value)}>
              <NativeSelectOption value="">{lists.isPending ? 'Loading…' : 'Choose…'}</NativeSelectOption>
              {lists.data?.map((l) => (
                <NativeSelectOption key={l.id} value={String(l.id)}>
                  {l.name} ({l.company?.code ?? 'every company'})
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1">
            <Label htmlFor="hld-from" className="text-xs text-muted-foreground">
              From
            </Label>
            <Input id="hld-from" type="date" className="h-10 rounded-xl" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">A company&apos;s list is only for its own employees. The days before the date keep the list they had.</p>
        <FormError error={assign.error} />
      </div>
    </FormDrawer>
  )
}
