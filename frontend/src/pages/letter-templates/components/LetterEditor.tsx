import TextAlign from '@tiptap/extension-text-align'
import { FontFamily, FontSize, TextStyle } from '@tiptap/extension-text-style'
import { EditorContent, type JSONContent, ReactNodeViewRenderer, useEditor, useEditorState } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
  AlignCenter,
  ChevronDown,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Columns2,
  IndentDecrease,
  IndentIncrease,
  Italic,
  List,
  ListOrdered,
  Redo2,
  SeparatorHorizontal,
  Stamp,
  Table,
  Underline,
  Undo2,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { LetterBlockView } from './LetterBlockView'
import { SignatureImageContext } from './letter-images-context'
import { cn } from '@/lib/utils'
import type { LetterBlockInfo, Placeholder } from './labels'
import { DEFAULT_SIZE, LETTER_FONT_SIZES as SIZES, LETTER_FONTS as FONTS, parseFontSize } from './letter-fonts'
import { applyTextStyle, Block, Field, PageBreak, shortLabel, SplitLine, TypingStyle } from './letter-nodes'
import { LetterPages, PAGE, pageBottom, pageCount, pageTop, PX, setLetterhead, SHEET_GAP, SHEET_PITCH } from './letter-pages'

// The letter template editor: A4 pages with the letterhead, edited like a Word document. Candidate details are
// inserted as tags ([Candidate name]) from "Insert field"; the salary table and the stamp + signature are filled in when
// the letter is written. The document is TipTap JSON - the backend writes the PDF from it.
// The pages break where the PDF's pages break (letter-pages.ts); fonts and sizes: letter-fonts.ts (the fonts the PDF
// prints with). Lines with a field can wrap differently in a letter, as the field's text is longer or shorter.

type Props = {
  // the document to start with
  initial: JSONContent
  editable: boolean
  placeholders: Placeholder[]
  blocks: LetterBlockInfo[]
  onChange: (doc: JSONContent) => void
  // the document as the editor reads it (its own normal form) - the "nothing changed yet" state
  onReady: (doc: JSONContent) => void
  // whether the letter has a header / footer image - the PDF leaves room for them on every page
  letterhead: { header: boolean; footer: boolean }
  // the letterhead images (data: URLs) - null while loading or when there is none
  header?: string | null
  footer?: string | null
  // the stamp + signature image, shown in the letter's signature block
  signature?: string | null
  // a side panel beside the paper (starts level with the paper; the toolbar spans both)
  aside?: React.ReactNode
}

