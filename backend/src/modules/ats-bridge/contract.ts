/** LC-01/D4: accepted LOI snapshot; source IDs are never HRMS employee IDs. */
import { createHash } from 'node:crypto';
import { z } from 'zod';
export const acceptedOfferSchema = z
  .object({
    eventId: z.string().uuid(),
    offerId: z.number().int().positive().safe(),
    candidateId: z.number().int().positive().safe(),
    acceptedBySubject: z.string().regex(/^[1-9]\d*$/),
    acceptedAt: z.string().datetime({ offset: true }),
    evidenceRef: z.string().trim().min(1).max(2000),
    companyId: z.number().int().positive().safe(),
    fullName: z.string().trim().min(1).max(255),
    personalEmail: z.string().trim().email().max(255),
    mobile: z.string().trim().min(1).max(50),
    positionTitle: z.string().trim().min(1).max(255),
    offeredCtc: z.string().regex(/^\d+(?:\.\d{1,2})?$/),
    probationMonths: z.number().int().positive().max(32767),
    probationSalaryPct: z.number().int().positive().max(100),
    proposedDoj: z.string().date(),
    offerDate: z.string().date(),
  })
  .strict();
export type AcceptedOffer = z.infer<typeof acceptedOfferSchema>;
/** Flat, exact-value contract: both independent projects implement this canonical ordering. */
export function acceptanceDigest(input: AcceptedOffer | Record<string, never>): string {
  return createHash('sha256')
    .update(
      JSON.stringify(
        Object.fromEntries(Object.entries(input).sort(([a], [b]) => a.localeCompare(b))),
      ),
    )
    .digest('hex');
}
