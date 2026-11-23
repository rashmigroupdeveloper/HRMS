import ExcelJS from 'exceljs'

// Excel files (.xlsx): writing a sheet (exports, import templates) and reading one back (imports). Knows nothing
// about HR - callers give the columns and rows.

export type ExcelColumn = {
  header: string
  // the row property this column shows
  key: string
  width?: number
  // a calendar date column (shown as dd-mm-yyyy)
  date?: boolean
  // a moment (date and time) column, shown in the server's local time as dd-mm-yyyy hh:mm
  dateTime?: boolean
  // a text column (codes, phone numbers): what is typed stays as typed - Excel keeps the leading zeros of 007
  text?: boolean
  // the allowed values: a dropdown in every row of the sheet (the list is kept on a hidden "Lists" sheet)
  list?: string[]
  // a hint shown as a comment on the header cell
  note?: string
}
export type ExcelSheet = {
  name: string
  columns: ExcelColumn[]
  rows: Record<string, string | number | Date | null | undefined>[]
  // how many rows get the dropdowns (a template is filled in below the example rows); default: the rows given
  dropdownRows?: number
}

// One cell's value as read: text (trimmed), a number, a date (calendar dates as UTC midnight) or null when empty
export type CellValue = string | number | Date | null

const DATE_FORMAT = 'dd-mm-yyyy'

// The .xlsx file with these sheets (the first is the one that opens).
export async function writeWorkbook(sheets: ExcelSheet[]): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook()
  const lists = sheets.some((s) => s.columns.some((c) => c.list?.length)) ? workbook.addWorksheet('Lists', { state: 'hidden' }) : null
  let listColumns = 0
  for (const sheet of sheets) {
    const ws = workbook.addWorksheet(sheet.name, { views: [{ state: 'frozen', ySplit: 1 }] })
    ws.columns = sheet.columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? Math.max(12, c.header.length + 2) }))
    ws.getRow(1).font = { bold: true }
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3EFE4' } }
    // Excel has no time zones: a moment is written as the server's local wall-clock time
    const moments = sheet.columns.filter((c) => c.dateTime).map((c) => c.key)
    const local = (value: unknown) => (value instanceof Date ? new Date(value.getTime() - value.getTimezoneOffset() * 60_000) : value)
    for (const row of sheet.rows) ws.addRow(moments.length ? { ...row, ...Object.fromEntries(moments.map((k) => [k, local(row[k])])) } : row)
    const lastRow = Math.max(sheet.dropdownRows ?? 0, sheet.rows.length) + 1
    sheet.columns.forEach((column, index) => {
      const col = ws.getColumn(index + 1)
      if (column.date) col.numFmt = DATE_FORMAT
      if (column.dateTime) col.numFmt = `${DATE_FORMAT} hh:mm`
      if (column.text) col.numFmt = '@'
      if (column.note) ws.getCell(1, index + 1).note = column.note
      if (column.list?.length && lists) {
        // the list in its own column of the hidden sheet, referenced by every cell's dropdown
        const listColumn = ++listColumns
        const letter = columnLetter(listColumn)
        column.list.forEach((value, i) => (lists.getCell(i + 1, listColumn).value = value))
        const formula = `Lists!$${letter}$1:$${letter}$${column.list.length}`
        for (let r = 2; r <= lastRow; r++) {
          ws.getCell(r, index + 1).dataValidation = {
            type: 'list',
            allowBlank: true,
            formulae: [formula],
            showErrorMessage: true,
            errorTitle: column.header,
            error: 'Pick a value from the list',
          }
        }
      }
    })
  }
  return new Uint8Array(await workbook.xlsx.writeBuffer())
}

// The first sheet of an .xlsx file: its header row (trimmed) and every non-empty row below it, keyed by header.
// Throws an Error with a readable message when the file is not an Excel workbook.
export async function readFirstSheet(bytes: Uint8Array): Promise<{ headers: string[]; rows: { rowNumber: number; values: Record<string, CellValue> }[] }> {
  const workbook = new ExcelJS.Workbook()
  try {
    await workbook.xlsx.load(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer)
  } catch {
    throw new Error('The file is not an Excel workbook (.xlsx)')
  }
  const ws = workbook.worksheets.find((sheet) => sheet.state !== 'hidden')
  if (!ws) return { headers: [], rows: [] }
  const headers: string[] = []
  ws.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => (headers[col - 1] = String(cellValue(cell.value) ?? '').trim()))
  const rows: { rowNumber: number; values: Record<string, CellValue> }[] = []
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return
    const values: Record<string, CellValue> = {}
    let any = false
    headers.forEach((header, i) => {
      if (!header) return
      const cell = row.getCell(i + 1)
      const value = cellValue(cell.value, cell.numFmt)
      values[header] = value
      if (value !== null) any = true
    })
    if (any) rows.push({ rowNumber, values })
  })
  return { headers: headers.filter(Boolean), rows }
}

// A cell's value without Excel's wrappers: rich text, hyperlinks (e-mails often become links - their text can be rich text
// too), formula results; anything else Excel can hold reads as empty, never as "[object Object]" (2026-11-23, the review).
// `format`: the cell's number format - a whole number it shows with leading zeros is read as the text shown.
function cellValue(value: ExcelJS.CellValue, format?: string): CellValue {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return value
  if (typeof value === 'number') return shownAsText(value, format) ?? value
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  if (typeof value === 'string') return value.trim() || null
  if (typeof value === 'object') {
    if ('richText' in value && Array.isArray(value.richText)) return value.richText.map((part) => part.text).join('').trim() || null
    if ('text' in value) return cellValue(value.text as ExcelJS.CellValue, format)
    if ('result' in value) return cellValue(value.result as ExcelJS.CellValue, format)
  }
  return null
}

// A whole number whose format pads it with zeros or adds fixed text - e.g. 7 in a 000 cell shows as 007, in a "RML"000000
// cell as RML000007 - as the text shown: it is a code, and the zeros are part of it (2026-11-23, the review). Any other
// format (0, 0.00, dates, several sections): null - read as the number.
function shownAsText(value: number, format: string | undefined): string | null {
  if (!format || !Number.isInteger(value) || value < 0) return null
  const parts = format.match(/^((?:"[^"]*"|\\.)*)(0+)((?:"[^"]*"|\\.)*)$/)
  if (!parts) return null
  const [, before = '', zeros = '', after = ''] = parts
  if (zeros.length < 2 && !before && !after) return null
  const literal = (part: string) => part.replace(/"([^"]*)"|\\(.)/g, (_, quoted: string | undefined, char: string | undefined) => quoted ?? char ?? '')
  return `${literal(before)}${String(value).padStart(zeros.length, '0')}${literal(after)}`
}

// 1 -> A, 27 -> AA
function columnLetter(n: number): string {
  let s = ''
  for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s
  return s
}
