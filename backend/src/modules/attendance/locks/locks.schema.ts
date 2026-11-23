import { z } from 'zod'

// The attendance month lock (the user, 2026-11-22) and the month's start day.

export const yearInput = z.object({ year: z.number().int().min(2000).max(2100) })

// an attendance month ("November" with the 26th as start day = 26 Oct - 25 Nov)
export const monthLockInput = z.object({ year: z.number().int().min(2000).max(2100), month: z.number().int().min(1).max(12) })

export const unlockMonthInput = monthLockInput.extend({ reason: z.string().trim().min(3, 'Give the reason').max(500) })

// the day an attendance month starts: 1 = the calendar month; up to 28
export const cycleStartInput = z.object({ cycleStartDay: z.number().int().min(1).max(28) })
