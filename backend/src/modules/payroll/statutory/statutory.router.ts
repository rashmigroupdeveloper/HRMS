import { accessProcedure } from '#core/rpc/procedures'
import * as statutoryService from './statutory.service.js'
import { deleteLwfInput, deletePtSlabsInput, deleteRateInput, deleteTaxSlabsInput, saveLwfInput, savePtSlabsInput, saveRateInput, saveSettingsInput, saveTaxSlabsInput } from './statutory.schema.js'

// The statutory settings (payroll stage 4): dated rates, professional-tax and income-tax slabs, labour welfare fund.
// One list for the group: Payroll View reads it; a change needs Payroll Edit for every company (checked in the service).
export const statutoryRouter = {
  list: accessProcedure('PAYROLL', 'READ').handler(({ context }) => statutoryService.listSettings(context.user)),
  saveRate: accessProcedure('PAYROLL', 'WRITE').input(saveRateInput).handler(({ context, input }) => statutoryService.saveRate(context.user, input)),
  deleteRate: accessProcedure('PAYROLL', 'WRITE').input(deleteRateInput).handler(({ context, input }) => statutoryService.deleteRate(context.user, input)),
  savePtSlabs: accessProcedure('PAYROLL', 'WRITE').input(savePtSlabsInput).handler(({ context, input }) => statutoryService.savePtSlabs(context.user, input)),
  deletePtSlabs: accessProcedure('PAYROLL', 'WRITE').input(deletePtSlabsInput).handler(({ context, input }) => statutoryService.deletePtSlabs(context.user, input)),
  saveLwf: accessProcedure('PAYROLL', 'WRITE').input(saveLwfInput).handler(({ context, input }) => statutoryService.saveLwf(context.user, input)),
  deleteLwf: accessProcedure('PAYROLL', 'WRITE').input(deleteLwfInput).handler(({ context, input }) => statutoryService.deleteLwf(context.user, input)),
  saveTaxSlabs: accessProcedure('PAYROLL', 'WRITE').input(saveTaxSlabsInput).handler(({ context, input }) => statutoryService.saveTaxSlabs(context.user, input)),
  deleteTaxSlabs: accessProcedure('PAYROLL', 'WRITE').input(deleteTaxSlabsInput).handler(({ context, input }) => statutoryService.deleteTaxSlabs(context.user, input)),
  // stage 5: the payroll settings row
  saveSettings: accessProcedure('PAYROLL', 'WRITE').input(saveSettingsInput).handler(({ context, input }) => statutoryService.saveSettings(context.user, input)),
}
