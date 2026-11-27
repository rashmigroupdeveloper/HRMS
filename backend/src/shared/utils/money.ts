// Money to the paisa / cent (2026-11-24): salary amounts have 2 decimals. Sums and comparisons are done in whole paise,
// so floating-point never makes 48,666.67 x 3 differ from 1,46,000.01.

// 48666.67 -> 4866667 (rounded to the nearest paisa)
export const toPaise = (amount: number) => Math.round(amount * 100)

// 4866667 -> 48666.67
export const fromPaise = (paise: number) => paise / 100

// Rounds to 2 decimals: 48666.666 -> 48666.67
export const roundMoney = (amount: number) => fromPaise(toPaise(amount))

// True when the amount has at most 2 decimals
export const hasPaiseOnly = (amount: number) => Math.abs(amount * 100 - Math.round(amount * 100)) < 1e-6

// The monthly amount of an annual one, to the paisa: 5,84,000 -> 48,666.67
export const monthlyOf = (annual: number) => fromPaise(Math.round((annual * 100) / 12))

// Adds amounts exactly (in paise)
export const sumMoney = (amounts: number[]) => fromPaise(amounts.reduce((total, amount) => total + toPaise(amount), 0))

// --- In words, the Indian way (payslips, payroll stage 6) ---

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

// 0-999 in words ("" for 0)
function hundreds(n: number): string {
  const below100 = n % 100
  const twoDigits = below100 < 20 ? ONES[below100]! : [TENS[Math.floor(below100 / 10)]!, ONES[below100 % 10]!].filter(Boolean).join(' ')
  return [n >= 100 ? `${ONES[Math.floor(n / 100)]!} Hundred` : '', twoDigits].filter(Boolean).join(' ')
}

// A whole number in words with crore, lakh and thousand: 5912400 -> "Fifty Nine Lakh Twelve Thousand Four Hundred"
export function inWords(whole: number): string {
  if (whole === 0) return 'Zero'
  const crore = Math.floor(whole / 10_000_000)
  const rest = whole % 10_000_000
  const parts = [
    crore ? `${inWords(crore)} Crore` : '',
    Math.floor(rest / 100_000) ? `${hundreds(Math.floor(rest / 100_000))} Lakh` : '',
    Math.floor((rest % 100_000) / 1000) ? `${hundreds(Math.floor((rest % 100_000) / 1000))} Thousand` : '',
    hundreds(rest % 1000),
  ]
  return parts.filter(Boolean).join(' ')
}

// An amount in rupees, as a payslip writes it: 59124 -> "Rupees Fifty Nine Thousand One Hundred Twenty Four Only";
// 10.5 -> "Rupees Ten and Fifty Paise Only"; a negative amount starts with "Minus"
export function rupeesInWords(amount: number): string {
  const paise = Math.abs(toPaise(amount))
  const rupees = Math.floor(paise / 100)
  const rest = paise % 100
  const words = `Rupees ${inWords(rupees)}${rest ? ` and ${inWords(rest)} Paise` : ''} Only`
  return amount < 0 && paise > 0 ? `Minus ${words}` : words
}
