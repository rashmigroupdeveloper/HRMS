import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BriefcaseBusiness, Wallet } from 'lucide-react'
import { useState } from 'react'
import { EmployeePicker } from '@/components/EmployeePicker'
import { DrawerCancel, FormDrawer } from '@/components/FormDrawer'
import { FormError } from '@/components/FormError'
import { FieldsGrid } from '@/components/FormFields'
import { JobChangeKindIcon } from '@/components/JobChangeDetails'
import { SalaryBreakupFields } from '@/components/SalaryBreakupFields'
import { SalaryStructurePicker, SalaryStructureStatus } from '@/components/SalaryStructurePicker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAccess } from '@/hooks/useAccess'
import { useStructureBreakup } from '@/hooks/useStructureBreakup'
import { type BreakupValues, breakupLines, changedValues, type FieldDef, type FormValues, type Option, toFormValues, toOptions } from '@/lib/form-values'
import { type client, orpc } from '@/lib/orpc'
import { cn, formatDate, formatMoney, fromDateInput, toDateInput } from '@/lib/utils'
import { EMPLOYMENT_TYPE, type EmployeeProfile, fullName, JOB_CHANGE_KIND, WORKFORCE } from '../../employees/components/labels'

// "Request a change" (the user, 2026-11-20; on Pay & career - Raise a change - since 2026-11-21): a change of the employee's job details and / or salary from a day on - a
// promotion, transfer, company transfer, salary revision... with its reason. It goes through the approval chain(s) and
// applies on its day once approved (a later day: on that day). Only the details changed here are sent. A typing mistake
// is fixed with "Edit details" instead. The job part needs "Request job changes": Edit covering the employee (a move: also
// where they go); the salary part "Request salary changes": Edit and Employee · Salary: View (to start from the salary in
// force) - their own areas since 2026-11-21. Only the kinds the viewer may ask for are offered.
// Restyled 2026-11-21 (the user: "boring"): who it is for on top, the kind as icon buttons, "was ..." under every changed
// detail and a summary of what is asked for above the buttons.
// The kinds in two groups (the user, 2026-11-21): job details only (no salary change), and salary changes - a "with hike"
// version of each job kind that can carry one (promotion, transfer, redesignation, company transfer), the salary revision
// and the salary correction. Picking a "with hike" kind sends the same kind with the salary part (no tick box any more).
// Each kind shows only the details it changes (DETAILS_OF, 2026-11-21).

type CreateInput = Parameters<typeof client.jobChanges.create>[0]
type Kind = CreateInput['kind']
const { JOINING: _joining, ...KIND_CHOICES } = JOB_CHANGE_KIND
const SALARY_KINDS: Kind[] = ['SALARY_REVISION', 'SALARY_CORRECTION']
// the kind buttons: job details only, and the job kinds that may come with a hike
const JOB_ONLY: Kind[] = ['PROMOTION', 'TRANSFER', 'REDESIGNATION', 'MANAGER_CHANGE', 'COMPANY_TRANSFER', 'OTHER']
const WITH_HIKE: Kind[] = ['PROMOTION', 'TRANSFER', 'REDESIGNATION', 'COMPANY_TRANSFER']

