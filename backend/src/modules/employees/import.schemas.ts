/**
 * Import row contracts + canonicalization data (doc 11 §0.1/§0.2).
 * Step 1 source: EMS `users` collection (identity + hierarchy + bcrypt hashes).
 * Step 2 source: greytHR export (DOB/DOJ/statutory/bank — what EMS lacks).
 */
import { z } from 'zod';

/** Raw company strings → canonical company NAME (as seeded in core.companies). */
export const COMPANY_ALIASES: Readonly<Record<string, string>> = {
  'Rashmi Metaliks Limited': 'Rashmi Metaliks Limited',
  'Rashmi Metalix Ltd': 'Rashmi Metaliks Limited', // misspelled dup (doc 11 §0.2)
  'Rashmi Green Hydrogen Steel Ltd': 'Rashmi Green Hydrogen Steel Ltd',
  'Reach Dredging Limited': 'Reach Dredging Limited',
  'Rashmi 6 Paradigm Limited': 'Rashmi Paradigm Limited', // OCR/typo (P0-T08 confirms)
  'Rashmi Paradigm Limited': 'Rashmi Paradigm Limited',
  'eHoome iOT Pvt. Limited': 'eHoome iOT Pvt. Limited',
  'Koove iOT Pvt. Limited': 'Koove iOT Pvt. Limited',
  'Koove Organic Chemical Pvt. Limited': 'Koove Organic Chemical Pvt. Limited',
  'Rashmi Rare Earth Limited': 'Rashmi Rare Earth Limited',
  'Rashmi Pipes And Fittings FZCO Dubai': 'Rashmi Pipes And Fittings FZCO Dubai',
  'Reach Mining Tz Limited': 'Reach Mining Tz Limited',
  'Rashmi Metaliks UK Limited': 'Rashmi Metaliks UK Limited',
  'Rashmi Metaliks Bahrain W.L.L': 'Rashmi Metaliks Bahrain W.L.L',
  'Rashmi Group': 'Rashmi Group',
};

/** greytHR e-code shape: prefix + digits (e.g. RML035384, EIPL0346). */
export const ECODE_PATTERN = /^[A-Z]{2,5}\d{3,7}$/;

export const emsUserSchema = z.object({
  userid: z.string().min(4),
  username: z.string().min(1),
  email: z.string().email().nullish(),
  phone: z.string().nullish(),
  gender: z.string().nullish(),
  company: z.string().min(1),
  department: z.string().nullish(),
  designation: z.string().nullish(),
  /** Manager's e-code (resolved from the EMS ObjectId refs at export time). */
  reporting_manager_userid: z.string().nullish(),
  /** HOD's e-code — maps to functional_manager (CORE-03). */
  hod_userid: z.string().nullish(),
  /** bcrypt hash carried over so everyone can log in day one (doc 11 §0.1). */
  encrypted_password: z.string().nullish(),
});
export type EmsUserRow = z.infer<typeof emsUserSchema>;

export const greythrRowSchema = z.object({
  userid: z.string().min(4),
  dob: z.string().date().nullish(),
  doj: z.string().date().nullish(),
  gender: z.string().nullish(),
  category: z.enum(['white_collar', 'blue_collar', 'trainee', 'consultant', 'contract']).nullish(),
  pan: z.string().nullish(),
  aadhaar: z.string().nullish(),
  uan: z.string().nullish(),
  pf_number: z.string().nullish(),
  esic_ip_number: z.string().nullish(),
  bank_name: z.string().nullish(),
  bank_account: z.string().nullish(),
  bank_ifsc: z.string().nullish(),
});
export type GreythrRow = z.infer<typeof greythrRowSchema>;

export interface ImportException {
  userid: string;
  issue: string;
}
