/**
 * Helpdesk (M9 — HD-01, SOW-9).
 *
 * The behaviours that make a helpdesk actually work, rather than becoming a
 * second inbox nobody reads:
 *   - every ticket gets an SLA clock at creation, computed from its CATEGORY
 *     (data, not code) — a ticket without a deadline has no owner;
 *   - auto-acknowledgement, so the raiser knows it landed (SOW-9.1);
 *   - routing by category to the role that handles it, resolved through RBAC
 *     rather than a hardcoded assignee;
 *   - escalation when the clock runs out (SOW-9.2), recorded as a level so the
 *     monthly report can show how often it happens (R29).
 *
 * The message thread is append-only at the DB, because "query logs for audit"
 * (SOW-9.4) is worthless if a participant can edit history.
 */
import { sql, type Kysely, type Transaction } from 'kysely';
import type { Database, TicketStatus } from '../../core/db/types.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { enqueue } from '../notifications/index.js';

export interface TicketRow {
  id: number;
  ticketNo: string;
  subject: string;
  categoryCode: string;
  categoryName: string;
  status: string;
  priority: string;
  raisedByEmail: string | null;
  assigneeEmail: string | null;
  slaDueAt: string;
  breached: boolean;
  escalatedLevel: number;
  escalatedToUserId: number | null;
  firstResponseAt: string | null;
  reopenCount: number;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

function iso(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return null;
}

/**
 * Ticket numbers are human-quotable: HD-2026-000123.
 *
 * Drawn from a SEQUENCE, never from COUNT(*): a count goes backwards after a
 * deletion and races under concurrency, and both produce a duplicate on a
 * UNIQUE column. A sequence is atomic and never reissues — gaps are fine, a
 * collision is not.
 */
async function nextTicketNo(db: Kysely<Database> | Transaction<Database>): Promise<string> {
  const year = new Date().getFullYear();
  // nextval returns BIGINT — the driver may hand back a string or a number.
  const result = await sql<{ n: string | number }>`SELECT nextval('hd.ticket_no_seq') AS n`.execute(db);
  const seq = String(result.rows[0]?.n ?? 1);
  return `HD-${String(year)}-${seq.padStart(6, '0')}`;
}

export async function listCategories(db: Kysely<Database>) {
  const rows = await db
    .selectFrom('hd.categories')
    .selectAll()
    .where('is_active', '=', true)
    .orderBy('name')
    .execute();
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    assigneeRoleCode: r.assignee_role_code,
    slaHours: r.sla_hours,
    escalateToRoleCode: r.escalate_to_role_code,
  }));
}

/**
 * Raise a ticket. The SLA is computed from the category, the assignee is
 * resolved from the category's role, and the raiser is acknowledged — all in
 * one transaction, so a ticket can never exist without its clock or its receipt.
 */