export function LetterEditor({
  initial,
  editable,
  placeholders,
  blocks,
  onChange,
  onReady,
  letterhead,
  header,
  footer,
  signature = null,
  aside,
}: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        link: false,
      }),
      TextAlign.configure({ types: ['paragraph'], alignments: ['left', 'center', 'right', 'justify'], defaultAlignment: 'justify' }),
      Field.configure({ labels: Object.fromEntries(placeholders.map((p) => [p.name, p.label])) }),
      // the blocks drawn by a React view: the signature block shows the uploaded stamp + signature
      Block.extend({ addNodeView: () => ReactNodeViewRenderer(LetterBlockView) }).configure({
        labels: Object.fromEntries(blocks.map((b) => [b.name, b.label])),
        examples: Object.fromEntries(blocks.flatMap((b) => (b.example ? [[b.name, b.example]] : []))),
      }),
      TextStyle,
      FontFamily,
      FontSize,
      SplitLine,
      PageBreak,
      TypingStyle,
      LetterPages,
    ],
    content: initial,
    editable,
    editorProps: { attributes: { class: 'letter-doc outline-none', 'aria-label': 'Letter text' } },
    onCreate: ({ editor }) => {
      // StarterKit keeps an empty line after a letter that ends with a block (to type below it), but only adds it on the
      // first transaction - e.g. the first click - which then looked like an unsaved change. Add it now, before the
      // page takes this as the saved version (and not as a step to undo).
      editor.view.dispatch(editor.state.tr.setMeta('addToHistory', false))
      onReady(editor.getJSON())
    },
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
  })

  // what the toolbar shows as switched on (re-read on every change of the selection)
  const active = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      font: String(e.getAttributes('textStyle').fontFamily ?? ''),
      size: String(e.getAttributes('textStyle').fontSize ?? ''),
      ordered: e.isActive('orderedList'),
      bullet: e.isActive('bulletList'),
      inList: e.isActive('listItem'),
      left: e.isActive({ textAlign: 'left' }),
      center: e.isActive({ textAlign: 'center' }),
      right: e.isActive({ textAlign: 'right' }),
      justify: e.isActive({ textAlign: 'justify' }),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  })

  const pages = useEditorState({ editor, selector: ({ editor: e }) => pageCount(e.state) })
  // the letterhead decides how much of each page the text has
  const { header: hasHeader, footer: hasFooter } = letterhead
  useEffect(() => setLetterhead(editor.view, { header: hasHeader, footer: hasFooter }), [editor, hasHeader, hasFooter])

  const chain = () => editor.chain().focus()

  return (
    <div className="space-y-3">
      {editable && (
        <div
          role="toolbar"
          aria-label="Formatting"
          className="sticky top-20 z-10 flex flex-wrap items-center gap-1 rounded-2xl border bg-card/95 p-1.5 shadow-card backdrop-blur-sm"
        >
          <NativeSelect
            aria-label="Font"
            title="Font"
            className="w-[10.5rem] [&_select]:h-8 [&_select]:rounded-lg [&_select]:text-sm"
            value={active.font}
            onChange={(e) => applyTextStyle(editor, { fontFamily: e.target.value || null }, true)}
          >
            {FONTS.map(([value, label]) => (
              <NativeSelectOption key={value} value={value}>
                {label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {/* remounted when the selection's size changes, so it always starts from the current size */}
          <SizeBox
            key={active.size}
            current={active.size ? active.size.replace(/pt$/, '') : DEFAULT_SIZE}
            // leaving the box by clicking into the letter (refocus false): the click places the cursor - focusing the
            // editor would put it back on the old selection
            onSize={(size, refocus) => applyTextStyle(editor, { fontSize: size === DEFAULT_SIZE ? null : `${size}pt` }, refocus)}
          />
          <Divider />
          <Tool label="Bold" on={active.bold} onClick={() => chain().toggleBold().run()} icon={<Bold />} />
          <Tool label="Italic" on={active.italic} onClick={() => chain().toggleItalic().run()} icon={<Italic />} />
          <Tool label="Underline" on={active.underline} onClick={() => chain().toggleUnderline().run()} icon={<Underline />} />
          <Divider />
          <Tool label="Numbered points" on={active.ordered} onClick={() => chain().toggleOrderedList().run()} icon={<ListOrdered />} />
          <Tool label="Bullet points" on={active.bullet} onClick={() => chain().toggleBulletList().run()} icon={<List />} />
          <Tool
            label="Make it a sub-point (4.1)"
            disabled={!active.inList}
            onClick={() => chain().sinkListItem('listItem').run()}
            icon={<IndentIncrease />}
          />
          <Tool
            label="Move back a level"
            disabled={!active.inList}
            onClick={() => chain().liftListItem('listItem').run()}
            icon={<IndentDecrease />}
          />
          <Divider />
          <Tool label="Align left" on={active.left} onClick={() => chain().setTextAlign('left').run()} icon={<AlignLeft />} />
          <Tool label="Centre" on={active.center} onClick={() => chain().setTextAlign('center').run()} icon={<AlignCenter />} />
          <Tool label="Align right" on={active.right} onClick={() => chain().setTextAlign('right').run()} icon={<AlignRight />} />
          <Tool label="Justify" on={active.justify} onClick={() => chain().setTextAlign('justify').run()} icon={<AlignJustify />} />
          <Divider />
          <NativeSelect
            aria-label="Insert a candidate detail"
            className="w-40 [&_select]:h-8 [&_select]:rounded-lg [&_select]:text-sm"
            value=""
            onChange={(e) => {
              if (e.target.value)
                chain()
                  .insertContent({ type: 'field', attrs: { name: e.target.value } })
                  .insertContent(' ')
                  .run()
            }}
          >
            <NativeSelectOption value="">+ Insert field…</NativeSelectOption>
            {placeholders.map((p) => (
              <NativeSelectOption key={p.name} value={p.name}>
                {shortLabel(p.label)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {blocks.some((b) => b.name === 'ctc_table') && (
            <Tool
              label="Insert the salary table"
              text="Salary table"
              onClick={() =>
                chain()
                  .insertContent({ type: 'letterBlock', attrs: { name: 'ctc_table' } })
                  .run()
              }
              icon={<Table />}
            />
          )}
          {blocks.some((b) => b.name === 'signature') && (
            <Tool
              label="Insert the stamp + signature"
              text="Signature"
              onClick={() =>
                chain()
                  .insertContent({ type: 'letterBlock', attrs: { name: 'signature' } })
                  .run()
              }
              icon={<Stamp />}
            />
          )}
          <Tool
            label="A line with text on the left and on the right (e.g. Ref ... Date)"
            text="Left | right"
            icon={<Columns2 />}
            onClick={() =>
              chain()
                .insertContent({
                  type: 'splitLine',
                  content: [
                    { type: 'paragraph', attrs: { textAlign: 'left' }, content: [{ type: 'text', text: 'Left' }] },
                    { type: 'paragraph', attrs: { textAlign: 'right' }, content: [{ type: 'text', text: 'Right' }] },
                  ],
                })
                .run()
            }
          />
          <Tool
            label="Start a new page here"
            text="New page"
            onClick={() => chain().insertContent({ type: 'pageBreak' }).run()}
            icon={<SeparatorHorizontal />}
          />
          <Divider />
          <Tool label="Undo" disabled={!active.canUndo} onClick={() => chain().undo().run()} icon={<Undo2 />} />
          <Tool label="Redo" disabled={!active.canRedo} onClick={() => chain().redo().run()} icon={<Redo2 />} />
        </div>
      )}

      <div className={cn('grid items-start gap-5', aside && 'lg:grid-cols-[minmax(0,1fr)_17rem]')}>
        {/* A4 sheets with the letterhead as they will print, and the letter's text over them (at the PDF's margins) */}
        <div className="overflow-x-auto rounded-3xl bg-surface-2 p-3 [overflow-anchor:none] sm:p-6">
          <div
            className="relative mx-auto"
            style={{ width: `${PAGE.width}pt`, height: pages * SHEET_PITCH - SHEET_GAP }}
            // a click on the empty rest of the last page: type at the end of the letter
            onMouseDown={(e) => {
              if (!editable || e.clientY < editor.view.dom.getBoundingClientRect().bottom) return
              e.preventDefault()
              editor.commands.focus('end')
            }}
          >
            <Sheets pages={pages} letterhead={letterhead} header={header ?? null} footer={footer ?? null} />
            <div
              className="relative text-[10pt] text-black"
              style={{ padding: `${pageTop(letterhead.header)}pt ${PAGE.side}pt 0`, fontFamily: 'Roboto, sans-serif' }}
            >
              <SignatureImageContext value={signature}>
                <EditorContent editor={editor} />
              </SignatureImageContext>
            </div>
          </div>
        </div>
        {aside}
      </div>
    </div>
  )
}

// The sheets behind the text: white A4 pages with the header (and ":: 2 ::" from page 2) and the footer where the PDF
// draws them - the header 18 pt from the top, fitted into 495 × 78 pt; the footer at the top of the bottom margin,
// fitted into 495 × 34 pt.
function Sheets({
  pages,
  letterhead,
  header,
  footer,
}: {
  pages: number
  letterhead: { header: boolean; footer: boolean }
  header: string | null
  footer: string | null
}) {
  const width = PAGE.width - 2 * PAGE.side
  // the header image's printed height (the page number goes 4 pt below it)
  const [headerHeight, setHeaderHeight] = useState(0)
  return Array.from({ length: pages }, (_, i) => (
    <div
      key={i}
      aria-hidden
      className="absolute inset-x-0 bg-white shadow-float"
      style={{ top: i * SHEET_PITCH, height: PAGE.height * PX }}
    >
      {letterhead.header && header && (
        <img
          src={header}
          alt=""
          className="absolute object-contain object-top"
          style={{ top: '18pt', left: `${PAGE.side}pt`, width: `${width}pt`, height: '78pt' }}
          onLoad={(e) => {
            const img = e.currentTarget
            if (i === 0 && img.naturalWidth) setHeaderHeight(Math.min(78, (width * img.naturalHeight) / img.naturalWidth))
          }}
        />
      )}
      {i > 0 && (
        <p
          className="absolute inset-x-0 text-center text-[9pt] leading-none text-black"
          style={{ top: `${18 + (letterhead.header ? headerHeight + 4 : 0)}pt`, fontFamily: 'Roboto, sans-serif' }}
        >
          :: {i + 1} ::
        </p>
      )}
      {letterhead.footer && footer && (
        <img
          src={footer}
          alt=""
          className="absolute object-contain object-top"
          style={{ top: `${PAGE.height - pageBottom(true)}pt`, left: `${PAGE.side}pt`, width: `${width}pt`, height: '34pt' }}
        />
      )}
    </div>
  ))
}

function Tool({
  label,
  text,
  icon,
  on,
  disabled,
  onClick,
}: {
  label: string
  text?: string
  icon: React.ReactNode
  on?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={on}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-sm text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4',
        on && 'bg-hero text-hero-foreground hover:bg-hero',
      )}
    >
      {icon}
      {text && <span className="hidden 2xl:inline">{text}</span>}
    </button>
  )
}

function Divider() {
  return <span aria-hidden className="mx-0.5 h-5 w-px bg-border" />
}

// The font size box, as in Word: a list to pick from (the ▾ button, or the down arrow key) and a box to type any size
// in (10.5, 10.7...) - Enter or leaving the box applies it. Anything that is not a size goes back to the current one.
function SizeBox({ current, onSize }: { current: string; onSize: (size: string, refocus: boolean) => void }) {
  const [typed, setTyped] = useState(current)
  const [open, setOpen] = useState(false)
  // refocus: back to the letter afterwards (Enter / a pick from the list) - not when the box was left by a click
  const apply = (value: string, refocus = true) => {
    setOpen(false)
    const size = parseFontSize(value)
    if (size === null) return setTyped(current)
    setTyped(size)
    if (size !== current) onSize(size, refocus)
  }
  return (
    <div
      className="relative flex h-8 items-center rounded-lg border border-input focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/40"
      // leaving the box (not into its own list) applies what was typed
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) apply(typed, false)
      }}
    >
      <input
        aria-label="Font size"
        title="Font size - pick one, or type any size (e.g. 10.7)"
        inputMode="decimal"
        aria-expanded={open}
        aria-controls="letter-font-sizes"
        className="h-full w-11 bg-transparent pl-2 text-sm tabular-nums outline-none"
        value={typed}
        onFocus={(e) => e.target.select()}
        onChange={(e) => setTyped(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            apply(typed)
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setOpen(true)
          }
          if (e.key === 'Escape') {
            setOpen(false)
            setTyped(current)
          }
        }}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="Show the font sizes"
        className="grid h-full w-6 place-items-center rounded-r-lg text-muted-foreground hover:bg-muted [&_svg]:size-3.5"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((o) => !o)}
      >
        <ChevronDown />
      </button>
      {open && (
        <ul
          id="letter-font-sizes"
          role="listbox"
          aria-label="Font sizes"
          className="absolute top-full left-0 z-20 mt-1 max-h-64 w-full min-w-16 overflow-y-auto rounded-lg border bg-popover p-1 text-sm text-popover-foreground shadow-float"
        >
          {SIZES.map((size) => (
            <li key={size} role="option" aria-selected={size === current}>
              <button
                type="button"
                tabIndex={-1}
                className={cn(
                  'w-full rounded-md px-2 py-1 text-left tabular-nums hover:bg-muted',
                  size === current && 'bg-muted font-semibold',
                )}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => apply(size)}
              >
                {size}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
