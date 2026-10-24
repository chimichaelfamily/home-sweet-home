/** Reads a photo from the iPad, shrinks it, and returns a small JPEG data URL. square = centre-crop for faces. */
export async function fileToDataUrl(file: File, max = 1000, square = false): Promise<string> {
  const bmp = await createImageBitmap(file)
  const c = document.createElement('canvas')
  const ctx = c.getContext('2d')!
  if (square) {
    const side = Math.min(bmp.width, bmp.height), size = Math.min(max, side)
    c.width = size; c.height = size
    ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size)
  } else {
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height))
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k)
    ctx.drawImage(bmp, 0, 0, c.width, c.height)
  }
  return c.toDataURL('image/jpeg', square ? 0.85 : 0.72)
}

/** Weather condition group from an Open-Meteo weather code. */
export type Sky = 'clear' | 'partly' | 'cloudy' | 'fog' | 'rain' | 'storm' | 'snow'
export function skyOf(code: number): Sky {
  if (code === 0 || code === 1) return 'clear'
  if (code === 2) return 'partly'
  if (code === 3) return 'cloudy'
  if (code === 45 || code === 48) return 'fog'
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain'
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow'
  if (code >= 95) return 'storm'
  return 'cloudy'
}
