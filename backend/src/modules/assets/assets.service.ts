/**
 * Asset registry service (M8 — AST-01…AST-06).
 *
 * The module earns its keep at EXIT: an asset still held by a leaver blocks
 * their clearance (AST-04), which is the loop that actually recovers kit. So
 * "what is still out, and who has it" is the query everything else is shaped
 * around.
 *
 * Invariants deliberately live in the DATABASE (see the migration), not here:
 * one open assignment per asset, a holder that is an employee XOR a third
 * party, and a return that carries both a timestamp and a condition. This
 * service enforces the *workflow* on top of them and writes the audit trail.
 */
import { sql, type Kysely, type SqlBool } from 'kysely';
import type {
  AssetStatus,
  Database,
  HolderKind,
  MaintenanceKind,
  ReturnCondition,
} from '../../core/db/types.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { formatDbDate } from '../../core/dates.js';

export interface AssetRow {
  id: number;
  assetNo: string;
  category: string;
  description: string | null;
  serialNo: string | null;
  purchaseDate: string | null;
  warrantyTill: string | null;
  status: AssetStatus;
  companyId: number;
  locationName: string | null;
  /** Current holder, when the asset is out. */
  holderKind: HolderKind | null;
  holderName: string | null;
  holderEcode: string | null;
  assignedAt: string | null;
  /** The OPEN assignment, when the asset is out — what a return acts on. */
  assignmentId: number | null;
}

/**
 * DATE columns arrive from pg as a Date at LOCAL midnight. `toISOString()`
 * would shift that back a day in IST (2020-01-15 00:00 IST is 2020-01-14
 * 18:30 UTC), silently reporting the wrong warranty or exit date — so this
 * goes through the shared calendar-safe formatter.
 */
function isoOrNull(value: unknown): string | null {
  if (value instanceof Date) return formatDbDate(value);
  if (typeof value === 'string') return value.slice(0, 10);
  return null;
}

function stampOrNull(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return null;
}

/**
 * AST-01 — search by asset number, serial, category, holder name or e-code.
 * The Task-Matrix gap was specifically "asset number filter", so a bare
 * asset-no search must always work even with every other filter empty.
 */
export async function listAssets(
  db: Kysely<Database>,
  params: {
    companyId?: number | undefined;
    q?: string | undefined;
    status?: AssetStatus | undefined;
    category?: string | undefined;
    /** AST-05: only assets currently held by someone. */
    outstandingOnly?: boolean | undefined;
    limit: number;
    offset: number;
  },
): Promise<{ rows: AssetRow[]; total: number }> {
  const base = db
    .selectFrom('ast.assets as a')
    .leftJoin('core.locations as l', 'l.id', 'a.location_id')
    // The single open assignment per asset is guaranteed by a partial unique
    // index, so this join can never fan out.
    .leftJoin(
      (eb) =>
        eb
          .selectFrom('ast.assignments')
          .select([
            'id as assignment_id',
            'asset_id',
            'holder_kind',
            'employee_id',
            'third_party_name',
            'assigned_at',
          ])
          .where('returned_at', 'is', null)
          .as('cur'),
      (join) => join.onRef('cur.asset_id', '=', 'a.id'),
    )
    .leftJoin('core.employees as e', 'e.id', 'cur.employee_id')
    .$if(params.companyId !== undefined, (qb) => qb.where('a.company_id', '=', params.companyId ?? 0))
    .$if(params.status !== undefined, (qb) => qb.where('a.status', '=', params.status ?? 'in_stock'))
    .$if(params.category !== undefined, (qb) => qb.where('a.category', '=', params.category ?? ''))
    .$if(params.outstandingOnly === true, (qb) => qb.where('cur.asset_id', 'is not', null))
    .$if(params.q !== undefined && params.q.trim() !== '', (qb) => {
      const term = `%${(params.q ?? '').trim().toLowerCase()}%`;
      return qb.where(
        sql<SqlBool>`(
          lower(a.asset_no) LIKE ${term}
          OR lower(coalesce(a.serial_no, '')) LIKE ${term}
          OR lower(coalesce(a.description, '')) LIKE ${term}
          OR lower(a.category) LIKE ${term}
          OR lower(coalesce(e.ecode, '')) LIKE ${term}
          OR lower(coalesce(e.first_name, '') || ' ' || coalesce(e.last_name, '')) LIKE ${term}
          OR lower(coalesce(cur.third_party_name, '')) LIKE ${term}
        )`,
      );
    });

  const counted = await base.select((eb) => eb.fn.countAll<string>().as('n')).executeTakeFirst();

  const rows = await base
    .select([
      'a.id',
      'a.asset_no',
      'a.category',
      'a.description',
      'a.serial_no',
      'a.purchase_date',
      'a.warranty_till',
      'a.status',
      'a.company_id',
      'l.name as location_name',
      'cur.assignment_id',
      'cur.holder_kind',
      'cur.third_party_name',
      'cur.assigned_at',
      'e.ecode as holder_ecode',
      'e.first_name',
      'e.last_name',
    ])
    .orderBy('a.asset_no')
    .limit(params.limit)
    .offset(params.offset)
    .execute();

  return {
    total: Number(counted?.n ?? 0),
    rows: rows.map((r) => {
      const employeeName =
        r.first_name === null
          ? null
          : [r.first_name, r.last_name].filter((p) => p !== null && p !== '').join(' ');
      return {
        id: r.id,
        assetNo: r.asset_no,
        category: r.category,
        description: r.description,
        serialNo: r.serial_no,
        purchaseDate: isoOrNull(r.purchase_date),
        warrantyTill: isoOrNull(r.warranty_till),
        status: r.status,
        companyId: r.company_id,
        locationName: r.location_name,
        holderKind: r.holder_kind,
        holderName: r.holder_kind === 'third_party' ? r.third_party_name : employeeName,
        holderEcode: r.holder_ecode,
        assignedAt: stampOrNull(r.assigned_at),
        assignmentId: r.assignment_id,
      };
    }),
  };
}

