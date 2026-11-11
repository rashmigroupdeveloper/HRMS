/**
 * Shared currency and number formatting utilities (NFR-09).
 */

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Format a rupee amount into Indian currency grouping: 123456.78 -> "₹1,23,456.78"
 */
export function formatINR(amount: number): string {
  if (!Number.isFinite(amount)) return '₹0.00';
  return inrFormatter.format(amount);
}

/**
 * Format an integer paise amount into Indian currency grouping: 12345678 -> "₹1,23,456.78"
 */
export function formatPaiseINR(amountPaise: number): string {
  return formatINR(amountPaise / 100);
}

