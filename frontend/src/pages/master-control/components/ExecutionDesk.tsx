import type { client } from '@/lib/orpc'
import { METRIC_LABELS } from './labels'

type Overview = Awaited<ReturnType<typeof client.masterControl.overview>>
// Open numerals and a proportional outcome strip, inspired by the Crextio reference. Every segment is a real count.
export function ExecutionDesk({ data }: { data: Overview }) {
  const { jobs } = data
  const percent = jobs.total ? Math.round(jobs.ok / jobs.total * 1000) / 10 : null
  return <section className="mc-execution-desk" aria-label="Job runs started in the last 24 hours">
    <div className="mc-outcomes"><div><h2>Execution mix</h2><span>{jobs.total.toLocaleString('en-IN')} runs · last 24 hours</span></div>
      <div className="mc-outcome-strip" role="img" aria-label={`${jobs.ok} completed, ${jobs.failed} failed, ${jobs.running} in progress`}>{jobs.total > 0 ? <><span className="mc-mix-ok" style={{ flex: jobs.ok }} /><span className="mc-mix-failed" style={{ flex: jobs.failed }} /><span className="mc-mix-running" style={{ flex: jobs.running }} /></> : <span className="mc-mix-empty" />}</div>
      <p>{percent === null ? 'No executions recorded in this window' : `${percent}% of started runs are recorded as completed`}</p>
    </div>
    <div className="mc-open-stats">{[jobs.ok, jobs.failed, jobs.running].map((n, i) => <div key={METRIC_LABELS[i + 1]}><strong className={i === 1 && n > 0 ? 'mc-negative' : ''}>{n.toLocaleString('en-IN')}</strong><span>{METRIC_LABELS[i + 1]}</span></div>)}</div>
  </section>
}
