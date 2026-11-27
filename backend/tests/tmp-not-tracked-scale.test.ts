import { writeFileSync } from 'node:fs'
import { afterAll, describe, expect, it } from 'vitest'
import { prisma } from '#core/db/prisma'
import { today } from '#shared/utils/dates'
import * as daysRepository from '../src/modules/attendance/days/days.repository.js'
import * as daysService from '../src/modules/attendance/days/days.service.js'
import * as exemptionsService from '../src/modules/attendance/exemptions/exemptions.service.js'
import { row, userWith } from './helpers/users.js'

// TEMPORARY size check (not kept): marking about a thousand employees "attendance not tracked" in one go - the
// employees already in the test database from earlier runs. Everything it writes is removed again.
const hr = userWith({ id: 0, employeeCode: 'HRSCALE' }, [{ access: { ATTENDANCE: 'WRITE', ATTENDANCE_SETUP: 'WRITE' }, rows: [row(null, null, null)] }])
const OUT = process.env.SCALE_OUT!
const DAY = 86_400_000

describe('size check: a thousand people marked at once', () => {
  afterAll(() => prisma.$disconnect())
  it('saves the markers and works their days out again in good time', async () => {
    const now = today()
    const from = new Date(now.getTime() - 6 * DAY)
    const startDay = await daysRepository.findCycleStartDay()
    const first = daysService.cycleOf(from, startDay)
    const monthFrom = daysService.cycleRange(first.year, first.month, startDay).from
    const people = await prisma.employee.findMany({
      where: { dateOfJoining: { lte: monthFrom }, dateOfLeaving: null, attendanceExemptions: { none: {} } },
      orderBy: { id: 'desc' },
      take: 1000,
      select: { id: true, employeeCode: true },
    })
    const ids = people.map((p) => p.id)
    const lines: string[] = [`people ${people.length}`]
    const hadDays = new Set(await daysRepository.listEmployeeIdsWithDays(monthFrom, now, ids))
    let t = Date.now()
    // their days of the open month, as the nightly close would have made them
    await daysService.recompute(ids, from, now)
    lines.push(`first working-out ms ${Date.now() - t}`)
    const reason = `SCALE-${Date.now()}`
    try {
      t = Date.now()
      const result = await exemptionsService.markNotTracked({ employeeCodes: people.map((p) => p.employeeCode), fromDate: from, reason }, hr)
      lines.push(`mark + rework ms ${Date.now() - t}`, `result ${JSON.stringify(result)}`)
      expect(result.marked).toBe(people.length)
      const notes = await prisma.attendanceDay.count({ where: { employeeId: { in: ids }, date: { gte: from, lte: now }, note: daysService.NOT_TRACKED_NOTE } })
      const absent = await prisma.attendanceDay.count({ where: { employeeId: { in: ids }, date: { gte: from, lt: now }, OR: [{ firstHalf: 'ABSENT' }, { secondHalf: 'ABSENT' }] } })
      lines.push(`days counted present ${notes}`, `absent halves left from the marker's first day ${absent}`)
      expect(notes).toBeGreaterThan(0)
      t = Date.now()
      const again = await exemptionsService.markNotTracked({ employeeCodes: people.map((p) => p.employeeCode), fromDate: from, reason }, hr)
      lines.push(`asked again ms ${Date.now() - t}`, `again ${JSON.stringify(again)}`)
      expect(again).toEqual({ marked: 0, unchanged: people.length })
    } finally {
      // clean up: the markers, and the days of those who had none before
      const removed = await prisma.attendanceExemption.deleteMany({ where: { employeeId: { in: ids }, reason } })
      const fresh = ids.filter((id) => !hadDays.has(id))
      const days = await prisma.attendanceDay.deleteMany({ where: { employeeId: { in: fresh }, date: { gte: monthFrom, lte: now } } })
      // the others: back to what the punches give
      await daysService.recompute(ids.filter((id) => hadDays.has(id)), from, now)
      lines.push(`cleaned: markers ${removed.count}, day rows ${days.count}, reworked ${hadDays.size}`)
      writeFileSync(OUT, lines.join('\n'))
    }
  }, 600_000)
})
