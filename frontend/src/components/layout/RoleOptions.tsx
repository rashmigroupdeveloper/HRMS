import { useIsMutating } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { DropdownMenuGroup, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@/components/ui/dropdown-menu'
import { useCurrentUser } from '@/hooks/useCurrentUser'

// Used inside both the desktop account dropdown and the phone's role dropdown.
export function RoleOptions() {
  const { data: me } = useCurrentUser()
  const navigate = useNavigate()
  const saving = useIsMutating() > 0
  if (!me) return null
  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel className="px-3 py-2">Switch role</DropdownMenuLabel>
      <DropdownMenuRadioGroup value={String(me.activeRoleId ?? '')} onValueChange={(value) => {
        const id = Number(value)
        if (id === me.activeRoleId || saving || !me.availableRoles.some((role) => role.id === id)) return
        // Normal navigation runs any unsaved-page guard before AppLayout commits the switch.
        void navigate('/', { state: { switchRoleTo: id } })
      }}>
        {me.availableRoles.map((role) => (
          <DropdownMenuRadioItem key={role.id} value={String(role.id)} disabled={saving} className="min-h-9 rounded-xl px-3 pr-8 whitespace-normal break-words">
            {role.name}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
      {me.availableRoles.length === 0 && <p className="px-3 py-2 text-sm text-muted-foreground">Employee self-service</p>}
    </DropdownMenuGroup>
  )
}
