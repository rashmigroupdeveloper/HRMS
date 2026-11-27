import { reportFile, reportSheet, type ReportField } from '#core/excel/report'
import type { z } from 'zod'
import type { exportSetupInput } from './shifts/shifts.schema.js'
import * as shiftsService from './shifts/shifts.service.js'
import * as policiesService from './policies/policies.service.js'
import * as holidaysService from './holidays/holidays.service.js'
import * as holidayListsService from './holiday-lists/holiday-lists.service.js'
import * as punchesService from './punches/punches.service.js'
import * as locksService from './locks/locks.service.js'
import { hasAccess } from '#core/auth/access'
import type { DbClient } from '#core/db/prisma'
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
export { assertOpenDays, halvesOf, loadCovers, recompute, registerHolidayLeave, registerLeaveCovers, type DayCover, type Half } from './days/days.service.js'
// on-application holidays (2026-11-24): those an employee may take; the holiday list each employee follows on a day
export { onApplicationHolidaysOf } from './holidays/holidays.service.js'
export { listsOn as holidayListsOn } from './holiday-lists/holiday-lists.service.js'

// --- For the candidates module: the holiday list chosen on the joining day (2026-11-24) ---
export { assertJoiningList as assertJoiningHolidayList, giveOnJoining as giveHolidayListOnJoining } from './holiday-lists/holiday-lists.service.js'

