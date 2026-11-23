import { hasAccess } from '#core/auth/access'
import type { CurrentUser } from '#core/rpc/procedures'
import { employeesService, hodsService } from '#modules/employees'
import { today } from '#shared/utils/dates'
import { SYSTEM_SCOPE } from '#core/auth/scope'
import { addDays, dayKey, eachDay } from '#shared/utils/time'
import * as daysService from './days/days.service.js'

// Attendance as a whole (2026-11-16): what the viewer's attendance page and the home page show first - their own today,
// whether they have a team, what they may do - and the worker's nightly close. (What waits for their decision - shift
// changes too - is on the Approvals page since 2026-11-22.)

export async function getOverview(viewer: CurrentUser) {
  const person = await daysService.getVisiblePerson(viewer, viewer.employeeCode)
  const [todayView, team, department, lock] = await Promise.all([
    daysService.getDayOf(person, today()),
    employeesService.listReportingTreeIds(viewer.employeeId),
    hodsService.listDepartmentIds(viewer.employeeId),
    daysService.loadLockState(),
  ])
  return {
    today: todayView,
    // the size of the viewer's reporting tree (0: no team tab)
    teamSize: team.length,
    // how many employees the viewer is the HOD of (0: no department tab - BACKLOG 3e)
    departmentSize: department.length,
    // the attendance month today is in (with RML's 26th start day, 26 Nov is already "December" - 2026-11-22)
    currentMonth: daysService.cycleOf(today(), lock.startDay),
    // the day an attendance month starts (1-28; RML 26) - the month's loading placeholder draws its real days (2026-11-22)
    cycleStartDay: lock.startDay,
    canSeeAll: hasAccess(viewer.access, 'ATTENDANCE', 'READ'),
    canEdit: hasAccess(viewer.access, 'ATTENDANCE', 'WRITE'),
  }
}

// The worker, every night: yesterday becomes final for everyone (no punch on a working day = absent)
export function closeYesterday() {
  return daysService.closeDay(addDays(today(), -1))
}

// --- For the leave module (2026-11-22 - leave depends on attendance, never the other way) ---

// what leave gives the day calculation (its approved leave as covers), works out again, checks the month lock with
export { assertOpenDays, halvesOf, loadCovers, recompute, registerLeaveCovers, type DayCover, type Half } from './days/days.service.js'

// The days from..to of one employee as attendance plans them - a working day (`halfDay`: only its first half is worked,
// e.g. RML's Saturday), a weekly off or a holiday - and whether they are employed that day. Leave days are counted from
// this (the holidays, rotations and weekly offs are attendance's).
export async function planDays(employeeId: number, from: Date, to: Date) {
  const [person] = await employeesService.listAttendancePeople({ scope: SYSTEM_SCOPE, ids: [employeeId], from: new Date(Date.UTC(1950, 0, 1)), to: new Date(Date.UTC(2200, 0, 1)) })
  if (!person) return []
  const plans = (await daysService.loadPlans([person], from, to)).get(person.id)!
  return eachDay(from, to).map((date) => {
    const plan = plans.get(dayKey(date))!
    return { date, kind: plan.kind, halfDay: plan.halfDay, holiday: plan.holiday, employed: date >= person.dateOfJoining && (!person.dateOfLeaving || date <= person.dateOfLeaving) }
  })
}

// One employee's day as worked out (for a comp-off claim - 2026-11-22): what it was meant to be (a working day, a weekly
// off, a holiday), its status and the time worked from the punches; null when they were not employed
export async function workedOn(employeeId: number, date: Date) {
  const [person] = await employeesService.listAttendancePeople({ scope: SYSTEM_SCOPE, ids: [employeeId], from: date, to: date })
  if (!person) return null
  const day = await daysService.getDayOf(person, date)
  return { planned: day.planned, holiday: day.holiday, status: day.status, firstHalf: day.firstHalf, secondHalf: day.secondHalf, workedMinutes: day.workedMinutes, inAt: day.inAt, outAt: day.outAt }
}
