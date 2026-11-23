import { ChevronDown, ChevronRight, LockKeyhole, Pencil, Search, ShieldCheck, Users } from 'lucide-react'
import { useState } from 'react'
import { Pill } from '@/components/Pill'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { hasAccess, useAccess } from '@/hooks/useAccess'
import { cn, formatDoneBy } from '@/lib/utils'
import { ACCESS_GROUPS, type AreaInfo, LEVEL_LABEL, LEVEL_TONE, type Role } from './labels'

// Inspect one role at a time. All permission changes go through RoleDialog's explicit Save and password check.
export function RoleWorkspace({ roles, areas, canChange, onEdit }: {
  roles: Role[]; areas: AreaInfo[]; canChange: boolean; onEdit: (role: Role) => void
}) {
  const { me } = useAccess()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [roleSearch, setRoleSearch] = useState('')
  const [search, setSearch] = useState('')
  const [group, setGroup] = useState('all')
  const selected = roles.find((role) => role.id === selectedId) ?? roles[0]
  const listedRoles = roles.filter((role) => `${role.name} ${role.description ?? ''}`.toLowerCase().includes(roleSearch.trim().toLowerCase()))
  if (!selected) return <div className="rounded-3xl bg-card p-6 text-sm shadow-card">No roles yet. Create a role to define its permissions.</div>

  const counts = {
    edit: areas.filter((a) => selected.access[a.area] === 'WRITE').length,
    view: areas.filter((a) => selected.access[a.area] === 'READ').length,
    none: areas.filter((a) => !selected.access[a.area]).length,
  }
  const heldByMe = !me?.isSuperAdmin && me?.availableRoles.some((role) => role.id === selected.id)
  const exceedsOwn = !me?.isSuperAdmin && areas.some((a) => selected.access[a.area] && !hasAccess(me, a.area, selected.access[a.area]))
  const editReason = selected.isSuperAdmin ? 'The built-in role cannot be changed.' : heldByMe ? 'You cannot edit a role you hold yourself.' : exceedsOwn ? 'This role grants more access than your active role.' : null
  const matching = areas.filter((a) => {
    const inGroup = group === 'all' || ACCESS_GROUPS.find((g) => g.id === group)?.areas.includes(a.area)
    return inGroup && `${a.label} ${a.read} ${a.write}`.toLowerCase().includes(search.trim().toLowerCase())
  })

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside aria-label="Choose a role to inspect" className="min-w-0 rounded-3xl bg-card p-4 shadow-card lg:sticky lg:top-28">
        <div className="mb-3 hidden items-center justify-between lg:flex">
          <h2 className="text-base font-medium">Roles</h2><span className="text-2xl font-light tabular-nums">{roles.length}</span>
        </div>
        <div className="lg:hidden">
          <Label htmlFor="inspect-role" className="sr-only">Role to inspect</Label>
          <NativeSelect id="inspect-role" className="w-full [&_select]:h-9" value={selected.id} onChange={(e) => setSelectedId(Number(e.target.value))}>
            {roles.map((role) => <NativeSelectOption key={role.id} value={role.id}>{role.name}</NativeSelectOption>)}
          </NativeSelect>
        </div>
        <div className="hidden lg:block">
          <div className="relative mb-3">
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Find a role" placeholder="Find a role" value={roleSearch} onChange={(e) => setRoleSearch(e.target.value)} className="h-9 rounded-full pl-9" />
          </div>
          <div className="max-h-[calc(100svh-20rem)] space-y-1 overflow-y-auto overscroll-contain">
            {listedRoles.map((role) => (
              <button key={role.id} type="button" aria-pressed={role.id === selected.id} aria-controls="role-permissions" onClick={() => setSelectedId(role.id)} className={cn('access-role-choice flex min-h-16 w-full items-center gap-3 rounded-2xl px-3 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring', role.id === selected.id ? 'bg-surface-2' : 'hover:bg-surface-2/60')}>
                <span aria-hidden className={cn('grid size-9 shrink-0 place-items-center rounded-full', role.id === selected.id ? 'bg-hero text-hero-foreground' : 'bg-surface-2 text-muted-foreground')}><ShieldCheck className="size-4" /></span>
                <span className="min-w-0 flex-1"><span className="block break-words text-sm font-medium">{role.name}</span><span className="block text-xs text-muted-foreground">{role.employeeCount} {role.employeeCount === 1 ? 'employee' : 'employees'}</span></span>
                {role.id === selected.id && <ChevronRight aria-hidden className="size-4 shrink-0" />}
              </button>
            ))}
            {listedRoles.length === 0 && <p className="px-3 py-4 text-sm text-muted-foreground">No matching roles. Try a different name.</p>}
          </div>
          <p className="mt-4 px-2 text-xs leading-relaxed text-muted-foreground">Inspecting a role here does not change your active role.</p>
        </div>
      </aside>

      <section id="role-permissions" aria-label="Role permissions" className="min-w-0 overflow-hidden rounded-3xl bg-card shadow-card">
        <div key={selected.id} className="access-role-panel">
          <div className="bg-hero p-4 text-hero-foreground sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="break-words text-xl font-light tracking-tight sm:text-2xl">{selected.name}</h2>
                  {selected.isSuperAdmin && <span className="rounded-full bg-hero-foreground/10 px-2 py-1 text-xs">Built in</span>}
                  {selected.isApprovalFallback && <span className="rounded-full bg-gold-soft px-2 py-1 text-xs text-gold-foreground">Fallback approver</span>}
                </div>
                {selected.description && <p className="mt-2 max-w-2xl text-xs leading-relaxed text-hero-foreground/75">{selected.description}</p>}
              </div>
              {canChange && !selected.isSuperAdmin && <Button variant="secondary" size="sm" disabled={!!editReason} title={editReason ?? undefined} className="shrink-0 bg-hero-foreground text-hero hover:bg-hero-foreground/90" onClick={() => onEdit(selected)}><Pencil aria-hidden /><span>Edit role</span></Button>}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-hero-foreground/80">
              <span className="inline-flex items-center gap-1.5"><Users aria-hidden className="size-3.5" />{selected.employeeCount} {selected.employeeCount === 1 ? 'employee' : 'employees'}</span>
              <span>{selected.chainStepCount} approval-chain {selected.chainStepCount === 1 ? 'step' : 'steps'}</span>
              <span className="hidden items-center gap-1.5 sm:inline-flex"><LockKeyhole aria-hidden className="size-3.5" />{selected.isSuperAdmin ? 'Protected role' : 'Changes require your password'}</span>
            </div>
          </div>
          <div className="space-y-4 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><span><strong className="text-foreground tabular-nums">{counts.edit}</strong> Edit</span><span><strong className="text-foreground tabular-nums">{counts.view}</strong> View</span><span><strong className="text-foreground tabular-nums">{counts.none}</strong> No access</span></p>
              <p className="text-xs text-muted-foreground">{areas.length} permission areas</p>
            </div>
            <div className="relative">
              <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input aria-label="Find a permission" placeholder="Find a permission" value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 rounded-full pl-9" />
            </div>
            <div aria-label="Permission groups" className="flex flex-wrap gap-1.5">
              {[{ id: 'all', label: 'All areas' }, ...ACCESS_GROUPS].map((g) => <button key={g.id} type="button" aria-pressed={group === g.id} onClick={() => setGroup(g.id)} className={cn('access-role-choice min-h-9 rounded-full px-3 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring', group === g.id ? 'bg-hero text-hero-foreground' : 'bg-surface-2 text-muted-foreground hover:text-foreground')}>{g.label}</button>)}
            </div>
            {editReason && !selected.isSuperAdmin && <p className="text-xs text-muted-foreground">{editReason}</p>}
            {!canChange && <p className="text-xs text-muted-foreground">View only. Your active role cannot change shared roles.</p>}
            <div>
              <div className="flex items-center justify-between border-b border-border pb-2 text-xs text-muted-foreground"><h3 className="font-medium text-foreground">Permissions</h3><span role="status">{matching.length} of {areas.length}</span></div>
              {matching.length === 0 && <p className="py-6 text-sm text-muted-foreground">No permissions match. Clear the search or choose another group.</p>}
              {matching.map((a) => <PermissionRow key={a.area} info={a} level={selected.access[a.area] ?? 'NONE'} />)}
            </div>
            <p className="border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">Changed {formatDoneBy(selected.updatedAt, selected.updatedBy)}. Data access is set separately for each employee on the People tab.</p>
          </div>
        </div>
      </section>
    </div>
  )
}

function PermissionRow({ info, level }: { info: AreaInfo; level: keyof typeof LEVEL_LABEL }) {
  return <details className="group border-b border-border/60 last:border-0">
    <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 py-2 outline-none focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
      <ChevronDown aria-hidden className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none" />
      <span className="min-w-0 flex-1 text-sm">{info.label}</span><Pill tone={LEVEL_TONE[level]} className="shrink-0">{LEVEL_LABEL[level]}</Pill>
    </summary>
    <dl className="grid gap-2 pb-4 pl-6.5 text-xs leading-relaxed text-muted-foreground sm:grid-cols-2 sm:gap-5"><div><dt className="mb-1 font-medium text-foreground">View</dt><dd>{info.read}</dd></div><div><dt className="mb-1 font-medium text-foreground">Edit</dt><dd>{info.write}</dd></div></dl>
  </details>
}
