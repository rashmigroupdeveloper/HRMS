import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity,
  ArrowLeft,
  Award,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Circle,
  CircleCheck,
  ClipboardCheck,
  Download,
  FileClock,
  FileText,
  GraduationCap,
  HandHeart,
  HeartPulse,
  History as HistoryIcon,
  House,
  IdCard,
  Landmark,
  Lock,
  Mail,
  MapPin,
  Pencil,
  Phone,
  PiggyBank,
  Plus,
  ShieldCheck,
  Siren,
  Upload,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useLocation, useSearchParams } from 'react-router'
import type { JoiningFormSection } from '@/components/JoiningFormSections'
import { Pill } from '@/components/Pill'
import { PillTabsList, PillTabsTrigger } from '@/components/PillTabs'
import { SearchableSelect } from '@/components/SearchableSelect'
import { DocumentsSkeleton } from '@/components/skeletons/employees/DocumentsSkeleton'
import { EmployeeProfileSkeleton, type ProfileTab } from '@/components/skeletons/employees/EmployeeProfileSkeleton'
import { Button } from '@/components/ui/button'
import { DialogCancel, FormDialog } from '@/components/FormDialog'
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { type AccessArea, useAccess } from '@/hooks/useAccess'
import { client, orpc } from '@/lib/orpc'
import { cn, errorMessage, formatDate, formatDoneBy, initialsOf } from '@/lib/utils'
import { EmployeeDetailsDrawer } from './EmployeeDetailsDrawer'
import { EmployeeHistory } from './EmployeeHistory'
import { EmployeeJoiningTasks } from './EmployeeJoiningTasks'
import { EmployeeLetters } from './EmployeeLetters'
import { EmployeeSectionsDrawer } from './EmployeeSectionsDrawer'
import { JobOverview } from '@/components/JobOverview'
import { JobTimeline } from '@/components/JobTimeline'
import { SalaryCard } from '@/components/SalaryCard'
import { SalaryHistory } from '@/components/SalaryHistory'
import { Layoffs } from './Layoffs'
import { OnboardingChecklistDialog } from './OnboardingChecklistDialog'
import { Chip, EmptyNote, InfoCard, ItemList, ItemRow, type LineRow, Lines } from '@/components/ProfileCards'
import { StatutoryNumbersDialog } from './StatutoryNumbersDialog'
import {
  ADDRESS_TYPE,
  ageOf,
  BANK_ACCOUNT_TYPE,
  BLOOD,
  CATEGORY,
  DOCUMENT_TYPE,
  type EmployeeDocument,
  type EmployeeProfile,
  EPF_RELATIVE,
  FAMILY_RELATIONSHIP,
  fullName,
  GENDER,
  IDENTITY_TYPE,
  MARITAL,
  MEDICAL_CONDITION,
  masked,
  MEDICAL_RESULT,
  NOMINATION_SCHEME,
  SALUTATION,
  SPORT,
  STATUS_LABEL,
  VERIFICATION,
  yesNo,
} from './labels'

// The tabs HR can edit after joining, and the joining-form sections each one opens (phase 5, 2026-11-16)
const EDITABLE = {
  personal: { title: 'Personal details', what: 'personal details', area: 'EMPLOYEE_PERSONAL_DETAILS', sections: ['personal'] },
  contact: { title: 'Addresses & contacts', what: 'addresses & contacts', area: 'EMPLOYEE_PERSONAL_DETAILS', sections: ['addresses', 'emergencyContacts'] },
  ids: { title: 'IDs & bank', what: 'IDs & bank', area: 'EMPLOYEE_IDS_BANK', sections: ['identityDocuments', 'bankAccount'] },
  statutory: { title: 'PF & ESIC answers', what: 'PF & ESIC answers', area: 'EMPLOYEE_IDS_BANK', sections: ['statutory'] },
  background: {
    title: 'Education & work',
    what: 'education & work',
    area: 'EMPLOYEE_PERSONAL_DETAILS',
    sections: ['qualifications', 'certifications', 'previousJobs'],
  },
  family: { title: 'Family & nominees', what: 'family & nominees', area: 'EMPLOYEE_PERSONAL_DETAILS', sections: ['familyMembers', 'nominees', 'gratuity'] },
  medical: { title: 'Medical information', what: 'medical information', area: 'MEDICAL', sections: ['medical'] },
} satisfies Record<string, { title: string; what: string; area: AccessArea; sections: JoiningFormSection[] }>
type EditableTab = keyof typeof EDITABLE
const isEditable = (tab: string): tab is EditableTab => tab in EDITABLE

// The status dot in the header
const STATUS_DOT: Record<keyof typeof STATUS_LABEL, string> = { ACTIVE: 'bg-positive', ON_NOTICE: 'bg-warning', EXITED: 'bg-hero-muted' }

// One fact in the header as a small chip with its icon
function Fact({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <li className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-hero-foreground/[0.07] px-2.5 py-1">
      <Icon aria-hidden className="size-3.5 shrink-0 text-gold" />
      <span className="truncate">{children}</span>
    </li>
  )
}

// The left menu's groups, in order - one per access area, so who gives access sees what each opens (the user,
// 2026-11-21): '' = Employee · Directory & job (Job, Record), then Personal, IDs, bank & statutory, Salary, Documents &
// letters, Medical, and History (Change history). A group of one tab shows no heading - the tab is its name.
const TAB_GROUPS = ['', 'Personal', 'IDs, bank & statutory', 'Salary', 'Documents & letters', 'Medical', 'History'] as const

// Every tab in menu order, with the area that shows it (none: always shown) - also the skeleton's tabs while it loads
const PROFILE_TABS: (ProfileTab & { group: (typeof TAB_GROUPS)[number]; area?: AccessArea })[] = [
  { value: 'job', label: 'Job', icon: BriefcaseBusiness, group: '' },
  { value: 'personal', label: 'Personal', icon: UserRound, group: 'Personal', area: 'EMPLOYEE_PERSONAL_DETAILS' },
  { value: 'contact', label: 'Addresses & contacts', icon: House, group: 'Personal', area: 'EMPLOYEE_PERSONAL_DETAILS' },
  { value: 'background', label: 'Education & work', icon: GraduationCap, group: 'Personal', area: 'EMPLOYEE_PERSONAL_DETAILS' },
  { value: 'family', label: 'Family & nominees', icon: Users, group: 'Personal', area: 'EMPLOYEE_PERSONAL_DETAILS' },
  { value: 'ids', label: 'IDs & bank', icon: IdCard, group: 'IDs, bank & statutory', area: 'EMPLOYEE_IDS_BANK' },
  { value: 'statutory', label: 'PF & ESIC', icon: ShieldCheck, group: 'IDs, bank & statutory', area: 'EMPLOYEE_IDS_BANK' },
  // confidential: the employee themselves or the "Employee · Salary" access
  { value: 'salary', label: 'Salary', icon: Wallet, group: 'Salary', area: 'SALARY' },
  { value: 'documents', label: 'Documents', icon: FileText, group: 'Documents & letters', area: 'EMPLOYEE_DOCUMENTS' },
  { value: 'letters', label: 'Letters', icon: Mail, group: 'Documents & letters', area: 'EMPLOYEE_DOCUMENTS' },
  // health data: the employee themselves or the "Employee · Medical" access
  { value: 'medical', label: 'Medical', icon: HeartPulse, group: 'Medical', area: 'MEDICAL' },
  { value: 'record', label: 'Record', icon: FileClock, group: '' },
  { value: 'history', label: 'History', icon: HistoryIcon, group: 'History', area: 'CHANGE_HISTORY' },
]

