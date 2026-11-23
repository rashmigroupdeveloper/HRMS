import { DrawerCancel, FormDrawer } from '@/components/FormDrawer'
import { Button } from '@/components/ui/button'
import type { client } from '@/lib/orpc'
import { formatDate, formatLastDay, formatMoment } from '@/lib/utils'
import { type HodPerson, type When, whenAt } from './HodDialogs'

// The gap list (BACKLOG 3e) - what still needs HR, inside the user's data access: places with employees but no HOD now
// (their approvals go to HR; who is appointed next, if anyone), places whose HOD stops at a planned moment with nobody
// after them, and leavers who still head places - or will - after they leave (2026-11-19). Moments in India time. (Every employee has a department - 2026-11-19.)

type Gaps = Awaited<ReturnType<typeof client.employees.hods.gaps>>

const people = (n: number) => `${n} employee${n === 1 ? '' : 's'}`
const H3 = 'text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase'

export function HodGapsDrawer({
  gaps,
  canEdit,
  onClose,
  onAppoint,
  onEnd,
}: {
  gaps: Gaps
  canEdit: boolean
  onClose: () => void
  // an HOD for these places - from `from` (else now)
  onAppoint: (postIds: number[], from?: When) => void
  // end a leaver's appointments
  onEnd: (person: HodPerson) => void
}) {
  const appointable = gaps.vacant.filter((p) => p.canChange && !p.next)
  return (
    <FormDrawer onClose={onClose} width={640} title="Gap list" description="What still needs HR, inside your data access." footer={<DrawerCancel>Close</DrawerCancel>}>
      <section className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <h3 className={H3}>
            Places without an HOD <span className="tabular-nums">· {gaps.vacant.length}</span>
          </h3>
          {canEdit && appointable.length > 1 && (
            <Button variant="secondary" size="sm" className="h-7 rounded-full text-xs" onClick={() => onAppoint(appointable.map((p) => p.id))}>
              One HOD for all {appointable.length}
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Their employees&apos; approvals go to HR until someone heads the place.</p>
        {gaps.vacant.length === 0 ? (
          <p className="text-sm text-muted-foreground">None.</p>
        ) : (
          <ul className="divide-y rounded-2xl bg-surface-2/50">
            {gaps.vacant.map((place) => (
              <li key={place.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 text-sm">
                <span>
                  {place.label} <span className="text-xs text-muted-foreground">· {people(place.employees)}</span>
                  {place.next && (
                    <span className="block text-xs text-info-ink">
                      {place.next.name} from {formatMoment(place.next.from)}
                    </span>
                  )}
                </span>
                {place.canChange && !place.next && (
                  <Button variant="ghost" size="sm" onClick={() => onAppoint([place.id])}>
                    Appoint
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-1.5">
        <h3 className={H3}>
          No HOD after the last day <span className="tabular-nums">· {gaps.ending.length}</span>
        </h3>
        <p className="text-xs text-muted-foreground">The HOD stops at a planned moment and nobody is appointed from then.</p>
        {gaps.ending.length === 0 ? (
          <p className="text-sm text-muted-foreground">None.</p>
        ) : (
          <ul className="divide-y rounded-2xl bg-surface-2/50">
            {gaps.ending.map((place) => (
              <li key={place.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 text-sm">
                <span>
                  {place.label} <span className="text-xs text-muted-foreground">· {people(place.employees)}</span>
                  <span className="block text-xs text-warning-ink">
                    {place.hod.name} until {formatLastDay(place.endsAt)}
                  </span>
                </span>
                {/* the successor starts the moment the HOD stops - never cuts their time short */}
                {place.canChange && (
                  <Button variant="ghost" size="sm" onClick={() => onAppoint([place.id], whenAt(place.endsAt))}>
                    Appoint next
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-1.5">
        <h3 className={H3}>
          Leavers heading places <span className="tabular-nums">· {gaps.leavers.length}</span>
        </h3>
        <p className="text-xs text-muted-foreground">They have left, or their appointment runs past their leaving day - end it with their last day.</p>
        {gaps.leavers.length === 0 ? (
          <p className="text-sm text-muted-foreground">None.</p>
        ) : (
          <ul className="divide-y rounded-2xl bg-surface-2/50">
            {gaps.leavers.map((person) => (
              <li key={person.employeeCode} className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 text-sm">
                <span>
                  {person.name} <span className="text-xs text-muted-foreground tabular-nums">{person.employeeCode}</span>
                  <span className="text-xs text-negative-ink"> · {person.hasLeft ? 'has left' : `leaves ${formatDate(person.dateOfLeaving)}`}</span>
                  <span className="block text-xs text-muted-foreground">
                    {person.posts.map((p) => (p.status === 'UPCOMING' ? `${p.label} (from ${formatMoment(p.startsAt, true)})` : p.label)).join(' · ')}
                  </span>
                </span>
                {canEdit && (
                  <Button variant="ghost" size="sm" onClick={() => onEnd({ employeeCode: person.employeeCode, name: person.name, dateOfLeaving: person.dateOfLeaving, places: person.posts })}>
                    End appointments
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </FormDrawer>
  )
}
