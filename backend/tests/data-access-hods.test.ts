import { prisma, SYSTEM_ACTOR } from '#core/db/prisma'
import { toApiError } from '#core/rpc/errors'
import { employeesSchemas, employeesService, hodsService } from '#modules/employees'
import { plantsService } from '#modules/organization'
import { today } from '#shared/utils/dates'
import { addDays, zonedInstant } from '#shared/utils/time'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createCompany, createDepartment, createEmployee, createPlant } from './helpers/organization.js'
import { row, userWith } from './helpers/users.js'

// HOD appointments (BACKLOG 3e - an HOD post is a plant-department, changed with the user 2026-11-19): every employee's
// HOD post is the plant-department they are placed in (every employee has a department - 2026-11-19); HODs are appointed
// only inside the data access (H3); an appointment runs from a moment until a moment, India time for every plant (2026-11-19) -
// at once, from a later day or backdated - and replacing an HOD leaves no gap or overlap; "My department" covers only the
// posts one heads now, never oneself.
describe('HOD appointments on plant-departments', () => {
  const day = (n: number) => addDays(today(), n)
  // a day - its midnight in India time
  const clock = (n: number) => ({ day: day(n) })
  const at = (n: number) => zonedInstant(day(n), 0, 'Asia/Kolkata')
  const iso = (d: Date | null) => d?.toISOString() ?? null
  let companyA: number
  let companyB: number
  let plantA1: number
  let plantA2: number
  let plantB1: number
  let maintenance: number
  let stores: number
  let other: number
  let admin: ReturnType<typeof userWith>
  let hrForA: ReturnType<typeof userWith>
  let hrForA1: ReturnType<typeof userWith>
  type Person = { id: number; employeeCode: string }
  let people: Record<'hod1' | 'hod2' | 'a1m' | 'a1m2' | 'a2m' | 'a2o' | 'b1m', Person>
  // the posts (plant-departments)
  const post: Record<string, number> = {}
  const postOf = async (plantId: number, departmentId: number) => (await plantsService.findPlantDepartmentId(plantId, departmentId))!
  // a department of its own at the plant, with one employee - a post to play with
  const freshPost = async (plantId: number, companyId = companyA) => {
    const department = (await createDepartment()).id
    await plantsService.addPlantDepartments(plantId, [department], SYSTEM_ACTOR)
    await createEmployee({ companyId, plantId, departmentId: department })
    return postOf(plantId, department)
  }

  beforeAll(async () => {
    companyA = (await createCompany()).id
    companyB = (await createCompany()).id
    plantA1 = (await createPlant(companyA)).id
    plantA2 = (await createPlant(companyA)).id
    plantB1 = (await createPlant(companyB)).id
    maintenance = (await createDepartment()).id
    stores = (await createDepartment()).id
    other = (await createDepartment()).id
    await plantsService.addPlantDepartments(plantA1, [maintenance, stores], SYSTEM_ACTOR)
    await plantsService.addPlantDepartments(plantA2, [maintenance, other], SYSTEM_ACTOR)
    await plantsService.addPlantDepartments(plantB1, [maintenance], SYSTEM_ACTOR)
    post.a1m = await postOf(plantA1, maintenance)
    post.a1s = await postOf(plantA1, stores)
    post.a2m = await postOf(plantA2, maintenance)
    post.a2o = await postOf(plantA2, other)
    post.b1m = await postOf(plantB1, maintenance)
    const placed = (companyId: number, plantId: number, departmentId: number) => createEmployee({ companyId, plantId, departmentId })
    people = {
      hod1: await placed(companyA, plantA1, stores),
      hod2: await placed(companyA, plantA2, maintenance),
      a1m: await placed(companyA, plantA1, maintenance),
      a1m2: await placed(companyA, plantA1, maintenance),
      a2m: await placed(companyA, plantA2, maintenance),
      a2o: await placed(companyA, plantA2, other),
      b1m: await placed(companyB, plantB1, maintenance),
    }
    admin = userWith(people.b1m, [], { isSuperAdmin: true })
    hrForA = userWith(people.b1m, [{ access: { HOD_APPOINTMENTS: 'WRITE', EMPLOYEES: 'WRITE', JOB_CHANGE_APPROVAL: 'WRITE' }, rows: [row(companyA, null, null)] }])
    hrForA1 = userWith(people.b1m, [{ access: { HOD_APPOINTMENTS: 'WRITE', EMPLOYEES: 'WRITE' }, rows: [row(companyA, plantA1, null)] }])
  })
  afterAll(() => prisma.$disconnect())

  it("stores each employee's HOD post: the plant-department they are placed in, and the new one after a move", async () => {
    expect((await employeesService.getByCodeFor(admin, people.a1m.employeeCode)).hod?.postId).toBe(post.a1m)
    const mover = await createEmployee({ companyId: companyA, plantId: plantA1, departmentId: maintenance })
    await employeesService.updateEmployee({ employeeCode: mover.employeeCode, plantId: plantA2 }, hrForA)
    expect((await employeesService.getByCodeFor(admin, mover.employeeCode)).hod?.postId).toBe(post.a2m)
    await employeesService.updateEmployee({ employeeCode: mover.employeeCode, departmentId: other }, hrForA)
    expect((await employeesService.getByCodeFor(admin, mover.employeeCode)).hod?.postId).toBe(post.a2o)
    // a department is changed, never cleared
    expect(employeesSchemas.updateEmployeeInput.safeParse({ employeeCode: mover.employeeCode, departmentId: null }).success).toBe(false)
  })

  it('appoints and ends HODs only inside the data access', async () => {
    const result = await hodsService.appointHod({ employeeCode: people.hod1.employeeCode, from: clock(-60), postIds: [post.a1m!] }, hrForA1)
    expect(result).toMatchObject({ appointed: 1, unchanged: 0, replaced: [] })
    // plant A2 and company B are outside: "not found"
    await expect(hodsService.appointHod({ employeeCode: people.hod1.employeeCode, from: clock(-60), postIds: [post.a2m!] }, hrForA1)).rejects.toThrow('No HOD post found')
    await expect(hodsService.appointHod({ employeeCode: people.hod1.employeeCode, from: clock(-60), postIds: [post.b1m!] }, hrForA)).rejects.toThrow('No HOD post found')
    // View only: seen, not changed
    const viewOnly = userWith(people.b1m, [{ access: { HOD_APPOINTMENTS: 'WRITE' }, rows: [row(companyA, null, null, 'READ')] }])
    await expect(hodsService.appointHod({ employeeCode: people.hod1.employeeCode, from: clock(-60), postIds: [post.a2m!] }, viewOnly)).rejects.toThrow('inside your data access')
    // the lists follow the data access
    const places = (await hodsService.listPlaces(hrForA1)).map((p) => p.id)
    expect(places).toEqual(expect.arrayContaining([post.a1m, post.a1s]))
    expect(places).not.toContain(post.a2m)
    expect(places).not.toContain(post.b1m)
    const hods = await hodsService.listHods(hrForA1)
    expect(hods.find((h) => h.employeeCode === people.hod1.employeeCode)?.places.map((p) => p.id)).toEqual([post.a1m])
  })

  it('replaces an HOD at the very moment the next starts, without gaps or overlaps; one person heads several places', async () => {
    const result = await hodsService.appointHod({ employeeCode: people.hod2.employeeCode, from: clock(-30), postIds: [post.a1m!, post.a2m!] }, hrForA)
    expect(result.appointed).toBe(2)
    expect(result.replaced.map((r) => r.employeeCode)).toEqual([people.hod1.employeeCode])
    const history = await hodsService.hodHistory({ postId: post.a1m! }, hrForA1)
    expect(history.map((h) => [h.employeeCode, iso(h.startsAt), iso(h.endsAt), h.status])).toEqual([
      [people.hod2.employeeCode, iso(at(-30)), null, 'CURRENT'],
      [people.hod1.employeeCode, iso(at(-60)), iso(at(-30)), 'PAST'],
    ])
    expect((await hodsService.hodHistory({ employeeCode: people.hod2.employeeCode }, hrForA)).length).toBe(2)
    // already theirs: unchanged; backdating reaches back to the current HOD's start - no further
    expect(await hodsService.appointHod({ employeeCode: people.hod2.employeeCode, from: clock(-5), postIds: [post.a1m!] }, hrForA)).toMatchObject({ appointed: 0, unchanged: 1 })
    await expect(hodsService.appointHod({ employeeCode: people.a1m2.employeeCode, from: clock(-30), postIds: [post.a1m!] }, hrForA)).rejects.toThrow('can only start after')
    // changing places in one go: plant A2 / other added, plant A1 / Maintenance taken away at that moment
    await hodsService.appointHod({ employeeCode: people.hod2.employeeCode, from: clock(-10), postIds: [post.a2o!], endPostIds: [post.a1m!] }, hrForA)
    const hods = await hodsService.listHods(hrForA)
    expect(hods.find((h) => h.employeeCode === people.hod2.employeeCode)?.places.map((p) => p.id).sort()).toEqual([post.a2m, post.a2o].sort())
    expect((await hodsService.hodHistory({ postId: post.a1m! }, admin))[0]).toMatchObject({ employeeCode: people.hod2.employeeCode, endsAt: at(-10), status: 'PAST' })
    // ending: not before it began
    await expect(hodsService.endHod({ employeeCode: people.hod2.employeeCode, lastDay: clock(-40), postIds: [post.a2o!] }, hrForA)).rejects.toThrow('cannot be before')
  })

  it("the user's case: an HOD resigns, last day 19-11-2026, nobody after - ends at midnight India time; flagged, then vacant", async () => {
    const india = await freshPost(plantA1)
    const joined = { day: new Date(Date.UTC(2026, 0, 1)) }
    const lastDay = { day: new Date(Date.UTC(2026, 10, 19)) }
    await hodsService.appointHod({ employeeCode: people.hod1.employeeCode, from: joined, postIds: [india] }, hrForA)
    expect(await hodsService.endHod({ employeeCode: people.hod1.employeeCode, lastDay, postIds: [india] }, hrForA)).toEqual({ ended: 1, cancelled: 0, unchanged: 0 })
    const [inIndia] = await hodsService.hodHistory({ postId: india }, admin)
    // the first day from its midnight, the last day to the midnight after it - India time
    expect(iso(inIndia!.startsAt)).toBe('2025-12-31T18:30:00.000Z')
    expect(iso(inIndia!.endsAt)).toBe('2026-11-19T18:30:00.000Z')
    // until then still the HOD - the gap list says nobody is appointed after; from then the place is vacant
    const stillHod = new Date() < inIndia!.endsAt!
    const gaps = await hodsService.listGaps(hrForA)
    expect(gaps.ending.some((p) => p.id === india)).toBe(stillHod)
    expect(gaps.vacant.some((p) => p.id === india)).toBe(!stillHod)
  })

  it('plans a change for a later day, cancels it, takes back a planned end - and hands over at once', async () => {
    const place = await freshPost(plantA1)
    await hodsService.appointHod({ employeeCode: people.hod1.employeeCode, from: clock(-20), postIds: [place] }, hrForA)
    // the HOD's last day is planned: still theirs until its end, and the gap list says nobody comes after
    await hodsService.endHod({ employeeCode: people.hod1.employeeCode, lastDay: clock(5), postIds: [place] }, hrForA)
    expect((await hodsService.listGaps(hrForA)).ending.map((p) => p.id)).toContain(place)
    // a successor from the next day: upcoming - shown as next, no "My department" before it starts
    await hodsService.appointHod({ employeeCode: people.a1m2.employeeCode, from: clock(6), postIds: [place] }, hrForA)
    const planned = (await hodsService.listPlaces(hrForA)).find((p) => p.id === place)!
    expect(planned.hod).toMatchObject({ employeeCode: people.hod1.employeeCode, until: at(6) })
    expect(planned.next).toMatchObject({ employeeCode: people.a1m2.employeeCode, from: at(6) })
    expect((await hodsService.listGaps(hrForA)).ending.map((p) => p.id)).not.toContain(place)
    expect((await hodsService.myDepartment(userWith(people.a1m2, []))).posts.map((p) => p.id)).not.toContain(place)
    // the planned end cannot be taken back while someone takes over; another HOD cannot slip in before the successor
    await expect(hodsService.endHod({ employeeCode: people.hod1.employeeCode, lastDay: null, postIds: [place] }, hrForA)).rejects.toThrow('cancel that first')
    await expect(hodsService.appointHod({ employeeCode: people.a1m.employeeCode, from: clock(2), postIds: [place] }, hrForA)).rejects.toThrow('cancel that first')
    // ending the upcoming one before it starts cancels it; then the planned end is taken back (the resignation withdrawn)
    expect(await hodsService.endHod({ employeeCode: people.a1m2.employeeCode, postIds: [place] }, hrForA)).toMatchObject({ cancelled: 1 })
    expect(await hodsService.endHod({ employeeCode: people.hod1.employeeCode, lastDay: null, postIds: [place] }, hrForA)).toMatchObject({ ended: 1 })
    expect((await hodsService.hodHistory({ postId: place }, admin)).map((h) => [h.employeeCode, h.endsAt])).toEqual([[people.hod1.employeeCode, null]])
    // at once: the old HOD stops at the very moment the new one starts
    const before = new Date()
    await hodsService.appointHod({ employeeCode: people.a1m.employeeCode, postIds: [place] }, hrForA)
    const [now, previous] = await hodsService.hodHistory({ postId: place }, admin)
    expect(now).toMatchObject({ employeeCode: people.a1m.employeeCode, endsAt: null, status: 'CURRENT' })
    expect(now!.startsAt >= before).toBe(true)
    expect(previous).toMatchObject({ employeeCode: people.hod1.employeeCode, endsAt: now!.startsAt, status: 'PAST' })
    expect((await hodsService.myDepartment(userWith(people.a1m, []))).posts.map((p) => p.id)).toContain(place)
  })

  it('flags leavers who head or will head a place after their leaving day', async () => {
    const place = await freshPost(plantA1)
    const leaver = await createEmployee({ companyId: companyA, plantId: plantA1, leavesOn: day(10) })
    // not from after their leaving day; until then yes - and flagged while the appointment runs past it
    await expect(hodsService.appointHod({ employeeCode: leaver.employeeCode, from: clock(11), postIds: [place] }, hrForA)).rejects.toThrow('leaves on')
    await hodsService.appointHod({ employeeCode: leaver.employeeCode, from: clock(-1), postIds: [place] }, hrForA)
    const flagged = (await hodsService.listGaps(hrForA)).leavers.find((l) => l.employeeCode === leaver.employeeCode)
    expect(flagged?.posts.map((p) => p.id)).toEqual([place])
    // their appointment ending with their last day: no longer flagged
    await hodsService.endHod({ employeeCode: leaver.employeeCode, lastDay: clock(10), postIds: [place] }, hrForA)
    expect((await hodsService.listGaps(hrForA)).leavers.map((l) => l.employeeCode)).not.toContain(leaver.employeeCode)
  })

  it('never lets two appointments of a post overlap, even when two people appoint at the same moment (the database refuses)', async () => {
    const lab = (await createDepartment()).id
    await plantsService.addPlantDepartments(plantA2, [lab], SYSTEM_ACTOR)
    const labPost = await postOf(plantA2, lab)
    const appoint = (who: Person) => hodsService.appointHod({ employeeCode: who.employeeCode, from: clock(-2), postIds: [labPost] }, hrForA)
    const results = await Promise.allSettled([appoint(people.a2m), appoint(people.a2o)])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    // the second waits for the first (lockPosts), then sees the place taken - the usual message, not a database error
    const failed = results.find((r) => r.status === 'rejected')
    expect(String((failed as PromiseRejectedResult).reason)).toContain('can only start after')
    const current = (await hodsService.hodHistory({ postId: labPost }, admin)).filter((h) => h.status === 'CURRENT')
    expect(current).toHaveLength(1)
    // and the database itself refuses an appointment of the post overlapping another (one before it, ended, is history)
    const other = current[0]!.employeeCode === people.a2m.employeeCode ? people.a2o : people.a2m
    const write = (endsAt: Date | null) =>
      prisma.hodAppointment.create({ data: { postId: labPost, employeeId: other.id, startsAt: at(-9), endsAt, createdById: SYSTEM_ACTOR, updatedById: SYSTEM_ACTOR } })
    const refused = await write(null).catch((error: unknown) => error)
    expect((toApiError(refused) as { code?: string }).code).toBe('CONFLICT')
    await expect(write(at(-8))).resolves.toMatchObject({ postId: labPost })
  })

  it('shows an HOD the employees of the posts they head - never themselves - in "My department" and attendance', async () => {
    const hod = userWith(people.hod2, [])
    const mine = await hodsService.myDepartment(hod)
    const codes = mine.employees.map((e) => e.employeeCode)
    expect(mine.posts.map((p) => p.id).sort()).toEqual([post.a2m, post.a2o].sort())
    expect(codes).toEqual(expect.arrayContaining([people.a2m.employeeCode, people.a2o.employeeCode]))
    // they work at plant A2 / Maintenance themselves, but are not their own HOD; plant A1 is no longer theirs
    expect(codes).not.toContain(people.hod2.employeeCode)
    expect(codes).not.toContain(people.a1m.employeeCode)
    const { peopleInScope } = await import('../src/modules/attendance/days/days.service.js')
    const inView = await peopleInScope(hod, { scope: 'DEPARTMENT' }, day(0), day(0))
    expect(inView.map((p) => p.employeeCode).sort()).toEqual([...codes].sort())
    const nobody = userWith(people.a1m2, [])
    expect(await peopleInScope(nobody, { scope: 'DEPARTMENT' }, day(0), day(0))).toEqual([])
    expect((await hodsService.myDepartment(nobody)).employees).toEqual([])
  })

  it('lists the gaps inside the data access only', async () => {
    const gaps = await hodsService.listGaps(hrForA)
    // plant A1 / Maintenance has employees and no HOD since hod2 left it
    expect(gaps.vacant.map((p) => p.id)).toContain(post.a1m)
    expect(gaps.vacant.map((p) => p.id)).not.toContain(post.a2m)
    expect(gaps.vacant.map((p) => p.company.id)).not.toContain(companyB)
    expect((await hodsService.listGaps(admin)).vacant.map((p) => p.id)).toContain(post.b1m)
  })

  it('retires, never deletes, a department with HOD history when it is unticked at the plant', async () => {
    const plant = (await createPlant(companyA)).id
    const extra = (await createDepartment()).id
    await plantsService.addPlantDepartments(plant, [extra], SYSTEM_ACTOR)
    const extraPost = await postOf(plant, extra)
    await hodsService.appointHod({ employeeCode: people.hod1.employeeCode, from: clock(-3), postIds: [extraPost] }, hrForA)
    await hodsService.endHod({ employeeCode: people.hod1.employeeCode, lastDay: clock(0), postIds: [extraPost] }, hrForA)
    expect(await plantsService.setPlantDepartments({ id: plant, departmentIds: [] }, SYSTEM_ACTOR)).toEqual({ added: 0, removed: 1 })
    // still there (retired), with its history
    expect(await plantsService.findPlantDepartmentId(plant, extra)).toBe(extraPost)
    expect((await hodsService.hodHistory({ postId: extraPost }, admin)).length).toBe(1)
  })
})

