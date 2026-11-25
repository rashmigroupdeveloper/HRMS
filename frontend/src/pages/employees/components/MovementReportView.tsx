import { STATUS_LABEL } from './labels'
import { useQuery } from '@tanstack/react-query'
import { useDeferredValue } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'
import { ExportButton } from '@/components/ExportButton'
import { FormError } from '@/components/FormError'
import { Pill } from '@/components/Pill'
import { MovementReportSkeleton } from '@/components/skeletons/employees/MovementReportSkeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAccess } from '@/hooks/useAccess'
import { client, orpc } from '@/lib/orpc'
import { formatDate, fromDateInput, toDateInput, todayDay } from '@/lib/utils'
import { MovementReportSummary } from './MovementReportSummary'
import { MOVEMENT_COLUMNS, MOVEMENT_KINDS, MOVEMENT_NOTE } from './movement-labels'

const id = (v: string | null) => v && /^\d+$/.test(v) && Number.isSafeInteger(Number(v)) && Number(v) > 0 ? Number(v) : undefined
export function MovementReportView() {
  const { ready, can } = useAccess()
  const [params, setParams] = useSearchParams()
  const now = todayDay()
  const from = params.get('from') ?? toDateInput(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)))
  const to = params.get('to') ?? toDateInput(now)
  const fromDay = fromDateInput(from), toDay = fromDateInput(to)
  const kind = MOVEMENT_KINDS.find(([value]) => value === (params.get('kind') ?? 'ALL'))?.[0]
  const valid = !!kind && !!fromDay && !!toDay && toDateInput(fromDay) === from && toDateInput(toDay) === to && fromDay.getUTCFullYear() >= 1900 && toDay.getUTCFullYear() <= 2100 && toDay >= fromDay && toDay.getTime() - fromDay.getTime() < 366 * 86_400_000 && ['company', 'plant', 'department', 'page'].every(k => !params.has(k) || !!id(params.get(k)))
  const search = params.get('search') ?? '', deferredSearch = useDeferredValue(search)
  const filter = { from: fromDay ?? now, to: toDay ?? now, kind: kind ?? 'ALL', search: deferredSearch.trim() || undefined,
    companyIds: id(params.get('company')) ? [id(params.get('company'))!] : undefined,
    plantIds: id(params.get('plant')) ? [id(params.get('plant'))!] : undefined,
    departmentIds: id(params.get('department')) ? [id(params.get('department'))!] : undefined }
  const page = Math.min(id(params.get('page')) ?? 1, 20_000)
  const report = useQuery({ ...orpc.employees.movements.list.queryOptions({ input: { ...filter, page, pageSize: 25 } }), enabled: valid && ready && can('EMPLOYEES') })
  const data = report.data
  const stale = report.isFetching || search !== deferredSearch
  function change(key: string, value: string) {
    setParams(old => { const p = new URLSearchParams(old); if (value) p.set(key, value); else p.delete(key); if (key !== 'page') p.delete('page'); if (key === 'company') { p.delete('plant'); p.delete('department') } if (key === 'plant') p.delete('department'); return p }, { replace: true })
  }
  return <section className="min-w-0 space-y-3 rounded-3xl bg-card p-4 shadow-card sm:p-5">
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2"><h2 className="text-lg font-medium tracking-tight">Recorded joiners &amp; leavers</h2><ExportButton disabled={!data?.total || !valid || stale} load={() => client.employees.movements.export(filter)} /></div>
    <div className="grid grid-cols-2 items-end gap-2 sm:grid-cols-4">
      <div className="space-y-1"><Label htmlFor="movement-from" className="text-xs text-muted-foreground">From</Label><Input id="movement-from" type="date" min="1900-01-01" max="2100-12-31" className="min-w-0 rounded-xl px-2 text-sm" value={from} onChange={e => change('from', e.target.value)} /></div>
      <div className="space-y-1"><Label htmlFor="movement-to" className="text-xs text-muted-foreground">To</Label><Input id="movement-to" type="date" min="1900-01-01" max="2100-12-31" className="min-w-0 rounded-xl px-2 text-sm" value={to} onChange={e => change('to', e.target.value)} /></div>
      <label className="space-y-1"><span className="text-xs text-muted-foreground">Events</span><NativeSelect value={kind ?? ''} aria-label="Events" className="w-full [&_select]:h-9 [&_select]:rounded-xl" onChange={e => change('kind', e.target.value)}>{!kind && <NativeSelectOption value="">Choose an event type</NativeSelectOption>}{MOVEMENT_KINDS.map(([value, label]) => <NativeSelectOption value={value} key={value}>{label}</NativeSelectOption>)}</NativeSelect></label>
      <div className="space-y-1"><Label htmlFor="movement-person" className="text-xs text-muted-foreground">Employee</Label><Input id="movement-person" value={search} placeholder="Name or code" maxLength={100} className="rounded-xl" onChange={e => change('search', e.target.value)} /></div>
    </div>
    <details className="rounded-xl bg-surface-2/50 px-3"><summary className="flex min-h-10 cursor-pointer flex-wrap items-center justify-between gap-2 text-sm focus-visible:outline-2 focus-visible:outline-ring"><span>Company, plant &amp; department</span><span className="text-xs text-muted-foreground">{['company', 'plant', 'department'].filter(k => params.has(k)).length || 'All'} within your access</span></summary><div className="flex flex-wrap gap-2 pb-3">{(['company', 'plant', 'department'] as const).map((key, i) => {
      const options = data?.options[(['companies', 'plants', 'departments'] as const)[i]!]
      const selected = id(params.get(key))
      return <label key={key} className="min-w-0 space-y-1"><span className="block text-xs capitalize text-muted-foreground">{key}</span><NativeSelect aria-label={key[0].toUpperCase() + key.slice(1)} value={params.get(key) ?? ''} onChange={e => change(key, e.target.value)} className="min-w-0 [&_select]:h-9 [&_select]:max-w-60 [&_select]:rounded-full"><NativeSelectOption value="">Every {key}</NativeSelectOption>{params.has(key) && !options?.some(o => o.id === selected) && <NativeSelectOption value={params.get(key)!}>Selected {key}</NativeSelectOption>}{options?.map(o => <NativeSelectOption key={o.id} value={String(o.id)}>{o.name}</NativeSelectOption>)}</NativeSelect></label>
    })}<Button variant="ghost" className="mt-auto min-h-9 rounded-full" onClick={() => setParams({ view: 'movements' }, { replace: true })}><RotateCcw aria-hidden />Reset</Button></div></details>
    <details className="text-xs text-muted-foreground"><summary className="flex min-h-9 cursor-pointer items-center focus-visible:outline-2 focus-visible:outline-ring">Recorded dates, not confirmed exits · coverage details</summary><p className="pb-2 leading-relaxed">{MOVEMENT_NOTE}</p></details>
    {!valid && <p role="alert" className="text-sm text-negative-ink">Use valid filters and an ordered date range of up to 366 days.</p>}
    <FormError error={report.error} />
    {valid && report.isPending && <MovementReportSkeleton />}
    {valid && data && <>
      <MovementReportSummary values={[data.summary.joiners, data.summary.leavers, data.summary.people, data.summary.future]} />
      <p className="text-xs text-muted-foreground">Totals cover all matching events, not just this page.</p>
      {data.total === 0 ? <p className="py-5 text-sm text-muted-foreground">No recorded joining or leaving dates match. Try another period or clear the filters.</p> : <>
        {data.items.length === 0 && <div className="flex flex-wrap items-center gap-2 text-sm"><span>No events on this page.</span><Button variant="secondary" className="rounded-full" onClick={() => change('page', '1')}>First page</Button></div>}
        <Table className="max-md:table-fixed"><TableHeader><TableRow>{MOVEMENT_COLUMNS.map(c => <TableHead key={c.label} className={c.className}>{c.label}</TableHead>)}</TableRow></TableHeader><TableBody>{data.items.map(r => <TableRow key={`${r.employeeCode}-${r.kind}`} className="h-20">
          <TableCell className="whitespace-normal break-words"><Link to={`/manage/employees/${r.employeeCode}`} className="inline-flex min-h-9 items-center font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring">{r.name}</Link><p className="text-xs text-muted-foreground">{r.employeeCode}</p><details className="text-xs text-muted-foreground md:hidden"><summary className="min-h-9 cursor-pointer py-2">Current placement</summary><p>{r.company.name} · {r.plant.name} · {r.department?.name ?? 'No department'} · {STATUS_LABEL[r.status]}</p></details></TableCell>
          <TableCell className="whitespace-normal"><p className="text-sm tabular-nums">{formatDate(r.date)}</p><Pill tone={r.kind === 'JOINER' ? 'positive' : 'neutral'}>{r.kind === 'JOINER' ? 'Joining date' : 'Leaving date'}</Pill>{r.future && <p className="mt-1 text-xs text-warning-ink">Future date</p>}</TableCell>
          <TableCell className="hidden whitespace-normal md:table-cell"><p className="text-sm">{r.company.name}</p><p className="text-xs text-muted-foreground">{r.plant.name} · {r.department?.name ?? 'No department'}</p>{r.designation && <p className="text-xs text-muted-foreground">{r.designation}</p>}</TableCell>
          <TableCell className="hidden text-xs lg:table-cell">{STATUS_LABEL[r.status]}</TableCell>
        </TableRow>)}</TableBody></Table>
        <nav aria-label="Movement report pages" className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span>{data.items.length ? (page - 1) * 25 + 1 : 0}–{data.items.length ? Math.min(page * 25, data.total) : 0} of {data.total} events</span><div className="flex items-center gap-1"><Button variant="ghost" size="sm" className="size-9 rounded-full" aria-label="Previous page" disabled={page <= 1 || stale} onClick={() => change('page', String(page - 1))}><ChevronLeft aria-hidden /></Button><span>Page {page}</span><Button variant="ghost" size="sm" className="size-9 rounded-full" aria-label="Next page" disabled={page * 25 >= data.total || stale} onClick={() => change('page', String(page + 1))}><ChevronRight aria-hidden /></Button></div></nav>
      </>}
    </>}
  </section>
}
