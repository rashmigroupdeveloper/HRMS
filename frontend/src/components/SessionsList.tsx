import { LogOut, Monitor } from 'lucide-react'
import { useState } from 'react'
import { Pill } from '@/components/Pill'
import { Button } from '@/components/ui/button'
import { formatDateTime } from '@/lib/utils'

// Where someone is signed in - Roles & access (everyone's) and the Change password page (one's own).

export type SessionItem = {
  id: number
  startedAt: Date
  lastSeenAt: Date
  ip: string | null
  browser: string
  current: boolean
  // whose session (everyone's list only)
  employee?: { employeeCode: string | null; name: string } | null
}

// "just now", "5 min ago", "3 h ago", else the date
function ago(date: Date) {
  const minutes = Math.floor((Date.now() - new Date(date).getTime()) / 60_000)
  if (minutes < 2) return 'active now'
  if (minutes < 60) return `${minutes} min ago`
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} h ago`
  return formatDateTime(date)
}

// the app opened on the server's own computer (a developer's machine) has a loopback address
const LOOPBACK = ['::1', '127.0.0.1', '::ffff:127.0.0.1']
const where = (ip: string) => (LOOPBACK.includes(ip) ? 'this computer' : ip)

export function SessionsList({
  sessions,
  onEnd,
  ending,
  limit,
}: {
  sessions: SessionItem[]
  // show only the first few, with "Show all" under them (one's own list; everyone's list shows all)
  limit?: number
  // log this session out (not offered for the current one)
  onEnd?: (session: SessionItem) => void
  ending?: boolean
}) {
  const [all, setAll] = useState(false)
  if (!sessions.length) return <p className="u-hatch rounded-2xl py-8 text-center text-sm text-muted-foreground">Nobody is signed in.</p>
  const shown = limit && !all ? sessions.slice(0, limit) : sessions
  return (
    <>
    <ul className="divide-y divide-border/70">
      {shown.map((session) => (
        <li key={session.id} className="flex items-start gap-3 py-2">
          <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-surface-2">
            <Monitor className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            {/* the button sits on the first line, so the line below it has the row's whole width */}
            <div className="flex items-start gap-2">
              <p className="min-w-0 flex-1 text-sm">
                {session.employee && (
                  <span className="font-medium">
                    {session.employee.name}
                    {session.employee.employeeCode && <span className="font-normal text-muted-foreground"> · {session.employee.employeeCode}</span>}
                    <span className="font-normal text-muted-foreground"> - </span>
                  </span>
                )}
                <span className={session.employee ? '' : 'font-medium'}>{session.browser}</span>
                {session.current && (
                  <Pill tone="positive" className="ml-2 px-2 py-0.5">
                    This device
                  </Pill>
                )}
              </p>
              {onEnd && !session.current && (
                <Button variant="ghost" size="sm" className="-my-1 shrink-0 max-sm:h-9" disabled={ending} onClick={() => onEnd(session)}>
                  <LogOut /> Log out
                </Button>
              )}
            </div>
            {/* each part stays whole - a narrow row breaks between parts, never inside one */}
            <p className="flex flex-wrap gap-x-1 text-xs text-muted-foreground tabular-nums">
              <span className="whitespace-nowrap">{ago(session.lastSeenAt)} ·</span>
              <span className="whitespace-nowrap">
                signed in {formatDateTime(session.startedAt)}
                {session.ip && ' ·'}
              </span>
              {session.ip && <span className="whitespace-nowrap">{where(session.ip)}</span>}
            </p>
          </div>
        </li>
      ))}
    </ul>
    {shown.length < sessions.length && (
      <Button variant="ghost" size="sm" className="mt-1 -ml-2" onClick={() => setAll(true)}>
        Show all {sessions.length}
      </Button>
    )}
    </>
  )
}
