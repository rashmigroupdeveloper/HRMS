import {
  ArrowLeftRight,
  ArrowRight,
  BadgeCheck,
  Building2,
  Lock,
  LogIn,
  PencilLine,
  Shuffle,
  TrendingUp,
  UsersRound,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { Pill, type Tone } from '@/components/Pill'
import type { client } from '@/lib/orpc'
import { cn, formatDate, formatMoney } from '@/lib/utils'

// One job change (the user, 2026-11-20 - modules/job-changes): what kind, from when, why, what changes (old -> new), the
// proposed salary for those who may see it (approvers on a step set to see it, Employee · Salary View), and why it could
// not be applied. Used by the Approvals page, the job changes list and the employee's Job tab.
// Restyled 2026-11-21 (the user: "boring"): the kind as an icon tile, the reason as a quote, the changes as before -> after rows.

export type JobChange = Awaited<ReturnType<typeof client.jobChanges.get>>
export type JobChangeKind = JobChange['kind']

const JOB_CHANGE_STATUS: Record<JobChange['status'], Tone> = {
  PENDING: 'warning',
  APPROVED: 'info',
  APPLIED: 'positive',
  REJECTED: 'negative',
  CANCELLED: 'neutral',
}

// Each kind's icon
const JOB_CHANGE_KIND_ICON: Record<JobChangeKind, LucideIcon> = {
  JOINING: LogIn,
  PROMOTION: TrendingUp,
  TRANSFER: ArrowLeftRight,
  REDESIGNATION: BadgeCheck,
  MANAGER_CHANGE: UsersRound,
  COMPANY_TRANSFER: Building2,
  SALARY_REVISION: Wallet,
  SALARY_CORRECTION: PencilLine,
  OTHER: Shuffle,
}

// A kind's icon alone (the "Request a change" kind picker)
export function JobChangeKindIcon({ kind, className }: { kind: JobChangeKind; className?: string }) {
  const Icon = JOB_CHANGE_KIND_ICON[kind]
  return <Icon aria-hidden className={className} />
}

// A kind's icon in a small tile: blue-grey for a job change, gold for a salary one
export function JobChangeKindTile({ kind, className }: { kind: JobChangeKind; className?: string }) {
  const Icon = JOB_CHANGE_KIND_ICON[kind]
  const salary = kind === 'SALARY_REVISION' || kind === 'SALARY_CORRECTION'
  return (
    <span
      aria-hidden
      className={cn(
        'grid size-8 shrink-0 place-items-center rounded-xl',
        salary ? 'bg-gold-soft text-foreground' : kind === 'JOINING' || kind === 'OTHER' ? 'bg-surface-2 text-muted-foreground' : 'bg-info/15 text-info-ink',
        className,
      )}
    >
      <Icon className="size-4" />
    </span>
  )
}

// Where a change stands, as a pill (`label`: the words to show, e.g. "Approved - waits for its day")
export function JobChangeStatusPill({ status, label }: { status: JobChange['status']; label: string }) {
  return <Pill tone={JOB_CHANGE_STATUS[status]}>{label}</Pill>
}

// `meta={false}`: without the status and who asked - the Approvals drawer shows them in its own header
export function JobChangeDetails({ change, meta = true }: { change: JobChange; meta?: boolean }) {
  const s = change.salary
  const money = (amount: number | null | undefined, currency: string) => (amount == null ? '—' : formatMoney(amount, currency))
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-start gap-3 rounded-2xl bg-surface-2/60 p-3">
        <JobChangeKindTile kind={change.kind} className="size-10" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{change.kindLabel}</span>
            {meta && <JobChangeStatusPill status={change.status} label={change.statusLabel} />}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Applies from <span className="font-medium text-foreground tabular-nums">{formatDate(change.effectiveFrom)}</span>
            {meta && ` · asked by ${change.requestedBy?.name ?? 'System'}, ${formatDate(change.raisedAt)}`}
          </p>
        </div>
      </div>
      <blockquote className="border-l-2 border-gold pl-3">
        <p className="text-xs text-muted-foreground">Reason</p>
        <p className="break-words">{change.reason}</p>
      </blockquote>
      {change.applyError && (
        <p className="rounded-xl bg-warning/10 px-3 py-2 text-xs text-warning-ink">Approved, but not applied on its day: {change.applyError}. It is tried again each night.</p>
      )}
      {change.changes.length > 0 && (
        <section>
          <h4 className="mb-1 text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">What changes</h4>
          <ul className="divide-y divide-dashed divide-border/80 rounded-2xl border px-3">
            {change.changes.map((c) => (
              <li key={c.field} className="grid gap-x-3 gap-y-0.5 py-2 sm:grid-cols-[8rem_minmax(0,1fr)]">
                <span className="text-xs text-muted-foreground sm:pt-0.5">{c.label}</span>
                <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <span className="text-muted-foreground line-through decoration-border">{c.from ?? '—'}</span>
                  <ArrowRight aria-label="becomes" className="size-3.5 shrink-0 text-gold" />
                  <span className="rounded-md bg-gold-soft px-1.5 font-medium">{c.to ?? '—'}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {change.salaryHidden && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Lock className="size-3.5" /> It changes the salary too - the figures are seen only with the salary access.
        </p>
      )}
      {s && (
        <section className="space-y-2 rounded-2xl border p-3">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-xs text-muted-foreground">New fixed CTC / year</span>
            {s.replaced && <span className="text-muted-foreground line-through decoration-border tabular-nums">{money(s.replaced.annualCtc, s.replaced.currency)}</span>}
            {s.replaced && <ArrowRight aria-label="becomes" className="size-3.5 self-center text-gold" />}
            <span className="text-base font-semibold tabular-nums">{money(s.annualCtc, s.currency)}</span>
            {s.changePercent !== null && <Pill tone={s.changePercent >= 0 ? 'positive' : 'negative'}>{`${s.changePercent > 0 ? '+' : ''}${s.changePercent}%`}</Pill>}
          </div>
          <p className="text-xs text-muted-foreground">
            {s.replaced && <>The salary from {formatDate(s.replaced.effectiveFrom)} is replaced. </>}
            {s.performancePayAnnual != null && (
              <>
                Performance pay / year: <span className="text-foreground tabular-nums">{money(s.performancePayAnnual, s.currency)}</span>
              </>
            )}
          </p>
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-1 text-left font-medium">Monthly</th>
                <th className="py-1 text-right font-medium">{s.replaced ? 'Now' : ''}</th>
                <th className="py-1 text-right font-medium">New</th>
              </tr>
            </thead>
            <tbody>
              {s.lines.map((line) => {
                const before = s.replaced?.lines.find((l) => l.salaryComponent.id === line.salaryComponent.id)
                return (
                  <tr key={line.salaryComponent.id} className="border-t border-dashed">
                    <td className="py-1">{line.salaryComponent.name}</td>
                    <td className="py-1 text-right text-muted-foreground tabular-nums">{before ? money(before.monthlyAmount, s.currency) : ''}</td>
                    <td className={cn('py-1 text-right font-medium tabular-nums', before && (before.monthlyAmount < line.monthlyAmount ? 'text-positive-ink' : before.monthlyAmount > line.monthlyAmount && 'text-negative-ink'))}>
                      {money(line.monthlyAmount, s.currency)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      )}
      {change.status === 'CANCELLED' && change.cancelledAt && (
        <p className="text-xs text-muted-foreground">
          Cancelled by {change.cancelledBy?.name ?? 'System'}, {formatDate(change.cancelledAt)}
          {change.cancelReason && ` - ${change.cancelReason}`}
        </p>
      )}
      {change.appliedAt && <p className="text-xs text-muted-foreground">In force since {formatDate(change.appliedAt)}</p>}
    </div>
  )
}
