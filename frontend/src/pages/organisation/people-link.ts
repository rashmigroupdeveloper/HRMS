import { toDateInput } from '@/lib/utils'
import type { MovementHref, PeopleHref } from './components/OrganisationBoard'

type Place = { companyId: number; plantId: number | null; departmentId: number | null } | null

function placeParams(params: URLSearchParams, slice: Place, company: { id: number } | null) {
  const companyId = slice?.companyId ?? company?.id
  if (companyId) params.set('company', String(companyId))
  if (slice?.plantId) params.set('plant', String(slice.plantId))
  if (slice?.departmentId) params.set('department', String(slice.departmentId))
  return params
}

// The people behind an organisation board count, on Employee records: working now (active and on notice, as the board
// counts), in that company / plant / department, with that classification. The list keeps its own data access, so it
// shows only the people the active role's Employee directory View covers.
export function peopleLink(company: { id: number } | null): PeopleHref {
  return (slice, filter) => {
    const params = placeParams(new URLSearchParams({ view: 'records', status: 'WORKING' }), slice, company)
    if (filter) params.set(filter.param, filter.value)
    return `/manage/employees?${params}`
  }
}

// The joiners or leavers behind a count, on the joiners & leavers report: the board's period, that place.
export function movementLink(company: { id: number } | null, period: { from: Date; to: Date }): MovementHref {
  return (slice, kind) => {
    const params = new URLSearchParams({ view: 'movements', from: toDateInput(period.from), to: toDateInput(period.to), kind })
    return `/manage/employees?${placeParams(params, slice, company)}`
  }
}
