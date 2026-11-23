import { companiesRouter } from './companies/companies.router.js'
import { costCentersRouter } from './cost-centers/cost-centers.router.js'
import { departmentsRouter } from './departments/departments.router.js'
import { designationsRouter } from './designations/designations.router.js'
import { gradesRouter } from './grades/grades.router.js'
import { positionsRouter } from './positions/positions.router.js'
import { regionsRouter } from './regions/regions.router.js'
import { workLocationsRouter } from './work-locations/work-locations.router.js'
import { plantsRouter } from './plants/plants.router.js'
import { salaryComponentsRouter } from './salary-components/salary-components.router.js'

// Organization masters: organization.companies.list, organization.departments.create, ...
export const organizationRouter = {
  companies: companiesRouter,
  regions: regionsRouter,
  workLocations: workLocationsRouter,
  plants: plantsRouter,
  costCenters: costCentersRouter,
  departments: departmentsRouter,
  designations: designationsRouter,
  grades: gradesRouter,
  positions: positionsRouter,
  salaryComponents: salaryComponentsRouter,
}
