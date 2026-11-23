// JSON that keeps Date objects: a Date is written as { "$date": "<ISO>" } and read back as a Date.
// (Plain JSON.stringify turns dates into strings, so they would come back as text.)

export function stringifyWithDates(value: unknown): string {
  return JSON.stringify(value, function (this: Record<string, unknown>, key, current: unknown) {
    const original = this[key]
    return original instanceof Date ? { $date: original.toISOString() } : current
  })
}

export function parseWithDates(text: string): unknown {
  return JSON.parse(text, (_key, value: unknown) => {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const keys = Object.keys(value)
      const date = (value as { $date?: unknown }).$date
      if (keys.length === 1 && typeof date === 'string') return new Date(date)
    }
    return value
  })
}
