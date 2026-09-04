/**
 * Stage 5.6 — statutory register stubs (CMP-08..14).
 * Permission: cmp.register.generate only. No invented payroll numbers.
 */
import { ORPCError } from '@orpc/server';
import { z } from 'zod';
import { withPermission } from '../../api/orpc.js';
import {
  listRegisterCatalog,
  previewRegister,
  REGISTER_CODES,
} from './registers.service.js';

const registerCode = z.enum(REGISTER_CODES);

const catalogEntry = z.object({
  code: registerCode,
  name: z.string(),
  requirementId: z.string(),
  status: z.enum(['available', 'pending_payroll']),
  dependency: z.string().nullable(),
});

const headerRow = z.object({
  ecode: z.string(),
  name: z.string(),
  doj: z.string().nullable(),
});

const previewOk = z.object({
  status: z.literal('ok'),
  code: registerCode,
  mode: z.literal('header_only'),
  columns: z.tuple([z.literal('ecode'), z.literal('name'), z.literal('doj')]),
  rows: z.array(headerRow),
});

const previewBlocked = z.object({
  status: z.literal('blocked'),
  code: registerCode,
  reason: z.string(),
});

const guard = withPermission('cmp.register.generate');

const registerCatalog = guard
  .route({
    method: 'GET',
    path: '/compliance/registers/catalog',
    summary: 'Statutory register catalog — available vs pending payroll (CMP-08)',
  })
  .output(z.object({ rows: z.array(catalogEntry) }))
  .handler(() => ({ rows: listRegisterCatalog() }));

const registerPreview = guard
  .route({
    method: 'GET',
    path: '/compliance/registers/{code}/preview',
    summary: 'Header-only preview from employee master, or blocked until Stage 2 payroll',
  })
  .input(
    z.object({
      code: registerCode,
      companyId: z.coerce.number().int().positive(),
    }),
  )
  .output(z.union([previewOk, previewBlocked]))
  .handler(async ({ input, context }) => {
    const result = await previewRegister(context.db, {
      code: input.code,
      companyId: input.companyId,
    });
    if (result.status === 'unknown_code') {
      throw new ORPCError('NOT_FOUND', { message: `Unknown register code: ${input.code}` });
    }
    return result;
  });

export const registersRouter = { registerCatalog, registerPreview };
