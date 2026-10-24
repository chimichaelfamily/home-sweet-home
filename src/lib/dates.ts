// Dates are plain 'YYYY-MM-DD' strings in the household's local time, so no time-zone surprises.
export const pad = (n: number) => String(n).padStart(2, '0')
export const toYmd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const fromYmd = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}
export const today = () => toYmd(new Date())
export const addDays = (s: string, n: number) => {
  const d = fromYmd(s)
  d.setDate(d.getDate() + n)
  return toYmd(d)
}
// Same behaviour as Excel's EDATE: month-end dates clamp (31 Jan + 1 month = 28/29 Feb).
export const addMonths = (s: string, n: number) => {
  const d = fromYmd(s)
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + n)
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, last))
  return toYmd(d)
}
export const diffDays = (a: string, b: string) =>
  Math.round((fromYmd(a).getTime() - fromYmd(b).getTime()) / 86400000)
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const fmtShort = (s: string) => {
  const d = fromYmd(s)
  return `${d.getDate()} ${MON[d.getMonth()]}`
}
export const fmtLong = (s: string) => {
  const d = fromYmd(s)
  return `${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`
}
export const dowShort = (s: string) => DOW[fromYmd(s).getDay()]
export const isoToYmd = (iso: string) => toYmd(new Date(iso))
