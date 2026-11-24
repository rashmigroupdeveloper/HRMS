import { reportFile, reportSheet } from '#core/excel/report'
import { scopeOf, SYSTEM_SCOPE } from '#core/auth/scope'
import { hasAccess } from '#core/auth/access'
import { prisma, type DbClient } from '#core/db/prisma'
import type { CurrentUser } from '#core/rpc/procedures'
import { employeesService } from '#modules/employees'
import { today } from '#shared/utils/dates'
import { addDays, DAY_MS, dayKey, eachDay, MINUTE_MS, weekdayIndex, zonedInstant } from '#shared/utils/time'
import { ORPCError } from '@orpc/server'
import type { z } from 'zod'
import * as daysService from '../days/days.service.js'
import * as shiftsService from '../shifts/shifts.service.js'
import * as rostersRepository from './rosters.repository.js'
import type { clearRosterInput, publishRosterInput, rosterGridInput, saveRosterInput } from './rosters.schema.js'

// Rosters (attendance, 2026-11-16 - the user chose rosters like the old HRMS). Part of the attendance setup since
// 2026-11-22 (the user): HR with Attendance setup (Edit covering the employee - data access) sets a shift or "off" per
// person per day, one by one, kept as a draft and then published; managers no longer roster - their people ask with a
// shift-change request. Only for rare, short changes (the user, 2026-11-22): rotating staff get a rotation pattern as their
// default shift instead, and a day set to what the default already gives is not kept (its row is taken out). Attendance follows only published days (a published day beats the default
// shift; a holiday beats both). On a roster day, less than 11 hours of rest after the day before, or more than 48 hours in
// its week (counting the default days too), shows as a warning - publishing is still allowed. Days left on the default
// shift get no warning (the default is HR's standing setup, not a roster being built). A published day also changes
// through an approved shift-change request.

const MAX_DAYS = 42
const MIN_REST = 11 * 60 * MINUTE_MS
const MAX_WEEK_MINUTES = 48 * 60

// Attendance setup Edit for someone (the screen's buttons; each employee is checked with their data access when saving)
const canRoster = (viewer: CurrentUser) => hasAccess(viewer.access, 'ATTENDANCE_SETUP', 'WRITE')
const EVER = { from: new Date(Date.UTC(1950, 0, 1)), to: new Date(Date.UTC(2200, 0, 1)) }

function checkRange(from: Date, to: Date) {
  if (to < from) throw new ORPCError('BAD_REQUEST', { message: 'The end date is before the start date' })
  if ((to.getTime() - from.getTime()) / DAY_MS >= MAX_DAYS) throw new ORPCError('BAD_REQUEST', { message: `Show at most ${MAX_DAYS / 7} weeks at a time` })
}

// The employees by code, if the viewer may roster them: Attendance setup Edit covering each (data access - outside the View
// range "not found", View only "forbidden")
async function rosterable(viewer: CurrentUser, codes: string[]) {
  const ids = await employeesService.mapCodesToIds(codes)
  const unknown = [...new Set(codes)].filter((c) => !ids.has(c))
  if (unknown.length) throw new ORPCError('NOT_FOUND', { message: `No employee found with code ${unknown.slice(0, 5).join(', ')}` })
  const people = await employeesService.listAttendancePeople({ scope: SYSTEM_SCOPE, ids: [...new Set(ids.values())], ...EVER })
  for (const person of people) daysService.assertAttendanceEdit(viewer, person, 'ATTENDANCE_SETUP')
  return { ids, people }
}

// Whether a roster day would be the same as the default (shift and weekly offs, or the rotation's day) - then no row is
// kept. A holiday or a half day by default is never the same: a roster day there means something of its own.
function sameAsDefault(plan: daysService.Plan | undefined, shiftId: number | null) {
  if (!plan || plan.kind === 'HOLIDAY' || plan.halfDay) return false
  return shiftId === null ? plan.kind === 'WEEKLY_OFF' : plan.kind === 'WORK' && plan.shift?.id === shiftId
}

