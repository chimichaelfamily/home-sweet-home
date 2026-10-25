// The little pictures used on the Calendar. Drawn here as simple original vector art.
export const Leaf = ({ size = 21 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-label="Vegetarian day"><path d="M5 19C5 10 10 5 20 4c0 9-5 15-13 15z" fill="#3FA66B" stroke="#2B7D4D" strokeWidth="1.5" strokeLinejoin="round" /><path d="M5 19c3-5 6-8 10-10" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" /></svg>
export const Pocket = ({ size = 20 }: { size?: number }) => <svg width={size * 0.9} height={size} viewBox="0 0 24 28" fill="none" aria-label="Lunar New Year"><rect x="3" y="2" width="18" height="24" rx="3" fill="#D6262B" stroke="#9E1519" strokeWidth="1.5" /><path d="M3 9c6 5 12 5 18 0" stroke="#F6C453" strokeWidth="1.5" /><circle cx="12" cy="15" r="3.5" fill="#F6C453" /></svg>
export const Lotus = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-label="Vegetarian day">
    <path d="M16 6c4 4 5 9 0 17-5-8-4-13 0-17z" fill="#F7A8C4" stroke="#C2527F" strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M16 23C9 21 5 15 4 10c6 0 10 4 12 13z" fill="#F9C2D6" stroke="#C2527F" strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M16 23c7-2 11-8 12-13-6 0-10 4-12 13z" fill="#F9C2D6" stroke="#C2527F" strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M5 26c4 3 18 3 22 0" stroke="#3FA66B" strokeWidth="2" strokeLinecap="round" />
  </svg>)
export const Family = ({ size = 22 }: { size?: number }) => (
  <svg width={size * 1.3} height={size} viewBox="0 0 40 30" fill="none" aria-label="Lunar New Year">
    <path d="M3 29c0-7 3-11 7-11s7 4 7 11z" fill="#D6262B" /><circle cx="10" cy="11" r="5" fill="#FFD9BE" /><path d="M5 10c0-5 10-6 10 0-3-2-7-2-10 0z" fill="#2B2B2A" />
    <path d="M23 29c0-7 3-11 7-11s7 4 7 11z" fill="#F29A1F" /><circle cx="30" cy="11" r="5" fill="#FFD9BE" /><path d="M25 10c0-5 10-6 10 0-3-2-7-2-10 0z" fill="#2B2B2A" />
    <path d="M14 29c0-5 2-8 6-8s6 3 6 8z" fill="#3E7CD6" /><circle cx="20" cy="16" r="4" fill="#FFD9BE" /><path d="M16 15c0-4 8-4 8 0-3-1.500-5-1.500-8 0z" fill="#2B2B2A" />
    <rect x="21" y="22" width="4" height="5.500" rx="1" fill="#D6262B" stroke="#F6C453" strokeWidth=".8" />
  </svg>)

/** One icon by its saved value: a built-in name, an emoji, or a picture the person uploaded. */
export function IconView({ value, size = 20 }: { value: string; size?: number }) {
  if (value === 'leaf') return <Leaf size={size} />
  if (value === 'lotus') return <Lotus size={size} />
  if (value === 'pocket') return <Pocket size={size} />
  if (value === 'family') return <Family size={size} />
  if (value.startsWith('data:')) return <img src={value} alt="" style={{ width: size, height: size, objectFit: 'contain' }} />
  return <span style={{ fontSize: size * 0.9, lineHeight: 1 }}>{value}</span>
}
