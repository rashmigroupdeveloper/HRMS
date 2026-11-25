import { useIsMutating } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { SELF_SERVICE } from '@/lib/active-role'

// Switches this tab to Employee self-service (SELF_SERVICE) or a role, then opens `to` - by default the new portal's home
// (/ess or /manage). The navigation runs any unsaved-page guard first; AppLayout then stores the choice and reloads the
// app at `to`, so nothing cached for the old role is shown with the new one. Not while something is being saved.
export function useSwitchRole() {
  const navigate = useNavigate()
  const saving = useIsMutating() > 0
  const switchRole = (id: number, to?: string) => {
    if (saving) return
    const target = to ?? (id === SELF_SERVICE ? '/ess' : '/manage')
    void navigate(target, { replace: !!to, state: { switchRoleTo: id, switchTo: target } })
  }
  return { switchRole, saving }
}
