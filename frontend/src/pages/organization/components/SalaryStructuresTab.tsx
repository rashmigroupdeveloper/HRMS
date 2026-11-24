import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { DrawerCancel, FormDrawer } from '@/components/FormDrawer'
import { FormError } from '@/components/FormError'
import { SalaryStructuresSkeleton } from '@/components/skeletons/organization/SalaryStructuresSkeleton'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { useAccess } from '@/hooks/useAccess'
import { useSettled } from '@/hooks/useSettled'
import { EMPLOYMENT_TYPE, JOINING_TYPE, WORKFORCE } from '@/lib/choices'
import { client, orpc } from '@/lib/orpc'
import { cn, errorMessage, formatMoney, sumMoney } from '@/lib/utils'

// Salary structures (the user, 2026-11-24 - HR's "CTC Structure" sheet): how an offer's breakup is worked out from its
// CTC, one per type of employee. HR changes a percentage here; offers already made keep their amounts.

type Structure = Awaited<ReturnType<typeof client.organization.salaryStructures.list>>[number]
type Method = Structure['lines'][number]['method']
type Component = Awaited<ReturnType<typeof client.organization.salaryComponents.list>>[number]

const METHOD_LABEL: Record<Method, string> = {
  PERCENT_OF_GROSS: '% of gross',
  PERCENT_OF_BASIC: '% of Basic',
  PERCENT_OF_CTC: '% of CTC',
  FIXED: 'Fixed amount',
  BALANCE: 'Balance',
}
const PERCENT: Method[] = ['PERCENT_OF_CTC', 'PERCENT_OF_GROSS', 'PERCENT_OF_BASIC']
const inr = (n: number) => formatMoney(n, 'INR')

// "50% of gross", "₹1,250 a month", "8.33% of Basic (of at least ₹7,000)", "3.25% of gross - only if the gross is at most ₹21,000"
function ruleText(line: Pick<Structure['lines'][number], 'method' | 'value' | 'minimumBase' | 'onlyIfGrossAtMost'>) {
  const main =
    line.method === 'BALANCE' ? 'Balance - what is left of the CTC' : line.method === 'FIXED' ? `${inr(line.value ?? 0)} a month` : `${line.value}${METHOD_LABEL[line.method]}`
  return [main, line.minimumBase != null && `of at least ${inr(line.minimumBase)}`, line.onlyIfGrossAtMost != null && `only if the gross is at most ${inr(line.onlyIfGrossAtMost)}`]
    .filter(Boolean)
    .join(' · ')
}

// "Regular · any employment type · White collar (staff)"
const forText = (s: Pick<Structure, 'joiningType' | 'employmentType' | 'workforceCategory'>) =>
  [
    s.joiningType ? JOINING_TYPE[s.joiningType] : 'any joining type',
    s.employmentType ? EMPLOYMENT_TYPE[s.employmentType] : 'any employment type',
    s.workforceCategory ? WORKFORCE[s.workforceCategory] : 'any workforce',
  ].join(' · ')

