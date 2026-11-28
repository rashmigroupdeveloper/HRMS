export const stamp = (value: Date | string) => new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) + ' IST'
export function formatBytes(bytes: number) {
  const gb = bytes / 1024 ** 3
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / 1024 ** 2).toFixed(0)} MB`
}
export function duration(ms: number | null) {
  if (ms === null) return 'Running'
  return ms < 1000 ? `${ms} ms` : ms < 60_000 ? `${(ms / 1000).toFixed(1)} s` : `${(ms / 60_000).toFixed(1)} min`
}
export function uptime(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  return hours ? `${hours} h ${Math.floor(seconds % 3600 / 60)} min` : `${Math.floor(seconds / 60)} min`
}
