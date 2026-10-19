/** LC-01: the same application contract governs submission and HR conversion.
 *  formKind follows the three Rashmi joining forms: regular (Form F + EPF),
 *  consultant/intern (medical, no gratuity nomination), overseas (passport, no medical).
 */
import { z } from 'zod';
import { educationRowSchema, familyRowSchema, joiningDocumentSchema, nominationRowSchema, addressSchema, nominationShareProblem } from './joining-pack.schema.js';

const row = z.object({
  label: z.string().trim().min(1).max(120),
  detail: z.string().trim().max(240).optional(),
});

export const PrejoinSubmissionSchema = z.object({
  formKind: z.enum(['regular', 'consultant', 'overseas']).default('regular'),
  presentAddress: z.string().trim().min(5),
  permanentAddress: z.string().trim().min(5),
  emergencyContactName: z.string().trim().min(2),
  emergencyContactPhone: z.string().trim().min(10),
  emergencyContactRelation: z.string().trim().min(2),
  emergencyContactAlt: z.string().trim().max(20).optional(),
  fatherName: z.string().trim().max(120).optional(),
  gender: z.enum(['male', 'female', 'transgender']).optional(),
  maritalStatus: z.enum(['single', 'married', 'other']).optional(),
  nationality: z.string().trim().max(80).optional(),
  passportNo: z.string().trim().max(20).optional(),
  pan: z.string().trim().max(10).optional(),
  aadhaar: z.string().trim().max(12).optional(),
  uan: z.string().optional(),
  esicNo: z.string().trim().max(20).optional(),
  nomineeName: z.string().trim().max(120).optional(),
  nomineeRelation: z.string().trim().max(80).optional(),
  bankName: z.string().trim().min(2),
  bankAccount: z.string().trim().min(8),
  bankIfsc: z.string().trim().length(11),
  bloodGroup: z.string().optional(),
  education: z.array(row).max(8).optional(),
  educationRows: z.array(educationRowSchema).max(8).optional(),
  previousEmployment: z.array(row).max(8).optional(),
  family: z.array(row).max(8).optional(),
  familyRows: z.array(familyRowSchema).max(12).optional(),
  nominations: z.array(nominationRowSchema).max(24).optional(),
  documents: z.array(joiningDocumentSchema).max(4).optional(),
  presentStructured: addressSchema.optional(),
  permanentStructured: addressSchema.optional(),
  medicalNotes: z.string().trim().max(2000).optional(),
  declarationAccepted: z.boolean().optional(),
}).superRefine((value, ctx) => {
  const shares = nominationShareProblem(value.nominations ?? []);
  if (shares) ctx.addIssue({ code: 'custom', path: ['nominations'], message: shares });
  if (value.formKind === 'overseas') {
    if ((value.passportNo ?? '').trim().length < 6) {
      ctx.addIssue({ code: 'custom', path: ['passportNo'], message: 'Overseas joining needs a passport number' });
    }
    return;
  }
  if ((value.pan ?? '').trim().length !== 10) {
    ctx.addIssue({ code: 'custom', path: ['pan'], message: 'PAN must contain exactly 10 characters' });
  }
  if ((value.aadhaar ?? '').trim().length !== 12) {
    ctx.addIssue({ code: 'custom', path: ['aadhaar'], message: 'Aadhaar must contain exactly 12 digits' });
  }
});
