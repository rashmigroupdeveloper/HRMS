import { beforeEach, describe, expect, it } from 'vitest';
import { loginLandingPath, markSignedOut, pathAfterSignIn } from './auth-landing';

beforeEach(() => {
  sessionStorage.clear();
});

describe('sign-in landing', () => {
  it('forgets the previous page after an explicit sign-out', () => {
    sessionStorage.setItem('rashmi.returnTo', '/my/attendance');
    markSignedOut();
    expect(loginLandingPath('/my/attendance', '')).toBe('/login');
    expect(pathAfterSignIn()).toBe('/');
  });

  it('returns to a deep link when the session expired there', () => {
    expect(loginLandingPath('/approvals/12', '?tab=mine')).toBe('/login');
    expect(pathAfterSignIn()).toBe('/approvals/12?tab=mine');
  });

  it('ignores a return path that is not an in-app route', () => {
    sessionStorage.setItem('rashmi.returnTo', '//evil.example');
    expect(pathAfterSignIn()).toBe('/');
  });
});