// An HOD may head the place their own manager works in (the user, 2026-11-22 - was refused from 2026-11-20); when several
// places are ticked and one cannot change, the message says which to untick
describe('an HOD above their own manager', () => {
  const admin = userWith({ id: 0, employeeCode: 'SYSTEM' }, [], { isSuperAdmin: true })
  it('allows the place where the manager works, and names the place to untick when one of several fails', async () => {
    const companyId = (await createCompany()).id
    const plantId = (await createPlant(companyId)).id
    const itDept = (await createDepartment()).id
    const admins = (await createDepartment()).id
    await plantsService.addPlantDepartments(plantId, [itDept, admins], SYSTEM_ACTOR)
    const boss = await createEmployee({ companyId, plantId, departmentId: admins })
    const junior = await createEmployee({ companyId, plantId, departmentId: itDept })
    const other = await createEmployee({ companyId, plantId, departmentId: itDept })
    await prisma.employee.update({ where: { id: junior.id }, data: { reportingManagerId: boss.id, updatedById: SYSTEM_ACTOR } })
    const itPost = (await plantsService.findPlantDepartmentId(plantId, itDept))!
    const adminPost = (await plantsService.findPlantDepartmentId(plantId, admins))!
    await expect(hodsService.appointHod({ employeeCode: junior.employeeCode, postIds: [adminPost] }, admin)).resolves.toMatchObject({ appointed: 1 })
    // someone else is appointed to IT later: appointing the other to both places now stops, naming IT to untick
    const later = new Date(Date.now() + 10 * 24 * 3600 * 1000)
    await hodsService.appointHod({ employeeCode: junior.employeeCode, postIds: [itPost], from: { day: later } }, admin)
    await expect(hodsService.appointHod({ employeeCode: other.employeeCode, postIds: [adminPost, itPost] }, admin)).rejects.toThrow(/Untick .* to go on with the other places/)
  })
})