// The grid: every person in the scope x every day - the roster day (draft or published) or what applies without one,
// with the warnings
// (`onlyChanges`: only the people with a roster day in the range - the roster is for rare changes, 2026-11-22). `planned`
// is the default without the roster.
export async function getGrid(viewer: CurrentUser, { from, to, onlyChanges, companyIds, search }: z.infer<typeof rosterGridInput>) {
  checkRange(from, to)
  // the employees inside the viewer's Attendance setup View data access
  const inScope = await employeesService.listAttendancePeople({ scope: scopeOf(viewer, 'ATTENDANCE_SETUP', 'READ'), companyIds, search, from, to })
  // the whole weeks (Monday-Sunday) around the days shown - the 48-hour check counts every day of a week, not only those on
  // screen (2026-11-23, the review)
  const weekFrom = addDays(from, -weekdayIndex(from))
  const weekTo = addDays(to, 6 - weekdayIndex(to))
  const entries = await rostersRepository.listEntries(
    inScope.map((p) => p.id),
    addDays(weekFrom, -1),
    weekTo,
  )
  const changed = new Set(entries.filter((e) => e.date >= from && e.date <= to).map((e) => e.employeeId))
  const people = onlyChanges ? inScope.filter((p) => changed.has(p.id)) : inScope
  const [plans, shifts] = await Promise.all([daysService.loadPlans(people, addDays(weekFrom, -1), weekTo, { roster: false }), shiftsService.listShifts(viewer, false)])
  // each shift's timing on the day (dated shifts - 2026-11-23)
  const shiftAt = await daysService.loadShifts()
  const days = eachDay(from, to)
  const canEdit = canRoster(viewer)
  return {
    days,
    shifts,
    canEdit,
    rows: people.map((person) => {
      const own = new Map(entries.filter((e) => e.employeeId === person.id).map((e) => [dayKey(e.date), e]))
      const plan = plans.get(person.id)!
      // what each day will be: the roster day (draft or published), else the plan
      const effective = (day: Date) => {
        const entry = own.get(dayKey(day))
        const planned = plan.get(dayKey(day))
        if (planned?.kind === 'HOLIDAY') return { working: false, shiftId: planned.shift?.id ?? null, halfDay: false }
        if (entry) return { working: entry.shiftId !== null, shiftId: entry.shiftId, halfDay: false }
        return { working: planned?.kind === 'WORK', shiftId: planned?.shift?.id ?? null, halfDay: planned?.halfDay ?? false }
      }
      const span = (day: Date) => {
        const e = effective(day)
        const shift = e.shiftId ? shiftAt(e.shiftId, day) : undefined
        if (!e.working || !shift) return null
        const full = shift.endMinute > shift.startMinute ? shift.endMinute : shift.endMinute + 1440
        // a half day (e.g. Saturday) ends where the first half ends, without the break (2026-11-22)
        const split = shift.halfSplitMinute === null ? Math.round((shift.startMinute + full) / 2) : shift.halfSplitMinute > shift.startMinute ? shift.halfSplitMinute : shift.halfSplitMinute + 1440
        const end = e.halfDay ? split : full
        return { start: zonedInstant(day, shift.startMinute, person.timezone), end: zonedInstant(day, end, person.timezone), minutes: end - shift.startMinute - (e.halfDay ? 0 : shift.breakMinutes) }
      }
      // the hours of each week (Monday to Sunday) shown - all its days
      const weekMinutes = new Map<string, number>()
      for (const day of eachDay(weekFrom, weekTo)) {
        const s = span(day)
        if (!s) continue
        const monday = dayKey(addDays(day, -weekdayIndex(day)))
        weekMinutes.set(monday, (weekMinutes.get(monday) ?? 0) + s.minutes)
      }
      const cells = days.map((day) => {
        const entry = own.get(dayKey(day))
        const planned = plan.get(dayKey(day))
        const warnings: string[] = []
        // only days set on the roster are checked
        const today_ = entry ? span(day) : null
        const before = span(addDays(day, -1))
        if (today_ && before && today_.start.getTime() - before.end.getTime() < MIN_REST) {
          warnings.push(`Only ${Math.max(0, Math.round((today_.start.getTime() - before.end.getTime()) / 3_600_000))}h rest after the day before`)
        }
        const week = weekMinutes.get(dayKey(addDays(day, -weekdayIndex(day)))) ?? 0
        if (today_ && week > MAX_WEEK_MINUTES) warnings.push(`${Math.round(week / 60)}h this week (more than 48h)`)
        return {
          date: day,
          entry: entry ? { shiftId: entry.shiftId, published: entry.publishedAt !== null } : null,
          planned: { kind: planned?.kind ?? 'WORK', shiftId: planned?.shift?.id ?? null, holiday: planned?.holiday ?? null, halfDay: planned?.halfDay ?? false },
          warnings,
        }
      })
      return { employeeCode: person.employeeCode, name: person.name, department: person.department?.name ?? null, designation: person.designation?.name ?? null, cells }
    }),
  }
}

