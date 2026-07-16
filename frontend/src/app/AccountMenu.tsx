/**
 * Top-bar account menu — the signed-in user in the top-right corner (the
 * conventional place), with a self-service dropdown (docs/05 §3 identity +
 * §6 ≤2-click). Every item is scoped to the account holder: "View my info"
 * opens their own profile (/me). Warm Editorial only (§0.1): charcoal avatar,
 * warm surfaces, right-aligned menu, no glass.
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, LogOut, UserRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
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

// Self-service, account-holder-only. Both routes already exist (router.tsx).
const MENU: MenuLink[] = [
  { to: '/me', label: 'View my info', icon: UserRound },
  { to: '/my/letters', label: 'My documents', icon: FileText },
];

export function AccountMenu({ user, onSignedOut }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
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

  const role = primaryRoleLabel(user.roles);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
        }}
        className="u-press grid size-9 place-items-center rounded-full bg-hero text-xs font-bold text-hero-ink ring-1 ring-line/40 transition-transform hover:brightness-110"
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
