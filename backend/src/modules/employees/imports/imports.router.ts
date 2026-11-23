import { accessProcedure } from '#core/rpc/procedures'
import { importIdInput, uploadImportInput } from './imports.schema.js'
import * as importsService from './imports.service.js'

// Routes + controller layer: auth, input validation -> service -> result. No business logic here.
export const employeeImportsRouter = {
  // The Excel template to fill in, with dropdowns of the current masters.
  template: accessProcedure('EMPLOYEES', 'WRITE').handler(() => importsService.importTemplate()),
  // Checks a filled-in template row by row; with save: true, also saves it (all rows or none).
  upload: accessProcedure('EMPLOYEES', 'WRITE')
    .input(uploadImportInput)
    .handler(({ input, context }) => importsService.uploadImport(input, context.user)),
  // The files imported, and the ones with errors (newest first)
  history: accessProcedure('EMPLOYEES', 'WRITE').handler(() => importsService.listImports()),
  // A file's wrong rows as an Excel file
  errorReport: accessProcedure('EMPLOYEES', 'WRITE')
    .input(importIdInput)
    .handler(({ input }) => importsService.errorReport(input.id)),
}
