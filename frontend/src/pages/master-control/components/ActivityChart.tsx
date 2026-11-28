import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { client } from '@/lib/orpc'

type Overview = Awaited<ReturnType<typeof client.masterControl.overview>>
export function ActivityChart({ data }: { data: Overview }) {
  const [selectedHour, setSelectedHour] = useState<string | null>(null)
  const firstHour = new Date(data.since); firstHour.setUTCMinutes(0, 0, 0)
  const bins = Array.from({ length: 25 }, (_, i) => {
    const at = new Date(firstHour.getTime() + i * 3600_000)
    const rows = data.jobs.timeline.filter(row => new Date(row.hour).getTime() === at.getTime())
    const count = (status: string) => rows.find(row => row.status === status)?.count ?? 0
    return { at, ok: count('OK'), failed: count('FAILED'), running: count('RUNNING') }
  })
  const max = Math.max(1, ...bins.map(bin => bin.ok + bin.failed + bin.running))
  const time = (date: Date) => date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata', hour12: false })
  const selected = bins.find(bin => bin.at.toISOString() === selectedHour)
  return <section className="mc-panel mc-activity" aria-labelledby="activity-title">
    <div className="mc-section-head"><h2 id="activity-title">Execution rhythm</h2><span className="mc-muted">Last 24 hours · IST</span></div>
    <div className="mc-chart" role="group" aria-label={`${data.jobs.total} runs started in the last 24 hours: ${data.jobs.ok} completed, ${data.jobs.failed} failed, ${data.jobs.running} in progress. Hourly bars; first and last hours are partial.`}>
      <span className="mc-chart-max">{max} / hour</span>
      <div className="mc-bars">{bins.map(bin => <button type="button" className="mc-bar-slot" key={bin.at.toISOString()} aria-pressed={selectedHour === bin.at.toISOString()} onClick={() => setSelectedHour(bin.at.toISOString())} aria-label={`${bin.at.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'Asia/Kolkata' })}, ${time(bin.at)} IST: ${bin.ok} completed, ${bin.failed} failed, ${bin.running} in progress`} title={`${time(bin.at)} IST: ${bin.ok} completed, ${bin.failed} failed, ${bin.running} in progress`}>
        <span className="mc-bar-stack" style={{ height: `${(bin.ok + bin.failed + bin.running) / max * 100}%` }}><span className="mc-bar-running" style={{ flex: bin.running }} /><span className="mc-bar-failed" style={{ flex: bin.failed }} /><span className="mc-bar-ok" style={{ flex: bin.ok }} /></span>
      </button>)}</div>
    </div>
    <div className="mc-chart-axis"><span>{time(firstHour)}</span><span>{time(new Date(firstHour.getTime() + 12 * 3600_000))}</span><span>{time(new Date(firstHour.getTime() + 24 * 3600_000))}</span></div>
    <div className="mc-hour-reading"><p className="mc-chart-reading" role="status">{selected ? `${time(selected.at)} IST · ${selected.ok} completed · ${selected.failed} failed · ${selected.running} in progress` : 'Select an hour to inspect its executions'}</p><label className="mc-select"><span className="sr-only">Hour to inspect</span><select value={selectedHour ?? ''} onChange={e => setSelectedHour(e.target.value || null)}><option value="">Choose hour</option>{bins.map(bin => <option key={bin.at.toISOString()} value={bin.at.toISOString()}>{bin.at.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'Asia/Kolkata' })} · {time(bin.at)} IST</option>)}</select><ChevronDown aria-hidden="true" /></label></div>
    <div className="mc-chart-key"><span><i className="mc-dot good" />Completed</span><span><i className="mc-dot bad" />Failed</span><span><i className="mc-dot warn" />In progress</span><span>Edge hours are partial</span></div>
  </section>
}
