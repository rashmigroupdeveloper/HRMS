// The fonts a letter can use: the open fonts of the WordCraft word processor (SIL OFL, @fontsource packages), shown
// on the editor's paper from the same files the backend prints the PDF with. Keep in step with LETTER_FONTS in
// backend/src/core/pdf/letter-pdf.ts. Regular, bold, italic and bold italic of each are loaded (Latin letters).

// the default font (Roboto, which the PDF writer ships with): regular and medium - the PDF's bold is Roboto Medium
import '@fontsource/roboto/400.css'
import '@fontsource/roboto/400-italic.css'
import '@fontsource/roboto/500.css'
import '@fontsource/roboto/500-italic.css'
import '@fontsource/carlito/400.css'
import '@fontsource/carlito/700.css'
import '@fontsource/carlito/400-italic.css'
import '@fontsource/carlito/700-italic.css'
import '@fontsource/caladea/400.css'
import '@fontsource/caladea/700.css'
import '@fontsource/caladea/400-italic.css'
import '@fontsource/caladea/700-italic.css'
import '@fontsource/arimo/400.css'
import '@fontsource/arimo/700.css'
import '@fontsource/arimo/400-italic.css'
import '@fontsource/arimo/700-italic.css'
import '@fontsource/tinos/400.css'
import '@fontsource/tinos/700.css'
import '@fontsource/tinos/400-italic.css'
import '@fontsource/tinos/700-italic.css'
import '@fontsource/cousine/400.css'
import '@fontsource/cousine/700.css'
import '@fontsource/cousine/400-italic.css'
import '@fontsource/cousine/700-italic.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/700.css'
import '@fontsource/inter/400-italic.css'
import '@fontsource/inter/700-italic.css'
import '@fontsource/source-sans-3/400.css'
import '@fontsource/source-sans-3/700.css'
import '@fontsource/source-sans-3/400-italic.css'
import '@fontsource/source-sans-3/700-italic.css'
import '@fontsource/source-serif-4/400.css'
import '@fontsource/source-serif-4/700.css'
import '@fontsource/source-serif-4/400-italic.css'
import '@fontsource/source-serif-4/700-italic.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/700.css'
import '@fontsource/jetbrains-mono/400-italic.css'
import '@fontsource/jetbrains-mono/700-italic.css'

// [value stored in the letter (a CSS font-family; names with a digit or a space quoted), name in the menu].
// '' = the default font (Roboto in the PDF).
export const LETTER_FONTS: [string, string][] = [
  ['', 'Default font'],
  ['Carlito', 'Carlito'],
  ['Caladea', 'Caladea'],
  ['Arimo', 'Arimo'],
  ['Tinos', 'Tinos'],
  ['Cousine', 'Cousine'],
  ['Inter', 'Inter'],
  ['"Source Sans 3"', 'Source Sans 3'],
  ['"Source Serif 4"', 'Source Serif 4'],
  ['"JetBrains Mono"', 'JetBrains Mono'],
]

// Font sizes in points: the list offers whole sizes; any size from 1 to 400 with one decimal (10.5, 10.7...) can be
// typed (the backend's letterFontSize). 1 pt on the paper = 1 pt in the PDF.
export const DEFAULT_SIZE = '10'
export const LETTER_FONT_SIZES = ['8', '9', '10', '11', '12', '14', '16', '18', '20', '22', '24', '26', '28', '36', '48', '72']

// What was typed in the size box as a size ("10.7"), rounded to one decimal; null if it is not a size from 1 to 400
export function parseFontSize(typed: string): string | null {
  const text = typed.trim().replace(',', '.')
  const size = Math.round(Number(text) * 10) / 10
  return text !== '' && Number.isFinite(size) && size >= 1 && size <= 400 ? String(size) : null
}
