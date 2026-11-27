import { PayrollPage } from '@/pages/payroll/PayrollPage'
import { PayrollRunPage } from '@/pages/payroll/PayrollRunPage'
import { StatutoryPage } from '@/pages/payroll/StatutoryPage'
import { AttendanceReportsPage } from '@/pages/attendance/AttendanceReportsPage'
import { createBrowserRouter, Navigate } from 'react-router'
import { AppLayout } from '@/components/layout/AppLayout'
import { MovedToPortal, PortalHome, RequireAccess, RequireLogin, RequirePortal } from '@/components/RouteGuards'
import { RolesPage } from '@/pages/access/RolesPage'
import { ApprovalChainsPage } from '@/pages/approval-chains/ApprovalChainsPage'
import { ApprovalsPage } from '@/pages/approvals/ApprovalsPage'
import { ChangePasswordPage } from '@/pages/auth/ChangePasswordPage'
import { LoginPage } from '@/pages/auth/LoginPage'
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage'
import { EmployeeProfilePage } from '@/pages/employees/EmployeeProfilePage'
import { MyProfilePage } from '@/pages/employees/MyProfilePage'
import { PeoplePage } from '@/pages/employees/PeoplePage'
import { HomePage } from '@/pages/home/HomePage'
import { ManageHomePage } from '@/pages/home/ManageHomePage'
import { AttendanceSetupPage } from '@/pages/attendance/AttendanceSetupPage'
import { MyAttendancePage } from '@/pages/attendance/MyAttendancePage'
import { TeamAttendancePage } from '@/pages/attendance/TeamAttendancePage'
import { LeavePage } from '@/pages/leave/LeavePage'
import { HolidaysPage } from '@/pages/leave/HolidaysPage'
import { TeamLeavePage } from '@/pages/leave/TeamLeavePage'
import { PayCareerPage } from '@/pages/pay-career/PayCareerPage'
import { JoiningTasksPage } from '@/pages/joining-tasks/JoiningTasksPage'
import { ChangeHistoryPage } from '@/pages/change-history/ChangeHistoryPage'
import { LetterTemplatePage } from '@/pages/letter-templates/LetterTemplatePage'
import { LetterTemplatesPage } from '@/pages/letter-templates/LetterTemplatesPage'
import { NotFoundPage } from '@/pages/not-found/NotFoundPage'
import { JoiningFormPage } from '@/pages/offer-response/JoiningFormPage'
import { OfferResponsePage } from '@/pages/offer-response/OfferResponsePage'
import { CandidatePage } from '@/pages/onboarding/CandidatePage'
import { OnboardingPage } from '@/pages/onboarding/OnboardingPage'
import { OrganizationPage } from '@/pages/organization/OrganizationPage'
import { MyDepartmentPage } from '@/pages/my-department/MyDepartmentPage'

