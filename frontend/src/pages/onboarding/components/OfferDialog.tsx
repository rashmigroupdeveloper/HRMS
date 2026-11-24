import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BriefcaseBusiness, CalendarRange, Check, FileCheck2, Lock, type LucideIcon, PenLine, Send, TriangleAlert, UserRound, Wallet } from 'lucide-react'
import { Pill } from '@/components/Pill'
import { useCallback, useRef, useState } from 'react'
import { DrawerCancel, FormDrawer } from '@/components/FormDrawer'
import { FormError } from '@/components/FormError'
import { Button } from '@/components/ui/button'
import { useAccess, type Where } from '@/hooks/useAccess'
import { useStructureBreakup } from '@/hooks/useStructureBreakup'
import { client, orpc } from '@/lib/orpc'
import { cn, formatMoney, monthlyOf, sumMoney } from '@/lib/utils'
import { FieldsGrid } from '@/components/FormFields'
import { type BreakupValues, breakupLines, changedValues, type FieldDef, type FormValues, fromFormValues, isShown, toFormValues } from '@/lib/form-values'
import { type Candidate, DOCUMENT_TYPE, EMPLOYMENT_TYPE, EMPLOYMENT_TYPES_FOR, FIXED_PERIOD, fullName, JOINING_TYPE, type Option, SALUTATION, STATUS_TONE, statusLabel, toOptions, WORKFORCE } from './labels'
import { SalaryBreakupFields } from '@/components/SalaryBreakupFields'
import { SalaryStructurePicker, SalaryStructureStatus } from '@/components/SalaryStructurePicker'

type CreateInput = Parameters<typeof client.candidates.create>[0]
type UpdateInput = Parameters<typeof client.candidates.update>[0]

// About the person - editable in every open status
const PERSON = ['salutation', 'firstName', 'middleName', 'lastName', 'mobile', 'personalEmail', 'address']
// Still changeable once the offer is accepted
const CHANGEABLE_WHEN_ACCEPTED = ['proposedJoiningDate', 'extraRequiredDocuments']
const ID_FIELDS = ['companyId', 'plantId', 'workLocationId', 'departmentId', 'designationId', 'gradeId']

