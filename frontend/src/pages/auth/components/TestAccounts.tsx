import { FlaskConical } from 'lucide-react'

// Development only: one-click sign-in with the test accounts, so testers do not type codes and passwords each time.
// The accounts come from VITE_TEST_ACCOUNTS in frontend/.env.development.local (never committed), as
// "CODE:password:label" separated by commas. Nothing shows in a production build or when the variable is not set.

type TestAccount = { employeeCode: string; password: string; label: string }

const ACCOUNTS: TestAccount[] = import.meta.env.DEV
  ? String(import.meta.env.VITE_TEST_ACCOUNTS ?? '')
      .split(',')
      .map((entry) => entry.trim().split(':'))
      .filter(([code, password]) => code && password)
      .map(([code, password, ...label]) => ({ employeeCode: code.trim().toUpperCase(), password, label: label.join(':').trim() }))
  : []

export function TestAccounts({ onPick, disabled }: { onPick: (account: TestAccount) => void; disabled: boolean }) {
  if (ACCOUNTS.length === 0) return null
  return (
    <section className="mt-8 rounded-2xl border border-dashed border-border p-4">
      <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <FlaskConical className="size-3.5" aria-hidden /> Test accounts - development only, click to sign in
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {ACCOUNTS.map((account) => (
          <button
            key={account.employeeCode}
            type="button"
            disabled={disabled}
            onClick={() => onPick(account)}
            className="rounded-xl bg-surface-2/70 px-3 py-2 text-left transition-colors hover:bg-surface-2 disabled:opacity-50"
          >
            <span className="block font-mono text-sm font-medium">{account.employeeCode}</span>
            {account.label && <span className="block text-xs text-muted-foreground">{account.label}</span>}
          </button>
        ))}
      </div>
    </section>
  )
}
