import { assertAccess } from '#core/auth/access'
import { reportFile, reportSheet } from '#core/excel/report'
import { hasLevelAt, type Placement, scopeAllows, scopeOf, SYSTEM_SCOPE } from '#core/auth/scope'
import { type ActorId, type DbClient, prisma } from '#core/db/prisma'
import type { CurrentUser } from '#core/rpc/procedures'
import { plantsService } from '#modules/organization'
import { formatDate } from '#shared/utils/dates'
import { addDays, formatMoment, spanStatus, zonedInstant } from '#shared/utils/time'
import { ORPCError } from '@orpc/server'
import type { z } from 'zod'
import * as employeesService from '../employees.service.js'
import * as hodsRepository from './hods.repository.js'
import type { appointHodInput, endHodInput, hodHistoryInput, clockSchema, exportHodsInput } from './hods.schema.js'

// HOD appointments (BACKLOG 3e, changed with the user 2026-11-19).
// - An HOD POST is a plant-department: one company + one of its plants + one department running there. It exists as soon
//   as the department is ticked at the plant (Organization page) - there is nothing else to create or keep in step.
// - An APPOINTMENT says who heads a post from a moment until a moment (the end not included; none = no end planned) -
//   one HOD per post at a time (the database refuses overlaps). Moments, not days (2026-11-19): a change takes effect at
//   once ("now"), from a later day (an upcoming appointment - nothing has to run when it comes: upcoming / current / past
//   follow from the clock), or from an earlier moment (backdating - back to the start of the appointment going on; what
//   was before is history and never changes). Days and times are India time for every plant (the user, 2026-11-19): a
//   day starts at midnight IST; a last day ends at the midnight after it. Appointing someone
//   ends the HOD then at that very moment. An upcoming appointment can be ended before it starts: it is cancelled.
// - One person heads any number of posts, in any companies - the screens list the HODs (about 15-20, the user,
//   2026-11-19) with the places each heads.
// - Every employee stores their HOD post (employees.service: hodPostOf) - for now the one they are placed in.
// - Access (H3): HOD appointments - View sees the posts inside the viewer's data access, Edit changes only those. An
//   HOD's own "My department" needs no role - from the moment their appointment starts.
// - Leavers (2026-11-19): nothing records a resignation yet - HR ends the appointment (in advance too); the gap list flags
//   HODs who have left, or whose leaving day comes before their appointment ends, and places whose HOD stops with nobody
//   appointed after. Later (BACKLOG 3e): the exit module ends a leaver's appointments; approvals (the leave module); an
//   HOD from another place for one employee.

type Post = Awaited<ReturnType<typeof plantsService.listAllPlantDepartments>>[number]
type Appointment = Awaited<ReturnType<typeof hodsRepository.listOpenAppointments>>[number]
type Person = Appointment['employee']
type Clock = z.infer<typeof clockSchema>

const placementOf = (post: Post): Placement => ({ companyId: post.plant.company.id, plantId: post.plant.id, departmentId: post.department.id })
// "RML · 1101 RML HQ · Maintenance"
export const postLabel = (post: Post) => `${post.plant.company.code} · ${post.plant.plantCode} ${post.plant.name} · ${post.department.name}`
const bad = (message: string) => new ORPCError('BAD_REQUEST', { message })
// An error about one of the ticked places: when several are ticked, the whole change stops - so it says which to untick
type PlaceError = (label: string, message: string) => ORPCError<'BAD_REQUEST', unknown>
const placeError =
  (several: boolean): PlaceError =>
  (label, message) =>
    bad(several ? `${message}. Untick ${label} to go on with the other places` : message)
const noPost = (id: number) => new ORPCError('NOT_FOUND', { message: `No HOD post found with id ${id}` })
const byPlace = (a: Post, b: Post) =>
  a.plant.company.code.localeCompare(b.plant.company.code) || a.plant.plantCode.localeCompare(b.plant.plantCode) || a.department.name.localeCompare(b.department.name)
const fullName = (person: Person) => employeesService.fullName(person)

