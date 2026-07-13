/**
 * Attendance ops surface (Stage 1.1): device health board (ATT-02), the
 * unmatched-swipe exception queue (04 §1.1 — never silently dropped),
 * quarantine review (doc 14 §8.4) and a manual sync trigger.
 * Permissions per docs/08 §2: devices/integrations = it_admin domain;
 * the unmatched queue = HR ops (attendance.manual_override holders fix mappings).
 */
import { z } from 'zod';
import { withPermission } from '../../api/orpc.js';
import { getTypedSetting } from '../settings/index.js';
import { runKentSync } from './kent-sync.job.js';
import { reingestQuarantined } from './ingest.service.js';
import { listFinalizationHolds } from './day-status.service.js';

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
        reason: z.enum([
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
    const result = await runKentSync(context.db);
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

export const attendanceRouter = {
  devices: devicesProcedure,
  finalizationHolds: finalizationHoldsProcedure,
  unmatched: unmatchedProcedure,
  quarantined: quarantineProcedure,
  syncNow: syncNowProcedure,
  reingest: reingestProcedure,
};
