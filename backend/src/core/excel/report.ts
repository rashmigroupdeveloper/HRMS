import { writeWorkbook, type ExcelColumn, type ExcelSheet } from './workbook.js'

export type ReportDetails = {
  title: string
  preparedBy: string
  coverage: string
  filters?: { label: string; value: string }[]
  exportedAt?: Date
}

// Reports keep row 1 as the real column headings. Import templates continue to use writeWorkbook without this option.
export function writeReport(sheets: ExcelSheet[], details: ReportDetails) {
  return writeWorkbook(sheets, details)
}

export async function reportFile(sheets: ExcelSheet[], details: ReportDetails, filename: string) {
  const bytes = await writeReport(sheets, details)
  return new File([new Uint8Array(bytes)], `${filename}.xlsx`, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

// Explicit columns only: callers curate what an authorized reader may export. No automatic object flattening.
export type ReportField<T> = Omit<ExcelColumn, 'key' | 'list'> & { value: (row: T) => string | number | Date | null | undefined }
export function reportSheet<T>(name: string, rows: T[], fields: ReportField<T>[]): ExcelSheet {
  return {
    name,
    columns: fields.map(({ value: _value, ...column }, index) => ({ ...column, key: `c${index}` })),
    rows: rows.map((row) => Object.fromEntries(fields.map((field, index) => [`c${index}`, field.value(row)]))),
  }
}
