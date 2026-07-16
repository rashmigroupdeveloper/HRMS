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
import { ApprovalsPage } from '../pages/approvals/ApprovalsPage';
import { AttendanceOpsPage } from '../pages/attendance/AttendanceOpsPage';
import { DeviceHealthPage } from '../pages/attendance/DeviceHealthPage';
import { ExceptionsPage } from '../pages/attendance/ExceptionsPage';
import { MonthLockPage } from '../pages/attendance/MonthLockPage';
import { MyAttendancePage } from '../pages/attendance/MyAttendancePage';
import { MyLeavePage } from '../pages/leave/MyLeavePage';
import { LeaveAdminPage } from '../pages/leave/LeaveAdminPage';
import { MusterPage } from '../pages/reports/MusterPage';
import { ReportsPage } from '../pages/reports/ReportsPage';
import { ReportRunPage } from '../pages/reports/ReportRunPage';
import { BoardingExitPage } from '../pages/reports/BoardingExitPage';
import { AbsenceCasesPage } from '../pages/attendance/AbsenceCasesPage';
import { OtDecisionsPage } from '../pages/team/OtDecisionsPage';
import { PoliciesPage } from '../pages/policies/PoliciesPage';
import { LettersPage } from '../pages/letters/LettersPage';
import { MyLettersPage } from '../pages/letters/MyLettersPage';
import { TeamPage } from '../pages/team/TeamPage';
import { AccessControlPage } from '../pages/admin/AccessControlPage';
import { SettingsPage } from '../pages/admin/SettingsPage';

interface AppRouterProps {
  user: SessionUser;
  onSignedOut: () => void;
}

export function AppRouter({ user, onSignedOut }: AppRouterProps) {
  return (
    <Routes>
      <Route element={<AppShell user={user} onSignedOut={onSignedOut} />}>
        <Route index element={<RoleHomePage user={user} />} />
        <Route path="me" element={<ProfilePage self />} />
        <Route path="people" element={<DirectoryPage />} />
        <Route path="people/:ecode" element={<ProfilePage />} />

        <Route path="approvals" element={<ApprovalsPage />} />
        <Route path="approvals/:id" element={<Navigate to="/approvals" replace />} />

        <Route path="my/attendance" element={<MyAttendancePage />} />
        <Route path="my/leave" element={<MyLeavePage />} />
        <Route
          path="my/pay"
          element={<PlaceholderPage title="My Pay" description="Phase 2 — ESS payslip (P2-T08)." />}
        />
        <Route
          path="my/claims"
          element={<PlaceholderPage title="My Claims" description="Phase 2 — P2-T10." />}
        />
        <Route path="my/team" element={<TeamPage user={user} />} />
        <Route path="my/team/overtime" element={<OtDecisionsPage />} />
        <Route path="my/letters" element={<MyLettersPage />} />
        <Route path="policies" element={<PoliciesPage user={user} />} />
        <Route path="letters" element={<LettersPage />} />

        <Route path="attendance" element={<AttendanceOpsPage user={user} />} />
        <Route path="attendance/muster" element={<MusterPage />} />
        <Route path="attendance/exceptions" element={<ExceptionsPage />} />
        <Route path="attendance/devices" element={<DeviceHealthPage />} />
        <Route path="attendance/month-lock" element={<MonthLockPage />} />
        <Route path="attendance/absence-cases" element={<AbsenceCasesPage user={user} />} />

        <Route path="leave" element={<LeaveAdminPage />} />
        <Route
          path="payroll/*"
          element={<PlaceholderPage title="Payroll" description="Phase 2 console." />}
        />
        <Route path="loans" element={<PlaceholderPage title="Loans & Advances" />} />
        <Route path="claims" element={<PlaceholderPage title="Claims" />} />
        <Route
          path="lifecycle/*"
          element={<PlaceholderPage title="Lifecycle" description="Phase 3." />}
        />
        <Route path="assets" element={<PlaceholderPage title="Assets" description="Phase 3." />} />
        <Route
          path="helpdesk"
          element={<PlaceholderPage title="Helpdesk" description="Phase 3." />}
        />
        <Route
          path="engagement"
          element={<PlaceholderPage title="Engagement" description="Phase 3." />}
        />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="reports/boarding-exit" element={<BoardingExitPage user={user} />} />
        <Route path="reports/:code" element={<ReportRunPage />} />
        <Route
          path="executive"
          element={
            <PlaceholderPage
              title="Executive dashboard"
              description="CEO dashboard at /executive — Phase 3 (docs/05 §4.8)."
            />
          }
        />

        <Route path="admin/users" element={<AccessControlPage />} />
        <Route path="admin/settings" element={<SettingsPage />} />
        <Route path="admin/audit" element={<PlaceholderPage title="Audit log" />} />

        <Route
          path="travel/*"
          element={<PlaceholderPage title="Travel & Expense" description="Phase 3.5." />}
        />
        <Route
          path="recruitment/*"
          element={<PlaceholderPage title="Recruitment" description="Phase 4 ATS." />}
        />

        <Route
          path="dev/gallery"
          element={hasRole(user, 'super_admin') ? <GalleryPage /> : <Navigate to="/" replace />}
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
