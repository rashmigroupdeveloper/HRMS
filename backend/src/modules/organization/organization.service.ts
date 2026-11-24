import type { CurrentUser } from '#core/rpc/procedures'
import { reportFile, reportSheet, type ReportField } from '#core/excel/report'
import type { z } from 'zod'
import type { exportOrganizationInput } from './organization.schema.js'
import * as companies from './companies/companies.service.js'
import * as plants from './plants/plants.service.js'
import * as costs from './cost-centers/cost-centers.service.js'
import * as locations from './work-locations/work-locations.service.js'
import * as departments from './departments/departments.service.js'
import * as designations from './designations/designations.service.js'
import * as regions from './regions/regions.service.js'
import * as positions from './positions/positions.service.js'
import * as grades from './grades/grades.service.js'
import * as salary from './salary-components/salary-components.service.js'

// Shared reference lists, as on Organization. The router requires Organization READ, including retired records.
// Requested IDs can only narrow the authorized list; their order preserves the screen's sort and filters.
export async function exportOrganization(viewer: CurrentUser, input: z.infer<typeof exportOrganizationInput>) {
  const build = <T extends { id: number; isActive: boolean }>(name: string, rows: T[], fields: ReportField<T>[]) => {
    const byId = new Map(rows.map((row) => [row.id, row]))
    const selected = [...new Set(input.ids)].flatMap((id) => byId.get(id) ? [byId.get(id)!] : [])
    return reportSheet(name, selected, [...fields, { header: 'Status', value: (r) => r.isActive ? 'Active' : 'Retired' }])
  }
  const all = { includeInactive: true }
  const sheet = await (async () => {
    switch (input.section) {
      case 'companies': return build('Companies', await companies.listCompaniesFor(viewer, true), [
        { header: 'Company code', value: r => r.code, text: true }, { header: 'Name', value: r => r.name, width: 36 },
        { header: 'SAP code', value: r => r.sapCompanyCode, text: true }, { header: 'Employee code prefix', value: r => r.ecodePrefix, text: true },
        { header: 'Next employee number', value: r => r.nextEmployeeNumber }, { header: 'India payroll', value: r => r.isIndiaPayroll ? 'Yes' : 'No' },
        { header: 'Country', value: r => r.countryCode }, { header: 'Region', value: r => r.region }, { header: 'Address', value: r => r.address, width: 45 },
        { header: 'Postal code', value: r => r.postalCode, text: true }, { header: 'PF establishment code', value: r => r.pfEstablishmentCode, text: true },
        { header: 'ESIC employer code', value: r => r.esicEmployerCode, text: true }, { header: 'PAN', value: r => r.pan, text: true },
        { header: 'TAN', value: r => r.tan, text: true }, { header: 'GSTIN', value: r => r.gstin, text: true }, { header: 'PT registration', value: r => r.ptRegistrationNo, text: true },
      ])
      case 'plants': return build('Plants', await plants.listPlantsFor(viewer, all), [
        { header: 'Plant code', value: r => r.plantCode, text: true }, { header: 'Name', value: r => r.name, width: 32 },
        { header: 'Company', value: r => `${r.company.code} · ${r.company.name}`, width: 32 }, { header: 'Address', value: r => r.address, width: 40 },
        { header: 'Country', value: r => r.countryCode }, { header: 'Region', value: r => r.region }, { header: 'Postal code', value: r => r.postalCode, text: true },
      ])
      case 'costCenters': return build('Cost centres', await costs.listCostCentersFor(viewer, all), [
        { header: 'Code', value: r => r.code, text: true }, { header: 'Name', value: r => r.name, width: 32 },
        { header: 'Company', value: r => r.company.name, width: 32 }, { header: 'Plant', value: r => r.plant ? `${r.plant.plantCode} · ${r.plant.name}` : '', width: 32 },
      ])
      case 'workLocations': return build('Work locations', await locations.listWorkLocationsFor(viewer, all), [
        { header: 'Name', value: r => r.name, width: 32 }, { header: 'Country', value: r => r.countryCode }, { header: 'State', value: r => r.stateCode },
        { header: 'Region', value: r => r.region?.name }, { header: 'Time zone', value: r => r.timezone, width: 25 }, { header: 'Address', value: r => r.address, width: 45 }, { header: 'Postal code', value: r => r.postalCode, text: true },
      ])
      case 'grades': return build('Grades', await grades.listGradesFor(viewer, true), [{ header: 'Code', value: r => r.code, text: true }, { header: 'Name', value: r => r.name, width: 36 }, { header: 'Rank', value: r => r.rank }])
      case 'salaryComponents': return build('Salary components', await salary.listSalaryComponentsFor(viewer, true), [{ header: 'Name', value: r => r.name, width: 36 }, { header: 'Kind', value: r => r.kind === 'EARNING' ? 'Earning' : 'Employer contribution' }, { header: 'Order', value: r => r.displayOrder }])
      case 'departments': return build('Departments', await departments.listDepartmentsFor(viewer, all), [{ header: 'Code', value: r => r.code, text: true }, { header: 'Name', value: r => r.name, width: 36 }])
      case 'designations': return build('Designations', await designations.listDesignationsFor(viewer, true), [{ header: 'Name', value: r => r.name, width: 40 }])
      case 'regions': return build('Regions', await regions.listRegionsFor(viewer, true), [{ header: 'Name', value: r => r.name, width: 40 }])
      case 'positions': return build('Positions', await positions.listPositionsFor(viewer, true), [{ header: 'Name', value: r => r.name, width: 40 }])
    }
  })()
  return reportFile([sheet], { title: sheet.name, preparedBy: `${viewer.name} (${viewer.employeeCode})`, coverage: 'The selected Organization list, in the displayed order.', filters: [{ label: 'View', value: input.selection ?? 'Selected rows' }] }, `organization-${input.section}`)
}
