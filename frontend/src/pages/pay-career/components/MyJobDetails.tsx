import { BriefcaseBusiness } from 'lucide-react'
import { InfoCard } from '@/components/ProfileCards'
import { EMPLOYMENT_TYPE, JOINING_TYPE, WORKFORCE } from '@/lib/choices'
import { cn, formatLastDay } from '@/lib/utils'
import type { EmployeeProfile } from '../../employees/components/labels'

// The job details on the "Mine" tab (redesigned 2026-11-21 - the user: "boring"): the label above the value, in three
// small groups side by side - where they work, their role, the people over them - instead of 17 dotted rows. The
// company, plant, designation and department are in the header above too.

type Cell = [label: string, value: React.ReactNode, sub?: string | null]

export function MyJobDetails({ e }: { e: EmployeeProfile }) {
  const hod = e.hod
  const headsOwnPlace = !!hod?.holder && hod.holder.employeeCode === e.employeeCode
  const groups: [string, Cell[]][] = [
    [
      'Where',
      [
        ['Plant', `${e.plant.plantCode} · ${e.plant.name}`],
        ['Department', e.department?.name],
        ['Work location', e.workLocation && `${e.workLocation.name} (${e.workLocation.countryCode})`, e.workLocation?.address],
        ['Region', e.workLocation?.region?.name],
        ['Cost centre', e.costCenter && `${e.costCenter.code} · ${e.costCenter.name}`],
      ],
    ],
    [
      'Role',
      [
        ['Designation', e.designation?.name],
        ['Position', e.position?.name],
        ['Grade', e.grade?.name],
        ['Employment type', EMPLOYMENT_TYPE[e.employmentType]],
        ['Workforce', WORKFORCE[e.workforceCategory]],
        ['Joining type', JOINING_TYPE[e.joiningType]],
      ],
    ],
    [
      'People',
      [
        ['Reports to', e.reportingManager?.name],
        ['Functional manager', e.functionalManager?.name],
        [
          'HOD',
          !hod?.holder ? 'None yet - HR approves' : headsOwnPlace ? `You head ${hod.department} here` : hod.holder.name,
          [hod?.holder?.until && `until ${formatLastDay(hod.holder.until, true)}`, hod?.next && `next: ${hod.next.employeeCode === e.employeeCode ? 'you' : hod.next.name}`]
            .filter(Boolean)
            .join(' · ') || null,
        ],
      ],
    ],
  ]
  return (
    <InfoCard icon={BriefcaseBusiness} title="Job details">
      <div className="grid gap-x-6 gap-y-3 lg:grid-cols-[5fr_6fr_4fr]">
        {groups.map(([title, cells], i) => (
          <section key={title} className={cn('min-w-0', i > 0 && 'lg:border-l lg:border-dashed lg:pl-6')}>
            <h4 className="mb-1 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">{title}</h4>
            <dl className={cn('grid grid-cols-2 gap-x-4 gap-y-1.5', title === 'People' && 'lg:grid-cols-1')}>
              {cells.map(([label, value, sub]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className={cn('text-sm break-words', value ? 'font-medium' : 'text-muted-foreground')}>{value || '—'}</dd>
                  {value && sub && <dd className="truncate text-xs text-muted-foreground" title={sub}>{sub}</dd>}
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </InfoCard>
  )
}
