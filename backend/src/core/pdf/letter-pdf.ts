import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import pdfmake from 'pdfmake'
import type { Content } from 'pdfmake'

// Writes a letter as an A4 PDF (pdfmake) from a rich-text document - the JSON the letter editor (TipTap) produces.
// Knows nothing about HR: the caller replaces the `field` nodes with the words and gives the `letterBlock` contents.
//
// Document nodes (TipTap JSON shape: { type, attrs?, content?, text?, marks? }):
//   doc, paragraph (attrs.textAlign left / center / right / justify - default justify), text (marks bold / italic /
//   underline, and textStyle with attrs.fontFamily - a key of LETTER_FONTS - and attrs.fontSize - one of
//   letterFontSize, e.g. "10.7pt"; without them: Roboto 10 pt), hardBreak, orderedList / bulletList / listItem (a list inside an item is a sub-list: 4.1, 4.2),
//   splitLine (two paragraphs on one line - left and right, e.g. reference and date), pageBreak,
//   field (attrs.name - a blank filled per letter), letterBlock (attrs.name - a table or image given by the caller;
//   not called "block" - that is the editor's name for the group of all block nodes).
// Older templates were plain text with a small markup; markupToDocument turns them into a document.

type DocumentDefinition = Parameters<typeof pdfmake.createPdf>[0]

// Fonts a letter can use besides the default Roboto: the open fonts of the WordCraft word processor (all SIL OFL,
// from the @fontsource packages - the same files the editor shows; decided 2026-11-12). Key = the font name as the
// editor stores it (a CSS font-family; names with a digit or a space are quoted), value = the @fontsource package.
// Only the Latin letters are included - ₹ prints only in the default Roboto. Keep in step with the editor
// (frontend pages/letter-templates/components/letter-fonts.ts).
export const LETTER_FONTS = {
  Carlito: 'carlito',
  Caladea: 'caladea',
  Arimo: 'arimo',
  Tinos: 'tinos',
  Cousine: 'cousine',
  Inter: 'inter',
  '"Source Sans 3"': 'source-sans-3',
  '"Source Serif 4"': 'source-serif-4',
  '"JetBrains Mono"': 'jetbrains-mono',
} as const
// A font size as the editor stores it: points with at most one decimal, from 1 to 400 ("10pt", "10.7pt")
export function letterFontSize(value: string): number | undefined {
  const match = /^(\d{1,3}(?:\.\d)?)pt$/.exec(value)
  const size = match ? Number(match[1]) : NaN
  return size >= 1 && size <= 400 ? size : undefined
}

export type LetterMark = {
  type: 'bold' | 'italic' | 'underline' | 'textStyle'
  attrs?: { fontFamily?: string | null | undefined; fontSize?: string | null | undefined } | null | undefined
}
export type LetterNode = {
  type: string
  attrs?: Record<string, unknown> | null | undefined
  content?: LetterNode[] | undefined
  text?: string | undefined
  marks?: LetterMark[] | undefined
}

export type PdfCell = { text: string; bold?: boolean; align?: 'left' | 'center' | 'right'; colSpan?: number; shaded?: boolean }

export type PdfTable = { kind: 'table'; widths: (number | '*')[]; rows: PdfCell[][] }
export type PdfBlock =
  | PdfTable
  // PNG or JPEG; width in points (1/72 inch)
  | { kind: 'image'; data: Uint8Array; width: number }
  // a grey stand-in (e.g. in a preview where the image is not uploaded yet)
  | { kind: 'note'; text: string }

export type LetterPdfInput = {
  // the document with every field already replaced by text
  doc: LetterNode
  blocks?: Record<string, PdfBlock>
  // Letterhead: drawn at the top / bottom of every page (PNG or JPEG)
  header?: Uint8Array | undefined
  footer?: Uint8Array | undefined
  // Document title (PDF properties)
  title: string
}

