import { useDeferredValue, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, CirclePause, Radio, RefreshCw, ShieldCheck } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { usePortal } from '@/hooks/usePortal'
import { client, orpc } from '@/lib/orpc'
import { FormError } from '@/components/FormError'
import { NotFoundPage } from '@/pages/not-found/NotFoundPage'
import { MasterControlSkeleton } from '@/components/skeletons/master-control/MasterControlSkeleton'
import { OrganisationBoardSkeleton } from '@/components/skeletons/organisation/OrganisationBoardSkeleton'
import { OrganisationBoard } from '@/pages/organisation/components/OrganisationBoard'
import { CONTROL_TABS } from './components/labels'
import { ExecutionDesk } from './components/ExecutionDesk'
import { ServiceMap } from './components/ServiceMap'
import { ActivityChart } from './components/ActivityChart'
import { MailPanel, RuntimePanel, Toolbox } from './components/OperationsPanels'
import { RunExplorer } from './components/RunExplorer'
import { stamp } from './components/format'
import './master-control.css'

export function MasterControlPage() {
  const me = useCurrentUser()
  const { to } = usePortal()
  const [params, setParams] = useSearchParams()
  const view = CONTROL_TABS.find(tab => tab === params.get('view')) ?? 'Overview'
  const status = ['ALL', 'OK', 'RUNNING', 'FAILED'].find(value => value === params.get('status')) as 'ALL' | 'OK' | 'RUNNING' | 'FAILED' | undefined ?? 'ALL'
  const hours = params.get('hours') === '168' ? 168 : 24
  const page = Math.min(10000, Math.max(1, Math.floor(Number(params.get('page')) || 1)))
  const [search, setSearch] = useState(params.get('search') ?? '')
  const deferredSearch = useDeferredValue(search)
  const [live, setLive] = useState(true)
  const allowed = me.data?.canMasterControl === true
  const rawCompany = Number(params.get('company'))
  const companyId = Number.isInteger(rawCompany) && rawCompany > 0 ? rawCompany : undefined
  const overview = useQuery({ ...orpc.masterControl.overview.queryOptions(), enabled: allowed, retry: false, gcTime: 0, refetchOnWindowFocus: live, refetchOnReconnect: live, refetchInterval: allowed && live ? 15_000 : false })
  const organisation = useQuery({ ...orpc.masterControl.organisation.queryOptions({ input: { companyId } }), enabled: allowed && view === 'Organisation', retry: false, gcTime: 0 })
  const runs = useQuery({ ...orpc.masterControl.runs.queryOptions({ input: { status, search: deferredSearch, hours, page } }), enabled: allowed && view === 'Job explorer', retry: false, gcTime: 0, refetchOnWindowFocus: live, refetchOnReconnect: live, refetchInterval: allowed && live && view === 'Job explorer' ? 15_000 : false })
  const update = (values: Record<string, string>) => setParams(previous => { const next = new URLSearchParams(previous); for (const [key, value] of Object.entries(values)) next.set(key, value); return next }, { replace: true })
  const switchView = (tab: string) => update({ view: tab })
  if (me.data && !allowed) return <NotFoundPage />
  const data = overview.data
  const denied = (error: unknown) => error && typeof error === 'object' && 'code' in error && ['NOT_FOUND', 'FORBIDDEN', 'UNAUTHORIZED'].includes(String(error.code))
  // Never keep displaying a cached snapshot after the backend revokes this private capability.
  if (denied(overview.error) || denied(runs.error)) return <NotFoundPage />
  const busy = overview.isFetching || (view === 'Job explorer' && runs.isFetching)
  const refresh = () => {void overview.refetch();if (view === 'Job explorer') void runs.refetch()}
  return <div className="mc-workspace">
    <div className="mc-title-row"><div><h1>Master Control<span className="mc-title-mark" aria-hidden="true"><span /><span /><span /></span></h1><p>The system, in focus.</p></div><div className="mc-owner"><ShieldCheck aria-hidden="true" /><span>Private workspace<span>RML033903</span></span></div></div>
    <div className="mc-toolbar"><nav aria-label="Master Control sections">{CONTROL_TABS.map(tab => <button type="button" key={tab} aria-current={view === tab ? 'page' : undefined} onClick={() => switchView(tab)}>{tab}</button>)}</nav><div className="mc-refresh-controls"><button type="button" className="mc-live" aria-pressed={live} onClick={() => setLive(!live)}>{live ? <Radio aria-hidden="true" /> : <CirclePause aria-hidden="true" />}{live ? 'Live · 15s' : 'Paused'}</button><button type="button" className="mc-refresh" disabled={busy || !allowed} onClick={refresh}><RefreshCw aria-hidden="true" className={busy ? 'mc-refreshing' : ''} />{busy ? 'Checking…' : 'Refresh'}</button></div></div>
    <div className="mc-freshness" aria-live="polite">{view === 'Organisation' ? 'Headcount of people working now' : data ? `${overview.isError ? 'Refresh failed · last successful check' : 'Last successful check'} ${stamp(data.checkedAt)}` : 'Connecting to system diagnostics'}<span>{view === 'Organisation' ? 'Counts only · no names' : 'Account-bound access · operational data only'}</span></div>
    <FormError error={overview.error} />
    {view === 'Organisation' ? <div className="mc-dashboard"><FormError error={organisation.error} />{organisation.isPending ? <OrganisationBoardSkeleton kind={companyId ? 'drill' : 'companies'} exports /> : organisation.data && organisation.data.level !== 'NONE' ? <OrganisationBoard board={organisation.data} onExport={() => client.masterControl.exportOrganisation({ companyId })} companyHref={organisation.data.level === 'COMPANY' ? (id) => `${to('/master-control')}?view=Organisation&company=${id}` : undefined} onBack={organisation.data.company ? () => update({ view: 'Organisation', company: '' }) : undefined} /> : organisation.isError ? null : <div className="mc-panel mc-empty">No companies to show.</div>}</div> : view === 'Job explorer' ? <div className="mc-dashboard"><FormError error={runs.error} /><RunExplorer data={runs.data} pending={runs.isPending} error={runs.isError} status={status} setStatus={value => update({ status: value, page: '1' })} hours={hours} setHours={value => update({ hours: value, page: '1' })} page={page} setPage={value => update({ page: String(value) })} search={search} setSearch={value => {setSearch(value);update({ search: value, page: '1' })}} /></div> : !data ? overview.isError ? <div className="mc-panel mc-empty">Diagnostics are unavailable. Check your connection and try Refresh.</div> : <MasterControlSkeleton view={view} /> : <div className="mc-dashboard">
      {view === 'Overview' && <>
        <ExecutionDesk data={data} />
        <div className="mc-top-grid"><ServiceMap data={data} /><section className="mc-panel mc-attention" aria-labelledby="attention-title"><div className="mc-section-head"><h2 id="attention-title">Needs attention</h2><span className="mc-count">{Number(data.jobs.failed > 0) + Number(data.mail.failed + data.mail.pending > 0) + Number(!data.worker.recent) + Number(!data.storage.available) + Number((data.migrations?.unresolved ?? 0) > 0) + 1}</span></div>
          <button className="mc-attention-row" type="button" onClick={() => update({ view: 'Job explorer', status: 'FAILED', page: '1' })}><span><strong>{data.jobs.failed ? `${data.jobs.failed} failed job runs` : 'No failed runs in 24 hours'}</strong><span>Inspect execution history</span></span><ArrowRight aria-hidden="true" /></button>
          <button className="mc-attention-row" type="button" onClick={() => switchView('Mail queue')}><span><strong>{data.mail.failed || data.mail.pending ? `${data.mail.pending} waiting · ${data.mail.failed} failed mails` : 'Mail retry queue is clear'}</strong><span>{data.runtime.mailMode === 'LOCAL_OUTBOX' ? 'Delivery is in local outbox mode' : 'Review retry records'}</span></span><ArrowRight aria-hidden="true" /></button>
          <div className="mc-attention-row"><span><strong>{data.worker.recent ? 'Worker activity recorded' : 'No recent worker signal'}</strong><span>Mail retry activity; not a dedicated heartbeat</span></span></div>
          {!data.storage.available && <div className="mc-attention-row"><span><strong>Storage needs checking</strong><span>Read/write access could not be confirmed</span></span></div>}
          {!!data.migrations?.unresolved && <div className="mc-attention-row"><span><strong>{data.migrations.unresolved} unresolved migrations</strong><span>Inspect migration status before releasing</span></span></div>}
          <div className="mc-attention-row mc-recovery"><span><strong>Recovery evidence not connected</strong><span>Backup age and restore drills are unverified</span></span></div>
        </section></div>

        <div className="mc-bottom-grid"><ActivityChart data={data} /><MailPanel data={data} /></div>
        <div className="mc-bottom-grid mc-tools-grid"><Toolbox data={data} /><RuntimePanel data={data} compact /></div>
      </>}
      {view === 'Mail queue' && <MailPanel data={data} expanded />}
      {view === 'Toolbox' && <div className="mc-bottom-grid mc-tools-grid"><Toolbox data={data} /><RuntimePanel data={data} /></div>}
    </div>}
  </div>
}
