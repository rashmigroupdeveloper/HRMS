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
