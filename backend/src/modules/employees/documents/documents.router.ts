import { accessAllProcedure, authedProcedure } from '#core/rpc/procedures'
import {
  deleteEmployeeDocumentInput,
  employeeDocumentIdInput,
  listEmployeeDocumentsInput,
  reviewEmployeeDocumentInput,
  uploadEmployeeDocumentInput,
} from './documents.schema.js'
import * as documentsService from './documents.service.js'

// employees.documents.* - routes + controller layer. Own documents: any logged-in employee; anyone else's: "Employee
// directory & job" + "Employee · Documents & letters" View (checked in the service, since it depends on whose document it is).
// Changing them: "Employee · Documents & letters" Edit.
const manage = () => accessAllProcedure(['EMPLOYEES', 'READ'], ['EMPLOYEE_DOCUMENTS', 'WRITE'])
export const employeeDocumentsRouter = {
  list: authedProcedure
    .input(listEmployeeDocumentsInput)
    .handler(({ input, context }) => documentsService.listDocuments(context.user, input.employeeCode)),
  download: authedProcedure
    .input(employeeDocumentIdInput)
    .handler(({ input, context }) => documentsService.downloadDocument(context.user, input.id)),
  // Own uploads are pending submissions; other people require the existing scoped document-management access.
  upload: authedProcedure
    .input(uploadEmployeeDocumentInput)
    .handler(({ input, context }) => documentsService.uploadDocument(input, context.user)),
  review: manage()
    .input(reviewEmployeeDocumentInput)
    .handler(({ input, context }) => documentsService.reviewDocument(input, context.user)),
  delete: manage()
    .input(deleteEmployeeDocumentInput)
    .handler(({ input, context }) => documentsService.deleteDocument(input, context.user)),
  restore: manage()
    .input(employeeDocumentIdInput)
    .handler(({ input, context }) => documentsService.restoreDocument(input.id, context.user)),
}
