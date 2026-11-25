export const MOVEMENT_KINDS = [['ALL', 'Joiners & leavers'], ['JOINER', 'Joiners'], ['LEAVER', 'Leavers']] as const
export const MOVEMENT_TOTALS = ['Joining events', 'Leaving events', 'People', 'Future dates'] as const
export const MOVEMENT_COLUMNS = [{ label: 'Employee', className: '' }, { label: 'Recorded date / event', className: '' }, { label: 'Current placement', className: 'hidden md:table-cell' }, { label: 'Current status', className: 'hidden lg:table-cell' }] as const
export const MOVEMENT_NOTE = 'Recorded employee dates · current placement. A leaving date does not confirm an approved exit, clearance or settlement. Imported/directly added employees are included; rehire history is not reconstructed.'
