/**
 * App root — session gate + router (docs/05 deep links).
 * Product chrome lives in AppShell; design-system gallery at /dev/gallery.
 */
import { useEffect, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { LoginPage } from './pages/auth/LoginPage';
import { AppRouter } from './app/router';
import {
  loadSession,
  restoreSession,
  type SessionUser,
} from './lib/session';

export function App() {
  const [session, setSession] = useState<SessionUser | 'checking' | null>('checking');

  useEffect(() => {
    void restoreSession().then(setSession);
  }, []);

  if (session === 'checking') {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="flex items-center gap-2.5 opacity-70">
          <span className="grid size-9 animate-pulse place-items-center rounded-full bg-hero text-sm font-bold text-hero-ink">
            R
          </span>
          <span className="text-sm font-semibold text-ink">Rashmi HRMS</span>
        </div>
      </div>
    );
  }

  if (session === null) {
    return (
      <LoginPage
        onSuccess={(user) => {
          setSession(user);
        }}
        loadSession={loadSession}
      />
    );
  }

  return (
    <BrowserRouter>
      <AppRouter
        user={session}
        onSignedOut={() => {
          setSession(null);
        }}
      />
    </BrowserRouter>
  );
}
