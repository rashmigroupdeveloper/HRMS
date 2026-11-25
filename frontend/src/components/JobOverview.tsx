import { useQuery } from '@tanstack/react-query'
import { AtSign, BriefcaseBusiness, CalendarClock, Mail, Phone, Smartphone, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { type client, orpc } from '@/lib/orpc'
import { cn, formatDate, formatLastDay, formatMoment, relativeDay } from '@/lib/utils'
import { EMPLOYMENT_TYPE, JOINING_TYPE, WORKFORCE } from '@/lib/choices'
import { InfoCard, Lines } from './ProfileCards'
import { HolidayListValueSkeleton } from './skeletons/employees/EmployeeProfileSkeleton'

// The profile's Job tab (redesigned 2026-11-17, compact): the position as label-value rows in two columns, the contact
// lines beside it, and the dates as a timeline (joined -> probation ends -> confirmed -> contract ends / left) whose
// gold line fills up to today, with the notice period.

type Employee = Awaited<ReturnType<typeof client.employees.getByCode>>

export function JobOverview({ employee: e, self }: { employee: Employee; self: boolean }) {
  const manager = e.reportingManager
  const functional = e.functionalManager
  // the HOD of their plant + department (BACKLOG 3e) - none when nobody heads it (HR approves)
  const hod = e.hod
  const headsOwnPlace = !!hod?.holder && hod.holder.employeeCode === e.employeeCode
  // the holiday list they follow (the user, 2026-11-25 - its name only; HR changes it on Attendance setup > Schedules)
  const holidayList = useQuery(orpc.attendance.holidayLists.ofEmployee.queryOptions({ input: { employeeCode: e.employeeCode } }))
  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <InfoCard icon={BriefcaseBusiness} title="Job & placement" className="lg:col-span-3">
        <Lines
          columns={2}
          rows={[
            ['Employee code', <span key="code" className="tabular-nums">{e.employeeCode}</span>],
            ['Company', `${e.company.name} (${e.company.code})`],
            ['Plant', `${e.plant.plantCode} · ${e.plant.name}`],
            ['Work location', e.workLocation && `${e.workLocation.name} (${e.workLocation.countryCode})`],
            ['Region', e.workLocation?.region?.name],
            ['Location address', e.workLocation?.address && [e.workLocation.address, e.workLocation.postalCode].filter(Boolean).join(' - ')],
            ['Department', e.department?.name],
            ['Designation', e.designation?.name],
            ['Grade', e.grade?.name],
            ['Position', e.position?.name],
            ['Cost centre', e.costCenter && `${e.costCenter.code} · ${e.costCenter.name}`],
            [
              'Holiday list',
              holidayList.isPending ? (
                <HolidayListValueSkeleton key="holidays" />
              ) : (
                (holidayList.data?.holidayList?.name ?? (holidayList.data ? <span key="holidays" className="font-normal text-muted-foreground">None - no holidays</span> : null))
              ),
            ],
            [
              'Reports to',
              manager &&
                (self ? (
                  manager.name
                ) : (
                  <Link key="manager" to={`/employees/${manager.employeeCode}`} className="underline-offset-4 hover:underline">
                    {manager.name} <span className="font-normal text-muted-foreground">{manager.employeeCode}</span>
                  </Link>
                )),
            ],
            [
              'Functional manager',
              functional &&
                (self ? (
                  functional.name
                ) : (
                  <Link key="functional" to={`/employees/${functional.employeeCode}`} className="underline-offset-4 hover:underline">
                    {functional.name} <span className="font-normal text-muted-foreground">{functional.employeeCode}</span>
                  </Link>
                )),
            ],
            [
              'HOD',
              // who heads it now (until a planned end) and who is appointed next
              <span key="hod">
                {!hod?.holder ? (
                  'None yet - HR approves'
                ) : headsOwnPlace ? (
                  `${self ? 'You head' : 'Heads'} ${hod.department} here`
                ) : (
                  <>
                    {hod.holder.name} <span className="font-normal text-muted-foreground">{hod.holder.employeeCode}</span>
                  </>
                )}
                {hod?.holder?.until && <span className="font-normal text-muted-foreground"> · until {formatLastDay(hod.holder.until, true)}</span>}
                {hod?.next && (
                  <span className="block text-xs font-normal text-muted-foreground">
                    Next: {hod.next.employeeCode === e.employeeCode ? (self ? 'you' : 'themselves') : hod.next.name} from{' '}
                    {formatMoment(hod.next.from, true)}
                  </span>
                )}
              </span>,
            ],
            ['Joining type', JOINING_TYPE[e.joiningType]],
            ['Employment type', EMPLOYMENT_TYPE[e.employmentType]],
            ['Workforce', WORKFORCE[e.workforceCategory]],
          ]}
        />
      </InfoCard>

      <InfoCard icon={Mail} title="Contact" className="lg:col-span-2">
          <ul className="space-y-1">
            <ContactLine icon={Mail} label="Work e-mail" value={e.workEmail} />
            <ContactLine icon={AtSign} label="Personal e-mail" value={e.personalEmail} />
            <ContactLine icon={Phone} label="Mobile" value={e.mobile} />
            <ContactLine icon={Smartphone} label="Alternate mobile" value={e.alternateMobile} />
          </ul>
        </InfoCard>

      <InfoCard
        icon={CalendarClock}
        title="Dates and terms"
        className="lg:col-span-5"
        aside={
          <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-muted-foreground">
            Notice period: <span className="font-medium text-foreground">{notice(e.noticeMonthsProbation, e.noticeMonthsConfirmed)}</span>
          </span>
        }
      >
        <Timeline steps={milestones(e)} />
      </InfoCard>
    </div>
  )
}

