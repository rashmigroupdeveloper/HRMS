import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Check,
  ClipboardList,
  FileText,
  FolderOpen,
  HeartPulse,
  History,
  Link2,
  type LucideIcon,
  Lock,
  Pencil,
  Send,
  ShieldCheck,
  Signature,
  UserPlus,
  UserRound,
  Wallet,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { FormError } from '@/components/FormError'
import { CandidatePageSkeleton } from '@/components/skeletons/onboarding/CandidatePageSkeleton'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAccess } from '@/hooks/useAccess'
import { client, orpc } from '@/lib/orpc'
import { cn, errorMessage, formatDate, formatDoneBy, formatMoney, sumMoney } from '@/lib/utils'
import { BackgroundChecksTab } from './components/BackgroundChecksTab'
import { DocumentsTab } from './components/DocumentsTab'
import { JoiningDialog } from './components/JoiningDialog'
import { JoiningFormTab } from './components/JoiningFormTab'
import {
  type Candidate,
  candidatePlace,
  CLOSED_STATUSES,
  EMPLOYMENT_TYPE,
  fullName,
  JOINING_TYPE,
  joiningDatePassed,
  loiOut,
  progressOf,
  PROGRESS_STEPS,
  SALUTATION,
  type SentKind,
  statusLabel,
  STATUS_TONE,
  WORKFORCE,
} from './components/labels'
import { MedicalTab } from './components/MedicalTab'
import { OfferDialog } from './components/OfferDialog'
import { type LinkResult, LinkDialog, OfferLettersCard, PaperAcceptDialog, SendOfferDialog } from './components/OfferLetters'
import { Pill } from '@/components/Pill'
import { ReasonDialog } from './components/ReasonDialog'
import { DetailCard } from './components/DetailCard'

type Outcome = Parameters<typeof client.candidates.close>[0]['outcome']

const OUTCOMES: Record<Outcome, { label: string; title: string; description: string }> = {
  DECLINED: { label: 'Declined', title: 'Candidate declined the offer', description: 'Record why, if the candidate said.' },
  EXPIRED: { label: 'Expired', title: 'Offer expired', description: 'No answer by the valid-until date.' },
  WITHDRAWN: { label: 'Withdraw', title: 'Withdraw the offer', description: 'The company cancels it (failed BGV, unfit, fake document, position closed...). The reason is required.' },
  BACKED_OUT: { label: 'Backed out', title: 'Candidate backed out', description: 'The candidate accepted (the offer or the Letter of Intent), then said they will not join.' },
  NO_SHOW: { label: 'No-show', title: 'Did not turn up', description: 'The candidate did not come on the joining date.' },
}

const TABS = [
  ['offer', 'Offer', FileText],
  ['joining', 'Joining form', ClipboardList],
  ['documents', 'Documents', FolderOpen],
  ['medical', 'Medical & confirmation', HeartPulse],
  // last: not needed to join (decided 2026-11-12) - may still be running on the joining day
  ['bgv', 'Background checks', ShieldCheck],
] as const satisfies readonly (readonly [string, string, LucideIcon])[]
type TabKey = (typeof TABS)[number][0]

// What each stage tab shows next to its name: "3/7" while in progress, a tick when done, nothing when unknown
type Progress = { done: number; total: number } | 'done' | null

// Each stage's progress, from the joining checklist and the background checks
function stageProgress(c: Candidate, items: { key: string; ok: boolean }[], bgv: { status: string }[]): Record<TabKey, Progress> {
  const count = (pick: (key: string) => boolean): Progress => {
    const mine = items.filter((i) => pick(i.key))
    if (!mine.length) return null
    const done = mine.filter((i) => i.ok).length
    return done === mine.length ? 'done' : { done, total: mine.length }
  }
  return {
    offer: c.acceptedAt ? 'done' : null,
    joining: c.employee ? 'done' : count((k) => ['personal', 'addresses', 'emergency', 'education', 'family', 'nominees', 'gratuity', 'identity', 'bank', 'statutory', 'medicalInfo', 'signed'].includes(k)),
    documents: c.employee ? 'done' : count((k) => k.startsWith('document:')),
    bgv: bgv.length
      ? bgv.every((b) => b.status === 'CLEAR')
        ? 'done'
        : { done: bgv.filter((b) => b.status === 'CLEAR').length, total: bgv.length }
      : null,
    medical: c.employee ? 'done' : count((k) => k === 'medical'),
  }
}

