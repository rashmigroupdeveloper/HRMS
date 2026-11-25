import { HomePersonalAttendance } from './components/HomePersonalAttendance'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, FolderOpen, IdCard, ShieldCheck, UserRound, Wallet } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { FormError } from '@/components/FormError'
import { TodayCardSkeleton } from '@/components/skeletons/common/TodayCardSkeleton'
import { HomeAttendanceSkeleton, HomeRoleSkeleton } from '@/components/skeletons/home/HomePanelsSkeleton'
import { TodayCard } from '@/components/TodayCard'
import { Skeleton } from '@/components/ui/skeleton'
import { useAccess } from '@/hooks/useAccess'
import { orpc } from '@/lib/orpc'
import { formatDate, todayDay } from '@/lib/utils'
import { SELF_SERVICE_NAME } from '@/lib/active-role'
import { HomeAttendance } from './components/HomeAttendance'
import { HomeLeave } from './components/HomeLeave'
import { HomeDecisions, HomeMyRequests } from './components/HomeRequests'
import { greeting } from './components/greeting'
import { QuickLink, type Shortcut } from './components/QuickLink'

// Employee self-service's home (/ess), arranged around the employee's own work, inspired by main's employee / manager
// dashboards: their attendance, leave, requests and details, and - for a manager or an HOD - their team today and the steps
// named to them. The role's work is the role portal's home (/manage - ManageHomePage, 2026-11-25).
export function HomePage() {
  const { me, ready } = useAccess()
  const [now] = useState(() => new Date())
  const [date] = useState(todayDay)
  const profile = useQuery({ ...orpc.employees.getByCode.queryOptions({ input: { employeeCode: me?.employeeCode ?? '' } }), enabled: !!me })
  const overview = useQuery(orpc.attendance.overview.queryOptions())
  // Start the decision reader alongside overview: choosing a layout must not create a second loading sequence.
  useQuery({ ...orpc.approvals.listToDecide.queryOptions(), enabled: ready })
  const e = profile.data
  const hasPeople = !!overview.data && (overview.data.teamSize > 0 || overview.data.departmentSize > 0)
  const isPersonal = !!overview.data && !hasPeople
  const workspace = (
    <section className="home-panel min-w-0 space-y-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-medium tracking-tight">Your workspace</h2><Link to="/ess/employees" className="flex min-h-9 items-center gap-1 text-sm underline underline-offset-4">People directory <ArrowRight aria-hidden className="size-3.5" /></Link></div>
      <p className="text-sm text-muted-foreground">Find a colleague in the people directory.</p>
      <FormError error={profile.error} />
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground"><p>{me ? `${me.name} · ${me.employeeCode}` : 'Your employee record'}{e && ` · ${e.company.name}`}</p>{e ? <p>Joined {formatDate(e.dateOfJoining)}</p> : profile.isPending && <Skeleton className="h-3 w-28 rounded" />}</div>
    </section>
  )
  return <div className="home-dashboard space-y-4">
    <header className="home-arrive flex flex-wrap items-end justify-between gap-x-6 gap-y-3 pb-1">
      <div><h1 className="text-[28px] font-light leading-tight tracking-tight sm:text-[40px]">{greeting(now)}{me ? `, ${me.name.split(' ')[0]}` : ''}</h1><p className="mt-2 text-sm text-muted-foreground">{hasPeople ? 'Your team, today. Keep the next steps moving.' : 'Your attendance, time off and requests in one place.'}</p></div>
      <div className="flex flex-wrap items-center gap-2 text-xs"><span className="max-w-full break-words rounded-full bg-card px-3 py-2 font-medium">{SELF_SERVICE_NAME}</span><span className="text-muted-foreground">{now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short' })}</span></div>
    </header>
    <div className="grid min-w-0 gap-3 lg:grid-cols-12">
      <div className="min-w-0 lg:col-span-8">
        {!ready || overview.isPending ? <HomeRoleSkeleton /> : isPersonal || overview.isError ? <HomeMyRequests /> : <HomeDecisions light />}
      </div>
      <div className="min-w-0 space-y-3 lg:col-span-4 lg:row-span-2">
        {overview.isPending ? <HomeRoleSkeleton dark /> : overview.isError ? <section className="home-panel p-5"><h2 className="text-lg font-medium">Attendance</h2><FormError error={overview.error} /><Link to="/ess/attendance" className="flex min-h-10 items-center text-sm underline underline-offset-4">Open attendance to retry</Link></section> : hasPeople ? <HomeAttendance overview={overview.data} date={date} dark /> : <HomePersonalAttendance overview={overview.data} />}
      </div>
      <div className="min-w-0 lg:col-span-8">
        {!overview.isPending && (isPersonal ? <PersonalLinks hasSalary={!!e?.salary} loading={profile.isPending} /> : <HomeMyRequests />)}
        {overview.isPending && <section className="home-panel p-4 sm:p-5"><h2 className="text-lg font-medium tracking-tight">People today</h2><HomeAttendanceSkeleton /></section>}
      </div>
    </div>
    <div className="grid min-w-0 items-start gap-3 lg:grid-cols-3">
      <div className="min-w-0 space-y-3">
        {overview.isPending ? <TodayCardSkeleton /> : overview.data && <Link to="/ess/attendance" className="block rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Open my attendance"><TodayCard today={overview.data.today} className="min-w-0 [&>span]:shrink-0 [&>div]:min-w-0" /></Link>}
        <FormError error={overview.error} /><HomeLeave />
      </div>
      <div className="min-w-0">{isPersonal ? <HomeDecisions light compact /> : workspace}</div>
      <div className="min-w-0">{isPersonal ? workspace : <PersonalLinks hasSalary={!!e?.salary} loading={profile.isPending} />}</div>
    </div>
  </div>
}

function PersonalLinks({ hasSalary, loading }: { hasSalary: boolean; loading: boolean }) {
  const links: Shortcut[] = [{ to: '/ess/me?tab=personal', icon: UserRound, title: 'Personal details', text: 'Family & contacts' }, { to: '/ess/me?tab=ids', icon: IdCard, title: 'IDs & bank', text: 'Your saved information' }, { to: '/ess/me?tab=documents', icon: FolderOpen, title: 'My documents', text: 'Joining documents' }, hasSalary ? { to: '/ess/me?tab=salary', icon: Wallet, title: 'My salary', text: 'CTC & monthly breakup' } : { to: '/ess/me?tab=statutory', icon: ShieldCheck, title: 'PF & ESIC', text: 'Your statutory numbers' }]
  return <div className="home-panel p-4 sm:p-5"><h2 className="mb-2 text-lg font-medium tracking-tight">My details &amp; documents</h2><div className="grid grid-cols-2 gap-x-4">{links.slice(0, 3).map(item => <QuickLink key={item.to} {...item} />)}{loading ? <div role="status" aria-label="Loading your salary link" className="flex min-h-14 items-center gap-2"><Skeleton className="size-8 shrink-0 rounded-full" /><div className="space-y-2"><Skeleton className="h-3 w-24 rounded" /><Skeleton className="h-3 w-20 rounded" /></div></div> : <QuickLink {...links[3]!} />}</div></div>
}