// Roboto ships with pdfmake (it has the ₹ sign); the other fonts are the @fontsource files (regular, bold, italic,
// bold italic). Only these font folders can be read - nothing else is loaded from anywhere.
const require = createRequire(import.meta.url)
const FONT_DIR = join(dirname(require.resolve('pdfmake/package.json')), 'fonts', 'Roboto')
const fontsourceDir = (pkg: string) => join(dirname(require.resolve(`@fontsource/${pkg}/package.json`)), 'files')
const fontsourceFiles = (pkg: string) => {
  const file = (variant: string) => join(fontsourceDir(pkg), `${pkg}-latin-${variant}.woff`)
  return { normal: file('400-normal'), bold: file('700-normal'), italics: file('400-italic'), bolditalics: file('700-italic') }
}
const FONT_DIRS = [FONT_DIR, ...Object.values(LETTER_FONTS).map(fontsourceDir)]
pdfmake.setUrlAccessPolicy(() => false)
pdfmake.setLocalAccessPolicy((path) => FONT_DIRS.some((dir) => path.startsWith(dir)))
pdfmake.setFonts({
  Roboto: {
    normal: join(FONT_DIR, 'Roboto-Regular.ttf'),
    bold: join(FONT_DIR, 'Roboto-Medium.ttf'),
    italics: join(FONT_DIR, 'Roboto-Italic.ttf'),
    bolditalics: join(FONT_DIR, 'Roboto-MediumItalic.ttf'),
  },
  // pdfmake knows each font by its package name
  ...Object.fromEntries(Object.values(LETTER_FONTS).map((pkg) => [pkg, fontsourceFiles(pkg)])),
})
const FONTS: Record<string, string> = LETTER_FONTS

// A4 in points; the text area is 495 wide
const SIDE_MARGIN = 50
const CONTENT_WIDTH = 595.28 - 2 * SIDE_MARGIN
const HEADER_HEIGHT = 78
const FOOTER_HEIGHT = 34
const ALIGN = new Set(['left', 'center', 'right', 'justify'])

function dataUrl(bytes: Uint8Array): string {
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50
  return `data:${isPng ? 'image/png' : 'image/jpeg'};base64,${Buffer.from(bytes).toString('base64')}`
}

// Text runs of a paragraph: bold / italic / underline, font and size; a hard break is a new line
function runs(nodes: LetterNode[] = []) {
  return nodes.map((node) => {
    if (node.type === 'hardBreak') return { text: '\n' }
    if (node.type !== 'text') throw new Error(`Unexpected ${node.type} inside a paragraph`)
    const marks = new Set((node.marks ?? []).map((m) => m.type))
    const style = node.marks?.find((m) => m.type === 'textStyle')?.attrs
    const font = style?.fontFamily ? FONTS[style.fontFamily] : undefined
    const size = style?.fontSize ? letterFontSize(style.fontSize) : undefined
    return {
      text: node.text ?? '',
      ...(marks.has('bold') && { bold: true }),
      ...(marks.has('italic') && { italics: true }),
      ...(marks.has('underline') && { decoration: 'underline' as const }),
      ...(font && { font }),
      ...(size && { fontSize: size }),
    }
  })
}

function paragraph(node: LetterNode, defaultAlign = 'justify'): Content {
  const align = typeof node.attrs?.textAlign === 'string' && ALIGN.has(node.attrs.textAlign) ? node.attrs.textAlign : defaultAlign
  const text = runs(node.content)
  // an empty paragraph is an empty line
  return { text: text.length ? text : ' ', alignment: align as 'left', margin: [0, 0, 0, 8] }
}

// A table is kept on one page: if it does not fit below the text, it starts on the next page (only a table taller
// than a page is split). The letter editor shows it the same way.
function tableContent(block: PdfTable): Content {
  return {
    margin: [0, 4, 0, 10],
    unbreakable: true,
    table: {
      widths: block.widths,
      body: block.rows.map((row) =>
        row.flatMap((cell) => {
          const content = {
            text: cell.text,
            bold: cell.bold ?? false,
            alignment: cell.align ?? 'left',
            ...(cell.colSpan && { colSpan: cell.colSpan }),
            ...(cell.shaded && { fillColor: '#e6e6e6' }),
          }
          // pdfmake wants an empty cell for every column a cell spans
          return [content, ...Array.from({ length: (cell.colSpan ?? 1) - 1 }, () => ({ text: '' }))]
        }),
      ),
    },
    layout: { hLineColor: () => '#555555', vLineColor: () => '#555555', paddingTop: () => 4, paddingBottom: () => 4 },
  }
}

