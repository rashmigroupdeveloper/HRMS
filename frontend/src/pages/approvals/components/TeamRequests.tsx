import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal, RotateCcw } from 'lucide-react'
import { useDeferredValue, useLayoutEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { ExportButton } from '@/components/ExportButton'
import { FormError } from '@/components/FormError'
import { Pill } from '@/components/Pill'
import { TeamRequestsSkeleton } from '@/components/skeletons/approvals/TeamRequestsSkeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { useAccess } from '@/hooks/useAccess'
import { client, orpc } from '@/lib/orpc'
import { TEAM_REPORT_COLUMNS, TEAM_REPORT_WIDTHS } from './request-kinds'
import { cn, formatDate, formatMoment, fromDateInput, toDateInput, todayDay } from '@/lib/utils'

// A report, not an approval queue: current team/department membership, every outcome, and full source messages.
type Filter = Omit<Parameters<typeof client.approvals.report>[0], 'page' | 'pageSize'>
type Row = Awaited<ReturnType<typeof client.approvals.report>>['items'][number]
const KINDS: [NonNullable<Filter['kind']>, string][] = [['LEAVE','Leave'],['LEAVE_CANCEL','Leave cancellation'],['REGULARIZATION','Regularisation'],['ON_DUTY','On duty'],['COMP_OFF','Comp off'],['SHIFT_CHANGE','Shift change']]
const STATUSES: [NonNullable<Filter['status']>, string][] = [['PENDING','Waiting'],['APPROVED','Approved'],['REJECTED','Rejected'],['CANCELLED','Withdrawn'],['EXPIRED','Expired'],['HELD','Held']]

export function TeamRequests() {
  const { me, can } = useAccess()
  const [params, setParams] = useSearchParams()
  const [moreFilters, setMoreFilters] = useState(false)
  const [month] = useState(() => {
    const now = todayDay()
    return {from:toDateInput(new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1))),to:toDateInput(new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+1,0)))}
  })
  const canSeeAll = can('LEAVE') || can('ATTENDANCE')
  const askedScope = params.get('people')
  const scope: Filter['scope'] = askedScope === 'DEPARTMENT' || askedScope === 'ALL' ? askedScope : 'TEAM'
  const from = params.get('from') ?? month.from, to = params.get('to') ?? month.to
  const dateBy = params.get('dateBy') === 'RAISED' ? 'RAISED' : 'WORK_DATES'
  const kind = KINDS.find(([key]) => key === params.get('requestType'))?.[0]
  const status = STATUSES.find(([key]) => key === params.get('status'))?.[0]
  const search = params.get('q') ?? '', deferredSearch = useDeferredValue(search.trim())
  const askedPage = Number(params.get('page') ?? 1)
  const page = Number.isSafeInteger(askedPage) && askedPage > 0 ? askedPage : 1
  const first = fromDateInput(from), last = fromDateInput(to)
  const valid = !!first && !!last && to >= from && last.getTime()-first.getTime() <= 366*86_400_000
  const filter: Filter = {scope,from:first ?? todayDay(),to:last ?? todayDay(),dateBy,kind,status,search:deferredSearch || undefined}
  const report = useQuery({...orpc.approvals.report.queryOptions({input:{...filter,page,pageSize:25}}),enabled:valid,placeholderData:keepPreviousData})
  const total = report.data?.total ?? 0
  const currentPage = report.data?.page ?? page
  const stale = report.isFetching || search.trim() !== deferredSearch
  const change = (key:string,value:string) => setParams(current => {
    const next = new URLSearchParams(current)
    if (value || key === 'from' || key === 'to') next.set(key,value); else next.delete(key)
    if (key !== 'page') next.delete('page')
    return next
  },{replace:true})
  const reset = () => setParams({tab:'team'},{replace:true})
  const extraCount = Number(scope !== 'TEAM') + Number(dateBy !== 'WORK_DATES')
  return <section className="min-w-0 space-y-3 rounded-2xl bg-card p-3 shadow-card sm:p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-baseline gap-2"><h2 className="text-sm font-semibold">Team requests</h2><span className="text-xs text-muted-foreground tabular-nums" aria-live="polite">{report.isPending || !valid || report.error ? '' : `${total} ${total === 1 ? 'match' : 'matches'}`}</span></div>
      <ExportButton disabled={!valid || !total || stale || !!report.error} title="Export every matching request, full messages and approval history" load={() => client.approvals.export({...filter,mode:'team'})} />
    </div>
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-0 basis-[calc(50%-4px)] space-y-1 sm:basis-32"><Label htmlFor="tr-from" className="text-xs text-muted-foreground">{dateBy==='RAISED'?'Requested from (UTC)':'Work / leave from'}</Label><Input id="tr-from" type="date" value={from} onInput={e=>change('from',e.currentTarget.value)} className="h-9 min-w-0 rounded-lg text-sm sm:h-8" /></div>
      <div className="min-w-0 basis-[calc(50%-4px)] space-y-1 sm:basis-32"><Label htmlFor="tr-to" className="text-xs text-muted-foreground">To</Label><Input id="tr-to" type="date" min={from} value={to} onInput={e=>change('to',e.currentTarget.value)} className="h-9 min-w-0 rounded-lg text-sm sm:h-8" /></div>
      <div className="min-w-0 basis-[calc(50%-4px)] space-y-1 sm:basis-40"><Label htmlFor="tr-type" className="text-xs text-muted-foreground">Request type</Label><NativeSelect id="tr-type" className="w-full [&_select]:h-9 [&_select]:rounded-lg sm:[&_select]:h-8" value={kind??''} onChange={e=>change('requestType',e.target.value)}><NativeSelectOption value="">All types</NativeSelectOption>{KINDS.map(([value,label])=><NativeSelectOption key={value} value={value}>{label}</NativeSelectOption>)}</NativeSelect></div>
      <div className="min-w-0 basis-[calc(50%-4px)] space-y-1 sm:basis-32"><Label htmlFor="tr-status" className="text-xs text-muted-foreground">Status</Label><NativeSelect id="tr-status" className="w-full [&_select]:h-9 [&_select]:rounded-lg sm:[&_select]:h-8" value={status??''} onChange={e=>change('status',e.target.value)}><NativeSelectOption value="">Every status</NativeSelectOption>{STATUSES.map(([value,label])=><NativeSelectOption key={value} value={value}>{label}</NativeSelectOption>)}</NativeSelect></div>
      <div className="min-w-32 flex-1 space-y-1 sm:max-w-56"><Label htmlFor="tr-search" className="text-xs text-muted-foreground">Employee</Label><div className="relative"><Search aria-hidden className="pointer-events-none absolute top-2.5 left-2.5 size-3.5 text-muted-foreground sm:top-2" /><Input id="tr-search" placeholder="Name or code" maxLength={100} value={search} onChange={e=>change('q',e.target.value)} className="h-9 rounded-lg pl-8 text-sm sm:h-8" /></div></div>
      <Button variant="secondary" className="h-9 gap-1.5 px-3 text-xs sm:h-8" aria-expanded={moreFilters} aria-controls="team-extra-filters" onClick={()=>setMoreFilters(v=>!v)}><SlidersHorizontal className="size-3.5" />Filters{extraCount>0?` (${extraCount})`:''}</Button>
      <Button variant="ghost" className="size-9 shrink-0 p-0 sm:size-8" aria-label="Reset report filters" title="Reset report filters" onClick={reset}><RotateCcw className="size-3.5" /></Button>
    </div>
    {moreFilters && <div id="team-extra-filters" className="flex flex-wrap gap-3 rounded-xl bg-surface-2/50 p-2.5">
      <div className="min-w-40 flex-1 space-y-1 sm:max-w-48"><Label htmlFor="tr-people" className="text-xs text-muted-foreground">People</Label><NativeSelect id="tr-people" className="w-full [&_select]:h-9 [&_select]:rounded-lg sm:[&_select]:h-8" value={scope} onChange={e=>change('people',e.target.value)}><NativeSelectOption value="TEAM">My team</NativeSelectOption>{(!!me?.hodPosts || scope==='DEPARTMENT') && <NativeSelectOption value="DEPARTMENT">My department</NativeSelectOption>}{(canSeeAll || scope==='ALL') && <NativeSelectOption value="ALL">Within my access</NativeSelectOption>}</NativeSelect></div>
      <div className="min-w-40 flex-1 space-y-1 sm:max-w-48"><Label htmlFor="tr-dates" className="text-xs text-muted-foreground">Dates mean</Label><NativeSelect id="tr-dates" className="w-full [&_select]:h-9 [&_select]:rounded-lg sm:[&_select]:h-8" value={dateBy} onChange={e=>change('dateBy',e.target.value)}><NativeSelectOption value="WORK_DATES">Work / leave dates</NativeSelectOption><NativeSelectOption value="RAISED">Requested on (UTC)</NativeSelectOption></NativeSelect></div>
      <p className="basis-full text-xs text-muted-foreground">{scope==='TEAM'?'Current reporting team, including indirect reports.':scope==='DEPARTMENT'?'People in the departments you currently head.':'Leave and attendance use their own access rules.'}</p>
    </div>}
    {!valid && <p role="alert" className="text-xs text-negative-ink">Choose valid dates in order, no more than one year apart.</p>}
    <FormError error={report.error} />
    {valid && report.isPending ? <TeamRequestsSkeleton label="Loading team requests" /> : valid && !report.error && report.data && <>
      {!total ? <EmptyState className="py-6" title="No matching requests" hint="Try different dates or filters. My team covers your current reporting team." /> : <div className={cn('min-w-0 transition-opacity motion-reduce:transition-none',stale && 'opacity-50')} aria-busy={stale}>
        <p id="tr-scroll-hint" className="mb-1 text-xs text-muted-foreground lg:hidden">Scroll across for messages and remarks. Export includes all {total} matches.</p>
        <Table tabIndex={0} aria-label="Team requests" aria-describedby="tr-scroll-hint" className="min-w-[960px] table-fixed text-[13px]">
          <TableHeader><TableRow>{TEAM_REPORT_COLUMNS.map((h,i)=><TableHead key={h} style={{width:TEAM_REPORT_WIDTHS[i]}} className={cn('h-8 px-2 text-xs',i===0&&'sticky left-0 z-10 bg-card')}>{h}</TableHead>)}</TableRow></TableHeader>
          <TableBody>{report.data.items.map(r=><ReportRow key={r.id} row={r} />)}</TableBody>
        </Table>
      </div>}
      {total > 25 && <nav aria-label="Team requests pages" className="flex items-center justify-between gap-2"><span className="text-xs text-muted-foreground tabular-nums">{(currentPage-1)*25+1}–{Math.min(currentPage*25,total)} of {total}</span><div className="flex items-center gap-2"><Button variant="secondary" size="icon" className="size-9" aria-label="Previous page" disabled={currentPage<=1||stale} onClick={()=>change('page',String(currentPage-1))}><ChevronLeft /></Button><Button variant="secondary" size="icon" className="size-9" aria-label="Next page" disabled={currentPage*25>=total||stale} onClick={()=>change('page',String(currentPage+1))}><ChevronRight /></Button></div></nav>}
    </>}
  </section>
}

