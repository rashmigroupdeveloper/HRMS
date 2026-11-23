import { describe, expect, it } from 'vitest'
import { assertGroupWide, beyondGiver, hasLevelAt, levelAt, levelOver, type RoleGrant, scopeAllows, scopeOf, scopeWhere, type ScopeRow } from './scope.js'

// Companies 1 (RML) and 2 (RDL); plants 11, 12 of company 1 and 21 of company 2; departments 100 (Maintenance), 200 (HR)
const row = (companyId: number | null, plantId: number | null, departmentId: number | null, level: ScopeRow['level']): ScopeRow => ({
  companyId,
  plantId,
  departmentId,
  level,
})
const viewer = (...grants: RoleGrant[]) => ({ isSuperAdmin: false, grants })
const at = (companyId: number, plantId: number, departmentId: number | null) => ({ companyId, plantId, departmentId })

describe('levelAt', () => {
  it('is the lower of the role level and the row level', () => {
    const hr = viewer({ access: { EMPLOYEES: 'WRITE' }, rows: [row(1, null, null, 'READ')] })
    expect(levelAt(hr, 'EMPLOYEES', at(1, 11, 100))).toBe('READ')
    const clerk = viewer({ access: { EMPLOYEES: 'READ' }, rows: [row(1, null, null, 'WRITE')] })
    expect(levelAt(clerk, 'EMPLOYEES', at(1, 11, 100))).toBe('READ')
  })

  it('takes the best role - "HR for RML" and "Payroll for the whole group"', () => {
    const person = viewer(
      { access: { EMPLOYEES: 'WRITE', ONBOARDING: 'WRITE' }, rows: [row(1, null, null, 'WRITE')] },
      { access: { EMPLOYEES: 'READ', SALARY: 'READ' }, rows: [row(null, null, null, 'READ')] },
    )
    expect(levelAt(person, 'EMPLOYEES', at(1, 12, null))).toBe('WRITE')
    expect(levelAt(person, 'EMPLOYEES', at(2, 21, 100))).toBe('READ')
    expect(levelAt(person, 'SALARY', at(1, 11, 100))).toBe('READ')
    expect(levelAt(person, 'ONBOARDING', at(2, 21, 100))).toBeUndefined()
  })

  it('narrows by plant and department; no department is covered only by "every department"', () => {
    const p = viewer({ access: { ATTENDANCE: 'WRITE' }, rows: [row(1, 11, 100, 'WRITE'), row(null, null, 200, 'READ')] })
    expect(levelAt(p, 'ATTENDANCE', at(1, 11, 100))).toBe('WRITE')
    expect(levelAt(p, 'ATTENDANCE', at(1, 12, 100))).toBeUndefined()
    expect(levelAt(p, 'ATTENDANCE', at(2, 21, 200))).toBe('READ')
    expect(levelAt(p, 'ATTENDANCE', at(1, 11, null))).toBeUndefined()
  })

  it('gives nothing without rows or without the area; everything to a Super Admin', () => {
    expect(levelAt(viewer({ access: { EMPLOYEES: 'WRITE' }, rows: [] }), 'EMPLOYEES', at(1, 11, 100))).toBeUndefined()
    expect(levelAt(viewer({ access: {}, rows: [row(null, null, null, 'WRITE')] }), 'EMPLOYEES', at(1, 11, 100))).toBeUndefined()
    expect(levelAt({ isSuperAdmin: true, grants: [] }, 'SALARY', at(2, 21, null))).toBe('WRITE')
    expect(hasLevelAt(viewer({ access: { EMPLOYEES: 'READ' }, rows: [row(1, null, null, 'WRITE')] }), 'EMPLOYEES', at(1, 11, 100), 'WRITE')).toBe(false)
  })
})

describe('scopeOf / scopeWhere', () => {
  it('is everything for a row over the whole group, nothing without rows', () => {
    expect(scopeOf(viewer({ access: { EMPLOYEES: 'READ' }, rows: [row(null, null, null, 'READ')] }), 'EMPLOYEES').slices).toBe('ALL')
    const none = scopeOf(viewer({ access: { EMPLOYEES: 'READ' }, rows: [] }), 'EMPLOYEES')
    expect(scopeWhere(none)).toEqual({ id: { in: [] } })
    expect(scopeAllows(none, at(1, 11, 100))).toBe(false)
  })

  it('keeps only rows at the level asked for, and drops slices inside others', () => {
    const p = viewer(
      { access: { EMPLOYEES: 'WRITE' }, rows: [row(1, null, null, 'WRITE'), row(1, 11, 100, 'WRITE'), row(2, 21, null, 'READ')] },
      { access: { EMPLOYEES: 'READ' }, rows: [row(null, null, 200, 'WRITE')] },
    )
    expect(scopeWhere(scopeOf(p, 'EMPLOYEES', 'WRITE'))).toEqual({ OR: [{ companyId: 1 }] })
    expect(scopeWhere(scopeOf(p, 'EMPLOYEES', 'READ'))).toEqual({ OR: [{ companyId: 1 }, { companyId: 2, plantId: 21 }, { departmentId: 200 }] })
  })
})

describe('giving access and group-wide settings', () => {
  const rmlHr = viewer({ access: { EMPLOYEES: 'WRITE', ACCESS: 'WRITE' }, rows: [row(1, null, null, 'WRITE')] })

  it('allows giving only inside the giver\'s own slices and levels', () => {
    expect(beyondGiver(rmlHr, { EMPLOYEES: 'WRITE' }, [row(1, 11, null, 'WRITE')])).toEqual([])
    expect(beyondGiver(rmlHr, { EMPLOYEES: 'WRITE' }, [row(2, null, null, 'READ')])).toEqual(['EMPLOYEES'])
    expect(beyondGiver(rmlHr, { EMPLOYEES: 'READ' }, [row(null, null, null, 'READ')])).toEqual(['EMPLOYEES'])
    expect(beyondGiver(rmlHr, { SALARY: 'READ' }, [row(1, null, null, 'READ')])).toEqual(['SALARY'])
  })

  it('needs Edit over the whole group for shared settings', () => {
    expect(levelOver(rmlHr, 'ACCESS', { companyId: 1, plantId: null, departmentId: null })).toBe('WRITE')
    expect(() => assertGroupWide(rmlHr, 'ACCESS', 'A role')).toThrow('shared by every company')
    expect(() => assertGroupWide(viewer({ access: { ACCESS: 'WRITE' }, rows: [row(null, null, null, 'WRITE')] }), 'ACCESS', 'A role')).not.toThrow()
  })
})
