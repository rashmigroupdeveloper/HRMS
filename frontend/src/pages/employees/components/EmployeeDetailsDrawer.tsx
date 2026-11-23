import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'
import { useState } from 'react'
import { EmployeePicker } from '@/components/EmployeePicker'
import { DrawerCancel, FormDrawer } from '@/components/FormDrawer'
import { FormError } from '@/components/FormError'
import { FieldsGrid } from '@/components/FormFields'
import { Button } from '@/components/ui/button'
import { changedValues, type FieldDef, fromFormValues, type Option, toFormValues, toOptions } from '@/lib/form-values'
import { useAccess, type Where } from '@/hooks/useAccess'
import { type client, orpc } from '@/lib/orpc'
import { EMPLOYMENT_TYPE, type EmployeeProfile, GENDER, JOINING_TYPE, SALUTATION, WORKFORCE } from './labels'

// "Add employee" (someone who joins without onboarding) and "Edit details" of an employee - the core details only (the
// IDs, bank, family... come from the joining form, or later). Employees: Edit. No login is created for an added
// employee - HR gives one on the Roles & access page (as in the old HRMS).

type AddInput = Parameters<typeof client.employees.create>[0]
type UpdateInput = Parameters<typeof client.employees.update>[0]

// the job details - in "Edit details" only with "Approve job & salary changes" (D7, 2026-11-20)
const JOB_FIELDS = ['plantId', 'departmentId', 'workLocationId', 'designationId', 'gradeId', 'positionId', 'costCenterId', 'employmentType', 'workforceCategory']
const ID_FIELDS = ['companyId', 'plantId', 'workLocationId', 'departmentId', 'designationId', 'gradeId', 'positionId', 'costCenterId']

// `personal`: the viewer sees personal details (gender, date of birth) - editing without that area leaves them out
function sections(adding: boolean, personal = true): { title: string; fields: FieldDef[] }[] {
  return [
    {
      title: 'Job',
      fields: [
        ...(adding ? [{ name: 'companyId', label: 'Company', type: 'search', required: true } satisfies FieldDef] : []),
        // company -> plant -> department (2026-11-18): a plant of the company, a department of the plant (required -
        // every employee has one, 2026-11-19)
        { name: 'plantId', label: 'Plant', type: 'search', required: true },
        { name: 'departmentId', label: 'Department', type: 'search', required: true },
        { name: 'designationId', label: 'Designation', type: 'search' },
        { name: 'workLocationId', label: 'Work location', type: 'search' },
        { name: 'gradeId', label: 'Grade', type: 'select' },
        { name: 'positionId', label: 'Position', type: 'search' },
        { name: 'costCenterId', label: 'Cost centre', type: 'search' },
        { name: 'dateOfJoining', label: 'Date of joining', type: 'date', required: true },
        { name: 'joiningType', label: 'Joining type', type: 'select', options: toOptions(JOINING_TYPE) },
        { name: 'employmentType', label: 'Employment type', type: 'select', options: toOptions(EMPLOYMENT_TYPE) },
        { name: 'workforceCategory', label: 'Workforce', type: 'select', options: toOptions(WORKFORCE) },
        { name: 'contractEndDate', label: 'Contract end date', type: 'date', showIf: (v) => !!v.employmentType && v.employmentType !== 'PERMANENT' },
        { name: 'probationEndDate', label: 'Probation end date', type: 'date' },
        ...(adding ? [] : [{ name: 'confirmationDate', label: 'Confirmation date', type: 'date' } satisfies FieldDef]),
      ],
    },
    {
      title: 'Person',
      fields: [
        { name: 'salutation', label: 'Salutation', type: 'select', options: toOptions(SALUTATION) },
        { name: 'firstName', label: 'First name', required: true },
        { name: 'middleName', label: 'Middle name' },
        { name: 'lastName', label: 'Last name' },
        ...(personal
          ? ([
              { name: 'gender', label: 'Gender', type: 'select', options: toOptions(GENDER) },
              { name: 'dateOfBirth', label: 'Date of birth', type: 'date', hint: 'At least 18 on the date of joining' },
            ] satisfies FieldDef[])
          : []),
      ],
    },
    {
      title: 'Contact',
      fields: [
        { name: 'mobile', label: 'Mobile' },
        ...(adding ? [] : [{ name: 'alternateMobile', label: 'Second mobile' } satisfies FieldDef]),
        { name: 'personalEmail', label: 'Personal e-mail', type: 'email' },
        { name: 'workEmail', label: 'Work e-mail', type: 'email' },
      ],
    },
  ]
}

