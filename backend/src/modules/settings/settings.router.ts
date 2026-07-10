/**
 * Settings procedures. Reads: any authenticated user. Writes: guarded by the
 * central permission gate (`admin.settings` — docs/08 §2) and audited old→new
 * into the hash chain.
 */
import { ORPCError } from '@orpc/server';
import { z } from 'zod';
import { authed, withPermission } from '../../api/orpc.js';
import { getSetting, listSettings } from './settings.repository.js';
import { setSetting } from './settings.service.js';

const settingOutput = z.object({
  key: z.string(),
  value: z.unknown(),
  valueType: z.enum(['number', 'string', 'boolean', 'json']),
  description: z.string(),
});

const getProcedure = authed
  .route({ method: 'GET', path: '/settings/{key}', summary: 'Read one setting' })
  .input(z.object({ key: z.string().min(1) }))
  .output(settingOutput)
  .handler(async ({ input, context }) => {
    const row = await getSetting(context.db, input.key);
    if (!row) throw new ORPCError('NOT_FOUND', { message: `Setting ${input.key} not found` });
    return { key: row.key, value: row.value, valueType: row.value_type, description: row.description };
  });

const listProcedure = authed
  .route({ method: 'GET', path: '/settings', summary: 'List all settings' })
  .output(z.array(settingOutput))
  .handler(async ({ context }) => {
    const rows = await listSettings(context.db);
    return rows.map((row) => ({
      key: row.key,
      value: row.value,
      valueType: row.value_type,
      description: row.description,
    }));
  });

const setProcedure = withPermission('admin.settings')
  .route({ method: 'PUT', path: '/settings/{key}', summary: 'Set a policy value (requires admin.settings; audited)' })
  .input(
    z.object({
      key: z.string().min(1),
      value: z.unknown(),
      valueType: z.enum(['number', 'string', 'boolean', 'json']),
      description: z.string().min(1),
    }),
  )
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context }) => {
    await setSetting(context.db, {
      key: input.key,
      value: input.value,
      type: input.valueType,
      description: input.description,
      actorUserId: context.user.id,
    });
    return { ok: true as const };
  });

export const settingsRouter = {
  get: getProcedure,
  list: listProcedure,
  set: setProcedure,
};