// --- moments: India time for every plant (the user, 2026-11-19) ---
const ZONE = 'Asia/Kolkata'
// A start: the start of the day, or that minute of it; none = now
const startOf = (clock: Clock | undefined, now: Date) => (clock ? zonedInstant(clock.day, clock.minute ?? 0, ZONE) : now)
// An end: the end of the last day (the midnight after it), or that minute of it; none = now
const endOf = (clock: Clock | undefined, now: Date) =>
  clock ? zonedInstant(clock.minute === undefined ? addDays(clock.day, 1) : clock.day, clock.minute ?? 0, ZONE) : now
// "2026-11-20" / "2026-11-20 15:05" (IST) - for messages
const when = (at: Date) => formatMoment(at, ZONE)
// When a leaver stops working: the end of their leaving day (none: no leaving day known)
const leavesAt = (person: Person) => (person.dateOfLeaving ? zonedInstant(addDays(person.dateOfLeaving, 1), 0, ZONE) : null)

// A post as the screens get it
const toPost = (post: Post) => ({
  id: post.id,
  isActive: post.isActive,
  label: postLabel(post),
  company: post.plant.company,
  plant: { id: post.plant.id, plantCode: post.plant.plantCode, name: post.plant.name },
  department: { id: post.department.id, code: post.department.code, name: post.department.name },
})
// who heads a post now, and who will next
const hodOf = (a: Appointment) => ({ employeeCode: a.employee.employeeCode, name: fullName(a.employee), since: a.startsAt, until: a.endsAt })
const nextOf = (a: Appointment) => ({ employeeCode: a.employee.employeeCode, name: fullName(a.employee), from: a.startsAt })

const groupByPost = (rows: Appointment[]) => {
  const byPost = new Map<number, Appointment[]>()
  for (const row of rows) byPost.set(row.postId, [...(byPost.get(row.postId) ?? []), row])
  return byPost
}
// The appointments going on at `now` by post, and the upcoming ones (earliest first) - from listOpenAppointments
function splitOpen(open: Appointment[], now: Date) {
  const current = new Map<number, Appointment>()
  const upcoming = new Map<number, Appointment[]>()
  for (const a of open) {
    if (a.startsAt <= now) current.set(a.postId, a)
    else upcoming.set(a.postId, [...(upcoming.get(a.postId) ?? []), a])
  }
  return { current, upcoming }
}

// Every post by id, and which ones the viewer may see / change (data access - H3)
async function loadPosts(viewer: CurrentUser) {
  const posts = await plantsService.listAllPlantDepartments()
  const scope = scopeOf(viewer, 'HOD_APPOINTMENTS', 'READ')
  return {
    byId: new Map(posts.map((post) => [post.id, post])),
    scope,
    sees: (post: Post) => scopeAllows(scope, placementOf(post)),
    changes: (post: Post) => hasLevelAt(viewer, 'HOD_APPOINTMENTS', placementOf(post), 'WRITE'),
  }
}

// --- the HODs and the places ---