export function SalaryStructuresTab({ canChange }: { canChange: boolean }) {
  // shared by every company: changing one needs Organization Edit for all companies (the backend checks the same)
  const group = useAccess().coversGroup('ORGANIZATION')
  const mayChange = canChange && group
  const structures = useQuery(orpc.organization.salaryStructures.list.queryOptions({ input: { includeInactive: true } }))
  const [editing, setEditing] = useState<Structure | 'new' | null>(null)
  const rows = [...(structures.data ?? [])].sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name))

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-2xl">
          <h2 className="text-lg font-light tracking-tight">Salary structures</h2>
          <p className="text-xs text-muted-foreground">
            How an offer's salary breakup is worked out from its CTC - one per type of employee, picked by the offer's joining type, employment type and
            workforce. Changing one changes new offers only; offers already made keep their amounts. Shared by every company.
          </p>
        </div>
        {mayChange && (
          <Button size="sm" variant="gold" onClick={() => setEditing('new')}>
            <Plus className="size-4" />
            Add structure
          </Button>
        )}
      </div>
      <FormError error={structures.error} />
      {structures.isPending ? (
        <SalaryStructuresSkeleton canEdit={mayChange} label="Loading salary structures" />
      ) : rows.length === 0 ? (
        <p className="rounded-2xl bg-card p-4 text-sm text-muted-foreground shadow-card">No salary structures yet - every offer's breakup is typed by hand.</p>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-2">
          {rows.map((s) => (
            <article key={s.id} className={cn('rounded-2xl bg-card p-4 shadow-card', !s.isActive && 'opacity-60')}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="flex items-center gap-2 font-medium">
                    {s.name}
                    {!s.isActive && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-normal text-muted-foreground">Retired</span>}
                  </h3>
                  <p className="text-xs text-muted-foreground">For: {forText(s)}</p>
                </div>
                {mayChange && (
                  <Button size="icon-sm" variant="ghost" aria-label={`Change ${s.name}`} onClick={() => setEditing(s)}>
                    <Pencil className="size-4" />
                  </Button>
                )}
              </div>
              <table className="mt-2 w-full text-sm">
                <tbody>
                  {s.lines.map((l) => (
                    <tr key={l.salaryComponentId} className="border-t border-dashed border-border/80">
                      <td className="py-1 pr-3">
                        {l.salaryComponent.name}
                        {l.salaryComponentId === s.basicComponentId && <span className="ml-1.5 text-[11px] text-muted-foreground">(Basic)</span>}
                      </td>
                      <td className="py-1 text-right text-muted-foreground">{ruleText(l)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>
          ))}
        </div>
      )}
      {editing && <StructureDrawer structure={editing === 'new' ? undefined : editing} onDone={() => setEditing(null)} />}
    </section>
  )
}

// --- The editor ---

type DraftLine = { key: number; salaryComponentId: string; method: Method; value: string; minimumBase: string; onlyIfGrossAtMost: string }
type Draft = {
  name: string
  joiningType: string
  employmentType: string
  workforceCategory: string
  basicComponentId: string
  isActive: boolean
  lines: DraftLine[]
}

let nextKey = 1
const text = (n: number | null | undefined) => (n == null ? '' : String(n))
const draftOf = (s?: Structure): Draft => ({
  name: s?.name ?? '',
  joiningType: s?.joiningType ?? '',
  employmentType: s?.employmentType ?? '',
  workforceCategory: s?.workforceCategory ?? '',
  basicComponentId: text(s?.basicComponentId),
  isActive: s?.isActive ?? true,
  lines: (s?.lines ?? []).map((l) => ({
    key: nextKey++,
    salaryComponentId: String(l.salaryComponentId),
    method: l.method,
    value: text(l.value),
    minimumBase: text(l.minimumBase),
    onlyIfGrossAtMost: text(l.onlyIfGrossAtMost),
  })),
})
const numberOrNull = (v: string) => (v.trim() === '' ? null : Number(v))
const linesInput = (lines: DraftLine[]) =>
  lines
    .filter((l) => l.salaryComponentId)
    .map((l) => ({
      salaryComponentId: Number(l.salaryComponentId),
      method: l.method,
      value: l.method === 'BALANCE' ? null : numberOrNull(l.value),
      minimumBase: PERCENT.includes(l.method) ? numberOrNull(l.minimumBase) : null,
      onlyIfGrossAtMost: l.method === 'BALANCE' ? null : numberOrNull(l.onlyIfGrossAtMost),
    }))
const decimal = (v: string) => v.replace(/[^\d.]/g, '').replace(/^(\d*\.?\d{0,2}).*$/, '$1')
const whole = (v: string) => v.replace(/\D/g, '').slice(0, 9)

function StructureDrawer({ structure, onDone }: { structure?: Structure; onDone: () => void }) {
  const queryClient = useQueryClient()
  const [initial] = useState(() => draftOf(structure))
  const [draft, setDraft] = useState(initial)
  const [exampleCtc, setExampleCtc] = useState('300000')
  const components = useQuery(orpc.organization.salaryComponents.list.queryOptions())
  // earnings and employer contributions only - a deduction is never part of a breakup; plus any retired one it still uses
  const usable: Pick<Component, 'id' | 'name' | 'kind'>[] = (components.data ?? []).filter((c) => c.kind !== 'DEDUCTION')
  for (const l of structure?.lines ?? []) if (!usable.some((c) => c.id === l.salaryComponentId)) usable.push(l.salaryComponent)

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))
  const setLine = (key: number, patch: Partial<DraftLine>) => setDraft((d) => ({ ...d, lines: d.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) }))
  const lines = linesInput(draft.lines)
  const basicId = numberOrNull(draft.basicComponentId)

  // the live example: the breakup this draft gives for a CTC, worked out by the backend when HR stops typing
  const example = JSON.parse(useSettled(JSON.stringify({ annualCtc: Number(exampleCtc) || 0, lines, basicComponentId: basicId }))) as {
    annualCtc: number
    lines: typeof lines
    basicComponentId: number | null
  }
  const calculated = useQuery({
    ...orpc.organization.salaryStructures.calculate.queryOptions({
      input: { annualCtc: example.annualCtc, draft: { basicComponentId: example.basicComponentId, lines: example.lines } },
    }),
    enabled: example.annualCtc > 0 && example.lines.length > 0,
    retry: false,
  })
  const nameOf = (id: number) => usable.find((c) => c.id === id)?.name ?? '?'

  const done = () => {
    void queryClient.invalidateQueries({ queryKey: orpc.organization.key() })
    onDone()
  }
  const save = useMutation({
    mutationFn: () => {
      const fields = {
        name: draft.name.trim(),
        joiningType: (draft.joiningType || null) as Structure['joiningType'],
        employmentType: (draft.employmentType || null) as Structure['employmentType'],
        workforceCategory: (draft.workforceCategory || null) as Structure['workforceCategory'],
        basicComponentId: basicId,
        lines,
      }
      return structure ? client.organization.salaryStructures.update({ id: structure.id, ...fields, isActive: draft.isActive }) : client.organization.salaryStructures.create(fields)
    },
    onSuccess: done,
  })
  const dirty = JSON.stringify({ ...draft, lines: linesInput(draft.lines) }) !== JSON.stringify({ ...initial, lines: linesInput(initial.lines) })
  const select = (id: string, label: string, value: string, onChange: (v: string) => void, options: [string, string][], anyLabel: string) => (
    <label htmlFor={id} className="space-y-1 text-sm">
      <span className="text-xs text-muted-foreground">{label}</span>
      <NativeSelect id={id} className="w-full [&_select]:h-9" value={value} onChange={(e) => onChange(e.target.value)}>
        <NativeSelectOption value="">{anyLabel}</NativeSelectOption>
        {options.map(([v, l]) => (
          <NativeSelectOption key={v} value={v}>
            {l}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </label>
  )

  return (
    <FormDrawer
      onClose={onDone}
      dirty={dirty}
      width={840}
      title={structure ? `Change "${structure.name}"` : 'New salary structure'}
      description="Offers made from now on use it; offers already made keep their amounts."
      footer={
        <>
          <DrawerCancel />
          <Button variant="gold" disabled={save.isPending || !draft.name.trim() || lines.length === 0} onClick={() => save.mutate()}>
            {save.isPending ? 'Saving…' : structure ? 'Save changes' : 'Add structure'}
          </Button>
        </>
      }
    >
      <section className="space-y-3">
        <label htmlFor="structure-name" className="block space-y-1 text-sm">
          <span className="text-xs text-muted-foreground">Name</span>
          <Input id="structure-name" className="rounded-xl" value={draft.name} placeholder="e.g. Regular - White collar" onChange={(e) => set({ name: e.target.value })} />
        </label>
        <div>
          <p className="text-xs font-medium text-muted-foreground">For which offers - each left on "any" fits every offer</p>
          <div className="mt-1 grid gap-3 sm:grid-cols-3">
            {select('structure-joining', 'Joining type', draft.joiningType, (v) => set({ joiningType: v }), Object.entries(JOINING_TYPE), 'Any joining type')}
            {select('structure-employment', 'Employment type', draft.employmentType, (v) => set({ employmentType: v }), Object.entries(EMPLOYMENT_TYPE), 'Any employment type')}
            {select('structure-workforce', 'Workforce', draft.workforceCategory, (v) => set({ workforceCategory: v }), Object.entries(WORKFORCE), 'Any workforce')}
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="flex items-center gap-3 text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase after:h-px after:flex-1 after:bg-border">Lines</h3>
        <p className="text-xs text-muted-foreground">
          One balance line (an earning, e.g. Special Allowance) takes what is left, so the lines always add up to the CTC. "% of Basic" needs the Basic chosen below.
        </p>
        <div className="hidden grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)_5rem_5.5rem_6rem_2rem] gap-2 text-xs text-muted-foreground sm:grid">
          <span>Component</span>
          <span>How</span>
          <span>Value</span>
          <span title="The percentage applies to at least this amount">Min. base</span>
          <span title="Only while the Monthly Gross is at most this">If gross ≤</span>
          <span />
        </div>
        {draft.lines.map((l) => (
          <div key={l.key} className="grid grid-cols-2 gap-2 rounded-xl border border-border/70 p-2 sm:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)_5rem_5.5rem_6rem_2rem] sm:border-0 sm:p-0">
            <NativeSelect aria-label="Component" className="col-span-2 w-full sm:col-span-1 [&_select]:h-9" value={l.salaryComponentId} onChange={(e) => setLine(l.key, { salaryComponentId: e.target.value })}>
              <NativeSelectOption value="">Choose…</NativeSelectOption>
              {usable.map((c) => (
                <NativeSelectOption key={c.id} value={String(c.id)}>
                  {c.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <NativeSelect aria-label="How it is worked out" className="col-span-2 w-full sm:col-span-1 [&_select]:h-9" value={l.method} onChange={(e) => setLine(l.key, { method: e.target.value as Method })}>
              {Object.entries(METHOD_LABEL).map(([v, label]) => (
                <NativeSelectOption key={v} value={v}>
                  {label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <label className="space-y-0.5">
            <span className="text-[11px] text-muted-foreground sm:hidden">Value</span>
            <Input
              aria-label={l.method === 'FIXED' ? 'Amount a month' : 'Percentage'}
              inputMode="decimal"
              className="h-9 rounded-xl text-right tabular-nums"
              placeholder={l.method === 'BALANCE' ? '—' : l.method === 'FIXED' ? '₹ a month' : '%'}
              disabled={l.method === 'BALANCE'}
              value={l.method === 'BALANCE' ? '' : l.value}
              onChange={(e) => setLine(l.key, { value: decimal(e.target.value) })}
            />
            </label>
            <label className="space-y-0.5">
            <span className="text-[11px] text-muted-foreground sm:hidden">Min. base</span>
            <Input
              aria-label="Minimum base"
              inputMode="numeric"
              className="h-9 rounded-xl text-right tabular-nums"
              placeholder="—"
              disabled={!PERCENT.includes(l.method)}
              value={PERCENT.includes(l.method) ? l.minimumBase : ''}
              onChange={(e) => setLine(l.key, { minimumBase: whole(e.target.value) })}
            />
            </label>
            <label className="space-y-0.5">
            <span className="text-[11px] text-muted-foreground sm:hidden">If gross ≤</span>
            <Input
              aria-label="Only if the gross is at most"
              inputMode="numeric"
              className="h-9 rounded-xl text-right tabular-nums"
              placeholder="—"
              disabled={l.method === 'BALANCE'}
              value={l.method === 'BALANCE' ? '' : l.onlyIfGrossAtMost}
              onChange={(e) => setLine(l.key, { onlyIfGrossAtMost: whole(e.target.value) })}
            />
            </label>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className="self-end justify-self-end"
              aria-label="Remove the line"
              onClick={() => setDraft((d) => ({ ...d, lines: d.lines.filter((x) => x.key !== l.key) }))}
            >
              <X className="size-4" />
            </Button>
          </div>
        ))}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setDraft((d) => ({ ...d, lines: [...d.lines, { key: nextKey++, salaryComponentId: '', method: 'FIXED', value: '', minimumBase: '', onlyIfGrossAtMost: '' }] }))}
          >
            <Plus className="size-4" />
            Add line
          </Button>
          <label htmlFor="structure-basic" className="min-w-56 space-y-1 text-sm">
            <span className="text-xs text-muted-foreground">Which line is the Basic</span>
            <NativeSelect id="structure-basic" className="w-full [&_select]:h-9" value={draft.basicComponentId} onChange={(e) => set({ basicComponentId: e.target.value })}>
              <NativeSelectOption value="">None</NativeSelectOption>
              {lines.map((l) => (
                <NativeSelectOption key={l.salaryComponentId} value={String(l.salaryComponentId)}>
                  {nameOf(l.salaryComponentId)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
        </div>
      </section>

      <section className="space-y-2 rounded-2xl border bg-surface-2/40 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium">Example</h3>
          <label htmlFor="structure-example" className="flex items-center gap-2 text-xs text-muted-foreground">
            Annual CTC
            <Input id="structure-example" inputMode="numeric" className="h-8 w-32 rounded-xl text-right tabular-nums" value={exampleCtc} onChange={(e) => setExampleCtc(whole(e.target.value))} />
          </label>
        </div>
        {!(example.annualCtc > 0 && example.lines.length > 0) ? (
          <p className="text-xs text-muted-foreground">Add lines and a CTC to see the breakup they give.</p>
        ) : calculated.error ? (
          <p role="alert" className="text-xs text-negative-ink">
            {errorMessage(calculated.error)}
          </p>
        ) : (
          <table className="w-full text-sm tabular-nums" aria-busy={calculated.isPending}>
            <tbody className={cn(calculated.isPending && 'opacity-50')}>
              {(calculated.data?.lines ?? []).map((l) => (
                <tr key={l.salaryComponentId} className="border-b border-dashed border-border/80">
                  <td className="py-1">{nameOf(l.salaryComponentId)}</td>
                  <td className="py-1 text-right">{inr(l.monthlyAmount)}</td>
                </tr>
              ))}
              {calculated.data && (
                <tr className="font-semibold">
                  <td className="pt-2">Total a month</td>
                  <td className="pt-2 text-right">{inr(sumMoney(calculated.data.lines.map((l) => l.monthlyAmount)))}</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </section>

      {structure && (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={draft.isActive} onCheckedChange={(v) => set({ isActive: v === true })} />
          In use - untick to retire it (offers of its kind are then typed by hand)
        </label>
      )}
      <FormError error={save.error} />
    </FormDrawer>
  )
}
