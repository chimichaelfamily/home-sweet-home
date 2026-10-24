/** Months from today to 31 Dec of `year` (at least 1). */
export function monthsTo(year: number, now = new Date()): number {
  return Math.max(1, (year - now.getFullYear()) * 12 + (11 - now.getMonth()) + 1)
}
export function daysUntil(ymd: string, now = new Date()): number {
  const [y, m, d] = ymd.split('-').map(Number)
  const a = Date.UTC(y, m - 1, d), b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((a - b) / 86400000)
}
export const money = (n: number) => '$' + Math.round(n).toLocaleString('en-AU')
