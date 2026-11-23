import { z } from 'zod'
import { employeeCodeSchema } from '../employees.schema.js'

export const listJobHistoryInput = z.object({ employeeCode: employeeCodeSchema })

// The job details in force on a day (2026-11-20)
export const jobAsOfInput = z.object({ employeeCode: employeeCodeSchema, date: z.date() })
