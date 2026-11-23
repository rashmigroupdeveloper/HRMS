import { ORPCError } from '@orpc/client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Eye,
  FileText,
  FolderOpen,
  GraduationCap,
  HeartPulse,
  IdCard,
  LogOut,
  type LucideIcon,
  MapPin,
  PenLine,
  ShieldCheck,
  Trash2,
  Undo2,
  Upload,
  UserRound,
  Users,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { type JoiningFormSection, JoiningFormSections } from '@/components/JoiningFormSections'
import { Pill, type Tone } from '@/components/Pill'
import { JoiningFormSignInSkeleton } from '@/components/skeletons/offer-response/JoiningFormSignInSkeleton'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { client, orpc } from '@/lib/orpc'
import { cn, formatDate, formatDateTime, isUnauthorized } from '@/lib/utils'
import { CandidateCard as Card } from './CandidatePageFrame'
import { CandidateError } from './CandidateError'
import { candidateMessage } from './candidate-message'

// The candidate's joining form, on its own page (JoiningFormPage) after they accepted the offer. They sign in with a
// one-time code sent to their e-mail (a session of its own - not an employee login), fill the form step by step (each
// section saves on its own), upload their documents and finally sign it online. HR sees the same form and verifies
// the documents. Layout: a welcome header with the overall progress, the steps (a list on the left on a computer,
// a row that scrolls sideways on a phone) and the current step.

type Portal = Awaited<ReturnType<typeof client.candidates.portal.me>>
type SaveInput = Parameters<typeof client.candidates.portal.save>[0]

type Step = {
  key: string
  title: string
  icon: LucideIcon
  // one line under the step's title
  help: string
  sections?: JoiningFormSection[]
  // the portal checks (required parts) this step fills; no checks = an optional step
  checks?: string[]
  only?: Portal['candidate']['joiningType'][]
}
const STEPS: Step[] = [
  { key: 'about', title: 'About you', icon: UserRound, help: 'Your basic details, as they are on your documents.', sections: ['personal'], checks: ['personal'] },
  {
    key: 'contact',
    title: 'Addresses & contacts',
    icon: MapPin,
    help: 'Where you live, and who we should call in an emergency.',
    sections: ['addresses', 'emergencyContacts'],
    checks: ['addresses', 'emergency'],
  },
  { key: 'id', title: 'ID & bank', icon: IdCard, help: 'Your Aadhaar and PAN, and the bank account your salary is paid into.', sections: ['identityDocuments', 'bankAccount'], checks: ['identity', 'bank'] },
  { key: 'pf', title: 'PF & ESIC', icon: ShieldCheck, help: 'Answers for your EPF (Form 11) and ESIC (Form 1).', sections: ['statutory'], checks: ['statutory'], only: ['REGULAR'] },
  {
    key: 'background',
    title: 'Education & work',
    icon: GraduationCap,
    help: 'Your education (at least one is needed), and any courses and earlier jobs (only if you have them).',
    sections: ['qualifications', 'certifications', 'previousJobs'],
    checks: ['education'],
  },
  {
    key: 'family',
    title: 'Family & nominees',
    icon: Users,
    help: 'Your family, and the people who get your money if something happens to you.',
    sections: ['familyMembers', 'nominees', 'gratuity'],
    checks: ['family', 'nominees', 'gratuity'],
  },
  {
    key: 'health',
    title: 'Health',
    icon: HeartPulse,
    help: 'Your medical information, as on the paper form. Only HR with medical access sees it.',
    sections: ['medical'],
    checks: ['medicalInfo'],
    only: ['REGULAR', 'CONSULTANT_INTERN'],
  },
  { key: 'documents', title: 'Documents', icon: FolderOpen, help: 'A clear photo or scan of each document.', checks: ['documents'] },
  { key: 'sign', title: 'Review & sign', icon: PenLine, help: 'Check that everything is there, then sign the form online.', checks: ['sign'] },
]

