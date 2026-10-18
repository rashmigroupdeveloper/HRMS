/**
 * Thin authenticated fetch helper — Bearer access token + credentials for the
 * refresh cookie. OpenAPI-generated client replaces this in a later stage.
 */
import { getAccessToken, refreshAccessToken, clearAccessToken } from './session';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Authenticated drop-in for `fetch`: Bearer token, refresh cookie, one retry
 * after a 401 refresh. Returns the raw Response (callers check `res.ok`).
 */
export async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body !== undefined && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  let token = getAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  let res = await fetch(path, { ...init, headers, credentials: 'include' });
  if (res.status === 401 && !path.startsWith('/api/auth/')) {
    token = await refreshAccessToken(token);
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
      res = await fetch(path, { ...init, headers, credentials: 'include' });
    } else {
      clearAccessToken();
    }
  }
  return res;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await authFetch(path, init);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(body?.message ?? `Request failed (${String(res.status)})`, res.status);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Server-supplied error message from a failed Response, or the fallback. */
export async function responseError(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { message?: string } | null;
  return body?.message ?? fallback;
}
