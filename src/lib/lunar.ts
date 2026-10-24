// Vietnamese lunar calendar (âm lịch), time zone UTC+7. Algorithm by Hồ Ngọc Đức.
const PI = Math.PI
const INT = Math.floor
const TZ = 7

function jdFromDate(dd: number, mm: number, yy: number): number {
  const a = INT((14 - mm) / 12), y = yy + 4800 - a, m = mm + 12 * a - 3
  return dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - INT(y / 100) + INT(y / 400) - 32045
}
function newMoonDay(k: number): number {
  const T = k / 1236.85, T2 = T * T, T3 = T2 * T, dr = PI / 180
  let Jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3
  Jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr)
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3
  let C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M)
  C1 -= 0.4068 * Math.sin(Mpr * dr)
  C1 += 0.0161 * Math.sin(dr * 2 * Mpr)
  C1 -= 0.0004 * Math.sin(dr * 3 * Mpr)
  C1 += 0.0104 * Math.sin(dr * 2 * F)
  C1 -= 0.0051 * Math.sin(dr * (M + Mpr))
  C1 -= 0.0074 * Math.sin(dr * (M - Mpr))
  C1 += 0.0004 * Math.sin(dr * (2 * F + M))
  C1 -= 0.0004 * Math.sin(dr * (2 * F - M))
  C1 -= 0.0006 * Math.sin(dr * (2 * F + Mpr))
  C1 += 0.001 * Math.sin(dr * (2 * F - Mpr))
  C1 += 0.0005 * Math.sin(dr * (2 * Mpr + M))
  const deltat = T < -11 ? 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3 : -0.000278 + 0.000265 * T + 0.000262 * T2
  return INT(Jd1 + C1 - deltat + 0.5 + TZ / 24)
}
function sunLongitude(jdn: number): number {
  const T = (jdn - 2451545.0) / 36525, T2 = T * T, dr = PI / 180
  const M = 357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2
  let DL = (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M)
  DL += (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.00029 * Math.sin(dr * 3 * M)
  let L = L0 + DL
  L = L * dr
  L -= PI * 2 * INT(L / (PI * 2))
  return L
}
const sunLong = (day: number) => INT((sunLongitude(day - 0.5 - TZ / 24) / PI) * 6)
function lunarMonth11(yy: number): number {
  const off = jdFromDate(31, 12, yy) - 2415021
  const k = INT(off / 29.530588853)
  let nm = newMoonDay(k)
  if (sunLong(nm) >= 9) nm = newMoonDay(k - 1)
  return nm
}
function leapOffset(a11: number): number {
  const k = INT((a11 - 2415021.076998695) / 29.530588853 + 0.5)
  let last = 0, i = 1, arc = sunLong(newMoonDay(k + i))
  do { last = arc; i++; arc = sunLong(newMoonDay(k + i)) } while (arc !== last && i < 14)
  return i - 1
}
export interface Lunar { day: number; month: number; year: number; leap: boolean }
export function solarToLunar(dd: number, mm: number, yy: number): Lunar {
  const dayNumber = jdFromDate(dd, mm, yy)
  const k = INT((dayNumber - 2415021.076998695) / 29.530588853)
  let monthStart = newMoonDay(k + 1)
  if (monthStart > dayNumber) monthStart = newMoonDay(k)
  let a11 = lunarMonth11(yy), b11 = a11, year: number
  if (a11 >= monthStart) { year = yy; a11 = lunarMonth11(yy - 1) } else { year = yy + 1; b11 = lunarMonth11(yy + 1) }
  const day = dayNumber - monthStart + 1
  const diff = INT((monthStart - a11) / 29)
  let leap = false, month = diff + 11
  if (b11 - a11 > 365) {
    const lo = leapOffset(a11)
    if (diff >= lo) { month = diff + 10; if (diff === lo) leap = true }
  }
  if (month > 12) month -= 12
  if (month >= 11 && diff < 4) year -= 1
  return { day, month, year, leap }
}