const VERIFICATION: Record<Portal['documents'][number]['verificationStatus'], { label: string; tone: Tone }> = {
  PENDING: { label: 'Waiting for HR', tone: 'warning' },
  VERIFIED: { label: 'Verified', tone: 'positive' },
  REJECTED: { label: 'Rejected', tone: 'negative' },
}

const sentenceCase = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

// Which section each required part of the form (portal.checks) is about
const CHECK_SECTION: Record<string, JoiningFormSection> = {
  personal: 'personal',
  addresses: 'addresses',
  emergency: 'emergencyContacts',
  education: 'qualifications',
  family: 'familyMembers',
  nominees: 'nominees',
  gratuity: 'gratuity',
  identity: 'identityDocuments',
  bank: 'bankAccount',
  statutory: 'statutory',
  medicalInfo: 'medical',
}

export function JoiningFormPortal({ token, codeEmail }: { token: string; codeEmail: string | null }) {
  const me = useQuery({ ...orpc.candidates.portal.me.queryOptions(), retry: false })
  if (me.isPending) return <JoiningFormSignInSkeleton label="Loading your joining form" />
  if (me.error) {
    return isUnauthorized(me.error) ? <SignIn token={token} codeEmail={codeEmail} /> : <Card><CandidateError error={me.error} /></Card>
  }
  return <Form portal={me.data} token={token} />
}

