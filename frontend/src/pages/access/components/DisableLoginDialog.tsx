import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { FormError } from '@/components/FormError'
import { Button } from '@/components/ui/button'
import { DialogCancel, FormDialog } from '@/components/FormDialog'
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { orpc } from '@/lib/orpc'
import type { Account } from './labels'

// Turns someone's login off (e.g. during a suspension): they cannot sign in although still employed, and are logged
// out everywhere. Turned back on from the People list.
export function DisableLoginDialog({ account, onClose }: { account: Account; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [reason, setReason] = useState('')
  const disable = useMutation(
    orpc.accounts.disable.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: orpc.accounts.key() })
        onClose()
      },
    }),
  )
  return (
    <FormDialog onOpenChange={(open) => !open && onClose()} dirty={!!reason.trim()} className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Turn off the login of {account.name}?</DialogTitle>
          <DialogDescription>
            {account.employeeCode} will not be able to sign in, and is logged out everywhere now. The employee record does not change. You can turn the
            login back on at any time.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <label htmlFor="disable-reason" className="text-xs font-medium text-muted-foreground">
            Why
          </label>
          <Textarea id="disable-reason" className="rounded-xl" placeholder="e.g. Suspended pending inquiry" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <FormError error={disable.error} />
        <DialogFooter>
          <DialogCancel />
          <Button variant="destructive" disabled={!reason.trim() || disable.isPending} onClick={() => disable.mutate({ employeeCode: account.employeeCode, reason: reason.trim() })}>
            {disable.isPending ? 'Turning off…' : 'Turn off login'}
          </Button>
        </DialogFooter>
    </FormDialog>
  )
}
