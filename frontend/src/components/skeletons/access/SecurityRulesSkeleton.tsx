import { ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

type Group = { title: string; rules: { label: string; unit: string; hint: string; min: number; max: number }[] }

// Loading placeholder for the security rules, drawn like the loaded card: the title, the groups and every rule's label,
// unit and hint are real text (they are fixed in the page - `groups`); only who changed them last and the numbers are
// bars. `canChange`: the Standard rules / Save rules buttons, disabled until the rules arrive.
export function SecurityRulesSkeleton({ groups, canChange = false, label = 'Loading' }: { groups: Group[]; canChange?: boolean; label?: string }) {
  return (
    <section role="status" aria-label={label} className="space-y-5 rounded-3xl bg-card p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-light tracking-tight">
            <ShieldCheck className="size-5" /> Security rules
          </h2>
          {/* who changed them last is data; the sentence after it is not */}
          <div className="text-xs text-muted-foreground">
            <Skeleton className="inline-block h-3 w-56 rounded-full align-middle" /> They apply from the next sign-in or password change.
          </div>
        </div>
        {canChange && (
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" disabled>
              Standard rules
            </Button>
            <Button variant="gold" disabled>
              Save rules
            </Button>
          </div>
        )}
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {groups.map((group) => (
          <fieldset key={group.title} className="space-y-3 rounded-2xl bg-surface-2/60 p-4">
            <legend className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">{group.title}</legend>
            {group.rules.map((rule) => (
              <div key={rule.label} className="space-y-1">
                <p className="pt-0.5 pb-1 text-[13px] leading-none font-medium">{rule.label}</p>
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-24 items-center rounded-xl border border-input px-2.5">
                    <Skeleton className="h-3.5 w-8 rounded-full" />
                  </span>
                  <span className="text-sm text-muted-foreground">{rule.unit}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {rule.hint} Between {rule.min} and {rule.max}.
                </p>
              </div>
            ))}
          </fieldset>
        ))}
      </div>
    </section>
  )
}
