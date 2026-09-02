/**
 * Session lifecycle (docs/02 §1).
 *
 * The model: the ACCESS token lives in sessionStorage; the REFRESH token is an
 * httpOnly cookie JavaScript can never read. The rule these tests protect is
 * that a failure to restore must land the user on the login screen with LOCAL
 * STATE CLEARED — a stale token left behind produces a half-authenticated app
 * that fails confusingly on every request.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearAccessToken,
  getAccessToken,
  hasAnyPermission,
  hasPermission,
  hasRole,
  loadSession,
  logout,
  restoreSession,
  setAccessToken,
  type SessionUser,
} from './session';

const USER: SessionUser = {
  id: 1,
  email: 'a@b.test',
  employeeId: 7,
  roles: ['hr_ops'],
  permissions: ['employee.read', 'attendance.team.read'],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('token storage', () => {
  afterEach(() => {
    clearAccessToken();
  });

  it('round-trips and clears the access token', () => {
    expect(getAccessToken()).toBeNull();
    setAccessToken('abc');
    expect(getAccessToken()).toBe('abc');
    clearAccessToken();
    expect(getAccessToken()).toBeNull();
  });
});

describe('restoreSession', () => {
  beforeEach(() => {
    clearAccessToken();
    vi.restoreAllMocks();
  });

  it('redeems the refresh cookie and returns the user', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ accessToken: 'fresh' }))
        .mockResolvedValueOnce(jsonResponse(USER)),
    );

    await expect(restoreSession()).resolves.toEqual(USER);
    // A reopened tab must not force a re-login while the refresh cookie lives.
    expect(getAccessToken()).toBe('fresh');
  });

  it('returns null and clears local state when there is no valid session', async () => {
    setAccessToken('stale');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 401 })));

    await expect(restoreSession()).resolves.toBeNull();
    expect(getAccessToken()).toBeNull();
  });

  it('returns null and clears local state when the network throws', async () => {
    setAccessToken('stale');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    await expect(restoreSession()).resolves.toBeNull();
    expect(getAccessToken()).toBeNull();
  });
});

describe('loadSession', () => {
  it('stores the token and loads roles/permissions', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(USER)));
    await expect(loadSession('tok')).resolves.toEqual(USER);
    expect(getAccessToken()).toBe('tok');
    clearAccessToken();
  });
});

describe('logout', () => {
  it('clears the local token even when the server call fails', async () => {
    setAccessToken('tok');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    await logout();
    // Best-effort server call, but the local session must always end.
    expect(getAccessToken()).toBeNull();
  });
});

describe('permission helpers', () => {
  it('hasPermission matches exactly — no prefix or wildcard behaviour', () => {
    expect(hasPermission(USER, 'employee.read')).toBe(true);
    expect(hasPermission(USER, 'employee')).toBe(false);
    expect(hasPermission(USER, 'employee.read.all')).toBe(false);
    expect(hasPermission(USER, 'employee.write')).toBe(false);
  });

  it('hasAnyPermission is true when at least one is held', () => {
    expect(hasAnyPermission(USER, ['employee.write', 'attendance.team.read'])).toBe(true);
    expect(hasAnyPermission(USER, ['payroll.run.view', 'admin.settings'])).toBe(false);
    expect(hasAnyPermission(USER, [])).toBe(false);
  });

  it('hasRole matches exactly', () => {
    expect(hasRole(USER, 'hr_ops')).toBe(true);
    expect(hasRole(USER, 'hr_head')).toBe(false);
  });
});
