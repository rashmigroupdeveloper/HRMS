/**
 * Client-side file downloads — one vocabulary for every report surface.
 *
 * `downloadCsv` builds the file from the EXACT rows the table renders, so
 * "export = view with applied filters" holds by construction (docs/06 rule).
 * Server-side XLSX endpoints replace individual call sites as they land
 * (R1 muster + R24 boarding already have them → `downloadBase64`).
 */

interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

function csvCell(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined) return '';
  const text = String(raw);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function triggerDownload(url: string, fileName: string): void {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadCsv<T>(fileName: string, columns: CsvColumn<T>[], rows: T[]): void {
  const lines = [
    columns.map((c) => csvCell(c.header)).join(','),
    ...rows.map((row) => columns.map((c) => csvCell(c.value(row))).join(',')),
  ];
  // BOM so Excel opens UTF-8 (INR names, Devanagari) correctly.
  const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
  triggerDownload(URL.createObjectURL(blob), fileName);
}

export function downloadBase64(fileName: string, mime: string, base64: string): void {
  const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
  triggerDownload(URL.createObjectURL(new Blob([bytes], { type: mime })), fileName);
}
