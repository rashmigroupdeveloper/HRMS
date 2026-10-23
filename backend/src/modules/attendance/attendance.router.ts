/**
 * Attendance ops surface (Stage 1.1): device health board (ATT-02), the
 * unmatched-swipe exception queue (04 §1.1 — never silently dropped),
 * quarantine review (doc 14 §8.4) and a manual sync trigger.
 * Permissions per docs/08 §2: devices/integrations = it_admin domain;
 * the unmatched queue = HR ops (attendance.manual_override holders fix mappings).
 */
import { ORPCError } from '@orpc/server';
import { z } from 'zod';
import { withAnyPermission, withPermission } from '../../api/orpc.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { assertEmployeesInScope } from '../../core/rbac/employee-scope.js';
import { getTypedSetting } from '../settings/index.js';
import { runKentSync, KentIntegrationUnavailable } from './kent-sync.job.js';
import { kentConnectorFromEnv } from './kent-source-connectors.js';
import { reingestQuarantined } from './ingest.service.js';
import { drainRecomputeQueue, listFinalizationHolds } from './day-status.service.js';
import { sql } from 'kysely';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const devicesProcedure = withPermission('admin.devices')
  .route({ method: 'GET', path: '/attendance/devices', summary: 'Device health board (last-seen, silent flags)' })
  .output(
    z.array(
      z.object({
        doorCode: z.string(),
        source: z.string(),
        lastSeenAt: z.string().nullable(),
        watermarkAt: z.string().nullable(),
        isActive: z.boolean(),
        silent: z.boolean(),
      }),
    ),
  )
  .handler(async ({ context }) => {
    const thresholdMinutes = await getTypedSetting(context.db, 'att.device_silent_minutes', 'number', 15);
    const cutoff = Date.now() - thresholdMinutes * 60_000;

    const rows = await context.db
      .selectFrom('att.devices as device')
      .leftJoin('att.device_watermarks as watermark', 'watermark.device_id', 'device.id')
      .select([
        'device.door_code',
        'device.source',
        'device.last_seen_at',
        'device.is_active',
        'watermark.watermark_ts',
      ])
      .orderBy('device.door_code')
      .execute();
    return rows.map((r) => ({
      doorCode: r.door_code,
      source: r.source,
      lastSeenAt: r.last_seen_at?.toISOString() ?? null,
      watermarkAt: r.watermark_ts?.toISOString() ?? null,
      isActive: r.is_active,
      silent: r.is_active && (r.last_seen_at === null || r.last_seen_at.getTime() < cutoff),
    }));
  });

const finalizationHoldsProcedure = withPermission('reports.hr')
  .route({
    method: 'GET',
    path: '/attendance/finalization-holds',
    summary: 'Biometric attendance days held until every mapped door is synchronized',
  })
  .input(z.object({ companyId: z.number().int().positive(), date: isoDate }))
  .output(
    z.array(
      z.object({
        employeeId: z.number(),
        ecode: z.string(),
        employeeName: z.string(),
        workDate: isoDate,
        shiftEndAt: z.string().nullable(),
        finalizeAfterAt: z.string().nullable(),
        reason: z.enum([
          'day_cutoff_pending',
          'location_not_mapped',
          'no_active_devices',
          'device_watermark_pending',
        ]),
        pendingDoors: z.array(z.string()),
      }),
    ),
  )
  .handler(async ({ input, context }) =>
    listFinalizationHolds(context.db, input.companyId, input.date),
  );

