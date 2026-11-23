import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Circle, CircleCheck, Link2, Lock, PenLine, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { type JoiningFormSection, JoiningFormReview, joiningSectionTitles, type RequiredPart } from '@/components/JoiningFormSections'
import { Pill, type Tone } from '@/components/Pill'
import { JoiningFormSkeleton } from '@/components/skeletons/onboarding/JoiningFormSkeleton'
import { Button } from '@/components/ui/button'
import { useAccess } from '@/hooks/useAccess'
import { client, orpc } from '@/lib/orpc'
import { cn, errorMessage, formatDateTime, formatDoneBy } from '@/lib/utils'
import { type Candidate, candidatePlace, fullName } from './labels'
import { MovedToEmployee } from './MovedToEmployee'
import { LinkDialog, type LinkResult } from './OfferLetters'
import { ReasonDialog } from './ReasonDialog'

type SaveInput = Parameters<typeof client.candidates.joiningForm.save>[0]
type ChecklistItem = Awaited<ReturnType<typeof client.candidates.joining.checklist>>['items'][number]

// The checklist items about the joining form, and the section each belongs to
const FORM_CHECKS: Record<string, JoiningFormSection | null> = {
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
  signed: null,
}

// The required parts by the names the form's own sections have (one list of names - never a second wording here);
// the signature is the one part that is not a section
const SECTION_TITLE = joiningSectionTitles()
const partLabel = (check: ChecklistItem) => {
  const section = FORM_CHECKS[check.key]
  return (section && SECTION_TITLE[section]) ?? (check.key === 'signed' ? 'Signed online' : check.label.replace('Joining form: ', ''))
}

// "3/7" in a ring that fills as the required parts are done
function ProgressRing({ done, total }: { done: number; total: number }) {
  const r = 20
  const length = 2 * Math.PI * r
  const complete = done === total
  return (
    <div className="relative grid size-12 shrink-0 place-items-center" title={`${done} of ${total} required parts done`}>
      <svg viewBox="0 0 48 48" className="absolute inset-0 -rotate-90">
        <circle cx="24" cy="24" r={r} fill="none" strokeWidth="4" className="stroke-surface-2" />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={length}
          strokeDashoffset={length * (1 - done / total)}
          className={cn('transition-all', complete ? 'stroke-positive' : 'stroke-gold')}
        />
      </svg>
      <span className="text-xs font-semibold tabular-nums">
        {done}/{total}
      </span>
    </div>
  )
}

