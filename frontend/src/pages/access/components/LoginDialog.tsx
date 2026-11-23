import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Copy, KeyRound } from 'lucide-react'
import { useState } from 'react'
import { DrawerCancel, FormDrawer } from '@/components/FormDrawer'
import { FormError } from '@/components/FormError'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { orpc } from '@/lib/orpc'
import type { Account } from './labels'

// Give an employee a login, or reset someone's password. Either way the backend makes a temporary password that
// is shown HERE ONCE - hand it over safely; the employee must change it at the next sign-in.
export function LoginDialog({ reset, onClose }: { reset: Account | null; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [employeeCode, setEmployeeCode] = useState('')
  const [copied, setCopied] = useState(false)
  const done = () => void queryClient.invalidateQueries({ queryKey: orpc.accounts.key() })
  const create = useMutation(orpc.accounts.create.mutationOptions({ onSuccess: done }))
  const resetPassword = useMutation(orpc.accounts.resetPassword.mutationOptions({ onSuccess: done }))
  const mutation = reset ? resetPassword : create
  const result = mutation.data
  // a typed employee code not yet given a login
  const dirty = !result && !reset && !!employeeCode.trim()

  return (
    <FormDrawer
      onClose={onClose}
      dirty={dirty}
      width={460}
      title={<>{reset ? `Reset password of ${reset.name}` : 'Give a login'}</>}
      description={
        <>
          {result
            ? 'Write it down or copy it now - it is not shown again. It must be changed at the first sign-in.'
            : reset
              ? `${reset.employeeCode} gets a new temporary password and is logged out everywhere. Their roles stay.`
              : 'The employee signs in with their employee code and a temporary password. Give roles afterwards with "Change roles".'}
        </>
      }
      footer={
        <>
          <DrawerCancel>{result ? 'Done' : 'Cancel'}</DrawerCancel>
          {!result && (
            <Button
              variant="gold"
              disabled={mutation.isPending || (!reset && !employeeCode.trim())}
              onClick={() =>
                reset ? resetPassword.mutate({ employeeCode: reset.employeeCode }) : create.mutate({ employeeCode: employeeCode.trim() })
              }
            >
              <KeyRound /> {mutation.isPending ? 'Working…' : reset ? 'Reset password' : 'Give login'}
            </Button>
          )}
        </>
      }
    >
      {result ? (
        <div className="space-y-2 rounded-2xl bg-gold-soft p-4">
          <p className="text-xs text-muted-foreground">
            {result.name} · {result.employeeCode}
          </p>
          <div className="flex items-center justify-between gap-3">
            <code className="text-xl font-semibold tracking-wider">{result.temporaryPassword}</code>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                void navigator.clipboard?.writeText(result.temporaryPassword).then(() => setCopied(true))
              }}
            >
              <Copy /> {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </div>
      ) : (
        !reset && (
          <div className="space-y-1.5">
            <Label htmlFor="login-code">Employee code</Label>
            <Input
              id="login-code"
              value={employeeCode}
              onChange={(e) => setEmployeeCode(e.target.value.toUpperCase())}
              placeholder="e.g. RML035384"
              maxLength={30}
            />
          </div>
        )
      )}

      <FormError error={mutation.error} />
    </FormDrawer>
  )
}
