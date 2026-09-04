/**
 * App root — session gate + router (docs/05 deep links).
 * Product chrome lives in AppShell; design-system gallery at /dev/gallery.
 *
 * Logged-out visitors still need a Router: ESS-01 reset lives at
 * /reset-password?token= outside AppShell, while every other path shows login.
 */
import { useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { LoginPage } from './pages/auth/LoginPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { AppRouter } from './app/router';
import {
  loadSession,
  reloadSession,
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
      <BrowserRouter>
        <Routes>
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route
            path="*"
            element={
              <LoginPage
                onSuccess={(user) => {
                  setSession(user);
                }}
                loadSession={loadSession}
              />
            }
          />
        </Routes>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <AppRouter
        user={session}
        onSignedOut={() => {
          setSession(null);
        }}
        onSessionChanged={() => {
          // Step-up, MFA changes and password changes all alter what /auth/me
          // reports, and the shell reads that for nav + the step-up window.
          void reloadSession().then((refreshed) => {
            if (refreshed !== null) setSession(refreshed);
          });
        }}
      />
    </BrowserRouter>
  );
}
