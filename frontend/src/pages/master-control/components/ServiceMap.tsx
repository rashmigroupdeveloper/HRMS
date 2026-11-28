import { useState } from 'react'
import { Database, HardDrive, Mail, Workflow } from 'lucide-react'
import type { client } from '@/lib/orpc'
import { SERVICE_LABELS } from './labels'
import { formatBytes, stamp } from './format'

type Overview = Awaited<ReturnType<typeof client.masterControl.overview>>
export function ServiceMap({ data }: { data: Overview }) {
  const [selected, setSelected] = useState(0)
  const services = [
    { Icon: Database, state: 'Reachable', tone: 'good', detail: `Database answered in ${data.databaseMs} ms. ${data.migrations ? `${data.migrations.applied} migrations recorded; ${data.migrations.unresolved} unresolved.` : 'Migration metadata is unavailable.'}` },
    { Icon: Workflow, state: data.worker.recent ? 'Recent activity' : 'No recent signal', tone: data.worker.recent ? 'good' : 'warn', detail: data.worker.evidence ? `Mail retry job last started ${stamp(data.worker.evidence.startedAt)}. This is activity evidence, not a dedicated heartbeat.` : 'No mail retry job has been recorded. Check that the worker process is running.' },
    { Icon: HardDrive, state: data.storage.available ? 'Accessible' : 'Needs checking', tone: data.storage.available ? 'good' : 'warn', detail: data.storage.available ? `${formatBytes(data.storage.freeBytes!)} free on the storage filesystem. Read/write permissions are present; individual files and recovery have not been tested.` : 'Storage directory cannot be accessed with read/write permissions. Check the configured directory on the server.' },
    { Icon: Mail, state: data.runtime.mailMode === 'LOCAL_OUTBOX' ? 'Local outbox' : 'SMTP configured', tone: data.runtime.mailMode === 'LOCAL_OUTBOX' ? 'warn' : 'neutral', detail: data.runtime.mailMode === 'LOCAL_OUTBOX' ? 'Mail is saved on the server instead of delivered. Configure SMTP to enable outgoing delivery.' : 'SMTP is configured. This does not verify connectivity or delivery to an inbox.' },
  ]
  return <section className="mc-map-panel" aria-labelledby="service-map-title">
    <div className="mc-section-head"><h2 id="service-map-title">Service map</h2><span className="mc-dark-note">Select a service to inspect</span></div>
    <div className="mc-map">
      <svg className="mc-connectors" viewBox="0 0 700 210" preserveAspectRatio="none" aria-hidden="true"><path d="M150 54 H285 Q310 54 310 80 V105 H390 V80 Q390 54 415 54 H550 M150 156 H285 Q310 156 310 130 V105 M390 105 V130 Q390 156 415 156 H550" /></svg>
      <div className="mc-core" aria-hidden="true"><span className="mc-core-mark"><span /><span /><span /></span><strong>HRMS</strong><span>{data.runtime.environment}</span></div>
      {services.map(({ Icon, state, tone }, i) => <button key={SERVICE_LABELS[i]} type="button" className={`mc-service mc-service-${i} ${selected === i ? 'is-selected' : ''}`} aria-pressed={selected === i} onClick={() => setSelected(i)}>
        <Icon aria-hidden="true" /><span><strong>{SERVICE_LABELS[i]}</strong><span><i className={`mc-dot ${tone}`} />{state}</span></span>
      </button>)}
    </div>
    <div className="mc-inspection" role="status"><strong>{SERVICE_LABELS[selected]}</strong><p>{services[selected]!.detail}</p></div>
  </section>
}
