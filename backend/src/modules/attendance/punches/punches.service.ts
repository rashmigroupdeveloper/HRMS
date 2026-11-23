import { hasLevelAt, SYSTEM_SCOPE } from '#core/auth/scope'
import { env } from '#core/config/env'
import type { CurrentUser } from '#core/rpc/procedures'
import { prisma } from '#core/db/prisma'
import { readFirstSheet, type CellValue } from '#core/excel/workbook'
import { employeesService } from '#modules/employees'
import { addDays, DAY_MS, localDay, wallClockToInstant, zonedInstant } from '#shared/utils/time'
import { ORPCError } from '@orpc/server'
import type { z } from 'zod'
import * as daysService from '../days/days.service.js'
import * as punchesRepository from './punches.repository.js'
import { MAX_PUNCH_ROWS, type addManualPunchesInput, type uploadPunchesInput } from './punches.schema.js'

// Punches (attendance, 2026-11-16). HR uploads the biometric machines' export - Excel (.xlsx) or CSV - until the Kent feed
// is connected (it will add punches the same way). The columns are found by their header, whatever the machine calls
// them: the employee code ("Employee code", "Emp Code", "EmpId"...), the time ("Punch time", "Date time"... - or a "Date"
// and a "Time" column) and, if there is one, the machine ("Device", "Door"...). A time without a zone is the clock of the
// employee's work location. The same punch (code + time) is kept once; a code that is no employee waits in "Unmatched
// punches"; the days the punches belong to are worked out at once.

const DEFAULT_ZONE = 'Asia/Kolkata'
const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')
const CODE_HEADERS = ['employeecode', 'empcode', 'empid', 'employeeid', 'ecode', 'code', 'employeeno', 'empno', 'userid', 'cardno']
const DATETIME_HEADERS = ['punchtime', 'punchdatetime', 'datetime', 'timestamp', 'logtime', 'logdatetime', 'swipetime', 'attendancetime']
const DATE_HEADERS = ['date', 'punchdate', 'logdate', 'attendancedate']
const TIME_HEADERS = ['time', 'punchtime', 'logtime', 'intime']
const DEVICE_HEADERS = ['device', 'devicename', 'deviceid', 'door', 'terminal', 'machine', 'reader']

// A CSV file as rows of cells (quoted cells may hold commas)
function parseCsv(text: string): { headers: string[]; rows: { rowNumber: number; values: Record<string, CellValue> }[] } {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/)
  const split = (line: string) => {
    const cells: string[] = []
    let cell = ''
    let quoted = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]!
      if (quoted) {
        if (ch === '"' && line[i + 1] === '"') (cell += '"'), i++
        else if (ch === '"') quoted = false
        else cell += ch
      } else if (ch === '"') quoted = true
      else if (ch === ',' || ch === ';' || ch === '\t') cells.push(cell), (cell = '')
      else cell += ch
    }
    cells.push(cell)
    return cells.map((c) => c.trim())
  }
  const headers = split(lines[0] ?? '')
  const rows = lines.slice(1).flatMap((line, i) => {
    if (!line.trim()) return []
    const cells = split(line)
    return [{ rowNumber: i + 2, values: Object.fromEntries(headers.map((h, j) => [h, cells[j] ? cells[j]! : null])) }]
  })
  return { headers, rows }
}

// A wall-clock date + time from text: 16-11-2026 09:04[:ss] [AM|PM], 16/11/2026 ..., 2026-11-16 09:04 / 2026-11-16T09:04 -
// or an instant when the text carries a zone (Z or +05:30)
function parseText(value: string): { wall: Date } | { instant: Date } | null {
  const text = value.trim()
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(text) && /\d{4}-\d{2}-\d{2}T/.test(text)) {
    const instant = new Date(text)
    return Number.isNaN(instant.getTime()) ? null : { instant }
  }
  const m =
    text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?$/) ??
    text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?$/)
  if (!m) return null
  const ymdFirst = m[1]!.length === 4
  const [y, mo, d] = ymdFirst ? [Number(m[1]), Number(m[2]), Number(m[3])] : [Number(m[3]), Number(m[2]), Number(m[1])]
  let hour = Number(m[4])
  const ampm = m[7]?.toUpperCase()
  if (ampm === 'PM' && hour < 12) hour += 12
  if (ampm === 'AM' && hour === 12) hour = 0
  const wall = new Date(Date.UTC(y, mo - 1, d, hour, Number(m[5]), Number(m[6] ?? 0)))
  // the day and the month as written (13-12-2025 read as month 13 would roll over into the next January)
  return wall.getUTCDate() === d && wall.getUTCMonth() === mo - 1 && hour < 24 ? { wall } : null
}

