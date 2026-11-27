import { useQuery } from '@tanstack/react-query'
import { Building2, CalendarCog, CircleAlert, FileText, Fingerprint, History, Inbox, ListChecks, ShieldCheck, UserPlus, Users, Workflow } from 'lucide-react'
import { Fragment, type ReactNode, useEffect, useState } from 'react'
import { FormError } from '@/components/FormError'
import { CycleDeskSkeleton, HomeAttendanceSkeleton, HomeRoleSkeleton } from '@/components/skeletons/home/HomePanelsSkeleton'
import { HomeStripSkeleton } from '@/components/skeletons/home/HomeWidgetsSkeleton'
import { ManageWorkspaceSkeleton } from '@/components/skeletons/home/ManageWorkspaceSkeleton'
import { useAccess } from '@/hooks/useAccess'
import { orpc } from '@/lib/orpc'
import { todayDay } from '@/lib/utils'
import { HomeAttendance } from './components/HomeAttendance'
import { CycleDesk } from './components/CycleDesk'
import { HomeAwayWeek } from './components/HomeAwayWeek'
import { HomeMonthClose } from './components/HomeMonthClose'
import { HomeMovements } from './components/HomeMovements'
import { HomePayroll } from './components/HomePayroll'
import { HomeJoiningWork, HomePreJoining } from './components/HomeOnboarding'
import { HomeDecisions, HomeMyRequests } from './components/HomeRequests'
import { greeting } from './components/greeting'
import { QuickLink, type Shortcut } from './components/QuickLink'
import { CardTitle, HeadlineStats, SegmentStrip } from './components/HomeParts'
import { PEOPLE_STRIP } from './components/home-labels'
import { useMonthClose } from './components/useMonthClose'
import { usePayrollRuns } from './components/usePayrollRuns'

