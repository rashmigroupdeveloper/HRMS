import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { DrawerCancel, FormDrawer } from '@/components/FormDrawer'
import { FormError } from '@/components/FormError'
import { Button } from '@/components/ui/button'
import { useAccess, type Where } from '@/hooks/useAccess'
import { client, orpc } from '@/lib/orpc'
import { FieldsGrid } from '@/components/FormFields'
import { type BreakupValues, breakupLines, changedValues, type FieldDef, type FormValues, fromFormValues, toFormValues } from '@/lib/form-values'
import { Checkbox } from '@/components/ui/checkbox'
import { type Candidate, DOCUMENT_TYPE, EMPLOYMENT_TYPE, EMPLOYMENT_TYPES_FOR, FIXED_PERIOD, JOINING_TYPE, type Option, SALUTATION, toOptions, WORKFORCE } from './labels'
import { SalaryBreakupFields } from '@/components/SalaryBreakupFields'

type CreateInput = Parameters<typeof client.candidates.create>[0]
type UpdateInput = Parameters<typeof client.candidates.update>[0]

// About the person - editable in every open status
const PERSON = ['salutation', 'firstName', 'middleName', 'lastName', 'mobile', 'personalEmail', 'address']
// Still changeable once the offer is accepted
const CHANGEABLE_WHEN_ACCEPTED = ['proposedJoiningDate', 'extraRequiredDocuments']
const ID_FIELDS = ['companyId', 'plantId', 'workLocationId', 'departmentId', 'designationId', 'gradeId']

// The form in sections; every field is printed on the offer letter or decides which letter / joining pack is used
const SECTIONS: { title: string; hint?: string; fields: FieldDef[] }[] = [
  {
    title: 'Candidate',
    hint: 'Who the offer letter is addressed to.',
    fields: [
      { name: 'salutation', label: 'Salutation', type: 'select', options: toOptions(SALUTATION) },
      { name: 'firstName', label: 'First name', required: true },
      { name: 'middleName', label: 'Middle name' },
      { name: 'lastName', label: 'Last name' },
      { name: 'mobile', label: 'Mobile', required: true, placeholder: '10-digit mobile' },
      { name: 'personalEmail', label: 'Personal email', type: 'email', placeholder: 'The letter and link are e-mailed here' },
      { name: 'address', label: 'Address (printed on the letter)', type: 'textarea', wide: true, placeholder: 'House, street, city, state - PIN' },
    ],
  },
  {
    title: 'Position',
    fields: [
      { name: 'companyId', label: 'Company', type: 'select', required: true },
      // company -> plant -> department (2026-11-18): the plant is one of the company's, the department one of the plant's
      { name: 'plantId', label: 'Plant', type: 'search', required: true },
      { name: 'departmentId', label: 'Department', type: 'search' },
      { name: 'workLocationId', label: 'Work location (initial posting)', type: 'select' },
      { name: 'designationId', label: 'Designation', type: 'select', required: true },
      { name: 'gradeId', label: 'Grade', type: 'select' },
      { name: 'joiningType', label: 'Joining type', type: 'select', required: true, options: toOptions(JOINING_TYPE) },
      { name: 'employmentType', label: 'Employment type', type: 'select', required: true, options: toOptions(EMPLOYMENT_TYPE) },
      { name: 'workforceCategory', label: 'Workforce', type: 'select', required: true, options: toOptions(WORKFORCE) },
    ],
  },
  {
    title: 'Dates, probation and notice',
    fields: [
      { name: 'proposedJoiningDate', label: 'Joining date', type: 'date', required: true },
      { name: 'offerValidUntil', label: 'Offer valid until', type: 'date' },
      // shown for every employment type but permanent; required for the fixed-period ones (see prepare)
      { name: 'contractEndDate', label: 'Contract / engagement end', type: 'date', showIf: (v) => !!v.employmentType && v.employmentType !== 'PERMANENT' },
      { name: 'probationMonths', label: 'Probation (months)', type: 'number', placeholder: 'e.g. 6' },
      { name: 'noticeMonthsProbation', label: 'Notice during probation (months)', type: 'number', placeholder: 'e.g. 1' },
      { name: 'noticeMonthsConfirmed', label: 'Notice after confirmation (months)', type: 'number', placeholder: 'e.g. 1' },
    ],
  },
  {
    title: 'Pay',
    hint: 'Annual CTC is the fixed CTC; performance pay comes on top (Total CTC on the letter).',
    fields: [
      { name: 'annualCtc', label: 'Annual CTC (fixed)', type: 'number', required: true, placeholder: 'e.g. 840000' },
      { name: 'performancePayAnnual', label: 'Performance pay per year', type: 'number', placeholder: 'optional' },
      { name: 'ctcCurrency', label: 'CTC currency', placeholder: 'INR' },
    ],
  },
  {
    title: 'Documents needed',
    hint: 'Ticked and greyed: always needed for this joining type. Tick any others this offer needs - the candidate uploads them before signing the joining form, and HR verifies them before joining. Can change until joining.',
    fields: [{ name: 'extraRequiredDocuments', label: 'Also needed for this offer', type: 'checks', wide: true }],
  },
  {
    title: 'After acceptance',
    hint: "Not printed on the letter. Unticked, HR sends the joining form link from the candidate's Joining form tab after they accept.",
    fields: [
      {
        name: 'joiningFormOnAcceptance',
        label: 'Joining form',
        type: 'checkbox',
        wide: true,
        placeholder: 'Open the joining form when the candidate accepts - its link is e-mailed to them then',
      },
    ],
  },
]
const ALL_FIELDS = SECTIONS.flatMap((s) => s.fields)

