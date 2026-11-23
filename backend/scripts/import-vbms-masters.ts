// One-off import of companies, plants, departments and which departments run at which plant from the VBMS database
// (../vbms, synced from SAP).
//
//   npm run import:vbms -- <path to vbms backend/.env> [--dry-run]
//
// Decided 2026-11-12:
// - Companies: VBMS is the list. A company we already have (from the old HRMS) is matched by its SAP company code,
//   or the first time by the mapping below; it takes the VBMS short name as code AND e-code prefix, the VBMS name
//   and the SAP company code. Missing companies are added (India payroll = it has a plant in India; the country that of
//   its first plant) with what VBMS has - name, codes, address, GSTIN; their state / region, PIN and PF / ESIC codes stay
//   empty until HR fills them in on the Organization page (the user, 2026-11-19: companies may be incomplete).
//   "Rashmi Group" is not in VBMS: it becomes RGRP, because VBMS uses RAS for Ravion Aviation Services.
// - Plants: matched by company + SAP plant code; name, address, PIN, country and region come from VBMS.
// - Departments: matched by code, else by name; an inactive VBMS duplicate of an active department's name is skipped.
// - Plant departments (2026-11-18, VBMS PlantDepartment): the active links are ADDED to the plant's departments - links
//   already there (e.g. ones HR added, or in use) are kept, nothing is removed. Links to a plant or department that is
//   not in the HRMS are skipped and counted. VBMS's department heads are not imported (HOD comes later).
// Reads VBMS with SELECT queries only and writes through the services (all validation rules apply), as System.
// Safe to run again.
import { readFileSync } from 'node:fs'
import { PrismaClient, SYSTEM_ACTOR } from '#core/db/prisma'
import { companiesService, departmentsService, plantsService } from '#modules/organization'
import { PrismaPg } from '@prisma/adapter-pg'

const [envPath, flag] = process.argv.slice(2)
if (!envPath) {
  console.error('Usage: npm run import:vbms -- <path to vbms backend/.env> [--dry-run]')
  process.exit(1)
}
const dryRun = flag === '--dry-run'

