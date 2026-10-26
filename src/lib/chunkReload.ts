export function isChunkLoadError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const message = err.message
  return message.includes('Failed to fetch dynamically imported module')
    || message.includes('Importing a module script failed')
    || message.includes('error loading dynamically imported module')
}

/** Full-page navigation into `path`, once per path for this tab. */
export function reloadOnceForChunkError(err: unknown, path: string): boolean {
  if (!isChunkLoadError(err)) return false
  const key = `eypi_chunk_reload:${path}`
  if (sessionStorage.getItem(key)) return false
  sessionStorage.setItem(key, '1')
  window.location.assign(path)
  return true
}
