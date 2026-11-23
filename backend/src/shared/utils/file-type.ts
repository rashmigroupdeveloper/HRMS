// Detects a file's real type from its first bytes ("magic numbers"). The type a browser sends is chosen by the
// client and can lie; this cannot (a renamed .exe is not a PDF).

export type DetectedFileType = 'application/pdf' | 'image/jpeg' | 'image/png'

const SIGNATURES: { type: DetectedFileType; bytes: number[] }[] = [
  { type: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] }, // %PDF-
  { type: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { type: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
]

export function detectFileType(data: Uint8Array): DetectedFileType | null {
  const match = SIGNATURES.find(({ bytes }) => bytes.every((byte, i) => data[i] === byte))
  return match?.type ?? null
}

// Keeps only a plain file name for display / download (no folders, no control characters); `fallback` when nothing
// is left
export function cleanFileName(name: string, fallback = 'document'): string {
  const base = name.split(/[\\/]/).pop() ?? ''
  return base.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 255) || fallback
}
