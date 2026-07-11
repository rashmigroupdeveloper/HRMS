/**
 * Application routes (docs/05 deep links + locked `/executive`).
 * Product pages that are not yet built render PlaceholderPage so nav works.
 */
import { Navigate, Route, Routes } from 'react-router-dom';
import type { SessionUser } from '../lib/session';
import { hasRole } from '../lib/session';
import { AppShell } from './AppShell';
import { RoleHomePage } from '../pages/home/RoleHomePage';
import { DirectoryPage } from '../pages/people/DirectoryPage';
import { ProfilePage } from '../pages/people/ProfilePage';
import { GalleryPage } from '../pages/dev/GalleryPage';
import { PlaceholderPage } from '../pages/PlaceholderPage';

interface AppRouterProps {
  user: SessionUser;
  onSignedOut: () => void;
}

export function AppRouter({ user, onSignedOut }: AppRouterProps) {
  return (
    <Routes>
      <Route element={<AppShell user={user} onSignedOut={onSignedOut} />}>
        <Route index element={<RoleHomePage user={user} />} />
        <Route path="people" element={<DirectoryPage />} />
        <Route path="people/:ecode" element={<ProfilePage />} />

        <Route
          path="approvals"
          element={
            <PlaceholderPage title="Approvals" description="Inbox UI ships with Stage 1.3 frontend (P1-T12)." />
          }
        />
        <Route
          path="approvals/:id"
          element={<PlaceholderPage title="Request detail" />}
        />

        <Route
          path="my/attendance"
          element={<PlaceholderPage title="My Attendance" description="Stage 1.7 — P1-T43." />}
        />
        <Route
          path="my/leave"
          element={<PlaceholderPage title="My Leave" description="Stage 1.5 / 1.7 — P1-T43." />}
        />
        <Route
          path="my/pay"
          element={<PlaceholderPage title="My Pay" description="Phase 2 — ESS payslip (P2-T08)." />}
        />
        <Route
          path="my/claims"
          element={<PlaceholderPage title="My Claims" description="Phase 2 — P2-T10." />}
        />
        <Route
          path="my/team"
          element={<PlaceholderPage title="My Team" description="Stage 1.7 — P1-T42 roster grid." />}
        />

        <Route
          path="attendance"
          element={<PlaceholderPage title="Attendance Ops" description="Stage 1.7 — muster, exceptions, devices." />}
        />
        <Route path="attendance/muster" element={<PlaceholderPage title="Muster summary" />} />
        <Route path="attendance/exceptions" element={<PlaceholderPage title="Unmatched swipes" />} />
        <Route path="attendance/devices" element={<PlaceholderPage title="Device health" />} />
        <Route path="attendance/month-lock" element={<PlaceholderPage title="Month lock" />} />

        <Route path="leave" element={<PlaceholderPage title="Leave Admin" />} />
        <Route path="payroll/*" element={<PlaceholderPage title="Payroll" description="Phase 2 console." />} />
        <Route path="loans" element={<PlaceholderPage title="Loans & Advances" />} />
        <Route path="claims" element={<PlaceholderPage title="Claims" />} />
        <Route path="lifecycle/*" element={<PlaceholderPage title="Lifecycle" description="Phase 3." />} />
        <Route path="assets" element={<PlaceholderPage title="Assets" description="Phase 3." />} />
        <Route path="helpdesk" element={<PlaceholderPage title="Helpdesk" description="Phase 3." />} />
        <Route path="engagement" element={<PlaceholderPage title="Engagement" description="Phase 3." />} />
        <Route path="reports" element={<PlaceholderPage title="Reports" description="Catalog fills across Phases 1–3." />} />
        <Route
          path="executive"
          element={
            <PlaceholderPage
              title="Executive dashboard"
              description="CEO dashboard at /executive — Phase 3 (docs/05 §4.8)."
            />
          }
        />

        <Route path="admin/users" element={<PlaceholderPage title="Users & Roles" />} />
        <Route path="admin/settings" element={<PlaceholderPage title="Settings" />} />
        <Route path="admin/audit" element={<PlaceholderPage title="Audit log" />} />

        <Route path="travel/*" element={<PlaceholderPage title="Travel & Expense" description="Phase 3.5." />} />
        <Route path="recruitment/*" element={<PlaceholderPage title="Recruitment" description="Phase 4 ATS." />} />

        <Route
          path="dev/gallery"
          element={
            hasRole(user, 'super_admin') ? (
              <GalleryPage />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
