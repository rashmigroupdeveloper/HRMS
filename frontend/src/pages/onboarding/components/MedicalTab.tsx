import { useMutation, useQueryClient } from '@tanstack/react-query'
import { PhoneCall } from 'lucide-react'
import { useState } from 'react'
import { FormError } from '@/components/FormError'
import { Button } from '@/components/ui/button'
import { useAccess } from '@/hooks/useAccess'
import { client, orpc } from '@/lib/orpc'
import { formatDate, formatDateTime } from '@/lib/utils'
import { FieldsGrid, SectionTitle } from '@/components/FormFields'
import { type FieldDef, fromFormValues, toFormValues } from '@/lib/form-values'
import { type Candidate, joiningDatePassed, joiningDayCome, MEDICAL_RESULT, toOptions } from './labels'
import { Pill } from '@/components/Pill'

type MedicalInput = Parameters<typeof client.candidates.recordMedical>[0]

const MEDICAL_FIELDS: FieldDef[] = [
  { name: 'result', label: 'Result', type: 'select', required: true, options: toOptions(MEDICAL_RESULT) },
  { name: 'examDate', label: 'Exam date', type: 'date', required: true },
  { name: 'examiner', label: 'Doctor / clinic', required: true, wide: true },
  { name: 'restrictions', label: 'Restrictions (required for "fit with restrictions")', type: 'textarea', wide: true },
]

// Pre-employment medical + the "are you still joining?" call.
export function MedicalTab({ candidate }: { candidate: Candidate }) {
  const queryClient = useQueryClient()
  const refresh = () => queryClient.invalidateQueries({ queryKey: orpc.candidates.key() })
  // Changes only before joining, and only with edit access to onboarding
  const canChange = useAccess().can('ONBOARDING', 'WRITE')
  const editable = candidate.status === 'ACCEPTED' && canChange
  const [values, setValues] = useState(() =>
    toFormValues(MEDICAL_FIELDS, {
      result: candidate.medicalResult,
      examDate: candidate.medicalExamDate,
      examiner: candidate.medicalExaminer,
      restrictions: candidate.medicalRestrictions,
    }),
  )
  const record = useMutation(orpc.candidates.recordMedical.mutationOptions({ onSuccess: () => void refresh() }))
  const confirm = useMutation(orpc.candidates.confirmJoining.mutationOptions({ onSuccess: () => void refresh() }))
  const noMedical = candidate.joiningType === 'OVERSEAS'

  return (
    <div className="space-y-4">
      <section className="space-y-4 rounded-3xl bg-card p-5 shadow-card">
        <SectionTitle
          title="Pre-employment medical"
          description={noMedical ? 'Not needed for the Overseas joining pack.' : 'Needed to join (Regular, Consultant & Intern). If the doctor gives a certificate, upload it on the Documents tab as "Medical fitness certificate" (optional).'}
        />
        {candidate.medicalResult ? (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-surface-2 px-4 py-3 text-sm">
            <Pill tone={candidate.medicalResult === 'FIT' ? 'positive' : candidate.medicalResult === 'UNFIT' ? 'negative' : 'warning'}>
              {MEDICAL_RESULT[candidate.medicalResult]}
            </Pill>
            <span>
              {formatDate(candidate.medicalExamDate)} · {candidate.medicalExaminer}
            </span>
            {candidate.medicalRestrictions && <span className="text-muted-foreground">— {candidate.medicalRestrictions}</span>}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No result recorded yet.</p>
        )}
        {editable && (
          <>
            <FieldsGrid fields={MEDICAL_FIELDS} values={values} onChange={(name, v) => setValues((s) => ({ ...s, [name]: v }))} />
            <FormError error={record.error} />
            <div className="flex justify-end">
              <Button disabled={record.isPending} onClick={() => record.mutate({ id: candidate.id, ...fromFormValues(MEDICAL_FIELDS, values) } as MedicalInput)}>
                {record.isPending ? 'Saving…' : candidate.medicalResult ? 'Replace result' : 'Record result'}
              </Button>
            </div>
          </>
        )}
      </section>

      <section className="space-y-4 rounded-3xl bg-card p-5 shadow-card">
        <SectionTitle
          title="Joining confirmation"
          description={
            candidate.joiningConfirmedAt
              ? `A few days before ${formatDate(candidate.proposedJoiningDate)}, call the candidate and confirm they are still joining.`
              : joiningDatePassed(candidate)
                ? `The joining date (${formatDate(candidate.proposedJoiningDate)}) has passed. Call the candidate: if they are joining on another day, change the date with Edit - then confirm before that day.`
                : joiningDayCome(candidate)
                  ? `Today is the joining day - no confirmation call is needed now (it is not required to join). If the candidate is not coming today, change the date with Edit.`
                  : `A few days before ${formatDate(candidate.proposedJoiningDate)}, call the candidate and confirm they are still joining.`
          }
        />
        {candidate.joiningConfirmedAt ? (
          <Pill tone="positive">Confirmed on {formatDateTime(candidate.joiningConfirmedAt)}</Pill>
        ) : (
          <Pill tone="neutral">Not confirmed yet</Pill>
        )}
        <FormError error={confirm.error} />
        {/* only before the joining day (the API refuses it from that day on) */}
        {editable && !joiningDayCome(candidate) && (
          <div className="flex justify-end">
            <Button disabled={confirm.isPending} onClick={() => confirm.mutate({ id: candidate.id })}>
              <PhoneCall /> {candidate.joiningConfirmedAt ? 'Confirmed again' : 'Candidate confirmed joining'}
            </Button>
          </div>
        )}
      </section>
    </div>
  )
}
