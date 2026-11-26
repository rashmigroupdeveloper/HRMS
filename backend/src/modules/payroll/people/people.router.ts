import { accessProcedure } from '#core/rpc/procedures'
import * as peopleService from './people.service.js'
import { peopleListInput, personInput, refreshInput } from './people.schema.js'

// A pay run's people and salary copy (payroll stage 2). The run is found with whole-company Payroll scope first;
// salary figures also need Salary View over the whole company (checked in the service).
export const peopleRouter = {
  list: accessProcedure('PAYROLL', 'READ').input(peopleListInput).handler(({ context, input }) => peopleService.listPeople(context.user, input)),
  get: accessProcedure('PAYROLL', 'READ').input(personInput).handler(({ context, input }) => peopleService.getPerson(context.user, input)),
  refresh: accessProcedure('PAYROLL', 'WRITE').input(refreshInput).handler(({ context, input }) => peopleService.refresh(context.user, input)),
}
