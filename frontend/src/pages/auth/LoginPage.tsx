/**
 * LoginPage — the product's front door (docs/05 Warm Editorial). The login
 * identifier is the **employee ID / e-code** (docs/11 §0.1: `userid` = the
 * greytHR e-code, e.g. `RML035384`) — admins may use their EMAIL instead;
 * the backend accepts either in the same field.
 * Composed entirely from `frontend/src/ui` (§0.1 firewall) — no new primitives.
 *
 * Wired to the real API (7 Jul 2026): POST /api/auth/login → stores the access
 * token; the refresh token rides an httpOnly cookie the browser manages.
 *
 * Form doctrine enforced (docs/05 §241): labels above, validation on blur,
 * error below naming the fix, focus jumps to the first invalid field on submit,
 * errors announced via `role="alert"`.
 */
import { useRef, useState } from 'react';
import type { CSSProperties, SyntheticEvent } from 'react';
import { IdCard, Lock, ShieldCheck } from 'lucide-react';
import { Button, Checkbox, StatusBadge, TextField, ThemeToggle } from '../../ui';
import { type SessionUser } from '../../lib/session';
import { ForgotPasswordPanel } from './ForgotPasswordPanel';

interface LoginPageProps {
  /** Called with the authenticated user once the server accepts the login. */
  onSuccess?: (user: SessionUser) => void;
  /** Load roles/permissions via /auth/me after the access token is issued. */
  loadSession: (accessToken: string) => Promise<SessionUser>;
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
// Admin/service accounts sign in with their email in the same field.
const EMAIL_RE = /^\S+@\S+\.\S+$/;

function validateEmployeeId(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return 'Enter your employee ID (or email) to sign in.';
  if (!ECODE_RE.test(trimmed) && !EMAIL_RE.test(trimmed))
    return 'Enter a valid employee ID (e.g. RML035384) or your email address.';
  return undefined;
}

function validatePassword(value: string): string | undefined {
  if (!value) return 'Enter your password.';
  return undefined;
}

const IDENTIFIER_KEY = 'rashmi.login.identifier';

function enterDelay(ms: number): CSSProperties {
  return { '--enter-delay': `${String(ms)}ms` } as CSSProperties;
}

function readRememberedIdentifier(): string {
  try {
    return localStorage.getItem(IDENTIFIER_KEY) ?? '';
  } catch {
    return '';
  }
}

export function LoginPage({ onSuccess, loadSession }: LoginPageProps) {
  const remembered = readRememberedIdentifier();
  const [employeeId, setEmployeeId] = useState(remembered);
  const [password, setPassword] = useState('');
  const [rememberIdentifier, setRememberIdentifier] = useState(remembered.length > 0);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Touched>({
    employeeId: false,
    password: false,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [panel, setPanel] = useState<'login' | 'forgot'>('login');

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
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // receive the httpOnly refresh cookie
        body: JSON.stringify({ identifier: employeeId.trim(), password }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        // Server messages are user-safe (e.g. lockout with retry time).
        setFormError(body?.message ?? 'We couldn’t sign you in. Check your details and try again.');
        return;
      }

      const body = (await res.json()) as { accessToken: string };
      try {
        if (rememberIdentifier) {
          localStorage.setItem(IDENTIFIER_KEY, employeeId.trim());
        } else {
          localStorage.removeItem(IDENTIFIER_KEY);
        }
      } catch {
        /* private mode — remembering the ID is a convenience, not a requirement */
      }
      const user = await loadSession(body.accessToken);
      onSuccess?.(user);
    } catch {
      setFormError('Can’t reach the server. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Brand panel — the single charcoal hero surface (§1 rule 2), grain-textured.
          Hidden on small screens where the form leads. */}
      <aside className="u-grain relative hidden flex-col justify-between overflow-hidden bg-hero px-12 py-14 text-hero-ink lg:flex">
        <div className="u-enter flex items-center gap-2.5" style={enterDelay(0)}>
          <span className="grid size-9 place-items-center rounded-full bg-accent text-sm font-bold text-accent-ink">
            R
          </span>
          <span className="text-sm font-semibold">Rashmi HRMS</span>
        </div>

        <div className="u-enter max-w-lg" style={enterDelay(50)}>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color-mix(in_srgb,var(--hero-ink)_78%,var(--hero-muted))]">
            One platform · 14 entities
          </p>
          <h1 className="mt-5 text-5xl font-light leading-[1.12] tracking-tight">
            <span className="block">People, attendance and payroll</span>
            <span className="relative mt-2 inline-block pb-1">
              finally in one place.
              <span className="u-gold-sweep absolute inset-x-0 -bottom-0.5 h-0.5 rounded-full bg-accent" aria-hidden />
            </span>
          </h1>
          <p className="mt-6 max-w-md text-sm leading-relaxed text-[color-mix(in_srgb,var(--hero-ink)_72%,var(--hero-muted))]">
            Sign in with your Rashmi Group employee ID to reach your dashboard,
            requests and payslips.
          </p>
        </div>

        <div
          className="u-enter flex items-center gap-2 text-xs text-[color-mix(in_srgb,var(--hero-ink)_72%,var(--hero-muted))]"
          style={enterDelay(110)}
        >
          <ShieldCheck className="size-4" aria-hidden />
          Sessions expire automatically. Sign in with your Rashmi employee ID.
        </div>
      </aside>

      {/* Form panel */}
      <main className="relative flex flex-col items-center justify-center px-6 py-12">
        <div className="absolute right-6 top-6">
          <ThemeToggle />
        </div>

        <div
          className="u-enter u-shadow-float w-full max-w-md rounded-card bg-surface p-8 sm:p-10"
          style={enterDelay(40)}
        >
          {/* Compact brand mark for the mobile layout where the aside is hidden. */}
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="grid size-9 place-items-center rounded-full bg-hero text-sm font-bold text-hero-ink">
              R
            </span>
            <span className="text-sm font-semibold text-ink">Rashmi HRMS</span>
          </div>

          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {panel === 'login' ? 'Employee sign-in' : 'Password reset'}
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
            {panel === 'login' ? 'Sign in to your account' : 'Forgot your password?'}
          </h2>

          {panel === 'forgot' ? (
            <ForgotPasswordPanel
              initialIdentifier={employeeId || remembered}
              validateIdentifier={validateEmployeeId}
              onBack={() => {
                setPanel('login');
              }}
            />
          ) : (
          <form
            aria-label="Employee sign-in"
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
              label="Employee ID or email"
              type="text"
              name="employeeId"
              autoComplete="username"
              spellCheck={false}
              placeholder="e.g. RML035384"
              leadingIcon={<IdCard />}
              value={employeeId}
              onChange={(e) => {
                // E-codes are uppercase; emails must stay as typed.
                const v = e.target.value;
                setEmployeeId(v.includes('@') ? v : v.toUpperCase());
              }}
              onBlur={() => {
                handleBlur('employeeId');
              }}
              error={touched.employeeId ? errors.employeeId : undefined}
              required
              autoFocus={remembered.length === 0}
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
              autoFocus={remembered.length > 0}
            />

            <div className="flex flex-wrap items-start justify-between gap-3 pt-1">
              <Checkbox
                label="Remember my employee ID"
                checked={rememberIdentifier}
                onChange={(event) => {
                  setRememberIdentifier(event.target.checked);
                }}
              />
              <button
                type="button"
                className="rounded text-sm font-medium text-ink underline-offset-4 hover:underline"
                onClick={() => {
                  setPanel('forgot');
                }}
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
          )}

          <p className="mt-8 text-xs leading-relaxed text-ink-muted">
            Trouble signing in? Contact HR Ops at{' '}
            <a
              href="mailto:hrms-support@rashmigroup.com"
              className="font-medium text-ink underline-offset-4 hover:underline"
            >
              hrms-support@rashmigroup.com
            </a>
            . Access is provisioned by IT during onboarding.
          </p>
        </div>
      </main>
    </div>
  );
}
