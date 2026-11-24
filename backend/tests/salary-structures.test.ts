import { SYSTEM_ACTOR } from '#core/db/prisma'
import { salaryComponentsService, salaryStructuresService } from '#modules/organization'
import { describe, expect, it } from 'vitest'

// Salary structures (the user, 2026-11-24 - HR's "CTC Structure" sheet): the offer's breakup worked out from its CTC.
// The seeded structures: Regular - White / Blue collar, Trainee. Amounts worked out by hand from HR's formulas (Basic
// = CTC / 2.1681, or / 2.2331 with ESIC; HRA 50% and bonus 8.33% of Basic; PF 12%, gratuity 4.81% of Basic; ESIC 3.25% of
// the gross while it is at most 21,000), each line rounded to the paisa, the balance what is left.
const tag = Math.random().toString(36).slice(2, 8).toUpperCase()
const regular = (workforceCategory: 'WHITE_COLLAR' | 'BLUE_COLLAR', employmentType: 'PERMANENT' | 'CONTRACT' = 'PERMANENT') =>
  ({ joiningType: 'REGULAR', employmentType, workforceCategory }) as const

async function breakup(input: Parameters<typeof salaryStructuresService.calculateBreakup>[0]) {
  const result = await salaryStructuresService.calculateBreakup(input)
  const names = new Map((await salaryComponentsService.listSalaryComponents()).map((c) => [c.id, c.name]))
  return { ...result, byName: Object.fromEntries(result.lines.map((l) => [names.get(l.salaryComponentId), l.monthlyAmount])) }
}
const componentId = async (name: string) => (await salaryComponentsService.listSalaryComponents()).find((c) => c.name === name)!.id

