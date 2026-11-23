import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ORPCError } from '@orpc/client'
import { ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { FormError } from '@/components/FormError'
import { Button } from '@/components/ui/button'
import { DialogCancel, FormDialog } from '@/components/FormDialog'
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useAccess } from '@/hooks/useAccess'
import { orpc } from '@/lib/orpc'

// Re-entering one's password before changing roles or the security rules (decided 2026-11-16): `confirmThen(action)`
// runs the action at once when the password was entered recently (the security rules say how long), else asks for it
// first. The backend checks the same thing - an action refused because the time ran out meanwhile is asked again with
// `needsConfirmation(error)`.
export function needsConfirmation(error: unknown) {
  return error instanceof ORPCError && (error.data as { passwordConfirmationRequired?: boolean } | undefined)?.passwordConfirmationRequired === true
}

export function useConfirmPassword() {
  const { me } = useAccess()
  const queryClient = useQueryClient()
  const [pending, setPending] = useState<(() => void) | null>(null)
  const [password, setPassword] = useState('')
  const confirm = useMutation(
    orpc.accounts.confirmPassword.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: orpc.accounts.me.key() })
        const action = pending
        close()
        action?.()
      },
    }),
  )
  function close() {
    setPending(null)
    setPassword('')
    confirm.reset()
  }
  // asked when an action starts (not while drawing the page)
  const isConfirmed = () => !!me?.passwordConfirmedUntil && new Date(me.passwordConfirmedUntil).getTime() > Date.now()

  return {
    // runs `action` now, or after the password is re-entered
    confirmThen: (action: () => void, force = false) => (isConfirmed() && !force ? action() : setPending(() => action)),
    dialog: pending && (
      <FormDialog onOpenChange={(open) => !open && close()} dirty={!!password} className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5" /> Confirm it is you
            </DialogTitle>
            <DialogDescription>Changing roles, access and the security rules needs your password. You will not be asked again for a few minutes.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              if (password) confirm.mutate({ password })
            }}
          >
            <Input type="password" autoComplete="current-password" aria-label="Your password" placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
            <FormError error={confirm.error} />
            <DialogFooter>
              <DialogCancel />
              <Button type="submit" variant="gold" disabled={!password || confirm.isPending}>
                {confirm.isPending ? 'Checking…' : 'Confirm'}
              </Button>
            </DialogFooter>
          </form>
      </FormDialog>
    ),
  }
}
