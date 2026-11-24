import { SYSTEM_ACTOR } from '#core/db/prisma'
import { salaryComponentsService } from '#modules/organization'
import { describe, expect, it } from 'vitest'

// Deductions as salary components (the user, 2026-11-24): payroll takes them out of the monthly pay, so they are never a
// line of a salary breakup (offer / salary / revision - the agreed CTC), and a component cannot switch to or from being one.
const tag = Math.random().toString(36).slice(2, 8).toUpperCase()

describe('salary components: deductions', () => {
  it('seeds the payslip deductions', async () => {
    const deductions = (await salaryComponentsService.listSalaryComponents()).filter((c) => c.kind === 'DEDUCTION').map((c) => c.name)
    expect(deductions).toEqual(expect.arrayContaining(['Employee PF', 'Professional Tax', 'Canteen Recovery']))
  })

  it('refuses a deduction in a salary breakup, accepts earnings and employer contributions', async () => {
    const earning = await salaryComponentsService.createSalaryComponent({ name: `Test earning ${tag}`, kind: 'EARNING', displayOrder: 900 }, SYSTEM_ACTOR)
    const employer = await salaryComponentsService.createSalaryComponent({ name: `Test employer ${tag}`, kind: 'EMPLOYER_CONTRIBUTION', displayOrder: 901 }, SYSTEM_ACTOR)
    const deduction = await salaryComponentsService.createSalaryComponent({ name: `Test deduction ${tag}`, kind: 'DEDUCTION', displayOrder: 902 }, SYSTEM_ACTOR)

    await expect(
      salaryComponentsService.checkBreakup(
        [
          { salaryComponentId: earning.id, monthlyAmount: 9_000 },
          { salaryComponentId: employer.id, monthlyAmount: 1_000 },
        ],
        120_000,
      ),
    ).resolves.toBeUndefined()
    await expect(
      salaryComponentsService.checkBreakup(
        [
          { salaryComponentId: earning.id, monthlyAmount: 9_000 },
          { salaryComponentId: deduction.id, monthlyAmount: 1_000 },
        ],
        120_000,
      ),
    ).rejects.toThrow('A deduction is not part of a salary breakup')
  })

  it('does not let a component switch to or from being a deduction', async () => {
    const earning = await salaryComponentsService.createSalaryComponent({ name: `Switch earning ${tag}`, kind: 'EARNING', displayOrder: 910 }, SYSTEM_ACTOR)
    const deduction = await salaryComponentsService.createSalaryComponent({ name: `Switch deduction ${tag}`, kind: 'DEDUCTION', displayOrder: 911 }, SYSTEM_ACTOR)

    await expect(salaryComponentsService.updateSalaryComponent({ id: earning.id, kind: 'DEDUCTION' }, SYSTEM_ACTOR)).rejects.toThrow('cannot become')
    await expect(salaryComponentsService.updateSalaryComponent({ id: deduction.id, kind: 'EARNING' }, SYSTEM_ACTOR)).rejects.toThrow('cannot become')
    // earning <-> employer contribution, and other changes, still work
    await expect(salaryComponentsService.updateSalaryComponent({ id: earning.id, kind: 'EMPLOYER_CONTRIBUTION' }, SYSTEM_ACTOR)).resolves.toMatchObject({ kind: 'EMPLOYER_CONTRIBUTION' })
    await expect(salaryComponentsService.updateSalaryComponent({ id: deduction.id, displayOrder: 912 }, SYSTEM_ACTOR)).resolves.toMatchObject({ kind: 'DEDUCTION', displayOrder: 912 })
  })
})
