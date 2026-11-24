import { useQuery } from '@tanstack/react-query'
import { Circle, CircleCheck, Printer } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useAccess } from '@/hooks/useAccess'
import { client, orpc } from '@/lib/orpc'
import { cn, openPdf } from '@/lib/utils'
import type { Candidate } from './labels'

// The checklist items that are parts of the joining form itself - the candidate's required items but the offer's status
// and the online signature. Not HR's items (department, employee code series, medical, paper forms): printing checks
// only the joining form, as the backend does (printed-forms.service.ts)
const FORM_PART = (i: { key: string; who: string; required: boolean }) => i.who === 'CANDIDATE' && i.required && i.key !== 'status' && i.key !== 'signed'

// Opens HR's paper forms filled in from the joining form, ready to print and sign (before joining only)
// - only once every required part of the joining form is filled (the joining checklist's form items)
export function PrintFormsButton({ candidate, variant = 'secondary' }: { candidate: Candidate; variant?: 'secondary' | 'gold' | 'ghost' }) {
  const [error, setError] = useState<string | null>(null)
  const [opening, setOpening] = useState(false)
  const checklist = useQuery({ ...orpc.candidates.joining.checklist.queryOptions({ input: { candidateId: candidate.id } }), enabled: candidate.status === 'ACCEPTED' })
  if (candidate.status !== 'ACCEPTED') return null
  const missing = (checklist.data?.items ?? []).filter((i) => !i.ok && FORM_PART(i))
  const blocked = checklist.isPending || missing.length > 0
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button
        variant={variant}
        size="sm"
        disabled={opening || blocked}
        title={missing.length ? `Still missing: ${missing.map((i) => i.label.replace('Joining form: ', '')).join('; ')}` : undefined}
        onClick={async () => {
          setError(null)
          setOpening(true)
          await openPdf(() => client.candidates.printedForms.print({ candidateId: candidate.id }), setError)
          setOpening(false)
        }}
      >
        <Printer /> {opening ? 'Preparing…' : 'Print forms'}
      </Button>
      {missing.length > 0 && (
        <span className="max-w-56 text-right text-xs text-muted-foreground">
          Fill the joining form first - {missing.length} required {missing.length === 1 ? 'part' : 'parts'} missing
        </span>
      )}
      {error && <span className="text-xs text-negative-ink">{error}</span>}
    </span>
  )
}

// The Documents tab's card: exactly which forms this candidate signs on paper (the HR documents of the joining
// checklist), each with how far it is - print, sign on the joining day, upload the scan
export function PrintFormsCard({ candidate }: { candidate: Candidate }) {
  const canSeeMedical = useAccess().can('MEDICAL', 'READ')
  const checklist = useQuery({ ...orpc.candidates.joining.checklist.queryOptions({ input: { candidateId: candidate.id } }), enabled: candidate.status === 'ACCEPTED' })
  if (candidate.status !== 'ACCEPTED') return null
  const forms = (checklist.data?.items ?? []).filter((i) => i.who === 'HR' && i.key.startsWith('document:'))
  return (
    <section className="space-y-3 rounded-3xl bg-card p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-medium tracking-tight">Forms to sign on paper</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Print them filled in from the joining form and have {candidate.firstName} sign them on the joining day. Then upload one scan of the whole
            signed pack as "Signed forms pack (all pages)" - it counts for every form below. A form can also be uploaded on its own.
            {candidate.joiningType !== 'OVERSEAS' && !canSeeMedical && ' The medical pages are not printed for you - they need the "Employee · Medical" access.'}
          </p>
        </div>
        <PrintFormsButton candidate={candidate} variant="gold" />
      </div>
      {forms.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {forms.map((f) => {
            const state = f.ok
              ? f.detail === 'In the signed forms pack'
                ? 'Verified (in the pack)'
                : 'Verified'
              : f.detail?.startsWith('Uploaded')
                ? 'Uploaded - verify it'
                : f.detail?.startsWith('Rejected')
                  ? 'Rejected - upload again'
                  : 'To upload'
            return (
              <li
                key={f.key}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs',
                  f.ok ? 'bg-positive/10 text-positive-ink' : state === 'To upload' ? 'bg-surface-2 text-muted-foreground' : 'bg-warning/15 text-warning-ink',
                )}
              >
                {f.ok ? <CircleCheck className="size-3.5" /> : <Circle className="size-3.5" />}
                <span className="font-medium text-foreground">{f.label.replace(/ verified$/, '')}</span> · {state}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
