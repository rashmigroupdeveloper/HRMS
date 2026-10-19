/**
 * SOW 5.2: designation and department names cannot carry `&`, quotes, or
 * similar characters. Payroll inputs strip them; they are not stored.
 */
const REJECTED = /[&"'`]/g;

export function cleanMasterLabel(raw: string): string {
  return raw.replace(REJECTED, ' ').replace(/\s+/g, ' ').trim();
}
