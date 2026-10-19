/** External endpoint: ATS client authentication replaces human role assertions. */
import { ORPCError } from '@orpc/server';
import { z } from 'zod';
import { base } from '../../api/orpc.js';
import { acceptedOfferSchema, acceptanceDigest } from './contract.js';
import { verifyAtsAssertion } from './security.js';
import { atsCompanyIds } from './company-scope.js';
import { receiveAcceptedOffer } from './service.js';
export const atsBridgeRouter = {
  companies: base
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
      if (!context.db)
        throw new ORPCError('SERVICE_UNAVAILABLE', { message: 'Database unavailable' });
      await verifyAtsAssertion(context.db, context.req.headers.authorization, acceptanceDigest({}));
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
  receive: base
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
      if (!context.db)
        throw new ORPCError('SERVICE_UNAVAILABLE', { message: 'Database unavailable' });
      await verifyAtsAssertion(
        context.db,
        context.req.headers.authorization,
        acceptanceDigest(input),
      );
      return { success: true as const, data: await receiveAcceptedOffer(context.db, input) };
    }),
};
