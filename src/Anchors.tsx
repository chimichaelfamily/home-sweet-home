import type React from 'react'
import { ANCHORS, type AnchorIcon } from './lib/anchors.ts'

const PATHS: Record<AnchorIcon, React.ReactElement> = {
  wallet: <><path d="M3 8a2 2 0 012-2h12v3" /><rect x="3" y="8" width="18" height="12" rx="2.500" /><circle cx="16.500" cy="14" r="1.200" fill="var(--accent)" stroke="none" /></>,
  shield: <><path d="M12 3l7 3v5c0 5-3.200 8.500-7 10-3.800-1.500-7-5-7-10V6z" /><path d="M8.500 12l2.500 2.500 4.500-5" /></>,
  growth: <><path d="M4 20h16" /><path d="M5 16l4-4 3 3 6-7" /><path d="M14 8h4v4" /></>,
  house: <><path d="M3.500 11.500L12 4l8.500 7.500" /><path d="M6 10.500V20h12v-9.500" /><path d="M10 20v-5h4v5" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3c3.500 3.500 3.500 14.500 0 18M12 3c-3.500 3.500-3.500 14.500 0 18" /></>,
  heart: <><path d="M12 20s-7.500-4.600-7.500-10.200A4.200 4.200 0 0112 7.300a4.200 4.200 0 017.500 2.500C19.500 15.400 12 20 12 20z" /><path d="M19 3v3M17.500 4.500h3" /></>,
  family: <><circle cx="8.500" cy="8" r="2.600" /><circle cx="16.200" cy="9" r="2.100" /><path d="M3.500 19c0-3.200 2-5.200 5-5.200s5 2 5 5.200" /><path d="M14.500 19c0-2.300 1.100-4 2.800-4s3.200 1.700 3.200 4" /></>,
  child: <><circle cx="12" cy="12.500" r="8" /><path d="M9 15c1.200 1.600 4.800 1.600 6 0" /><circle cx="9.500" cy="11" r=".7" fill="var(--accent)" stroke="none" /><circle cx="14.500" cy="11" r=".7" fill="var(--accent)" stroke="none" /><path d="M11 4.500c-.8-1.800 1.600-2.800 2.600-1.200" /></>,
}

export function Anchors() {
  return (
    <div className="anchor-cards">
      {ANCHORS.map(a => (
        <div key={a.text} className="anchor-card">
          <span className="anchor-icon">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.700" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{PATHS[a.icon]}</svg>
          </span>
          <span className="anchor-text">{a.text}</span>
        </div>
      ))}
    </div>
  )
}
