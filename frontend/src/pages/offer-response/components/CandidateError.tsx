import { candidateMessage } from './candidate-message'

// The candidate-safe message of a failed call (see candidate-message.ts) as a red box; renders nothing without an error
export function CandidateError({ error }: { error: unknown }) {
  if (!error) return null
  return (
    <p role="alert" className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm font-medium text-negative-ink">
      {candidateMessage(error)}
    </p>
  )
}
