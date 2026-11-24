import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, RotateCcw, Search } from 'lucide-react'
import { useDeferredValue, useState } from 'react'
import { useSearchParams } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { ExportButton } from '@/components/ExportButton'
import { FormDrawer } from '@/components/FormDrawer'
import { FormError } from '@/components/FormError'
import { Pill } from '@/components/Pill'
import { AttendanceReportsSkeleton, RawPunchesSkeleton } from '@/components/skeletons/attendance/AttendanceReportsSkeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { client, orpc } from '@/lib/orpc'
import { formatDate, fromDateInput, toDateInput, todayDay } from '@/lib/utils'
import { type Overview, hours, segment, SEGMENTS, STATUS } from './labels'
import { ReportSummary } from './ReportSummary'
import { EXCEPTION_OPTIONS, REPORT_COLUMNS, REPORT_SUMMARY_NOTE } from './report-labels'

type Filter = Parameters<typeof client.attendance.reports.list>[0]
type Row = Awaited<ReturnType<typeof client.attendance.reports.list>>['items'][number]
const clock = (date: Date | null) => date ? date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }) : '—'
const integer = (value: string | null) => value && /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : undefined

export function AttendanceReportView({ overview, overviewFailed }: { overview?: Overview; overviewFailed: boolean }) {
  const [params, setParams] = useSearchParams()
  const [opened, setOpened] = useState<Row | null>(null)
  const now = todayDay(), start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const from = params.get('from') ?? toDateInput(start), to = params.get('to') ?? toDateInput(now)
  const fromDay = fromDateInput(from), toDay = fromDateInput(to)
  const valid = !!fromDay && !!toDay && toDay >= fromDay && toDay.getTime() - fromDay.getTime() < 366 * 86_400_000
  const scopes = [ ...(overview?.teamSize ? [['TEAM', 'My team'] as const] : []), ...(overview?.departmentSize ? [['DEPARTMENT', 'My department'] as const] : []), ...(overview?.canSeeAll ? [['ALL', 'Within my access'] as const] : []) ]
  const scope = scopes.find(([value]) => value === params.get('scope'))?.[0] ?? scopes[0]?.[0] ?? 'TEAM'
  const mode = params.get('mode') === 'EXCEPTIONS' ? 'EXCEPTIONS' : 'DETAIL'
  const exception = EXCEPTION_OPTIONS.find(([key]) => key === params.get('exception'))?.[0] ?? 'ANY'
  const status = Object.keys(STATUS).find(key => key === params.get('status')) as Filter['status']
  const search = params.get('search') ?? '', deferredSearch = useDeferredValue(search)
  const filter: Filter = { scope, from: fromDay!, to: toDay!, mode, exception, status, search: deferredSearch.trim() || undefined,
    companyIds: integer(params.get('company')) ? [integer(params.get('company'))!] : undefined,
    plantIds: integer(params.get('plant')) ? [integer(params.get('plant'))!] : undefined,
    departmentIds: integer(params.get('department')) ? [integer(params.get('department'))!] : undefined }
  const page = Math.min(integer(params.get('page')) ?? 1, 1_000_000)
  const report = useQuery({ ...orpc.attendance.reports.list.queryOptions({ input: { ...filter, page, pageSize: 25 } }), enabled: valid && !!overview && scopes.length > 0 })
  const data = report.data, stale = report.isFetching || search !== deferredSearch
  function change(key: string, value: string) {
    setOpened(null)
    setParams(previous => { const next = new URLSearchParams(previous); if (value) next.set(key, value); else next.delete(key); if (key !== 'page') next.delete('page'); if (key === 'scope') ['company', 'plant', 'department'].forEach(k => next.delete(k)); if (key === 'company') next.delete('plant'); return next }, { replace: true })
  }
  const summary = data?.summary
  const summaryValues = summary ? [summary.days, summary.people, Math.round(summary.workedMinutes / 6) / 10, summary.late, summary.early, summary.absent, summary.missedPunch] : undefined
  return <section className="min-w-0 space-y-3 rounded-3xl bg-card p-4 shadow-card sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className={SEGMENTS}>{([['DETAIL', 'Attendance detail'], ['EXCEPTIONS', 'Exceptions']] as const).map(([value, label]) => <button key={value} type="button" className={segment(mode === value)} aria-label={label} aria-pressed={mode === value} onClick={() => change('mode', value)}><span className="sm:hidden">{value === 'DETAIL' ? 'Detail' : label}</span><span className="hidden sm:inline">{label}</span></button>)}</div>
      <ExportButton disabled={!data?.total || stale || !valid} load={() => client.attendance.reports.export(filter)} />
    </div>
    <div className="grid grid-cols-2 items-end gap-2 sm:grid-cols-4">
      <label className="col-span-2 space-y-1 sm:col-span-1"><span className="text-xs text-muted-foreground">People</span><NativeSelect aria-label="People" value={scope} onChange={e => change('scope', e.target.value)} className="w-full [&_select]:w-full [&_select]:rounded-xl">{scopes.length ? scopes.map(([value, label]) => <NativeSelectOption key={value} value={value}>{label}</NativeSelectOption>) : <NativeSelectOption value="TEAM">My team</NativeSelectOption>}</NativeSelect></label>
      <div className="space-y-1"><Label className="text-xs text-muted-foreground" htmlFor="report-from">From</Label><Input id="report-from" type="date" min="2020-01-01" max="2100-12-31" className="min-w-0 rounded-xl px-2 text-sm" value={from} onChange={e => change('from', e.target.value)} /></div>
      <div className="space-y-1"><Label className="text-xs text-muted-foreground" htmlFor="report-to">To</Label><Input id="report-to" type="date" min="2020-01-01" max="2100-12-31" className="min-w-0 rounded-xl px-2 text-sm" value={to} onChange={e => change('to', e.target.value)} /></div>
      <label className="col-span-2 space-y-1 sm:col-span-1"><span className="text-xs text-muted-foreground">Employee</span><div className="relative"><Search aria-hidden className="absolute top-2.5 left-3 size-4 text-muted-foreground" /><Input aria-label="Name or employee code" className="rounded-xl pl-9" placeholder="Name or code" maxLength={100} value={search} onChange={e => change('search', e.target.value)} /></div></label>
    </div>
    <details className="group rounded-xl bg-surface-2/40 px-3">
      <summary className="flex min-h-10 cursor-pointer items-center text-sm focus-visible:outline-2 focus-visible:outline-ring">Filters<span className="ml-2 text-xs text-muted-foreground">{[status && STATUS[status].label, mode === 'EXCEPTIONS' && EXCEPTION_OPTIONS.find(([key]) => key === exception)?.[1], filter.companyIds && 'Company', filter.plantIds && 'Plant', filter.departmentIds && 'Department'].filter(Boolean).join(' · ') || 'Company, plant, department & status'}</span></summary>
      <div className="space-y-3 pb-3"><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">      <label className="space-y-1"><span className="text-xs text-muted-foreground">Status</span><NativeSelect aria-label="Status" className="w-full [&_select]:w-full [&_select]:rounded-xl" value={status ?? ''} onChange={e => change('status', e.target.value)}><NativeSelectOption value="">Every status</NativeSelectOption>{Object.entries(STATUS).map(([key, value]) => <NativeSelectOption key={key} value={key}>{value.label}</NativeSelectOption>)}</NativeSelect></label>
      {mode === 'EXCEPTIONS' && <label className="space-y-1"><span className="text-xs text-muted-foreground">Exception</span><NativeSelect aria-label="Exception" className="w-full [&_select]:w-full [&_select]:rounded-xl" value={exception} onChange={e => change('exception', e.target.value)}>{EXCEPTION_OPTIONS.map(([key, label]) => <NativeSelectOption key={key} value={key}>{label}</NativeSelectOption>)}</NativeSelect></label>}
</div>    <div className="flex flex-wrap items-center gap-2">
      {(['company', 'plant', 'department'] as const).map(key => {
        const options = key === 'company' ? data?.options.companies : key === 'plant' ? data?.options.plants.filter(p => !filter.companyIds || p.companyId === filter.companyIds[0]) : data?.options.departments
        return <NativeSelect key={key} aria-label={key[0].toUpperCase() + key.slice(1)} value={params.get(key) ?? ''} onChange={e => change(key, e.target.value)} className="min-w-0 max-w-full [&_select]:max-w-52 [&_select]:rounded-full"><NativeSelectOption value="">{key === 'company' ? 'Every company' : key === 'plant' ? 'Every plant' : 'Every department'}</NativeSelectOption>{options?.map(option => <NativeSelectOption key={option.id} value={String(option.id)}>{option.name}</NativeSelectOption>)}</NativeSelect>
      })}
      <Button variant="ghost" className="ml-auto min-h-9 rounded-full" onClick={() => { setOpened(null); setParams({}, { replace: true }) }}><RotateCcw aria-hidden />Reset</Button>
    </div>
</div>
    </details>
    <p className="text-xs text-muted-foreground">Calendar work dates · current placement · stored attendance only · punch times in IST. Missing days are not counted as absent.</p>
    {!valid && <p role="alert" className="text-sm text-negative-ink">Choose an ordered date range of at most 366 days.</p>}
    <FormError error={report.error} />
    {!overview && !overviewFailed && <AttendanceReportsSkeleton />}
    {overview && scopes.length === 0 && <EmptyState title="No attendance reports to show" hint="Reports cover your reporting team, HOD department or Attendance View access." />}
    {overview && scopes.length > 0 && valid && report.isPending && <AttendanceReportsSkeleton />}
    {data && valid && <div aria-busy={stale} className="space-y-3">
      <ReportSummary values={summaryValues} />
      <p className="text-xs text-muted-foreground">{REPORT_SUMMARY_NOTE}</p>
      {data.total === 0 ? <EmptyState title="No stored days match" hint="Try a different period or clear the filters. Attendance is not calculated by opening this report." /> : <>
        <div className="overflow-x-auto"><Table className="max-md:table-fixed"><TableHeader><TableRow>{REPORT_COLUMNS.map(c => <TableHead key={c.label} className={c.className}>{c.label}</TableHead>)}</TableRow></TableHeader><TableBody>{data.items.map(row => <AttendanceRow key={row.id} row={row} onOpen={() => setOpened(row)} />)}</TableBody></Table></div>
        <nav aria-label="Report pages" className="flex items-center justify-between gap-2 text-xs text-muted-foreground"><p>{(data.page - 1) * data.pageSize + 1}–{Math.min(data.page * data.pageSize, data.total)} of {data.total} days</p><div className="flex items-center gap-1"><Button variant="ghost" size="icon" aria-label="Previous page" disabled={data.page <= 1 || stale} onClick={() => change('page', String(data.page - 1))}><ChevronLeft /></Button><span>Page {data.page}</span><Button variant="ghost" size="icon" aria-label="Next page" disabled={data.page * data.pageSize >= data.total || stale} onClick={() => change('page', String(data.page + 1))}><ChevronRight /></Button></div></nav>
      </>}
    </div>}
    {opened && <RawPunches row={opened} onClose={() => setOpened(null)} />}
  </section>
}

