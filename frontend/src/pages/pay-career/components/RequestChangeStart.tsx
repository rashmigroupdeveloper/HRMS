import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { EmployeePicker, type PickedEmployee } from '@/components/EmployeePicker'
import { DialogCancel, FormDialog } from '@/components/FormDialog'
import { FormError } from '@/components/FormError'
import { Button } from '@/components/ui/button'
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useAccess } from '@/hooks/useAccess'
import { orpc } from '@/lib/orpc'
import { RequestChangeDrawer } from './RequestChangeDrawer'

// "Request a change" on Pay & career - "Raise a change" (the user, 2026-11-21 - moved off the employee's profile, which
// only shows the record): pick the employee, then the change form opens for them. Only employees the viewer may ask a change
// for ("Request job changes", or "Request salary changes" with Employee · Salary View, covering them) go on to the form - never
// themselves (someone who looks after them asks for it).
export function RequestChangeStart({ onClose }: { onClose: () => void }) {
  const { me, covers } = useAccess()
  const [picked, setPicked] = useState<PickedEmployee | null>(null)
  const [chosen, setChosen] = useState<string | null>(null)
  const profile = useQuery({ ...orpc.employees.getByCode.queryOptions({ input: { employeeCode: chosen ?? '' } }), enabled: chosen !== null })
  const e = profile.data
  const here = e && { companyId: e.company.id, plantId: e.plant.id, departmentId: e.department?.id ?? null }
  const self = !!e && e.employeeCode === me?.employeeCode
  const may = !!here && !self && (covers('JOB_CHANGE_REQUEST', 'WRITE', here) || (covers('SALARY_CHANGE_REQUEST', 'WRITE', here) && covers('SALARY', 'READ', here)))

  if (e && may) return <RequestChangeDrawer employee={e} onClose={onClose} />
  return (
    <FormDialog onOpenChange={(open) => !open && onClose()} dirty={picked !== null} className="rounded-3xl sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Request a change</DialogTitle>
        <DialogDescription>Pick the employee - the change form opens for them.</DialogDescription>
      </DialogHeader>
      <div className="space-y-1.5">
        <Label htmlFor="request-employee" className="text-xs text-muted-foreground">
          Employee
        </Label>
        <EmployeePicker
          id="request-employee"
          value={picked?.employeeCode ?? ''}
          onChange={(employee) => {
            setPicked(employee)
            setChosen(null)
          }}
        />
      </div>
      <FormError error={profile.error} />
      {self && <p className="text-sm text-negative-ink">You cannot ask for a change of your own job or salary - someone who looks after you asks for it.</p>}
      {e && !self && !may && <p className="text-sm text-negative-ink">You cannot ask for changes for {e.employeeCode} - they are outside the data access of your request roles.</p>}
      <DialogFooter>
        <DialogCancel />
        <Button variant="gold" disabled={!picked || profile.isFetching} onClick={() => setChosen(picked!.employeeCode)}>
          {profile.isFetching ? 'Opening…' : 'Continue'}
        </Button>
      </DialogFooter>
    </FormDialog>
  )
}
