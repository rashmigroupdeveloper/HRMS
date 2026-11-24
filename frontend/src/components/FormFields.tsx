import { CircleCheck, type LucideIcon, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { FormError } from '@/components/FormError'
import { SearchableSelect } from '@/components/SearchableSelect'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { type FieldDef, type FormValues, fromFormValues, isShown, toFormValues } from '@/lib/form-values'

// Form building blocks (onboarding, the candidate's joining-form page). Fields are described in lib/form-values.ts.

export function FieldInput({
  field,
  value,
  onChange,
  disabled,
  idPrefix = '',
}: {
  field: FieldDef
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  // keeps ids unique when the same fields appear more than once on a page (e.g. "present-", "permanent-")
  idPrefix?: string
}) {
  const id = `field-${idPrefix}${field.name}`
  const off = disabled || field.disabled
  const control = (() => {
    switch (field.type) {
      case 'select':
      case 'yesno': {
        // a yes / no field may word its two answers itself (options with the values 'yes' / 'no' - e.g. to avoid a
        // double negative, 2026-11-20); the answer stored stays true / false
        const opts = field.type === 'yesno' ? (field.options ?? [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]) : (field.options ?? [])
        // a styled list (the browser's own one cannot be styled); an optional field can be emptied again with "—"
        return (
          <Select items={opts} value={value || null} disabled={off} onValueChange={(v) => onChange(v ?? '')}>
            <SelectTrigger
              id={id}
              className="w-full rounded-xl bg-card px-3 text-sm hover:border-foreground/25 data-popup-open:border-gold data-popup-open:ring-3 data-popup-open:ring-gold/25 data-[size=default]:h-9"
            >
              <SelectValue placeholder={field.required ? 'Select…' : '—'} />
            </SelectTrigger>
            {/* as wide as the longest option (never narrower than the field, never off the screen), so long names show in full */}
            <SelectContent
              alignItemWithTrigger={false}
              sideOffset={6}
              className="w-max max-w-[min(32rem,calc(100vw-2rem))] min-w-(--anchor-width) rounded-2xl p-1.5 shadow-float ring-border"
            >
              {!field.required && (
                <SelectItem value={null} className="rounded-xl py-2 pl-3 text-muted-foreground">
                  —
                </SelectItem>
              )}
              {opts.map((o) => (
                <SelectItem key={o.value} value={o.value} className="rounded-xl py-2 pl-3 whitespace-normal data-selected:font-medium">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      }
      case 'search':
        return (
          <SearchableSelect
            id={id}
            value={value}
            onChange={onChange}
            options={field.options ?? []}
            allowCustom={field.allowCustom}
            disabled={off}
            placeholder={field.placeholder ?? (field.allowCustom ? 'Type or pick…' : 'Type to search…')}
            className="h-9 w-full rounded-xl bg-card"
          />
        )
      case 'checks': {
        // tick boxes: any number of the options
        const chosen = new Set(value ? value.split(',') : [])
        return (
          <div id={id} className="flex flex-wrap gap-x-5 gap-y-2 pt-1">
            {(field.options ?? []).map((o) => (
              <label key={o.value} className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={chosen.has(o.value)}
                  disabled={off}
                  onCheckedChange={(checked) => {
                    const next = new Set(chosen)
                    if (checked) next.add(o.value)
                    else next.delete(o.value)
                    onChange(field.options!.filter((x) => next.has(x.value)).map((x) => x.value).join(','))
                  }}
                />
                {o.label}
              </label>
            ))}
          </div>
        )
      }
      case 'checkbox':
        // one tick that must be given (a consent): its text is the placeholder
        return (
          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl bg-surface-2/60 p-3 text-sm">
            <Checkbox id={id} className="mt-0.5" checked={value === 'yes'} disabled={off} onCheckedChange={(checked) => onChange(checked === true ? 'yes' : '')} />
            <span>{field.placeholder}</span>
          </label>
        )
      case 'textarea':
        return <Textarea id={id} className="rounded-xl" value={value} disabled={off} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />
      default:
        return (
          <Input
            id={id}
            type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'email' ? 'email' : 'text'}
            // read-only: plainly readable (not faded like a disabled field), on a tinted background
            className={cn('h-9 rounded-xl', field.readOnly && 'cursor-default border-transparent bg-surface-2/80 focus-visible:ring-0')}
            value={value}
            readOnly={field.readOnly}
            disabled={off}
            placeholder={field.placeholder}
            onChange={(e) => onChange(e.target.value)}
          />
        )
    }
  })()
  return (
    <div className={cn('min-w-0 space-y-1', field.wide && '@md:col-span-2')}>
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {field.label}
        {field.required && <span className="text-negative-ink">*</span>}
      </Label>
      {control}
      {field.hint && <p className="text-xs leading-snug text-muted-foreground">{field.hint}</p>}
    </div>
  )
}

export function FieldsGrid({
  fields,
  values,
  onChange,
  disabled,
  idPrefix,
}: {
  fields: FieldDef[]
  values: FormValues
  onChange: (name: string, value: string) => void
  disabled?: boolean
  idPrefix?: string
}) {
  // fields that do not apply to the answers so far are left out (e.g. the spouse's name for someone single)
  const shown = fields.filter((field) => isShown(field, values))
  // a field may fill others when it changes (see FieldDef.fills)
  const change = (field: FieldDef, value: string) => {
    onChange(field.name, value)
    for (const [name, filled] of Object.entries(field.fills?.(value, values) ?? {})) onChange(name, filled)
  }
  const input = (field: FieldDef) => <FieldInput key={field.name} field={field} value={values[field.name] ?? ''} onChange={(v) => change(field, v)} disabled={disabled} idPrefix={idPrefix} />
  // columns by the room the form has (container queries), not the screen: 1 on a phone, up to 4 in a wide card
  const grid = (list: FieldDef[]) => (
    <div className="@container">
      <div className="grid gap-x-3 gap-y-2.5 @md:grid-cols-2 @lg:grid-cols-3 @2xl:grid-cols-4">{list.map(input)}</div>
    </div>
  )

  const groups: { name: string; fields: FieldDef[] }[] = []
  for (const field of shown) {
    const name = field.group ?? ''
    if (groups.at(-1)?.name === name) groups.at(-1)!.fields.push(field)
    else groups.push({ name, fields: [field] })
  }
  if (groups.length <= 1 && !groups[0]?.name) return grid(shown)
  // a long form with sub-headings: one block per group - its name on the left when there is room, else above
  return (
    <div className="divide-y divide-border/60 @container/form">
      {groups.map((group) => (
        <div key={group.name} className="grid gap-x-5 gap-y-2 py-3 first:pt-0 last:pb-0 @2xl/form:grid-cols-[6.5rem_minmax(0,1fr)]">
          <p className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase @2xl/form:pt-6">{group.name}</p>
          {grid(group.fields)}
        </div>
      ))}
    </div>
  )
}

type SaveState = { pending: boolean; error: unknown; saved: boolean }

// What every section card can show in its header besides the title
export type ShellProps = {
  title: string
  description?: string
  // an icon in front of the title
  icon?: LucideIcon
  // something on the right of the title, e.g. a "Saved" pill
  badge?: React.ReactNode
}

// The box around a section: a card with a header (icon, title, description, badge), or nothing (`bare` - the caller
// draws the card)
export function SectionShell({ bare, title, description, icon: Icon, badge, children }: ShellProps & { bare?: boolean; children: React.ReactNode }) {
  if (bare) return <div className="space-y-4">{children}</div>
  return (
    <section className="overflow-hidden rounded-3xl bg-card shadow-card">
      <header className="flex items-start gap-3.5 border-b border-border/70 px-5 py-4 sm:px-6">
        {Icon && (
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-gold-soft text-foreground">
            <Icon className="size-5" />
          </span>
        )}
        <div className="min-w-0 flex-1 self-center">
          <h3 className="text-base font-medium tracking-tight">{title}</h3>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {badge && <div className="shrink-0 self-center">{badge}</div>}
      </header>
      <div className="space-y-4 px-5 py-5 sm:px-6">{children}</div>
    </section>
  )
}

// "Personal details" -> "personal details", but "PF and ESIC" and "(Form F)" keep their capitals
const saveLabel = (title: string) =>
  title
    .split(' ')
    .map((word) => ((word.length > 1 && word === word.toUpperCase()) || word.startsWith('(') ? word : word.toLowerCase()))
    .join(' ')

export function SavedNote({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <span className="flex items-center gap-1 text-xs font-medium text-positive-ink">
      <CircleCheck className="size-3.5" /> Saved
    </span>
  )
}

// One section of a form (e.g. "Personal details"), saved on its own.
export function SectionForm({
  title,
  description,
  icon,
  badge,
  fields,
  data,
  onSave,
  onCancel,
  state,
  disabled,
  bare,
}: ShellProps & {
  fields: FieldDef[]
  data: Record<string, unknown> | null | undefined
  onSave: (payload: Record<string, unknown>) => void
  // shows a Cancel button (e.g. to close the form again)
  onCancel?: () => void
  state: SaveState
  disabled?: boolean
  // no card and title - the caller draws them
  bare?: boolean
}) {
  const [values, setValues] = useState(() => toFormValues(fields, data))
  return (
    <SectionShell bare={bare} title={title} description={description} icon={icon} badge={badge}>
      <FieldsGrid fields={fields} values={values} onChange={(name, v) => setValues((s) => ({ ...s, [name]: v }))} disabled={disabled} />
      <FormError error={state.error} />
      {!disabled && (
        <div className="flex items-center justify-end gap-3">
          <SavedNote show={state.saved} />
          {onCancel && (
            <Button variant="ghost" disabled={state.pending} onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button disabled={state.pending} onClick={() => onSave(fromFormValues(fields, values))}>
            {state.pending ? 'Saving…' : `Save ${saveLabel(title)}`}
          </Button>
        </div>
      )}
    </SectionShell>
  )
}

// A list section (addresses, emergency contacts, identity documents): add / remove rows, saved as a whole.
export function ListSectionForm({
  title,
  description,
  icon,
  badge,
  itemLabel,
  fields,
  data,
  max,
  onSave,
  onCancel,
  state,
  disabled,
  bare,
  startWithRow,
}: ShellProps & {
  itemLabel: string
  fields: FieldDef[]
  data: Record<string, unknown>[] | null | undefined
  max: number
  onSave: (payload: Record<string, unknown>[]) => void
  onCancel?: () => void
  state: SaveState
  disabled?: boolean
  bare?: boolean
  // an empty list starts with one blank row (opened with "Add ...")
  startWithRow?: boolean
}) {
  const [rows, setRows] = useState<FormValues[]>(() => {
    const existing = (data ?? []).map((item) => toFormValues(fields, item))
    return existing.length === 0 && startWithRow ? [toFormValues(fields, {})] : existing
  })
  const savedCount = data?.length ?? 0
  const addRow = () => setRows((r) => [...r, toFormValues(fields, {})])
  return (
    <SectionShell bare={bare} title={title} description={description} icon={icon} badge={badge}>
      {rows.length === 0 &&
        (disabled ? (
          <p className="text-sm text-muted-foreground">None added.</p>
        ) : (
          <button
            type="button"
            onClick={addRow}
            className="flex w-full flex-col items-center gap-1.5 rounded-2xl border-2 border-dashed border-border px-4 py-6 text-sm text-muted-foreground transition-colors hover:border-gold hover:bg-gold-soft/30 hover:text-foreground"
          >
            <span className="grid size-8 place-items-center rounded-full bg-surface-2">
              <Plus className="size-4" />
            </span>
            <span className="font-medium">Add {itemLabel.toLowerCase()}</span>
          </button>
        ))}
      {rows.map((row, index) => (
        <div key={index} className="space-y-3 rounded-2xl border border-border/70 bg-surface-2/50 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-medium">
              <span className="grid size-5 place-items-center rounded-full bg-hero text-xs font-semibold text-hero-foreground tabular-nums">{index + 1}</span>
              {itemLabel}
            </p>
            {!disabled && (
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-negative-ink" onClick={() => setRows((r) => r.filter((_, i) => i !== index))}>
                <Trash2 /> Remove
              </Button>
            )}
          </div>
          <FieldsGrid
            fields={fields}
            values={row}
            disabled={disabled}
            onChange={(name, v) => setRows((r) => r.map((item, i) => (i === index ? { ...item, [name]: v } : item)))}
          />
        </div>
      ))}
      <FormError error={state.error} />
      {/* nothing to save while the list is empty and was empty (removing every saved row still needs a save) */}
      {!disabled && (rows.length > 0 || savedCount > 0 || onCancel) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {rows.length > 0 ? (
            <Button variant="secondary" size="sm" disabled={rows.length >= max} onClick={addRow}>
              <Plus /> Add another {itemLabel.toLowerCase()}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-3">
            <SavedNote show={state.saved} />
            {onCancel && (
              <Button variant="ghost" disabled={state.pending} onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button disabled={state.pending} onClick={() => onSave(rows.map((row) => fromFormValues(fields, row)))}>
              {state.pending ? 'Saving…' : `Save ${saveLabel(title)}`}
            </Button>
          </div>
        </div>
      )}
    </SectionShell>
  )
}

export function SectionTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div>
      <h3 className="text-lg font-light tracking-tight">{title}</h3>
      {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
    </div>
  )
}
