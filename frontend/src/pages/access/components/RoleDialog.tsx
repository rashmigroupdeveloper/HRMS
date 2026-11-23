import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { DrawerCancel, FormDrawer } from '@/components/FormDrawer'
import { FormError } from '@/components/FormError'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { type AccessArea, type AccessLevel, hasAccess, useAccess } from '@/hooks/useAccess'
import { orpc } from '@/lib/orpc'
import { needsConfirmation, useConfirmPassword } from './useConfirmPassword'
import { type AreaInfo, type Role, type RoleAccess } from './labels'
import { LevelPicker } from './LevelPicker'

// Create a role, or change one: its name, description, and View / Edit / No access for every area.
export function RoleDialog({
  role,
  areas,
  onClose,
}: {
  // null = a new role
  role: Role | null
  areas: AreaInfo[]
  onClose: () => void
}) {
  return <RoleForm role={role} areas={areas} onDone={onClose} />
}

function RoleForm({ role, areas, onDone }: { role: Role | null; areas: AreaInfo[]; onDone: () => void }) {
  const queryClient = useQueryClient()
  const { me } = useAccess()
  const [name, setName] = useState(role?.name ?? '')
  const [description, setDescription] = useState(role?.description ?? '')
  const [access, setAccess] = useState<RoleAccess>(role?.access ?? {})
  // the fallback approver (2026-11-20): decides approval requests nobody else can - one role at most
  const [fallback, setFallback] = useState(role?.isApprovalFallback ?? false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // accounts.* covers the roles list, the people list and the logged-in user's own access
  const done = () => {
    void queryClient.invalidateQueries({ queryKey: orpc.accounts.key() })
    onDone()
  }
  // changing roles needs the password re-entered (asked again if the 10 minutes ran out meanwhile)
  const { confirmThen, dialog } = useConfirmPassword()
  const again = (retry: () => void) => (error: unknown) => needsConfirmation(error) && confirmThen(retry, true)
  const create = useMutation(orpc.accounts.roles.create.mutationOptions({ onSuccess: done }))
  const update = useMutation(orpc.accounts.roles.update.mutationOptions({ onSuccess: done }))
  const remove = useMutation(orpc.accounts.roles.delete.mutationOptions({ onSuccess: done }))
  const pending = create.isPending || update.isPending || remove.isPending
  // the name, description or any level differs from what the role had (a new role: anything filled in)
  const startAccess: RoleAccess = role?.access ?? {}
  const dirty =
    name !== (role?.name ?? '') ||
    description !== (role?.description ?? '') ||
    fallback !== (role?.isApprovalFallback ?? false) ||
    (Object.keys({ ...startAccess, ...access }) as AccessArea[]).some((area) => access[area] !== startAccess[area])

  const setLevel = (area: AccessArea, level: AccessLevel | 'NONE') =>
    setAccess((current) => {
      const next = { ...current }
      if (level === 'NONE') delete next[area]
      else next[area] = level
      return next
    })

  const save = () => {
    const trimmed = description.trim()
    const run = () =>
      role
        ? update.mutate(
            { id: role.id, name: name.trim(), description: trimmed || null, access, ...(fallback !== role.isApprovalFallback && { isApprovalFallback: fallback }) },
            { onError: again(run) },
          )
        : create.mutate({ name: name.trim(), description: trimmed || undefined, access }, { onError: again(run) })
    confirmThen(run)
  }
  const removeRole = (id: number) => {
    const run = () => remove.mutate({ id }, { onError: again(run) })
    confirmThen(run)
  }

  return (
    <FormDrawer
      onClose={onDone}
      dirty={dirty && !create.isSuccess && !update.isSuccess && !remove.isSuccess}
      width={640}
      title={<>{role ? `Change role "${role.name}"` : 'New role'}</>}
      description={
        <>
          Choose what this role may do in each part of the system. View = see only; Edit = see and change. Changes apply at once to everyone
          with the role.
        </>
      }
      footer={
        <>
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            {role ? (
              <Button
                variant={confirmDelete ? 'destructive' : 'ghost'}
                disabled={pending}
                onClick={() => (confirmDelete ? removeRole(role.id) : setConfirmDelete(true))}
              >
                <Trash2 /> {confirmDelete ? 'Yes, delete this role' : 'Delete role'}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <DrawerCancel />
              <Button variant="gold" disabled={pending || name.trim().length < 2} onClick={save}>
                {create.isPending || update.isPending ? 'Saving…' : role ? 'Save role' : 'Create role'}
              </Button>
            </div>
          </div>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="role-name">Name</Label>
            <Input id="role-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Recruiter" maxLength={60} />
          </div>
          {role && (
            <label className="flex items-start gap-2 text-sm sm:col-span-2">
              <input type="checkbox" className="mt-0.5 size-4 accent-[var(--gold)]" checked={fallback} onChange={(e) => setFallback(e.target.checked)} />
              <span>
                Fallback approver
                <span className="block text-xs text-muted-foreground">
                  Decides approval requests nobody else can (no manager, no HOD, nobody holding a step&apos;s role) - within the data access given with the
                  role. One role at most: marking this one takes the mark from the other.
                </span>
              </span>
            </label>
          )}
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="role-description">Description (optional)</Label>
            <Textarea
              id="role-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Who gets this role and why"
              maxLength={300}
              rows={2}
            />
          </div>
        </div>

        <div className="space-y-2">
          {areas.map((info) => {
            const current = access[info.area] ?? 'NONE'
            return (
              <div key={info.area} className="space-y-2 rounded-2xl bg-surface-2 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-medium">{info.label}</p>
                  <LevelPicker
                    label={info.label}
                    value={current}
                    // Someone who is not a super admin cannot give more than they have (the backend checks it too)
                    isAllowed={(choice) => choice === 'NONE' || !!me?.isSuperAdmin || hasAccess(me, info.area, choice)}
                    onChange={(choice) => setLevel(info.area, choice)}
                  />
                </div>
                <dl className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2 sm:gap-4">
                  <div>
                    <dt className="inline font-medium text-foreground">View: </dt>
                    <dd className="inline">{info.read}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium text-foreground">Edit: </dt>
                    <dd className="inline">{info.write}</dd>
                  </div>
                </dl>
              </div>
            )
          })}
        </div>

        {/* the employee areas only add tabs to a profile one can open - with "Employee · Directory & job" (2026-11-16) */}
        {!access.EMPLOYEES && (['EMPLOYEE_PERSONAL_DETAILS', 'EMPLOYEE_IDS_BANK', 'EMPLOYEE_DOCUMENTS', 'SALARY', 'MEDICAL'] as const).some((a) => access[a]) && (
          <p className="rounded-2xl bg-warning/10 px-4 py-3 text-sm text-warning-ink">
            The employee areas work only together with <strong>Employee directory &amp; job</strong>: View - without it nobody with this role can
            open another employee&apos;s profile.
          </p>
        )}
        <FormError error={create.error ?? update.error ?? remove.error} />
      </div>
      {dialog}
    </FormDrawer>
  )
}
