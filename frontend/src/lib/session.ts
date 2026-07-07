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
}

const TOKEN_KEY = 'hrms.accessToken';

// getAccessToken() lands with the Phase-1 API client (first authed data fetch).
export function setAccessToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
}

function clearAccessToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
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

    const me = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!me.ok) {
      clearAccessToken();
      return null;
    }
    return (await me.json()) as SessionUser;
  } catch {
    // Network failure ≠ logged out; but with no token we can't render data —
    // treat as anonymous and let the user sign in when connectivity returns.
    clearAccessToken();
    return null;
  }
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
