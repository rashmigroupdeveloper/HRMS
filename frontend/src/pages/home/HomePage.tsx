import { useQuery } from '@tanstack/react-query'
import { CalendarCheck, CircleAlert, Fingerprint, FolderOpen, IdCard, Inbox, Palmtree, ShieldCheck, UserRound, Users, Wallet } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { FormError } from '@/components/FormError'
import { HomeAttendanceSkeleton } from '@/components/skeletons/home/HomePanelsSkeleton'
import { HomeTodaySkeleton, HomeWeekSkeleton } from '@/components/skeletons/home/HomeWidgetsSkeleton'
import { Skeleton } from '@/components/ui/skeleton'
import { useAccess } from '@/hooks/useAccess'
import { orpc } from '@/lib/orpc'
import { cn, todayDay } from '@/lib/utils'
import { SELF_SERVICE_NAME } from '@/lib/active-role'
import { HomeAttendance } from './components/HomeAttendance'
import { HomeAwayWeek } from './components/HomeAwayWeek'
import { HomeHolidays } from './components/HomeHolidays'
import { HomeLeave } from './components/HomeLeave'
import { HomeMonthStrip } from './components/HomeMonthStrip'
import { AllClear, CardTitle, CornerLink, type Headline, HeadlineStats, TILE } from './components/HomeParts'
import { HomeDecisions, HomeMyRequests } from './components/HomeRequests'
import { HomeToday } from './components/HomeToday'
import { HomeToFix } from './components/HomeToFix'
import { HomeWeek } from './components/HomeWeek'
import { greeting } from './components/greeting'
import { weekOf } from './components/home-labels'
import { QuickLink, type Shortcut } from './components/QuickLink'
import { useMyDays } from './components/useMyDays'
import { useToFix } from './components/useToFix'

