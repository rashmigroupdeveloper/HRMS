/** LC-01 / REQ-002..008: joining grids shared by the portal and the HR walk-in form. */
import { z } from 'zod';

const SCHEMES = ['pf', 'eps', 'gratuity', 'esic', 'gpa', 'gmc', 'gtli'] as const;

export const addressSchema = z.object({
  house: z.string().trim().min(1).max(120),
  locality: z.string().trim().max(120).optional(),
  city: z.string().trim().min(1).max(80),
  district: z.string().trim().min(1).max(80),
  stateCode: z.string().trim().toUpperCase().length(2),
  pin: z.string().regex(/^[1-9]\d{5}$/),
});

export const educationRowSchema = z.object({
  qualification: z.string().trim().min(1).max(120),
  institute: z.string().trim().min(1).max(160),
  yearOfPassing: z.number().int().min(1950).max(2100).optional(),
});

export const familyRowSchema = z.object({
  name: z.string().trim().min(1).max(120),
  relation: z.string().trim().min(1).max(80),
  gender: z.enum(['Male', 'Female', 'Transgender']).optional(),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const nominationRowSchema = z.object({
  scheme: z.enum(SCHEMES),
  nomineeName: z.string().trim().min(1).max(120),
  relation: z.string().trim().min(1).max(80),
  sharePct: z.number().positive().max(100),
  address: z.string().trim().min(5).max(240),
});

export const joiningDocumentSchema = z.object({
  documentType: z.enum(['photo', 'id_proof', 'education', 'bank_proof', 'signature']),
  fileName: z.string().trim().min(1).max(180),
  mime: z.enum(['application/pdf', 'image/png', 'image/jpeg']),
  content: z.string().min(8).max(2_000_000),
});

const joiningPackObjectSchema = z.object({
  gender: z.enum(['Male', 'Female', 'Transgender']).optional(),
  fatherName: z.string().trim().max(120).optional(),
  present: addressSchema.optional(),
  permanent: addressSchema.optional(),
  sameAsPresent: z.boolean().optional(),
  education: z.array(educationRowSchema).max(8).optional(),
  family: z.array(familyRowSchema).max(12).optional(),
  nominations: z.array(nominationRowSchema).max(24).optional(),
  documents: z.array(joiningDocumentSchema).max(4).optional(),
  medicalNotes: z.string().trim().max(2000).optional(),
});

export const joiningPackSchema = joiningPackObjectSchema.superRefine((value, ctx) => {
  const problem = nominationShareProblem(value.nominations ?? []);
  if (problem) ctx.addIssue({ code: 'custom', path: ['nominations'], message: problem });
});

export const joiningPackInputSchema = joiningPackObjectSchema
  .extend({ ecode: z.string().trim().min(3).max(32) })
  .superRefine((value, ctx) => {
    const problem = nominationShareProblem(value.nominations ?? []);
    if (problem) ctx.addIssue({ code: 'custom', path: ['nominations'], message: problem });
  });

/** Shares of one scheme total 100. Empty schemes are not a nomination. */
export function nominationShareProblem(rows: { scheme: string; sharePct: number }[]): string | null {
  const totals = new Map<string, number>();
  for (const row of rows) totals.set(row.scheme, (totals.get(row.scheme) ?? 0) + row.sharePct);
  for (const [scheme, total] of totals) {
    if (Math.abs(total - 100) > 0.01) return `${scheme} nominations must total 100% (now ${total.toFixed(2)}%)`;
  }
  return null;
}

export type JoiningPack = z.infer<typeof joiningPackSchema>;
export type JoiningAddress = z.infer<typeof addressSchema>;
