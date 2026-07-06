/**
 * Placeholder shell — now on real Warm Editorial tokens (docs/05 §1).
 * The full app shell (masthead, pill-nav, per-role navigation) lands with
 * the component kit in Stage 0.3 (docs/05 §3, docs/08 §3).
 */
export function App() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="rounded-card bg-surface px-10 py-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-ink">Rashmi HRMS</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Warm Editorial tokens active — component kit arrives in Stage 0.3.
        </p>
        <span className="mt-4 inline-block rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent-ink">
          Stage 0.0 ✓ · tokens ✓
        </span>
      </div>
    </main>
  );
}