// A date cell / text and a time cell / text together
function joinDateTime(date: CellValue, time: CellValue): { wall: Date } | null {
  let day: Date | null = null
  if (date instanceof Date) day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  else if (typeof date === 'string') {
    const parsed = parseText(`${date} 00:00`)
    if (parsed && 'wall' in parsed) day = parsed.wall
  }
  if (!day) return null
  let minutes: number | null = null
  if (time instanceof Date) minutes = time.getUTCHours() * 60 + time.getUTCMinutes() + time.getUTCSeconds() / 60
  else if (typeof time === 'number' && time >= 0 && time < 1) minutes = Math.round(time * 1440 * 60) / 60
  else if (typeof time === 'string') {
    const t = time.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?$/)
    if (t) {
      let hour = Number(t[1])
      if (t[4]?.toUpperCase() === 'PM' && hour < 12) hour += 12
      if (t[4]?.toUpperCase() === 'AM' && hour === 12) hour = 0
      minutes = hour * 60 + Number(t[2]) + Number(t[3] ?? 0) / 60
    }
  }
  return minutes === null || minutes >= 1440 ? null : { wall: new Date(day.getTime() + minutes * 60_000) }
}

export async function uploadPunches({ file }: z.infer<typeof uploadPunchesInput>, viewer: CurrentUser) {
  const actorId = viewer.employeeId
  const bytes = new Uint8Array(await file.arrayBuffer())
  // an Excel file starts with "PK" (a zip); anything else is read as CSV text - also a CSV whose first letter is a P
  const isCsv = /\.(csv|txt)$/i.test(file.name) || bytes[0] !== 0x50 || bytes[1] !== 0x4b
  let sheet
  try {
    sheet = isCsv ? parseCsv(new TextDecoder().decode(bytes)) : await readFirstSheet(bytes)
  } catch (error) {
    throw new ORPCError('BAD_REQUEST', { message: error instanceof Error ? error.message : 'The file cannot be read' })
  }
  const find = (names: string[], except?: string) => sheet.headers.find((h) => names.includes(norm(h)) && h !== except)
  const codeHeader = find(CODE_HEADERS)
  const dateTimeHeader = find(DATETIME_HEADERS)
  const dateHeader = find(DATE_HEADERS)
  const timeHeader = dateHeader ? find(TIME_HEADERS, dateHeader) : undefined
  const deviceHeader = find(DEVICE_HEADERS)
  if (!codeHeader) throw new ORPCError('BAD_REQUEST', { message: 'No employee code column found - name it "Employee code" (or Emp Code / EmpId)' })
  if (!dateTimeHeader && !(dateHeader && timeHeader)) throw new ORPCError('BAD_REQUEST', { message: 'No time column found - a "Punch time" column, or a "Date" and a "Time" column' })
  if (!sheet.rows.length) throw new ORPCError('BAD_REQUEST', { message: 'The file has no punches' })
  if (sheet.rows.length > MAX_PUNCH_ROWS) throw new ORPCError('BAD_REQUEST', { message: `Upload at most ${MAX_PUNCH_ROWS.toLocaleString('en-IN')} punches per file` })

  // the employees by code (and their work location's time zone)
  const codes = sheet.rows.map((r) => String(r.values[codeHeader] ?? '').trim().toUpperCase()).filter(Boolean)
  const ids = await employeesService.mapCodesToIds(codes)
  const people = ids.size ? await employeesService.listAttendancePeople({ scope: SYSTEM_SCOPE, ids: [...new Set(ids.values())], from: new Date(Date.UTC(1950, 0, 1)), to: new Date(Date.UTC(2200, 0, 1)) }) : []
  const zoneOf = new Map(people.map((p) => [p.id, p.timezone]))
  // data access: punches only for employees inside the uploader's Attendance setup Edit range (others are left out, unnamed)
  const allowed = new Set(people.filter((p) => hasLevelAt(viewer, 'ATTENDANCE_SETUP', daysService.placementOf(p), 'WRITE')).map((p) => p.id))

  const errors: string[] = []
  const rows: { employeeId: number | null; employeeCode: string; punchedAt: Date; device: string | null }[] = []
  // a punch for a day of a locked attendance month is left out (2026-11-22)
  const lock = await daysService.loadLockState()
  for (const { rowNumber, values } of sheet.rows) {
    const code = String(values[codeHeader] ?? '').trim().toUpperCase()
    if (!code) {
      errors.push(`Row ${rowNumber}: no employee code`)
      continue
    }
    const employeeId = ids.get(code) ?? null
    if (employeeId !== null && !allowed.has(employeeId)) {
      errors.push(`Row ${rowNumber}: employee code ${code} cannot be used here`)
      continue
    }
    const zone = (employeeId && zoneOf.get(employeeId)) || DEFAULT_ZONE
    let punchedAt: Date | null = null
    // the date-time column, when its cell really holds a date and a time (it wins: a night shift's out punch can be the
    // day after the file's "Date")
    const cell = dateTimeHeader ? values[dateTimeHeader] : null
    // a time-only Excel cell comes as a day of 1899 - not a date and a time
    if (cell instanceof Date && cell.getUTCFullYear() >= 2000) punchedAt = wallClockToInstant(cell, zone)
    else if (typeof cell === 'string') {
      const parsed = parseText(cell)
      punchedAt = parsed ? ('instant' in parsed ? parsed.instant : wallClockToInstant(parsed.wall, zone)) : null
    }
    // otherwise a "Date" column and a time column together - also when the time column is called "Punch time" or "Log
    // time", which are date-time names too (2026-11-23: "Date" + "Punch Time", the usual machine export, was read as a
    // date-time column alone - time-only cells became punches of 30-12-1899, text times were all refused)
    if (!punchedAt && dateHeader && timeHeader) {
      const joined = joinDateTime(values[dateHeader] ?? null, values[timeHeader] ?? null)
      punchedAt = joined ? wallClockToInstant(joined.wall, zone) : null
    }
    if (!punchedAt) {
      errors.push(`Row ${rowNumber}: the time cannot be read`)
      continue
    }
    if (punchedAt.getTime() > Date.now() + 10 * 60_000) {
      errors.push(`Row ${rowNumber}: the time is in the future`)
      continue
    }
    if (daysService.isLockedDay(localDay(punchedAt, zone), lock)) {
      errors.push(`Row ${rowNumber}: ${code}'s punch is in a locked attendance month`)
      continue
    }
    const device = deviceHeader ? String(values[deviceHeader] ?? '').trim() || null : null
    rows.push({ employeeId, employeeCode: code, punchedAt, device })
  }

  const added = await prisma.$transaction(
    async (tx) => {
      const upload = await punchesRepository.createUpload({ fileName: file.name, rowCount: sheet.rows.length }, actorId, tx)
      const count = await punchesRepository.addPunches(
        rows.map((r) => ({ ...r, source: 'UPLOAD' as const, uploadId: upload.id })),
        actorId,
        tx,
      )
      const unmatched = new Set(rows.filter((r) => r.employeeId === null).map((r) => r.employeeCode)).size
      await punchesRepository.finishUpload(upload.id, { addedCount: count, duplicateCount: rows.length - count, unmatchedCount: unmatched }, actorId, tx)
      return { count, unmatched, uploadId: upload.id }
    },
    { timeout: 120_000 },
  )

  // the days of the matched punches are worked out again
  const matched = rows.filter((r) => r.employeeId !== null)
  if (matched.length) {
    const days = matched.map((r) => localDay(r.punchedAt, zoneOf.get(r.employeeId!) ?? DEFAULT_ZONE).getTime())
    const from = addDays(new Date(Math.min(...days)), -1)
    const to = new Date(Math.max(...days))
    await daysService.recompute([...new Set(matched.map((r) => r.employeeId!))], from, to)
  }
  return {
    uploadId: added.uploadId,
    rowCount: sheet.rows.length,
    added: added.count,
    duplicates: rows.length - added.count,
    unmatchedCodes: added.unmatched,
    skipped: errors.length,
    errors: errors.slice(0, 50),
  }
}

