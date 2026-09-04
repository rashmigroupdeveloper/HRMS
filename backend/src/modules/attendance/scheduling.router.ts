/**
 * Stage 1.11 scheduling surface — patterns, publish, coverage, calendar, swap,
 * meters (SHF-04..08). Shift catalog micro-policy lives on the existing
 * config router so admin.settings stays the one permission for catalog writes.
 */
import { ORPCError } from '@orpc/server';
import { sql } from 'kysely';
import { z } from 'zod';
import { withPermission } from '../../api/orpc.js';
import { booleanQuery } from '../../api/zod.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { formatDbDate } from '../../core/dates.js';
import { enqueue, enqueueEvent } from '../notifications/index.js';
import { RosterRuleError } from './shift-windows.js';
import { coverageView, rosterMeters } from './coverage.service.js';
import {
  commitPatternApply,
  listPatterns,
  previewPatternApply,
  upsertPattern,
} from './shift-pattern.service.js';
import { listMySwaps, requestShiftSwap } from './shift-swap.service.js';
import { teamCalendar } from './team-calendar.service.js';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');
const monthStr = z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/);

function asBadRequest(err: unknown): never {
  if (err instanceof RosterRuleError) {
    throw new ORPCError('BAD_REQUEST', { message: err.message });
  }
  throw new ORPCError('BAD_REQUEST', { message: err instanceof Error ? err.message : 'Invalid request' });
}

function requireEmployeeId(user: { employee_id: number | null }): number {
  if (user.employee_id === null) {
    throw new ORPCError('BAD_REQUEST', { message: 'No employee profile linked' });
  }
  return user.employee_id;
}

async function teamIds(
  db: Parameters<typeof teamCalendar>[0],
  managerId: number,
  subtree: boolean,
): Promise<number[]> {
  let q = db
    .selectFrom('core.employees as e')
    .select('e.id')
    .where('e.status', 'in', ['active', 'on_notice']);
  q = subtree
    ? q.where('e.id', 'in', sql<number>`(SELECT rt.employee_id FROM core.reporting_tree rt WHERE rt.manager_id = ${managerId})`)
    : q.where('e.reporting_manager_id', '=', managerId);
  const rows = await q.execute();
  return rows.map((r) => r.id);
}

const patternDay = z.object({
  shiftCode: z.string().min(1).nullable(),
  weekOff: z.boolean(),
});

const listPatternProc = withPermission('attendance.roster.write')
  .route({ method: 'GET', path: '/attendance/patterns', summary: 'Cyclic roster templates (SHF-04)' })
  .output(z.array(z.object({ code: z.string(), name: z.string(), cycle: z.array(patternDay) })))
  .handler(async ({ context }) => listPatterns(context.db));

const upsertPatternProc = withPermission('attendance.roster.write')
  .route({ method: 'PUT', path: '/attendance/patterns/{code}', summary: 'Create/update a cyclic template (SHF-04)' })
  .input(z.object({ code: z.string().min(1), name: z.string().min(1), cycle: z.array(patternDay).min(1) }))
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context }) => {
    try {
      await upsertPattern(context.db, {
        actorUserId: context.user.id,
        pattern: input,
        ip: context.req.ip ?? null,
      });
      return { ok: true as const };
    } catch (err) {
      asBadRequest(err);
    }
  });

const applyPatternProc = withPermission('attendance.roster.write')
  .route({ method: 'POST', path: '/attendance/patterns/{code}/apply', summary: 'Dry-run or commit a cyclic pattern (SHF-04)' })
  .input(
    z.object({
      code: z.string().min(1),
      from: isoDate,
      to: isoDate,
      employeeIds: z.array(z.number().int().positive()).min(1).max(500),
      dryRun: z.boolean().default(true),
      reason: z.string().min(5).optional(),
    }),
  )
  .output(
    z.object({
      upserted: z.number(),
      preview: z.array(
        z.object({ employeeId: z.number(), date: z.string(), shiftCode: z.string().nullable(), weekOff: z.boolean() }),
      ),
    }),
  )
  .handler(async ({ input, context }) => {
    try {
      if (input.dryRun) {
        const preview = await previewPatternApply(context.db, input);
        return { upserted: 0, preview };
      }
      return await commitPatternApply(context.db, {
        actorUserId: context.user.id,
        code: input.code,
        from: input.from,
        to: input.to,
        employeeIds: input.employeeIds,
        ip: context.req.ip ?? null,
        reason: input.reason ?? null,
      });
    } catch (err) {
      asBadRequest(err);
    }
  });

