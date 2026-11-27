import { useQuery } from '@tanstack/react-query'
import { Building2, CalendarCog, FileText, History, ListChecks, ShieldCheck, UserPlus, Users, Workflow } from 'lucide-react'
import { useState } from 'react'
import { FormError } from '@/components/FormError'
import { HomeAttendanceSkeleton, HomeRoleSkeleton } from '@/components/skeletons/home/HomePanelsSkeleton'
import { ManageWorkspaceSkeleton } from '@/components/skeletons/home/ManageWorkspaceSkeleton'
import { useAccess } from '@/hooks/useAccess'
import { orpc } from '@/lib/orpc'
import { todayDay } from '@/lib/utils'
import { HomeAttendance } from './components/HomeAttendance'
import { HomeAwayWeek } from './components/HomeAwayWeek'
import { HomeMonthClose } from './components/HomeMonthClose'
import { HomeMovements } from './components/HomeMovements'
import { HomePayroll } from './components/HomePayroll'
import { HomeJoiningWork, HomePreJoining } from './components/HomeOnboarding'
import { HomeDecisions, HomeMyRequests } from './components/HomeRequests'
import { greeting } from './components/greeting'
import { QuickLink, type Shortcut } from './components/QuickLink'

// The role portal's home (/manage - the user, 2026-11-25): only the active role's work - its pages, its approval steps,
// joining work (Onboarding), the people today in its data access plus one's own team, and the requests raised for others;
// since 2026-11-27 also the role's numbers - the attendance month to close, the payroll runs, joiners & leavers and who is
// away this week - each shown only with the access its reader needs (a role switch reloads the page with the new role's).
// One's own attendance, leave and details are on Employee self-service's home (/ess), never here.
export function ManageHomePage() {
  const { me, can, coversGroup, ready } = useAccess()
  const [now] = useState(() => new Date())
  const [date] = useState(todayDay)
  const overview = useQuery(orpc.attendance.overview.queryOptions())
  const role = me?.availableRoles.find((r) => r.id === me.activeRoleId)?.name
  const isHR = can('ONBOARDING')
  const hasPeople = !!overview.data && (overview.data.canSeeAll || overview.data.teamSize > 0 || overview.data.departmentSize > 0)
  const work: Shortcut[] = [
    ...(can('ONBOARDING') ? [{ to: '/manage/onboarding', icon: UserPlus, title: 'Onboarding', text: 'Offers & joining' }] : []),
    ...(can('EMPLOYEES') ? [{ to: '/manage/employees?view=records', icon: Users, title: 'Employee records', text: 'Find a colleague' }] : []),
    ...(can('JOINING_TASKS') || can('ONBOARDING') || can('JOINING_TASK_TYPES') ? [{ to: '/manage/joining-tasks', icon: ListChecks, title: 'Joining checklist', text: 'Tasks for new joiners' }] : []),
    ...(can('ORGANIZATION') || can('HOD_APPOINTMENTS') ? [{ to: '/manage/organization', icon: Building2, title: 'Organization', text: 'Companies & places' }] : []),
    ...(can('ATTENDANCE_SETUP') ? [{ to: '/manage/attendance-setup', icon: CalendarCog, title: 'Attendance setup', text: 'Shifts, holidays & punches' }] : []),
    ...(can('LETTER_TEMPLATES') ? [{ to: '/manage/letter-templates', icon: FileText, title: 'Letter templates', text: 'Manage your letters' }] : []),
    ...(can('ACCESS') ? [{ to: '/manage/access', icon: ShieldCheck, title: 'Roles & access', text: 'Logins & permissions' }] : []),
    ...(can('APPROVAL_CHAINS') ? [{ to: '/manage/approval-chains', icon: Workflow, title: 'Approval rules', text: 'Who approves what' }] : []),
    ...(can('CHANGE_HISTORY') ? [{ to: '/manage/change-history', icon: History, title: 'Change history', text: 'Who changed what' }] : []),
  ]
  const workspace = (wide: boolean) => (
    <section className="home-panel min-w-0 space-y-3 p-4 sm:p-5">
      <h2 className="text-lg font-medium tracking-tight">Your role&apos;s pages</h2>
      {work.length > 0 ? (
        <div className={`grid grid-cols-2 gap-x-4 gap-y-1 ${wide ? 'md:grid-cols-3 xl:grid-cols-5' : ''}`}>{work.map((item) => <QuickLink key={item.to} {...item} />)}</div>
      ) : (
        <p className="text-sm text-muted-foreground">This role gives no set-up pages - its approvals and people are below.</p>
      )}
    </section>
  )
  // the dark column: joining work for HR, otherwise the people today (the role's data access and one's own team)
  const focus = isHR ? <><HomeJoiningWork /><HomePreJoining /><HomeMyRequests /></> : overview.isPending ? <HomeRoleSkeleton dark /> : hasPeople ? <HomeAttendance overview={overview.data!} date={date} dark /> : <HomeMyRequests />
  // the role's own numbers (2026-11-27, from main's HR / payroll dashboards) - each only with the access its reader needs,
  // so switching the role changes them: the attendance month for whoever locks it (Attendance setup Edit for every
  // company), the payroll runs (Payroll View), joiners & leavers (Employees View), who is away (Leave View)
  const numbers = [
    ...(coversGroup('ATTENDANCE_SETUP') ? [<HomeMonthClose key="month" overview={overview.data} />] : []),
    ...(can('PAYROLL') ? [<HomePayroll key="payroll" overview={overview.data} />] : []),
    ...(can('EMPLOYEES') ? [<HomeMovements key="movements" />] : []),
    ...(can('LEAVE') ? [<HomeAwayWeek key="away" />] : []),
  ]
  return (
    <div className="home-dashboard space-y-4">
      <header className="home-arrive flex flex-wrap items-end justify-between gap-x-6 gap-y-3 pb-1">
        <div>
          <h1 className="text-[28px] font-light leading-tight tracking-tight sm:text-[40px]">{greeting(now)}{me ? `, ${me.name.split(' ')[0]}` : ''}</h1>
          <p className="mt-2 text-sm text-muted-foreground">The work of your role - its people, set-up and decisions.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {role && <span className="max-w-full break-words rounded-full bg-card px-3 py-2 font-medium">{role}</span>}
          <span className="text-muted-foreground">{now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short' })}</span>
        </div>
      </header>
      <div className="grid min-w-0 gap-3 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-8"><HomeDecisions light /></div>
        <div className="min-w-0 space-y-3 lg:col-span-4 lg:row-span-2">{ready ? focus : <HomeRoleSkeleton dark />}</div>
        <div className="min-w-0 lg:col-span-8">
          {!ready ? <ManageWorkspaceSkeleton label="Loading your role's pages" /> : numbers.length ? <div className="grid min-w-0 items-start gap-3 sm:grid-cols-2">{numbers}</div> : workspace(false)}
        </div>
      </div>
      <FormError error={overview.error} />
      {/* HR's people today across the page; its skeleton while the overview loads, so nothing moves in after */}
      {ready && isHR && (overview.isPending ? <section className="home-panel min-w-0 p-4 sm:p-5"><h2 className="text-lg font-medium tracking-tight">People today</h2><HomeAttendanceSkeleton /></section> : hasPeople && <HomeAttendance overview={overview.data!} date={date} />)}
      {ready && !isHR && hasPeople && <HomeMyRequests />}
      {ready && numbers.length > 0 && workspace(true)}
    </div>
  )
}
