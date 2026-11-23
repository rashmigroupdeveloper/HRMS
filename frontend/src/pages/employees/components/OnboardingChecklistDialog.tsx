import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { FieldsGrid } from '@/components/FormFields'
import { FormError } from '@/components/FormError'
import { Button } from '@/components/ui/button'
import { DialogCancel, FormDialog } from '@/components/FormDialog'
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { changedValues, type FieldDef, toFormValues } from '@/lib/form-values'
import { orpc } from '@/lib/orpc'

// The joining form's "For HR / Office Use Only" box (JF §11) after joining: joining formalities completed, payroll
// updated, ID card / access created, induction date. Ticking records when and by whom (the server keeps the first time).

type Checklist = { joiningFormalitiesCompletedAt: Date | null; payrollUpdatedAt: Date | null; idCardIssuedAt: Date | null; inductionDate: Date | null }

const FIELDS: FieldDef[] = [
  {
    name: 'joiningFormalitiesCompleted',
    label: 'Joining formalities completed?',
    type: 'yesno',
    hint: 'Yes once everything of the joining is done - induction, paperwork, handover. Records who and when.',
  },
  { name: 'payrollUpdated', label: 'Payroll updated?', type: 'yesno' },
  { name: 'idCardIssued', label: 'ID card / access created?', type: 'yesno' },
  { name: 'inductionDate', label: 'Induction date', type: 'date' },
]

export function OnboardingChecklistDialog({ employeeCode, current, onClose }: { employeeCode: string; current: Checklist | null; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [initial] = useState(() =>
    toFormValues(FIELDS, {
      joiningFormalitiesCompleted: !!current?.joiningFormalitiesCompletedAt,
      payrollUpdated: !!current?.payrollUpdatedAt,
      idCardIssued: !!current?.idCardIssuedAt,
      inductionDate: current?.inductionDate,
    }),
  )
  const [values, setValues] = useState(initial)
  const save = useMutation(
    orpc.employees.updateOnboardingChecklist.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: orpc.employees.key() })
        onClose()
      },
    }),
  )
  const changes = changedValues(FIELDS, initial, values) as {
    joiningFormalitiesCompleted?: boolean | null
    payrollUpdated?: boolean | null
    idCardIssued?: boolean | null
    inductionDate?: Date | null
  }

  return (
    <FormDialog onOpenChange={(open) => !open && onClose()} dirty={Object.keys(changes).length > 0} className="rounded-3xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>For HR / Office use</DialogTitle>
          <DialogDescription>The joining form's office checklist: what is done after the employee joined.</DialogDescription>
        </DialogHeader>
        <FieldsGrid fields={FIELDS} values={values} onChange={(name, value) => setValues((v) => ({ ...v, [name]: value }))} />
        <FormError error={save.error} />
        <DialogFooter>
          <DialogCancel />
          <Button
            disabled={save.isPending || Object.keys(changes).length === 0}
            onClick={() =>
              save.mutate({
                employeeCode,
                ...(changes.joiningFormalitiesCompleted !== undefined && { joiningFormalitiesCompleted: changes.joiningFormalitiesCompleted === true }),
                ...(changes.payrollUpdated !== undefined && { payrollUpdated: changes.payrollUpdated === true }),
                ...(changes.idCardIssued !== undefined && { idCardIssued: changes.idCardIssued === true }),
                ...(changes.inductionDate !== undefined && { inductionDate: changes.inductionDate }),
              })
            }
          >
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
    </FormDialog>
  )
}
