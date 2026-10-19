/** External endpoint: ATS client authentication replaces human role assertions. */
import { ORPCError } from '@orpc/server';
import { z } from 'zod';
import { withPermission } from '../../api/orpc.js';
import { acceptedOfferSchema } from './contract.js';
import { atsClientAccount } from './client-account.js';
import { atsCompanyIds } from './company-scope.js';
import { receiveAcceptedOffer } from './service.js';
export const atsBridgeRouter = {
  companies: withPermission('integration.ats.receive', 'read', atsClientAccount)
    .route({
      method: 'GET',
      path: '/integrations/ats/employing-entities',
      summary: 'Configured legal-entity choices for the authenticated ATS client',
    })
    .input(z.object({}).optional())
    .output(
      z.object({
        success: z.literal(true),
        data: z.object({
          companies: z.array(
            z.object({ id: z.number().int(), name: z.string(), ecodePrefix: z.string() }),
          ),
        }),
      }),
    )
    .handler(async ({ context }) => {
      if (!context.permissionAccess.all)
        throw new ORPCError('FORBIDDEN', {
          message: 'Configured integration requires group-scoped authority',
        });
      const ids = await atsCompanyIds(context.db);
      const rows = await context.db
        .selectFrom('core.companies')
        .select(['id', 'name', 'ecode_prefix'])
        .where('id', 'in', ids)
        .orderBy('name')
        .execute();
      return {
        success: true as const,
        data: {
          companies: rows.map((c) => ({ id: c.id, name: c.name, ecodePrefix: c.ecode_prefix })),
        },
      };
    }),
  receive: withPermission('integration.ats.receive', 'write', atsClientAccount)
    .route({
      method: 'POST',
      path: '/integrations/ats/accepted-offers',
      summary: 'Receive an authenticated candidate-accepted ATS LOI; never creates an employee',
    })
    .input(acceptedOfferSchema)
    .output(
      z.object({
        success: z.literal(true),
        data: z.object({ candidateId: z.number().int(), created: z.boolean() }),
      }),
    )
    .handler(async ({ context, input }) => {
      if (!context.permissionAccess.all)
        throw new ORPCError('FORBIDDEN', {
          message: 'Configured integration requires group-scoped authority',
        });
      return { success: true as const, data: await receiveAcceptedOffer(context.db, input, context.user.id) };
    }),
};
