/**
 * Session management — the single place the frontend touches auth state.
 *
 * Model (docs/02 §1): the ACCESS token (15 min) lives in sessionStorage and is
 * sent as a Bearer header; the REFRESH token (7 d) is an httpOnly cookie the
 * browser manages — JavaScript can never read it. On page load,
 * `restoreSession()` redeems that cookie for a fresh access token, so a
 * refresh/reopen does NOT log the user out until the refresh token expires.
 */

export interface SessionUser {
  id: number;
  email: string;
  employeeId: number | null;
  roles: string[];
  permissions: string[];
}

const TOKEN_KEY = 'hrms.accessToken';

export function getAccessToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setAccessToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearAccessToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
}

async function fetchMe(accessToken: string): Promise<SessionUser> {
  const me = await fetch('/api/auth/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!me.ok) {
    throw new Error('me failed');
  }
  return (await me.json()) as SessionUser;
}

/**
 * Try to resume the session from the httpOnly refresh cookie.
 * Returns the user, or null when there is no valid session (show login).
 */
export async function restoreSession(): Promise<SessionUser | null> {
  try {
    const refreshed = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    });
    if (!refreshed.ok) {
      clearAccessToken();
      return null;
    }
    const { accessToken } = (await refreshed.json()) as { accessToken: string };
    setAccessToken(accessToken);
    return await fetchMe(accessToken);
  } catch {
    clearAccessToken();
    return null;
  }
}

/** After password login — load roles/permissions via /auth/me. */
export async function loadSession(accessToken: string): Promise<SessionUser> {
  setAccessToken(accessToken);
  return fetchMe(accessToken);
}

/** Clears the refresh cookie server-side and the local access token. */
export async function logout(): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  } catch {
    // Best effort — local state clears regardless.
  }
  clearAccessToken();
}

export function hasPermission(user: SessionUser, code: string): boolean {
  return user.permissions.includes(code);
}

export function hasAnyPermission(user: SessionUser, codes: readonly string[]): boolean {
  return codes.some((c) => user.permissions.includes(c));
}

export function hasRole(user: SessionUser, code: string): boolean {
  return user.roles.includes(code);
}
