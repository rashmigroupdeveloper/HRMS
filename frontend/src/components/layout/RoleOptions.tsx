import { DropdownMenuGroup, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@/components/ui/dropdown-menu'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useSwitchRole } from '@/hooks/useSwitchRole'
import { SELF_SERVICE, SELF_SERVICE_NAME } from '@/lib/active-role'

// Used inside both the desktop account dropdown and the phone's role dropdown. Employee self-service first (where
// everyone signs in - 2026-11-25, its pages under /ess), then the roles given, each opening the role portal (/manage).
export function RoleOptions() {
  const { data: me } = useCurrentUser()
  const { switchRole, saving } = useSwitchRole()
  if (!me) return null
  const current = me.activeRoleId ?? SELF_SERVICE
  const choices = [{ id: SELF_SERVICE, name: SELF_SERVICE_NAME }, ...me.availableRoles]
  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel className="px-3 py-2">Switch role</DropdownMenuLabel>
      {me.availableRoles.length === 0 ? (
        <p className="px-3 py-2 text-sm text-muted-foreground">{SELF_SERVICE_NAME}</p>
      ) : (
        <DropdownMenuRadioGroup value={String(current)} onValueChange={(value) => {
          const id = Number(value)
          if (id !== current && choices.some((choice) => choice.id === id)) switchRole(id)
        }}>
          {choices.map((choice) => (
            <DropdownMenuRadioItem key={choice.id} value={String(choice.id)} disabled={saving} className="min-h-9 rounded-xl px-3 pr-8 whitespace-normal break-words">
              {choice.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      )}
    </DropdownMenuGroup>
  )
}
