import { type Editor, Extension, mergeAttributes, Node } from '@tiptap/core'
import type { ExampleTable } from './labels'

// The letter editor's own parts (TipTap nodes), matching what the backend's letter writer knows
// (backend/src/core/pdf/letter-pdf.ts):
//   field     - a blank filled per candidate, shown as a tag, e.g. [Candidate name]
//   letterBlock - a whole-width part filled when the letter is written: the salary table, the stamp + signature
//                 (not "block": that name is the editor's group of all block nodes)
//   splitLine - one line with a left part and a right part (e.g. reference ... date)
//   pageBreak - the next part starts on a new page

// The text before " (" or ", e.g." - "Personal e-mail (its line is left out...)" -> "Personal e-mail"
export const shortLabel = (label: string) => label.split(/ \(|, e\.g\./)[0]!

export const Field = Node.create<{ labels: Record<string, string> }>({
  name: 'field',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addOptions() {
    return { labels: {} }
  },
  addAttributes() {
    return {
      name: { default: null, parseHTML: (el) => el.getAttribute('data-field'), renderHTML: () => ({}) },
    }
  },
  parseHTML() {
    return [{ tag: 'span[data-field]' }]
  },
  renderHTML({ node, HTMLAttributes }) {
    const name = String(node.attrs.name)
    return [
      'span',
      mergeAttributes(HTMLAttributes, { 'data-field': name, class: 'letter-field', title: this.options.labels[name] ?? name }),
      shortLabel(this.options.labels[name] ?? name),
    ]
  },
  renderText({ node }) {
    const name = String(node.attrs.name)
    return `[${shortLabel(this.options.labels[name] ?? name)}]`
  },
})

// options: the blocks' labels, and the example table of a table block (shown on the page - LetterBlockView)
export const Block = Node.create<{ labels: Record<string, string>; examples: Record<string, ExampleTable> }>({
  name: 'letterBlock',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addOptions() {
    return { labels: {}, examples: {} }
  },
  addAttributes() {
    return {
      name: { default: null, parseHTML: (el) => el.getAttribute('data-block'), renderHTML: () => ({}) },
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-block]' }]
  },
  renderHTML({ node, HTMLAttributes }) {
    const name = String(node.attrs.name)
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-block': name, class: 'letter-block' }),
      ['span', { class: 'letter-block-title' }, this.options.labels[name] ?? name],
      [
        'span',
        { class: 'letter-block-hint' },
        name === 'signature' ? "The company's stamp + signature image goes here" : 'Filled from the offer when the letter is written',
      ],
    ]
  },
})

export const SplitLine = Node.create({
  name: 'splitLine',
  group: 'block',
  content: 'paragraph paragraph',
  defining: true,
  parseHTML() {
    return [{ tag: 'div[data-split-line]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-split-line': '', class: 'letter-split' }), 0]
  },
})

export const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  selectable: true,
  parseHTML() {
    return [{ tag: 'div[data-page-break]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-page-break': '', class: 'letter-page-break' }), 'New page']
  },
})

// The font / size chosen while nothing is selected: the "pen" for typing. It stays when the cursor moves (a click
// somewhere else), so what is typed next - wherever - gets it; picking the default font and size 10 drops it.
// (Text that is selected when a font / size is picked just gets that font / size - it does not change the pen.)
export type TextStyleAttrs = { fontFamily?: string | null; fontSize?: string | null }

export const TypingStyle = Extension.create<object, { style: TextStyleAttrs | null }>({
  name: 'typingStyle',
  addStorage() {
    return { style: null }
  },
  onSelectionUpdate() {
    const style = this.storage.style
    if (!style || !this.editor.state.selection.empty) return
    // after this selection change is done: put the pen at the new cursor
    queueMicrotask(() => {
      if (this.editor.state.selection.empty) this.editor.chain().setMark('textStyle', style).removeEmptyTextStyle().run()
    })
  },
})

// Applies a font / size: to the selected text, or - with nothing selected - as the pen for typing.
// `focus`: back to the letter afterwards (not when the box was left by a click into the letter - the click places it).
export function applyTextStyle(editor: Editor, attrs: TextStyleAttrs, focus: boolean) {
  if (editor.state.selection.empty) {
    const storage = (editor.storage as unknown as Record<string, { style: TextStyleAttrs | null }>).typingStyle!
    const pen = { ...storage.style, ...attrs }
    storage.style = pen.fontFamily || pen.fontSize ? pen : null
  }
  const chain = focus ? editor.chain().focus() : editor.chain()
  chain.setMark('textStyle', attrs).removeEmptyTextStyle().run()
}
