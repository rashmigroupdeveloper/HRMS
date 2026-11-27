const DAY = 86_400_000

// The first and last day of an attendance month. Same arithmetic as days.service cycleRange — display only.
export function cycleBounds(year: number, month: number, startDay: number) {
  if (startDay <= 1) return { from: new Date(Date.UTC(year, month - 1, 1)), to: new Date(Date.UTC(year, month, 0)) }
  return { from: new Date(Date.UTC(year, month - 2, startDay)), to: new Date(Date.UTC(year, month - 1, startDay - 1)) }
}

export function cycleSpan(from: Date, to: Date, today: Date) {
  const length = Math.round((to.getTime() - from.getTime()) / DAY) + 1
  const raw = Math.round((today.getTime() - from.getTime()) / DAY)
  const index = Math.min(Math.max(length - 1, 0), Math.max(0, raw))
  const outside = raw < 0 ? 'before' : raw > length - 1 ? 'after' : null
  const ratio = length <= 1 ? 1 : index / (length - 1)
  return { length, index, outside, ratio }
}
