import { formatMoney } from '@/lib/utils'
import { days, type DepositStateKey } from './deposits-labels'

// The line under a scheme's month's state: overdue / late, short by, more than due, people left out, no due date set
export function standingDetail(l: { state: DepositStateKey; daysOverdue: number; daysLate: number; difference: number; leftOut: { count: number }; dueOn: Date | null }) {
  const parts: string[] = []
  const people = `${l.leftOut.count} ${l.leftOut.count === 1 ? 'person' : 'people'} left out`
  // the rest deposited, the people left out still owed: overdue is about them
  if (l.state === 'PEOPLE_LEFT_OUT') parts.push(l.daysOverdue ? `${people}, overdue ${days(l.daysOverdue)}` : people, l.dueOn ? `the rest paid ${l.daysLate ? `${days(l.daysLate)} late` : 'on time'}` : '')
  else {
    if (l.daysOverdue) parts.push(`overdue ${days(l.daysOverdue)}`)
    if (l.state === 'SHORT' || l.state === 'NOT_DEPOSITED' || l.state === 'FILED_NOT_PAID') parts.push(`${formatMoney(l.difference, 'INR')} to deposit`)
    if (l.state === 'MORE_THAN_DUE') parts.push(`${formatMoney(-l.difference, 'INR')} more than due - check`)
    if (l.leftOut.count) parts.push(people)
    if (l.state === 'DEPOSITED' && l.dueOn) parts.push(l.daysLate ? `paid ${days(l.daysLate)} late` : 'on time')
  }
  if (!l.dueOn) parts.push('no due date set')
  const text = parts.filter(Boolean).join(' · ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}
