/**
 * Masthead identity menu — who is signed in, at a glance, with sign-out.
 * Replaces the bare sign-out icon: a professional shell always shows the user.
 */
import { useEffect, useRef, useState } from 'react';
import { LogOut, User } from 'lucide-react';
import type { SessionUser } from '../lib/session';
import { logout } from '../lib/session';

/** Human label for the highest-privilege role the user holds (docs/08 order). */
const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Administrator',
  hr_head: 'HR Head',
  payroll_admin: 'Payroll Administrator',
  hr_ops: 'HR Operations',
  plant_head: 'Plant / Business Head',
  ceo_cell: 'CEO Cell',
  it_admin: 'IT Administrator',
  senior_manager: 'Senior Manager',
  manager: 'Manager',
  employee: 'Employee',
};
const ROLE_ORDER = Object.keys(ROLE_LABELS);

function primaryRole(roles: string[]): string {
  for (const code of ROLE_ORDER) if (roles.includes(code)) return ROLE_LABELS[code] ?? code;
  return roles[0] ?? 'Employee';
}

function initials(user: SessionUser): string {
  const source = user.email.split('@')[0] ?? user.email;
  const parts = source.split(/[.\-_\s]+/).filter(Boolean);
  const letters = (parts.length >= 2 ? `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}` : source.slice(0, 2)).toUpperCase();
  return letters || 'U';
}

export function UserMenu({ user, onSignedOut }: { user: SessionUser; onSignedOut: () => void }) {
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

  const role = primaryRole(user.roles);

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
        {initials(user)}
      </button>

      {open && (
        <div
          role="menu"
          className="u-shadow-float absolute right-0 top-full z-40 mt-2 w-64 origin-top-right overflow-hidden rounded-tile bg-surface"
          style={{ animation: 'u-pop var(--motion-short) var(--ease-out-strong)' }}
        >
          <div className="flex items-center gap-3 border-b border-line/60 p-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-hero text-sm font-bold text-hero-ink">
              {initials(user)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{user.email}</p>
              <p className="mt-0.5 text-xs text-ink-muted">{role}</p>
            </div>
          </div>
          <div className="p-1.5">
            <div className="flex items-center gap-2 rounded-row px-3 py-2 text-xs text-ink-faint">
              <User className="size-3.5" aria-hidden />
              {user.employeeId ? `Employee #${String(user.employeeId)}` : 'No employee profile linked'}
            </div>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                void logout().finally(onSignedOut);
              }}
              className="u-press flex w-full items-center gap-2 rounded-row px-3 py-2 text-left text-sm font-medium text-ink hover:bg-surface-2"
            >
              <LogOut className="size-4" aria-hidden />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
