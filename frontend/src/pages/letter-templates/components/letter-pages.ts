import { Extension } from '@tiptap/core'
import type { Node as PmNode } from '@tiptap/pm/model'
import { type EditorState, Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view'

// Pages on the editor's paper, as in the PDF: the letter is cut into A4 pages where the backend's PDF writer (pdfmake,
// backend/src/core/pdf/letter-pdf.ts) would cut it - a paragraph line by line, the stamp / salary table / left | right
// line as a whole, and at every "New page".
//
// How: the letter is one editable text. After each change it is measured as it would flow without pages; wherever a
// line would run past the end of a page's text area, an invisible spacer (a widget) pushes it to the top of the next
// page's text area. LetterEditor draws the sheets (with the letterhead) behind the text, at fixed places.
// The text is measured like pdfmake measures it: the same fonts and widths, a line as high as its tallest piece of
// text (font height × 1.25 - see .letter-doc in index.css), 8 pt after each paragraph.

// A4 and the PDF's margins, in points - keep in step with letter-pdf.ts (SIDE_MARGIN, HEADER_HEIGHT + 40, FOOTER_HEIGHT + 36)
export const PAGE = { width: 595.28, height: 841.89, side: 50 }
export const pageTop = (header: boolean) => (header ? 118 : 50)
export const pageBottom = (footer: boolean) => (footer ? 70 : 50)
// CSS pixels per point, and the grey space between two sheets on screen
export const PX = 96 / 72
export const SHEET_GAP = 28
export const SHEET_PITCH = PAGE.height * PX + SHEET_GAP

type PageBreak = {
  pos: number
  // spacer height in px: from where the line would be to the top of the next page's text area
  height: number
  // inside a paragraph (an inline spacer before a line) or before a whole block
  inline: boolean
}
type PagesState = { breaks: PageBreak[]; pages: number; header: boolean; footer: boolean; runs: DecorationSet }
type PagesMeta = Partial<Pick<PagesState, 'breaks' | 'pages' | 'header' | 'footer'>>

export const letterPagesKey = new PluginKey<PagesState>('letterPages')
export const pageCount = (state: EditorState) => letterPagesKey.getState(state)?.pages ?? 1
// Tell the editor whether the letter has a header / footer image (they change the text area of every page). Not a
// step to undo - nor is what other parts add in reply (the empty line StarterKit keeps after a final block).
export const setLetterhead = (view: EditorView, letterhead: { header: boolean; footer: boolean }) =>
  view.dispatch(view.state.tr.setMeta(letterPagesKey, letterhead satisfies PagesMeta).setMeta('addToHistory', false))

// Every piece of text in a span (class letter-run): its line height is set there, from its own font (index.css)
function textRuns(doc: PmNode) {
  const decorations: Decoration[] = []
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true
    if (node.content.size) decorations.push(Decoration.inline(pos + 1, pos + node.nodeSize - 1, { class: 'letter-run' }))
    return false
  })
  return DecorationSet.create(doc, decorations)
}

export const LetterPages = Extension.create({
  name: 'letterPages',
  addProseMirrorPlugins() {
    return [
      new Plugin<PagesState>({
        key: letterPagesKey,
        state: {
          init: (_, state) => ({ breaks: [], pages: 1, header: false, footer: false, runs: textRuns(state.doc) }),
          apply: (tr, value) => {
            const meta = tr.getMeta(letterPagesKey) as PagesMeta | undefined
            let next = value
            if (tr.docChanged) {
              // until it is measured again, the spacers move with the text
              next = { ...next, runs: textRuns(tr.doc), breaks: next.breaks.map((b) => ({ ...b, pos: tr.mapping.map(b.pos, -1) })) }
            }
            return meta ? { ...next, ...meta } : next
          },
        },
        props: {
          decorations: (state) => {
            const { breaks, runs } = letterPagesKey.getState(state)!
            if (!breaks.length) return runs
            return runs.add(
              state.doc,
              breaks.map((b) =>
                Decoration.widget(b.pos, () => spacer(b), {
                  side: -1,
                  ignoreSelection: true,
                  key: `page-${b.inline ? 'i' : 'b'}-${b.height.toFixed(2)}`,
                }),
              ),
            )
          },
        },
        view: (view) => {
          let frame = 0
          const schedule = () => {
            cancelAnimationFrame(frame)
            frame = requestAnimationFrame(() => {
              if (!view.isDestroyed) measure(view)
            })
          }
          // re-measure when the text's size changes (a font or the stamp image loaded, a view drawn late) or fonts load
          const resize = new ResizeObserver(schedule)
          resize.observe(view.dom)
          document.fonts.addEventListener('loadingdone', schedule)
          schedule()
          return {
            update: (view, previous) => {
              const now = letterPagesKey.getState(view.state)!
              const before = letterPagesKey.getState(previous)!
              if (view.state.doc !== previous.doc || now.header !== before.header || now.footer !== before.footer) schedule()
            },
            destroy: () => {
              cancelAnimationFrame(frame)
              resize.disconnect()
              document.fonts.removeEventListener('loadingdone', schedule)
            },
          }
        },
      }),
    ]
  },
})

