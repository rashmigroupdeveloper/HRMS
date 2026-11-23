import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronRight, Pencil } from 'lucide-react'
import { useEffect, useState } from 'react'
import { FormError } from '@/components/FormError'
import { Pill } from '@/components/Pill'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { type AccessArea, type AccessLevel, hasAccess, useAccess } from '@/hooks/useAccess'
import { orpc } from '@/lib/orpc'
import { cn, formatDoneBy } from '@/lib/utils'
import { type AreaInfo, LEVEL_LABEL, LEVEL_TONE, type Role } from './labels'
import { LevelPicker } from './LevelPicker'
import { needsConfirmation, useConfirmPassword } from './useConfirmPassword'

// The access grid: one row per role, one column per area (on a phone: one block per role, the areas as a list).
// Someone with Edit on "Roles & access" changes a cell right here (saved at once, for everyone with that role); the
// pencil opens the dialog for name and description.
export function AccessGrid({
  roles,
  areas,
  canChange,
  onEdit,
}: {
  roles: Role[]
  areas: AreaInfo[]
  canChange: boolean
  onEdit: (role: Role) => void
}) {
  const queryClient = useQueryClient()
  const { me } = useAccess()
  // the cell being saved, e.g. "3:ONBOARDING"
  const [saving, setSaving] = useState<string | null>(null)
  const update = useMutation(
    orpc.accounts.roles.update.mutationOptions({
      // accounts.* covers the roles, the people list and the logged-in user's own access
      onSettled: () => {
        setSaving(null)
        void queryClient.invalidateQueries({ queryKey: orpc.accounts.key() })
      },
    }),
  )
  const [attachScroll, scroll] = useSideScroll(roles.length + areas.length)
  // changing roles needs the password re-entered (asked first, and again if the minutes ran out meanwhile)
  const { confirmThen, dialog } = useConfirmPassword()

  const setLevel = (role: Role, area: AccessArea, level: AccessLevel | 'NONE') => {
    const access = { ...role.access }
    if (level === 'NONE') delete access[area]
    else access[area] = level
    const run = () => {
      setSaving(`${role.id}:${area}`)
      update.mutate({ id: role.id, access }, { onError: (error) => needsConfirmation(error) && confirmThen(run, true) })
    }
    confirmThen(run)
  }
  // Someone who is not a super admin can only give - and change roles within - the access they have themselves
  const withinOwn = (role: Role) => me?.isSuperAdmin || areas.every((a) => !role.access[a.area] || hasAccess(me, a.area, role.access[a.area]))

  // name, "Built in", the pencil, description and who changed it last - the same in the table and in a phone block
  const roleInfo = (role: Role) => (
    <>
      <span className="flex items-center gap-2">
        <span className="font-medium">{role.name}</span>
        {role.isSuperAdmin && <Pill tone="neutral" className="py-0.5">Built in</Pill>}
        {role.isApprovalFallback && <Pill tone="gold" className="py-0.5">Fallback approver</Pill>}
        {canChange && !role.isSuperAdmin && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="ml-auto max-md:size-9"
            title="Change the name and description"
            aria-label={`Change the role ${role.name}`}
            onClick={() => onEdit(role)}
            disabled={!withinOwn(role)}
          >
            <Pencil />
          </Button>
        )}
      </span>
      {role.description && <span className="block text-xs whitespace-normal text-muted-foreground">{role.description}</span>}
      <span className="block text-xs whitespace-nowrap text-muted-foreground">Changed {formatDoneBy(role.updatedAt, role.updatedBy)}</span>
    </>
  )
  // one area of one role: the picker for someone who may change it, else a pill
  const cell = (role: Role, a: AreaInfo, editable: boolean) => {
    const level = role.access[a.area] ?? 'NONE'
    return editable ? (
      <LevelPicker
        size="sm"
        label={`${role.name}: ${a.label}`}
        value={level}
        disabled={saving !== null}
        isAllowed={(choice) => choice === 'NONE' || !!me?.isSuperAdmin || hasAccess(me, a.area, choice)}
        onChange={(choice) => setLevel(role, a.area, choice)}
      />
    ) : (
      <Pill tone={LEVEL_TONE[level]}>{LEVEL_LABEL[level]}</Pill>
    )
  }

  return (
    <section className="space-y-3 rounded-3xl bg-card p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <h2 className="text-lg font-light tracking-tight">Access grid</h2>
          <p className="text-xs text-muted-foreground">
            {canChange
              ? 'Pick a level to change it - it is saved at once and applies straight away to everyone with that role.'
              : 'What each role may do in each part of the system.'}
          </p>
        </div>
        <Legend />
      </div>
      {/* the password question opens a dialog - not shown as an error */}
      <FormError error={needsConfirmation(update.error) ? null : update.error} />
      {dialog}

      {/* a phone: one block per role, its areas as a list */}
      <ul className="space-y-3 md:hidden">
        {roles.map((role) => {
          const editable = canChange && !role.isSuperAdmin && withinOwn(role)
          return (
            <li key={role.id} className="rounded-2xl bg-surface-2/60 p-3">
              <div className="text-sm">{roleInfo(role)}</div>
              <p className="text-xs text-muted-foreground tabular-nums">
                {role.employeeCount} {role.employeeCount === 1 ? 'employee' : 'employees'}
              </p>
              <ul className="mt-2 divide-y divide-border/70 border-t border-border/70">
                {areas.map((a) => (
                  <li key={a.area} className="flex items-center justify-between gap-3 py-1">
                    <span className="min-w-0 text-sm">
                      {a.label}
                      {saving === `${role.id}:${a.area}` && <span className="ml-2 text-xs text-muted-foreground">Saving…</span>}
                    </span>
                    <span className="shrink-0">{cell(role, a, editable)}</span>
                  </li>
                ))}
              </ul>
            </li>
          )
        })}
      </ul>

      <div ref={attachScroll} className="relative max-md:hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={cn('min-w-64 align-bottom text-xs text-muted-foreground', PIN_LEFT, scroll.left && SHADE_RIGHT)}>Role</TableHead>
              {areas.map((a) => (
                <TableHead
                  key={a.area}
                  className="w-30 min-w-30 px-1.5 py-1.5 text-center align-bottom text-xs leading-tight whitespace-normal"
                  title={`View: ${a.read}\nEdit: ${a.write}`}
                >
                  {a.label}
                </TableHead>
              ))}
              <TableHead className="px-3 text-center align-bottom text-xs">Employees</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.map((role) => {
              const editable = canChange && !role.isSuperAdmin && withinOwn(role)
              return (
                <TableRow key={role.id} className={cn('group/row', role.isSuperAdmin && 'bg-surface-2/60 hover:bg-surface-2/60')}>
                  <TableCell
                    className={cn(
                      'py-1.5 align-top',
                      PIN_LEFT,
                      role.isSuperAdmin ? 'bg-[color-mix(in_srgb,var(--surface-2)_60%,var(--card))]' : PIN_HOVER,
                      scroll.left && SHADE_RIGHT,
                    )}
                  >
                    {roleInfo(role)}
                  </TableCell>
                  {areas.map((a) => (
                    <TableCell key={a.area} className="px-1.5 py-1.5 text-center">
                      {cell(role, a, editable)}
                      {saving === `${role.id}:${a.area}` && <span className="block text-xs text-muted-foreground">Saving…</span>}
                    </TableCell>
                  ))}
                  <TableCell className="text-center tabular-nums">{role.employeeCount}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        {/* more areas to the right: a soft fade on the edge */}
        {scroll.right && <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-linear-to-l from-card to-transparent" />}
      </div>

      <AreaHelp areas={areas} />
    </section>
  )
}

// The role column stays in view while the areas scroll sideways, with a soft shade on the side they slide under
const PIN_LEFT = 'sticky left-0 z-10 bg-card'
const PIN_HOVER = 'group-hover/row:bg-[color-mix(in_srgb,var(--muted)_50%,var(--card))]'
const SHADE_RIGHT = 'after:pointer-events-none after:absolute after:inset-y-0 after:left-full after:w-5 after:bg-linear-to-r after:from-foreground/12 after:to-transparent'

// Whether the table inside `ref` can still be scrolled to the left / right; `size`: looked at again when it changes
function useSideScroll(size: number) {
  // the wrapper, kept as state (a callback ref) so the effect runs once it is on the page
  const [wrapper, setWrapper] = useState<HTMLDivElement | null>(null)
  const [state, setState] = useState({ left: false, right: false })
  useEffect(() => {
    const box = wrapper?.querySelector<HTMLElement>('[data-slot="table-container"]')
    if (!box) return
    const read = () => {
      const left = box.scrollLeft > 1
      const right = box.scrollLeft + box.clientWidth < box.scrollWidth - 1
      setState((s) => (s.left === left && s.right === right ? s : { left, right }))
    }
    read()
    box.addEventListener('scroll', read, { passive: true })
    const observer = new ResizeObserver(read)
    observer.observe(box)
    if (box.firstElementChild) observer.observe(box.firstElementChild)
    return () => {
      box.removeEventListener('scroll', read)
      observer.disconnect()
    }
  }, [wrapper, size])
  return [setWrapper, state] as const
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <Pill tone={LEVEL_TONE.WRITE}>Edit</Pill> see and change
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Pill tone={LEVEL_TONE.READ}>View</Pill> see only
      </span>
      <Pill tone={LEVEL_TONE.NONE}>No access</Pill>
    </div>
  )
}

// What View and Edit mean in each area (the column headers also show it on hover)
function AreaHelp({ areas }: { areas: AreaInfo[] }) {
  return (
    <details className="group rounded-2xl bg-surface-2 px-4 py-2 text-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-medium [&::-webkit-details-marker]:hidden">
        <ChevronRight aria-hidden className="size-4 text-muted-foreground transition-transform group-open:rotate-90" />
        What View and Edit allow in each area
      </summary>
      <dl className="mt-2 grid gap-3 pb-1 sm:grid-cols-2">
        {areas.map((a) => (
          <div key={a.area}>
            <dt className="font-medium">{a.label}</dt>
            <dd className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">View:</span> {a.read}
            </dd>
            <dd className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Edit:</span> {a.write}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  )
}
