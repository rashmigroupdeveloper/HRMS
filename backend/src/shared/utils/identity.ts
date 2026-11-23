// Checks of Indian identity numbers and phone numbers (old HRMS rules, 2026-11-16). Pure helpers - no I/O.

// Verhoeff check-digit tables (the checksum UIDAI uses for the 12th digit of an Aadhaar number)
const D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
]
const P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
]

// A real Aadhaar number: 12 digits, not starting with 0 or 1, and the last digit is its Verhoeff check digit
export function isValidAadhaar(digits: string): boolean {
  if (!/^[2-9]\d{11}$/.test(digits)) return false
  let check = 0
  ;[...digits].reverse().forEach((digit, i) => {
    check = D[check]![P[i % 8]![Number(digit)]!]!
  })
  return check === 0
}

// A person's PAN: AAAAA9999A with "P" as the 4th letter (P = individual; companies, firms, trusts have other letters)
export function isPersonalPan(pan: string): boolean {
  return /^[A-Z]{3}P[A-Z]\d{4}[A-Z]$/.test(pan)
}

// A mobile number: an Indian one - 10 digits starting 6-9, optionally written with +91 / 91 / 0 in front - or an
// international one written with + and its country code (overseas joiners). Spaces and hyphens are ignored.
export function isValidMobile(value: string): boolean {
  const compact = value.replace(/[\s-]/g, '')
  if (/^(\+91|91|0)?[6-9]\d{9}$/.test(compact)) return true
  return /^\+(?!91)[1-9]\d{6,14}$/.test(compact)
}
