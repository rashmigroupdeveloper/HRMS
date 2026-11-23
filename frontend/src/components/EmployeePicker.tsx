import { useQuery } from '@tanstack/react-query'
import { ORPCError } from '@orpc/client'
import { useEffect, useState } from 'react'
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from '@/components/ui/combobox'
import { Input } from '@/components/ui/input'
import { orpc } from '@/lib/orpc'

// Picks an employee by name or code, searching on the server (a company can have thousands) - e.g. a reporting manager.
// `value`: the chosen employee's code, '' for none. People who have left are not offered. It searches the whole group
// (employees.search - code, name, designation, company only), so a manager can be picked from another plant. Without
// Employees: View the code is typed in instead.
export type PickedEmployee = { employeeCode: string; name: string }

export function EmployeePicker({
  id,
  value,
  onChange,
  initial,
  excludeCode,
  placeholder = 'Type a name or employee code…',
  className = 'h-9 w-full rounded-xl bg-card',
}: {
  id?: string
  value: string
  onChange: (employee: PickedEmployee | null) => void
  // the employee chosen before (shows their name until the list loads)
  initial?: PickedEmployee | null
  // not offered (e.g. the employee being edited - nobody reports to themselves)
  excludeCode?: string
  placeholder?: string
  className?: string
}) {
  const [picked, setPicked] = useState<PickedEmployee | null>(initial ?? null)
  const [typed, setTyped] = useState('')
  const [search, setSearch] = useState('')
  // ask the server once typing pauses
  useEffect(() => {
    const timer = setTimeout(() => setSearch(typed.trim()), 250)
    return () => clearTimeout(timer)
  }, [typed])
  const selected = value ? (picked?.employeeCode === value ? picked : { employeeCode: value, name: value }) : null
  const label = (e: PickedEmployee) => (e.name === e.employeeCode ? e.employeeCode : `${e.name} · ${e.employeeCode}`)
  // the text shown for the choice is not a search
  const query = selected && search === label(selected) ? '' : search
  const results = useQuery(orpc.employees.search.queryOptions({ input: { query: query || undefined } }))

  if (results.error instanceof ORPCError && results.error.code === 'FORBIDDEN') {
    return (
      <Input
        id={id}
        className={className}
        value={value}
        placeholder="Employee code, e.g. RML035384"
        onChange={(e) => onChange(e.target.value.trim() ? { employeeCode: e.target.value.trim().toUpperCase(), name: e.target.value.trim().toUpperCase() } : null)}
      />
    )
  }

  const found: PickedEmployee[] = (results.data ?? []).filter((e) => e.employeeCode !== excludeCode).map((e) => ({ employeeCode: e.employeeCode, name: e.name }))
  const items = selected && !found.some((e) => e.employeeCode === selected.employeeCode) ? [selected, ...found] : found

  return (
    <Combobox<PickedEmployee>
      items={items}
      // the server already searched
      filter={null}
      value={selected}
      onValueChange={(employee) => {
        setPicked(employee)
        onChange(employee)
      }}
      onInputValueChange={setTyped}
      itemToStringLabel={label}
      itemToStringValue={(e) => e.employeeCode}
      isItemEqualToValue={(a, b) => a.employeeCode === b.employeeCode}
      autoHighlight
    >
      <ComboboxInput
        id={id}
        placeholder={placeholder}
        className={className}
        showClear={!!selected}
        // Esc with the list closed reaches the drawer (which asks before closing) instead of clearing the choice
        onKeyDown={(event) => {
          if (event.key === 'Escape' && event.currentTarget.getAttribute('aria-expanded') !== 'true') event.preventBaseUIHandler()
        }}
      />
      <ComboboxContent>
        <ComboboxEmpty>{results.isFetching ? 'Searching…' : 'No employee matches.'}</ComboboxEmpty>
        <ComboboxList>
          {(employee: PickedEmployee) => (
            <ComboboxItem key={employee.employeeCode} value={employee}>
              <span className="min-w-0 truncate">{employee.name}</span>
              <span className="ml-auto pl-3 text-xs text-muted-foreground tabular-nums">{employee.employeeCode}</span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