const ID_FIELDS = ['plantId', 'departmentId', 'workLocationId', 'designationId', 'gradeId', 'positionId', 'costCenterId'] as const
const CHANGE: FieldDef[] = [
  { name: 'kind', label: 'Kind of change', type: 'select', required: true, options: toOptions(KIND_CHOICES) },
  { name: 'effectiveFrom', label: 'Applies from', type: 'date', required: true, hint: 'A later day: applies then, once approved' },
  { name: 'reason', label: 'Reason', type: 'textarea', required: true, wide: true, placeholder: 'Why - shown to the approvers' },
]
const [, DATE_FIELD, REASON_FIELD] = CHANGE as [FieldDef, FieldDef, FieldDef]
const DETAILS: FieldDef[] = [
  { name: 'plantId', label: 'Plant', type: 'search', required: true },
  { name: 'departmentId', label: 'Department', type: 'search', required: true },
  { name: 'workLocationId', label: 'Work location', type: 'search' },
  { name: 'designationId', label: 'Designation', type: 'search' },
  { name: 'gradeId', label: 'Grade', type: 'select' },
  { name: 'positionId', label: 'Position', type: 'search' },
  { name: 'costCenterId', label: 'Cost centre', type: 'search' },
  { name: 'employmentType', label: 'Employment type', type: 'select', required: true, options: toOptions(EMPLOYMENT_TYPE) },
  { name: 'workforceCategory', label: 'Workforce', type: 'select', required: true, options: toOptions(WORKFORCE) },
]
// The details each kind of change may touch (the user, 2026-11-21: "a change of manager shows everything to change") - the
// others are hidden and not sent. A kind not listed (Other, a company transfer) shows every detail.
type Detail = (typeof DETAILS)[number]['name'] | 'reportingManager' | 'functionalManager'
const DETAILS_OF: Partial<Record<Kind, Detail[]>> = {
  PROMOTION: ['designationId', 'gradeId', 'positionId'],
  REDESIGNATION: ['designationId', 'positionId'],
  TRANSFER: ['plantId', 'departmentId', 'workLocationId', 'costCenterId', 'reportingManager', 'functionalManager'],
  MANAGER_CHANGE: ['reportingManager', 'functionalManager'],
}
const heading = 'flex items-center gap-2 text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase after:h-px after:flex-1 after:bg-border'

