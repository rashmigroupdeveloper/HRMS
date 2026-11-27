import { describe, expect, it } from 'vitest'
import { warningsOf, type CheckContext, type CheckPerson } from './checks.service.js'

// The warnings of a run (payroll stage 5, the user 2026-11-27) - made-up people and limits

const d = (text: string) => new Date(`${text}T00:00:00Z`)
const ctx: CheckContext = { periodTo: d('2095-03-25'), taxYearFrom: d('2094-04-01'), pfCeiling: 15000, epsAgeLimit: 58, bigChangePercent: 20, epsAgeSoonMonths: 2 }
// nothing to warn about: paid, a complete salary account, PAN, a PF member with UAN and Aadhaar, joined long ago
const ok: CheckPerson = {
  status: 'WORKED_OUT',
  net: 25000,
  previousNet: 24000,
  employmentType: 'PERMANENT',
  monthlyGross: 30000,
  inputs: [],
  allAbsent: false,
  dateOfBirth: d('2060-01-01'),
  dateOfJoining: d('2090-01-01'),
  dateOfLeaving: null,
  hasPan: true,
  hasAadhaar: true,
  salaryAccount: { complete: true },
  statutory: { pfApplicable: true, epsMember: true, uan: '100000000000', esicIpNumber: null },
  esicCovered: false,
  pfWages: 15000,
  hasTaxOpening: false,
}
const w = (patch: Partial<CheckPerson>) => warningsOf({ ...ok, ...patch }, ctx)

describe('the warnings of a person', () => {
  it('none when all is in order', () => {
    expect(w({})).toEqual([])
  })
  it("this month's payment", () => {
    // (nothing to pay after 24,000 last month is a big change too)
    expect(w({ net: 0 })).toEqual(['NET_ZERO', 'BIG_CHANGE'])
    expect(w({ salaryAccount: null })).toEqual(['NO_BANK_ACCOUNT'])
    expect(w({ salaryAccount: { complete: false } })).toEqual(['BANK_INCOMPLETE'])
    // 20% is the limit: 28,800 is exactly 20% above 24,000 - not more
    expect(w({ net: 28800 })).toEqual([])
    expect(w({ net: 28801 })).toEqual(['BIG_CHANGE'])
    expect(w({ net: 19000 })).toEqual(['BIG_CHANGE'])
    expect(w({ previousNet: null, net: 99999 })).toEqual([])
    expect(w({ dateOfLeaving: d('2095-03-25') })).toEqual(['LEAVING'])
    expect(w({ dateOfLeaving: d('2095-04-10') })).toEqual([])
    expect(w({ allAbsent: true })).toEqual(['ABSENT_THROUGHOUT'])
    expect(w({ inputs: [{ salaryComponentId: 9, amount: 500 }, { salaryComponentId: 9, amount: 500 }] })).toEqual(['DUPLICATE_INPUT'])
    expect(w({ inputs: [{ salaryComponentId: 9, amount: 30000.01 }] })).toEqual(['LARGE_INPUT'])
  })
  it('statutory, later months', () => {
    expect(w({ hasPan: false })).toEqual(['NO_PAN'])
    expect(w({ statutory: { ...ok.statutory!, uan: null }, hasAadhaar: false })).toEqual(['NO_UAN', 'NO_AADHAAR'])
    expect(w({ esicCovered: true })).toEqual(['NO_ESIC_NUMBER'])
    // not a PF member though the PF wages are within the ceiling - except consultants and apprentices
    const notMember = { statutory: { ...ok.statutory!, pfApplicable: false } }
    expect(w(notMember)).toEqual(['NO_PF_UNDER_CEILING'])
    expect(w({ ...notMember, pfWages: 15001 })).toEqual([])
    expect(w({ ...notMember, employmentType: 'APPRENTICE' })).toEqual([])
    expect(w({ dateOfJoining: d('2094-06-15') })).toEqual(['NO_TAX_OPENING'])
    expect(w({ dateOfJoining: d('2094-06-15'), hasTaxOpening: true })).toEqual([])
    // 58 on 1 May 2095: within 2 months of 25 March
    expect(w({ dateOfBirth: d('2037-05-01') })).toEqual(['EPS_AGE_SOON'])
    expect(w({ dateOfBirth: d('2037-06-01') })).toEqual([])
  })
})
