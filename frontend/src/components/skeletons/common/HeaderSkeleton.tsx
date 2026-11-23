import { ChevronDown, Menu } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

// the nav items depend on the user's access - bars of a typical item's width
const NAV = ['w-11', 'w-20', 'w-22', 'w-20', 'w-12', 'w-28', 'w-18', 'w-12']

// The header's parts that wait for the logged-in employee (AppLayout, while accounts.me loads - the page below already
// shows its own skeleton): the pill navigation's items (which ones depend on the access) ...
export function NavItemsSkeleton() {
  return (
    <span role="status" aria-label="Loading the menu" className="flex items-center gap-0.5">
      {NAV.map((width, i) => (
        <span key={i} className="flex h-9 items-center px-3">
          <Skeleton className={`h-4 rounded-full ${width}`} />
        </span>
      ))}
    </span>
  )
}

// ... and the account chip on wide screens / the Menu button on a phone
export function AccountSkeleton() {
  return (
    <>
      <div className="hidden shrink-0 items-center gap-2.5 rounded-full bg-card py-1.5 pr-3 pl-1.5 shadow-card xl:flex">
        <Skeleton className="size-7 rounded-full bg-gold-soft" />
        <span>
          <span className="flex h-5 items-center">
            <Skeleton className="h-3.5 w-24 rounded-full" />
          </span>
          <span className="flex h-4 items-center">
            <Skeleton className="h-3 w-16 rounded-full" />
          </span>
        </span>
        <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
      </div>
      <span className="flex h-10 shrink-0 items-center gap-2 rounded-full bg-card px-4 text-sm font-medium text-muted-foreground shadow-card xl:hidden">
        <Menu className="size-4" aria-hidden />
        Menu
      </span>
    </>
  )
}