function ContactLine({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string | null }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl px-1 py-1.5">
      <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-muted-foreground">
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn('truncate text-sm', value ? 'font-medium' : 'text-muted-foreground')}>{value ?? 'Not given'}</p>
      </div>
    </li>
  )
}

type Step = { label: string; date: Date | null; pending?: string }
type Dates = Pick<Employee, 'dateOfJoining' | 'probationEndDate' | 'confirmationDate' | 'contractEndDate' | 'dateOfLeaving'>

// The milestones as a timeline - for the Pay & career page's charcoal header (`dark`)
export function EmploymentTimeline({ employee, dark }: { employee: Dates; dark?: boolean }) {
  return <Timeline steps={milestones(employee)} dark={dark} />
}

// The notice period in words ("1 month in probation · 3 months after")
export function NoticePeriod({ probation, confirmed }: { probation: number | null; confirmed: number | null }) {
  return <>{notice(probation, confirmed)}</>
}

// The milestones of an employment: joined -> probation ends -> confirmed -> contract ends / left (also the Pay & career
// page's header, 2026-11-21)
function milestones(e: Dates): Step[] {
  return [
    { label: 'Joined', date: e.dateOfJoining },
    ...(e.probationEndDate ? [{ label: 'Probation ends', date: e.probationEndDate }] : []),
    // "not yet" only means something when there is a probation to finish
    ...(e.confirmationDate || e.probationEndDate ? [{ label: 'Confirmed', date: e.confirmationDate, pending: 'Not yet' }] : []),
    ...(e.contractEndDate ? [{ label: 'Contract ends', date: e.contractEndDate }] : []),
    ...(e.dateOfLeaving ? [{ label: 'Left', date: e.dateOfLeaving }] : []),
  ]
}

// The milestones left to right (top to bottom on a phone): a filled dot once the day has come, the line between two
// dates filled as far as today. `dark`: on a charcoal header (the Pay & career page, 2026-11-21)
function Timeline({ steps, dark = false }: { steps: Step[]; dark?: boolean }) {
  // today, read once when the tab opens
  const [now] = useState(() => Date.now())
  const time = (d: Date | null) => (d ? new Date(d).getTime() : null)
  return (
    <ol className="grid gap-x-3 gap-y-4 pt-1 sm:auto-cols-fr sm:grid-flow-col">
      {steps.map((step, i) => {
        const at = time(step.date)
        const reached = at !== null && at <= now
        const next = steps[i + 1]
        const nextAt = next ? time(next.date) : null
        // how much of the line to the next step is behind us
        const fill = at === null || !next ? 0 : nextAt === null ? (reached ? 0.5 : 0) : Math.min(1, Math.max(0, (now - at) / Math.max(1, nextAt - at)))
        return (
          <li key={step.label} className="flex gap-3 sm:block">
            <div className="flex flex-col items-center sm:flex-row">
              <span
                aria-hidden
                className={cn(
                  'size-3 shrink-0 rounded-full border-2',
                  reached ? 'border-gold bg-gold' : dark ? 'border-hero-foreground/30 bg-hero' : 'border-border bg-card',
                  at === null && 'border-dashed',
                )}
              />
              {next && (
                <span aria-hidden className={cn('relative my-1 w-0.5 flex-1 overflow-hidden rounded-full sm:mx-1.5 sm:my-0 sm:h-0.5 sm:w-auto', dark ? 'bg-hero-foreground/15' : 'bg-border')}>
                  <Fill fraction={fill} />
                </span>
              )}
            </div>
            <div className="min-w-0 pb-1 sm:pt-2">
              <p className={cn('text-xs', dark ? 'text-hero-foreground/60' : 'text-muted-foreground')}>{step.label}</p>
              <p className={cn('text-sm', at === null ? (dark ? 'text-hero-foreground/60' : 'text-muted-foreground') : 'font-medium')}>
                {step.date ? formatDate(step.date) : (step.pending ?? '—')}
              </p>
              {at !== null && <p className={cn('text-xs', dark ? 'text-hero-foreground/60' : 'text-muted-foreground')}>{relativeDay(at, now)}</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

// The filled part of a timeline line: down on a phone (height), across from sm (width)
function Fill({ fraction }: { fraction: number }) {
  const percent = `${Math.round(fraction * 100)}%`
  return (
    <>
      <span className="absolute inset-x-0 top-0 bg-gold sm:hidden" style={{ height: percent }} />
      <span className="absolute inset-y-0 left-0 hidden bg-gold sm:block" style={{ width: percent }} />
    </>
  )
}

// "1 month during probation, 1 month after confirmation"
function notice(probation: number | null, confirmed: number | null) {
  const months = (n: number) => `${n} ${n === 1 ? 'month' : 'months'}`
  if (probation === null && confirmed === null) return 'not set'
  if (probation === confirmed && probation !== null) return months(probation)
  return [probation !== null && `${months(probation)} in probation`, confirmed !== null && `${months(confirmed)} after`].filter(Boolean).join(' · ')
}
