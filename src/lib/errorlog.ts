export interface LoggedError { at: string; where: string; message: string }
const KEY = 'hsh.errors', SEEN = 'hsh.errors.seen'
const read = (): LoggedError[] => { try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] } }
export const getErrors = read
export function logError(where: string, e: unknown) {
  const message = e instanceof Error ? e.message : typeof e === 'string' ? e : JSON.stringify(e)
  const list = [{ at: new Date().toISOString(), where, message: message.slice(0, 400) }, ...read()].slice(0, 50)
  try { localStorage.setItem(KEY, JSON.stringify(list)) } catch { /* ignore */ }
  window.dispatchEvent(new Event('hsh-errors'))
}
export const clearErrors = () => { try { localStorage.removeItem(KEY) } catch { /* ignore */ } window.dispatchEvent(new Event('hsh-errors')) }
export const markSeen = () => { try { localStorage.setItem(SEEN, new Date().toISOString()) } catch { /* ignore */ } window.dispatchEvent(new Event('hsh-errors')) }
export function unseenCount(): number {
  let seen = ''; try { seen = localStorage.getItem(SEEN) || '' } catch { /* ignore */ }
  return read().filter(e => e.at > seen).length
}
export function installGlobalHandlers() {
  window.addEventListener('error', ev => logError('App', ev.message))
  window.addEventListener('unhandledrejection', ev => logError('App', (ev.reason && (ev.reason.message || String(ev.reason))) || 'Unknown problem'))
}
