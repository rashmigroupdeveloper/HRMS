import { useQuery } from '@tanstack/react-query'
import { CalendarCheck, CircleAlert, Fingerprint, FolderOpen, IdCard, Inbox, Palmtree, ShieldCheck, UserRound, Users, Wallet } from 'lucide-react'
import { Fragment, type ReactNode, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { FormError } from '@/components/FormError'
import { HomeAttendanceSkeleton } from '@/components/skeletons/home/HomePanelsSkeleton'
import { HomeTodaySkeleton, HomeWeekSkeleton } from '@/components/skeletons/home/HomeWidgetsSkeleton'
import { Skeleton } from '@/components/ui/skeleton'
import { useAccess } from '@/hooks/useAccess'
import { orpc } from '@/lib/orpc'
import { todayDay } from '@/lib/utils'
import { SELF_SERVICE_NAME } from '@/lib/active-role'
import { HomeAttendance } from './components/HomeAttendance'
import { HomeAwayWeek } from './components/HomeAwayWeek'
import { HomeHolidays } from './components/HomeHolidays'
import { HomeLeave } from './components/HomeLeave'
import { HomeMonthStrip } from './components/HomeMonthStrip'
import { CardTitle, CornerLink, type Headline, HeadlineStats } from './components/HomeParts'
import { HomeDecisions, HomeMyRequests } from './components/HomeRequests'
import { HomeToday } from './components/HomeToday'
import { HomeToFix } from './components/HomeToFix'
import { HomeWeek } from './components/HomeWeek'
import { greeting } from './components/greeting'
import { QuickLink, type Shortcut } from './components/QuickLink'
import { useMyDays } from './components/useMyDays'
import { useToFix } from './components/useToFix'

// Employee self-service's home (/ess) - redesigned 2026-11-27 after Crextio's composition (crextio-ref/NOTES.md): the
// greeting with the attendance month as a segmented strip, big light headline numbers on the right, then cards with light
// titles and a round arrow link. Two rules from the user (2026-11-27):
// - what needs the employee comes first: decisions waiting and days to fix rise to the top of the main column; with
//   nothing waiting they become slim calm rows at its bottom;
// - self-service is about oneself and, for a manager, the people who report to them DIRECTLY - not the whole reporting
//   tree or an HOD department (those stay on the Team attendance / Team leave pages and the role portal).
// The role's work is the role portal's home (/manage).
export function HomePage() {
  const { me, ready } = useAccess()
  const [now] = useState(() => new Date())
  const [date] = useState(todayDay)
  const profile = useQuery({ ...orpc.employees.getByCode.queryOptions({ input: { employeeCode: me?.employeeCode ?? '' } }), enabled: !!me })
  const overview = useQuery(orpc.attendance.overview.queryOptions())
  // Start the decision reader alongside overview: choosing a layout must not create a second loading sequence.
  const toDecide = useQuery({ ...orpc.approvals.listToDecide.queryOptions(), enabled: ready })
  const o = overview.data
  // what this browser showed last (a team; decisions / days to fix waiting), so the loading state draws the page that will
  // load - a per-browser convenience only; the answers always come from the readers (2026-11-27)
  const [remembered] = useState(readRemembered)
  const hasPeople = o ? o.directReports > 0 : overview.isPending && remembered.team
  const fix = useToFix(o)
  const my = useMyDays(o)
  const decisionsWaiting = toDecide.data ? toDecide.data.length > 0 : remembered.decisions
  const fixWaiting = !fix.pending ? fix.days.length > 0 : remembered.fix
  useEffect(() => {
    if (o && toDecide.data && !fix.pending) remember({ team: o.directReports > 0, decisions: toDecide.data.length > 0, fix: fix.days.length > 0 })
  }, [o, toDecide.data, fix.pending, fix.days.length])
  // the headline numbers: for a manager the direct reports, who of them punched in today and the decisions; for everyone
  // else the leave days left, the days to fix and the days present this attendance month
  const board = useQuery({ ...orpc.attendance.days.board.queryOptions({ input: { scope: 'DIRECT', date } }), enabled: !!o && hasPeople })
  const balances = useQuery({ ...orpc.leave.balances.get.queryOptions(), enabled: ready && !hasPeople })
  const headlines: { icon: Headline['icon']; label: string; value: number | null; to: string }[] = hasPeople
    ? [
        { icon: Users, label: 'Report to me', value: o ? o.directReports : null, to: '/ess/team-attendance' },
        { icon: Fingerprint, label: 'Punched in today', value: board.data?.summary.in ?? null, to: '/ess/team-attendance' },
        { icon: Inbox, label: 'Decisions waiting', value: toDecide.data?.length ?? null, to: '/ess/approvals' },
      ]
    : [
        { icon: Palmtree, label: 'Leave days left', value: balances.data ? balances.data.balances.reduce((n, b) => n + (b.available ?? 0), 0) : null, to: '/ess/leave' },
        { icon: CircleAlert, label: 'Days to fix', value: fix.pending ? null : fix.days.length, to: '/ess/attendance' },
        { icon: CalendarCheck, label: 'Present this month', value: my.month && !my.pending ? my.month.totals.present : null, to: '/ess/attendance' },
      ]
  const loadingHeadlines = headlines.some((h) => h.value === null) && !overview.isError
  const links = (narrow: boolean) => <PersonalLinks narrow={narrow} hasSalary={!!profile.data?.salary} loading={profile.isPending} />
  const todayWeek = (
    <div className="grid min-w-0 gap-3 sm:grid-cols-2">
      {o ? <HomeToday overview={o} /> : overview.isPending ? <HomeTodaySkeleton /> : null}
      {o ? <HomeWeek overview={o} /> : overview.isPending ? <HomeWeekSkeleton /> : null}
    </div>
  )
  // the main column, most urgent first (a stable sort keeps the rest in this order): decisions past due, decisions waiting,
  // days to fix, then the employee's day, the team's week, time off - and the calm "nothing waiting" rows last
  const late = toDecide.data?.some((r) => r.step?.late) ?? false
  const cards: { key: string; score: number; node: ReactNode }[] = [
    // without a team a decision is rare (an escalation, a functional manager): shown only when one waits
    ...(hasPeople || decisionsWaiting ? [{ key: 'decisions', score: decisionsWaiting ? (late ? 50 : 40) : 1, node: <HomeDecisions light /> }] : []),
    { key: 'fix', score: fixWaiting ? 30 : 1, node: <HomeToFix overview={o} dark={!hasPeople && fixWaiting} /> },
    { key: 'today', score: 20, node: todayWeek },
    ...(hasPeople ? [{ key: 'away', score: 10, node: <HomeAwayWeek directReports={o?.directReports ?? 0} /> }] : []),
    { key: 'time-off', score: 5, node: <div className="grid min-w-0 items-start gap-3 sm:grid-cols-2"><HomeLeave /><HomeHolidays /></div> },
  ].sort((x, y) => y.score - x.score)
  const overviewError = overview.isError && (
    <section className="home-panel p-5"><h2 className="text-xl font-light">Attendance</h2><FormError error={overview.error} /><Link to="/ess/attendance" className="flex min-h-10 items-center text-sm underline underline-offset-4">Open attendance to retry</Link></section>
  )
  return <div className="home-dashboard space-y-4">
    <header className="home-arrive grid min-w-0 items-end gap-x-8 gap-y-5 pb-2 lg:grid-cols-12">
      <div className="min-w-0 space-y-5 lg:col-span-7">
        <div>
          <p className="text-xs text-muted-foreground">{now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long' })} · {SELF_SERVICE_NAME}</p>
          <h1 className="mt-1 text-[32px] leading-tight font-light tracking-tight sm:text-[44px]">{greeting(now)}{me ? `, ${me.name.split(' ')[0]}` : ''}</h1>
        </div>
        {!overview.isError && <HomeMonthStrip overview={o} />}
      </div>
      <div className="min-w-0 lg:col-span-5 lg:justify-self-end"><HeadlineStats stats={headlines.map((h) => ({ ...h, value: h.value ?? '—' }))} loading={loadingHeadlines} /></div>
    </header>
    {overviewError}
    {!overview.isError && (
      <div className="grid min-w-0 items-start gap-3 lg:grid-cols-12">
        <div className="min-w-0 space-y-3 lg:col-span-8">{cards.map((c) => <Fragment key={c.key}>{c.node}</Fragment>)}</div>
        <div className="min-w-0 space-y-3 lg:col-span-4">
          {hasPeople && (o ? <HomeAttendance overview={o} date={date} dark direct /> : <section className="home-panel home-panel-dark home-people-dark min-w-0 p-4 text-hero-foreground sm:p-5"><h2 className="text-xl font-light tracking-tight">People today</h2><HomeAttendanceSkeleton dark /></section>)}
          <HomeMyRequests />
          {/* without a team the right column has room for one's details; with one they run along the bottom */}
          {!hasPeople && links(true)}
        </div>
      </div>
    )}
    {(hasPeople || overview.isError) && links(false)}
  </div>
}

function PersonalLinks({ hasSalary, loading, narrow }: { hasSalary: boolean; loading: boolean; narrow: boolean }) {
  const links: Shortcut[] = [{ to: '/ess/me?tab=personal', icon: UserRound, title: 'Personal details', text: 'Family & contacts' }, { to: '/ess/me?tab=ids', icon: IdCard, title: 'IDs & bank', text: 'Your saved information' }, { to: '/ess/me?tab=documents', icon: FolderOpen, title: 'My documents', text: 'Joining documents' }, { to: '/ess/employees', icon: Users, title: 'People directory', text: 'Find a colleague' }, { to: '/ess/me?tab=statutory', icon: ShieldCheck, title: 'PF & ESIC', text: 'Your statutory numbers' }]
  return <div className="home-panel p-4 sm:p-5"><CardTitle title="My details & documents" action={<CornerLink to="/ess/me" label="Open my profile" />} /><div className={`mt-2 grid grid-cols-2 gap-x-4 ${narrow ? 'sm:grid-cols-3 lg:grid-cols-2' : 'sm:grid-cols-3 xl:grid-cols-6'}`}>{links.map(item => <QuickLink key={item.to} {...item} />)}{loading ? <div role="status" aria-label="Loading your salary link" className="flex min-h-14 items-center gap-2"><Skeleton className="size-8 shrink-0 rounded-full" /><div className="space-y-2"><Skeleton className="h-3 w-24 rounded" /><Skeleton className="h-3 w-20 rounded" /></div></div> : hasSalary && <QuickLink to="/ess/me?tab=salary" icon={Wallet} title="My salary" text="CTC & monthly breakup" />}</div></div>
}

const REMEMBER_KEY = 'hrms.home.layout'
type Remembered = { team: boolean; decisions: boolean; fix: boolean }
function readRemembered(): Remembered {
  try {
    const v = JSON.parse(window.localStorage.getItem(REMEMBER_KEY) ?? '{}') as Partial<Remembered>
    return { team: v.team === true, decisions: v.decisions === true, fix: v.fix === true }
  } catch {
    return { team: false, decisions: false, fix: false }
  }
}
function remember(value: Remembered) {
  try { window.localStorage.setItem(REMEMBER_KEY, JSON.stringify(value)) } catch { /* storage blocked: the default layout loads */ }
}