// The role portal's home (/manage - the user, 2026-11-25): only the active role's work - its approval steps, joining work
// (Onboarding), the people today in its data access plus one's own team, the requests raised for others, the role's
// numbers (the attendance month to close, payroll runs, joiners & leavers, who is away) and its pages - each shown only
// with the access its reader needs (a role switch reloads the page with the new role's). One's own attendance, leave and
// details are on Employee self-service's home (/ess), never here.
// Redesigned 2026-11-27 like /ess (the user): big headline numbers from the role's access, the people today in the role's
// access as a strip under the greeting, and what needs the person first - decisions waiting, a month over and not locked,
// a pay month without a run - while calm cards follow and "nothing waiting" becomes a slim row at the bottom.
// The attendance cycle (the start day from Attendance setup, with who is in today) sits under that header.
export function ManageHomePage() {
  const { me, can, coversGroup, ready } = useAccess()
  const [now] = useState(() => new Date())
  const [date] = useState(todayDay)
  const overview = useQuery(orpc.attendance.overview.queryOptions())
  const o = overview.data
  const role = me?.availableRoles.find((r) => r.id === me.activeRoleId)?.name
  const isHR = can('ONBOARDING')
  const hasPeople = !!o && (o.canSeeAll || o.teamSize > 0 || o.departmentSize > 0)
  const joining = can('JOINING_TASKS') || can('ONBOARDING')
  const locks = coversGroup('ATTENDANCE_SETUP')
  // the readers behind the numbers - the same queries the cards below read (shared, so nothing loads twice)
  const toDecide = useQuery({ ...orpc.approvals.listToDecide.queryOptions(), enabled: ready })
  const board = useQuery({ ...orpc.attendance.days.board.queryOptions({ input: { scope: 'ALL', date } }), enabled: ready && can('ATTENDANCE') })
  const tasks = useQuery({ ...orpc.joiningTasks.list.queryOptions({ input: { scope: 'ALL', status: 'OPEN' } }), enabled: ready && joining })
  const first = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
  const movements = useQuery({ ...orpc.employees.movements.list.queryOptions({ input: { from: first, to: date, pageSize: 1 } }), enabled: ready && can('EMPLOYEES') })
  const month = useMonthClose(o, ready && locks)
  const canPayroll = can('PAYROLL')
  const payroll = usePayrollRuns(o, ready && canPayroll)
  // what this browser saw last (decisions waiting, a month to lock, a pay run missing), so the loading state draws the
  // order that will load - a per-browser convenience only; the answers always come from the readers (2026-11-27)
  const [remembered] = useState(readRemembered)
  const monthUrgent = month.pending ? remembered.month : !!month.overdue
  const payrollUrgent = payroll.pending ? remembered.payroll : payroll.dueMissing
  useEffect(() => {
    if (toDecide.data && (!locks || !month.pending) && (!canPayroll || !payroll.pending)) remember({ decisions: toDecide.data.length > 0, month: !!month.overdue, payroll: payroll.dueMissing })
  }, [toDecide.data, locks, month.pending, month.overdue, payroll.pending, payroll.dueMissing, canPayroll])
  const headlines = [
    { icon: Inbox, label: 'Decisions waiting', value: toDecide.data?.length ?? null, to: '/manage/approvals' },
    ...(joining ? [{ icon: ListChecks, label: 'Open joining tasks', value: tasks.data ? tasks.data.teams.reduce((n, t) => n + t.open, 0) : null, to: '/manage/joining-tasks?tab=all' }] : []),
    ...(can('ATTENDANCE')
      ? [{ icon: Fingerprint, label: 'Punched in today', value: board.data?.summary.in ?? null, to: '/manage/team-attendance?view=all' }]
      : locks ? [{ icon: CircleAlert, label: 'Missed punches', value: month.checklist?.missedPunches ?? null, to: '/manage/attendance-setup?part=lock' }] : []),
    ...(can('EMPLOYEES') ? [{ icon: UserPlus, label: 'Joined this month', value: movements.data?.summary.joiners ?? null, to: '/manage/employees?view=movements' }] : []),
  ].slice(0, 3)
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
  const workspace = (
    <section className="home-panel min-w-0 p-4 sm:p-5">
      <CardTitle title="Your role's pages" />
      {work.length > 0 ? (
        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 md:grid-cols-3 xl:grid-cols-5">{work.map((item) => <QuickLink key={item.to} {...item} />)}</div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">This role gives no set-up pages - its approvals and people are above.</p>
      )}
    </section>
  )
  // the right column: joining work for HR, otherwise the people today (the role's data access and one's own team)
  const focus = isHR ? <><HomeJoiningWork /><HomePreJoining /><HomeMyRequests /></> : overview.isPending ? <HomeRoleSkeleton dark /> : hasPeople ? <HomeAttendance overview={o!} date={date} dark /> : <HomeMyRequests />
  // the role's number cards, each with how much it needs the person now
  const numberCards = [
    ...(locks ? [{ key: 'month', score: monthUrgent ? 35 : 8, node: <HomeMonthClose overview={o} /> }] : []),
    ...(can('PAYROLL') ? [{ key: 'payroll', score: payrollUrgent ? 25 : 6, node: <HomePayroll overview={o} /> }] : []),
    ...(can('EMPLOYEES') ? [{ key: 'movements', score: 4, node: <HomeMovements /> }] : []),
    ...(can('LEAVE') ? [{ key: 'away', score: 3, node: <HomeAwayWeek /> }] : []),
  ].sort((x, y) => y.score - x.score)
  const urgent = numberCards.filter((c) => c.score >= 20)
  const calm = numberCards.filter((c) => c.score < 20)
  const grid = (list: typeof numberCards) => <div className="grid min-w-0 items-start gap-3 sm:grid-cols-2">{list.map((c) => <Fragment key={c.key}>{c.node}</Fragment>)}</div>
  const waiting = toDecide.data ? toDecide.data.length > 0 : remembered.decisions
  const late = toDecide.data?.some((r) => r.step?.late) ?? false
  // the main column, most urgent first (a stable sort keeps the rest in this order)
  const cards: { key: string; score: number; node: ReactNode }[] = [
    { key: 'decisions', score: waiting ? (late ? 50 : 40) : 1, node: <HomeDecisions light /> },
    ...(urgent.length ? [{ key: 'urgent', score: 30, node: grid(urgent) }] : []),
    // HR's people today in the role's access (light - the dark column is the joining work)
    ...(isHR && (overview.isPending || hasPeople) ? [{ key: 'people', score: 15, node: overview.isPending ? <section className="home-panel min-w-0 p-4 sm:p-5"><h2 className="text-xl font-light tracking-tight">People today</h2><HomeAttendanceSkeleton /></section> : <HomeAttendance overview={o!} date={date} /> }] : []),
    ...(calm.length ? [{ key: 'calm', score: 10, node: grid(calm) }] : []),
    ...(!isHR && hasPeople ? [{ key: 'requests', score: 5, node: <HomeMyRequests /> }] : []),
  ].sort((x, y) => y.score - x.score)
  const s = board.data?.summary
  return (
    <div className="home-dashboard space-y-4">
      <header className="home-arrive grid min-w-0 items-end gap-x-8 gap-y-5 pb-2 lg:grid-cols-12">
        <div className="min-w-0 space-y-5 lg:col-span-7">
          <div>
            <p className="text-xs text-muted-foreground">{now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long' })}{role ? ` · ${role}` : ''}</p>
            <h1 className="mt-1 text-[32px] leading-tight font-light tracking-tight sm:text-[44px]">{greeting(now)}{me ? `, ${me.name.split(' ')[0]}` : ''}</h1>
          </div>
          {ready && can('ATTENDANCE') && (s ? (
            <div className="min-w-0">
              <p className="mb-2 text-xs text-muted-foreground">People today within your access · {s.total}</p>
              <SegmentStrip label="People today within your access" segments={[{ label: 'Punched in', value: s.in, tone: 'dark' }, { label: 'On leave', value: s.leave + s.onDuty, tone: 'gold' }, { label: 'Not in yet', value: s.notIn, tone: 'hatched' }, { label: 'Absent', value: s.absent, tone: 'outline' }]} />
            </div>
          ) : <HomeStripSkeleton parts={PEOPLE_STRIP} />)}
        </div>
        <div className="min-w-0 lg:col-span-5 lg:justify-self-end">{ready && <HeadlineStats stats={headlines.map((h) => ({ ...h, value: h.value ?? '—' }))} loading={headlines.some((h) => h.value === null)} />}</div>
      </header>
      {can('ATTENDANCE') && overview.isPending && <CycleDeskSkeleton />}
      {can('ATTENDANCE') && hasPeople && o && <CycleDesk overview={o} date={date} />}
      <FormError error={overview.error} />
      <div className="grid min-w-0 items-start gap-3 lg:grid-cols-12">
        <div className="min-w-0 space-y-3 lg:col-span-8">{ready ? cards.map((c) => <Fragment key={c.key}>{c.node}</Fragment>) : <ManageWorkspaceSkeleton label="Loading your role's pages" />}</div>
        <div className="min-w-0 space-y-3 lg:col-span-4">{ready ? focus : <HomeRoleSkeleton dark />}</div>
      </div>
      {ready && workspace}
    </div>
  )
}

const REMEMBER_KEY = 'hrms.manage.layout'
type Remembered = { decisions: boolean; month: boolean; payroll: boolean }
function readRemembered(): Remembered {
  try {
    const v = JSON.parse(window.localStorage.getItem(REMEMBER_KEY) ?? '{}') as Partial<Remembered>
    return { decisions: v.decisions !== false, month: v.month === true, payroll: v.payroll === true }
  } catch {
    return { decisions: true, month: false, payroll: false }
  }
}
function remember(value: Remembered) {
  try { window.localStorage.setItem(REMEMBER_KEY, JSON.stringify(value)) } catch { /* storage blocked: the default order loads */ }
}
