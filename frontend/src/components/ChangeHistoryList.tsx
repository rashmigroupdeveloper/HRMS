import { ArrowRight, ChevronDown, KeyRound, LogIn, LogOut, Pencil, Plus, ShieldAlert, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { HISTORY_ACTION_LABEL as ACTION_LABEL, type HistoryAction } from '@/lib/choices'
import { type client } from '@/lib/orpc'
import { cn, formatDate, formatDateTime } from '@/lib/utils'

// Entries of the change history (who changed what and when) - the Change history page and an employee's profile.
// Grouped by day (the browser's time zone), one compact row each: who did what, the first changed fields on one line,
// the time on the right. A row opens to show every field and where the change came from (the API's name, the address).

type HistoryEntry = Awaited<ReturnType<typeof client.changeHistory.list>>['items'][number]
const ACTION_ICON: Record<HistoryAction, typeof Plus> = {
  CREATE: Plus,
  UPDATE: Pencil,
  DELETE: Trash2,
  SIGN_IN: LogIn,
  SIGN_IN_FAILED: ShieldAlert,
  SIGN_OUT: LogOut,
}

// A value as stored in the history, in words: dates, yes / no, codes like PERMANENT as "Permanent"
function showValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) return value.length ? value.map(showValue).join(', ') : '—'
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/.test(value)) return formatDate(new Date(value))
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return formatDateTime(new Date(value))
    // a fixed value like PERMANENT or WHITE_COLLAR (not a short code like IN or RML)
    if (/^[A-Z][A-Z_]*[A-Z]$/.test(value) && (value.includes('_') || value.length >= 4)) {
      const words = value.toLowerCase().replace(/_/g, ' ')
      return words.charAt(0).toUpperCase() + words.slice(1)
    }
    return value
  }
  // a group of values (e.g. a job change's "before" snapshot) in words, not raw JSON (the user, 2026-11-21 - P6):
  // "Company: Rashmi Metaliks Limited · Grade: Executive 1 · Reporting manager: Amit Kumar Ghosh (RML090002)"
  if (typeof value === 'object') {
    const parts = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([key, v]) => `${keyLabel(key)}: ${showValue(v)}`)
    return parts.length ? parts.join(' · ') : '—'
  }
  return String(value)
}

