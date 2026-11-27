import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Download, FileCheck2 } from 'lucide-react'
import { DialogCancel, FormDialog } from '@/components/FormDialog'
import { FormError } from '@/components/FormError'
import { Button } from '@/components/ui/button'
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { client, orpc } from '@/lib/orpc'
import { downloadFile, formatDateTime } from '@/lib/utils'
import { REGISTER_DRAFT_HINT, REGISTER_LABEL, RELEASE_LABEL, RELEASE_NOTE } from './payroll-labels'

type Run = Awaited<ReturnType<typeof client.payroll.get>>
type Payslips = NonNullable<Run['payslips']>

// The salary register of a run as Excel (payroll stage 6) - every person's days and amounts; marked DRAFT until the run
// is final. Payroll and Salary View over the whole company (the page shows it only with the salaries).
export function RegisterButton({ runId, final }: { runId: number; final: boolean }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button
        variant="secondary"
        className="min-h-9 gap-1.5 rounded-full"
        title={final ? 'Excel' : REGISTER_DRAFT_HINT}
        disabled={pending}
        aria-busy={pending}
        onClick={async () => {
          setPending(true)
          setError(null)
          try {
            await downloadFile(() => client.payroll.register.export({ runId }), setError)
          } finally {
            setPending(false)
          }
        }}
      >
        <Download className="size-4" aria-hidden />{pending ? 'Preparing…' : REGISTER_LABEL}
      </Button>
      {error && <span role="alert" className="max-w-72 text-right text-xs text-negative-ink">{error}</span>}
    </span>
  )
}

// Where a final run's payslips stand (stage 6): not released yet (and "Release payslips" for someone who may), or
// released - by whom, when, with which template - and how many are made
export function PayslipsLine({ runId, payslips }: { runId: number; payslips: Payslips }) {
  const [releasing, setReleasing] = useState(false)
  const making = payslips.releasedAt && payslips.made < payslips.total
  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-2/60 px-3 py-2 text-xs">
      <p className="min-w-0">
        <span className="font-medium">Payslips: </span>
        {payslips.releasedAt
          ? `released by ${payslips.releasedBy?.name ?? '—'}, ${formatDateTime(payslips.releasedAt)}${payslips.template ? ` with “${payslips.template.name}”` : ''} · ${payslips.made} of ${payslips.total} made${making ? ' - the rest within a few minutes' : ''}. Each employee sees theirs in self-service.`
          : 'not released yet - employees see them once they are released.'}
      </p>
      {payslips.canRelease && (
        <Button size="sm" className="gap-1.5 rounded-full" onClick={() => setReleasing(true)}>
          <FileCheck2 className="size-4" aria-hidden />{RELEASE_LABEL}
        </Button>
      )}
      {releasing && <ReleaseDialog runId={runId} templates={payslips.templates} close={() => setReleasing(false)} />}
    </div>
  )
}

function ReleaseDialog({ runId, templates, close }: { runId: number; templates: Payslips['templates']; close: () => void }) {
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? 0)
  const queryClient = useQueryClient()
  const release = useMutation({
    ...orpc.payroll.payslips.release.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orpc.payroll.key() })
      close()
    },
  })
  return (
    <FormDialog onOpenChange={close} className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{RELEASE_LABEL}?</DialogTitle>
        <DialogDescription>{RELEASE_NOTE}</DialogDescription>
      </DialogHeader>
      {templates.length ? (
        <div className="space-y-1.5">
          <Label htmlFor="ps-template">Payslip template</Label>
          <NativeSelect id="ps-template" className="w-full [&_select]:h-10" value={String(templateId)} onChange={(e) => setTemplateId(Number(e.target.value))} disabled={release.isPending}>
            {templates.map((t) => <NativeSelectOption key={t.id} value={String(t.id)}>{t.name}</NativeSelectOption>)}
          </NativeSelect>
        </div>
      ) : (
        <p className="rounded-xl bg-warning/10 px-3 py-2 text-sm text-warning-ink">
          There is no active payslip template yet. <Link to="/manage/letter-templates/new?kind=PAYSLIP" className="underline underline-offset-4">Add one on Letter templates</Link>, then release.
        </p>
      )}
      <FormError error={release.error} />
      <DialogFooter>
        <DialogCancel />
        <Button disabled={!templates.length || release.isPending} onClick={() => release.mutate({ runId, templateId })}>{release.isPending ? 'Releasing…' : RELEASE_LABEL}</Button>
      </DialogFooter>
    </FormDialog>
  )
}
