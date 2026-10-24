/** Turns a pasted YouTube or Spotify link into an embeddable player URL (or null). */
export function embedUrl(link: string): { kind: 'youtube' | 'spotify'; src: string } | null {
  let u: URL
  try { u = new URL(link.trim()) } catch { return null }
  const h = u.hostname.replace(/^www\.|^m\./, '')
  if (h === 'youtu.be') { const id = u.pathname.slice(1); return id ? { kind: 'youtube', src: `https://www.youtube-nocookie.com/embed/${id}?playsinline=1&rel=0` } : null }
  if (h === 'youtube.com' || h === 'music.youtube.com') {
    const list = u.searchParams.get('list')
    const v = u.searchParams.get('v') || (/^\/(shorts|embed|live)\//.test(u.pathname) ? u.pathname.split('/')[2] : '')
    if (v) return { kind: 'youtube', src: `https://www.youtube-nocookie.com/embed/${v}?playsinline=1&rel=0${list ? '&list=' + list : ''}` }
    if (list) return { kind: 'youtube', src: `https://www.youtube-nocookie.com/embed/videoseries?list=${list}&playsinline=1&rel=0` }
    return null
  }
  if (h === 'open.spotify.com') {
    const m = u.pathname.replace(/^\/intl-[a-z-]+/, '').match(/^\/(track|album|playlist|episode|show|artist)\/([A-Za-z0-9]+)/)
    return m ? { kind: 'spotify', src: `https://open.spotify.com/embed/${m[1]}/${m[2]}` } : null
  }
  return null
}
