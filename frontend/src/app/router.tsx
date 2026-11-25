import { AttendanceReportsPage } from '@/pages/attendance/AttendanceReportsPage'
import { createBrowserRouter, Navigate } from 'react-router'
import { AppLayout } from '@/components/layout/AppLayout'
import { RequireAccess, RequireLogin } from '@/components/RouteGuards'
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
//   /change-password       - any logged-in employee
//   /me                    - the employee's own profile (any logged-in employee)
//   /employees/:code       - HR's view of a profile: Employees: View (checked in the page, after sending one's own
//                            code to /me); the backend checks every request too
//   /employees             - any logged-in employee: the directory + org chart; the records tab: Employees: View
//   /organization          - Organization: View, or HOD appointments: View (the Department heads tab only)
//   /my-department         - any logged-in employee; shows the employees whose HOD they are (none: an empty page)
//   /onboarding   - also needs view access to ONBOARDING (RequireAccess); others are sent to / (health page)
//   /onboarding/:id        - one candidate on its own page (Onboarding: View; changing needs Onboarding: Edit)
//   /access       - also needs view access to ACCESS (roles and who has them)
//   /attendance            - one's own attendance (everyone); /team-attendance - others' (a team, an HOD department or
//                            Attendance: View); /attendance-setup - Attendance setup: View (2026-11-22)
//   /leave                 - one's own leave (everyone); /team-leave - others' (a team, an HOD department or Leave: View);
//                            /holidays - one's own holiday list's holidays (everyone - 2026-11-25)
//   /change-history        - Change history: View (who changed what and when; one employee's history is on the profile)
//   /letter-templates      - Letter templates: View (the wording of the offer letter)
//   /letter-templates/new, /letter-templates/:id - one template on its own page (changing it needs Letter templates: Edit)
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
          { index: true, element: <HomePage /> },
          { path: 'change-password', element: <ChangePasswordPage /> },
          { path: 'me', element: <MyProfilePage /> },
          // everyone's own attendance (old ?tab= links go on to the two pages below - 2026-11-22)
          { path: 'attendance', element: <MyAttendancePage /> },
          // others' attendance: a team, an HOD department or Attendance: View (nobody to see: back to /attendance)
          { path: 'team-attendance', element: <TeamAttendancePage /> },
          { path: 'attendance-reports', element: <AttendanceReportsPage /> },
          // everyone's own leave (2026-11-22); others' (a team, an HOD department or Leave: View - nobody to see: back to /leave)
          { path: 'leave', element: <LeavePage /> },
          { path: 'team-leave', element: <TeamLeavePage /> },
          // everyone's own holidays (2026-11-25)
          { path: 'holidays', element: <HolidaysPage /> },
          { path: 'employees/:employeeCode', element: <EmployeeProfilePage /> },
          // an HOD's own department (BACKLOG 3e) - read-only, no role needed
          { path: 'my-department', element: <MyDepartmentPage /> },
          // Joining tasks or Onboarding view access - checked on the page
          { path: 'joining-tasks', element: <JoiningTasksPage /> },
          // everyone: what waits for my decision, and what I raised (2026-11-20)
          { path: 'approvals', element: <ApprovalsPage /> },
          // everyone: their own job and salary; the other sidebar items follow the access (2026-11-21, was /job-changes, then /jobs-salary)
          { path: 'pay-career', element: <PayCareerPage /> },
          { path: 'job-changes', element: <Navigate to="/pay-career?view=register" replace /> },
          // "Jobs & salary" until 2026-11-21 (renamed Pay & career)
          { path: 'jobs-salary', element: <Navigate to="/pay-career" replace /> },
          // everyone: the company directory and org chart; HR's employee records are a tab inside (Employee · Directory &
          // job: View - 2026-11-21, the page needed that access before)
          { path: 'employees', element: <PeoplePage /> },
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
    ],
  },
])