const publishRoster = withPermission('attendance.roster.write')
  .route({ method: 'POST', path: '/attendance/roster/publish', summary: 'Publish a roster range (SHF-05)' })
  .input(z.object({ from: isoDate, to: isoDate, reason: z.string().min(5).optional(), subtree: booleanQuery().optional() }))
  .output(z.object({ id: z.number(), revision: z.number(), notified: z.number() }))
  .handler(async ({ input, context }) => {
    const managerId = requireEmployeeId(context.user);
    if (input.from > input.to) throw new ORPCError('BAD_REQUEST', { message: 'from must be on or before to' });
    const ids = await teamIds(context.db, managerId, input.subtree === true);
    const existing = await context.db
      .selectFrom('att.roster_publications')
      .select(['id', 'revision'])
      .where('manager_employee_id', '=', managerId)
      .where('period_from', '=', sql<Date>`${input.from}::date`)
      .where('period_to', '=', sql<Date>`${input.to}::date`)
      .executeTakeFirst();
    const revision = (existing?.revision ?? 0) + 1;
    const row = existing
      ? (
          await context.db
            .updateTable('att.roster_publications')
            .set({ published_at: new Date(), published_by: context.user.id, revision, reason: input.reason ?? null })
            .where('id', '=', existing.id)
            .returning(['id', 'revision'])
            .executeTakeFirstOrThrow()
        )
      : (
          await context.db
            .insertInto('att.roster_publications')
            .values({
              manager_employee_id: managerId,
              period_from: sql<Date>`${input.from}::date` as unknown as Date,
              period_to: sql<Date>`${input.to}::date` as unknown as Date,
              published_at: new Date(),
              published_by: context.user.id,
              revision: 1,
              reason: input.reason ?? null,
            })
            .returning(['id', 'revision'])
            .executeTakeFirstOrThrow()
        );
    await writeAudit(context.db, {
      actorUserId: context.user.id,
      action: existing ? 'update' : 'create',
      entity: 'att.roster_publications',
      entityId: row.id,
      subjectEmployeeId: managerId,
      newValue: `${input.from}..${input.to} rev ${String(row.revision)}`,
      ip: context.req.ip ?? null,
    });
    const users = ids.length === 0
      ? []
      : await context.db
          .selectFrom('core.users')
          .select('id')
          .where('employee_id', 'in', ids)
          .where('is_active', '=', true)
          .execute();
    for (const user of users) {
      await enqueue(context.db, {
        recipientUserId: user.id,
        channel: 'in_app',
        templateCode: 'roster_published',
        payload: { from: input.from, to: input.to, revision: row.revision },
      });
    }
    const extra = await enqueueEvent(context.db, 'attendance.roster_published', 'roster_published', {
      from: input.from,
      to: input.to,
      managerEmployeeId: managerId,
    });
    return { id: row.id, revision: row.revision, notified: users.length + extra };
  });

const getPublication = withPermission('attendance.roster.write')
  .route({ method: 'GET', path: '/attendance/roster/publication', summary: 'Published roster range for this manager (SHF-05)' })
  .input(z.object({ from: isoDate, to: isoDate }))
  .output(
    z.object({
      published: z.boolean(),
      publishedAt: z.string().nullable(),
      revision: z.number().nullable(),
    }),
  )
  .handler(async ({ input, context }) => {
    const managerId = requireEmployeeId(context.user);
    const row = await context.db
      .selectFrom('att.roster_publications')
      .select(['published_at', 'revision'])
      .where('manager_employee_id', '=', managerId)
      .where('period_from', '<=', sql<Date>`${input.from}::date`)
      .where('period_to', '>=', sql<Date>`${input.to}::date`)
      .orderBy('revision', 'desc')
      .executeTakeFirst();
    return {
      published: row !== undefined,
      publishedAt: row === undefined ? null : new Date(row.published_at).toISOString(),
      revision: row?.revision ?? null,
    };
  });

const coverageProc = withPermission('attendance.roster.write')
  .route({ method: 'GET', path: '/attendance/roster/coverage', summary: 'Sanctioned vs rostered vs on-leave (SHF-06)' })
  .input(z.object({ from: isoDate, to: isoDate, subtree: booleanQuery().optional() }))
  .output(
    z.array(
      z.object({
        date: z.string(),
        shiftCode: z.string(),
        sanctioned: z.number(),
        rostered: z.number(),
        onLeave: z.number(),
        remaining: z.number(),
        shortfall: z.number(),
      }),
    ),
  )
  .handler(async ({ input, context }) => {
    const ids = await teamIds(context.db, requireEmployeeId(context.user), input.subtree === true);
    return coverageView(context.db, { employeeIds: ids, from: input.from, to: input.to });
  });

