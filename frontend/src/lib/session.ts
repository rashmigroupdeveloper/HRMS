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
let refreshInFlight: Promise<string | null> | null = null;
let generation = 0;
let loggingOut = false;

/** Serialize cookies shared by tabs; one in-flight promise also covers browsers without Web Locks. */
async function withAuthLock<T>(work: () => Promise<T>): Promise<T> {
  const locks = (navigator as Partial<Navigator>).locks;
  return locks ? locks.request('hrms.auth-cookie', work) : work();
}

function refreshWasCancelled(started: number): boolean {
  return started !== generation || loggingOut;
}

export function refreshAccessToken(failedToken?: string | null): Promise<string | null> {
  if (loggingOut) return Promise.resolve(null);
  const current = getAccessToken();
  if (failedToken && current && current !== failedToken) return Promise.resolve(current);
  if (refreshInFlight) return refreshInFlight;
  const started = generation;
  refreshInFlight = withAuthLock(async () => {
    if (refreshWasCancelled(started)) return null;
    try {
      const response = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
      if (!response.ok || refreshWasCancelled(started)) return null;
      const body = (await response.json()) as { accessToken: string };
      if (refreshWasCancelled(started)) return null;
      setAccessToken(body.accessToken);
      return body.accessToken;
    } catch { return null; }
  }).finally(() => { refreshInFlight = null; });
  return refreshInFlight;
}

export function getAccessToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setAccessToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearAccessToken(): void {
  generation += 1;
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
    const accessToken = await refreshAccessToken();
    if (!accessToken) {
      clearAccessToken();
      return null;
    }
    return await fetchMe(accessToken);
  } catch {
    clearAccessToken();
    return null;
  }
}

/** After password login — load roles/permissions via /auth/me. */
export async function loadSession(accessToken: string): Promise<SessionUser> {
  clearAccessToken();
  setAccessToken(accessToken);
  return fetchMe(accessToken);
}

/** Clears the refresh cookie server-side and the local access token. */
export async function logout(): Promise<void> {
  const token = getAccessToken();
  loggingOut = true;
  clearAccessToken();
  try {
    await refreshInFlight;
    await withAuthLock(() => fetch('/api/auth/logout', {
      method: 'POST', credentials: 'include',
      ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
    }));
  } catch {
    // Offline sign-out clears this tab; server revocation needs a reachable API.
  } finally {
    clearAccessToken();
    loggingOut = false;
  }
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
