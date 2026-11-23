import { Building2, Cake, Droplet, Mail, MapPin, Network, UserRound } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { useAccess } from '@/hooks/useAccess'
import type { client } from '@/lib/orpc'
import { cn, formatDate, initialsOf } from '@/lib/utils'
import { BLOOD } from './labels'

export type Colleague = Awaited<ReturnType<typeof client.employees.directory>>['items'][number]

// "05 May" - a birthday without the year
const birthdayText = (b: Colleague['birthday']) =>
  b && new Date(Date.UTC(2000, b.month - 1, b.day)).toLocaleDateString('en-IN', { timeZone: 'UTC', day: '2-digit', month: 'short' })

// The basic card of a colleague (the People page, 2026-11-21 - like greytHR's directory): what every employee may see -
// work details, the reporting manager, the joining day, the birthday (day + month) and the blood group. "Open full
// profile" only for those whose Employee · Directory & job access covers them (the backend checks it too); one's own card
// opens /me.
export function ColleagueCard({ c, onPick, onChart }: { c: Colleague; onPick: (employeeCode: string) => void; onChart?: (employeeCode: string) => void }) {
  const { me, covers } = useAccess()
  const self = me?.employeeCode === c.employeeCode
  const opensProfile = self || covers('EMPLOYEES', 'READ', { companyId: c.company.id, plantId: c.plant.id, departmentId: c.department?.id ?? null })
  const rows: { icon: typeof Mail; label: string; value: React.ReactNode }[] = [
    { icon: Building2, label: 'Company', value: `${c.company.name} (${c.company.code})` },
    { icon: MapPin, label: 'Plant', value: `${c.plant.code} · ${c.plant.name}${c.workLocation ? ` · ${c.workLocation}` : ''}` },
    { icon: Network, label: 'Department', value: c.department?.name ?? '—' },
    {
      icon: Mail,
      label: 'Work e-mail',
      value: c.workEmail ? (
        <a href={`mailto:${c.workEmail}`} className="underline-offset-4 hover:underline">
          {c.workEmail}
        </a>
      ) : (
        '—'
      ),
    },
    {
      icon: UserRound,
      label: 'Reports to',
      value: c.reportingManager ? (
        <button type="button" onClick={() => onPick(c.reportingManager!.employeeCode)} className="text-left underline-offset-4 hover:underline">
          {c.reportingManager.name} <span className="text-muted-foreground tabular-nums">{c.reportingManager.employeeCode}</span>
        </button>
      ) : (
        '—'
      ),
    },
  ]
  const facts: [string, string][] = [
    ['Joined', formatDate(c.dateOfJoining)],
    ['Birthday', birthdayText(c.birthday) ?? '—'],
    ['Blood group', c.bloodGroup ? BLOOD[c.bloodGroup] : '—'],
  ]
  return (
    <article className="rounded-2xl bg-card p-4 shadow-card">
      <header className="flex items-center gap-3">
        <span aria-hidden className="grid size-14 shrink-0 place-items-center rounded-2xl bg-gold text-lg font-semibold text-gold-foreground">
          {initialsOf(c.name)}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg leading-tight font-medium">{c.name}</h2>
          <p className="truncate text-sm text-muted-foreground">
            {c.designation ?? 'No designation'} · <span className="tabular-nums">{c.employeeCode}</span>
          </p>
        </div>
      </header>
      <dl className="mt-4 space-y-2 text-sm">
        {rows.map(({ icon: Icon, label, value }) => (
          <div key={label} className="grid grid-cols-[1.25rem_7rem_minmax(0,1fr)] items-baseline gap-x-2">
            <Icon aria-hidden className="size-4 translate-y-0.5 text-muted-foreground" />
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="min-w-0 break-words">{value}</dd>
          </div>
        ))}
      </dl>
      <dl className="mt-3 grid grid-cols-3 gap-2">
        {facts.map(([label, value], i) => (
          <div key={label} className="rounded-xl bg-surface-2/70 px-3 py-2">
            <dt className="flex items-center gap-1 text-xs text-muted-foreground">
              {i === 1 && <Cake aria-hidden className="size-3" />}
              {i === 2 && <Droplet aria-hidden className="size-3" />}
              {label}
            </dt>
            <dd className={cn('text-sm font-medium tabular-nums', value === '—' && 'text-muted-foreground')}>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        {onChart && (
          <Button variant="secondary" size="sm" onClick={() => onChart(c.employeeCode)}>
            <Network /> Org chart{c.directReports ? ` · ${c.directReports} report${c.directReports === 1 ? '' : 's'}` : ''}
          </Button>
        )}
        {opensProfile && (
          <Button variant="secondary" size="sm" nativeButton={false} render={<Link to={self ? '/me' : `/employees/${c.employeeCode}`} />}>
            <UserRound /> {self ? 'My profile' : 'Open full profile'}
          </Button>
        )}
      </div>
    </article>
  )
}
