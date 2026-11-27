import { z } from 'zod'

// Payroll stage 6 (approved by the user 2026-11-27): payslips of a final run

const id = z.number().int().positive()

// One person's payslip in a run (their id in the run)
export const payslipInput = z.object({ runId: id, personId: id }).strict()

// A payslip as it would be made with this template - not stored
export const previewInput = z.object({ runId: id, personId: id, templateId: id }).strict()

// Releases a final run's payslips, made with this payslip template
export const releaseInput = z.object({ runId: id, templateId: id }).strict()

// One of one's own payslips
export const myPayslipInput = z.object({ id }).strict()

export type PayslipInput = z.infer<typeof payslipInput>
export type PreviewInput = z.infer<typeof previewInput>
export type ReleaseInput = z.infer<typeof releaseInput>