// HR's view of the joining form: the candidate mainly fills it on their own page (the offer link + a one-time code);
// HR reviews it section by section and can fill or correct any of them. On top: how far it is, the candidate's online
// signature, and sending it back / sending a new link.
export function JoiningFormTab({ candidate }: { candidate: Candidate }) {
  const queryClient = useQueryClient()
  const input = { candidateId: candidate.id }
  const form = useQuery(orpc.candidates.joiningForm.get.queryOptions({ input }))
  const checklist = useQuery({ ...orpc.candidates.joining.checklist.queryOptions({ input }), enabled: candidate.status === 'ACCEPTED' })
  const [active, setActive] = useState<{ section: JoiningFormSection; saved: boolean } | null>(null)
  const save = useMutation(
    orpc.candidates.joiningForm.save.mutationOptions({
      onSuccess: (data) => {
        queryClient.setQueryData(orpc.candidates.joiningForm.get.queryKey({ input }), data)
        // the checklist depends on the form
        void queryClient.invalidateQueries({ queryKey: orpc.candidates.joining.key() })
        setActive((a) => a && { ...a, saved: true })
      },
    }),
  )
  // Changes only before joining, and only with edit access to onboarding
  const { can, covers } = useAccess()
  const canChange = covers('ONBOARDING', 'WRITE', candidatePlace(candidate))
  // the medical information is health data: only with the "Employee · Medical" access
  const canSeeMedical = can('MEDICAL', 'READ')
  const editable = candidate.status === 'ACCEPTED' && canChange

  if (candidate.employee) return <MovedToEmployee what="joining form" employeeCode={candidate.employee.employeeCode} />
  if (form.error) return <p className="text-sm text-negative-ink">{errorMessage(form.error)}</p>

  const formChecks = (checklist.data?.items ?? []).filter((i) => i.key in FORM_CHECKS)
  // the form (undefined while it loads - the sections are then a skeleton)
  const loaded = form.data
  const data = loaded?.form ?? ({} as NonNullable<typeof loaded>['form'])
  const changes = loaded?.changes ?? ({} as NonNullable<typeof loaded>['changes'])
  const required = (section: JoiningFormSection): RequiredPart | undefined => {
    const check = formChecks.find((i) => FORM_CHECKS[i.key] === section)
    return check && { ok: check.ok, detail: check.detail }
  }
  const state = (section: JoiningFormSection) => ({
    pending: save.isPending && active?.section === section,
    error: active?.section === section ? save.error : null,
    saved: !save.isPending && !save.error && active?.section === section && active.saved,
  })
  const offerName = { firstName: candidate.firstName, middleName: candidate.middleName, lastName: candidate.lastName }
  const fromOffer = { ...offerName, mobile: candidate.mobile, personalEmail: candidate.personalEmail }
  const mobileChanged = !!data.personal?.mobile && data.personal.mobile !== candidate.mobile
  // the name in the form, when it is not the offer's (corrected by the candidate or HR)
  const formName = data.personal?.firstName
    ? fullName({ firstName: data.personal.firstName, middleName: data.personal.middleName ?? null, lastName: data.personal.lastName ?? null })
    : null
  const nameChanged = formName !== null && formName.toLowerCase() !== fullName(offerName).toLowerCase()
  const note = (section: JoiningFormSection) => {
    const change = changes[section]
    const lines = [
      section === 'personal' && nameChanged ? `Name changed from the offer's "${fullName(offerName)}" - the employee is created with "${formName}"` : null,
      section === 'personal' && mobileChanged ? `Mobile changed from the offer's ${candidate.mobile} to ${data.personal?.mobile}` : null,
      change ? `Last changed ${formatDoneBy(change.at, change.by)}` : null,
    ]
    return lines.filter(Boolean).join(' · ') || undefined
  }

  return (
    <div className="space-y-4">
      {candidate.status === 'ACCEPTED' && <Overview candidate={candidate} checks={formChecks} canChange={canChange} />}
      {!editable && (
        <p className="flex items-center gap-2 rounded-2xl bg-surface-2 px-4 py-3 text-sm text-muted-foreground">
          <Lock className="size-4 shrink-0" />
          {canChange ? 'The joining form can be changed only while the offer is accepted (before joining). Shown read-only.' : 'View only - you can see the joining form but not change it.'}
        </p>
      )}
      {/* only the sections wait for the form - the overview above comes from the candidate */}
      {!loaded ? (
        <JoiningFormSkeleton pack={candidate.joiningType} medical={canSeeMedical} editable={editable} label="Loading the joining form" />
      ) : (
        <JoiningFormReview
          form={data as Record<string, unknown>}
          fromOffer={fromOffer}
          pack={candidate.joiningType}
          medical={canSeeMedical}
          disabled={!editable}
          required={required}
          note={note}
          state={state}
          onSave={(section, value, done) => {
            setActive({ section, saved: false })
            save.mutate({ candidateId: candidate.id, loadedAt: loaded.loadedAt, [section]: value } as SaveInput, { onSuccess: done })
          }}
        />
      )}
    </div>
  )
}

