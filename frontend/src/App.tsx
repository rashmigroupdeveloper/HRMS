/**
 * App root — session gate + router (docs/05 deep links).
 * Product chrome lives in AppShell; design-system gallery at /dev/gallery.
 */
import { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { LoginPage } from './pages/auth/LoginPage';

// The signed-in app and the candidate portal are separate chunks: the login
// screen (the first paint on every phone) ships only what it needs.
const AppRouter = lazy(() => import('./app/router').then((m) => ({ default: m.AppRouter })));
const SsoAuthorizePage=lazy(()=>import('./pages/auth/SsoAuthorizePage').then(m=>({default:m.SsoAuthorizePage})));
const PrejoinPortalPage = lazy(() =>
  import('./pages/lifecycle/PrejoinPortalPage').then((m) => ({ default: m.PrejoinPortalPage })),
);
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

  if (session === 'checking') return <Splash />;

  if (window.location.pathname.startsWith('/onboard/prejoin')) {
    return (
      <BrowserRouter>
        <Suspense fallback={<Splash />}>
          <PrejoinPortalPage />
        </Suspense>
      </BrowserRouter>
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

  if(window.location.pathname.endsWith('/connect/ats'))return <Suspense fallback={<Splash />}><SsoAuthorizePage /></Suspense>;

  return (
    <BrowserRouter>
      <Suspense fallback={<Splash />}>
        <AppRouter
          user={session}
          onSignedOut={() => {
            setSession(null);
          }}
        />
      </Suspense>
    </BrowserRouter>
  );
}

function Splash() {
  return (
    <div role="status" aria-label="Loading Rashmi HRMS" className="grid min-h-screen place-items-center">
      <div className="flex items-center gap-2.5 opacity-70">
        <span className="grid size-9 animate-pulse place-items-center rounded-full bg-hero text-sm font-bold text-hero-ink">
          R
        </span>
        <span className="text-sm font-semibold text-ink">Rashmi HRMS</span>
      </div>
    </div>
  );
}
