import { useQuery } from '@tanstack/react-query'
import { Building2, CalendarCog, CircleAlert, FileText, Fingerprint, HandCoins, History, Inbox, Landmark, ListChecks, ShieldCheck, UserPlus, Users, Workflow } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { FormError } from '@/components/FormError'
import { CycleDeskSkeleton, HomeAttendanceSkeleton } from '@/components/skeletons/home/HomePanelsSkeleton'
import { ManageWorkspaceSkeleton } from '@/components/skeletons/home/ManageWorkspaceSkeleton'
import { useAccess } from '@/hooks/useAccess'
import { orpc } from '@/lib/orpc'
import { cn, todayDay } from '@/lib/utils'
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
import { AllClear, CardTitle, HeadlineStats, TILE } from './components/HomeParts'
import { useMonthClose } from './components/useMonthClose'
import { usePayrollRuns } from './components/usePayrollRuns'

// The role portal's home (/manage - the user, 2026-11-25): only the active role's work - its approval steps, joining work
// (Onboarding), the people today in its data access plus one's own team, the requests raised for others, the role's
// numbers (the attendance month to close, payroll runs, joiners & leavers, who is away) and its pages - each shown only
// with the access its reader needs (a role switch reloads the page with the new role's). One's own attendance, leave and
// details are on Employee self-service's home (/ess), never here.
// 2026-11-27 (the user), as /ess: big headline numbers from the role's access, then the attendance cycle (the start day
// from Attendance setup) as the one reading of who is in today. Under that, ONE regular grid of tiles of one height
// (one or two columns wide, four to a row), most urgent first - decisions waiting, a month over and not locked, a pay
// month without a run, open joining tasks - and a calm line of checks for what needs nothing; the role's pages complete
// the last row. The people tile is the names worth a look.
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
  const canPayroll = can('PAYROLL')
  // the readers behind the numbers and the order - the same queries the tiles read (shared, so nothing loads twice)
  const toDecide = useQuery({ ...orpc.approvals.listToDecide.queryOptions(), enabled: ready })
  const raised = useQuery({ ...orpc.approvals.listMine.queryOptions(), enabled: ready })
  const board = useQuery({ ...orpc.attendance.days.board.queryOptions({ input: { scope: 'ALL', date } }), enabled: ready && can('ATTENDANCE') })
  const tasks = useQuery({ ...orpc.joiningTasks.list.queryOptions({ input: { scope: 'ALL', status: 'OPEN' } }), enabled: ready && joining })
  const offers = useQuery({ ...orpc.candidates.list.queryOptions({ input: { status: 'ACCEPTED' } }), enabled: ready && isHR })
  const first = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
  const movements = useQuery({ ...orpc.employees.movements.list.queryOptions({ input: { from: first, to: date, pageSize: 1 } }), enabled: ready && can('EMPLOYEES') })
  const month = useMonthClose(o, ready && locks)
  const payroll = usePayrollRuns(o, ready && canPayroll)
  const openTasks = tasks.data ? tasks.data.teams.reduce((n, t) => n + t.open, 0) : null
  // what this browser saw last, so the loading state draws the order that will load - a per-browser convenience only;
  // the answers always come from the readers (2026-11-27)
  const [remembered] = useState(readRemembered)
  const decisionsWaiting = toDecide.data ? toDecide.data.length > 0 : remembered.decisions
  const monthUrgent = month.pending ? remembered.month : !!month.overdue
  const payrollUrgent = payroll.pending ? remembered.payroll : payroll.dueMissing
  const anyRaised = raised.data ? raised.data.length > 0 : remembered.raised
  const anyOffers = offers.data ? offers.data.length > 0 : remembered.offers
  useEffect(() => {
    if (toDecide.data && raised.data && (!locks || !month.pending) && (!canPayroll || !payroll.pending) && (!isHR || offers.data)) {
      remember({ decisions: toDecide.data.length > 0, month: !!month.overdue, payroll: payroll.dueMissing, raised: raised.data.length > 0, offers: (offers.data?.length ?? 0) > 0 })
    }
  }, [toDecide.data, raised.data, locks, month.pending, month.overdue, canPayroll, payroll.pending, payroll.dueMissing, isHR, offers.data])
  const headlines = [
    { icon: Inbox, label: 'Decisions waiting', value: toDecide.data?.length ?? null, to: '/manage/approvals' },
    ...(joining ? [{ icon: ListChecks, label: 'Open joining tasks', value: openTasks, to: '/manage/joining-tasks?tab=all' }] : []),
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
    ...(can('PAYROLL_PAYMENTS') ? [{ to: '/manage/salary-payments', icon: HandCoins, title: 'Salary payments', text: 'Batches & what is owed' }] : []),
    ...(can('STATUTORY_DEPOSITS') ? [{ to: '/manage/statutory-deposits', icon: Landmark, title: 'Statutory deposits', text: 'PF, ESIC, PT & LWF due' }] : []),
    ...(can('LETTER_TEMPLATES') ? [{ to: '/manage/letter-templates', icon: FileText, title: 'Letter templates', text: 'Manage your letters' }] : []),
    ...(can('ACCESS') ? [{ to: '/manage/access', icon: ShieldCheck, title: 'Roles & access', text: 'Logins & permissions' }] : []),
    ...(can('APPROVAL_CHAINS') ? [{ to: '/manage/approval-chains', icon: Workflow, title: 'Approval rules', text: 'Who approves what' }] : []),
    ...(can('CHANGE_HISTORY') ? [{ to: '/manage/change-history', icon: History, title: 'Change history', text: 'Who changed what' }] : []),
  ]
  // the tiles, most urgent first. One dark tile: the joining work for HR, otherwise the people today.
  const late = toDecide.data?.some((r) => r.step?.late) ?? false
  const peopleTile = overview.isPending
    ? <section className={cn(TILE, !isHR && 'home-panel-dark home-people-dark text-hero-foreground')}><h2 className="text-xl leading-tight font-light tracking-tight">People today</h2><HomeAttendanceSkeleton dark={!isHR} figures={false} /></section>
    : <HomeAttendance overview={o!} date={date} dark={!isHR} figures={false} />
  const tiles: { key: string; score: number; span: 1 | 2; node: ReactNode }[] = [
    ...(decisionsWaiting ? [{ key: 'decisions', score: late ? 50 : 40, span: 2 as const, node: <HomeDecisions light /> }] : []),
    ...(locks ? [{ key: 'month', score: monthUrgent ? 35 : 8, span: 1 as const, node: <HomeMonthClose overview={o} /> }] : []),
    ...(joining && openTasks !== 0 ? [{ key: 'joining', score: 28, span: 1 as const, node: <HomeJoiningWork /> }] : []),
    ...(canPayroll ? [{ key: 'payroll', score: payrollUrgent ? 26 : 6, span: 1 as const, node: <HomePayroll overview={o} /> }] : []),
    ...(overview.isPending || hasPeople ? [{ key: 'people', score: 15, span: 1 as const, node: peopleTile }] : []),
    ...(isHR && anyOffers ? [{ key: 'offers', score: 7, span: 1 as const, node: <HomePreJoining /> }] : []),
    ...(anyRaised ? [{ key: 'raised', score: 5, span: 1 as const, node: <HomeMyRequests /> }] : []),
    ...(can('EMPLOYEES') ? [{ key: 'movements', score: 4, span: 1 as const, node: <HomeMovements /> }] : []),
    ...(can('LEAVE') ? [{ key: 'away', score: 3, span: 2 as const, node: <HomeAwayWeek /> }] : []),
  ].sort((x, y) => y.score - x.score)
  // the role's pages complete the last row (four columns wide, two from md), so the grid ends square
  const used = tiles.reduce((n, t) => n + t.span, 0)
  const pagesSpan = (4 - (used % 4)) as 1 | 2 | 3 | 4
  const pagesSpanMd = used % 2 === 0 ? 2 : 1
  // what needs nothing: a check in the calm line instead of a tile
  const clear = [
    ...(toDecide.data && !decisionsWaiting ? [{ label: 'No decisions waiting', to: '/manage/approvals' }] : []),
    ...(joining && openTasks === 0 ? [{ label: 'No open joining tasks', to: '/manage/joining-tasks?tab=all' }] : []),
    ...(isHR && offers.data && !anyOffers ? [{ label: 'No accepted offers waiting to join', to: '/manage/onboarding' }] : []),
    ...(raised.data && !anyRaised ? [{ label: 'Nothing raised for others', to: '/manage/approvals?tab=mine' }] : []),
  ]
  return (
    <div className="home-dashboard space-y-5">
      {/* one compact band, as /ess: greeting and numbers on one row; who is in today is the cycle under this */}
      <header className="home-arrive space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long' })}{role ? ` · ${role}` : ''}</p>
            <h1 className="text-[26px] leading-tight font-light tracking-tight sm:text-[30px]">{greeting(now)}{me ? `, ${me.name.split(' ')[0]}` : ''}</h1>
          </div>
          {ready && <HeadlineStats stats={headlines.map((h) => ({ ...h, value: h.value ?? '—' }))} loading={headlines.some((h) => h.value === null)} />}
        </div>
      </header>
      {can('ATTENDANCE') && overview.isPending && <CycleDeskSkeleton />}
      {can('ATTENDANCE') && hasPeople && o && <CycleDesk overview={o} date={date} />}
      <FormError error={overview.error} />
      {!ready ? <ManageWorkspaceSkeleton label="Loading your role's pages" /> : (
        <div className="grid min-w-0 grid-flow-row-dense gap-4 md:grid-cols-2 xl:grid-cols-4">
          {tiles.map((t) => <div key={t.key} className={cn('home-tile min-w-0', t.span === 2 && 'md:col-span-2')}>{t.node}</div>)}
          <div className={cn('min-w-0', pagesSpan < 4 && 'home-tile', MD_SPAN[pagesSpanMd], XL_SPAN[pagesSpan])}>
            <RolePages work={work} span={pagesSpan} />
          </div>
        </div>
      )}
      {ready && <AllClear items={clear} />}
    </div>
  )
}