const metersProc = withPermission('attendance.roster.write')
  .route({ method: 'GET', path: '/attendance/roster/meters', summary: 'Weekly/quarterly hours meters (SHF-03)' })
  .input(z.object({ month: monthStr, subtree: booleanQuery().optional() }))
  .output(
    z.array(
      z.object({
        employeeId: z.number(),
        weekHours: z.number(),
        weekCap: z.number(),
        quarterHours: z.number(),
        quarterCap: z.number(),
      }),
    ),
  )
  .handler(async ({ input, context }) => {
    const ids = await teamIds(context.db, requireEmployeeId(context.user), input.subtree === true);
    return rosterMeters(context.db, { employeeIds: ids, month: input.month });
  });

const calendarProc = withPermission('attendance.team.read')
  .route({ method: 'GET', path: '/attendance/team-calendar', summary: 'Team leave planner (SHF-08)' })
  .input(z.object({ month: monthStr, subtree: booleanQuery().optional() }))
  .output(
    z.array(
      z.object({
        employeeId: z.number(),
        ecode: z.string(),
        name: z.string(),
        days: z.record(
          z.object({
            shiftCode: z.string().nullable(),
            weekOff: z.boolean(),
            leave: z.boolean(),
            leavePending: z.boolean(),
            blackout: z.string().nullable(),
          }),
        ),
      }),
    ),
  )
  .handler(async ({ input, context }) => {
    const month = input.month.length === 7 ? `${input.month}-01` : input.month;
    const [y = 0, mo = 1] = month.split('-').map(Number);
    const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    const to = `${y}-${String(mo).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
    const ids = await teamIds(context.db, requireEmployeeId(context.user), input.subtree === true);
    return teamCalendar(context.db, { employeeIds: ids, from: month, to });
  });

const requestSwap = withPermission('attendance.own')
  .route({ method: 'POST', path: '/attendance/swaps', summary: 'Request a shift swap or bid (SHF-07)' })
  .input(
    z.object({
      counterpartEmployeeId: z.number().int().positive(),
      workDate: isoDate,
      kind: z.enum(['swap', 'bid']).default('swap'),
      reason: z.string().min(5),
    }),
  )
  .output(z.object({ id: z.number(), workflowRequestId: z.number() }))
  .handler(async ({ input, context }) => {
    try {
      return await requestShiftSwap(context.db, {
        requesterEmployeeId: requireEmployeeId(context.user),
        requestedByUserId: context.user.id,
        counterpartEmployeeId: input.counterpartEmployeeId,
        workDate: input.workDate,
        kind: input.kind,
        reason: input.reason,
      });
    } catch (err) {
      asBadRequest(err);
    }
  });

const mySwaps = withPermission('attendance.own')
  .route({ method: 'GET', path: '/attendance/swaps/mine', summary: 'My shift-swap requests (SHF-07)' })
  .output(
    z.array(
      z.object({
        id: z.number(),
        kind: z.string(),
        workDate: z.string(),
        counterpartEmployeeId: z.number().nullable(),
        applied: z.boolean(),
        workflowStatus: z.string(),
        workflowRequestId: z.number(),
      }),
    ),
  )
  .handler(async ({ context }) => {
    const rows = await listMySwaps(context.db, requireEmployeeId(context.user));
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      workDate: formatDbDate(r.work_date),
      counterpartEmployeeId: r.counterpart_employee_id,
      applied: r.applied,
      workflowStatus: r.workflow_status,
      workflowRequestId: r.workflow_request_id,
    }));
  });

const upsertBlackout = withPermission('admin.settings')
  .route({ method: 'PUT', path: '/attendance/blackouts', summary: 'Leave blackout date (SHF-08)' })
  .input(z.object({ date: isoDate, name: z.string().min(1), locationId: z.number().int().positive().nullish() }))
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context }) => {
    await context.db
      .insertInto('att.leave_blackouts')
      .values({
        blackout_date: sql<Date>`${input.date}::date` as unknown as Date,
        name: input.name,
        location_id: input.locationId ?? null,
      })
      .onConflict((oc) => oc.columns(['location_id', 'blackout_date']).doUpdateSet({ name: input.name }))
      .execute();
    await writeAudit(context.db, {
      actorUserId: context.user.id,
      action: 'update',
      entity: 'att.leave_blackouts',
      field: input.date,
      newValue: input.name,
      ip: context.req.ip ?? null,
    });
    return { ok: true as const };
  });

export const schedulingRouter = {
  listPatternProc,
  upsertPatternProc,
  applyPatternProc,
  publishRoster,
  getPublication,
  coverageProc,
  metersProc,
  calendarProc,
  requestSwap,
  mySwaps,
  upsertBlackout,
};
