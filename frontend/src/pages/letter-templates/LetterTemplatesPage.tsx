import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus } from 'lucide-react'
import { Link } from 'react-router'
import { FormError } from '@/components/FormError'
import { SharedListNote } from '@/components/SharedListNote'
import { Pill } from '@/components/Pill'
import { Button } from '@/components/ui/button'
import { useAccess } from '@/hooks/useAccess'
import { orpc } from '@/lib/orpc'
import { formatDoneBy } from '@/lib/utils'
import { JOINING_TYPE, KIND, KIND_HINT, KIND_ORDER } from './components/labels'

// The wording of the letters the system writes, by kind: to candidates (Letter of Intent, offer letter) and to employees
// (appointment, confirmation, experience, relieving - 2026-11-16). Letter templates: View to read, Edit to change.
// A letter uses the active template of its joining type, else the one for every joining type. Each template opens on
// its own page (LetterTemplatePage).

export function LetterTemplatesPage() {
  const queryClient = useQueryClient()
  // templates are shared by every company: Edit for all companies (B13)
  const canChange = useAccess().coversGroup('LETTER_TEMPLATES')
  const templates = useQuery(orpc.letterTemplates.list.queryOptions())
  const toggle = useMutation(
    orpc.letterTemplates.update.mutationOptions({ onSuccess: () => void queryClient.invalidateQueries({ queryKey: orpc.letterTemplates.key() }) }),
  )

  // kinds that have a template first (in their usual order), the ones still to be written after them
  const kinds = [...KIND_ORDER].sort(
    (a, b) => Number(!templates.data?.some((t) => t.kind === a)) - Number(!templates.data?.some((t) => t.kind === b)),
  )

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-muted-foreground">Administration</p>
        <h1 className="mt-1 text-3xl font-light tracking-tight sm:text-4xl">Letter templates</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground max-sm:hidden">
          The wording of the letters to candidates and employees, filled in with the person's details on the company's letterhead. Changes
          apply to letters written from now on - letters already sent never change.
        </p>
      </div>

      <SharedListNote area="LETTER_TEMPLATES" label="Letter templates" />
      {templates.error && <FormError error={templates.error} />}
      <FormError error={toggle.error} />

      {templates.data && (
        <div className="grid items-start gap-x-6 gap-y-5 lg:grid-cols-2">
          {kinds.map((kind) => {
            const ofKind = templates.data.filter((t) => t.kind === kind)
            return (
              <section key={kind} className="space-y-2">
                <div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h2 className="text-lg font-light tracking-tight">{KIND[kind]}</h2>
                    {canChange && ofKind.length > 0 && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="max-sm:h-9"
                        aria-label={`New ${KIND[kind].toLowerCase()} template`}
                        nativeButton={false}
                        render={<Link to={`/letter-templates/new?kind=${kind}`} />}
                      >
                        <Plus /> New template
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{KIND_HINT[kind]}</p>
                </div>
                {ofKind.length === 0 && (
                  // nothing yet: one line, with the way to make one
                  <div className="u-hatch flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-2xl px-4 py-2">
                    <p className="text-sm">
                      <span className="font-medium">No template yet</span>
                      <span className="text-muted-foreground"> - this letter cannot be written until one is made.</span>
                    </p>
                    {canChange && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="bg-card max-sm:h-9"
                        aria-label={`New ${KIND[kind].toLowerCase()} template`}
                        nativeButton={false}
                        render={<Link to={`/letter-templates/new?kind=${kind}`} />}
                      >
                        <Plus /> New template
                      </Button>
                    )}
                  </div>
                )}
                {ofKind.map((t) => (
                  <article key={t.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl bg-card px-4 py-3 shadow-card">
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <h3 className="text-base font-medium">{t.name}</h3>
                        <Pill tone={t.isActive ? 'positive' : 'neutral'} className="py-0.5">{t.isActive ? 'Active' : 'Retired'}</Pill>
                        <Pill tone={t.ready ? 'positive' : 'warning'} className="py-0.5">{t.ready ? 'Letterhead ready' : 'Letterhead missing'}</Pill>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t.joiningType ? `Suggested for ${JOINING_TYPE[t.joiningType]}` : 'For any joining type'} · Last changed {formatDoneBy(t.updatedAt, t.updatedBy)}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button variant="secondary" size="sm" className="max-sm:h-9" nativeButton={false} render={<Link to={`/letter-templates/${t.id}`} />}>
                        <Pencil /> {canChange ? 'Edit' : 'View'}
                      </Button>
                      {canChange && (
                        <Button variant="ghost" size="sm" className="max-sm:h-9" disabled={toggle.isPending} onClick={() => toggle.mutate({ id: t.id, isActive: !t.isActive })}>
                          {t.isActive ? 'Retire' : 'Re-activate'}
                        </Button>
                      )}
                    </div>
                  </article>
                ))}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
