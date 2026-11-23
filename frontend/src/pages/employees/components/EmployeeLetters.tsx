import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, FileText, Mail, Plus, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { FormError } from '@/components/FormError'
import { LetterRowsSkeleton } from '@/components/skeletons/employees/LetterRowsSkeleton'
import { Button } from '@/components/ui/button'
import { DialogCancel, FormDialog } from '@/components/FormDialog'
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { client, orpc } from '@/lib/orpc'
import { formatDate, formatDoneBy, fromDateInput, openPdf, toDateInput } from '@/lib/utils'
import { CardTitle } from '@/components/ProfileCards'

// The letters issued to an employee (2026-11-16): appointment (issued automatically on the joining day), confirmation,
// experience, relieving, salary certificate - each kept as the PDF that was issued and e-mailed to the employee. Seen on one's own profile
// and with "Employee · Documents & letters" View; issued with "Employee · Documents & letters" Edit. Experience and relieving letters are issued
// by HR for now (later after the resignation module's approvals).

type Letter = Awaited<ReturnType<typeof client.employeeLetters.list>>[number]
type Kind = Parameters<typeof client.employeeLetters.issue>[0]['kind']

const KIND: Record<Kind, string> = {
  APPOINTMENT_LETTER: 'Appointment letter',
  CONFIRMATION_LETTER: 'Confirmation letter',
  EXPERIENCE_LETTER: 'Experience letter',
  RELIEVING_LETTER: 'Relieving letter',
  SALARY_CERTIFICATE: 'Salary certificate',
}
const KIND_HINT: Record<Kind, string> = {
  APPOINTMENT_LETTER: 'Issued automatically on the joining day; issue it here if that did not happen (no template then).',
  CONFIRMATION_LETTER: 'Needs the confirmation date on the employee record (Edit details).',
  EXPERIENCE_LETTER: 'Needs the last working day.',
  RELIEVING_LETTER: 'Needs the last working day.',
  SALARY_CERTIFICATE: 'States the salary in effect - e.g. for a bank loan.',
}
const needsLastDay = (kind: Kind) => kind === 'EXPERIENCE_LETTER' || kind === 'RELIEVING_LETTER'

export function EmployeeLetters({ employeeCode, canIssue }: { employeeCode: string; canIssue: boolean }) {
  const letters = useQuery(orpc.employeeLetters.list.queryOptions({ input: { employeeCode } }))
  const [error, setError] = useState<string | null>(null)
  const [issuing, setIssuing] = useState(false)
  const [issued, setIssued] = useState<{ letterNumber: string; emailedTo: string | null } | null>(null)

  return (
    <section className="space-y-3 rounded-3xl bg-card p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle icon={FileText}>Letters</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">Kept exactly as issued - a later change of the template does not change them.</p>
        </div>
        {canIssue && (
          <Button variant="secondary" size="sm" onClick={() => setIssuing(true)}>
            <Plus /> Issue a letter
          </Button>
        )}
      </div>
      {issued && (
        <p className="flex items-center gap-2 rounded-2xl bg-positive/10 px-4 py-3 text-sm text-positive-ink">
          <Mail className="size-4 shrink-0" /> Letter {issued.letterNumber} issued
          {issued.emailedTo ? ` and e-mailed to ${issued.emailedTo}.` : ' - not e-mailed (no e-mail address, or the e-mail failed): download it and hand it over.'}
        </p>
      )}
      {error && <p className="text-sm text-negative-ink">{error}</p>}
      <FormError error={letters.error} />
      {letters.isPending && <LetterRowsSkeleton rows={3} label="Loading the letters" />}
      {letters.data?.length === 0 && <p className="text-sm text-muted-foreground">No letters issued yet.</p>}
      {!!letters.data?.length && (
        <ul className="divide-y">
          {letters.data.map((letter: Letter) => (
            <li key={letter.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
              <div className="min-w-0 space-y-1 text-sm">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {KIND[letter.kind as Kind] ?? letter.kind}
                  <span className="text-xs font-normal text-muted-foreground">· {letter.letterNumber}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Dated {formatDate(letter.letterDate)}
                  {letter.lastWorkingDay && ` · last working day ${formatDate(letter.lastWorkingDay)}`} · issued {formatDoneBy(letter.issuedAt, letter.issuedBy)}
                  {' · '}
                  {letter.emailedTo ? `e-mailed to ${letter.emailedTo}` : 'not e-mailed'}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => void openPdf(() => client.employeeLetters.download({ id: letter.id }), setError)}>
                <Download /> PDF
              </Button>
            </li>
          ))}
        </ul>
      )}
      {issuing && (
        <IssueLetterDialog
          employeeCode={employeeCode}
          onClose={() => setIssuing(false)}
          onIssued={(result) => {
            setIssuing(false)
            setIssued(result)
          }}
        />
      )}
    </section>
  )
}

