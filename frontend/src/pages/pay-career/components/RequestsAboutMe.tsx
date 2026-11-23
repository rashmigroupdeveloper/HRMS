import { useQuery } from '@tanstack/react-query'
import { FileClock } from 'lucide-react'
import { useState } from 'react'
import { FormError } from '@/components/FormError'
import { JobChangeKindTile } from '@/components/JobChangeDetails'
import { JobChangeDrawer } from '@/components/JobChangeDrawer'
import { Chip, InfoCard } from '@/components/ProfileCards'
import { orpc } from '@/lib/orpc'
import { formatDate } from '@/lib/utils'
import { Standing, WhatChanges } from './ChangeList'

// On "Overview" (the user, 2026-11-21): the changes asked for the logged-in employee by someone who looks after
// them - waiting for approval, approved for a later day, rejected or cancelled, with the proposed salary inside (their own).
// Those in force are left out: the job timeline and the salary history show them. Hidden when there are none.
export function RequestsAboutMe() {
  const [open, setOpen] = useState<number | null>(null)
  const list = useQuery(orpc.jobChanges.list.queryOptions({ input: { mine: 'ABOUT_ME', statuses: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'], page: 1, pageSize: 20 } }))
  const items = list.data?.items ?? []
  if (!items.length && !list.error) return null
  return (
    <InfoCard icon={FileClock} title="Requests about me" aside={<Chip>{list.data?.total ?? 0}</Chip>}>
      <FormError error={list.error} />
      <ul className="divide-y divide-dashed divide-border/80">
        {items.map((c) => (
          <li key={c.id}>
            <button type="button" onClick={() => setOpen(c.id)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1.5 py-2 text-left">
              <span className="flex min-w-0 flex-1 items-center gap-2.5">
                <JobChangeKindTile kind={c.kind} />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">
                    {c.kindLabel} <span className="font-normal text-muted-foreground">· from {formatDate(c.effectiveFrom)}</span>
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    <WhatChanges c={c} />
                    {c.requestedBy && ` · asked by ${c.requestedBy.name}`}
                  </span>
                </span>
              </span>
              <Standing c={c} />
            </button>
          </li>
        ))}
      </ul>
      {open !== null && <JobChangeDrawer id={open} onClose={() => setOpen(null)} />}
    </InfoCard>
  )
}
