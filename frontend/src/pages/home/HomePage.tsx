import { useQuery } from '@tanstack/react-query'
import { FolderOpen, IdCard, ShieldCheck, UserRound, Users, Wallet } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { FormError } from '@/components/FormError'
import { HomeAttendanceSkeleton } from '@/components/skeletons/home/HomePanelsSkeleton'
import { HomeMyDaySkeleton } from '@/components/skeletons/home/HomeWidgetsSkeleton'
import { Skeleton } from '@/components/ui/skeleton'
import { useAccess } from '@/hooks/useAccess'
import { orpc } from '@/lib/orpc'
import { todayDay } from '@/lib/utils'
import { SELF_SERVICE_NAME } from '@/lib/active-role'
import { HomeAttendance } from './components/HomeAttendance'
import { HomeAwayWeek } from './components/HomeAwayWeek'
import { HomeHolidays } from './components/HomeHolidays'
import { HomeLeave } from './components/HomeLeave'
import { HomeMyDay } from './components/HomeMyDay'
import { HomePersonalAttendance } from './components/HomePersonalAttendance'
import { HomeDecisions, HomeMyRequests } from './components/HomeRequests'
import { greeting } from './components/greeting'
import { QuickLink, type Shortcut } from './components/QuickLink'

// Employee self-service's home (/ess), arranged around the employee's own work, from main's employee / manager dashboards
// (2026-11-27: "My day" with first in / last out and the shift now, the days still to fix, coming holidays, who of the
// team is away this week). Without a team: one's own day first. With a team or an HOD department: the decisions and the
// people today first, one's own day below. The role's work is the role portal's home (/manage - ManageHomePage).
export function HomePage() {
  const { me, ready } = useAccess()
  const [now] = useState(() => new Date())
  const [date] = useState(todayDay)
  const profile = useQuery({ ...orpc.employees.getByCode.queryOptions({ input: { employeeCode: me?.employeeCode ?? '' } }), enabled: !!me })
  const overview = useQuery(orpc.attendance.overview.queryOptions())
  // Start the decision reader alongside overview: choosing a layout must not create a second loading sequence.
  const toDecide = useQuery({ ...orpc.approvals.listToDecide.queryOptions(), enabled: ready })
  const o = overview.data
  // the layout this browser showed last (team or not), so the loading state draws the page that will load - a per-browser
  // convenience only; the answer always comes from attendance.overview (2026-11-27)
  const [rememberedTeam] = useState(() => readRememberedTeam())
  const hasPeople = o ? o.teamSize > 0 || o.departmentSize > 0 : overview.isPending && rememberedTeam
  useEffect(() => { if (o) rememberTeam(o.teamSize > 0 || o.departmentSize > 0) }, [o])
  const links = <PersonalLinks hasSalary={!!profile.data?.salary} loading={profile.isPending} />
  const myDay = o ? <HomeMyDay overview={o} /> : overview.isPending ? <HomeMyDaySkeleton /> : null
  const overviewError = overview.isError && (
    <section className="home-panel p-5"><h2 className="text-lg font-medium">Attendance</h2><FormError error={overview.error} /><Link to="/ess/attendance" className="flex min-h-10 items-center text-sm underline underline-offset-4">Open attendance to retry</Link></section>
  )
  return <div className="home-dashboard space-y-4">
    <header className="home-arrive flex flex-wrap items-end justify-between gap-x-6 gap-y-3 pb-1">
      <div><h1 className="text-[28px] font-light leading-tight tracking-tight sm:text-[40px]">{greeting(now)}{me ? `, ${me.name.split(' ')[0]}` : ''}</h1><p className="mt-2 text-sm text-muted-foreground">{hasPeople ? 'Your team today, and your own day. Keep the next steps moving.' : 'Your day, your time off and your requests in one place.'}</p></div>
      <div className="flex flex-wrap items-center gap-2 text-xs"><span className="max-w-full break-words rounded-full bg-card px-3 py-2 font-medium">{SELF_SERVICE_NAME}</span><span className="text-muted-foreground">{now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short' })}</span></div>
    </header>
    {hasPeople ? (
      <>
        <div className="grid min-w-0 gap-3 lg:grid-cols-12">
          <div className="min-w-0 lg:col-span-8"><HomeDecisions light /></div>
          <div className="min-w-0 lg:col-span-4 lg:row-span-2">{o ? <HomeAttendance overview={o} date={date} dark /> : <section className="home-panel home-panel-dark home-people-dark min-w-0 p-4 text-hero-foreground sm:p-5"><h2 className="text-lg font-medium tracking-tight">People today</h2><HomeAttendanceSkeleton dark /></section>}</div>
          <div className="min-w-0 lg:col-span-8"><HomeAwayWeek /></div>
        </div>
        <div className="grid min-w-0 items-start gap-3 lg:grid-cols-3">
          <div className="min-w-0">{myDay}</div>
          <div className="min-w-0 space-y-3"><HomeLeave /><HomeHolidays /></div>
          <div className="min-w-0 space-y-3"><HomeMyRequests />{links}</div>
        </div>
      </>
    ) : (
      <>
        <div className="grid min-w-0 gap-3 lg:grid-cols-12">
          <div className="min-w-0 lg:col-span-8">{overviewError || myDay}</div>
          <div className="min-w-0 space-y-3 lg:col-span-4 lg:row-span-2">{!overview.isError && <HomePersonalAttendance overview={o} />}{links}</div>
          <div className="grid min-w-0 items-start gap-3 sm:grid-cols-2 lg:col-span-8"><HomeLeave /><HomeHolidays /></div>
        </div>
        <div className="grid min-w-0 items-start gap-3 lg:grid-cols-12">
          <div className={toDecide.data?.length ? 'min-w-0 lg:col-span-8' : 'min-w-0 lg:col-span-12'}><HomeMyRequests /></div>
          {/* a decision named to someone without a team (an escalation, a functional manager) - only when one waits */}
          {!!toDecide.data?.length && <div className="min-w-0 lg:col-span-4"><HomeDecisions light compact /></div>}
        </div>
      </>
    )}
  </div>
}

function PersonalLinks({ hasSalary, loading }: { hasSalary: boolean; loading: boolean }) {
  const links: Shortcut[] = [{ to: '/ess/me?tab=personal', icon: UserRound, title: 'Personal details', text: 'Family & contacts' }, { to: '/ess/me?tab=ids', icon: IdCard, title: 'IDs & bank', text: 'Your saved information' }, { to: '/ess/me?tab=documents', icon: FolderOpen, title: 'My documents', text: 'Joining documents' }, { to: '/ess/employees', icon: Users, title: 'People directory', text: 'Find a colleague' }, { to: '/ess/me?tab=statutory', icon: ShieldCheck, title: 'PF & ESIC', text: 'Your statutory numbers' }]
  return <div className="home-panel p-4 sm:p-5"><h2 className="mb-2 text-lg font-medium tracking-tight">My details &amp; documents</h2><div className="grid grid-cols-2 gap-x-4">{links.map(item => <QuickLink key={item.to} {...item} />)}{loading ? <div role="status" aria-label="Loading your salary link" className="flex min-h-14 items-center gap-2"><Skeleton className="size-8 shrink-0 rounded-full" /><div className="space-y-2"><Skeleton className="h-3 w-24 rounded" /><Skeleton className="h-3 w-20 rounded" /></div></div> : hasSalary && <QuickLink to="/ess/me?tab=salary" icon={Wallet} title="My salary" text="CTC & monthly breakup" />}</div></div>
}

const TEAM_KEY = 'hrms.home.team'
function readRememberedTeam() {
  try { return window.localStorage.getItem(TEAM_KEY) === '1' } catch { return false }
}
function rememberTeam(team: boolean) {
  try { window.localStorage.setItem(TEAM_KEY, team ? '1' : '0') } catch { /* storage blocked: the default layout loads */ }
}
