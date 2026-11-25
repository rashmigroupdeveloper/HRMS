import { ArrowRightLeft } from 'lucide-react'
import { Link, useLocation } from 'react-router'
import { Button } from '@/components/ui/button'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useSwitchRole } from '@/hooks/useSwitchRole'
import { SELF_SERVICE, SELF_SERVICE_NAME, type Portal } from '@/lib/active-role'

// A page of the other portal (2026-11-25): a role page (/manage/...) opened in Employee self-service - e.g. from an
// e-mail link, as a new tab starts in self-service - or a self-service page (/ess/...) opened with a role active. It
// offers the switch and comes back to this same page; nothing of the page is shown or loaded meanwhile.
export function WrongPortal({ portal }: { portal: Portal }) {
  const { data: me } = useCurrentUser()
  const { pathname, search } = useLocation()
  const { switchRole, saving } = useSwitchRole()
  const here = pathname + search
  const roles = me?.availableRoles ?? []
  const toRole = portal === 'manage'
  const title = toRole ? (roles.length ? 'Pick a role to open this page' : 'This page needs a role') : `This page is in ${SELF_SERVICE_NAME}`
  const hint = toRole
    ? roles.length
      ? 'It belongs to the role portal. Choose the role to open it with - you come back to this page.'
      : 'It belongs to the role portal, and your login has no role. Ask HR if you think you need one.'
    : 'Your own leave, attendance, requests and profile are done as an employee, not with a role.'
  return (
    <div role="status" className="mx-auto mt-10 max-w-md rounded-3xl bg-card p-6 text-center shadow-card sm:mt-16">
      <span aria-hidden className="mx-auto grid size-12 place-items-center rounded-full bg-gold-soft"><ArrowRightLeft className="size-5" /></span>
      <h1 className="mt-3 text-2xl font-light tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{hint}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {toRole
          ? roles.map((role) => (
              <Button key={role.id} disabled={saving} onClick={() => switchRole(role.id, here)}>
                {role.name}
              </Button>
            ))
          : <Button disabled={saving} onClick={() => switchRole(SELF_SERVICE, here)}>Switch to {SELF_SERVICE_NAME}</Button>}
        <Button variant="secondary" nativeButton={false} render={<Link to={toRole ? '/ess' : '/manage'} />}>
          {toRole ? `Back to ${SELF_SERVICE_NAME}` : 'Back to the role portal'}
        </Button>
      </div>
    </div>
  )
}
