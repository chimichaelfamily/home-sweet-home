import { addMonths, diffDays } from './dates.ts'

export const TYPES = ['Sauce', 'Cleanser', 'Moisturiser', 'Serum', 'Sunscreen', 'Spice', 'Oil', 'Medicine', 'Other'] as const
export const PLACES = ['Fridge', 'Pantry', 'Kitchen', 'Bathroom', 'Other'] as const
// Months a product is good for after opening, unless the label says otherwise.
export const SHELF: Record<string, number> = { Sauce: 6, Cleanser: 12, Moisturiser: 12, Serum: 6, Sunscreen: 6, Spice: 24, Oil: 6, Medicine: 12, Other: 12 }

/** Use-by is the earlier of: opened date plus shelf life, or the printed date. */
export function useBy(opened: string, months: number, printed: string | null): string {
  const byOpen = addMonths(opened, months)
  return printed && printed < byOpen ? printed : byOpen
}
export function productStatus(useByYmd: string, today: string): { label: string; tone: 'late' | 'soon' | 'ok' } {
  const d = diffDays(useByYmd, today)
  if (d < 0) return { label: 'Overdue', tone: 'late' }
  if (d <= 30) return { label: d === 0 ? 'Today' : `In ${d} days`, tone: 'soon' }
  return { label: `In ${d} days`, tone: 'ok' }
}
