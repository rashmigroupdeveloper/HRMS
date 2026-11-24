import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { FormError } from '@/components/FormError'
import { SecurityRulesSkeleton } from '@/components/skeletons/access/SecurityRulesSkeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { client, orpc } from '@/lib/orpc'
import { formatDoneBy } from '@/lib/utils'
import { needsConfirmation, useConfirmPassword } from './useConfirmPassword'

// The security rules (2026-11-16, inspired by the old HRMS's Settings page): lockout, how long a sign-in lasts, the
// password rules, how long codes and a re-entered password count. Roles & access: View to see, Edit to change (with
// the password re-entered). They apply from the next sign-in / password change.

type Rules = Awaited<ReturnType<typeof client.accounts.security.get>>['rules']
type RuleKey = keyof Rules

// Each rule in plain words, grouped, with its unit and the bounds the server accepts
const GROUPS: { title: string; rules: { key: RuleKey; label: string; unit: string; hint: string; min: number; max: number }[] }[] = [
  {
    title: 'Wrong passwords',
    rules: [
      { key: 'maxFailedLogins', label: 'Wrong passwords before the login is locked', unit: 'tries', hint: 'In a row; a correct password starts the count again.', min: 3, max: 20 },
      { key: 'lockMinutes', label: 'The lock lasts', unit: 'minutes', hint: 'Roles & access: Edit can unlock earlier.', min: 1, max: 1440 },
    ],
  },
  {
    title: 'Sign-in',
    rules: [{ key: 'sessionHours', label: 'A sign-in lasts', unit: 'hours', hint: 'From signing in (168 hours = 7 days); not made longer by using the app.', min: 1, max: 720 }],
  },
  {
    title: 'Passwords',
    rules: [
      { key: 'minPasswordLength', label: 'Shortest password', unit: 'characters', hint: 'It also needs a letter and a digit, and not the employee code.', min: 8, max: 64 },
      { key: 'passwordHistory', label: 'A new password may not be one of the last', unit: 'passwords', hint: 'The one in use counts.', min: 1, max: 24 },
    ],
  },
  {
    title: 'Codes and confirmations',
    rules: [
      { key: 'resetCodeMinutes', label: 'A "forgot password" code works for', unit: 'minutes', hint: 'The code e-mailed to the personal e-mail.', min: 5, max: 60 },
      { key: 'confirmPasswordMinutes', label: 'After re-entering the password, changing roles is allowed for', unit: 'minutes', hint: 'Then the password is asked again.', min: 1, max: 60 },
    ],
  },
]

export function SecurityRules({ canChange, onDirtyChange }: { canChange: boolean; onDirtyChange: (dirty: boolean) => void }) {
  const queryClient = useQueryClient()
  const current = useQuery(orpc.accounts.security.get.queryOptions())
  const [draft, setDraft] = useState<Record<RuleKey, string> | null>(null)
  const [saved, setSaved] = useState(false)
  const { confirmThen, dialog } = useConfirmPassword()
  const save = useMutation(
    orpc.accounts.security.update.mutationOptions({
      onSuccess: (data) => {
        queryClient.setQueryData(orpc.accounts.security.get.queryKey(), data)
        void queryClient.invalidateQueries({ queryKey: orpc.accounts.me.key() })
        setDraft(null)
        setSaved(true)
      },
      onError: (error, input) => {
        if (needsConfirmation(error)) confirmThen(() => save.mutate(input), true)
      },
    }),
  )

  const draftChanged = !!draft && !!current.data && (Object.keys(current.data.rules) as RuleKey[]).some((key) => draft[key] !== String(current.data.rules[key]))
  useEffect(() => onDirtyChange(draftChanged), [draftChanged, onDirtyChange])

  if (current.isPending) return <SecurityRulesSkeleton groups={GROUPS} canChange={canChange} label="Loading the security rules" />
  if (current.error) return <FormError error={current.error} />
  const { rules, defaults, isDefault, updatedAt, updatedBy } = current.data
  const values = draft ?? (Object.fromEntries(Object.entries(rules).map(([k, v]) => [k, String(v)])) as Record<RuleKey, string>)
  const changed = (Object.keys(rules) as RuleKey[]).some((k) => values[k] !== String(rules[k]))
  const allNumbers = (Object.keys(rules) as RuleKey[]).every((k) => /^\d+$/.test(values[k]))
  const set = (key: RuleKey, value: string) => {
    setSaved(false)
    setDraft({ ...values, [key]: value })
  }
  const submit = () => {
    const input = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, Number(v)])) as Rules
    setSaved(false)
    confirmThen(() => save.mutate(input))
  }

  return (
    <section className="space-y-5 rounded-3xl bg-card p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-light tracking-tight">
            <ShieldCheck className="size-5" /> Security rules
          </h2>
          <p className="text-xs text-muted-foreground">
            {isDefault ? 'The standard rules - nobody has changed them.' : `Last changed ${formatDoneBy(updatedAt, updatedBy)}.`} They apply from the next
            sign-in or password change.
          </p>
        </div>
        {canChange && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              disabled={save.isPending || (Object.keys(defaults) as RuleKey[]).every((k) => values[k] === String(defaults[k]))}
              onClick={() => setDraft(Object.fromEntries(Object.entries(defaults).map(([k, v]) => [k, String(v)])) as Record<RuleKey, string>)}
            >
              Standard rules
            </Button>
            <Button variant="gold" disabled={!changed || !allNumbers || save.isPending} onClick={submit}>
              {save.isPending ? 'Saving…' : 'Save rules'}
            </Button>
          </div>
        )}
      </div>
      {saved && !changed && <p className="rounded-2xl bg-positive/10 px-4 py-2 text-sm text-positive-ink">Saved. The new rules apply from the next sign-in.</p>}
      {save.error && !needsConfirmation(save.error) && <FormError error={save.error} />}

      <div className="grid gap-5 md:grid-cols-2">
        {GROUPS.map((group) => (
          <fieldset key={group.title} className="space-y-3 rounded-2xl bg-surface-2/60 p-4">
            <legend className="text-sm font-medium text-foreground">{group.title}</legend>
            {group.rules.map((rule) => (
              <div key={rule.key} className="space-y-1">
                <Label htmlFor={`rule-${rule.key}`} className="text-[13px]">
                  {rule.label}
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id={`rule-${rule.key}`}
                    type="number"
                    inputMode="numeric"
                    min={rule.min}
                    max={rule.max}
                    disabled={!canChange || save.isPending}
                    className="h-9 w-24 rounded-xl tabular-nums"
                    value={values[rule.key]}
                    onChange={(e) => set(rule.key, e.target.value)}
                  />
                  <span className="text-sm text-muted-foreground">{rule.unit}</span>
                  {values[rule.key] !== String(defaults[rule.key]) && <span className="text-xs text-muted-foreground">(standard: {defaults[rule.key]})</span>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {rule.hint} Between {rule.min} and {rule.max}.
                </p>
              </div>
            ))}
          </fieldset>
        ))}
      </div>
      {dialog}
    </section>
  )
}