// (literal class names, so the stylesheet keeps them)
const MD_SPAN: Record<1 | 2, string> = { 1: 'md:col-span-1', 2: 'md:col-span-2' }
const XL_SPAN: Record<1 | 2 | 3 | 4, string> = { 1: 'xl:col-span-1', 2: 'xl:col-span-2', 3: 'xl:col-span-3', 4: 'xl:col-span-4' }
const PAGE_COLUMNS: Record<1 | 2 | 3 | 4, string> = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-2 sm:grid-cols-3', 4: 'grid-cols-2 md:grid-cols-3 xl:grid-cols-5' }

// the role's set-up pages: a plain list in one column, shortcuts with a line each when wider
function RolePages({ work, span }: { work: Shortcut[]; span: 1 | 2 | 3 | 4 }) {
  return (
    <section className={TILE}>
      <CardTitle title="Your role's pages" />
      {work.length === 0 && <p className="mt-2 text-sm text-muted-foreground">This role gives no set-up pages - its approvals and people are above.</p>}
      {span === 1
        ? <ul className="mt-2 divide-y divide-border/60 overflow-y-auto">{work.map(({ to, icon: Icon, title }) => <li key={to}><Link to={to} className="flex min-h-10 items-center gap-2.5 rounded-lg text-sm outline-none hover:bg-surface-2/60 focus-visible:ring-2 focus-visible:ring-ring"><Icon aria-hidden className="size-4 text-muted-foreground" />{title}</Link></li>)}</ul>
        : <div className={cn('mt-1 grid gap-x-4', PAGE_COLUMNS[span])}>{work.map((item) => <QuickLink key={item.to} {...item} />)}</div>}
    </section>
  )
}

const REMEMBER_KEY = 'hrms.manage.layout'
type Remembered = { decisions: boolean; month: boolean; payroll: boolean; raised: boolean; offers: boolean }
function readRemembered(): Remembered {
  try {
    const v = JSON.parse(window.localStorage.getItem(REMEMBER_KEY) ?? '{}') as Partial<Remembered>
    return { decisions: v.decisions !== false, month: v.month === true, payroll: v.payroll === true, raised: v.raised !== false, offers: v.offers === true }
  } catch {
    return { decisions: true, month: false, payroll: false, raised: true, offers: false }
  }
}
function remember(value: Remembered) {
  try { window.localStorage.setItem(REMEMBER_KEY, JSON.stringify(value)) } catch { /* storage blocked: the default order loads */ }
}
