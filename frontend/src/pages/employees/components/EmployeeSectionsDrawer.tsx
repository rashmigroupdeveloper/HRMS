import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { FormDrawer } from '@/components/FormDrawer'
import { JoiningFormSections, type JoiningFormSection } from '@/components/JoiningFormSections'
import { SectionRowsSkeleton } from '@/components/skeletons/employees/SectionRowsSkeleton'
import { type client, orpc } from '@/lib/orpc'
import { errorMessage } from '@/lib/utils'

// HR edits an employee's records after joining (phase 5, 2026-11-16 - canonical profile edits remain with HR; employees submit documents separately and ask HR
// outside the system). The same section forms and rules as the joining form; saved numbers show as their last 4
// digits and may be left empty to keep them. Each section saves on its own and goes into the change history.

type SaveInput = Parameters<typeof client.employees.form.save>[0]

export function EmployeeSectionsDrawer({
  employeeCode,
  name,
  title,
  sections,
  onClose,
}: {
  employeeCode: string
  name: string
  title: string
  sections: JoiningFormSection[]
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const formQuery = orpc.employees.form.get.queryOptions({ input: { employeeCode } })
  const form = useQuery(formQuery)
  const [saving, setSaving] = useState<JoiningFormSection | null>(null)
  const [saved, setSaved] = useState<JoiningFormSection | null>(null)
  // the sections whose form is open - closing the drawer then asks "Discard your changes?"
  const [open, setOpen] = useState<JoiningFormSection[]>([])
  const save = useMutation(
    orpc.employees.form.save.mutationOptions({
      onSuccess: (data) => {
        queryClient.setQueryData(formQuery.queryKey, data)
        // the profile shows the new values
        void queryClient.invalidateQueries({ queryKey: orpc.employees.getByCode.key() })
      },
    }),
  )

  return (
    <FormDrawer onClose={onClose} dirty={open.length > 0} width={880} title={`${title} - ${name}`} description="Each part saves on its own. Numbers show only their last 4 digits - leave one empty to keep it.">
      {form.isPending ? (
        <SectionRowsSkeleton sections={sections} label="Loading the records" />
      ) : form.error ? (
        <p className="text-sm text-negative-ink">{errorMessage(form.error)}</p>
      ) : (
        <JoiningFormSections
          form={form.data.form as Record<string, unknown>}
          sections={sections}
          masked
          forCandidate={false}
          allowNoFamily={false}
          pack={form.data.joiningType}
          disabled={save.isPending}
          state={(section) => ({ pending: save.isPending && saving === section, error: saving === section ? save.error : null, saved: saved === section && !save.isPending })}
          onEditingChange={(section, editing) => setOpen((now) => (editing ? [...now.filter((s) => s !== section), section] : now.filter((s) => s !== section)))}
          onSave={(section, value, done) => {
            setSaving(section)
            setSaved(null)
            save.mutate({ employeeCode, [section]: value } as SaveInput, {
              onSuccess: () => {
                setSaved(section)
                done()
              },
            })
          }}
        />
      )}
    </FormDrawer>
  )
}
