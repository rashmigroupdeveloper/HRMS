import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

// Loading placeholder for the list of uploaded letterhead images (LetterheadImages' "Choose" dialog): the real rows - the
// image's frame, its file name, "Uploaded" with who and when, the templates using it - and "Use this" (disabled).
export function ImagePickerSkeleton({ rows = 2, label = 'Loading' }: { rows?: number; label?: string }) {
  return (
    <ul role="status" aria-label={label} className="space-y-2">
      {Array.from({ length: rows }, (_, r) => (
        <li key={r} className="space-y-2 rounded-2xl border p-3">
          <div className="flex h-20 items-center justify-center overflow-hidden rounded-xl border border-dashed bg-white p-1">
            <Skeleton className="size-full rounded-lg" />
          </div>
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0 flex-1 text-xs text-muted-foreground">
              <div className="flex h-4 items-center">
                <Skeleton className="h-3 w-40 max-w-full rounded-full" />
              </div>
              <div className="flex h-4 items-center gap-1">
                Uploaded <Skeleton className="h-3 w-36 rounded-full" />
              </div>
              <div className="flex h-4 items-center">
                <Skeleton className="h-3 w-48 max-w-full rounded-full" />
              </div>
            </div>
            <Button size="sm" variant="secondary" className="shrink-0" disabled>
              Use this
            </Button>
          </div>
        </li>
      ))}
    </ul>
  )
}
