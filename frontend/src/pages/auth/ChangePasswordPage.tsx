import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, LogOut } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { FormError } from '@/components/FormError'
import { SessionsList } from '@/components/SessionsList'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { orpc } from '@/lib/orpc'

// Change your own password. With a temporary password (a new login or an admin reset) every other page sends the
// employee here first. Rules (checked by the backend; length and history from the security rules): a minimum length, a letter and a digit, not the employee code, not
// one of the last 5 passwords. Below: where the employee is signed in, to log other devices out.
export function ChangePasswordPage() {
  const me = useCurrentUser()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const forced = me.data?.mustChangePassword === true
  const change = useMutation(
    orpc.accounts.changePassword.mutationOptions({
      onSuccess: async () => {
        // everything, not only accounts.me: the layout's own calls (attendance, approvals) failed on the temporary password
        await queryClient.invalidateQueries()
        if (forced) void navigate('/', { replace: true })
      },
    }),
  )
  const mismatch = repeat !== '' && repeat !== newPassword
  // where I am signed in (not while on a temporary password - those APIs wait until it is changed)
  const sessions = useQuery({ ...orpc.accounts.sessions.mine.queryOptions(), enabled: me.data !== undefined && !forced })
  const endOne = useMutation(orpc.accounts.sessions.end.mutationOptions({ onSuccess: () => void sessions.refetch() }))
  const endOthers = useMutation(orpc.accounts.sessions.endAll.mutationOptions({ onSuccess: () => void sessions.refetch() }))
  const others = (sessions.data ?? []).filter((s) => !s.current).length

  return (
    <div className="mx-auto max-w-md space-y-6">
      <header>
        <p className="text-sm text-muted-foreground">Your login</p>
        <h1 className="mt-1 text-3xl font-light tracking-tight">Change password</h1>
        {forced && (
          <p className="mt-3 rounded-2xl bg-gold-soft px-4 py-3 text-sm">
            You signed in with a temporary password. Choose your own password to continue.
          </p>
        )}
      </header>

      <form
        className="space-y-4 rounded-3xl bg-card p-6 shadow-card"
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          change.mutate({ currentPassword, newPassword })
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="current-password">{forced ? 'Temporary password' : 'Current password'}</Label>
          <Input id="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-password">New password</Label>
          <Input id="new-password" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          <p className="text-xs text-muted-foreground">
            At least {me.data?.passwordRule.minLength ?? 10} characters, with a letter and a digit, not containing your employee code, and not one of your last{' '}
            {me.data?.passwordRule.history ?? 5} passwords.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="repeat-password">New password again</Label>
          <Input id="repeat-password" type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
          {mismatch && <p className="text-xs text-negative-ink">The two new passwords are not the same.</p>}
        </div>
        <FormError error={change.error} />
        {change.isSuccess && !forced && <p className="text-sm text-positive-ink">Password changed. Your other devices were logged out.</p>}
        <Button type="submit" variant="gold" className="w-full" disabled={!currentPassword || !newPassword || repeat !== newPassword || change.isPending}>
          <KeyRound /> {change.isPending ? 'Saving…' : 'Change password'}
        </Button>
      </form>

      {!forced && (
        <section className="space-y-2 rounded-3xl bg-card p-6 shadow-card">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-light tracking-tight">Where you are signed in</h2>
            {others > 0 && me.data && (
              <Button variant="ghost" size="sm" disabled={endOthers.isPending} onClick={() => endOthers.mutate({ employeeCode: me.data.employeeCode })}>
                <LogOut /> Log out other devices
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">A device you do not recognise? Log it out and change your password.</p>
          <FormError error={sessions.error ?? endOne.error ?? endOthers.error} />
          {sessions.data && <SessionsList limit={5} sessions={sessions.data} ending={endOne.isPending} onEnd={(s) => endOne.mutate({ sessionId: s.id })} />}
        </section>
      )}
    </div>
  )
}
