import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, Download, FileText, Mail, Send, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { FormError } from '@/components/FormError'
import { Pill } from '@/components/Pill'
import { Button } from '@/components/ui/button'
import { DialogCancel, FormDialog } from '@/components/FormDialog'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { client, orpc } from '@/lib/orpc'
import { formatDateTime, formatDoneBy, openPdf } from '@/lib/utils'
import { JOINING_TYPE, SENT_KIND, type SentKind } from './labels'
import { SectionTitle } from '@/components/FormFields'
import type { Candidate, OfferLetter } from './labels'

// The offer letter on the candidate panel: opening a PDF, the link dialog after sending, accepting on paper, and the
// history of the letters sent.

export type LinkResult = { link: string; emailedTo: string | null; emailError: string | null }
type SendResult = Awaited<ReturnType<typeof client.candidates.send>>

// Sending the Letter of Intent or the offer: HR picks the letter template (its wording and letterhead - one suggested
// for the joining type), can preview the letter, then sends it
export function SendOfferDialog({
  candidate,
  kind,
  onClose,
  onSent,
}: {
  candidate: Candidate
  kind: SentKind
  onClose: () => void
  onSent: (result: SendResult) => void
}) {
  const queryClient = useQueryClient()
  const options = useQuery(orpc.candidates.offerLetters.templates.queryOptions({ input: { id: candidate.id, kind } }))
  const loi = kind === 'LETTER_OF_INTENT'
  const revised = loi ? !!candidate.loiNumber : !!candidate.offerNumber
  const [picked, setPicked] = useState<string | null>(null)
  const templateId = picked ?? (options.data?.suggestedId ? String(options.data.suggestedId) : '')
  const chosen = options.data?.templates.find((t) => String(t.id) === templateId)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const send = useMutation(
    orpc.candidates.send.mutationOptions({
      onSuccess: (result) => {
        void queryClient.invalidateQueries({ queryKey: orpc.candidates.key() })
        onSent(result)
      },
    }),
  )
  return (
    <FormDialog onOpenChange={(open) => !open && onClose()} dirty={picked !== null} className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {loi ? (revised ? 'Send the revised Letter of Intent' : 'Send the Letter of Intent') : revised ? 'Send the revised offer' : candidate.loiAcceptedAt ? 'Send the full offer' : 'Send the offer'}
          </DialogTitle>
          <DialogDescription>
            Pick the letter template - its wording and letterhead are used for the letter.
            {loi && ' Once the candidate accepts it, send the full offer.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="offer-template" className="text-xs text-muted-foreground">
            Letter template<span className="text-negative-ink">*</span>
          </Label>
          <NativeSelect
            id="offer-template"
            className="w-full [&_select]:h-10 [&_select]:rounded-xl"
            value={templateId}
            disabled={options.isPending}
            onChange={(e) => setPicked(e.target.value)}
          >
            <NativeSelectOption value="">{options.isPending ? 'Loading…' : 'Choose a template'}</NativeSelectOption>
            {options.data?.templates.map((t) => (
              <NativeSelectOption key={t.id} value={String(t.id)} disabled={!t.ready}>
                {t.name}
                {t.joiningType ? ` (${JOINING_TYPE[t.joiningType]})` : ''}
                {t.ready ? '' : ' - letterhead missing'}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {options.data && options.data.templates.length === 0 && (
            <p className="text-xs text-negative-ink">There is no active {SENT_KIND[kind].toLowerCase()} template - add one on the Letter templates page.</p>
          )}
          {options.data && options.data.templates.length > 0 && !options.data.suggestedId && (
            <p className="text-xs text-negative-ink">No template has its letterhead yet - upload it on the Letter templates page.</p>
          )}
        </div>
        {previewError && <p className="text-sm text-negative-ink">{previewError}</p>}
        <FormError error={send.error ?? options.error} />
        <DialogFooter>
          <DialogCancel />
          <Button
            variant="secondary"
            disabled={!chosen?.ready}
            onClick={() => {
              setPreviewError(null)
              void openPdf(() => client.candidates.offerLetters.preview({ id: candidate.id, templateId: Number(templateId) }), setPreviewError)
            }}
          >
            <FileText /> Preview
          </Button>
          <Button variant="gold" disabled={!chosen?.ready || send.isPending} onClick={() => send.mutate({ id: candidate.id, templateId: Number(templateId) })}>
            <Send /> {send.isPending ? 'Writing the letter…' : 'Send'}
          </Button>
        </DialogFooter>
    </FormDialog>
  )
}

// After sending (or a new link): the candidate's link - shown once, since only its fingerprint is kept - and
// whether the e-mail went out.
// `description` / `emailed`: the wording for another link than the offer's (the joining-form link)
export function LinkDialog({
  result,
  title,
  description = 'The candidate opens this link to read the letter and accept or decline it with a code sent to their e-mail.',
  emailed = 'Letter and link e-mailed to',
  onClose,
}: {
  result: LinkResult
  title: string
  description?: string
  emailed?: string
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)
  return (
    // the link is shown only once - a click outside does not close it
    <Dialog open disablePointerDismissal onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="rounded-3xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {result.emailedTo && (
          <p className="flex items-center gap-2 rounded-2xl bg-positive/10 px-4 py-3 text-sm text-positive-ink">
            <Mail className="size-4 shrink-0" /> {emailed} {result.emailedTo}.
          </p>
        )}
        {result.emailError && (
          <p className="flex items-center gap-2 rounded-2xl bg-gold-soft px-4 py-3 text-sm">
            <TriangleAlert className="size-4 shrink-0" /> {result.emailError} Share the link below yourself, or send a new link later.
          </p>
        )}
        {!result.emailedTo && !result.emailError && (
          <p className="flex items-center gap-2 rounded-2xl bg-gold-soft px-4 py-3 text-sm">
            <TriangleAlert className="size-4 shrink-0" /> No personal e-mail on this offer, so nothing was e-mailed. Share the link yourself (e.g. WhatsApp) or
            print the letter - the candidate can then accept on paper.
          </p>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="offer-link" className="text-xs text-muted-foreground">
            Candidate's link (copy it now - it is not shown again)
          </Label>
          <div className="flex gap-2">
            <Input id="offer-link" readOnly value={result.link} className="h-10 rounded-xl font-mono text-xs" onFocus={(e) => e.target.select()} />
            <Button
              variant="secondary"
              onClick={() => {
                void navigator.clipboard.writeText(result.link).then(() => setCopied(true))
              }}
            >
              {copied ? <Check /> : <Copy />} {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="gold" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// The candidate answered on paper: upload the signed letter, then mark the offer (or the Letter of Intent) accepted
export function PaperAcceptDialog({ candidate, loi, onClose }: { candidate: Candidate; loi: boolean; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const accept = useMutation({
    mutationFn: async () => {
      await client.candidates.documents.upload({ candidateId: candidate.id, type: 'SIGNED_OFFER_LETTER', file: file! })
      return client.candidates.accept({ id: candidate.id })
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: orpc.candidates.key() }),
    onSuccess: onClose,
  })
  const tooBig = !!file && file.size > 5 * 1024 * 1024
  return (
    <FormDialog onOpenChange={(open) => !open && onClose()} dirty={!!file} className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{loi ? 'Letter of Intent accepted on paper' : 'Accepted on paper'}</DialogTitle>
          <DialogDescription>
            Upload the {loi ? 'Letter of Intent' : 'offer letter'} the candidate signed (scan or photo - PDF, JPG or PNG, up to 5 MB). It is kept as the proof of
            acceptance and moves to the employee's documents on joining.{loi && ' Then send the full offer.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="signed-letter" className="text-xs text-muted-foreground">
            {loi ? 'Signed Letter of Intent' : 'Signed offer letter'}
            <span className="text-negative-ink">*</span>
          </Label>
          <Input id="signed-letter" type="file" accept=".pdf,.jpg,.jpeg,.png" className="rounded-xl" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          {tooBig && <p className="text-sm text-negative-ink">The file must be 5 MB or smaller.</p>}
        </div>
        <FormError error={accept.error} />
        <DialogFooter>
          <DialogCancel />
          <Button variant="gold" disabled={!file || tooBig || accept.isPending} onClick={() => accept.mutate()}>
            {accept.isPending ? 'Saving…' : 'Upload and mark accepted'}
          </Button>
        </DialogFooter>
    </FormDialog>
  )
}

const RESPONSE: Record<NonNullable<OfferLetter['response']>, { label: string; tone: 'positive' | 'negative' }> = {
  ACCEPTED: { label: 'Accepted online', tone: 'positive' },
  DECLINED: { label: 'Declined online', tone: 'negative' },
}

// Every letter sent for the offer, newest first, with the online answer and its proof
export function OfferLettersCard({ candidate }: { candidate: Candidate }) {
  const letters = useQuery(orpc.candidates.offerLetters.list.queryOptions({ input: { id: candidate.id } }))
  const [error, setError] = useState<string | null>(null)
  if (!letters.data?.length) return null
  // the revision among the letters of the same kind (the Letter of Intent and the offer are counted apart)
  const revisionOf = (letter: OfferLetter) => letters.data.filter((l) => l.kind === letter.kind && l.revision < letter.revision).length
  const numbers = [candidate.loiNumber && `Letter of Intent ${candidate.loiNumber}`, `offer number ${candidate.offerNumber ?? '—'}`].filter(Boolean).join(' · ')
  return (
    <section className="space-y-3 rounded-3xl bg-card p-5 shadow-card">
      <SectionTitle title="Letters sent" description={`${numbers.charAt(0).toUpperCase()}${numbers.slice(1)}. A changed offer is sent again as a new revision.`} />
      {error && <p className="text-sm text-negative-ink">{error}</p>}
      <ul className="divide-y">
        {letters.data.map((letter) => (
          <li key={letter.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
            <div className="min-w-0 space-y-1 text-sm">
              <p className="flex flex-wrap items-center gap-2 font-medium">
                {SENT_KIND[letter.kind as SentKind] ?? 'Letter'}
                {revisionOf(letter) > 0 && ` · revision ${revisionOf(letter)}`}
                <span className="text-xs font-normal text-muted-foreground">· {letter.template.name}</span>
                {letter.isCurrent && <Pill tone="info">Current</Pill>}
                {letter.response && <Pill tone={RESPONSE[letter.response].tone}>{RESPONSE[letter.response].label}</Pill>}
              </p>
              <p className="text-xs text-muted-foreground">
                Sent {formatDoneBy(letter.sentAt, letter.sentBy)} · {letter.emailedAt ? `e-mailed ${formatDateTime(letter.emailedAt)}` : 'not e-mailed'}
              </p>
              {letter.respondedAt && (
                <p className="text-xs text-muted-foreground">
                  {letter.response === 'ACCEPTED' ? `Accepted as "${letter.responseName}"` : 'Declined'} on {formatDateTime(letter.respondedAt)} · IP {letter.responseIp ?? '—'}
                  {letter.declineReason && ` · "${letter.declineReason}"`}
                </p>
              )}
              {letter.respondedAt && <p className="truncate font-mono text-xs text-muted-foreground" title="SHA-256 fingerprint of the exact PDF the candidate answered">PDF fingerprint {letter.sha256}</p>}
            </div>
            <Button variant="ghost" size="sm" onClick={() => void openPdf(() => client.candidates.offerLetters.download({ id: letter.id }), setError)}>
              <Download /> PDF
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}
