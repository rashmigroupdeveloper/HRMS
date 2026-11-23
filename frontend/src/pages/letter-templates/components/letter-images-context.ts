import { createContext } from 'react'

// The template's stamp + signature image (data: URL) for the editor's signature block - null when not uploaded.
// Given by LetterEditor, read by LetterBlockView.
export const SignatureImageContext = createContext<string | null>(null)