// The HODs (people) with the posts each heads now or will head (upcoming) - only posts inside the viewer's data access (a
// person is listed when one of theirs is) - and how many employees (inside it) have each post
export async function listHods(viewer: CurrentUser) {
  const now = new Date()
  const [{ byId, scope, sees, changes }, open] = await Promise.all([loadPosts(viewer), hodsRepository.listOpenAppointments(now)])
  const counts = await hodsRepository.countEmployeesByPost(scope)
  type Place = ReturnType<typeof toPost> & {
    appointmentId: number
    status: ReturnType<typeof spanStatus>
    startsAt: Date
    endsAt: Date | null
    employees: number
    canChange: boolean
  }
  const people = new Map<number, { employee: Person; places: Place[] }>()
  for (const a of open) {
    const post = byId.get(a.postId)
    if (!post || !sees(post)) continue
    const entry = people.get(a.employee.id) ?? { employee: a.employee, places: [] }
    entry.places.push({
      ...toPost(post),
      appointmentId: a.id,
      status: spanStatus(a, now),
      startsAt: a.startsAt,
      endsAt: a.endsAt,
      employees: counts.get(post.id) ?? 0,
      canChange: changes(post),
    })
    people.set(a.employee.id, entry)
  }
  return [...people.values()]
    .map(({ employee, places }) => ({
      employeeCode: employee.employeeCode,
      name: fullName(employee),
      hasLeft: employee.status === 'EXITED',
      // their leaving day, when known and still to come or just past (an exited one: hasLeft)
      leavingOn: employee.status === 'EXITED' ? null : employee.dateOfLeaving,
      places: places.sort((a, b) => a.label.localeCompare(b.label) || a.startsAt.getTime() - b.startsAt.getTime()),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

// Every post inside the viewer's data access - active ones, and retired ones someone still heads, will head or has - with
// who heads it now, who will next, and how many employees have it: the place picker and "By place"
export async function listPlaces(viewer: CurrentUser) {
  const now = new Date()
  const [{ byId, scope, sees, changes }, open] = await Promise.all([loadPosts(viewer), hodsRepository.listOpenAppointments(now)])
  const counts = await hodsRepository.countEmployeesByPost(scope)
  const { current, upcoming } = splitOpen(open, now)
  return [...byId.values()]
    .filter((post) => sees(post) && (post.isActive || current.has(post.id) || upcoming.has(post.id) || (counts.get(post.id) ?? 0) > 0))
    .sort(byPlace)
    .map((post) => {
      const hod = current.get(post.id)
      const next = upcoming.get(post.id)?.[0]
      return { ...toPost(post), hod: hod ? hodOf(hod) : null, next: next ? nextOf(next) : null, employees: counts.get(post.id) ?? 0, canChange: changes(post) }
    })
}

// --- appointing and ending ---

// The posts of `ids`, each inside the viewer's View data access ("not found" otherwise) and Edit data access
function postsToChange(ids: number[], posts: Awaited<ReturnType<typeof loadPosts>>) {
  return ids.map((id) => {
    const post = posts.byId.get(id)
    if (!post || !posts.sees(post)) throw noPost(id)
    if (!posts.changes(post)) throw new ORPCError('FORBIDDEN', { message: `You can only change HODs inside your data access - not of ${postLabel(post)}` })
    return post
  })
}

// The employee's appointment of a post that is not over at `now` - going on, or the upcoming one
const openOf = (rows: Appointment[], person: { id: number }, now: Date) => rows.find((a) => a.employee.id === person.id && (a.endsAt === null || a.endsAt > now))

// Ends an appointment at `at` (null: no end - takes back a planned end); `rows`: every appointment of its post. One that has
// not begun and would end before it begins is cancelled (removed - it never took effect). It cannot end before it began,
// nor after the next HOD of the post starts.
async function stopAppointment(
  appointment: Appointment,
  at: Date | null,
  rows: Appointment[],
  post: Post,
  now: Date,
  actorId: ActorId,
  tx: DbClient,
  fail: PlaceError,
): Promise<'ended' | 'cancelled' | 'unchanged'> {
  const label = postLabel(post)
  const next = rows.find((a) => a.startsAt > appointment.startsAt)
  if (at === null) {
    if (appointment.endsAt === null) return 'unchanged'
    if (next) throw fail(label, `${fullName(next.employee)} takes over ${label} at ${when(next.startsAt)} - cancel that first`)
    await hodsRepository.updateAppointment(appointment.id, { endsAt: null }, actorId, tx)
    return 'ended'
  }
  if (at <= appointment.startsAt) {
    if (appointment.startsAt > now) {
      await hodsRepository.deleteAppointments([appointment.id], tx)
      return 'cancelled'
    }
    throw fail(label, `${fullName(appointment.employee)} became HOD of ${label} at ${when(appointment.startsAt)} - the end cannot be before that`)
  }
  if (next && at > next.startsAt) {
    throw fail(label, `${fullName(next.employee)} takes over ${label} at ${when(next.startsAt)} - ${fullName(appointment.employee)} cannot stay later than that`)
  }
  if (appointment.endsAt?.getTime() === at.getTime()) return 'unchanged'
  await hodsRepository.updateAppointment(appointment.id, { endsAt: at }, actorId, tx)
  return 'ended'
}

// Appoints the employee to the posts from `from` (none = now), in one transaction: whoever heads a post
// then (someone else) stops at that moment; the posts they head then already stay as they are; their own upcoming
// appointment of a post starts earlier instead; `endPostIds` (posts they stop heading) end at that moment
export async function appointHod(input: z.infer<typeof appointHodInput>, viewer: CurrentUser) {
  const now = new Date()
  const adding = [...new Set(input.postIds)]
  const ending = [...new Set(input.endPostIds ?? [])]
  if (adding.some((id) => ending.includes(id))) throw bad('A place cannot be added and taken away at once')
  const person = await hodsRepository.findEmployeeByCode(input.employeeCode)
  if (!person) throw bad(`No employee found with code ${input.employeeCode}`)
  if (adding.length && person.status === 'EXITED') throw bad(`${input.employeeCode} has left - pick a current employee`)
  const name = fullName(person)
  const posts = await loadPosts(viewer)
  postsToChange([...adding, ...ending], posts)
  // an HOD may head the place their own manager works in (the user, 2026-11-22 - the 2026-11-20 rule blocked the place of
  // whoever tops the reporting tree, e.g. SUPERADMIN's, for everyone)
  const fail = placeError(adding.length + ending.length > 1)
  return prisma.$transaction(async (tx) => {
    // someone changing these posts at the same moment finishes first - then the rules below see what they did
    await hodsRepository.lockPosts([...adding, ...ending], tx)
    const rowsOf = groupByPost(await hodsRepository.listAppointmentsOfPosts([...adding, ...ending], tx))
    const toCreate: { postId: number; employeeId: number; startsAt: Date }[] = []
    const replaced: { post: string; employeeCode: string; name: string }[] = []
    const counts = { appointed: 0, unchanged: 0, ended: 0, cancelled: 0 }
    for (const id of adding) {
      const post = posts.byId.get(id)!
      const label = postLabel(post)
      const rows = rowsOf.get(id) ?? []
      const from = startOf(input.from, now)
      const leaves = leavesAt(person)
      if (leaves && from >= leaves) throw bad(`${name} leaves on ${formatDate(person.dateOfLeaving!)} - they cannot head ${label} from ${when(from)}`)
      // who heads it at that moment, and the next appointment after it
      const then = rows.find((a) => a.startsAt <= from && (a.endsAt === null || a.endsAt > from))
      const next = rows.find((a) => a.startsAt > from)
      // theirs then already (an appointment not over yet - a past one of theirs is history)
      if (then?.employee.id === person.id && (then.endsAt === null || then.endsAt > now)) {
        counts.unchanged++
        continue
      }
      // a retired place gets no new HOD - one heading it stays, and can still be ended (2026-11-23, the review)
      if (!post.isActive || !post.plant.isActive || !post.department.isActive) throw fail(label, `${label} is retired - it gets no new HOD`)
      // backdating reaches back to the start of the appointment going on now (or the end of the last one) - no further
      const latest = rows.filter((a) => a.startsAt <= now).at(-1)
      if (latest) {
        const over = latest.endsAt !== null && latest.endsAt <= now
        if (over && from < latest.endsAt!) throw fail(label, `${label} had an HOD until ${when(latest.endsAt!)} - a new HOD can only start from then`)
        if (!over && from <= latest.startsAt) {
          throw fail(label, `${fullName(latest.employee)} heads ${label} since ${when(latest.startsAt)} - a new HOD can only start after that`)
        }
      }
      if (next && next.employee.id !== person.id) {
        throw fail(label, `${fullName(next.employee)} is appointed to ${label} from ${when(next.startsAt)} - cancel that first (End), then appoint`)
      }
      if (then) {
        // someone else's upcoming appointment from that very moment cannot be cut to nothing
        if (then.startsAt.getTime() === from.getTime()) throw fail(label, `${fullName(then.employee)} is appointed to ${label} from ${when(from)} - cancel that first (End), then appoint`)
        await hodsRepository.updateAppointment(then.id, { endsAt: from }, viewer.employeeId, tx)
        replaced.push({ post: label, employeeCode: then.employee.employeeCode, name: fullName(then.employee) })
      }
      // their own upcoming appointment starts earlier - else a new one
      if (next) await hodsRepository.updateAppointment(next.id, { startsAt: from }, viewer.employeeId, tx)
      else toCreate.push({ postId: id, employeeId: person.id, startsAt: from })
      counts.appointed++
    }
    for (const id of ending) {
      const post = posts.byId.get(id)!
      const rows = rowsOf.get(id) ?? []
      const appointment = openOf(rows, person, now)
      if (!appointment) throw fail(postLabel(post), `${name} is not the HOD of ${postLabel(post)} now, nor appointed to it`)
      counts[await stopAppointment(appointment, startOf(input.from, now), rows, post, now, viewer.employeeId, tx, fail)]++
    }
    if (toCreate.length) await hodsRepository.createAppointments(toCreate, viewer.employeeId, tx)
    return { ...counts, replaced }
  })
}

// Ends the employee's appointments on these posts - the one going on, or an upcoming one (cancelled when it would end
// before it starts): `lastDay` (none = now; null = no end - takes back a planned end)
export async function endHod(input: z.infer<typeof endHodInput>, viewer: CurrentUser) {
  const now = new Date()
  const person = await hodsRepository.findEmployeeByCode(input.employeeCode)
  if (!person) throw bad(`No employee found with code ${input.employeeCode}`)
  const name = fullName(person)
  const ids = [...new Set(input.postIds)]
  const chosen = postsToChange(ids, await loadPosts(viewer))
  const fail = placeError(chosen.length > 1)
  return prisma.$transaction(async (tx) => {
    // someone changing these posts at the same moment finishes first (as in appointHod)
    await hodsRepository.lockPosts(ids, tx)
    const rowsOf = groupByPost(await hodsRepository.listAppointmentsOfPosts(ids, tx))
    const counts = { ended: 0, cancelled: 0, unchanged: 0 }
    for (const post of chosen) {
      const rows = rowsOf.get(post.id) ?? []
      const appointment = openOf(rows, person, now)
      if (!appointment) throw fail(postLabel(post), `${name} is not the HOD of ${postLabel(post)} now, nor appointed to it`)
      const at = input.lastDay === null ? null : endOf(input.lastDay, now)
      counts[await stopAppointment(appointment, at, rows, post, now, viewer.employeeId, tx, fail)]++
    }
    return counts
  })
}

// Who headed a post from when to when - or the posts an employee headed - the latest first, upcoming ones too, only posts
// inside the viewer's data access ("who was the HOD on 15-05")
export async function hodHistory(input: z.infer<typeof hodHistoryInput>, viewer: CurrentUser) {
  const now = new Date()
  const { byId, sees } = await loadPosts(viewer)
  let rows: Appointment[]
  if ('postId' in input) {
    const post = byId.get(input.postId)
    if (!post || !sees(post)) throw noPost(input.postId)
    rows = await hodsRepository.listAppointmentsOfPost(post.id)
  } else {
    const person = await hodsRepository.findEmployeeByCode(input.employeeCode)
    // (an unknown code: the same empty list as someone who headed nothing the viewer may see - it gives nothing away)
    if (!person) return []
    rows = (await hodsRepository.listAppointmentsOfEmployee(person.id)).filter((a) => {
      const post = byId.get(a.postId)
      return !!post && sees(post)
    })
  }
  const person = await employeesService.lookupPeople(rows.map((row) => row.createdById))
  return rows.map((row) => ({
    id: row.id,
    post: toPost(byId.get(row.postId)!),
    employeeCode: row.employee.employeeCode,
    name: fullName(row.employee),
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    status: spanStatus(row, now),
    appointedBy: person(row.createdById),
  }))
}

// --- the gap list ---

// What needs HR, inside the viewer's data access:
// - vacant: posts with employees but no HOD now (their approvals go to HR) - and who is appointed next, if anyone;
// - ending: posts with employees whose HOD stops at a set moment with nobody appointed from then;
// - leavers: HODs (now or upcoming) who have left, or whose leaving day comes before their appointment ends.
// (Every employee has a department, so an HOD post - 2026-11-19.)
export async function listGaps(viewer: CurrentUser) {
  const now = new Date()
  const [{ byId, scope, sees, changes }, open] = await Promise.all([loadPosts(viewer), hodsRepository.listOpenAppointments(now)])
  const counts = await hodsRepository.countEmployeesByPost(scope)
  const { current, upcoming } = splitOpen(open, now)
  const employeesOf = (post: Post) => counts.get(post.id) ?? 0
  const headedAt = (postId: number, at: Date) => (upcoming.get(postId) ?? []).some((a) => a.startsAt <= at && (a.endsAt === null || a.endsAt > at))
  type LeaverPost = ReturnType<typeof toPost> & { status: ReturnType<typeof spanStatus>; startsAt: Date; endsAt: Date | null; canChange: boolean }
  const leavers = new Map<number, { employeeCode: string; name: string; hasLeft: boolean; dateOfLeaving: Date | null; posts: LeaverPost[] }>()
  for (const a of open) {
    const post = byId.get(a.postId)
    if (!post || !sees(post)) continue
    const leaves = leavesAt(a.employee)
    const flagged = a.employee.status === 'EXITED' || (leaves !== null && (a.endsAt === null || a.endsAt > leaves))
    if (!flagged) continue
    const entry = leavers.get(a.employee.id) ?? {
      employeeCode: a.employee.employeeCode,
      name: fullName(a.employee),
      hasLeft: a.employee.status === 'EXITED',
      dateOfLeaving: a.employee.dateOfLeaving,
      posts: [],
    }
    entry.posts.push({ ...toPost(post), status: spanStatus(a, now), startsAt: a.startsAt, endsAt: a.endsAt, canChange: changes(post) })
    leavers.set(a.employee.id, entry)
  }
  return {
    vacant: [...byId.values()]
      .filter((post) => sees(post) && !current.has(post.id) && employeesOf(post) > 0)
      .sort(byPlace)
      .map((post) => {
        const next = upcoming.get(post.id)?.[0]
        return { ...toPost(post), employees: employeesOf(post), canChange: changes(post), next: next ? nextOf(next) : null }
      }),
    ending: [...current.values()]
      .flatMap((a) => {
        const post = byId.get(a.postId)
        if (!post || !sees(post) || a.endsAt === null || employeesOf(post) === 0 || headedAt(post.id, a.endsAt)) return []
        return [{ ...toPost(post), hod: { employeeCode: a.employee.employeeCode, name: fullName(a.employee) }, endsAt: a.endsAt, employees: employeesOf(post), canChange: changes(post) }]
      })
      .sort((a, b) => a.endsAt.getTime() - b.endsAt.getTime()),
    leavers: [...leavers.values()].sort((a, b) => a.name.localeCompare(b.name)),
  }
}

// --- the HOD's own view (no role needed) ---

// "My department" (H2): the employees whose HOD post the viewer heads now - their directory & job details, read-only. An
// upcoming appointment gives nothing until it starts (2026-11-19).
export async function myDepartment(viewer: CurrentUser) {
  const now = new Date()
  const [held, posts] = await Promise.all([hodsRepository.listAppointmentsOfEmployee(viewer.employeeId), plantsService.listAllPlantDepartments()])
  const current = held.filter((a) => spanStatus(a, now) === 'CURRENT')
  const byId = new Map(posts.map((post) => [post.id, post]))
  // the HOD relationship (the posts the viewer heads), not data-access rows - CLAUDE.md section 8, rule 7
  const rows = await hodsRepository.listOnPosts({ scope: SYSTEM_SCOPE, postIds: current.map((a) => a.postId), exceptId: viewer.employeeId })
  return {
    posts: current
      .flatMap((a) => {
        const post = byId.get(a.postId)
        return post ? [{ ...toPost(post), since: a.startsAt, until: a.endsAt, employees: rows.filter((row) => row.hodPostId === a.postId).length }] : []
      })
      .sort((a, b) => a.label.localeCompare(b.label)),
    employees: rows.map((row) => ({
      employeeCode: row.employeeCode,
      name: employeesService.fullName(row),
      status: row.status,
      postId: row.hodPostId,
      employmentType: row.employmentType,
      dateOfJoining: row.dateOfJoining,
      workEmail: row.workEmail,
      company: row.company.code,
      plant: row.plant,
      workLocation: row.workLocation?.name ?? null,
      department: row.department.name,
      designation: row.designation?.name ?? null,
      reportingManager: row.reportingManager && { employeeCode: row.reportingManager.employeeCode, name: employeesService.fullName(row.reportingManager) },
    })),
  }
}

// Who heads the post now (an employee id), or null - an approval step named to the HOD (modules/approvals)
export function currentHodOf(postId: number) {
  return hodsRepository.findHolderAt(postId, new Date())
}

// How many posts the employee heads now - the menu shows "My department" to an HOD (accounts.me)
export function countHeldPosts(employeeId: number) {
  return hodsRepository.countHeldAt(employeeId, new Date())
}

// The posts the employee heads now - the organisation board's department cards
export function listHeldPostIds(employeeId: number) {
  return hodsRepository.listPostIdsHeldAt(employeeId, new Date())
}

// The ids of the employees whose HOD the employee is now, whatever their status - attendance's "My department" view
export async function listDepartmentIds(employeeId: number) {
  const postIds = await hodsRepository.listPostIdsHeldAt(employeeId, new Date())
  // the HOD relationship, not data-access rows - CLAUDE.md section 8, rule 7
  return hodsRepository.listIdsOnPosts({ scope: SYSTEM_SCOPE, postIds, exceptId: employeeId })
}

// Every post (retired too) as its label - the change history names the posts in employees' and appointments' changes
export async function listPostLabels() {
  const posts = await plantsService.listAllPlantDepartments()
  return new Map(posts.map((post) => [post.id, postLabel(post)]))
}

export async function exportHods(viewer: CurrentUser, input: z.infer<typeof exportHodsInput>) {
  const words = (input.search ?? '').toLowerCase().split(/\s+/).filter(Boolean)
  const preparedBy = `${viewer.name} (${viewer.employeeCode})`
  if (input.view === 'department') {
    const data = await myDepartment(viewer)
    const rows = data.employees.filter((e) => (!input.postId || e.postId === input.postId) && words.every((w) => `${e.employeeCode} ${e.name}`.toLowerCase().includes(w)))
    return reportFile([reportSheet('My department', rows, [
      { header: 'Employee code', value: r => r.employeeCode, text: true }, { header: 'Employee', value: r => r.name, width: 30 },
      { header: 'Designation', value: r => r.designation, width: 28 }, { header: 'Company', value: r => r.company },
      { header: 'Plant', value: r => `${r.plant.plantCode} · ${r.plant.name}`, width: 28 }, { header: 'Department', value: r => r.department, width: 28 },
      { header: 'Joined', value: r => r.dateOfJoining, date: true }, { header: 'Reporting manager', value: r => r.reportingManager?.name, width: 28 },
      { header: 'Work email', value: r => r.workEmail, width: 34 }, { header: 'Status', value: r => r.status },
    ])], { title: 'My department', preparedBy, coverage: 'Only employees in the departments you currently head, with the selected department and search filters.' }, 'my-department')
  }
  assertAccess(viewer.access, 'HOD_APPOINTMENTS', 'READ')
  const rows = (await listPlaces(viewer)).filter((r) => (!input.onlyGaps || (r.employees > 0 && !r.hod)) && words.every((w) => `${r.label} ${r.hod?.name ?? ''} ${r.hod?.employeeCode ?? ''} ${r.next?.name ?? ''}`.toLowerCase().includes(w)))
  return reportFile([reportSheet('Department heads', rows, [
    { header: 'Company', value: r => r.company.code, text: true }, { header: 'Plant', value: r => `${r.plant.plantCode} · ${r.plant.name}`, width: 30 },
    { header: 'Department', value: r => r.department.name, width: 30 }, { header: 'Employees', value: r => r.employees },
    { header: 'Current HOD code', value: r => r.hod?.employeeCode, text: true }, { header: 'Current HOD', value: r => r.hod?.name, width: 30 },
    { header: 'Since', value: r => r.hod?.since, dateTime: true }, { header: 'Until', value: r => r.hod?.until, dateTime: true },
    { header: 'Next HOD', value: r => r.next?.name, width: 30 }, { header: 'Next starts', value: r => r.next?.from, dateTime: true },
  ])], { title: 'Department head coverage', preparedBy, coverage: 'Places within your active role HOD appointments View scope, with current search and gap filters.' }, 'department-heads')
}
