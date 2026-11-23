import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleCheck, CircleX, Clock, FileText, Mail } from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router'
import { OfferCardSkeleton } from '@/components/skeletons/offer-response/OfferCardSkeleton'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { client, orpc } from '@/lib/orpc'
import { formatDate, formatDateTime } from '@/lib/utils'
import { CandidateCard as Card, CandidatePageFrame } from './components/CandidatePageFrame'
import { CandidateError } from './components/CandidateError'
import { candidateMessage } from './components/candidate-message'

// The candidate's own page, opened from the link in the offer e-mail (no login - the secret link is the key).
// They read the letter and accept it (typing their full name) or decline it; both need a one-time code e-mailed to
// them. The backend keeps the proof (time, IP, browser, the exact PDF's fingerprint). After acceptance it points to
// their joining form, a page of its own (JoiningFormPage). Errors show only candidate-safe messages (CandidateError).
// The letter may be a Letter of Intent (2026-11-16): accepted the same way, then the full offer follows by e-mail.

type View = Awaited<ReturnType<typeof client.candidates.offerResponse.view>>
type Choice = 'accept' | 'decline'

// the letter's name and what is accepted: "the offer" / "the Letter of Intent"
const letterName = (view: View) => (view.kind === 'LETTER_OF_INTENT' ? 'Letter of Intent' : 'offer letter')
const answered = (view: View) => (view.kind === 'LETTER_OF_INTENT' ? 'the Letter of Intent' : 'the offer')

export function OfferResponsePage() {
  const { token = '' } = useParams()
  const view = useQuery({ ...orpc.candidates.offerResponse.view.queryOptions({ input: { token } }), retry: false })

  return (
    <CandidatePageFrame title="Offer letter">
      {view.isPending && <OfferCardSkeleton label="Loading your offer" />}
      {view.error && (
        <Card>
          <h1 className="text-2xl font-light tracking-tight">This link does not work</h1>
          <p className="mt-2 text-sm text-muted-foreground">{candidateMessage(view.error)}</p>
        </Card>
      )}
      {view.data && <Offer token={token} view={view.data} />}
    </CandidatePageFrame>
  )
}

function Offer({ token, view }: { token: string; view: View }) {
  const [pdfError, setPdfError] = useState<string | null>(null)
  async function openLetter() {
    setPdfError(null)
    try {
      const blob = await client.candidates.offerResponse.download({ token })
      window.open(URL.createObjectURL(blob), '_blank', 'noopener')
    } catch (error) {
      setPdfError(candidateMessage(error))
    }
  }

  return (
    <>
      <Card>
        <p className="text-xs font-medium text-muted-foreground">
          {view.company} · {view.offerNumber}
          {view.revision > 0 && ` · revision ${view.revision}`}
        </p>
        <h1 className="mt-1 text-3xl font-light tracking-tight">Dear {view.name},</h1>
        <p className="mt-3 text-sm leading-relaxed">
          {view.company} is pleased to {view.kind === 'LETTER_OF_INTENT' ? 'tell you of its intent to offer you' : 'offer you'} the position of{' '}
          <strong>{view.designation}</strong>, joining on <strong>{formatDate(view.joiningDate)}</strong>. Please read the {letterName(view)} carefully before
          you answer.
          {view.kind === 'LETTER_OF_INTENT' && ' Once you accept it, we will send you the full offer letter with all the terms.'}
        </p>
        <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl bg-surface-2/70 px-4 py-3">
            <dt className="text-xs text-muted-foreground">Joining date</dt>
            <dd className="font-medium">{formatDate(view.joiningDate)}</dd>
          </div>
          <div className="rounded-2xl bg-surface-2/70 px-4 py-3">
            <dt className="text-xs text-muted-foreground">Answer by</dt>
            <dd className="font-medium">{formatDate(view.validUntil)}</dd>
          </div>
        </dl>
        <Button variant="secondary" className="mt-5 w-full" onClick={() => void openLetter()}>
          <FileText /> Read the {letterName(view)} (PDF)
        </Button>
        {pdfError && <p className="mt-2 text-sm text-negative-ink">{pdfError}</p>}
      </Card>
      {view.state === 'OPEN' ? <Answer token={token} view={view} /> : <Closed view={view} />}
    </>
  )
}