// "Joined 01 Apr 2025 · 1 yr 7 mo" - how long they have been here (shown only, not stored); a future date "Joins ..."
function joinedText(value: Date) {
  const from = new Date(value)
  const now = new Date()
  if (from > now) return `Joins ${formatDate(from)}`
  let months = (now.getFullYear() - from.getFullYear()) * 12 + now.getMonth() - from.getMonth()
  if (now.getDate() < from.getDate()) months--
  const years = Math.floor(months / 12)
  const rest = months % 12
  const length = months < 1 ? 'new joiner' : [years && `${years} yr`, rest && `${rest} mo`].filter(Boolean).join(' ')
  return `Joined ${formatDate(from)} · ${length}`
}

// One employee's profile: job and placement, personal details, addresses and contacts, IDs and bank (last 4
// digits only), PF / ESIC, education and previous jobs, family and nominees, documents and the record history.
// Two views (decided 2026-11-15): `self` - the employee's own profile at /me (MyProfilePage), what the employee sees,
// without HR's actions and internal parts; otherwise HR's view at /employees/:code (EmployeeProfilePage, Employees:
// View). The backend checks every request itself (own record, or Employees: View).
export function EmployeeProfile({ employeeCode, self }: { employeeCode: string; self: boolean }) {
  const access = useAccess()
  // HR's actions and internal parts only in HR's view
  const can: typeof access.can = (area, level) => !self && access.can(area, level)
  // the open tab is in the address (?tab=salary), so a link can open one (the home page's quick links)
  const [params, setParams] = useSearchParams()
  const { search } = useLocation()
  const tab = params.get('tab') ?? 'job'
  const [editingNumbers, setEditingNumbers] = useState(false)
  const [editingChecklist, setEditingChecklist] = useState(false)
  const [editingDetails, setEditingDetails] = useState(false)
  // the tab whose records HR is editing
  const [editingTab, setEditingTab] = useState<EditableTab | null>(null)
  // ('' = one's own code is not known yet - /me before accounts.me answers: the skeleton shows until it is)
  const profile = useQuery({ ...orpc.employees.getByCode.queryOptions({ input: { employeeCode } }), enabled: employeeCode !== '' })

  // the way back to the list - shown while the profile loads too
  const back = can('EMPLOYEES') && (
    <Button variant="ghost" size="sm" className="-ml-3" nativeButton={false} render={<Link to="/employees?view=records" />}>
      <ArrowLeft /> People
    </Button>
  )

  const openTab = (value: string) => setParams(value === 'job' ? {} : { tab: value }, { replace: true })

  if (profile.isPending) {
    // the real tabs while it loads - the ones the viewer's roles may open (one's own: all but History) - and the open
    // tab's edit button
    // (before accounts.me answers - a hard refresh - the access is not known yet: all of them)
    const guess = PROFILE_TABS.filter((t) => !t.area || (self ? t.area !== 'CHANGE_HISTORY' : !access.ready || access.can(t.area)))
    const active = guess.some((t) => t.value === tab) ? tab : 'job'
    const editArea = isEditable(active) ? EDITABLE[active].area : active === 'job' ? 'EMPLOYEES' : null
    const editLabel = editArea && can(editArea, 'WRITE') ? (isEditable(active) ? `Edit ${EDITABLE[active].what}` : 'Edit details') : null
    return (
      <div className="space-y-6">
        {back}
        <EmployeeProfileSkeleton
          tabs={guess}
          groups={TAB_GROUPS}
          active={active}
          onTab={openTab}
          self={self}
          edit={editLabel}
          hr={can('EMPLOYEES')}
          manageDocuments={can('EMPLOYEE_DOCUMENTS', 'WRITE')}
          label="Loading the profile"
        />
      </div>
    )
  }
  if (profile.error) return <p className="text-sm text-negative-ink">{errorMessage(profile.error)}</p>
  const e = profile.data
  // a code they had before a company transfer finds them (2026-11-20): the page moves to their code now
  if (!self && e.employeeCode !== employeeCode.toUpperCase()) return <Navigate to={`/employees/${e.employeeCode}${search}`} replace />
  // a tab of a part the viewer may not see (e.g. an old link ?tab=ids) opens the job tab instead
  const here = { companyId: e.company.id, plantId: e.plant.id, departmentId: e.department?.id ?? null }
  // a tab that would only say "no access" is not shown (2026-11-21); one's own profile shows salary and medical always
  const seesSalary = self || access.covers('SALARY', 'READ', here)
  const seesMedical = self || access.covers('MEDICAL', 'READ', here)
  // who changed what: Change history View covering the employee - not Employees View, not on one's own profile
  const seesHistory = !self && access.covers('CHANGE_HISTORY', 'READ', here)
  const hiddenTab =
    (['personal', 'contact', 'background', 'family'].includes(tab) && e.personalDetailsHidden) ||
    (['ids', 'statutory'].includes(tab) && e.idsBankHidden) ||
    (['documents', 'letters'].includes(tab) && e.documentsHidden) ||
    (tab === 'salary' && !seesSalary) ||
    (tab === 'medical' && !seesMedical) ||
    (tab === 'history' && !seesHistory)
  const shownTab = hiddenTab ? 'job' : tab
  // the tabs the viewer may see (each part with an area of its own shows only with it - split 2026-11-16, the server
  // leaves it empty)
  const sees: Partial<Record<AccessArea, boolean>> = {
    EMPLOYEE_PERSONAL_DETAILS: !e.personalDetailsHidden,
    EMPLOYEE_IDS_BANK: !e.idsBankHidden,
    SALARY: seesSalary,
    EMPLOYEE_DOCUMENTS: !e.documentsHidden,
    MEDICAL: seesMedical,
    CHANGE_HISTORY: seesHistory,
  }
  const tabs = PROFILE_TABS.filter((t) => !t.area || sees[t.area])
  // One edit button, in the header, for the open tab (2026-11-17): the Job tab edits the core record (Employee directory
  // & job: Edit); a records tab opens its sections with that part's access ("Edit IDs & bank"); a tab with nothing to
  // edit this way (documents, letters, salary, record - they have their own actions) shows none
  const edit =
    isEditable(shownTab) && can(EDITABLE[shownTab].area, 'WRITE')
      ? { label: `Edit ${EDITABLE[shownTab].what}`, open: () => setEditingTab(shownTab) }
      : shownTab === 'job' && can('EMPLOYEES', 'WRITE')
        ? { label: 'Edit details', open: () => setEditingDetails(true) }
        : null

  return (
    <div className="space-y-6">
      {back}

      {/* the header (compact, 2026-11-17): initials tile, name with status and code, the position, then the key facts as
          small chips; the one edit button for the open tab on the right */}
      <header className="u-grain relative overflow-hidden rounded-3xl bg-hero px-4 py-4 text-hero-foreground shadow-card sm:px-5">
        <span aria-hidden className="pointer-events-none absolute -top-24 -right-20 size-64 rounded-full bg-gold/15 blur-3xl" />
        <div className="relative flex flex-wrap items-center gap-x-4 gap-y-3">
          <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gold text-base font-semibold text-gold-foreground shadow-card sm:size-14 sm:text-lg">
            {`${e.firstName.charAt(0)}${e.lastName?.charAt(0) ?? ''}`.toUpperCase()}
          </span>
          <div className="min-w-48 flex-1">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <h1 className="text-2xl font-light tracking-tight sm:text-[28px] sm:leading-9">{fullName(e)}</h1>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-hero-foreground/10 px-2 py-0.5 text-[11px] font-medium">
                <span aria-hidden className={cn('size-1.5 rounded-full', STATUS_DOT[e.status])} />
                {STATUS_LABEL[e.status]}
              </span>
              <span className="rounded-full border border-hero-foreground/15 px-2 py-0.5 text-[11px] font-medium text-hero-foreground/80 tabular-nums">{e.employeeCode}</span>
              {self && <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[11px] font-medium text-gold">My profile</span>}
            </div>
            <p className="mt-0.5 text-sm text-hero-foreground/70">
              {e.designation?.name ? <span className="font-medium text-hero-foreground/90">{e.designation.name}</span> : 'No designation yet'}
              {e.department?.name && ` · ${e.department.name}`}
            </p>
          </div>
          {edit && (
            <Button variant="gold" size="sm" className="shrink-0" onClick={edit.open}>
              <Pencil /> {edit.label}
            </Button>
          )}
        </div>
        <ul className="relative mt-3 flex flex-wrap gap-1.5 border-t border-hero-foreground/10 pt-3 text-xs text-hero-foreground/80">
          <Fact icon={Building2}>{e.company.name}</Fact>
          {e.workLocation && <Fact icon={MapPin}>{e.workLocation.name}</Fact>}
          <Fact icon={CalendarDays}>{joinedText(e.dateOfJoining)}</Fact>
          {e.reportingManager && (
            <Fact icon={UserRound}>
              Reports to{' '}
              {can('EMPLOYEES') ? (
                <Link to={`/employees/${e.reportingManager.employeeCode}`} className="font-medium text-hero-foreground underline-offset-2 hover:underline">
                  {e.reportingManager.name}
                </Link>
              ) : (
                <span className="font-medium text-hero-foreground">{e.reportingManager.name}</span>
              )}
            </Fact>
          )}
          {e.workEmail && <Fact icon={Mail}>{e.workEmail}</Fact>}
          {e.mobile && <Fact icon={Phone}>{e.mobile}</Fact>}
        </ul>
      </header>
      {editingDetails && <EmployeeDetailsDrawer employee={e} onClose={() => setEditingDetails(false)} />}
      {editingTab && (
        <EmployeeSectionsDrawer
          employeeCode={e.employeeCode}
          name={fullName(e)}
          title={EDITABLE[editingTab].title}
          sections={EDITABLE[editingTab].sections}
          onClose={() => setEditingTab(null)}
        />
      )}

      {/* The tabs: a menu on the left on a wide screen (2026-11-21 - twelve tabs did not fit in one row; grouped, it stays in
          view while the tab scrolls), the pill row on top below that (narrower screens keep the whole width for the cards) */}
      <Tabs value={shownTab} onValueChange={(value) => openTab(String(value))} className="xl:grid xl:grid-cols-[13rem_minmax(0,1fr)] xl:items-start xl:gap-x-5">
        <PillTabsList className="xl:hidden">
          {tabs.map((t) => (
            <PillTabsTrigger key={t.value} value={t.value}>
              {t.label}
            </PillTabsTrigger>
          ))}
        </PillTabsList>
        <nav aria-label="Profile sections" className="sticky top-4 col-start-1 row-start-1 space-y-2 rounded-3xl bg-card p-2 shadow-card max-xl:hidden">
          {TAB_GROUPS.map((group) => {
            const items = tabs.filter((t) => t.group === group)
            return (
              items.length > 0 && (
                <div key={group || 'top'}>
                  {group && items.length > 1 && <p className="px-3 pt-1 pb-1 text-xs font-medium text-muted-foreground">{group}</p>}
                  <ul className="space-y-0.5">
                    {items.map((t) => (
                      <li key={t.value}>
                        <button
                          type="button"
                          aria-current={shownTab === t.value ? 'page' : undefined}
                          onClick={() => openTab(t.value)}
                          className={cn(
                            'flex h-9 w-full items-center gap-2.5 rounded-xl px-3 text-left text-sm transition-colors',
                            shownTab === t.value ? 'bg-hero font-medium text-hero-foreground shadow-card' : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground',
                          )}
                        >
                          <t.icon className="size-4 shrink-0" />
                          <span className="truncate">{t.label}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            )
          })}
        </nav>

        <TabsContent value="job" className="mt-4 xl:col-start-2 xl:row-start-1 xl:mt-0">
          <JobOverview employee={e} self={self} />
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <JobTimeline employee={e} canSeeChanges={!self && access.can('EMPLOYEES')} />
            <Layoffs employeeCode={e.employeeCode} />
          </div>
        </TabsContent>

        <TabsContent value="personal" className="mt-4 xl:col-start-2 xl:row-start-1 xl:mt-0">
          <div className="grid gap-4 lg:grid-cols-3">
            <InfoCard icon={UserRound} title="About">
              <Lines
                rows={[
                  ['Salutation', e.salutation && SALUTATION[e.salutation]],
                  ['Gender', e.gender && GENDER[e.gender]],
                  ['Date of birth', e.dateOfBirth && `${formatDate(e.dateOfBirth)} · ${ageOf(e.dateOfBirth) ?? ''}`],
                  ['Place of birth', e.placeOfBirth],
                  ['Nationality', e.nationality],
                  ['Country of origin', e.countryOfOrigin],
                  ['Religion', e.religion],
                  ['Category', e.category && CATEGORY[e.category]],
                ]}
              />
            </InfoCard>
            <InfoCard icon={Users} title="Family">
              <Lines
                rows={[
                  ["Father's name", e.fatherName],
                  ["Mother's name", e.motherName],
                  ['Marital status', e.maritalStatus && MARITAL[e.maritalStatus]],
                  ["Spouse's name", e.spouseName],
                  ['Date of marriage', e.marriageDate && formatDate(e.marriageDate)],
                ]}
              />
            </InfoCard>
            <InfoCard icon={HeartPulse} title="Physical and other">
              <Lines
                rows={[
                  ['Blood group', e.bloodGroup && BLOOD[e.bloodGroup]],
                  ['Height', e.heightCm && `${e.heightCm} cm`],
                  ['Weight', e.weightKg && `${e.weightKg} kg`],
                  ['Identification mark', e.identificationMark],
                  [
                    'Physically disabled',
                    e.isPhysicallyDisabled
                      ? `Yes${e.disabilityType ? ` - ${e.disabilityType}` : ''}${e.disabilityPercent != null ? ` (${e.disabilityPercent}%)` : ''}`
                      : 'No',
                  ],
                  ['Hobbies', e.hobbies],
                ]}
              />
            </InfoCard>
          </div>
        </TabsContent>

        <TabsContent value="contact" className="mt-4 xl:col-start-2 xl:row-start-1 xl:mt-0">
          <div className="grid gap-4 lg:grid-cols-2">
            <InfoCard icon={House} title="Addresses" aside={e.addresses.length > 0 && <Chip>{e.addresses.length}</Chip>}>
              {e.addresses.length === 0 ? (
                <EmptyNote>No address recorded.</EmptyNote>
              ) : (
                <ItemList>
                  {e.addresses.map((a) => (
                    <ItemRow
                      key={a.type}
                      icon={MapPin}
                      title={ADDRESS_TYPE[a.type]}
                      details={[[a.houseNo, a.locality, a.cityOrVillage, a.district, a.state, a.postalCode, a.countryCode].filter(Boolean).join(', ')]}
                      extra={
                        (a.postOffice || a.policeStation || a.subDivision) && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {a.postOffice && <Chip>PO {a.postOffice}</Chip>}
                            {a.policeStation && <Chip>PS {a.policeStation}</Chip>}
                            {a.subDivision && <Chip>Sub-division {a.subDivision}</Chip>}
                          </div>
                        )
                      }
                    />
                  ))}
                </ItemList>
              )}
            </InfoCard>
            <InfoCard icon={Siren} title="Emergency contacts" aside={e.emergencyContacts.length > 0 && <Chip>{e.emergencyContacts.length}</Chip>}>
              {e.emergencyContacts.length === 0 ? (
                <EmptyNote>No emergency contact recorded.</EmptyNote>
              ) : (
                <ItemList>
                  {e.emergencyContacts.map((c, i) => (
                    <ItemRow
                      key={i}
                      initials={initialsOf(c.name)}
                      title={c.name}
                      chips={<Chip tone="gold">{c.relationship}</Chip>}
                      details={[
                        <span key="m" className="inline-flex items-center gap-1 font-medium text-foreground tabular-nums">
                          <Phone className="size-3" /> {[c.mobile, c.alternateMobile].filter(Boolean).join(' / ')}
                        </span>,
                        c.address,
                      ]}
                    />
                  ))}
                </ItemList>
              )}
            </InfoCard>
          </div>
        </TabsContent>

        <TabsContent value="ids" className="mt-4 xl:col-start-2 xl:row-start-1 xl:mt-0">
          <div className="grid gap-4 lg:grid-cols-2">
            <InfoCard icon={IdCard} title="Identity documents" aside={<span className="text-xs text-muted-foreground">Stored encrypted · last 4 digits shown</span>}>
              {e.identityDocuments.length === 0 ? (
                <EmptyNote />
              ) : (
                <ItemList>
                  {e.identityDocuments.map((d) => (
                    <ItemRow
                      key={d.type}
                      icon={IdCard}
                      title={IDENTITY_TYPE[d.type]}
                      chips={
                        d.validUntil &&
                        (isPast(d.validUntil) ? <Chip tone="negative">Expired {formatDate(d.validUntil)}</Chip> : <Chip>Valid until {formatDate(d.validUntil)}</Chip>)
                      }
                      details={[
                        <span key="n" className="font-medium text-foreground tabular-nums">
                          {masked(d.numberLast4)}
                        </span>,
                        d.nameOnDocument,
                        d.issuingCountry,
                      ]}
                    />
                  ))}
                </ItemList>
              )}
            </InfoCard>
            <InfoCard icon={Landmark} title="Bank accounts">
              {e.bankAccounts.length === 0 ? (
                <EmptyNote />
              ) : (
                <div className="grid gap-3">
                  {e.bankAccounts.map((b, i) => (
                    <BankCard key={i} b={b} />
                  ))}
                </div>
              )}
            </InfoCard>
          </div>
        </TabsContent>

        <TabsContent value="statutory" className="mt-4 xl:col-start-2 xl:row-start-1 xl:mt-0">
          {e.statutory ? (
            <Statutory s={e.statutory} onEditNumbers={can('EMPLOYEE_IDS_BANK', 'WRITE') ? () => setEditingNumbers(true) : undefined} />
          ) : (
            <InfoCard
              icon={ShieldCheck}
              title="PF and ESIC"
              aside={
                can('EMPLOYEE_IDS_BANK', 'WRITE') && (
                  <Button variant="ghost" size="sm" onClick={() => setEditingNumbers(true)}>
                    <Pencil /> Edit numbers
                  </Button>
                )
              }
            >
              <EmptyNote>No PF / ESIC details recorded.</EmptyNote>
            </InfoCard>
          )}
          {editingNumbers && <StatutoryNumbersDialog employeeCode={e.employeeCode} current={e.statutory} onClose={() => setEditingNumbers(false)} />}
        </TabsContent>

        <TabsContent value="background" className="mt-4 xl:col-start-2 xl:row-start-1 xl:mt-0">
          <div className="grid gap-4 lg:grid-cols-2">
            <InfoCard icon={GraduationCap} title="Education" aside={e.qualifications.length > 0 && <Chip>{e.qualifications.length}</Chip>}>
              {e.qualifications.length === 0 ? (
                <EmptyNote />
              ) : (
                <ItemList>
                  {e.qualifications.map((q, i) => (
                    <ItemRow
                      key={i}
                      icon={GraduationCap}
                      title={q.qualification}
                      chips={<Chip>{q.yearOfPassing}</Chip>}
                      details={[q.institute, q.specialization, q.score && <span key="s">Score {q.score}</span>]}
                    />
                  ))}
                </ItemList>
              )}
            </InfoCard>
            <InfoCard icon={Award} title="Additional certifications" aside={e.certifications.length > 0 && <Chip>{e.certifications.length}</Chip>}>
              {e.certifications.length === 0 ? (
                <EmptyNote />
              ) : (
                <ItemList>
                  {e.certifications.map((c, i) => (
                    <ItemRow
                      key={i}
                      icon={Award}
                      title={c.name}
                      chips={c.certifiedOn && <Chip>{formatDate(c.certifiedOn)}</Chip>}
                      details={[c.issuedBy, c.specialization, c.score && <span key="s">Score {c.score}</span>]}
                    />
                  ))}
                </ItemList>
              )}
            </InfoCard>
            <InfoCard
              icon={BriefcaseBusiness}
              title="Previous employment"
              className="lg:col-span-2"
              aside={e.previousJobs.length > 0 && <Chip>{e.previousJobs.length}</Chip>}
            >
              {e.previousJobs.length === 0 ? (
                <EmptyNote />
              ) : (
                <ItemList>
                  {e.previousJobs.map((j, i) => (
                    <ItemRow
                      key={i}
                      icon={Building2}
                      title={j.employerName}
                      chips={<Chip tone="gold">{spanOf(j.fromDate, j.toDate)}</Chip>}
                      details={[j.designation, `${formatDate(j.fromDate)} – ${formatDate(j.toDate)}`, j.reasonForLeaving && `left: ${j.reasonForLeaving}`]}
                    />
                  ))}
                </ItemList>
              )}
            </InfoCard>
          </div>
        </TabsContent>

        <TabsContent value="family" className="mt-4 xl:col-start-2 xl:row-start-1 xl:mt-0">
          <div className="grid gap-4 lg:grid-cols-2">
            <InfoCard icon={Users} title="Family" aside={e.familyMembers.length > 0 && <Chip>{e.familyMembers.length}</Chip>}>
              {e.familyMembers.length === 0 ? (
                <EmptyNote />
              ) : (
                <ItemList>
                  {e.familyMembers.map((m, i) => (
                    <ItemRow
                      key={i}
                      initials={initialsOf(m.name)}
                      title={m.name}
                      chips={<Chip tone="gold">{FAMILY_RELATIONSHIP[m.relationship]}</Chip>}
                      details={[
                        m.gender && GENDER[m.gender],
                        m.dateOfBirth && `born ${formatDate(m.dateOfBirth)} (${ageOf(m.dateOfBirth) ?? '—'})`,
                        m.aadhaarLast4 && `Aadhaar ${masked(m.aadhaarLast4)}`,
                        m.livesWithEmployee === false
                          ? `lives in ${[m.residenceTown, m.residenceState].filter(Boolean).join(', ') || '—'}`
                          : m.livesWithEmployee && 'lives with the employee',
                        m.preExistingDisease && `pre-existing disease: ${m.preExistingDisease}`,
                      ]}
                    />
                  ))}
                </ItemList>
              )}
            </InfoCard>
            <InfoCard icon={HandHeart} title="Nominees">
              {e.nominees.length === 0 ? <EmptyNote /> : <Nominees nominees={e.nominees} />}
            </InfoCard>
          </div>
        </TabsContent>

        <TabsContent value="documents" className="mt-4 xl:col-start-2 xl:row-start-1 xl:mt-0">
          <Documents employeeCode={e.employeeCode} canManage={can('EMPLOYEE_DOCUMENTS', 'WRITE')} />
        </TabsContent>

        {/* letters issued to the employee (appointment, confirmation, experience, relieving) - with the documents' access */}
        <TabsContent value="letters" className="mt-4 xl:col-start-2 xl:row-start-1 xl:mt-0">
          <EmployeeLetters employeeCode={e.employeeCode} canIssue={can('EMPLOYEE_DOCUMENTS', 'WRITE')} />
        </TabsContent>

        <TabsContent value="salary" className="mt-4 xl:col-start-2 xl:row-start-1 xl:mt-0">
          {e.salary ? (
            <div className="space-y-4">
              <SalaryCard s={e.salary} />
              <SalaryHistory employeeCode={e.employeeCode} />
            </div>
          ) : (
            <InfoCard icon={Wallet} title="Salary">
              <EmptyNote>No salary saved yet.</EmptyNote>
            </InfoCard>
          )}
        </TabsContent>

        <TabsContent value="medical" className="mt-4 xl:col-start-2 xl:row-start-1 xl:mt-0">
          {e.medicalInfo ? (
            <MedicalInfo m={e.medicalInfo} heightCm={e.heightCm} weightKg={e.weightKg} />
          ) : (
            <InfoCard icon={HeartPulse} title="Medical information">
              <EmptyNote>No medical information yet.</EmptyNote>
            </InfoCard>
          )}
        </TabsContent>

        <TabsContent value="record" className="mt-4 xl:col-start-2 xl:row-start-1 xl:mt-0 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <InfoCard icon={FileClock} title="Record">
              <Lines
                rows={[
                  ['Created', formatDoneBy(e.createdAt, e.createdBy)],
                  ['Last changed', formatDoneBy(e.updatedAt, e.updatedBy)],
                  ['Joining completed', e.joining?.completedAt ? formatDoneBy(e.joining.completedAt, e.joining.completedBy) : 'Imported or created directly'],
                  [
                    'Joining form signed online',
                    e.joining?.declarationAcceptedAt && formatDoneBy(e.joining.declarationAcceptedAt, { name: 'the employee' }),
                  ],
                  ['Pre-employment medical', preEmploymentMedical(e.joining)],
                  // HR's own references - not shown to the employee on their own profile
                  ...(can('EMPLOYEES') ? ([['Joined from offer', e.candidateId && `Candidate #${e.candidateId}`]] as LineRow[]) : []),
                ]}
              />
            </InfoCard>
            {/* the joining form's "For HR / Office Use Only" box (JF §11) - HR's, not shown to the employee */}
            {can('EMPLOYEES') && (
              <InfoCard
                icon={ClipboardCheck}
                title="For HR / office use"
                aside={
                  can('EMPLOYEES', 'WRITE') && (
                    <Button variant="ghost" size="sm" onClick={() => setEditingChecklist(true)}>
                      <Pencil /> Update
                    </Button>
                  )
                }
              >
                <ul className="divide-y divide-border/70">
                  <Check
                    label="Joining formalities completed"
                    done={e.joining?.joiningFormalitiesCompletedAt && formatDoneBy(e.joining.joiningFormalitiesCompletedAt, e.joining.joiningFormalitiesCompletedBy)}
                  />
                  <Check label="Payroll updated" done={e.joining?.payrollUpdatedAt && formatDoneBy(e.joining.payrollUpdatedAt, e.joining.payrollUpdatedBy)} />
                  <Check label="ID card / access created" done={e.joining?.idCardIssuedAt && formatDoneBy(e.joining.idCardIssuedAt, e.joining.idCardIssuedBy)} />
                  <Check label="Induction" done={e.joining?.inductionDate && formatDate(e.joining.inductionDate)} pending="Not scheduled" />
                </ul>
              </InfoCard>
            )}
          </div>
          {editingChecklist && (
            <OnboardingChecklistDialog employeeCode={e.employeeCode} current={e.joining} onClose={() => setEditingChecklist(false)} />
          )}
          {/* the tasks other teams do for the new employee (e-mail ID, laptop, ID card...) - HR's view only */}
          {can('EMPLOYEES') && <EmployeeJoiningTasks employeeCode={e.employeeCode} />}
        </TabsContent>

        {/* every change to this employee's records and their sign-ins - Change history View (its own tab, 2026-11-21) */}
        <TabsContent value="history" className="mt-4 xl:col-start-2 xl:row-start-1 xl:mt-0">
          {seesHistory && <EmployeeHistory employeeCode={e.employeeCode} />}
        </TabsContent>
      </Tabs>
    </div>
  )
}

// The medical information (health data) - the joining form's "Employee Medical Information" pages
function MedicalInfo({
  m,
  heightCm,
  weightKg,
}: {
  m: NonNullable<EmployeeProfile['medicalInfo']>
  heightCm: number | null
  weightKg: number | null
}) {
  const answer = (yes: boolean | null, details: string | null) => (yes === null ? null : yes ? `Yes${details ? ` - ${details}` : ''}` : 'No')
  const bmi = heightCm && weightKg ? (weightKg / (heightCm / 100) ** 2).toFixed(1) : null
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <InfoCard
        icon={HeartPulse}
        title="Medical history - self"
        aside={bmi && <Chip tone="gold">BMI {bmi}</Chip>}
      >
        <Lines
          rows={[
            ['Conditions', [...m.conditions.map((c) => MEDICAL_CONDITION[c]), m.otherConditions].filter(Boolean).join(', ') || 'None'],
            ['Taking medication', answer(m.takesMedication, m.medications)],
            ['Physical limitations', answer(m.hasPhysicalLimitations, m.physicalLimitations)],
            ['Surgery / major treatment (5 years)', answer(m.hadSurgery, m.surgeries)],
            ['Allergies', answer(m.hasAllergies, m.allergies)],
            ['Height / weight', [heightCm && `${heightCm} cm`, weightKg && `${weightKg} kg`].filter(Boolean).join(' · ')],
          ]}
        />
      </InfoCard>
      <InfoCard icon={Users} title="Medical history - family">
        <Lines
          rows={[
            ['Heart disease', m.familyHeartDisease],
            ['Diabetes', m.familyDiabetes],
            ['High blood pressure', m.familyHighBloodPressure],
            ['Cancer', m.familyCancer],
            ['Stroke', m.familyStroke],
            ['Mental health disorder', m.familyMentalHealth],
            ['Genetic disorder', m.familyGeneticDisorders],
            ['Other', m.familyOther],
            ['Hereditary condition', answer(m.hasHereditaryCondition, m.hereditaryCondition)],
            ['Unplanned health leave', answer(m.needsHealthLeave, m.healthLeave)],
          ]}
        />
      </InfoCard>
      <InfoCard icon={Activity} title="Lifestyle and care" aside={m.consentAt && <Chip tone="positive">Consent {formatDate(m.consentAt)}</Chip>}>
        <Lines
          rows={[
            ['Smokes / tobacco', answer(m.smokes, null)],
            ['Alcohol', answer(m.drinksAlcohol, null)],
            ['Exercises regularly', answer(m.exercisesRegularly, m.exerciseFrequency)],
            ['Emergency medical care', answer(m.needsEmergencyCare, m.emergencyCare)],
            ['Sports', [...m.sports.filter((s) => s !== 'OTHER').map((s) => SPORT[s]), m.otherSports].filter(Boolean).join(', ') || 'None'],
            ['How often', m.sportsFrequency],
          ]}
        />
      </InfoCard>
    </div>
  )
}

// EPF (Form 11) and ESIC (Form 1) side by side, each with whether it applies. `onEditNumbers`: the numbers given after
// joining (UAN, PF member number, ESIC IP number) - "Employee · IDs, bank & statutory": Edit
function Statutory({ s, onEditNumbers }: { s: NonNullable<EmployeeProfile['statutory']>; onEditNumbers?: () => void }) {
  const editNumbers = onEditNumbers && (
    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onEditNumbers}>
      <Pencil /> Edit numbers
    </Button>
  )
  const applies = (value: boolean | null) =>
    value === null ? null : value ? <Chip tone="positive">Applicable</Chip> : <Chip>Not applicable</Chip>
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <InfoCard
        icon={PiggyBank}
        title="EPF (Form 11)"
        aside={
          <div className="flex items-center gap-1">
            {editNumbers}
            {applies(s.pfApplicable)}
          </div>
        }
      >
        <Lines
          rows={[
            ['UAN', s.uan && <span key="uan" className="tabular-nums">{s.uan}</span>],
            ['PF member number', s.pfNumber],
            ['Relative on EPF', EPF_RELATIVE[s.epfRelative]],
            ['Mobile registered with Aadhaar', s.aadhaarMobile],
            ['International worker', yesNo(s.isInternationalWorker)],
            ['Earlier EPF / EPS member', `${yesNo(s.wasEpfMember)} / ${yesNo(s.wasEpsMember)}`],
            ['Previous PF number', s.previousPfNumber],
            ['Previous exit date', s.previousExitDate && formatDate(s.previousExitDate)],
            ['Scheme certificate / PPO', [s.schemeCertificateNumber, s.ppoNumber].filter(Boolean).join(' / ')],
          ]}
        />
      </InfoCard>
      <InfoCard
        icon={ShieldCheck}
        title="ESIC (Form 1)"
        aside={
          <div className="flex items-center gap-1">
            {editNumbers}
            {applies(s.esicApplicable)}
          </div>
        }
      >
        <Lines
          rows={[
            ['IP number', s.esicIpNumber && <span key="ip" className="tabular-nums">{s.esicIpNumber}</span>],
            ['Branch office / dispensary', [s.esicBranchOffice, s.esicDispensary].filter(Boolean).join(' / ')],
            ['Previous IP number', s.previousEsicIpNumber],
            ['Previous employer', [s.previousEmployerName, s.previousEmployerCode].filter(Boolean).join(' · ')],
          ]}
        />
      </InfoCard>
    </div>
  )
}

// A bank account drawn like a card: the bank, the masked number, the holder, IFSC and type
function BankCard({ b }: { b: EmployeeProfile['bankAccounts'][number] }) {
  return (
    <div className="u-grain relative overflow-hidden rounded-2xl bg-hero p-4 text-hero-foreground">
      <span aria-hidden className="pointer-events-none absolute -top-16 -right-12 size-40 rounded-full bg-gold/20 blur-2xl" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{b.bankName}</p>
          {b.branch && <p className="truncate text-xs text-hero-foreground/60">{b.branch}</p>}
        </div>
        {b.isSalaryAccount && <span className="shrink-0 rounded-full bg-gold px-2 py-0.5 text-[11px] font-semibold text-gold-foreground">Salary account</span>}
      </div>
      <p className="relative mt-4 font-mono text-lg tracking-[0.18em] tabular-nums">•••• •••• {b.accountNumberLast4}</p>
      <div className="relative mt-2 flex flex-wrap items-end justify-between gap-x-4 gap-y-1 text-xs text-hero-foreground/70">
        <span className="font-medium text-hero-foreground/90 uppercase">{b.accountHolderName}</span>
        <span className="tabular-nums">
          {[b.ifsc, BANK_ACCOUNT_TYPE[b.accountType]].filter(Boolean).join(' · ')}
        </span>
      </div>
    </div>
  )
}

// The nominees grouped by scheme, each with their share as a small bar
function Nominees({ nominees }: { nominees: EmployeeProfile['nominees'] }) {
  const schemes = [...new Set(nominees.map((n) => n.scheme))]
  return (
    <div className="space-y-3">
      {schemes.map((scheme) => (
        <div key={scheme}>
          <p className="mb-0.5 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">{NOMINATION_SCHEME[scheme]}</p>
          <ItemList>
            {nominees
              .filter((n) => n.scheme === scheme)
              .map((n, i) => (
                <ItemRow
                  key={i}
                  initials={initialsOf(n.name)}
                  title={n.name}
                  chips={<Chip tone="gold">{n.relationship}</Chip>}
                  details={[n.dateOfBirth && `born ${formatDate(n.dateOfBirth)}`, n.address, n.guardianName && `guardian: ${n.guardianName}, ${n.guardianAddress ?? ''}`]}
                  aside={
                    n.sharePercent != null && (
                      <div className="w-16 shrink-0 text-right">
                        <p className="text-sm font-semibold tabular-nums">{n.sharePercent}%</p>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                          <div className="h-full rounded-full bg-gold" style={{ width: `${Math.min(100, n.sharePercent)}%` }} />
                        </div>
                      </div>
                    )
                  }
                />
              ))}
          </ItemList>
        </div>
      ))}
    </div>
  )
}

// One line of the HR checklist: a green tick with who / when once done, an empty circle until then
function Check({ label, done, pending = 'Not yet' }: { label: string; done: string | null | undefined; pending?: string }) {
  return (
    <li className="flex items-center gap-3 py-2 first:pt-0.5 last:pb-0">
      {done ? <CircleCheck aria-hidden className="size-4.5 shrink-0 text-positive" /> : <Circle aria-hidden className="size-4.5 shrink-0 text-border" />}
      <span className="flex-1 text-sm">{label}</span>
      <span className={cn('text-right text-xs', done ? 'text-muted-foreground' : 'text-muted-foreground/70')}>{done ?? pending}</span>
    </li>
  )
}

function Documents({ employeeCode, canManage }: { employeeCode: string; canManage: boolean }) {
  const queryClient = useQueryClient()
  const documents = useQuery(orpc.employees.documents.list.queryOptions({ input: { employeeCode } }))
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [asking, setAsking] = useState<{ doc: EmployeeDocument; action: 'reject' | 'delete' } | null>(null)
  const refresh = () => void queryClient.invalidateQueries({ queryKey: orpc.employees.documents.key() })
  const review = useMutation(orpc.employees.documents.review.mutationOptions({ onSuccess: refresh }))
  const remove = useMutation(orpc.employees.documents.delete.mutationOptions({ onSuccess: refresh }))
  const restore = useMutation(orpc.employees.documents.restore.mutationOptions({ onSuccess: refresh }))
  const busy = review.isPending || remove.isPending || restore.isPending

  async function view(doc: EmployeeDocument) {
    setError(null)
    try {
      const blob = await client.employees.documents.download({ id: doc.id })
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (cause) {
      setError(errorMessage(cause))
    }
  }

  if (documents.isPending)
    return (
      <InfoCard
        icon={FileText}
        title="Documents"
        aside={
          canManage && (
            <Button variant="gold" size="sm" className="ml-1" disabled>
              <Plus /> Add document
            </Button>
          )
        }
      >
        <div className="space-y-3">
          {canManage && <p className="text-xs text-muted-foreground">Employees do not upload - they give documents to HR, who add them here.</p>}
          <DocumentsSkeleton label="Loading the documents" />
        </div>
      </InfoCard>
    )
  if (documents.error) return <p className="text-sm text-negative-ink">{errorMessage(documents.error)}</p>
  // per type the newest one not deleted is current; older ones are earlier versions; deleted ones last
  const current = new Map<string, number>()
  for (const d of [...documents.data].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))) {
    if (!d.isDeleted && !current.has(d.type)) current.set(d.type, d.id)
  }
  const rows = [...documents.data].sort(
    (a, b) => Number(a.isDeleted) - Number(b.isDeleted) || DOCUMENT_TYPE[a.type].localeCompare(DOCUMENT_TYPE[b.type]) || +new Date(b.createdAt) - +new Date(a.createdAt),
  )
  // the current documents by status, for the counts next to the title
  const currentDocs = documents.data.filter((d) => current.get(d.type) === d.id)
  const count = (status: EmployeeDocument['verificationStatus']) => currentDocs.filter((d) => d.verificationStatus === status).length
  return (
    <InfoCard
      icon={FileText}
      title="Documents"
      aside={
        <div className="flex flex-wrap items-center gap-1.5">
          {count('VERIFIED') > 0 && <Chip tone="positive">{count('VERIFIED')} verified</Chip>}
          {count('PENDING') > 0 && <Chip tone="warning">{count('PENDING')} to verify</Chip>}
          {count('REJECTED') > 0 && <Chip tone="negative">{count('REJECTED')} rejected</Chip>}
          {canManage && (
            <Button variant="gold" size="sm" className="ml-1" onClick={() => setAdding(true)}>
              <Plus /> Add document
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-3">
      {canManage && <p className="text-xs text-muted-foreground">Employees do not upload - they give documents to HR, who add them here.</p>}
      {(error || review.error || remove.error || restore.error) && (
        <p className="text-sm text-negative-ink">{error ?? errorMessage(review.error ?? remove.error ?? restore.error)}</p>
      )}
      {rows.length === 0 ? (
        <EmptyNote>No documents.</EmptyNote>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>File</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Uploaded / reviewed</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((d) => {
              const earlier = !d.isDeleted && current.get(d.type) !== d.id
              return (
                <TableRow key={d.id} className={d.isDeleted || earlier ? 'text-muted-foreground' : undefined}>
                  <TableCell className="font-medium">
                    {DOCUMENT_TYPE[d.type]}
                    {earlier && <span className="block text-xs font-normal">Earlier version</span>}
                  </TableCell>
                  <TableCell className="max-w-48 truncate text-muted-foreground">
                    {/* a sensitive document without its access: listed, not opened (2026-11-16) */}
                    {d.locked ? (
                      <span className="inline-flex items-center gap-1 text-xs" title="Needs the IDs / medical access too">
                        <Lock className="size-3.5" /> Needs more access
                      </span>
                    ) : (
                      d.fileName
                    )}
                  </TableCell>
                  <TableCell>
                    {d.isDeleted ? (
                      <>
                        <Pill tone="neutral">Deleted</Pill>
                        <p className="mt-1 text-xs">
                          {formatDoneBy(d.deletedAt, d.deletedBy)}
                          {d.deleteReason && <span className="block text-negative-ink">{d.deleteReason}</span>}
                        </p>
                      </>
                    ) : (
                      <>
                        <Pill tone={VERIFICATION[d.verificationStatus].tone}>{VERIFICATION[d.verificationStatus].label}</Pill>
                        {d.rejectionReason && <p className="mt-1 text-xs text-negative-ink">{d.rejectionReason}</p>}
                      </>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDoneBy(d.createdAt, d.uploadedBy)}
                    {d.reviewedAt && <span className="block">Reviewed {formatDoneBy(d.reviewedAt, d.reviewedBy)}</span>}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {!d.locked && (
                      <Button variant="ghost" size="sm" onClick={() => void view(d)}>
                        <Download /> View
                      </Button>
                    )}
                    {canManage && !d.locked && !d.isDeleted && d.verificationStatus !== 'VERIFIED' && (
                      <Button variant="ghost" size="sm" disabled={busy} onClick={() => review.mutate({ id: d.id, status: 'VERIFIED' })}>
                        Verify
                      </Button>
                    )}
                    {canManage && !d.locked && !d.isDeleted && d.verificationStatus !== 'REJECTED' && (
                      <Button variant="ghost" size="sm" disabled={busy} onClick={() => setAsking({ doc: d, action: 'reject' })}>
                        Reject
                      </Button>
                    )}
                    {canManage && !d.locked && !d.isDeleted && d.verificationStatus !== 'VERIFIED' && (
                      <Button variant="ghost" size="sm" disabled={busy} onClick={() => setAsking({ doc: d, action: 'delete' })}>
                        Delete
                      </Button>
                    )}
                    {canManage && !d.locked && d.isDeleted && (
                      <Button variant="ghost" size="sm" disabled={busy} onClick={() => restore.mutate({ id: d.id })}>
                        Restore
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
      {adding && <AddDocumentDialog employeeCode={employeeCode} onClose={() => setAdding(false)} onAdded={refresh} />}
      {asking && (
        <ReasonDialog
          title={asking.action === 'reject' ? `Reject ${DOCUMENT_TYPE[asking.doc.type]}?` : `Delete ${DOCUMENT_TYPE[asking.doc.type]}?`}
          label={asking.action === 'reject' ? 'What is wrong with it' : 'Why it is deleted (it is kept and can be restored)'}
          confirm={asking.action === 'reject' ? 'Reject' : 'Delete'}
          onClose={() => setAsking(null)}
          onConfirm={(reason) => {
            const done = { onSuccess: () => setAsking(null) }
            if (asking.action === 'reject') review.mutate({ id: asking.doc.id, status: 'REJECTED', rejectionReason: reason }, done)
            else remove.mutate({ id: asking.doc.id, reason }, done)
          }}
        />
      )}
      </div>
    </InfoCard>
  )
}

// HR adds a document for the employee: its type and the file (PDF / JPG / PNG, 5 MB)
function AddDocumentDialog({ employeeCode, onClose, onAdded }: { employeeCode: string; onClose: () => void; onAdded: () => void }) {
  const [type, setType] = useState<EmployeeDocument['type'] | ''>('')
  const [file, setFile] = useState<File | null>(null)
  const upload = useMutation(
    orpc.employees.documents.upload.mutationOptions({
      onSuccess: () => {
        onAdded()
        onClose()
      },
    }),
  )
  const options = (Object.keys(DOCUMENT_TYPE) as EmployeeDocument['type'][]).map((t) => ({ value: t, label: DOCUMENT_TYPE[t] })).sort((a, b) => a.label.localeCompare(b.label))
  return (
    <FormDialog onOpenChange={(open) => !open && onClose()} dirty={!!type || !!file} className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a document</DialogTitle>
          <DialogDescription>It waits for review like any other document. A newer copy of a type replaces the older one, which stays as an earlier version.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <label htmlFor="add-doc-type" className="text-xs font-medium text-muted-foreground">
              Type
            </label>
            <SearchableSelect id="add-doc-type" value={type} options={options} placeholder="Pick a type…" onChange={(v) => setType(v as EmployeeDocument['type'] | '')} className="h-9 w-full rounded-xl bg-card" />
          </div>
          <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-border bg-surface-2/50 px-4 py-3 text-sm hover:border-foreground/30">
            <Upload className="size-4 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">{file ? file.name : 'Choose a PDF, JPG or PNG (5 MB)'}</span>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          {upload.error && <p className="text-sm text-negative-ink">{errorMessage(upload.error)}</p>}
        </div>
        <DialogFooter>
          <DialogCancel />
          <Button variant="gold" disabled={!type || !file || upload.isPending} onClick={() => type && file && upload.mutate({ employeeCode, type, file })}>
            {upload.isPending ? 'Uploading…' : 'Add document'}
          </Button>
        </DialogFooter>
    </FormDialog>
  )
}

// Asks for a reason (rejecting / deleting a document)
function ReasonDialog({ title, label, confirm, onClose, onConfirm }: { title: string; label: string; confirm: string; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState('')
  return (
    <FormDialog onOpenChange={(open) => !open && onClose()} dirty={!!reason.trim()} className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-1">
          <label htmlFor="reason" className="text-xs font-medium text-muted-foreground">
            {label}
          </label>
          <Textarea id="reason" className="rounded-xl" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <DialogFooter>
          <DialogCancel />
          <Button variant="destructive" disabled={!reason.trim()} onClick={() => onConfirm(reason.trim())}>
            {confirm}
          </Button>
        </DialogFooter>
    </FormDialog>
  )
}

// "Fit with restrictions - 15 Nov 2026, City Clinic - no work at height"
function preEmploymentMedical(joining: EmployeeProfile['joining']) {
  if (!joining?.medicalResult) return '—'
  return [MEDICAL_RESULT[joining.medicalResult], formatDate(joining.medicalExamDate), joining.medicalExaminer, joining.medicalRestrictions]
    .filter((part) => part && part !== '—')
    .join(' · ')
}

// a day already past (an identity document's validity)
function isPast(day: Date) {
  return new Date(day).getTime() < Date.now()
}

// "2 yrs 3 mo" between two days (an earlier job)
function spanOf(from: Date, to: Date) {
  const a = new Date(from)
  const b = new Date(to)
  const months = Math.max(0, (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth())
  const years = Math.floor(months / 12)
  return [years && `${years} yr${years > 1 ? 's' : ''}`, months % 12 && `${months % 12} mo`].filter(Boolean).join(' ') || 'under a month'
}