// The tab the page opens on: the offer until it is accepted (and once the candidate joined or the offer closed);
// for an accepted offer the first stage still open - joining form, documents, medical, then background checks (when
// started; not needed to join) - or the joining form when all are done
const PRE_JOINING_STAGES: TabKey[] = ['joining', 'documents', 'medical', 'bgv']
function currentStage(c: Candidate, progress: Record<TabKey, Progress>): TabKey {
  if (c.status !== 'ACCEPTED') return 'offer'
  return PRE_JOINING_STAGES.find((stage) => progress[stage] !== null && progress[stage] !== 'done') ?? 'joining'
}

// One candidate on its own page (/onboarding/:id): the offer and every pre-joining step, one tab each.
// The open tab is kept in the address (?tab=documents), so a reload or a shared link opens the same tab.
export function CandidatePage() {
  const id = Number(useParams().id)
  // a fresh page per candidate (no state carried over from the previous one)
  return <CandidatePanel key={id} id={id} />
}

// "PS" for Prateek Singh - the badge in the header
const initials = (c: { firstName: string; lastName: string | null }) => `${c.firstName.charAt(0)}${c.lastName?.charAt(0) ?? ''}`.toUpperCase()

const back = (
  <Link to="/manage/onboarding" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
    <ArrowLeft className="size-4" /> Onboarding
  </Link>
)

