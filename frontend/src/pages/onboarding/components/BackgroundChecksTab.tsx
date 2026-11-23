import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { DrawerCancel, FormDrawer } from '@/components/FormDrawer'
import { FormError } from '@/components/FormError'
import { BackgroundChecksTableSkeleton } from '@/components/skeletons/onboarding/BackgroundChecksTableSkeleton'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAccess } from '@/hooks/useAccess'
import { client, orpc } from '@/lib/orpc'
import { errorMessage, formatDoneBy } from '@/lib/utils'
import { FieldsGrid, SectionTitle } from '@/components/FormFields'
import { changedValues, type FieldDef, fromFormValues, toFormValues } from '@/lib/form-values'
import { type BackgroundCheck, BGV_STATUS, BGV_TONE, BGV_TYPE, type Candidate, toOptions } from './labels'
import { Pill } from '@/components/Pill'

type CreateInput = Parameters<typeof client.candidates.backgroundChecks.create>[0]
type UpdateInput = Parameters<typeof client.candidates.backgroundChecks.update>[0]

const START_FIELDS: FieldDef[] = [
  { name: 'type', label: 'Check', type: 'select', required: true, options: toOptions(BGV_TYPE) },
  { name: 'subject', label: 'What is checked', placeholder: 'e.g. B.Tech, Delhi University' },
  { name: 'vendorName', label: 'BGV agency' },
  { name: 'vendorReference', label: 'Agency case id' },
]

const UPDATE_FIELDS: FieldDef[] = [
  { name: 'status', label: 'Result', type: 'select', required: true, options: toOptions(BGV_STATUS) },
  { name: 'vendorReference', label: 'Agency case id' },
  { name: 'vendorName', label: 'BGV agency' },
  { name: 'subject', label: 'What is checked' },
  { name: 'remarks', label: 'Remarks (required for discrepancy / failed)', type: 'textarea', wide: true },
]

export function BackgroundChecksTab({ candidate }: { candidate: Candidate }) {
  const queryClient = useQueryClient()
  const checks = useQuery(orpc.candidates.backgroundChecks.list.queryOptions({ input: { candidateId: candidate.id } }))
  const documents = useQuery(orpc.candidates.documents.list.queryOptions({ input: { candidateId: candidate.id } }))
  const refresh = () => queryClient.invalidateQueries({ queryKey: orpc.candidates.key() })
  // Changes only before joining, and only with edit access to onboarding
  const canChange = useAccess().can('ONBOARDING', 'WRITE')
  // People may join while checks are running, so checks stay open after joining
  const editable = (candidate.status === 'ACCEPTED' || candidate.status === 'JOINED') && canChange
  const hasConsent = documents.data?.some((d) => d.type === 'BGV_CONSENT_FORM' && d.verificationStatus !== 'REJECTED')

  const [values, setValues] = useState(() => toFormValues(START_FIELDS, {}))
  const [editing, setEditing] = useState<BackgroundCheck | null>(null)
  const start = useMutation(
    orpc.candidates.backgroundChecks.create.mutationOptions({
      onSuccess: () => {
        setValues(toFormValues(START_FIELDS, {}))
        void refresh()
      },
    }),
  )
  const remove = useMutation(orpc.candidates.backgroundChecks.delete.mutationOptions({ onSuccess: () => void refresh() }))

  return (
    <div className="space-y-4">
      {editable && (
        <section className="space-y-4 rounded-3xl bg-card p-5 shadow-card">
          <SectionTitle
            title="Start a check"
            description="Hand the case to the BGV agency, then record each result here. The candidate may join while checks are still running."
          />
          {!hasConsent && (
            <p className="rounded-2xl bg-gold-soft px-4 py-3 text-sm">
              Upload the candidate's signed <b>BGV consent form</b> in the Documents tab first - no check can start without it.
            </p>
          )}
          <FieldsGrid fields={START_FIELDS} values={values} onChange={(name, v) => setValues((s) => ({ ...s, [name]: v }))} />
          <FormError error={start.error} />
          <div className="flex justify-end">
            <Button
              disabled={start.isPending}
              onClick={() => start.mutate({ candidateId: candidate.id, ...fromFormValues(START_FIELDS, values) } as CreateInput)}
            >
              {start.isPending ? 'Starting…' : 'Start check'}
            </Button>
          </div>
        </section>
      )}

      <section className="space-y-3 rounded-3xl bg-card p-5 shadow-card">
        <SectionTitle title="Background checks" />
        <FormError error={remove.error} />
        {checks.isPending ? (
          <BackgroundChecksTableSkeleton editable={editable} label="Loading the background checks" />
        ) : checks.error ? (
          <p className="text-sm text-negative-ink">{errorMessage(checks.error)}</p>
        ) : checks.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No checks started.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Check</TableHead>
                <TableHead>Agency</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Started / completed</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {checks.data.map((check) => (
                <TableRow key={check.id}>
                  <TableCell>
                    <p className="font-medium">{BGV_TYPE[check.type]}</p>
                    {check.subject && <p className="text-xs text-muted-foreground">{check.subject}</p>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {check.vendorName ?? '—'}
                    {check.vendorReference && <span className="block text-xs">{check.vendorReference}</span>}
                  </TableCell>
                  <TableCell className="max-w-56 whitespace-normal">
                    <Pill tone={BGV_TONE[check.status]}>{BGV_STATUS[check.status]}</Pill>
                    {check.remarks && <p className="mt-1 text-xs text-muted-foreground">{check.remarks}</p>}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDoneBy(check.createdAt, check.createdBy)}
                    <span className="block">{check.completedAt ? formatDoneBy(check.completedAt, check.completedBy) : 'open'}</span>
                  </TableCell>
                  <TableCell>
                    {editable && (
                      <div className="flex justify-end gap-1">
                        <Button variant="secondary" size="sm" onClick={() => setEditing(check)}>
                          Record result
                        </Button>
                        {check.status === 'IN_PROGRESS' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label="Delete"
                            disabled={remove.isPending}
                            onClick={() => remove.mutate({ id: check.id })}
                          >
                            <Trash2 />
                          </Button>
                        )}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      {editing && (
        <UpdateCheckForm
          check={editing}
          onDone={() => {
            setEditing(null)
            void refresh()
          }}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function UpdateCheckForm({ check, onDone, onCancel }: { check: BackgroundCheck; onDone: () => void; onCancel: () => void }) {
  const [initial] = useState(() => toFormValues(UPDATE_FIELDS, check))
  const [values, setValues] = useState(initial)
  const update = useMutation(orpc.candidates.backgroundChecks.update.mutationOptions({ onSuccess: onDone }))
  // a value changed from what the check had, not saved yet
  const dirty = Object.keys(changedValues(UPDATE_FIELDS, initial, values)).length > 0 && !update.isSuccess
  return (
    <FormDrawer
      onClose={onCancel}
      dirty={dirty}
      width={460}
      title={<>{BGV_TYPE[check.type]} check</>}
      description={<>A discrepancy can later be changed to Clear once it is explained.</>}
      footer={
        <>
          <DrawerCancel />
          <Button
            disabled={update.isPending}
            onClick={() => {
              const changes = changedValues(UPDATE_FIELDS, initial, values)
              if (Object.keys(changes).length === 0) return onCancel()
              update.mutate({ id: check.id, ...changes } as UpdateInput)
            }}
          >
            {update.isPending ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <FieldsGrid fields={UPDATE_FIELDS} values={values} onChange={(name, v) => setValues((s) => ({ ...s, [name]: v }))} />
      <FormError error={update.error} />
    </FormDrawer>
  )
}
