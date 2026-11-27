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
// the company registers them with EPFO, and an ESIC IP number from ESIC. With them, the payroll facts the candidate never
// answers (payroll stage 4, approved 2026-11-27): PF on full wages, EPS membership and the income-tax regime. Only changed
// values are sent; an emptied number is cleared.

type Numbers = { uan: string | null; pfNumber: string | null; esicIpNumber: string | null; pfOnFullWages?: boolean; epsMember?: boolean; taxRegime?: 'NEW' | 'OLD' }

const FIELDS: FieldDef[] = [
  { name: 'uan', label: 'UAN (12 digits)', placeholder: 'From the EPFO portal' },
  { name: 'pfNumber', label: 'PF member number', placeholder: 'e.g. WBCAL0012345000000123' },
  { name: 'esicIpNumber', label: 'ESIC IP number (10 digits)' },
  { name: 'pfOnFullWages', label: 'PF on full wages', type: 'yesno', group: 'For payroll', hint: 'PF above the wage ceiling - the joint option of employee and company' },
  { name: 'epsMember', label: 'In the pension scheme (EPS)', type: 'yesno', group: 'For payroll', hint: 'No for a member outside EPS (e.g. joined after Sep 2014 above the ceiling)' },
  {
    name: 'taxRegime',
    label: 'Income-tax regime',
    type: 'select',
    group: 'For payroll',
    options: [{ value: 'NEW', label: 'New (default)' }, { value: 'OLD', label: 'Old - HR types the monthly TDS' }],
    hint: 'For the current tax year',
  },
]

export function StatutoryNumbersDialog({ employeeCode, current, onClose }: { employeeCode: string; current: Numbers | null; onClose: () => void }) {
  const queryClient = useQueryClient()
  // (no PF / ESIC row yet: the payroll facts show their defaults)
  const [initial] = useState(() => toFormValues(FIELDS, { pfOnFullWages: false, epsMember: true, taxRegime: 'NEW', ...current }))
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
          <DialogTitle>PF, ESIC and payroll</DialogTitle>
          <DialogDescription>
            The numbers given after joining - the UAN and PF member number once the employee is registered with EPFO, the ESIC IP number from ESIC - and how payroll deducts PF and income tax for them.
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
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
    </FormDialog>
  )
}
