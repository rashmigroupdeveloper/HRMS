import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { DrawerCancel, FormDrawer } from '@/components/FormDrawer'
import { FormError } from '@/components/FormError'
import { Pill } from '@/components/Pill'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { hasAccess, useAccess } from '@/hooks/useAccess'
import { orpc } from '@/lib/orpc'
import { type DataAccessRow, DataAccessRows } from './DataAccessRows'
import { needsConfirmation, useConfirmPassword } from './useConfirmPassword'
import { type Account, type AreaInfo, LEVEL_LABEL, type Role } from './labels'

// Tick the roles one employee should have, and for each the data access - whose records it covers (company -> plant ->
// department, 2026-11-18). Their access is the highest level any ticked role gives for that record.
export function PersonRolesDialog({
  account,
  roles,
  areas,
  onClose,
}: {
  account: Account
  roles: Role[]
  areas: AreaInfo[]
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const { me } = useAccess()
  const [initial] = useState(() => new Map<number, DataAccessRow[]>(account.roles.map((r) => [r.id, r.dataAccess.map(toRow)])))
  // the ticked roles and each one's rows
  const [chosen, setChosen] = useState(initial)
  const save = useMutation(
    orpc.accounts.setRoles.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: orpc.accounts.key() })
        onClose()
      },
    }),
  )

  // Same rules as the backend: only a super admin gives / takes the Super Admin role, and anyone else only roles
  // whose access they have themselves (the backend also checks the data access)
  const canGive = (role: Role) =>
    me?.isSuperAdmin || (!role.isSuperAdmin && areas.every((a) => !role.access[a.area] || hasAccess(me, a.area, role.access[a.area])))

  // giving roles needs the password re-entered (asked again if the 10 minutes ran out meanwhile)
  const { confirmThen, dialog } = useConfirmPassword()
  const saveRoles = () => {
    const payload = { employeeCode: account.employeeCode, roles: [...chosen].map(([roleId, rows]) => ({ roleId, dataAccess: rows })) }
    const run = () => save.mutate(payload, { onError: (error) => needsConfirmation(error) && confirmThen(run, true) })
    confirmThen(run)
  }

  // the ticked roles or their rows differ from what the employee has
  const key = (m: Map<number, DataAccessRow[]>) => JSON.stringify([...m].sort(([a], [b]) => a - b))
  const dirty = key(chosen) !== key(initial)

  // a role newly ticked starts with the employee's own company (every plant and department, Edit) - change it as needed
  const toggle = (id: number, on: boolean) =>
    setChosen((current) => {
      const next = new Map(current)
      if (on) next.set(id, initial.get(id) ?? [{ companyId: account.companyId, plantId: null, departmentId: null, level: 'WRITE' }])
      else next.delete(id)
      return next
    })
  const setRows = (id: number, rows: DataAccessRow[]) => setChosen((current) => new Map(current).set(id, rows))

  return (
    <FormDrawer
      onClose={onClose}
      dirty={dirty && !save.isSuccess}
      width={760}
      title={<>Roles of {account.name}</>}
      description={
        <>
          {account.employeeCode} · Every employee can always use their own self-service pages; roles add access on top of that. Each role&apos;s data access
          says whose records it covers.
        </>
      }
      footer={
        <>
          <DrawerCancel />
          <Button variant="gold" disabled={save.isPending} onClick={saveRoles}>
            {save.isPending ? 'Saving…' : 'Save roles'}
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        {roles.map((role) => {
          const allowed = canGive(role)
          const access = areas.filter((a) => role.access[a.area])
          const rows = chosen.get(role.id)
          return (
            <div key={role.id} className="space-y-3 rounded-2xl bg-surface-2 p-4 has-[button[role=checkbox]:disabled]:opacity-50">
              <label className="flex cursor-pointer items-start gap-3 has-disabled:cursor-not-allowed">
                <Checkbox className="mt-0.5" checked={rows !== undefined} disabled={!allowed} onCheckedChange={(checked) => toggle(role.id, checked)} />
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{role.name}</span>
                    {role.isSuperAdmin && <Pill tone="neutral">Built in</Pill>}
                  </span>
                  {role.description && <span className="block text-xs text-muted-foreground">{role.description}</span>}
                  <span className="block text-xs text-muted-foreground">
                    {role.isSuperAdmin
                      ? 'Edit on everything, for every company'
                      : access.length
                        ? access.map((a) => `${a.label}: ${LEVEL_LABEL[role.access[a.area] ?? 'READ']}`).join(' · ')
                        : 'No access to anything yet'}
                  </span>
                  {!allowed && (
                    <span className="block text-xs text-warning-ink">
                      {role.isSuperAdmin ? 'Only a super admin can give this role' : 'This role gives more access than you have'}
                    </span>
                  )}
                </span>
              </label>
              {rows !== undefined && !role.isSuperAdmin && (
                <div className="space-y-1.5 border-t border-border/70 pt-3 sm:pl-7">
                  <p className="text-xs font-medium text-muted-foreground">Data access - whose records this role covers</p>
                  <DataAccessRows idPrefix={`role-${role.id}`} rows={rows} onChange={(next) => setRows(role.id, next)} />
                </div>
              )}
            </div>
          )
        })}
      </div>

      <FormError error={save.error} />
      {dialog}
    </FormDrawer>
  )
}

const toRow = ({ companyId, plantId, departmentId, level }: DataAccessRow): DataAccessRow => ({ companyId, plantId, departmentId, level })