const vbmsUrl = readFileSync(envPath, 'utf8')
  .match(/^\s*DATABASE_URL\s*=\s*(.+)$/m)?.[1]
  ?.trim()
  .replace(/^["']|["']$/g, '')
  // Prisma's ?schema=public is not a Postgres option
  .replace(/[?&]schema=[^&]*/, '')
if (!vbmsUrl) throw new Error(`DATABASE_URL not found in ${envPath}`)
const vbms = new PrismaClient({ adapter: new PrismaPg({ connectionString: vbmsUrl }) })

type VbmsCompany = { sapCode: string; short: string; name: string; address: string | null; gstin: string | null; isActive: boolean; inIndia: boolean; country: string | null }
type VbmsPlant = {
  plantCode: string
  sapCompanyCode: string
  name: string
  address: string | null
  postalCode: string | null
  countryKey: string | null
  regionName: string | null
  isActive: boolean
}
type VbmsDepartment = { code: string; name: string; isActive: boolean }
type VbmsPlantDepartment = { plantCode: string; sapCompanyCode: string; departmentCode: string; departmentName: string }

// First run only: VBMS short name -> the code the company had from the old HRMS (same company, different code)
const OLD_CODE: Record<string, string> = {
  RML: 'RML',
  RDL: 'RDL',
  EIPL: 'EIPL',
  RPF: 'RPF',
  RMB: 'RMB',
  KIPL: 'KIO',
  KOCPL: 'KOL',
  RGHSPL: 'RGH',
  R6PL: 'RPL',
  RREL: 'RRE',
  RMTZ: 'RBS',
  RMUK: 'RMT',
}
// Our companies that are not in VBMS but whose code VBMS uses for another company
const RENAME_NOT_IN_VBMS: { name: string; code: string }[] = [{ name: 'Rashmi Group', code: 'RGRP' }]

const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/
const clean = (v: string | null) => (v && v.trim() ? v.trim() : undefined)
const log = (line: string) => console.log(`${dryRun ? '[dry run] ' : ''}${line}`)

async function importCompanies() {
  const rows = await vbms.$queryRaw<VbmsCompany[]>`
    select c."companyCode" "sapCode", c."shortName" short, c."companyName" name, c.address, c.gstin, c."isActive" "isActive",
      exists (select 1 from "Plant" p where p."companyId" = c.id and p."countryKey" = 'IN') "inIndia",
      (select p."countryKey" from "Plant" p where p."companyId" = c.id order by p."plantCode" limit 1) country
    from "Company" c order by c."companyCode"`
  let ours = await companiesService.listCompanies(true)
  let created = 0, updated = 0

  for (const rename of RENAME_NOT_IN_VBMS) {
    const company = ours.find((c) => c.name === rename.name)
    if (company && company.code !== rename.code) {
      log(`company ${company.code} "${company.name}" -> code / prefix ${rename.code} (not in VBMS)`)
      if (!dryRun) await companiesService.updateImportedCompany(company.id, { code: rename.code, ecodePrefix: rename.code }, SYSTEM_ACTOR)
      updated++
    }
  }
  ours = await companiesService.listCompanies(true)

  for (const v of rows) {
    const short = v.short.trim().toUpperCase()
    const gstin = clean(v.gstin)?.replace(/\s/g, '').toUpperCase()
    if (gstin && !GSTIN.test(gstin)) log(`  ! ${short}: GSTIN "${gstin}" is not a valid GSTIN - not imported`)
    const fields = {
      code: short,
      ecodePrefix: short,
      name: v.name.trim(),
      sapCompanyCode: v.sapCode.trim(),
      isActive: v.isActive,
    }
    const mine = ours.find((c) => c.sapCompanyCode === fields.sapCompanyCode) ?? ours.find((c) => OLD_CODE[short] !== undefined && c.code === OLD_CODE[short])
    if (mine) {
      const changes = Object.fromEntries(
        Object.entries({
          ...fields,
          ...(!mine.address && clean(v.address) && { address: clean(v.address) }),
          ...(!mine.gstin && gstin && GSTIN.test(gstin) && { gstin }),
        }).filter(([key, value]) => mine[key as keyof typeof mine] !== value),
      )
      if (Object.keys(changes).length) {
        log(`company ${mine.code} -> ${Object.entries(changes).map(([k, val]) => `${k}=${String(val)}`).join(', ')}`)
        if (!dryRun) await companiesService.updateImportedCompany(mine.id, changes, SYSTEM_ACTOR)
        updated++
      }
    } else {
      // added with what VBMS has; HR fills in the state / region, PIN and PF / ESIC codes (the user, 2026-11-19)
      const country = clean(v.country)?.toUpperCase()
      log(`company ${short} "${fields.name}" added (SAP ${fields.sapCompanyCode}) - state, PIN and PF / ESIC codes to fill in on the Organization page`)
      if (!dryRun) {
        await companiesService.importCompany(
          {
            ...fields,
            isIndiaPayroll: v.inIndia,
            countryCode: country && /^[A-Z]{2}$/.test(country) ? country : 'IN',
            address: clean(v.address),
            gstin: gstin && GSTIN.test(gstin) ? gstin : undefined,
          },
          SYSTEM_ACTOR,
        )
      }
      created++
    }
  }
  console.log(`Companies: ${rows.length} in VBMS - ${created} added (details to fill in), ${updated} updated`)
}

async function importPlants() {
  const rows = await vbms.$queryRaw<VbmsPlant[]>`
    select p."plantCode" "plantCode", c."companyCode" "sapCompanyCode", p."plantName" name, p.address, p."postalCode" "postalCode",
      p."countryKey" "countryKey", p."regionName" "regionName", p."isActive" "isActive"
    from "Plant" p join "Company" c on c.id = p."companyId" order by p."plantCode"`
  const companies = await companiesService.listCompanies(true)
  const existing = await plantsService.listPlants({ includeInactive: true })
  let created = 0, updated = 0, skipped = 0
  for (const v of rows) {
    const company = companies.find((c) => c.sapCompanyCode === v.sapCompanyCode.trim())
    if (!company) {
      // only possible in a dry run before the companies exist
      skipped++
      continue
    }
    const fields = {
      plantCode: v.plantCode.trim().toUpperCase(),
      name: v.name.trim(),
      address: clean(v.address) ?? null,
      postalCode: clean(v.postalCode) ?? null,
      countryCode: (clean(v.countryKey) ?? 'IN').toUpperCase(),
      region: clean(v.regionName) ?? null,
      isActive: v.isActive,
    }
    const mine = existing.find((p) => p.company.id === company.id && p.plantCode === fields.plantCode)
    if (mine) {
      const changes = Object.fromEntries(Object.entries(fields).filter(([key, value]) => mine[key as keyof typeof mine] !== value))
      if (Object.keys(changes).length) {
        if (!dryRun) await plantsService.updatePlant({ id: mine.id, ...changes }, SYSTEM_ACTOR)
        updated++
      }
    } else {
      if (!dryRun) {
        await plantsService.createPlant(
          {
            companyId: company.id,
            plantCode: fields.plantCode,
            name: fields.name,
            address: fields.address ?? undefined,
            postalCode: fields.postalCode ?? undefined,
            countryCode: fields.countryCode,
            region: fields.region ?? undefined,
          },
          SYSTEM_ACTOR,
        )
      }
      created++
    }
  }
  console.log(`Plants: ${rows.length} in VBMS - ${created} added, ${updated} updated${skipped ? `, ${skipped} wait for their company` : ''}`)
}

async function importDepartments() {
  const rows = await vbms.$queryRaw<VbmsDepartment[]>`
    select "departmentCode" code, "departmentName" name, "isActive" "isActive" from "Department" order by "departmentName"`
  const activeNames = new Set(rows.filter((d) => d.isActive).map((d) => d.name.trim().toLowerCase()))
  const existing = await departmentsService.listDepartments(true)
  let created = 0, updated = 0, skipped = 0
  for (const v of rows) {
    const fields = { code: v.code.trim(), name: v.name.trim(), isActive: v.isActive }
    if (!fields.isActive && activeNames.has(fields.name.toLowerCase())) {
      log(`  department "${fields.name}" (${fields.code}, inactive) skipped - duplicate of an active department`)
      skipped++
      continue
    }
    const mine = existing.find((d) => d.code === fields.code) ?? existing.find((d) => d.name.toLowerCase() === fields.name.toLowerCase())
    if (mine) {
      const changes = Object.fromEntries(Object.entries(fields).filter(([key, value]) => mine[key as keyof typeof mine] !== value))
      if (Object.keys(changes).length) {
        if (!dryRun) await departmentsService.updateDepartment({ id: mine.id, ...changes }, SYSTEM_ACTOR)
        updated++
      }
    } else {
      if (!dryRun) {
        const department = await departmentsService.createDepartment({ code: fields.code, name: fields.name }, SYSTEM_ACTOR)
        if (!fields.isActive) await departmentsService.updateDepartment({ id: department.id, isActive: false }, SYSTEM_ACTOR)
      }
      created++
    }
  }
  console.log(`Departments: ${rows.length} in VBMS - ${created} added, ${updated} updated, ${skipped} skipped`)
}

async function importPlantDepartments() {
  const rows = await vbms.$queryRaw<VbmsPlantDepartment[]>`
    select p."plantCode" "plantCode", c."companyCode" "sapCompanyCode", d."departmentCode" "departmentCode", d."departmentName" "departmentName"
    from "PlantDepartment" pd
      join "Plant" p on p.id = pd."plantId"
      join "Company" c on c.id = p."companyId"
      join "Department" d on d.id = pd."departmentId"
    where pd."isActive"
    order by p."plantCode", d."departmentName"`
  const companies = await companiesService.listCompanies(true)
  const plants = await plantsService.listPlants({ includeInactive: true })
  const departments = await departmentsService.listDepartments(true)
  // the departments to add to each plant, by our plant id
  const byPlant = new Map<number, Set<number>>()
  let noPlant = 0, noDepartment = 0
  for (const v of rows) {
    const company = companies.find((c) => c.sapCompanyCode === v.sapCompanyCode.trim())
    const plant = company && plants.find((p) => p.company.id === company.id && p.plantCode === v.plantCode.trim().toUpperCase())
    // matched like the departments above: by code, else by name (an inactive duplicate lands on the active one)
    const department =
      departments.find((d) => d.code === v.departmentCode.trim()) ?? departments.find((d) => d.name.toLowerCase() === v.departmentName.trim().toLowerCase())
    if (!plant) noPlant++
    else if (!department) noDepartment++
    else byPlant.set(plant.id, (byPlant.get(plant.id) ?? new Set<number>()).add(department.id))
  }
  let added = 0
  for (const [plantId, departmentIds] of byPlant) {
    if (dryRun) added += departmentIds.size
    else added += await plantsService.addPlantDepartments(plantId, [...departmentIds], SYSTEM_ACTOR)
  }
  console.log(
    `Plant departments: ${rows.length} active links in VBMS - ${added} ${dryRun ? 'to add (existing ones not subtracted)' : 'added'}` +
      `${noPlant ? `, ${noPlant} skipped (plant not in the HRMS)` : ''}${noDepartment ? `, ${noDepartment} skipped (department not in the HRMS)` : ''}`,
  )
}

try {
  console.log(dryRun ? 'DRY RUN - nothing will be written\n' : '')
  await importCompanies()
  await importPlants()
  await importDepartments()
  await importPlantDepartments()
  process.exit(0)
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
} finally {
  await vbms.$disconnect()
}
