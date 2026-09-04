/**
 * Top-bar account menu — the signed-in user in the top-right corner (the
 * conventional place), with a self-service dropdown (docs/05 §3 identity +
 * §6 ≤2-click). Every item is scoped to the account holder: "View my info"
 * opens their own profile (/me). Privacy and DPO contact are permanent here
 * (PRV-10 — a privacy link that is hard to find is not a privacy link).
 * Warm Editorial only (§0.1): charcoal avatar, warm surfaces, right-aligned
 * menu, no glass.
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Lock, LogOut, Mail, UserRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ApiError, apiFetch } from '../lib/api';
import type { SessionUser } from '../lib/session';
import { logout } from '../lib/session';
import { accountInitials, primaryRoleLabel } from './user-display';

interface AccountMenuProps {
  user: SessionUser;
  onSignedOut: () => void;
}

interface MenuLink {
  to: string;
  label: string;
  icon: LucideIcon;
}

interface DpoContact {
  name: string;
  email: string;
  phone?: string | null;
  responseSlaDays?: number | null;
}

// Self-service, account-holder-only. Privacy sits with View my info — never
// buried under "More" alone (Stage 5.3 UI contract).
const MENU: MenuLink[] = [
  { to: '/me', label: 'View my info', icon: UserRound },
  { to: '/my/privacy', label: 'Privacy', icon: Lock },
  { to: '/my/letters', label: 'My documents', icon: FileText },
];

export function AccountMenu({ user, onSignedOut }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const [dpo, setDpo] = useState<DpoContact | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (event: MouseEvent): void => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Fetch once — DPO contact is published org-wide and changes rarely.
  useEffect(() => {
    void apiFetch<DpoContact>('/api/privacy/dpo')
      .then(setDpo)
      .catch((caught: unknown) => {
        if (caught instanceof ApiError && caught.status === 404) {
          setDpo(null);
          return;
        }
        setDpo(null);
      });
  }, []);

  const role = primaryRoleLabel(user.roles);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
        }}
        className="u-press u-shadow-card grid size-10 place-items-center rounded-full bg-hero text-xs font-bold text-hero-ink transition-transform hover:brightness-110"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        title={`${user.email} · ${role}`}
      >
        {accountInitials(user)}
      </button>

      {open && (
        <div
          role="menu"
          className="u-shadow-float absolute right-0 top-full z-40 mt-2 w-64 origin-top-right overflow-hidden rounded-tile bg-surface"
          style={{ animation: 'u-pop var(--motion-short) var(--ease-out-strong)' }}
        >
          <div className="border-b border-line/60 px-4 py-3">
            <p className="truncate text-sm font-semibold text-ink">{user.email}</p>
            <p className="mt-0.5 text-xs text-ink-muted">{role}</p>
          </div>
          <div className="p-1.5">
            {MENU.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                }}
                className="u-press flex items-center gap-2.5 rounded-row px-3 py-2 text-sm font-medium text-ink hover:bg-surface-2"
              >
                <item.icon className="size-4 shrink-0 text-ink-muted" aria-hidden />
                {item.label}
              </Link>
            ))}

            {/* PRV-10 — DPO contact is never buried; always visible when published. */}
            {dpo === null ? null : (
              <>
                <div className="my-1 h-px bg-line/60" />
                <a
                  href={`mailto:${dpo.email}`}
                  role="menuitem"
                  className="u-press flex items-start gap-2.5 rounded-row px-3 py-2 text-left text-sm font-medium text-ink hover:bg-surface-2"
                  onClick={() => {
                    setOpen(false);
                  }}
                >
                  <Mail className="mt-0.5 size-4 shrink-0 text-ink-muted" aria-hidden />
                  <span className="min-w-0">
                    <span className="block">Data Protection Officer</span>
                    <span className="mt-0.5 block truncate text-xs font-normal text-ink-muted">
                      {dpo.name} · {dpo.email}
                    </span>
                  </span>
                </a>
              </>
            )}

            <div className="my-1 h-px bg-line/60" />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                void logout().finally(onSignedOut);
              }}
              className="u-press flex w-full items-center gap-2.5 rounded-row px-3 py-2 text-left text-sm font-medium text-ink hover:bg-surface-2"
            >
              <LogOut className="size-4 shrink-0 text-ink-muted" aria-hidden />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
