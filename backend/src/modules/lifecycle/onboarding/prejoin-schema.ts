/** LC-01: the same application contract governs submission and HR conversion. */
import { z } from 'zod';

export const PrejoinSubmissionSchema = z.object({
  presentAddress: z.string().trim().min(5),
  permanentAddress: z.string().trim().min(5),
  emergencyContactName: z.string().trim().min(2),
  emergencyContactPhone: z.string().trim().min(10),
  emergencyContactRelation: z.string().trim().min(2),
  pan: z.string().trim().length(10),
  aadhaar: z.string().trim().length(12),
  uan: z.string().optional(),
  bankName: z.string().trim().min(2),
  bankAccount: z.string().trim().min(8),
  bankIfsc: z.string().trim().length(11),
  bloodGroup: z.string().optional(),
});
