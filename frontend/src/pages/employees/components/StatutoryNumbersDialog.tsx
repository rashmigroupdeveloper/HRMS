import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { FieldsGrid } from '@/components/FormFields'
import { FormError } from '@/components/FormError'
import { Button } from '@/components/ui/button'
import { DialogCancel, FormDialog } from '@/components/FormDialog'
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { changedValues, type FieldDef, toFormValues } from '@/lib/form-values'
import { orpc } from '@/lib/orpc'

// HR records the PF / ESIC numbers given after joining: a first-job joiner gets a UAN and a PF member number only once
// the company registers them with EPFO, and an ESIC IP number from ESIC. Only changed numbers are sent; an emptied
// one is cleared.

type Numbers = { uan: string | null; pfNumber: string | null; esicIpNumber: string | null }

const FIELDS: FieldDef[] = [
  { name: 'uan', label: 'UAN (12 digits)', placeholder: 'From the EPFO portal' },
  { name: 'pfNumber', label: 'PF member number', placeholder: 'e.g. WBCAL0012345000000123' },
  { name: 'esicIpNumber', label: 'ESIC IP number (10 digits)' },
]

export function StatutoryNumbersDialog({ employeeCode, current, onClose }: { employeeCode: string; current: Numbers | null; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [initial] = useState(() => toFormValues(FIELDS, current))
  const [values, setValues] = useState(initial)
  const save = useMutation(
    orpc.employees.updateStatutoryNumbers.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: orpc.employees.key() })
        onClose()
      },
    }),
  )
  const changes = changedValues(FIELDS, initial, values)

  return (
    <FormDialog onOpenChange={(open) => !open && onClose()} dirty={Object.keys(changes).length > 0} className="rounded-3xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>PF and ESIC numbers</DialogTitle>
          <DialogDescription>
            The numbers given after joining: the UAN and PF member number once the employee is registered with EPFO, and the ESIC IP number from ESIC.
          </DialogDescription>
        </DialogHeader>
        <FieldsGrid fields={FIELDS} values={values} onChange={(name, value) => setValues((v) => ({ ...v, [name]: value }))} />
        <FormError error={save.error} />
        <DialogFooter>
          <DialogCancel />
          <Button
            disabled={save.isPending || Object.keys(changes).length === 0}
            onClick={() => save.mutate({ employeeCode, ...(changes as Partial<Numbers>) })}
          >
            {save.isPending ? 'Saving…' : 'Save numbers'}
          </Button>
        </DialogFooter>
    </FormDialog>
  )
}
