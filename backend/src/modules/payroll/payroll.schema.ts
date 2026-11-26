import { z } from 'zod'

const id = z.number().int().positive()
export const month = z.date().refine(d => d.getUTCFullYear() >= 2000 && d.getUTCFullYear() <= 2100 && d.getUTCDate() === 1 && d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0, 'Choose a calendar month from 2000 to 2100')
export const setupInput = z.object({ payMonth: month }).strict()
export const listInput = z.object({ year: z.number().int().min(2000).max(2100), companyId: id.optional(), page: z.number().int().min(1).max(100000).default(1), pageSize: z.number().int().min(1).max(100).default(25) }).strict()
export const getInput = z.object({ id }).strict()
export const createInput = z.object({ companyId: id, payMonth: month, expectedAttendanceFrom: z.date(), expectedAttendanceTo: z.date() }).strict()
export type ListInput = z.infer<typeof listInput>
export type CreateInput = z.infer<typeof createInput>