export async function raiseTicket(
  db: Kysely<Database>,
  params: {
    raisedByUserId: number;
    categoryCode: string;
    subject: string;
    body: string;
    priority?: 'low' | 'normal' | 'high' | 'urgent' | undefined;
    ip: string | null;
  },
): Promise<{ id: number; ticketNo: string; slaDueAt: string }> {
  return db.transaction().execute(async (trx) => {
    const category = await trx
      .selectFrom('hd.categories')
      .selectAll()
      .where('code', '=', params.categoryCode)
      .where('is_active', '=', true)
      .executeTakeFirst();
    if (!category) throw new Error(`Unknown helpdesk category: ${params.categoryCode}`);

    // Routing is DATA: the category names a role, RBAC names the people.
    let assignee: number | null = null;
    if (category.assignee_role_code !== null) {
      const candidate = await trx
        .selectFrom('core.user_roles as ur')
        .innerJoin('core.roles as r', 'r.id', 'ur.role_id')
        .innerJoin('core.users as u', 'u.id', 'ur.user_id')
        .select('u.id')
        .where('r.code', '=', category.assignee_role_code)
        .where('u.is_active', '=', true)
        .orderBy('u.id')
        .executeTakeFirst();
      assignee = candidate?.id ?? null;
    }

    const priority = params.priority ?? 'normal';
    let computedHours = category.sla_hours;
    if (priority === 'urgent') {
      computedHours = Math.max(2, Math.round(category.sla_hours * 0.25));
    } else if (priority === 'high') {
      computedHours = Math.max(4, Math.round(category.sla_hours * 0.5));
    } else if (priority === 'low') {
      computedHours = Math.round(category.sla_hours * 2);
    }

    const ticketNo = await nextTicketNo(trx);
    const inserted = await trx
      .insertInto('hd.tickets')
      .values({
        ticket_no: ticketNo,
        raised_by: params.raisedByUserId,
        category_id: category.id,
        subject: params.subject,
        body: params.body,
        priority,
        assignee_user_id: assignee,
        sla_due_at: sql<Date>`now() + ${computedHours} * INTERVAL '1 hour'`,
        acknowledged_at: sql<Date>`now()`,
      })
      .returning(['id', 'sla_due_at'])
      .executeTakeFirstOrThrow();

    // SOW-9.1 auto-acknowledgement — the raiser is told it landed, and the
    // assignee is told it exists. Both are receipts, not courtesies.
    await enqueue(trx, {
      recipientUserId: params.raisedByUserId,
      channel: 'in_app',
      templateCode: 'helpdesk_ticket_acknowledged',
      payload: { ticketNo, subject: params.subject },
    });
    if (assignee !== null) {
      await enqueue(trx, {
        recipientUserId: assignee,
        channel: 'in_app',
        templateCode: 'helpdesk_ticket_assigned',
        payload: { ticketNo, subject: params.subject, slaHours: computedHours },
      });
    }

    await writeAudit(trx, {
      actorUserId: params.raisedByUserId,
      action: 'create',
      entity: 'hd.tickets',
      entityId: inserted.id,
      field: ticketNo,
      newValue: `${category.code}/${params.priority ?? 'normal'}`,
      ip: params.ip,
    });

    return { id: inserted.id, ticketNo, slaDueAt: iso(inserted.sla_due_at) ?? '' };
  });
}

/** Queue view. `mine` scopes to what the caller raised (ESS). */
export async function listTickets(
  db: Kysely<Database>,
  params: {
    raisedByUserId?: number | undefined;
    assigneeUserId?: number | undefined;
    status?: TicketStatus | undefined;
    categoryCode?: string | undefined;
    breachedOnly?: boolean | undefined;
    limit: number;
    offset: number;
  },
): Promise<{ rows: TicketRow[]; total: number }> {
  const base = db
    .selectFrom('hd.tickets as t')
    .innerJoin('hd.categories as c', 'c.id', 't.category_id')
    .leftJoin('core.users as ru', 'ru.id', 't.raised_by')
    .leftJoin('core.users as au', 'au.id', 't.assignee_user_id')
    .$if(params.raisedByUserId !== undefined, (qb) =>
      qb.where('t.raised_by', '=', params.raisedByUserId ?? 0),
    )
    .$if(params.assigneeUserId !== undefined, (qb) =>
      qb.where('t.assignee_user_id', '=', params.assigneeUserId ?? 0),
    )
    .$if(params.status !== undefined, (qb) => qb.where('t.status', '=', params.status ?? 'open'))
    .$if(params.categoryCode !== undefined, (qb) => qb.where('c.code', '=', params.categoryCode ?? ''))
    .$if(params.breachedOnly === true, (qb) =>
      qb.where(
        sql<boolean>`((t.sla_due_at < now() AND t.status IN ('open','pending')) OR (t.resolved_at IS NOT NULL AND t.resolved_at > t.sla_due_at) OR t.escalated_level > 0)`,
      ),
    );

  const counted = await base.select((eb) => eb.fn.countAll<string>().as('n')).executeTakeFirst();

  const rows = await base
    .select([
      't.id',
      't.ticket_no',
      't.subject',
      't.status',
      't.priority',
      't.escalated_level',
      't.escalated_to_user_id',
      't.first_response_at',
      't.reopen_count',
      't.acknowledged_at',
      't.resolved_at',
      't.created_at',
      't.sla_due_at',
      'c.code as category_code',
      'c.name as category_name',
      'ru.email as raised_by_email',
      'au.email as assignee_email',
    ])
    .select(
      sql<boolean>`((t.sla_due_at < now() AND t.status IN ('open','pending')) OR (t.resolved_at IS NOT NULL AND t.resolved_at > t.sla_due_at) OR t.escalated_level > 0)`.as(
        'breached',
      ),
    )
    .orderBy('t.sla_due_at')
    .limit(params.limit)
    .offset(params.offset)
    .execute();

  return {
    total: Number(counted?.n ?? 0),
    rows: rows.map((r) => ({
      id: r.id,
      ticketNo: r.ticket_no,
      subject: r.subject,
      categoryCode: r.category_code,
      categoryName: r.category_name,
      status: r.status,
      priority: r.priority,
      raisedByEmail: r.raised_by_email,
      assigneeEmail: r.assignee_email,
      slaDueAt: iso(r.sla_due_at) ?? '',
      breached: r.breached,
      escalatedLevel: r.escalated_level,
      escalatedToUserId: r.escalated_to_user_id,
      firstResponseAt: iso(r.first_response_at),
      reopenCount: r.reopen_count,
      acknowledgedAt: iso(r.acknowledged_at),
      resolvedAt: iso(r.resolved_at),
      createdAt: iso(r.created_at) ?? '',
    })),
  };
}