/** AST-01/02 — create or update a registry entry. Past warranty dates allowed. */
export async function upsertAsset(
  db: Kysely<Database>,
  params: {
    assetNo: string;
    category: string;
    description?: string | null | undefined;
    serialNo?: string | null | undefined;
    purchaseDate?: string | null | undefined;
    warrantyTill?: string | null | undefined;
    companyId: number;
    locationId?: number | null | undefined;
    actorUserId: number;
    ip: string | null;
  },
): Promise<{ id: number; created: boolean }> {
  const existing = await db
    .selectFrom('ast.assets')
    .select(['id', 'category', 'serial_no'])
    .where('asset_no', '=', params.assetNo)
    .executeTakeFirst();

  const values = {
    asset_no: params.assetNo,
    category: params.category,
    description: params.description ?? null,
    serial_no: params.serialNo ?? null,
    purchase_date: params.purchaseDate === undefined || params.purchaseDate === null
      ? null
      : (sql<Date>`${params.purchaseDate}::date` as unknown as Date),
    // AST-02: a past date here is legitimate — kit is often registered after
    // it was issued, and forcing a future date would corrupt the record.
    warranty_till: params.warrantyTill === undefined || params.warrantyTill === null
      ? null
      : (sql<Date>`${params.warrantyTill}::date` as unknown as Date),
    company_id: params.companyId,
    location_id: params.locationId ?? null,
  };

  if (existing) {
    await db
      .updateTable('ast.assets')
      .set({ ...values, updated_at: sql`now()` })
      .where('id', '=', existing.id)
      .execute();
  } else {
    await db
      .insertInto('ast.assets')
      .values({ ...values, created_by: params.actorUserId })
      .execute();
  }

  const row = await db
    .selectFrom('ast.assets')
    .select('id')
    .where('asset_no', '=', params.assetNo)
    .executeTakeFirstOrThrow();

  await writeAudit(db, {
    actorUserId: params.actorUserId,
    action: existing ? 'update' : 'create',
    entity: 'ast.assets',
    entityId: row.id,
    field: params.assetNo,
    oldValue: existing ? `${existing.category}/${existing.serial_no ?? '—'}` : null,
    newValue: `${params.category}/${params.serialNo ?? '—'}`,
    ip: params.ip,
  });

  return { id: row.id, created: !existing };
}

/**
 * AST-03 — allocate to an employee OR a third party.
 * Refuses if the asset is already out: the DB would reject the second open row
 * anyway, but a clear domain error beats a constraint-violation stack trace.
 */