// Punches typed by hand for one employee on one day - for testing the attendance (the user, 2026-11-22). Never in
// production: there a punch comes only from the machines. Stored like an uploaded punch (the same punch is kept once),
// marked with the device "Manual entry (testing)"; the day is worked out again.
export async function addManualPunches({ employeeCode, date, times }: z.infer<typeof addManualPunchesInput>, viewer: CurrentUser) {
  if (env.NODE_ENV === 'production') throw new ORPCError('FORBIDDEN', { message: 'Punches can be typed by hand only on a test system' })
  const ids = await employeesService.mapCodesToIds([employeeCode])
  const employeeId = ids.get(employeeCode)
  const [person] = employeeId ? await employeesService.listAttendancePeople({ scope: SYSTEM_SCOPE, ids: [employeeId], from: new Date(Date.UTC(1950, 0, 1)), to: new Date(Date.UTC(2200, 0, 1)) }) : []
  if (!person) throw new ORPCError('NOT_FOUND', { message: `No employee found with code ${employeeCode}` })
  // Attendance setup Edit covering the employee (data access)
  daysService.assertAttendanceEdit(viewer, person, 'ATTENDANCE_SETUP')
  await daysService.assertOpenDays([date])
  const punchedAt = [...new Set(times)].map((minutes) => zonedInstant(date, minutes, person.timezone))
  if (punchedAt.some((t) => t.getTime() > Date.now() + 10 * 60_000)) throw new ORPCError('BAD_REQUEST', { message: 'A punch cannot be in the future' })
  const added = await punchesRepository.addPunches(
    punchedAt.map((t) => ({ employeeId: person.id, employeeCode: person.employeeCode, punchedAt: t, device: 'Manual entry (testing)', source: 'UPLOAD' as const, uploadId: null })),
    viewer.employeeId,
  )
  await daysService.recompute([person.id], addDays(date, -1), date)
  return { added, duplicates: punchedAt.length - added }
}

