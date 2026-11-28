import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import { FormError } from '@/components/FormError'
import { OrganisationBoardSkeleton } from '@/components/skeletons/organisation/OrganisationBoardSkeleton'
import { useAccess } from '@/hooks/useAccess'
import { client, orpc } from '@/lib/orpc'
import { OrganisationBoard } from './components/OrganisationBoard'
import { BOARD_TITLE } from './labels'
import { breakdownsFor } from './labels'
import { movementLink, peopleLink } from './people-link'

// The role portal's organisation board: companies this role covers, and one company's departments. Counts open the
// people on Employee records (with that access); the board exports to Excel.
export function OrganisationDashboardPage() {
  const { can } = useAccess()
  const [params, setParams] = useSearchParams()
  const raw = Number(params.get('company'))
  const companyId = Number.isInteger(raw) && raw > 0 ? raw : undefined
  const board = useQuery(orpc.employees.organisationBoard.queryOptions({ input: { companyId } }))
  const data = board.data
  return (
    <div className="space-y-4">
      <FormError error={board.error} />
      {board.isPending || !data ? (
        <OrganisationBoardSkeleton kind={companyId ? 'drill' : 'companies'} heading="h1" people={can('EMPLOYEES')} exports breakdowns={breakdownsFor(can('EMPLOYEE_PERSONAL_DETAILS'))} />
      ) : data.level === 'NONE' ? (
        <section className="space-y-4">
          <h1 className="text-[26px] leading-tight font-light tracking-tight sm:text-[30px]">{BOARD_TITLE}</h1>
          <p className="rounded-3xl bg-card px-5 py-8 text-sm text-muted-foreground shadow-card sm:px-6">This role does not cover a company or a department, and you head none.</p>
        </section>
      ) : (
        <OrganisationBoard
          heading="h1"
          board={data}
          companyHref={data.level === 'COMPANY' ? (id) => `/manage/organisation-dashboard?company=${id}` : undefined}
          peopleHref={can('EMPLOYEES') ? peopleLink(data.company) : undefined}
          movementHref={can('EMPLOYEES') ? movementLink(data.company, data.period) : undefined}
          onExport={() => client.employees.exportOrganisationBoard({ companyId })}
          onBack={data.company ? () => setParams({}) : undefined}
        />
      )}
    </div>
  )
}
