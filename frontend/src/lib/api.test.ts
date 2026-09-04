/**
 * `apiFetch` — the single door every request goes through, including the
 * silent access-token refresh (docs/02 §1).
 *
 * The behaviours pinned here are the ones whose failure is invisible until it
 * is catastrophic: a refresh loop that logs the plant out mid-shift, a 401 on
 * the login call being retried forever, or an error body being swallowed so
 * the user sees "something went wrong" instead of the real reason.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, StepUpRequiredError, apiFetch } from './api';
import { getAccessToken, setAccessToken, clearAccessToken } from './session';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('apiFetch', () => {
  beforeEach(() => {
    clearAccessToken();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    clearAccessToken();
  });

  it('sends the bearer token and parses the JSON body', async () => {
    setAccessToken('tok-1');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch<{ ok: boolean }>('/api/settings')).resolves.toEqual({ ok: true });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get('Authorization')).toBe('Bearer tok-1');
    expect(init.credentials).toBe('include');
  });

  it('sets a JSON content type only when there IS a body', async () => {
    // A Response body can only be read once, so build a fresh one per call.
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({})));
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/api/settings');
    let headers = new Headers((fetchMock.mock.calls[0] as [string, RequestInit])[1].headers);
    expect(headers.get('Content-Type')).toBeNull();

    await apiFetch('/api/settings/x', { method: 'PUT', body: '{}' });
    headers = new Headers((fetchMock.mock.calls[1] as [string, RequestInit])[1].headers);
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it('refreshes once on 401, then retries the original request with the new token', async () => {
    setAccessToken('stale');
    const fetchMock = vi
      .fn()
      // 1: the original request is rejected
      .mockResolvedValueOnce(new Response('', { status: 401 }))
      // 2: the refresh succeeds
      .mockResolvedValueOnce(jsonResponse({ accessToken: 'fresh' }))
      // 3: the retry succeeds
      .mockResolvedValueOnce(jsonResponse({ value: 42 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch<{ value: number }>('/api/settings')).resolves.toEqual({ value: 42 });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(getAccessToken()).toBe('fresh');
    const retryHeaders = new Headers((fetchMock.mock.calls[2] as [string, RequestInit])[1].headers);
    expect(retryHeaders.get('Authorization')).toBe('Bearer fresh');
  });

  it('clears the token and surfaces the 401 when the refresh itself fails', async () => {
    setAccessToken('stale');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 401 }))
      .mockResolvedValueOnce(new Response('', { status: 401 })); // refresh rejected
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('/api/settings')).rejects.toBeInstanceOf(ApiError);
    // Not clearing here would leave the app retrying with a dead token forever.
    expect(getAccessToken()).toBeNull();
  });

  it('never tries to refresh an auth call — that would be an infinite loop', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      apiFetch('/api/auth/login', { method: 'POST', body: '{}' }),
    ).rejects.toBeInstanceOf(ApiError);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws ApiError carrying the server message and status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ message: 'Month already locked' }, 409)),
    );

    await expect(apiFetch('/api/attendance/month-lock', { method: 'POST', body: '{}' }))
      .rejects.toMatchObject({ message: 'Month already locked', status: 409 });
  });

  it('falls back to a status-bearing message when the error body is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('boom', { status: 500 })));

    await expect(apiFetch('/api/settings')).rejects.toMatchObject({
      message: 'Request failed (500)',
      status: 500,
    });
  });

  it('returns undefined for 204 rather than trying to parse an empty body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(apiFetch('/api/settings/x')).resolves.toBeUndefined();
  });
});

describe('StepUpRequiredError (SEC-04)', () => {
  it('is thrown — distinctly — when the server asks for a step-up', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({ message: 'Step-up required', data: { code: 'STEP_UP_REQUIRED' } }),
            { status: 403 },
          ),
        ),
      ),
    );
    await expect(apiFetch('/api/anything')).rejects.toBeInstanceOf(StepUpRequiredError);
  });

  it('leaves an ordinary 403 as a plain ApiError, so pages do not prompt wrongly', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ message: 'Missing permission: payroll.run.manage' }), {
            status: 403,
          }),
        ),
      ),
    );
    const error = await apiFetch('/api/anything').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).not.toBeInstanceOf(StepUpRequiredError);
  });
});