// Every page of the app is registered here.
//   /login        - public
//   /offer/:token - public: the candidate's own offer page (the secret link from the offer e-mail is the key)
//   /joining-form/:token   - public: the candidate's joining form after accepting (same secret link + a one-time code)
//   everything    - needs a logged-in employee (RequireLogin); with a temporary password -> /change-password first
//   /change-password       - any logged-in employee, in either portal
//   /                      - the home of this tab's portal
//
// Two portals (the user, 2026-11-25), each page under its own address; opened in the other portal -> the switch screen
// (RequirePortal). Everyone signs in to Employee self-service; picking a role in the account menu opens the role portal.
//   /ess/...      Employee self-service - no role active: one's own record and actions, one's team and HOD department
//     /ess                 - home
//     /ess/me              - the employee's own profile
//     /ess/attendance      - one's own attendance; /ess/team-attendance, /ess/attendance-reports - one's reporting tree
//                            and HOD department (nobody to see: back to /ess/attendance)
//     /ess/leave           - one's own leave; /ess/holidays - one's holiday list's holidays; /ess/team-leave - one's team's
//     /ess/pay-career      - one's own job and salary
//     /ess/employees       - the directory + org chart
//     /ess/my-department   - the employees whose HOD they are (none: an empty page)
//     /ess/approvals       - the steps named to them (manager, HOD) and their own requests
//   /manage/...   the role portal - a role active; each page also needs its area (RequireAccess or in the page). Its
//                 lists show the role's records plus one's own team (the user, 2026-11-25)
//     /manage                      - home
//     /manage/employees            - Employees: View - HR's employee records and joiners & leavers (the directory and the
//                                    org chart are self-service's /ess/employees - the user, 2026-11-25)
//     /manage/employees/:code      - HR's view of a profile: Employees: View (one's own code goes to /ess/me)
//     /manage/onboarding, /manage/onboarding/:id - Onboarding: View (changing needs Onboarding: Edit)
//     /manage/joining-tasks        - Joining tasks or Onboarding view access - checked on the page
//     /manage/team-attendance, /manage/attendance-reports - Attendance: View (and one's team)
//     /manage/attendance-setup     - Attendance setup: View
//     /manage/team-leave           - Leave: View (and one's team)
//     /manage/payroll              - Payroll: View - whole-company monthly drafts; creation needs whole-company Edit
//     /manage/payroll/:id          - one run: its people + salary copy and the month's inputs (Payroll: View; changes Edit;
//                                    salary figures also need Salary: View over the whole company)
//     /manage/payroll/statutory    - the statutory rates and slabs (Payroll: View; changes Payroll Edit for every company)
//                                    and opening tax figures (whole-company Payroll scope)
//     /manage/pay-career           - raising job / salary changes, the change register
//     /manage/approvals            - the role's steps and the requests raised for others
//     /manage/organization         - Organization: View, or HOD appointments: View (the Department heads tab only)
//     /manage/letter-templates[/new|/:id] - Letter templates: View (changing needs Letter templates: Edit)
//     /manage/access               - Roles & access: View
//     /manage/approval-chains      - Approval chains: View
//     /manage/change-history       - Change history: View
//   The addresses from before (/leave, /onboarding/:id, /approvals... - also in e-mails already sent) go to the same page in
//   its portal (MovedToPortal); pages in both portals go to this tab's portal.
export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/offer/:token', element: <OfferResponsePage /> },
  { path: '/joining-form/:token', element: <JoiningFormPage /> },
  {
    element: <RequireLogin />,
    children: [
      {
        path: '/',
        element: <AppLayout />,
        children: [
          { index: true, element: <PortalHome /> },
          { path: 'change-password', element: <ChangePasswordPage /> },
          {
            path: 'ess',
            element: <RequirePortal portal="ess" />,
            children: [
              { index: true, element: <HomePage /> },
              { path: 'me', element: <MyProfilePage /> },
              { path: 'attendance', element: <MyAttendancePage /> },
              { path: 'team-attendance', element: <TeamAttendancePage /> },
              { path: 'attendance-reports', element: <AttendanceReportsPage /> },
              { path: 'leave', element: <LeavePage /> },
              { path: 'holidays', element: <HolidaysPage /> },
              { path: 'team-leave', element: <TeamLeavePage /> },
              { path: 'pay-career', element: <PayCareerPage /> },
              { path: 'employees', element: <PeoplePage /> },
              { path: 'my-department', element: <MyDepartmentPage /> },
              { path: 'approvals', element: <ApprovalsPage /> },
              { path: '*', element: <NotFoundPage /> },
            ],
          },
          {
            path: 'manage',
            element: <RequirePortal portal="manage" />,
            children: [
              { index: true, element: <ManageHomePage /> },
              { element: <RequireAccess area="PAYROLL" />, children: [{ path: 'payroll', element: <PayrollPage /> }, { path: 'payroll/statutory', element: <StatutoryPage /> }, { path: 'payroll/:id', element: <PayrollRunPage /> }] },
              { path: 'employees', element: <PeoplePage /> },
              { path: 'employees/:employeeCode', element: <EmployeeProfilePage /> },
              { path: 'joining-tasks', element: <JoiningTasksPage /> },
              { path: 'team-attendance', element: <TeamAttendancePage /> },
              { path: 'attendance-reports', element: <AttendanceReportsPage /> },
              { path: 'team-leave', element: <TeamLeavePage /> },
              { path: 'pay-career', element: <PayCareerPage /> },
              { path: 'approvals', element: <ApprovalsPage /> },
              {
                element: <RequireAccess area={['ORGANIZATION', 'HOD_APPOINTMENTS']} />,
                children: [{ path: 'organization', element: <OrganizationPage /> }],
              },
              {
                element: <RequireAccess area="ONBOARDING" />,
                children: [
                  { path: 'onboarding', element: <OnboardingPage /> },
                  { path: 'onboarding/:id', element: <CandidatePage /> },
                ],
              },
              {
                element: <RequireAccess area="LETTER_TEMPLATES" />,
                children: [
                  { path: 'letter-templates', element: <LetterTemplatesPage /> },
                  { path: 'letter-templates/new', element: <LetterTemplatePage /> },
                  { path: 'letter-templates/:id', element: <LetterTemplatePage /> },
                ],
              },
              {
                element: <RequireAccess area="ACCESS" />,
                children: [{ path: 'access', element: <RolesPage /> }],
              },
              {
                element: <RequireAccess area="APPROVAL_CHAINS" />,
                children: [{ path: 'approval-chains', element: <ApprovalChainsPage /> }],
              },
              {
                element: <RequireAccess area="ATTENDANCE_SETUP" />,
                children: [{ path: 'attendance-setup', element: <AttendanceSetupPage /> }],
              },
              {
                element: <RequireAccess area="CHANGE_HISTORY" />,
                children: [{ path: 'change-history', element: <ChangeHistoryPage /> }],
              },
              { path: '*', element: <NotFoundPage /> },
            ],
          },
          // the addresses from before the two portals (2026-11-25)
          ...['me', 'attendance', 'leave', 'holidays', 'my-department'].map((path) => ({ path, element: <MovedToPortal portal="ess" /> })),
          ...['employees/:employeeCode', 'onboarding', 'onboarding/:id', 'joining-tasks', 'organization', 'letter-templates', 'letter-templates/new', 'letter-templates/:id', 'access', 'approval-chains', 'attendance-setup', 'change-history'].map((path) => ({
            path,
            element: <MovedToPortal portal="manage" />,
          })),
          ...['employees', 'team-attendance', 'attendance-reports', 'team-leave', 'pay-career', 'approvals'].map((path) => ({ path, element: <MovedToPortal /> })),
          // older names of Pay & career's sections (until 2026-11-21)
          { path: 'job-changes', element: <Navigate to="/manage/pay-career?view=register" replace /> },
          { path: 'jobs-salary', element: <Navigate to="/ess/pay-career" replace /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
])