// Sets days of the draft (a manager: today onwards and not published days; HR: any day - a published one stays published
// and is worked out again)
export async function saveCells(viewer: CurrentUser, { cells }: z.infer<typeof saveRosterInput>) {
  const { ids, people } = await rosterable(
    viewer,
    cells.map((c) => c.employeeCode),
  )
  const active = new Set((await shiftsService.listShifts(viewer, false)).map((s) => s.id))
  if (cells.some((c) => c.shiftId !== null && !active.has(c.shiftId))) throw new ORPCError('BAD_REQUEST', { message: 'A shift on the roster does not exist or is retired' })
  // not a day of a locked attendance month (2026-11-22)
  await daysService.assertOpenDays(cells.map((c) => c.date))
  const now = today()
  const existing = await rostersRepository.listEntries(
    [...new Set(ids.values())],
    new Date(Math.min(...cells.map((c) => c.date.getTime()))),
    new Date(Math.max(...cells.map((c) => c.date.getTime()))),
  )
  const published = new Set(existing.filter((e) => e.publishedAt).map((e) => `${e.employeeId}:${dayKey(e.date)}`))
  const stored = new Set(existing.map((e) => `${e.employeeId}:${dayKey(e.date)}`))
  // what each day is without the roster - a day set to that is not kept
  const defaults = await daysService.loadPlans(
    people,
    new Date(Math.min(...cells.map((c) => c.date.getTime()))),
    new Date(Math.max(...cells.map((c) => c.date.getTime()))),
    { roster: false },
  )
  const rework: { employeeId: number; date: Date }[] = []
  let removed = 0
  await prisma.$transaction(async (tx) => {
    for (const cell of cells) {
      const employeeId = ids.get(cell.employeeCode)!
      const isPublished = published.has(`${employeeId}:${dayKey(cell.date)}`)
      if (sameAsDefault(defaults.get(employeeId)?.get(dayKey(cell.date)), cell.shiftId)) {
        if (stored.has(`${employeeId}:${dayKey(cell.date)}`)) {
          await rostersRepository.deleteEntry(employeeId, cell.date, tx)
          removed++
        }
      } else await rostersRepository.upsertEntry({ employeeId, date: cell.date, shiftId: cell.shiftId, publish: isPublished }, viewer.employeeId, tx)
      if (isPublished && cell.date <= now) rework.push({ employeeId, date: cell.date })
    }
  })
  for (const { employeeId, date } of rework) await daysService.recompute([employeeId], date, date)
  return { saved: cells.length, removed }
}

// Takes days out of the draft (published days stay)
export async function clearCells(viewer: CurrentUser, { cells }: z.infer<typeof clearRosterInput>) {
  const { ids } = await rosterable(
    viewer,
    cells.map((c) => c.employeeCode),
  )
  let cleared = 0
  await prisma.$transaction(async (tx) => {
    for (const cell of cells) cleared += (await rostersRepository.deleteDraft(ids.get(cell.employeeCode)!, cell.date, tx)).count
  })
  return { cleared }
}

// Publishes the draft days; the days already come are worked out again
export async function publish(viewer: CurrentUser, { employeeCodes, from, to }: z.infer<typeof publishRosterInput>) {
  checkRange(from, to)
  const { ids } = await rosterable(viewer, employeeCodes)
  const employeeIds = [...new Set(ids.values())]
  // not across a locked attendance month (2026-11-22)
  await daysService.assertOpenDays(eachDay(from, to))
  const published = await rostersRepository.publish(employeeIds, from, to, viewer.employeeId)
  if (from <= today()) await daysService.recompute(employeeIds, from, to)
  return { published }
}

// An approved shift change: the day is set and published at once (inside the approval's transaction) - or, when it is
// back to the default, its row is taken out
export async function setPublishedDay(employeeId: number, date: Date, shiftId: number | null, actorId: number, db?: DbClient) {
  const people = await employeesService.listAttendancePeople({ scope: SYSTEM_SCOPE, ids: [employeeId], ...EVER })
  const defaults = await daysService.loadPlans(people, date, date, { roster: false })
  if (sameAsDefault(defaults.get(employeeId)?.get(dayKey(date)), shiftId)) {
    await rostersRepository.deleteEntry(employeeId, date, db)
    return
  }
  await rostersRepository.upsertEntry({ employeeId, date, shiftId, publish: true }, actorId, db)
}

export async function exportGrid(viewer: CurrentUser,input:z.infer<typeof rosterGridInput>){
  const grid=await getGrid(viewer,input)
  const shift=(id:number|null)=>id===null?'Off':grid.shifts.find(s=>s.id===id)?.code??'Unknown shift'
  return reportFile([reportSheet('Roster',grid.rows,[
    {header:'Employee code',text:true,value:r=>r.employeeCode},{header:'Employee',value:r=>r.name},
    {header:'Department',value:r=>r.department},{header:'Designation',value:r=>r.designation},
    ...grid.days.map(date=>({header:date.toISOString().slice(0,10),width:24,value:(r:typeof grid.rows[number])=>{
      const c=r.cells.find(c=>c.date.getTime()===date.getTime())!
      return c.entry?`${shift(c.entry.shiftId)} (${c.entry.published?'Published':'Draft'})`:
        c.planned.kind==='HOLIDAY'?`Holiday: ${c.planned.holiday??''}`:
        c.planned.kind==='WEEKLY_OFF'?'Off':`${shift(c.planned.shiftId)}${c.planned.halfDay?' (half day)':''}`
    }})),
  ])],{title:'Attendance roster',preparedBy:`${viewer.name} (${viewer.employeeCode})`,
    coverage:'Same authorized employees and date range as the roster grid. Draft and published overrides are explicitly labelled; other cells show the plan.',
    filters:[{label:'From',value:input.from.toISOString().slice(0,10)},{label:'To',value:input.to.toISOString().slice(0,10)},
    {label:'Search',value:input.search||'All'},{label:'Changed employees only',value:input.onlyChanges?'Yes':'No'}],
  },'attendance-roster')
}