const unmatchedProcedure = withPermission('attendance.manual_override')
  .route({
    method: 'GET',
    path: '/attendance/exceptions/unmatched',
    summary: 'Swipes whose employee_no matched no employee — fix the mapping, nothing is dropped',
  })
  .input(z.object({ limit: z.number().int().min(1).max(500).default(200) }).optional())
  .output(
    z.array(
      z.object({
        employeeNo: z.string(),
        swipes: z.number(),
        firstSeen: z.string(),
        lastSeen: z.string(),
      }),
    ),
  )
  .handler(async ({ input, context }) => {
    const rows = await context.db
      .selectFrom('att.swipe_events')
      .select((eb) => [
        'employee_no',
        eb.fn.countAll().as('swipes'),
        eb.fn.min('swipe_ts').as('first_seen'),
        eb.fn.max('swipe_ts').as('last_seen'),
      ])
      .where('employee_id', 'is', null)
      .groupBy('employee_no')
      .orderBy('last_seen', 'desc')
      .limit(input?.limit ?? 200)
      .execute();
    return rows.map((r) => ({
      employeeNo: r.employee_no,
      swipes: Number(r.swipes),
      firstSeen: new Date(r.first_seen as unknown as string).toISOString(),
      lastSeen: new Date(r.last_seen as unknown as string).toISOString(),
    }));
  });

const quarantineProcedure = withPermission('admin.integrations')
  .route({
    method: 'GET',
    path: '/attendance/exceptions/quarantined',
    summary: 'Swipes with implausible timestamps (device clock drift/reset) awaiting review',
  })
  .input(z.object({ limit: z.number().int().min(1).max(500).default(200) }).optional())
  .output(
    z.array(
      z.object({
        id: z.number(),
        employeeNo: z.string(),
        swipeTs: z.string(),
        receivedAt: z.string(),
        doorCode: z.string().nullable(),
        reason: z.string(),
        reviewed: z.boolean(),
      }),
    ),
  )
  .handler(async ({ input, context }) => {
    const rows = await context.db
      .selectFrom('att.quarantined_swipes')
      .selectAll()
      .where('reviewed', '=', false)
      .orderBy('created_at', 'desc')
      .limit(input?.limit ?? 200)
      .execute();
    return rows.map((r) => ({
      id: r.id,
      employeeNo: r.employee_no,
      swipeTs: r.swipe_ts.toISOString(),
      receivedAt: r.received_at.toISOString(),
      doorCode: r.door_code,
      reason: r.reason,
      reviewed: r.reviewed,
    }));
  });

const syncNowProcedure = withPermission('admin.integrations')
  .route({ method: 'POST', path: '/attendance/sync', summary: 'Run one ingestion cycle immediately' })
  .output(
    z.object({
      fetched: z.number(),
      inserted: z.number(),
      quarantined: z.number(),
      unmatched: z.number(),
      silentDoorsAlerted: z.array(z.string()),
    }),
  )
  .handler(async ({ context }) => {
    let result;
    try { result = await runKentSync(context.db, kentConnectorFromEnv()); }
    catch (error) {
      if (error instanceof KentIntegrationUnavailable) throw new ORPCError('SERVICE_UNAVAILABLE', { message: error.message });
      throw error;
    }
    return {
      fetched: result.fetched,
      inserted: result.inserted,
      quarantined: result.quarantined,
      unmatched: result.unmatchedEmployeeNos.length,
      silentDoorsAlerted: result.silentDoorsAlerted,
    };
  });

const reingestProcedure = withPermission('admin.integrations')
  .route({
    method: 'POST',
    path: '/attendance/exceptions/quarantined/reingest',
    summary: 'Promote reviewed quarantined swipes into attendance after the device clock is fixed',
  })
  .input(z.object({ ids: z.array(z.number().int().positive()).optional() }).optional())
  .output(z.object({ promoted: z.number(), reviewed: z.number() }))
  .handler(async ({ input, context }) => {
    return reingestQuarantined(context.db, input?.ids);
  });

