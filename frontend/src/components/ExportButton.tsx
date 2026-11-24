import { Download } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn, downloadFile } from '@/lib/utils'

// A consistent report action. Each caller supplies its own typed, authorized API and current filters.
export function ExportButton({ load, disabled, className, title = 'Export to Excel for review and printing' }: {
  load: () => Promise<Blob>; disabled?: boolean; className?: string; title?: string
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return <span className={cn('inline-flex min-w-0 flex-col items-end gap-1', className)}>
    <Button type="button" variant="secondary" className="group/export h-10 min-w-28 gap-2 rounded-full px-4 shadow-card transition-colors hover:bg-card active:translate-y-px motion-reduce:transform-none" title={title} disabled={disabled || pending} aria-busy={pending} onClick={async () => {
      setPending(true)
      setError(null)
      try { await downloadFile(load, setError) } finally { setPending(false) }
    }}>
      <Download aria-hidden className="size-4 transition-transform duration-150 group-hover/export:-translate-y-0.5 motion-reduce:transform-none" />
      <span>{pending ? 'Exporting…' : 'Export'}</span>
    </Button>
    {error && <span role="alert" className="max-w-72 text-right text-xs text-negative-ink">{error}</span>}
  </span>
}
