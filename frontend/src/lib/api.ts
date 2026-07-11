/**
 * Thin authenticated fetch helper — Bearer access token + credentials for the
 * refresh cookie. OpenAPI-generated client replaces this in a later stage.
 */
import { getAccessToken, setAccessToken, clearAccessToken } from './session';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function tryRefresh(): Promise<string | null> {
  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { accessToken: string };
    setAccessToken(body.accessToken);
    return body.accessToken;
  } catch {
    return null;
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
    token = await tryRefresh();
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
