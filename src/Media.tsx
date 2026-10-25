// Players for the whole app.
// Music keeps playing in a small corner player when you change tabs; workout videos open in a big pop-up.
// Each player is one YouTube frame that stays loaded, and new songs or videos are sent into it. After the
// first tap on play in a session, the iPad then lets every later song or video start by itself.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { playerSrc, youtubeId } from './lib/embed.ts'

interface Item { id: string; title: string }
interface Ctx {
  music: Item | null; video: Item | null
  playMusic: (id: string, title: string, url: string) => void; stopMusic: () => void
  watch: (id: string, title: string, url: string) => void; closeVideo: () => void
}
const MediaCtx = createContext<Ctx | null>(null)
export const useMedia = () => useContext(MediaCtx)!

const send = (f: HTMLIFrameElement | null, func: string, args: unknown[] = []) => f?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), '*')

/** One persistent player frame. */
function usePlayer() {
  const frame = useRef<HTMLIFrameElement>(null)
  const [src, setSrc] = useState<string | null>(null)
  const [kind, setKind] = useState<'youtube' | 'spotify'>('youtube')
  const ready = useRef(false)
  const state = useRef(-1)
  const [playing, setPlaying] = useState(false)
  const [needTap, setNeedTap] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (!frame.current || e.source !== frame.current.contentWindow || typeof e.data !== 'string') return
      try { const s = JSON.parse(e.data)?.info?.playerState; if (typeof s === 'number') { state.current = s; setPlaying(s === 1); if (s === 1) setNeedTap(false) } } catch { /* not ours */ }
    }
    window.addEventListener('message', on); return () => window.removeEventListener('message', on)
  }, [])
  const watchStart = () => { window.clearTimeout(timer.current); setNeedTap(false); timer.current = window.setTimeout(() => { if (state.current !== 1) setNeedTap(true) }, 3500) }
  const load = (url: string) => {
    const id = youtubeId(url)
    if (id && src && kind === 'youtube' && ready.current) { send(frame.current, 'loadVideoById', [id, 0]); state.current = -1; watchStart(); return true }
    const p = playerSrc(url); if (!p) return false
    ready.current = false; state.current = -1; setKind(p.kind); setSrc(p.src); watchStart(); return true
  }
  const onLoad = () => {
    ready.current = true
    if (kind !== 'youtube') return
    frame.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*')
    send(frame.current, 'unMute'); send(frame.current, 'playVideo')
  }
  const pause = () => { window.clearTimeout(timer.current); setNeedTap(false); if (kind === 'youtube') send(frame.current, 'pauseVideo'); else { setSrc(null); ready.current = false } }
  const resume = () => send(frame.current, 'playVideo')
  return { frame, src, kind, onLoad, load, pause, resume, playing, needTap }
}

export function MediaProvider({ children }: { children: ReactNode }) {
  const m = usePlayer(), v = usePlayer()
  const [music, setMusic] = useState<Item | null>(null)
  const [video, setVideo] = useState<Item | null>(null)
  const [big, setBig] = useState(false)
  const mr = useRef(m), vr = useRef(v); mr.current = m; vr.current = v
  const stopMusic = useCallback(() => { mr.current.pause(); setMusic(null); setBig(false) }, [])
  const closeVideo = useCallback(() => { vr.current.pause(); setVideo(null) }, [])
  const playMusic = (id: string, title: string, url: string) => { if (video) closeVideo(); if (m.load(url)) setMusic({ id, title }) }
  const watch = (id: string, title: string, url: string) => { if (music) stopMusic(); if (v.load(url)) setVideo({ id, title }) }
  const off: React.CSSProperties = { position: 'fixed', left: -2000, top: 0, width: 320, height: 180, opacity: 0, pointerEvents: 'none' }
  return (
    <MediaCtx.Provider value={{ music, video, playMusic, stopMusic, watch, closeVideo }}>
      {children}
      {/* music: corner player (tap ⤢ to open big) */}
      {big && music && <div onClick={() => setBig(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(20,16,30,.55)', zIndex: 44 }} />}
      {m.src && (
        <div className={music ? 'dock-card' : ''} style={!music ? off : big
          ? { position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 'min(92vw, 760px)', zIndex: 45, display: 'flex', flexDirection: 'column' }
          : { position: 'fixed', right: 16, bottom: 96, width: 300, zIndex: 40, display: 'flex', alignItems: 'center' }}>
          <iframe ref={m.frame} title="Music" src={m.src} onLoad={m.onLoad} allow="autoplay; encrypted-media; clipboard-write; picture-in-picture; fullscreen" allowFullScreen
            style={big ? { display: 'block', width: '100%', aspectRatio: m.kind === 'youtube' ? '16 / 9' : undefined, height: m.kind === 'youtube' ? 'auto' : 152, border: 0, background: '#000' }
              : { display: 'block', width: m.kind === 'youtube' ? 112 : 150, height: m.kind === 'youtube' ? 63 : 80, border: 0, background: '#000', flex: 'none' }} />
          {music && (
            <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6, padding: big ? '10px 14px' : '6px 8px', background: 'var(--card)' }}>
              <button onClick={() => setBig(!big)} style={{ flex: 1, minWidth: 0, textAlign: 'left', border: 'none', background: 'none', padding: 0, color: 'var(--ink)' }}>
                <div style={{ fontSize: big ? 16 : 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{music.title}</div>
                {m.needTap && <div style={{ fontSize: 11, color: 'var(--late)', fontWeight: 600 }}>Tap ▶ on the video once</div>}
              </button>
              {m.kind === 'youtube' && <button className="dock-btn" aria-label={m.playing ? 'Pause' : 'Play'} onClick={() => (m.playing ? send(m.frame.current, 'pauseVideo') : m.resume())}>{m.playing ? '❚❚' : '▶'}</button>}
              <button className="dock-btn" aria-label={big ? 'Make small' : 'Open big'} onClick={() => setBig(!big)}>{big ? '↘' : '⤢'}</button>
              <button className="dock-btn" aria-label="Stop" onClick={stopMusic}>✕</button>
            </div>)}
        </div>)}
      {/* workout video: big pop-up */}
      {video && <div onClick={closeVideo} style={{ position: 'fixed', inset: 0, background: 'rgba(20,16,30,.6)', zIndex: 46 }} />}
      {v.src && (
        <div style={!video ? off : { position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 'min(96vw, 1100px)', zIndex: 47, borderRadius: 24, overflow: 'hidden', background: 'var(--card)', boxShadow: '0 24px 64px rgba(0,0,0,.45)' }}>
          <iframe ref={v.frame} title="Workout video" src={v.src} onLoad={v.onLoad} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen
            style={{ display: 'block', width: '100%', aspectRatio: '16 / 9', maxHeight: '78dvh', border: 0, background: '#000' }} />
          {video && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 18, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{video.title}</div>
                {v.needTap && <div style={{ fontSize: 13, color: 'var(--late)', fontWeight: 600 }}>Tap ▶ on the video once. After that, videos start by themselves.</div>}
              </div>
              <button className="btn small" onClick={closeVideo}>Close</button>
            </div>)}
        </div>)}
    </MediaCtx.Provider>
  )
}