function blockContent(name: string, blocks: Record<string, PdfBlock>): Content {
  const block = blocks[name]
  if (!block) throw new Error(`The letter uses the block "${name}", which has no content`)
  if (block.kind === 'table') return tableContent(block)
  if (block.kind === 'note') return { text: block.text, italics: true, color: '#888888', margin: [0, 12, 0, 12] }
  return { image: dataUrl(block.data), width: block.width, margin: [0, 4, 0, 4] }
}

// A numbered list: "1." at the top level, "4.1" for a sub-list inside item 4; a bullet list uses "•"
function list(node: LetterNode, blocks: Record<string, PdfBlock>, prefix: string): Content {
  const ordered = node.type === 'orderedList'
  const start = typeof node.attrs?.start === 'number' ? node.attrs.start : 1
  const depth = prefix ? prefix.split('.').length : 0
  return {
    stack: (node.content ?? []).map((item, i) => {
      const number = prefix ? `${prefix}.${start + i}` : String(start + i)
      const label = ordered ? (prefix ? number : `${number}.`) : '•'
      return {
        columns: [
          { width: 16 + depth * 10, text: label },
          { width: '*', stack: (item.content ?? []).map((child) => nodeContent(child, blocks, number)) },
        ],
        columnGap: 6,
        margin: [depth ? 6 : 0, 0, 0, 0],
      } as Content
    }),
  }
}

// One block-level node; `listNumber` is the number of the list item it is in (for sub-lists)
function nodeContent(node: LetterNode, blocks: Record<string, PdfBlock>, listNumber = ''): Content {
  switch (node.type) {
    case 'paragraph':
      return paragraph(node)
    case 'orderedList':
    case 'bulletList':
      return list(node, blocks, listNumber)
    case 'splitLine': {
      const [left, right] = node.content ?? []
      return {
        columns: [
          { width: '*', text: runs(left?.content) },
          { width: '*', text: runs(right?.content), alignment: 'right' },
        ],
        margin: [0, 0, 0, 8],
      }
    }
    case 'letterBlock':
      return blockContent(String(node.attrs?.name ?? ''), blocks)
    default:
      throw new Error(`Unexpected ${node.type} in a letter`)
  }
}

// The PDF bytes
export async function renderLetterPdf({ doc, blocks = {}, header, footer, title }: LetterPdfInput): Promise<Buffer> {
  const content: Content[] = []
  let newPage = false
  for (const node of doc.content ?? []) {
    if (node.type === 'pageBreak') {
      newPage = true
      continue
    }
    const item = nodeContent(node, blocks)
    content.push(newPage ? ({ stack: [item], pageBreak: 'before' } as Content) : item)
    newPage = false
  }

  const definition: DocumentDefinition = {
    info: { title },
    pageSize: 'A4',
    pageMargins: [SIDE_MARGIN, header ? HEADER_HEIGHT + 40 : 50, SIDE_MARGIN, footer ? FOOTER_HEIGHT + 36 : 50],
    defaultStyle: { font: 'Roboto', fontSize: 10, lineHeight: 1.25 },
    header: (currentPage: number) => ({
      margin: [SIDE_MARGIN, 18, SIDE_MARGIN, 0],
      stack: [
        ...(header ? [{ image: dataUrl(header), fit: [CONTENT_WIDTH, HEADER_HEIGHT] as [number, number], alignment: 'center' as const }] : []),
        // ":: 2 ::" on every page after the first, as on the printed letters
        ...(currentPage > 1 ? [{ text: `:: ${currentPage} ::`, alignment: 'center' as const, fontSize: 9, margin: [0, 4, 0, 0] as [number, number, number, number] }] : []),
      ],
    }),
    ...(footer && {
      footer: () => ({
        margin: [SIDE_MARGIN, 0, SIDE_MARGIN, 14],
        stack: [{ image: dataUrl(footer), fit: [CONTENT_WIDTH, FOOTER_HEIGHT] as [number, number], alignment: 'center' as const }],
      }),
    }),
    content,
  }
  return pdfmake.createPdf(definition).getBuffer()
}

