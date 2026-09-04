/**
 * Application routes (docs/05 deep links + locked `/executive`).
 * Every product route resolves to a real page. Surfaces whose BACKEND lands in
 * a later phase render their real layout plus an honest pending panel — never
 * invented data (docs/05 §4.8).
 */
import { Navigate, Route, Routes } from 'react-router-dom';
import type { SessionUser } from '../lib/session';
import { hasRole } from '../lib/session';
import { AppShell } from './AppShell';
import { RoleHomePage } from '../pages/home/RoleHomePage';
import { DirectoryPage } from '../pages/people/DirectoryPage';
import { ProfilePage } from '../pages/people/ProfilePage';
import { GalleryPage } from '../pages/dev/GalleryPage';
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
import {
  R2SwipesPage,
  R3RegularizationsPage,
  R4ExceptionsPage,
  R5OtPage,
  R6AbsencePage,
  R24BoardingPage,
  R27HeadcountPage,
} from '../pages/reports/SupportingReports';
import { TeamPage } from '../pages/team/TeamPage';
import { OtDecisionsPage } from '../pages/team/OtDecisionsPage';
import { AbsenceCasesPage } from '../pages/attendance/AbsenceCasesPage';
import { PoliciesPage } from '../pages/policies/PoliciesPage';
import { LettersPage } from '../pages/letters/LettersPage';
import { MyLettersPage } from '../pages/letters/MyLettersPage';
import { AccessControlPage } from '../pages/admin/AccessControlPage';
import { SettingsPage } from '../pages/admin/SettingsPage';
import { AuditLogPage } from '../pages/admin/AuditLogPage';
import { WorkflowsPage } from '../pages/admin/WorkflowsPage';
import { AttendanceMastersPage } from '../pages/admin/AttendanceMastersPage';
import { SecurityPage } from '../pages/admin/SecurityPage';
import { PrivacyPage } from '../pages/my/PrivacyPage';
import { MyDocumentsPage } from '../pages/my/MyDocumentsPage';
import { DocumentsPage } from '../pages/documents/DocumentsPage';
import { PrivacyOpsPage } from '../pages/privacy/PrivacyOpsPage';
import { CompliancePage } from '../pages/compliance/CompliancePage';
import { PayrollPage } from '../pages/payroll/PayrollPage';
import { MyPayPage } from '../pages/payroll/MyPayPage';
import { ClaimsPage } from '../pages/payroll/ClaimsPage';
import { MyClaimsPage } from '../pages/payroll/MyClaimsPage';
import { LoansPage } from '../pages/payroll/LoansPage';
import { LifecyclePage } from '../pages/lifecycle/LifecyclePage';
import { AssetsPage } from '../pages/workplace/AssetsPage';
import { HelpdeskPage } from '../pages/workplace/HelpdeskPage';
import { EngagementPage } from '../pages/workplace/EngagementPage';
import { ExecutivePage } from '../pages/executive/ExecutivePage';
import { TravelPage } from '../pages/travel/TravelPage';
import { RecruitmentPage } from '../pages/recruitment/RecruitmentPage';

interface AppRouterProps {
  user: SessionUser;
  onSignedOut: () => void;
  /** Re-reads /auth/me after step-up, MFA or password changes (SEC-04). */
  onSessionChanged: () => void;
}

export function AppRouter({ user, onSignedOut, onSessionChanged }: AppRouterProps) {
  return (
    <Routes>
      <Route element={<AppShell user={user} onSignedOut={onSignedOut} onSessionChanged={onSessionChanged} />}>
        <Route index element={<RoleHomePage user={user} />} />
        <Route path="me" element={<ProfilePage self />} />
        <Route path="people" element={<DirectoryPage />} />
        <Route path="people/:ecode" element={<ProfilePage />} />

        <Route path="approvals" element={<ApprovalsPage />} />
        <Route path="approvals/:id" element={<ApprovalsPage />} />

        <Route path="my/attendance" element={<MyAttendancePage />} />
        <Route path="my/leave" element={<MyLeavePage />} />
        <Route path="my/pay" element={<MyPayPage />} />
        <Route path="my/claims" element={<MyClaimsPage />} />
        <Route path="my/team" element={<TeamPage user={user} />} />
        <Route
          path="my/privacy"
          element={<PrivacyPage user={user} onSessionChanged={onSessionChanged} />}
        />
        <Route path="my/documents" element={<MyDocumentsPage />} />
        <Route path="my/team/overtime" element={<OtDecisionsPage />} />
        <Route path="my/letters" element={<MyLettersPage />} />
        <Route path="policies" element={<PoliciesPage user={user} />} />
        <Route path="letters" element={<LettersPage />} />
        <Route path="documents" element={<DocumentsPage />} />

        <Route path="attendance" element={<AttendanceOpsPage user={user} />} />
        <Route path="attendance/muster" element={<MusterPage />} />
        <Route path="attendance/exceptions" element={<ExceptionsPage />} />
        <Route path="attendance/devices" element={<DeviceHealthPage />} />
        <Route path="attendance/month-lock" element={<MonthLockPage />} />
        <Route path="attendance/absence-cases" element={<AbsenceCasesPage user={user} />} />

        <Route path="leave" element={<LeaveAdminPage />} />
        <Route path="payroll/*" element={<PayrollPage />} />
        <Route path="loans" element={<LoansPage />} />
        <Route path="claims" element={<ClaimsPage />} />
        <Route path="lifecycle/*" element={<LifecyclePage />} />
        <Route path="assets" element={<AssetsPage />} />
        <Route path="helpdesk" element={<HelpdeskPage user={user} />} />
        <Route path="engagement" element={<EngagementPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="reports/r2-swipes" element={<R2SwipesPage />} />
        <Route path="reports/r3-regularizations" element={<R3RegularizationsPage />} />
        <Route path="reports/r4-exceptions" element={<R4ExceptionsPage />} />
        <Route path="reports/r5-ot" element={<R5OtPage />} />
        <Route path="reports/r6-absence" element={<R6AbsencePage />} />
        <Route path="reports/r24-boarding" element={<R24BoardingPage />} />
        <Route path="reports/r27-headcount" element={<R27HeadcountPage />} />
        <Route path="executive" element={<ExecutivePage />} />

        <Route path="admin/users" element={<AccessControlPage />} />
        <Route path="admin/settings" element={<SettingsPage user={user} />} />
        <Route path="admin/audit" element={<AuditLogPage />} />
        <Route path="admin/workflows" element={<WorkflowsPage user={user} />} />
        <Route path="admin/masters" element={<AttendanceMastersPage user={user} />} />
        <Route path="admin/org" element={<Navigate to="/admin/masters" replace />} />
        <Route
          path="admin/security"
          element={<SecurityPage user={user} onSessionChanged={onSessionChanged} />}
        />

        <Route path="compliance" element={<CompliancePage />} />
        <Route path="privacy" element={<PrivacyOpsPage />} />

        <Route path="travel/*" element={<TravelPage />} />
        <Route path="recruitment/*" element={<RecruitmentPage />} />

        <Route
          path="dev/gallery"
          element={hasRole(user, 'super_admin') ? <GalleryPage /> : <Navigate to="/" replace />}
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