describe('salary structures: the breakup from the CTC', () => {
  it('works out a white-collar offer by HR\'s formulas - no ESIC above 21,000 gross (the sheet charges it there: its slip)', async () => {
    const r = await breakup({ annualCtc: 300_000, ...regular('WHITE_COLLAR') })
    expect(r.structure?.name).toBe('Regular - White collar')
    expect(r.byName).toEqual({
      Basic: 11_530.83,
      HRA: 5_765.42,
      'Education Allowance': 200,
      Medical: 1_250,
      'Special Allowance': 3_354.9,
      Bonus: 960.52,
      'Employer Contribution to PF': 1_383.7,
      'Employer Contribution to Gratuity': 554.63,
    })
    // the lines pass the offer's own check
    await expect(salaryComponentsService.checkBreakup(r.lines, 300_000)).resolves.toBeUndefined()
  })

  it('adds ESIC (3.25% of the gross) while the gross is at most 21,000, and the bonus never on less than 7,000', async () => {
    const r = await breakup({ annualCtc: 180_000, ...regular('WHITE_COLLAR') })
    // Basic = 15,000 / 2.2331, as HR's formula
    expect(r.byName).toMatchObject({ Basic: 6_717.12, HRA: 3_358.56, Bonus: 583.1, 'Employer Contribution to ESI': 436.61, 'Employer Contribution to PF': 806.05, 'Employer Contribution to Gratuity': 323.09, 'Special Allowance': 1_325.47 })
    // the switch: a gross just under 21,000 keeps ESIC, just over drops it
    expect((await breakup({ annualCtc: 23_447 * 12, ...regular('WHITE_COLLAR') })).byName['Employer Contribution to ESI']).toBeGreaterThan(0)
    expect((await breakup({ annualCtc: 23_449 * 12, ...regular('WHITE_COLLAR') })).byName['Employer Contribution to ESI']).toBeUndefined()
  })

  it('keeps a CTC that does not divide by 12 to the paisa', async () => {
    const r = await breakup({ annualCtc: 584_000, ...regular('WHITE_COLLAR') })
    expect(r.monthlyCtc).toBe(48_666.67)
    expect(r.byName).toMatchObject({ Basic: 22_446.69, HRA: 11_223.35, Bonus: 1_869.81, 'Employer Contribution to PF': 2_693.6, 'Employer Contribution to Gratuity': 1_079.69, 'Special Allowance': 7_903.53 })
    await expect(salaryComponentsService.checkBreakup(r.lines, 584_000)).resolves.toBeUndefined()
  })

  it('blue collar has no education or medical allowance; a trainee gets the whole CTC as stipend', async () => {
    const blue = await breakup({ annualCtc: 300_000, ...regular('BLUE_COLLAR', 'CONTRACT') })
    expect(blue.structure?.name).toBe('Regular - Blue collar')
    expect(blue.byName['Medical']).toBeUndefined()
    expect(blue.byName['Special Allowance']).toBe(4_804.9)
    const trainee = await breakup({ annualCtc: 216_000, joiningType: 'CONSULTANT_INTERN', employmentType: 'TRAINEE', workforceCategory: 'WHITE_COLLAR' })
    expect(trainee.structure?.name).toBe('Trainee')
    expect(trainee.byName).toEqual({ Stipend: 18_000 })
  })

  it('gives consultants, apprentices and overseas offers no structure until HR defines one', async () => {
    for (const offer of [
      { joiningType: 'CONSULTANT_INTERN', employmentType: 'CONSULTANT', workforceCategory: 'WHITE_COLLAR' },
      { joiningType: 'CONSULTANT_INTERN', employmentType: 'APPRENTICE', workforceCategory: 'BLUE_COLLAR' },
      { joiningType: 'OVERSEAS', employmentType: 'PERMANENT', workforceCategory: 'WHITE_COLLAR' },
    ] as const) {
      const r = await salaryStructuresService.calculateBreakup({ annualCtc: 600_000, ...offer })
      expect([offer.employmentType, r.structure, r.lines]).toEqual([offer.employmentType, null, []])
    }
  })

  it('picks the closest structure: the employment type over the joining type over the category', () => {
    const s = (name: string, m: Partial<{ joiningType: 'REGULAR'; employmentType: 'TRAINEE'; workforceCategory: 'WHITE_COLLAR' }>) => ({
      name,
      joiningType: m.joiningType ?? null,
      employmentType: m.employmentType ?? null,
      workforceCategory: m.workforceCategory ?? null,
    })
    const all = [s('White', { workforceCategory: 'WHITE_COLLAR' }), s('Regular', { joiningType: 'REGULAR' }), s('Trainee', { employmentType: 'TRAINEE' })]
    const pick = (offer: Parameters<typeof salaryStructuresService.pickStructure>[1]) => salaryStructuresService.pickStructure(all, offer)?.name
    expect(pick({ joiningType: 'REGULAR', employmentType: 'TRAINEE', workforceCategory: 'WHITE_COLLAR' })).toBe('Trainee')
    expect(pick({ joiningType: 'REGULAR', employmentType: 'PERMANENT', workforceCategory: 'WHITE_COLLAR' })).toBe('Regular')
    expect(pick({ joiningType: 'OVERSEAS', employmentType: 'PERMANENT', workforceCategory: 'WHITE_COLLAR' })).toBe('White')
  })

  it('refuses a CTC too low for the structure, and a structure breaking the rules', async () => {
    const [basic, special, medical, canteen] = (await Promise.all(['Basic', 'Special Allowance', 'Medical', 'Canteen Recovery'].map(componentId))) as [number, number, number, number]
    const draft = (lines: { salaryComponentId: number; method: 'FIXED' | 'BALANCE' | 'PERCENT_OF_BASIC' | 'PERCENT_OF_GROSS'; value?: number | null }[], basicComponentId: number | null = null) =>
      salaryStructuresService.calculateBreakup({ annualCtc: 120_000, draft: { basicComponentId, lines } })
    await expect(draft([{ salaryComponentId: medical, method: 'FIXED', value: 30_000 }, { salaryComponentId: special, method: 'BALANCE' }])).rejects.toThrow('too low')
    await expect(draft([{ salaryComponentId: canteen, method: 'FIXED', value: 100 }, { salaryComponentId: special, method: 'BALANCE' }])).rejects.toThrow('is a deduction')
    await expect(draft([{ salaryComponentId: medical, method: 'BALANCE' }, { salaryComponentId: special, method: 'BALANCE' }])).rejects.toThrow('exactly one balance')
    await expect(draft([{ salaryComponentId: medical, method: 'PERCENT_OF_BASIC', value: 10 }, { salaryComponentId: special, method: 'BALANCE' }])).rejects.toThrow('which line is the Basic')
    await expect(draft([{ salaryComponentId: basic, method: 'PERCENT_OF_GROSS', value: 120 }, { salaryComponentId: special, method: 'BALANCE' }], basic)).rejects.toThrow('at most 100')
    // a valid draft: the live example of the Organization page
    const ok = await draft([{ salaryComponentId: basic, method: 'PERCENT_OF_GROSS', value: 50 }, { salaryComponentId: medical, method: 'PERCENT_OF_BASIC', value: 10 }, { salaryComponentId: special, method: 'BALANCE' }], basic)
    expect(ok.lines.map((l) => l.monthlyAmount)).toEqual([5_000, 500, 4_500])
  })

  it('saves a structure, never two active ones for the same offers, and changes its lines', async () => {
    const stipend = await componentId('Stipend')
    const match = { joiningType: 'OVERSEAS', employmentType: 'APPRENTICE', workforceCategory: 'BLUE_COLLAR' } as const
    // a run that stopped half-way may have left one active - retire it first (the test database is never wiped)
    for (const old of (await salaryStructuresService.listSalaryStructures()).filter((s) => s.joiningType === 'OVERSEAS' && s.employmentType === 'APPRENTICE')) {
      await salaryStructuresService.updateSalaryStructure({ id: old.id, isActive: false }, SYSTEM_ACTOR)
    }
    const created = await salaryStructuresService.createSalaryStructure({ name: `Test structure ${tag}`, ...match, lines: [{ salaryComponentId: stipend, method: 'BALANCE' }] }, SYSTEM_ACTOR)
    try {
      expect(created.lines).toEqual([expect.objectContaining({ method: 'BALANCE', value: null })])
      await expect(
        salaryStructuresService.createSalaryStructure({ name: `Test structure twin ${tag}`, ...match, lines: [{ salaryComponentId: stipend, method: 'BALANCE' }] }, SYSTEM_ACTOR),
      ).rejects.toThrow('already for these offers')
      const medical = await componentId('Medical')
      const changed = await salaryStructuresService.updateSalaryStructure(
        { id: created.id, lines: [{ salaryComponentId: medical, method: 'FIXED', value: 1_250.5 }, { salaryComponentId: stipend, method: 'BALANCE' }] },
        SYSTEM_ACTOR,
      )
      expect(changed.lines.map((l) => [l.method, l.value])).toEqual(expect.arrayContaining([['FIXED', 1_250.5], ['BALANCE', null]]))
      const r = await salaryStructuresService.calculateBreakup({ annualCtc: 120_000, ...match })
      expect(r.lines.map((l) => l.monthlyAmount)).toEqual(expect.arrayContaining([1_250.5, 8_749.5]))
      // a component of the structure retired later: calculating says so (the offer could not save that line)
      const extra = await salaryComponentsService.createSalaryComponent({ name: `Test allowance ${tag}`, kind: 'EARNING', displayOrder: 920 }, SYSTEM_ACTOR)
      await salaryStructuresService.updateSalaryStructure({ id: created.id, lines: [{ salaryComponentId: extra.id, method: 'FIXED', value: 100 }, { salaryComponentId: stipend, method: 'BALANCE' }] }, SYSTEM_ACTOR)
      await salaryComponentsService.updateSalaryComponent({ id: extra.id, isActive: false }, SYSTEM_ACTOR)
      await expect(salaryStructuresService.calculateBreakup({ annualCtc: 120_000, ...match })).rejects.toThrow('which is retired')
    } finally {
      await salaryStructuresService.updateSalaryStructure({ id: created.id, isActive: false }, SYSTEM_ACTOR)
    }
  })
})