function Closed({ view }: { view: View }) {
  const content = {
    ACCEPTED: {
      icon: <CircleCheck className="size-6 text-positive-ink" />,
      title: `You have accepted ${view.kind === 'LETTER_OF_INTENT' ? 'this Letter of Intent' : 'this offer'}`,
      text: `Thank you!${view.respondedAt ? ` Accepted on ${formatDateTime(view.respondedAt)}.` : ''} ${
        // no joining-form button here (2026-11-20): its link comes by e-mail, now or from HR later
        view.joiningFormNext === 'EMAILED'
          ? 'Next step: the link to your joining form has been e-mailed to you - please fill it in and upload your documents.'
          : view.joiningFormNext === 'FROM_HR'
            ? 'Next step: HR will send you the link to your joining form by e-mail.'
            : view.kind === 'LETTER_OF_INTENT'
            ? 'Next step: we will e-mail you the full offer letter with all the terms.'
            : 'HR will contact you about the next steps.'
      }`,
    },
    DECLINED: { icon: <CircleX className="size-6 text-negative-ink" />, title: `You have declined ${answered(view)}`, text: `Your answer was recorded on ${formatDateTime(view.respondedAt)}. Thank you for letting us know.` },
    EXPIRED: { icon: <Clock className="size-6 text-muted-foreground" />, title: 'This offer has expired', text: 'The last day to answer has passed. Please contact HR if you are still interested.' },
    REPLACED: { icon: <Mail className="size-6 text-muted-foreground" />, title: 'This letter has been replaced', text: 'A revised letter is on its way (or was already e-mailed to you). Please use the link in the latest e-mail.' },
    CLOSED: { icon: <CircleX className="size-6 text-muted-foreground" />, title: 'This offer is no longer open', text: 'Please contact HR for details.' },
    OPEN: null,
  }[view.state]
  if (!content) return null
  return (
    <Card>
      <div className="flex items-start gap-3">
        {content.icon}
        <div>
          <h2 className="text-xl font-light tracking-tight">{content.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{content.text}</p>
        </div>
      </div>
    </Card>
  )
}

function Answer({ token, view }: { token: string; view: View }) {
  const queryClient = useQueryClient()
  const [choice, setChoice] = useState<Choice | null>(null)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [reason, setReason] = useState('')
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null)

  const done = (next: View) => queryClient.setQueryData(orpc.candidates.offerResponse.view.queryKey({ input: { token } }), next)
  const sendCode = useMutation(orpc.candidates.offerResponse.sendCode.mutationOptions({ onSuccess: (r) => setCodeSentTo(r.sentTo) }))
  const accept = useMutation(orpc.candidates.offerResponse.accept.mutationOptions({ onSuccess: done }))
  const decline = useMutation(orpc.candidates.offerResponse.decline.mutationOptions({ onSuccess: done }))

  if (!view.codeEmail) {
    return (
      <Card>
        <h2 className="text-xl font-light tracking-tight">How to answer</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          We do not have your e-mail address, so {answered(view)} cannot be answered online. Please sign the letter and return it to HR, or contact HR.
        </p>
      </Card>
    )
  }

  if (!choice) {
    return (
      <Card>
        <h2 className="text-xl font-light tracking-tight">Your answer</h2>
        <p className="mt-1 text-sm text-muted-foreground">We will e-mail a one-time code to {view.codeEmail} to confirm it is you.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Button variant="gold" size="lg" onClick={() => setChoice('accept')}>
            <CircleCheck /> Accept {answered(view)}
          </Button>
          <Button variant="secondary" size="lg" onClick={() => setChoice('decline')}>
            Decline
          </Button>
        </div>
      </Card>
    )
  }

  const accepting = choice === 'accept'
  const pending = accept.isPending || decline.isPending
  const ready = /^\d{6}$/.test(code) && (accepting ? agreed && name.trim().length > 0 : true)
  return (
    <Card>
      <h2 className="text-xl font-light tracking-tight">
        {accepting ? 'Accept' : 'Decline'} {answered(view)}
      </h2>
      <div className="mt-5 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="code" className="text-xs text-muted-foreground">
            One-time code
          </Label>
          <div className="flex gap-2">
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="6 digits"
              className="h-11 rounded-xl text-center font-mono text-lg tracking-[0.3em]"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
            <Button variant="secondary" className="h-11" disabled={sendCode.isPending} onClick={() => sendCode.mutate({ token })}>
              {sendCode.isPending ? 'Sending…' : codeSentTo ? 'Send again' : 'Send code'}
            </Button>
          </div>
          {codeSentTo && <p className="text-xs text-positive-ink">Code sent to {codeSentTo}. It is valid for 10 minutes.</p>}
          <CandidateError error={sendCode.error} />
        </div>

        {accepting ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs text-muted-foreground">
                Type your full name as on the letter: <span className="font-medium text-foreground">{view.fullName}</span>
              </Label>
              <Input id="name" className="h-11 rounded-xl" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </div>
            <label className="flex items-start gap-3 text-sm">
              <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} className="mt-0.5" />
              <span>
                I have read the {letterName(view)} and accept {answered(view)} and its terms and conditions. I understand that typing my name here is my
                signature.
              </span>
            </label>
          </>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="reason" className="text-xs text-muted-foreground">
              Reason (optional)
            </Label>
            <Textarea id="reason" className="rounded-xl" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. accepted another offer" />
          </div>
        )}

        <CandidateError error={accept.error ?? decline.error} />
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={() => setChoice(null)} disabled={pending}>
            Back
          </Button>
          <Button
            variant={accepting ? 'gold' : 'destructive'}
            disabled={!ready || pending}
            onClick={() => (accepting ? accept.mutate({ token, code, name }) : decline.mutate({ token, code, reason: reason.trim() || undefined }))}
          >
            {pending ? 'Saving…' : `${accepting ? 'Accept' : 'Decline'} ${answered(view)}`}
          </Button>
        </div>
      </div>
    </Card>
  )
}
