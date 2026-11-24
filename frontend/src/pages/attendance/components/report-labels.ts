// Shared by the loaded reports and their skeleton; change headings in this one place.
export const REPORT_COLUMNS = [
  { label: 'Employee / work date', className: 'w-1/2 whitespace-normal md:w-auto' },
  { label: 'Status / punches', className: 'w-1/2 whitespace-normal md:w-auto' },
  { label: 'Worked', className: 'hidden text-right md:table-cell' },
  { label: 'Late / early', className: 'hidden text-right md:table-cell' },
  { label: 'Raw punches', className: 'hidden text-right md:table-cell' },
] as const
export const REPORT_SUMMARIES = ['Matching days', 'People', 'Worked hours', 'Late days', 'Early days', 'Absent days', 'Missed punches'] as const
export const EXCEPTION_OPTIONS = [['ANY', 'Any exception'], ['LATE', 'Late arrival'], ['EARLY', 'Early departure'], ['ABSENT', 'Absent half or day'], ['MISSED_PUNCH', 'Missed punch']] as const

export const REPORT_SUMMARY_NOTE = 'Totals cover every matching page. Exception counts include either half and can overlap.'
