/**
 * Helpdesk API (M9 — HD-01).
 *
 * Two permission tiers, deliberately:
 *   - RAISING and reading YOUR OWN tickets is `authed`. Gating "ask HR a
 *     question" behind a permission would mean the people most likely to be
 *     mis-provisioned are the ones who cannot report it.
 *   - Working the QUEUE (assignment, internal notes, resolution, escalation)
 *     needs `helpdesk.agent` (docs/08 §2).
 */
import { ORPCError } from '@orpc/server';
import { z } from 'zod';
import { authed, withPermission } from '../../api/orpc.js';
import { getUserPermissions } from '../../core/rbac/permissions.service.js';
import { booleanQuery } from '../../api/zod.js';
import { rowsToExcelBuffer } from '../../core/excel/workbook.js';
import {
  escalateBreachedTickets,
  helpdeskPerformance,
  listCategories,
  listTickets,
  raiseTicket,
  replyToTicket,
  setTicketStatus,
  ticketThread,
} from './helpdesk.service.js';

const agent = () => withPermission('helpdesk.agent');

function asBadRequest(err: unknown): never {
  throw new ORPCError('BAD_REQUEST', {
    message: err instanceof Error ? err.message : 'Invalid request',
  });
}

const ticketShape = z.object({
  id: z.number(),
  ticketNo: z.string(),
  subject: z.string(),
  categoryCode: z.string(),
  categoryName: z.string(),
  status: z.string(),
  priority: z.string(),
  raisedByEmail: z.string().nullable(),
  assigneeEmail: z.string().nullable(),
  slaDueAt: z.string(),
  breached: z.boolean(),
  escalatedLevel: z.number(),
  acknowledgedAt: z.string().nullable(),
  resolvedAt: z.string().nullable(),
  createdAt: z.string(),
});

const categories = authed
  .route({ method: 'GET', path: '/helpdesk/categories', summary: 'Ticket categories with their SLA' })
  .output(
    z.array(
      z.object({
        id: z.number(),
        code: z.string(),
        name: z.string(),
        assigneeRoleCode: z.string().nullable(),
        slaHours: z.number(),
      }),
    ),
  )
  .handler(({ context }) => listCategories(context.db));

/** Anyone signed in can raise a ticket — see the note at the top of this file. */
const raise = authed
  .route({ method: 'POST', path: '/helpdesk/tickets', summary: 'Raise a ticket (auto-acknowledged, SLA from the category)' })
  .input(
    z.object({
      categoryCode: z.string().min(1),
      subject: z.string().min(3).max(200),
      body: z.string().min(1),
      priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
    }),
  )
  .output(z.object({ id: z.number(), ticketNo: z.string(), slaDueAt: z.string() }))
  .handler(async ({ input, context }) => {
    try {
      return await raiseTicket(context.db, {
        ...input,
        raisedByUserId: context.user.id,
        ip: context.req.ip ?? null,
      });
    } catch (err) {
      asBadRequest(err);
    }
  });

const myTickets = authed
  .route({ method: 'GET', path: '/helpdesk/tickets/mine', summary: 'Tickets you raised' })
  .input(z.object({ limit: z.coerce.number().int().min(1).max(100).default(50) }).optional())
  .output(z.object({ rows: z.array(ticketShape), total: z.number() }))
  .handler(({ input, context }) =>
    listTickets(context.db, { raisedByUserId: context.user.id, limit: input?.limit ?? 50, offset: 0 }),
  );

const queue = agent()
  .route({ method: 'GET', path: '/helpdesk/tickets', summary: 'The agent queue, SLA-sorted' })
  .input(
    z.object({
      status: z.enum(['open', 'pending', 'resolved', 'closed']).optional(),
      categoryCode: z.string().optional(),
      mineOnly: booleanQuery().optional(),
      breachedOnly: booleanQuery().optional(),
      limit: z.coerce.number().int().min(1).max(200).default(50),
      offset: z.coerce.number().int().min(0).default(0),
    }),
  )
  .output(z.object({ rows: z.array(ticketShape), total: z.number() }))
  .handler(({ input, context }) =>
    listTickets(context.db, {
      status: input.status,
      categoryCode: input.categoryCode,
      breachedOnly: input.breachedOnly,
      assigneeUserId: input.mineOnly === true ? context.user.id : undefined,
      limit: input.limit,
      offset: input.offset,
    }),
  );

