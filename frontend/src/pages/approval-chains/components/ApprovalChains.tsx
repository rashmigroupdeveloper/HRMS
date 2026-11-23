import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Bell, BellOff, Briefcase, CalendarClock, CalendarMinus, CalendarPlus, CalendarOff, ChevronRight, CircleCheck, Clock, Eye, FileClock, MapPin, EyeOff, GitBranch, IndianRupee, Lock, Pencil, Plus, ShieldCheck, SkipForward, Trash2, UserX, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { DrawerCancel, FormDrawer } from '@/components/FormDrawer'
import { FormError } from '@/components/FormError'
import { Pill } from '@/components/Pill'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { useAccess } from '@/hooks/useAccess'
import { type client, orpc } from '@/lib/orpc'
import { cn, formatDate } from '@/lib/utils'

// The approval chains (the user, 2026-11-20 - their own page and access area, "Approval chains"): for each kind of request (a job / position change, a
// salary revision...), the steps it goes through, in order - free-form: any steps, any order (e.g. "manager only",
// "manager -> HOD -> HR -> HR Head"). Each step is the reporting manager, the functional manager, the HOD, anyone holding a
// role, or anyone with an access - within their data access. One chain is shared by every company; a company can have
// its own. A step with nobody to decide it is skipped (a role / access nobody holds goes to the fallback approver - the
// role marked so on the Roles tab).

type ChainsList = Awaited<ReturnType<typeof client.approvals.chains.list>>
type Kind = ChainsList['kinds'][number]
type Role = ChainsList['roles'][number]
type AreaInfo = ChainsList['areas'][number]
type Chain = Kind['chains'][number]
type Breach = Chain['steps'][number]['onBreach']
type Step = {
  approverType: 'REPORTING_MANAGER' | 'FUNCTIONAL_MANAGER' | 'HOD' | 'ROLE' | 'ACCESS'
  roleId: number | null
  accessArea: AreaInfo['area'] | null
  // a ROLE / ACCESS step named to one holder (null: anyone holding it - the user, 2026-11-20)
  approverId: number | null
  seesConfidential: boolean
  // the SLA (2026-11-20): hours, what happens when they pass, the role to escalate to
  slaHours: number | null
  onBreach: Breach
  escalateRoleId: number | null
  // "Wait - no reminder" picked (sent as WAIT without hours) - kept apart so emptying the hours box does not pick it
  silent: boolean
}

// What happens on an SLA breach, as the old HRMS's editor - plus "wait" (the user, 2026-11-20): nothing moves and only
// its approver decides; the SLA then only sets the reminder - or no reminder at all, the default for a new step (the
// user, 2026-11-20 - as the backend's default)
type Choice = Breach | 'WAIT_SILENT'
// the hours an action starts with when picked instead of "wait - no reminder"
const DEFAULT_SLA_HOURS = 48
const BREACH: Record<Choice, { label: string; hint: (hours: number) => string; warn?: boolean }> = {
  WAIT_SILENT: { label: 'Wait - no reminder', hint: () => 'Nothing moves and no reminder is sent - it waits as long as it takes.' },
  WAIT: { label: 'Wait - remind the approver', hint: (h) => `Nothing moves - the approver is reminded every ${h} hours until they decide.` },
  ESCALATE: { label: 'Escalate', hint: (h) => `After ${h} hours it is passed on - the approver's manager, or the role picked below.` },
  EXPIRE: { label: 'Lapse', hint: (h) => `After ${h} hours the request dies unapproved - the requester raises it again if still needed.` },
  AUTO_APPROVE: { label: 'Auto-approve', hint: (h) => `After ${h} hours the system approves it - nobody checks it at this step.`, warn: true },
  AUTO_REJECT: { label: 'Auto-reject', hint: (h) => `After ${h} hours the system rejects it.`, warn: true },
}
const choiceOf = (s: Step): Choice => (s.silent ? 'WAIT_SILENT' : s.onBreach)
// what a chain's step shows in the list: "remind 48 h", "48 h → escalate"... (nothing for "wait - no reminder")
const BREACH_SHORT: Record<Breach, string> = { WAIT: 'wait', ESCALATE: 'escalate', AUTO_APPROVE: 'auto-approve', EXPIRE: 'lapse', AUTO_REJECT: 'auto-reject' }
// the breach actions that decide without a person - shown in the warning ink
const BREACH_WARN: Record<Breach, boolean> = { WAIT: false, ESCALATE: false, AUTO_APPROVE: true, EXPIRE: false, AUTO_REJECT: true }
// each kind's icon on its card (a new kind without one shows the generic chain icon)
const KIND_ICON: Partial<Record<Kind['kind'], typeof GitBranch>> = {
  JOB_CHANGE: Briefcase,
  SALARY_REVISION: IndianRupee,
  SHIFT_CHANGE: CalendarClock,
  LEAVE: CalendarOff,
  LEAVE_CANCEL: CalendarMinus,
  REGULARIZATION: FileClock,
  ON_DUTY: MapPin,
  COMP_OFF: CalendarPlus,
}
const isNamedType = (t: Step['approverType']) => t === 'REPORTING_MANAGER' || t === 'FUNCTIONAL_MANAGER' || t === 'HOD'
const newStep = (approverType: Step['approverType'], seesConfidential: boolean): Step => ({
  approverType,
  roleId: null,
  accessArea: null,
  approverId: null,
  seesConfidential,
  slaHours: null,
  onBreach: 'WAIT',
  escalateRoleId: null,
  silent: true,
})