// "reportingManagerId" -> "Reporting manager", "workforceCategory" -> "Workforce category"
function keyLabel(key: string) {
  const words = key.replace(/Id$/, '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

// How many changed fields a closed row shows
const SHOWN = 3

// "Today · 16 Nov 2026", "Yesterday · 15 Nov 2026", "14 Nov 2026" - in the browser's time zone, as formatDateTime
function dayLabel(date: Date) {
  const day = (d: Date) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  const text = day(date)
  const now = new Date()
  if (text === day(now)) return `Today · ${text}`
  if (text === day(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))) return `Yesterday · ${text}`
  return text
}

// "4:35 pm" in the browser's time zone (the day is the heading above)
function formatTime(date: Date) {
  return new Date(date).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
}

export function ChangeHistoryList({
  items,
  // the profile shows one employee's history - no need to repeat whose record it is
  hideEmployee = false,
  // links to profiles (people with Employees: View)
  linkEmployees = false,
  // the Change history page hangs each day on a spine; a profile keeps the compact rows
  variant = 'compact',
}: {
  items: HistoryEntry[]
  hideEmployee?: boolean
  linkEmployees?: boolean
  variant?: 'compact' | 'ledger'
}) {
  // the rows opened to show everything
  const [open, setOpen] = useState<ReadonlySet<HistoryEntry['id']>>(new Set())
  const toggle = (id: HistoryEntry['id']) =>
    setOpen((current) => {
      const next = new Set(current)
      if (!next.delete(id)) next.add(id)
      return next
    })

  if (!items.length) return <EmptyState title="No changes recorded." className="py-6" />

  // newest first, so the entries of a day are already together
  const days: { label: string; entries: HistoryEntry[] }[] = []
  for (const entry of items) {
    const label = dayLabel(new Date(entry.at))
    const last = days.at(-1)
    if (last && last.label === label) last.entries.push(entry)
    else days.push({ label, entries: [entry] })
  }

  if (variant === 'ledger') {
    return <Ledger days={days} open={open} toggle={toggle} hideEmployee={hideEmployee} linkEmployees={linkEmployees} />
  }

  return (
    <div>
      {days.map((day) => (
        <section key={day.label}>
          <h3 className="sticky top-16 z-10 border-b border-border/70 bg-card py-1 text-xs font-medium text-muted-foreground lg:top-20">{day.label}</h3>
          <ol className="divide-y divide-border/70">
            {day.entries.map((entry) => {
              const Icon = entry.action === 'UPDATE' && entry.model === 'UserAccount' && entry.changes.some((c) => c.field === 'passwordHash') ? KeyRound : ACTION_ICON[entry.action]
              const employee = entry.employee
              const isOpen = open.has(entry.id)
              const more = entry.changes.length - SHOWN
              // where it came from - only in the opened row (and as the row's tooltip)
              const origin = [entry.source, entry.ip].filter(Boolean).join(' · ')
              const canOpen = more > 0 || origin !== ''
              const changes = isOpen ? entry.changes : entry.changes.slice(0, SHOWN)
              return (
                <li key={entry.id} className="flex gap-2.5 py-1.5" title={entry.source ?? undefined}>
                  <span
                    className={cn(
                      'grid size-6 shrink-0 place-items-center rounded-full',
                      entry.action === 'SIGN_IN_FAILED' || entry.action === 'DELETE' ? 'bg-destructive/10 text-negative-ink' : 'bg-surface-2 text-foreground',
                    )}
                  >
                    <Icon className="size-3.5" />
                  </span>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                          {entry.action === 'SIGN_IN_FAILED' ? (
                            // someone tried to sign in - not necessarily the employee, so said without a "who"
                            <p className="text-sm">
                              <span className="text-muted-foreground">Sign-in failed for </span>
                              <span className="font-medium">{employee ? `${employee.name} (${employee.employeeCode})` : String(entry.details?.login ?? entry.details?.employeeCode ?? 'an unknown code')}</span>
                            </p>
                          ) : (
                            <p className="text-sm">
                              <span className="font-medium">{entry.by?.name ?? 'Unknown'}</span>
                              {entry.by?.employeeCode && <span className="text-muted-foreground"> · {entry.by.employeeCode}</span>}
                              {entry.model === 'UserAccountRole' && (entry.action === 'CREATE' || entry.action === 'DELETE') ? (
                                // a role given to / taken from someone
                                <span className="text-muted-foreground">{entry.action === 'CREATE' ? ' gave a role' : ' took away a role'}</span>
                              ) : (
                                <>
                                  <span className="text-muted-foreground"> {ACTION_LABEL[entry.action].toLowerCase()}</span>
                                  {entry.modelLabel && <span className="font-medium"> {entry.modelLabel.toLowerCase()}</span>}
                                </>
                              )}
                              {/* whose record (a sign-in / out is the person's own - nothing to add) */}
                              {!hideEmployee && entry.model && employee && (
                                <>
                                  <span className="text-muted-foreground">{entry.model === 'UserAccountRole' ? (entry.action === 'DELETE' ? ' from ' : ' to ') : ' of '}</span>
                                  {linkEmployees && employee.employeeCode ? (
                                    <Link to={`/manage/employees/${employee.employeeCode}`} className="font-medium underline-offset-4 hover:underline">
                                      {employee.name} ({employee.employeeCode})
                                    </Link>
                                  ) : (
                                    <span className="font-medium">{employee.name}</span>
                                  )}
                                </>
                              )}
                              {!hideEmployee && !employee && entry.candidateId && (
                                <>
                                  <span className="text-muted-foreground"> of </span>
                                  <Link to={`/manage/onboarding/${entry.candidateId}`} className="font-medium underline-offset-4 hover:underline">
                                    candidate #{entry.candidateId}
                                  </Link>
                                </>
                              )}
                            </p>
                          )}
                      </div>
                      {canOpen ? (
                        <button
                          type="button"
                          aria-expanded={isOpen}
                          aria-label={isOpen ? 'Show less' : 'Show everything about this entry'}
                          className="-my-1 inline-flex shrink-0 items-center gap-1 rounded-full py-1 pl-2 text-xs whitespace-nowrap text-muted-foreground tabular-nums hover:text-foreground max-sm:-my-2 max-sm:min-h-9"
                          onClick={() => toggle(entry.id)}
                        >
                          {formatTime(entry.at)}
                          <ChevronDown aria-hidden className={cn('size-3.5 transition-transform', isOpen && 'rotate-180')} />
                        </button>
                      ) : (
                        <span className="shrink-0 text-xs whitespace-nowrap text-muted-foreground tabular-nums">{formatTime(entry.at)}</span>
                      )}
                    </div>
                    {changes.length > 0 && (
                      // closed: the first fields side by side on one line (two on a narrow screen); open: one per line
                      <ul className={cn('text-xs', isOpen ? 'space-y-0.5' : 'flex flex-wrap gap-x-4 gap-y-0.5')}>
                        {changes.map((change) => (
                          <li key={change.field} className="flex flex-wrap items-baseline gap-x-1.5">
                            <span className="text-muted-foreground">{change.label}:</span>
                            {entry.action !== 'CREATE' && <span className="break-all line-through decoration-foreground/30">{showValue(change.before)}</span>}
                            {entry.action === 'UPDATE' && <ArrowRight className="size-3 shrink-0 self-center text-muted-foreground" />}
                            {entry.action !== 'DELETE' && <span className="font-medium break-all">{showValue(change.after)}</span>}
                          </li>
                        ))}
                        {more > 0 && (
                          <li>
                            <button
                              type="button"
                              className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                              onClick={() => toggle(entry.id)}
                            >
                              {isOpen ? 'Show less' : `+ ${more} more`}
                            </button>
                          </li>
                        )}
                      </ul>
                    )}
                    {entry.details && (
                      <p className="text-xs text-muted-foreground">
                        {[entry.details.reason, (entry.details.login ?? entry.details.employeeCode) && `typed: ${String(entry.details.login ?? entry.details.employeeCode)}`]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    )}
                    {isOpen && origin && <p className="font-mono text-xs break-all text-muted-foreground">{origin}</p>}
                  </div>
                </li>
              )
            })}
          </ol>
        </section>
      ))}
    </div>
  )
}

// The Change history page: one day is a sheet on a dashed spine. Time sits on the spine, the sentence
// to its right. Opening a line unfolds the rest of the fields; the marker fills gold while it is open.
function Ledger({
  days,
  open,
  toggle,
  hideEmployee,
  linkEmployees,
}: {
  days: { label: string; entries: HistoryEntry[] }[]
  open: ReadonlySet<HistoryEntry['id']>
  toggle: (id: HistoryEntry['id']) => void
  hideEmployee: boolean
  linkEmployees: boolean
}) {
  return (
    <div>
      {days.map((day) => (
        <section key={day.label} className="mt-5 first:mt-0">
          <h3 className="sticky top-16 z-10 bg-card/95 py-1.5 text-sm font-medium backdrop-blur-sm lg:top-20">{day.label}</h3>
          <ol className="relative">
            <span aria-hidden className="absolute top-2 bottom-2 left-[calc(5.25rem+0.75rem+0.625rem)] w-px -translate-x-1/2 border-l border-dashed border-foreground/25" />
            {day.entries.map((entry) => {
              const employee = entry.employee
              const isOpen = open.has(entry.id)
              const more = entry.changes.length - SHOWN
              const origin = [entry.source, entry.ip].filter(Boolean).join(' · ')
              const canOpen = more > 0 || origin !== ''
              const preview = entry.changes.slice(0, SHOWN)
              const rest = entry.changes.slice(SHOWN)
              const marked = entry.action === 'SIGN_IN_FAILED' || entry.action === 'DELETE'
              return (
                <li key={entry.id} className="group grid grid-cols-[5.25rem_1.25rem_minmax(0,1fr)] gap-x-3 py-2" title={entry.source ?? undefined}>
                  {canOpen ? (
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-label={isOpen ? 'Show less' : 'Show everything about this entry'}
                      onClick={() => toggle(entry.id)}
                      className="inline-flex items-start justify-end gap-0.5 pt-0.5 text-right text-xs whitespace-nowrap text-muted-foreground tabular-nums hover:text-foreground max-sm:min-h-9"
                    >
                      {formatTime(entry.at)}
                      <ChevronDown aria-hidden className={cn('mt-0.5 size-3.5 shrink-0 transition-transform duration-200', isOpen && 'rotate-180')} />
                    </button>
                  ) : (
                    <time dateTime={new Date(entry.at).toISOString()} className="pt-0.5 text-right text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                      {formatTime(entry.at)}
                    </time>
                  )}
                  <span className="relative z-10 flex justify-center pt-1.5">
                    <span
                      className={cn(
                        'size-2 rounded-full ring-2 ring-card transition-colors duration-200',
                        isOpen ? 'bg-gold' : marked ? 'bg-destructive' : 'bg-foreground',
                      )}
                    />
                  </span>
                  <div className="min-w-0 rounded-2xl px-2 py-0.5 transition-colors duration-150 group-hover:bg-surface-2/80">
                    <EntrySentence entry={entry} employee={employee} hideEmployee={hideEmployee} linkEmployees={linkEmployees} />
                    {preview.length > 0 && <FieldList entry={entry} changes={preview} />}
                    {entry.details && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {[entry.details.reason, (entry.details.login ?? entry.details.employeeCode) && `typed: ${String(entry.details.login ?? entry.details.employeeCode)}`]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    )}
                    {canOpen && (
                      <div className="history-unfold" data-open={isOpen ? 'true' : 'false'}>
                        <div aria-hidden={isOpen ? undefined : true}>
                          {rest.length > 0 && <FieldList entry={entry} changes={rest} stacked />}
                          {origin && <p className="pt-1 text-xs break-all text-muted-foreground">{origin}</p>}
                        </div>
                      </div>
                    )}
                    {more > 0 && !isOpen && (
                      <button type="button" onClick={() => toggle(entry.id)} className="mt-0.5 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline max-sm:min-h-9">
                        {more} more field{more === 1 ? '' : 's'}
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        </section>
      ))}
    </div>
  )
}

function EntrySentence({
  entry,
  employee,
  hideEmployee,
  linkEmployees,
}: {
  entry: HistoryEntry
  employee: HistoryEntry['employee']
  hideEmployee: boolean
  linkEmployees: boolean
}) {
  if (entry.action === 'SIGN_IN_FAILED') {
    return (
      <p className="text-sm">
        <span className="text-muted-foreground">Sign-in failed for </span>
        <span className="font-medium">{employee ? `${employee.name} (${employee.employeeCode})` : String(entry.details?.login ?? entry.details?.employeeCode ?? 'an unknown code')}</span>
      </p>
    )
  }
  return (
    <p className="text-sm">
      <span className="font-medium">{entry.by?.name ?? 'Unknown'}</span>
      {entry.by?.employeeCode && <span className="text-muted-foreground"> · {entry.by.employeeCode}</span>}
      {entry.model === 'UserAccountRole' && (entry.action === 'CREATE' || entry.action === 'DELETE') ? (
        <span className="text-muted-foreground">{entry.action === 'CREATE' ? ' gave a role' : ' took away a role'}</span>
      ) : (
        <>
          <span className="text-muted-foreground"> {ACTION_LABEL[entry.action].toLowerCase()}</span>
          {entry.modelLabel && <span className="font-medium"> {entry.modelLabel.toLowerCase()}</span>}
        </>
      )}
      {!hideEmployee && entry.model && employee && (
        <>
          <span className="text-muted-foreground">{entry.model === 'UserAccountRole' ? (entry.action === 'DELETE' ? ' from ' : ' to ') : ' of '}</span>
          {linkEmployees && employee.employeeCode ? (
            <Link to={`/manage/employees/${employee.employeeCode}`} className="font-medium underline-offset-4 hover:underline">
              {employee.name} ({employee.employeeCode})
            </Link>
          ) : (
            <span className="font-medium">{employee.name}</span>
          )}
        </>
      )}
      {!hideEmployee && !employee && entry.candidateId && (
        <>
          <span className="text-muted-foreground"> of </span>
          <Link to={`/manage/onboarding/${entry.candidateId}`} className="font-medium underline-offset-4 hover:underline">
            candidate #{entry.candidateId}
          </Link>
        </>
      )}
    </p>
  )
}

function FieldList({ entry, changes, stacked = false }: { entry: HistoryEntry; changes: HistoryEntry['changes']; stacked?: boolean }) {
  return (
    <ul className={cn('mt-0.5 text-xs', stacked ? 'space-y-0.5' : 'flex flex-wrap gap-x-4 gap-y-0.5')}>
      {changes.map((change) => (
        <li key={change.field} className="flex flex-wrap items-baseline gap-x-1.5">
          <span className="text-muted-foreground">{change.label}:</span>
          {entry.action !== 'CREATE' && <span className="break-all line-through decoration-foreground/30">{showValue(change.before)}</span>}
          {entry.action === 'UPDATE' && <ArrowRight className="size-3 shrink-0 self-center text-muted-foreground" />}
          {entry.action !== 'DELETE' && <span className="font-medium break-all">{showValue(change.after)}</span>}
        </li>
      ))}
    </ul>
  )
}
