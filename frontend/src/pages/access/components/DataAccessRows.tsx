import { useQuery } from '@tanstack/react-query'
import { Plus, X } from 'lucide-react'
import { SearchableSelect } from '@/components/SearchableSelect'
import { Button } from '@/components/ui/button'
import type { AccessLevel } from '@/hooks/useAccess'
import { orpc } from '@/lib/orpc'
import { LevelPicker } from './LevelPicker'

// The data access of one role given to someone (2026-11-18): rows of company -> plant -> department ("All" at any
// level) at View or Edit - whose records the role covers. Several rows add up; no row = nobody's records.

export type DataAccessRow = { companyId: number | null; plantId: number | null; departmentId: number | null; level: AccessLevel }

const ALL = 'ALL'
const toValue = (id: number | null) => (id === null ? ALL : String(id))
const toId = (value: string) => (value === ALL || value === '' ? null : Number(value))

export function DataAccessRows({ rows, onChange, idPrefix }: { rows: DataAccessRow[]; onChange: (rows: DataAccessRow[]) => void; idPrefix: string }) {
  const companies = useQuery(orpc.organization.companies.list.queryOptions())
  const plants = useQuery(orpc.organization.plants.list.queryOptions())
  const departments = useQuery(orpc.organization.departments.list.queryOptions())

  const companyOptions = [{ value: ALL, label: 'All companies' }, ...(companies.data ?? []).map((c) => ({ value: String(c.id), label: `${c.code} · ${c.name}` }))]
  const plantOptions = (companyId: number | null) => [
    { value: ALL, label: 'All plants' },
    ...(plants.data ?? []).filter((p) => p.company.id === companyId).map((p) => ({ value: String(p.id), label: `${p.plantCode} · ${p.name}` })),
  ]
  const departmentOptions = [{ value: ALL, label: 'All departments' }, ...(departments.data ?? []).map((d) => ({ value: String(d.id), label: d.name }))]

  const update = (index: number, change: Partial<DataAccessRow>) => onChange(rows.map((row, i) => (i === index ? { ...row, ...change } : row)))

  return (
    <div className="space-y-2">
      {rows.length === 0 && <p className="text-xs text-warning-ink">No data access - this role covers nobody&apos;s records until a row is added.</p>}
      {rows.map((row, index) => (
        <div key={index} className="grid items-center gap-1.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
          <SearchableSelect
            id={`${idPrefix}-company-${index}`}
            value={toValue(row.companyId)}
            options={companyOptions}
            placeholder="Company…"
            className="h-8 rounded-lg bg-card text-xs"
            // another company has other plants
            onChange={(value) => update(index, { companyId: toId(value), plantId: null })}
          />
          <SearchableSelect
            id={`${idPrefix}-plant-${index}`}
            value={toValue(row.plantId)}
            options={plantOptions(row.companyId)}
            placeholder="Plant…"
            disabled={row.companyId === null}
            className="h-8 rounded-lg bg-card text-xs"
            onChange={(value) => update(index, { plantId: toId(value) })}
          />
          <SearchableSelect
            id={`${idPrefix}-department-${index}`}
            value={toValue(row.departmentId)}
            options={departmentOptions}
            placeholder="Department…"
            className="h-8 rounded-lg bg-card text-xs"
            onChange={(value) => update(index, { departmentId: toId(value) })}
          />
          <LevelPicker label="Level" size="sm" choices={['READ', 'WRITE']} value={row.level} onChange={(level) => level !== 'NONE' && update(index, { level })} />
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-negative-ink"
            aria-label="Remove this row"
            title="Remove this row"
            onClick={() => onChange(rows.filter((_, i) => i !== index))}
          >
            <X />
          </Button>
        </div>
      ))}
      <Button variant="ghost" size="sm" className="text-xs" onClick={() => onChange([...rows, { companyId: null, plantId: null, departmentId: null, level: 'WRITE' }])}>
        <Plus /> Add data access
      </Button>
    </div>
  )
}
