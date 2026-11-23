import { useMutation } from '@tanstack/react-query'
import { CircleCheck, IdCard, KeyRound, Lock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { orpc } from '@/lib/orpc'
import { errorMessage } from '@/lib/utils'
import { AuthLayout } from './components/AuthLayout'

const RESEND_SECONDS = 60

// "Forgot password" (not logged in): the employee code -> a 6-digit code to the personal e-mail -> a new password.
// The API answers the same whatever the code is, so this page does not say whether the code has a login.
export function ForgotPasswordPage() {
  const [params] = useSearchParams()
  const [employeeCode, setEmployeeCode] = useState(params.get('code') ?? '')
  const [step, setStep] = useState<'ask' | 'reset' | 'done'>('ask')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  // a new code only after a minute (the API sends at most one a minute): a countdown, one second at a time
  const [secondsLeft, setSecondsLeft] = useState(0)
  useEffect(() => {
    if (secondsLeft <= 0) return
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [secondsLeft])

  const request = useMutation(
    orpc.accounts.requestPasswordReset.mutationOptions({
      onSuccess: () => {
        setStep('reset')
        setSecondsLeft(RESEND_SECONDS)
      },
    }),
  )
  const reset = useMutation(orpc.accounts.resetPasswordWithCode.mutationOptions({ onSuccess: () => setStep('done') }))
  const mismatch = repeat.length > 0 && password !== repeat

  if (step === 'done') {
    return (
      <AuthLayout eyebrow="Forgot password" title="Your password is changed">
        <p className="mt-6 flex items-start gap-2 rounded-2xl bg-positive/10 px-4 py-3 text-sm text-positive-ink">
          <CircleCheck className="mt-0.5 size-4 shrink-0" /> Sign in with your new password. You were signed out everywhere else.
        </p>
        <Button variant="gold" size="lg" className="mt-6 w-full" nativeButton={false} render={<Link to="/login" />}>
          Go to sign in
        </Button>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout eyebrow="Forgot password" title={step === 'ask' ? 'Get a code by e-mail' : 'Set a new password'}>
      {step === 'ask' ? (
        <form
          className="mt-8 space-y-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            request.mutate({ employeeCode })
          }}
        >
          <p className="text-sm leading-relaxed text-muted-foreground">
            Enter your employee code. We send a 6-digit code to the personal e-mail address HR has for you.
          </p>
          {request.error && (
            <p role="alert" className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm font-medium text-negative-ink">
              {errorMessage(request.error)}
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="employeeCode">Employee code</Label>
            <div className="relative">
              <IdCard aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="employeeCode"
                autoComplete="username"
                spellCheck={false}
                placeholder="e.g. RML035384"
                className="h-11 rounded-2xl pl-10"
                value={employeeCode}
                onChange={(event) => setEmployeeCode(event.target.value.toUpperCase())}
                autoFocus
              />
            </div>
          </div>
          <Button type="submit" variant="gold" size="lg" className="mt-2 w-full" disabled={request.isPending || !employeeCode.trim()}>
            {request.isPending ? 'Sending…' : 'Send the code'}
          </Button>
        </form>
      ) : (
        <form
          className="mt-8 space-y-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            if (!mismatch) reset.mutate({ employeeCode, code, newPassword: password })
          }}
        >
          <p className="rounded-2xl bg-surface-2 px-4 py-3 text-sm leading-relaxed text-muted-foreground">{request.data?.message}</p>
          {reset.error && (
            <p role="alert" className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm font-medium text-negative-ink">
              {errorMessage(reset.error)}
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="code">Code from the e-mail</Label>
            <div className="relative">
              <KeyRound aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="6 digits"
                maxLength={6}
                className="h-11 rounded-2xl pl-10 tracking-[0.3em] tabular-nums placeholder:tracking-normal"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
                autoFocus
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="newPassword">New password</Label>
            <div className="relative">
              <Lock aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                className="h-11 rounded-2xl pl-10"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              At least {request.data?.passwordRule.minLength ?? 10} characters, with a letter and a digit, not your employee code, and not one of your last{' '}
              {request.data?.passwordRule.history ?? 5} passwords.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="repeatPassword">New password again</Label>
            <div className="relative">
              <Lock aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="repeatPassword"
                type="password"
                autoComplete="new-password"
                className="h-11 rounded-2xl pl-10"
                value={repeat}
                onChange={(event) => setRepeat(event.target.value)}
              />
            </div>
            {mismatch && <p className="text-xs text-negative-ink">The two passwords are not the same.</p>}
          </div>
          <Button type="submit" variant="gold" size="lg" className="mt-2 w-full" disabled={reset.isPending || code.length !== 6 || !password || mismatch || !repeat}>
            {reset.isPending ? 'Saving…' : 'Set new password'}
          </Button>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <button type="button" className="underline-offset-4 hover:text-foreground hover:underline" onClick={() => setStep('ask')}>
              Another employee code
            </button>
            <button
              type="button"
              disabled={secondsLeft > 0 || request.isPending}
              className="underline-offset-4 enabled:hover:text-foreground enabled:hover:underline disabled:opacity-60"
              onClick={() => request.mutate({ employeeCode })}
            >
              {secondsLeft > 0 ? `Send again in ${secondsLeft}s` : 'Send the code again'}
            </button>
          </div>
        </form>
      )}

      <p className="mt-8 text-xs leading-relaxed text-muted-foreground">
        Remembered it?{' '}
        <Link to="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  )
}
