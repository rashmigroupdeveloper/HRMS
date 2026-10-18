/**
 * Application routes (docs/05 deep links + locked `/executive`).
 * Every product route resolves to a real page. Surfaces whose BACKEND lands in
 * a later phase render their real layout plus an honest pending panel — never
 * invented data (docs/05 §4.8).
 *
 * Route-level code splitting (docs/05 §7 `bundle-splitting`): every page
 * except the role landing is a lazy chunk, so Payroll's heavy grids never
 * slow the ESS phone. AppShell owns the Suspense boundary + skeleton.
 */
import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import type { SessionUser } from '../lib/session';
import { hasRole } from '../lib/session';
import { AppShell } from './AppShell';
import { RouteGuard } from './RouteGuard';
import { RoleHomePage } from '../pages/home/RoleHomePage';
const DirectoryPage = lazy(() => import('../pages/people/DirectoryPage').then((m) => ({ default: m.DirectoryPage })));
const ProfilePage = lazy(() => import('../pages/people/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const GalleryPage = lazy(() => import('../pages/dev/GalleryPage').then((m) => ({ default: m.GalleryPage })));
const ApprovalsPage = lazy(() => import('../pages/approvals/ApprovalsPage').then((m) => ({ default: m.ApprovalsPage })));
const AttendanceOpsPage = lazy(() => import('../pages/attendance/AttendanceOpsPage').then((m) => ({ default: m.AttendanceOpsPage })));
const DeviceHealthPage = lazy(() => import('../pages/attendance/DeviceHealthPage').then((m) => ({ default: m.DeviceHealthPage })));
const ExceptionsPage = lazy(() => import('../pages/attendance/ExceptionsPage').then((m) => ({ default: m.ExceptionsPage })));
const MonthLockPage = lazy(() => import('../pages/attendance/MonthLockPage').then((m) => ({ default: m.MonthLockPage })));
const MyAttendancePage = lazy(() => import('../pages/attendance/MyAttendancePage').then((m) => ({ default: m.MyAttendancePage })));
const MyLeavePage = lazy(() => import('../pages/leave/MyLeavePage').then((m) => ({ default: m.MyLeavePage })));
const LeaveAdminPage = lazy(() => import('../pages/leave/LeaveAdminPage').then((m) => ({ default: m.LeaveAdminPage })));
const MusterPage = lazy(() => import('../pages/reports/MusterPage').then((m) => ({ default: m.MusterPage })));
const ReportsPage = lazy(() => import('../pages/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const R2SwipesPage = lazy(() => import('../pages/reports/SupportingReports').then((m) => ({ default: m.R2SwipesPage })));
const R3RegularizationsPage = lazy(() => import('../pages/reports/SupportingReports').then((m) => ({ default: m.R3RegularizationsPage })));
const R4ExceptionsPage = lazy(() => import('../pages/reports/SupportingReports').then((m) => ({ default: m.R4ExceptionsPage })));
const R5OtPage = lazy(() => import('../pages/reports/SupportingReports').then((m) => ({ default: m.R5OtPage })));
const R6AbsencePage = lazy(() => import('../pages/reports/SupportingReports').then((m) => ({ default: m.R6AbsencePage })));
const R21OffersPage = lazy(() => import('../pages/reports/SupportingReports').then((m) => ({ default: m.R21OffersPage })));
const R23TransfersPage = lazy(() => import('../pages/reports/SupportingReports').then((m) => ({ default: m.R23TransfersPage })));
const R24BoardingPage = lazy(() => import('../pages/reports/SupportingReports').then((m) => ({ default: m.R24BoardingPage })));
const R25ProbationPage = lazy(() => import('../pages/reports/SupportingReports').then((m) => ({ default: m.R25ProbationPage })));
const R26AttritionPage = lazy(() => import('../pages/reports/SupportingReports').then((m) => ({ default: m.R26AttritionPage })));
const R27HeadcountPage = lazy(() => import('../pages/reports/SupportingReports').then((m) => ({ default: m.R27HeadcountPage })));
const R28AssetsPage = lazy(() => import('../pages/reports/SupportingReports').then((m) => ({ default: m.R28AssetsPage })));
const R29HelpdeskPage = lazy(() => import('../pages/reports/SupportingReports').then((m) => ({ default: m.R29HelpdeskPage })));
const R30PoliciesPage = lazy(() => import('../pages/reports/SupportingReports').then((m) => ({ default: m.R30PoliciesPage })));
const R31ClaimsPage = lazy(() => import('../pages/reports/SupportingReports').then((m) => ({ default: m.R31ClaimsPage })));
const TeamPage = lazy(() => import('../pages/team/TeamPage').then((m) => ({ default: m.TeamPage })));
const OtDecisionsPage = lazy(() => import('../pages/team/OtDecisionsPage').then((m) => ({ default: m.OtDecisionsPage })));
const AbsenceCasesPage = lazy(() => import('../pages/attendance/AbsenceCasesPage').then((m) => ({ default: m.AbsenceCasesPage })));
const PoliciesPage = lazy(() => import('../pages/policies/PoliciesPage').then((m) => ({ default: m.PoliciesPage })));
const LettersPage = lazy(() => import('../pages/letters/LettersPage').then((m) => ({ default: m.LettersPage })));
const MyResignationPage = lazy(() => import('../pages/lifecycle/MyResignationPage').then((m) => ({ default: m.MyResignationPage })));
const MyLettersPage = lazy(() => import('../pages/letters/MyLettersPage').then((m) => ({ default: m.MyLettersPage })));
const AccessControlPage = lazy(() => import('../pages/admin/AccessControlPage').then((m) => ({ default: m.AccessControlPage })));
const SettingsPage = lazy(() => import('../pages/admin/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const AuditLogPage = lazy(() => import('../pages/admin/AuditLogPage').then((m) => ({ default: m.AuditLogPage })));
const WorkflowsPage = lazy(() => import('../pages/admin/WorkflowsPage').then((m) => ({ default: m.WorkflowsPage })));
const OrgMastersPage = lazy(() => import('../pages/admin/OrgMastersPage').then((m) => ({ default: m.OrgMastersPage })));
const DepartmentHeadsPage = lazy(() => import('../pages/admin/DepartmentHeadsPage').then((m) => ({ default: m.DepartmentHeadsPage })));
const AttendanceMastersPage = lazy(() => import('../pages/admin/AttendanceMastersPage').then((m) => ({ default: m.AttendanceMastersPage })));
const PayrollPage = lazy(() => import('../pages/payroll/PayrollPage').then((m) => ({ default: m.PayrollPage })));
const SalaryStructuresPage = lazy(() => import('../pages/payroll/SalaryStructuresPage').then((m) => ({ default: m.SalaryStructuresPage })));
const SalaryRevisionsPage = lazy(() => import('../pages/payroll/SalaryRevisionsPage').then((m) => ({ default: m.SalaryRevisionsPage })));
const ParallelRunPage = lazy(() => import('../pages/payroll/ParallelRunPage').then((m) => ({ default: m.ParallelRunPage })));
const TaxDeclarationPage = lazy(() => import('../pages/tax/TaxDeclarationPage').then((m) => ({ default: m.TaxDeclarationPage })));
const TdsCompliancePage = lazy(() => import('../pages/tax/TdsCompliancePage').then((m) => ({ default: m.TdsCompliancePage })));
const PayrollSettingsPage = lazy(() => import('../pages/payroll/PayrollSettingsPage').then((m) => ({ default: m.PayrollSettingsPage })));
const MyPayPage = lazy(() => import('../pages/payroll/MyPayPage').then((m) => ({ default: m.MyPayPage })));
const ClaimsPage = lazy(() => import('../pages/payroll/ClaimsPage').then((m) => ({ default: m.ClaimsPage })));
const LoansPage = lazy(() => import('../pages/payroll/LoansPage').then((m) => ({ default: m.LoansPage })));
const LifecyclePage = lazy(() => import('../pages/lifecycle/LifecyclePage').then((m) => ({ default: m.LifecyclePage })));
const PrejoinPortalPage = lazy(() => import('../pages/lifecycle/PrejoinPortalPage').then((m) => ({ default: m.PrejoinPortalPage })));
const AlumniPortalPage = lazy(() => import('../pages/lifecycle/AlumniPortalPage').then((m) => ({ default: m.AlumniPortalPage })));
const AssetsPage = lazy(() => import('../pages/workplace/AssetsPage').then((m) => ({ default: m.AssetsPage })));
const HelpdeskPage = lazy(() => import('../pages/workplace/HelpdeskPage').then((m) => ({ default: m.HelpdeskPage })));
const EngagementPage = lazy(() => import('../pages/workplace/EngagementPage').then((m) => ({ default: m.EngagementPage })));
const ExecutivePage = lazy(() => import('../pages/executive/ExecutivePage').then((m) => ({ default: m.ExecutivePage })));
const TravelPage = lazy(() => import('../pages/travel/TravelPage').then((m) => ({ default: m.TravelPage })));
const RecruitmentPage = lazy(() => import('../pages/recruitment/RecruitmentPage').then((m) => ({ default: m.RecruitmentPage })));
const DataImportsPage = lazy(() => import('../pages/imports/DataImportsPage').then((m) => ({ default: m.DataImportsPage })));

interface AppRouterProps {
  user: SessionUser;
  onSignedOut: () => void;
}

export function AppRouter({ user, onSignedOut }: AppRouterProps) {
  return (
    <Routes>
      <Route element={<AppShell user={user} onSignedOut={onSignedOut} />}>
       <Route element={<RouteGuard user={user} />}>
        <Route index element={<RoleHomePage user={user} />} />
        <Route path="me" element={<ProfilePage self user={user} />} />
        <Route path="people" element={<DirectoryPage user={user} />} />
        <Route path="people/:ecode" element={<ProfilePage user={user} />} />

        <Route path="approvals" element={<ApprovalsPage />} />
        <Route path="approvals/:id" element={<ApprovalsPage />} />

        <Route path="my/attendance" element={<MyAttendancePage />} />
        <Route path="my/leave" element={<MyLeavePage />} />
        <Route path="my/pay" element={<MyPayPage />} />
        <Route path="my/tax" element={<TaxDeclarationPage />} />
        <Route path="my/claims" element={<ClaimsPage />} />
        <Route path="my/team" element={<TeamPage user={user} />} />
        <Route path="my/team/overtime" element={<OtDecisionsPage />} />
        <Route path="my/letters" element={<MyLettersPage />} />
        <Route path="my/resignation" element={<MyResignationPage />} />
        <Route path="policies" element={<PoliciesPage user={user} />} />
        <Route path="letters" element={<LettersPage />} />

        <Route path="attendance" element={<AttendanceOpsPage user={user} />} />
        <Route path="attendance/muster" element={<MusterPage />} />
        <Route path="attendance/exceptions" element={<ExceptionsPage />} />
        <Route path="attendance/devices" element={<DeviceHealthPage user={user} />} />
        <Route path="attendance/month-lock" element={<MonthLockPage />} />
        <Route path="attendance/absence-cases" element={<AbsenceCasesPage user={user} />} />

        <Route path="leave" element={<LeaveAdminPage />} />
        <Route path="payroll" element={<PayrollPage user={user} />} />
        <Route path="payroll/settings" element={<PayrollSettingsPage user={user} />} />
        <Route path="payroll/tds" element={<TdsCompliancePage />} />
        <Route path="payroll/structures" element={<SalaryStructuresPage />} />
        <Route path="payroll/revisions" element={<SalaryRevisionsPage />} />
        <Route path="payroll/parallel-run" element={<ParallelRunPage />} />
        <Route path="admin/salary-structures" element={<SalaryStructuresPage />} />
        <Route path="loans" element={<LoansPage />} />
        <Route path="claims" element={<ClaimsPage />} />
        <Route path="lifecycle/*" element={<LifecyclePage user={user} />} />
        <Route path="onboard/prejoin" element={<PrejoinPortalPage />} />
        <Route path="alumni" element={<AlumniPortalPage />} />
        <Route path="assets" element={<AssetsPage />} />
        <Route path="helpdesk" element={<HelpdeskPage user={user} />} />
        <Route path="engagement" element={<EngagementPage user={user} />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="reports/r2-swipes" element={<R2SwipesPage />} />
        <Route path="reports/r3-regularizations" element={<R3RegularizationsPage />} />
        <Route path="reports/r4-exceptions" element={<R4ExceptionsPage />} />
        <Route path="reports/r5-ot" element={<R5OtPage />} />
        <Route path="reports/r6-absence" element={<R6AbsencePage />} />
        <Route path="reports/r21-offers" element={<R21OffersPage />} />
        <Route path="reports/r23-transfers" element={<R23TransfersPage />} />
        <Route path="reports/r24-boarding" element={<R24BoardingPage />} />
        <Route path="reports/r25-probation" element={<R25ProbationPage />} />
        <Route path="reports/r26-attrition" element={<R26AttritionPage />} />
        <Route path="reports/r27-headcount" element={<R27HeadcountPage />} />
        <Route path="reports/r28-assets" element={<R28AssetsPage />} />
        <Route path="reports/r29-helpdesk" element={<R29HelpdeskPage />} />
        <Route path="reports/r30-policies" element={<R30PoliciesPage />} />
        <Route path="reports/r31-claims" element={<R31ClaimsPage />} />
        <Route path="executive" element={<ExecutivePage />} />

        <Route path="admin/users" element={<AccessControlPage user={user} />} />
        <Route path="admin/settings" element={<SettingsPage user={user} />} />
        <Route path="admin/audit" element={<AuditLogPage />} />
        <Route path="admin/imports" element={<DataImportsPage />} />
        <Route path="admin/workflows" element={<WorkflowsPage user={user} />} />
        <Route path="admin/department-heads" element={<DepartmentHeadsPage />} />
        <Route path="admin/org-masters" element={<OrgMastersPage user={user} />} />
        <Route path="admin/masters" element={<AttendanceMastersPage user={user} />} />

        <Route path="travel/*" element={<TravelPage />} />
        <Route path="recruitment/*" element={<RecruitmentPage />} />

        <Route
          path="dev/gallery"
          element={hasRole(user, 'super_admin') ? <GalleryPage /> : <Navigate to="/" replace />}
        />

       </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