function spacer({ height, inline }: PageBreak) {
  const el = document.createElement(inline ? 'span' : 'div')
  el.className = inline ? 'letter-page-spacer letter-page-spacer-inline' : 'letter-page-spacer'
  el.style.height = `${height}px`
  el.contentEditable = 'false'
  return el
}

// Where the lines of a paragraph are (px from the top of the text, as if there were no pages) and the document
// position each line starts at
type Line = { top: number; bottom: number; pos: number }
function paragraphLines(view: EditorView, el: HTMLElement, pos: number, origin: number): Line[] {
  const box = el.getBoundingClientRect()
  const top = box.top - origin
  const bottom = box.bottom - origin
  // the text of the paragraph (not inside a spacer), with the rectangles of its pieces on each line
  const pieces: { node: Text; rects: DOMRect[] }[] = []
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    if (!node.data.length) continue
    const range = document.createRange()
    range.selectNodeContents(node)
    const rects = [...range.getClientRects()].filter((r) => r.height > 0)
    if (rects.length) pieces.push({ node, rects })
  }
  // group the rectangles into lines (rectangles of one line overlap in height; lines never do)
  const lines: { top: number; bottom: number }[] = []
  for (const r of pieces.flatMap((p) => p.rects).sort((a, b) => a.top - b.top)) {
    const last = lines.at(-1)
    if (last && r.top < last.bottom - 1) last.bottom = Math.max(last.bottom, r.bottom)
    else lines.push({ top: r.top, bottom: r.bottom })
  }
  if (lines.length <= 1) return [{ top, bottom, pos: pos + 1 }]
  // Where each line starts: the text sits at the same depth in every line (of the same font and size) - the first
  // line's depth below the paragraph's top. (Not halfway between two lines' text: the browser's text box is not
  // centred in the line.)
  const depth = lines[0]!.top - box.top
  const edges = lines.slice(1).map((line) => line.top - depth)
  const result: Line[] = [{ top, bottom: edges[0]! - origin, pos: pos + 1 }]
  edges.forEach((edge, i) => {
    const start = lineStart(view, pieces, edge)
    if (start === null) return
    result.push({ top: edge - origin, bottom: (edges[i + 1] ?? box.bottom) - origin, pos: start })
  })
  return result
}

// The document position of the first character below `edge` (a screen y between two lines)
function lineStart(view: EditorView, pieces: { node: Text; rects: DOMRect[] }[], edge: number): number | null {
  const below = (r: DOMRect) => (r.top + r.bottom) / 2 > edge
  const piece = pieces.find((p) => p.rects.some(below))
  if (!piece) return null
  // a field tag (one piece of the document): the line starts before it
  const field = piece.node.parentElement?.closest<HTMLElement>('[data-field]')
  if (field?.parentNode) return view.posAtDOM(field.parentNode, Array.prototype.indexOf.call(field.parentNode.childNodes, field))
  // the first character of this text that is on the new line
  const { node } = piece
  const range = document.createRange()
  let low = 0
  let high = node.data.length - 1
  while (low < high) {
    const mid = (low + high) >> 1
    range.setStart(node, mid)
    range.setEnd(node, mid + 1)
    if (below(range.getBoundingClientRect())) high = mid
    else low = mid + 1
  }
  return view.posAtDOM(node, low)
}

