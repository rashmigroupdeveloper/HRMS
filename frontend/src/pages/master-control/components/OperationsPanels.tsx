import { ArrowUpRight, Check, Copy, Download } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import type { client } from '@/lib/orpc'
import { useAccess } from '@/hooks/useAccess'
import { formatBytes, stamp, uptime } from './format'

type Overview = Awaited<ReturnType<typeof client.masterControl.overview>>
export function MailPanel({ data, expanded = false }: { data: Overview; expanded?: boolean }) {
  return <section className="mc-panel" aria-labelledby="mail-title"><div className="mc-section-head"><h2 id="mail-title">Mail queue</h2><span className="mc-muted">{data.runtime.mailMode === 'LOCAL_OUTBOX' ? 'Outbox mode' : 'SMTP configured'}</span></div>
    <div className="mc-mail-numbers"><div><span>Waiting to retry</span><strong>{data.mail.pending}</strong></div><div><span>Gave up</span><strong className={data.mail.failed ? 'mc-negative' : ''}>{data.mail.failed}</strong></div></div>
    <p className="mc-caption">{data.mail.oldestPendingAt ? `Oldest waiting: ${stamp(data.mail.oldestPendingAt)}.` : 'No messages are waiting for another attempt.'} SMTP acceptance does not confirm inbox delivery.</p>
    {expanded && <><div className="mc-mail-list">{data.mail.items.map(item => <div key={item.id}><span><strong>Message #{item.id}</strong><span>{stamp(item.createdAt)}</span></span><span>{item.status === 'FAILED' ? 'Gave up' : `${item.attempts} of 5 attempts`}<span>{item.status === 'PENDING' ? `Next: ${stamp(item.nextAttemptAt)}` : 'Payload removed'}</span></span></div>)}</div><p className="mc-caption">Oldest 12 retry records. Recipients, subjects and message bodies are private. Sent messages are removed from this queue; failed records are retained for 30 days. Regenerate expired codes in the original workflow.</p></>}
  </section>
}
export function RuntimePanel({ data }: { data: Overview }) {
  return <section className="mc-panel" aria-labelledby="runtime-title"><div className="mc-section-head"><h2 id="runtime-title">Under the hood</h2><span className="mc-muted">API process</span></div><dl className="mc-facts">
    <div><dt>Environment</dt><dd>{data.runtime.environment}</dd></div><div><dt>Release</dt><dd>{data.runtime.release ?? 'Not supplied'}</dd></div><div><dt>Node.js</dt><dd>{data.runtime.node}</dd></div><div><dt>Process uptime</dt><dd>{uptime(data.runtime.uptimeSeconds)}</dd></div><div><dt>Process memory</dt><dd>{formatBytes(data.runtime.memoryBytes)}</dd></div><div><dt>JavaScript heap</dt><dd>{formatBytes(data.runtime.heapUsedBytes)} / {formatBytes(data.runtime.heapTotalBytes)}</dd></div><div><dt>Storage free</dt><dd>{data.storage.freeBytes === null ? 'Unknown' : formatBytes(data.storage.freeBytes)}</dd></div><div><dt>Migration records</dt><dd>{data.migrations ? `${data.migrations.applied} applied · ${data.migrations.unresolved} unresolved` : 'Unavailable'}</dd></div>
  </dl><p className="mc-caption">Uptime and memory describe this API process. Applied records do not prove all release migrations are present.</p></section>
}
export function Toolbox({ data }: { data?: Overview }) {
  const { can } = useAccess()
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)
  const report = () => data ? JSON.stringify({ product: 'HRMS Master Control', checkedAt: data.checkedAt,
    databaseMs: data.databaseMs, runtime: data.runtime, storage: data.storage, migrations: data.migrations,
    jobs: { total: data.jobs.total, completed: data.jobs.ok, failed: data.jobs.failed, running: data.jobs.running },
    worker: data.worker, mail: { pending: data.mail.pending, failed: data.mail.failed }, recovery: 'Not connected' }, null, 2) : ''
  const download = () => { if (!data) return; const url = URL.createObjectURL(new Blob([report()], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = `hrms-diagnostics-${new Date(data.checkedAt).toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(url) }
  const tools = [
    { to: '/manage/access', name: 'Roles & sessions', detail: 'Permissions, login recovery and signed-in devices', area: 'ACCESS' as const },
    { to: '/manage/change-history', name: 'Change history', detail: 'Inspect changes, export records and verify integrity', area: 'CHANGE_HISTORY' as const },
    { to: '/manage/approval-chains', name: 'Approval rules', detail: 'Routing, escalation and held requests', area: 'APPROVAL_CHAINS' as const },
    { to: '/manage/attendance-setup', name: 'Attendance setup', detail: 'Punch uploads, unmatched codes and month locks', area: 'ATTENDANCE_SETUP' as const },
  ]
  return <section className="mc-panel" aria-labelledby="toolbox-title"><div className="mc-section-head"><h2 id="toolbox-title">Toolbox</h2><span className="mc-muted">Your next move</span></div><div className="mc-tools">{tools.filter(tool => can(tool.area)).map(tool => <Link key={tool.to} to={tool.to}><span><strong>{tool.name}</strong><span>{tool.detail}</span></span><ArrowUpRight aria-hidden="true" /></Link>)}</div>
    {!tools.some(tool => can(tool.area)) && <p className="mc-caption">Switch to an authorized role to open business administration tools. Master Control does not grant HR permissions.</p>}
    <div className="mc-diagnostic-actions"><button type="button" disabled={!data} onClick={download}><Download aria-hidden="true" />Download diagnostics</button><button type="button" disabled={!data} onClick={async () => {try {await navigator.clipboard.writeText(report());setCopied(true);setCopyError(false)}catch{setCopyError(true)}}}>{copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}{copied ? 'Copied' : 'Copy report'}</button></div>{copyError && <p role="alert" className="mc-caption">Clipboard unavailable. Use Download diagnostics.</p>}
    <p className="mc-caption">The report includes operational counts and configuration status. It excludes employee records, mail contents, secrets and server paths.</p>
  </section>
}
