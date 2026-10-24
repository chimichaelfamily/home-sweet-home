import type { ReactNode } from 'react'
import type { Sky } from './lib/photos.ts'

const BG: Record<string, string> = {
  'clear-day': 'linear-gradient(160deg,#3F8FE0,#8CC8F5)', 'clear-cold': 'linear-gradient(160deg,#6FA6D2,#CFE3F1)',
  'partly-day': 'linear-gradient(160deg,#5A9BDA,#A8CDEB)', 'cloudy-day': 'linear-gradient(160deg,#7C8A9C,#B9C3CF)',
  'fog-day': 'linear-gradient(160deg,#9AA5B1,#CBD2D9)', 'rain-day': 'linear-gradient(160deg,#4B586A,#7C8A9C)',
  'storm-day': 'linear-gradient(160deg,#2D3443,#566077)', 'snow-day': 'linear-gradient(160deg,#9DB3C8,#E0E9F1)',
  'clear-night': 'linear-gradient(160deg,#0E1A3C,#2E3F72)', 'partly-night': 'linear-gradient(160deg,#16213F,#3A4B78)',
  'cloudy-night': 'linear-gradient(160deg,#1C2434,#3C4659)', 'fog-night': 'linear-gradient(160deg,#252C38,#4A5361)',
  'rain-night': 'linear-gradient(160deg,#141A27,#34405A)', 'storm-night': 'linear-gradient(160deg,#10131C,#2E3547)',
  'snow-night': 'linear-gradient(160deg,#27334A,#5B6E8C)',
}
const drops = Array.from({ length: 26 }, (_, i) => i)

export function WeatherScene({ sky, day, temp, children }: { sky: Sky | null; day: boolean; temp: number | null; children: ReactNode }) {
  const key = sky ? (sky === 'clear' && day && temp !== null && temp <= 12 ? 'clear-cold' : `${sky}-${day ? 'day' : 'night'}`) : null
  const bg = key ? BG[key] : 'linear-gradient(120deg,var(--accent),var(--g2))'
  const clouds = sky === 'cloudy' || sky === 'rain' || sky === 'storm' ? 3 : sky === 'partly' || sky === 'snow' ? 2 : sky === 'fog' ? 2 : 0
  return (
    <div className="wx-card" style={{ background: bg }}>
      <div className="wx-layer" aria-hidden="true">
        {sky && (sky === 'clear' || sky === 'partly') && day && <i className="wx-sun" />}
        {sky && (sky === 'clear' || sky === 'partly') && !day && <><i className="wx-moon" /><i className="wx-stars" /></>}
        {Array.from({ length: clouds }, (_, i) => <i key={i} className={`wx-cloud c${i} ${sky === 'rain' || sky === 'storm' ? 'dark' : ''} ${day ? '' : 'nightc'}`} />)}
        {sky === 'fog' && <i className="wx-fog" />}
        {(sky === 'rain' || sky === 'storm') && drops.map(i => <i key={i} className="wx-drop" style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 7) * 0.13}s`, animationDuration: `${0.7 + (i % 5) * 0.08}s` }} />)}
        {sky === 'snow' && drops.map(i => <i key={i} className="wx-flake" style={{ left: `${(i * 41) % 100}%`, animationDelay: `${(i % 9) * 0.5}s`, animationDuration: `${4 + (i % 5)}s` }} />)}
        {sky === 'storm' && <i className="wx-flash" />}
      </div>
      <div className="wx-content">{children}</div>
    </div>
  )
}
