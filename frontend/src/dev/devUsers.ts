/**
 * DEV-ONLY seed accounts (login is by userid / e-code — docs/11 §0.1).
 * These are throwaway credentials for local development ONLY: all share the
 * password `password123`. They must never reach a shared/staging/prod DB, and
 * this map must never carry real statutory data (CLAUDE.md §5).
 *
 * Replace with the real employee master (seeded from EMS, keyed on userid) and
 * a live auth call once the backend auth module lands. This file exists purely
 * so the login screen resolves a name/role during frontend development.
 */

interface DevUser {
  readonly userid: string;
  readonly name: string;
  readonly role: string;
}

const DEV_USERS: readonly DevUser[] = [
  { userid: 'RML035384', name: 'Jagganath Jena', role: 'super_admin' },
  { userid: 'RML033903', name: 'Vivek Kumar', role: 'hr_admin' },
  { userid: 'RML002116', name: 'Chaman Singh', role: 'payroll_admin' },
  { userid: 'RML041220', name: 'Ananda S', role: 'finance' },
  { userid: 'RML050471', name: 'Lildhari Prasad', role: 'hod_manager' },
  { userid: 'RML061845', name: 'Ritu Sharma', role: 'recruiter' },
  { userid: 'RML072390', name: 'Sameer Roy', role: 'approver' },
  { userid: 'RML088102', name: 'Priya Nair', role: 'employee' },
];

/** Case-insensitive lookup by userid; undefined for an unknown e-code. */
export function findDevUser(userid: string): DevUser | undefined {
  const key = userid.trim().toUpperCase();
  return DEV_USERS.find((u) => u.userid.toUpperCase() === key);
}

/** First name for the greeting; falls back to the raw userid. */
export function firstName(user: DevUser | undefined, userid: string): string {
  if (user === undefined) return userid.trim().toUpperCase();
  return user.name.split(' ')[0] ?? user.name;
}