// Employee self-service's home (/ess) - after Crextio's composition (crextio-ref/NOTES.md), rebuilt 2026-11-27 as one
// regular grid (the user: "irregular - keep it compact and subtle"): the greeting with the attendance month as a strip
// and big headline numbers, then tiles of ONE height, one or two columns wide, packed four to a row - and a calm line of
// checks for what needs nothing. The user's two rules (2026-11-27):
// - what needs the employee comes first: decisions waiting and days to fix are the first tiles; with nothing waiting
//   they get no tile, only a check in the calm line;
// - self-service is about oneself and, for a manager, the people who report to them DIRECTLY - not the whole reporting
//   tree or an HOD department (those stay on Team attendance / Team leave and in the role portal).
// The role's work is the role portal's home (/manage).
export function HomePage() {
  const { me, ready } = useAccess()
  const [now] = useState(() => new Date())
  const [date] = useState(todayDay)
  const profile = useQuery({ ...orpc.employees.getByCode.queryOptions({ input: { employeeCode: me?.employeeCode ?? '' } }), enabled: !!me })
  const overview = useQuery(orpc.attendance.overview.queryOptions())
  // Start the decision reader alongside overview: choosing a layout must not create a second loading sequence.
  const toDecide = useQuery({ ...orpc.approvals.listToDecide.queryOptions(), enabled: ready })
  const requests = useQuery({ ...orpc.approvals.listMine.queryOptions(), enabled: ready })
  const o = overview.data
  // what this browser showed last, so the loading state draws the tiles that will load - a per-browser convenience
  // only; the answers always come from the readers (2026-11-27)
  const [remembered] = useState(readRemembered)
  const hasPeople = o ? o.directReports > 0 : overview.isPending && remembered.team
  const fix = useToFix(o)
  const my = useMyDays(o)
  const week = weekOf(date)
  // the direct reports' leave this week - the same query "Away this week" reads
  const away = useQuery({ ...orpc.leave.applications.list.queryOptions({ input: { scope: 'DIRECT', from: week[0]!, to: week[6]! } }), enabled: !!o && hasPeople })
  const decisionsWaiting = toDecide.data ? toDecide.data.length > 0 : remembered.decisions
  const fixWaiting = !fix.pending ? fix.days.length > 0 : remembered.fix
  const someoneAway = away.data ? away.data.length > 0 : remembered.away
  const anyRequests = requests.data ? requests.data.length > 0 : remembered.requests
  useEffect(() => {
    if (o && toDecide.data && requests.data && !fix.pending && (!(o.directReports > 0) || away.data)) {
      remember({ team: o.directReports > 0, decisions: toDecide.data.length > 0, fix: fix.days.length > 0, away: (away.data?.length ?? 0) > 0, requests: requests.data.length > 0 })
    }
  }, [o, toDecide.data, requests.data, fix.pending, fix.days.length, away.data])
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
  // the tiles, most urgent first (decisions past due, decisions, days to fix), then the team, the day, the week, time off
  const late = toDecide.data?.some((r) => r.step?.late) ?? false
  const tiles: { key: string; score: number; span: 1 | 2; node: ReactNode }[] = [
    ...(decisionsWaiting ? [{ key: 'decisions', score: late ? 50 : 40, span: 2 as const, node: <HomeDecisions light /> }] : []),
    ...(fixWaiting ? [{ key: 'fix', score: 30, span: 1 as const, node: <HomeToFix overview={o} dark={!hasPeople} /> }] : []),
    ...(hasPeople ? [{ key: 'people', score: 25, span: 1 as const, node: o ? <HomeAttendance overview={o} date={date} dark direct /> : <section className={cn(TILE, 'home-panel-dark home-people-dark text-hero-foreground')}><h2 className="text-xl leading-tight font-light tracking-tight">People today</h2><HomeAttendanceSkeleton dark /></section> }] : []),
    { key: 'today', score: 20, span: 1 as const, node: o ? <HomeToday overview={o} /> : <HomeTodaySkeleton /> },
    { key: 'week', score: 19, span: 1 as const, node: o ? <HomeWeek overview={o} /> : <HomeWeekSkeleton /> },
    ...(hasPeople && someoneAway ? [{ key: 'away', score: 12, span: 2 as const, node: <HomeAwayWeek directReports={o?.directReports ?? 0} /> }] : []),
    { key: 'leave', score: 10, span: 1 as const, node: <HomeLeave /> },
    { key: 'holidays', score: 9, span: 1 as const, node: <HomeHolidays /> },
    ...(anyRequests ? [{ key: 'requests', score: 8, span: 1 as const, node: <HomeMyRequests /> }] : []),
  ].sort((x, y) => y.score - x.score)
  // the details tile completes the last row (four columns wide, two from md), so the grid ends square
  const used = tiles.reduce((n, t) => n + t.span, 0)
  const detailsSpan = (4 - (used % 4)) as 1 | 2 | 3 | 4
  const detailsSpanMd = used % 2 === 0 ? 2 : 1
  // what needs nothing: a check in the calm line instead of a tile
  const clear = [
    ...(hasPeople && toDecide.data && !decisionsWaiting ? [{ label: 'No decisions waiting', to: '/ess/approvals' }] : []),
    ...(!fix.pending && !fixWaiting ? [{ label: 'Every working day of the last 30 in order', to: '/ess/attendance' }] : []),
    ...(hasPeople && away.data && !someoneAway ? [{ label: 'Nobody away this week', to: '/ess/team-leave' }] : []),
    ...(requests.data && !anyRequests ? [{ label: 'No requests raised', to: '/ess/approvals?tab=mine' }] : []),
  ]
  return <div className="home-dashboard space-y-5">
    {/* one compact band (the user, 2026-11-27: the header took too much space): greeting and numbers on one row, the
        attendance month as a thin bar under them */}
    <header className="home-arrive space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long' })} · {SELF_SERVICE_NAME}</p>
          <h1 className="text-[26px] leading-tight font-light tracking-tight sm:text-[30px]">{greeting(now)}{me ? `, ${me.name.split(' ')[0]}` : ''}</h1>
        </div>
        <HeadlineStats stats={headlines.map((h) => ({ ...h, value: h.value ?? '—' }))} loading={loadingHeadlines} />
      </div>
      {!overview.isError && <HomeMonthStrip overview={o} />}
    </header>
    {overview.isError && <section className="home-panel p-4"><h2 className="text-lg font-light">Attendance</h2><FormError error={overview.error} /><Link to="/ess/attendance" className="flex min-h-9 items-center text-sm underline underline-offset-4">Open attendance to retry</Link></section>}
    <div className="grid min-w-0 grid-flow-row-dense gap-4 md:grid-cols-2 xl:grid-cols-4">
      {tiles.map((t) => <div key={t.key} className={cn('home-tile min-w-0', t.span === 2 && 'md:col-span-2')}>{t.node}</div>)}
      <div className={cn('min-w-0', detailsSpan < 4 && 'home-tile', MD_SPAN[detailsSpanMd], XL_SPAN[detailsSpan])}>
        <PersonalLinks span={detailsSpan} hasSalary={!!profile.data?.salary} loading={profile.isPending} />
      </div>
    </div>
    <AllClear items={clear} />
  </div>
}

