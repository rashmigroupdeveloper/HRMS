/**
 * Presentation helpers for the signed-in user — initials, a friendly greeting
 * name, and the human label for their highest-privilege role. Shared by the
 * sidebar account menu (and anywhere else identity is shown) so the derivation
 * lives in exactly one place.
 */
import type { SessionUser } from '../lib/session';

/** Highest-privilege role first (docs/08 order). */
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

export function primaryRoleLabel(roles: string[]): string {
  for (const code of ROLE_ORDER) if (roles.includes(code)) return ROLE_LABELS[code] ?? code;
  return roles[0] ?? 'Employee';
}

export function accountInitials(user: SessionUser): string {
  const source = user.email.split('@')[0] ?? user.email;
  const parts = source.split(/[.\-_\s]+/).filter(Boolean);
  const letters = (
    parts.length >= 2 ? `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}` : source.slice(0, 2)
  ).toUpperCase();
  return letters || 'U';
}
