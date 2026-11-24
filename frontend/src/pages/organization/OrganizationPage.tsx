import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { FormError } from '@/components/FormError'
import { PillTabsList, PillTabsTrigger } from '@/components/PillTabs'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { useAccess } from '@/hooks/useAccess'
import { client, orpc } from '@/lib/orpc'
import { cn } from '@/lib/utils'
import { DepartmentHeadsTab } from './components/DepartmentHeadsTab'
import { CompanyDetail, CompanyTile } from './components/CompanyDetail'
import { lacksEmployerDetails, nextCodeOf } from './components/company-facts'
import { MasterSection } from './components/MasterSection'
import { PlantDepartmentsDrawer } from './components/PlantDepartmentsDrawer'
import { SalaryStructuresTab } from './components/SalaryStructuresTab'
import { COUNTRY_OPTIONS, INDIAN_STATE_NAME_OPTIONS, INDIAN_STATE_OPTIONS, TIME_ZONE_OPTIONS } from '@/lib/choices'

// Organization masters (Organization: View; changing needs Organization: Edit): companies, work locations (where employees / candidates are placed), plants and cost centres (SAP), departments,
// designations, grades and salary components (the lines of an offer's salary breakup).
// Retired entries stay listed. The "Department heads" tab: HOD appointments: View (BACKLOG 3e) - someone with only that
// sees only that tab.
const ALL = { includeInactive: true }
const opt = (value: string) => (value.trim() === '' ? undefined : value.trim())
const YES_NO = [
  { value: 'true', label: 'Yes' },
  { value: 'false', label: 'No' },
]
const bool = (value: string | undefined) => (value === 'true' ? true : value === 'false' ? false : undefined)
// a clearable field: '' (emptied) -> null, unchanged -> undefined
const orNull = (value: string | undefined) => (value === undefined ? undefined : value.trim() === '' ? null : value.trim())
const num = (value: string | undefined) => (value === undefined || value.trim() === '' ? undefined : Number(value))
// State / region: Indian states to pick from when the country is India (stored by name, as SAP sends it);
// a free text box abroad (e.g. Dubai, London)
const regionChoices = (values: Record<string, string>) => ((values.countryCode ?? 'IN') === 'IN' ? INDIAN_STATE_NAME_OPTIONS : undefined)

type PlantRow = Awaited<ReturnType<typeof client.organization.plants.list>>[number]
type SalaryKind = Awaited<ReturnType<typeof client.organization.salaryComponents.list>>[number]['kind']
const SALARY_KIND: Record<SalaryKind, string> = { EARNING: 'Earning', EMPLOYER_CONTRIBUTION: 'Employer contribution', DEDUCTION: 'Deduction' }
// The groups on the page, in this order (as the breakup prints them, then the payslip's deductions - 2026-11-24)
const SALARY_KIND_GROUP: Record<SalaryKind, { order: number; label: string }> = {
  EARNING: { order: 1, label: 'Earnings - add up to the Monthly Gross' },
  EMPLOYER_CONTRIBUTION: { order: 2, label: 'Employer contributions - paid on top, part of the CTC' },
  DEDUCTION: { order: 3, label: 'Deductions - taken out of the monthly pay by payroll, never in a salary breakup' },
}

// The API of a master that only has a name (designations)
type NameOnlyApi = {
  create: (input: { name: string }) => Promise<unknown>
  update: (input: { id: number; name?: string | undefined; isActive?: boolean | undefined }) => Promise<unknown>
}