export async function assignAsset(
  db: Kysely<Database>,
  params: {
    assetId: number;
    holderKind: HolderKind;
    employeeId?: number | null | undefined;
    thirdPartyName?: string | null | undefined;
    thirdPartyOrg?: string | null | undefined;
    notes?: string | null | undefined;
    actorUserId: number;
    ip: string | null;
  },
): Promise<{ assignmentId: number }> {
  return db.transaction().execute(async (trx) => {
    const asset = await trx
      .selectFrom('ast.assets')
      .select(['id', 'asset_no', 'status'])
      .where('id', '=', params.assetId)
      .executeTakeFirst();
    if (!asset) throw new Error('Asset not found');
    if (asset.status === 'scrapped' || asset.status === 'lost') {
      throw new Error(`Asset ${asset.asset_no} is ${asset.status} and cannot be allocated`);
    }

    const open = await trx
      .selectFrom('ast.assignments')
      .select('id')
      .where('asset_id', '=', params.assetId)
      .where('returned_at', 'is', null)
      .executeTakeFirst();
    if (open) throw new Error(`Asset ${asset.asset_no} is already allocated — record a return first`);

    if (params.holderKind === 'employee' && (params.employeeId ?? null) === null) {
      throw new Error('Choose the employee who will hold this asset');
    }
    if (params.holderKind === 'third_party' && (params.thirdPartyName ?? '').trim() === '') {
      throw new Error('Third-party holders need a name');
    }

    const inserted = await trx
      .insertInto('ast.assignments')
      .values({
        asset_id: params.assetId,
        holder_kind: params.holderKind,
        employee_id: params.holderKind === 'employee' ? (params.employeeId ?? null) : null,
        third_party_name: params.holderKind === 'third_party' ? (params.thirdPartyName ?? null) : null,
        third_party_org: params.holderKind === 'third_party' ? (params.thirdPartyOrg ?? null) : null,
        notes: params.notes ?? null,
        assigned_by: params.actorUserId,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    await trx
      .updateTable('ast.assets')
      .set({ status: 'assigned', updated_at: sql`now()` })
      .where('id', '=', params.assetId)
      .execute();

    await writeAudit(trx, {
      actorUserId: params.actorUserId,
      action: 'assign',
      entity: 'ast.assignments',
      entityId: inserted.id,
      field: asset.asset_no,
      newValue:
        params.holderKind === 'employee'
          ? `employee:${String(params.employeeId ?? 0)}`
          : `third_party:${params.thirdPartyName ?? ''}`,
      ip: params.ip,
    });

    return { assignmentId: inserted.id };
  });
}

/**
 * AST-04 — record a return. `not_returned` is a first-class outcome, not a
 * failure to record one: an exit clearance has to be able to say "this was
 * never handed back" and keep the case open (AST-05).
 */
export async function returnAsset(
  db: Kysely<Database>,
  params: {
    assignmentId: number;
    condition: ReturnCondition;
    notes?: string | null | undefined;
    actorUserId: number;
    ip: string | null;
  },
): Promise<{ ok: true }> {
  return db.transaction().execute(async (trx) => {
    const assignment = await trx
      .selectFrom('ast.assignments as asg')
      .innerJoin('ast.assets as a', 'a.id', 'asg.asset_id')
      .select(['asg.id', 'asg.asset_id', 'asg.returned_at', 'a.asset_no'])
      .where('asg.id', '=', params.assignmentId)
      .executeTakeFirst();
    if (!assignment) throw new Error('Assignment not found');
    if (assignment.returned_at !== null) throw new Error('This allocation is already closed');

    await trx
      .updateTable('ast.assignments')
      .set({
        returned_at: sql`now()`,
        return_condition: params.condition,
        returned_by: params.actorUserId,
        notes: params.notes ?? null,
      })
      .where('id', '=', params.assignmentId)
      .execute();

    // A damaged return goes to maintenance, not back into stock — otherwise it
    // would be reallocated to the next joiner in its broken state.
    const nextStatus: AssetStatus = params.condition === 'damaged' ? 'maintenance' : 'in_stock';
    await trx
      .updateTable('ast.assets')
      .set({ status: nextStatus, updated_at: sql`now()` })
      .where('id', '=', assignment.asset_id)
      .execute();

    if (params.condition === 'damaged') {
      await trx
        .insertInto('ast.maintenance')
        .values({
          asset_id: assignment.asset_id,
          kind: 'damage',
          reported_by: params.actorUserId,
          description: params.notes ?? 'Damage reported on return',
        })
        .execute();
    }

    await writeAudit(trx, {
      actorUserId: params.actorUserId,
      action: 'return',
      entity: 'ast.assignments',
      entityId: params.assignmentId,
      field: assignment.asset_no,
      newValue: params.condition,
      ip: params.ip,
    });

    return { ok: true as const };
  });
}

/** AST-04 — everything a leaver still holds; the exit-clearance checklist. */
export async function assetsHeldByEmployee(
  db: Kysely<Database>,
  employeeId: number,
): Promise<{ assignmentId: number; assetNo: string; category: string; assignedAt: string | null }[]> {
  const rows = await db
    .selectFrom('ast.assignments as asg')
    .innerJoin('ast.assets as a', 'a.id', 'asg.asset_id')
    .select(['asg.id as assignment_id', 'a.asset_no', 'a.category', 'asg.assigned_at'])
    .where('asg.employee_id', '=', employeeId)
    .where('asg.returned_at', 'is', null)
    .orderBy('a.asset_no')
    .execute();

  return rows.map((r) => ({
    assignmentId: r.assignment_id,
    assetNo: r.asset_no,
    category: r.category,
    assignedAt: stampOrNull(r.assigned_at),
  }));
}

/** AST-05 — the dashboard tile: assets held by people who have already left. */
export async function nonReturnedByLeavers(
  db: Kysely<Database>,
  companyId?: number,
): Promise<{ assetNo: string; category: string; ecode: string; name: string; dol: string | null }[]> {
  const rows = await db
    .selectFrom('ast.assignments as asg')
    .innerJoin('ast.assets as a', 'a.id', 'asg.asset_id')
    .innerJoin('core.employees as e', 'e.id', 'asg.employee_id')
    .select(['a.asset_no', 'a.category', 'e.ecode', 'e.first_name', 'e.last_name', 'e.dol'])
    .where('asg.returned_at', 'is', null)
    .where('e.status', '=', 'exited')
    .$if(companyId !== undefined, (qb) => qb.where('a.company_id', '=', companyId ?? 0))
    .orderBy('e.dol')
    .execute();

  return rows.map((r) => ({
    assetNo: r.asset_no,
    category: r.category,
    ecode: r.ecode,
    name: [r.first_name, r.last_name].filter((p) => p !== null && p !== '').join(' '),
    dol: isoOrNull(r.dol),
  }));
}

/** AST-06 — log scheduled service, an incident, damage or a loss. */
export async function logMaintenance(
  db: Kysely<Database>,
  params: {
    assetId: number;
    kind: MaintenanceKind;
    description: string;
    scheduledFor?: string | null | undefined;
    cost?: number | null | undefined;
    actorUserId: number;
    ip: string | null;
  },
): Promise<{ id: number }> {
  return db.transaction().execute(async (trx) => {
    const asset = await trx
      .selectFrom('ast.assets')
      .select(['id', 'asset_no'])
      .where('id', '=', params.assetId)
      .executeTakeFirst();
    if (!asset) throw new Error('Asset not found');

    const inserted = await trx
      .insertInto('ast.maintenance')
      .values({
        asset_id: params.assetId,
        kind: params.kind,
        description: params.description,
        scheduled_for:
          params.scheduledFor === undefined || params.scheduledFor === null
            ? null
            : (sql<Date>`${params.scheduledFor}::date` as unknown as Date),
        cost: params.cost === undefined || params.cost === null ? null : String(params.cost),
        reported_by: params.actorUserId,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    // A lost asset stops being allocatable immediately.
    if (params.kind === 'lost') {
      await trx
        .updateTable('ast.assets')
        .set({ status: 'lost', updated_at: sql`now()` })
        .where('id', '=', params.assetId)
        .execute();
    }

    await writeAudit(trx, {
      actorUserId: params.actorUserId,
      action: 'create',
      entity: 'ast.maintenance',
      entityId: inserted.id,
      field: asset.asset_no,
      newValue: params.kind,
      ip: params.ip,
    });

    return { id: inserted.id };
  });
}

/** The maintenance/incident trail for one asset (AST-06). */
export async function assetMaintenance(
  db: Kysely<Database>,
  assetId: number,
): Promise<
  {
    id: number;
    kind: MaintenanceKind;
    description: string;
    scheduledFor: string | null;
    resolvedAt: string | null;
    cost: number | null;
  }[]
> {
  const rows = await db
    .selectFrom('ast.maintenance')
    .selectAll()
    .where('asset_id', '=', assetId)
    .orderBy('id', 'desc')
    .execute();

  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    description: r.description,
    scheduledFor: isoOrNull(r.scheduled_for),
    resolvedAt: stampOrNull(r.resolved_at),
    cost: r.cost === null ? null : Number(r.cost),
  }));
}