// The 6-digit code field with "Send code" (the code is e-mailed by offerResponse.sendCode)
function CodeField({ token, code, onCode }: { token: string; code: string; onCode: (code: string) => void }) {
  const [sentTo, setSentTo] = useState<string | null>(null)
  const sendCode = useMutation(orpc.candidates.offerResponse.sendCode.mutationOptions({ onSuccess: (r) => setSentTo(r.sentTo) }))
  return (
    <div className="space-y-1.5">
      <Label htmlFor="portal-code" className="text-xs text-muted-foreground">
        One-time code
      </Label>
      <div className="flex gap-2">
        <Input
          id="portal-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="6 digits"
          className="h-11 rounded-xl text-center font-mono text-lg tracking-[0.3em]"
          value={code}
          onChange={(e) => onCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        />
        <Button variant="secondary" className="h-11" disabled={sendCode.isPending} onClick={() => sendCode.mutate({ token })}>
          {sendCode.isPending ? 'Sending…' : sentTo ? 'Send again' : 'Send code'}
        </Button>
      </div>
      {sentTo && <p className="text-xs text-positive-ink">Code sent to {sentTo}. It is valid for 10 minutes.</p>}
      <CandidateError error={sendCode.error} />
    </div>
  )
}

function SignIn({ token, codeEmail }: { token: string; codeEmail: string | null }) {
  const queryClient = useQueryClient()
  const [code, setCode] = useState('')
  const signIn = useMutation(
    orpc.candidates.portal.signIn.mutationOptions({ onSuccess: (portal) => queryClient.setQueryData(orpc.candidates.portal.me.queryKey(), portal) }),
  )
  if (!codeEmail) {
    return (
      <Card>
        <h2 className="text-xl font-light tracking-tight">Your joining form</h2>
        <p className="mt-2 text-sm text-muted-foreground">We do not have your e-mail address, so the form cannot be opened online. HR will fill it in with you.</p>
      </Card>
    )
  }
  return (
    <Card>
      <h1 className="text-2xl font-light tracking-tight">Your joining form</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Fill in your details and upload your documents before you join. To open the form we e-mail a one-time code to {codeEmail}.
      </p>
      <div className="mt-5 space-y-4">
        <CodeField token={token} code={code} onCode={setCode} />
        <CandidateError error={signIn.error} />
        <Button variant="gold" size="lg" className="w-full" disabled={!/^\d{6}$/.test(code) || signIn.isPending} onClick={() => signIn.mutate({ token, code })}>
          {signIn.isPending ? 'Opening…' : 'Open my joining form'}
        </Button>
      </div>
    </Card>
  )
}

function Form({ portal, token }: { portal: Portal; token: string }) {
  const queryClient = useQueryClient()
  const steps = STEPS.filter((s) => !s.only || s.only.includes(portal.candidate.joiningType))
  const [stepIndex, setStepIndex] = useState(0)
  const step = steps[stepIndex]!
  // a new step starts at the top of the page (on a phone the content is far below)
  const top = useRef<HTMLDivElement>(null)
  const go = (index: number) => {
    setStepIndex(index)
    top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  // on a phone the steps are a row that scrolls sideways: keep the current one in view
  const stepList = useRef<HTMLOListElement>(null)
  useEffect(() => {
    const list = stepList.current
    const current = list?.querySelector<HTMLElement>('[aria-current=step]')?.parentElement
    if (list && current && list.scrollWidth > list.clientWidth) {
      list.scrollTo({ left: current.offsetLeft - (list.clientWidth - current.offsetWidth) / 2, behavior: 'smooth' })
    }
  }, [stepIndex])
  const locked = !!portal.submission.submittedAt
  const setPortal = (next: Portal) => queryClient.setQueryData(orpc.candidates.portal.me.queryKey(), next)
  const signOut = useMutation(orpc.candidates.portal.signOut.mutationOptions({ onSuccess: () => queryClient.resetQueries({ queryKey: orpc.candidates.portal.me.queryKey() }) }))

  const missingDocuments = portal.documentTypes.filter((t) => t.required && !portal.documents.some((d) => d.type === t.type && d.verificationStatus !== 'REJECTED'))
  const ok = (key: string) => (key === 'documents' ? missingDocuments.length === 0 : key === 'sign' ? locked : (portal.checks.find((c) => c.key === key)?.ok ?? true))
  // true = done, false = still to do, null = optional
  const stepDone = (s: Step) => (s.checks ? s.checks.every(ok) : null)
  const required = steps.filter((s) => s.checks)
  const doneCount = required.filter((s) => stepDone(s)).length
  // the step that fills a check (for "Go to step" on the last step)
  const stepOf = (checkKey: string) => steps.findIndex((s) => s.checks?.includes(checkKey))
  const c = portal.candidate

  return (
    <div ref={top} className="scroll-mt-4 space-y-5">
      {/* Welcome header: who, what for, how far */}
      <section className="u-grain relative overflow-hidden rounded-3xl bg-hero px-6 py-6 text-hero-foreground shadow-float sm:px-8">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-[0.12em] text-gold uppercase">Joining form</p>
            <h1 className="mt-1 text-3xl font-light tracking-tight">Welcome, {c.name.split(' ')[0]}</h1>
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-hero-muted">
              <span className="flex items-center gap-1.5">
                <BriefcaseBusiness className="size-4" /> {c.designation}
              </span>
              <span className="flex items-center gap-1.5">
                <Building2 className="size-4" /> {c.company}
                {c.workLocation && `, ${c.workLocation}`}
              </span>
              <span className="flex items-center gap-1.5">
                <CalendarDays className="size-4" /> Joining {formatDate(c.joiningDate)}
              </span>
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 text-hero-muted hover:bg-hero-foreground/10 hover:text-hero-foreground"
            disabled={signOut.isPending}
            onClick={() => signOut.mutate({})}
          >
            <LogOut /> <span className="max-sm:sr-only">Sign out</span>
          </Button>
        </div>

        <div className="mt-5 space-y-2">
          <div className="flex items-baseline justify-between text-xs text-hero-muted">
            <span>{locked ? 'Signed and submitted' : 'Each part saves on its own - you can stop and come back with the link in your e-mail.'}</span>
            <span className="shrink-0 pl-3 tabular-nums">
              <span className="text-sm font-semibold text-hero-foreground">{doneCount}</span> / {required.length} done
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-hero-foreground/10">
            <div className={cn('h-full rounded-full transition-all', locked ? 'bg-positive' : 'bg-gold')} style={{ width: `${(doneCount / required.length) * 100}%` }} />
          </div>
        </div>

        {locked ? (
          <p className="mt-4 flex items-start gap-2.5 rounded-2xl bg-positive/20 px-4 py-3 text-sm">
            <CircleCheck className="mt-0.5 size-4 shrink-0 text-positive" />
            <span>
              You signed your joining form on {formatDateTime(portal.submission.submittedAt)}. HR is checking it and will send it back if something must change. You can
              still upload documents HR asks for.
            </span>
          </p>
        ) : (
          portal.submission.returnedAt && (
            <p className="mt-4 flex items-start gap-2.5 rounded-2xl bg-gold/15 px-4 py-3 text-sm">
              <Undo2 className="mt-0.5 size-4 shrink-0 text-gold" />
              <span>
                HR sent your form back on {formatDateTime(portal.submission.returnedAt)}: <span className="italic">"{portal.submission.returnReason}"</span> Please make
                the changes and sign it again.
              </span>
            </p>
          )
        )}
      </section>

      <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start lg:gap-6">
        {/* The steps: a list on the left on a computer, a row that scrolls sideways on a phone */}
        <nav aria-label="Steps" className="lg:sticky lg:top-6">
          <ol ref={stepList} className="relative -mx-4 flex gap-2 overflow-x-auto px-4 pb-3 lg:mx-0 lg:block lg:space-y-0.5 lg:overflow-visible lg:rounded-3xl lg:bg-card lg:p-3 lg:shadow-card [&::-webkit-scrollbar]:hidden">
            {steps.map((s, i) => {
              const done = stepDone(s)
              const current = i === stepIndex
              return (
                <li key={s.key} className="shrink-0">
                  <button
                    type="button"
                    aria-current={current ? 'step' : undefined}
                    onClick={() => go(i)}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-full py-1.5 pr-3.5 pl-1.5 text-left text-sm transition-colors lg:rounded-2xl lg:py-2 lg:pr-2',
                      current ? 'bg-hero text-hero-foreground lg:bg-surface-2 lg:text-foreground' : 'bg-card text-foreground/75 shadow-card hover:text-foreground lg:bg-transparent lg:shadow-none lg:hover:bg-surface-2/60',
                    )}
                  >
                    <span
                      className={cn(
                        'grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold tabular-nums',
                        done ? 'bg-positive text-white' : current ? 'bg-gold text-gold-foreground' : 'bg-surface-2 text-muted-foreground',
                      )}
                    >
                      {done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
                    </span>
                    <span className="min-w-0 lg:flex-1">
                      <span className={cn('block whitespace-nowrap lg:truncate', current && 'font-medium')}>{s.title}</span>
                      {done === null && <span className="hidden text-xs text-muted-foreground lg:block">Optional</span>}
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </nav>

        <div className="min-w-0 space-y-4">
          <div className="flex items-center gap-3 px-1 pt-1">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-hero text-gold">
              <step.icon className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                Step {stepIndex + 1} of {steps.length}
                {stepDone(step) === null && ' · optional'}
              </p>
              <h2 className="text-xl font-medium tracking-tight">{step.title}</h2>
              <p className="text-sm text-muted-foreground">{step.help}</p>
            </div>
          </div>

          {step.sections && <SectionsStep key={step.key} portal={portal} sections={step.sections} locked={locked} onSaved={setPortal} />}
          {step.key === 'documents' && <DocumentsStep portal={portal} onChange={setPortal} />}
          {step.key === 'sign' && (
            <SignStep portal={portal} token={token} missingDocuments={missingDocuments.map((t) => t.label)} goTo={(key) => go(stepOf(key))} onSigned={setPortal} />
          )}

          <div className="flex items-center justify-between gap-2 pt-1">
            <Button variant="ghost" disabled={stepIndex === 0} onClick={() => go(stepIndex - 1)}>
              <ChevronLeft /> Back
            </Button>
            {stepIndex < steps.length - 1 && (
              <Button variant="gold" onClick={() => go(stepIndex + 1)}>
                <span className="max-sm:hidden">Next:</span> {steps[stepIndex + 1]!.title} <ChevronRight />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function SectionsStep({ portal, sections, locked, onSaved }: { portal: Portal; sections: JoiningFormSection[]; locked: boolean; onSaved: (p: Portal) => void }) {
  const [active, setActive] = useState<{ section: JoiningFormSection; saved: boolean } | null>(null)
  const save = useMutation(
    orpc.candidates.portal.save.mutationOptions({
      onSuccess: (next) => {
        onSaved(next)
        setActive((a) => a && { ...a, saved: true })
      },
    }),
  )
  return (
    <JoiningFormSections
      form={portal.form as Record<string, unknown>}
      sections={sections}
      masked
      fromOffer={portal.candidate.fromOffer}
      pack={portal.candidate.joiningType}
      required={(section) => {
        // the form's required parts (portal.checks) - shown on each card as complete or missing, as HR sees them
        const check = portal.checks.find((c) => CHECK_SECTION[c.key] === section)
        return check && { ok: check.ok, detail: check.detail }
      }}
      disabled={locked}
      note={(section) => {
        const change = (portal.changes as Partial<Record<JoiningFormSection, { at: Date; byHr: boolean }>>)[section]
        return change ? `Saved ${formatDateTime(change.at)}${change.byHr ? ' by HR' : ''}.` : undefined
      }}
      state={(section) => ({
        pending: save.isPending && active?.section === section,
        // the candidate sees only messages written for them
        error: active?.section === section && save.error ? new ORPCError('BAD_REQUEST', { message: candidateMessage(save.error) }) : null,
        saved: !save.isPending && !save.error && active?.section === section && active.saved,
      })}
      onSave={(section, value, done) => {
        setActive({ section, saved: false })
        // a successful save closes the section back to its summary
        save.mutate({ loadedAt: portal.loadedAt, [section]: value } as SaveInput, { onSuccess: done })
      }}
    />
  )
}

function DocumentsStep({ portal, onChange }: { portal: Portal; onChange: (p: Portal) => void }) {
  const upload = useMutation(orpc.candidates.portal.uploadDocument.mutationOptions({ onSuccess: onChange }))
  const remove = useMutation(orpc.candidates.portal.removeDocument.mutationOptions({ onSuccess: onChange }))
  const [viewError, setViewError] = useState<unknown>(null)
  async function view(id: number) {
    setViewError(null)
    try {
      const file = await client.candidates.portal.document({ id })
      window.open(URL.createObjectURL(file), '_blank', 'noopener')
    } catch (error) {
      setViewError(error)
    }
  }

  const groups = [
    { title: 'Needed before you sign', types: portal.documentTypes.filter((t) => t.required) },
    { title: 'If you have them', types: portal.documentTypes.filter((t) => !t.required) },
  ].filter((g) => g.types.length)

  return (
    <div className="space-y-4">
      <p className="flex items-start gap-2.5 rounded-2xl bg-card px-4 py-3 text-xs text-muted-foreground shadow-card">
        <FileText className="mt-px size-4 shrink-0" />
        PDF, JPG or PNG, up to 5 MB each. Several files of one kind are fine (e.g. Aadhaar front and back). HR checks every document against the original on your
        joining day.
      </p>
      <CandidateError error={upload.error ?? remove.error ?? viewError} />
      {groups.map((group) => (
        <section key={group.title} className="overflow-hidden rounded-3xl bg-card shadow-card">
          <h3 className="border-b border-border/70 bg-surface-2/40 px-5 py-3 text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase sm:px-6">
            {group.title}
          </h3>
          <ul className="divide-y divide-border/70">
            {group.types.map((t) => {
              const files = portal.documents.filter((d) => d.type === t.type)
              const has = files.some((d) => d.verificationStatus !== 'REJECTED')
              const inputId = `upload-${t.type}`
              const uploading = upload.isPending && upload.variables?.type === t.type
              return (
                <li key={t.type} className="space-y-3 px-5 py-4 sm:px-6">
                  <div className="flex items-center gap-3.5">
                    <span
                      className={cn(
                        'grid size-10 shrink-0 place-items-center rounded-2xl',
                        has ? 'bg-positive/15 text-positive-ink' : t.required ? 'bg-warning/15 text-warning-ink' : 'bg-surface-2 text-muted-foreground',
                      )}
                    >
                      {has ? <CircleCheck className="size-5" /> : <FileText className="size-5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{t.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {files.length ? `${files.length} ${files.length === 1 ? 'file' : 'files'} uploaded` : t.required ? 'Not uploaded yet' : 'Optional'}
                      </p>
                    </div>
                    <input
                      id={inputId}
                      type="file"
                      accept="application/pdf,image/jpeg,image/png"
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        e.target.value = ''
                        if (file) upload.mutate({ type: t.type, file })
                      }}
                    />
                    <Button
                      variant={!has && t.required ? 'gold' : 'secondary'}
                      size="sm"
                      className="shrink-0"
                      disabled={upload.isPending}
                      render={<label htmlFor={inputId} />}
                      nativeButton={false}
                    >
                      <Upload /> {uploading ? 'Uploading…' : files.length ? 'Add' : 'Upload'}
                    </Button>
                  </div>
                  {files.length > 0 && (
                    <ul className="space-y-2 sm:pl-[3.375rem]">
                      {files.map((d) => (
                        <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-border/70 bg-surface-2/40 px-3 py-2 text-sm">
                          <FileText className="size-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate">{d.fileName}</p>
                            {d.verificationStatus === 'REJECTED' && <p className="text-xs text-negative-ink">Rejected: {d.rejectionReason} - please upload it again.</p>}
                          </div>
                          <div className="flex items-center gap-1">
                            <Pill tone={VERIFICATION[d.verificationStatus].tone} className="px-2 py-0.5 text-xs">
                              {VERIFICATION[d.verificationStatus].label}
                            </Pill>
                            <Button variant="ghost" size="icon-sm" title="View" aria-label={`View ${d.fileName}`} onClick={() => void view(d.id)}>
                              <Eye />
                            </Button>
                            {d.uploadedByYou && d.verificationStatus === 'PENDING' && (
                              <Button variant="ghost" size="icon-sm" title="Remove" aria-label={`Remove ${d.fileName}`} className="hover:text-negative-ink" disabled={remove.isPending} onClick={() => remove.mutate({ id: d.id })}>
                                <Trash2 />
                              </Button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ))}
      <p className="px-1 text-xs text-muted-foreground">
        HR gives you the statutory forms (EPF, ESIC, gratuity) and the printed joining form to sign on paper on your joining day.
      </p>
    </div>
  )
}

function SignStep({
  portal,
  token,
  missingDocuments,
  goTo,
  onSigned,
}: {
  portal: Portal
  token: string
  missingDocuments: string[]
  // opens the step that fills a check
  goTo: (checkKey: string) => void
  onSigned: (p: Portal) => void
}) {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [agreed, setAgreed] = useState(false)
  const submit = useMutation(orpc.candidates.portal.submit.mutationOptions({ onSuccess: onSigned }))

  if (portal.submission.submittedAt) {
    return (
      <Card className="text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-positive/15 text-positive-ink">
          <CircleCheck className="size-7" />
        </span>
        <h3 className="mt-4 text-2xl font-light tracking-tight">Your joining form is signed</h3>
        <p className="mt-3 font-serif text-3xl italic">{portal.submission.signedName}</p>
        <p className="mt-1 text-xs text-muted-foreground">Signed online on {formatDateTime(portal.submission.submittedAt)}</p>
        <p className="mx-auto mt-4 max-w-md text-sm text-muted-foreground">
          Thank you. HR will contact you if anything is missing. See you on {formatDate(portal.candidate.joiningDate)}!
        </p>
      </Card>
    )
  }

  const items = [
    ...portal.checks.map((c) => ({ key: c.key, label: sentenceCase(c.label), detail: c.detail, ok: c.ok })),
    {
      key: 'documents',
      label: 'Documents',
      detail: missingDocuments.length ? `Upload: ${missingDocuments.join(', ')}` : null,
      ok: missingDocuments.length === 0,
    },
  ]
  const missing = items.filter((i) => !i.ok).length

  return (
    <div className="space-y-4">
      {/* what is still missing - each with a way to get there */}
      <section className="overflow-hidden rounded-3xl bg-card shadow-card">
        <div className="flex items-center justify-between gap-3 border-b border-border/70 px-5 py-4 sm:px-6">
          <h3 className="text-base font-medium tracking-tight">Before you sign</h3>
          {missing ? (
            <Pill tone="warning">{missing} still to do</Pill>
          ) : (
            <Pill tone="positive">All done</Pill>
          )}
        </div>
        <ul className="grid divide-y divide-border/70 sm:grid-cols-2 sm:divide-y-0">
          {items.map((item) => (
            <li key={item.key} className="flex items-start gap-3 px-5 py-3 sm:px-6 sm:py-3.5">
              {item.ok ? <CircleCheck className="mt-0.5 size-4.5 shrink-0 text-positive" /> : <CircleAlert className="mt-0.5 size-4.5 shrink-0 text-warning" />}
              <div className="min-w-0 flex-1">
                <p className={cn('text-sm', item.ok ? 'text-foreground/70' : 'font-medium')}>{item.label}</p>
                {!item.ok && (
                  <p className="text-xs text-muted-foreground">
                    {item.detail ?? 'Not filled in yet'} ·{' '}
                    <button type="button" className="font-medium text-foreground underline underline-offset-2 hover:text-gold" onClick={() => goTo(item.key)}>
                      Go to step
                    </button>
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-5 rounded-3xl bg-card p-5 shadow-card sm:p-6">
        <div>
          <h3 className="text-base font-medium tracking-tight">Your declaration</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">After signing, the form can only be changed if HR sends it back to you.</p>
        </div>
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border-l-4 border-gold bg-surface-2/60 p-4 text-sm leading-relaxed">
          <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} className="mt-1" />
          <span>{portal.declaration}</span>
        </label>
        <div className="space-y-1.5">
          <Label htmlFor="sign-name" className="text-xs text-muted-foreground">
            Type your full name as in your form: <span className="font-medium text-foreground">{portal.candidate.signName}</span>
          </Label>
          <Input id="sign-name" className="h-11 rounded-xl" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          {/* how the signature will read */}
          <div className="flex min-h-16 items-end justify-between gap-3 border-b-2 border-dashed border-border px-1 pb-1">
            <span className={cn('font-serif text-3xl italic', !name.trim() && 'text-muted-foreground/40')}>{name.trim() || 'Your signature'}</span>
            <PenLine className="mb-1.5 size-4 shrink-0 text-muted-foreground" />
          </div>
        </div>
        <CodeField token={token} code={code} onCode={setCode} />
        <CandidateError error={submit.error} />
        <Button
          variant="gold"
          size="lg"
          className="w-full"
          disabled={!agreed || !name.trim() || !/^\d{6}$/.test(code) || submit.isPending}
          onClick={() => submit.mutate({ code, name, agreed: true })}
        >
          <PenLine /> {submit.isPending ? 'Signing…' : 'Sign and submit the joining form'}
        </Button>
      </section>
    </div>
  )
}