function IssueLetterDialog({
  employeeCode,
  onClose,
  onIssued,
}: {
  employeeCode: string
  onClose: () => void
  onIssued: (result: { letterNumber: string; emailedTo: string | null }) => void
}) {
  const queryClient = useQueryClient()
  const [kind, setKind] = useState<Kind>('CONFIRMATION_LETTER')
  const [picked, setPicked] = useState<string | null>(null)
  const [today] = useState(() => toDateInput(new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()))))
  const [letterDate, setLetterDate] = useState(today)
  const [lastWorkingDay, setLastWorkingDay] = useState('')
  const [previewError, setPreviewError] = useState<string | null>(null)
  const options = useQuery(orpc.employeeLetters.templates.queryOptions({ input: { employeeCode, kind } }))
  const templateId = picked ?? (options.data?.suggestedId ? String(options.data.suggestedId) : '')
  const chosen = options.data?.templates.find((t) => String(t.id) === templateId)
  const input = () => ({
    employeeCode,
    kind,
    templateId: Number(templateId),
    letterDate: fromDateInput(letterDate),
    ...(needsLastDay(kind) && { lastWorkingDay: fromDateInput(lastWorkingDay) }),
  })
  const issue = useMutation(
    orpc.employeeLetters.issue.mutationOptions({
      onSuccess: (letter) => {
        void queryClient.invalidateQueries({ queryKey: orpc.employeeLetters.key() })
        onIssued({ letterNumber: letter.letterNumber, emailedTo: letter.emailedTo })
      },
    }),
  )
  // the template the page suggests is not a change; one picked by hand is
  const dirty = kind !== 'CONFIRMATION_LETTER' || picked !== null || letterDate !== today || lastWorkingDay !== ''
  const ready = !!chosen?.ready && !!letterDate && (!needsLastDay(kind) || !!lastWorkingDay)

  return (
    <FormDialog onOpenChange={(open) => !open && onClose()} dirty={dirty} className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Issue a letter</DialogTitle>
          <DialogDescription>It gets the next letter number, is kept as a PDF and is e-mailed to the employee.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="letter-kind" className="text-xs text-muted-foreground">
              Letter<span className="text-negative-ink">*</span>
            </Label>
            <NativeSelect
              id="letter-kind"
              className="w-full [&_select]:h-10 [&_select]:rounded-xl"
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as Kind)
                setPicked(null)
              }}
            >
              {Object.entries(KIND).map(([value, label]) => (
                <NativeSelectOption key={value} value={value}>
                  {label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <p className="text-xs text-muted-foreground">{KIND_HINT[kind]}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="letter-template" className="text-xs text-muted-foreground">
              Template<span className="text-negative-ink">*</span>
            </Label>
            <NativeSelect
              id="letter-template"
              className="w-full [&_select]:h-10 [&_select]:rounded-xl"
              value={templateId}
              disabled={options.isPending}
              onChange={(e) => setPicked(e.target.value)}
            >
              <NativeSelectOption value="">{options.isPending ? 'Loading…' : 'Choose a template'}</NativeSelectOption>
              {options.data?.templates.map((t) => (
                <NativeSelectOption key={t.id} value={String(t.id)} disabled={!t.ready}>
                  {t.name}
                  {t.ready ? '' : ' - letterhead missing'}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            {options.data && options.data.templates.length === 0 && (
              <p className="flex items-center gap-1.5 text-xs text-negative-ink">
                <TriangleAlert className="size-3.5" /> There is no active {KIND[kind].toLowerCase()} template - add one on the Letter templates page.
              </p>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="letter-date" className="text-xs text-muted-foreground">
                Letter date<span className="text-negative-ink">*</span>
              </Label>
              <Input id="letter-date" type="date" className="h-10 rounded-xl" value={letterDate} onChange={(e) => setLetterDate(e.target.value)} />
            </div>
            {needsLastDay(kind) && (
              <div className="space-y-1.5">
                <Label htmlFor="letter-lwd" className="text-xs text-muted-foreground">
                  Last working day<span className="text-negative-ink">*</span>
                </Label>
                <Input id="letter-lwd" type="date" className="h-10 rounded-xl" value={lastWorkingDay} onChange={(e) => setLastWorkingDay(e.target.value)} />
              </div>
            )}
          </div>
        </div>
        {previewError && <p className="text-sm text-negative-ink">{previewError}</p>}
        <FormError error={issue.error ?? options.error} />
        <DialogFooter>
          <DialogCancel />
          <Button
            variant="secondary"
            disabled={!ready}
            onClick={() => {
              setPreviewError(null)
              void openPdf(() => client.employeeLetters.preview(input()), setPreviewError)
            }}
          >
            <FileText /> Preview
          </Button>
          <Button variant="gold" disabled={!ready || issue.isPending} onClick={() => issue.mutate(input())}>
            {issue.isPending ? 'Writing the letter…' : 'Issue'}
          </Button>
        </DialogFooter>
    </FormDialog>
  )
}