export function OrganizationPage() {
  const { can } = useAccess()
  const canChange = can('ORGANIZATION', 'WRITE')
  // the masters (with the retired ones) need Organization: View; the HOD posts their own area
  const canSeeMasters = can('ORGANIZATION')
  const canSeeHods = can('HOD_APPOINTMENTS')
  // the open tab: the first one the access gives until one is picked - worked out on every render, so it follows
  // accounts.me when that answers after the page showed (a default value was fixed before)
  const [pickedTab, setPickedTab] = useState<string | null>(null)
  const tab = pickedTab ?? (canSeeMasters ? 'companies' : 'department-heads')
  const companies = useQuery({ ...orpc.organization.companies.list.queryOptions({ input: ALL }), enabled: canSeeMasters })
  const workLocations = useQuery({ ...orpc.organization.workLocations.list.queryOptions({ input: ALL }), enabled: canSeeMasters })
  const plants = useQuery({ ...orpc.organization.plants.list.queryOptions({ input: ALL }), enabled: canSeeMasters })
  const costCenters = useQuery({ ...orpc.organization.costCenters.list.queryOptions({ input: ALL }), enabled: canSeeMasters })
  const departments = useQuery({ ...orpc.organization.departments.list.queryOptions({ input: ALL }), enabled: canSeeMasters })
  const designations = useQuery({ ...orpc.organization.designations.list.queryOptions({ input: ALL }), enabled: canSeeMasters })
  const grades = useQuery({ ...orpc.organization.grades.list.queryOptions({ input: ALL }), enabled: canSeeMasters })
  const positions = useQuery({ ...orpc.organization.positions.list.queryOptions({ input: ALL }), enabled: canSeeMasters })
  const regions = useQuery({ ...orpc.organization.regions.list.queryOptions({ input: ALL }), enabled: canSeeMasters })
  const salaryComponents = useQuery({ ...orpc.organization.salaryComponents.list.queryOptions({ input: ALL }), enabled: canSeeMasters })
  // the same list the tab shows (one cache) - for the count on the tab
  const salaryStructures = useQuery({ ...orpc.organization.salaryStructures.list.queryOptions({ input: ALL }), enabled: canSeeMasters })
  // the plant whose departments are open
  const [plantDepartments, setPlantDepartments] = useState<PlantRow | null>(null)
  const companyOptions = (companies.data ?? [])
    .filter((c) => c.isActive)
    .map((c) => ({ value: String(c.id), label: `${c.code} · ${c.name}` }))
  // labelled with their company - the backend refuses one of another company
  const plantOptions = (plants.data ?? [])
    .filter((p) => p.isActive)
    .map((p) => ({ value: String(p.id), label: `${p.company.code} · ${p.plantCode} ${p.name}` }))
  // regions to put a work location in - a retired one is listed (marked) so a location that has it still shows it; the
  // backend refuses choosing it anew
  const regionOptions = (regions.data ?? []).map((r) => ({ value: String(r.id), label: r.isActive ? r.name : `${r.name} (retired)` }))
  // companies in use that miss employer details or their employee code series - a dot on the tab
  const companiesNeedingWork = (companies.data ?? []).filter((c) => c.isActive && (lacksEmployerDetails(c) || c.nextEmployeeNumber === null)).length

  const nameOnly = (singular: string, api: NameOnlyApi) => ({
    singular,
    item: (r: { name: string }) => ({ title: r.name }),
    preview: (v: Record<string, string>) => ({ title: v.name ?? '' }),
    sort: (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name),
    fields: [{ name: 'name', label: 'Name', required: true }],
    toValues: (r: { name: string }) => ({ name: r.name }),
    create: (v: Record<string, string>) => api.create({ name: v.name!.trim() }),
    update: (id: number, c: Record<string, string>, isActive?: boolean) => api.update({ id, name: opt(c.name ?? ''), isActive }),
  })

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-muted-foreground">Administration</p>
        <h1 className="mt-1 text-3xl font-light tracking-tight sm:text-4xl">Organization</h1>
      </header>

      <FormError
        error={
          companies.error ??
          workLocations.error ??
          plants.error ??
          costCenters.error ??
          departments.error ??
          designations.error ??
          grades.error ??
          positions.error ??
          regions.error ??
          salaryComponents.error
        }
      />

      <Tabs value={tab} onValueChange={(value) => setPickedTab(String(value))}>
        <PillTabsList>
          {(
            [
              ...(canSeeMasters
                ? [
                    ['companies', 'Companies', companies.data, companiesNeedingWork > 0],
                    ...(canSeeHods ? [['department-heads', 'Department heads']] : []),
                    ['plants', 'Plants', plants.data],
                    ['departments', 'Departments', departments.data],
                    ['cost-centres', 'Cost centres', costCenters.data],
                    ['work-locations', 'Work locations', workLocations.data],
                    ['regions', 'Regions', regions.data],
                    ['designations', 'Designations', designations.data],
                    ['positions', 'Positions', positions.data],
                    ['grades', 'Grades', grades.data],
                    ['salary-components', 'Salary components', salaryComponents.data],
                    ['salary-structures', 'Salary structures', salaryStructures.data],
                  ]
                : []),
              ...(canSeeHods && !canSeeMasters ? [['department-heads', 'Department heads']] : []),
            ] as [string, string, { isActive: boolean }[]?, boolean?][]
          ).map(([value, label, list, attention]) => (
            <PillTabsTrigger key={value} value={value} className="gap-1.5">
              {label}
              {list && <span className="text-xs tabular-nums opacity-60">{list.filter((r) => r.isActive).length}</span>}
              {attention && <span aria-label="needs attention" className="size-1.5 rounded-full bg-warning" />}
            </PillTabsTrigger>
          ))}
        </PillTabsList>

        {canSeeHods && (
          <TabsContent value="department-heads" className="mt-5">
            <DepartmentHeadsTab />
          </TabsContent>
        )}

        <TabsContent value="companies" className="mt-5">
          <MasterSection
            title="Companies" exportSection="companies"
            singular="company"
            about="A legal entity of the group. Its employer details are printed on EPF Form 11, ESIC Form 1 and Gratuity Form F."
            canChange={canChange}
            addShared
            rows={companies.data ?? []}
            loading={companies.isPending}
            preview={(v) => ({
              lead: <CompanyTile code={v.code || '?'} />,
              title: v.name ?? '',
              subtitle: [
                v.sapCompanyCode && `SAP ${v.sapCompanyCode}`,
                v.ecodePrefix && v.nextEmployeeNumber ? `Next code ${v.ecodePrefix}${v.nextEmployeeNumber.padStart(6, '0')}` : v.ecodePrefix && 'No next employee code yet',
                v.isIndiaPayroll === 'false' ? 'Overseas' : 'India payroll',
              ]
                .filter(Boolean)
                .join(' · '),
            })}
            item={(c) => ({
              lead: <CompanyTile code={c.code} />,
              title: c.name,
              subtitle: [c.sapCompanyCode && `SAP ${c.sapCompanyCode}`, nextCodeOf(c) && `next ${nextCodeOf(c)}`, !c.isIndiaPayroll && 'Overseas']
                .filter(Boolean)
                .join(' · '),
            })}
            searchText={(c) => `${c.code} ${c.name} ${c.sapCompanyCode ?? ''} ${c.ecodePrefix} ${c.region ?? ''}`}
            sort={(a, b) => a.name.localeCompare(b.name)}
            filters={[
              { key: 'details', label: 'Missing employer details', warning: true, test: (c) => c.isActive && lacksEmployerDetails(c) },
              { key: 'series', label: 'No next employee code', warning: true, test: (c) => c.isActive && c.nextEmployeeNumber === null },
              { key: 'overseas', label: 'Overseas', test: (c) => !c.isIndiaPayroll },
            ]}
            detail={(c, actions) => <CompanyDetail company={c} plants={plants.data ?? []} actions={actions} onOpenPlant={setPlantDepartments} />}
            fields={[
              {
                section: 'Company',
                name: 'name',
                label: 'Company name',
                required: true,
                wide: true,
                placeholder: 'e.g. Rashmi Metaliks Limited',
              },
              { section: 'Company', name: 'code', label: 'Code', required: true, upperCase: true, placeholder: 'e.g. RML' },
              {
                section: 'Company',
                name: 'ecodePrefix',
                label: 'E-code prefix',
                required: true,
                upperCase: true,
                placeholder: 'e.g. RML',
                hint: 'Start of its employee codes (RML035384)',
              },
              {
                section: 'Company',
                name: 'nextEmployeeNumber',
                label: 'Next employee number',
                digitsOnly: 8,
                placeholder: 'e.g. 35385',
                hint: 'The number the next employee code gets (prefix + 6 digits, e.g. RML035385) - where the existing codes end',
              },
              {
                section: 'Company',
                name: 'sapCompanyCode',
                label: 'SAP company code',
                upperCase: true,
                placeholder: 'e.g. 1100',
                hint: 'Plant codes start with it',
              },
              {
                section: 'Company',
                name: 'isIndiaPayroll',
                label: 'India payroll',
                options: YES_NO,
                defaultValue: 'true',
                hint: 'No for overseas entities - no PF / ESIC / PT / TDS',
              },
              { section: 'Registrations', name: 'pan', label: 'Company PAN', upperCase: true, placeholder: 'AABCR1234K' },
              { section: 'Registrations', name: 'tan', label: 'TAN', upperCase: true, placeholder: 'CALR12345A' },
              {
                section: 'Registrations',
                name: 'gstin',
                label: 'GSTIN',
                upperCase: true,
                placeholder: '19AABCR1234K1Z5',
                hint: 'Characters 3-12 are the PAN',
              },
              { section: 'Registrations', name: 'ptRegistrationNo', label: 'PT registration number', upperCase: true },
              {
                section: 'Registrations',
                name: 'pfEstablishmentCode',
                label: 'PF establishment code',
                upperCase: true,
                placeholder: 'WBCAL0012345',
                // printed on EPF Form 11 - every India payroll company has one
                requiredWhen: (v) => v.isIndiaPayroll !== 'false',
                hint: 'Required for India payroll - printed on EPF Form 11',
              },
              {
                section: 'Registrations',
                name: 'esicEmployerCode',
                label: 'ESIC employer code',
                placeholder: '17 digits',
                requiredWhen: (v) => v.isIndiaPayroll !== 'false',
                hint: 'Required for India payroll - printed on ESIC Form 1',
              },
              {
                section: 'Address',
                name: 'address',
                label: 'Address',
                required: true,
                wide: true,
                multiline: true,
                placeholder: 'Building, street, area',
                hint: 'Printed on Gratuity Form F and ESIC Form 1',
              },
              {
                section: 'Address',
                name: 'countryCode',
                label: 'Country',
                options: COUNTRY_OPTIONS,
                defaultValue: 'IN',
                clears: ['region'],
              },
              { section: 'Address', name: 'region', label: 'State / region', required: true, optionsFor: regionChoices, placeholder: 'e.g. Dubai' },
              {
                section: 'Address',
                name: 'postalCode',
                label: 'PIN / postal code',
                placeholder: 'e.g. 700017',
                // abroad there may be no postal code
                requiredWhen: (v) => (v.countryCode || 'IN') === 'IN',
                hint: 'Required for India (6 digits)',
              },
            ]}
            toValues={(c) => ({
              code: c.code,
              name: c.name,
              ecodePrefix: c.ecodePrefix,
              nextEmployeeNumber: c.nextEmployeeNumber === null ? '' : String(c.nextEmployeeNumber),
              sapCompanyCode: c.sapCompanyCode ?? '',
              isIndiaPayroll: String(c.isIndiaPayroll),
              address: c.address ?? '',
              postalCode: c.postalCode ?? '',
              countryCode: c.countryCode,
              region: c.region ?? '',
              pan: c.pan ?? '',
              tan: c.tan ?? '',
              gstin: c.gstin ?? '',
              pfEstablishmentCode: c.pfEstablishmentCode ?? '',
              esicEmployerCode: c.esicEmployerCode ?? '',
              ptRegistrationNo: c.ptRegistrationNo ?? '',
            })}
            create={(v) =>
              client.organization.companies.create({
                code: v.code!.trim(),
                name: v.name!.trim(),
                ecodePrefix: v.ecodePrefix!.trim(),
                nextEmployeeNumber: num(v.nextEmployeeNumber),
                sapCompanyCode: opt(v.sapCompanyCode ?? ''),
                isIndiaPayroll: bool(v.isIndiaPayroll),
                address: v.address!.trim(),
                postalCode: opt(v.postalCode ?? ''),
                countryCode: opt(v.countryCode ?? ''),
                region: v.region!.trim(),
                pan: opt(v.pan ?? ''),
                tan: opt(v.tan ?? ''),
                gstin: opt(v.gstin ?? ''),
                pfEstablishmentCode: opt(v.pfEstablishmentCode ?? ''),
                esicEmployerCode: opt(v.esicEmployerCode ?? ''),
                ptRegistrationNo: opt(v.ptRegistrationNo ?? ''),
              })
            }
            update={(id, c, isActive) =>
              client.organization.companies.update({
                id,
                code: opt(c.code ?? ''),
                name: opt(c.name ?? ''),
                ecodePrefix: opt(c.ecodePrefix ?? ''),
                nextEmployeeNumber: num(c.nextEmployeeNumber),
                sapCompanyCode: opt(c.sapCompanyCode ?? ''),
                isIndiaPayroll: bool(c.isIndiaPayroll),
                address: opt(c.address ?? ''),
                postalCode: opt(c.postalCode ?? ''),
                countryCode: opt(c.countryCode ?? ''),
                region: opt(c.region ?? ''),
                pan: opt(c.pan ?? ''),
                tan: opt(c.tan ?? ''),
                gstin: opt(c.gstin ?? ''),
                pfEstablishmentCode: opt(c.pfEstablishmentCode ?? ''),
                esicEmployerCode: opt(c.esicEmployerCode ?? ''),
                ptRegistrationNo: opt(c.ptRegistrationNo ?? ''),
                isActive,
              })
            }
          />
        </TabsContent>

        <TabsContent value="work-locations" className="mt-5">
          <MasterSection
            title="Work locations" exportSection="workLocations"
            singular="work location"
            about="A place where people work - any company can use it. Its state decides Professional Tax and LWF."
            canChange={canChange}
            shared
            rows={workLocations.data ?? []}
            loading={workLocations.isPending}
            preview={(v) => ({
              title: v.name ?? '',
              subtitle: [INDIAN_STATE_OPTIONS.find((o) => o.value === v.stateCode)?.label ?? (v.countryCode !== 'IN' ? countryName(v.countryCode ?? '') : ''), v.timezone]
                .filter(Boolean)
                .join(' · '),
            })}
            columns={[
              { label: 'Location', value: (l) => <span className="font-medium">{l.name}</span> },
              { label: 'Country / state', value: (l) => [l.countryCode, l.stateCode].filter(Boolean).join(' · ') },
              { label: 'Region', value: (l) => l.region?.name ?? '' },
              { label: 'Address', wrap: true, value: (l) => [l.address, l.postalCode].filter(Boolean).join(' - ') },
              { label: 'Time zone', value: (l) => l.timezone },
            ]}
            fields={[
              {
                name: 'name',
                label: 'Location',
                required: true,
                hint: 'Short name of the place, e.g. Kharagpur Works, Kolkata HQ - any company can use it',
              },
              { name: 'countryCode', label: 'Country', required: true, options: COUNTRY_OPTIONS, defaultValue: 'IN' },
              {
                name: 'stateCode',
                label: 'State',
                required: true,
                options: INDIAN_STATE_OPTIONS,
                hint: 'Decides Professional Tax and LWF',
                showWhen: (v) => v.countryCode === 'IN',
              },
              { name: 'timezone', label: 'Time zone', required: true, options: TIME_ZONE_OPTIONS, defaultValue: 'Asia/Kolkata' },
              {
                name: 'regionId',
                label: 'Region',
                options: regionOptions,
                clearable: true,
                hint: 'e.g. East - the list is on the Regions tab',
              },
              { name: 'address', label: 'Address', multiline: true, wide: true, clearable: true },
              {
                name: 'postalCode',
                label: 'PIN code',
                clearable: true,
                hint: 'In India: 6 digits',
              },
            ]}
            toValues={(l) => ({
              name: l.name,
              countryCode: l.countryCode,
              stateCode: l.stateCode ?? '',
              timezone: l.timezone,
              regionId: l.region ? String(l.region.id) : '',
              address: l.address ?? '',
              postalCode: l.postalCode ?? '',
            })}
            create={(v) =>
              client.organization.workLocations.create({
                name: v.name!.trim(),
                countryCode: opt(v.countryCode ?? ''),
                stateCode: opt(v.stateCode ?? ''),
                timezone: opt(v.timezone ?? ''),
                regionId: num(v.regionId),
                address: opt(v.address ?? ''),
                postalCode: opt(v.postalCode ?? ''),
              })
            }
            update={(id, c, isActive) =>
              client.organization.workLocations.update({
                id,
                name: opt(c.name ?? ''),
                countryCode: opt(c.countryCode ?? ''),
                stateCode: opt(c.stateCode ?? ''),
                timezone: opt(c.timezone ?? ''),
                regionId: c.regionId === undefined ? undefined : c.regionId === '' ? null : Number(c.regionId),
                address: orNull(c.address),
                postalCode: orNull(c.postalCode),
                isActive,
              })
            }
          />
        </TabsContent>

        <TabsContent value="regions" className="mt-5">
          <MasterSection title="Regions" exportSection="regions" canChange={canChange} shared rows={regions.data ?? []} loading={regions.isPending} {...nameOnly('region', client.organization.regions)} />
        </TabsContent>

        <TabsContent value="plants" className="mt-5">
          <MasterSection
            title="Plants" exportSection="plants"
            singular="plant"
            about="An SAP plant of one company. After saving, tick the departments that run at it."
            canChange={canChange}
            rows={plants.data ?? []}
            loading={plants.isPending}
            sort={(a, b) => a.company.name.localeCompare(b.company.name) || a.plantCode.localeCompare(b.plantCode)}
            groupBy={(p) => ({ key: p.company.id, label: <CompanyHeading code={p.company.code} name={p.company.name} /> })}
            searchText={(p) => `${p.plantCode} ${p.name} ${p.company.code} ${p.company.name} ${p.address ?? ''} ${p.region ?? ''}`}
            filters={[{ key: 'no-departments', label: 'No departments', warning: true, test: (p) => p.isActive && p._count.departments === 0 }]}
            preview={(v) => ({
              lead: <CodeChip code={v.plantCode} />,
              title: v.name ?? '',
              subtitle: [companyOptions.find((o) => o.value === v.companyId)?.label, v.region].filter(Boolean).join(' · '),
            })}
            item={(p) => ({
              lead: <span className="w-10 shrink-0 text-xs text-muted-foreground tabular-nums">{p.plantCode}</span>,
              title: p.name,
              subtitle: [p.address, p.postalCode].filter(Boolean).join(' - ') || undefined,
              tags: <PlantDepartmentsButton plant={p} onOpen={setPlantDepartments} />,
            })}
            columns={[
              {
                label: 'Plant',
                wrap: true,
                value: (p) => (
                  <span>
                    <span className="mr-1.5 text-muted-foreground tabular-nums">{p.plantCode}</span>
                    <span className="font-medium">{p.name}</span>
                  </span>
                ),
              },
              {
                // company -> plant -> department (2026-11-18): which departments run at the plant
                label: 'Depts',
                value: (p) => <PlantDepartmentsButton plant={p} onOpen={setPlantDepartments} />,
              },
              {
                label: 'Address',
                wrap: true,
                value: (p) => {
                  const address = [p.address, p.postalCode].filter(Boolean).join(' - ')
                  return (
                    <span title={address} className="line-clamp-1 text-xs">
                      {address || '—'}
                    </span>
                  )
                },
              },
              { label: 'State / region', value: (p) => p.region || countryName(p.countryCode) },
            ]}
            fields={[
              {
                section: 'Plant',
                name: 'companyId',
                label: 'Company',
                required: true,
                createOnly: true,
                wide: true,
                options: companyOptions,
                hint: 'Set once - a plant always belongs to this company',
              },
              {
                section: 'Plant',
                name: 'plantCode',
                label: 'Plant code',
                required: true,
                upperCase: true,
                placeholder: 'e.g. 1101',
                hint: 'SAP plant code, unique within the company',
              },
              { section: 'Plant', name: 'name', label: 'Plant name', required: true, placeholder: 'e.g. RML HQ' },
              { section: 'Address', name: 'address', label: 'Address', wide: true, multiline: true, placeholder: 'Building, street, area' },
              {
                section: 'Address',
                name: 'countryCode',
                label: 'Country',
                options: COUNTRY_OPTIONS,
                defaultValue: 'IN',
                clears: ['region'],
              },
              { section: 'Address', name: 'region', label: 'State / region', optionsFor: regionChoices, placeholder: 'e.g. Dubai' },
              { section: 'Address', name: 'postalCode', label: 'PIN / postal code', placeholder: 'e.g. 721301' },
            ]}
            toValues={(p) => ({
              companyId: String(p.company.id),
              plantCode: p.plantCode,
              name: p.name,
              address: p.address ?? '',
              postalCode: p.postalCode ?? '',
              countryCode: p.countryCode,
              region: p.region ?? '',
            })}
            create={(v) =>
              client.organization.plants.create({
                companyId: Number(v.companyId),
                plantCode: v.plantCode!.trim(),
                name: v.name!.trim(),
                address: opt(v.address ?? ''),
                postalCode: opt(v.postalCode ?? ''),
                countryCode: opt(v.countryCode ?? ''),
                region: opt(v.region ?? ''),
              })
            }
            update={(id, c, isActive) =>
              client.organization.plants.update({
                id,
                plantCode: opt(c.plantCode ?? ''),
                name: opt(c.name ?? ''),
                address: opt(c.address ?? ''),
                postalCode: opt(c.postalCode ?? ''),
                countryCode: opt(c.countryCode ?? ''),
                region: opt(c.region ?? ''),
                isActive,
              })
            }
          />
          {plantDepartments && <PlantDepartmentsDrawer plant={plantDepartments} canChange={canChange} onClose={() => setPlantDepartments(null)} />}
        </TabsContent>

        <TabsContent value="cost-centres" className="mt-5">
          <MasterSection
            title="Cost centres" exportSection="costCenters"
            singular="cost centre"
            about="An SAP cost centre of one company, optionally tied to one of its plants."
            canChange={canChange}
            rows={costCenters.data ?? []}
            loading={costCenters.isPending}
            preview={(v) => ({
              lead: <CodeChip code={v.code} />,
              title: v.name ?? '',
              subtitle: [companyOptions.find((o) => o.value === v.companyId)?.label, plantOptions.find((o) => o.value === v.plantId)?.label].filter(Boolean).join(' · '),
            })}
            sort={(a, b) => a.company.name.localeCompare(b.company.name) || a.code.localeCompare(b.code)}
            groupBy={(cc) => ({ key: cc.company.id, label: <CompanyHeading code={cc.company.code} name={cc.company.name} /> })}
            searchText={(cc) => `${cc.code} ${cc.name} ${cc.company.code} ${cc.company.name} ${cc.plant?.plantCode ?? ''} ${cc.plant?.name ?? ''}`}
            columns={[
              {
                label: 'Cost centre',
                wrap: true,
                value: (cc) => (
                  <span>
                    <span className="mr-1.5 text-muted-foreground tabular-nums">{cc.code}</span>
                    <span className="font-medium">{cc.name}</span>
                  </span>
                ),
              },
              {
                label: 'Plant',
                value: (cc) =>
                  cc.plant ? (
                    <span className="text-xs">
                      <span className="text-muted-foreground tabular-nums">{cc.plant.plantCode}</span> {cc.plant.name}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  ),
              },
            ]}
            fields={[
              {
                name: 'companyId',
                label: 'Company',
                required: true,
                createOnly: true,
                options: companyOptions,
                hint: 'Set once - it always belongs to this company',
              },
              {
                name: 'code',
                label: 'Cost centre code',
                required: true,
                upperCase: true,
                placeholder: 'e.g. 1701',
                hint: 'SAP code, unique within the company',
              },
              { name: 'name', label: 'Name', required: true, placeholder: 'e.g. Production' },
              { name: 'plantId', label: 'Plant', options: plantOptions, hint: 'A plant of the same company' },
            ]}
            toValues={(cc) => ({
              companyId: String(cc.company.id),
              code: cc.code,
              name: cc.name,
              plantId: cc.plant ? String(cc.plant.id) : '',
            })}
            create={(v) =>
              client.organization.costCenters.create({
                companyId: Number(v.companyId),
                code: v.code!.trim(),
                name: v.name!.trim(),
                plantId: num(v.plantId),
              })
            }
            update={(id, c, isActive) =>
              client.organization.costCenters.update({
                id,
                code: opt(c.code ?? ''),
                name: opt(c.name ?? ''),
                plantId: num(c.plantId),
                isActive,
              })
            }
          />
        </TabsContent>

        <TabsContent value="departments" className="mt-5">
          <MasterSection
            title="Departments" exportSection="departments"
            singular="department"
            about="Shared by every company - tick it at each plant where it runs (Plants tab)."
            canChange={canChange}
            shared
            rows={departments.data ?? []}
            loading={departments.isPending}
            sort={(a, b) => a.name.localeCompare(b.name)}
            dense
            preview={(v) => ({ title: v.name ?? '', subtitle: v.code })}
            searchText={(d) => `${d.code} ${d.name}`}
            // the code only when it says something the name does not (many VBMS departments have code = name)
            item={(d) => ({ title: d.name, subtitle: d.code.toLowerCase() === d.name.toLowerCase() ? undefined : d.code })}
            fields={[
              { name: 'code', label: 'Code', required: true, hint: 'As in SAP / VBMS, e.g. ELEC.MAINT' },
              { name: 'name', label: 'Name', required: true },
            ]}
            toValues={(d) => ({ code: d.code, name: d.name })}
            create={(v) => client.organization.departments.create({ code: v.code!.trim(), name: v.name!.trim() })}
            update={(id, c, isActive) =>
              client.organization.departments.update({ id, code: opt(c.code ?? ''), name: opt(c.name ?? ''), isActive })
            }
          />
        </TabsContent>
        <TabsContent value="designations" className="mt-5">
          <MasterSection
            title="Designations" exportSection="designations"
            canChange={canChange}
            shared
            rows={designations.data ?? []}
            loading={designations.isPending}
            {...nameOnly('designation', client.organization.designations)}
          />
        </TabsContent>
        <TabsContent value="positions" className="mt-5">
          <MasterSection title="Positions" exportSection="positions" canChange={canChange} shared rows={positions.data ?? []} loading={positions.isPending} {...nameOnly('position', client.organization.positions)} />
        </TabsContent>
        <TabsContent value="grades" className="mt-5">
          <MasterSection
            title="Grades" exportSection="grades"
            singular="grade"
            about="A seniority level. The rank orders grades: 1 is the most senior."
            canChange={canChange}
            shared
            rows={grades.data ?? []}
            loading={grades.isPending}
            // seniority order: rank 1 = the top
            sort={(a, b) => a.rank - b.rank}
            searchText={(g) => `${g.code} ${g.name}`}
            preview={(v) => ({ lead: <OrderBadge value={v.rank || '?'} title="Rank" />, title: v.name ?? '', subtitle: v.code })}
            item={(g) => ({ lead: <OrderBadge value={g.rank} title="Rank - lower is more senior" />, title: g.name, subtitle: g.code })}
            fields={[
              { name: 'code', label: 'Code', required: true, upperCase: true, hint: 'e.g. M1' },
              { name: 'name', label: 'Name', required: true, hint: 'e.g. Manager 1' },
              {
                name: 'rank',
                label: 'Rank',
                required: true,
                digitsOnly: 3,
                hint: 'Seniority order: a whole number 0-999, lower = more senior (1 = the top)',
              },
            ]}
            toValues={(g) => ({ code: g.code, name: g.name, rank: String(g.rank) })}
            create={(v) => client.organization.grades.create({ code: v.code!.trim(), name: v.name!.trim(), rank: Number(v.rank) })}
            update={(id, c, isActive) =>
              client.organization.grades.update({ id, code: opt(c.code ?? ''), name: opt(c.name ?? ''), rank: num(c.rank), isActive })
            }
          />
        </TabsContent>

        <TabsContent value="salary-components" className="mt-5">
          <MasterSection
            title="Salary components" exportSection="salaryComponents"
            singular="salary component"
            about="A line of the salary breakup in offer letters, or a deduction on the payslip."
            canChange={canChange}
            shared
            rows={salaryComponents.data ?? []}
            loading={salaryComponents.isPending}
            // as the offer letter's breakup prints them: earnings first, each group in its order; deductions last
            sort={(a, b) => SALARY_KIND_GROUP[a.kind].order - SALARY_KIND_GROUP[b.kind].order || a.displayOrder - b.displayOrder}
            groupBy={(s) => ({ key: s.kind, label: SALARY_KIND_GROUP[s.kind].label })}
            searchText={(s) => `${s.name} ${SALARY_KIND[s.kind]}`}
            preview={(v) => ({
              lead: <OrderBadge value={v.displayOrder || '?'} title="Order" />,
              title: v.name ?? '',
              subtitle: SALARY_KIND[v.kind as SalaryKind],
            })}
            item={(s) => ({ lead: <OrderBadge value={s.displayOrder} title="Order in the breakup" />, title: s.name })}
            fields={[
              { name: 'name', label: 'Name', required: true, placeholder: 'e.g. Special Allowance', hint: 'As printed in the salary breakup of the offer letter, or on the payslip' },
              {
                name: 'kind',
                label: 'Type',
                required: true,
                options: Object.entries(SALARY_KIND).map(([value, label]) => ({ value, label })),
                hint: 'Earnings add up to the Monthly Gross; employer contributions are paid on top (part of the CTC)',
              },
              { name: 'displayOrder', label: 'Order', required: true, digitsOnly: 3, placeholder: 'e.g. 65', hint: 'Position in the breakup - lower comes first' },
            ]}
            toValues={(s) => ({ name: s.name, kind: s.kind, displayOrder: String(s.displayOrder) })}
            create={(v) =>
              client.organization.salaryComponents.create({ name: v.name!.trim(), kind: v.kind as SalaryKind, displayOrder: Number(v.displayOrder) })
            }
            update={(id, c, isActive) =>
              client.organization.salaryComponents.update({
                id,
                name: opt(c.name ?? ''),
                kind: (c.kind || undefined) as SalaryKind | undefined,
                displayOrder: num(c.displayOrder),
                isActive,
              })
            }
          />
        </TabsContent>

        {canSeeMasters && (
          <TabsContent value="salary-structures" className="mt-5">
            <SalaryStructuresTab canChange={canChange} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}

const countryName = (code: string) => COUNTRY_OPTIONS.find((o) => o.value === code)?.label.replace(/ \(\w+\)$/, '') ?? code

// How many departments run at a plant - opens them (amber when none: nobody can be placed there yet)
function PlantDepartmentsButton({ plant, onOpen }: { plant: PlantRow; onOpen: (plant: PlantRow) => void }) {
  const n = plant._count.departments
  return (
    <button
      type="button"
      className={cn(
        'inline-flex h-7 min-w-9 shrink-0 items-center justify-center rounded-full px-2.5 text-xs font-medium tabular-nums transition-colors max-sm:h-9',
        n === 0 ? 'bg-warning/15 text-warning-ink hover:bg-warning/25' : 'bg-surface-2 hover:bg-hero hover:text-hero-foreground',
      )}
      title="See or change the departments that run at this plant"
      aria-label={`${n} departments - see or change them`}
      onClick={() => onOpen(plant)}
    >
      {n === 0 ? 'None' : n}
    </button>
  )
}

// The company a group of plants / cost centres belongs to
function CompanyHeading({ code, name }: { code: string; name: string }) {
  return (
    <>
      <span className="font-semibold">{code}</span>
      <span className="text-muted-foreground">{name}</span>
    </>
  )
}

// A code in front of a preview (a plant's, a cost centre's)
function CodeChip({ code }: { code: string | undefined }) {
  return <span className="grid h-8 min-w-12 shrink-0 place-items-center rounded-xl bg-surface-2 px-1.5 text-xs font-semibold text-foreground tabular-nums">{code || '?'}</span>
}

// A small number in front of a list entry (a grade's rank, a salary component's order)
function OrderBadge({ value, title }: { value: number | string; title: string }) {
  return (
    <span title={title} className="grid h-7 min-w-7 shrink-0 place-items-center rounded-lg bg-surface-2 px-1 text-xs font-semibold text-muted-foreground tabular-nums">
      {value}
    </span>
  )
}