// Measure the letter without pages and work out the page breaks; store them when they changed
function measure(view: EditorView) {
  const state = letterPagesKey.getState(view.state)!
  const height = (PAGE.height - pageTop(state.header) - pageBottom(state.footer)) * PX
  const spacers = view.dom.querySelectorAll<HTMLElement>('.letter-page-spacer')
  spacers.forEach((s) => (s.style.display = 'none'))
  const breaks: PageBreak[] = []
  let page = 0
  // total height of the spacers so far: a natural y + offset = where it is with pages
  let offset = 0
  // The browser rounds every margin to its pixel grid (8 pt = 10.667 px becomes 10.656 px), so over a page the text
  // comes out a little shorter than in the PDF - enough to keep a line the PDF moves on. The space between two parts
  // is always whole points (8 pt after a paragraph, 4 / 10 / 12 pt around a block), so it is counted exactly: fix is
  // what the rounding lost since the last page break.
  let fix = 0
  let previousBottom = 0
  let end = 0
  try {
    const origin = view.dom.getBoundingClientRect().top
    const doc = view.state.doc
    const pageStart = () => page * SHEET_PITCH
    const pageEnd = () => pageStart() + height
    // a new page from `y` (where the line is in the browser): the spacer takes it to the next page's text area
    const breakAt = (pos: number, y: number, inline: boolean) => {
      const spacerHeight = (page + 1) * SHEET_PITCH - (y + offset)
      breaks.push({ pos, height: spacerHeight, inline })
      offset += spacerHeight
      fix = 0
      page++
    }
    // where a y in the browser is in the PDF's layout, with pages
    const at = (y: number) => y + fix + offset
    const dom = (pos: number) => view.nodeDOM(pos) as HTMLElement | null

    doc.descendants((node, pos, parent) => {
      const el = dom(pos)
      if (!el || !(el instanceof HTMLElement)) return false
      const box = el.getBoundingClientRect()
      const top = box.top - origin
      const bottom = box.bottom - origin
      if (node.type.name === 'pageBreak' || node.isTextblock || node.isAtom || node.type.name === 'splitLine') {
        const gap = top - previousBottom
        fix += Math.round(gap / PX) * PX - gap
        previousBottom = bottom
      }
      if (node.type.name === 'pageBreak') {
        // the rest of the page stays empty (unless nothing follows)
        if (pos + node.nodeSize < doc.content.size) breakAt(pos + node.nodeSize, top, false)
        return false
      }
      if (node.isTextblock && parent?.type.name !== 'splitLine') {
        if (at(bottom) > pageEnd()) {
          for (const line of paragraphLines(view, el, pos, origin)) {
            if (at(line.bottom) > pageEnd() && at(line.top) > pageStart() + 1) breakAt(line.pos, line.top, true)
          }
        }
        end = Math.max(end, at(bottom))
        return false
      }
      if (node.isBlock && (node.isAtom || node.type.name === 'splitLine')) {
        // the stamp, the salary table, a left | right line: moved whole
        if (at(bottom) > pageEnd() && at(top) > pageStart() + 1) breakAt(pos, top, false)
        end = Math.max(end, at(bottom))
        return false
      }
      return true
    })
  } finally {
    spacers.forEach((s) => (s.style.display = ''))
  }

  // (something taller than a page - e.g. a very tall stamp image - runs on into the next sheet)
  const pages = Math.max(page + 1, Math.floor(end / SHEET_PITCH) + 1)
  const same =
    pages === state.pages &&
    breaks.length === state.breaks.length &&
    breaks.every((b, i) => {
      const old = state.breaks[i]!
      return old.pos === b.pos && old.inline === b.inline && Math.abs(old.height - b.height) < 0.5
    })
  if (!same) view.dispatch(view.state.tr.setMeta(letterPagesKey, { breaks, pages } satisfies PagesMeta).setMeta('addToHistory', false))
}