// The form in sections; every field is printed on the offer letter or decides which letter / joining pack is used
// (`short` names the step in the bar on top; the section's element id is `offer-<id>`)
const SECTIONS: { id: string; title: string; short: string; icon: LucideIcon; hint?: string; fields: FieldDef[] }[] = [
  {
    id: 'candidate',
    title: 'Candidate',
    short: 'Candidate',
    icon: UserRound,
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
    id: 'position',
    title: 'Position',
    short: 'Position',
    icon: BriefcaseBusiness,
    hint: 'Where the person joins and on what terms - it decides the letter and the joining pack.',
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
    id: 'dates',
    title: 'Dates, probation and notice',
    short: 'Dates',
    icon: CalendarRange,
    hint: 'When the person joins, and the probation and notice periods printed on the letter.',
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
    id: 'pay',
    title: 'Pay',
    short: 'Pay',
    icon: Wallet,
    hint: 'Annual CTC is the fixed CTC; performance pay comes on top (Total CTC on the letter).',
    fields: [
      { name: 'annualCtc', label: 'Annual CTC (fixed)', type: 'number', required: true, placeholder: 'e.g. 840000' },
      { name: 'performancePayAnnual', label: 'Performance pay per year', type: 'number', placeholder: 'optional' },
      { name: 'ctcCurrency', label: 'CTC currency', placeholder: 'INR' },
    ],
  },
  {
    id: 'documents',
    title: 'Documents needed',
    short: 'Documents',
    icon: FileCheck2,
    hint: 'The documents under "Always needed" are required for this joining type. Tick any others this offer needs - the candidate uploads them before signing the joining form, and HR verifies them before joining. Can change until joining.',
    fields: [{ name: 'extraRequiredDocuments', label: 'Also needed for this offer', type: 'checks', wide: true }],
  },
  {
    id: 'after',
    title: 'After acceptance',
    short: 'After acceptance',
    icon: Send,
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

  // The breakup worked out from the CTC by a salary structure (2026-11-24): a new offer fills in at once; an offer with a
  // saved breakup keeps it until HR recalculates or picks a structure
  const structure = useStructureBreakup({
    annualCtc: Number(values.annualCtc) || 0,
    joiningType: values.joiningType as Candidate['joiningType'] | '',
    employmentType: values.employmentType as Candidate['employmentType'] | '',
    workforceCategory: values.workforceCategory as Candidate['workforceCategory'] | '',
    start: initialBreakup,
    startFollowing: !candidate?.salaryLines.length,
    disabled: accepted,
  })
  const breakup = structure.breakup

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

  // Editing: what changed in each section (Pay counts the breakup too), and the sections an accepted offer locks
  const changedFields = fields.filter((f) => (values[f.name] ?? '') !== (initial[f.name] ?? '')).map((f) => f.name)
  const changedCount: Record<string, number> = Object.fromEntries(
    SECTIONS.map((s) => [s.id, s.fields.filter((f) => changedFields.includes(f.name)).length + (s.id === 'pay' && breakupChanged ? 1 : 0)]),
  )
  const totalChanges = Object.values(changedCount).reduce((a, b) => a + b, 0)
  const locked = (id: string) => SECTIONS.find((s) => s.id === id)!.fields.every((f) => prepare(f).disabled)
  // a sent letter goes back to Draft when an offer term changes (the backend decides; this only warns)
  const termsChanged = candidate?.status === 'OFFERED' && (breakupChanged || changedFields.some((name) => !PERSON.includes(name)))

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

  // required fields still empty, per section - the step bar, the section badges and the footer show them
  const missing: Record<string, number> = Object.fromEntries(
    SECTIONS.map((s) => [s.id, s.fields.map(prepare).filter((f) => f.required && isShown(f, values) && !(values[f.name] ?? '').trim()).length]),
  )
  const hasRequired = (id: string) => SECTIONS.find((s) => s.id === id)!.fields.some((f) => f.required)
  const totalMissing = Object.values(missing).reduce((a, b) => a + b, 0)

  // The step bar follows the scrolling: the section crossing a line 20% down the panel, or the last one at the very end
  // (a short last section never reaches the line). A clicked step stays marked while the panel scrolls to it - near the
  // end the panel cannot bring it to the top.
  const [active, setActive] = useState(SECTIONS[0]!.id)
  const clicked = useRef<{ id: string; timer?: ReturnType<typeof setTimeout> } | null>(null)
  const follow = useCallback((nav: HTMLElement | null) => {
    const scroller = nav?.parentElement
    if (!nav || !scroller) return
    const update = () => {
      if (clicked.current) {
        // still scrolling to the clicked step: wait until the scrolling stops
        clearTimeout(clicked.current.timer)
        clicked.current.timer = setTimeout(() => (clicked.current = null), 150)
        return
      }
      if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4) return setActive(SECTIONS.at(-1)!.id)
      const line = scroller.getBoundingClientRect().top + nav.offsetHeight + scroller.clientHeight * 0.2
      let current = SECTIONS[0]!.id
      for (const s of SECTIONS) if ((document.getElementById(`offer-${s.id}`)?.getBoundingClientRect().top ?? Infinity) <= line) current = s.id
      setActive(current)
    }
    scroller.addEventListener('scroll', update, { passive: true })
    return () => scroller.removeEventListener('scroll', update)
  }, [])
  const goTo = (id: string) => {
    clicked.current = { id }
    setActive(id)
    document.getElementById(`offer-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const currency = values.ctcCurrency || 'INR'
  const ctc = Number(values.annualCtc) || 0
  const performancePay = Number(values.performancePayAnnual) || 0
  const money = (n: number) => formatMoney(n, currency)

  return (
    <FormDrawer
      onClose={onDone}
      dirty={dirty}
      width={800}
      bodyClassName="border-t bg-surface-2/50"
      title={
        candidate ? (
          <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            Edit offer
            <span className="text-muted-foreground">· {fullName(candidate)}</span>
            <Pill tone={STATUS_TONE[candidate.status]} className="tracking-normal">
              {statusLabel(candidate)}
            </Pill>
          </span>
        ) : (
          'New offer'
        )
      }
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
          <p
            role="status"
            className={cn('mr-auto flex items-center gap-1.5 text-xs font-medium', totalMissing || (candidate && !totalChanges) ? 'text-muted-foreground' : 'text-positive-ink')}
          >
            {totalMissing ? (
              <>
                <span className="grid size-5 place-items-center rounded-full bg-gold-soft text-xs text-foreground tabular-nums">{totalMissing}</span>
                required {totalMissing === 1 ? 'field' : 'fields'} left
              </>
            ) : candidate ? (
              totalChanges ? (
                <>
                  <span className="grid size-5 place-items-center rounded-full bg-gold text-xs text-gold-foreground tabular-nums">{totalChanges}</span>
                  <span className="text-foreground">unsaved {totalChanges === 1 ? 'change' : 'changes'}</span>
                </>
              ) : (
                'No changes yet'
              )
            ) : (
              <>
                <Check className="size-4" /> Ready to save
              </>
            )}
          </p>
          <DrawerCancel />
          <Button variant="gold" disabled={pending || (!!candidate && !dirty)} onClick={submit}>
            {pending ? 'Saving…' : candidate ? 'Save changes' : 'Create draft offer'}
          </Button>
        </>
      }
    >
      {/* the steps: jump to a section; a tick once its required fields are filled */}
      <nav ref={follow} aria-label="Offer sections" className="sticky top-0 z-10 -mx-6 bg-card">
        <div className="flex gap-1 overflow-x-auto border-b border-border/60 bg-surface-2/50 px-6 py-2 [scrollbar-width:none]">
          {SECTIONS.map((s, index) => {
            const current = active === s.id
            const complete = hasRequired(s.id) && missing[s.id] === 0
            // editing: a pencil on a changed section, a lock on one the accepted offer locks
            const edited = !!candidate && !!changedCount[s.id]
            const isLocked = locked(s.id)
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => goTo(s.id)}
                aria-current={current ? 'step' : undefined}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-full py-1 pr-3 pl-1 text-xs font-medium transition-colors',
                  current ? 'bg-hero text-hero-foreground' : 'text-muted-foreground hover:bg-card hover:text-foreground',
                )}
              >
                <span
                  className={cn(
                    'grid size-5 place-items-center rounded-full text-xs tabular-nums',
                    isLocked
                      ? 'bg-surface-2 text-muted-foreground ring-1 ring-border'
                      : edited || (current && !complete)
                        ? 'bg-gold text-gold-foreground'
                        : complete
                          ? 'bg-positive text-white'
                          : 'bg-card ring-1 ring-border',
                  )}
                >
                  {isLocked ? <Lock className="size-3" /> : edited ? <PenLine className="size-3" /> : complete ? <Check className="size-3" /> : index + 1}
                </span>
                {s.short}
              </button>
            )
          })}
        </div>
      </nav>
      {termsChanged && (
        <p role="status" className="flex items-start gap-2 rounded-xl bg-gold-soft px-3 py-2 text-xs font-medium">
          <TriangleAlert className="mt-px size-4 shrink-0" />
          An offer term changed: saving moves this offer back to Draft - send it again as a revised letter.
        </p>
      )}
      {SECTIONS.map((section) => (
        <section
          key={section.id}
          id={`offer-${section.id}`}
          className="scroll-mt-14 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-card"
        >
          <header className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-gold-soft">
              <section.icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold tracking-tight">{section.title}</h3>
              {section.hint && <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{section.hint}</p>}
            </div>
            {locked(section.id) ? (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                <Lock className="size-3.5" /> Locked
              </span>
            ) : missing[section.id] ? (
              <span className="shrink-0 rounded-full bg-gold-soft px-2 py-0.5 text-xs font-medium tabular-nums">{missing[section.id]} required left</span>
            ) : candidate ? (
              !!changedCount[section.id] && (
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-gold px-2 py-0.5 text-xs font-medium text-gold-foreground tabular-nums">
                  <PenLine className="size-3.5" /> {changedCount[section.id]} changed
                </span>
              )
            ) : (
              hasRequired(section.id) && (
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-positive/10 px-2 py-0.5 text-xs font-medium text-positive-ink">
                  <Check className="size-3.5" /> Complete
                </span>
              )
            )}
          </header>
          <div className="space-y-3 p-4">
            {section.id === 'documents' && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Always needed</p>
                {joiningType ? (
                  <div className="flex flex-wrap gap-1.5">
                    {(docRules.data?.compulsory[joiningType] ?? []).map((type) => (
                      <span key={type} className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs">
                        <Check className="size-3.5 text-positive-ink" />
                        {DOCUMENT_TYPE[type]}
                        {type === 'ESIC_FORM_1' && ' (when ESIC applies)'}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Choose the joining type to see the documents it always needs.</p>
                )}
              </div>
            )}
            <FieldsGrid fields={section.fields.map(prepare)} values={values} onChange={set} />
            {section.id === 'pay' && ctc > 0 && (
              // what the letter will say: the fixed CTC, performance pay on top, and the Total CTC
              <dl className="grid grid-cols-3 overflow-hidden rounded-xl bg-hero text-hero-foreground">
                {[
                  { label: 'Fixed CTC', value: money(ctc), note: `${money(monthlyOf(ctc))} a month` },
                  { label: 'Performance pay', value: performancePay ? money(performancePay) : '—', note: 'a year, on top' },
                  { label: 'Total CTC', value: money(sumMoney([ctc, performancePay])), note: 'printed on the letter' },
                ].map((item, index) => (
                  <div key={item.label} className={cn('min-w-0 px-3 py-2.5 sm:px-4', index > 0 && 'border-l border-hero-foreground/10')}>
                    <dt className="text-xs text-hero-muted">{item.label}</dt>
                    <dd className={cn('truncate text-sm font-semibold tabular-nums sm:text-base', index === 2 && 'text-gold')}>{item.value}</dd>
                    <dd className="truncate text-xs text-hero-muted">{item.note}</dd>
                  </div>
                ))}
              </dl>
            )}
            {section.id === 'pay' && (
              <div className="space-y-2 border-t border-dashed pt-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    Salary breakup <span className="text-xs font-normal text-muted-foreground">· Annexure-I of the letter, monthly amounts</span>
                  </p>
                  {!accepted && <SalaryStructurePicker s={structure} />}
                </div>
                {!accepted && <SalaryStructureStatus s={structure} needs="Type the annual CTC and choose the joining type, employment type and workforce" />}
                <SalaryBreakupFields
                  components={components}
                  values={breakup}
                  onChange={structure.change}
                  hideEmpty={!!structure.result?.structure}
                  annualCtc={Number(values.annualCtc) || 0}
                  currency={values.ctcCurrency || 'INR'}
                  onUseTotal={(annual) => set('annualCtc', String(annual))}
                  disabled={accepted}
                />
              </div>
            )}
          </div>
        </section>
      ))}
      <FormError error={create.error ?? update.error} />
    </FormDrawer>
  )
}
