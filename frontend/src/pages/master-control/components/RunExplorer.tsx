import { ChevronDown, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import type { client } from '@/lib/orpc'
import { RUN_COLUMNS } from './labels'
import { duration, stamp } from './format'
import { RunRowsSkeleton } from '@/components/skeletons/master-control/MasterControlSkeleton'

type Runs = Awaited<ReturnType<typeof client.masterControl.runs>>
export function RunExplorer({ data, pending, search, setSearch, status, setStatus, hours, setHours, page, setPage, error }: {
  data?: Runs; pending: boolean; search: string; setSearch: (v: string) => void; status: string; setStatus: (v: string) => void;
  hours: number; setHours: (v: string) => void; page: number; setPage: (v: number) => void; error: boolean;
}) {
  return <section className="mc-panel mc-runs" aria-labelledby="runs-title">
    <div className="mc-section-head"><h2 id="runs-title">Job explorer</h2><span className="mc-muted">{data ? `${data.total.toLocaleString('en-IN')} matching runs` : 'Recorded executions'}</span></div>
    <div className="mc-filters">
      <label className="mc-search"><Search aria-hidden="true" /><span className="sr-only">Search job names</span><input maxLength={100} value={search} onChange={e => setSearch(e.target.value)} placeholder="Find a job…" /></label>
      <label className="mc-select"><span className="sr-only">Job result</span><select value={status} onChange={e => setStatus(e.target.value)}><option value="ALL">All results</option><option value="FAILED">Failed</option><option value="RUNNING">In progress</option><option value="OK">Completed</option></select><ChevronDown aria-hidden="true" /></label>
      <label className="mc-select"><span className="sr-only">Job time range</span><select value={hours} onChange={e => setHours(e.target.value)}><option value={24}>24 hours</option><option value={168}>7 days</option></select><ChevronDown aria-hidden="true" /></label>
    </div>
    <div className="mc-run-head" aria-hidden="true">{RUN_COLUMNS.map(label => <span key={label}>{label}</span>)}</div>
    {pending ? <RunRowsSkeleton /> : error ? <p className="mc-empty">Job runs could not be refreshed. Try Refresh.</p> : !data?.items.length ? <p className="mc-empty">No runs match these filters. Try another result or time range.</p> : <ul className="mc-run-list">{data.items.map(run => <li key={run.id}>
      <details><summary className="mc-run-row"><span className="mc-job"><strong>{run.job}</strong><span>{stamp(run.startedAt)} <span aria-hidden="true">·</span> #{run.id}</span></span><span className={`mc-result ${run.status === 'FAILED' ? 'bad' : run.status === 'RUNNING' ? 'warn' : 'good'}`}>{run.status === 'OK' ? 'Completed' : run.status === 'FAILED' ? 'Failed' : 'In progress'}</span><span className="mc-duration">{duration(run.durationMs)}<ChevronDown aria-hidden="true" /></span></summary>
        <div className="mc-run-detail"><strong>{run.failure?.category ?? (run.status === 'OK' ? 'Execution finished' : 'Execution has not finished')}</strong><p>{run.failure?.next ?? (run.finishedAt ? `Finished ${stamp(run.finishedAt)}.` : 'The worker has not recorded a finish. Check worker activity if this persists.')}</p><span>Raw error text stays in server logs to protect personal data and credentials.</span></div>
      </details>
    </li>)}</ul>}
    <div className="mc-pagination"><span>Page {page}{data ? ` of ${Math.max(1, Math.ceil(data.total / data.pageSize))}` : ''}</span><div><button type="button" aria-label="Previous page" disabled={page === 1 || pending} onClick={() => setPage(page - 1)}><ChevronLeft aria-hidden="true" /></button><button type="button" aria-label="Next page" disabled={!data || page * data.pageSize >= data.total || pending} onClick={() => setPage(page + 1)}><ChevronRight aria-hidden="true" /></button></div></div>
  </section>
}
