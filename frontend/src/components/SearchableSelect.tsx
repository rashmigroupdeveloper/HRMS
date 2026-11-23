import { useState } from 'react'
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from '@/components/ui/combobox'

// A dropdown you can type into to filter (countries, states, time zones, companies...). Works with string values
// like a native <select>: `value` is the chosen option's value, '' for none. With `allowCustom` the typed text can
// be used as it is when no option fits (e.g. a qualification or bank that is not in the list).
export type SelectOption = { value: string; label: string }

type Item = SelectOption & { typed?: boolean }

export function SearchableSelect({
  id,
  value,
  onChange,
  options,
  placeholder = 'Type to search…',
  disabled = false,
  allowCustom = false,
  className,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
  allowCustom?: boolean
  // for the input box (e.g. its height to match the other fields of a form)
  className?: string
}) {
  const [typed, setTyped] = useState('')
  // a saved value that is not in the list (typed in earlier) still shows
  const selected: Item | null = options.find((o) => o.value === value) ?? (allowCustom && value ? { value, label: value } : null)
  const text = typed.trim()
  const known = (v: string) => options.some((o) => o.label.toLowerCase() === v.toLowerCase())
  const items: Item[] = [
    ...(allowCustom && text && !known(text) ? [{ value: text, label: text, typed: true }] : []),
    ...(selected && !options.includes(selected) && selected.value !== text ? [selected] : []),
    ...options,
  ]
  return (
    <Combobox<Item>
      items={items}
      value={selected}
      onValueChange={(option) => onChange(option?.value ?? '')}
      onInputValueChange={setTyped}
      itemToStringLabel={(option) => option.label}
      itemToStringValue={(option) => option.value}
      isItemEqualToValue={(a, b) => a.value === b.value}
      autoHighlight
      disabled={disabled}
    >
      <ComboboxInput
        id={id}
        placeholder={placeholder}
        disabled={disabled}
        className={className ?? 'w-full'}
        // Esc with the list closed would clear the choice (Base UI default); instead let it reach the drawer / dialog,
        // which closes (asking first if there are unsaved changes). With the list open, Esc still just closes the list.
        onKeyDown={(event) => {
          if (event.key === 'Escape' && event.currentTarget.getAttribute('aria-expanded') !== 'true') event.preventBaseUIHandler()
        }}
      />
      <ComboboxContent>
        <ComboboxEmpty>Nothing matches.</ComboboxEmpty>
        <ComboboxList>
          {(option: Item) => (
            <ComboboxItem key={`${option.typed ? 'typed:' : ''}${option.value}`} value={option}>
              {option.typed ? (
                <span>
                  Use "<span className="font-medium">{option.label}</span>"
                </span>
              ) : (
                option.label
              )}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