const TYPE_LABEL: Record<Step['approverType'], string> = {
  REPORTING_MANAGER: 'Reporting manager',
  FUNCTIONAL_MANAGER: 'Functional manager',
  HOD: 'HOD of their department',
  ROLE: 'Anyone with a role',
  ACCESS: 'Anyone with an access',
}

export function ApprovalChains({ canChange }: { canChange: boolean }) {
  const queryClient = useQueryClient()
  const chains = useQuery(orpc.approvals.chains.list.queryOptions())
  const roles = chains.data?.roles ?? []
  const areas = chains.data?.areas ?? []
  const companies = useQuery(orpc.organization.companies.list.queryOptions())
  const [editing, setEditing] = useState<{ kind: Kind; companyId: number | null; isActive: boolean; steps: Step[] } | null>(null)
  const [adding, setAdding] = useState<Record<string, string>>({})
  // the company chain whose removal waits for a second click
  const [removing, setRemoving] = useState<string | null>(null)
  const remove = useMutation(orpc.approvals.chains.remove.mutationOptions({ onSuccess: () => void queryClient.invalidateQueries({ queryKey: orpc.approvals.key() }) }))
  const fallback = roles.find((r) => r.isApprovalFallback)
  // the shared chain needs Approval chains Edit for all companies, a company's own chain Edit for that whole company - only
  // those are offered (B13, 2026-11-21; the backend checks the same)
  const { coversGroup, coversWhole } = useAccess()
  const mayChange = (companyId: number | null) =>
    canChange && (companyId === null ? coversGroup('APPROVAL_CHAINS') : coversWhole('APPROVAL_CHAINS', 'WRITE', { companyId }))
  const areaLabel = (area: string | null) => areas.find((a) => a.area === area)?.label ?? area
  const stepText = (s: Chain['steps'][number]) => (s.approverType === 'ROLE' ? (s.roleName ?? 'A role') : s.approverType === 'ACCESS' ? areaLabel(s.accessArea) : TYPE_LABEL[s.approverType as Step['approverType']])
  const toSteps = (chain: Chain | undefined): Step[] =>
    (chain?.steps ?? []).map((s) => ({
      approverType: s.approverType as Step['approverType'],
      roleId: s.roleId,
      accessArea: s.accessArea,
      approverId: s.approverId,
      seesConfidential: s.seesConfidential,
      slaHours: s.slaHours,
      onBreach: s.onBreach,
      escalateRoleId: s.escalateRoleId,
      silent: s.onBreach === 'WAIT' && s.slaHours === null,
    }))

  return (
    <div className="space-y-4">
      <ul className="flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-2xl bg-card/60 px-4 py-2.5 text-xs text-muted-foreground">
        <li className="flex items-center gap-1.5">
          <SkipForward className="size-3.5 shrink-0" />A step with nobody to decide it is skipped - no manager, no HOD
        </li>
        <li className="flex flex-wrap items-center gap-1.5">
          <ShieldCheck className="size-3.5 shrink-0" />
          Nobody can decide → fallback approver
          {fallback ? (
            <Pill tone="gold" className="py-0.5">
              {fallback.name}
            </Pill>
          ) : (
            <>
              <Pill tone="warning" className="py-0.5">
                Not set
              </Pill>
              <Link to="/access" className="text-warning-ink underline underline-offset-2">
                mark a role in Roles &amp; access
              </Link>
            </>
          )}
        </li>
        <li className="flex items-center gap-1.5">
          <UserX className="size-3.5 shrink-0" />
          Nobody decides a request about themselves or one they raised
        </li>
      </ul>
      <FormError error={chains.error ?? remove.error} />
      {(chains.data?.kinds ?? []).map((kind) => {
        const shared = kind.chains.find((c) => c.companyId === null)
        const own = kind.chains.filter((c) => c.companyId !== null)
        const free = (companies.data ?? []).filter((co) => !own.some((c) => c.companyId === co.id) && mayChange(co.id))
        const KindIcon = KIND_ICON[kind.kind] ?? GitBranch
        const picking = adding[kind.kind] !== undefined
        const stopPicking = () =>
          setAdding((a) => {
            const next = { ...a }
            delete next[kind.kind]
            return next
          })
        return (
          <section key={kind.kind} className="rounded-3xl bg-card px-4 pt-3 pb-1 shadow-card sm:px-5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pb-2">
              <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-surface-2">
                <KindIcon className="size-4" />
              </span>
              <h2 className="text-base font-medium">{kind.label}</h2>
              {kind.confidential && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Lock className="size-3.5" />
                  sees {kind.confidential}
                </span>
              )}
              {free.length > 0 && (
                <span className={cn('ml-auto flex items-center gap-1.5', picking && 'max-sm:w-full')}>
                  {picking ? (
                    <>
                      <NativeSelect
                        aria-label="Company for its own chain"
                        value={adding[kind.kind]}
                        onChange={(e) => setAdding((a) => ({ ...a, [kind.kind]: e.target.value }))}
                        className="min-w-0 flex-1 sm:w-64 sm:flex-none max-sm:*:h-9"
                      >
                        <NativeSelectOption value="">Pick a company…</NativeSelectOption>
                        {free.map((co) => (
                          <NativeSelectOption key={co.id} value={String(co.id)}>
                            {co.name}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full max-sm:h-9"
                        disabled={!adding[kind.kind]}
                        onClick={() => {
                          setEditing({ kind, companyId: Number(adding[kind.kind]), isActive: true, steps: toSteps(shared) })
                          stopPicking()
                        }}
                      >
                        Set its steps
                      </Button>
                      <Button size="icon-sm" variant="ghost" aria-label="Cancel" className="max-sm:size-9" onClick={stopPicking}>
                        <X />
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="ghost" className="rounded-full text-muted-foreground" onClick={() => setAdding((a) => ({ ...a, [kind.kind]: '' }))}>
                      <Plus /> Company chain
                    </Button>
                  )}
                </span>
              )}
            </div>
            <div className="divide-y divide-dashed border-t border-dashed">
              {[...(shared ? [shared] : []), ...own].map((chain) => (
                <div key={chain.companyId ?? 'shared'} className="grid items-center gap-x-4 gap-y-2 py-3 sm:grid-cols-[9.5rem_1fr_auto]">
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm font-medium" title={chain.company?.name}>
                      {chain.company ? chain.company.name : 'Every company'}
                    </p>
                    {chain.isActive ? (
                      <p className="text-xs text-muted-foreground">{chain.company ? 'Its own chain' : own.length ? 'All other companies' : 'Shared chain'}</p>
                    ) : (
                      <span title="Switched off - new requests are refused">
                        <Pill tone="negative" className="mt-0.5 py-0.5">
                          Off
                        </Pill>
                      </span>
                    )}
                  </div>
                  <ol className={cn('flex min-w-0 flex-wrap items-center gap-y-2 max-sm:flex-col max-sm:items-start max-sm:gap-y-1.5', !chain.isActive && 'opacity-60')}>
                    {chain.steps.map((s, n) => {
                      const sees = s.seesConfidential && !!kind.confidential
                      return (
                        <li key={n} className="flex items-center">
                          {n > 0 && <ChevronRight aria-hidden className="mx-0.5 size-4 shrink-0 text-muted-foreground/60 max-sm:hidden" />}
                          <span className="inline-flex items-center gap-2 sm:rounded-full sm:bg-surface-2 sm:py-1 sm:pr-3 sm:pl-1">
                            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-foreground text-xs font-semibold text-background tabular-nums">{n + 1}</span>
                            <span className="flex leading-tight max-sm:flex-wrap max-sm:items-baseline max-sm:gap-x-2 sm:flex-col">
                              <span className="flex items-center gap-1 text-sm font-medium whitespace-nowrap">
                                {stepText(s)}
                                {s.approver && <span className="font-normal text-muted-foreground">· {s.approver.name}</span>}
                                {sees && <Lock aria-label={`Sees ${kind.confidential}`} className="size-3.5 text-muted-foreground" />}
                                {n === chain.steps.length - 1 && <CircleCheck aria-hidden className="ml-1 size-4 shrink-0 text-positive-ink sm:hidden" />}
                              </span>
                              <span className="flex items-center gap-1 text-xs whitespace-nowrap text-muted-foreground">
                                {s.slaHours === null ? (
                                  <>
                                    <BellOff className="size-3" /> no reminder
                                  </>
                                ) : s.onBreach === 'WAIT' ? (
                                  <>
                                    <Bell className="size-3" /> remind every {s.slaHours} h
                                  </>
                                ) : (
                                  <>
                                    <Clock className="size-3" />
                                    <span className={cn(BREACH_WARN[s.onBreach] && 'text-warning-ink')}>
                                      {s.slaHours} h → {BREACH_SHORT[s.onBreach]}
                                      {s.onBreach === 'ESCALATE' && s.escalateRoleName ? ` to ${s.escalateRoleName}` : ''}
                                    </span>
                                  </>
                                )}
                              </span>
                            </span>
                          </span>
                          {n === chain.steps.length - 1 && <CircleCheck aria-label="then approved" className="ml-1.5 size-4 shrink-0 text-positive-ink max-sm:hidden" />}
                        </li>
                      )
                    })}
                  </ol>
                  <div className="flex items-center gap-2 sm:justify-end">
                    <span className="text-xs text-muted-foreground sm:text-right">
                      Changed {formatDate(chain.updatedAt)}
                      <br className="max-sm:hidden" /> by {chain.updatedBy?.name ?? 'System'}
                    </span>
                    {mayChange(chain.companyId) && (
                      <span className="ml-auto flex shrink-0 gap-2 sm:ml-0">
                        <Button size="sm" variant="outline" className="rounded-full max-sm:h-9" onClick={() => setEditing({ kind, companyId: chain.companyId, isActive: chain.isActive, steps: toSteps(chain) })}>
                          <Pencil /> Change
                        </Button>
                        {chain.companyId !== null &&
                          (removing === `${kind.kind}:${chain.companyId}` ? (
                            <Button
                              size="sm"
                              variant="destructive"
                              className="rounded-full max-sm:h-9"
                              disabled={remove.isPending}
                              onClick={() => remove.mutate({ kind: kind.kind, companyId: chain.companyId! }, { onSettled: () => setRemoving(null) })}
                            >
                              Yes, use the shared chain
                            </Button>
                          ) : (
                            <Button size="icon-sm" variant="ghost" className="max-sm:size-9" aria-label="Remove this company's own chain" onClick={() => setRemoving(`${kind.kind}:${chain.companyId}`)}>
                              <Trash2 />
                            </Button>
                          ))}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )
      })}
      {editing && (
        <ChainDrawer
          kind={editing.kind}
          companyId={editing.companyId}
          companyName={(companies.data ?? []).find((c) => c.id === editing.companyId)?.name ?? null}
          start={editing.steps}
          startActive={editing.isActive}
          roles={roles}
          areas={areas}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function ChainDrawer({
  kind,
  companyId,
  companyName,
  start,
  startActive,
  roles,
  areas,
  onClose,
}: {
  kind: Kind
  companyId: number | null
  companyName: string | null
  start: Step[]
  startActive: boolean
  roles: Role[]
  areas: AreaInfo[]
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [steps, setSteps] = useState<Step[]>(start.length ? start : [newStep('REPORTING_MANAGER', !!kind.confidential)])
  const [isActive, setIsActive] = useState(startActive)
  const [closed, setClosed] = useState(false)
  const save = useMutation(
    orpc.approvals.chains.save.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: orpc.approvals.key() })
        setClosed(true)
      },
    }),
  )
  const dirty = JSON.stringify(steps) !== JSON.stringify(start) || isActive !== startActive
  const change = (index: number, patch: Partial<Step>) => setSteps((all) => all.map((s, n) => (n === index ? { ...s, ...patch } : s)))
  const move = (index: number, by: number) =>
    setSteps((all) => {
      const next = [...all]
      const [step] = next.splice(index, 1)
      next.splice(index + by, 0, step!)
      return next
    })
  const incomplete = steps.some((s) => (s.approverType === 'ROLE' && !s.roleId) || (s.approverType === 'ACCESS' && !s.accessArea) || (!s.silent && s.slaHours === null))
  // "wait - no reminder" is sent as WAIT without hours
  const toSave = steps.map(({ silent, ...s }) => ({ ...s, slaHours: silent ? null : s.slaHours }))

  return (
    <FormDrawer
      onClose={onClose}
      closed={closed}
      dirty={dirty}
      width={640}
      title={`${kind.label} · ${companyName ?? 'every company'}`}
      description="The steps run in order. Each person is asked once; a step with nobody to decide it is skipped."
      footer={
        <>
          <DrawerCancel />
          <Button variant="gold" disabled={save.isPending || incomplete || steps.length === 0} onClick={() => save.mutate({ kind: kind.kind, companyId, isActive, steps: toSave })}>
            {save.isPending ? 'Saving…' : 'Save chain'}
          </Button>
        </>
      }
    >
      <div className={cn('flex items-center gap-3 rounded-2xl px-3 py-2.5', isActive ? 'bg-surface-2' : 'bg-destructive/10')}>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{isActive ? 'Chain is on' : 'Chain is off'}</span>
          <span className="block text-xs text-muted-foreground">
            {isActive
              ? `New ${kind.label.toLowerCase()} requests follow these steps.`
              : `New ${kind.label.toLowerCase()} requests are refused${companyId === null ? ' (in companies without a chain of their own)' : ` for ${companyName ?? 'this company'}`}. Requests already raised go on.`}
          </span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={isActive}
          aria-label="Chain is on"
          onClick={() => setIsActive((on) => !on)}
          className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none', isActive ? 'bg-positive' : 'bg-input')}
        >
          <span className={cn('absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-sm transition-transform', isActive && 'translate-x-5')} />
        </button>
      </div>

      <ol>
        {steps.map((step, index) => {
          const choice = choiceOf(step)
          return (
            <li key={index} className="grid grid-cols-[1.75rem_1fr] gap-x-3">
              <span className="flex flex-col items-center">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-foreground text-sm font-semibold text-background tabular-nums">{index + 1}</span>
                <span aria-hidden className="w-px flex-1 bg-border" />
              </span>
              <div className="mb-3 space-y-2.5 rounded-2xl border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <NativeSelect
                    aria-label={`Step ${index + 1}: approver`}
                    value={step.approverType}
                    onChange={(e) => change(index, { approverType: e.target.value as Step['approverType'], roleId: null, accessArea: null, approverId: null })}
                    className="min-w-44 flex-1"
                  >
                    {(Object.keys(TYPE_LABEL) as Step['approverType'][]).map((t) => (
                      <NativeSelectOption key={t} value={t}>
                        {TYPE_LABEL[t]}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  {step.approverType === 'ROLE' && (
                    <NativeSelect aria-label="Role" value={step.roleId ?? ''} onChange={(e) => change(index, { roleId: Number(e.target.value) || null, approverId: null })} className="min-w-44 flex-1">
                      <NativeSelectOption value="">Pick a role…</NativeSelectOption>
                      {roles.map((r) => (
                        <NativeSelectOption key={r.id} value={r.id}>
                          {r.name}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  )}
                  {step.approverType === 'ACCESS' && (
                    <NativeSelect
                      aria-label="Access"
                      value={step.accessArea ?? ''}
                      onChange={(e) => change(index, { accessArea: (e.target.value || null) as Step['accessArea'], approverId: null })}
                      className="min-w-44 flex-1"
                    >
                      <NativeSelectOption value="">Pick an access (Edit)…</NativeSelectOption>
                      {areas.map((a) => (
                        <NativeSelectOption key={a.area} value={a.area}>
                          {a.label}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  )}
                  <span className="ml-auto flex">
                    <Button size="icon-sm" variant="ghost" aria-label="Move up" disabled={index === 0} onClick={() => move(index, -1)}>
                      <ArrowUp />
                    </Button>
                    <Button size="icon-sm" variant="ghost" aria-label="Move down" disabled={index === steps.length - 1} onClick={() => move(index, 1)}>
                      <ArrowDown />
                    </Button>
                    <Button size="icon-sm" variant="ghost" aria-label="Remove step" disabled={steps.length === 1} onClick={() => setSteps((all) => all.filter((_, n) => n !== index))}>
                      <Trash2 />
                    </Button>
                  </span>
                </div>

                {(() => {
                  // who decides a role / access step: anyone holding it, or one holder whose access covers the whole chain -
                  // every company for the shared chain, the whole company for its own (the user, 2026-11-20)
                  const holders =
                    step.approverType === 'ROLE' ? roles.find((r) => r.id === step.roleId)?.holders : step.approverType === 'ACCESS' ? areas.find((a) => a.area === step.accessArea)?.holders : undefined
                  if (!holders) return null
                  const fits = holders.filter((h) => h.everyCompany || (companyId !== null && h.companyIds.includes(companyId)))
                  const what = step.approverType === 'ROLE' ? 'role' : 'access'
                  const picked = step.approverId === null ? null : fits.find((h) => h.employeeId === step.approverId)
                  return (
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm">
                        <label htmlFor={`step-person-${index}`} className="text-muted-foreground">
                          Decided by
                        </label>
                        <NativeSelect
                          id={`step-person-${index}`}
                          value={step.approverId ?? ''}
                          onChange={(e) => change(index, { approverId: Number(e.target.value) || null })}
                          aria-invalid={step.approverId !== null && !picked}
                          className="min-w-56 flex-1"
                        >
                          <NativeSelectOption value="">Anyone with this {what}</NativeSelectOption>
                          {step.approverId !== null && !picked && (
                            <NativeSelectOption value={step.approverId}>{holders.find((h) => h.employeeId === step.approverId)?.name ?? 'The person picked earlier'} - no longer qualifies</NativeSelectOption>
                          )}
                          {fits.map((h) => (
                            <NativeSelectOption key={h.employeeId} value={h.employeeId}>
                              {h.name} ({h.employeeCode})
                            </NativeSelectOption>
                          ))}
                        </NativeSelect>
                      </div>
                      <p className={cn('text-xs', step.approverId !== null && !picked ? 'text-destructive' : 'text-muted-foreground')}>
                        {step.approverId === null
                          ? `Any holder whose data access covers the employee decides it. ${fits.length ? `${fits.length} ${fits.length === 1 ? 'person holds' : 'people hold'}` : 'Nobody holds'} it for ${companyId === null ? 'every company' : 'the whole company'}.`
                          : picked
                            ? `Only ${picked.name} decides it. If they leave or their access changes, the fallback approver does.`
                            : `They no longer hold this ${what} for ${companyId === null ? 'every company' : 'the whole company'} - pick someone else or "Anyone".`}
                      </p>
                    </div>
                  )
                })()}

                {kind.confidential && (
                  <button
                    type="button"
                    aria-pressed={step.seesConfidential}
                    onClick={() => change(index, { seesConfidential: !step.seesConfidential })}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                      step.seesConfidential ? 'bg-gold-soft text-foreground' : 'bg-surface-2 text-muted-foreground',
                    )}
                  >
                    {step.seesConfidential ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                    {step.seesConfidential ? `Sees ${kind.confidential}` : `Does not see ${kind.confidential}`}
                    <span className="text-muted-foreground">· change</span>
                  </button>
                )}

                <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm">
                  <label htmlFor={`step-breach-${index}`} className="text-muted-foreground">
                    If not decided
                  </label>
                  <NativeSelect
                    id={`step-breach-${index}`}
                    value={choice}
                    onChange={(e) => {
                      const next = e.target.value as Choice
                      change(index, {
                        silent: next === 'WAIT_SILENT',
                        onBreach: next === 'WAIT_SILENT' ? 'WAIT' : next,
                        slaHours: next === 'WAIT_SILENT' ? null : (step.slaHours ?? DEFAULT_SLA_HOURS),
                        escalateRoleId: null,
                      })
                    }}
                  >
                    {(Object.keys(BREACH) as Choice[]).map((b) => (
                      <NativeSelectOption key={b} value={b}>
                        {BREACH[b].label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  {choice !== 'WAIT_SILENT' && (
                    <span className="flex items-center gap-2">
                      <label htmlFor={`step-sla-${index}`} className="text-muted-foreground">
                        {choice === 'WAIT' ? 'every' : 'after'}
                      </label>
                      <Input
                        id={`step-sla-${index}`}
                        type="number"
                        min={1}
                        max={2160}
                        value={step.slaHours ?? ''}
                        onChange={(e) => change(index, { slaHours: e.target.value ? Math.min(2160, Math.max(1, Math.round(Number(e.target.value)))) : null })}
                        aria-invalid={step.slaHours === null}
                        className="h-8 w-20"
                      />
                      <span className="text-muted-foreground">hours</span>
                    </span>
                  )}
                  {step.onBreach === 'ESCALATE' && (
                    <span className="flex items-center gap-2">
                      <label htmlFor={`step-escalate-${index}`} className="text-muted-foreground">
                        to
                      </label>
                      <NativeSelect id={`step-escalate-${index}`} value={step.escalateRoleId ?? ''} onChange={(e) => change(index, { escalateRoleId: Number(e.target.value) || null })}>
                        <NativeSelectOption value="">{isNamedType(step.approverType) ? "the late approver's manager" : 'the fallback approver'}</NativeSelectOption>
                        {roles.map((r) => (
                          <NativeSelectOption key={r.id} value={r.id}>
                            {r.name}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </span>
                  )}
                </div>
                <p className={cn('text-xs', BREACH[choice].warn ? 'text-warning-ink' : 'text-muted-foreground')}>{BREACH[choice].hint(step.slaHours ?? DEFAULT_SLA_HOURS)}</p>
              </div>
            </li>
          )
        })}
        <li className="grid grid-cols-[1.75rem_1fr] items-center gap-x-3">
          <span className="flex flex-col items-center">
            <span className="grid size-7 place-items-center rounded-full border border-dashed text-muted-foreground">
              <Plus className="size-4" />
            </span>
          </span>
          <span>
            <Button variant="ghost" size="sm" className="rounded-full" disabled={steps.length >= 10} onClick={() => setSteps((all) => [...all, newStep('ROLE', !!kind.confidential)])}>
              Add a step
            </Button>
          </span>
        </li>
        <li className="mt-2 grid grid-cols-[1.75rem_1fr] items-center gap-x-3">
          <span className="grid size-7 place-items-center justify-self-center rounded-full bg-positive/15 text-positive-ink">
            <CircleCheck className="size-4" />
          </span>
          <span className="text-sm text-muted-foreground">Approved - once every step above has said yes</span>
        </li>
      </ol>
      <FormError error={save.error} />
    </FormDrawer>
  )
}
