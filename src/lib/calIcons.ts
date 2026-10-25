// Which little pictures the Calendar uses for vegetarian days and Lunar New Year. Saved on this iPad.
export const VEG_ICONS = ['lotus', 'leaf', '🌿', '🥬', '🥦', '🌱', '🍃', '🥗', '🍄'] as const
export const TET_ICONS = ['family', 'pocket', '🧧', '🧨', '🏮', '🌼', '🌸', '🐉', '🎆', '🎋'] as const
const KEY = 'home-sweet-home.calicons.v1'
export type CalIcons = { veg: string; tet: string }
export function getCalIcons(): CalIcons {
  try { return { veg: 'lotus', tet: 'family', ...JSON.parse(localStorage.getItem(KEY) || '{}') } } catch { return { veg: 'lotus', tet: 'family' } }
}
export function setCalIcon(k: keyof CalIcons, v: string) {
  try { localStorage.setItem(KEY, JSON.stringify({ ...getCalIcons(), [k]: v })) } catch { /* ignore */ }
  window.dispatchEvent(new Event('hsh-calicons'))
}