/** The thread. Internal notes are hidden from the raiser. */
export async function ticketThread(
  db: Kysely<Database>,
  ticketId: number,
  opts: { includeInternal: boolean },
) {
  const rows = await db
    .selectFrom('hd.ticket_messages as m')
    .leftJoin('core.users as u', 'u.id', 'm.author_user_id')
    .select(['m.id', 'm.body', 'm.is_internal', 'm.created_at', 'u.email as author_email'])
    .where('m.ticket_id', '=', ticketId)
    .$if(!opts.includeInternal, (qb) => qb.where('m.is_internal', '=', false))
    .orderBy('m.created_at')
    .execute();

  return rows.map((r) => ({
    id: r.id,
    body: r.body,
    isInternal: r.is_internal,
    authorEmail: r.author_email,
    createdAt: iso(r.created_at) ?? '',
  }));
}

export async function replyToTicket(
  db: Kysely<Database>,
  params: {
    ticketId: number;
    authorUserId: number;
    body: string;
    isInternal: boolean;
    isAgent?: boolean | undefined;
  },
): Promise<{ id: number }> {
  const ticket = await db
    .selectFrom('hd.tickets')
    .select(['id', 'raised_by', 'assignee_user_id', 'ticket_no', 'status', 'first_response_at'])
    .where('id', '=', params.ticketId)
    .executeTakeFirst();
  if (!ticket) throw new Error('Ticket not found');
  if (ticket.status === 'closed') throw new Error('This ticket is closed — reopen it to add a reply');

  const isAuthorized =
    params.isAgent === true ||
    params.authorUserId === ticket.raised_by;
  if (!isAuthorized) {
    throw new Error('Not authorized to access or reply to this ticket');
  }

  const inserted = await db
    .insertInto('hd.ticket_messages')
    .values({
      ticket_id: params.ticketId,
      author_user_id: params.authorUserId,
      body: params.body,
      is_internal: params.isInternal,
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  // If this is an agent reply, record first response time and transition status if open
  if (params.isAgent) {
    const updates: Record<string, unknown> = {};
    if (ticket.first_response_at === null) {
      updates['first_response_at'] = sql`now()`;
    }
    if (ticket.status === 'open') {
      updates['status'] = 'pending';
    }
    if (Object.keys(updates).length > 0) {
      await db
        .updateTable('hd.tickets')
        .set(updates)
        .where('id', '=', params.ticketId)
        .execute();
    }
  }

  // Notify the other party — an internal note tells nobody outside the desk.
  if (!params.isInternal) {
    const notify =
      params.authorUserId === ticket.raised_by ? ticket.assignee_user_id : ticket.raised_by;
    if (notify !== null) {
      await enqueue(db, {
        recipientUserId: notify,
        channel: 'in_app',
        templateCode: 'helpdesk_ticket_reply',
        payload: { ticketNo: ticket.ticket_no },
      });
    }
  }
  return { id: inserted.id };
}

/** Resolve / reopen. A resolution reason is mandatory (enforced by DB CHECK). */
export async function setTicketStatus(
  db: Kysely<Database>,
  params: {
    ticketId: number;
    status: 'open' | 'pending' | 'resolved' | 'closed';
    resolution?: string | null | undefined;
    actorUserId: number;
    ip: string | null;
  },
): Promise<{ ok: true }> {
  const ticket = await db
    .selectFrom('hd.tickets')
    .select(['id', 'ticket_no', 'status', 'raised_by', 'reopen_count'])
    .where('id', '=', params.ticketId)
    .executeTakeFirst();
  if (!ticket) throw new Error('Ticket not found');

  const closing = params.status === 'resolved' || params.status === 'closed';
  const reopening =
    params.status === 'open' && (ticket.status === 'resolved' || ticket.status === 'closed');

  if (closing && (params.resolution ?? '').trim() === '') {
    throw new Error('Say how it was resolved — a ticket closed without a reason helps nobody');
  }

  if (reopening && (params.resolution ?? '').trim() === '') {
    throw new Error('State the reason for reopening this ticket');
  }

  await db
    .updateTable('hd.tickets')
    .set({
      status: params.status,
      resolution: closing ? (params.resolution ?? null) : null,
      resolved_at: closing ? sql`now()` : null,
      reopen_count: reopening ? sql`reopen_count + 1` : sql`reopen_count`,
      updated_at: sql`now()`,
    })
    .where('id', '=', params.ticketId)
    .execute();

  if (closing) {
    await enqueue(db, {
      recipientUserId: ticket.raised_by,
      channel: 'in_app',
      templateCode: 'helpdesk_ticket_resolved',
      payload: { ticketNo: ticket.ticket_no, resolution: params.resolution ?? '' },
    });
  } else if (reopening) {
    await enqueue(db, {
      recipientUserId: ticket.raised_by,
      channel: 'in_app',
      templateCode: 'helpdesk_ticket_reopened',
      payload: { ticketNo: ticket.ticket_no, reason: params.resolution ?? '' },
    });
  }

  await writeAudit(db, {
    actorUserId: params.actorUserId,
    action: 'update',
    entity: 'hd.tickets',
    entityId: params.ticketId,
    field: ticket.ticket_no,
    oldValue: ticket.status,
    newValue: params.status,
    ip: params.ip,
  });

  return { ok: true as const };
}

/**
 * SOW-9.2 escalation sweep (C27). Raises the level of every breached open ticket
 * and escalates to the designated higher management hierarchy rather than
 * alerting the existing assignee alone.
 */
export async function escalateBreachedTickets(db: Kysely<Database>): Promise<{ escalated: number }> {
  const breached = await db
    .selectFrom('hd.tickets as t')
    .innerJoin('hd.categories as c', 'c.id', 't.category_id')
    .select([
      't.id',
      't.ticket_no',
      't.subject',
      't.priority',
      't.escalated_level',
      't.assignee_user_id',
      'c.name as category_name',
      'c.escalate_to_role_code',
      'c.escalate_after_hours',
    ])
    .where('t.status', 'in', ['open', 'pending'])
    .where(sql<boolean>`t.sla_due_at < now()`)
    .where(
      sql<boolean>`t.escalated_at IS NULL OR t.escalated_at < now() - COALESCE(c.escalate_after_hours, 24) * INTERVAL '1 hour'`,
    )
    .execute();

  let count = 0;
  for (const ticket of breached) {
    // Resolve higher management recipient for this category (C27)
    const targetRole = ticket.escalate_to_role_code ?? 'hr_head';
    const manager = await db
      .selectFrom('core.user_roles as ur')
      .innerJoin('core.roles as r', 'r.id', 'ur.role_id')
      .innerJoin('core.users as u', 'u.id', 'ur.user_id')
      .select('u.id')
      .where('r.code', '=', targetRole)
      .where('u.is_active', '=', true)
      .orderBy('u.id')
      .executeTakeFirst();

    const targetUserId = manager?.id ?? null;

    await db
      .updateTable('hd.tickets')
      .set({
        escalated_level: ticket.escalated_level + 1,
        escalated_at: sql`now()`,
        escalated_to_user_id: targetUserId,
        updated_at: sql`now()`,
      })
      .where('id', '=', ticket.id)
      .execute();

    // Alert the higher management hierarchy user (fixing C27)
    if (targetUserId !== null) {
      await enqueue(db, {
        recipientUserId: targetUserId,
        channel: 'in_app',
        templateCode: 'helpdesk_ticket_escalated_manager',
        payload: {
          ticketNo: ticket.ticket_no,
          subject: ticket.subject,
          priority: ticket.priority,
          level: ticket.escalated_level + 1,
          category: ticket.category_name,
        },
      });
    }

    // Also notify current assignee that ticket has breached and escalated to management
    if (ticket.assignee_user_id !== null && ticket.assignee_user_id !== targetUserId) {
      await enqueue(db, {
        recipientUserId: ticket.assignee_user_id,
        channel: 'in_app',
        templateCode: 'helpdesk_ticket_escalated',
        payload: { ticketNo: ticket.ticket_no, level: ticket.escalated_level + 1 },
      });
    }

    count++;
  }
  return { escalated: count };
}

/** R29 — monthly performance (SOW-9.3, docs/06 §3). */
export async function helpdeskPerformance(
  db: Kysely<Database>,
  params: { month: string },
): Promise<
  {
    categoryCode: string;
    categoryName: string;
    raised: number;
    resolved: number;
    breached: number;
    avgResolutionHours: number | null;
    avgFirstResponseHours: number | null;
    reopenedCount: number;
    resolutionRatePct: number;
  }[]
> {
  const monthStart = `${params.month}-01`;
  const rows = await db
    .selectFrom('hd.tickets as t')
    .innerJoin('hd.categories as c', 'c.id', 't.category_id')
    .select(['c.code as category_code', 'c.name as category_name'])
    .select(sql<string>`COUNT(*)`.as('raised'))
    .select(sql<string>`COUNT(*) FILTER (WHERE t.status IN ('resolved','closed'))`.as('resolved'))
    .select(
      sql<string>`COUNT(*) FILTER (WHERE (t.resolved_at IS NULL AND t.sla_due_at < now()) OR (t.resolved_at IS NOT NULL AND t.resolved_at > t.sla_due_at) OR t.escalated_level > 0)`.as(
        'breached',
      ),
    )
    .select(
      sql<string | null>`AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)) / 3600) FILTER (WHERE t.resolved_at IS NOT NULL)`.as(
        'avg_hours',
      ),
    )
    .select(
      sql<string | null>`AVG(EXTRACT(EPOCH FROM (t.first_response_at - t.created_at)) / 3600) FILTER (WHERE t.first_response_at IS NOT NULL)`.as(
        'first_response_hours',
      ),
    )
    .select(sql<string>`COUNT(*) FILTER (WHERE t.reopen_count > 0)`.as('reopened_count'))
    .where(sql<boolean>`t.created_at >= ${monthStart}::date`)
    .where(sql<boolean>`t.created_at < (${monthStart}::date + INTERVAL '1 month')`)
    .groupBy(['c.code', 'c.name'])
    .orderBy('c.name')
    .execute();

  return rows.map((r) => {
    const raised = Number(r.raised);
    const resolved = Number(r.resolved);
    return {
      categoryCode: r.category_code,
      categoryName: r.category_name,
      raised,
      resolved,
      breached: Number(r.breached),
      avgResolutionHours: r.avg_hours === null ? null : Math.round(Number(r.avg_hours) * 10) / 10,
      avgFirstResponseHours:
        r.first_response_hours === null
          ? null
          : Math.round(Number(r.first_response_hours) * 10) / 10,
      reopenedCount: Number(r.reopened_count),
      resolutionRatePct: raised === 0 ? 100 : Math.round((resolved / raised) * 100),
    };
  });
}
