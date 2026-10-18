/** Org masters CRUD API (SOW 004, C-48). Read: any signed-in user; write: `org.masters.manage` (super_admin). */
import { z } from 'zod';
import { withPermission } from '../../api/orpc.js';
import { companiesInScope } from '../../core/rbac/company-scope.js';
import { MASTER_KINDS, createMaster, deleteMaster, listMasters, updateMaster } from './masters.service.js';

const kind = z.enum(MASTER_KINDS);
const values = z.record(z.string(), z.union([z.string().max(300), z.number(), z.null()]));
const row = z.record(z.string(), z.unknown());

export const mastersRouter = {
  list: withPermission('employee.read', 'read')
    .route({ method: 'GET', path: '/core/masters/{kind}', summary: 'List an org master (company-bound masters filtered to your companies)' })
    .input(z.object({ kind }))
    .output(z.object({ rows: z.array(row) }))
    .handler(async ({ input, context }) => {
      // Group roles see every company; entity-bound roles see their own companies' masters.
      const companies = await companiesInScope(context);
      const rows = await listMasters(context.db, input.kind, companies);
      return { rows: rows.map((r) => JSON.parse(JSON.stringify(r)) as Record<string, unknown>) };
    }),
  create: withPermission('org.masters.manage')
    .route({ method: 'POST', path: '/core/masters/{kind}', summary: 'Create an org master row (audited)' })
    .input(z.object({ kind, values }))
    .output(z.object({ id: z.number() }))
    .handler(({ input, context }) => createMaster(context.db, input.kind, input.values, context.user.id, context.req.ip ?? null)),
  update: withPermission('org.masters.manage')
    .route({ method: 'PATCH', path: '/core/masters/{kind}/{id}', summary: 'Update an org master row (audited)' })
    .input(z.object({ kind, id: z.coerce.number().int().positive(), values }))
    .output(z.object({ id: z.number() }))
    .handler(({ input, context }) => updateMaster(context.db, input.kind, input.id, input.values, context.user.id, context.req.ip ?? null)),
  remove: withPermission('org.masters.manage')
    .route({ method: 'DELETE', path: '/core/masters/{kind}/{id}', summary: 'Delete an unused org master row (audited)' })
    .input(z.object({ kind, id: z.coerce.number().int().positive() }))
    .output(z.object({ ok: z.boolean() }))
    .handler(({ input, context }) => deleteMaster(context.db, input.kind, input.id, context.user.id, context.req.ip ?? null)),
};
