import type { client } from '@/lib/orpc'

// Facts worked out from a company row (the Companies tab's list, filters and detail)

export type Company = Awaited<ReturnType<typeof client.organization.companies.list>>[number]

// What a company still misses: the employer details (printed on EPF Form 11, ESIC Form 1 and Gratuity Form F) and the next employee number (no employee can be
// added without it - 2026-11-16)
export function missingOf(c: Company) {
  return {
    address: !c.address,
    region: !c.region,
    postalCode: c.countryCode === 'IN' && !c.postalCode,
    pfEstablishmentCode: c.isIndiaPayroll && !c.pfEstablishmentCode,
    esicEmployerCode: c.isIndiaPayroll && !c.esicEmployerCode,
    nextEmployeeNumber: c.nextEmployeeNumber === null,
  }
}
export const lacksEmployerDetails = (c: Company) => {
  const m = missingOf(c)
  return m.address || m.region || m.postalCode || m.pfEstablishmentCode || m.esicEmployerCode
}
export const nextCodeOf = (c: Company) => (c.nextEmployeeNumber === null ? null : c.ecodePrefix + String(c.nextEmployeeNumber).padStart(6, '0'))
