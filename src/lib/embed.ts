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

/** The YouTube video id of a link, or null (playlists and other sites return null). */
export function youtubeId(link: string): string | null {
  let u: URL
  try { u = new URL(link.trim()) } catch { return null }
  const h = u.hostname.replace(/^www\.|^m\./, '')
  if (h === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null
  if (h === 'youtube.com' || h === 'music.youtube.com') return u.searchParams.get('v') || (/^\/(shorts|embed|live)\//.test(u.pathname) ? u.pathname.split('/')[2] : null) || null
  return null
}

/** Player address for the media dock. Songs after the first play on automatically (YouTube only). */
export function playerSrc(link: string, then: string[] = []): { kind: 'youtube' | 'spotify'; src: string } | null {
  const id = youtubeId(link)
  if (id) {
    const rest = then.map(youtubeId).filter((x): x is string => !!x && x !== id)
    return { kind: 'youtube', src: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1&rel=0&enablejsapi=1${rest.length ? '&playlist=' + rest.join(',') : ''}` }
  }
  const e = embedUrl(link)
  if (!e) return null
  return { kind: e.kind, src: e.kind === 'youtube' ? e.src + '&autoplay=1&enablejsapi=1' : e.src }
}