// (literal class names, so the stylesheet keeps them)
const MD_SPAN: Record<1 | 2, string> = { 1: 'md:col-span-1', 2: 'md:col-span-2' }
const XL_SPAN: Record<1 | 2 | 3 | 4, string> = { 1: 'xl:col-span-1', 2: 'xl:col-span-2', 3: 'xl:col-span-3', 4: 'xl:col-span-4' }
const LINK_COLUMNS: Record<1 | 2 | 3 | 4, string> = { 1: 'grid-cols-2', 2: 'grid-cols-2 sm:grid-cols-3', 3: 'grid-cols-2 sm:grid-cols-3', 4: 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-6' }

function PersonalLinks({ hasSalary, loading, span }: { hasSalary: boolean; loading: boolean; span: 1 | 2 | 3 | 4 }) {
  const links: Shortcut[] = [{ to: '/ess/me?tab=personal', icon: UserRound, title: 'Personal details', text: 'Family & contacts' }, { to: '/ess/me?tab=ids', icon: IdCard, title: 'IDs & bank', text: 'Your saved information' }, { to: '/ess/me?tab=documents', icon: FolderOpen, title: 'My documents', text: 'Joining documents' }, { to: '/ess/employees', icon: Users, title: 'People directory', text: 'Find a colleague' }, { to: '/ess/me?tab=statutory', icon: ShieldCheck, title: 'PF & ESIC', text: 'Your statutory numbers' }]
  const all = hasSalary ? [...links, { to: '/ess/me?tab=salary', icon: Wallet, title: 'My salary', text: 'CTC & monthly breakup' }] : links
  if (span === 1) return <section className={TILE}><CardTitle title="My details" action={<CornerLink to="/ess/me" label="Open my profile" />} /><ul className="mt-2 divide-y divide-border/60">{all.map(({ to, icon: Icon, title }) => <li key={to}><Link to={to} className="flex min-h-10 items-center gap-2.5 rounded-lg text-sm outline-none hover:bg-surface-2/60 focus-visible:ring-2 focus-visible:ring-ring"><Icon aria-hidden className="size-4 text-muted-foreground" />{title}</Link></li>)}</ul></section>
  return <section className={TILE}><CardTitle title="My details & documents" action={<CornerLink to="/ess/me" label="Open my profile" />} /><div className={cn('mt-1 grid gap-x-3', LINK_COLUMNS[span])}>{links.map(item => <QuickLink key={item.to} {...item} />)}{loading ? <div role="status" aria-label="Loading your salary link" className="flex min-h-14 items-center gap-2"><Skeleton className="size-8 shrink-0 rounded-full" /><div className="space-y-2"><Skeleton className="h-3 w-24 rounded" /><Skeleton className="h-3 w-20 rounded" /></div></div> : hasSalary && <QuickLink to="/ess/me?tab=salary" icon={Wallet} title="My salary" text="CTC & monthly breakup" />}</div></section>
}

const REMEMBER_KEY = 'hrms.home.layout'
type Remembered = { team: boolean; decisions: boolean; fix: boolean; away: boolean; requests: boolean }
function readRemembered(): Remembered {
  try {
    const v = JSON.parse(window.localStorage.getItem(REMEMBER_KEY) ?? '{}') as Partial<Remembered>
    return { team: v.team === true, decisions: v.decisions === true, fix: v.fix === true, away: v.away === true, requests: v.requests !== false }
  } catch {
    return { team: false, decisions: false, fix: false, away: false, requests: true }
  }
}
function remember(value: Remembered) {
  try { window.localStorage.setItem(REMEMBER_KEY, JSON.stringify(value)) } catch { /* storage blocked: the default layout loads */ }
}
