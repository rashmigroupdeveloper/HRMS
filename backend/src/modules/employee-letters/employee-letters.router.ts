import { accessAllProcedure, authedProcedure } from '#core/rpc/procedures'
import { employeeLetterIdInput, employeeLettersInput, letterTemplatesForInput, writeEmployeeLetterInput } from './employee-letters.schema.js'
import * as lettersService from './employee-letters.service.js'

// Routes + controller layer: auth, input validation -> service -> result. No business logic here.
// Issuing letters: "Employee · Directory & job" View + "Employee · Documents & letters" Edit.
const issue = () => accessAllProcedure(['EMPLOYEES', 'READ'], ['EMPLOYEE_DOCUMENTS', 'WRITE'])

export const employeeLettersRouter = {
  // The employee's letters - own: any logged-in employee; others: Employee · Documents & letters View (checked in the service)
  list: authedProcedure.input(employeeLettersInput).handler(({ input, context }) => lettersService.listLetters(context.user, input.employeeCode)),
  download: authedProcedure.input(employeeLetterIdInput).handler(({ input, context }) => lettersService.downloadLetter(context.user, input.id)),
  // The templates of a kind of letter to pick from (+ the suggested one)
  templates: issue().input(letterTemplatesForInput).handler(({ input, context }) => lettersService.templatesFor(context.user, input.employeeCode, input.kind)),
  // The letter as it would be issued now (PDF)
  preview: issue().input(writeEmployeeLetterInput).handler(({ input, context }) => lettersService.previewLetter(input, context.user)),
  // Issues it: numbered, kept, e-mailed to the employee
  issue: issue().input(writeEmployeeLetterInput).handler(({ input, context }) => lettersService.issueLetter(input, context.user)),
}