export async function listUploads() {
  const rows = await punchesRepository.listUploads(30)
  const person = await employeesService.lookupPeople(rows.map((r) => r.createdById))
  return rows.map(({ createdById, ...row }) => ({ ...row, by: person(createdById) }))
}

export function listUnmatched() {
  return punchesRepository.listUnmatched()
}

// The punches of a code that matched no employee go to this employee; their days are worked out again
export async function linkUnmatched({ code, employeeCode }: { code: string; employeeCode: string }, viewer: CurrentUser) {
  const actorId = viewer.employeeId
  const employeeId = (await employeesService.mapCodesToIds([employeeCode])).get(employeeCode)
  if (!employeeId) throw new ORPCError('NOT_FOUND', { message: `No employee found with code ${employeeCode}` })
  // Attendance setup Edit covering the employee (data access)
  const [person] = await employeesService.listAttendancePeople({ scope: SYSTEM_SCOPE, ids: [employeeId], from: new Date(Date.UTC(1950, 0, 1)), to: new Date(Date.UTC(2200, 0, 1)) })
  if (!person) throw new ORPCError('NOT_FOUND', { message: `No employee found with code ${employeeCode}` })
  daysService.assertAttendanceEdit(viewer, person, 'ATTENDANCE_SETUP')
  const times = await punchesRepository.linkCode(code.toUpperCase(), employeeId, actorId)
  if (!times.length) throw new ORPCError('NOT_FOUND', { message: `No unmatched punches with code ${code}` })
  const from = new Date(Math.min(...times.map((t) => t.getTime())) - DAY_MS)
  const to = new Date(Math.max(...times.map((t) => t.getTime())) + DAY_MS)
  await daysService.recompute([employeeId], new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())), new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate())))
  return { linked: times.length }
}