// Where the form stands: status, progress of the required parts, the online signature, and HR's actions
function Overview({ candidate, checks, canChange }: { candidate: Candidate; checks: ChecklistItem[]; canChange: boolean }) {
  const queryClient = useQueryClient()
  const [sendingBack, setSendingBack] = useState(false)
  const [link, setLink] = useState<LinkResult | null>(null)
  const sendBack = useMutation(
    orpc.candidates.joiningForm.sendBack.mutationOptions({
      onSuccess: (result) => {
        setSendingBack(false)
        setLink(result)
        void queryClient.invalidateQueries({ queryKey: orpc.candidates.key() })
      },
    }),
  )
  const newLink = useMutation(orpc.candidates.offerLetters.newLink.mutationOptions({ onSuccess: (result) => setLink(result) }))
  const submitted = candidate.joiningFormSubmittedAt
  const done = checks.filter((c) => c.ok).length
  // what the ring counts: the sections that must be filled, and the candidate's signature
  const sectionParts = checks.filter((c) => FORM_CHECKS[c.key]).length
  const counted = `${done} of ${checks.length} required parts done${sectionParts < checks.length ? ` (${sectionParts} sections + the signature)` : ''}`

  const headline: { title: string; text: string; tone: Tone; pill: string } = submitted
    ? { title: 'Signed by the candidate', text: 'Review the sections and verify the documents - correct anything here, or send it back.', tone: 'positive', pill: 'Signed online' }
    : candidate.joiningFormReturnedAt
      ? { title: 'Sent back for changes', text: `${formatDoneBy(candidate.joiningFormReturnedAt, candidate.joiningFormReturnedBy)}: "${candidate.joiningFormReturnReason}"`, tone: 'warning', pill: 'Sent back' }
      : candidate.personalEmail && candidate.status === 'ACCEPTED' && !candidate.joiningFormOpenedAt
        ? { title: 'Link not sent yet', text: 'This offer leaves the joining form to HR - "Send link" opens it and e-mails the link to the candidate.', tone: 'warning', pill: 'Not opened' }
        : candidate.personalEmail
        ? { title: 'Waiting for the candidate', text: `They fill it on their own page with the link e-mailed to them, then sign it online.${candidate.joiningFormOpenedAt ? ` Opened ${formatDoneBy(candidate.joiningFormOpenedAt, candidate.joiningFormOpenedBy)}.` : ''}`, tone: 'neutral', pill: 'Not submitted' }
        : { title: 'Filled by HR', text: 'No personal e-mail on this offer - fill the form here and get it signed on paper.', tone: 'neutral', pill: 'Paper only' }

  return (
    <section className="overflow-hidden rounded-3xl bg-card shadow-card">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-3.5">
        {checks.length > 0 && <ProgressRing done={done} total={checks.length} />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-medium tracking-tight">{headline.title}</h2>
            <Pill tone={headline.tone}>{headline.pill}</Pill>
            {checks.length > 0 && <span className="text-xs text-muted-foreground tabular-nums">{counted}</span>}
          </div>
          <p className="text-sm text-muted-foreground">{headline.text}</p>
        </div>
        {canChange &&
          (submitted ? (
            <Button variant="secondary" size="sm" className="max-sm:w-full" onClick={() => setSendingBack(true)}>
              <Undo2 /> Send back
            </Button>
          ) : (
            candidate.personalEmail && (
              <Button variant="secondary" size="sm" className="max-sm:w-full" disabled={newLink.isPending} onClick={() => newLink.mutate({ id: candidate.id })}>
                <Link2 /> {newLink.isPending ? 'Sending…' : 'Send link'}
              </Button>
            )
          ))}
      </div>

      {/* a wide screen lists every section in the side index - this strip (one line, scrolls sideways) is for the screens without it */}
      {checks.length > 0 && (
        <ul className="flex items-center gap-x-5 overflow-x-auto border-t bg-surface-2/40 px-5 py-2.5 text-xs whitespace-nowrap [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden">
          {checks.map((c) => (
            <li
              key={c.key}
              title={c.detail ?? undefined}
              className={cn('flex shrink-0 items-center gap-1.5', c.ok ? 'text-positive-ink' : 'text-muted-foreground')}
            >
              {c.ok ? <CircleCheck className="size-3.5" /> : <Circle className="size-3.5" />}
              {partLabel(c)}
            </li>
          ))}
        </ul>
      )}

      {submitted && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t px-5 py-3 text-xs text-muted-foreground">
          <PenLine className="size-4 text-positive-ink" />
          <span>
            Signed as <span className="font-serif text-base text-foreground italic">{candidate.joiningFormSignedName}</span>
          </span>
          <span>· {formatDateTime(submitted)}</span>
          <span>· code to {candidate.personalEmail}</span>
          <span>· IP {candidate.joiningFormSignIp ?? '—'}</span>
          {candidate.joiningFormDeclaration && (
            <details className="w-full">
              <summary className="cursor-pointer font-medium text-foreground/80">Declaration agreed to</summary>
              <p className="mt-1.5 max-w-3xl border-l-2 border-gold pl-3 italic">{candidate.joiningFormDeclaration}</p>
            </details>
          )}
        </div>
      )}
      {newLink.error && <p className="border-t px-6 py-3 text-sm text-negative-ink">{errorMessage(newLink.error)}</p>}

      <ReasonDialog
        open={sendingBack}
        onOpenChange={setSendingBack}
        title="Send the joining form back"
        description="The candidate is e-mailed a new link with your reason, can change the form, and must sign it again."
        confirmLabel="Send back"
        reasonLabel="What should the candidate change?"
        reasonRequired
        pending={sendBack.isPending}
        error={sendBack.error}
        onConfirm={(reason) => sendBack.mutate({ candidateId: candidate.id, reason: reason ?? '' })}
      />
      {link && (
        <LinkDialog
          result={link}
          title="Joining form link"
          description="The candidate opens this link to fill in the joining form, with a code sent to their e-mail."
          emailed="Link e-mailed to"
          onClose={() => setLink(null)}
        />
      )}
    </section>
  )
}
