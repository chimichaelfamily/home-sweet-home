// One place that plays videos and music for the whole app, so playback keeps going when you change tabs.
// The players are fixed on screen: a video sits over its spot on the Affirmation page, or shrinks to the corner.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { playerSrc } from './lib/embed.ts'

export interface Media { id: string; title: string; kind: 'youtube' | 'spotify'; src: string }
interface Ctx {
  video: Media | null; music: Media | null
  playVideo: (id: string, title: string, url: string) => void
  playMusic: (id: string, title: string, url: string, then?: string[]) => void
  stop: (which: 'video' | 'music') => void
  setSlot: (el: HTMLElement | null) => void
}
const MediaCtx = createContext<Ctx | null>(null)
export const useMedia = () => useContext(MediaCtx)!

export function MediaProvider({ children }: { children: ReactNode }) {
  const [video, setVideo] = useState<Media | null>(null)
  const [music, setMusic] = useState<Media | null>(null)
  const slot = useRef<HTMLElement | null>(null)
  const [, bump] = useState(0)
  const playVideo = useCallback((id: string, title: string, url: string) => { const p = playerSrc(url); if (p) setVideo({ id, title, ...p }) }, [])
  const playMusic = useCallback((id: string, title: string, url: string, then: string[] = []) => { const p = playerSrc(url, then); if (p) setMusic({ id, title, ...p }) }, [])
  const stop = useCallback((w: 'video' | 'music') => (w === 'video' ? setVideo(null) : setMusic(null)), [])
  const setSlot = useCallback((el: HTMLElement | null) => { slot.current = el; bump(n => n + 1) }, [])
  return (
    <MediaCtx.Provider value={{ video, music, playVideo, playMusic, stop, setSlot }}>
      {children}
      <Dock video={video} music={music} slot={slot} stop={stop} />
    </MediaCtx.Provider>
  )
}

const send = (f: HTMLIFrameElement | null, func: 'pauseVideo' | 'playVideo') => f?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args: [] }), '*')

function Dock({ video, music, slot, stop }: { video: Media | null; music: Media | null; slot: React.MutableRefObject<HTMLElement | null>; stop: (w: 'video' | 'music') => void }) {
  const vf = useRef<HTMLIFrameElement>(null), mf = useRef<HTMLIFrameElement>(null)
  const [box, setBox] = useState<{ top: number; left: number; width: number; height: number; clip: string } | null>(null)
  const [paused, setPaused] = useState<{ video: boolean; music: boolean }>({ video: false, music: false })
  useEffect(() => setPaused(p => ({ ...p, video: false })), [video?.id])
  useEffect(() => setPaused(p => ({ ...p, music: false })), [music?.id, music?.src])
  // Follow the video's spot on the Affirmation page (it scrolls), every frame.
  useEffect(() => {
    if (!video) { setBox(null); return }
    let raf = 0
    const tick = () => {
      const el = slot.current
      if (el && el.isConnected && el.offsetParent) {
        const r = el.getBoundingClientRect()
        const boxes = [el.closest('.scroll'), el.closest('.main')].filter((x): x is HTMLElement => !!x).map(x => x.getBoundingClientRect())
        const area = { top: Math.max(0, ...boxes.map(b => b.top)), bottom: Math.min(innerHeight, ...boxes.map(b => b.bottom)) }
        const visible = r.bottom > area.top && r.top < area.bottom && r.width > 0
        if (visible) {
          const clip = `inset(${Math.max(0, area.top - r.top)}px 0px ${Math.max(0, r.bottom - area.bottom)}px 0px round 16px)`
          setBox(b => (b && b.top === r.top && b.left === r.left && b.width === r.width && b.height === r.height && b.clip === clip ? b : { top: r.top, left: r.left, width: r.width, height: r.height, clip }))
        } else setBox(b => (b === null ? b : null))
      } else setBox(b => (b === null ? b : null))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [video, slot])
  const mini = !box
  const toggle = (w: 'video' | 'music') => { const f = w === 'video' ? vf.current : mf.current; send(f, paused[w] ? 'playVideo' : 'pauseVideo'); setPaused({ ...paused, [w]: !paused[w] }) }
  const bar = (w: 'video' | 'music', m: Media) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: 'var(--card)' }}>
      <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ink)' }}>{m.title}</span>
      {m.kind === 'youtube' && <button className="dock-btn" aria-label={paused[w] ? 'Play' : 'Pause'} onClick={() => toggle(w)}>{paused[w] ? '▶' : '❚❚'}</button>}
      <button className="dock-btn" aria-label="Stop" onClick={() => stop(w)}>✕</button>
    </div>
  )
  return (
    <>
      {video && (
        <div className={mini ? 'dock-card' : ''} style={mini
          ? { position: 'fixed', right: 16, bottom: music ? 172 : 96, width: 260, zIndex: 40 }
          : { position: 'fixed', top: box!.top, left: box!.left, width: box!.width, height: box!.height, clipPath: box!.clip, zIndex: 5, borderRadius: 16, overflow: 'hidden', background: '#000' }}>
          <iframe ref={vf} key={video.id + video.src} title={video.title} src={video.src} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen
            style={{ display: 'block', width: '100%', height: mini ? 146 : '100%', border: 0, background: '#000' }} />
          {mini && bar('video', video)}
        </div>)}
      {music && (
        <div className="dock-card" style={{ position: 'fixed', right: 16, bottom: 96, width: 300, zIndex: 40, display: 'flex', alignItems: 'center' }}>
          <iframe ref={mf} key={music.id + music.src} title={music.title} src={music.src} allow="autoplay; encrypted-media; clipboard-write"
            style={{ display: 'block', width: music.kind === 'spotify' ? 150 : 112, height: music.kind === 'spotify' ? 80 : 63, border: 0, background: '#000', flex: 'none' }} />
          <div style={{ flex: 1, minWidth: 0 }}>{bar('music', music)}</div>
        </div>)}
    </>
  )
}

/** The big spot where the current workout video shows on the Affirmation page. */
export function VideoSlot() {
  const { setSlot, video } = useMedia()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { setSlot(ref.current); return () => setSlot(null) }, [setSlot])
  return <div ref={ref} style={{ width: '100%', aspectRatio: '16 / 9', borderRadius: 16, background: video ? '#000' : 'var(--ground)' }} />
}
