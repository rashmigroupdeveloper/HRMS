import { useMutation, useQueryClient } from '@tanstack/react-query'
import { IdCard, Lock } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { hasAccess } from '@/hooks/useAccess'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { orpc } from '@/lib/orpc'
import { errorMessage } from '@/lib/utils'
import { AuthLayout } from './components/AuthLayout'
import { TestAccounts } from './components/TestAccounts'

// Where to go after signing in when no `next` page was asked for
function startPage(user: Parameters<typeof hasAccess>[0]) {
  return hasAccess(user, 'ONBOARDING') ? '/onboarding' : '/'
}

// Employee sign-in: employee code or work e-mail + password ("Forgot password?" -> ForgotPasswordPage)
export function LoginPage() {
  const me = useCurrentUser()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [params] = useSearchParams()
  // the employee code or the work e-mail
  const [loginName, setLoginName] = useState('')
  const isEmail = loginName.includes('@')
  const [password, setPassword] = useState('')

  const login = useMutation(
    orpc.accounts.login.mutationOptions({
      onSuccess: (user) => {
        queryClient.setQueryData(orpc.accounts.me.queryKey(), user)
        void navigate(user.mustChangePassword ? '/change-password' : (params.get('next') ?? startPage(user)), { replace: true })
      },
    }),
  )

  // Already logged in
  if (me.data && !login.isPending) return <Navigate to={startPage(me.data)} replace />

  return (
    <AuthLayout eyebrow="Employee sign-in" title="Sign in to your account">
      <form
        className="mt-8 space-y-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          login.mutate({ login: loginName, password })
        }}
      >
        {login.error && (
          <p role="alert" className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm font-medium text-negative-ink">
            {errorMessage(login.error)}
          </p>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="employeeCode">Employee code or work e-mail</Label>
          <div className="relative">
            <IdCard aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="employeeCode"
              autoComplete="username"
              spellCheck={false}
              placeholder="e.g. RML035384 or name@company.com"
              className="h-11 rounded-2xl pl-10"
              value={loginName}
              // codes are upper case; an e-mail is left as typed
              onChange={(event) => setLoginName(event.target.value.includes('@') ? event.target.value : event.target.value.toUpperCase())}
              autoFocus
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="password">Password</Label>
            <Link
              to={`/forgot-password${loginName.trim() && !isEmail ? `?code=${encodeURIComponent(loginName.trim())}` : ''}`}
              className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              className="h-11 rounded-2xl pl-10"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
        </div>

        <Button
          type="submit"
          variant="gold"
          size="lg"
          className="mt-2 w-full"
          disabled={login.isPending}
        >
          {login.isPending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <p className="mt-8 text-xs leading-relaxed text-muted-foreground">
        Your login comes by e-mail when you join. No e-mail address with HR? Ask HR for your password.
      </p>

      <TestAccounts
        disabled={login.isPending}
        onPick={(account) => {
          setLoginName(account.employeeCode)
          setPassword(account.password)
          login.mutate({ login: account.employeeCode, password: account.password })
        }}
      />
    </AuthLayout>
  )
}