// the code an employee of this company would get next: its prefix + the next number as 6 digits (the backend's format)
const nextCodeOf = (company: { ecodePrefix: string; nextEmployeeNumber: number | null } | undefined) =>
  company?.nextEmployeeNumber == null ? null : company.ecodePrefix + String(company.nextEmployeeNumber).padStart(6, '0')

export function EmployeeDetailsDrawer({
  employee,
  onClose,
  onAdded,
}: {
  // the employee to edit; none = add a new one
  employee?: EmployeeProfile
  onClose: () => void
  // after adding: the new employee's code
  onAdded?: (employeeCode: string) => void
}) {
  const adding = !employee
  const queryClient = useQueryClient()
  const all = sections(adding, !employee?.personalDetailsHidden)
  const fields = all.flatMap((s) => s.fields)
  const [initial] = useState(() =>
    toFormValues(
      fields,
      employee
        ? {
            ...employee,
            plantId: employee.plant.id,
            workLocationId: employee.workLocation?.id,
            departmentId: employee.department?.id,
            designationId: employee.designation?.id,
            gradeId: employee.grade?.id,
            positionId: employee.position?.id,
            costCenterId: employee.costCenter?.id,
          }
        : { joiningType: 'REGULAR', employmentType: 'PERMANENT', workforceCategory: 'WHITE_COLLAR' },
    ),
  )
  const [values, setValues] = useState(initial)
  const initialManager = employee?.reportingManager ?? null
  const [managerCode, setManagerCode] = useState(initialManager?.employeeCode ?? '')
  const initialFunctional = employee?.functionalManager ?? null
  const [functionalCode, setFunctionalCode] = useState(initialFunctional?.employeeCode ?? '')
  const [closed, setClosed] = useState(false)

  const companies = useQuery(orpc.organization.companies.list.queryOptions())
  const locations = useQuery(orpc.organization.workLocations.list.queryOptions())
  // the plants of the company (the chosen one when adding, the employee's when editing), the departments of the plant
  const companyId = employee ? employee.company.id : Number(values.companyId) || 0
  const plantId = Number(values.plantId) || 0
  const plants = useQuery({ ...orpc.organization.plants.list.queryOptions({ input: { companyId } }), enabled: companyId > 0 })
  const departments = useQuery({ ...orpc.organization.departments.list.queryOptions({ input: { plantId } }), enabled: plantId > 0 })
  const designations = useQuery(orpc.organization.designations.list.queryOptions())
  const grades = useQuery(orpc.organization.grades.list.queryOptions())
  const positions = useQuery(orpc.organization.positions.list.queryOptions())
  // the company's cost centres
  const costCenters = useQuery({ ...orpc.organization.costCenters.list.queryOptions({ input: { companyId } }), enabled: companyId > 0 })
  // only where the viewer may place people (data access - the backend checks the same)
  const { covers } = useAccess()
  const placeable = (where: Where) => covers('EMPLOYEES', 'WRITE', where)
  const masterOptions: Record<string, Option[]> = {
    companyId: (companies.data ?? []).filter((c) => placeable({ companyId: c.id })).map((c) => ({ value: String(c.id), label: `${c.name} (${c.code})` })),
    workLocationId: (locations.data ?? []).map((l) => ({ value: String(l.id), label: `${l.name} (${l.countryCode})` })),
    plantId: companyId
      ? (plants.data ?? []).filter((p) => placeable({ companyId, plantId: p.id })).map((p) => ({ value: String(p.id), label: `${p.plantCode} · ${p.name}` }))
      : [],
    departmentId: plantId
      ? (departments.data ?? []).filter((d) => placeable({ companyId, plantId, departmentId: d.id })).map((d) => ({ value: String(d.id), label: d.name }))
      : [],
    designationId: (designations.data ?? []).map((d) => ({ value: String(d.id), label: d.name })),
    gradeId: (grades.data ?? []).map((g) => ({ value: String(g.id), label: g.name })),
    positionId: (positions.data ?? []).map((p) => ({ value: String(p.id), label: p.name })),
    costCenterId: companyId ? (costCenters.data ?? []).map((c) => ({ value: String(c.id), label: `${c.code} · ${c.name}` })) : [],
  }
  // an employee's current master that was retired since still shows
  if (employee) {
    for (const [key, current] of [
      ['workLocationId', employee.workLocation],
      ['departmentId', employee.department],
      ['designationId', employee.designation],
      ['gradeId', employee.grade],
      ['positionId', employee.position],
    ] as const) {
      if (current && !masterOptions[key]!.some((o) => o.value === String(current.id))) masterOptions[key]!.push({ value: String(current.id), label: current.name })
    }
    const costCenter = employee.costCenter
    if (costCenter && !masterOptions.costCenterId!.some((o) => o.value === String(costCenter.id))) {
      masterOptions.costCenterId!.push({ value: String(costCenter.id), label: `${costCenter.code} · ${costCenter.name}` })
    }
    const plant = employee.plant
    if (!masterOptions.plantId!.some((o) => o.value === String(plant.id))) masterOptions.plantId!.push({ value: String(plant.id), label: `${plant.plantCode} · ${plant.name}` })
  }
  // D7 (2026-11-20): job details change through approval (Request a change on the Pay & career page - Raise a change); changing them here needs
  // "Approve job & salary changes" for the employee (the backend checks the same)
  const jobLocked = !adding && !covers('JOB_CHANGE_APPROVAL', 'WRITE', { companyId: employee.company.id, plantId: employee.plant.id, departmentId: employee.department?.id ?? null })
  const prepare = (field: FieldDef): FieldDef => ({
    ...field,
    ...(jobLocked && JOB_FIELDS.includes(field.name) && { disabled: true }),
    options: masterOptions[field.name] ?? field.options,
    ...(field.name === 'plantId' && !companyId && { placeholder: 'Choose the company first' }),
    ...(field.name === 'departmentId' && !plantId && { placeholder: 'Choose the plant first' }),
    ...(field.name === 'costCenterId' && !companyId && { placeholder: 'Choose the company first' }),
  })
  // another company has other plants, another plant other departments: pick them again
  const set = (name: string, value: string) =>
    setValues((v) => ({
      ...v,
      [name]: value,
      ...(name === 'companyId' && value !== v.companyId && { plantId: '', departmentId: '', costCenterId: '' }),
      ...(name === 'plantId' && value !== v.plantId && { departmentId: '' }),
    }))

  const company = companies.data?.find((c) => String(c.id) === values.companyId)
  const nextCode = nextCodeOf(company)
  const done = () => {
    void queryClient.invalidateQueries({ queryKey: orpc.employees.key() })
    setClosed(true)
  }
  const create = useMutation(
    orpc.employees.create.mutationOptions({
      onSuccess: (created) => {
        done()
        onAdded?.(created.employeeCode)
      },
    }),
  )
  const update = useMutation(orpc.employees.update.mutationOptions({ onSuccess: done }))
  const pending = create.isPending || update.isPending
  const managerChanged = managerCode !== (initialManager?.employeeCode ?? '')
  const functionalChanged = functionalCode !== (initialFunctional?.employeeCode ?? '')
  const changes = changedValues(fields, initial, values)
  const dirty = Object.keys(changes).length > 0 || managerChanged || functionalChanged
  // a required field left empty (e.g. the department after the plant changed): pick it before saving
  const missing = fields.some((f) => f.required && !f.readOnly && !(values[f.name] ?? '').trim())

  const withIds = (payload: Record<string, unknown>) => {
    for (const key of ID_FIELDS) if (typeof payload[key] === 'string') payload[key] = Number(payload[key])
    return payload
  }
  function submit() {
    if (adding) {
      create.mutate({
        ...withIds(fromFormValues(fields, values)),
        ...(managerCode && { reportingManagerCode: managerCode }),
        ...(functionalCode && { functionalManagerCode: functionalCode }),
      } as AddInput)
      return
    }
    if (!dirty) return setClosed(true)
    update.mutate({
      employeeCode: employee.employeeCode,
      ...withIds(changes),
      ...(managerChanged && { reportingManagerCode: managerCode || null }),
      ...(functionalChanged && { functionalManagerCode: functionalCode || null }),
    } as UpdateInput)
  }

  return (
    <FormDrawer
      onClose={onClose}
      closed={closed}
      dirty={dirty}
      width={720}
      title={adding ? 'Add employee' : `Edit ${employee.employeeCode}`}
      description={
        adding ? (
          <>
            For someone who joins without onboarding. The IDs, bank, family and other details are added later. No login is created - give one on
            the Roles &amp; access page.
          </>
        ) : (
          <>
            {employee.company.name}. For fixing mistakes - a change from a day on (a promotion, a transfer, a move to another company) is
            asked for on the Pay & career page (Raise a change), so it goes through approval and shows in the job timeline.
          </>
        )
      }
      footer={
        <>
          <DrawerCancel />
          <Button variant="gold" disabled={pending || missing || (adding && !!company && !nextCode)} onClick={submit}>
            {pending ? 'Saving…' : adding ? 'Add employee' : 'Save changes'}
          </Button>
        </>
      }
    >
      {all.map((section) => (
        <section key={section.title} className="space-y-3">
          <h3 className="flex items-center gap-3 text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase after:h-px after:flex-1 after:bg-border">
            {section.title}
          </h3>
          {jobLocked && section.title === 'Job' && (
            <p className="rounded-xl bg-surface-2/60 px-3 py-2 text-xs text-muted-foreground">
              The job details and managers change through approval - use Raise a change on the Pay & career page. Here you fix the name, dates and contact details.
            </p>
          )}
          <FieldsGrid fields={section.fields.map(prepare)} values={values} onChange={set} />
          {adding && section.title === 'Job' && company && (
            <p className={nextCode ? 'text-xs text-muted-foreground' : 'rounded-xl bg-warning/10 px-3 py-2 text-xs text-warning-ink'}>
              {nextCode ? (
                <>
                  Employee code: <span className="font-medium text-foreground tabular-nums">{nextCode}</span> (the next of {company.code}&apos;s series)
                </>
              ) : (
                <>
                  {company.name} has no employee code series yet - set its next employee number on the{' '}
                  <Link to="/organization" className="font-medium underline underline-offset-2">
                    Organization page
                  </Link>{' '}
                  first.
                </>
              )}
            </p>
          )}
        </section>
      ))}
      <section className="space-y-3">
        <h3 className="flex items-center gap-3 text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase after:h-px after:flex-1 after:bg-border">
          Managers
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="reporting-manager" className="text-xs font-medium text-muted-foreground">
              Reporting manager
            </label>
            {jobLocked ? (
              <p id="reporting-manager" className="text-sm">{initialManager ? `${initialManager.name} (${initialManager.employeeCode})` : '—'}</p>
            ) : (
              <EmployeePicker
                id="reporting-manager"
                value={managerCode}
                initial={initialManager}
                excludeCode={employee?.employeeCode}
                onChange={(picked) => setManagerCode(picked?.employeeCode ?? '')}
              />
            )}
            <p className="text-xs text-muted-foreground">Approves their leave and attendance. Leave empty for the head of a company.</p>
          </div>
          <div className="space-y-1">
            <label htmlFor="functional-manager" className="text-xs font-medium text-muted-foreground">
              Functional manager
            </label>
            {jobLocked ? (
              <p id="functional-manager" className="text-sm">{initialFunctional ? `${initialFunctional.name} (${initialFunctional.employeeCode})` : '—'}</p>
            ) : (
              <EmployeePicker
                id="functional-manager"
                value={functionalCode}
                initial={initialFunctional}
                excludeCode={employee?.employeeCode}
                onChange={(picked) => setFunctionalCode(picked?.employeeCode ?? '')}
              />
            )}
            <p className="text-xs text-muted-foreground">Optional. Shown on the profile only - approvals stay with the reporting manager.</p>
          </div>
        </div>
      </section>
      <FormError error={create.error ?? update.error} />
    </FormDrawer>
  )
}
