/**
 * Country-pluggable identity / bank validators. Employee master, onboarding
 * and bulk imports call validateIdentity(country, field, value) so a new
 * country adds a table entry instead of new if-branches. India is the only
 * fully specified country today; others fall back to length/charset checks.
 */

/** Verhoeff checksum (UIDAI uses it for the 12th Aadhaar digit). */
const D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5], [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7], [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3], [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4], [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7], [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

export function verhoeffValid(digits: string): boolean {
  let c = 0;
  const rev = digits.split('').reverse();
  for (let i = 0; i < rev.length; i++) c = D[c]?.[P[i % 8]?.[Number(rev[i])] ?? 0] ?? 0;
  return c === 0;
}

export type IdentityField = 'pan' | 'aadhaar' | 'uan' | 'esic' | 'ifsc' | 'bank_account' | 'mobile' | 'pincode';

type Rule = (value: string) => string | null;

const IN: Record<IdentityField, Rule> = {
  pan: (v) => (/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(v) ? (/^[A-Z]{3}P/.test(v) ? null : 'PAN 4th letter must be P for an individual') : 'PAN must look like ABCDE1234F'),
  aadhaar: (v) => (!/^[2-9]\d{11}$/.test(v) ? 'Aadhaar must be 12 digits and cannot start with 0 or 1' : verhoeffValid(v) ? null : 'Aadhaar checksum is invalid (typo?)'),
  uan: (v) => (/^\d{12}$/.test(v) ? null : 'UAN must be 12 digits'),
  esic: (v) => (/^\d{10}$/.test(v) ? null : 'ESIC IP number must be 10 digits'),
  ifsc: (v) => (/^[A-Z]{4}0[A-Z0-9]{6}$/.test(v) ? null : 'IFSC must look like HDFC0001234 (5th character 0)'),
  bank_account: (v) => (/^\d{9,18}$/.test(v) ? null : 'Bank account must be 9–18 digits'),
  mobile: (v) => (/^[6-9]\d{9}$/.test(v) ? null : 'Mobile must be a 10-digit Indian number'),
  pincode: (v) => (/^[1-9]\d{5}$/.test(v) ? null : 'PIN code must be 6 digits'),
};

const GENERIC: Record<IdentityField, Rule> = {
  pan: (v) => (/^[A-Z0-9-]{4,20}$/.test(v) ? null : 'Tax ID: 4–20 letters/digits'),
  aadhaar: (v) => (/^[A-Z0-9-]{4,24}$/.test(v) ? null : 'National ID: 4–24 letters/digits'),
  uan: (v) => (/^[A-Z0-9-]{4,24}$/.test(v) ? null : 'Social security no.: 4–24 letters/digits'),
  esic: (v) => (/^[A-Z0-9-]{4,24}$/.test(v) ? null : 'Insurance no.: 4–24 letters/digits'),
  ifsc: (v) => (/^[A-Z0-9]{6,11}$/.test(v) ? null : 'Bank code (SWIFT/sort code): 6–11 letters/digits'),
  bank_account: (v) => (/^[A-Z0-9]{6,34}$/.test(v) ? null : 'Account / IBAN: 6–34 letters/digits'),
  mobile: (v) => (/^\+?\d{7,15}$/.test(v) ? null : 'Phone: 7–15 digits, optional +'),
  pincode: (v) => (/^[A-Z0-9 -]{3,10}$/i.test(v) ? null : 'Postal code: 3–10 characters'),
};

const BY_COUNTRY: Record<string, Record<IdentityField, Rule>> = { IN };

/** Canonical form used for storage and duplicate checks. */
export function normalizeIdentity(field: IdentityField, value: string): string {
  const v = value.trim().toUpperCase();
  const compact = v.replace(/[\s-]/g, '');
  return field === 'mobile' ? compact.replace(/^\+91(?=\d{10}$)/, '') : compact;
}

/** null when valid; otherwise a user-facing message. */
export function validateIdentity(country: string, field: IdentityField, value: string): string | null {
  const rules = BY_COUNTRY[country.toUpperCase()] ?? GENERIC;
  return rules[field](normalizeIdentity(field, value));
}

/** Whole years between two ISO dates. */
export function ageOn(dobIso: string, onIso: string): number {
  const [y1, m1, d1] = dobIso.split('-').map(Number);
  const [y2, m2, d2] = onIso.split('-').map(Number);
  let age = (y2 ?? 0) - (y1 ?? 0);
  if ((m2 ?? 0) < (m1 ?? 0) || ((m2 ?? 0) === (m1 ?? 0) && (d2 ?? 0) < (d1 ?? 0))) age--;
  return age;
}
