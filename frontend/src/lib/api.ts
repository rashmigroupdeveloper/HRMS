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

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body !== undefined) {
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

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(body?.message ?? `Request failed (${String(res.status)})`, res.status);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
