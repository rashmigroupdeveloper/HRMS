import { fromDateInput, toDateInput } from '@/lib/utils'

// A form is described as a list of fields; values are kept as strings while editing and converted to/from the
// API's types (Date, number, boolean) at the edges.

export type Option = { value: string; label: string }

// { MALE: 'Male', ... } -> options for a select field
export const toOptions = <K extends string>(labels: Record<K, string>): Option[] =>
  Object.entries<string>(labels).map(([value, label]) => ({ value, label }))

// 'search': a dropdown you can type into to filter a long list (countries, states, banks...)
// 'checks': tick boxes, any number of the options (kept as "A,B" while editing, a list in the API)
// 'checkbox': one tick that must be given, e.g. a consent - its text is the field's placeholder
export type FieldType = 'text' | 'email' | 'number' | 'date' | 'select' | 'search' | 'yesno' | 'textarea' | 'checks' | 'checkbox'

export type FieldDef = {
  name: string
  label: string
  type?: FieldType
  options?: Option[]
  required?: boolean
  // takes the full row of the grid
  wide?: boolean
  placeholder?: string
  disabled?: boolean
  // starts a sub-heading inside a long form (shown when it differs from the previous field's group)
  group?: string
  // a number shown only as its last 4 digits in read-only summaries (Aadhaar, account number)
  sensitive?: boolean
  // a short note under the field
  hint?: string
  // shown for information only and never sent when saving (e.g. the candidate's e-mail from the offer)
  readOnly?: boolean
  // shown only when this returns true for the values being edited (e.g. the spouse's name only when married);
  // a hidden field is not sent, so an answer that no longer applies is cleared
  showIf?: (values: FormValues) => boolean
  // a 'search' field that also takes any text typed in when no option fits (e.g. a qualification not in the list)
  allowCustom?: boolean
  // other fields to set when this one changes, e.g. a nominee picked from the family details brings their relationship
  // and date of birth
  // (`values`: the form as it was before this change)
  fills?: (value: string, values: FormValues) => FormValues | undefined
}

export type FormValues = Record<string, string>

export const isShown = (field: FieldDef, values: FormValues) => !field.showIf || field.showIf(values)

// API object -> form strings
export function toFormValues(fields: FieldDef[], data: Record<string, unknown> | null | undefined): FormValues {
  const values: FormValues = {}
  for (const field of fields) {
    const value = data?.[field.name]
    if (value === null || value === undefined) values[field.name] = ''
    else if (Array.isArray(value)) values[field.name] = value.join(',')
    else if (value instanceof Date) values[field.name] = toDateInput(value)
    else if (typeof value === 'boolean') values[field.name] = value ? 'yes' : 'no'
    else values[field.name] = String(value)
  }
  return values
}

function convert(field: FieldDef, raw: string): unknown {
  const value = raw.trim()
  if (value === '') return undefined
  switch (field.type) {
    case 'date':
      return fromDateInput(value)
    case 'number':
      return Number(value)
    case 'yesno':
      return value === 'yes'
    case 'checks':
      return value.split(',').filter(Boolean)
    case 'checkbox':
      return value === 'yes' ? true : undefined
    default:
      return value
  }
}

// Form strings -> API object; empty fields are left out.
export function fromFormValues(fields: FieldDef[], values: FormValues): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const field of fields) {
    if (field.readOnly || !isShown(field, values)) continue
    const value = convert(field, values[field.name] ?? '')
    if (value !== undefined) out[field.name] = value
  }
  return out
}

// Only the fields that changed; a cleared field becomes null (for update APIs).
export function changedValues(fields: FieldDef[], initial: FormValues, values: FormValues): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const field of fields) {
    if (field.readOnly) continue
    // a field that no longer applies is cleared
    const value = isShown(field, values) ? (values[field.name] ?? '') : ''
    if (value === (initial[field.name] ?? '')) continue
    out[field.name] = convert(field, value) ?? null
  }
  return out
}

// ---- Salary breakup of an offer: component id -> monthly amount as typed ----

export type BreakupValues = Record<number, string>

// The lines to save: components with an amount (0 is kept - e.g. "Reimbursement 0")
export function breakupLines(values: BreakupValues) {
  return Object.entries(values)
    .filter(([, v]) => v !== '' && /^\d+$/.test(v))
    .map(([id, v]) => ({ salaryComponentId: Number(id), monthlyAmount: Number(v) }))
}
