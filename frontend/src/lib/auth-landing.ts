/**
 * Where the address bar goes around sign-in.
 * An explicit sign-out opens a clean login and the next person lands on home.
 * A session that expires on a deep link returns there after the same person signs in.
 */
const INTENT_KEY = 'rashmi.auth.intent';
const RETURN_KEY = 'rashmi.returnTo';

function safePath(value: string | null): string | null {
  if (value === null || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/login')) return null;
  return value;
}

export function markSignedOut(): void {
  sessionStorage.setItem(INTENT_KEY, 'sign-out');
  sessionStorage.removeItem(RETURN_KEY);
}

/** Path to show while the login screen is up. */
export function loginLandingPath(pathname: string, search: string): string {
  if (sessionStorage.getItem(INTENT_KEY) === 'sign-out') {
    sessionStorage.removeItem(INTENT_KEY);
    sessionStorage.removeItem(RETURN_KEY);
    return '/login';
  }
  const current = `${pathname}${search}`;
  const deepLink = safePath(current);
  if (deepLink !== null && deepLink !== '/') sessionStorage.setItem(RETURN_KEY, deepLink);
  return '/login';
}

/** Path to open once sign-in succeeds. */
export function pathAfterSignIn(): string {
  const back = safePath(sessionStorage.getItem(RETURN_KEY));
  sessionStorage.removeItem(RETURN_KEY);
  sessionStorage.removeItem(INTENT_KEY);
  return back ?? '/';
}