function AttendanceRow({ row: r, onOpen }: { row: Row; onOpen: () => void }) {
  return <TableRow className="h-20 [&>td]:align-top">
    <TableCell className="whitespace-normal break-words"><p className="font-medium">{r.employee}</p><p className="text-xs text-muted-foreground">{r.employeeCode} · {formatDate(r.date)}</p><details className="text-xs text-muted-foreground"><summary className="min-h-9 cursor-pointer py-1 sm:min-h-5">Placement &amp; totals</summary><p className="py-1">{r.company} · {r.plant} · {r.department}</p><p>{r.employeePeriodRows} matching days · late {r.employeeLateMinutes}m · early {r.employeeEarlyMinutes}m in filtered period</p>{r.note && <p className="mt-1 whitespace-pre-wrap">{r.note}</p>}<p className="mt-1">Punch-derived status: {STATUS[r.autoStatus].label}</p></details></TableCell>
    <TableCell className="whitespace-normal break-words"><Pill tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Pill>{r.firstHalf !== r.secondHalf && <p className="mt-1 text-xs">{STATUS[r.firstHalf].short} / {STATUS[r.secondHalf].short}</p>}<p className="mt-1 text-xs tabular-nums">{clock(r.firstIn)} – {clock(r.lastOut)}{r.shift ? ` · ${r.shift.code}` : ''}</p><p className="text-xs text-muted-foreground md:hidden">{hours(r.workedMinutes)} · late {r.lateMinutes}m / early {r.earlyMinutes}m</p><Button variant="ghost" className="mt-1 min-h-9 rounded-full px-2 md:hidden" aria-label={`Raw punches for ${r.employeeCode} on ${toDateInput(r.date)}`} onClick={onOpen}>View {r.punchCount} punches</Button></TableCell>
    <TableCell className="hidden text-right tabular-nums md:table-cell">{hours(r.workedMinutes)}</TableCell>
    <TableCell className="hidden text-right tabular-nums md:table-cell">{r.lateMinutes}m / {r.earlyMinutes}m</TableCell>
    <TableCell className="hidden text-right md:table-cell"><Button variant="ghost" className="min-h-9 rounded-full px-2" aria-label={`Raw punches for ${r.employeeCode} on ${toDateInput(r.date)}`} onClick={onOpen}>View <span className="tabular-nums">{r.punchCount}</span></Button></TableCell>
  </TableRow>
}

