import { accessProcedure, authedProcedure } from '#core/rpc/procedures'
import { listInput } from '#shared/schemas/common.schema'
import { calculateInput, createSalaryStructureInput, updateSalaryStructureInput } from './salary-structures.schema.js'
import * as salaryStructuresService from './salary-structures.service.js'

// Routes + controller layer. List: ORGANIZATION READ; create / update: ORGANIZATION WRITE (for all companies - checked in
// the service); calculate: any logged-in employee (the offer and salary forms - a calculation, nobody's record).
const changeProcedure = accessProcedure('ORGANIZATION', 'WRITE')

export const salaryStructuresRouter = {
  list: accessProcedure('ORGANIZATION', 'READ')
    .input(listInput)
    .handler(({ input }) => salaryStructuresService.listSalaryStructures(input?.includeInactive)),
  create: changeProcedure
    .input(createSalaryStructureInput)
    .handler(({ input, context }) => salaryStructuresService.createSalaryStructureFor(context.user, input)),
  update: changeProcedure
    .input(updateSalaryStructureInput)
    .handler(({ input, context }) => salaryStructuresService.updateSalaryStructureFor(context.user, input)),
  calculate: authedProcedure.input(calculateInput).handler(({ input }) => salaryStructuresService.calculateBreakup(input)),
}