const thread = authed
  .route({ method: 'GET', path: '/helpdesk/tickets/{ticketId}/thread', summary: 'Ticket conversation' })
  .input(z.object({ ticketId: z.coerce.number().int().positive() }))
  .output(
    z.array(
      z.object({
        id: z.number(),
        body: z.string(),
        isInternal: z.boolean(),
        authorEmail: z.string().nullable(),
        createdAt: z.string(),
      }),
    ),
  )
  .handler(async ({ input, context }) => {
    // Internal notes are for the desk, not the raiser. `authed` does not carry
    // resolved permissions, so ask for them explicitly rather than assuming.
    const permissions = await getUserPermissions(context.db, context.user.id);
    return ticketThread(context.db, input.ticketId, {
      includeInternal: permissions.has('helpdesk.agent'),
    });
  });

const reply = authed
  .route({ method: 'POST', path: '/helpdesk/tickets/{ticketId}/reply', summary: 'Add a reply (append-only)' })
  .input(
    z.object({
      ticketId: z.coerce.number().int().positive(),
      body: z.string().min(1),
      isInternal: z.boolean().default(false),
    }),
  )
  .output(z.object({ id: z.number() }))
  .handler(async ({ input, context }) => {
    // Only an agent may write an internal note — a raiser marking their own
    // reply "internal" must not hide it from the desk.
    const permissions = await getUserPermissions(context.db, context.user.id);
    const isAgent = permissions.has('helpdesk.agent');
    try {
      return await replyToTicket(context.db, {
        ticketId: input.ticketId,
        authorUserId: context.user.id,
        body: input.body,
        isInternal: input.isInternal && isAgent,
      });
    } catch (err) {
      asBadRequest(err);
    }
  });

const setStatus = agent()
  .route({ method: 'POST', path: '/helpdesk/tickets/{ticketId}/status', summary: 'Resolve, close or reopen (audited)' })
  .input(
    z.object({
      ticketId: z.coerce.number().int().positive(),
      status: z.enum(['open', 'pending', 'resolved', 'closed']),
      resolution: z.string().nullish(),
    }),
  )
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context }) => {
    try {
      return await setTicketStatus(context.db, {
        ...input,
        actorUserId: context.user.id,
        ip: context.req.ip ?? null,
      });
    } catch (err) {
      asBadRequest(err);
    }
  });

const escalate = withPermission('admin.integrations')
  .route({ method: 'POST', path: '/helpdesk/escalate', summary: 'Run the SLA escalation sweep now (SOW-9.2)' })
  .output(z.object({ escalated: z.number() }))
  .handler(({ context }) => escalateBreachedTickets(context.db));

const performanceRow = z.object({
  categoryCode: z.string(),
  categoryName: z.string(),
  raised: z.number(),
  resolved: z.number(),
  breached: z.number(),
  avgResolutionHours: z.number().nullable(),
});

const monthStr = z.string().regex(/^\d{4}-\d{2}$/, 'YYYY-MM');

/** R29 — monthly helpdesk performance (docs/06 §3), on screen and as Excel. */
const performance = withPermission('reports.hr')
  .route({ method: 'GET', path: '/helpdesk/performance', summary: 'R29 — monthly performance by category' })
  .input(z.object({ month: monthStr }))
  .output(z.array(performanceRow))
  .handler(({ input, context }) => helpdeskPerformance(context.db, input));

const performanceExcel = withPermission('reports.hr')
  .route({ method: 'GET', path: '/helpdesk/performance/export', summary: 'R29 as Excel (same query as the table)' })
  .input(z.object({ month: monthStr }))
  .output(z.object({ filename: z.string(), base64: z.string() }))
  .handler(async ({ input, context }) => {
    const rows = await helpdeskPerformance(context.db, input);
    const buf = await rowsToExcelBuffer(
      'R29 Helpdesk performance',
      [
        { header: 'Category', key: 'categoryName', width: 26 },
        { header: 'Raised', key: 'raised', width: 10 },
        { header: 'Resolved', key: 'resolved', width: 11 },
        { header: 'SLA breached', key: 'breached', width: 14 },
        { header: 'Avg resolution (hrs)', key: 'avgResolutionHours', width: 20 },
      ],
      rows,
    );
    return { filename: `R29-helpdesk-${input.month}.xlsx`, base64: buf.toString('base64') };
  });

export const helpdeskRouter = {
  categories,
  raise,
  myTickets,
  queue,
  thread,
  reply,
  setStatus,
  escalate,
  performance,
  performanceExcel,
};
