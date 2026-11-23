import { errorMessage } from '@/lib/utils'

// The error of a failed API call, as a red box (validation problems are listed by field). Renders nothing when
// there is no error.
export function FormError({ error }: { error: unknown }) {
  if (!error) return null
  return (
    <p role="alert" className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm font-medium text-negative-ink">
      {errorMessage(error)}
    </p>
  )
}
