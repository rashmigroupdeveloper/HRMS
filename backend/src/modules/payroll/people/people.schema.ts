import { z } from 'zod'

const id = z.number().int().positive()

// What the people list can be narrowed to (payroll stage 2; stage 3: unpaid days, days to look at, absent throughout,
// pay not worked out; stage 4: no PF)
export const PEOPLE_FLAGS = ['NO_SALARY', 'CHANGED', 'HAS_INPUTS', 'NOT_IN_PERIOD', 'UNPAID_DAYS', 'UNCLEAR_DAYS', 'ALL_ABSENT', 'PAY_NOT_WORKED_OUT', 'NO_PF'] as const

export const peopleListInput = z
  .object({
    runId: id,
    // employee code or name, any part
    search: z.string().trim().max(100).optional(),
    flag: z.enum(PEOPLE_FLAGS).optional(),
    page: z.number().int().min(1).max(100000).default(1),
    pageSize: z.number().int().min(1).max(200).default(50),
  })
  .strict()

export const personInput = z.object({ runId: id, personId: id }).strict()

// The screen sends back the refresh time it showed (null = never refreshed), so a stale screen cannot rebuild over a
// newer copy
export const refreshInput = z.object({ runId: id, expectedRefreshedAt: z.date().nullable() }).strict()

export type PeopleListInput = z.infer<typeof peopleListInput>
