import { useQuery } from '@tanstack/react-query'
import { ArrowRight, History } from 'lucide-react'
import { useState } from 'react'
import { JobChangeStatusPill } from '@/components/JobChangeDetails'
import { JobChangeDrawer } from '@/components/JobChangeDrawer'
import { Pill } from '@/components/Pill'
import { PairsSkeleton } from '@/components/skeletons/common/PairsSkeleton'
import { TimelineSkeleton } from '@/components/skeletons/common/TimelineSkeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { type client, orpc } from '@/lib/orpc'
import { cn, errorMessage, formatDate, fromDateInput } from '@/lib/utils'
import { EMPLOYMENT_TYPE, JOB_CHANGE_KIND, WORKFORCE } from '@/lib/choices'
import { InfoCard } from './ProfileCards'

// The job timeline on the profile's Job tab (the user, 2026-11-19/20): every change of the employee's job details from
// the day it applies, latest first - what changed (old -> new, with a company transfer's company and code), "Show all"
// for the whole picture of that day, and the details in force on any day ("As of"). On top, for HR (Employees: View),
// the changes not in force yet: waiting for approval (and for whom), or approved for a later day. Asking for a change is on
// the Pay & career page (Raise a change) (the user, 2026-11-21 - the profile only shows the record).

type EmployeeProfile = Awaited<ReturnType<typeof client.employees.getByCode>>
type Entry = Awaited<ReturnType<typeof client.employees.jobHistory.list>>[number]
type Field = keyof Entry['details']

const FIELD_LABEL: Record<Field, string> = {
  plantId: 'Plant',
  departmentId: 'Department',
  workLocationId: 'Work location',
  designationId: 'Designation',
  gradeId: 'Grade',
  positionId: 'Position',
  costCenterId: 'Cost centre',
  reportingManagerId: 'Reporting manager',
  functionalManagerId: 'Functional manager',
  employmentType: 'Employment type',
  workforceCategory: 'Workforce',
}
const FIELDS = Object.keys(FIELD_LABEL) as Field[]
// the "as of" query's day while none is picked (it does not run then)
const NO_DAY = new Date(0)

// a detail as shown (the two kinds are codes - shown with their words)
function shown(field: Field, value: string | null) {
  if (value === null) return '—'
  if (field === 'employmentType') return EMPLOYMENT_TYPE[value as keyof typeof EMPLOYMENT_TYPE] ?? value
  if (field === 'workforceCategory') return WORKFORCE[value as keyof typeof WORKFORCE] ?? value
  return value
}

function Change({ label, from, to }: { label: string; from: string; to: string }) {
  return (
    <li className="flex flex-wrap items-center gap-1.5 text-xs">
      <span className="text-muted-foreground">{label}:</span>
      <span className="text-muted-foreground line-through decoration-border">{from}</span>
      <ArrowRight className="size-3 text-muted-foreground" />
      <span className="font-medium">{to}</span>
    </li>
  )
}

