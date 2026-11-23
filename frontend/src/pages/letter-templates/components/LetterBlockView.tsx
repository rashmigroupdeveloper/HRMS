import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react'
import { useContext } from 'react'
import { cn } from '@/lib/utils'
import type { ExampleTable } from './labels'
import { SignatureImageContext } from './letter-images-context'

// How a letter block shows on the editor's page, as the PDF prints it:
// - the stamp + signature: the uploaded image, 110 pt wide, 4 pt above and below (else a box saying what goes there);
// - the salary table: the example table the preview PDF prints (each letter gets the candidate's own), 4 pt above and
//   10 pt below, drawn like pdfmake draws it (index.css .letter-table).
// The space is padding, so it adds to the paragraph's 8 pt above, as in the PDF. When selected, index.css outlines
// the element with data-block.

export function LetterBlockView({ node, extension }: ReactNodeViewProps) {
  const signature = useContext(SignatureImageContext)
  const name = String(node.attrs.name)
  const options = extension.options as { labels: Record<string, string>; examples: Record<string, ExampleTable> }
  const label = options.labels[name] ?? name
  const example = options.examples[name]

  if (name === 'signature' && signature) {
    return (
      <NodeViewWrapper className="py-[4pt]">
        <div data-block={name} className="w-fit rounded-lg" title={label}>
          <img src={signature} alt={label} draggable={false} className="block h-auto w-[110pt]" />
        </div>
      </NodeViewWrapper>
    )
  }
  if (example) {
    return (
      <NodeViewWrapper className="pt-[4pt] pb-[10pt]">
        <div data-block={name} title={`${label} - example figures; each letter shows the candidate's own`}>
          <TableView table={example} />
        </div>
      </NodeViewWrapper>
    )
  }
  return (
    <NodeViewWrapper className={name === 'signature' ? 'py-[12pt]' : 'pt-[4pt] pb-[10pt]'}>
      <div data-block={name} className="letter-block">
        <span className="letter-block-title">{label}</span>
        <span className="letter-block-hint">
          {name === 'signature'
            ? 'Upload the stamp + signature in the Letterhead panel - it shows here'
            : 'Filled from the offer when the letter is written'}
        </span>
      </div>
    </NodeViewWrapper>
  )
}

// A fixed column is its width plus the cell's 4 pt padding each side and the line, as in pdfmake; "*" takes the rest
function TableView({ table }: { table: ExampleTable }) {
  return (
    <table className="letter-table">
      <colgroup>
        {table.widths.map((width, i) => (
          <col key={i} style={width === '*' ? undefined : { width: `${width + 9}pt` }} />
        ))}
      </colgroup>
      <tbody>
        {table.rows.map((row, r) => (
          <tr key={r}>
            {row.map((cell, c) => (
              <td
                key={c}
                colSpan={cell.colSpan}
                className={cn(cell.bold && 'font-bold', cell.shaded && 'bg-[#e6e6e6]')}
                style={{ textAlign: cell.align ?? 'left' }}
              >
                {cell.text}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