/** E2E-031: IT / HR ops record biometric enrolment (and access card) after onboarding — feeds the readiness check. */
const biometricEnrolmentProcedure = withAnyPermission('admin.devices', 'attendance.manual_override')
  .route({ method: 'POST', path: '/attendance/biometric-enrolment', summary: 'Mark an employee biometric-enrolled (audited)' })
  .input(z.object({ ecode: z.string().trim().min(1), registered: z.boolean(), accessCardNo: z.string().trim().max(40).optional() }).strict())
  .output(z.object({ employeeId: z.number(), ecode: z.string(), biometricRegistered: z.boolean(), accessCardNo: z.string().nullable() }))
  .handler(async ({ input, context }) => {
    const emp = await context.db.selectFrom('core.employees').select(['id', 'ecode', 'biometric_registered', 'access_card_no'])
      .where('ecode', '=', input.ecode.toUpperCase()).executeTakeFirst();
    if (!emp) throw new ORPCError('NOT_FOUND', { message: `No employee with e-code ${input.ecode}` });
    await assertEmployeesInScope(context.db, { ...context.permissionAccess, actorEmployeeId: context.user.employee_id }, [emp.id]);
    const card = input.accessCardNo === undefined ? emp.access_card_no : input.accessCardNo === '' ? null : input.accessCardNo;
    await context.db.updateTable('core.employees').set({ biometric_registered: input.registered, access_card_no: card }).where('id', '=', emp.id).execute();
    await writeAudit(context.db, {
      actorUserId: context.user.id, action: 'update', entity: 'core.employees', entityId: emp.id, field: 'biometric_registered',
      oldValue: JSON.stringify({ biometric_registered: emp.biometric_registered, access_card_no: emp.access_card_no }),
      newValue: JSON.stringify({ biometric_registered: input.registered, access_card_no: card }), ip: context.req.ip ?? null,
    });
    return { employeeId: emp.id, ecode: emp.ecode, biometricRegistered: input.registered, accessCardNo: card };
  });

/**
 * E2E-032: when punches arrive by manual upload (no live Kent feed), an admin
 * confirms the doors are complete through a past date. Watermarks only move
 * forward (GREATEST + monotonic trigger), the reason is audited, and held days
 * are recomputed straight away.
 */
const markDoorsCompleteProcedure = withAnyPermission('admin.devices', 'attendance.month_lock')
  .route({ method: 'POST', path: '/attendance/doors/mark-complete', summary: 'Mark door data complete through a date after a manual upload (audited)' })
  .input(z.object({ through: isoDate, locationId: z.number().int().positive().optional(), reason: z.string().trim().min(10).max(500) }).strict())
  .output(z.object({ doors: z.array(z.string()), watermarkAt: z.string(), recomputed: z.number() }))
  .handler(async ({ input, context }) => {
    const watermark = new Date(`${input.through}T23:59:59.999+05:30`);
    if (watermark.getTime() >= Date.now()) throw new ORPCError('BAD_REQUEST', { message: 'Only a past date can be marked complete' });
    let q = context.db.selectFrom('att.devices').select(['id', 'door_code']).where('is_active', '=', true);
    if (input.locationId !== undefined) q = q.where('location_id', '=', input.locationId);
    const devices = await q.orderBy('door_code').execute();
    if (devices.length === 0) throw new ORPCError('BAD_REQUEST', { message: 'No active doors match' });
    const apply = async (trx: typeof context.db): Promise<void> => {
      for (const d of devices) {
        await trx.insertInto('att.device_watermarks').values({ device_id: d.id, watermark_ts: watermark })
          .onConflict((oc) => oc.column('device_id').doUpdateSet({ watermark_ts: sql`GREATEST(att.device_watermarks.watermark_ts, excluded.watermark_ts)`, updated_at: new Date() }))
          .execute();
      }
      await writeAudit(trx, {
        actorUserId: context.user.id, action: 'update', entity: 'att.device_watermarks', field: 'manual_complete',
        newValue: JSON.stringify({ through: input.through, locationId: input.locationId ?? null, doors: devices.map((d) => d.door_code), reason: input.reason }),
        ip: context.req.ip ?? null,
      });
    };
    if (context.db.isTransaction) await apply(context.db);
    else await context.db.transaction().execute(apply);
    const recomputed = await drainRecomputeQueue(context.db);
    return { doors: devices.map((d) => d.door_code), watermarkAt: watermark.toISOString(), recomputed };
  });

export const attendanceRouter = {
  markDoorsComplete: markDoorsCompleteProcedure,
  biometricEnrolment: biometricEnrolmentProcedure,
  devices: devicesProcedure,
  finalizationHolds: finalizationHoldsProcedure,
  unmatched: unmatchedProcedure,
  quarantined: quarantineProcedure,
  syncNow: syncNowProcedure,
  reingest: reingestProcedure,
};
