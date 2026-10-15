/**
 * Indian Rupee Number to Words converter (docs/04 §6.6, PAY-06).
 * Formats rupee & paise amounts according to Indian numbering system:
 * Crores (1,00,00,000), Lakhs (1,00,000), Thousands (1,000), Hundreds (100).
 */

const ONES: readonly string[] = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];

const TENS: readonly string[] = [
  '',
  '',
  'Twenty',
  'Thirty',
  'Forty',
  'Fifty',
  'Sixty',
  'Seventy',
  'Eighty',
  'Ninety',
];

function twoDigitsToWords(n: number): string {
  if (n < 20) {
    return ONES[n] ?? '';
  }
  const ten = Math.floor(n / 10);
  const one = n % 10;
  return one > 0 ? `${TENS[ten]}-${ONES[one]}` : (TENS[ten] ?? '');
}

function threeDigitsToWords(n: number): string {
  const hundred = Math.floor(n / 100);
  const rem = n % 100;
  const parts: string[] = [];

  if (hundred > 0) {
    parts.push(`${ONES[hundred]} Hundred`);
  }
  if (rem > 0) {
    parts.push(twoDigitsToWords(rem));
  }

  return parts.join(' ');
}

/**
 * Convert integer rupee amount to Indian words.
 */
function rupeeAmountToWords(rupees: number): string {
  if (rupees === 0) {
    return 'Zero Rupees';
  }

  let absVal = Math.abs(Math.floor(rupees));
  const parts: string[] = [];

  if (absVal >= 10000000) {
    const crores = Math.floor(absVal / 10000000);
    parts.push(`${twoDigitsToWords(crores)} Crore`);
    absVal %= 10000000;
  }

  if (absVal >= 100000) {
    const lakhs = Math.floor(absVal / 100000);
    parts.push(`${twoDigitsToWords(lakhs)} Lakh`);
    absVal %= 100000;
  }

  if (absVal >= 1000) {
    const thousands = Math.floor(absVal / 1000);
    parts.push(`${twoDigitsToWords(thousands)} Thousand`);
    absVal %= 1000;
  }

  if (absVal > 0) {
    parts.push(threeDigitsToWords(absVal));
  }

  const prefix = rupees < 0 ? 'Minus ' : '';
  return `${prefix}${parts.join(' ').trim()} Rupees`;
}

/**
 * Full Indian currency string with optional paise:
 * e.g. 57999 -> "Rupees Fifty-Seven Thousand Nine Hundred Ninety-Nine Only"
 * e.g. 1076.92 -> "Rupees One Thousand Seventy-Six and Ninety-Two Paise Only"
 */
export function formatCurrencyInWords(rupeeAmount: number): string {
  if (rupeeAmount === 0) {
    return 'Rupees Zero Only';
  }

  const isNeg = rupeeAmount < 0;
  const abs = Math.abs(rupeeAmount);
  const intRupees = Math.floor(abs);
  const paise = Math.round((abs - intRupees) * 100);

  const rupeeWords = rupeeAmountToWords(intRupees).replace(/ Rupees$/, '');
  let result = `Rupees ${rupeeWords}`;

  if (paise > 0) {
    result += ` and ${twoDigitsToWords(paise)} Paise`;
  }

  result += ' Only';

  return isNeg ? `Minus ${result}` : result;
}
