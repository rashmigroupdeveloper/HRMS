import { describe, expect, it } from 'vitest'
import { inWords, rupeesInWords } from './money.js'

// Amounts in words the Indian way, as the payslip writes net pay (payroll stage 6). Made-up amounts.
describe('amounts in words', () => {
  it('uses thousand, lakh and crore', () => {
    expect(inWords(0)).toBe('Zero')
    expect(inWords(7)).toBe('Seven')
    expect(inWords(19)).toBe('Nineteen')
    expect(inWords(40)).toBe('Forty')
    expect(inWords(101)).toBe('One Hundred One')
    expect(inWords(59124)).toBe('Fifty Nine Thousand One Hundred Twenty Four')
    expect(inWords(100000)).toBe('One Lakh')
    expect(inWords(1234567)).toBe('Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven')
    expect(inWords(250000000)).toBe('Twenty Five Crore')
    expect(inWords(1000000001)).toBe('One Hundred Crore One')
  })
  it('writes rupees and paise', () => {
    expect(rupeesInWords(59124)).toBe('Rupees Fifty Nine Thousand One Hundred Twenty Four Only')
    expect(rupeesInWords(10.5)).toBe('Rupees Ten and Fifty Paise Only')
    expect(rupeesInWords(0.07)).toBe('Rupees Zero and Seven Paise Only')
    expect(rupeesInWords(0)).toBe('Rupees Zero Only')
    expect(rupeesInWords(-12)).toBe('Minus Rupees Twelve Only')
  })
})
