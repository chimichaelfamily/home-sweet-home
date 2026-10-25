// Background music for the whole app: it keeps playing when you change tabs, in a small player in the corner.
// Tap the corner player to open it big (to pick the part you want), and ✕ to stop.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { playerSrc } from './lib/embed.ts'

export interface Media { id: string; title: string; kind: 'youtube' | 'spotify'; src: string }
interface Ctx { music: Media | null; playMusic: (id: string, title: string, url: string) => void; stopMusic: () => void }
const MediaCtx = createContext<Ctx | null>(null)
export const useMedia = () => useContext(MediaCtx)!

export function MediaProvider({ children }: { children: ReactNode }) {
  const [music, setMusic] = useState<Media | null>(null)
  const playMusic = useCallback((id: string, title: string, url: string) => { const p = playerSrc(url); if (p) setMusic({ id, title, ...p }) }, [])
  const stopMusic = useCallback(() => setMusic(null), [])
  return (
    <MediaCtx.Provider value={{ music, playMusic, stopMusic }}>
      {children}
      {music && <MusicDock key={music.id} music={music} stop={stopMusic} />}
    </MediaCtx.Provider>
  )
}

const send = (f: HTMLIFrameElement | null, msg: object) => f?.contentWindow?.postMessage(JSON.stringify(msg), '*')

function MusicDock({ music, stop }: { music: Media; stop: () => void }) {
  const f = useRef<HTMLIFrameElement>(null)
  const [big, setBig] = useState(false)
  const [paused, setPaused] = useState(false)
  const [hint, setHint] = useState(false)
  const state = useRef(-1)
  // Listen to the YouTube player so we know whether it really started (the iPad sometimes needs one tap).
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.source !== f.current?.contentWindow || typeof e.data !== 'string') return
      try { const d = JSON.parse(e.data); const s = d?.info?.playerState; if (typeof s === 'number') { state.current = s; if (s === 1) { setHint(false); setPaused(false) } if (s === 2) setPaused(true) } } catch { /* not ours */ }
    }
    window.addEventListener('message', on)
    return () => window.removeEventListener('message', on)
  }, [])
  const loaded = () => {
    if (music.kind !== 'youtube') return
    send(f.current, { event: 'listening', id: 1, channel: 'widget' })
    setTimeout(() => { if (state.current !== 1) { setBig(true); setHint(true) } }, 3000)
  }
  const toggle = () => { send(f.current, { event: 'command', func: paused ? 'playVideo' : 'pauseVideo', args: [] }); setPaused(!paused) }
  const yt = music.kind === 'youtube'
  return (
    <>
      {big && <div onClick={() => setBig(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(20,16,30,.55)', zIndex: 44 }} />}
      <div className="dock-card" style={big
        ? { position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 'min(92vw, 760px)', zIndex: 45, display: 'flex', flexDirection: 'column' }
        : { position: 'fixed', right: 16, bottom: 96, width: 300, zIndex: 40, display: 'flex', alignItems: 'center' }}>
        <iframe ref={f} title={music.title} src={music.src} onLoad={loaded} allow="autoplay; encrypted-media; clipboard-write; picture-in-picture; fullscreen" allowFullScreen
          style={big ? { display: 'block', width: '100%', aspectRatio: yt ? '16 / 9' : undefined, height: yt ? 'auto' : 152, border: 0, background: '#000' }
            : { display: 'block', width: yt ? 112 : 150, height: yt ? 63 : 80, border: 0, background: '#000', flex: 'none' }} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6, padding: big ? '10px 14px' : '6px 8px', background: 'var(--card)' }}>
          <button onClick={() => setBig(!big)} style={{ flex: 1, minWidth: 0, textAlign: 'left', border: 'none', background: 'none', padding: 0, color: 'var(--ink)' }}>
            <div style={{ fontSize: big ? 16 : 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{music.title}</div>
            {hint && big && <div className="muted" style={{ fontSize: 13 }}>Tap play on the video once to start the sound.</div>}
          </button>
          {yt && <button className="dock-btn" aria-label={paused ? 'Play' : 'Pause'} onClick={toggle}>{paused ? '▶' : '❚❚'}</button>}
          <button className="dock-btn" aria-label={big ? 'Make small' : 'Open big'} onClick={() => setBig(!big)}>{big ? '↘' : '⤢'}</button>
          <button className="dock-btn" aria-label="Stop" onClick={stop}>✕</button>
        </div>
      </div>
    </>
  )
}
