/**
 * India state code → name (ORG / PT support).
 *
 * Every table stores the 2-letter code (`core.locations.state_code`,
 * `pay.pt_slabs.state_code`); the R7 register prints the full name in its
 * `PT Location` column (docs/06 §2.1 — the live sheet shows "West Bengal",
 * not "WB"). Keeping the map here rather than in the report stops each new
 * export inventing its own spelling of a state.
 *
 * Professional tax is a STATE levy (docs/10 §4), so this list must stay
 * complete: a Rashmi entity registered outside WB must render a real name,
 * not a bare code that finance then has to decode.
 */
export const INDIA_STATE_NAMES = {
  AN: 'Andaman and Nicobar Islands',
  AP: 'Andhra Pradesh',
  AR: 'Arunachal Pradesh',
  AS: 'Assam',
  BR: 'Bihar',
  CH: 'Chandigarh',
  CT: 'Chhattisgarh',
  DH: 'Dadra and Nagar Haveli and Daman and Diu',
  DL: 'Delhi',
  GA: 'Goa',
  GJ: 'Gujarat',
  HP: 'Himachal Pradesh',
  HR: 'Haryana',
  JH: 'Jharkhand',
  JK: 'Jammu and Kashmir',
  KA: 'Karnataka',
  KL: 'Kerala',
  LA: 'Ladakh',
  LD: 'Lakshadweep',
  MH: 'Maharashtra',
  ML: 'Meghalaya',
  MN: 'Manipur',
  MP: 'Madhya Pradesh',
  MZ: 'Mizoram',
  NL: 'Nagaland',
  OD: 'Odisha',
  PB: 'Punjab',
  PY: 'Puducherry',
  RJ: 'Rajasthan',
  SK: 'Sikkim',
  TN: 'Tamil Nadu',
  TR: 'Tripura',
  TS: 'Telangana',
  UK: 'Uttarakhand',
  UP: 'Uttar Pradesh',
  WB: 'West Bengal',
} as const;

export type StateCode = keyof typeof INDIA_STATE_NAMES;

export function isStateCode(code: string): code is StateCode {
  return Object.prototype.hasOwnProperty.call(INDIA_STATE_NAMES, code.toUpperCase());
}

/**
 * `'WB'` → `'West Bengal'`. An unknown code falls through unchanged so a
 * register row never loses its PT location — a visible `ZZ` in the export is
 * far easier to catch than a silent blank.
 */
export function stateName(code: string): string {
  const upper = code.toUpperCase();
  return isStateCode(upper) ? INDIA_STATE_NAMES[upper] : code;
}