export function RequestChangeDrawer({ employee, onClose }: { employee: EmployeeProfile; onClose: () => void }) {
  const queryClient = useQueryClient()
  const { covers } = useAccess()
  const here = { companyId: employee.company.id, plantId: employee.plant.id, departmentId: employee.department?.id ?? null }
  const canJob = covers('JOB_CHANGE_REQUEST', 'WRITE', here)
  const canSalary = covers('SALARY_CHANGE_REQUEST', 'WRITE', here) && covers('SALARY', 'READ', here)
  const current = employee.salary
  const [initial] = useState<FormValues>(() => ({
    ...toFormValues(CHANGE, { kind: canJob ? 'PROMOTION' : 'SALARY_REVISION' }),
    ...toFormValues(DETAILS, {
      plantId: employee.plant.id,
      departmentId: employee.department?.id,
      workLocationId: employee.workLocation?.id,
      designationId: employee.designation?.id,
      gradeId: employee.grade?.id,
      positionId: employee.position?.id,
      costCenterId: employee.costCenter?.id,
      employmentType: employee.employmentType,
      workforceCategory: employee.workforceCategory,
    }),
    companyId: String(employee.company.id),
  }))
  const [values, setValues] = useState(initial)
  const [managerCode, setManagerCode] = useState(employee.reportingManager?.employeeCode ?? '')
  const [functionalCode, setFunctionalCode] = useState(employee.functionalManager?.employeeCode ?? '')
  // the names picked, for the summary
  const [managerName, setManagerName] = useState(employee.reportingManager?.name ?? '')
  const [functionalName, setFunctionalName] = useState(employee.functionalManager?.name ?? '')
  // the salary part: starts from the salary in force (the viewer sees it with the salary access)
  const startBreakup: BreakupValues = Object.fromEntries((current?.lines ?? []).map((l) => [l.salaryComponent.id, String(l.monthlyAmount)]))
  const [withSalary, setWithSalary] = useState(false)
  const [annualCtc, setAnnualCtc] = useState(current ? String(current.annualCtc) : '')
  const [performancePay, setPerformancePay] = useState(current?.performancePayAnnual ? String(current.performancePayAnnual) : '')
  const [closed, setClosed] = useState(false)

  const kind = values.kind as Kind
  const salaryOnly = SALARY_KINDS.includes(kind)
  const companyTransfer = kind === 'COMPANY_TRANSFER'
  const salaryShown = salaryOnly || withSalary
  // the breakup worked out from the new CTC by a salary structure (2026-11-24, as on the offer): it starts from the salary
  // in force and fills in from the structure once a new CTC is typed (or "Recalculate" / a structure is picked); the
  // employment type and workforce are the ones after this change
  const structure = useStructureBreakup({
    annualCtc: Number(annualCtc) || 0,
    joiningType: employee.joiningType,
    employmentType: values.employmentType as EmployeeProfile['employmentType'],
    workforceCategory: values.workforceCategory as EmployeeProfile['workforceCategory'],
    start: startBreakup,
    startFollowing: !current,
    disabled: !canSalary || !salaryShown,
  })
  const breakup = structure.breakup
  const shows = (name: Detail) => !salaryOnly && (!DETAILS_OF[kind] || DETAILS_OF[kind]!.includes(name))
  const shownDetails = DETAILS.filter((f) => shows(f.name))
  const companyId = companyTransfer ? Number(values.companyId) || 0 : employee.company.id
  const plantId = Number(values.plantId) || 0
  const companies = useQuery({ ...orpc.organization.companies.list.queryOptions(), enabled: companyTransfer })
  const plants = useQuery({ ...orpc.organization.plants.list.queryOptions({ input: { companyId } }), enabled: companyId > 0 })
  const departments = useQuery({ ...orpc.organization.departments.list.queryOptions({ input: { plantId } }), enabled: plantId > 0 })
  const locations = useQuery(orpc.organization.workLocations.list.queryOptions())
  const designations = useQuery(orpc.organization.designations.list.queryOptions())
  const grades = useQuery(orpc.organization.grades.list.queryOptions())
  const positions = useQuery(orpc.organization.positions.list.queryOptions())
  const costCenters = useQuery({ ...orpc.organization.costCenters.list.queryOptions({ input: { companyId } }), enabled: companyId > 0 })
  const components = useQuery({ ...orpc.organization.salaryComponents.list.queryOptions(), enabled: canSalary })
  // a move: only to where the viewer may place people (data access - the backend checks the same)
  const placeable = (company: number, plant?: number, department?: number) =>
    covers('JOB_CHANGE_REQUEST', 'WRITE', { companyId: company, ...(plant && { plantId: plant }), ...(department && { departmentId: department }) })
  const named = (rows: { id: number; name: string }[] | undefined) => (rows ?? []).map((r) => ({ value: String(r.id), label: r.name }))
  const options: Record<string, Option[]> = {
    plantId: (plants.data ?? []).filter((p) => placeable(companyId, p.id)).map((p) => ({ value: String(p.id), label: `${p.plantCode} · ${p.name}` })),
    departmentId: plantId ? (departments.data ?? []).filter((d) => placeable(companyId, plantId, d.id)).map((d) => ({ value: String(d.id), label: d.name })) : [],
    workLocationId: (locations.data ?? []).map((l) => ({ value: String(l.id), label: `${l.name} (${l.countryCode})` })),
    designationId: named(designations.data),
    gradeId: named(grades.data),
    positionId: named(positions.data),
    costCenterId: (costCenters.data ?? []).map((c) => ({ value: String(c.id), label: `${c.code} · ${c.name}` })),
  }
  // what the employee has now stays choosable, even if retired since (not across a company transfer: other lists)
  const sameCompany = companyId === employee.company.id
  for (const [key, held] of [
    ['plantId', sameCompany && { id: employee.plant.id, name: `${employee.plant.plantCode} · ${employee.plant.name}` }],
    ['departmentId', sameCompany && values.plantId === initial.plantId && employee.department],
    ['workLocationId', employee.workLocation],
    ['designationId', employee.designation],
    ['gradeId', employee.grade],
    ['positionId', employee.position],
    ['costCenterId', sameCompany && employee.costCenter && { id: employee.costCenter.id, name: `${employee.costCenter.code} · ${employee.costCenter.name}` }],
  ] as const) {
    if (held && !options[key]!.some((o) => o.value === String(held.id))) options[key]!.push({ value: String(held.id), label: held.name })
  }
  const companyOptions = (companies.data ?? []).map((c) => ({ value: String(c.id), label: `${c.name} (${c.code})` }))
  // what the employee has now, as shown - from their record (the dropdowns may no longer list it, e.g. after a company change)
  const held: Record<string, string | null | undefined> = {
    companyId: `${employee.company.name} (${employee.company.code})`,
    plantId: `${employee.plant.plantCode} · ${employee.plant.name}`,
    departmentId: employee.department?.name,
    workLocationId: employee.workLocation && `${employee.workLocation.name} (${employee.workLocation.countryCode})`,
    designationId: employee.designation?.name,
    gradeId: employee.grade?.name,
    positionId: employee.position?.name,
    costCenterId: employee.costCenter && `${employee.costCenter.code} · ${employee.costCenter.name}`,
    employmentType: EMPLOYMENT_TYPE[employee.employmentType],
    workforceCategory: WORKFORCE[employee.workforceCategory],
  }
  const wasLabel = (name: string) => held[name] ?? '—'
  // a value as shown in its dropdown
  const labelOf = (name: string, value: string | undefined) => {
    if (!value) return '—'
    const list = name === 'companyId' ? companyOptions : (options[name] ?? DETAILS.find((f) => f.name === name)?.options ?? [])
    return list.find((o) => o.value === value)?.label ?? (name === 'companyId' ? employee.company.name : value)
  }
  const changedField = (name: string) => (values[name] ?? '') !== (initial[name] ?? '')
  const prepare = (field: FieldDef): FieldDef => ({
    ...field,
    options: options[field.name] ?? field.options,
    ...(field.name === 'departmentId' && !plantId && { placeholder: 'Choose the plant first' }),
    // what it is now, under a changed detail
    ...(changedField(field.name) && { hint: `was ${wasLabel(field.name)}` }),
  })
  const set = (name: string, value: string) =>
    setValues((v) => {
      const next = { ...v, [name]: value }
      if (name === 'plantId' && value !== v.plantId) next.departmentId = ''
      // another company: its own plants, departments and cost centres
      if (name === 'companyId' && value !== v.companyId) Object.assign(next, { plantId: '', departmentId: '', costCenterId: '' })
      // a correction is for the salary in force: its day
      if (name === 'kind' && value === 'SALARY_CORRECTION' && !v.effectiveFrom && current) next.effectiveFrom = toDateInput(current.effectiveFrom)
      // leaving a company transfer: back to their own company
      if (name === 'kind' && value !== 'COMPANY_TRANSFER' && v.kind === 'COMPANY_TRANSFER') Object.assign(next, { companyId: initial.companyId, plantId: initial.plantId, departmentId: initial.departmentId, costCenterId: initial.costCenterId })
      return next
    })

  const managerChanged = shows('reportingManager') && managerCode !== (employee.reportingManager?.employeeCode ?? '')
  const functionalChanged = shows('functionalManager') && functionalCode !== (employee.functionalManager?.employeeCode ?? '')
  const changes = changedValues(shownDetails, initial, values)
  const changesJob = Object.keys(changes).length > 0 || (!salaryOnly && (managerChanged || functionalChanged)) || (companyTransfer && values.companyId !== initial.companyId)
  const lines = breakupLines(breakup)
  const salaryReady = !salaryShown || (Number(annualCtc) > 0 && lines.length > 0)
  const dirty =
    changesJob ||
    withSalary ||
    values.effectiveFrom !== '' ||
    values.reason !== '' ||
    values.kind !== initial.kind ||
    annualCtc !== (current ? String(current.annualCtc) : '') ||
    JSON.stringify(lines) !== JSON.stringify(breakupLines(startBreakup))
  const money = (amount: number) => formatMoney(amount, current?.currency ?? 'INR')
  // what is asked for, above the buttons: [what, from, to]
  const summary: [string, string, string][] = []
  if (!salaryOnly) {
    if (companyTransfer && changedField('companyId')) summary.push(['Company', wasLabel('companyId'), labelOf('companyId', values.companyId)])
    for (const f of shownDetails) if (changedField(f.name)) summary.push([f.label, wasLabel(f.name), labelOf(f.name, values[f.name])])
    if (managerChanged) summary.push(['Reporting manager', employee.reportingManager?.name ?? '—', managerName || '—'])
    if (functionalChanged) summary.push(['Functional manager', employee.functionalManager?.name ?? '—', functionalName || '—'])
  }
  const newCtc = Number(annualCtc) || 0
  if (salaryShown && newCtc > 0 && newCtc !== current?.annualCtc) {
    const percent = current?.annualCtc ? Math.round(((newCtc - current.annualCtc) / current.annualCtc) * 1000) / 10 : null
    summary.push(['Fixed CTC / year', current ? money(current.annualCtc) : '—', `${money(newCtc)}${percent !== null ? ` (${percent > 0 ? '+' : ''}${percent}%)` : ''}`])
  }
  // the kind picker's two groups - only what the viewer may ask for (a hike needs both request areas)
  const kindGroups: { title: string; note: string; salary: boolean; choices: { kind: Kind; hike: boolean }[] }[] = [
    { title: 'Job details only', note: 'no salary change', salary: false, choices: canJob ? JOB_ONLY.map((k) => ({ kind: k, hike: false })) : [] },
    {
      title: 'Salary change',
      note: 'with the new salary',
      salary: true,
      choices: [...(canJob && canSalary ? WITH_HIKE.map((k) => ({ kind: k, hike: true })) : []), ...(canSalary ? SALARY_KINDS.map((k) => ({ kind: k, hike: false })) : [])],
    },
  ]
  const kindName = (k: Kind, hike: boolean) => (hike ? `${KIND_CHOICES[k]} with hike` : KIND_CHOICES[k])
  const missing = !values.effectiveFrom || !values.reason.trim() || shownDetails.some((f) => f.required && !(values[f.name] ?? '').trim())

  const save = useMutation(
    orpc.jobChanges.create.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: orpc.jobChanges.key() })
        void queryClient.invalidateQueries({ queryKey: orpc.approvals.key() })
        void queryClient.invalidateQueries({ queryKey: orpc.employees.key() })
        setClosed(true)
      },
    }),
  )
  function submit() {
    const details: Record<string, unknown> = { ...changes }
    for (const key of ID_FIELDS) if (key in details) details[key] = details[key] == null || details[key] === '' ? null : Number(details[key])
    if (companyTransfer) {
      // the new company's plant and department are always sent
      details.plantId = Number(values.plantId)
      details.departmentId = Number(values.departmentId)
    }
    save.mutate({
      employeeCode: employee.employeeCode,
      effectiveFrom: fromDateInput(values.effectiveFrom)!,
      kind,
      reason: values.reason.trim(),
      ...(!salaryOnly && details),
      ...(companyTransfer && { companyId }),
      ...(!salaryOnly && managerChanged && { reportingManagerCode: managerCode || null }),
      ...(!salaryOnly && functionalChanged && { functionalManagerCode: functionalCode || null }),
      ...(salaryShown && {
        salary: { annualCtc: Number(annualCtc), performancePayAnnual: performancePay ? Number(performancePay) : null, currency: current?.currency, lines },
      }),
    } as CreateInput)
  }

  return (
    <FormDrawer
      onClose={onClose}
      closed={closed}
      dirty={dirty}
      width={720}
      title="Request a change"
      description="It goes for approval, then applies on its day. A typing mistake is fixed with Edit details instead."
      footer={
        <>
          <DrawerCancel />
          <Button variant="gold" disabled={save.isPending || missing || !salaryReady || (!changesJob && !salaryShown)} onClick={submit}>
            {save.isPending ? 'Sending…' : 'Send for approval'}
          </Button>
        </>
      }
    >
      <div className="flex items-center gap-3 rounded-2xl bg-surface-2/60 p-3">
        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-hero text-sm font-semibold text-hero-foreground">
          {`${employee.firstName.charAt(0)}${employee.lastName?.charAt(0) ?? ''}`.toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {fullName(employee)} <span className="font-normal text-muted-foreground tabular-nums">{employee.employeeCode}</span>
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {[employee.designation?.name, employee.department?.name, `${employee.plant.plantCode} ${employee.plant.name}`].filter(Boolean).join(' · ')}
          </p>
        </div>
        {canSalary && current && (
          <div className="shrink-0 text-right">
            <p className="text-xs text-muted-foreground">Fixed CTC now</p>
            <p className="text-sm font-medium tabular-nums">{money(current.annualCtc)}</p>
          </div>
        )}
      </div>
      <section className="space-y-3">
        <div role="radiogroup" aria-label="Kind of change" className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            Kind of change <span className="text-destructive">*</span>
          </p>
          {kindGroups
            .filter((g) => g.choices.length > 0)
            .map((g) => (
              <div key={g.title} className="space-y-1">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                  {g.salary ? <Wallet aria-hidden className="size-3.5" /> : <BriefcaseBusiness aria-hidden className="size-3.5" />}
                  {g.title}
                  <span className="font-normal tracking-normal normal-case">- {g.note}</span>
                </p>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {g.choices.map(({ kind: k, hike }) => {
                    const active = kind === k && (SALARY_KINDS.includes(k) || withSalary === hike)
                    return (
                      <button
                        key={`${k}-${hike}`}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => {
                          set('kind', k)
                          setWithSalary(hike)
                        }}
                        className={cn(
                          'flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-sm transition-colors',
                          active ? 'border-hero bg-hero text-hero-foreground' : g.salary ? 'border-gold/40 bg-gold-soft/30 hover:bg-gold-soft/60' : 'bg-card hover:bg-surface-2',
                        )}
                      >
                        <JobChangeKindIcon kind={k} className={cn('size-4 shrink-0', active ? 'text-gold' : 'text-muted-foreground')} />
                        <span className="min-w-0 truncate">{kindName(k, hike)}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-[12rem_minmax(0,1fr)]">
          <FieldsGrid fields={[DATE_FIELD]} values={values} onChange={set} />
          <FieldsGrid fields={[REASON_FIELD]} values={values} onChange={set} />
        </div>
      </section>
      {!salaryOnly && (
        <section className="space-y-3">
          <h3 className={heading}>
            <BriefcaseBusiness aria-hidden className="size-3.5" /> New details
            <span className="font-normal tracking-normal normal-case">
              - {DETAILS_OF[kind] ? `what a ${KIND_CHOICES[kind].toLowerCase()} changes (anything else: Other)` : 'change only what changes'}
            </span>
          </h3>
          {companyTransfer && (
            <FieldsGrid
              fields={[
                {
                  name: 'companyId',
                  label: 'Moves to company',
                  type: 'search',
                  required: true,
                  hint: 'They get the next code of its series; the old code still finds them',
                  options: (companies.data ?? [])
                    .filter((c) => c.id !== employee.company.id && placeable(c.id))
                    .map((c) => ({ value: String(c.id), label: `${c.name} (${c.code})` })),
                },
              ]}
              values={values}
              onChange={set}
            />
          )}
          {shownDetails.length > 0 && <FieldsGrid fields={shownDetails.map(prepare)} values={values} onChange={set} />}
          <div className="grid gap-4 sm:grid-cols-2">
            {shows('reportingManager') && (
            <div className="space-y-1">
              <label htmlFor="request-reporting-manager" className="text-xs font-medium text-muted-foreground">
                Reporting manager
              </label>
              <EmployeePicker
                id="request-reporting-manager"
                value={managerCode}
                initial={employee.reportingManager}
                excludeCode={employee.employeeCode}
                onChange={(picked) => {
                  setManagerCode(picked?.employeeCode ?? '')
                  setManagerName(picked?.name ?? '')
                }}
              />
            </div>
            )}
            {shows('functionalManager') && (
            <div className="space-y-1">
              <label htmlFor="request-functional-manager" className="text-xs font-medium text-muted-foreground">
                Functional manager
              </label>
              <EmployeePicker
                id="request-functional-manager"
                value={functionalCode}
                initial={employee.functionalManager}
                excludeCode={employee.employeeCode}
                onChange={(picked) => {
                  setFunctionalCode(picked?.employeeCode ?? '')
                  setFunctionalName(picked?.name ?? '')
                }}
              />
            </div>
            )}
          </div>
        </section>
      )}
      {canSalary && salaryShown && (
        <section className="space-y-3">
          <h3 className={heading}>
            <Wallet aria-hidden className="size-3.5" /> {salaryOnly ? 'Salary' : 'New salary'}
          </h3>
          {salaryShown && (
            <>
              <p className="text-xs text-muted-foreground">
                {kind === 'SALARY_CORRECTION'
                  ? 'Replaces the figures of the salary from that day (it must be a salary already saved).'
                  : current
                    ? 'Starts from the salary in force - change what changes. It must start after the latest salary.'
                    : 'No salary is saved yet - this will be the first.'}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label htmlFor="request-ctc" className="text-xs font-medium text-muted-foreground">
                    Fixed CTC / year ({current?.currency ?? 'INR'})
                  </label>
                  <Input id="request-ctc" inputMode="numeric" className="rounded-xl tabular-nums" value={annualCtc} onChange={(e) => {
                      setAnnualCtc(e.target.value.replace(/\D/g, '').slice(0, 10))
                      // a new CTC: the breakup fills in from the structure (unless lines were changed by hand)
                      structure.followIfUntouched()
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="request-performance" className="text-xs font-medium text-muted-foreground">
                    Performance pay / year (optional)
                  </label>
                  <Input
                    id="request-performance"
                    inputMode="numeric"
                    className="rounded-xl tabular-nums"
                    value={performancePay}
                    onChange={(e) => setPerformancePay(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  />
                </div>
              </div>
              <SalaryStructurePicker s={structure} />
              <SalaryStructureStatus s={structure} needs="Type the new fixed CTC" />
              <SalaryBreakupFields
                components={(components.data ?? []).map((c) => ({ id: c.id, name: c.name, kind: c.kind }))}
                values={breakup}
                onChange={structure.change}
                hideEmpty={!!structure.result?.structure}
                annualCtc={Number(annualCtc) || 0}
                currency={current?.currency ?? 'INR'}
                onUseTotal={(annual) => setAnnualCtc(String(annual))}
              />
            </>
          )}
        </section>
      )}
      {summary.length > 0 && (
        <section aria-label="What you are asking for" className="rounded-2xl border border-gold/60 bg-gold-soft/40 p-3">
          <p className="mb-1.5 text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            You are asking for · {kindName(kind, withSalary && !salaryOnly)}
            {values.effectiveFrom && `, from ${formatDate(fromDateInput(values.effectiveFrom))}`}
          </p>
          <ul className="space-y-1 text-sm">
            {summary.map(([what, from, to]) => (
              <li key={what} className="grid gap-x-3 sm:grid-cols-[9rem_minmax(0,1fr)]">
                <span className="text-xs text-muted-foreground sm:pt-0.5">{what}</span>
                <span className="min-w-0">
                  <span className="text-muted-foreground line-through decoration-border">{from}</span> → <span className="font-medium">{to}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <FormError error={save.error} />
    </FormDrawer>
  )
}
