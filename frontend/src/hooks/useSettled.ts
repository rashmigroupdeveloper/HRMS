import { useEffect, useState } from 'react'

// A value that follows `value` once it has stopped changing for `ms` - e.g. a CTC is calculated when HR stops typing
// (the offer form and the salary structure's live example, 2026-11-24)
export function useSettled<T>(value: T, ms = 400) {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms)
    return () => clearTimeout(timer)
  }, [value, ms])
  return settled
}
