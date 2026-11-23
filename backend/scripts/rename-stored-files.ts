// Gives files stored before the readable names (2026-11-13) their readable name, and updates their keys:
//   candidates/<uuid>     -> candidates/<id>-<name>/<document type>/<date>_<random>.<ext>
//   employees' documents  -> employees/<employee code>/<document type>/<date>_<random>.<ext>
//   offer-letters/<uuid>  -> offer-letters/<company code>/<offer number>/rev-<n>/<date>_<random>.pdf
//   letterheads/<uuid>    -> letter-templates/<id>-<name>/<part>/<date>_<random>.<ext>
//
//   npm run rename-stored-files
//
// Safe to run again: files that already have a readable name are left alone. Each file is copied to its new name,
// its key saved, then the old file deleted - an interrupted run never loses a file.
import { SYSTEM_ACTOR } from '#core/db/prisma'
import { candidateDocumentsService, offerLettersService } from '#modules/candidates'
import { employeeDocumentsService } from '#modules/employees'
import { letterTemplatesService } from '#modules/letter-templates'

try {
  const results = {
    'candidate documents': await candidateDocumentsService.renameOldFiles(SYSTEM_ACTOR),
    'employee documents': await employeeDocumentsService.renameOldFiles(SYSTEM_ACTOR),
    'offer letters': await offerLettersService.renameOldFiles(SYSTEM_ACTOR),
    'letterhead images': await letterTemplatesService.renameOldFiles(SYSTEM_ACTOR),
  }
  for (const [what, count] of Object.entries(results)) console.log(`${what}: ${count} renamed`)
  process.exit(0)
} catch (error) {
  console.error(error)
  process.exit(1)
}
