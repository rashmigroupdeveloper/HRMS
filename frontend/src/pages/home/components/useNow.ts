import { useEffect, useState } from 'react'

// The time now, renewed every minute - the home widgets' "ends in 2h 10m" and the shift line's marker move with it
// (2026-11-27). The page does not reload its data on this tick; each widget's query keeps its own refresh.
export function useNow(everyMs = 60_000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), everyMs)
    return () => window.clearInterval(timer)
  }, [everyMs])
  return now
}