function CandidatePanel({ id }: { id: number }) {
  const queryClient = useQueryClient()
  const query = useQuery(orpc.candidates.get.queryOptions({ input: { id } }))
  const refresh = () => queryClient.invalidateQueries({ queryKey: orpc.candidates.key() })
  const [editing, setEditing] = useState(false)
  const [closing, setClosing] = useState<Outcome | null>(null)
  const [joining, setJoining] = useState(false)
  const [paperAccept, setPaperAccept] = useState(false)
  // the candidate's link after sending / a new link (shown once)
  const [linkResult, setLinkResult] = useState<{ title: string; result: LinkResult } | null>(null)
  const { can, covers } = useAccess()

  // picking the letter template, previewing and sending happen in the send dialog - the Letter of Intent or the offer
  const [sending, setSending] = useState<SentKind | null>(null)
  const newLink = useMutation(
    orpc.candidates.offerLetters.newLink.mutationOptions({
      onSuccess: (result) => {
        setLinkResult({ title: 'New link for the candidate', result })
        void refresh()
      },
    }),
  )
  const close = useMutation(orpc.candidates.close.mutationOptions({ onSuccess: () => { setClosing(null); void refresh() } }))
  const [searchParams, setSearchParams] = useSearchParams()
  // the stage tabs' progress: the joining checklist (form, documents, medical) and the background checks
  const preJoining = query.data?.status === 'ACCEPTED'
  const checklist = useQuery({ ...orpc.candidates.joining.checklist.queryOptions({ input: { candidateId: id } }), enabled: preJoining })
  const checks = useQuery({ ...orpc.candidates.backgroundChecks.list.queryOptions({ input: { candidateId: id } }), enabled: !!query.data?.acceptedAt })
  const asked = searchParams.get('tab')
  // Opened without ?tab: go to the stage in progress once it is known, and keep it in the address - so the page
  // does not jump to the next stage while HR works on this one
  const stage =
    query.data && (query.data.status !== 'ACCEPTED' || (checklist.isSuccess && !checks.isPending))
      ? currentStage(query.data, stageProgress(query.data, checklist.data?.items ?? [], checks.data ?? []))
      : null
  useEffect(() => {
    if (!asked && stage && stage !== 'offer') setSearchParams({ tab: stage }, { replace: true })
  }, [asked, stage, setSearchParams])

  if (query.isPending) {
    // the tab asked for in the address (a reload keeps it) - the stage tabs stay usable while the candidate loads
    const loadingTab = TABS.some(([value]) => value === asked) ? asked! : 'offer'
    return (
      <CandidatePageSkeleton
        back={back}
        tabs={TABS}
        tab={loadingTab}
        onTab={(value) => setSearchParams({ tab: value }, { replace: true })}
        groups={OFFER_GROUPS}
        pay={PAY_LABELS}
        timeline={TIMELINE_LABELS}
        steps={PROGRESS_STEPS}
        medical={can('MEDICAL', 'READ')}
        label="Loading the candidate"
      />
    )
  }
  if (query.error) {
    return (
      <div className="space-y-4">
        {back}
        <p className="text-sm text-negative-ink">{errorMessage(query.error)}</p>
      </div>
    )
  }
  const c = query.data
  // Onboarding Edit covering where this candidate is placed (the backend checks the same)
  const canChange = covers('ONBOARDING', 'WRITE', candidatePlace(c))
  // the tabs after "Offer" open once the candidate accepted; without ?tab, the stage in progress (the joining form
  // while that is still being worked out)
  const fallback = stage ?? (c.status === 'ACCEPTED' ? 'joining' : 'offer')
  const tab = TABS.some(([value]) => value === asked) && (asked === 'offer' || c.acceptedAt) ? asked! : fallback
  const openTab = (value: string) => setSearchParams({ tab: value }, { replace: true })
  const closeButtons: Outcome[] =
    c.status === 'DRAFT'
      ? ['WITHDRAWN']
      : c.status === 'OFFERED'
        ? ['DECLINED', 'EXPIRED', 'WITHDRAWN']
        : c.status === 'LOI_ACCEPTED'
          ? ['BACKED_OUT', 'WITHDRAWN']
          : c.status === 'ACCEPTED'
            ? ['BACKED_OUT', 'NO_SHOW', 'WITHDRAWN']
            : []
  // a Letter of Intent only before the full offer
  const canSendLoi = c.status === 'DRAFT' && !c.loiAcceptedAt && !c.offerNumber
  // Action buttons: only while the candidate is still open, and only with edit access
  const showActions = closeButtons.length > 0 && canChange

  const progress = stageProgress(c, checklist.data?.items ?? [], checks.data ?? [])
  const journey = progressOf(c)
  const closed = CLOSED_STATUSES.includes(c.status)

  return (
    <Tabs value={tab} onValueChange={(value) => openTab(String(value))} className="gap-4">
      {back}
      {/* Charcoal hero header - the one dark surface of the page: who, where it stands, the actions and the stages */}
      <header className="u-grain relative space-y-3 overflow-hidden rounded-3xl bg-hero px-5 pt-4 text-hero-foreground shadow-card sm:px-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-2xl bg-hero-foreground/10 text-base font-semibold">
            {initials(c)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-light tracking-tight">{fullName(c)}</h1>
              <Pill tone={STATUS_TONE[c.status]} className="bg-hero-foreground/10 text-hero-foreground">
                {statusLabel(c)}
              </Pill>
              {!canChange && <span className="rounded-full bg-hero-foreground/10 px-2.5 py-0.5 text-xs text-hero-foreground">View only</span>}
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-hero-foreground/75">
              <span>#{c.id}</span>
              <span className="flex items-center gap-1">
                <BriefcaseBusiness className="size-3.5" /> {c.designation.name}
              </span>
              <span className="flex items-center gap-1">
                <Building2 className="size-3.5" /> {c.company.name}
              </span>
              <span className="flex items-center gap-1">
                <CalendarDays className="size-3.5" /> Joining {formatDate(c.proposedJoiningDate)}
              </span>
              {/* not joined yet and the day is gone: the date probably moved */}
              {joiningDatePassed(c) && (
                <span className="rounded-full bg-amber-300 px-2 py-0.5 font-medium text-amber-950" title="Change the joining date with Edit if it moved">
                  Date passed - change it with Edit if it moved
                </span>
              )}
            </p>
          </div>
          {(showActions || c.employee) && (
            <div className="flex flex-wrap items-center gap-1.5">
              {showActions && (
                <>
                  {canSendLoi && (
                    <Button variant={c.loiNumber ? 'gold' : 'secondary'} size="sm" onClick={() => setSending('LETTER_OF_INTENT')}>
                      <Send /> {c.loiNumber ? 'Send revised Letter of Intent' : 'Send Letter of Intent'}
                    </Button>
                  )}
                  {(c.status === 'DRAFT' || c.status === 'LOI_ACCEPTED') && (
                    <Button variant={c.loiNumber && canSendLoi ? 'secondary' : 'gold'} size="sm" onClick={() => setSending('OFFER_LETTER')}>
                      <Send /> {c.offerNumber ? 'Send revised offer' : c.loiAcceptedAt ? 'Send full offer' : 'Send offer'}
                    </Button>
                  )}
                  {c.status === 'ACCEPTED' && (
                    <Button variant="gold" size="sm" onClick={() => setJoining(true)}>
                      <UserPlus /> Complete joining
                    </Button>
                  )}
                  {c.status === 'OFFERED' && (
                    <>
                      <Button variant="gold" size="sm" onClick={() => setPaperAccept(true)}>
                        <Signature /> Accepted on paper
                      </Button>
                      <Button variant="secondary" size="sm" disabled={newLink.isPending} onClick={() => newLink.mutate({ id: c.id })}>
                        <Link2 /> {newLink.isPending ? 'Sending…' : 'New link'}
                      </Button>
                    </>
                  )}
                  <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                    <Pencil /> Edit
                  </Button>
                  {/* closing the offer - apart from the main actions: after a rule, on a phone a line of their own */}
                  <div className="flex items-center gap-0.5 max-sm:-mx-2 max-sm:w-[calc(100%+1rem)] sm:ml-2 sm:border-l sm:border-hero-foreground/20 sm:pl-2">
                    {closeButtons.map((outcome) => (
                      <Button
                        key={outcome}
                        variant="ghost"
                        size="sm"
                        className="text-hero-foreground/75 hover:bg-hero-foreground/10 hover:text-hero-foreground max-sm:h-9"
                        onClick={() => setClosing(outcome)}
                      >
                        {OUTCOMES[outcome].label}
                      </Button>
                    ))}
                  </div>
                </>
              )}
              {c.employee && (
                <Button variant="gold" size="sm" nativeButton={false} render={<Link to={`/manage/employees/${c.employee.employeeCode}`} />}>
                  Joined as {c.employee.employeeCode} <ArrowRight />
                </Button>
              )}
            </div>
          )}
        </div>
        {/* the way from the offer to the joining day (as on the onboarding list): steps done, the next one in gold */}
        <div className="flex flex-wrap items-end gap-x-6 gap-y-2 pt-1">
          <ol aria-label="Onboarding progress" className="grid min-w-0 flex-1 grid-cols-5 gap-1.5">
            {PROGRESS_STEPS.map((step, i) => {
              const done = i < journey.done
              return (
                <li key={step} className="min-w-0" aria-current={i === journey.done && !closed ? 'step' : undefined}>
                  <span
                    className={cn(
                      'block h-1.5 rounded-full',
                      done ? (closed ? 'bg-hero-foreground/40' : 'bg-hero-foreground') : i === journey.done && !closed ? 'bg-gold' : 'bg-hero-foreground/15',
                    )}
                  />
                  <span className={cn('mt-1.5 block truncate text-xs', done ? 'text-hero-foreground/90' : 'text-hero-foreground/50')}>
                    {done && <Check className="mr-1 inline size-3 align-[-1px]" strokeWidth={3} />}
                    {step}
                  </span>
                </li>
              )
            })}
          </ol>
          <p className={cn('shrink-0 text-sm font-medium', closed ? 'text-hero-foreground/75' : 'text-gold')}>{journey.next}</p>
        </div>
        <FormError error={newLink.error} />
        {/* employees with the same mobile or e-mail - a rehire, or an offer made twice (shown, never blocking) */}
        {c.possibleDuplicates.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-amber-300/90 px-4 py-2.5 text-sm text-amber-950">
            <span className="font-medium">Possibly already an employee:</span>
            {c.possibleDuplicates.map((d) =>
              // one outside your data access comes as code + name only (no status) - not a link you could open
              d.status === null ? (
                <span key={d.employeeCode}>
                  {d.name} ({d.employeeCode}) - same {d.matchedOn.join(' and ')}
                </span>
              ) : (
                <Link key={d.employeeCode} to={`/manage/employees/${d.employeeCode}`} className="underline underline-offset-2">
                  {d.name} ({d.employeeCode}
                  {d.status === 'EXITED' ? ', left' : ''}) - same {d.matchedOn.join(' and ')}
                </Link>
              ),
            )}
          </div>
        )}

        {/* The stages, as tabs along the bottom of the header (scroll sideways on a phone) */}
        <TabsList
          variant="line"
          className="-mx-5 flex h-auto w-[calc(100%+2.5rem)] group-data-horizontal/tabs:h-auto flex-nowrap justify-start gap-0 overflow-x-auto border-t border-hero-foreground/10 px-2 py-0 [scrollbar-width:none] sm:-mx-6 sm:w-[calc(100%+3rem)] sm:px-3 [&::-webkit-scrollbar]:hidden"
        >
          {TABS.map(([value, label, Icon]) => {
            const locked = value !== 'offer' && !c.acceptedAt
            return (
              <TabsTrigger
                key={value}
                value={value}
                disabled={locked}
                title={locked ? 'Opens once the candidate accepts the offer' : undefined}
                onClick={(event) => event.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' })}
                className="h-auto flex-none gap-2 rounded-none px-3 py-3 whitespace-nowrap text-hero-foreground/75 group-data-horizontal/tabs:after:bottom-0 after:h-[3px] after:rounded-full after:bg-gold hover:text-hero-foreground data-active:text-hero-foreground"
              >
                {locked ? <Lock className="size-3.5" /> : <Icon className="size-4" />}
                {label}
                <StageBadge progress={locked ? null : progress[value]} />
              </TabsTrigger>
            )
          })}
        </TabsList>
      </header>

      <div>
          <TabsContent value="offer" className="space-y-4">
            <OfferDetails c={c} />
            <OfferLettersCard candidate={c} />
          </TabsContent>
          <TabsContent value="joining">
            <JoiningFormTab candidate={c} />
          </TabsContent>
          <TabsContent value="documents">
            <DocumentsTab candidate={c} />
          </TabsContent>
          <TabsContent value="medical">
            <MedicalTab key={c.updatedAt.getTime()} candidate={c} />
          </TabsContent>
          <TabsContent value="bgv">
            <BackgroundChecksTab candidate={c} />
          </TabsContent>
      </div>

      <OfferDialog open={editing} onOpenChange={setEditing} candidate={c} />
      {joining && <JoiningDialog candidate={c} onClose={() => setJoining(false)} />}
      {paperAccept && <PaperAcceptDialog candidate={c} loi={loiOut(c)} onClose={() => setPaperAccept(false)} />}
      {sending && (
        <SendOfferDialog
          candidate={c}
          kind={sending}
          onClose={() => setSending(null)}
          onSent={(result) => {
            setSending(null)
            setLinkResult({
              title: sending === 'LETTER_OF_INTENT' ? `Letter of Intent sent - ${result.candidate.loiNumber}` : `Offer sent - ${result.candidate.offerNumber}`,
              result,
            })
          }}
        />
      )}
      {linkResult && <LinkDialog title={linkResult.title} result={linkResult.result} onClose={() => setLinkResult(null)} />}
      {closing && (
        <ReasonDialog
          open
          onOpenChange={(next) => !next && setClosing(null)}
          title={OUTCOMES[closing].title}
          description={OUTCOMES[closing].description}
          confirmLabel={`Close as ${OUTCOMES[closing].label.toLowerCase()}`}
          reasonRequired={closing === 'WITHDRAWN'}
          destructive
          pending={close.isPending}
          error={close.error}
          onConfirm={(reason) => close.mutate({ id: c.id, outcome: closing, reason })}
        />
      )}
    </Tabs>
  )
}

function StageBadge({ progress }: { progress: Progress }) {
  if (!progress) return null
  if (progress === 'done') {
    return (
      <span className="grid size-4 place-items-center rounded-full bg-positive text-white">
        <Check className="size-3" strokeWidth={3} />
      </span>
    )
  }
  return (
    <span className="rounded-full bg-hero-foreground/10 px-1.5 py-px text-xs text-hero-foreground/80 tabular-nums" title={`${progress.done} of ${progress.total} done`}>
      {progress.done}/{progress.total}
    </span>
  )
}

const months = (n: number | null) => (n === null ? '—' : `${n} month${n === 1 ? '' : 's'}`)

// The offer's details in cards: label, value, and whether it takes a whole line. The titles and labels are also the
// loading skeleton's (CandidatePageSkeleton gets OFFER_GROUPS, PAY_LABELS and TIMELINE_LABELS).
type OfferRow = readonly [label: string, value: (c: Candidate) => React.ReactNode, wide?: boolean]
type OfferGroup = { title: string; icon: LucideIcon; columns: string; rows: OfferRow[] }
const OFFER_GROUPS: OfferGroup[] = [
  {
    title: 'Position',
    icon: BriefcaseBusiness,
    columns: 'sm:grid-cols-3',
    rows: [
      ['Designation', (c) => c.designation.name],
      ['Department', (c) => c.department?.name ?? '—'],
      ['Grade', (c) => c.grade?.name ?? '—'],
      ['Company', (c) => `${c.company.name} (${c.company.code})`],
      ['Plant', (c) => `${c.plant.plantCode} · ${c.plant.name}`],
      ['Work location', (c) => (c.workLocation ? `${c.workLocation.name} (${c.workLocation.countryCode})` : '—')],
      ['Joining type', (c) => JOINING_TYPE[c.joiningType]],
      ['Employment type', (c) => EMPLOYMENT_TYPE[c.employmentType]],
      ['Workforce', (c) => WORKFORCE[c.workforceCategory]],
    ],
  },
  {
    title: 'Candidate',
    icon: UserRound,
    columns: 'grid-cols-2',
    rows: [
      ['Addressed to', (c) => `${c.salutation ? `${SALUTATION[c.salutation]} ` : ''}${fullName(c)}`],
      ['Mobile', (c) => c.mobile],
      ['Personal email', (c) => c.personalEmail ?? '—', true],
      ['Address', (c) => c.address ?? '—', true],
    ],
  },
  {
    title: 'Dates and terms',
    icon: CalendarDays,
    columns: 'grid-cols-2',
    rows: [
      ['Joining date', (c) => formatDate(c.proposedJoiningDate)],
      ['Offer valid until', (c) => formatDate(c.offerValidUntil)],
      ['Contract end', (c) => formatDate(c.contractEndDate)],
      ['Probation', (c) => months(c.probationMonths)],
      ['Notice (probation / confirmed)', (c) => `${months(c.noticeMonthsProbation)} / ${months(c.noticeMonthsConfirmed)}`, true],
    ],
  },
]
const PAY_LABELS = ['Annual CTC (fixed)', 'Performance pay', 'Total CTC']

// The offer's history, oldest first: what happened, when and by whom; a step not reached yet is shown hollow
type Moment = { label: string; done: boolean; when: string; note?: string | null }
function momentsOf(c: Candidate): Moment[] {
  const at = (label: string, date: Date | null, by: { name: string } | null, note?: string | null): Moment => ({ label, done: !!date, when: formatDoneBy(date, by), note })
  const closed = CLOSED_STATUSES.includes(c.status)
  return [
    at('Created', c.createdAt, c.createdBy),
    ...(c.loiNumber ? [at('Letter of Intent accepted', c.loiAcceptedAt, c.loiAcceptedBy, c.loiNumber)] : []),
    at('Offer sent', c.offerSentAt, c.offerSentBy, c.offerNumber),
    at('Accepted', c.acceptedAt, c.acceptedBy),
    at('Joining confirmed', c.joiningConfirmedAt, c.joiningConfirmedBy),
    closed ? at('Closed', c.closedAt, c.closedBy, c.closeReason) : { label: 'Joined', done: !!c.employee, when: c.employee ? `as ${c.employee.employeeCode}` : '' },
  ]
}
// the timeline's labels as the skeleton shows them (an open offer without a Letter of Intent)
const TIMELINE_LABELS = ['Created', 'Offer sent', 'Accepted', 'Joining confirmed', 'Joined']

function OfferDetails({ c }: { c: Candidate }) {
  const money = (n: number) => formatMoney(n, c.ctcCurrency)
  const gross = sumMoney(c.salaryLines.filter((l) => l.salaryComponent.kind === 'EARNING').map((l) => l.monthlyAmount))
  const total = sumMoney(c.salaryLines.map((l) => l.monthlyAmount))
  const figures = [money(c.annualCtc), c.performancePayAnnual ? money(c.performancePayAnnual) : '—', money(sumMoney([c.annualCtc, c.performancePayAnnual ?? 0]))]
  const moments = momentsOf(c)
  const group = ({ title, icon, columns, rows }: OfferGroup) => (
    <DetailCard key={title} title={title} icon={icon}>
      <dl className={cn('grid gap-x-6 gap-y-3', columns)}>
        {rows.map(([label, value, wide]) => {
          const shown = value(c)
          return (
            <div key={label} className={cn('flex min-w-0 flex-col gap-0.5', wide && 'col-span-full')}>
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className={cn('text-sm break-words whitespace-pre-line', shown === '—' ? 'text-muted-foreground' : 'font-medium')}>{shown}</dd>
            </div>
          )
        })}
      </dl>
    </DetailCard>
  )
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="space-y-4">
        {group(OFFER_GROUPS[0]!)}
        <div className="grid items-start gap-4 md:grid-cols-2">{OFFER_GROUPS.slice(1).map(group)}</div>

        <DetailCard title="Pay" icon={Wallet}>
          {/* the figures the letter prints, big and light */}
          <dl className="grid grid-cols-3 gap-4">
            {PAY_LABELS.map((label, i) => (
              <div key={label} className="flex min-w-0 flex-col-reverse">
                <dt className="mt-0.5 text-xs text-muted-foreground">{label}</dt>
                <dd className={cn('truncate text-2xl font-light tracking-tight tabular-nums sm:text-3xl', figures[i] === '—' && 'text-muted-foreground')}>{figures[i]}</dd>
              </div>
            ))}
          </dl>
          {c.salaryLines.length > 0 && (
            <table className="mt-4 w-full border-t border-dashed text-sm">
              <caption className="caption-top pt-3 pb-1 text-left text-xs text-muted-foreground">Salary breakup - Annexure-I of the letter</caption>
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="py-1 text-left font-medium">Component</th>
                  <th className="py-1 text-right font-medium">Monthly</th>
                  <th className="py-1 text-right font-medium">Annual</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {c.salaryLines.map((l, i) => (
                  <tr key={l.salaryComponent.id} className={i > 0 && l.salaryComponent.kind !== c.salaryLines[i - 1]!.salaryComponent.kind ? 'border-t' : ''}>
                    <td className="py-1">{l.salaryComponent.name}</td>
                    <td className="py-1 text-right">{money(l.monthlyAmount)}</td>
                    <td className="py-1 text-right">{money(sumMoney([l.monthlyAmount * 12]))}</td>
                  </tr>
                ))}
                <tr className="border-t text-muted-foreground">
                  <td className="py-1">Monthly gross</td>
                  <td className="py-1 text-right">{money(gross)}</td>
                  <td className="py-1 text-right">{money(sumMoney([gross * 12]))}</td>
                </tr>
                <tr className="border-t font-semibold">
                  <td className="py-1">Total (fixed CTC)</td>
                  <td className="py-1 text-right">{money(total)}</td>
                  {/* the agreed annual CTC: 12 x the monthly total can be a few paise off it (2026-11-24) */}
                  <td className="py-1 text-right">{money(c.annualCtc)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </DetailCard>
      </div>

      <DetailCard title="Timeline" icon={History}>
        <ol>
          {moments.map((m, i) => (
            <li key={m.label} className="relative flex gap-3 pb-4 last:pb-0">
              {i < moments.length - 1 && <span aria-hidden className={cn('absolute top-5 bottom-0 left-[7px] w-px', m.done && moments[i + 1]!.done ? 'bg-hero' : 'bg-border')} />}
              <span aria-hidden className={cn('mt-0.5 size-[15px] shrink-0 rounded-full border-2', m.done ? 'border-hero bg-hero' : 'border-border bg-card')} />
              <div className="min-w-0">
                <p className={cn('text-sm', m.done ? 'font-medium' : 'text-muted-foreground')}>
                  {m.label}
                  {m.note && <span className="font-normal text-muted-foreground"> · {m.note}</span>}
                </p>
                <p className="text-xs text-muted-foreground">{m.done ? m.when : 'Not yet'}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-4 border-t border-dashed pt-3 text-xs text-muted-foreground">Last changed {formatDoneBy(c.updatedAt, c.updatedBy)}</p>
      </DetailCard>
    </div>
  )
}
