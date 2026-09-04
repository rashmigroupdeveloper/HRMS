/**
 * Public API of the org module (Stage 2.0 — ORG-01..05 filter contract + masters).
 *
 * Deep imports are CI-blocked; everything other modules need is re-exported here.
 */
export { orgRouter } from './org.router.js';
export { orgScopeWhere } from './scope-sql.js';
export {
  listCostCenters,
  listDepartments,
  listGlAccounts,
  setCostCenterPlant,
  setDepartmentMisCode,
  upsertGlAccount,
  type CostCenterRow,
  type DepartmentRow,
  type GlAccountRow,
} from './org-mappings.service.js';
export {
  listCompanies,
  listPlants,
  listMisCodes,
  upsertPlant,
  upsertMisCode,
  setCompanySapCode,
  type CompanyRow,
  type PlantRow,
  type MisCodeRow,
} from './org.service.js';
