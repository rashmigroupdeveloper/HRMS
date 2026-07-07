/**
 * LoginPage — the product's front door (docs/05 Warm Editorial). The login
 * identifier is the **employee ID / e-code** (docs/11 §0.1: `userid` = the
 * greytHR e-code, e.g. `RML035384`, the same format as the greytHR ESS login).
 * Composed entirely from `frontend/src/ui` (§0.1 firewall) — no new primitives.
 *
 * This screen is UI-only for now: it validates input and shows the loading /
 * error states the real Stage-0.4 auth flow (JWT issuer + lockout, P0-T20) will
 * drive. The submit handler is a stub the auth service replaces later.
 *
 * Form doctrine enforced (docs/05 §241): labels above, validation on blur,
 * error below naming the fix, focus jumps to the first invalid field on submit,
 * errors announced via `role="alert"`.
 */
import { useRef, useState } from 'react';
import type { SyntheticEvent } from 'react';
import { IdCard, Lock, ShieldCheck } from 'lucide-react';
import { Button, StatusBadge, TextField, ThemeToggle } from '../../ui';

interface LoginPageProps {
  /** Called with the entered userid once credentials validate. */
  onSuccess?: (userid: string) => void;
}

interface FieldErrors {
  employeeId?: string | undefined;
  password?: string | undefined;
}

interface Touched {
  employeeId: boolean;
  password: boolean;
}

// E-code shape: an entity prefix (letters) + a numeric run. Verified against the
// live EMS master (1,066 e-codes, Jul 2026): prefixes run 3–5 letters
// (RML, RGH, RDL, RPL, KIOL, EIPLL, RMLUK…) and the numeric tail is as short as
// 2 digits for 5 records — so the check stays DELIBERATELY loose: the server is
// the source of truth, and blocking a real ID is far worse than missing a typo.
const ECODE_RE = /^[A-Z]{2,6}\d{2,}$/;

function validateEmployeeId(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return 'Enter your employee ID to sign in.';
  if (!ECODE_RE.test(trimmed))
    return 'That doesn’t look like a valid employee ID — e.g. RML035384.';
  return undefined;
}

function validatePassword(value: string): string | undefined {
  if (!value) return 'Enter your password.';
  return undefined;
}

export function LoginPage({ onSuccess }: LoginPageProps) {
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Touched>({
    employeeId: false,
    password: false,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const idRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // Validate on blur (never on keystroke — docs/05 §241).
  function handleBlur(field: 'employeeId' | 'password') {
    setTouched((t) => ({ ...t, [field]: true }));
    setErrors((prev) => ({
      ...prev,
      [field]:
        field === 'employeeId'
          ? validateEmployeeId(employeeId)
          : validatePassword(password),
    }));
  }

  async function handleSubmit(e: SyntheticEvent) {
    e.preventDefault();
    setFormError(null);

    const nextErrors: FieldErrors = {
      employeeId: validateEmployeeId(employeeId),
      password: validatePassword(password),
    };
    setErrors(nextErrors);
    setTouched({ employeeId: true, password: true });

    // Focus the first invalid field on submit (docs/05 §241 focus-management).
    if (nextErrors.employeeId) {
      idRef.current?.focus();
      return;
    }
    if (nextErrors.password) {
      passwordRef.current?.focus();
      return;
    }

    setSubmitting(true);
    try {
      // Stub: the Stage-0.4 auth service (JWT issuer, P0-T20) replaces this.
      await new Promise((resolve) => setTimeout(resolve, 900));
      onSuccess?.(employeeId);
    } catch {
      setFormError('We couldn’t sign you in. Check your details and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel — the single charcoal hero surface (§1 rule 2), grain-textured.
          Hidden on small screens where the form leads. */}
      <aside className="u-grain relative hidden flex-col justify-between bg-hero p-12 text-hero-ink lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-full bg-accent text-sm font-bold text-accent-ink">
            R
          </span>
          <span className="text-sm font-semibold">Rashmi HRMS</span>
        </div>

        <div className="max-w-md">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-hero-muted">
            One platform · 14 entities
          </p>
          <h1 className="mt-4 text-4xl font-light leading-[1.1] tracking-tight">
            People, attendance and payroll — finally in one place.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-hero-muted">
            Sign in with your Rashmi Group employee ID to reach your dashboard,
            requests and payslips.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-hero-muted">
          <ShieldCheck className="size-4" aria-hidden />
          Secured with single sign-on · sessions expire automatically
        </div>
      </aside>

      {/* Form panel */}
      <main className="relative flex flex-col items-center justify-center px-6 py-12">
        <div className="absolute right-6 top-6">
          <ThemeToggle />
        </div>

        <div className="w-full max-w-sm">
          {/* Compact brand mark for the mobile layout where the aside is hidden. */}
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="grid size-9 place-items-center rounded-full bg-hero text-sm font-bold text-hero-ink">
              R
            </span>
            <span className="text-sm font-semibold text-ink">Rashmi HRMS</span>
          </div>

          <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
            Welcome back
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
            Sign in to your account
          </h2>

          <form
            onSubmit={(e) => {
              void handleSubmit(e);
            }}
            noValidate
            className="mt-8 space-y-4"
          >
            {formError && (
              <div role="alert">
                <StatusBadge tone="negative">{formError}</StatusBadge>
              </div>
            )}

            <TextField
              ref={idRef}
              label="Employee ID"
              type="text"
              name="employeeId"
              autoComplete="username"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="e.g. RML035384"
              leadingIcon={<IdCard />}
              value={employeeId}
              onChange={(e) => {
                // E-codes are uppercase; normalise as the user types.
                setEmployeeId(e.target.value.toUpperCase());
              }}
              onBlur={() => {
                handleBlur('employeeId');
              }}
              error={touched.employeeId ? errors.employeeId : undefined}
              required
              autoFocus
            />

            <TextField
              ref={passwordRef}
              label="Password"
              type="password"
              name="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              leadingIcon={<Lock />}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
              }}
              onBlur={() => {
                handleBlur('password');
              }}
              error={touched.password ? errors.password : undefined}
              required
            />

            <div className="flex items-center justify-between pt-1">
              <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-ink-muted">
                <input
                  type="checkbox"
                  className="size-4 rounded accent-[var(--accent)]"
                />
                Keep me signed in
              </label>
              <button
                type="button"
                className="rounded text-sm font-medium text-ink-muted underline-offset-4 hover:text-ink hover:underline"
              >
                Forgot password?
              </button>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={submitting}
              className="w-full"
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <p className="mt-8 text-xs leading-relaxed text-ink-faint">
            Trouble signing in? Contact HR Ops at{' '}
            <span className="text-ink-muted">hrms-support@rashmigroup.com</span>
            . Access is provisioned by IT during onboarding.
          </p>
        </div>
      </main>
    </div>
  );
}
