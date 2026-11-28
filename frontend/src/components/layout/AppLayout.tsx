import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useQuery } from '@tanstack/react-query'
import { ArrowRightLeft, ChevronDown, KeyRound, LogOut, Menu, UserRound } from 'lucide-react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { AccountSkeleton, NavItemsSkeleton } from '@/components/skeletons/common/HeaderSkeleton'
import { useAccess } from '@/hooks/useAccess'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { orpc } from '@/lib/orpc'
import { cn } from '@/lib/utils'
import { portalOf, SELF_SERVICE, SELF_SERVICE_NAME, writeActiveRole } from '@/lib/active-role'
import { RoleOptions } from './RoleOptions'

// short: the name on the "More" button while that page is open (the page's title says the rest)
type NavItem = { to: string; label: string; short?: string; count?: number; also?: string[]; end?: boolean }

// `also`: other pages the item stands for (Leave: My leave, Holidays and Team leave); `end`: only its own address (Home)
const isCurrent = (item: NavItem, pathname: string) =>
  item.end ? pathname === item.to : [item.to, ...(item.also ?? [])].some((to) => pathname === to || pathname.startsWith(`${to}/`))

// App shell in the old HRMS style: brand left, pill navigation in the middle (dark pill = current page), the
// logged-in employee on the right. Nothing is ever cut off:
//   - wide screens (1280px and up - 2026-11-22, the menu got longer): the everyday pages in the pill, the set-up pages under "More" (which shows the current page's
//     name when it is one of them); the employee's chip opens My profile / Change password / Log out;
//   - narrow screens: the brand and a Menu button that opens every page in a side sheet.
export function AppLayout() {
  const me = useCurrentUser()
  const { can } = useAccess()
  const navigate = useNavigate()
  const location = useLocation()
  const { pathname } = location
  const queryClient = useQueryClient()
  const [menuOpen, setMenuOpen] = useState(false)
  const activeRole = me.data?.availableRoles.find((role) => role.id === me.data.activeRoleId)?.name ?? SELF_SERVICE_NAME
  // the choice being switched to: Employee self-service (SELF_SERVICE) or one of the roles given
  const switchingRole = me.data && [{ id: SELF_SERVICE, name: SELF_SERVICE_NAME }, ...me.data.availableRoles].find(
    (role) => role.id === location.state?.switchRoleTo && role.id !== (me.data.activeRoleId ?? SELF_SERVICE),
  )
  const switchingRoleId = switchingRole?.id
  useEffect(() => {
    if (switchingRoleId === undefined) return
    // Keep the old role in force until the transition commits. The fresh document clears all
    // cached records and in-flight reads before the new role's data is shown.
    const timer = window.setTimeout(() => {
      writeActiveRole(switchingRoleId === SELF_SERVICE ? null : switchingRoleId)
      window.location.replace(typeof location.state?.switchTo === 'string' ? location.state.switchTo : '/')
    }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220)
    return () => window.clearTimeout(timer)
  }, [switchingRoleId, location.state])
  // what waits for my decision (2026-11-20) - shown next to Approvals
  const waiting = useQuery({ ...orpc.approvals.countToDecide.queryOptions(), refetchInterval: 120_000 })
  // whether they have a team or an HOD department (the overview's sizes) - their team's pages, in both portals
  const attendance = useQuery(orpc.attendance.overview.queryOptions())
  // the menu waits for both, so an item does not pop in after the others
  const menuReady = Boolean(me.data) && !attendance.isPending

  const logout = useMutation(
    orpc.accounts.logout.mutationOptions({
      onSettled: () => {
        writeActiveRole(null)
        queryClient.clear()
        void navigate('/login', { replace: true })
      },
    }),
  )

  // Two portals, two menus (2026-11-25) - the menu follows this tab's choice in the account menu; a page of the other
  // portal shows the switch screen instead (RequirePortal)
  const portal = portalOf(me.data?.activeRoleId)
  const home = `/${portal}`
  const team = (attendance.data?.teamSize ?? 0) > 0 || (attendance.data?.departmentSize ?? 0) > 0
  // the everyday pages
  const mainItems: NavItem[] =
    portal === 'ess'
      ? [
          { to: home, label: 'Home', end: true },
          // their own attendance; their team's and HOD department's on a page of its own (2026-11-22)
          { to: '/ess/attendance', label: 'My attendance' },
          ...(team ? [{ to: '/ess/team-attendance', label: 'Team attendance' }] : []),
          // their own leave, their holidays and their team's - switched between on the leave pages (2026-11-22)
          { to: '/ess/leave', label: 'Leave', also: ['/ess/team-leave', '/ess/holidays'] },
          { to: '/ess/pay-career', label: 'Pay & career' },
          // the company directory and org chart (2026-11-21)
          { to: '/ess/employees', label: 'People' },
          // an HOD: the employees whose HOD they are (BACKLOG 3e)
          ...((me.data?.hodPosts ?? 0) > 0 ? [{ to: '/ess/my-department', label: 'My department' }] : []),
          // the steps named to them (manager, HOD) and their own requests
          { to: '/ess/approvals', label: 'Approvals', count: waiting.data },
        ]
      : [
          { to: home, label: 'Home', end: true },
          // HR's employee records and joiners & leavers (the directory and org chart are self-service's People - 2026-11-25)
          ...(can('EMPLOYEES') ? [{ to: '/manage/employees', label: 'Employees' }] : []),
          ...(can('ONBOARDING') ? [{ to: '/manage/onboarding', label: 'Onboarding' }] : []),
          // the role's records plus one's own team (the user, 2026-11-25)
          ...(can('ATTENDANCE') || team ? [{ to: '/manage/team-attendance', label: 'Attendance' }] : []),
          ...(can('LEAVE') || team ? [{ to: '/manage/team-leave', label: 'Leave' }] : []),
          ...(can('JOB_CHANGE_REQUEST', 'WRITE') || can('SALARY_CHANGE_REQUEST', 'WRITE') || can('EMPLOYEES') ? [{ to: '/manage/pay-career', label: 'Pay & career' }] : []),
          // the role's approval steps and the requests raised for others
          { to: '/manage/approvals', label: 'Approvals', count: waiting.data },
        ]
  // the set-up pages - under "More" on wide screens
  const moreItems: NavItem[] =
    portal === 'ess'
      ? [...(team ? [{ to: '/ess/attendance-reports', label: 'Attendance reports', short: 'Reports' }] : [])]
      : [
          ...(can('ATTENDANCE') || team ? [{ to: '/manage/attendance-reports', label: 'Attendance reports', short: 'Reports' }] : []),
          // the tasks given to me (Joining tasks), or all of them (Onboarding)
          ...(can('JOINING_TASKS') || can('ONBOARDING') || can('JOINING_TASK_TYPES') ? [{ to: '/manage/joining-tasks', label: 'Joining checklist', short: 'Checklist' }] : []),
          ...(can('ORGANIZATION') || can('HOD_APPOINTMENTS') ? [{ to: '/manage/organization', label: 'Organization' }] : []),
          ...(can('PAYROLL') ? [{ to: '/manage/payroll', label: 'Payroll' }] : []),
          // paying the approved runs (payroll stage 6 slice 2) - often finance's, apart from payroll
          ...(can('PAYROLL_PAYMENTS') ? [{ to: '/manage/salary-payments', label: 'Salary payments', short: 'Payments' }] : []),
          // what the approved runs must deposit to PF, ESIC, professional tax and LWF (payroll stage 6 slice 3)
          ...(can('STATUTORY_DEPOSITS') ? [{ to: '/manage/statutory-deposits', label: 'Statutory deposits', short: 'Deposits' }] : []),
          ...(can('LETTER_TEMPLATES') ? [{ to: '/manage/letter-templates', label: 'Letter templates' }] : []),
          ...(can('ACCESS') ? [{ to: '/manage/access', label: 'Roles & access' }] : []),
          ...(can('ATTENDANCE_SETUP') ? [{ to: '/manage/attendance-setup', label: 'Attendance setup', short: 'Setup' }] : []),
          ...(can('APPROVAL_CHAINS') ? [{ to: '/manage/approval-chains', label: 'Approval rules' }] : []),
          ...(can('CHANGE_HISTORY') ? [{ to: '/manage/change-history', label: 'History' }] : []),
        ]
  // a single set-up page needs no menu
  const pillItems = moreItems.length === 1 ? [...mainItems, ...moreItems] : mainItems
  const menuItems = moreItems.length === 1 ? [] : moreItems
  const currentMore = menuItems.find((item) => isCurrent(item, pathname))

  const pill = (active: boolean) =>
    cn(
      'nav-control relative isolate flex shrink-0 items-center gap-1 rounded-full px-3 py-2 text-sm font-medium whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
      active ? 'text-hero-foreground' : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground',
    )
  const sheetLink = (active: boolean) =>
    cn('nav-control flex items-center gap-3 rounded-2xl px-4 py-3 text-[15px] font-medium transition-colors', active ? 'bg-hero text-hero-foreground' : 'hover:bg-surface-2')

  const activeSurface = <span aria-hidden className="nav-active-surface pointer-events-none absolute inset-0 -z-10 rounded-full bg-hero" />

  return (
    <>
      {switchingRole && (
        <div role="status" aria-live="polite" className="role-transition fixed inset-0 z-[100] grid place-items-center bg-background/95 backdrop-blur-sm">
          <div className="flex items-center gap-4 px-6">
            <span className="role-transition-mark grid size-12 shrink-0 place-items-center rounded-full bg-gold-soft text-foreground"><ArrowRightLeft aria-hidden className="size-5" /></span>
            <div><p className="text-xs text-muted-foreground">Switching role</p><p className="role-transition-name mt-1 text-xl font-medium">{switchingRole.name}</p></div>
          </div>
        </div>
      )}
    <div inert={!!switchingRole} className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-30 bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6 lg:py-4">
          <Link to={home} className="flex shrink-0 items-center gap-2.5 rounded-full">
            <span aria-hidden className="relative grid size-9 place-items-center rounded-full bg-hero text-sm font-bold text-hero-foreground">
              H
              <span className="absolute right-1.5 bottom-1.5 size-1.5 rounded-full bg-gold" />
            </span>
            <span className="hidden text-[15px] font-semibold tracking-tight xl:inline">HRMS</span>
          </Link>

          {/* narrow screens: the brand only - the page's own title is right below */}
          <span className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-tight xl:hidden">HRMS</span>

          <nav aria-label="Primary" className="mx-auto hidden min-w-0 items-center gap-0.5 overflow-x-auto rounded-full bg-card p-1.5 shadow-float [scrollbar-width:none] xl:flex [&::-webkit-scrollbar]:hidden">
            {/* the items follow the access - bars until accounts.me answers (the page below loads at the same time) */}
            {!menuReady && <NavItemsSkeleton />}
            {menuReady && pillItems.map((item) => (
              <NavLink key={item.to} to={item.to} viewTransition end={item.end} className={({ isActive }) => pill(isActive)}>
                {({ isActive }) => <>
                  {isActive && activeSurface}
                  {item.label}
                  {!!item.count && <span className="rounded-full bg-gold px-1.5 text-[11px] font-semibold text-gold-foreground tabular-nums">{item.count}</span>}
                </>}
              </NavLink>
            ))}
            {menuReady && menuItems.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger className={cn(pill(Boolean(currentMore)), 'nav-dropdown')}>
                  {currentMore && activeSurface}
                  {currentMore ? (currentMore.short ?? currentMore.label) : 'More'}
                  <ChevronDown className="size-4 opacity-70" aria-hidden />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={10} className="nav-popup w-52 rounded-2xl p-1.5 shadow-float ring-0">
                  {menuItems.map((item) => (
                    <DropdownMenuItem
                      key={item.to}
                      className={cn('rounded-xl px-3 py-2', item === currentMore && 'bg-surface-2 font-medium')}
                      onClick={() => void navigate(item.to, { viewTransition: true })}
                    >
                      {item.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </nav>

          {!me.data && <AccountSkeleton />}
          {me.data && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label="My account"
                  className="nav-control nav-dropdown hidden shrink-0 items-center gap-2.5 rounded-full bg-card py-1.5 pr-3 pl-1.5 text-left shadow-card transition-colors outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring/50 xl:flex"
                >
                  <span className="grid size-7 place-items-center rounded-full bg-gold-soft text-xs font-semibold">{me.data.name.slice(0, 1)}</span>
                  <span className="max-w-36 text-sm leading-tight">
                    <span className="block truncate font-medium">{me.data.name}</span>
                    <span className="block truncate text-xs text-muted-foreground" title={activeRole}>{activeRole}</span>
                  </span>
                  <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={10} className="nav-popup w-52 rounded-2xl p-1.5 shadow-float ring-0">
                  <RoleOptions />
                  <DropdownMenuSeparator />
                  {/* one's own profile is Employee self-service */}
                  {portal === 'ess' && (
                    <DropdownMenuItem className="rounded-xl px-3 py-2" onClick={() => void navigate('/ess/me')}>
                      <UserRound /> My profile
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem className="rounded-xl px-3 py-2" onClick={() => void navigate('/change-password')}>
                    <KeyRound /> Change password
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="rounded-xl px-3 py-2" disabled={logout.isPending} onClick={() => logout.mutate({})}>
                    <LogOut /> Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="min-w-0 xl:hidden">
                <DropdownMenu>
                  <DropdownMenuTrigger aria-label={`Switch role: ${activeRole}`} className="nav-control nav-dropdown flex h-10 max-w-36 items-center gap-2 rounded-full bg-card px-3 text-sm shadow-card outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <span className="truncate">{activeRole}</span><ChevronDown aria-hidden className="size-4 shrink-0" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" sideOffset={8} className="nav-popup w-60 max-w-[calc(100vw-2rem)] rounded-2xl p-1.5 shadow-float ring-0">
                    <RoleOptions />
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                className="nav-control flex h-10 shrink-0 items-center gap-2 rounded-full bg-card px-4 text-sm font-medium shadow-card transition-colors outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring/50 xl:hidden"
              >
                <Menu className="size-4" aria-hidden />
                Menu
              </button>
            </>
          )}
        </div>
      </header>

      {/* narrow screens: every page, then the account */}
      {me.data && (
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetContent side="right" className="sheet-travel gap-0 overflow-y-auto border-0 bg-background">
            <SheetHeader className="flex-row items-center gap-3 p-5 pr-14">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gold-soft text-sm font-semibold">{me.data.name.slice(0, 1)}</span>
              <div className="min-w-0">
                <SheetTitle className="truncate">{me.data.name}</SheetTitle>
                <SheetDescription>{me.data.employeeCode}</SheetDescription>
              </div>
            </SheetHeader>
            <nav aria-label="All pages" className="flex flex-col gap-1 px-3 pb-3">
              {[...mainItems, ...moreItems].map((item) => (
                <NavLink key={item.to} to={item.to} viewTransition end={item.end} onClick={() => setMenuOpen(false)} className={({ isActive }) => sheetLink(isActive)}>
                  {item.label}
                {!!item.count && <span className="ml-auto rounded-full bg-gold px-1.5 text-xs font-semibold text-gold-foreground tabular-nums">{item.count}</span>}
                </NavLink>
              ))}
            </nav>
            <div className="mt-auto flex flex-col gap-1 border-t border-border px-3 py-3">
              {portal === 'ess' && (
                <NavLink to="/ess/me" onClick={() => setMenuOpen(false)} className={({ isActive }) => sheetLink(isActive)}>
                  <UserRound className="size-4" aria-hidden /> My profile
                </NavLink>
              )}
              <NavLink to="/change-password" onClick={() => setMenuOpen(false)} className={({ isActive }) => sheetLink(isActive)}>
                <KeyRound className="size-4" aria-hidden /> Change password
              </NavLink>
              <button type="button" disabled={logout.isPending} onClick={() => logout.mutate({})} className={cn(sheetLink(false), 'text-left disabled:opacity-50')}>
                <LogOut className="size-4" aria-hidden /> Log out
              </button>
            </div>
          </SheetContent>
        </Sheet>
      )}

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-4 pb-16 sm:px-6 lg:pt-6">
        <Outlet />
      </main>
    </div>
    </>
  )
}
