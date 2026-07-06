/**
 * Placeholder shell — Stage 0.0 proves the toolchain only.
 * The real app shell (masthead, pill-nav, per-role navigation) lands in
 * Stage 0.3 from packages/ui (docs/05 §3, docs/08 §3).
 */
export function App() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="rounded-3xl bg-[#fbf9f3] px-10 py-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Rashmi HRMS</h1>
        <p className="mt-2 text-sm text-[#6f6b62]">
          Stage 0.0 — project skeleton is running. Design system arrives in Stage 0.3.
        </p>
      </div>
    </main>
  );
}
