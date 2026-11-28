import type { client } from '@/lib/orpc'

type Overview = Awaited<ReturnType<typeof client.masterControl.overview>>
export function ActivityChart({ data }: { data: Overview }) {
  const firstHour = new Date(data.since); firstHour.setUTCMinutes(0, 0, 0)
  const bins = Array.from({ length: 25 }, (_, i) => {
    const at = new Date(firstHour.getTime() + i * 3600_000)
    const rows = data.jobs.timeline.filter(row => new Date(row.hour).getTime() === at.getTime())
    const count = (status: string) => rows.find(row => row.status === status)?.count ?? 0
    return { at, ok: count('OK'), failed: count('FAILED'), running: count('RUNNING') }
  })
  const max = Math.max(1, ...bins.map(bin => bin.ok + bin.failed + bin.running))
  const time = (date: Date) => date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata', hour12: false })
  return <section className="mc-panel mc-activity" aria-labelledby="activity-title">
    <div className="mc-section-head"><h2 id="activity-title">Execution rhythm</h2><span className="mc-muted">Last 24 hours · IST</span></div>
    <div className="mc-chart" role="img" aria-label={`${data.jobs.total} runs started in the last 24 hours: ${data.jobs.ok} completed, ${data.jobs.failed} failed, ${data.jobs.running} in progress. Hourly bars; first and last hours are partial.`}>
      <span className="mc-chart-max">{max} / hour</span>
      <div className="mc-bars">{bins.map(bin => <div className="mc-bar-slot" key={bin.at.toISOString()} title={`${time(bin.at)} IST: ${bin.ok} completed, ${bin.failed} failed, ${bin.running} in progress`}>
        <div className="mc-bar-stack" style={{ height: `${(bin.ok + bin.failed + bin.running) / max * 100}%` }}><span className="mc-bar-running" style={{ flex: bin.running }} /><span className="mc-bar-failed" style={{ flex: bin.failed }} /><span className="mc-bar-ok" style={{ flex: bin.ok }} /></div>
      </div>)}</div>
    </div>
    <div className="mc-chart-axis"><span>{time(firstHour)}</span><span>{time(new Date(firstHour.getTime() + 12 * 3600_000))}</span><span>{time(new Date(firstHour.getTime() + 24 * 3600_000))}</span></div>
    <div className="mc-chart-key"><span><i className="mc-dot good" />Completed</span><span><i className="mc-dot bad" />Failed</span><span><i className="mc-dot warn" />In progress</span><span>Edge hours are partial</span></div>
  </section>
}