export function JobTimeline({ employee, canSeeChanges }: { employee: EmployeeProfile; canSeeChanges: boolean }) {
  const history = useQuery(orpc.employees.jobHistory.list.queryOptions({ input: { employeeCode: employee.employeeCode } }))
  // the changes not in force yet - HR's view (Employees: View)
  const waiting = useQuery({
    ...orpc.jobChanges.list.queryOptions({ input: { employeeCode: employee.employeeCode, statuses: ['PENDING', 'APPROVED'], page: 1, pageSize: 10 } }),
    enabled: canSeeChanges,
  })
  const [asOf, setAsOf] = useState('')
  const day = fromDateInput(asOf)
  const inForce = useQuery({ ...orpc.employees.jobHistory.asOf.queryOptions({ input: { employeeCode: employee.employeeCode, date: day ?? NO_DAY } }), enabled: !!day })
  const [openChange, setOpenChange] = useState<number | null>(null)
  const [open, setOpen] = useState<number | null>(null)
  const entries = history.data ?? []
  const pending = waiting.data?.items ?? []

  return (
    <InfoCard
      icon={History}
      title="Job timeline"
      aside={
        <span className="flex flex-wrap items-center gap-2">
          <label htmlFor="timeline-as-of" className="text-xs text-muted-foreground">
            As of
          </label>
          <Input id="timeline-as-of" type="date" className="h-8 w-36 rounded-full text-xs" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
        </span>
      }
    >
      {history.error && <p className="text-sm text-negative-ink">{errorMessage(history.error)}</p>}
      {day && (
        <div className="mb-3 rounded-2xl bg-surface-2/60 p-3 text-xs">
          {inForce.isPending ? (
            // the day's line, then the details with their real labels - only the values are bars
            <PairsSkeleton title labels={FIELDS.map((field) => FIELD_LABEL[field])} label="Loading the details on that day" />
          ) : !inForce.data ? (
            <span className="text-muted-foreground">Not employed yet on {formatDate(day)}.</span>
          ) : (
            <>
              <p className="mb-1.5 font-medium">
                On {formatDate(day)} - {inForce.data.company.name}, {inForce.data.employeeCode} (since {formatDate(inForce.data.entryFrom)}, {JOB_CHANGE_KIND[inForce.data.kind].toLowerCase()})
              </p>
              <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
                {FIELDS.map((field) => (
                  <div key={field} className="flex min-w-0 gap-2">
                    <dt className="shrink-0 text-muted-foreground">{FIELD_LABEL[field]}</dt>
                    <dd className="min-w-0 truncate font-medium">{shown(field, inForce.data!.details[field])}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </div>
      )}
      {pending.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => setOpenChange(c.id)}
          className="mb-2 flex w-full flex-wrap items-center gap-2 rounded-2xl border border-dashed px-3 py-2 text-left text-sm hover:bg-surface-2/60"
        >
          <span className="font-medium">{c.kindLabel}</span>
          <span className="text-muted-foreground">from {formatDate(c.effectiveFrom)}</span>
          <JobChangeStatusPill status={c.status} label={c.status === 'APPROVED' ? (c.applyError ? 'Approved - not applied' : 'Approved - waits for its day') : 'Waiting for approval'} />
          {c.status === 'PENDING' && c.approval?.step && (
            <span className="text-xs text-muted-foreground">
              step {c.approval.step.stepNo} of {c.approval.step.of}: {c.approval.step.approver?.name ?? c.approval.step.who}
            </span>
          )}
          {c.status === 'PENDING' && c.approval?.held && <Pill tone="warning">Held</Pill>}
          {c.status === 'PENDING' && c.approval?.step?.late && <Pill tone="negative">Late</Pill>}
          <span className="w-full truncate text-xs text-muted-foreground">{[...c.changed, ...(c.hasSalary ? ['Salary'] : [])].join(', ')}</span>
        </button>
      ))}
      {history.isPending ? (
        <TimelineSkeleton rows={3} link="Show all details" label="Loading the job timeline" />
      ) : !entries.length ? (
        <p className="text-sm text-muted-foreground">No entries yet.</p>
      ) : (
        <ol className="relative">
          {entries.map((entry, index) => {
            const before = entries[index + 1]
            const isOpen = open === entry.id
            const companyChanged = before && before.company.code !== entry.company.code
            const codeChanged = before && before.employeeCode !== entry.employeeCode
            return (
              <li key={entry.id} className="grid grid-cols-[5.5rem_1rem_1fr] gap-x-3 pb-3 last:pb-0">
                <span className="pt-0.5 text-right text-xs text-muted-foreground tabular-nums">{formatDate(entry.effectiveFrom)}</span>
                <span className="relative flex justify-center">
                  <span className={cn('z-10 mt-1 size-2.5 rounded-full border-2', index === 0 ? 'border-gold bg-gold' : 'border-border bg-card')} />
                  {index < entries.length - 1 && <span className="absolute top-3 bottom-[-0.75rem] w-px bg-border" />}
                </span>
                <div className="min-w-0 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{JOB_CHANGE_KIND[entry.kind]}</span>
                    {entry.enteredBy && <span className="text-xs text-muted-foreground">by {entry.enteredBy.name}</span>}
                    {entry.jobChangeRequestId && canSeeChanges && (
                      <Button size="xs" variant="ghost" onClick={() => setOpenChange(entry.jobChangeRequestId)}>
                        Approval
                      </Button>
                    )}
                  </div>
                  {entry.note && <p className="text-xs text-muted-foreground">{entry.note}</p>}
                  {before && (entry.changed.length > 0 || companyChanged || codeChanged) && (
                    <ul className="mt-1 space-y-0.5">
                      {companyChanged && <Change label="Company" from={before.company.name} to={entry.company.name} />}
                      {codeChanged && <Change label="Employee code" from={before.employeeCode} to={entry.employeeCode} />}
                      {entry.changed.map((field) => (
                        <Change key={field} label={FIELD_LABEL[field]} from={shown(field, before.details[field])} to={shown(field, entry.details[field])} />
                      ))}
                    </ul>
                  )}
                  <button type="button" className="mt-1 text-xs text-info-ink underline-offset-4 hover:underline" onClick={() => setOpen(isOpen ? null : entry.id)}>
                    {isOpen ? 'Hide details' : 'Show all details'}
                  </button>
                  {isOpen && (
                    <dl className="mt-1.5 grid gap-x-4 gap-y-1 rounded-2xl bg-surface-2/60 p-3 text-xs sm:grid-cols-2">
                      <div className="flex min-w-0 gap-2">
                        <dt className="shrink-0 text-muted-foreground">Company</dt>
                        <dd className="min-w-0 truncate font-medium">
                          {entry.company.name} · {entry.employeeCode}
                        </dd>
                      </div>
                      {FIELDS.map((field) => (
                        <div key={field} className="flex min-w-0 gap-2">
                          <dt className="shrink-0 text-muted-foreground">{FIELD_LABEL[field]}</dt>
                          <dd className="min-w-0 truncate font-medium">{shown(field, entry.details[field])}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      )}
      {openChange !== null && <JobChangeDrawer id={openChange} onClose={() => setOpenChange(null)} />}
    </InfoCard>
  )
}