const breakupOf = (candidate?: Candidate): BreakupValues =>
  Object.fromEntries((candidate?.salaryLines ?? []).map((l) => [l.salaryComponent.id, String(l.monthlyAmount)]))
const sameBreakup = (a: BreakupValues, b: BreakupValues) => JSON.stringify(breakupLines(a).sort((x, y) => x.salaryComponentId - y.salaryComponentId)) === JSON.stringify(breakupLines(b).sort((x, y) => x.salaryComponentId - y.salaryComponentId))

// New offer (candidate = undefined) or edit an existing one.
export function OfferDialog({
  open,
  onOpenChange,
  candidate,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  candidate?: Candidate
  onCreated?: (id: number) => void
}) {
  if (!open) return null
  return <OfferForm candidate={candidate} onDone={() => onOpenChange(false)} onCreated={onCreated} />
}

function OfferForm({ candidate, onDone, onCreated }: { candidate?: Candidate; onDone: () => void; onCreated?: (id: number) => void }) {
  const queryClient = useQueryClient()
  const [initial] = useState<FormValues>(() =>
    toFormValues(
      ALL_FIELDS,
      candidate
        ? {
            ...candidate,
            companyId: candidate.company.id,
            plantId: candidate.plant.id,
            workLocationId: candidate.workLocation?.id,
            departmentId: candidate.department?.id,
            designationId: candidate.designation.id,
            gradeId: candidate.grade?.id,
          }
        : { salutation: 'MR', probationMonths: 6, noticeMonthsProbation: 1, noticeMonthsConfirmed: 1 },
    ),
  )
  const [values, setValues] = useState(initial)
  const [initialBreakup] = useState(() => breakupOf(candidate))
  const [breakup, setBreakup] = useState(initialBreakup)

  const companies = useQuery(orpc.organization.companies.list.queryOptions())
  // the plants of the chosen company, and the departments of the chosen plant
  const companyId = Number(values.companyId) || 0
  const plantId = Number(values.plantId) || 0
  const plants = useQuery({ ...orpc.organization.plants.list.queryOptions({ input: { companyId } }), enabled: companyId > 0 })
  const departments = useQuery({ ...orpc.organization.departments.list.queryOptions({ input: { plantId } }), enabled: plantId > 0 })
  const designations = useQuery(orpc.organization.designations.list.queryOptions())
  const grades = useQuery(orpc.organization.grades.list.queryOptions())
  // one group-wide list - any company can place people at any work location
  const locations = useQuery(orpc.organization.workLocations.list.queryOptions())
  const salaryComponents = useQuery(orpc.organization.salaryComponents.list.queryOptions())
  // the pack's compulsory documents and what an offer may ask for on top (2026-11-20)
  const docRules = useQuery(orpc.candidates.documents.requirements.queryOptions())

  // only where the viewer may place offers (data access - the backend checks the same)
  const { covers } = useAccess()
  const placeable = (where: Where) => covers('ONBOARDING', 'WRITE', where)
  const masterOptions: Record<string, Option[]> = {
    companyId: (companies.data ?? []).filter((c) => placeable({ companyId: c.id })).map((c) => ({ value: String(c.id), label: `${c.name} (${c.code})` })),
    plantId: companyId
      ? (plants.data ?? []).filter((p) => placeable({ companyId, plantId: p.id })).map((p) => ({ value: String(p.id), label: `${p.plantCode} · ${p.name}` }))
      : [],
    workLocationId: (locations.data ?? []).map((l) => ({ value: String(l.id), label: `${l.name} (${l.countryCode})` })),
    designationId: (designations.data ?? []).map((d) => ({ value: String(d.id), label: d.name })),
    departmentId: plantId
      ? (departments.data ?? []).filter((d) => placeable({ companyId, plantId, departmentId: d.id })).map((d) => ({ value: String(d.id), label: d.name }))
      : [],
    gradeId: (grades.data ?? []).map((g) => ({ value: String(g.id), label: g.name })),
    extraRequiredDocuments: (docRules.data?.requestable ?? []).map((d) => ({ value: d.type, label: d.label })),
  }
  // the offer's own department still shows when it was retired at the plant since (it may stay; a new one must be open)
  const own = candidate?.department
  if (own && candidate.plant.id === plantId && !masterOptions.departmentId!.some((o) => o.value === String(own.id))) {
    masterOptions.departmentId!.push({ value: String(own.id), label: own.name })
  }
  const accepted = candidate?.status === 'ACCEPTED'
  // the employment types that fit the chosen joining type
  const joiningType = values.joiningType as Candidate['joiningType'] | ''
  const employmentOptions = joiningType ? EMPLOYMENT_TYPES_FOR[joiningType].map((t) => ({ value: t, label: EMPLOYMENT_TYPE[t] })) : undefined
  const prepare = (field: FieldDef): FieldDef => ({
    ...field,
    options: masterOptions[field.name] ?? (field.name === 'employmentType' ? employmentOptions : undefined) ?? field.options,
    ...(field.name === 'contractEndDate' && { required: FIXED_PERIOD.includes(values.employmentType as Candidate['employmentType']) }),
    ...(field.name === 'plantId' && !companyId && { placeholder: 'Choose the company first' }),
    ...(field.name === 'departmentId' && !plantId && { placeholder: 'Choose the plant first' }),
    // Accepted offer: the terms are locked (except the joining date and the documents asked for)
    disabled: accepted && !PERSON.includes(field.name) && !CHANGEABLE_WHEN_ACCEPTED.includes(field.name),
  })
  const fields = ALL_FIELDS.map(prepare)

  // active components, plus any retired one this offer already uses (so it still shows)
  const used = (candidate?.salaryLines ?? []).map((l) => l.salaryComponent)
  const components = [...(salaryComponents.data ?? []), ...used.filter((u) => !(salaryComponents.data ?? []).some((c) => c.id === u.id))]

  const done = (id: number) => {
    void queryClient.invalidateQueries({ queryKey: orpc.candidates.key() })
    onCreated?.(id)
    onDone()
  }
  const create = useMutation(orpc.candidates.create.mutationOptions({ onSuccess: (c) => done(c.id) }))
  const update = useMutation(orpc.candidates.update.mutationOptions({ onSuccess: (c) => done(c.id) }))
  const pending = create.isPending || update.isPending
  const breakupChanged = !sameBreakup(initialBreakup, breakup)
  const dirty = fields.some((f) => (values[f.name] ?? '') !== (initial[f.name] ?? '')) || breakupChanged

  // The id selects hold strings; the API wants numbers
  const withIds = (payload: Record<string, unknown>) => {
    for (const key of ID_FIELDS) if (typeof payload[key] === 'string') payload[key] = Number(payload[key])
    return payload
  }

  function submit() {
    if (!candidate) {
      const lines = breakupLines(breakup)
      create.mutate({ ...withIds(fromFormValues(fields, values)), ...(lines.length && { salaryLines: lines }) } as CreateInput)
      return
    }
    const changes = withIds(changedValues(fields, initial, values))
    // an accepted offer changes only the person's details and the joining date - the locked terms are not sent, so a
    // hidden one (e.g. an old contract end date on a permanent offer) is not "cleared" and refused
    if (candidate.status === 'ACCEPTED') {
      for (const name of Object.keys(changes)) if (!PERSON.includes(name) && !CHANGEABLE_WHEN_ACCEPTED.includes(name)) delete changes[name]
    }
    // an unticked box comes back as "cleared" (null): it means "HR sends the link"
    if (changes.joiningFormOnAcceptance === null) changes.joiningFormOnAcceptance = false
    // every box unticked = no extra documents
    if (changes.extraRequiredDocuments === null) changes.extraRequiredDocuments = []
    if (breakupChanged && candidate.status !== 'ACCEPTED') changes.salaryLines = breakupLines(breakup)
    if (Object.keys(changes).length === 0) return onDone()
    update.mutate({ id: candidate.id, ...changes } as UpdateInput)
  }

  const set = (name: string, v: string) =>
    setValues((s) => {
      const next = { ...s, [name]: v }
      // another company has other plants, another plant other departments: pick them again
      if (name === 'companyId' && v !== s.companyId) next.plantId = ''
      if ((name === 'companyId' || name === 'plantId') && v !== s[name]) next.departmentId = ''
      // a joining type that does not allow the chosen employment type clears it, so HR picks again
      if (name === 'joiningType' && v && next.employmentType && !EMPLOYMENT_TYPES_FOR[v as Candidate['joiningType']].includes(next.employmentType as Candidate['employmentType'])) {
        next.employmentType = ''
      }
      return next
    })

  return (
    <FormDrawer
      onClose={onDone}
      dirty={dirty}
      width={760}
      title={<>{candidate ? 'Edit offer' : 'New offer'}</>}
      description={
        <>
          {!candidate && 'Saved as a draft. Sending it writes the offer letter and e-mails it to the candidate.'}
          {candidate?.status === 'DRAFT' && 'Draft: everything can change.'}
          {candidate?.status === 'OFFERED' &&
            (candidate.loiAcceptedAt
              ? 'The full offer was sent. Changing any offer term takes it back - send it again as a revised letter.'
              : 'A letter was sent. Changing any offer term moves it back to Draft - send it again as a revised letter.')}
          {candidate?.status === 'LOI_ACCEPTED' && 'The Letter of Intent was accepted: the terms can still change before the full offer is sent.'}
          {accepted && 'Accepted offer: only the person details and the joining date can change.'}
        </>
      }
      footer={
        <>
          <DrawerCancel />
          <Button variant="gold" disabled={pending} onClick={submit}>
            {pending ? 'Saving…' : candidate ? 'Save changes' : 'Create draft offer'}
          </Button>
        </>
      }
    >
      {SECTIONS.map((section) => (
        <section key={section.title} className="space-y-3">
          <div>
            <h3 className="flex items-center gap-3 text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase after:h-px after:flex-1 after:bg-border">
              {section.title}
            </h3>
            {section.hint && <p className="mt-1 text-xs text-muted-foreground">{section.hint}</p>}
          </div>
          {section.title === 'Documents needed' && (
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {joiningType ? (
                (docRules.data?.compulsory[joiningType] ?? []).map((type) => (
                  <label key={type} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Checkbox checked disabled />
                    {DOCUMENT_TYPE[type]}
                    {type === 'ESIC_FORM_1' && ' (when ESIC applies)'}
                  </label>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">Choose the joining type to see the documents it always needs.</p>
              )}
            </div>
          )}
          <FieldsGrid fields={section.fields.map(prepare)} values={values} onChange={set} />
          {section.title === 'Pay' && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Salary breakup (Annexure-I of the letter) - monthly amounts</p>
              <SalaryBreakupFields
                components={components}
                values={breakup}
                onChange={setBreakup}
                annualCtc={Number(values.annualCtc) || 0}
                currency={values.ctcCurrency || 'INR'}
                onUseTotal={(annual) => set('annualCtc', String(annual))}
                disabled={accepted}
              />
            </div>
          )}
        </section>
      ))}
      <FormError error={create.error ?? update.error} />
    </FormDrawer>
  )
}