function ExpandableText({text}:{text:string}) {
  const [expanded,setExpanded] = useState(false)
  const [canExpand,setCanExpand] = useState(false)
  const paragraph = useRef<HTMLParagraphElement>(null)
  useLayoutEffect(()=>{
    if (expanded || !paragraph.current) return
    const node = paragraph.current
    const measure = () => setCanExpand(node.scrollHeight > node.clientHeight + 1)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  },[text,expanded])
  return <><p ref={paragraph} className={cn('whitespace-pre-wrap break-words leading-5',!expanded&&'line-clamp-2')}>{text}</p>{(canExpand||expanded)&&<button type="button" aria-expanded={expanded} className="min-h-9 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring sm:min-h-5" onClick={()=>setExpanded(v=>!v)}>{expanded?'Show less':'Read full message'}</button>}</>
}

function ReportRow({row:r}:{row:Row}) {
  const tone = r.status==='Approved'?'positive':r.status==='Rejected'?'negative':r.status==='Held'?'warning':r.status==='Waiting'?'gold':'neutral'
  const last = r.decisions.at(-1)
  return <TableRow className="[&>td]:align-top hover:bg-surface-2/30">
    <TableCell className="sticky left-0 z-10 whitespace-normal break-words bg-card px-2 py-1.5"><p className="font-medium">{r.employee}</p><p className="text-xs text-muted-foreground">{r.employeeCode}</p></TableCell>
    <TableCell className="whitespace-normal px-2 py-1.5"><p className="font-medium">{r.kind}</p><p className="text-xs text-muted-foreground">#{r.id}</p></TableCell>
    <TableCell className="px-2 py-1.5 text-xs tabular-nums"><p>{r.from?formatDate(r.from):'Dates unavailable'}</p>{r.to&&r.from&&r.to.getTime()!==r.from.getTime()&&<p>to {formatDate(r.to)}</p>}{r.days!==null&&<p className="text-muted-foreground">{r.days} {r.days===1?'day':'days'}</p>}{r.portion&&r.portion!=='Whole days'&&<p className="text-muted-foreground">{r.portion}</p>}</TableCell>
    <TableCell className="whitespace-normal px-2 py-1.5"><ExpandableText text={r.reason??(r.sourceAvailable?'No message recorded.':'Source details unavailable.')} /></TableCell>
    <TableCell className="space-y-0.5 whitespace-normal px-2 py-1.5">
      <details className="peer text-xs"><summary className="flex min-h-9 cursor-pointer items-center justify-between gap-2 focus-visible:outline-2 focus-visible:outline-ring sm:min-h-6"><Pill tone={tone}>{r.status}</Pill><span className="text-muted-foreground underline underline-offset-2">{r.decisions.length?`History (${r.decisions.length})`:'Details'}</span></summary><div className="space-y-2 py-2"><p>{r.company}{r.department?` · ${r.department}`:''}</p><p>{r.summary}</p><p>Raised by {r.raisedBy?.name??'Unknown'} · {formatMoment(r.raisedAt)}</p>{r.currentStep&&r.status==='Waiting'&&<p>{r.currentStep}</p>}{r.withdrawalReason&&<p>Withdrawal: {r.withdrawalReason}</p>}{r.heldReason&&<p>Held: {r.heldReason}</p>}{r.closedAt&&<p>Closed {formatMoment(r.closedAt)}</p>}{r.decisions.map(d=><div key={d.step}><p className="text-muted-foreground">Step {d.step}: {d.status.toLowerCase()} · {d.by?.name??(d.automatic?'Automatic':'Unknown approver')}{d.at?` · ${formatMoment(d.at)}`:''}</p>{d.comment&&<p className="mt-0.5 whitespace-pre-wrap break-words">{d.comment}</p>}</div>)}</div></details>
      {r.status==='Waiting'&&r.currentStep&&<p className="truncate text-xs text-muted-foreground peer-open:hidden">{r.currentStep}</p>}{r.heldReason&&<p className="line-clamp-1 text-xs text-warning-ink peer-open:hidden">{r.heldReason}</p>}{last?.comment&&<p className="line-clamp-1 text-xs peer-open:hidden">{last.comment}</p>}
    </TableCell>
  </TableRow>
}
