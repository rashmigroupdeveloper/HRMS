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

/**
 * SEC-04 — the server refused because this session is not elevated.
 *
 * A distinct error type, not a status check scattered through pages: a caller
 * catches THIS, opens the step-up dialog, and retries the exact action. The
 * user never loses what they were doing (docs/05 §6 kill-list — state
 * preservation).
 */
export class StepUpRequiredError extends ApiError {
  constructor(message: string) {
    super(message, 403);
    this.name = 'StepUpRequiredError';
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
    const raw = await res.text().catch(() => '');
    let message = `Request failed (${String(res.status)})`;
    try {
      const parsed = JSON.parse(raw) as { message?: string };
      if (typeof parsed.message === 'string' && parsed.message !== '') message = parsed.message;
    } catch {
      // A non-JSON error body is still worth surfacing as a status.
    }
    if (res.status === 403 && raw.includes('STEP_UP_REQUIRED')) {
      throw new StepUpRequiredError(message);
    }
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
