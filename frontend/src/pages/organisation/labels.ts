// Shared by the organisation board and its skeleton. Change both together.
export const BOARD_TITLE = 'Organisation'
export const BOARD_CAPTION = 'Headcount of each company this role covers. Open a company to see its departments.'
export const DEPARTMENT_CAPTION = 'Headcount of the departments this role covers, including places you head.'
export const DRILL_CAPTION = 'Headcount of each department of this company.'
export const COUNT_NOTE = 'Counts people working now - active and on notice. Exited people are not included.'
export const SUMMARY_LABEL = 'Working now'
export const SPLIT_LABEL = 'Split by'
export const VIEWS = [
  { key: 'overview', label: 'Overview' },
  { key: 'table', label: 'Table' },
] as const
export type BoardView = (typeof VIEWS)[number]['key']
export const GROUPING_LABEL = 'Group by'
export const GROUPINGS = [
  { key: 'department', label: 'Department' },
  { key: 'plant', label: 'Plant' },
] as const
export type Grouping = (typeof GROUPINGS)[number]['key']
export const MONTH_LABEL = 'This month'
export const COLUMNS = { companies: 'Company', departments: 'Department', plants: 'Plant', people: 'People' } as const
// a company / department row: name, people, the split bar, the arrow (two lines on a phone)
export const ROW = 'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2.5 px-5 sm:px-6 md:grid-cols-[minmax(0,1.3fr)_5.5rem_minmax(0,2fr)_1rem] md:gap-x-6'
export const CLASS_GROUPS = [
  { key: 'employmentType', label: 'Employment' },
  { key: 'workforceCategory', label: 'Workforce' },
  { key: 'joiningType', label: 'Joining' },
] as const
// the extra groups the server adds (`breakdowns`), as the skeleton draws them - change together with breakdownsOf in
// backend/src/modules/employees/organisation/organisation.service.ts
export const BREAKDOWN_LABELS = { gender: 'Gender', grade: 'Grade', designation: 'Designation' } as const
// the groups a role's board will have: gender needs Employee · Personal details View
export const breakdownsFor = (personal: boolean) => (personal ? (['gender', 'grade', 'designation'] as const) : (['grade', 'designation'] as const))
