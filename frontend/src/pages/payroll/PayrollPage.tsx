import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { FormError } from '@/components/FormError'
import { Pill } from '@/components/Pill'
import { PayrollRunsSkeleton } from '@/components/skeletons/payroll/PayrollRunsSkeleton'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Input } from '@/components/ui/input'
import { useAccess } from '@/hooks/useAccess'
import { orpc } from '@/lib/orpc'
import { formatDate, todayDay, toDateInput } from '@/lib/utils'
import { NewPayrollRun } from './components/NewPayrollRun'
import { PAYROLL_NOTE } from './components/payroll-labels'

export function PayrollPage() {
  const { ready, can } = useAccess()
  const [params, setParams] = useSearchParams()
  const now = todayDay(), initialMonth = toDateInput(now).slice(0, 7)
  const rawYear = params.get('year') ?? String(now.getUTCFullYear())
  const rawCompany = params.get('company') ?? ''
  const rawPage = params.get('page') ?? '1'
  const positive = (text: string) => /^\d+$/.test(text) && Number.isSafeInteger(Number(text)) && Number(text) > 0
  const valid = /^\d{4}$/.test(rawYear) && Number(rawYear) >= 2000 && Number(rawYear) <= 2100 && (!rawCompany || positive(rawCompany)) && positive(rawPage) && Number(rawPage) <= 100000
  const year = valid ? Number(rawYear) : now.getUTCFullYear(), page = valid ? Number(rawPage) : 1
  const [creating, setCreating] = useState(false)
  const navigate = useNavigate()
  const setup = useQuery({ ...orpc.payroll.setup.queryOptions({ input: { payMonth: new Date(`${initialMonth}-01T00:00:00Z`) } }), enabled: ready && can('PAYROLL') })
  const query = useQuery({ ...orpc.payroll.list.queryOptions({ input: { year, companyId: rawCompany && positive(rawCompany) ? Number(rawCompany) : undefined, page, pageSize: 25 } }), enabled: valid && ready && can('PAYROLL') })
  const data = query.data
  const change = (key: string, value: string) => setParams(old => { const next = new URLSearchParams(old); if (value) next.set(key, value); else next.delete(key); if (key !== 'page' && key !== 'run') next.delete('page'); return next }, { replace: true })
  return <div className="space-y-4">
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1"><h1 className="flex min-h-9 items-center text-2xl font-light tracking-tight">Payroll</h1>{ready && can('PAYROLL', 'WRITE') && <Button className="min-h-9 rounded-full" disabled={!setup.data?.companies.some(c => c.canCreate)} title="Requires Payroll Edit covering a whole active India payroll company" onClick={() => setCreating(true)}><Plus aria-hidden />New payroll run</Button>}<p className="col-span-2 text-sm text-muted-foreground">Regular monthly runs · India payroll companies</p></header>
    <p className="max-w-3xl text-sm text-muted-foreground">{PAYROLL_NOTE}</p>
    <section className="min-w-0 space-y-3 rounded-3xl bg-card p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><h2 className="text-lg font-medium">Payroll runs</h2><div className="grid w-full min-w-0 grid-cols-[5rem_minmax(0,1fr)] gap-3 sm:w-auto sm:grid-cols-[6rem_minmax(0,16rem)]"><div className="space-y-1"><Label htmlFor="payroll-year">Year</Label><Input className="h-9 w-full" id="payroll-year" type="number" min={2000} max={2100} value={rawYear} onChange={e => change('year', e.target.value)} /></div><div className="min-w-0 space-y-1"><Label htmlFor="payroll-company-filter">Company</Label><NativeSelect id="payroll-company-filter" className="w-full [&_select]:h-9 [&_select]:truncate" value={rawCompany} onChange={e => change('company', e.target.value)}><NativeSelectOption value="">All within full-company access</NativeSelectOption>{rawCompany && !setup.data?.companies.some(c => String(c.id) === rawCompany) && <NativeSelectOption value={rawCompany}>Selected company</NativeSelectOption>}{setup.data?.companies.map(c => <NativeSelectOption key={c.id} value={String(c.id)}>{c.code} · {c.name}</NativeSelectOption>)}</NativeSelect></div></div></div>
      {!valid && <p role="alert" className="text-sm text-negative-ink">Choose a year from 2000 to 2100 and valid company/page filters.</p>}
      <FormError error={setup.error ?? query.error} />
      {valid && query.isPending && <PayrollRunsSkeleton />}
      {valid && data && (data.total === 0 ? <div className="py-6"><p className="font-medium">No payroll runs for these filters</p><p className="mt-1 text-sm text-muted-foreground">Try another year or company. Runs require Payroll access covering the whole company.</p></div> : <><div className="divide-y">{data.items.map(r => <div key={r.id} className="grid min-h-24 items-center gap-2 py-3 sm:grid-cols-[1fr_1fr_auto]"><div className="min-w-0"><Link className="inline-flex min-h-9 items-center text-left font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring" to={`/manage/payroll/${r.id}`}>{new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(r.payMonth)}</Link><p className="break-words text-sm text-muted-foreground">{r.company.code} · {r.company.name}</p></div><div><p className="text-xs text-muted-foreground">Attendance period</p><p className="text-sm tabular-nums">{formatDate(r.attendanceFrom)} – {formatDate(r.attendanceTo)}</p><p className="text-xs text-muted-foreground tabular-nums">{r.people} {r.people === 1 ? 'person' : 'people'}</p></div><Pill className="justify-self-start" tone="neutral">Draft</Pill></div>)}</div>
      <nav aria-label="Payroll run pages" className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground"><span>{data.total} {data.total === 1 ? 'run' : 'runs'} · page {page}</span><div className="flex gap-1"><Button size="sm" variant="secondary" className="min-h-9 rounded-full" disabled={page <= 1 || query.isFetching} onClick={() => change('page', String(page - 1))}><ChevronLeft aria-hidden />Previous</Button><Button size="sm" variant="secondary" className="min-h-9 rounded-full" disabled={page * 25 >= data.total || query.isFetching} onClick={() => change('page', String(page + 1))}>Next<ChevronRight aria-hidden /></Button></div></nav>{!data.items.length && <Button variant="secondary" onClick={() => change('page', '1')}>First page</Button>}</>)}
    </section>
    {creating && <NewPayrollRun initialMonth={initialMonth} close={() => setCreating(false)} created={id => { setCreating(false); navigate(`/manage/payroll/${id}`) }} />}
    {params.get('run') && positive(params.get('run')!) && <Navigate replace to={`/manage/payroll/${params.get('run')}`} />}
  </div>
}