// The days from..to of one employee as attendance plans them - a working day (`halfDay`: only its first half is worked,
// e.g. RML's Saturday; `holidayHalf`: that half is a holiday - 2026-11-24), a weekly off or a holiday - and whether they
// are employed that day. Leave days are counted from
// this (the holidays, rotations and weekly offs are attendance's).
export async function planDays(employeeId: number, from: Date, to: Date) {
  const [person] = await employeesService.listAttendancePeople({ scope: SYSTEM_SCOPE, ids: [employeeId], from: new Date(Date.UTC(1950, 0, 1)), to: new Date(Date.UTC(2200, 0, 1)) })
  if (!person) return []
  const plans = (await daysService.loadPlans([person], from, to)).get(person.id)!
  return eachDay(from, to).map((date) => {
    const plan = plans.get(dayKey(date))!
    return { date, kind: plan.kind, halfDay: plan.halfDay, holidayHalf: plan.holidayHalf, holiday: plan.holiday, employed: date >= person.dateOfJoining && (!person.dateOfLeaving || date <= person.dateOfLeaving) }
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

// Each section uses exactly its existing page reader; shared setup is separate from scoped employee schedules.
export async function exportSetup(viewer: CurrentUser,input:z.infer<typeof exportSetupInput>) {
  // the holidays of one list (the page's filter - 2026-11-25): its name in the file's details
  const listName=input.section==='holidays'&&input.holidayListId?(await holidayListsService.getHolidayLists([input.holidayListId]))[0]!.name:null
  const details={title:`Attendance ${input.section}`,preparedBy:`${viewer.name} (${viewer.employeeCode})`,
    coverage:input.section==='schedules'?'Current schedules within Attendance setup View data access and selected filters.':
      input.section==='punches'?'Latest 30 uploads and all unmatched machine codes, matching the shared ingestion lists.':
      'Shared attendance setup, matching the selected section. Includes retired definitions and current effective rules.',
    filters:[{label:'Year',value:input.year?String(input.year):'Not applicable'},
      {label:'Schedule filters',value:input.schedules?JSON.stringify(input.schedules):'All'},
      ...(input.section==='holidays'?[{label:'Holiday list',value:listName??'Every list'}]:[])]}
  const file=<T>(name:string,rows:T[],fields:ReportField<T>[])=>reportFile([reportSheet(name,rows,fields)],details,`attendance-${input.section}${input.year?'-'+input.year:''}`)
  switch(input.section){
    case 'shifts':return file('Shifts',await shiftsService.listShifts(viewer,true),[
      {header:'Code',text:true,value:r=>r.code},{header:'Name',value:r=>r.name},
      {header:'Start',text:true,value:r=>r.start},{header:'End',text:true,value:r=>r.end},
      {header:'Break minutes',value:r=>r.breakMinutes},{header:'First half ends',text:true,value:r=>r.halfSplit},
      {header:'Effective from',date:true,value:r=>r.from},{header:'Status',value:r=>r.isActive?'Active':'Retired'},
      {header:'Upcoming timings',width:48,value:r=>r.versions.filter(v=>v.upcoming).map(v=>`${v.effectiveFrom.toISOString().slice(0,10)}: ${v.start}–${v.end}; break ${v.breakMinutes}m; first half ${v.halfSplit??'midpoint'}`).join('\n')},
    ])
    case 'patterns':{
      const shifts=await shiftsService.listShifts(viewer,true)
      return file('Weekly patterns',await shiftsService.listPatterns(viewer,true),[
        {header:'Name',value:r=>r.name},{header:'Default',value:r=>r.isDefault?'Yes':'No'},
        {header:'Cycle days',width:70,value:r=>r.days.map((id,i)=>`${i+1}: ${id===0?'Off':shifts.find(s=>s.id===id)?.code??id}${r.halfDays.includes(i+1)?' (half day)':''}`).join('\n')},
        {header:'Upcoming cycles',width:65,value:r=>r.versions.filter(v=>v.upcoming).map(v=>`${v.effectiveFrom.toISOString().slice(0,10)}: ${v.days.map((id,i)=>`${i+1}: ${id===0?'Off':shifts.find(s=>s.id===id)?.code??id}${v.halfDays.includes(i+1)?' (half day)':''}`).join(', ')}`).join('\n')},
        {header:'Becomes default',date:true,value:r=>r.defaultFrom},
        {header:'Effective from',date:true,value:r=>r.from},{header:'Status',value:r=>r.isActive?'Active':'Retired'},
      ])
    }
    case 'policies':return file('Policies',await policiesService.listPolicies(viewer,true),[
      {header:'Name',value:r=>r.name},{header:'Default',value:r=>r.isDefault?'Yes':'No'},
      {header:'Grace minutes',value:r=>r.graceMinutes},{header:'Full day minutes',value:r=>r.fullDayMinutes},
      {header:'Half day minutes',value:r=>r.halfDayMinutes},{header:'Lates per half day cut',value:r=>r.latesPerHalfDayCut},
      {header:'Very late minutes',value:r=>r.veryLateMinutes},{header:'Very early minutes',value:r=>r.veryEarlyMinutes},
      {header:'Upcoming rules',width:65,value:r=>r.versions.filter(v=>v.upcoming).map(v=>`${v.effectiveFrom.toISOString().slice(0,10)}: grace ${v.graceMinutes}m, full ${v.fullDayMinutes??'shift'}m, half ${v.halfDayMinutes}m, late cut every ${v.latesPerHalfDayCut??'none'}, very late ${v.veryLateMinutes??'none'}m, very early ${v.veryEarlyMinutes??'none'}m`).join('\n')},
      {header:'Effective from',date:true,value:r=>r.from},{header:'Status',value:r=>r.isActive?'Active':'Retired'},
    ])
    case 'holidays':return file('Holidays',await holidaysService.listHolidays(input.year!,input.holidayListId),[
      {header:'Date',date:true,value:r=>r.date},{header:'Name',value:r=>r.name},
      {header:'Category',value:r=>r.category.name},
      {header:'Day off',value:r=>r.portion==='FULL_DAY'?'Whole day':r.portion==='FIRST_HALF'?'First half':'Second half'},
      {header:'How',value:r=>r.mode==='AUTOMATIC'?'Everyone on the lists':`On application (${r.leaveType?.code??'?'}${r.allowHalfDay?', half days too':''})`},
      {header:'Holiday lists',width:45,value:r=>r.lists.map(l=>l.name).join(', ')},
    ])
    case 'schedules':return file('Schedules',await shiftsService.listSchedules(viewer,input.schedules??{}),[
      {header:'Employee code',text:true,value:r=>r.employee.employeeCode},{header:'Employee',value:r=>r.employee.name},
      {header:'Company',value:r=>r.employee.company},{header:'Plant',value:r=>r.employee.plant},
      {header:'Department',value:r=>r.employee.department},{header:'Cost center',value:r=>r.employee.costCenter},
      {header:'Work location',value:r=>r.employee.workLocation},{header:'Pattern',value:r=>r.pattern?.name},
      {header:'Policy',value:r=>r.policy?.name},{header:'Since',date:true,value:r=>r.since},
      {header:'Next pattern',value:r=>r.next?.pattern?.name},{header:'Next from',date:true,value:r=>r.next?.from},
      {header:'Holiday list',value:r=>r.holidayList.holidayList?.name??'None'},{header:'Holiday list since',date:true,value:r=>r.holidayList.since},
      {header:'Next holiday list',value:r=>r.holidayList.next?.holidayList.name},{header:'Next holiday list from',date:true,value:r=>r.holidayList.next?.from},
      {header:'Attendance not tracked',value:r=>r.notTracked?(r.notTracked.current?'Yes':'From a later day'):''},{header:'Not tracked from',date:true,value:r=>r.notTracked?.fromDate},
      {header:'Not tracked until',date:true,value:r=>r.notTracked?.toDate},{header:'Not tracked - reason',width:40,value:r=>r.notTracked?.reason},
    ])
    case 'locks':return file('Month locks',(await locksService.listMonths(viewer,input.year!)).months,[
      {header:'Month',value:r=>r.name},{header:'From',date:true,value:r=>r.from},{header:'To',date:true,value:r=>r.to},
      {header:'Status',value:r=>r.locked?'Locked':'Open'},{header:'Locked by',value:r=>r.locked?.by?.name},
      {header:'Locked at',dateTime:true,value:r=>r.locked?.at},
      {header:'Reopened',width:50,value:r=>r.reopened.map(o=>`${o.unlockedAt?.toISOString()} ${o.unlockedBy?.name}: ${o.reason}`).join('\n')},
    ])
    case 'punches':{
      const [uploads,unmatched]=await Promise.all([punchesService.listUploads(),punchesService.listUnmatched()])
      return reportFile([reportSheet('Uploads',uploads,[
        {header:'File',width:40,value:r=>r.fileName},{header:'Rows',value:r=>r.rowCount},
        {header:'Added',value:r=>r.addedCount},{header:'Duplicates',value:r=>r.duplicateCount},
        {header:'Unmatched',value:r=>r.unmatchedCount},{header:'Uploaded by',value:r=>r.by?.name},
        {header:'Uploaded at',dateTime:true,value:r=>r.createdAt},
      ]),reportSheet('Unmatched codes',unmatched,[
        {header:'Machine code',text:true,value:r=>r.code},{header:'Punches',value:r=>r.punches},
        {header:'First punch',dateTime:true,value:r=>r.first},{header:'Last punch',dateTime:true,value:r=>r.last},
      ])],details,'attendance-punches')
    }
  }
}

// Company payroll headers snapshot this period; managing the group-wide attendance lock remains separate.
export { getPeriod as getPayrollPeriod } from './locks/locks.service.js'

// --- For payroll, stage 3 (2026-11-27 - payroll depends on attendance, never the other way) ---

// Whether a pay run's whole period is locked, and since when
export function payrollLockOf(from: Date, to: Date, db?: DbClient) {
  return locksService.lockOfDays(from, to, db)
}

// The worked-out days a pay run copies: each half's status, and the leave type (with paid or not) of a half on leave.
// The caller chose the employees (the people of one run it found with whole-company Payroll scope).
export type { PayrollDay, PayrollHalf } from './days/days.service.js'
export function listPayrollDays(employeeIds: number[], from: Date, to: Date) {
  return daysService.listForPayroll(employeeIds, from, to)
}