function RawPunches({ row, onClose }: { row: Row; onClose: () => void }) {
  const input = { employeeCode: row.employeeCode, date: row.date }
  const punches = useQuery(orpc.attendance.days.punches.queryOptions({ input }))
  return <FormDrawer title="Raw punches" description={`${row.employee} · ${row.employeeCode} · work date ${formatDate(row.date)}`} onClose={onClose} width={600}>
    <div className="space-y-3"><div className="flex items-start justify-between gap-3"><p className="text-xs text-muted-foreground">Shift-owned punches, including overnight exits. Source details are shown as stored.</p><ExportButton disabled={!punches.data?.length || punches.isFetching} load={() => client.attendance.reports.exportPunches(input)} /></div>
      <FormError error={punches.error} />{punches.isPending && <RawPunchesSkeleton rows={Math.min(row.punchCount, 10)} />}
      {punches.data && <><p className="text-xs text-muted-foreground">{punches.data.length} stored punches · displayed in the employee’s work-location time zone</p>{punches.data.length === 0 && <EmptyState title="No stored punches" hint="The attendance status may come from a correction, leave or on-duty approval." />}
        <ol className="divide-y divide-border/60">{punches.data.map(p => <li key={p.id} className="space-y-1 py-3 text-sm"><p className="font-medium tabular-nums">{p.at.toLocaleDateString('en-IN', { timeZone: p.timezone })} · {p.time} <span className="text-xs font-normal text-muted-foreground">{p.timezone}</span></p><p className="break-all text-xs text-muted-foreground">{p.at.toISOString()}</p><p>{p.device ?? 'Device not supplied'}</p><p className="text-xs">Source: {p.source}{p.uploadId ? ` · upload #${p.uploadId}` : ''}</p>{p.uploadFile && <p className="break-all text-xs">File: {p.uploadFile}</p>}<p className="text-xs text-muted-foreground">Stored: {p.storedAt.toISOString()}</p></li>)}</ol></>}
      <p className="text-xs text-muted-foreground">These are retained punches, not the original machine payload. Card, direction, door and GPS fields are not stored.</p>
    </div>
  </FormDrawer>
}
