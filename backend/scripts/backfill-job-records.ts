// Gives every employee added before the job timeline existed (2026-11-19) its first entry: the details they have now,
// from their date of joining. Safe to run again - employees who already have an entry are left as they are.
//
//   npm run backfill-job-records -w backend
import { employeesService } from '#modules/employees'

try {
  const count = await employeesService.backfillJobRecords()
  console.log(`${count} employee${count === 1 ? '' : 's'} given a first job-timeline entry`)
  process.exit(0)
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
