import { PDFDocument, type PDFFont, type PDFPage, rgb, StandardFonts } from 'pdf-lib'

// Writing onto the pages of an existing PDF - a paper form printed filled in: text, ticks, circles and strike-throughs
// at measured places. Knows nothing about which form it is.
// Positions are PDF points from the TOP-left corner of the template page (as a PDF viewer measures them); a text's `y`
// is its baseline. `page` is the page's index in the template.

export type PdfMark =
  // `width`: the room there is - the text shrinks to fit (down to 5.5 pt), then wraps onto up to `lines` lines
  | { kind: 'text'; page: number; x: number; y: number; text: string; size?: number; width?: number; lines?: number; bold?: boolean }
  // drawn around a printed choice ("Yes / No", "Male / Female")
  | { kind: 'circle'; page: number; x0: number; y0: number; x1: number; y1: number }
  // a tick centred on (x, y) - in a tick box
  | { kind: 'tick'; page: number; x: number; y: number; size?: number }
  // a line through a printed statement that does not apply
  | { kind: 'strike'; page: number; x0: number; x1: number; y: number }

const INK = rgb(0.04, 0.12, 0.45)
const MIN_SIZE = 5.5

// The built-in PDF fonts only know Western characters: accents are dropped and anything else becomes "?"
function printable(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/[^\x20-\x7e\xa0-\xff]/g, '?')
    .trim()
}

function wrap(font: PDFFont, text: string, size: number, width: number): string[] {
  const rows: string[] = []
  let row = ''
  for (const word of text.split(' ')) {
    const next = row ? `${row} ${word}` : word
    if (row && font.widthOfTextAtSize(next, size) > width) {
      rows.push(row)
      row = word
    } else row = next
  }
  if (row) rows.push(row)
  return rows
}

// The size and rows the text is written in: the given size if it fits, else smaller, else wrapped (the last row cut)
function fit(font: PDFFont, text: string, size: number, width: number | undefined, lines: number) {
  if (!width) return { size, rows: [text] }
  for (let s = size; s >= MIN_SIZE; s -= 0.5) {
    const rows = wrap(font, text, s, width)
    if (rows.length <= lines && rows.every((r) => font.widthOfTextAtSize(r, s) <= width)) return { size: s, rows }
  }
  // still too long at the smallest size: the last row is cut with "..."
  const all = wrap(font, text, MIN_SIZE, width)
  const rows = all.slice(0, lines)
  const lastIndex = rows.length - 1
  let last = rows[lastIndex] ?? ''
  if (all.length > lines || font.widthOfTextAtSize(last, MIN_SIZE) > width) {
    while (last.length > 1 && font.widthOfTextAtSize(`${last}...`, MIN_SIZE) > width) last = last.slice(0, -1)
    rows[lastIndex] = `${last}...`
  }
  return { size: MIN_SIZE, rows }
}

function draw(page: PDFPage, mark: PdfMark, fonts: { regular: PDFFont; bold: PDFFont }) {
  const top = (y: number) => page.getHeight() - y
  switch (mark.kind) {
    case 'text': {
      const text = printable(mark.text)
      if (!text) return
      const font = mark.bold ? fonts.bold : fonts.regular
      const { size, rows } = fit(font, text, mark.size ?? 9, mark.width, mark.lines ?? 1)
      rows.forEach((row, i) => page.drawText(row, { x: mark.x, y: top(mark.y + i * size * 1.15), size, font, color: INK }))
      return
    }
    case 'circle':
      page.drawEllipse({
        x: (mark.x0 + mark.x1) / 2,
        y: top((mark.y0 + mark.y1) / 2),
        xScale: (mark.x1 - mark.x0) / 2 + 2.5,
        yScale: (mark.y1 - mark.y0) / 2 + 1.5,
        borderColor: INK,
        borderWidth: 0.9,
      })
      return
    case 'tick': {
      const s = mark.size ?? 7
      const a = { x: mark.x - s / 2, y: top(mark.y) }
      const b = { x: mark.x - s / 7, y: top(mark.y + s / 2.4) }
      const c = { x: mark.x + s / 2, y: top(mark.y - s / 2) }
      page.drawLine({ start: a, end: b, thickness: 1.2, color: INK })
      page.drawLine({ start: b, end: c, thickness: 1.2, color: INK })
      return
    }
    case 'strike':
      page.drawLine({ start: { x: mark.x0, y: top(mark.y) }, end: { x: mark.x1, y: top(mark.y) }, thickness: 0.8, color: INK })
      return
  }
}

// Blank A4-letter pages added after the template's (e.g. a continuation sheet): the first is page EXTRA_PAGE, the next
// EXTRA_PAGE + 1...
export const EXTRA_PAGE = 1000

// A new PDF of the template's `pages` (in this order), then `extraPages` blank pages, with the marks written on them
export async function fillPdf(template: Uint8Array, pages: number[], marks: PdfMark[], extraPages = 0): Promise<Uint8Array> {
  const source = await PDFDocument.load(template)
  const out = await PDFDocument.create()
  const fonts = { regular: await out.embedFont(StandardFonts.Helvetica), bold: await out.embedFont(StandardFonts.HelveticaBold) }
  const copied = await out.copyPages(source, pages)
  const byTemplatePage = new Map<number, PDFPage>()
  copied.forEach((page, i) => {
    out.addPage(page)
    byTemplatePage.set(pages[i]!, page)
  })
  for (let i = 0; i < extraPages; i++) byTemplatePage.set(EXTRA_PAGE + i, out.addPage([612, 792]))
  for (const mark of marks) {
    const page = byTemplatePage.get(mark.page)
    if (page) draw(page, mark, fonts)
  }
  return out.save()
}