// ---- Older templates: plain text with a small markup -> document -------------------------------------------------
//   Paragraphs are separated by an empty line; a single line break stays a line break. **text** is bold.
//   "1." / "4.1" at the start of a paragraph is a numbered point / sub-point. "left >> right" is a split line.
//   "# Heading" is a centred bold paragraph. "---" alone starts a new page. {{name}} / {{name?}} is a field; a line
//   with only {{name}} is a block.

const PLACEHOLDER = /\{\{\s*([a-z0-9_]+)\??\s*\}\}/g
const BLOCK_LINE = /^\{\{\s*([a-z0-9_]+)\s*\}\}$/
const NUMBERED = /^(\d+(?:\.\d+)*)\.?\s+([\s\S]*)$/

// "**Dear {{name}},**" -> text and field nodes with their marks; line breaks -> hardBreak
function inlineNodes(text: string, extraMarks: LetterMark[] = []): LetterNode[] {
  const nodes: LetterNode[] = []
  text.split('\n').forEach((line, lineIndex) => {
    if (lineIndex > 0) nodes.push({ type: 'hardBreak' })
    line.split('**').forEach((part, i) => {
      const marks = [...extraMarks, ...(i % 2 === 1 ? [{ type: 'bold' as const }] : [])]
      let last = 0
      for (const match of part.matchAll(PLACEHOLDER)) {
        if (match.index > last) nodes.push({ type: 'text', text: part.slice(last, match.index), ...(marks.length && { marks }) })
        nodes.push({ type: 'field', attrs: { name: match[1] }, ...(marks.length && { marks }) })
        last = match.index + match[0].length
      }
      if (last < part.length) nodes.push({ type: 'text', text: part.slice(last), ...(marks.length && { marks }) })
    })
  })
  return nodes
}

export function markupToDocument(markup: string): LetterNode {
  const content: LetterNode[] = []
  // the top-level numbered list being built, and its last item (sub-points go into it)
  let list: LetterNode | null = null
  for (const raw of markup.replace(/\r\n/g, '\n').split(/\n\s*\n/)) {
    const text = raw.trim()
    if (text === '') continue
    const numbered = NUMBERED.exec(text)
    if (numbered) {
      const [, number = '', rest = ''] = numbered
      const item: LetterNode = { type: 'listItem', content: [{ type: 'paragraph', attrs: { textAlign: 'justify' }, content: inlineNodes(rest) }] }
      if (!number.includes('.') || !list) {
        if (!list) {
          list = { type: 'orderedList', attrs: { start: Number(number.split('.')[0]) || 1 }, content: [] }
          content.push(list)
        }
        list.content!.push(item)
      } else {
        // a sub-point goes into a list inside the last top-level item
        const parent = list.content!.at(-1)!
        let sub = parent.content!.find((n) => n.type === 'orderedList')
        if (!sub) {
          sub = { type: 'orderedList', attrs: { start: Number(number.split('.').at(-1)) || 1 }, content: [] }
          parent.content!.push(sub)
        }
        sub.content!.push(item)
      }
      continue
    }
    list = null
    const block = BLOCK_LINE.exec(text)
    if (text === '---') content.push({ type: 'pageBreak' })
    else if (block) content.push({ type: 'letterBlock', attrs: { name: block[1] } })
    else if (text.startsWith('# ')) {
      content.push({ type: 'paragraph', attrs: { textAlign: 'center' }, content: inlineNodes(text.slice(2).trim(), [{ type: 'bold' }]) })
    } else if (!text.includes('\n') && text.includes(' >> ')) {
      const [left = '', right = ''] = text.split(' >> ')
      content.push({
        type: 'splitLine',
        content: [
          { type: 'paragraph', attrs: { textAlign: 'left' }, content: inlineNodes(left) },
          { type: 'paragraph', attrs: { textAlign: 'right' }, content: inlineNodes(right) },
        ],
      })
    } else content.push({ type: 'paragraph', attrs: { textAlign: 'justify' }, content: inlineNodes(text) })
  }
  return { type: 'doc', content }
}
