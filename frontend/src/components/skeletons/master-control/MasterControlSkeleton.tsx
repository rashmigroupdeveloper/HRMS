import { Database, HardDrive, Mail, Workflow } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { METRIC_LABELS, SERVICE_LABELS } from '@/pages/master-control/components/labels'
import { Toolbox } from '@/pages/master-control/components/OperationsPanels'

function RuntimeSkeleton({ compact = false }: { compact?: boolean }) {
  const base = ['Environment', 'Release', 'Process uptime', 'Process memory']
  const more = ['Node.js', 'JavaScript heap', 'Storage free', 'Migration records']
  const rows = (labels: string[]) => <dl className="mc-facts">{labels.map(name => <div key={name}><dt>{name}</dt><dd><Skeleton className="h-4 w-24" /></dd></div>)}</dl>
  return <section className="mc-panel"><div className="mc-section-head"><h2>Under the hood</h2><span className="mc-muted">API process</span></div>{rows(base)}{compact ? <details className="mc-more-diagnostics"><summary>More diagnostics</summary>{rows(more)}</details> : rows(more)}<p className="mc-caption">Figures describe this API process. Migration records do not verify release alignment.</p></section>
}
function MailSkeleton({ expanded = false }: { expanded?: boolean }) {
  return <section className="mc-panel"><div className="mc-section-head"><h2>Mail queue</h2><Skeleton className="h-3 w-20" /></div><div className="mc-mail-numbers">{['Waiting to retry', 'Gave up'].map(name => <div key={name}><span>{name}</span><Skeleton className="mt-2 h-8 w-12" /></div>)}</div><div className="mc-caption"><Skeleton className="mb-1 h-3 w-4/5" />SMTP acceptance does not confirm inbox delivery.</div>{expanded ? <><div className="mc-mail-list">{Array.from({ length: 3 }, (_, i) => <div key={i}><span><Skeleton className="h-4 w-24" /><Skeleton className="mt-1 h-3 w-32" /></span><span><Skeleton className="h-4 w-24" /><Skeleton className="mt-1 h-3 w-28" /></span></div>)}</div><p className="mc-caption">Oldest 12 retry records. Recipients, subjects and message bodies are private. Sent messages are removed from this queue; failed records are retained for 30 days. Regenerate expired codes in the original workflow.</p></> : <div className="mc-mail-preview">{[0, 1].map(i => <div key={i}><Skeleton className="h-3 w-20" /><Skeleton className="h-3 w-28" /></div>)}</div>}</section>
}
export function RunRowsSkeleton() {
  return <div role="status" aria-label="Loading job runs">{Array.from({ length: 5 }, (_, i) => <div className="mc-run-skeleton" key={i}><div><Skeleton className="h-4 w-48 max-w-full" /><Skeleton className="mt-2 h-3 w-28" /></div><Skeleton className="h-5 w-16" /><Skeleton className="h-4 w-10" /></div>)}</div>
}
// The loaded page's own grid, labels, icons and geometry; only observations become bars. Keep panel labels in sync.
export function MasterControlSkeleton({ label = 'Loading Master Control', view = 'Overview' }: { label?: string; view?: string }) {
  const bottom = <div className="mc-bottom-grid mc-tools-grid"><Toolbox /><RuntimeSkeleton compact={view === 'Overview'} /></div>
  if (view === 'Mail queue') return <div role="status" aria-label={label} className="mc-dashboard"><MailSkeleton expanded /></div>
  if (view === 'Toolbox') return <div role="status" aria-label={label} className="mc-dashboard">{bottom}</div>
  const icons = [Database, Workflow, HardDrive, Mail]
  return <div role="status" aria-label={label} className="mc-dashboard">
    <section className="mc-execution-desk" aria-label="Job runs started in the last 24 hours"><div className="mc-outcomes"><div><h2>Execution mix</h2><Skeleton className="h-3 w-32" /></div><div className="mc-outcome-strip"><Skeleton className="h-full w-full" /></div><p><Skeleton className="h-3 w-56 max-w-full" /></p></div><div className="mc-open-stats">{METRIC_LABELS.slice(1).map(name => <div key={name}><Skeleton className="h-11 w-14" /><span>{name}</span></div>)}</div></section>
    <div className="mc-top-grid"><section className="mc-map-panel"><div className="mc-section-head"><h2>Service map</h2><span className="mc-dark-note">Select a service to inspect</span></div><div className="mc-map">
      <svg className="mc-connectors" viewBox="0 0 700 210" preserveAspectRatio="none" aria-hidden="true"><path d="M150 54 H285 Q310 54 310 80 V105 H390 V80 Q390 54 415 54 H550 M150 156 H285 Q310 156 310 130 V105 M390 105 V130 Q390 156 415 156 H550" /></svg>
      <div className="mc-core"><span className="mc-core-mark"><span /><span /><span /></span><strong>HRMS</strong><Skeleton className="h-3 w-14 bg-hero-foreground/10" /></div>{SERVICE_LABELS.map((name, i) => {const Icon = icons[i]!;return <div className={`mc-service mc-service-${i}`} key={name}><Icon aria-hidden="true" /><span><strong>{name}</strong><Skeleton className="mt-2 h-3 w-20 bg-hero-foreground/10" /></span></div>})}</div><div className="mc-inspection"><strong>Database</strong><Skeleton className="mt-2 h-3 w-3/4 bg-hero-foreground/10" /></div></section>
      <section className="mc-panel mc-attention"><div className="mc-section-head"><h2>Needs attention</h2><Skeleton className="h-5 w-8" /></div>{['Inspect execution history', 'Review retry records', 'Mail retry activity; not a dedicated heartbeat', 'Backup age and restore drills are unverified'].map((text, i) => <div className={`mc-attention-row ${i === 3 ? 'mc-recovery' : ''}`} key={text}><span><Skeleton className="h-4 w-48 max-w-full" /><span>{text}</span></span></div>)}</section></div>

    <div className="mc-bottom-grid"><section className="mc-panel mc-activity"><div className="mc-section-head"><h2>Execution rhythm</h2><span className="mc-muted">Last 24 hours · IST</span></div><div className="mc-chart"><Skeleton className="h-full w-full" /></div><div className="mc-chart-axis"><Skeleton className="h-3 w-12" /><Skeleton className="h-3 w-12" /></div><div className="mc-hour-reading"><p className="mc-chart-reading">Select an hour to inspect its executions</p><label className="mc-select"><span className="sr-only">Hour to inspect</span><select disabled><option>Choose hour</option></select></label></div><div className="mc-chart-key">Completed · Failed · In progress · Edge hours are partial</div></section><MailSkeleton /></div>
    {bottom}
  </div>
}
